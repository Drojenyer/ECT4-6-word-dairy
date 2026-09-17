const { app, BrowserWindow, Notification, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const express = require('express');
const fs = require('fs').promises;
const os = require('os');

let mainWindow;
let server;
let tray;
let reminderInterval;
let serverPort = 3000;
let isQuitting = false;
let closeToTray = true;

const DATA_DIR = path.join(os.homedir(), '.cet_vocab');
const DATA_FILE = path.join(DATA_DIR, 'data.json');

const DEFAULT_STATS = {
  streak_days: 0,
  total_days: 0,
  last_check_in: null,
  total_quizzes: 0,
  correct_count: 0,
  wrong_count: 0,
  mastered_words: [],
  wrong_words: []
};

const DEFAULT_SETTINGS = {
  remind_enabled: true,
  remind_start: '08:00',
  remind_end: '22:00',
  quiz_mode: 'word_to_translation',
  vocab_source: 'all',
  exclude_mastered: true,
  // 高频词是否改用「见中写英」默写考察
  high_freq_spelling: true,
  close_to_tray: true,
  auto_start: false,
  daily_count: 100,
  last_tab: 'home',
  // 错题本的排列方式与显示模式
  mistake_sort: 'recent',
  mistake_layout: 'detail',
  // 外观：主题色 / 背景色 / 界面圆角 / 卡片密度
  theme_accent: 'blue',
  theme_background: 'gray',
  theme_radius: 'standard',
  theme_density: 'standard'
};

// 旧版（Python 版）的测验模式命名与新版本不同
const QUIZ_MODE_ALIASES = {
  word_to_meaning: 'word_to_translation',
  meaning_to_word: 'translation_to_word'
};

/**
 * 艾宾浩斯复习间隔（天）。
 * 错词每答对一次就往后推进一个阶段，间隔逐渐拉长；
 * 走完全部阶段即视为已掌握，答错则退回第一阶段重新开始。
 */
const REVIEW_INTERVALS = [0, 1, 2, 4, 7, 15, 30];

function todayString() {
  return new Date().toISOString().split('T')[0];
}

// 错词记录加入时刻用完整时间戳，同一天加入的多个词也能分出先后
function nowTimestamp() {
  return new Date().toISOString();
}

// dateString 既可能是 "2026-09-17"，也可能是完整时间戳，统一取日期部分计算
function addDays(dateString, days) {
  const date = new Date(`${String(dateString).slice(0, 10)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split('T')[0];
}

// 错词的复习阶段对应的下一次复习日期
function nextReviewDate(stage, fromDate) {
  const interval = REVIEW_INTERVALS[Math.min(Math.max(stage, 0), REVIEW_INTERVALS.length - 1)];
  return addDays(fromDate, interval);
}

/**
 * 补齐错词的复习计划字段。
 * 旧数据的错词只有 word/translation/level/phrases，这里补上默认值，
 * 保证「排列方式」和艾宾浩斯复习都能正常工作。
 */
function normalizeWrongWord(item) {
  if (!item || !item.word) {
    return null;
  }

  const addedAt = item.added_at || todayString();
  const stage = Number.isInteger(item.stage) && item.stage >= 0 ? item.stage : 0;

  return {
    word: item.word,
    translation: item.translation || '',
    level: item.level || '',
    phrases: Array.isArray(item.phrases) ? item.phrases : [],
    added_at: addedAt,
    stage,
    wrong_count: Number(item.wrong_count) || 1,
    review_count: Number(item.review_count) || 0,
    last_review: item.last_review || null,
    next_review: item.next_review || nextReviewDate(stage, addedAt),
    graduated: typeof item.graduated === 'boolean'
      ? item.graduated
      : stage >= REVIEW_INTERVALS.length
  };
}

/**
 * 统一数据结构。
 * 旧版本把统计数据直接放在根节点、且没有 stats 字段，
 * 直接读取会导致 /api/stats 返回空内容、前端解析失败。
 * 这里做一次兼容映射，保证新旧数据都能正常使用。
 */
function normalizeData(parsed) {
  const raw = parsed || {};
  const stats = Object.assign({}, DEFAULT_STATS, raw.stats || {});
  const settings = Object.assign({}, DEFAULT_SETTINGS, raw.settings || {});

  if (!raw.stats) {
    stats.streak_days = raw.streak_days || 0;
    stats.total_days = raw.total_checkin || 0;
    stats.last_check_in = raw.last_checkin_date || null;
    stats.mastered_words = raw.mastered_words || [];
    stats.wrong_words = raw.wrong_words || [];

    if (raw.checkin_records) {
      const records = Object.values(raw.checkin_records);
      stats.total_quizzes = records.length;
      stats.correct_count = records.reduce((sum, r) => sum + (r.correct || 0), 0);
      stats.wrong_count = records.reduce(
        (sum, r) => sum + Math.max(0, (r.count || 0) - (r.correct || 0)),
        0
      );
    }
  }

  if (QUIZ_MODE_ALIASES[settings.quiz_mode]) {
    settings.quiz_mode = QUIZ_MODE_ALIASES[settings.quiz_mode];
  }

  stats.wrong_words = (stats.wrong_words || []).map(normalizeWrongWord).filter(Boolean);

  if (raw.settings && raw.settings.level && !raw.settings.vocab_source) {
    settings.vocab_source = String(raw.settings.level).toLowerCase();
  }

  // 今日学习进度：用于关闭软件后继续上次的进度
  const session = raw.session && typeof raw.session === 'object' && raw.session.date
    ? raw.session
    : null;

  return { stats, settings, session };
}

async function initDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(DATA_FILE);
  } catch {
    await saveData(normalizeData(null));
  }
}

async function loadData() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf-8');
    return normalizeData(JSON.parse(raw));
  } catch (error) {
    console.error('加载数据失败:', error);

    // 文件无法解析时先备份，避免后续写入把原始数据彻底覆盖掉
    try {
      await fs.rename(DATA_FILE, `${DATA_FILE}.corrupt-${Date.now()}`);
      console.error('已将损坏的数据文件备份为 .corrupt-*');
    } catch {
      // 文件不存在时无需备份
    }

    return normalizeData(null);
  }
}

// 先写临时文件再整体替换，避免写入过程中被并发请求打断而产生损坏的 JSON
async function saveData(data) {
  const tempFile = `${DATA_FILE}.tmp`;
  try {
    await fs.writeFile(tempFile, JSON.stringify(data, null, 2));
    await fs.rename(tempFile, DATA_FILE);
  } catch (error) {
    console.error('保存数据失败:', error);
  }
}

let dataLock = Promise.resolve();

/**
 * 串行化「读取 → 修改 → 写回」。
 * 之前多个请求并发读写同一个数据文件，既会互相覆盖导致进度丢失，
 * 也可能写出损坏的 JSON —— 而损坏的文件会被当作空数据加载，
 * 表现出来就是「关闭软件后学习进度被重置」。
 */
function updateData(mutator) {
  const run = dataLock.then(async () => {
    const data = await loadData();
    const result = await mutator(data);
    await saveData(data);
    return result;
  });

  dataLock = run.then(() => {}, () => {});
  return run;
}

const vocabCache = new Map();

async function loadVocab(fileName, level) {
  if (vocabCache.has(level)) {
    return vocabCache.get(level);
  }

  const content = await fs.readFile(path.join(__dirname, 'data', fileName), 'utf-8');
  const words = JSON.parse(content).map(item => ({
    word: item.word,
    translation: (item.translations || []).map(t => t.translation).join('；'),
    level,
    phrases: item.phrases || []
  }));

  vocabCache.set(level, words);
  return words;
}

let highFreqMapCache = null;

/**
 * 高频词表：word（小写）-> 考研/四级/六级真题出现总次数。
 * 用于判断某个错词是否高频，高频词在错词复习时改用「见中写英」默写。
 * 文件缺失时返回空表，不影响其他功能。
 */
async function loadHighFreqMap() {
  if (highFreqMapCache) {
    return highFreqMapCache;
  }

  const map = {};

  try {
    const content = await fs.readFile(path.join(__dirname, 'data', 'high_freq_words.json'), 'utf-8');
    const parsed = JSON.parse(content);

    (parsed.words || []).forEach(item => {
      if (item && item.word) {
        map[String(item.word).toLowerCase()] = (item.frequency && item.frequency.total) || 0;
      }
    });
  } catch (error) {
    console.error('加载高频词表失败:', error);
  }

  highFreqMapCache = map;
  return map;
}

let phoneticMapCache = null;

/**
 * 音标表：word（小写）-> 音标。
 * 数据来自词典文件 cet4-phonetic.json / cet6-phonetic.json，
 * 两份词表有重叠，合并时以先出现的为准。
 * 词表里查不到的单词不返回音标，前端也不显示。
 */
async function loadPhoneticMap() {
  if (phoneticMapCache) {
    return phoneticMapCache;
  }

  const map = {};

  for (const fileName of ['cet4-phonetic.json', 'cet6-phonetic.json']) {
    try {
      const content = await fs.readFile(path.join(__dirname, 'data', fileName), 'utf-8');

      JSON.parse(content).forEach(item => {
        const word = item && item.word ? String(item.word).trim().toLowerCase() : '';
        const phonetic = item && item.phonetic ? String(item.phonetic).trim() : '';

        if (word && phonetic && !map[word]) {
          map[word] = phonetic;
        }
      });
    } catch (error) {
      console.error(`加载音标文件 ${fileName} 失败:`, error);
    }
  }

  phoneticMapCache = map;
  return map;
}

function createWindow() {
  mainWindow = new BrowserWindow({
      width: 1100,
      height: 750,
      show: false,
      icon: path.join(__dirname, 'assets', 'icon.png'),
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true
      },
      frame: true,
      backgroundColor: '#f6f7f9'
    });

  // 通过本地服务器加载页面，保证前端与后端同源，避免跨域导致接口请求失败
  mainWindow.loadURL(`http://localhost:${serverPort}/`);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // 关闭窗口时最小化到系统托盘
  mainWindow.on('close', (event) => {
    if (!isQuitting && tray && closeToTray) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

function createServer() {
  const expressApp = express();
  expressApp.use(express.json({ limit: '50mb' }));

  // 允许跨域，兼容以 file:// 方式打开页面的情况
  expressApp.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  expressApp.use(express.static(path.join(__dirname, 'src')));

  expressApp.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'index.html'));
  });

  expressApp.get('/api/stats', async (req, res) => {
    const data = await loadData();
    res.json(data.stats);
  });

  expressApp.post('/api/stats/mastered', async (req, res) => {
    const word = req.body && req.body.word;
    if (!word) {
      return res.status(400).json({ error: 'word is required' });
    }

    await updateData(data => {
      if (!data.stats.mastered_words.includes(word)) {
        data.stats.mastered_words.push(word);
      }
    });

    res.json({ success: true });
  });

  expressApp.post('/api/stats/wrong', async (req, res) => {
    const word = req.body;
    if (!word || !word.word) {
      return res.status(400).json({ error: 'word is required' });
    }

    await updateData(data => {
      const existing = data.stats.wrong_words.find(item => item.word === word.word);

      // 再次答错的词直接回到第一个复习阶段，重新开始记忆曲线
      if (existing) {
        existing.wrong_count = (existing.wrong_count || 1) + 1;
        existing.stage = 0;
        existing.graduated = false;
        existing.next_review = nextReviewDate(0, todayString());
        return;
      }

      data.stats.wrong_words.push(normalizeWrongWord({
        word: word.word,
        translation: word.translation,
        level: word.level,
        phrases: word.phrases,
        added_at: nowTimestamp(),
        stage: 0,
        wrong_count: 1
      }));
    });

    res.json({ success: true });
  });

  // 错词复习结果：答对推进记忆阶段，答错退回第一阶段
  expressApp.post('/api/stats/wrong/review', async (req, res) => {
    const word = req.body && req.body.word;
    const isCorrect = Boolean(req.body && req.body.correct);
    // 借助字母提示才默写出来，算答对但不推进阶段，很快会再考一次
    const hinted = Boolean(req.body && req.body.hinted);

    if (!word) {
      return res.status(400).json({ error: 'word is required' });
    }

    const updated = await updateData(data => {
      const item = data.stats.wrong_words.find(entry => entry.word === word);
      if (!item) {
        return null;
      }

      const today = todayString();
      item.last_review = today;
      item.review_count = (item.review_count || 0) + 1;

      if (isCorrect && !hinted) {
        item.stage = (item.stage || 0) + 1;
        item.next_review = nextReviewDate(item.stage, today);
        item.graduated = item.stage >= REVIEW_INTERVALS.length;
      } else if (isCorrect) {
        item.next_review = nextReviewDate(item.stage || 0, today);
      } else {
        item.stage = 0;
        item.next_review = nextReviewDate(0, today);
        item.graduated = false;
      }

      return item;
    });

    res.json({ success: true, item: updated });
  });

  expressApp.delete('/api/stats/wrong/:word', async (req, res) => {
    const word = req.params.word;

    await updateData(data => {
      data.stats.wrong_words = data.stats.wrong_words.filter(item => item.word !== word);
    });

    res.json({ success: true });
  });

  expressApp.post('/api/stats/result', async (req, res) => {
    const correct = Number(req.body && req.body.correct) || 0;
    const wrong = Number(req.body && req.body.wrong) || 0;

    const stats = await updateData(data => {
      data.stats.total_quizzes = (data.stats.total_quizzes || 0) + 1;
      data.stats.correct_count = (data.stats.correct_count || 0) + correct;
      data.stats.wrong_count = (data.stats.wrong_count || 0) + wrong;
      return data.stats;
    });

    res.json({ success: true, stats });
  });

  /* ---------- 今日学习进度（断点续学） ---------- */
  expressApp.get('/api/session', async (req, res) => {
    const data = await loadData();
    res.json(data.session || null);
  });

  expressApp.post('/api/session', async (req, res) => {
    const session = req.body && req.body.date ? req.body : null;
    await updateData(data => {
      data.session = session;
    });
    res.json({ success: true });
  });

  expressApp.delete('/api/session', async (req, res) => {
    await updateData(data => {
      data.session = null;
    });
    res.json({ success: true });
  });

  expressApp.get('/api/settings', async (req, res) => {
    const data = await loadData();
    res.json(data.settings);
  });

  expressApp.post('/api/settings', async (req, res) => {
    await updateData(data => Object.assign(data.settings, req.body));
    res.json({ success: true });
  });

  // 高频词表，供前端判断错词是否走默写模式。
  // 注意要注册在 /api/vocab/:level 之前，否则会被通配路由吃掉。
  expressApp.get('/api/vocab/highfreq', async (req, res) => {
    res.json(await loadHighFreqMap());
  });

  // 音标表，同样要注册在通配路由之前
  expressApp.get('/api/vocab/phonetics', async (req, res) => {
    res.json(await loadPhoneticMap());
  });

  // 词库原始格式为 { word, translations: [{ translation, type }], phrases }，
  // 这里统一转换成前端直接可用的结构（translation 为字符串、补充 level），
  // 同时缓存解析结果，避免每次开始测验都重复解析 10MB 级的 JSON。
  expressApp.get('/api/vocab/:level', async (req, res) => {
    const level = String(req.params.level).toUpperCase();
    const files = { CET4: '3-CET4-顺序.json', CET6: '4-CET6-顺序.json' };

    if (!files[level]) {
      return res.status(404).json({ error: 'Unknown vocabulary level' });
    }

    try {
      res.json(await loadVocab(files[level], level));
    } catch (error) {
      console.error('词库加载失败:', error);
      res.status(500).json({ error: 'Failed to load vocabulary' });
    }
  });

  expressApp.post('/api/checkin', async (req, res) => {
    const today = new Date().toISOString().split('T')[0];

    const stats = await updateData(data => {
      if (data.stats.last_check_in !== today) {
        const previousCheckIn = data.stats.last_check_in;

        if (previousCheckIn) {
          const lastDate = new Date(previousCheckIn);
          const todayDate = new Date(today);
          const diffDays = Math.round((todayDate - lastDate) / (1000 * 60 * 60 * 24));

          if (diffDays === 1) {
            data.stats.streak_days = (data.stats.streak_days || 0) + 1;
          } else {
            data.stats.streak_days = 1;
          }
        } else {
          data.stats.streak_days = 1;
        }

        data.stats.last_check_in = today;
        data.stats.total_days = (data.stats.total_days || 0) + 1;
      }

      return data.stats;
    });

    res.json({ success: true, stats });
  });

  expressApp.delete('/api/mistakes', async (req, res) => {
    await updateData(data => {
      data.stats.wrong_words = [];
    });
    res.json({ success: true });
  });

  return new Promise((resolve) => {
    server = expressApp.listen(serverPort, () => {
      console.log(`Server running on http://localhost:${serverPort}`);
      resolve();
    });

    // 端口被占用时自动切换到随机可用端口
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        server = expressApp.listen(0, () => {
          serverPort = server.address().port;
          console.log(`Port 3000 occupied, switched to http://localhost:${serverPort}`);
          resolve();
        });
      } else {
        console.error('服务器启动失败:', error);
        resolve();
      }
    });
  });
}

