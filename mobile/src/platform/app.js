/**
 * 移动端启动流程，取代桌面端的 src/js/app.js。
 *
 * 桌面端启动时数据文件已就绪，直接恢复上次页面即可；
 * 移动端首启需要先把词库播种进 IndexedDB，因此这里加了启动引导页，
 * 播种与默认记录补齐完成后，再走与桌面端一致的页面恢复逻辑。
 */
import * as services from '../services.js';
import { seedIfNeeded } from '../seed.js';

function showBootScreen() {
  const screen = document.createElement('div');
  screen.id = 'boot-screen';
  screen.innerHTML = `
    <div class="boot-card">
      <div class="boot-logo">📚</div>
      <div class="boot-title">四六级词汇</div>
      <div class="boot-status" id="boot-status">正在准备词库…</div>
      <div class="boot-bar"><div class="boot-bar-fill" id="boot-bar-fill"></div></div>
    </div>
  `;

  document.body.appendChild(screen);
  return screen;
}

function report(screen, text, percent) {
  const status = screen.querySelector('#boot-status');
  const fill = screen.querySelector('#boot-bar-fill');

  if (status) {
    status.textContent = text;
  }
  if (fill) {
    fill.style.width = `${percent}%`;
  }
}

async function prepareData(screen) {
  const { seeded } = await seedIfNeeded(({ step, totalSteps, label }) => {
    // 播种进行中最多占到 95%，留一点给后续的默认值初始化
    report(screen, label, Math.round(((step - 1) / totalSteps) * 95));
  });

  await services.ensureDefaults();

  report(screen, seeded ? '词库导入完成' : '准备完成', 100);
}

function registerNotificationTap() {
  if (!window.Capacitor || !window.Capacitor.Plugins.LocalNotifications) {
    return;
  }

  window.Capacitor.Plugins.LocalNotifications.addListener(
    'localNotificationActionPerformed',
    () => {
      if (window.ui) {
        window.ui.startOrResume();
      }
    }
  );
}

async function boot() {
  const screen = showBootScreen();
  let failed = false;

  try {
    await prepareData(screen);
  } catch (error) {
    failed = true;
    console.error('数据准备失败:', error);
    report(screen, `词库准备失败：${error.message}`, 100);
  }

  if (failed) {
    return;
  }

  try {
    const settings = await services.getSettings();
    await window.notifications.syncSchedule(settings);
  } catch (error) {
    console.error('同步通知计划失败:', error);
  }

  registerNotificationTap();

  // 等页面恢复逻辑跑起来再撤掉引导页，避免中途闪空白
  const restore = window.ui.restoreLastPage();

  requestAnimationFrame(() => screen.remove());
  await restore;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
