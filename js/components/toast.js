/* ==========================================================================
   js/components/toast.js — 轻提示
   使用 aria-live 容器，屏幕阅读器可感知；动效 200ms ease-out。
   ========================================================================== */
(function (global) {
  'use strict';

  var CR = (global.CampusRadar = global.CampusRadar || {});

  var ICONS = {
    success: 'check',
    warn: 'alert',
    error: 'shield',
    info: 'spark',
    fav: 'starFill',
    signup: 'check',
    bell: 'bellOn',
    calendar: 'calendar'
  };

  function host() {
    var el = document.getElementById('toastHost');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toastHost';
      el.className = 'toast-host';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    return el;
  }

  /**
   * 显示一条 Toast
   * @param {string} message 文本
   * @param {object} opts { type:'success'|'warn'|'error'|'info'|'fav', duration:number, action:{label,onClick} }
   */
  function show(message, opts) {
    opts = opts || {};
    var type = opts.type || 'info';
    var duration = opts.duration == null ? 2400 : opts.duration;
    var el = document.createElement('div');
    el.className = 'toast toast--' + type;
    el.innerHTML = CR.ui.icon(ICONS[type] || 'spark') + '<div>' + CR.ui.esc(message) + '</div>';
    host().appendChild(el);

    // 最多保留 3 条，避免移动端遮挡
    var all = host().querySelectorAll('.toast');
    if (all.length > 3) all[0].remove();

    var timer = null;
    function close() {
      if (timer) clearTimeout(timer);
      el.classList.add('is-out');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 200);
    }
    if (duration > 0) timer = setTimeout(close, duration);
    el.addEventListener('click', close);

    return { close: close };
  }

  var toast = {
    show: show,
    success: function (m, d) { return show(m, { type: 'success', duration: d }); },
    warn: function (m, d) { return show(m, { type: 'warn', duration: d }); },
    error: function (m, d) { return show(m, { type: 'error', duration: d }); },
    info: function (m, d) { return show(m, { type: 'info', duration: d }); },
    fav: function (m, d) { return show(m, { type: 'fav', duration: d }); },
    signup: function (m, d) { return show(m, { type: 'signup', duration: d }); },
    bell: function (m, d) { return show(m, { type: 'bell', duration: d }); },
    calendar: function (m, d) { return show(m, { type: 'calendar', duration: d }); }
  };

  CR.toast = toast;
})(window);
