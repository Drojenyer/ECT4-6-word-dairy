# -*- coding: utf-8 -*-
"""弹窗打卡提醒模块 - 定时弹窗提醒用户学习"""

import threading
import time
from datetime import datetime, date


class ReminderManager:
    """后台定时提醒管理器"""

    def __init__(self, storage, on_remind_callback=None):
        self.storage = storage
        self.on_remind_callback = on_remind_callback
        self._thread = None
        self._running = False
        self._last_remind_date = None

    def start(self):
        """启动后台提醒线程"""
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def stop(self):
        """停止提醒"""
        self._running = False

    def _loop(self):
        """后台循环：检查是否需要弹窗提醒"""
        while self._running:
            time.sleep(30)  # 每30秒检查一次

            settings = self.storage.get_settings()
            if not settings.get("remind_enabled", True):
                continue

            now = datetime.now()
            current_time = now.strftime("%H:%M")

            # 检查是否在提醒时间段内
            remind_start = settings.get("remind_start", "08:00")
            remind_end = settings.get("remind_end", "22:00")
            if not (remind_start <= current_time <= remind_end):
                continue

            # 今日已打卡则不再提醒
            if self.storage.has_checked_in_today():
                continue

            # 每天最多提醒一次
            today = date.today().isoformat()
            if self._last_remind_date == today:
                continue

            self._last_remind_date = today

            # 触发回调
            if self.on_remind_callback:
                try:
                    self.on_remind_callback()
                except Exception:
                    pass

    def trigger_now(self):
        """立即触发一次提醒"""
        if self.on_remind_callback:
            self.on_remind_callback()
