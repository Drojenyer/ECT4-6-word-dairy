# -*- coding: utf-8 -*-
"""
英语四六级词汇学习平台 - 入口文件
Windows 桌面应用，每日随机考察 10-100 个词汇，弹窗打卡提醒

启动方式: python main.py
"""

import sys
import os

# 确保当前目录在 Python 路径中
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def main():
    from gui import MainApp
    app = MainApp()
    app.run()


if __name__ == "__main__":
    main()