// 创建系统托盘图标与菜单
function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray.png');
  let trayIcon = nativeImage.createFromPath(iconPath);

  if (trayIcon.isEmpty()) {
    trayIcon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon.png'));
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('英语四六级词汇学习平台');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主界面',
      click: () => showMainWindow()
    },
    {
      label: '隐藏主界面',
      click: () => {
        if (mainWindow) mainWindow.hide();
      }
    },
    { type: 'separator' },
    {
      label: '开始学习',
      click: () => {
        showMainWindow();
        if (mainWindow) mainWindow.webContents.send('start-quiz');
      }
    },
    { type: 'separator' },
    {
      label: '开机自启动',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (menuItem) => setAutoStart(menuItem.checked)
    },
    {
      label: '关闭窗口时最小化到托盘',
      type: 'checkbox',
      checked: closeToTray,
      click: (menuItem) => {
        closeToTray = menuItem.checked;
        saveDataSafe({ close_to_tray: closeToTray });
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  // 双击托盘图标恢复窗口
  tray.on('double-click', () => showMainWindow());
}

function showMainWindow() {
  if (!mainWindow) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function setAutoStart(enabled) {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath
  });
  saveDataSafe({ auto_start: enabled });
  return app.getLoginItemSettings().openAtLogin;
}

