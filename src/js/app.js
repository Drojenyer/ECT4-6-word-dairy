document.addEventListener('DOMContentLoaded', () => {
  const { ipcRenderer } = require('electron');

  // 点击系统通知或托盘「开始学习」
  ipcRenderer.on('start-quiz', () => {
    if (window.ui) {
      window.ui.startOrResume();
    }
  });

  // 恢复到上次所在的页面（学习中途会直接续上进度）
  window.ui.restoreLastPage();
});
