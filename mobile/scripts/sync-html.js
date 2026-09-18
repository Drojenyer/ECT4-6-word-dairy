/**
 * 由桌面端的 src/index.html 生成移动端入口 HTML。
 *
 * 页面结构完全复用（底部标签栏靠 mobile.css 把侧边栏重排实现，不动 DOM），
 * 只做三处移动端改动：
 *   1. 共享样式路径补上 ../src 前缀，追加 mobile.css
 *   2. viewport 加上 viewport-fit=cover，支持刘海屏安全区
 *   3. 六个 <script src> 合并为单一 ES 模块入口
 *
 * 生成物 mobile/index.html 不进版本库，避免与 src/index.html 出现两份实现。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const mobileDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(mobileDir, '..');
const sourceFile = path.join(repoRoot, 'src', 'index.html');
const targetFile = path.join(mobileDir, 'index.html');

function generate() {
  let html = fs.readFileSync(sourceFile, 'utf-8');

  // 共享样式位于 src/styles，移动端入口在 mobile/ 下，需要补一层目录
  html = html.replace(/href="styles\//g, 'href="../src/styles/');

  // 适配刘海屏与状态栏
  html = html.replace(
    /<meta name="viewport"[^>]*>/,
    '<meta name="viewport" content="width=device-width, initial-scale=1.0, '
      + 'maximum-scale=1.0, user-scalable=no, viewport-fit=cover">'
  );

  html = html.replace('</head>', [
    '    <meta name="theme-color" content="#4c8bf5">',
    '    <meta name="mobile-web-app-capable" content="yes">',
    '    <meta name="apple-mobile-web-app-capable" content="yes">',
    '    <link rel="stylesheet" href="./src/styles/mobile.css">',
    '</head>'
  ].join('\n'));

  // 桌面端逐个加载的全局脚本，这里换成模块入口（内部按相同顺序 import）
  html = html.replace(/^[ \t]*<script src="js\/[^"]+"><\/script>[ \t]*\r?\n/gm, '');
  html = html.replace('</body>', [
    '    <script type="module" src="./src/main.js"></script>',
    '</body>'
  ].join('\n'));

  fs.writeFileSync(targetFile, html);
  console.log(`已生成 ${path.relative(repoRoot, targetFile)}`);
}

generate();
