const { app, BrowserWindow, Notification, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const express = require('express');
const fs = require('fs').promises;
const crypto = require('crypto');
const os = require('os');

let mainWindow;
let server;
let tray;
let reminderInterval;
let serverPort = 3000;
let isQuitting = false;
let closeToTray = true;
let appStartTime = 0;
let isStudying = false;
let lastReminderTime = 0;
// 窗口材质：'none' 普通底色，'acrylic' Windows 11 半透明
let windowMaterial = 'default';

// 关闭材质后窗口恢复的默认底色，与页面浅灰底保持一致
const WINDOW_BASE_COLOR = '#f6f7f9';

// 旧版把数据放在用户目录，便携版改放到程序目录旁边，拷贝整个文件夹就能带走进度
const HOME_DATA_DIR = path.join(os.homedir(), '.cet_vocab');
const HOME_DATA_FILE = path.join(HOME_DATA_DIR, 'data.json');

// 实际数据文件位置在 initDataDir() 中确定
let DATA_FILE = '';

// The local translation credential file lives beside the executable. It is
// outside resources/app and is never exposed by express.static(src).
const TRANSLATION_CONFIG_FILE = path.join(
  app.isPackaged ? path.dirname(app.getPath('exe')) : __dirname,
  'baidu-translate.local.json'
);

const DEFAULT_STATS = {
  streak_days: 0,
  total_days: 0,
  last_check_in: null,
  total_quizzes: 0,
  correct_count: 0,
  wrong_count: 0,
  mastered_words: [],
  wrong_words: [],
  // 打过卡的日期（"YYYY-MM-DD"），供统计页的打卡日历标注
  checkin_dates: [],
  // 每日学习时长（秒），形如 {"2026-09-30": 1830}
  study_time: {}
};

const DEFAULT_SETTINGS = {
  remind_enabled: true,
  remind_start: '08:00',
  remind_end: '22:00',
  quiz_mode: 'word_to_translation',
  vocab_source: 'all',
  exclude_mastered: true,
  // 高频词是否改用「见中写英」默写考察
  high_freq_spelling: true,
  close_to_tray: true,
  auto_start: false,
  // 窗口是否启用 Windows 11 亚克力材质（界面半透明，透出桌面）
  window_material: 'default',
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

// 旧版（Python 版）的测验模式命名与新版本不同
const QUIZ_MODE_ALIASES = {
  word_to_meaning: 'word_to_translation',
  meaning_to_word: 'translation_to_word'
};

/**
 * 艾宾浩斯复习间隔（天）。
 * 错词每答对一次就往后推进一个阶段，间隔逐渐拉长；
 * 走完全部阶段即视为已掌握，答错则退回第一阶段重新开始。
 */
const REVIEW_INTERVALS = [0, 1, 2, 4, 7, 15, 30];

function todayString() {
  return new Date().toISOString().split('T')[0];
}

// 错词记录加入时刻用完整时间戳，同一天加入的多个词也能分出先后
function nowTimestamp() {
  return new Date().toISOString();
}

// dateString 既可能是 "2026-09-17"，也可能是完整时间戳，统一取日期部分计算
function addDays(dateString, days) {
  const date = new Date(`${String(dateString).slice(0, 10)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split('T')[0];
}

// 错词的复习阶段对应的下一次复习日期
function nextReviewDate(stage, fromDate) {
  const interval = REVIEW_INTERVALS[Math.min(Math.max(stage, 0), REVIEW_INTERVALS.length - 1)];
  return addDays(fromDate, interval);
}

// 日历只认 "YYYY-MM-DD" 这种日期键
function isDateKey(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

// 打卡日期去重并按时间排序
function uniqueDates(list) {
  return [...new Set((list || []).filter(isDateKey))].sort();
}

/**
 * 打卡要逐日记下来，日历才知道哪几天打过卡。
 * 逐日记录是本版新增的，旧数据里没有，按可靠性依次兜底：
 *   1. 早期 Python 版存过 checkin_records，直接取它的日期；
 *   2. 只剩 last_check_in + streak_days 时，按「连续 N 天」倒推出最近这一段的日期 ——
 *      连续打卡的定义就是这 N 天每天都打了卡，所以这段是可以确定的。
 * 一旦写进数据文件就不再重算，缺失时才会补。
 */
function resolveCheckinDates(raw, stats) {
  const saved = raw.stats && Array.isArray(raw.stats.checkin_dates)
    ? uniqueDates(raw.stats.checkin_dates)
    : null;

  if (saved) {
    return saved;
  }

  if (raw.checkin_records && typeof raw.checkin_records === 'object') {
    const fromRecords = uniqueDates(Object.keys(raw.checkin_records));
    if (fromRecords.length) {
      return fromRecords;
    }
  }

  if (!isDateKey(stats.last_check_in)) {
    return [];
  }

  const streakDays = Math.max(1, Number(stats.streak_days) || 1);
  const dates = [];

  for (let i = streakDays - 1; i >= 0; i--) {
    dates.push(addDays(stats.last_check_in, -i));
  }

  return uniqueDates(dates);
}

// 记下打卡日期；同一天重复打卡不会写两条
function recordCheckinDate(stats, dateKey) {
  const dates = Array.isArray(stats.checkin_dates) ? stats.checkin_dates : [];
  stats.checkin_dates = uniqueDates(dates.concat(dateKey));
}

/**
 * 补齐错词的复习计划字段。
 * 旧数据的错词只有 word/translation/level/phrases，这里补上默认值，
 * 保证「排列方式」和艾宾浩斯复习都能正常工作。
 */
function normalizeWrongWord(item) {
  if (!item || !item.word) {
    return null;
  }

  const addedAt = item.added_at || todayString();
  const stage = Number.isInteger(item.stage) && item.stage >= 0 ? item.stage : 0;

  return {
    word: item.word,
    translation: item.translation || '',
    pos: item.pos || '',
    level: item.level || '',
    phrases: Array.isArray(item.phrases) ? item.phrases : [],
    added_at: addedAt,
    stage,
    wrong_count: Number(item.wrong_count) || 1,
    review_count: Number(item.review_count) || 0,
    intensive: typeof item.intensive === 'boolean'
      ? item.intensive
      : (Number(item.wrong_count) || 1) >= 2 && !item.graduated,
    intensive_correct: Math.max(0, Number(item.intensive_correct) || 0),
    last_review: item.last_review || null,
    next_review: item.next_review || nextReviewDate(stage, addedAt),
    graduated: typeof item.graduated === 'boolean'
      ? item.graduated
      : stage >= REVIEW_INTERVALS.length
  };
}

/**
 * 统一数据结构。
 * 旧版本把统计数据直接放在根节点、且没有 stats 字段，
 * 直接读取会导致 /api/stats 返回空内容、前端解析失败。
 * 这里做一次兼容映射，保证新旧数据都能正常使用。
 */
function normalizeData(parsed) {
  const raw = parsed || {};
  const stats = Object.assign({}, DEFAULT_STATS, raw.stats || {});
  const settings = Object.assign({}, DEFAULT_SETTINGS, raw.settings || {});

  if (!raw.stats) {
    stats.streak_days = raw.streak_days || 0;
    stats.total_days = raw.total_checkin || 0;
    stats.last_check_in = raw.last_checkin_date || null;
    stats.mastered_words = raw.mastered_words || [];
    stats.wrong_words = raw.wrong_words || [];

    if (raw.checkin_records) {
      const records = Object.values(raw.checkin_records);
      stats.total_quizzes = records.length;
      stats.correct_count = records.reduce((sum, r) => sum + (r.correct || 0), 0);
      stats.wrong_count = records.reduce(
        (sum, r) => sum + Math.max(0, (r.count || 0) - (r.correct || 0)),
        0
      );
    }
  }

  if (QUIZ_MODE_ALIASES[settings.quiz_mode]) {
    settings.quiz_mode = QUIZ_MODE_ALIASES[settings.quiz_mode];
  }

  stats.wrong_words = (stats.wrong_words || []).map(normalizeWrongWord).filter(Boolean);
  stats.checkin_dates = resolveCheckinDates(raw, stats);

  // 每日学习时长：缺失或格式不对时退回空表，避免前端读到脏数据
  if (!stats.study_time || typeof stats.study_time !== 'object' || Array.isArray(stats.study_time)) {
    stats.study_time = {};
  }

  if (raw.settings && raw.settings.level && !raw.settings.vocab_source) {
    settings.vocab_source = String(raw.settings.level).toLowerCase();
  }

  // 今日学习进度：用于关闭软件后继续上次的进度
  const session = raw.session && typeof raw.session === 'object' && raw.session.date
    ? raw.session
    : null;

  return { stats, settings, session };
}

// 目录能否写入（放 Program Files 之类的只读位置时需要回退）
async function isWritable(dir) {
  const probe = path.join(dir, `.write-probe-${Date.now()}`);

  try {
    await fs.writeFile(probe, '');
    await fs.unlink(probe);
    return true;
  } catch {
    return false;
  }
}

/**
 * 确定数据目录。
 * 便携版优先用程序（exe）同级的 user-data，写完就跟着文件夹走；
 * 该位置不可写时回退到用户目录，保证程序在任何位置都能正常记录进度。
 * 开发模式（electron .）仍用用户目录，避免把数据写进源码目录。
 */
async function resolveDataDir() {
  const candidates = app.isPackaged
    ? [path.join(path.dirname(app.getPath('exe')), 'user-data'), HOME_DATA_DIR]
    : [HOME_DATA_DIR];

  for (const dir of candidates) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch {
      continue;
    }

    if (await isWritable(dir)) {
      return dir;
    }
  }

  return candidates[candidates.length - 1];
}

// 首次以便携模式运行时，把旧版留在用户目录的数据搬过来，避免看起来「进度丢了」
async function migrateLegacyData() {
  if (path.resolve(DATA_FILE) === path.resolve(HOME_DATA_FILE)) {
    return;
  }

  try {
    await fs.access(DATA_FILE);
    return;
  } catch {
    // 便携目录里还没有数据，尝试从用户目录迁移
  }

  try {
    await fs.copyFile(HOME_DATA_FILE, DATA_FILE);
    console.log('已把旧数据迁移到:', DATA_FILE);
  } catch {
    // 用户目录也没有旧数据，属于正常首次运行
  }
}

async function initDataDir() {
  DATA_FILE = path.join(await resolveDataDir(), 'data.json');

  await migrateLegacyData();

  try {
    await fs.access(DATA_FILE);
  } catch {
    await saveData(normalizeData(null));
  }
}

async function loadData() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf-8');
    return normalizeData(JSON.parse(raw));
  } catch (error) {
    console.error('加载数据失败:', error);

    // 文件无法解析时先备份，避免后续写入把原始数据彻底覆盖掉
    try {
      await fs.rename(DATA_FILE, `${DATA_FILE}.corrupt-${Date.now()}`);
      console.error('已将损坏的数据文件备份为 .corrupt-*');
    } catch {
      // 文件不存在时无需备份
    }

    return normalizeData(null);
  }
}

// 先写临时文件再整体替换，避免写入过程中被并发请求打断而产生损坏的 JSON
async function saveData(data) {
  const tempFile = `${DATA_FILE}.tmp`;
  try {
    await fs.writeFile(tempFile, JSON.stringify(data, null, 2));
    await fs.rename(tempFile, DATA_FILE);
  } catch (error) {
    console.error('保存数据失败:', error);
  }
}

let dataLock = Promise.resolve();

/**
 * 串行化「读取 → 修改 → 写回」。
 * 之前多个请求并发读写同一个数据文件，既会互相覆盖导致进度丢失，
 * 也可能写出损坏的 JSON —— 而损坏的文件会被当作空数据加载，
 * 表现出来就是「关闭软件后学习进度被重置」。
 */
function updateData(mutator) {
  const run = dataLock.then(async () => {
    const data = await loadData();
    const result = await mutator(data);
    await saveData(data);
    return result;
  });

  dataLock = run.then(() => {}, () => {});
  return run;
}

async function loadVocab(fileName, level) {
  const content = await fs.readFile(path.join(__dirname, 'data', fileName), 'utf-8');
  return JSON.parse(content).map(item => {
    const translations = item.translations || [];
    const posSet = [...new Set(translations.map(t => t.type).filter(Boolean))];
    return {
      word: item.word,
      translation: translations.map(t => t.translation).join('；'),
      pos: posSet.join('/'),
      level,
      phrases: item.phrases || []
    };
  });

}

function sampleVocabulary(words, limit, excludedWords = new Set()) {
  const requested = Math.max(1, Number(limit) || words.length);
  const eligibleSample = [];
  const fallbackSample = [];
  let eligibleCount = 0;
  let excludedCount = 0;

  for (const item of words) {
    const eligible = !excludedWords.has(item.word);
    if (eligible) eligibleCount += 1;
    else excludedCount += 1;
    const sample = eligible ? eligibleSample : fallbackSample;
    const seen = eligible ? eligibleCount : excludedCount;
    if (sample.length < requested) sample.push(item);
    else {
      const index = Math.floor(Math.random() * seen);
      if (index < requested) sample[index] = item;
    }
  }

  return eligibleCount > 0 ? eligibleSample : fallbackSample;
}

let highFreqMapCache = null;

/**
 * 高频词表：word（小写）-> 考研/四级/六级真题出现总次数。
 * 用于判断某个错词是否高频，高频词在错词复习时改用「见中写英」默写。
 * 文件缺失时返回空表，不影响其他功能。
 */
async function loadHighFreqMap() {
  if (highFreqMapCache) {
    return highFreqMapCache;
  }

  const map = {};

  try {
    const content = await fs.readFile(path.join(__dirname, 'data', 'high_freq_words.json'), 'utf-8');
    const parsed = JSON.parse(content);

    (parsed.words || []).forEach(item => {
      if (item && item.word) {
        map[String(item.word).toLowerCase()] = (item.frequency && item.frequency.total) || 0;
      }
    });
  } catch (error) {
    console.error('加载高频词表失败:', error);
  }

  highFreqMapCache = map;
  return map;
}

let phoneticMapCache = null;

/**
 * 音标表：word（小写）-> 音标。
 * 数据来自词典文件 cet4-phonetic.json / cet6-phonetic.json，
 * 两份词表有重叠，合并时以先出现的为准。
 * 词表里查不到的单词不返回音标，前端也不显示。
 */
async function loadPhoneticMap() {
  if (phoneticMapCache) {
    return phoneticMapCache;
  }

  const map = {};

  for (const fileName of ['cet4-phonetic.json', 'cet6-phonetic.json']) {
    try {
      const content = await fs.readFile(path.join(__dirname, 'data', fileName), 'utf-8');

      JSON.parse(content).forEach(item => {
        const word = item && item.word ? String(item.word).trim().toLowerCase() : '';
        const phonetic = item && item.phonetic ? String(item.phonetic).trim() : '';

        if (word && phonetic && !map[word]) {
          map[word] = phonetic;
        }
      });
    } catch (error) {
      console.error(`加载音标文件 ${fileName} 失败:`, error);
    }
  }

  phoneticMapCache = map;
  return map;
}

let posMapCache = null;

/**
 * 词性表：word（小写）-> 词性（adv / v / n ...）。
 * 错词与续学会话里存的是历史快照，可能没有词性，
 * 前端用它把词性补齐，避免复习时看不到词性。
 */
async function loadPosMap() {
  if (posMapCache) {
    return posMapCache;
  }

  const map = {};

  for (const [fileName, level] of [['3-CET4-顺序.json', 'CET4'], ['4-CET6-顺序.json', 'CET6']]) {
    try {
      const words = await loadVocab(fileName, level);

      words.forEach(item => {
        const word = item && item.word ? String(item.word).trim().toLowerCase() : '';

        if (word && item.pos && !map[word]) {
          map[word] = item.pos;
        }
      });
    } catch (error) {
      console.error(`加载词性表 ${fileName} 失败:`, error);
    }
  }

  posMapCache = map;
  return map;
}

/**
 * 窗口亚克力材质是 Windows 11 22H2（内部版本 22621）起才有的系统能力，
 * 更早的系统上直接当作不支持，界面照常显示普通底色。
 */
function supportsWindowMaterial() {
  if (process.platform !== 'win32') {
    return false;
  }

  const build = Number(String(os.release()).split('.')[2]);
  return build >= 22621;
}

/**
 * 应用窗口材质。窗口底色要一起调成透明，
 * 否则页面下面的不透明底色会把系统材质整个盖住。
 */
function applyWindowMaterial(material) {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  const target = material === 'acrylic' && supportsWindowMaterial() ? 'acrylic' : 'none';

  try {
    mainWindow.setBackgroundMaterial(target);
    mainWindow.setBackgroundColor(target === 'acrylic' ? '#00000000' : WINDOW_BASE_COLOR);
    return material !== 'acrylic' || target === 'acrylic';
  } catch (error) {
    console.error('设置窗口材质失败:', error);
    return false;
  }
}

function createWindow() {
  const material = supportsWindowMaterial() && windowMaterial === 'acrylic' ? 'acrylic' : 'none';

  mainWindow = new BrowserWindow({
      width: 1100,
      height: 750,
      show: false,
      icon: path.join(__dirname, 'assets', 'icon.png'),
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true
      },
      frame: process.platform !== 'win32',
      thickFrame: true,
      hasShadow: true,
      // 开了亚克力材质窗口底色必须透明，否则会盖住系统材质
      backgroundColor: material === 'acrylic' ? '#00000000' : WINDOW_BASE_COLOR,
      backgroundMaterial: material
    });

  // 通过本地服务器加载页面，保证前端与后端同源，避免跨域导致接口请求失败
  mainWindow.loadURL(`http://localhost:${serverPort}/`);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  const notifyMaximizeState = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window:maximize-change', mainWindow.isMaximized());
    }
  };
  mainWindow.on('maximize', notifyMaximizeState);
  mainWindow.on('unmaximize', notifyMaximizeState);

  // 关闭窗口时最小化到系统托盘
  mainWindow.on('close', (event) => {
    if (!isQuitting && tray && closeToTray) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

function createServer() {
  const expressApp = express();
  expressApp.use(express.json({ limit: '50mb' }));

  // 允许跨域，兼容以 file:// 方式打开页面的情况
  expressApp.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  expressApp.use(express.static(path.join(__dirname, 'src')));

  expressApp.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'index.html'));
  });

  // Read credentials on each request so local configuration changes take effect
  // without copying secrets into the frontend or user learning data.
  expressApp.post('/api/translate', async (req, res) => {
    const remote = req.socket.remoteAddress || '';
    const host = req.headers.host || '';
    const origin = req.headers.origin || '';
    const allowedHost = new Set([`localhost:${serverPort}`, `127.0.0.1:${serverPort}`]);
    let sameOrigin = !origin;
    if (origin) {
      try {
        const parsed = new URL(origin);
        sameOrigin = parsed.protocol === 'http:' && allowedHost.has(parsed.host);
      } catch {
        sameOrigin = false;
      }
    }
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote)
      || !allowedHost.has(host) || !sameOrigin) {
      return res.status(403).json({ error: '仅允许本机调用翻译' });
    }
    const { text, target_lang: target } = req.body || {};
    if (typeof text !== 'string' || !text.trim() || Buffer.byteLength(text, 'utf8') > 6000
      || !['zh', 'en'].includes(target)) {
      return res.status(400).json({ error: '请输入有效的翻译文本（原文最多 6000 字节）' });
    }
    let appId;
    let key;
    try {
      const config = JSON.parse(await fs.readFile(TRANSLATION_CONFIG_FILE, 'utf8'));
      appId = typeof config.appId === 'string' ? config.appId.trim() : '';
      key = typeof config.apiKey === 'string' ? config.apiKey.trim() : '';
      if (!appId || !key || appId.length > 100 || key.length > 200) throw new Error('invalid');
    } catch {
      return res.status(503).json({ error: '未找到有效的百度翻译配置，请检查程序目录中的 baidu-translate.local.json' });
    }
    const query = text.trim();
    const salt = crypto.randomBytes(8).toString('hex');
    const sign = crypto.createHash('md5').update(`${appId}${query}${salt}${key}`, 'utf8').digest('hex');
    const form = new URLSearchParams({ q: query, from: 'auto', to: target, appid: appId, salt, sign });
    try {
      const response = await fetch('https://fanyi-api.baidu.com/api/trans/vip/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
        signal: AbortSignal.timeout(15000)
      });
      if (!response.ok) {
        return res.status(502).json({ error: `百度翻译请求失败（HTTP ${response.status}）` });
      }
      const result = await response.json();
      if (result.error_code) {
        const errors = {
          52001: '百度翻译请求超时，请稍后重试',
          52002: '百度翻译系统错误，请稍后重试',
          52003: '百度翻译未授权，请核对 APP ID 和密钥',
          54000: '百度翻译参数错误，请核对 APP ID',
          54001: '百度翻译签名错误，请核对 APP ID 和配套密钥',
          54003: '请求过于频繁，请稍后重试',
          54004: '百度翻译额度已用完',
          58000: '百度翻译客户端 IP 受限'
        };
        return res.status(502).json({ error: errors[result.error_code] || `百度翻译错误（${result.error_code}）` });
      }
      const translations = Array.isArray(result.trans_result) ? result.trans_result : [];
      return res.json({ text: translations.map(item => item.dst || '').join('\n'), source_lang: result.from });
    } catch {
      return res.status(502).json({ error: '无法连接百度翻译，请检查网络或切换其他 API' });
    }
  });

  expressApp.get('/api/stats', async (req, res) => {
    const data = await loadData();
    res.json(data.stats);
  });

  expressApp.post('/api/stats/mastered', async (req, res) => {
    const word = req.body && req.body.word;
    if (!word) {
      return res.status(400).json({ error: 'word is required' });
    }

    await updateData(data => {
      if (!data.stats.mastered_words.includes(word)) {
        data.stats.mastered_words.push(word);
      }
    });

    res.json({ success: true });
  });

  expressApp.post('/api/stats/wrong', async (req, res) => {
    const word = req.body;
    if (!word || !word.word) {
      return res.status(400).json({ error: 'word is required' });
    }

    await updateData(data => {
      const existing = data.stats.wrong_words.find(item => item.word === word.word);

      // 再次答错的词直接回到第一个复习阶段，重新开始记忆曲线
      if (existing) {
        existing.wrong_count = (existing.wrong_count || 1) + 1;
        existing.intensive = existing.wrong_count >= 2;
        existing.intensive_correct = 0;
        existing.stage = 0;
        existing.graduated = false;
        existing.next_review = nextReviewDate(0, todayString());
        return;
      }

      data.stats.wrong_words.push(normalizeWrongWord({
        word: word.word,
        translation: word.translation,
        level: word.level,
        phrases: word.phrases,
        added_at: nowTimestamp(),
        stage: 0,
        wrong_count: 1
      }));
    });

    res.json({ success: true });
  });

  // 错词复习结果：答对推进记忆阶段，答错退回第一阶段
  expressApp.post('/api/stats/wrong/review', async (req, res) => {
    const word = req.body && req.body.word;
    const isCorrect = Boolean(req.body && req.body.correct);
    // 借助字母提示才默写出来，算答对但不推进阶段，很快会再考一次
    const hinted = Boolean(req.body && req.body.hinted);

    if (!word) {
      return res.status(400).json({ error: 'word is required' });
    }

    const updated = await updateData(data => {
      const item = data.stats.wrong_words.find(entry => entry.word === word);
      if (!item) {
        return null;
      }

      const today = todayString();
      item.last_review = today;
      item.review_count = (item.review_count || 0) + 1;

      if (isCorrect && !hinted) {
        if (item.intensive) {
          item.intensive_correct = (item.intensive_correct || 0) + 1;
          if (item.intensive_correct >= 3) item.intensive = false;
        }
        item.stage = (item.stage || 0) + 1;
        item.next_review = nextReviewDate(item.stage, today);
        item.graduated = item.stage >= REVIEW_INTERVALS.length;
      } else if (isCorrect) {
        item.next_review = nextReviewDate(item.stage || 0, today);
      } else {
        item.stage = 0;
        item.next_review = nextReviewDate(0, today);
        item.graduated = false;
      }

      return item;
    });

    res.json({ success: true, item: updated });
  });

  expressApp.delete('/api/stats/wrong/:word', async (req, res) => {
    const word = req.params.word;

    await updateData(data => {
      data.stats.wrong_words = data.stats.wrong_words.filter(item => item.word !== word);
    });

    res.json({ success: true });
  });

  expressApp.post('/api/stats/result', async (req, res) => {
    const correct = Number(req.body && req.body.correct) || 0;
    const wrong = Number(req.body && req.body.wrong) || 0;

    const stats = await updateData(data => {
      data.stats.total_quizzes = (data.stats.total_quizzes || 0) + 1;
      data.stats.correct_count = (data.stats.correct_count || 0) + correct;
      data.stats.wrong_count = (data.stats.wrong_count || 0) + wrong;
      return data.stats;
    });

    res.json({ success: true, stats });
  });

  // 学习时长：前端按「停在学习页 + 有操作」累计，每隔一段分批上报
  expressApp.post('/api/stats/study', async (req, res) => {
    const seconds = Math.max(0, Math.round(Number(req.body && req.body.seconds) || 0));

    if (!seconds) {
      return res.json({ success: true });
    }

    const stats = await updateData(data => {
      if (!data.stats.study_time || typeof data.stats.study_time !== 'object') {
        data.stats.study_time = {};
      }

      const today = todayString();
      data.stats.study_time[today] = (Number(data.stats.study_time[today]) || 0) + seconds;
      return data.stats;
    });

    res.json({ success: true, stats });
  });

  /* ---------- 今日学习进度（断点续学） ---------- */

  expressApp.get('/api/session', async (req, res) => {
    const data = await loadData();
    res.json(data.session || null);
  });

  expressApp.post('/api/session', async (req, res) => {
    const session = req.body && req.body.date ? req.body : null;
    await updateData(data => {
      data.session = session;
    });
    res.json({ success: true });
  });

  expressApp.delete('/api/session', async (req, res) => {
    await updateData(data => {
      data.session = null;
    });
    res.json({ success: true });
  });

  expressApp.get('/api/settings', async (req, res) => {
    const data = await loadData();
    res.json(data.settings);
  });

  expressApp.post('/api/settings', async (req, res) => {
    await updateData(data => Object.assign(data.settings, req.body));
    res.json({ success: true });
  });

  // 高频词表，供前端判断错词是否走默写模式。
  // 注意要注册在 /api/vocab/:level 之前，否则会被通配路由吃掉。
  expressApp.get('/api/vocab/highfreq', async (req, res) => {
    res.json(await loadHighFreqMap());
  });

  // 音标表，同样要注册在通配路由之前
  expressApp.get('/api/vocab/phonetics', async (req, res) => {
    res.json(await loadPhoneticMap());
  });

  // 词性表，同样要注册在通配路由之前
  expressApp.get('/api/vocab/pos', async (req, res) => {
    res.json(await loadPosMap());
  });

  // 词库原始格式为 { word, translations: [{ translation, type }], phrases }，
  // 这里统一转换成前端直接可用的结构（translation 为字符串、补充 level），
  // 仅返回本局所需词条，避免向渲染进程传输整套词库。
  expressApp.get('/api/vocab/:level', async (req, res) => {
    const level = String(req.params.level).toUpperCase();
    const files = { CET4: '3-CET4-顺序.json', CET6: '4-CET6-顺序.json' };

    if (!files[level]) {
      return res.status(404).json({ error: 'Unknown vocabulary level' });
    }

    try {
      const words = await loadVocab(files[level], level);
      const limit = Math.min(Math.max(1, Number(req.query.limit) || words.length), words.length);
      const data = await loadData();
      const mastered = new Set(data.stats && Array.isArray(data.stats.mastered_words)
        ? data.stats.mastered_words : []);
      res.json(sampleVocabulary(words, limit, req.query.exclude_mastered === 'false' ? new Set() : mastered));
    } catch (error) {
      console.error('词库加载失败:', error);
      res.status(500).json({ error: 'Failed to load vocabulary' });
    }
  });

  expressApp.post('/api/checkin', async (req, res) => {
    const today = new Date().toISOString().split('T')[0];

    const stats = await updateData(data => {
      if (data.stats.last_check_in !== today) {
        const previousCheckIn = data.stats.last_check_in;

        if (previousCheckIn) {
          const lastDate = new Date(previousCheckIn);
          const todayDate = new Date(today);
          const diffDays = Math.round((todayDate - lastDate) / (1000 * 60 * 60 * 24));

          if (diffDays === 1) {
            data.stats.streak_days = (data.stats.streak_days || 0) + 1;
          } else {
            data.stats.streak_days = 1;
          }
        } else {
          data.stats.streak_days = 1;
        }

        data.stats.last_check_in = today;
        data.stats.total_days = (data.stats.total_days || 0) + 1;
      }

      // 逐日记录打卡日期，供统计页的日历标注
      recordCheckinDate(data.stats, today);

      return data.stats;
    });

    res.json({ success: true, stats });
  });

  expressApp.delete('/api/mistakes', async (req, res) => {
    await updateData(data => {
      data.stats.wrong_words = [];
    });
    res.json({ success: true });
  });

  return new Promise((resolve) => {
    server = expressApp.listen(serverPort, () => {
      console.log(`Server running on http://localhost:${serverPort}`);
      resolve();
    });

    // 端口被占用时自动切换到随机可用端口
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        server = expressApp.listen(0, () => {
          serverPort = server.address().port;
          console.log(`Port 3000 occupied, switched to http://localhost:${serverPort}`);
          resolve();
        });
      } else {
        console.error('服务器启动失败:', error);
        resolve();
      }
    });
  });
}

