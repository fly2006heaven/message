/* ==========================================================================
   js/components/card.js — 机会卡片 / 截止雷达条目 / 倒计时组件
   交互按钮统一使用 data-action，由 app.js 通过事件委托统一处理。
   ========================================================================== */
(function (global) {
  'use strict';

  var CR = (global.CampusRadar = global.CampusRadar || {});
  var U = CR.ui;

  /** 卡片的视觉修饰类：风险左侧红条 / 疑似推广橙条 / 补充通知底色 */
  function cardClass(op) {
    var cls = 'op-card';
    if (op.riskLevel === 'high') cls += ' op-card--risk';
    else if (op.riskLevel === 'suspect') cls += ' op-card--suspect';
    if (op.trustLevel === 'pending') cls += ' op-card--muted';
    if (op.sourceType === 'supplement') cls += ' op-card--supplement';
    return cls;
  }

  /** 卡片元信息行 */
  function metaRow(op) {
    var rows = [];
    var t = U.timeText(op);
    if (t) {
      rows.push('<div>' + U.icon('clock') + '<span><b>时间</b> ' + U.esc(t) + '</span></div>');
    } else {
      rows.push('<div>' + U.icon('clock') + '<span><b>时间</b> ' +
        U.missingEl('未注明，请以主办方通知为准') + '</span></div>');
    }

    var loc = U.locationText(op);
    if (loc) {
      rows.push('<div>' + U.icon('pin') + '<span><b>地点</b> ' + U.esc(loc) + '</span></div>');
    } else if (op.locationPending) {
      rows.push('<div>' + U.icon('pin') + '<span><b>地点</b> ' + U.missingEl('待确认，请以发起人通知为准') + '</span></div>');
    } else if (op.online !== true) {
      rows.push('<div>' + U.icon('pin') + '<span><b>地点</b> ' + U.missingEl() + '</span></div>');
    }

    if (op.audienceExtra) {
      rows.push('<div>' + U.icon('users') + '<span><b>对象</b> ' + U.esc(op.audienceExtra) + '</span></div>');
    } else if (op.audience) {
      rows.push('<div>' + U.icon('users') + '<span><b>对象</b> ' +
        U.esc(CR.trust.AUDIENCE_LEVELS[op.audience] || '全校') + '</span></div>');
    } else {
      rows.push('<div>' + U.icon('users') + '<span><b>对象</b> ' + U.missingEl() + '</span></div>');
    }

    if (op.deadline) {
      var passed = op.deadline - Date.now() <= 0;
      var label = op.deadlineNote ? '报名截止（' + op.deadlineNote + '）' : '报名截止';
      rows.push('<div>' + U.icon('alert') + '<span><b>' + U.esc(label) + '</b> ' +
        U.esc(CR.date.fmtDateShort(op.deadline)) +
        (passed ? ' <span class="op-card__missing">已截止</span>' : '') + '</span></div>');
    }
    return rows.join('');
  }

  /** 卡片的推荐理由（仅新生护航模式显示） */
  function reasonsBlock(op, profile) {
    if (!profile || !profile.guardMode) return '';
    var list = CR.trust.reasons(op, profile);
    if (!list.length) return '';
    return '<div class="op-card__reasons">' +
      list.map(function (r) { return '<span class="reason">' + U.esc(r) + '</span>'; }).join('') +
      '</div>';
  }

  /**
   * 机会卡片
   * @param {object} op
   * @param {object} opts { compact:boolean, reasons:boolean, profile }
   */
  function opportunityCard(op, opts) {
    opts = opts || {};
    var isFav = CR.store.isFavorite(op.id);
    var signup = CR.store.getSignup(op.id);
    var inCal = CR.store.inCalendar(op.id);
    var hasRemind = CR.store.hasReminder(op.id);
    var href = '#/detail/' + encodeURIComponent(op.id);

    var tags = (op.tags || []).slice(0, 4)
      .map(function (t) { return U.tag(t); }).join('');

    var foot = '<div class="op-card__foot">' +
      // 倒计时
      (op.deadline && op.deadline - Date.now() > 0
        ? U.countdownEl(op.deadline, 'deadline', '截止倒计时')
        : (op.startTime && op.startTime - Date.now() > 0
          ? U.countdownEl(op.startTime, 'start', '开始')
          : '<span class="op-card__countdown is-pass">' +
            (op.status && op.status === 'longterm' ? '长期开放' : '已结束') + '</span>')) +
      '<span class="spacer"></span>' +
      '<button class="icon-btn' + (isFav ? ' is-on' : '') + '" type="button" data-action="fav" data-id="' +
        U.esc(op.id) + '" aria-pressed="' + isFav + '" title="' +
        (isFav ? '取消收藏' : '收藏') + '">' +
        (isFav ? U.icon('starFill') : U.icon('star')) +
        '<span class="sr-only">' + (isFav ? '取消收藏' : '收藏') + ' ' + U.esc(op.title) + '</span></button>' +
      '<button class="btn btn--sm ' + (signup ? 'btn--secondary' : 'btn--ghost') + '" type="button" data-action="signup" data-id="' +
        U.esc(op.id) + '" title="' + (signup ? '查看/修改报名状态' : '报名或意向登记') + '">' +
        U.icon('check') + (signup ? U.esc(CR.store.SIGNUP_STATUS[signup.status].label) : '报名/意向') + '</button>' +
      '<button class="btn btn--sm ' + (inCal ? 'btn--secondary' : 'btn--ghost') + '" type="button" data-action="calendar" data-id="' +
        U.esc(op.id) + '" title="加入日历">' + U.icon('calendar') + (inCal ? '已加入' : '日历') + '</button>' +
      (hasRemind ? '<span class="tag tag--accent">' + U.icon('bell') + '已设提醒</span>' : '') +
      '</div>';

    var riskNote = '';
    var risk = CR.trust.riskOf(op);
    if (risk && opts.hideRiskNote !== true) {
      riskNote = '<div class="op-card__risk-note">' + U.icon('shield') + ' ' + U.esc(risk.text) + '</div>';
    } else if (op.trustLevel === 'pending') {
      riskNote = '<div class="op-card__risk-note">' + U.icon('question') +
        ' 关键信息未注明（' + U.esc((op.missingFields || []).join('、')) + '），请以主办方通知为准。</div>';
    }

    return '<article class="' + cardClass(op) + '" data-op="' + U.esc(op.id) + '" aria-labelledby="t-' + U.esc(op.id) + '">' +
      '<div class="op-card__top">' +
        '<div class="op-card__badges">' + U.badgeRow(op) + '</div>' +
      '</div>' +
      '<h3 class="op-card__title" id="t-' + U.esc(op.id) + '">' +
        '<a href="' + href + '">' + U.esc(op.title) + '</a></h3>' +
      (op.summary ? '<p class="t-small t-muted">' + U.esc(op.summary) + '</p>' : '') +
      '<div class="op-card__meta">' + metaRow(op) + '</div>' +
      (tags ? '<div class="op-card__tags">' + tags + '</div>' : '') +
      reasonsBlock(op, opts.profile || CR.store.state.profile) +
      riskNote +
      foot +
      '</article>';
  }

  /** 今日焦点横向卡片 */
  function pulseCard(op) {
    var href = '#/detail/' + encodeURIComponent(op.id);
    var timeLabel = op.startTime ? CR.date.fmtTime(op.startTime) : (op.deadline ? '截止 ' + CR.date.fmtTime(op.deadline) : '时间未定');
    return '<a class="pulse-card" href="' + href + '">' +
      '<div class="op-card__badges">' + U.sourceBadge(op) + U.statusBadge(op) + '</div>' +
      '<div class="pulse-card__time">' + U.esc(timeLabel) + '</div>' +
      '<div class="pulse-card__title">' + U.esc(op.title) + '</div>' +
      '<div class="pulse-card__meta">' + U.esc(op.location || op.sourceName || '地点未注明') + '</div>' +
      '</a>';
  }

  /** 截止雷达条目 */
  function deadlineItem(row) {
    var op = row.op;
    var cls = 'deadline-item' + (row.passed ? ' is-passed' : '') +
      (op.riskLevel === 'high' || op.riskLevel === 'suspect' ? ' is-risk' : '');
    var when = CR.date.fmtDateShort(row.at) + (op.deadlineNote ? '（' + op.deadlineNote + '）' : '');
    return '<a class="' + cls + '" href="#/detail/' + U.esc(op.id) + '" data-deadline="' + row.at + '">' +
      '<div class="deadline-item__main">' +
        '<div class="deadline-item__title">' + U.esc(op.title) + '</div>' +
        '<div class="deadline-item__when">' + U.esc(when) + ' · ' + U.esc(CR.trust.sourceLabel(op.sourceType)) + '</div>' +
      '</div>' +
      (row.passed
        ? '<span class="countdown countdown--pass">已截止</span>'
        : '<span class="countdown' + (row.left <= CR.date.HOUR ? ' countdown--asap' : '') +
          '" data-countdown="' + row.at + '" data-mode="deadline">' +
          CR.date.countdownText(row.left) + '</span>') +
      '</a>';
  }

  /** 详情页倒计时盒子 */
  function countdownCell(label, target, opts, note) {
    opts = opts || {};
    if (!target) {
      return '<div class="countdown-cell countdown-cell--pass">' +
        '<div class="countdown-cell__label">' + U.esc(label) + '</div>' +
        '<div class="countdown-cell__value">未注明</div>' +
        '<div class="countdown-cell__hint">请以主办方通知为准</div></div>';
    }
    var left = target - Date.now();
    var passed = left <= 0;
    var tone = passed ? 'countdown-cell--pass'
      : left <= CR.date.HOUR ? 'countdown-cell--danger'
        : left <= CR.date.DAY ? 'countdown-cell--warn' : '';
    return '<div class="countdown-cell ' + tone + '">' +
      '<div class="countdown-cell__label">' + U.esc(label) + '</div>' +
      '<div class="countdown-cell__value" data-countdown="' + target + '" data-mode="box"' +
        (opts.long ? ' data-long="1"' : '') + '>' +
        (passed ? (opts.passedText || '已截止') : CR.date.countdownText(left)) + '</div>' +
      '<div class="countdown-cell__hint">' + U.esc(CR.date.fmtDateShort(target)) + ' · ' +
        (passed ? '时间已过' : CR.date.untilText(left)) + '</div>' +
      (note ? '<div class="countdown-cell__hint" style="color:#b45309">注意：' + U.esc(note) + '</div>' : '') +
      '</div>';
  }

  /** 小列表条目（我的页面用） */
  function miniItem(op, actions, sub) {
    return '<div class="mini-item" data-op="' + U.esc(op.id) + '">' +
      '<div class="mini-item__main">' +
        '<div class="mini-item__title"><a href="#/detail/' + U.esc(op.id) + '">' + U.esc(op.title) + '</a></div>' +
        '<div class="mini-item__sub">' + (sub || U.esc(op.sourceName || '')) + '</div>' +
      '</div>' +
      '<div class="mini-item__actions">' + (actions || '') + '</div>' +
      '</div>';
  }

  CR.card = {
    cardClass: cardClass,
    opportunityCard: opportunityCard,
    pulseCard: pulseCard,
    deadlineItem: deadlineItem,
    countdownCell: countdownCell,
    miniItem: miniItem,
    metaRow: metaRow
  };
})(window);
