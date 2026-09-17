// 页面由内置服务器提供，使用相对路径请求即可保证同源；
// 若以 file:// 方式打开，则回退到本地服务端口。
const API_BASE_URL = window.location.protocol === 'file:'
  ? 'http://localhost:3000/api'
  : '/api';

class ApiClient {
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

  async getCET4Vocab() {
    return this.get('/vocab/cet4');
  }

  async getCET6Vocab() {
    return this.get('/vocab/cet6');
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

  async checkIn() {
    return this.post('/checkin', {});
  }

  async clearMistakes() {
    return this.delete('/mistakes');
  }

  /* ---------- 桌面端系统能力（通过主进程 IPC 调用） ---------- */
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

  testNotification() {
    return this.ipc.invoke('app:test-notification');
  }

  hideToTray() {
    return this.ipc.invoke('app:hide-to-tray');
  }

  quitApp() {
    return this.ipc.invoke('app:quit');
  }
}

const api = new ApiClient();
window.api = api;