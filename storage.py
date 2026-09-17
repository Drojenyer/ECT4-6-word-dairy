# -*- coding: utf-8 -*-
"""本地数据存储模块 - 管理学习进度、打卡记录、用户设置"""

import json
import os
from datetime import datetime, date


# 数据文件存放目录（用户目录下）
APP_DIR = os.path.join(os.path.expanduser("~"), ".cet_vocab")
DATA_FILE = os.path.join(APP_DIR, "data.json")

DEFAULT_SETTINGS = {
    "daily_count": 20,          # 每日词汇数量 10-100
    "level": "all",             # 词库选择: CET4 / CET6 / all
    "remind_enabled": True,      # 是否开启弹窗提醒
    "remind_interval": 120,     # 提醒间隔（分钟）
    "remind_start": "08:00",     # 提醒开始时间
    "remind_end": "22:00",       # 提醒结束时间
    "quiz_mode": "word_to_meaning",  # 学习模式: word_to_meaning / meaning_to_word / card
    "exclude_mastered": True,    # 是否排除已掌握词汇
    "last_tab": 0,              # 上次选中的标签页
}


class Storage:
    """数据持久化管理"""

    def __init__(self):
        self._data = None
        self._ensure_dir()

    def _ensure_dir(self):
        if not os.path.exists(APP_DIR):
            os.makedirs(APP_DIR)

    @property
    def data(self):
        """加载并缓存数据"""
        if self._data is None:
            if os.path.exists(DATA_FILE):
                try:
                    with open(DATA_FILE, "r", encoding="utf-8") as f:
                        self._data = json.load(f)
                except (json.JSONDecodeError, IOError):
                    self._data = self._default_data()
            else:
                self._data = self._default_data()
        return self._data

    def _default_data(self):
        return {
            "settings": dict(DEFAULT_SETTINGS),
            "checkin_records": {},       # {"2026-09-16": {"count": 20, "correct": 15, "time": "..."}}
            "mastered_words": [],        # 已掌握的单词列表
            "wrong_words": [],           # 错题本
            "streak_days": 0,            # 连续打卡天数
            "total_checkin": 0,          # 累计打卡次数
            "last_checkin_date": None,   # 最后打卡日期
        }

    def save(self):
        """保存数据到文件"""
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(self.data, f, ensure_ascii=False, indent=2)

    # ===== 设置 =====

    def get_settings(self):
        return self.data["settings"]

    def update_settings(self, **kwargs):
        settings = self.data["settings"]
        for k, v in kwargs.items():
            if k in settings:
                settings[k] = v
        self.save()

    # ===== 打卡记录 =====

    def today_str(self):
        return date.today().isoformat()

    def has_checked_in_today(self):
        return self.today_str() in self.data["checkin_records"]

    def record_checkin(self, total_count, correct_count):
        """记录今日打卡"""
        today = self.today_str()
        now = datetime.now().isoformat()

        self.data["checkin_records"][today] = {
            "count": total_count,
            "correct": correct_count,
            "time": now,
        }

        # 更新连续打卡
        last_date = self.data.get("last_checkin_date")
        if last_date:
            last = date.fromisoformat(last_date)
            diff = (date.today() - last).days
            if diff == 1:
                self.data["streak_days"] += 1
            elif diff == 0:
                pass  # 同一天重复打卡
            else:
                self.data["streak_days"] = 1
        else:
            self.data["streak_days"] = 1

        self.data["last_checkin_date"] = today
        self.data["total_checkin"] += 1
        self.save()

    def get_checkin_records(self):
        return self.data["checkin_records"]

    def get_streak_days(self):
        return self.data.get("streak_days", 0)

    def get_total_checkin(self):
        return self.data.get("total_checkin", 0)

    # ===== 已掌握单词 =====

    def add_mastered(self, word):
        if word not in self.data["mastered_words"]:
            self.data["mastered_words"].append(word)
            self.save()

    def get_mastered_set(self):
        return set(self.data.get("mastered_words", []))

    def is_mastered(self, word):
        return word in self.data.get("mastered_words", [])

    # ===== 错题本 =====

    def add_wrong_word(self, word):
        wrongs = self.data["wrong_words"]
        if word not in wrongs:
            wrongs.append(word)
        self.save()

    def remove_wrong_word(self, word):
        if word in self.data["wrong_words"]:
            self.data["wrong_words"].remove(word)
            self.save()

    def get_wrong_words(self):
        return self.data.get("wrong_words", [])

    def clear_wrong_words(self):
        self.data["wrong_words"] = []
        self.save()

    # ===== 统计 =====

    def get_stats(self):
        records = self.data["checkin_records"]
        total_days = len(records)
        total_words = sum(r["count"] for r in records.values())
        total_correct = sum(r["correct"] for r in records.values())
        accuracy = (total_correct / total_words * 100) if total_words > 0 else 0

        return {
            "total_days": total_days,
            "streak_days": self.get_streak_days(),
            "total_checkin": self.get_total_checkin(),
            "total_words": total_words,
            "total_correct": total_correct,
            "accuracy": accuracy,
            "mastered_count": len(self.data.get("mastered_words", [])),
            "wrong_count": len(self.data.get("wrong_words", [])),
        }
