class UI {
  constructor() {
    this.currentPage = 'home';
    this.settings = {};
    this.pendingSession = null;
    this.mistakeSort = 'recent';
    this.mistakeLayout = 'detail';
    this.highFreqMap = null;
    this.phoneticMap = null;
    this.readyToTrackTab = false;
    this.quickStartBound = false;
    this.settingsActionsBound = false;
    this.mistakesActionsBound = false;
    this.initNavigation();
  }

  // 启动时恢复到上次所在的页面
  async restoreLastPage() {
    const validTabs = ['home', 'learn', 'stats', 'mistakes', 'settings'];

    try {
      const settings = await api.getSettings();
      this.settings = settings;

      // 先套用外观，避免页面闪一下默认配色
      window.theme.applyFromSettings(settings);

      const target = validTabs.includes(settings.last_tab) ? settings.last_tab : 'home';
      this.readyToTrackTab = true;

      if (target === 'learn') {
        const session = await api.getSession();
        const today = new Date().toISOString().split('T')[0];

        if (session && session.date === today && (session.index || 0) < (session.words || []).length) {
          this.pendingSession = session;
          await this.continueSession();
          return;
        }

        this.navigateTo('home');
        return;
      }

      this.navigateTo(target);
    } catch (error) {
      console.error('恢复上次页面失败:', error);
      this.readyToTrackTab = true;
      this.navigateTo('home');
    }
  }

  initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const page = item.dataset.page;
        this.navigateTo(page);
      });
    });
  }

  navigateTo(page) {
    const pages = document.querySelectorAll('.page');
    const navItems = document.querySelectorAll('.nav-item');

    pages.forEach(p => p.classList.remove('active'));
    navItems.forEach(n => n.classList.remove('active'));

    const targetPage = document.getElementById(`page-${page}`);
    const targetNav = document.querySelector(`.nav-item[data-page="${page}"]`);

    if (targetPage) {
      targetPage.classList.add('active');
    }

    if (targetNav) {
      targetNav.classList.add('active');
    }

    this.currentPage = page;

    if (this.readyToTrackTab) {
      api.updateSettings({ last_tab: page }).catch(() => {});
    }

    if (page === 'home') {
      this.loadHomePage();
    } else if (page === 'stats') {
      this.loadStatsPage();
    } else if (page === 'mistakes') {
      this.loadMistakesPage();
    } else if (page === 'settings') {
      this.loadSettingsPage();
    }
  }

  async loadHomePage() {
    try {
      const stats = await api.getStats();
      const settings = await api.getSettings();

      this.updateStreakBadge(stats.streak_days);
      this.updateCheckInStatus(stats);
      this.setupQuickStart(settings);
      await this.loadTodaySession();
      this.loadReviewReminder(stats);
    } catch (error) {
      console.error('加载首页数据失败:', error);
    }
  }

  // 艾宾浩斯复习提醒：有到期错词时在首页提示，点击直接开始复习
  loadReviewReminder(stats) {
    const section = document.getElementById('review-section');
    if (!section) {
      return;
    }

    const dueCount = (stats.wrong_words || []).filter(item => this.isReviewDue(item)).length;

    if (dueCount === 0) {
      section.classList.add('hidden');
      return;
    }

    document.getElementById('review-text').textContent =
      `今天有 ${dueCount} 个错词到了复习时间`;
    section.classList.remove('hidden');

    document.getElementById('review-btn').onclick = () => this.startWrongQuiz();
  }

  // 显示「今日学习进行中」卡片
  async loadTodaySession() {
    const section = document.getElementById('continue-section');

    let session = null;
    try {
      session = await api.getSession();
    } catch (error) {
      console.error('读取学习进度失败:', error);
    }

    const today = new Date().toISOString().split('T')[0];
    const unfinished = session
      && session.date === today
      && Array.isArray(session.words)
      && session.words.length > 0
      && (session.index || 0) < session.words.length;

    if (!unfinished) {
      this.pendingSession = null;
      section.classList.add('hidden');
      return;
    }

    this.pendingSession = session;

    const modeNames = {
      'word_to_translation': '看词选义',
      'translation_to_word': '看义选词',
      'flashcard': '词卡浏览'
    };
    const percent = Math.round((session.index / session.words.length) * 100);

    document.getElementById('continue-count').textContent =
      `已完成 ${session.index} / ${session.words.length}`;
    document.getElementById('continue-mode').textContent = modeNames[session.mode] || '';
    document.getElementById('continue-bar-fill').style.width = `${percent}%`;

    section.classList.remove('hidden');

    document.getElementById('continue-btn').onclick = () => this.continueSession();
  }

  async continueSession() {
    if (!this.pendingSession) {
      return;
    }

    this.navigateTo('learn');

    document.getElementById('learn-area').innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>正在恢复上次的进度…</p>
      </div>
    `;

    await window.quiz.resumeSession(this.pendingSession, this.settings);
  }

  // 点击提醒通知或托盘「开始学习」：有未完成进度就继续，否则开始新的一局
  async startOrResume() {
    if (!this.settings || !this.settings.vocab_source) {
      this.settings = await api.getSettings();
    }

    await this.loadTodaySession();

    if (this.pendingSession) {
      await this.continueSession();
      return;
    }

    await this.startQuizWithMode(this.settings.quiz_mode || 'word_to_translation', this.settings);
  }

  updateStreakBadge(days) {
    const streakCount = document.getElementById('streak-count');
    streakCount.textContent = days;
  }

  updateCheckInStatus(stats) {
    const today = new Date().toISOString().split('T')[0];
    const isCheckedIn = stats.last_check_in === today;

    const checkinCard = document.getElementById('checkin-card');
    const checkinIcon = document.getElementById('checkin-icon');
    const checkinTitle = document.getElementById('checkin-title');
    const checkinText = document.getElementById('checkin-text');

    if (isCheckedIn) {
      checkinCard.classList.add('checked-in');
      checkinIcon.textContent = '✅';
      checkinTitle.textContent = '今日已打卡';
      checkinText.textContent = `连续打卡 ${stats.streak_days} 天，继续加油！`;
    } else {
      checkinCard.classList.remove('checked-in');
      checkinIcon.textContent = '📅';
      checkinTitle.textContent = '今日未打卡';
      checkinText.textContent = '点击下方按钮开始今日学习';
    }
  }

  setupQuickStart(settings) {
    this.settings = settings;

    if (this.quickStartBound) {
      return;
    }

    const quickBtns = document.querySelectorAll('.quick-btn');
    quickBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        // 已有未完成的进度时先确认，避免误操作丢进度
        if (this.pendingSession
          && !confirm('将重新开始一套新题目，今日已完成的进度会被放弃，确定继续吗？')) {
          return;
        }
        this.startQuizWithMode(btn.dataset.mode, this.settings);
      });
    });

    this.quickStartBound = true;
  }

  async startQuizWithMode(mode, settings) {
    this.navigateTo('learn');

    const learnArea = document.getElementById('learn-area');
    if (learnArea) {
      learnArea.innerHTML = `
        <div class="loading-state">
          <div class="spinner"></div>
          <p>正在准备词汇…</p>
        </div>
      `;
    }

    try {
      await this.performCheckIn();
      await window.quiz.startQuiz(mode, settings);
    } catch (error) {
      console.error('开始测验失败:', error);
      if (learnArea) {
        learnArea.innerHTML = `
          <div class="loading-state">
            <p>词汇加载失败，请稍后重试。</p>
          </div>
        `;
      }
    }
  }

  async performCheckIn() {
    try {
      const result = await api.checkIn();
      if (result.success) {
        this.updateCheckInStatus(result.stats);
      }
    } catch (error) {
      console.error('打卡失败:', error);
    }
  }

  async loadStatsPage() {
    try {
      const stats = await api.getStats();
      this.updateStatsDisplay(stats);
    } catch (error) {
      console.error('加载统计数据失败:', error);
    }
  }

  updateStatsDisplay(stats) {
    document.getElementById('stat-streak').textContent = stats.streak_days || 0;
    document.getElementById('stat-total').textContent = stats.total_days || 0;
    document.getElementById('stat-quizzes').textContent = stats.total_quizzes || 0;
    document.getElementById('stat-correct').textContent = stats.correct_count || 0;
    document.getElementById('stat-wrong').textContent = stats.wrong_count || 0;

    const total = (stats.correct_count || 0) + (stats.wrong_count || 0);
    const accuracy = total > 0 ? Math.round((stats.correct_count / total) * 100) : 0;
    document.getElementById('stat-accuracy').textContent = `${accuracy}%`;

    document.getElementById('stat-mastered').textContent = (stats.mastered_words || []).length;
    document.getElementById('stat-mistakes').textContent = (stats.wrong_words || []).length;
  }

  async loadMistakesPage() {
    try {
      const stats = await api.getStats();

      if (!this.settings || !this.settings.vocab_source) {
        this.settings = await api.getSettings();
      }

      // 排列方式与显示模式都持久化在设置里，重开软件后保持不变
      this.mistakeSort = this.settings.mistake_sort || 'recent';
      this.mistakeLayout = this.settings.mistake_layout || 'detail';

      // 高频词在复习时会走默写，这里先标出来
      try {
        this.highFreqMap = await api.getHighFreqMap();
      } catch (error) {
        console.error('加载高频词表失败:', error);
        this.highFreqMap = {};
      }

      try {
        this.phoneticMap = await api.getPhoneticMap();
      } catch (error) {
        console.error('加载音标表失败:', error);
        this.phoneticMap = {};
      }

      const wrongWords = stats.wrong_words || [];

      this.syncMistakeControls();
      this.renderMistakesList(wrongWords);
      this.updateMistakesSummary(wrongWords);
      this.setupMistakesActions();
    } catch (error) {
      console.error('加载错题本失败:', error);
    }
  }

  syncMistakeControls() {
    const sortBox = document.getElementById('mistake-sorts');
    if (sortBox) {
      sortBox.querySelectorAll('[data-sort]').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.sort === this.mistakeSort);
      });
    }

    const layoutBox = document.getElementById('mistake-layouts');
    if (layoutBox) {
      layoutBox.querySelectorAll('[data-layout]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.layout === this.mistakeLayout);
      });
    }
  }

  saveMistakePref(key, value) {
    this.settings[key] = value;
    api.updateSettings({ [key]: value }).catch(() => {});
  }

  // 错词数量统计 + 测试按钮文案（有到期错词时优先复习到期的）
  updateMistakesSummary(wrongWords) {
    const subtitle = document.getElementById('mistakes-subtitle');
    const quizBtn = document.getElementById('start-wrong-quiz');
    const dueCount = wrongWords.filter(item => this.isReviewDue(item)).length;
    const bestCount = dueCount > 0 ? dueCount : wrongWords.length;

    if (subtitle) {
      const mastered = wrongWords.filter(item => item.graduated).length;
      subtitle.textContent = wrongWords.length === 0
        ? '共 0 个错词'
        : `共 ${wrongWords.length} 个错词 · 今日待复习 ${dueCount} 个 · 已掌握 ${mastered} 个`;
    }

    if (quizBtn) {
      quizBtn.disabled = wrongWords.length === 0;
      quizBtn.textContent = dueCount > 0
        ? `开始错词测试（今日复习 ${dueCount} 个）`
        : `开始错词测试（全部 ${bestCount} 个）`;
    }
  }

  // 是否到了该复习的日期
  isReviewDue(item) {
    if (item.graduated) {
      return false;
    }
    return !item.next_review || item.next_review <= this.todayKey();
  }

  todayKey() {
    return new Date().toISOString().split('T')[0];
  }

  // 距离下次复习还有几天
  daysUntilReview(item) {
    if (!item.next_review) {
      return 0;
    }
    const today = new Date(`${this.todayKey()}T00:00:00Z`);
    const next = new Date(`${item.next_review}T00:00:00Z`);
    return Math.round((next - today) / 86400000);
  }

  // 复习状态徽章：已掌握 / 今日复习 / N 天后复习
  reviewBadge(item) {
    if (item.graduated) {
      return '<span class="mistake-badge badge-done">已掌握</span>';
    }

    const days = this.daysUntilReview(item);
    if (days <= 0) {
      return '<span class="mistake-badge badge-due">今日复习</span>';
    }

    return `<span class="mistake-badge badge-wait">${days} 天后复习</span>`;
  }

  sortWrongWords(wrongWords) {
    const items = [...wrongWords];
    const byWord = (a, b) => String(a.word).localeCompare(String(b.word));
    const byAdded = (a, b) => String(a.added_at || '').localeCompare(String(b.added_at || ''));

    // 旧数据的 added_at 只精确到天，同一天加入的词靠不住它区分。
    // 数据文件里就是按加入先后顺序存的，用它的位置作为次级依据。
    const order = new Map(wrongWords.map((item, index) => [item.word, index]));
    const byAddedAsc = (a, b) => byAdded(a, b) || order.get(a.word) - order.get(b.word);

    switch (this.mistakeSort) {
      case 'oldest':
        return items.sort(byAddedAsc);
      case 'alpha':
        return items.sort(byWord);
      case 'level':
        return items.sort((a, b) => String(a.level || '').localeCompare(String(b.level || '')) || byWord(a, b));
      case 'wrong':
        return items.sort((a, b) => (b.wrong_count || 0) - (a.wrong_count || 0) || byWord(a, b));
      case 'review':
        return items.sort((a, b) => String(a.next_review || '').localeCompare(String(b.next_review || '')) || byWord(a, b));
      case 'recent':
      default:
        return items.sort((a, b) => byAddedAsc(b, a));
    }
  }

  // 加入时间：新数据带时间戳，旧的只有日期，统一显示成本地时间
  formatAddedAt(value) {
    if (!value) {
      return '—';
    }

    const text = String(value);
    if (text.length <= 10) {
      return text;
    }

    const date = new Date(text);
    if (Number.isNaN(date.getTime())) {
      return text.slice(0, 10);
    }

    const pad = number => String(number).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} `
      + `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  // 真题出现次数，0 表示不在高频词表里
  highFreqScore(word) {
    if (!this.highFreqMap) {
      return 0;
    }
    return this.highFreqMap[String(word).trim().toLowerCase()] || 0;
  }

  // 音标统一用斜杠包裹显示；词表里查不到这个单词时不显示
  phoneticHtml(word) {
    const text = this.phoneticMap ? this.phoneticMap[String(word).trim().toLowerCase()] : '';
    return text ? `<span class="phonetic">/${text}/</span>` : '';
  }

  // 高频词会在复习时改考默写，给个醒目标记
  highFreqBadge(word) {
    const score = this.highFreqScore(word);
    if (!score) {
      return '';
    }
    return `<span class="mistake-badge badge-freq" title="考研/四级/六级真题累计出现 ${score} 次">🔥 高频</span>`;
  }

  // 条状详细：完整展示释义、例句与复习信息
  renderDetailItem(word) {
    const phrasesHtml = word.phrases && word.phrases.length > 0
      ? `<div class="mistake-phrases">
          <div class="phrases-title">词组例句：</div>
          ${word.phrases.slice(0, 3).map(phrase => `
            <div class="mistake-phrase-item">
              <span class="mistake-phrase-en">${phrase.phrase}</span>
              <span class="mistake-phrase-zh">${phrase.translation}</span>
            </div>
          `).join('')}
        </div>`
      : '';

    return `
      <div class="mistake-header">
        <div class="mistake-word-line">
          <span class="mistake-word">${word.word}</span>
          ${this.phoneticHtml(word.word)}
          ${this.highFreqBadge(word.word)}
          ${this.reviewBadge(word)}
        </div>
        <span class="mistake-level">${word.level}</span>
      </div>
      <div class="mistake-translation">${word.translation}</div>
      ${phrasesHtml}
      <div class="mistake-meta">
        <span>答错 ${word.wrong_count || 1} 次</span>
        <span>已复习 ${word.review_count || 0} 次</span>
        <span>加入于 ${this.formatAddedAt(word.added_at)}</span>
      </div>
      <div class="mistake-actions">
        <button class="btn btn-secondary btn-sm" onclick="ui.removeMistake('${word.word}')">移除</button>
      </div>
    `;
  }

  // 网格简略：一屏扫视更多单词，只看单词、释义与复习状态
  renderGridItem(word) {
    return `
      <div class="mistake-grid-head">
        <span class="mistake-word-wrap">
          <span class="mistake-word">${word.word}</span>${this.phoneticHtml(word.word)}
        </span>
        <span class="mistake-level">${word.level}</span>
      </div>
      <div class="mistake-grid-badges">
        ${this.reviewBadge(word)}
        ${this.highFreqBadge(word.word)}
        <span class="mistake-badge badge-count">错 ${word.wrong_count || 1}</span>
      </div>
      <div class="mistake-translation">${word.translation}</div>
      <div class="mistake-grid-actions">
        <button class="btn btn-secondary btn-sm" onclick="ui.removeMistake('${word.word}')">移除</button>
      </div>
    `;
  }

  renderMistakesList(wrongWords) {
    const mistakesList = document.getElementById('mistakes-list');
    const mistakesEmpty = document.getElementById('mistakes-empty');

    if (wrongWords.length === 0) {
      mistakesList.classList.add('hidden');
      mistakesEmpty.classList.remove('hidden');
      return;
    }

    mistakesList.classList.remove('hidden');
    mistakesEmpty.classList.add('hidden');

    const isGrid = this.mistakeLayout === 'grid';
    mistakesList.classList.toggle('layout-grid', isGrid);
    mistakesList.innerHTML = '';

    this.sortWrongWords(wrongWords).forEach((word, index) => {
      const mistakeItem = document.createElement('div');
      mistakeItem.className = isGrid ? 'mistake-item mistake-grid-item' : 'mistake-item';
      mistakeItem.style.animationDelay = `${Math.min(index, 12) * 0.04}s`;
      mistakeItem.innerHTML = isGrid ? this.renderGridItem(word) : this.renderDetailItem(word);

      mistakesList.appendChild(mistakeItem);
    });
  }

  async removeMistake(word) {
    try {
      await api.removeWrongWord(word);
      this.loadMistakesPage();
    } catch (error) {
      console.error('移除错题失败:', error);
    }
  }

  setupMistakesActions() {
    if (this.mistakesActionsBound) {
      return;
    }

    const clearBtn = document.getElementById('clear-mistakes');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearMistakes());
    }

    const quizBtn = document.getElementById('start-wrong-quiz');
    if (quizBtn) {
      quizBtn.addEventListener('click', () => this.startWrongQuiz());
    }

    const sortBox = document.getElementById('mistake-sorts');
    if (sortBox) {
      sortBox.querySelectorAll('[data-sort]').forEach(chip => {
        chip.addEventListener('click', () => {
          this.mistakeSort = chip.dataset.sort;
          this.saveMistakePref('mistake_sort', this.mistakeSort);
          this.syncMistakeControls();
          this.loadMistakesPage();
        });
      });
    }

    const layoutBox = document.getElementById('mistake-layouts');
    if (layoutBox) {
      layoutBox.querySelectorAll('[data-layout]').forEach(btn => {
        btn.addEventListener('click', () => {
          this.mistakeLayout = btn.dataset.layout;
          this.saveMistakePref('mistake_layout', this.mistakeLayout);
          this.syncMistakeControls();
          this.loadMistakesPage();
        });
      });
    }

    this.mistakesActionsBound = true;
  }

  // 错词测试：只考错题本里的单词，答对后按艾宾浩斯曲线安排下次复习
  async startWrongQuiz() {
    if (!this.settings || !this.settings.quiz_mode) {
      this.settings = await api.getSettings();
    }

    this.navigateTo('learn');

    document.getElementById('learn-area').innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>正在准备错词…</p>
      </div>
    `;

    try {
      await window.quiz.startWrongQuiz(this.settings.quiz_mode || 'word_to_translation', this.settings);
    } catch (error) {
      console.error('开始错词测试失败:', error);
      document.getElementById('learn-area').innerHTML = `
        <div class="loading-state">
          <p>错词加载失败，请稍后重试。</p>
        </div>
      `;
    }
  }

  async clearMistakes() {
    if (confirm('确定要清空错题本吗？')) {
      try {
        await api.clearMistakes();
        this.loadMistakesPage();
      } catch (error) {
        console.error('清空错题本失败:', error);
      }
    }
  }

  async loadSettingsPage() {
    try {
      const settings = await api.getSettings();
      this.loadSettingsForm(settings);

      window.theme.applyFromSettings(settings);
      window.theme.renderControls();

      try {
        const system = await api.getSystemSettings();
        document.getElementById('setting-auto-start').checked = !!system.autoStart;
        document.getElementById('setting-close-to-tray').checked = !!system.closeToTray;
      } catch (error) {
        console.error('读取系统设置失败:', error);
      }

      this.setupSettingsActions();
    } catch (error) {
      console.error('加载设置失败:', error);
    }
  }

  loadSettingsForm(settings) {
    document.getElementById('setting-remind-enabled').checked = settings.remind_enabled !== false;
    document.getElementById('setting-remind-start').value = settings.remind_start || '08:00';
    document.getElementById('setting-remind-end').value = settings.remind_end || '22:00';
    document.getElementById('setting-quiz-mode').value = settings.quiz_mode || 'word_to_translation';
    document.getElementById('setting-vocab-source').value = settings.vocab_source || 'all';
    document.getElementById('setting-exclude-mastered').checked = settings.exclude_mastered !== false;
    document.getElementById('setting-high-freq-spelling').checked = settings.high_freq_spelling !== false;

    const dailySelect = document.getElementById('setting-daily-count');
    const daily = String(settings.daily_count || 100);
    const matched = Array.from(dailySelect.options).some(option => option.value === daily);
    dailySelect.value = matched ? daily : '100';
  }

  setupSettingsActions() {
    if (this.settingsActionsBound) {
      return;
    }

    const saveBtn = document.getElementById('save-settings');
    const testBtn = document.getElementById('test-notification');
    const hideBtn = document.getElementById('hide-to-tray');

    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.saveSettings());
    }

    if (testBtn) {
      testBtn.addEventListener('click', () => this.testNotification());
    }

    if (hideBtn) {
      hideBtn.addEventListener('click', () => api.hideToTray());
    }

    this.settingsActionsBound = true;
  }

  async saveSettings() {
    const saveBtn = document.getElementById('save-settings');

    try {
      const settings = {
        remind_enabled: document.getElementById('setting-remind-enabled').checked,
        remind_start: document.getElementById('setting-remind-start').value,
        remind_end: document.getElementById('setting-remind-end').value,
        quiz_mode: document.getElementById('setting-quiz-mode').value,
        vocab_source: document.getElementById('setting-vocab-source').value,
        exclude_mastered: document.getElementById('setting-exclude-mastered').checked,
        high_freq_spelling: document.getElementById('setting-high-freq-spelling').checked,
        daily_count: Number(document.getElementById('setting-daily-count').value) || 100,
      };

      await api.updateSettings(settings);
      this.settings = Object.assign({}, this.settings, settings);

      await api.setAutoStart(document.getElementById('setting-auto-start').checked);
      await api.setCloseToTray(document.getElementById('setting-close-to-tray').checked);

      this.showToast('设置已保存', 'success');
    } catch (error) {
      console.error('保存设置失败:', error);
      this.showToast('保存失败，请重试', 'error');
    } finally {
      if (saveBtn) {
        saveBtn.blur();
      }
    }
  }

  async testNotification() {
    const sent = await window.notifications.showReminder();
    if (sent) {
      this.showToast('已发送测试通知', 'success');
    }
  }

  showToast(message, type = 'info') {
    const existing = document.querySelector('.app-toast');
    if (existing) {
      existing.remove();
    }

    const toast = document.createElement('div');
    toast.className = `app-toast app-toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('visible'));

    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, 2400);
  }
}

window.ui = new UI();