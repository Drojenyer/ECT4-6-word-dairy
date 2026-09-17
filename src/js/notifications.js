// 桌面通知统一交由 Electron 主进程弹出，保证与微信 / QQ 一致的
// Windows 右下角系统通知样式，避免浏览器 Notification 权限导致弹不出来。
class Notifications {
  async showReminder() {
    if (typeof api === 'undefined') {
      return false;
    }

    const result = await api.testNotification();

    if (!result || !result.success) {
      alert('当前系统不支持桌面通知，请在 Windows 设置中开启通知权限。');
      return false;
    }

    return true;
  }

  showAchievement(message) {
    if (typeof api === 'undefined') {
      return;
    }

    // 复用主进程通知能力
    api.ipc.invoke('app:test-notification', { title: '🎉 学习成就', body: message });
  }
}

window.notifications = new Notifications();
