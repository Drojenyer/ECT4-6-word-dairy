/**
 * 把仓库 data/ 下的词库数据同步到 mobile/public/data/，供移动端首次运行时
 * 播种进 IndexedDB。
 *
 * 桌面端把这些文件放在 resources/app/data 下由 Express 读取；
 * 移动端没有服务端，改为随 Web 资源一起打包，启动时 fetch 后写入 IndexedDB。
 *
 * 文件名统一改成 ASCII，避免 URL 里出现中文需要转义。
 * 同时生成 manifest.json，内含按内容计算的版本号，用于判断是否需要重新播种。
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const mobileDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(mobileDir, '..');
const sourceDir = path.join(repoRoot, 'data');
const targetDir = path.join(mobileDir, 'public', 'data');

const FILES = [
  { source: '3-CET4-顺序.json', target: 'cet4.json' },
  { source: '4-CET6-顺序.json', target: 'cet6.json' },
  { source: 'cet4-phonetic.json', target: 'phonetic-cet4.json' },
  { source: 'cet6-phonetic.json', target: 'phonetic-cet6.json' },
  { source: 'high_freq_words.json', target: 'highfreq.json' }
];

async function sync() {
  await fs.mkdir(targetDir, { recursive: true });

  const hash = crypto.createHash('sha1');
  const files = [];

  for (const file of FILES) {
    const content = await fs.readFile(path.join(sourceDir, file.source));

    await fs.writeFile(path.join(targetDir, file.target), content);

    hash.update(file.target);
    hash.update(crypto.createHash('sha1').update(content).digest());
    files.push({ name: file.target, size: content.length });
  }

  const manifest = {
    version: hash.digest('hex').slice(0, 12),
    files
  };

  await fs.writeFile(
    path.join(targetDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  const total = files.reduce((sum, item) => sum + item.size, 0);
  console.log(`已同步 ${files.length} 个数据文件到 public/data（${(total / 1024 / 1024).toFixed(1)} MB）`);
  console.log(`数据版本: ${manifest.version}`);
}

sync().catch(error => {
  console.error('同步词库数据失败:', error.message);
  process.exit(1);
});
