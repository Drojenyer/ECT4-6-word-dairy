/**
 * 业务逻辑层：把桌面端 main.js 里的接口实现原样搬到前端。
 *
 * 桌面端靠「读文件 → 改内存 → 写回文件」并加锁串行化；
 * 移动端改用 IndexedDB 事务，天然保证原子性，不再需要锁。
 * 导入导出表单条写入，都用事务包住，避免中途失败留下半截数据。
 */
import { db, SINGLETON_KEY, META_KEYS } from './db.js';

export const DEFAULT_STATS = {
  streak_days: 0,
  total_days: 0,
  last_check_in: null,
  total_quizzes: 0,
  correct_count: 0,
  wrong_count: 0,
  mastered_words: []
};

export const DEFAULT_SETTINGS = {
  remind_enabled: true,
  remind_start: '08:00',
  remind_end: '22:00',
  quiz_mode: 'word_to_translation',
  vocab_source: 'all',
  exclude_mastered: true,
  // 高频词是否改用「见中写英」默写考察
  high_freq_spelling: true,
  daily_count: 100,
  last_tab: 'home',
  // 错题本的排列方式与显示模式
  mistake_sort: 'recent',
  mistake_layout: 'detail',
  // 外观：主题色 / 背景色 / 界面圆角 / 卡片密度
  theme_accent: 'blue',
  theme_background: 'gray',
  theme_radius: 'standard',
  theme_density: 'standard'
};

// 桌面端遗留的测验模式命名
const QUIZ_MODE_ALIASES = {
  word_to_meaning: 'word_to_translation',
  meaning_to_word: 'translation_to_word'
};

/**
 * 艾宾浩斯复习间隔（天）。
 * 错词每答对一次往后推进一个阶段，间隔逐渐拉长；
 * 走完全部阶段即视为已掌握，答错则退回第一阶段重新开始。
 */
export const REVIEW_INTERVALS = [0, 1, 2, 4, 7, 15, 30];

export function todayString() {
  return new Date().toISOString().split('T')[0];
}

// 错词加入时刻用完整时间戳，同一天加入的多个词也能分出先后
export function nowTimestamp() {
  return new Date().toISOString();
}

