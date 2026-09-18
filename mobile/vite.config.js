import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const mobileDir = path.dirname(fileURLToPath(import.meta.url));
// 仓库根目录：移动端入口会直接引用桌面端共用的 ../src
// （quiz.js / ui.js / theme.js / 样式），保持单一源码。
const repoRoot = path.resolve(mobileDir, '..');

export default defineConfig({
  root: mobileDir,
  // Capacitor 以本地 scheme 加载页面，资源必须用相对路径
  base: './',
  publicDir: path.resolve(mobileDir, 'public'),
  server: {
    port: 5173,
    // 允许开发服务器读取 root 之外的 ../src
    fs: { allow: [repoRoot] }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020'
  }
});
