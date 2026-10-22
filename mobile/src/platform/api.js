/**
 * 移动端的 api 实现，方法签名与桌面端 src/js/api.js 完全一致。
 *
 * 桌面端走 HTTP 到内置 Express；移动端没有服务端，直接落到 IndexedDB。
 * 因此共用代码（quiz.js / ui.js）无需任何改动即可复用。
 *
 * 桌面专属的系统能力（托盘、开机自启、主进程通知）在这里给出安全实现：
 * 该做的换成 Capacitor 能力，做不了的返回空值，保证 UI 不报错。
 */
import * as services from '../services.js';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import md5 from 'js-md5';

class ApiClient {
  isDesktopWindow() { return false; }
  minimizeWindow() { return Promise.resolve(); }
  toggleMaximizeWindow() { return Promise.resolve({ isMaximized: false }); }
  closeWindow() { return Promise.resolve(); }
  getWindowState() { return Promise.resolve({ isMaximized: false }); }
  onWindowMaximizeChange() {}

  async translateText(payload) {
    if (!Capacitor.isNativePlatform()) {
      throw new Error('请在安卓应用中使用在线翻译功能');
    }
    const { text, target_lang: target, app_id: appId, api_key: key } = payload || {};
    if (typeof text !== 'string' || !text.trim() || new TextEncoder().encode(text).length > 6000
      || !['zh', 'en'].includes(target) || typeof appId !== 'string' || !appId.trim()
      || typeof key !== 'string' || !key.trim()) {
      throw new Error('请输入有效的文本、APP ID 和密钥（原文最多 6000 字节）');
    }
    const query = text.trim();
    const salt = Array.from(crypto.getRandomValues(new Uint8Array(8)), byte =>
      byte.toString(16).padStart(2, '0')).join('');
    const sign = md5(`${appId.trim()}${query}${salt}${key.trim()}`);
    const form = new URLSearchParams({ q: query, from: 'auto', to: target, appid: appId.trim(), salt, sign });
    let response;
    try {
      response = await CapacitorHttp.post({
        url: 'https://fanyi-api.baidu.com/api/trans/vip/translate',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        data: form.toString(),
        connectTimeout: 15000,
        readTimeout: 15000
      });
    } catch {
      throw new Error('无法连接百度翻译，请检查网络或切换其他 API');
    }
    if (response.status !== 200) {
      throw new Error(`百度翻译请求失败（HTTP ${response.status}）`);
    }
    const result = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    if (result.error_code) {
      const errors = {
        52003: '百度翻译未授权，请核对 APP ID 和密钥',
        54000: '百度翻译参数错误，请核对 APP ID',
        54001: '百度翻译签名错误，请核对 APP ID 和配套密钥',
        54003: '请求过于频繁，请稍后重试',
        54004: '百度翻译额度已用完',
        58000: '百度翻译客户端 IP 受限'
      };
      throw new Error(errors[result.error_code] || `百度翻译错误（${result.error_code}）`);
    }
    const translations = Array.isArray(result.trans_result) ? result.trans_result : [];
    return { text: translations.map(item => item.dst || '').join('\n'), source_lang: result.from };
  }

  /* ---------- 统计与错词 ---------- */

  getStats() {
    return services.getStats();
  }

  markMastered(word) {
    return services.markMastered(word);
  }

  addWrongWord(word) {
    return services.addWrongWord(word);
  }

  reviewWrongWord(word, correct, hinted) {
    return services.reviewWrongWord(word, correct, hinted);
  }

  removeWrongWord(word) {
    return services.removeWrongWord(word);
  }

  recordResult(correct, wrong) {
    return services.recordResult(correct, wrong);
  }

  checkIn() {
    return services.checkIn();
  }

  clearMistakes() {
    return services.clearMistakes();
  }

  /* ---------- 今日学习进度 ---------- */

  getSession() {
    return services.getSession();
  }

  saveSession(session) {
    return services.saveSession(session);
  }

  clearSession() {
    return services.clearSession();
  }

  /* ---------- 设置 ---------- */

  getSettings() {
    return services.getSettings();
  }

  async updateSettings(settings) {
    const updated = await services.updateSettings(settings);

    // 提醒时间可能变了，顺手同步一次本地通知计划
    if (window.notifications) {
      window.notifications.syncSchedule(updated);
    }

    return updated;
  }

  /* ---------- 词库 ---------- */

  getCET4Vocab() {
    return services.getVocab('CET4');
  }

  getCET6Vocab() {
    return services.getVocab('CET6');
  }

  // 静态词表体积大，拉一次缓存住
  async getHighFreqMap() {
    if (!this._highFreqMap) {
      this._highFreqMap = await services.getHighFreqMap();
    }
    return this._highFreqMap;
  }

  async getPhoneticMap() {
    if (!this._phoneticMap) {
      this._phoneticMap = await services.getPhoneticMap();
    }
    return this._phoneticMap;
  }

  async getPosMap() {
    if (!this._posMap) {
      this._posMap = {};
      for (const level of ['CET4', 'CET6']) {
        for (const item of await services.getVocab(level)) {
          if (item.pos) this._posMap[item.word.toLowerCase()] = item.pos;
        }
      }
    }
    return this._posMap;
  }

  addStudyTime(seconds) {
    return services.addStudyTime(seconds);
  }

  setStudying() {
    return Promise.resolve({ success: true });
  }

  setWindowMaterial(material) {
    return services.updateSettings({ window_material: material });
  }

  /* ---------- 数据导入（从桌面端迁移进度） ---------- */

  importLegacyData(parsed) {
    return services.importLegacyData(parsed);
  }

  /* ---------- 桌面专属能力，移动端降级 ---------- */

  // 移动端没有「开机自启」和「最小化到托盘」的概念，设置页对应区块已被 CSS 隐藏
  getSystemSettings() {
    return services.getSettings().then(settings => ({
      autoStart: false,
      closeToTray: false,
      windowMaterial: settings.window_material || 'default',
      materialSupported: false
    }));
  }

  setAutoStart() {
    return Promise.resolve({ success: false });
  }

  setCloseToTray() {
    return Promise.resolve({ success: false });
  }

  testNotification() {
    if (window.notifications) {
      return window.notifications.showReminder().then(success => ({ success }));
    }
    return Promise.resolve({ success: false });
  }

  hideToTray() {
    // Android 上没有托盘，退回桌面即可
    if (Capacitor.isNativePlatform() && window.Capacitor && window.Capacitor.Plugins.App) {
      return window.Capacitor.Plugins.App.minimizeApp();
    }
    return Promise.resolve();
  }

  quitApp() {
    return Promise.resolve();
  }
}

const api = new ApiClient();
window.api = api;

export default api;