async function saveDataSafe(partialSettings) {
  await updateData(data => {
    data.settings = Object.assign({}, data.settings, partialSettings);
  });
}

// 右下角系统通知
function showNotification(title, body) {
  if (!Notification.isSupported()) {
    return false;
  }

  const notification = new Notification({
    title,
    body,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    silent: false
  });

  notification.on('click', () => {
    showMainWindow();
    if (mainWindow) mainWindow.webContents.send('start-quiz');
  });

  notification.show();
  return true;
}

function showReminderNotification() {
  loadData().then(data => {
    const settings = data.settings || {};
    const stats = data.stats || {};

    if (!settings.remind_enabled) return;

    const today = new Date().toISOString().split('T')[0];
    if (stats.last_check_in === today) return;

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    const [startHour, startMinute] = settings.remind_start.split(':').map(Number);
    const [endHour, endMinute] = settings.remind_end.split(':').map(Number);

    const startTime = startHour * 60 + startMinute;
    const endTime = endHour * 60 + endMinute;
    const currentTimeMinutes = currentHour * 60 + currentMinute;

    if (currentTimeMinutes < startTime || currentTimeMinutes > endTime) return;

    showNotification(
      '学习提醒',
      `今日还未打卡学习！连续打卡 ${stats.streak_days || 0} 天，继续加油！`
    );
  });
}

