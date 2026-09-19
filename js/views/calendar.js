/* ==========================================================================
   js/views/calendar.js — 日历页
   月视图 · 事件点（按来源着色）· 报名截止橙色标记 · 今日高亮
   点击日期查看当日活动 · 冲突提示 · 截止雷达
   ========================================================================== */
(function (global) {
  'use strict';

  var CR = (global.CampusRadar = global.CampusRadar || {});
  var U = CR.ui;
  var S = CR.store;

  var viewMonth = null;   // 当前显示的月份（月初时间戳）
  var selectedDay = null; // 选中的日期（当天 0 点）

  function ensureInit() {
    var today = CR.date.startOfDay(Date.now());
    if (viewMonth == null) viewMonth = CR.date.startOfMonth(today);
    if (selectedDay == null) selectedDay = today;
  }

  /** 汇总所有机会的事件点，按“天”建立索引 */
  function buildIndex() {
    var map = {};
    S.allOpportunities().forEach(function (op) {
      if (S.isHidden(op.id)) return;
      CR.seed.calendarPoints(op).forEach(function (p) {
        var key = String(CR.date.startOfDay(p.at));
        if (!map[key]) map[key] = { items: [] };
        map[key].items.push({ at: p.at, kind: p.kind, label: p.label, op: op });
      });
    });
    return map;
  }

  function dotStyle(op, kind) {
    if (kind === 'deadline') return '';
    if (kind === 'replay') return ' style="background:#0EA5E9"';
    var color = op.origin === 'local' ? CR.trust.SOURCE.local.color : CR.trust.sourceOf(op.sourceType).color;
    return ' style="background:' + color + '"';
  }

  function legend() {
    var codes = ['school', 'college', 'project', 'contest', 'student', 'material', 'supplement', 'local'];
    return '<div class="cal-legend">' +
      codes.map(function (c) {
        return '<span><i class="dot" style="background:' + CR.trust.SOURCE[c].color + '"></i>' +
          U.esc(CR.trust.SOURCE[c].label) + '</span>';
      }).join('') +
      '<span><i class="dot dot--deadline"></i>报名截止</span>' +
      '<span><i class="dot" style="background:#0EA5E9"></i>回放</span>' +
      '</div>';
  }

  function renderMonth(index) {
    var today = CR.date.startOfDay(Date.now());
    var cells = CR.date.monthMatrix(viewMonth);
    var html = '<div class="cal-grid" role="grid" aria-label="月视图">';
    ['日', '一', '二', '三', '四', '五', '六'].forEach(function (d) {
      html += '<div class="cal-dow" role="columnheader">' + d + '</div>';
    });

    cells.forEach(function (c) {
      var day = index[String(c.ts)];
      var items = day ? day.items.slice().sort(function (a, b) { return a.at - b.at; }) : [];
      var isSel = selectedDay != null && c.ts === selectedDay;
      var cls = 'cal-cell' + (c.inMonth ? '' : ' is-out') +
        (c.ts === today ? ' is-today' : '') + (isSel ? ' is-selected' : '');

      var dots = items.slice(0, 4).map(function (it) {
        return '<i class="' + (it.kind === 'deadline' ? 'dot dot--deadline' : 'dot') + '"' +
          dotStyle(it.op, it.kind) + '></i>';
      }).join('');

      var label = CR.date.fmtDate(c.ts) + '，' + (items.length || '无') + ' 个事件' +
        (c.ts === today ? '，今天' : '');

      html += '<button class="' + cls + '" type="button" role="gridcell" data-action="pickDay" data-day="' +
        c.ts + '" aria-label="' + U.esc(label) + '" aria-selected="' + isSel + '">' +
        '<span class="cal-cell__num">' + new Date(c.ts).getDate() + '</span>' +
        '<span class="cal-cell__dots">' + dots + '</span>' +
        (items.length > 4 ? '<span class="cal-cell__more">+' + (items.length - 4) + '</span>' : '') +
        '</button>';
    });
    return html + '</div>';
  }

  function dayPanel(index, watchedIds) {
    var day = index[String(selectedDay)];
    var items = day ? day.items.slice().sort(function (a, b) { return a.at - b.at; }) : [];
    var isToday = selectedDay === CR.date.startOfDay(Date.now());

    var html = '<section class="panel" aria-labelledby="dayTitle">' +
      '<div class="section__head" style="margin-bottom:10px">' +
        '<h2 id="dayTitle" style="font-size:18px">' + U.esc(CR.date.fmtDateWeek(selectedDay)) +
          (isToday ? ' <span class="badge badge--today">今天</span>' : '') + '</h2>' +
        '<span class="section__hint">' + items.length + ' 个事件</span>' +
      '</div>';

    if (!items.length) {
      html += '<p class="t-small t-muted">这一天没有收录的活动或截止。可以把感兴趣的机会“加入日历”后再回来看。</p>';
    } else {
      html += '<div class="stack">' + items.map(function (it) {
        var op = it.op;
        var isDeadline = it.kind === 'deadline';
        var color = isDeadline ? '#F59E0B'
          : (op.origin === 'local' ? CR.trust.SOURCE.local.color : CR.trust.sourceOf(op.sourceType).color);
        return '<div class="mini-item" style="border-left:3px solid ' + color + '">' +
          '<div class="mini-item__main">' +
            '<div class="mini-item__title"><a href="#/detail/' + U.esc(op.id) + '">' +
              U.esc(op.title) + '</a></div>' +
            '<div class="mini-item__sub">' + U.esc(CR.date.fmtTime(it.at)) + ' · ' +
              (isDeadline ? '报名截止' : (it.kind === 'replay' ? '预计上传回放' : '活动开始')) +
              (it.label ? ' · ' + U.esc(it.label) : '') + ' · ' +
              U.esc(CR.trust.sourceLabel(op.sourceType)) +
              (op.trustLevel === 'pending' ? ' · 待确认' : '') + '</div>' +
          '</div>' +
          '<div class="mini-item__actions">' +
            (watchedIds[op.id]
              ? '<span class="tag tag--accent">' + U.icon('check') + '已关注</span>'
              : (S.inCalendar(op.id)
                ? '<span class="tag tag--accent">' + U.icon('check') + '已加入</span>'
                : '<button class="btn btn--sm btn--ghost" type="button" data-action="calendar" data-id="' +
                  U.esc(op.id) + '">' + U.icon('plus') + '加入日历</button>')) +
          '</div></div>';
      }).join('') + '</div>';
    }
    return html + '</section>';
  }

  /** 冲突提示：针对用户关注（收藏 / 报名 / 加入日历）的活动 */
  function conflictPanel(watched) {
    var groups = CR.conflict.groupByDay(CR.conflict.detect(watched));
    if (!groups.length) {
      return U.banner('info', '未检测到时间冲突',
        '已检查你的收藏、报名与加入日历的活动。关注更多活动后，雷达会自动提示时间重叠。', 'check');
    }
    return '<div class="stack">' + groups.map(function (g) {
      var d = CR.conflict.describeGroup(g);
      return '<div class="conflict-item">' + U.icon('alert') +
        '<div><div class="conflict-item__title">' + U.esc(d.title) + '</div>' +
        '<div class="conflict-item__text">时间重叠，注意取舍或提前向主办方确认能否错峰参加。</div>' +
        '<div class="conflict-item__list">' + d.lines.map(function (l) {
          return '<div>· ' + U.esc(l) + '</div>';
        }).join('') + '</div></div></div>';
    }).join('') + '</div>';
  }

  function render(root) {
    ensureInit();
    var index = buildIndex();
    var watched = S.calendarOpportunities();
    var watchedIds = {};
    watched.forEach(function (op) { watchedIds[op.id] = 1; });
    var radar = CR.conflict.deadlineRadar(S.allOpportunities(), { includePassed: false });

    var html = '<div class="view"><div class="discover-layout">';

    /* 左列：月视图 + 当日列表 + 冲突提示 */
    html += '<div>';
    html += '<section class="panel">' +
      '<div class="cal-head">' +
        '<h2>' + new Date(viewMonth).getFullYear() + ' 年 ' + (new Date(viewMonth).getMonth() + 1) + ' 月</h2>' +
        '<div class="cal-nav">' +
          '<button class="icon-btn" type="button" data-action="prevMonth" aria-label="上个月">' +
            U.icon('back') + '</button>' +
          '<button class="btn btn--sm btn--ghost" type="button" data-action="todayMonth">今天</button>' +
          '<button class="icon-btn" type="button" data-action="nextMonth" aria-label="下个月">' +
            '<span style="display:inline-block;transform:rotate(180deg)">' + U.icon('back') + '</span>' +
          '</button>' +
        '</div>' +
      '</div>' +
      renderMonth(index) +
      legend() +
      '</section>';

    html += '<div style="height:16px"></div>';
    html += dayPanel(index, watchedIds);

    html += '<div style="height:16px"></div>';
    html += '<section class="panel">' +
      '<div class="section__head" style="margin-bottom:10px">' +
        '<h2 style="font-size:18px">冲突检测</h2>' +
        '<span class="section__hint">收藏 / 报名 / 已加入日历（' + watched.length + ' 条）</span>' +
      '</div>' +
      conflictPanel(watched) +
      '</section>';

    html += '</div>';

    /* 右列：截止雷达 */
    html += '<aside class="discover-aside"><section class="panel">' +
      '<div class="section__head" style="margin-bottom:10px"><h2 style="font-size:18px">截止雷达</h2></div>' +
      '<p class="t-small t-muted" style="margin-bottom:10px">按截止时间升序；橙色标记为报名截止。</p>' +
      (radar.length
        ? '<div class="deadline-radar">' + radar.map(function (row) {
          return CR.card.deadlineItem(row) +
            (watchedIds[row.op.id]
              ? '<span class="tag tag--accent" style="margin:-6px 0 4px 14px">' + U.icon('star') + '你已关注</span>'
              : '');
        }).join('') + '</div>'
        : U.empty({ title: '暂无未截止的报名', text: '所有收录的报名都已截止。' })) +
      '</section></aside>';

    html += '</div></div>';
    root.innerHTML = html;
  }

  CR.views = CR.views || {};
  CR.views.calendar = {
    title: '日历',
    render: render,
    prevMonth: function () { ensureInit(); viewMonth = CR.date.addMonths(viewMonth, -1); },
    nextMonth: function () { ensureInit(); viewMonth = CR.date.addMonths(viewMonth, 1); },
    today: function () {
      ensureInit();
      viewMonth = CR.date.startOfMonth(Date.now());
      selectedDay = CR.date.startOfDay(Date.now());
    },
    pickDay: function (ts) {
      selectedDay = Number(ts);
      viewMonth = CR.date.startOfMonth(selectedDay);
    },
    selectedDay: function () { ensureInit(); return selectedDay; },
    buildIndex: buildIndex
  };
})(window);