// 创建系统托盘图标与菜单
function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray.png');
  let trayIcon = nativeImage.createFromPath(iconPath);

  if (trayIcon.isEmpty()) {
    trayIcon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon.png'));
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('英语四六级词汇学习平台');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主界面',
      click: () => showMainWindow()
    },
    {
      label: '隐藏主界面',
      click: () => {
        if (mainWindow) mainWindow.hide();
      }
    },
    { type: 'separator' },
    {
      label: '开始学习',
      click: () => {
        showMainWindow();
        if (mainWindow) mainWindow.webContents.send('start-quiz');
      }
    },
    { type: 'separator' },
    {
      label: '开机自启动',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (menuItem) => setAutoStart(menuItem.checked)
    },
    {
      label: '关闭窗口时最小化到托盘',
      type: 'checkbox',
      checked: closeToTray,
      click: (menuItem) => {
        closeToTray = menuItem.checked;
        saveDataSafe({ close_to_tray: closeToTray });
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  // 双击托盘图标恢复窗口
  tray.on('double-click', () => showMainWindow());
}

function showMainWindow() {
  if (!mainWindow) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function setAutoStart(enabled) {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath
  });
  saveDataSafe({ auto_start: enabled });
  return app.getLoginItemSettings().openAtLogin;
}

