# -*- coding: utf-8 -*-
"""词汇数据加载模块 - 从 JSON 文件加载四六级词库"""

import json
import os
import sys
import random


def _get_resource_path(filename):
    """获取资源文件路径：优先从 PyInstaller 打包目录查找，其次从 E 盘原始路径"""
    # PyInstaller 打包后：资源在 sys._MEIPASS 临时目录中
    if hasattr(sys, "_MEIPASS"):
        bundled = os.path.join(sys._MEIPASS, filename)
        if os.path.exists(bundled):
            return bundled
    # 开发环境 / 未打包：从原始路径读取
    return os.path.join(r"E:\Vocabu_work", filename)


# 默认词汇文件路径
DEFAULT_CET4_PATH = _get_resource_path("3-CET4-顺序.json")
DEFAULT_CET6_PATH = _get_resource_path("4-CET6-顺序.json")


class VocabItem:
    """单个词条"""
    def __init__(self, word, translations, phrases=None, level="CET4"):
        self.word = word
        self.translations = translations  # [{"translation": "...", "type": "..."}]
        self.phrases = phrases or []      # [{"phrase": "...", "translation": "..."}]
        self.level = level

    @property
    def translation_text(self):
        """合并所有释义为一段文本"""
        parts = []
        for t in self.translations:
            tp = t.get("type", "")
            tr = t.get("translation", "")
            if tp:
                parts.append(f"{tp}. {tr}")
            else:
                parts.append(tr)
        return "；".join(parts)

    def __repr__(self):
        return f"<VocabItem {self.word} ({self.level})>"


class VocabLoader:
    """词库加载器"""
    def __init__(self, cet4_path=DEFAULT_CET4_PATH, cet6_path=DEFAULT_CET6_PATH):
        self.cet4_path = cet4_path
        self.cet6_path = cet6_path
        self._cet4_words = None
        self._cet6_words = None

    def _load_file(self, path, level):
        """加载单个 JSON 词库文件"""
        if not os.path.exists(path):
            print(f"[警告] 词库文件不存在: {path}")
            return []
        with open(path, "r", encoding="utf-8") as f:
            raw = json.load(f)
        items = []
        for entry in raw:
            word = entry.get("word", "").strip()
            if not word:
                continue
            translations = entry.get("translations", [])
            phrases = entry.get("phrases", [])
            items.append(VocabItem(word, translations, phrases, level))
        return items

    @property
    def cet4_words(self):
        if self._cet4_words is None:
            self._cet4_words = self._load_file(self.cet4_path, "CET4")
        return self._cet4_words

    @property
    def cet6_words(self):
        if self._cet6_words is None:
            self._cet6_words = self._load_file(self.cet6_path, "CET6")
        return self._cet6_words

    def get_words(self, level="all", count=10, mastered=None):
        """
        随机选取指定数量的词汇
        level: "CET4" | "CET6" | "all"
        count: 选取数量
        mastered: set of mastered words, 若提供则排除已掌握的词
        """
        if level == "CET4":
            pool = list(self.cet4_words)
        elif level == "CET6":
            pool = list(self.cet6_words)
        else:
            pool = list(self.cet4_words) + list(self.cet6_words)

        if mastered:
            pool = [w for w in pool if w.word not in mastered]

        if not pool:
            return []

        count = min(count, len(pool))
        return random.sample(pool, count)

    def get_word_by_text(self, word_text, level=None):
        """按英文单词文本查找词条"""
        pools = []
        if level == "CET4" or level is None:
            pools.append(self.cet4_words)
        if level == "CET6" or level is None:
            pools.append(self.cet6_words)
        for pool in pools:
            for w in pool:
                if w.word == word_text:
                    return w
        return None

    @property
    def total_count(self):
        return len(self.cet4_words) + len(self.cet6_words)

    @property
    def cet4_count(self):
        return len(self.cet4_words)

    @property
    def cet6_count(self):
        return len(self.cet6_words)
