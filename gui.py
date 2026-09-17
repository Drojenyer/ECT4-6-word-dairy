# -*- coding: utf-8 -*-
"""主 GUI 界面 - 四六级词汇学习平台（现代风格）"""

import ctypes
import random
import tkinter as tk
from tkinter import ttk, messagebox
from datetime import date

from vocab import VocabLoader
from storage import Storage
from reminder import ReminderManager


# ===== 现代配色方案 =====
C_BG        = "#f7f8fc"
C_CARD      = "#ffffff"
C_PRIMARY   = "#6366f1"
C_PRIMARY_D = "#4f46e5"
C_PRIMARY_L = "#eef2ff"
C_PRIMARY_LL= "#f5f7ff"
C_ACCENT    = "#ec4899"
C_ACCENT_D  = "#db2777"
C_ACCENT_L  = "#fdf2f8"
C_SUCCESS   = "#10b981"
C_SUCCESS_D = "#059669"
C_SUCCESS_L = "#ecfdf5"
C_WARN      = "#f59e0b"
C_WARN_D    = "#d97706"
C_WARN_L    = "#fffbeb"
C_ERROR     = "#ef4444"
C_ERROR_L   = "#fef2f2"
C_TEXT      = "#1e293b"
C_TEXT_SUB  = "#475569"
C_TEXT_LT   = "#94a3b8"
C_BORDER    = "#e2e8f0"
C_BORDER_LT = "#f1f5f9"
C_SIDEBAR   = "#1e293b"
C_SIDEBAR_H = "#334155"

# 字体
F_TITLE  = ("Microsoft YaHei", 22, "bold")
F_HEAD   = ("Microsoft YaHei", 16, "bold")
F_SUB    = ("Microsoft YaHei", 13, "bold")
F_BODY   = ("Microsoft YaHei", 12)
F_SMALL  = ("Microsoft YaHei", 10)
F_TINY   = ("Microsoft YaHei", 9)
F_WORD   = ("Consolas", 30, "bold")
F_WORD_S = ("Consolas", 22, "bold")
F_TRANS  = ("Microsoft YaHei", 14)
F_OPT    = ("Microsoft YaHei", 13)
F_OPT_K  = ("Microsoft YaHei", 14, "bold")
F_NUM    = ("Microsoft YaHei", 32, "bold")
F_EMOJI  = ("Segoe UI Emoji", 42)


# ===== 动画工具 =====

def fade_in(win, dur=300, steps=12):
    win.attributes("-alpha", 0)
    d = dur / steps
    a = 1.0 / steps
    def _s(i=0):
        if i <= steps:
            try: win.attributes("-alpha", min(1.0, a*i))
            except tk.TclError: return
            win.after(int(d), lambda: _s(i+1))
    _s()

def anim_progress(bar, sv, ev, dur=400, steps=20):
    d = dur / steps
    step = (ev - sv) / steps
    def _s(i=0):
        if i <= steps:
            try: bar["value"] = sv + step*i
            except tk.TclError: return
            bar.after(int(d), lambda: _s(i+1))
    _s()

def shake(w, dur=300):
    ox = w.winfo_x()
    pat = [-10,10,-8,8,-5,5,-3,3,0]
    d = dur // len(pat)
    def _s(i=0):
        if i < len(pat):
            w.place(x=ox+pat[i], y=w.winfo_y())
            w.after(d, lambda: _s(i+1))
        else:
            w.place(x=ox, y=w.winfo_y())
    _s()

def pulse(w, bg, pulse_c, dur=300, steps=4):
    d = dur // (steps*2)
    def _do(i=0):
        if i < steps:
            try: w.config(bg=pulse_c)
            except tk.TclError: return
            w.after(d, lambda: _rest(i+1))
    def _rest(i):
        try: w.config(bg=bg)
        except tk.TclError: return
        if i < steps: w.after(d, lambda: _do(i))
    _do()

def slide_x(win, start_x, end_x, y, dur=350, steps=20):
    d = dur / steps
    diff = end_x - start_x
    step = diff / steps
    def _s(i=0):
        if i <= steps:
            x = int(start_x + step*i)
            try: win.geometry(f"+{x}+{y}")
            except tk.TclError: return
            win.after(int(d), lambda: _s(i+1))
    _s()


class WinToast(tk.Toplevel):
    """Windows 11 风格右下角弹窗通知（类似微信/QQ消息提示）"""

    _instances = []

    def __init__(self, master, title, message, on_action=None, action_text="立即学习"):
        super().__init__(master)
        self.on_action = on_action
        self.overrideredirect(True)
        self.attributes("-topmost", True)
        self.configure(bg=C_CARD)

        w, h = 380, 110
        sw = self.winfo_screenwidth()
        sh = self.winfo_screenheight()
        # 多条通知堆叠
        stack_h = sum(t._h for t in WinToast._instances if t.winfo_exists())
        x = sw - w - 16
        y = sh - h - 60 - stack_h - 10 * len(WinToast._instances)
        self._w, self._h = w, h
        self._final_x, self._final_y = x, y
        self.geometry(f"{w}x{h}+{x}+{y}")
        self._alpha = 0.0
        self.attributes("-alpha", 0.0)

        WinToast._instances.append(self)

        # 内容
        root = tk.Frame(self, bg=C_CARD)
        root.pack(fill="both", expand=True)
        root.configure(highlightbackground=C_PRIMARY, highlightthickness=3,
                       highlightcolor=C_PRIMARY)

        top_bar = tk.Frame(root, bg=C_PRIMARY)
        top_bar.pack(fill="x")
        tk.Label(top_bar, text=f"  {title}", font=F_SMALL, bg=C_PRIMARY,
                 fg="white", anchor="w").pack(side="left", padx=8, pady=3)
        close_lbl = tk.Label(top_bar, text="×", font=("", 13), bg=C_PRIMARY, fg="white",
                 cursor="hand2")
        close_lbl.pack(side="right", padx=8)
        close_lbl.bind("<Button-1>", lambda e: self._dismiss())

        body = tk.Frame(root, bg=C_CARD)
        body.pack(fill="both", expand=True, padx=12, pady=8)

        tk.Label(body, text="📚", font=("", 16), bg=C_CARD).pack(side="left", padx=(0, 8))
        right = tk.Frame(body, bg=C_CARD)
        right.pack(side="left", fill="both", expand=True)
        tk.Label(right, text=message, font=F_SMALL, bg=C_CARD, fg=C_TEXT,
                 wraplength=270, justify="left", anchor="w").pack(anchor="w")

        btns = tk.Frame(right, bg=C_CARD)
        btns.pack(side="bottom", anchor="e", pady=(2, 0))
        if on_action:
            tk.Button(btns, text=action_text, font=F_TINY, bg=C_PRIMARY, fg="white",
                      relief="flat", cursor="hand2", padx=8, pady=1,
                      command=self._do_action).pack(side="right", padx=(2, 0))
        tk.Button(btns, text="忽略", font=F_TINY, bg=C_BORDER, fg=C_TEXT,
                  relief="flat", cursor="hand2", padx=8, pady=1,
                  command=self._dismiss).pack(side="right")

        self._fade_in()
        self._auto = self.after(6000, self._dismiss)

    def _fade_in(self, step=0, max_s=10):
        if step <= max_s:
            self._alpha = step / max_s
            try: self.attributes("-alpha", self._alpha)
            except tk.TclError: return
            self.after(25, lambda: self._fade_in(step + 1, max_s))

    def _fade_out(self, step=0, max_s=8):
        if step <= max_s:
            self._alpha = max(0.0, 1.0 - step / max_s)
            try: self.attributes("-alpha", self._alpha)
            except tk.TclError:
                self.destroy(); return
            self.after(25, lambda: self._fade_out(step + 1, max_s))
        else:
            self.destroy()

    def _do_action(self):
        try: self.after_cancel(self._auto)
        except: pass
        self._dismiss()
        if self.on_action:
            self.on_action()

    def _dismiss(self):
        try: self.after_cancel(self._auto)
        except: pass
        self._fade_out()

    def destroy(self):
        if self in WinToast._instances:
            WinToast._instances.remove(self)
        super().destroy()


