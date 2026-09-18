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
import { Capacitor } from '@capacitor/core';

class ApiClient {
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

  /* ---------- 数据导入（从桌面端迁移进度） ---------- */

  importLegacyData(parsed) {
    return services.importLegacyData(parsed);
  }

  /* ---------- 桌面专属能力，移动端降级 ---------- */

  // 移动端没有「开机自启」和「最小化到托盘」的概念，设置页对应区块已被 CSS 隐藏
  getSystemSettings() {
    return Promise.resolve({ autoStart: false, closeToTray: false });
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
