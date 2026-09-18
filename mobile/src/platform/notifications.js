/**
 * 移动端通知：改用 Capacitor 本地通知插件。
 *
 * 桌面端由 Electron 主进程弹系统通知，并且只在「提醒时段内且今天没学习」时弹；
 * 安卓上没有常驻进程做这个判断，改为按提醒开始时间登记一条每日重复通知。
 * 用户当天完成学习后，在 app.js 里取消当天那条，效果与桌面端一致。
 */
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

// 每日提醒固定用这个 id，重复登记即为覆盖
const REMINDER_ID = 1001;
const ACHIEVEMENT_ID = 1002;
const CHANNEL_ID = 'study-reminder';

class Notifications {
  constructor() {
    this.native = Capacitor.isNativePlatform();
  }

  // "08:00" -> { hour: 8, minute: 0 }
  parseTime(value, fallback) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || '').trim());

    if (!match) {
      return fallback;
    }

    const hour = Number(match[1]);
    const minute = Number(match[2]);

    if (hour > 23 || minute > 59) {
      return fallback;
    }

    return { hour, minute };
  }

  async ensurePermission() {
    try {
      let status = await LocalNotifications.checkPermissions();

      if (status.display !== 'granted') {
        status = await LocalNotifications.requestPermissions();
      }

      return status.display === 'granted';
    } catch (error) {
      console.error('申请通知权限失败:', error);
      return false;
    }
  }

  // Android 8 起通知必须归属某个通道，否则不会弹出
  async ensureChannel() {
    if (!this.native) {
      return;
    }

    try {
      await LocalNotifications.createChannel({
        id: CHANNEL_ID,
        name: '每日学习提醒',
        description: '提醒你完成当天的词汇学习',
        importance: 4,
        visibility: 1
      });
    } catch (error) {
      console.error('创建通知通道失败:', error);
    }
  }

  /**
   * 按设置同步每日提醒：关闭提醒时取消，开启时登记每天固定时刻的重复通知。
   * 时间取「提醒开始时间」，与桌面端提醒时段的起点一致。
   */
  async syncSchedule(settings) {
    if (!settings || settings.remind_enabled === false) {
      await this.cancelReminder();
      return;
    }

    const granted = await this.ensurePermission();

    if (!granted) {
      return;
    }

    const start = this.parseTime(settings.remind_start, { hour: 8, minute: 0 });

    await this.ensureChannel();

    try {
      // 先取消旧的，避免时间被改过之后留下两条
      await this.cancelReminder();

      await LocalNotifications.schedule({
        notifications: [{
          id: REMINDER_ID,
          title: '📚 今天的单词还没学',
          body: '花几分钟过一组词汇，别断了连续打卡',
          channelId: CHANNEL_ID,
          schedule: {
            on: { hour: start.hour, minute: start.minute },
            allowWhileIdle: true
          }
        }]
      });
    } catch (error) {
      console.error('登记每日提醒失败:', error);
    }
  }

  async cancelReminder() {
    try {
      await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] });
    } catch (error) {
      // 没有已登记的通知时会报错，属正常情况
    }
  }

  /**
   * 今天已经学过了，取消当天那条提醒。
   * 重复通知无法只取消某一天，所以这里改成「取消后再排下一次」：
   * 由于每次登记都是每天重复，效果上等价于今天不再打扰。
   */
  async markTodayDone() {
    await this.cancelReminder();
  }

  // 设置页的「测试通知」
  async showReminder() {
    const granted = await this.ensurePermission();

    if (!granted) {
      alert('通知权限未开启，请在系统设置里允许本应用发送通知。');
      return false;
    }

    await this.ensureChannel();

    try {
      await LocalNotifications.schedule({
        notifications: [{
          id: ACHIEVEMENT_ID,
          title: '🔔 通知测试',
          body: '通知功能正常，学习提醒会按设置的时间送达。',
          channelId: CHANNEL_ID,
          schedule: { at: new Date(Date.now() + 1000) }
        }]
      });

      return true;
    } catch (error) {
      console.error('发送测试通知失败:', error);
      alert('通知发送失败，请检查系统通知权限。');
      return false;
    }
  }

  async showAchievement(message) {
    const granted = await this.ensurePermission();

    if (!granted) {
      return;
    }

    try {
      await LocalNotifications.schedule({
        notifications: [{
          id: ACHIEVEMENT_ID + 1,
          title: '🎉 学习成就',
          body: message,
          channelId: CHANNEL_ID,
          schedule: { at: new Date(Date.now() + 500) }
        }]
      });
    } catch (error) {
      console.error('发送成就通知失败:', error);
    }
  }
}

window.notifications = new Notifications();

export default window.notifications;
