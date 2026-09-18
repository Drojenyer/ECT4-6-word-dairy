/**
 * 移动端入口。
 *
 * 与桌面端 src/index.html 里六个 <script src> 的加载顺序保持一致：
 * 先装好平台实现（api / 通知），再引入共用的页面逻辑（主题 / 答题 / UI），
 * 最后启动。
 *
 * quiz.js、ui.js、theme.js 直接引用桌面端的同一份文件，没有副本，
 * 修一处两端同时生效。
 */

// 平台实现：window.api（IndexedDB）、window.notifications（Capacitor 本地通知）
import './platform/api.js';
import './platform/notifications.js';

// 共用页面逻辑
import '../../src/js/theme.js';
import '../../src/js/quiz.js';
import '../../src/js/ui.js';

// 最后启动：播种数据 → 补齐默认记录 → 恢复上次页面
import './platform/app.js';