class HoverButton(tk.Button):
    """悬停变色按钮"""
    def __init__(self, parent, bg_n, bg_h, **kw):
        super().__init__(parent, bg=bg_n, **kw)
        self._n, self._h = bg_n, bg_h
        self.bind("<Enter>", lambda e: self._s(self._h))
        self.bind("<Leave>", lambda e: self._s(self._n))
    def _s(self, c):
        if self.cget("state") != "disabled":
            self.config(bg=c)

class OptionCard(tk.Frame):
    """多选题选项卡片"""
    def __init__(self, parent, key, text, on_click):
        super().__init__(parent, bg=C_CARD, cursor="hand2",
                        highlightbackground=C_BORDER, highlightthickness=1)
        self._on_click = on_click
        self._key = key
        self._en = True
        self._bg = C_CARD
        self._bg_h = C_PRIMARY_L

        self.k = tk.Label(self, text=key, font=F_OPT_K, bg=C_CARD,
                          fg=C_PRIMARY, width=2)
        self.k.pack(side="left", padx=(10,4), pady=8)
        self.t = tk.Label(self, text=text, font=F_OPT, bg=C_CARD,
                          fg=C_TEXT, wraplength=260, justify="left")
        self.t.pack(side="left", fill="x", expand=True, padx=(2,10), pady=8)
        self._bind_all("<Enter>", self._ent)
        self._bind_all("<Leave>", self._lev)
        self._bind_all("<Button-1>", lambda e: self._clk())

    def _bind_all(self, seq, fn=None):
        self.bind(seq, fn)
        for c in self.winfo_children():
            c.bind(seq, fn)

    def _set_bg(self, c):
        self.config(bg=c, highlightbackground=c if c != C_CARD else C_BORDER)
        self.k.config(bg=c)
        self.t.config(bg=c)

    def _ent(self, e):
        if self._en: self._set_bg(self._bg_h)

    def _lev(self, e):
        if self._en: self._set_bg(C_CARD)

    def _clk(self):
        if self._en: self._on_click(self._key)

    def show_correct(self, sel=False):
        self._en = False
        if sel:
            self._set_bg(C_SUCCESS)
            self.k.config(fg="white"); self.t.config(fg="white")
        else:
            self._set_bg(C_SUCCESS_L)
            self.k.config(fg=C_SUCCESS_D)

    def show_wrong(self):
        self._en = False
        self._set_bg(C_ERROR)
        self.k.config(fg="white"); self.t.config(fg="white")

    def show_correct_hint(self):
        self._en = False
        self._set_bg(C_SUCCESS_L)
        self.k.config(fg=C_SUCCESS_D)

    def reset(self):
        self._en = True
        self._set_bg(C_CARD)
        self.k.config(fg=C_PRIMARY); self.t.config(fg=C_TEXT)

    def set_text(self, t): self.t.config(text=t)