async function saveDataSafe(partialSettings) {
  await updateData(data => {
    data.settings = Object.assign({}, data.settings, partialSettings);
  });
}

// 右下角系统通知
function showNotification(title, body) {
  if (!Notification.isSupported()) {
    return false;
  }

  const notification = new Notification({
    title,
    body,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    silent: false
  });

  notification.on('click', () => {
    showMainWindow();
    if (mainWindow) mainWindow.webContents.send('start-quiz');
  });

  notification.show();
  return true;
}

function showReminderNotification() {
  const now = Date.now();

  // 打开软件后 5 分钟内不弹窗
  if (now - appStartTime < 5 * 60 * 1000) return;

  // 正在学习中不弹窗
  if (isStudying) return;

  // 上次弹窗后 30 分钟内不重复弹窗
  if (lastReminderTime && now - lastReminderTime < 30 * 60 * 1000) return;

  loadData().then(data => {
    const settings = data.settings || {};
    const stats = data.stats || {};

    if (!settings.remind_enabled) return;

    const today = new Date().toISOString().split('T')[0];
    if (stats.last_check_in === today) return;

    const now2 = new Date();
    const currentHour = now2.getHours();
    const currentMinute = now2.getMinutes();

    const [startHour, startMinute] = settings.remind_start.split(':').map(Number);
    const [endHour, endMinute] = settings.remind_end.split(':').map(Number);

    const startTime = startHour * 60 + startMinute;
    const endTime = endHour * 60 + endMinute;
    const currentTimeMinutes = currentHour * 60 + currentMinute;

    if (currentTimeMinutes < startTime || currentTimeMinutes > endTime) return;

    showNotification(
      '学习提醒',
      `今日还未打卡学习！连续打卡 ${stats.streak_days || 0} 天，继续加油！`
    );
    lastReminderTime = Date.now();
  });
}

