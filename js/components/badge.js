/* ==========================================================================
   js/components/badge.js — 图标、徽章与小片段渲染
   所有状态都带文字标签，不只依赖颜色（可访问性要求）。
   ========================================================================== */
(function (global) {
  'use strict';

  var CR = (global.CampusRadar = global.CampusRadar || {});

  /* 内联 SVG 图标（无外部图标库） */
  var PATHS = {
    radar: '<circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="4.5"></circle><path d="M12 12 20 6"></path>',
    clock: '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3.5 2"></path>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="3"></rect><path d="M8 3v4M16 3v4M3 11h18"></path>',
    pin: '<path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z"></path><circle cx="12" cy="10" r="2.6"></circle>',
    users: '<circle cx="9" cy="8" r="3.2"></circle><path d="M2.5 20a6.5 6.5 0 0 1 13 0"></path><path d="M16 5.2a3.2 3.2 0 0 1 0 6.1M17.5 20a6.4 6.4 0 0 0-2-4.6"></path>',
    check: '<path d="M20 6 9 17l-5-5"></path>',
    alert: '<path d="M12 3.5 2.6 20h18.8z"></path><path d="M12 10v4.2M12 17.4h.01"></path>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="M12 9v4M12 16h.01"></path>',
    question: '<circle cx="12" cy="12" r="9"></circle><path d="M9.5 9.2a2.6 2.6 0 1 1 3.4 2.5c-.6.2-.9.8-.9 1.5v.5M12 17h.01"></path>',
    star: '<path d="M12 3l2.3 5.3 5.7.5-4.3 3.8 1.3 5.6L12 15.6 6.9 18.2 8.2 12.6 4 8.8l5.7-.5z"></path>',
    starFill: '<path d="M12 3l2.3 5.3 5.7.5-4.3 3.8 1.3 5.6L12 15.6 6.9 18.2 8.2 12.6 4 8.8l5.7-.5z" fill="currentColor"></path>',
    bell: '<path d="M18 15v-4a6 6 0 1 0-12 0v4l-1.6 3h15.2z"></path><path d="M10 21h4"></path>',
    bellOn: '<path d="M18 15v-4a6 6 0 1 0-12 0v4l-1.6 3h15.2z" fill="currentColor"></path><path d="M10 21h4"></path>',
    plus: '<path d="M12 5v14M5 12h14"></path>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2.5"></rect><path d="M6 15H5.5A1.5 1.5 0 0 1 4 13.5V5.5A1.5 1.5 0 0 1 5.5 4h8A1.5 1.5 0 0 1 15 5.5V6"></path>',
    eyeOff: '<path d="M3 3l18 18"></path><path d="M10.6 5.2A9.7 9.7 0 0 1 12 5c5 0 9 4.5 9 7 0 .9-.5 2-1.4 3.1M6.2 7.4C4.2 8.7 3 10.4 3 12c0 2.5 4 7 9 7 1.3 0 2.5-.3 3.6-.8"></path>',
    search: '<circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path>',
    filter: '<path d="M4 6h16M7 12h10M10 18h4"></path>',
    trash: '<path d="M4 7h16M9 7V5h6v2M6.5 7l.8 13h9.4l.8-13"></path>',
    edit: '<path d="M4 20h4l10-10-4-4L4 16z"></path><path d="m14 6 4 4"></path>',
    back: '<path d="m15 5-7 7 7 7"></path>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"></path>',
    play: '<circle cx="12" cy="12" r="9"></circle><path d="M10 8.5 16 12l-6 3.5z"></path>',
    infinity: '<path d="M7 9a3 3 0 1 0 0 6c2.5 0 3.5-3 5-3s2.5 3 5 3a3 3 0 1 0 0-6c-2.5 0-3.5 3-5 3s-2.5-3-5-3z"></path>',
    moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"></path>',
    link: '<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"></path><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"></path>',
    download: '<path d="M12 4v10M8 10.5l4 4 4-4"></path><path d="M5 19h14"></path>',
    home: '<path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"></path>',
    list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"></path>'
  };

  function icon(name, cls) {
    var p = PATHS[name] || PATHS.question;
    return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** 来源徽章 */
  function sourceBadge(op) {
    var s = CR.trust.sourceOf(op.sourceType);
    return '<span class="badge ' + s.badge + '">' + esc(op.sourceType === 'local' ? '本机发布' : s.label) + '</span>';
  }

  /** 状态徽章：带图标，避免只靠颜色 */
  function statusBadge(op) {
    var key = op.status || CR.conflict.statusOf(op);
    var s = CR.trust.statusOf(key);
    var label = s.label;
    if (key === 'replay' && op.replayAt) {
      label = '已结束·预计' + CR.date.fmtDate(op.replayAt) + '传回放';
    }
    return '<span class="badge ' + s.badge + '">' + icon(s.icon) + esc(label) + '</span>';
  }

  /** 风险 / 疑似推广徽章 */
  function riskBadge(op) {
    var r = CR.trust.riskOf(op);
    if (!r) return '';
    return '<span class="badge ' + (r.level === 'high' ? 'badge--risk' : 'badge--pending') + '">' +
      icon(r.level === 'high' ? 'shield' : 'alert') + esc(r.title) + '</span>';
  }

  /** 待确认徽章（关键信息缺失） */
  function pendingBadge(op) {
    if (!op.missingFields || !op.missingFields.length) return '';
    return '<span class="badge badge--pending">' + icon('question') + '待确认：' +
      esc(op.missingFields.slice(0, 2).join('、')) + (op.missingFields.length > 2 ? ' 等' : '') + '</span>';
  }

  function trustBadge(op) {
    var t = CR.trust.trustOf(op.trustLevel);
    var cls = t.tone === 'ok' ? 'badge--open' : (t.tone === 'bad' ? 'badge--risk' : 'badge--pending');
    return '<span class="badge ' + cls + '">' + esc(t.label) + '</span>';
  }

  function badgeRow(op, opts) {
    opts = opts || {};
    var html = sourceBadge(op) + statusBadge(op) + riskBadge(op);
    if (op.origin === 'local') html += '<span class="badge badge--pending">' + icon('home') + '本机发布</span>';
    if (op.trustLevel === 'supplement') html += trustBadge(op);
    if (opts.showPending !== false) html += pendingBadge(op);
    return html;
  }

  /** 通用标签 */
  function tag(text, cls) {
    return '<span class="tag ' + (cls || '') + '">' + esc(text) + '</span>';
  }

  /** 倒计时元素（由 app.js 的 tick 每秒刷新） */
  function countdownEl(target, mode, label) {
    if (!target) {
      return '<span class="op-card__countdown is-pass">' +
        (mode === 'deadline' ? '报名截止：未注明' : '时间未定') + '</span>';
    }
    var left = target - Date.now();
    var cls = 'op-card__countdown' + (left <= 0 ? ' is-pass' : '');
    return '<span class="' + cls + '" data-countdown="' + target + '" data-mode="' + (mode || 'deadline') +
      '">' + (label ? esc(label) + ' ' : '') + CR.date.countdownText(left) + '</span>';
  }

  /** 时间展示文案（缺失时不臆测） */
  function timeText(op) {
    if (op.timeText) return op.timeText;
    if (op.startTime) return CR.date.fmtRange(op.startTime, op.endTime);
    if (op.needSignup && op.deadline) return '活动时间未注明（仅注明报名截止）';
    return null;
  }

  function locationText(op) {
    if (!op.location) {
      if (op.online === true) return '线上参与';
      return null;
    }
    return op.location + (op.online === true ? '（同步线上）' : '');
  }

  /** 缺失信息统一文案 */
  function missingEl(text) {
    return '<span class="op-card__missing">' + esc(text || CR.trust.MISSING) + '</span>';
  }

  /** 空状态插画 + 标题 + 说明 + 行动按钮 */
  function empty(opts) {
    opts = opts || {};
    var art = '<svg viewBox="0 0 96 96" fill="none" stroke="currentColor" stroke-width="2.4" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<circle cx="44" cy="44" r="26"></circle><circle cx="44" cy="44" r="13" stroke-dasharray="4 6"></circle>' +
      '<path d="M44 44 66 26"></path><path d="M74 74l14 14"></path><path d="M28 84h32"></path></svg>';
    return '<div class="empty">' +
      '<div class="empty__art">' + art + '</div>' +
      '<h3>' + esc(opts.title || '这里还没有内容') + '</h3>' +
      '<p>' + esc(opts.text || '换个筛选条件，或先去发现页看看今天有什么。') + '</p>' +
      (opts.action
        ? '<a class="btn btn--primary" href="' + opts.action.href + '">' + esc(opts.action.label) + '</a>'
        : '') +
      '</div>';
  }

  /** 加载状态：雷达旋转 + 文本（可访问） */
  function loading(text) {
    return '<div class="loading" role="status">' +
      '<div class="radar-spin" aria-hidden="true"></div>' +
      '<div>' + esc(text || '雷达扫描中…') + '</div></div>';
  }

  function skeletonCards(n) {
    var out = '<div class="card-list">';
    for (var i = 0; i < (n || 3); i++) out += '<div class="skeleton skeleton--card"></div>';
    return out + '</div>';
  }

  /** 风险横幅 */
  function banner(kind, title, text, iconName) {
    var cls = kind === 'danger' ? 'banner--danger'
      : kind === 'warn' ? 'banner--warn'
        : kind === 'pending' ? 'banner--pending' : 'banner--info';
    return '<div class="banner ' + cls + '">' + icon(iconName || 'alert') +
      '<div><div class="banner__title">' + title + '</div>' +
      '<div class="banner__text">' + text + '</div></div></div>';
  }

  CR.ui = {
    PATHS: PATHS,
    icon: icon,
    esc: esc,
    sourceBadge: sourceBadge,
    statusBadge: statusBadge,
    riskBadge: riskBadge,
    pendingBadge: pendingBadge,
    trustBadge: trustBadge,
    badgeRow: badgeRow,
    tag: tag,
    countdownEl: countdownEl,
    timeText: timeText,
    locationText: locationText,
    missingEl: missingEl,
    empty: empty,
    loading: loading,
    skeletonCards: skeletonCards,
    banner: banner
  };
})(window);