class MultipleChoiceQuiz(tk.Toplevel):
    """多选题测验窗口"""
    def __init__(self, parent, loader, storage, words, mode="word_to_meaning", on_finish=None):
        super().__init__(parent)
        self.loader, self.storage = loader, storage
        self.words, self.mode = words, mode
        self.on_finish = on_finish
        self.idx = 0
        self.correct = 0
        self.answers = []
        self.answered = False
        self.opts = []

        self.title("词汇测验")
        self.geometry("660x580")
        self.configure(bg=C_BG)
        self.resizable(False, False)
        self.transient(parent)
        self.grab_set()
        self._cx()
        self._build()
        self._load(True)

    def _cx(self):
        self.update_idletasks()
        w,h = 660,580
        sw,sh = self.winfo_screenwidth(), self.winfo_screenheight()
        self.geometry(f"{w}x{h}+{(sw-w)//2}+{(sh-h)//2}")

    def _build(self):
        top = tk.Frame(self, bg=C_PRIMARY, height=56)
        top.pack(fill="x"); top.pack_propagate(False)

        self.p_lbl = tk.Label(top, text="1/20", font=F_SUB, bg=C_PRIMARY, fg="white")
        self.p_lbl.pack(side="left", padx=20, pady=14)
        self.p_bar = ttk.Progressbar(top, length=250, mode="determinate")
        self.p_bar.pack(side="left", padx=10, pady=18)
        self.p_bar["maximum"] = len(self.words)
        self.s_lbl = tk.Label(top, text="正确: 0", font=F_SMALL, bg=C_PRIMARY, fg="white")
        self.s_lbl.pack(side="right", padx=20, pady=14)

        self.content = tk.Frame(self, bg=C_CARD)
        self.content.pack(fill="both", expand=True, padx=20, pady=15)

        qf = tk.Frame(self.content, bg=C_CARD)
        qf.pack(fill="x", pady=(10,5))
        self.lvl_lbl = tk.Label(qf, text="", font=F_SMALL, bg=C_CARD, fg=C_TEXT_LT)
        self.lvl_lbl.pack(pady=(5,2))
        self.q_word = tk.Label(qf, text="", font=F_WORD, bg=C_CARD, fg=C_TEXT)
        self.q_word.pack(pady=(5,5))
        self.hint = tk.Label(qf, text="请选择正确的释义", font=F_BODY, bg=C_CARD, fg=C_TEXT_LT)
        self.hint.pack(pady=(0,10))

        self.of = tk.Frame(self.content, bg=C_CARD)
        self.of.pack(fill="x", pady=(5,10))

        self.dl = tk.Label(self.content, text="", font=F_SMALL, bg=C_CARD, fg=C_PRIMARY_D,
                           wraplength=580, justify="left", anchor="w")
        self.dl.pack(fill="x", padx=10, pady=(5,0))

        bot = tk.Frame(self, bg=C_CARD, height=55)
        bot.pack(fill="x", side="bottom"); bot.pack_propagate(False)
        self.next_b = HoverButton(bot, text="下一题 →", font=F_BODY, bg_n=C_SUCCESS, bg_h=C_SUCCESS_D,
                                  fg="white", width=14, relief="flat", cursor="hand2",
                                  command=self._next, state="disabled")
        self.next_b.pack(side="right", padx=(10,30), pady=10)
        self.skip_b = HoverButton(bot, text="跳过", font=F_BODY, bg_n=C_WARN, bg_h=C_WARN_D,
                                  fg="white", width=10, relief="flat", cursor="hand2",
                                  command=self._skip)
        self.skip_b.pack(side="left", padx=(30,10), pady=10)

    def _gen_opts(self, wi):
        if self.mode == "word_to_meaning":
            correct = wi.translation_text
        else:
            correct = wi.word
        pool = self.loader.cet4_words if wi.level == "CET4" else self.loader.cet6_words
        ds = []; seen = {correct}
        for _ in range(200):
            w = random.choice(pool)
            t = w.translation_text if self.mode == "word_to_meaning" else w.word
            if t not in seen and len(t) < 80:
                seen.add(t); ds.append(t)
            if len(ds) >= 3: break
        opts = ds + [correct]
        random.shuffle(opts)
        return opts, correct

    def _load(self, anim=False):
        if self.idx >= len(self.words):
            self._result(); return
        self.answered = False
        self.dl.config(text="")
        for b in self.opts: b.destroy()
        self.opts = []

        wi = self.words[self.idx]
        self.lvl_lbl.config(text=f"({wi.level})")
        if self.mode == "word_to_meaning":
            self.q_word.config(text=wi.word)
            self.hint.config(text="请选择正确的释义：")
        else:
            self.q_word.config(text=wi.translation_text)
            self.hint.config(text="请选择正确的英文单词：")
            self.q_word.config(font=F_WORD_S if len(wi.translation_text)>40 else F_WORD)

        opts, ct = self._gen_opts(wi)
        for i,(k,t) in enumerate(zip(["A","B","C","D"], opts)):
            r,c = i//2, i%2
            b = OptionCard(self.of, k, t, self._ans)
            b.grid(row=r, column=c, padx=8, pady=6, sticky="nsew")
            b._ct = ct; b._ot = t
            self.opts.append(b)
        self.of.grid_columnconfigure(0, weight=1)
        self.of.grid_columnconfigure(1, weight=1)

        ov = self.p_bar["value"]
        self.p_lbl.config(text=f"{self.idx+1}/{len(self.words)}")
        self.s_lbl.config(text=f"正确: {self.correct}")
        self.skip_b.config(state="normal")
        self.next_b.config(state="disabled")
        if anim: anim_progress(self.p_bar, ov, self.idx, dur=300)

    def _ans(self, key):
        if self.answered: return
        self.answered = True
        wi = self.words[self.idx]
        sel = None; cor = None
        for b in self.opts:
            if b._key == key: sel = b
            if b._ot == b._ct: cor = b
        ok = (sel == cor)
        if ok:
            self.correct += 1
            sel.show_correct(sel=True)
            pulse(self.q_word, C_CARD, C_SUCCESS_L, dur=300)
        else:
            sel.show_wrong()
            cor.show_correct_hint()
            shake(self.q_word, dur=300)
            self.storage.add_wrong_word(wi.word)
        self.answers.append((wi.word, key, ok))

        parts = []
        if wi.phrases:
            for p in wi.phrases[:3]:
                parts.append(f"  {p['phrase']}  {p['translation']}")
        if parts:
            self.dl.config(text="词组例句：\n" + "\n".join(parts))

        self.s_lbl.config(text=f"正确: {self.correct}")
        anim_progress(self.p_bar, self.p_bar["value"], self.idx+1, dur=400)
        self.skip_b.config(state="disabled")
        self.next_b.config(state="normal")

    def _next(self): self.idx += 1; self._load(True)
    def _skip(self):
        if not self.answered:
            wi = self.words[self.idx]
            self.storage.add_wrong_word(wi.word)
            self.answers.append((wi.word, "", False))
        self.idx += 1; self._load(True)

    def _result(self):
        total = len(self.words); cor = self.correct
        acc = (cor/total*100) if total else 0
        self.storage.record_checkin(total, cor)
        for w in self.winfo_children(): w.destroy()

        f = tk.Frame(self, bg=C_CARD)
        f.pack(fill="both", expand=True, padx=30, pady=30)
        tk.Label(f, text="🎉", font=F_EMOJI, bg=C_CARD).pack(pady=(20,5))
        tk.Label(f, text="测验完成！", font=F_TITLE, bg=C_CARD, fg=C_TEXT).pack(pady=(5,15))
        rc = tk.Frame(f, bg=C_BG); rc.pack(pady=(5,15), ipadx=20, ipady=10)
        tk.Label(rc, text=f"{acc:.0f}%", font=F_NUM, bg=C_BG,
                 fg=C_SUCCESS if acc>=60 else C_ERROR).pack(side="left", padx=15)
        tk.Label(rc, text=f"总计 {total}    正确 {cor}    错误 {total-cor}",
                 font=F_BODY, bg=C_BG, fg=C_TEXT).pack(side="left", padx=15)
        wr = [(w,k,c) for w,k,c in self.answers if not c]
        if wr:
            wt = "错题回顾：\n" + "\n".join(f"  {w}" for w,k,c in wr[:8])
            if len(wr)>8: wt += f"\n  ...等共 {len(wr)} 题"
            tk.Label(f, text=wt, font=F_SMALL, bg=C_CARD, fg=C_ERROR,
                     justify="left", anchor="w", wraplength=540).pack(pady=(5,10), fill="x")
        HoverButton(f, text="关闭", font=F_BODY, bg_n=C_PRIMARY, bg_h=C_PRIMARY_D,
                    fg="white", width=14, relief="flat", cursor="hand2",
                    command=self._close).pack(pady=(15,10))
        fade_in(self, dur=200)

    def _close(self):
        self.destroy()
        if self.on_finish: self.on_finish()


