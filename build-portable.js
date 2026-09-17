/**
 * 打包成免安装便携版。
 *
 * 不用 electron-packager / electron-builder：
 *   - electron-packager 在新版 Node 下解压 Electron 压缩包时会卡住不动；
 *   - electron-builder 需要解压含 macOS 符号链接的 winCodeSign，需要管理员权限。
 * 这里直接拿 node_modules/electron/dist 里已解压好的 Electron 运行时组装，
 * 全程只是文件复制，稳定、快速、无需联网。
 *
 * 用法：
 *   node build-portable.js             # 输出到 dist/
 *   node build-portable.js E:\某个目录   # 输出到指定目录
 */
const path = require('path');
const fs = require('fs').promises;
const { execFileSync } = require('child_process');

const ROOT = __dirname;
const APP_NAME = '英语四六级词汇学习平台';
const OUT_DIR = process.argv[2] || path.join(ROOT, 'dist');

// 打进包里的应用本体（运行时数据 user-data 不在其中）
const APP_ENTRIES = ['main.js', 'package.json', 'src', 'data', 'assets'];

async function copyDir(source, target) {
  await fs.mkdir(target, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);

    if (entry.isDirectory()) {
      await copyDir(from, to);
    } else if (!entry.isSymbolicLink()) {
      await fs.copyFile(from, to);
    }
  }
}

// npm 解析出的生产依赖，含嵌套结构，按相对路径原样复制
function listProductionDeps() {
  const output = execFileSync('npm', ['ls', '--omit=dev', '--parseable', '--all'], {
    cwd: ROOT,
    encoding: 'utf-8',
    shell: true,
    stdio: ['ignore', 'pipe', 'ignore']
  });

  return output
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && line !== ROOT)
    .map(line => path.relative(ROOT, line).split(path.sep).join('/'))
    .filter(rel => rel.startsWith('node_modules/'));
}

async function build() {
  const target = path.join(OUT_DIR, `${APP_NAME}-win32-x64`);
  const runtime = path.join(ROOT, 'node_modules', 'electron', 'dist');

  try {
    await fs.access(path.join(runtime, 'electron.exe'));
  } catch {
    throw new Error('找不到本地 Electron 运行时，请先执行 npm install');
  }

  console.log(`输出目录: ${target}`);
  await fs.rm(target, { recursive: true, force: true });

  console.log('1/4 复制 Electron 运行时…');
  await copyDir(runtime, target);

  console.log('2/4 重命名可执行文件…');
  await fs.rename(path.join(target, 'electron.exe'), path.join(target, `${APP_NAME}.exe`));
  // 只有缺少 app 目录时才会回退到它，留着会多一份无关内容
  await fs.rm(path.join(target, 'resources', 'default_app.asar'), { force: true });

  console.log('3/4 复制应用代码与数据…');
  const appDir = path.join(target, 'resources', 'app');
  await fs.mkdir(appDir, { recursive: true });

  for (const entry of APP_ENTRIES) {
    const from = path.join(ROOT, entry);
    const stat = await fs.stat(from);

    if (stat.isDirectory()) {
      await copyDir(from, path.join(appDir, entry));
    } else {
      await fs.copyFile(from, path.join(appDir, entry));
    }
  }

  console.log('4/4 复制生产依赖…');
  for (const rel of listProductionDeps()) {
    await copyDir(path.join(ROOT, rel), path.join(appDir, rel));
  }

  console.log('打包完成:', target);
}

build().catch(error => {
  console.error('打包失败:', error.message);
  process.exit(1);
});