// dateString 既可能是 "2026-09-17"，也可能是完整时间戳，统一取日期部分计算
export function addDays(dateString, days) {
  const date = new Date(`${String(dateString).slice(0, 10)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split('T')[0];
}

export function nextReviewDate(stage, fromDate) {
  const index = Math.min(Math.max(stage, 0), REVIEW_INTERVALS.length - 1);
  return addDays(fromDate, REVIEW_INTERVALS[index]);
}

/**
 * 补齐错词的复习计划字段，旧数据缺字段时给默认值，
 * 保证排列方式和艾宾浩斯复习都能正常工作。
 */
export function normalizeWrongWord(item) {
  if (!item || !item.word) {
    return null;
  }

  const addedAt = item.added_at || todayString();
  const stage = Number.isInteger(item.stage) && item.stage >= 0 ? item.stage : 0;

  return {
    word: item.word,
    translation: item.translation || '',
    level: item.level || '',
    phrases: Array.isArray(item.phrases) ? item.phrases : [],
    added_at: addedAt,
    stage,
    wrong_count: Number(item.wrong_count) || 1,
    review_count: Number(item.review_count) || 0,
    last_review: item.last_review || null,
    next_review: item.next_review || nextReviewDate(stage, addedAt),
    graduated: typeof item.graduated === 'boolean'
      ? item.graduated
      : stage >= REVIEW_INTERVALS.length
  };
}

/* ---------- 单例记录的读写 ---------- */

async function readSingleton(table, defaults) {
  const record = await table.get(SINGLETON_KEY);
  return Object.assign({}, defaults, record ? record.value : null);
}

async function writeSingleton(table, value) {
  await table.put({ key: SINGLETON_KEY, value });
  return value;
}

/* ---------- 统计与错词 ---------- */

export async function getStats() {
  const stats = await readSingleton(db.stats, DEFAULT_STATS);
  const wrongWords = await db.mistakes.toArray();

  return Object.assign({}, stats, { wrong_words: wrongWords.map(normalizeWrongWord).filter(Boolean) });
}

export async function markMastered(word) {
  if (!word) {
    return;
  }

  await db.transaction('rw', db.stats, async () => {
    const stats = await readSingleton(db.stats, DEFAULT_STATS);
    const mastered = stats.mastered_words || [];

    if (!mastered.includes(word)) {
      mastered.push(word);
    }

    stats.mastered_words = mastered;
    await writeSingleton(db.stats, stats);
  });
}

export async function addWrongWord(word) {
  if (!word || !word.word) {
    return;
  }

  await db.transaction('rw', db.mistakes, async () => {
    const existing = await db.mistakes.get(word.word);

    // 再次答错的词直接回到第一个复习阶段，重新开始记忆曲线
    if (existing) {
      await db.mistakes.put(Object.assign({}, existing, {
        wrong_count: (existing.wrong_count || 1) + 1,
        stage: 0,
        graduated: false,
        next_review: nextReviewDate(0, todayString())
      }));
      return;
    }

    await db.mistakes.put(normalizeWrongWord({
      word: word.word,
      translation: word.translation,
      level: word.level,
      phrases: word.phrases,
      added_at: nowTimestamp(),
      stage: 0,
      wrong_count: 1
    }));
  });
}

/**
 * 错词复习结果：答对推进记忆阶段，答错退回第一阶段。
 * 借助字母提示才默写出来的算答对但不推进阶段，很快会再考一次。
 */
export async function reviewWrongWord(word, correct, hinted) {
  if (!word) {
    return null;
  }

  return db.transaction('rw', db.mistakes, async () => {
    const item = await db.mistakes.get(word);
    if (!item) {
      return null;
    }

    const today = todayString();
    item.last_review = today;
    item.review_count = (item.review_count || 0) + 1;

    if (correct && !hinted) {
      item.stage = (item.stage || 0) + 1;
      item.next_review = nextReviewDate(item.stage, today);
      item.graduated = item.stage >= REVIEW_INTERVALS.length;
    } else if (correct) {
      item.next_review = nextReviewDate(item.stage || 0, today);
    } else {
      item.stage = 0;
      item.next_review = nextReviewDate(0, today);
      item.graduated = false;
    }

    await db.mistakes.put(item);
    return item;
  });
}

export async function removeWrongWord(word) {
  await db.mistakes.delete(word);
}

export async function clearMistakes() {
  await db.mistakes.clear();
}

export async function recordResult(correct, wrong) {
  return db.transaction('rw', db.stats, async () => {
    const stats = await readSingleton(db.stats, DEFAULT_STATS);

    stats.total_quizzes = (stats.total_quizzes || 0) + 1;
    stats.correct_count = (stats.correct_count || 0) + (Number(correct) || 0);
    stats.wrong_count = (stats.wrong_count || 0) + (Number(wrong) || 0);

    return writeSingleton(db.stats, stats);
  });
}

export async function checkIn() {
  const today = todayString();

  return db.transaction('rw', db.stats, async () => {
    const stats = await readSingleton(db.stats, DEFAULT_STATS);

    if (stats.last_check_in !== today) {
      const previous = stats.last_check_in;

      if (previous) {
        const diffDays = Math.round(
          (new Date(today) - new Date(previous)) / (1000 * 60 * 60 * 24)
        );
        stats.streak_days = diffDays === 1 ? (stats.streak_days || 0) + 1 : 1;
      } else {
        stats.streak_days = 1;
      }

      stats.last_check_in = today;
      stats.total_days = (stats.total_days || 0) + 1;
    }

    return writeSingleton(db.stats, stats);
  });
}

/* ---------- 今日学习进度（断点续学） ---------- */

export async function getSession() {
  const record = await db.sessions.get(SINGLETON_KEY);
  const session = record ? record.value : null;

  return session && session.date ? session : null;
}

export async function saveSession(session) {
  if (!session || !session.date) {
    await db.sessions.delete(SINGLETON_KEY);
    return;
  }

  await db.sessions.put({ key: SINGLETON_KEY, value: session });
}

export async function clearSession() {
  await db.sessions.delete(SINGLETON_KEY);
}

/* ---------- 设置 ---------- */

export async function getSettings() {
  const settings = await readSingleton(db.settings, DEFAULT_SETTINGS);

  if (QUIZ_MODE_ALIASES[settings.quiz_mode]) {
    settings.quiz_mode = QUIZ_MODE_ALIASES[settings.quiz_mode];
  }

  return settings;
}

export async function updateSettings(patch) {
  const settings = await readSingleton(db.settings, DEFAULT_SETTINGS);
  return writeSingleton(db.settings, Object.assign(settings, patch || {}));
}

/* ---------- 静态词表 ---------- */

export async function getVocab(level) {
  const target = String(level).toUpperCase();
  return db.vocab.where('level').equals(target).toArray();
}

// 高频词表：word -> 真题出现总次数
export async function getHighFreqMap() {
  const rows = await db.highfreq.toArray();
  const map = {};

  rows.forEach(row => {
    map[row.word] = row.frequency || 0;
  });

  return map;
}

// 音标表：word -> 音标
export async function getPhoneticMap() {
  const rows = await db.phonetics.toArray();
  const map = {};

  rows.forEach(row => {
    map[row.word] = row.phonetic;
  });

  return map;
}

/* ---------- 启动初始化 ---------- */

/**
 * 首次启动补齐单例记录。
 * 必须在播种完成后调用，设置页读取时才有默认值可用。
 */
export async function ensureDefaults() {
  await db.transaction('rw', db.stats, db.settings, async () => {
    if (!(await db.stats.get(SINGLETON_KEY))) {
      await writeSingleton(db.stats, Object.assign({}, DEFAULT_STATS));
    }

    if (!(await db.settings.get(SINGLETON_KEY))) {
      await writeSingleton(db.settings, Object.assign({}, DEFAULT_SETTINGS));
    }
  });
}

/**
 * 把桌面端 data.json 的完整内容导入移动端。
 * 用于「从桌面端迁移进度」：把 PC 上的 user-data/data.json 选进来即可。
 */
export async function importLegacyData(parsed) {
  const raw = parsed || {};
  const stats = Object.assign({}, DEFAULT_STATS, raw.stats || {});
  const settings = Object.assign({}, DEFAULT_SETTINGS, raw.settings || {});

  if (raw.settings && raw.settings.level && !raw.settings.vocab_source) {
    settings.vocab_source = String(raw.settings.level).toLowerCase();
  }

  if (QUIZ_MODE_ALIASES[settings.quiz_mode]) {
    settings.quiz_mode = QUIZ_MODE_ALIASES[settings.quiz_mode];
  }

  // 旧版格式：统计数据直接放在根节点
  if (!raw.stats) {
    stats.streak_days = raw.streak_days || 0;
    stats.total_days = raw.total_checkin || 0;
    stats.last_check_in = raw.last_checkin_date || null;
    stats.mastered_words = raw.mastered_words || [];
    stats.wrong_words = raw.wrong_words || [];
  }

  const wrongWords = (stats.wrong_words || []).map(normalizeWrongWord).filter(Boolean);
  // 错词已拆到独立表，统计记录里不再保留这份数组
  const { wrong_words: _wrong, ...statOnly } = stats;

  await db.transaction('rw', [db.stats, db.settings, db.sessions, db.mistakes], async () => {
    await writeSingleton(db.stats, statOnly);
    await writeSingleton(db.settings, settings);

    await db.mistakes.clear();
    if (wrongWords.length) {
      await db.mistakes.bulkPut(wrongWords);
    }

    if (raw.session && typeof raw.session === 'object' && raw.session.date) {
      await db.sessions.put({ key: SINGLETON_KEY, value: raw.session });
    } else {
      await db.sessions.delete(SINGLETON_KEY);
    }
  });

  return { stats: statOnly, settings, wrongWords: wrongWords.length };
}
