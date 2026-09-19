/* ==========================================================================
   js/views/mine.js — 我的
   数据概览 · 收藏 · 报名/意向 · 提醒 · 我的发布 · 浏览历史
   新生模式设置 · 筛选偏好 · 清除本地数据
   ========================================================================== */
(function (global) {
  'use strict';

  var CR = (global.CampusRadar = global.CampusRadar || {});
  var U = CR.ui;
  var S = CR.store;

  var TABS = [
    { key: 'favorites', label: '我的收藏' },
    { key: 'signups', label: '我的报名/意向' },
    { key: 'reminders', label: '我的提醒' },
    { key: 'posts', label: '我的发布' },
    { key: 'history', label: '浏览历史' },
    { key: 'settings', label: '新生模式设置' }
  ];

  var tab = 'favorites';

  function statGrid() {
    var c = S.counts();
    var items = [
      { n: c.favorites, label: '收藏' },
      { n: c.signups, label: '报名/意向' },
      { n: c.reminders, label: '提醒' },
      { n: c.posts, label: '本机发布' }
    ];
    return '<div class="stat-grid">' + items.map(function (i) {
      return '<div class="stat"><div class="stat__num">' + i.n + '</div>' +
        '<div class="stat__label">' + U.esc(i.label) + '</div></div>';
    }).join('') + '</div>';
  }

  function statusTag(key) {
    var st = S.SIGNUP_STATUS[key] || S.SIGNUP_STATUS.signed;
    var cls = st.tone === 'ok' ? 'badge--open' : (st.tone === 'info' ? 'badge--today' : 'badge--pending');
    return '<span class="badge ' + cls + '">' + U.esc(st.label) + '</span>';
  }

  function removeBtn(action, id, label) {
    return '<button class="btn btn--sm btn--ghost" type="button" data-action="' + action + '" data-id="' +
      U.esc(id) + '" title="' + U.esc(label) + '">' + U.icon('trash') + '</button>';
  }

  function favPanel() {
    var rows = S.state.user.favorites.map(function (f) { return S.getById(f.id); }).filter(Boolean);
    if (!rows.length) {
      return U.empty({
        title: '还没有收藏',
        text: '在发现页点卡片右下角的星标即可收藏，刷新后依然保留。',
        action: { href: '#/discover', label: '去发现机会' }
      });
    }
    return '<div class="stack">' + rows.map(function (op) {
      return CR.card.miniItem(op,
        '<span class="badge badge--today">' + U.icon('starFill') + '已收藏</span>' +
        removeBtn('unfav', op.id, '取消收藏'),
        CR.trust.sourceLabel(op.sourceType) + ' · ' +
        (op.deadline ? '截止 ' + CR.date.fmtDateShort(op.deadline) : (op.startTime ? CR.date.fmtDateShort(op.startTime) : '时间未注明'))
      );
    }).join('') + '</div>';
  }

  function signupPanel() {
    var rows = S.state.user.signups.map(function (r) {
      return { row: r, op: S.getById(r.id) };
    }).filter(function (x) { return x.op; });
    if (!rows.length) {
      return U.empty({
        title: '还没有报名或意向登记',
        text: '纯前端模拟：不会真正提交给主办方，只在本机记录你的状态。',
        action: { href: '#/discover', label: '去看看有哪些机会' }
      });
    }
    return '<div class="stack">' + rows.map(function (x) {
      var op = x.op;
      var hint = op.needReview
        ? '需审核：提交报名表不代表最终录取'
        : (op.waitlist ? '报名已截止，可候补关注' : '');
      return CR.card.miniItem(op,
        statusTag(x.row.status) +
        '<button class="btn btn--sm btn--ghost" type="button" data-action="signup" data-id="' +
          U.esc(op.id) + '">改状态</button>' +
        removeBtn('unsignup', op.id, '取消报名记录'),
        U.esc(CR.date.fmtDateShort(x.row.at || Date.now())) + ' 登记 · ' +
        (op.deadline ? '截止 ' + CR.date.fmtDateShort(op.deadline) : '无明确截止') +
        (hint ? ' · <span class="op-card__missing">' + U.esc(hint) + '</span>' : '')
      );
    }).join('') + '</div>';
  }

  function reminderPanel() {
    var rows = S.state.user.reminders.map(function (r) {
      return { row: r, op: S.getById(r.id) };
    }).filter(function (x) { return x.op; });
    if (!rows.length) {
      return U.empty({
        title: '还没有设置提醒',
        text: '在详情页选择“提前 1 小时”等选项即可设置。页面打开时会自动检查到点提醒。'
      });
    }
    return '<div class="stack">' + rows.map(function (x) {
      var left = x.row.at - Date.now();
      var off = S.REMINDER_OFFSETS.filter(function (o) { return o.key === x.row.offset; })[0];
      return CR.card.miniItem(x.op,
        '<span class="tag tag--accent" data-countdown="' + x.row.at + '" data-mode="deadline">' +
          CR.date.countdownText(left) + '</span>' +
        '<button class="btn btn--sm btn--ghost" type="button" data-action="reminder" data-id="' +
          U.esc(x.op.id) + '">修改</button>' +
        removeBtn('unremind', x.op.id, '删除提醒'),
        (off ? off.label : '提前提醒') + ' · 触发时间 ' + U.esc(CR.date.fmtDateShort(x.row.at)) +
        '（基准：' + (x.row.base === 'deadline' ? '报名截止' : '活动开始') + '）'
      );
    }).join('') + '</div>';
  }

  function postsPanel() {
    var list = S.state.posts;
    if (!list.length) {
      return U.empty({
        title: '还没有本机发布',
        text: '你可以发布约球、搭子、招募或交流信息，发布后会进入发现列表与日历。',
        action: { href: '#/publish', label: '去发布' }
      });
    }
    return '<div class="banner banner--info" style="margin-bottom:10px">' + U.icon('home') +
      '<div><div class="banner__title">本机发布，仅本机可见；纯前端模拟</div>' +
      '<div class="banner__text">保存在 IndexedDB，刷新或重新打开后依然存在。</div></div></div>' +
      '<div class="stack">' + list.map(function (p) {
        var op = S.postToOpportunity(p);
        return CR.card.miniItem(op,
          '<button class="btn btn--sm btn--ghost" type="button" data-action="editPost" data-id="' +
            U.esc(p.id) + '">' + U.icon('edit') + '编辑</button>' +
          removeBtn('removePost', p.id, '下架'),
          U.esc(p.category) + ' · 发布 ' + U.esc(CR.date.fmtDateShort(p.createdAt)) +
          (op.missingFields.length ? ' · <span class="op-card__missing">待确认：' +
            U.esc(op.missingFields.join('、')) + '</span>' : '') +
          ' · <button class="btn btn--sm btn--ghost" type="button" data-action="restorePost" data-id="' +
            U.esc(p.id) + '">查看已下架</button>'
        );
      }).join('') + '</div>';
  }

  function historyPanel() {
    if (!S.state.history.length) {
      return U.empty({ title: '还没有浏览记录', text: '打开任意机会详情后，这里会记录你的浏览历史。' });
    }
    return '<div class="row" style="margin-bottom:10px"><span class="tag">共 ' + S.state.history.length +
      ' 条</span><button class="btn btn--sm btn--ghost" type="button" data-action="clearHistory">' +
      U.icon('trash') + '清空浏览历史</button></div>' +
      '<div class="stack">' + S.state.history.map(function (h) {
        var op = S.getById(h.id);
        if (!op) {
          return '<div class="mini-item"><div class="mini-item__main">' +
            '<div class="mini-item__title t-faint">' + U.esc(h.title || h.id) + '</div>' +
            '<div class="mini-item__sub">该内容已不可用</div></div>' +
            '<div class="mini-item__actions">' + removeBtn('removeHistory', h.id, '删除记录') + '</div></div>';
        }
        return CR.card.miniItem(op, removeBtn('removeHistory', op.id, '删除记录'),
          '浏览于 ' + CR.date.fmtDateShort(h.visitedAt) + ' ' + CR.date.fmtTime(h.visitedAt) +
          ' · ' + CR.trust.sourceLabel(op.sourceType));
      }).join('') + '</div>';
  }

  /* ---------------------------------------------------- 新生模式设置 ----- */
  var GRADES = [
    { key: 'freshman', label: '大一' },
    { key: 'sophomore', label: '大二' },
    { key: 'junior', label: '大三及以上' }
  ];
  var INTERESTS = ['编程', 'AI', '科研', '竞赛', '志愿', '摄影', '语言'];
  var FOUNDATIONS = [
    { key: 'none', label: '零基础' },
    { key: 'some', label: '有基础' }
  ];
  var HOURS = [
    { key: '1-2', label: '1—2 小时' },
    { key: '3-4', label: '3—4 小时' },
    { key: '5+', label: '5 小时以上' }
  ];

  function chipRow(options, selected, group, multi) {
    var sel = multi ? (selected || []) : [selected];
    return '<div class="chips">' + options.map(function (o) {
      var key = o.key != null ? o.key : o;
      var label = o.label != null ? o.label : o;
      var on = sel.indexOf(key) >= 0;
      return '<button class="chip' + (on ? ' is-on' : '') + '" type="button" role="radio" aria-checked="' + on +
        '" data-setting="' + group + '" data-value="' + U.esc(key) + '" data-multi="' + !!multi + '">' +
        U.esc(label) + '</button>';
    }).join('') + '</div>';
  }

  function settingsPanel() {
    var p = S.state.profile;
    var prefs = S.state.preferences;
    return '<div class="stack-lg">' +
      '<div class="panel" style="box-shadow:none">' +
        '<div class="row"><strong>' + U.icon('shield') + ' 新生护航模式</strong>' +
        '<span class="spacer"></span>' +
        '<label class="checkline"><input type="checkbox" data-setting="guardMode" data-toggle="1"' +
          (p.guardMode ? ' checked' : '') + ' /><span class="t-small">' +
          (p.guardMode ? '已开启' : '已关闭') + '</span></label></div>' +
        '<p class="t-small t-muted" style="margin-top:6px">开启后，卡片会显示基于已提供信息的推荐理由，' +
          '并按新生友好度优先排序。所有理由都可以在详情页核对，不会补全未提供的信息。</p>' +
      '</div>' +
      '<div class="field"><div class="field__label">年级</div>' +
        chipRow(GRADES, p.grade, 'grade', false) + '</div>' +
      '<div class="field"><div class="field__label">兴趣</div>' +
        chipRow(INTERESTS, p.interests, 'interests', true) + '</div>' +
      '<div class="field"><div class="field__label">基础</div>' +
        chipRow(FOUNDATIONS, p.foundation, 'foundation', false) + '</div>' +
      '<div class="field"><div class="field__label">每周可投入时间</div>' +
        chipRow(HOURS, p.hoursPerWeek, 'hoursPerWeek', false) + '</div>' +
      '<div class="divider"></div>' +
      '<div class="field"><div class="field__label">筛选偏好（会自动保留）</div>' +
        '<p class="t-small t-muted">来源：' + (prefs.sources.length ? U.esc(prefs.sources.map(CR.trust.sourceLabel).join('、')) : '全部') +
        '；类型：' + (prefs.categories.length ? U.esc(prefs.categories.join('、')) : '全部') +
        '；对象：' + (prefs.audiences.length ? U.esc(prefs.audiences.join('、')) : '全部') +
        '；条件：' + (prefs.conditions.length ? U.esc(prefs.conditions.join('、')) : '全部') +
        '；状态：' + (prefs.statuses.length ? U.esc(prefs.statuses.join('、')) : '全部') +
        '；排序：' + U.esc((S.SORTS.filter(function (s) { return s.key === prefs.sort; })[0] || {}).label || prefs.sort) +
        '；搜索词：' + (prefs.query ? U.esc(prefs.query) : '无') + '</p>' +
        '<div class="row" style="margin-top:8px">' +
          '<button class="btn btn--sm btn--ghost" type="button" data-action="resetFilters">清空筛选偏好</button>' +
          '<a class="btn btn--sm btn--ghost" href="#/discover">回发现页调整</a>' +
        '</div>' +
      '</div>' +
      '<div class="divider"></div>' +
      '<div class="banner banner--danger">' + U.icon('shield') +
        '<div><div class="banner__title">清除本地数据</div>' +
        '<div class="banner__text">将删除收藏、报名、提醒、本机发布、浏览历史与引导设置（localStorage + IndexedDB）。' +
        '此操作不可撤销，需要二次确认。</div>' +
        '<div class="row" style="margin-top:10px">' +
          '<button class="btn btn--danger btn--sm" type="button" data-action="clearAll">' +
            U.icon('trash') + '清除全部本地数据</button>' +
          '<a class="btn btn--sm btn--ghost" href="#/onboarding">重新做新生引导</a>' +
        '</div></div></div>' +
      '</div>';
  }

  function tabPanel() {
    if (tab === 'favorites') return favPanel();
    if (tab === 'signups') return signupPanel();
    if (tab === 'reminders') return reminderPanel();
    if (tab === 'posts') return postsPanel();
    if (tab === 'history') return historyPanel();
    return settingsPanel();
  }

  function tabCount(key) {
    var c = S.counts();
    if (key === 'favorites') return c.favorites;
    if (key === 'signups') return c.signups;
    if (key === 'reminders') return c.reminders;
    if (key === 'posts') return c.posts;
    if (key === 'history') return S.state.history.length;
    return null;
  }

  function render(root) {
    var p = S.state.profile;

    var html = '<div class="view">' +
      '<div class="section__head"><h1 style="font-size:24px">我的</h1>' +
      '<span class="section__hint">所有数据保存在本机浏览器</span></div>' +
      statGrid() +
      '<div style="height:12px"></div>' +
      U.banner('info', '纯前端模拟说明',
        '收藏、报名、提醒、发布都不会真正提交到任何服务器；数据保存在 localStorage 与 IndexedDB 中。' +
        '清除浏览器数据会一并清除这些记录。', 'shield') +
      '<div class="section">' +
      '<div class="tabrow" role="tablist">' + TABS.map(function (t) {
        var n = tabCount(t.key);
        var on = tab === t.key;
        return '<button class="chip' + (on ? ' is-on' : '') + '" type="button" role="tab" aria-selected="' + on +
          '" data-action="mineTab" data-value="' + t.key + '">' + U.esc(t.label) +
          (n != null ? '<span class="chip__count">' + n + '</span>' : '') + '</button>';
      }).join('') + '</div>' +
      '<section class="panel" role="tabpanel" aria-label="' + U.esc((TABS.filter(function (t) { return t.key === tab; })[0] || {}).label || '') + '">' +
      tabPanel() +
      '</section></div>';

    if (p.guardMode) {
      html += '<div class="section">' + U.banner('info', '新生护航模式已开启',
        '推荐理由示例：' + (CR.trust.reasons(CR.seed.byId('02'), p).join(' · ') || '—'), 'spark') + '</div>';
    }

    html += '</div>';
    root.innerHTML = html;
  }

  CR.views = CR.views || {};
  CR.views.mine = {
    title: '我的',
    render: render,
    setTab: function (key) { tab = key; },
    tab: function () { return tab; },
    GRADES: GRADES,
    INTERESTS: INTERESTS,
    FOUNDATIONS: FOUNDATIONS,
    HOURS: HOURS
  };
})(window);
