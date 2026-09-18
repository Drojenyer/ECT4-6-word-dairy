/**
 * IndexedDB 结构定义（Dexie）。
 *
 * 移动端没有后端进程，桌面端 data.json 里的数据在这里拆成按用途划分的表：
 *   - 可变状态（统计 / 设置 / 今日进度）各存一条单例记录，用 key 固定
 *   - 词库、音标、高频词表是只读静态数据，首次启动由 seed.js 写入
 *   - 错词本独立成表，可以直接按 next_review 建索引查「今天该复习哪些」
 *
 * 词库用 [level+word] 做联合主键：CET4 与 CET6 存在大量重叠词汇，
 * 只用 word 当主键会互相覆盖。
 */
import Dexie from 'dexie';

export const db = new Dexie('cet-vocab');

db.version(1).stores({
  meta: 'key',
  stats: 'key',
  settings: 'key',
  sessions: 'key',
  vocab: '[level+word], level',
  phonetics: 'word',
  highfreq: 'word',
  mistakes: 'word, next_review, added_at, stage'
});

// 单例记录统一用这个 key
export const SINGLETON_KEY = 'main';

// meta 表里的条目
export const META_KEYS = {
  SEED: 'seed'
};

export const LEVELS = ['CET4', 'CET6'];

export default db;