class WordCardWindow(tk.Toplevel):
    """词卡浏览窗口 - 修复版：点击卡片任意区域均可翻卡"""
    def __init__(self, parent, loader, storage, words, on_finish=None):
        super().__init__(parent)
        self.loader, self.storage = loader, storage
        self.words = words
        self.on_finish = on_finish
        self.idx = 0
        self.flipped = False
        self.known = 0
        self.unknown_list = []

        self.title("词卡浏览")
        self.geometry("560x600")
        self.configure(bg=C_BG)
        self.resizable(False, False)
        self.transient(parent)
        self.grab_set()
        self._cx()
        self._build()
        self._load()

    def _cx(self):
        self.update_idletasks()
        w,h = 560,600
        sw,sh = self.winfo_screenwidth(), self.winfo_screenheight()
        self.geometry(f"{w}x{h}+{(sw-w)//2}+{(sh-h)//2}")

    def _build(self):
        top = tk.Frame(self, bg=C_PRIMARY, height=50)
        top.pack(fill="x"); top.pack_propagate(False)
        self.c_pl = tk.Label(top, text="1/20", font=F_SUB, bg=C_PRIMARY, fg="white")
        self.c_pl.pack(side="left", padx=20, pady=10)
        self.c_bar = ttk.Progressbar(top, length=250, mode="determinate")
        self.c_bar.pack(side="left", padx=10, pady=15)
        self.c_bar["maximum"] = len(self.words)
        self.c_kl = tk.Label(top, text="认识: 0", font=F_SMALL, bg=C_PRIMARY, fg="white")
        self.c_kl.pack(side="right", padx=20, pady=10)

        # 底部按钮区 — 必须先 pack，否则被 area(expand=True) 挤掉
        bot = tk.Frame(self, bg=C_BG, height=70)
        bot.pack(fill="x", side="bottom"); bot.pack_propagate(False)
        self.unk_b = tk.Button(bot, text="不认识", font=F_HEAD, bg=C_ERROR, fg="white",
                               width=14, relief="flat", cursor="hand2",
                               activebackground="#dc2626", activeforeground="white",
                               command=self._mark_wrong)
        self.unk_b.pack(side="left", padx=(40,10), pady=15)
        self.kn_b = tk.Button(bot, text="认识", font=F_HEAD, bg=C_SUCCESS, fg="white",
                              width=14, relief="flat", cursor="hand2",
                              activebackground=C_SUCCESS_D, activeforeground="white",
                              command=self._mark_known)
        self.kn_b.pack(side="right", padx=(10,40), pady=15)

        # 卡片区域
        self.area = tk.Frame(self, bg=C_BG)
        self.area.pack(fill="both", expand=True, padx=20, pady=15)

        # 卡片容器
        self.card = tk.Frame(self.area, bg=C_CARD,
                             highlightbackground=C_BORDER, highlightthickness=1)
        self.card.pack(fill="both", expand=True)

        # 正面
        self.front = tk.Frame(self.card, bg=C_CARD)
        self.front.pack(fill="both", expand=True)
        self.f_lvl = tk.Label(self.front, text="", font=F_SMALL, bg=C_CARD, fg=C_TEXT_LT)
        self.f_lvl.pack(pady=(30,5))
        self.f_word = tk.Label(self.front, text="", font=F_WORD, bg=C_CARD, fg=C_TEXT)
        self.f_word.pack(pady=(20,10))
        self.flip_btn = tk.Button(self.front, text="查看释义", font=F_BODY, bg=C_PRIMARY,
                                  fg="white", relief="flat", cursor="hand2", width=12,
                                  activebackground=C_PRIMARY_D, activeforeground="white",
                                  command=self._flip)
        self.flip_btn.pack(pady=(20,10))

        # 背面
        self.back = tk.Frame(self.card, bg=C_CARD)
        self.b_word = tk.Label(self.back, text="", font=F_WORD_S, bg=C_CARD, fg=C_PRIMARY)
        self.b_word.pack(pady=(20,5))
        self.b_trans = tk.Label(self.back, text="", font=F_TRANS, bg=C_CARD, fg=C_TEXT,
                                wraplength=460, justify="center")
        self.b_trans.pack(pady=(5,10))
        self.b_phr = tk.Label(self.back, text="", font=F_SMALL, bg=C_CARD, fg=C_TEXT_SUB,
                              wraplength=460, justify="left")
        self.b_phr.pack(pady=(5,10), fill="x", padx=20)

        # 也允许点击卡片翻面
        self.card.bind("<Button-1>", lambda e: self._flip())
        self.f_lvl.bind("<Button-1>", lambda e: self._flip())
        self.f_word.bind("<Button-1>", lambda e: self._flip())

    def _load(self):
        if self.idx >= len(self.words):
            self._result(); return
        wi = self.words[self.idx]
        self.flipped = False

        self.front.pack(fill="both", expand=True)
        self.back.pack_forget()
        self.f_lvl.config(text=f"({wi.level})")
        self.f_word.config(text=wi.word)

        self.b_word.config(text=wi.word)
        self.b_trans.config(text=wi.translation_text)
        if wi.phrases:
            pt = "\n".join(f"  {p['phrase']}  {p['translation']}" for p in wi.phrases[:4])
            self.b_phr.config(text="词组：\n" + pt)
        else:
            self.b_phr.config(text="")

        ov = self.c_bar["value"]
        self.c_pl.config(text=f"{self.idx+1}/{len(self.words)}")
        self.c_kl.config(text=f"认识: {self.known}")
        anim_progress(self.c_bar, ov, self.idx, dur=300)

    def _flip(self):
        if self.flipped: return
        self.flipped = True
        self.front.pack_forget()
        self.back.pack(fill="both", expand=True)
        pulse(self.card, C_CARD, C_PRIMARY_L, dur=200)

    def _mark_known(self):
        self._mark(True)

    def _mark_wrong(self):
        self._mark(False)

    def _mark(self, known):
        wi = self.words[self.idx]
        if known:
            self.known += 1
        else:
            self.unknown_list.append(wi.word)
            self.storage.add_wrong_word(wi.word)
        ov = self.c_bar["value"]
        anim_progress(self.c_bar, ov, self.idx+1, dur=300)
        self.c_kl.config(text=f"认识: {self.known}")
        self.idx += 1
        self._load()

    def _result(self):
        total = len(self.words); kn = self.known
        self.storage.record_checkin(total, kn)
        for w in self.winfo_children(): w.destroy()
        f = tk.Frame(self, bg=C_CARD); f.pack(fill="both", expand=True, padx=30, pady=30)
        tk.Label(f, text="📋", font=F_EMOJI, bg=C_CARD).pack(pady=(20,5))
        tk.Label(f, text="词卡学习完成！", font=F_TITLE, bg=C_CARD, fg=C_TEXT).pack(pady=(5,15))
        rate = (kn/total*100) if total else 0
        rc = tk.Frame(f, bg=C_BG); rc.pack(pady=(5,15), ipadx=20, ipady=10)
        tk.Label(rc, text=f"{rate:.0f}%", font=F_NUM, bg=C_BG,
                 fg=C_SUCCESS if rate>=60 else C_WARN).pack(side="left", padx=15)
        tk.Label(rc, text=f"总计 {total}    认识 {kn}    不认识 {total-kn}",
                 font=F_BODY, bg=C_BG, fg=C_TEXT).pack(side="left", padx=15)
        if self.unknown_list:
            wt = "不认识的词：\n" + "\n".join(f"  {w}" for w in self.unknown_list[:8])
            if len(self.unknown_list)>8: wt += f"\n  ...等共 {len(self.unknown_list)} 个"
            tk.Label(f, text=wt, font=F_SMALL, bg=C_CARD, fg=C_ERROR,
                     justify="left", anchor="w", wraplength=480).pack(pady=(5,10), fill="x")
        HoverButton(f, text="关闭", font=F_BODY, bg_n=C_PRIMARY, bg_h=C_PRIMARY_D,
                    fg="white", width=14, relief="flat", cursor="hand2",
                    command=self._close).pack(pady=(15,10))
        fade_in(self, dur=200)

    def _close(self):
        self.destroy()
        if self.on_finish: self.on_finish()