function startReminderCheck() {
  // 每 5 分钟检查一次，但实际弹窗间隔由 lastReminderTime 控制为 30 分钟
  reminderInterval = setInterval(() => {
    showReminderNotification();
  }, 5 * 60 * 1000);
}

function stopReminderCheck() {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }
}

// 注册渲染进程可调用的接口
function registerIpcHandlers() {
  ipcMain.handle('window:minimize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize();
    return { success: true };
  });

  ipcMain.handle('window:toggle-maximize', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return { isMaximized: false };
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
    return { isMaximized: mainWindow.isMaximized() };
  });

  ipcMain.handle('window:get-state', () => ({
    isMaximized: !!(mainWindow && !mainWindow.isDestroyed() && mainWindow.isMaximized())
  }));

  ipcMain.handle('window:close', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
    return { success: true };
  });

  // 测试通知 / 自定义通知
  ipcMain.handle('app:test-notification', async (event, payload = {}) => {
    let title = payload.title;
    let body = payload.body;

    if (!title || !body) {
      const data = await loadData();
      const stats = data.stats || {};
      title = title || '学习提醒';
      body = body || `今日还未打卡学习！连续打卡 ${stats.streak_days || 0} 天，继续加油！`;
    }

    const ok = showNotification(title, body);
    return { success: ok };
  });

  // 读取系统相关设置
  ipcMain.handle('app:get-system-settings', () => ({
    autoStart: app.getLoginItemSettings().openAtLogin,
    closeToTray,
    windowMaterial,
    transparentTitlebar: windowMaterial === 'transparent',
    materialSupported: supportsWindowMaterial(),
    version: app.getVersion()
  }));

  // 窗口透明材质：改完立即生效，不用重启
  ipcMain.handle('app:set-window-material', async (event, material) => {
    windowMaterial = ['default', 'acrylic', 'transparent'].includes(material) ? material : 'default';
    const applied = applyWindowMaterial(windowMaterial);
    await saveDataSafe({ window_material: windowMaterial });
    return { success: true, windowMaterial, applied };
  });

  // 开机自启动
  ipcMain.handle('app:set-auto-start', (event, enabled) => ({
    success: true,
    autoStart: setAutoStart(!!enabled)
  }));

  // 关闭窗口时是否最小化到托盘
  ipcMain.handle('app:set-close-to-tray', async (event, enabled) => {
    closeToTray = !!enabled;
    await saveDataSafe({ close_to_tray: closeToTray });
    return { success: true, closeToTray };
  });

  // 手动隐藏到托盘
  ipcMain.handle('app:hide-to-tray', () => {
    if (mainWindow) mainWindow.hide();
    return { success: true };
  });

  // 退出应用
  ipcMain.handle('app:quit', () => {
    isQuitting = true;
    app.quit();
    return { success: true };
  });

  // 标记学习状态：学习时抑制提醒弹窗
  ipcMain.handle('app:set-studying', (event, studying) => {
    isStudying = !!studying;
    return { success: true };
  });
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showMainWindow();
  });

  app.whenReady().then(async () => {
    await initDataDir();

    const data = await loadData();
    if (data.settings && typeof data.settings.close_to_tray === 'boolean') {
      closeToTray = data.settings.close_to_tray;
    }

    // 窗口材质要在建窗前读出来，材质只能随窗口一起创建
    const savedMaterial = data.settings && data.settings.window_material;
    windowMaterial = ['acrylic', 'transparent'].includes(savedMaterial) ? savedMaterial : 'default';

    // 移除 Electron 默认菜单栏，保持界面简洁
    Menu.setApplicationMenu(null);

    await createServer();
    createTray();
    registerIpcHandlers();
    createWindow();
    appStartTime = Date.now();
    startReminderCheck();
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  stopReminderCheck();
  if (server) {
    server.close();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    showMainWindow();
  }
});
