// 学习时长的统计口径：停在学习页 + 窗口可见 + 最近有过操作才算。
// 每 STUDY_TICK_SECONDS 秒累加一拍，攒够 STUDY_FLUSH_SECONDS 秒写回一次数据。
const STUDY_TICK_SECONDS = 5;
const STUDY_FLUSH_SECONDS = 30;
// 超过这么久没有任何点击 / 按键，就认为人不在，这段时间不计入
const STUDY_IDLE_SECONDS = 60;

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
    // 打卡日历：当前显示的月份 + 是否已绑定翻月按钮
    this.calendarCursor = null;
    this.calendarBound = false;
    this.checkinDates = new Set();
    // 学习时长：还没上报的秒数、最近一次操作时间、最近一次上报的 Promise
    this.pendingStudySeconds = 0;
    this.lastActivityAt = 0;
    this.studyTimerId = null;
    this.studyFlush = null;
    this.initNavigation();
    this.initWindowControls();
    this.startStudyTimer();
  }

  initWindowControls() {
    const titlebar = document.getElementById('desktop-titlebar');
    if (!titlebar || !api.isDesktopWindow || !api.isDesktopWindow()) return;
    titlebar.hidden = false;
    document.body.classList.add('has-desktop-titlebar');

    document.getElementById('window-minimize').addEventListener('click', () => api.minimizeWindow());
    document.getElementById('window-maximize').addEventListener('click', async () => {
      const state = await api.toggleMaximizeWindow();
      this.syncWindowMaximizeButton(state.isMaximized);
    });
    document.getElementById('window-close').addEventListener('click', () => api.closeWindow());
    document.getElementById('desktop-titlebar-drag').addEventListener('dblclick', async event => {
      if (event.target.closest('button')) return;
      const state = await api.toggleMaximizeWindow();
      this.syncWindowMaximizeButton(state.isMaximized);
    });

    api.getWindowState().then(state => this.syncWindowMaximizeButton(state.isMaximized));
    if (api.onWindowMaximizeChange) {
      api.onWindowMaximizeChange(isMaximized => this.syncWindowMaximizeButton(isMaximized));
    }
  }

  syncWindowMaximizeButton(isMaximized) {
    const button = document.getElementById('window-maximize');
    if (!button) return;
    button.title = isMaximized ? '还原' : '最大化';
    button.setAttribute('aria-label', button.title);
    button.querySelector('svg').innerHTML = isMaximized
      ? '<path d="M4 2h6v6M8 4H2v6h6V4Z"/>'
      : '<rect x="2" y="2" width="8" height="8" rx="1"/>';
  }

  // 启动时恢复到上次所在的页面
  async restoreLastPage() {
    const validTabs = ['home', 'learn', 'stats', 'mistakes', 'translate', 'settings'];

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

        // 没有未完成进度就直接开一局（默认看词选义），不要停在空白页
        await this.startQuizWithMode(settings.quiz_mode || 'word_to_translation', settings);
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

  /**
   * 只切页面、不加载内容。
   * 学习页的内容由各入口自己准备（开局 / 继续进度 / 错词测试），
   * 那些入口需要先切页再自己渲染，所以走这里而不是带自动开局的 navigateTo。
   */
  switchPage(page) {
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

    // 离开学习页时取消抑制提醒，并把还没上报的学习时长先写回去
    if (page !== 'learn') {
      try { api.setStudying(false); } catch (e) {}
      this.flushStudyTime();
    }

    if (this.readyToTrackTab) {
      api.updateSettings({ last_tab: page }).catch(() => {});
    }
  }

  navigateTo(page) {
    this.switchPage(page);

    if (page === 'home') {
      this.loadHomePage();
    } else if (page === 'learn') {
      this.openLearnPage();
    } else if (page === 'stats') {
      this.loadStatsPage();
    } else if (page === 'mistakes') {
      this.loadMistakesPage();
    } else if (page === 'translate') {
      window.translator.activate();
    } else if (page === 'settings') {
      this.loadSettingsPage();
    }
  }

  /**
   * 进入学习页：已经有内容（正在答题，或上次的成绩单）就原样保留，
   * 否则先试「继续上次进度」，没有未完成的进度就直接开一局，
   * 默认模式是看词选义，避免点进来是一片空白。
   */
  async openLearnPage() {
    const area = document.getElementById('learn-area');

    // 用子元素判断有没有内容：初始状态里只有一个注释节点
    if (!area || area.children.length > 0) {
      return;
    }

    try {
      await this.startOrResume();
    } catch (error) {
      console.error('打开学习页失败:', error);
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

    this.switchPage('learn');
    try { api.setStudying(true); } catch (e) {}

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
      checkinIcon.innerHTML = '<i class="fa-solid fa-check"></i>';
      checkinTitle.textContent = '今日已打卡';
      checkinText.textContent = `连续打卡 ${stats.streak_days} 天，继续加油！`;
    } else {
      checkinCard.classList.remove('checked-in');
      checkinIcon.innerHTML = '<i class="fa-solid fa-calendar-day"></i>';
      checkinTitle.textContent = '今日未打卡';
      checkinText.textContent = '完成今日学习任务后自动打卡';
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
    this.switchPage('learn');

    try { api.setStudying(true); } catch (e) {}

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
      // 打卡不在这里做，等整套题目做完（quiz.renderResult）再计入
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
        return result.stats;
      }
    } catch (error) {
      console.error('打卡失败:', error);
    }

    return null;
  }

  async loadStatsPage() {
    try {
      // 先把还没落库的学习时长写回去，避免统计页读到旧数字
      await this.flushStudyTime();

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

    this.updateStudyTimeDisplay(stats);
    this.renderCheckinCalendar(stats);
  }

  /* ---------- 打卡日历 ---------- */

  // 每次进统计页都从当月看起，翻月后离开再回来不会停在旧月份
  renderCheckinCalendar(stats) {
    const grid = document.getElementById('calendar-grid');
    if (!grid) {
      return;
    }

    this.checkinDates = new Set(stats.checkin_dates || []);
    this.streakDays = stats.streak_days || 0;
    this.totalDays = stats.total_days || 0;

    const today = this.calendarToday();
    this.calendarCursor = { year: today.getUTCFullYear(), month: today.getUTCMonth() };

    this.bindCalendarEvents();
    this.paintCalendar();
  }

  /**
   * 日期一律按 "YYYY-MM-DD" 处理，与打卡记录、todayKey() 保持同一口径，
   * 都用 UTC 取年月日，避免时区差异让日历和记录差一天。
   */
  calendarToday() {
    return new Date(`${this.todayKey()}T00:00:00Z`);
  }

  bindCalendarEvents() {
    if (this.calendarBound) {
      return;
    }

    const prev = document.getElementById('calendar-prev');
    const next = document.getElementById('calendar-next');

    if (!prev || !next) {
      return;
    }

    prev.addEventListener('click', () => this.shiftCalendar(-1));
    next.addEventListener('click', () => this.shiftCalendar(1));
    this.calendarBound = true;
  }

  shiftCalendar(delta) {
    const shifted = new Date(Date.UTC(this.calendarCursor.year, this.calendarCursor.month + delta, 1));
    this.calendarCursor = {
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth()
    };
    this.paintCalendar();
  }

  // 画当月网格：周日开头，打过卡的日期加标记，今天套个圈
  paintCalendar() {
    const grid = document.getElementById('calendar-grid');
    if (!grid) {
      return;
    }

    const { year, month } = this.calendarCursor;
    const monthLabel = document.getElementById('calendar-month');
    const todayKey = this.todayKey();
    const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

    if (monthLabel) {
      monthLabel.textContent = `${year} 年 ${month + 1} 月`;
    }

    const cells = [];

    // 当月 1 号之前空出的格子
    for (let i = 0; i < firstWeekday; i++) {
      cells.push('<div class="calendar-cell is-blank"></div>');
    }

    let monthCount = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const checked = this.checkinDates.has(key);
      const isToday = key === todayKey;

      if (checked) {
        monthCount++;
      }

      cells.push(
        `<div class="calendar-cell${checked ? ' is-checked' : ''}${isToday ? ' is-today' : ''}"`
        + ` title="${key}${checked ? ' 已打卡' : ''}">`
        + `<span class="calendar-day">${day}</span></div>`
      );
    }

    grid.innerHTML = cells.join('');

    this.setText('calendar-streak', this.streakDays);
    this.setText('calendar-total', this.totalDays);
    this.setText('calendar-month-count', monthCount);

    // 逐日记录是本版才有的，早期打卡补不全，说明一下免得看着像漏记
    this.setText(
      'calendar-note',
      this.totalDays > this.checkinDates.size ? '更早的打卡没有逐日记录，从本版开始逐日保存' : ''
    );
  }

  setText(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  }

  /* ---------- 学习时长统计 ---------- */

  /**
   * 计时口径：停在学习页 + 窗口在前台 + 最近 STUDY_IDLE_SECONDS 秒内有过操作。
   * 挂着不动、切到别的页面、最小化到托盘都不会计入，
   * 所以是「有在学」的时间，而不是打开软件的时间。
   */
  startStudyTimer() {
    if (this.studyTimerId) {
      return;
    }

    ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(type => {
      document.addEventListener(type, () => { this.lastActivityAt = Date.now(); }, { passive: true });
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flushStudyTime();
      }
    });

    this.studyTimerId = setInterval(() => this.tickStudyTime(), STUDY_TICK_SECONDS * 1000);
  }

  isStudyActive() {
    return this.currentPage === 'learn'
      && document.visibilityState === 'visible'
      && (Date.now() - this.lastActivityAt) <= STUDY_IDLE_SECONDS * 1000;
  }

  tickStudyTime() {
    if (!this.isStudyActive()) {
      return;
    }

    this.pendingStudySeconds += STUDY_TICK_SECONDS;

    if (this.pendingStudySeconds >= STUDY_FLUSH_SECONDS) {
      this.flushStudyTime();
    }
  }

  /**
   * 把攒下的秒数写回数据，返回最近一次写入的 Promise。
   * 统计页刷新前会先 await 它，避免读到还没落库的时长。
   */
  flushStudyTime() {
    const seconds = Math.round(this.pendingStudySeconds);

    if (seconds < 1) {
      return this.studyFlush || Promise.resolve();
    }

    this.pendingStudySeconds = 0;
    this.studyFlush = api.addStudyTime(seconds).catch(error => {
      console.error('记录学习时长失败:', error);
      // 写失败就把秒数留着，下次一起上报
      this.pendingStudySeconds += seconds;
    });

    return this.studyFlush;
  }

  // 今日学习时长 + 累计学习时长（累计 = 各天之和）
  updateStudyTimeDisplay(stats) {
    const byDate = stats && stats.study_time && typeof stats.study_time === 'object'
      ? stats.study_time
      : {};
    const total = Object.keys(byDate).reduce((sum, key) => sum + (Number(byDate[key]) || 0), 0);
    const pending = Math.round(this.pendingStudySeconds);

    this.setText('stat-study-today', this.formatDuration((Number(byDate[this.todayKey()]) || 0) + pending));
    this.setText('stat-study-total', this.formatDuration(total + pending));
  }

  // 秒 → 「N 分钟 / N 小时 M 分」，不足一分钟按 0 分钟
  formatDuration(seconds) {
    const minutes = Math.floor(Math.max(0, Number(seconds) || 0) / 60);

    if (minutes < 60) {
      return `${minutes} 分钟`;
    }

    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours} 小时 ${rest} 分` : `${hours} 小时`;
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

  intensiveBadge(item) {
    return item.intensive
      ? `<span class="mistake-badge badge-intensive" title="答对 3 次后自动取消重点标记">重点复习 ${item.intensive_correct || 0}/3</span>`
      : '';
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
    return `<span class="mistake-badge badge-freq" title="考研/四级/六级真题累计出现 ${score} 次"><i class="fa-solid fa-fire"></i> 高频</span>`;
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
          ${this.intensiveBadge(word)}
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
        ${this.intensiveBadge(word)}
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

    this.switchPage('learn');
    try { api.setStudying(true); } catch (e) {}

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
      this.settings = settings;
      this.loadSettingsForm(settings);

      window.theme.applyFromSettings(settings);
      window.theme.renderControls();

      try {
        const system = await api.getSystemSettings();
        document.getElementById('setting-auto-start').checked = !!system.autoStart;
        document.getElementById('setting-close-to-tray').checked = !!system.closeToTray;
        this.syncWindowMaterialControls(system);
      } catch (error) {
        console.error('读取系统设置失败:', error);
      }

      this.setupSettingsActions();
    } catch (error) {
      console.error('加载设置失败:', error);
    }
  }

  // 亚克力材质只有 Windows 11 22H2 以上能用；其他顶部栏效果仍可选。
  syncWindowMaterialControls(system) {
    const select = document.getElementById('setting-window-material');
    const note = document.getElementById('window-material-note');

    if (!select) {
      return;
    }

    select.value = ['default', 'acrylic', 'transparent'].includes(system.windowMaterial)
      ? system.windowMaterial : 'default';
    const acrylicOption = select.querySelector('option[value="acrylic"]');
    if (acrylicOption) acrylicOption.disabled = system.materialSupported === false;

    if (note) {
      note.classList.toggle('hidden', system.materialSupported !== false);
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

      const material = document.getElementById('setting-window-material').value;
      settings.window_material = material;

      await api.updateSettings(settings);
      this.settings = Object.assign({}, this.settings, settings);

      await api.setAutoStart(document.getElementById('setting-auto-start').checked);
      await api.setCloseToTray(document.getElementById('setting-close-to-tray').checked);

      const materialResult = await api.setWindowMaterial(material);
      // 亚克力模式下面板要变成半透明，改完重新套一次外观
      window.theme.applyFromSettings(this.settings);

      if (material === 'acrylic' && materialResult && materialResult.applied === false) {
        this.showToast('当前系统不支持亚克力材质，已改用默认样式', 'info');
      } else {
        this.showToast('设置已保存', 'success');
      }
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
