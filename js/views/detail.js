/* ==========================================================================
   js/views/detail.js — 机会详情页
   完整信息 / 关联补充通知 / 倒计时 / 风险提示 / 吸底操作栏 / 我的备注
   ========================================================================== */
(function (global) {
  'use strict';

  var CR = (global.CampusRadar = global.CampusRadar || {});
  var U = CR.ui;
  var S = CR.store;

  function infoRow(label, valueHtml) {
    return '<div class="inforow"><dt>' + U.esc(label) + '</dt><dd>' + valueHtml + '</dd></div>';
  }

  function missing() {
    return '<span class="missing">' + U.esc(CR.trust.MISSING) + '</span>';
  }

  function orMissing(text) {
    return text ? U.esc(text) : missing();
  }

  function render(root, params) {
    var id = params && params.id;
    var op = id ? S.getById(id) : null;

    if (!op) {
      root.innerHTML = '<div class="view">' + U.empty({
        title: '找不到这条机会',
        text: '它可能已被下架，或链接不正确（编号：' + U.esc(id || '空') + '）。',
        action: { href: '#/discover', label: '返回发现页' }
      }) + '</div>';
      return;
    }

    // 记录浏览历史（含本机发布）
    S.recordVisit(op.id);

    var now = Date.now();
    var risk = CR.trust.riskOf(op);
    var rel = CR.conflict.relations(op, S.allOpportunities());
    var fav = S.isFavorite(op.id);
    var signup = S.getSignup(op.id);
    var remind = S.getReminder(op.id);
    var inCal = S.inCalendar(op.id);
    var hidden = S.isHidden(op.id);
    var guardOn = !!S.state.profile.guardMode;
    var reasons = guardOn ? CR.trust.reasons(op, S.state.profile) : [];

    var html = '';

    /* ---------------- 头部 ---------------- */
    html += '<div class="detail-hero"><div class="detail-hero__inner">' +
      '<a class="btn btn--sm btn--ghost" href="#/discover">' + U.icon('back') + '返回发现</a>' +
      '<div class="detail-hero__badges" style="margin-top:12px">' + U.badgeRow(op) + '</div>' +
      '<h1>' + U.esc(op.title) + '</h1>' +
      (op.summary ? '<p class="t-muted">' + U.esc(op.summary) + '</p>' : '') +
      '<div class="row" style="margin-top:12px">' +
        '<span class="tag">编号 ' + U.esc(op.id) + '</span>' +
        '<span class="tag">' + U.esc(CR.trust.sourceLabel(op.sourceType)) + ' · ' + U.esc(op.sourceName) + '</span>' +
        '<span class="tag">' + U.esc(op.category) + '</span>' +
        (op.origin === 'local' ? '<span class="tag tag--primary">本机发布，仅本机可见；纯前端模拟</span>' : '') +
      '</div>' +
      '</div></div>';

    html += '<div class="detail-body"><div class="detail-grid">';

    /* ---------------- 风险 / 待确认横幅 ---------------- */
    if (risk && risk.level === 'high') {
      html += U.banner('danger', U.icon('shield') + ' ' + risk.title, U.esc(risk.text));
    } else if (risk) {
      html += U.banner('warn', U.icon('alert') + ' ' + risk.title, U.esc(risk.text));
    }
    if (op.trustLevel === 'pending' || (op.missingFields && op.missingFields.length)) {
      html += U.banner('pending', '部分信息未注明',
        '缺失项：' + U.esc(op.missingFields.join('、') || '—') +
        '。页面不会替你补全这些信息，请以主办方通知为准。', 'question');
    }
    if (op.deadline && op.deadline - now <= 0 && op.waitlist) {
      html += U.banner('warn', '报名已截止，可候补关注',
        '原报名截止时间为 ' + U.esc(CR.date.fmtDateShort(op.deadline)) +
        '。活动方说明：如现场仍有余位，可接受候补入场（不保证名额）。', 'users');
    }
    if (op.deadlineNote) {
      html += U.banner('info', '时间说明',
        U.esc(op.deadlineNote) + '（对应时间：' + U.esc(CR.date.fmtDateShort(op.deadline)) + '）。' +
        '这条时间不是报名截止，请以主办方通知为准。', 'question');
    }
    if (op.replayAt) {
      html += U.banner('info', '活动已结束，预计可看回放',
        '直播已于 ' + U.esc(CR.date.fmtDateShort(op.startTime)) + ' 结束；活动方预计 ' +
        U.esc(CR.date.fmtDate(op.replayAt)) + ' 上传回放。回放地址未注明，请以主办方通知为准。', 'play');
    }

    /* ---------------- 新生护航推荐理由 ---------------- */
    if (reasons.length) {
      html += '<div class="panel" style="background:#f0fdfa;border-color:#ccfbf1">' +
        '<div class="row"><strong style="color:#0f766e">' + U.icon('shield') + ' 新生护航模式推荐理由</strong>' +
        '<span class="tag tag--accent">仅依据已提供信息</span></div>' +
        '<div class="op-card__reasons" style="background:transparent;border:0;padding:8px 0 0">' +
        reasons.map(function (r) { return '<span class="reason">' + U.esc(r) + '</span>'; }).join('') +
        '</div></div>';
    }

    /* ---------------- 倒计时 ---------------- */
    html += '<section class="panel" aria-labelledby="cdTitle">' +
      '<h2 id="cdTitle" style="font-size:18px;margin-bottom:12px">时间与倒计时</h2>' +
      '<div class="countdown-box">' +
        CR.card.countdownCell(
          op.needSignup ? '报名截止倒计时' : '关键时间倒计时',
          op.deadline,
          { passedText: op.needSignup ? '已截止' : '已过期' },
          op.deadlineNote
        ) +
        CR.card.countdownCell('活动开始倒计时', op.startTime, { passedText: '已开始/已结束' }) +
      '</div>' +
      (op.contestMilestones && op.contestMilestones.length
        ? '<div class="divider"></div><div class="t-small t-muted">关键节点：' +
          op.contestMilestones.map(function (m) {
            return U.esc(m.label) + ' ' + U.esc(CR.date.fmtDateShort(m.at));
          }).join(' · ') + '</div>'
        : '') +
      (op.recurrence && op.recurrence.weeks
        ? '<div class="t-small t-muted" style="margin-top:8px">共 ' + op.recurrence.weeks +
          ' 周，每周' + U.esc(CR.date.WEEK[op.recurrence.weekday]) + ' ' + U.esc(op.recurrence.time) + ' 开展。</div>'
        : '') +
      '</section>';

    /* ---------------- 完整信息 ---------------- */
    var timeHtml = op.timeText ? U.esc(op.timeText)
      : (op.startTime ? U.esc(CR.date.fmtRange(op.startTime, op.endTime)) : missing());

    html += '<section class="panel" aria-labelledby="infoTitle">' +
      '<h2 id="infoTitle" style="font-size:18px;margin-bottom:8px">完整信息</h2>' +
      '<dl class="infotable">' +
      infoRow('时间', timeHtml) +
      infoRow('地点', op.locationPending && !op.location
        ? '<span class="missing">待确认，请以发起人通知为准</span>'
        : orMissing(U.locationText(op))) +
      infoRow('参与方式', op.online === true ? '线上（' + (op.location ? '线下同步：' + U.esc(op.location) : '线下地点未注明') + '）'
        : (op.online === false ? '线下' : missing())) +
      infoRow('适用对象', orMissing(op.audienceExtra ||
        (op.audience ? CR.trust.AUDIENCE_LEVELS[op.audience] : ''))) +
      infoRow('条件要求', op.requirements && op.requirements.length
        ? U.esc(op.requirements.join('；')) : '<span class="t-faint">无特别说明</span>') +
      infoRow('报名方式', op.needSignup === false
        ? '无需报名'
        : orMissing(op.signupMethod)) +
      infoRow('报名截止', op.deadline
        ? U.esc(CR.date.fmtDateShort(op.deadline)) +
          (op.deadlineNote ? ' <span class="t-faint">（' + U.esc(op.deadlineNote) + '）</span>' : '')
        : (op.needSignup === false ? '无需报名' : missing())) +
      infoRow('是否需要审核', op.needReview
        ? '需要审核：<strong>提交报名表不代表最终录取，以审核通知为准</strong>'
        : (op.needSignup === false ? '无需报名' : '<span class="t-faint">未注明是否需要审核</span>')) +
      infoRow('人数限制', op.capacity
        ? '限 ' + U.esc(String(op.capacity)) + ' 人' + (op.needSignup ? '，先到先得' : '')
        : (op.capacityLimited ? '有名额限制，具体人数未注明' : '<span class="t-faint">未注明</span>')) +
      infoRow('费用', op.fee ? U.esc(op.fee) : missing()) +
      infoRow('投入时间', op.weeklyHours ? '每周约 ' + op.weeklyHours + ' 小时' + (op.durationText ? '；' + U.esc(op.durationText) : '')
        : (op.durationText ? U.esc(op.durationText) : '<span class="t-faint">未注明</span>')) +
      (op.recruitRoles && op.recruitRoles.length
        ? infoRow('招募方向', U.esc(op.recruitRoles.join('、'))) : '') +
      infoRow('来源可信度', U.esc(CR.trust.trustOf(op.trustLevel).label) + ' — ' +
        U.esc(CR.trust.trustOf(op.trustLevel).desc)) +
      infoRow('标签', (op.tags || []).length
        ? (op.tags.map(function (t) { return U.tag(t); }).join(' '))
        : '<span class="t-faint">无</span>') +
      '</dl></section>';

    /* ---------------- 备注 / 补充信息 ---------------- */
    if (op.notes && op.notes.length) {
      html += '<section class="panel" aria-labelledby="notesTitle">' +
        '<h2 id="notesTitle" style="font-size:18px;margin-bottom:8px">备注与说明</h2>' +
        '<ul class="stack" style="font-size:14px;line-height:22px;color:var(--text-2)">' +
        op.notes.map(function (n) { return '<li>' + U.icon('check') + ' ' + U.esc(n) + '</li>'; }).join('') +
        '</ul></section>';
    }

    /* ---------------- 关联通知 ---------------- */
    if (rel.supplements.length || rel.original) {
      html += '<section class="panel" aria-labelledby="relTitle">' +
        '<h2 id="relTitle" style="font-size:18px;margin-bottom:8px">关联通知</h2>' +
        '<p class="t-small t-muted" style="margin-bottom:10px">' +
        '补充通知不会覆盖原始信息，两条并列展示，请以最新通知为准。</p>' +
        '<div class="related-list">' +
        rel.supplements.map(function (s) {
          return '<a class="related-item" href="#/detail/' + U.esc(s.id) + '">' +
            '<div class="related-item__label">补充通知（关联 ' + U.esc(op.id) + '）</div>' +
            '<div class="related-item__title">' + U.esc(s.title) + '</div>' +
            '<div class="related-item__text">' + U.esc(s.summary) + '</div>' +
            '<div class="related-item__text t-faint">' + U.esc(s.notes.slice(0, 2).join(' ')) + '</div>' +
            '</a>';
        }).join('') +
        (rel.original
          ? '<a class="related-item" href="#/detail/' + U.esc(rel.original.id) + '">' +
            '<div class="related-item__label">原始信息（本通知的关联对象）</div>' +
            '<div class="related-item__title">' + U.esc(rel.original.title) + '</div>' +
            '<div class="related-item__text">' + U.esc(rel.original.summary) + '</div></a>'
          : '') +
        '</div></section>';
    }

    /* ---------------- 我的备注 ---------------- */
    html += '<section class="panel" aria-labelledby="myTitle">' +
      '<h2 id="myTitle" style="font-size:18px;margin-bottom:8px">我的备注</h2>' +
      '<div class="field">' +
        '<label class="field__label" for="noteInput">仅保存在本机（IndexedDB）</label>' +
        '<textarea class="textarea" id="noteInput" data-action="noteInput" ' +
          'placeholder="例如：和室友一起报名 / 记得带学生证">' + U.esc(S.noteOf(op.id)) + '</textarea>' +
        '<div class="field__hint">刷新或重新打开后仍会保留。</div>' +
      '</div>' +
      '<div class="row" style="margin-top:10px">' +
        '<button class="btn btn--secondary btn--sm" type="button" data-action="saveNote" data-id="' + U.esc(op.id) + '">' +
          U.icon('check') + '保存备注</button>' +
        '<button class="btn btn--ghost btn--sm" type="button" data-action="copy" data-id="' + U.esc(op.id) + '">' +
          U.icon('copy') + '复制信息</button>' +
      '</div></section>';

    /* ---------------- 本机发布的管理入口 ---------------- */
    if (op.origin === 'local') {
      html += '<section class="panel">' +
        '<h2 style="font-size:18px;margin-bottom:8px">本机发布管理</h2>' +
        '<p class="t-small t-muted" style="margin-bottom:10px">' +
        '这条信息由你本机发布，仅本机可见，纯前端模拟，不会真正对外提交。</p>' +
        '<div class="row">' +
          '<a class="btn btn--secondary btn--sm" href="#/publish?edit=" data-action="editPost">' +
            U.icon('edit') + '编辑</a>' +
          '<button class="btn btn--danger btn--sm" type="button" data-action="removePost" data-id="' +
            U.esc(op.id) + '">' + U.icon('trash') + '下架</button>' +
        '</div></section>';
    }

    html += '<div style="height:8px"></div></div></div>'; // /detail-grid /detail-body

    /* ---------------- 吸底操作栏 ---------------- */
    html += '<div class="actionbar"><div class="actionbar__inner">' +
      '<button class="btn ' + (fav ? 'btn--secondary' : 'btn--primary') + '" type="button" data-action="fav" data-id="' +
        U.esc(op.id) + '" aria-pressed="' + fav + '">' +
        (fav ? U.icon('starFill') : U.icon('star')) + (fav ? '已收藏' : '收藏') + '</button>' +
      '<button class="btn ' + (signup ? 'btn--secondary' : 'btn--ghost') + '" type="button" data-action="signup" data-id="' +
        U.esc(op.id) + '">' + U.icon('check') +
        (signup ? '报名状态：' + U.esc(S.SIGNUP_STATUS[signup.status].label) : '报名 / 意向登记') + '</button>' +
      '<button class="btn ' + (remind ? 'btn--secondary' : 'btn--ghost') + '" type="button" data-action="reminder" data-id="' +
        U.esc(op.id) + '">' + U.icon(remind ? 'bellOn' : 'bell') +
        (remind ? '提醒：' + U.esc(reminderLabel(remind)) : '设置提醒') + '</button>' +
      '<button class="btn ' + (inCal ? 'btn--secondary' : 'btn--ghost') + '" type="button" data-action="calendar" data-id="' +
        U.esc(op.id) + '">' + U.icon('calendar') + (inCal ? '已加入日历' : '加入日历') + '</button>' +
      '<button class="btn ' + (hidden ? 'btn--secondary' : 'btn--ghost') + '" type="button" data-action="hide" data-id="' +
        U.esc(op.id) + '">' + U.icon('eyeOff') + (hidden ? '已标记不感兴趣' : '标记不感兴趣') + '</button>' +
      '<button class="btn btn--ghost" type="button" data-action="copy" data-id="' + U.esc(op.id) + '">' +
        U.icon('copy') + '复制信息</button>' +
      '</div></div>';

    root.innerHTML = html;
  }

  function reminderLabel(row) {
    var off = S.REMINDER_OFFSETS.filter(function (o) { return o.key === row.offset; })[0];
    return off ? off.label.replace('提前 ', '') + '前' : '已设置';
  }

  /** 生成用于复制的纯文本 */
  function plainText(op) {
    var lines = [];
    lines.push(op.title);
    lines.push('来源：' + CR.trust.sourceLabel(op.sourceType) + ' · ' + op.sourceName);
    lines.push('状态：' + CR.trust.statusOf(op.status || CR.conflict.statusOf(op)).label);
    lines.push('时间：' + (op.timeText || (op.startTime ? CR.date.fmtRange(op.startTime, op.endTime) : CR.trust.MISSING)));
    lines.push('地点：' + (op.location || (op.locationPending ? '待确认' : CR.trust.MISSING)));
    lines.push('对象：' + (op.audienceExtra || (op.audience ? CR.trust.AUDIENCE_LEVELS[op.audience] : CR.trust.MISSING)));
    lines.push('报名截止：' + (op.deadline ? CR.date.fmtDateShort(op.deadline) : (op.needSignup === false ? '无需报名' : CR.trust.MISSING)));
    lines.push('报名方式：' + (op.needSignup === false ? '无需报名' : (op.signupMethod || CR.trust.MISSING)));
    lines.push('费用：' + (op.fee || CR.trust.MISSING));
    if (op.needReview) lines.push('注意：提交报名表不代表最终录取，以审核通知为准。');
    if (op.riskLevel === 'high') lines.push('风险提示：' + CR.trust.riskOf(op).text);
    if (op.riskLevel === 'suspect') lines.push('提示：' + CR.trust.riskOf(op).text);
    lines.push('（来自 校园机会雷达 CampusRadar · 数据版本 ' + CR.seed.SEED_VERSION + '）');
    return lines.join('\n');
  }

  CR.views = CR.views || {};
  CR.views.detail = {
    title: '详情',
    render: render,
    plainText: plainText,
    reminderLabel: reminderLabel
  };
})(window);
