@echo off
chcp 65001 >nul
title 英语四六级词汇学习平台 (Electron版本)
cd /d "%~dp0"
npm start
if errorlevel 1 (
    echo.
    echo 启动失败，请确保已安装 Node.js 和 npm。
    pause
)