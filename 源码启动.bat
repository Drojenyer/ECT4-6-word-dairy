@echo off
chcp 65001 >nul
title 英语四六级词汇学习平台 (源码模式)
cd /d "%~dp0"
python main.py
if errorlevel 1 (
    echo.
    echo 启动失败，请确保已安装 Python 3.x 并配置环境变量。
    pause
)