class MainApp:
    """主应用窗口"""

    def __init__(self):
        self.root = tk.Tk()
        self.root.title("英语四六级词汇学习平台")
        self.root.geometry("720x600")
        self.root.configure(bg=C_BG)
        self.root.resizable(False, False)
        self.root.protocol("WM_DELETE_WINDOW", self._on_close)

        self.storage = Storage()
        self.loader = VocabLoader()
        self.reminder = ReminderManager(self.storage, on_remind_callback=self._show_toast)
        self.reminder.start()

        self._setup_style()
        self._build_ui()
        self._update_home()
        self.root.after(2000, self._check_reminder)

    def _setup_style(self):
        st = ttk.Style()
        st.theme_use("clam")
        st.configure("TProgressbar", troughcolor=C_BORDER_LT, background=C_PRIMARY_L, borderwidth=0)
        st.configure("TNotebook", background=C_BG, borderwidth=0, tabmargins=0)
        st.configure("TNotebook.Tab",
                     background=C_BG, foreground=C_TEXT_LT,
                     padding=(24,10), font=F_BODY, borderwidth=0)
        st.map("TNotebook.Tab",
               background=[("selected", C_PRIMARY)],
               foreground=[("selected", "white")])
        st.configure("Treeview", background=C_CARD, fieldbackground=C_CARD,
                     foreground=C_TEXT, rowheight=30, font=F_BODY)
        st.configure("Treeview.Heading", font=F_SUB, background=C_BG, foreground=C_TEXT)
        st.map("Treeview.Heading", background=[("active", C_BORDER_LT)])

    def _center(self):
        self.root.update_idletasks()
        w,h = 720,600
        sw,sh = self.root.winfo_screenwidth(), self.root.winfo_screenheight()
        self.root.geometry(f"{w}x{h}+{(sw-w)//2}+{(sh-h)//2}")

    def _on_close(self):
        # 保存当前状态
        self.storage.update_settings(last_tab=self.notebook.index("current"))
        self.reminder.stop()
        self.root.destroy()

    def _build_ui(self):
        # 顶部标题栏（渐变色感）
        header = tk.Frame(self.root, bg=C_PRIMARY, height=64)
        header.pack(fill="x"); header.pack_propagate(False)

        tk.Label(header, text="📚  英语四六级词汇学习平台",
                 font=F_HEAD, bg=C_PRIMARY, fg="white").pack(side="left", padx=25, pady=18)

        # 右上角打卡状态
        self.header_streak = tk.Label(header, text="", font=F_SMALL, bg=C_PRIMARY, fg="white")
        self.header_streak.pack(side="right", padx=25, pady=18)

        # 内容区
        content = tk.Frame(self.root, bg=C_BG)
        content.pack(fill="both", expand=True, padx=20, pady=12)

        self.notebook = ttk.Notebook(content)
        self.notebook.pack(fill="both", expand=True)
        self.notebook.bind("<<NotebookTabChanged>>", lambda e: self._on_tab_change())

        self.tab_home = tk.Frame(self.notebook, bg=C_CARD)
        self.tab_quiz = tk.Frame(self.notebook, bg=C_CARD)
        self.tab_stats = tk.Frame(self.notebook, bg=C_CARD)
        self.tab_wrong = tk.Frame(self.notebook, bg=C_CARD)
        self.tab_settings = tk.Frame(self.notebook, bg=C_CARD)

        self.notebook.add(self.tab_home, text="  打卡首页  ")
        self.notebook.add(self.tab_quiz, text="  开始学习  ")
        self.notebook.add(self.tab_stats, text="  学习统计  ")
        self.notebook.add(self.tab_wrong, text="  错题本  ")
        self.notebook.add(self.tab_settings, text="  设置  ")

        self._build_home()
        self._build_quiz()
        self._build_stats()
        self._build_wrong()
        self._build_settings()

        # 恢复上次标签页
        last = self.storage.get_settings().get("last_tab", 0)
        if last < 5:
            self.notebook.select(last)

        # 底部
        footer = tk.Frame(self.root, bg=C_BG, height=24)
        footer.pack(fill="x", side="bottom")
        self.status = tk.Label(footer, text="就绪", font=F_TINY, bg=C_BG, fg=C_TEXT_LT)
        self.status.pack(side="left", padx=15, pady=2)

    def _on_tab_change(self):
        idx = self.notebook.index("current")
        if idx == 2: self._update_stats()
        elif idx == 3: self._update_wrong()
        elif idx == 0: self._update_home()

    # ===== 打卡首页 =====

    def _build_home(self):
        t = self.tab_home; t.configure(padx=30, pady=18)

        # 今日打卡卡片
        card = tk.Frame(t, bg=C_CARD, highlightbackground=C_BORDER, highlightthickness=1)
        card.pack(fill="x", pady=(0,12))
        tk.Label(card, text="今日打卡", font=F_HEAD, bg=C_CARD, fg=C_TEXT).pack(anchor="w", padx=20, pady=(15,5))
        self.h_status = tk.Label(card, text="", font=F_SUB, bg=C_CARD, fg=C_TEXT_LT)
        self.h_status.pack(anchor="w", padx=20, pady=(0,15))

        # 数据卡片
        sf = tk.Frame(t, bg=C_CARD); sf.pack(fill="x", pady=(0,12))
        for title,key,clr in [("连续打卡","streak_days",C_PRIMARY),("累计打卡","total_checkin",C_ACCENT)]:
            sub = tk.Frame(sf, bg=C_CARD, highlightbackground=C_BORDER, highlightthickness=1)
            sub.pack(side="left", expand=True, fill="x", padx=5, ipady=10)
            v = self.storage.get_stats().get(key, 0)
            tk.Label(sub, text=str(v), font=F_NUM, bg=C_CARD, fg=clr).pack(pady=(5,0))
            tk.Label(sub, text=title, font=F_SMALL, bg=C_CARD, fg=C_TEXT_LT).pack(pady=(0,5))

        # 学习模式快捷入口
        mode_card = tk.Frame(t, bg=C_CARD, highlightbackground=C_BORDER, highlightthickness=1)
        mode_card.pack(fill="x", pady=(0,12), ipady=8)
        tk.Label(mode_card, text="快捷开始", font=F_SUB, bg=C_CARD, fg=C_TEXT).pack(anchor="w", padx=20, pady=(8,5))

        mode_row = tk.Frame(mode_card, bg=C_CARD)
        mode_row.pack(fill="x", padx=15, pady=(0,8))
        for label, m, clr in [("看词选义","word_to_meaning",C_PRIMARY),
                              ("看义选词","meaning_to_word",C_SUCCESS),
                              ("词卡浏览","card",C_WARN)]:
            HoverButton(mode_row, text=label, font=F_SMALL, bg_n=clr, bg_h=clr,
                        fg="white", width=10, relief="flat", cursor="hand2",
                        command=lambda mm=m: self._quick_start(mm)).pack(side="left", padx=4)

        # 今日设置
        self.h_vocab = tk.Label(t, text="", font=F_SMALL, bg=C_CARD, fg=C_TEXT_LT)
        self.h_vocab.pack(pady=(5,0))

    def _update_home(self):
        s = self.storage.get_stats()
        today = date.today().isoformat()
        checked = self.storage.has_checked_in_today()
        if checked:
            rec = self.storage.get_checkin_records().get(today, {})
            self.h_status.config(text=f"  今日已打卡  |  答题 {rec.get('count',0)} 题，正确 {rec.get('correct',0)} 题", fg=C_SUCCESS_D)
        else:
            self.h_status.config(text="  今日尚未打卡，快来学习吧！", fg=C_WARN_D)
        self.header_streak.config(text=f"🔥 连续 {s['streak_days']} 天")
        st = self.storage.get_settings()
        lt = {"CET4":"四级","CET6":"六级","all":"四六级全部"}.get(st["level"],"全部")
        self.h_vocab.config(text=f"今日设置: {lt}词库，{st['daily_count']} 个词汇  |  CET4: {self.loader.cet4_count}词  CET6: {self.loader.cet6_count}词")

    def _quick_start(self, mode):
        st = self.storage.get_settings()
        self.notebook.select(1)  # 切到学习页
        self.quiz_mode_var.set(mode)
        self._start_quiz()

    # ===== 学习标签页 =====

    def _build_quiz(self):
        t = self.tab_quiz; t.configure(padx=30, pady=12)
        tk.Label(t, text="选择学习模式", font=F_HEAD, bg=C_CARD, fg=C_TEXT).pack(anchor="w", pady=(0,10))

        mf = tk.Frame(t, bg=C_CARD); mf.pack(fill="x", pady=(0,8))
        self.quiz_mode_var = tk.StringVar(value=self.storage.get_settings().get("quiz_mode","word_to_meaning"))
        for title,val,desc,clr in [("看词选义","word_to_meaning","显示英文，选正确中文释义",C_PRIMARY),
                                    ("看义选词","meaning_to_word","显示中文，选正确英文单词",C_SUCCESS),
                                    ("词卡浏览","card","翻卡自评认识/不认识",C_WARN)]:
            c = tk.Frame(mf, bg=C_CARD, highlightbackground=C_BORDER, highlightthickness=1)
            c.pack(fill="x", pady=3, ipadx=10, ipady=4)
            tk.Radiobutton(c, text=title, variable=self.quiz_mode_var, value=val,
                           font=F_SUB, bg=C_CARD, fg=clr, activebackground=C_CARD,
                           selectcolor=C_CARD, command=self._mode_chg).pack(side="left", padx=(5,10))
            tk.Label(c, text=desc, font=F_SMALL, bg=C_CARD, fg=C_TEXT_LT).pack(side="left", padx=(5,0))

        # 设置
        sf = tk.Frame(t, bg=C_CARD); sf.pack(fill="x", pady=(8,5))

        cf = tk.Frame(sf, bg=C_CARD); cf.pack(fill="x", pady=(0,6))
        tk.Label(cf, text="词汇数量:", font=F_BODY, bg=C_CARD, fg=C_TEXT).pack(side="left", padx=(0,8))
        self.count_var = tk.IntVar(value=self.storage.get_settings()["daily_count"])
        tk.Spinbox(cf, from_=10, to=100, increment=5, textvariable=self.count_var,
                   width=8, font=F_BODY, justify="center").pack(side="left", padx=(0,5))
        tk.Label(cf, text="(10-100)", font=F_SMALL, bg=C_CARD, fg=C_TEXT_LT).pack(side="left")

        lf = tk.Frame(sf, bg=C_CARD); lf.pack(fill="x", pady=(0,6))
        tk.Label(lf, text="选择词库:", font=F_BODY, bg=C_CARD, fg=C_TEXT).pack(side="left", padx=(0,8))
        self.level_var = tk.StringVar(value=self.storage.get_settings()["level"])
        for txt,val in [("四级","CET4"),("六级","CET6"),("全部","all")]:
            tk.Radiobutton(lf, text=txt, variable=self.level_var, value=val,
                           font=F_BODY, bg=C_CARD, activebackground=C_CARD).pack(side="left", padx=4)

        self.exclude_var = tk.BooleanVar(value=self.storage.get_settings().get("exclude_mastered", True))
        tk.Checkbutton(sf, text="排除已掌握的词汇", variable=self.exclude_var,
                       font=F_BODY, bg=C_CARD, activebackground=C_CARD).pack(anchor="w", pady=(2,5))

        HoverButton(t, text="开始学习", font=F_HEAD, bg_n=C_PRIMARY, bg_h=C_PRIMARY_D,
                    fg="white", width=18, relief="flat", cursor="hand2",
                    command=self._start_quiz).pack(pady=(8,5))
        self.mode_desc = tk.Label(t, text="", font=F_SMALL, bg=C_CARD, fg=C_TEXT_LT, justify="left")
        self.mode_desc.pack(pady=(5,0))
        self._mode_chg()

    def _mode_chg(self):
        m = self.quiz_mode_var.get()
        d = {"word_to_meaning":"看词选义：显示英文单词，从4个选项中选择正确的中文释义\n答错自动加入错题本，答题后显示词组例句",
              "meaning_to_word":"看义选词：显示中文释义，从4个选项中选择正确的英文单词\n答错自动加入错题本，答题后显示词组例句",
              "card":"词卡浏览：翻卡式学习，先看单词再翻卡看释义\n自评认识/不认识，不认识的词加入错题本"}
        self.mode_desc.config(text=d.get(m,""))

    def _start_quiz(self):
        cnt = max(10, min(100, self.count_var.get()))
        lvl = self.level_var.get()
        mode = self.quiz_mode_var.get()
        exc = self.exclude_var.get()
        # 持久化所有设置
        self.storage.update_settings(daily_count=cnt, level=lvl, quiz_mode=mode, exclude_mastered=exc)
        mastered = self.storage.get_mastered_set() if exc else None
        words = self.loader.get_words(level=lvl, count=cnt, mastered=mastered)
        if not words:
            messagebox.showinfo("提示", "没有可用的词汇，请检查词库设置。"); return
        self.status.config(text=f"正在学习: {len(words)} 个词汇...")
        if mode == "card":
            self.qw = WordCardWindow(self.root, self.loader, self.storage, words, on_finish=self._finish)
        else:
            self.qw = MultipleChoiceQuiz(self.root, self.loader, self.storage, words, mode=mode, on_finish=self._finish)

    def _finish(self):
        self._update_home(); self._update_stats(); self._update_wrong()
        self.status.config(text="学习完成")

    # ===== 统计 =====

    def _build_stats(self):
        t = self.tab_stats; t.configure(padx=30, pady=12)
        tk.Label(t, text="学习统计", font=F_HEAD, bg=C_CARD, fg=C_TEXT).pack(anchor="w", pady=(0,10))
        self.sf = tk.Frame(t, bg=C_CARD); self.sf.pack(fill="both", expand=True)

    def _update_stats(self):
        for w in self.sf.winfo_children(): w.destroy()
        s = self.storage.get_stats()
        cards = [("累计打卡", s["total_days"], C_PRIMARY), ("连续打卡", s["streak_days"], C_ACCENT),
                 ("学习词汇", s["total_words"], C_SUCCESS), ("答对词汇", s["total_correct"], C_SUCCESS),
                 ("正确率", f"{s['accuracy']:.1f}%", C_WARN), ("已掌握", s["mastered_count"], C_PRIMARY),
                 ("错题数", s["wrong_count"], C_ERROR), ("词库总量", self.loader.total_count, C_TEXT_LT)]
        for i,(title,val,clr) in enumerate(cards):
            r,c = i//2, i%2
            card = tk.Frame(self.sf, bg=C_CARD, highlightbackground=C_BORDER, highlightthickness=1)
            card.grid(row=r, column=c, padx=5, pady=5, sticky="nsew", ipadx=10, ipady=8)
            tk.Label(card, text=str(val), font=("Microsoft YaHei",24,"bold"), bg=C_CARD, fg=clr).pack(pady=(3,0))
            tk.Label(card, text=title, font=F_SMALL, bg=C_CARD, fg=C_TEXT_LT).pack(pady=(0,3))
        self.sf.grid_columnconfigure(0, weight=1); self.sf.grid_columnconfigure(1, weight=1)

    # ===== 错题本 =====

    def _build_wrong(self):
        t = self.tab_wrong; t.configure(padx=20, pady=12)
        hd = tk.Frame(t, bg=C_CARD); hd.pack(fill="x", pady=(0,10))
        tk.Label(hd, text="错题本", font=F_HEAD, bg=C_CARD, fg=C_TEXT).pack(side="left")
        HoverButton(hd, text="清空", font=F_SMALL, bg_n=C_ERROR, bg_h="#dc2626", fg="white",
                    relief="flat", cursor="hand2", command=self._clear_wrong).pack(side="right", padx=5)
        HoverButton(hd, text="刷新", font=F_SMALL, bg_n=C_PRIMARY, bg_h=C_PRIMARY_D, fg="white",
                    relief="flat", cursor="hand2", command=self._update_wrong).pack(side="right", padx=5)
        lf = tk.Frame(t, bg=C_CARD, highlightbackground=C_BORDER, highlightthickness=1)
        lf.pack(fill="both", expand=True)
        cols = ("word","translation","level")
        self.wtree = ttk.Treeview(lf, columns=cols, show="headings", height=15)
        self.wtree.heading("word", text="单词"); self.wtree.heading("translation", text="释义")
        self.wtree.heading("level", text="级别")
        self.wtree.column("word", width=150); self.wtree.column("translation", width=350)
        self.wtree.column("level", width=80)
        self.wtree.tag_configure("even", background=C_BG)
        self.wtree.tag_configure("odd", background=C_CARD)
        sc = ttk.Scrollbar(lf, orient="vertical", command=self.wtree.yview)
        self.wtree.configure(yscrollcommand=sc.set)
        self.wtree.pack(side="left", fill="both", expand=True, padx=(2,0))
        sc.pack(side="right", fill="y", pady=2)
        self.wtree.bind("<Double-1>", self._del_wrong)

    def _update_wrong(self):
        for it in self.wtree.get_children(): self.wtree.delete(it)
        wws = self.storage.get_wrong_words()
        for idx,wt in enumerate(wws):
            it = self.loader.get_word_by_text(wt)
            tag = "even" if idx%2==0 else "odd"
            if it:
                self.wtree.insert("", "end", values=(it.word, it.translation_text, it.level), tags=(wt, tag))
            else:
                self.wtree.insert("", "end", values=(wt, "(未找到)", ""), tags=(wt, tag))

    def _del_wrong(self, e):
        sel = self.wtree.selection()
        if not sel: return
        it = sel[0]; tags = self.wtree.item(it, "tags")
        if tags: self.storage.remove_wrong_word(tags[0]); self._update_wrong()

    def _clear_wrong(self):
        if messagebox.askyesno("确认", "确定清空错题本吗？"):
            self.storage.clear_wrong_words(); self._update_wrong(); self._update_stats()

    # ===== 设置 =====

    def _build_settings(self):
        t = self.tab_settings; t.configure(padx=30, pady=12)
        tk.Label(t, text="学习设置", font=F_HEAD, bg=C_CARD, fg=C_TEXT).pack(anchor="w", pady=(0,10))
        rf = tk.LabelFrame(t, text="打卡提醒", font=F_BODY, bg=C_CARD, fg=C_TEXT, padx=15, pady=10)
        rf.pack(fill="x", pady=(0,10))
        self.re_en = tk.BooleanVar(value=self.storage.get_settings().get("remind_enabled", True))
        tk.Checkbutton(rf, text="启用每日弹窗提醒", variable=self.re_en,
                       font=F_BODY, bg=C_CARD, activebackground=C_CARD).pack(anchor="w", pady=(0,5))
        tf = tk.Frame(rf, bg=C_CARD); tf.pack(fill="x", pady=(5,0))
        tk.Label(tf, text="提醒时段:", font=F_BODY, bg=C_CARD).pack(side="left", padx=(0,8))
        self.re_st = tk.StringVar(value=self.storage.get_settings().get("remind_start","08:00"))
        self.re_ed = tk.StringVar(value=self.storage.get_settings().get("remind_end","22:00"))
        tk.Label(tf, text="从", font=F_SMALL, bg=C_CARD).pack(side="left")
        tk.Entry(tf, textvariable=self.re_st, width=6, font=F_BODY, justify="center").pack(side="left", padx=(3,5))
        tk.Label(tf, text="到", font=F_SMALL, bg=C_CARD).pack(side="left")
        tk.Entry(tf, textvariable=self.re_ed, width=6, font=F_BODY, justify="center").pack(side="left", padx=(3,5))
        tk.Label(tf, text="(HH:MM)", font=F_SMALL, bg=C_CARD, fg=C_TEXT_LT).pack(side="left", padx=(5,0))

        pf = tk.LabelFrame(t, text="数据文件路径", font=F_BODY, bg=C_CARD, fg=C_TEXT, padx=15, pady=10)
        pf.pack(fill="x", pady=(0,10))
        from storage import APP_DIR, DATA_FILE
        tk.Label(pf, text=f"数据目录: {APP_DIR}", font=F_SMALL, bg=C_CARD, fg=C_TEXT_LT, anchor="w").pack(anchor="w", pady=2)
        tk.Label(pf, text=f"数据文件: {DATA_FILE}", font=F_SMALL, bg=C_CARD, fg=C_TEXT_LT, anchor="w").pack(anchor="w", pady=2)

        HoverButton(t, text="保存设置", font=F_BODY, bg_n=C_PRIMARY, bg_h=C_PRIMARY_D, fg="white",
                    width=15, relief="flat", cursor="hand2", command=self._save_set).pack(pady=(8,0))
        HoverButton(t, text="测试通知", font=F_SMALL, bg_n=C_WARN, bg_h=C_WARN_D, fg="white",
                    width=15, relief="flat", cursor="hand2", command=self._show_toast).pack(pady=(8,0))

    def _save_set(self):
        self.storage.update_settings(remind_enabled=self.re_en.get(),
                                     remind_start=self.re_st.get().strip(),
                                     remind_end=self.re_ed.get().strip())
        messagebox.showinfo("成功", "设置已保存！")
        self._update_home()

    # ===== Win11 风格右下角弹窗通知 =====

    def _check_reminder(self):
        st = self.storage.get_settings()
        if st.get("remind_enabled", True) and not self.storage.has_checked_in_today():
            self._show_toast()

    def _show_toast(self):
        # 关键：从后台线程调用时切回主线程，否则 tkinter 创建窗口会静默失败
        self.root.after(0, self._create_toast)

    def _create_toast(self):
        streak = self.storage.get_streak_days()
        if self.storage.has_checked_in_today():
            msg = "今日已打卡，可继续复习错题。"
        else:
            msg = f"今日还未打卡学习！连续打卡 {streak} 天，继续加油！"
        WinToast(self.root, "学习提醒", msg, on_action=self._start_quiz)

    # ===== 运行 =====

    def run(self):
        self._center()
        self._update_stats()
        self._update_wrong()
        self.root.mainloop()
