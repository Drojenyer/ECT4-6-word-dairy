// 页面由内置服务器提供，使用相对路径请求即可保证同源；
// 若以 file:// 方式打开，则回退到本地服务端口。
const API_BASE_URL = window.location.protocol === 'file:'
  ? 'http://localhost:3000/api'
  : '/api';

class ApiClient {
  usesLocalTranslationCredentials = true;
  async request(method, endpoint, data) {
    const options = { method };
    if (data !== undefined) {
      options.headers = { 'Content-Type': 'application/json' };
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`API ${method} ${endpoint} error:`, error);
      throw error;
    }
  }

  async get(endpoint) {
    return this.request('GET', endpoint);
  }

  async post(endpoint, data) {
    return this.request('POST', endpoint, data);
  }

  async delete(endpoint) {
    return this.request('DELETE', endpoint);
  }

  async getStats() {
    return this.get('/stats');
  }

  async translateText(payload) {
    const response = await fetch(`${API_BASE_URL}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '翻译请求失败');
    return result;
  }

  async markMastered(word) {
    return this.post('/stats/mastered', { word });
  }

  async addWrongWord(word) {
    return this.post('/stats/wrong', word);
  }

  async reviewWrongWord(word, correct, hinted) {
    return this.post('/stats/wrong/review', { word, correct, hinted: !!hinted });
  }

  async removeWrongWord(word) {
    return this.delete(`/stats/wrong/${encodeURIComponent(word)}`);
  }

  async recordResult(correct, wrong) {
    return this.post('/stats/result', { correct, wrong });
  }

  // 学习时长按秒分批上报，后端按日期累加
  async addStudyTime(seconds) {
    return this.post('/stats/study', { seconds });
  }

  async getSession() {
    return this.get('/session');
  }

  async saveSession(session) {
    return this.post('/session', session);
  }

  async clearSession() {
    return this.delete('/session');
  }

  async getSettings() {
    return this.get('/settings');
  }

  async updateSettings(settings) {
    return this.post('/settings', settings);
  }

  async getCET4Vocab(limit, excludeMastered = true) {
    return this.get(`/vocab/cet4?limit=${encodeURIComponent(limit)}&exclude_mastered=${excludeMastered}`);
  }

  async getCET6Vocab(limit, excludeMastered = true) {
    return this.get(`/vocab/cet6?limit=${encodeURIComponent(limit)}&exclude_mastered=${excludeMastered}`);
  }

  // 高频词表是静态数据，拉一次就缓存住
  async getHighFreqMap() {
    if (!this._highFreqMap) {
      this._highFreqMap = await this.get('/vocab/highfreq');
    }
    return this._highFreqMap;
  }

  // 音标表同样是静态数据
  async getPhoneticMap() {
    if (!this._phoneticMap) {
      this._phoneticMap = await this.get('/vocab/phonetics');
    }
    return this._phoneticMap;
  }

  // 词性表同样是静态数据，用于给错词/旧会话补齐词性
  async getPosMap() {
    if (!this._posMap) {
      this._posMap = await this.get('/vocab/pos');
    }
    return this._posMap;
  }

  async checkIn() {
    return this.post('/checkin', {});
  }

  async clearMistakes() {
    return this.delete('/mistakes');
  }

  /* ---------- 桌面端系统能力（通过主进程 IPC 调用） ---------- */
  isDesktopWindow() {
    return process.platform === 'win32';
  }

  minimizeWindow() {
    return this.ipc.invoke('window:minimize');
  }

  toggleMaximizeWindow() {
    return this.ipc.invoke('window:toggle-maximize');
  }

  closeWindow() {
    return this.ipc.invoke('window:close');
  }

  getWindowState() {
    return this.ipc.invoke('window:get-state');
  }

  onWindowMaximizeChange(listener) {
    this.ipc.on('window:maximize-change', (_event, isMaximized) => listener(isMaximized));
  }

  get ipc() {
    if (!this._ipc) {
      this._ipc = require('electron').ipcRenderer;
    }
    return this._ipc;
  }

  getSystemSettings() {
    return this.ipc.invoke('app:get-system-settings');
  }

  setAutoStart(enabled) {
    return this.ipc.invoke('app:set-auto-start', enabled);
  }

  setCloseToTray(enabled) {
    return this.ipc.invoke('app:set-close-to-tray', enabled);
  }

  setWindowMaterial(material) {
    return this.ipc.invoke('app:set-window-material', material);
  }

  testNotification() {
    return this.ipc.invoke('app:test-notification');
  }

  hideToTray() {
    return this.ipc.invoke('app:hide-to-tray');
  }

  quitApp() {
    return this.ipc.invoke('app:quit');
  }

  setStudying(studying) {
    return this.ipc.invoke('app:set-studying', studying);
  }
}

const api = new ApiClient();
window.api = api;