function startReminderCheck() {
  reminderInterval = setInterval(() => {
    showReminderNotification();
  }, 60 * 1000);
}

function stopReminderCheck() {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }
}

// 注册渲染进程可调用的接口
function registerIpcHandlers() {
  // 测试通知 / 自定义通知
  ipcMain.handle('app:test-notification', async (event, payload = {}) => {
    let title = payload.title;
    let body = payload.body;

    if (!title || !body) {
      const data = await loadData();
      const stats = data.stats || {};
      title = title || '学习提醒';
      body = body || `今日还未打卡学习！连续打卡 ${stats.streak_days || 0} 天，继续加油！`;
    }

    const ok = showNotification(title, body);
    return { success: ok };
  });

  // 读取系统相关设置
  ipcMain.handle('app:get-system-settings', () => ({
    autoStart: app.getLoginItemSettings().openAtLogin,
    closeToTray,
    version: app.getVersion()
  }));

  // 开机自启动
  ipcMain.handle('app:set-auto-start', (event, enabled) => ({
    success: true,
    autoStart: setAutoStart(!!enabled)
  }));

  // 关闭窗口时是否最小化到托盘
  ipcMain.handle('app:set-close-to-tray', async (event, enabled) => {
    closeToTray = !!enabled;
    await saveDataSafe({ close_to_tray: closeToTray });
    return { success: true, closeToTray };
  });

  // 手动隐藏到托盘
  ipcMain.handle('app:hide-to-tray', () => {
    if (mainWindow) mainWindow.hide();
    return { success: true };
  });

  // 退出应用
  ipcMain.handle('app:quit', () => {
    isQuitting = true;
    app.quit();
    return { success: true };
  });
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showMainWindow();
  });

  app.whenReady().then(async () => {
    await initDataDir();

    const data = await loadData();
    if (data.settings && typeof data.settings.close_to_tray === 'boolean') {
      closeToTray = data.settings.close_to_tray;
    }

    // 移除 Electron 默认菜单栏，保持界面简洁
    Menu.setApplicationMenu(null);

    await createServer();
    createTray();
    registerIpcHandlers();
    createWindow();
    startReminderCheck();
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  stopReminderCheck();
  if (server) {
    server.close();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    showMainWindow();
  }
});