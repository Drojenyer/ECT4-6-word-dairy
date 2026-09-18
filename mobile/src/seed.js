/**
 * 首次启动的播种逻辑：把随包发布的词库数据写入 IndexedDB。
 *
 * 桌面端由 Express 在每次请求时读取 JSON 并缓存；移动端没有服务端，
 * 改为把数据文件作为 Web 资源随包发布，首启时一次性导入数据库。
 * 之后读取走索引查询，比每次都解析 12MB JSON 快得多。
 *
 * 数据文件按内容算出的版本号写在 manifest.json 里，
 * 版本变了才重新播种（清空后重建，避免词表删词后留下残留）。
 */
import { db, META_KEYS } from './db.js';

const DATA_BASE = './data';

// 每个词库文件的来源与目标级别
const VOCAB_FILES = [
  { file: 'cet4.json', level: 'CET4' },
  { file: 'cet6.json', level: 'CET6' }
];

const PHONETIC_FILES = ['phonetic-cet4.json', 'phonetic-cet6.json'];

// 单次写入条数，避免一个事务里塞太多记录导致卡顿
const CHUNK_SIZE = 1000;

async function fetchJson(fileName) {
  const response = await fetch(`${DATA_BASE}/${fileName}`);

  if (!response.ok) {
    throw new Error(`加载数据文件 ${fileName} 失败（HTTP ${response.status}）`);
  }

  return response.json();
}

async function bulkPutChunked(table, rows) {
  for (let index = 0; index < rows.length; index += CHUNK_SIZE) {
    await table.bulkPut(rows.slice(index, index + CHUNK_SIZE));
  }
}

/**
 * 原始词库是 { word, translations: [{ translation }], phrases }。
 *
 * 源文件由多份词表拼接而成，同一个单词会出现 2～3 次、释义各有侧重，
 * 直接入库会导致一局里重复考同一个词、干扰项是同词的其他释义。
 * 这里按单词合并：释义去重拼接、词组去重，并清理多余的空白。
 * CET4 7508 条 → 4544 个词，CET6 5651 条 → 3992 个词。
 */
function normalizeVocab(items, level) {
  const merged = new Map();

  items.forEach(item => {
    if (!item || !item.word) {
      return;
    }

    const meanings = (item.translations || [])
      .map(t => String((t && t.translation) || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    const phrases = (item.phrases || []).filter(Boolean);
    const existing = merged.get(item.word);

    if (existing) {
      meanings.forEach(meaning => {
        if (!existing.meanings.includes(meaning)) {
          existing.meanings.push(meaning);
        }
      });

      const seen = new Set(existing.phrases.map(p => JSON.stringify(p)));
      phrases.forEach(phrase => {
        const key = JSON.stringify(phrase);
        if (!seen.has(key)) {
          seen.add(key);
          existing.phrases.push(phrase);
        }
      });

      return;
    }

    merged.set(item.word, {
      word: item.word,
      meanings: [...new Set(meanings)],
      phrases: [...phrases]
    });
  });

  return [...merged.values()].map(row => ({
    word: row.word,
    translation: row.meanings.join('；'),
    level,
    phrases: row.phrases
  }));
}

async function seedVocab(onStep) {
  for (const { file, level } of VOCAB_FILES) {
    onStep(`正在导入 ${level} 词库…`);
    const rows = normalizeVocab(await fetchJson(file), level);
    await bulkPutChunked(db.vocab, rows);
  }
}

async function seedPhonetics(onStep) {
  onStep('正在导入音标词典…');
  const merged = new Map();

  for (const file of PHONETIC_FILES) {
    const items = await fetchJson(file);

    items.forEach(item => {
      const word = item && item.word ? String(item.word).trim().toLowerCase() : '';
      const phonetic = item && item.phonetic ? String(item.phonetic).trim() : '';

      // 两份词典有重叠，先出现的为准
      if (word && phonetic && !merged.has(word)) {
        merged.set(word, { word, phonetic });
      }
    });
  }

  await bulkPutChunked(db.phonetics, [...merged.values()]);
}

async function seedHighFreq(onStep) {
  onStep('正在导入高频词表…');
  const parsed = await fetchJson('highfreq.json');
  const rows = [];

  (parsed.words || []).forEach(item => {
    if (item && item.word) {
      rows.push({
        word: String(item.word).toLowerCase(),
        frequency: (item.frequency && item.frequency.total) || 0
      });
    }
  });

  await bulkPutChunked(db.highfreq, rows);
}

/**
 * 需要时执行播种。onProgress 会收到 { step, totalSteps, label }，
 * 供启动页展示进度。
 */
export async function seedIfNeeded(onProgress = () => {}) {
  const manifest = await fetchJson('manifest.json');
  const stored = await db.meta.get(META_KEYS.SEED);

  if (stored && stored.version === manifest.version) {
    return { seeded: false, version: manifest.version };
  }

  const steps = [
    seedVocab,
    seedPhonetics,
    seedHighFreq
  ];

  let current = 0;
  const onStep = label => {
    current += 1;
    onProgress({ step: current, totalSteps: steps.length, label });
  };

  // 先清空再重建，避免词库更新后残留已删除的词条
  await db.transaction('rw', [db.vocab, db.phonetics, db.highfreq], async () => {
    await db.vocab.clear();
    await db.phonetics.clear();
    await db.highfreq.clear();
  });

  for (const step of steps) {
    await step(onStep);
  }

  await db.meta.put({
    key: META_KEYS.SEED,
    version: manifest.version,
    seeded_at: new Date().toISOString()
  });

  return { seeded: true, version: manifest.version };
}

// 提供词库统计，便于自检
export async function collectStats() {
  const [cet4, cet6, phonetics, highfreq] = await Promise.all([
    db.vocab.where('level').equals('CET4').count(),
    db.vocab.where('level').equals('CET6').count(),
    db.phonetics.count(),
    db.highfreq.count()
  ]);

  return { cet4, cet6, phonetics, highfreq };
}
