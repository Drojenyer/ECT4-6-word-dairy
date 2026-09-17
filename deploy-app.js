const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

async function deployApp() {
  try {
    const sourceDir = path.join(__dirname, 'dist', 'win-unpacked');
    const targetDir = 'E:\\Vocabu_work\\英语四六级词汇学习平台_Electron';
    const desktopPath = path.join(process.env.USERPROFILE, 'Desktop', '英语四六级词汇学习平台_Electron.bat');

    console.log('开始部署...');

    // 检查源目录是否存在
    await fs.access(sourceDir);
    console.log('✓ 源目录检查通过');

    // 创建目标目录（如果不存在）
    await fs.mkdir(targetDir, { recursive: true });
    console.log('✓ 目标目录准备完成');

    // 复制所有文件
    const files = await fs.readdir(sourceDir);
    for (const file of files) {
      const sourcePath = path.join(sourceDir, file);
      const targetPath = path.join(targetDir, file);

      const stat = await fs.stat(sourcePath);
      if (stat.isDirectory()) {
        await copyDirectory(sourcePath, targetPath);
      } else {
        await fs.copyFile(sourcePath, targetPath);
      }
      console.log(`✓ 已复制: ${file}`);
    }

    // 创建桌面快捷方式
    const shortcutContent = `@echo off
chcp 65001 >nul
title 英语四六级词汇学习平台
cd /d "${targetDir}"
start "" "英语四六级词汇学习平台.exe"`;

    await fs.writeFile(desktopPath, shortcutContent, 'utf-8');
    console.log('✓ 桌面快捷方式已创建');

    console.log('\n✅ 部署完成！');
    console.log(`📁 应用程序位置: ${targetDir}`);
    console.log(`🖥️ 桌面快捷方式: ${desktopPath}`);

    // 询问是否立即启动
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('\n是否立即启动应用程序？(Y/N): ', async (answer) => {
      if (answer.toUpperCase() === 'Y') {
        try {
          execSync(`start "" "${path.join(targetDir, '英语四六级词汇学习平台.exe')}"`, { windowsHide: true });
          console.log('✓ 应用程序已启动');
        } catch (error) {
          console.error('启动失败:', error.message);
        }
      }
      rl.close();
    });

  } catch (error) {
    console.error('❌ 部署失败:', error.message);
    process.exit(1);
  }
}

async function copyDirectory(source, target) {
  await fs.mkdir(target, { recursive: true });
  const files = await fs.readdir(source);

  for (const file of files) {
    const sourcePath = path.join(source, file);
    const targetPath = path.join(target, file);

    const stat = await fs.stat(sourcePath);
    if (stat.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
    } else {
      await fs.copyFile(sourcePath, targetPath);
    }
  }
}

deployApp();