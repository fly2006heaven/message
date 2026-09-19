/* ==========================================================================
   js/utils/conflict.js — 冲突与截止雷达
   1) 时间冲突检测（收藏 / 已报名 / 已提醒的活动之间）
   2) 报名截止倒计时列表
   3) 关联通知合并（补充通知不覆盖原文）
   ========================================================================== */
(function (global) {
  'use strict';

  var CR = (global.CampusRadar = global.CampusRadar || {});

  /** 活动的有效时间区间；无结束时间时按 30 分钟估。 */
  function spanOf(op) {
    if (!op.startTime) return null;
    var end = op.endTime || op.startTime + 30 * CR.date.MIN;
    return { start: op.startTime, end: end };
  }

  /**
   * 检测给定机会列表中的时间重叠。
   * @returns {Array<{a, b, overlapStart, overlapEnd, day}>}
   */
  function detect(list) {
    var timed = list
      .map(function (op) { return { op: op, span: spanOf(op) }; })
      .filter(function (x) { return !!x.span; })
      .sort(function (x, y) { return x.span.start - y.span.start; });

    var out = [];
    var seen = {};
    for (var i = 0; i < timed.length; i++) {
      for (var j = i + 1; j < timed.length; j++) {
        var A = timed[i], B = timed[j];
        // 已按开始时间排序：若 B 的开始 >= A 的结束，则后续都不会重叠
        if (B.span.start >= A.span.end) break;
        if (!CR.date.overlaps(A.span.start, A.span.end, B.span.start, B.span.end)) continue;
        var key = [A.op.id, B.op.id].sort().join('|');
        if (seen[key]) continue;
        seen[key] = 1;
        out.push({
          a: A.op,
          b: B.op,
          overlapStart: Math.max(A.span.start, B.span.start),
          overlapEnd: Math.min(A.span.end, B.span.end),
          day: new Date(A.span.start).setHours(0, 0, 0, 0)
        });
      }
    }
    return out;
  }

  /** 按天分组冲突，便于日历里集中展示 */
  function groupByDay(pairs) {
    var map = {};
    pairs.forEach(function (p) {
      var k = String(p.day);
      if (!map[k]) map[k] = { day: p.day, items: [], ops: {} };
      map[k].items.push(p);
      map[k].ops[p.a.id] = p.a;
      map[k].ops[p.b.id] = p.b;
    });
    return Object.keys(map).sort(function (x, y) { return Number(x) - Number(y); })
      .map(function (k) {
        var g = map[k];
        g.list = Object.keys(g.ops).map(function (id) { return g.ops[id]; })
          .sort(function (a, b) { return a.startTime - b.startTime; });
        return g;
      });
  }

  /** 冲突分组的中文摘要，例如 “9月21日 19:00 有 3 个活动重叠” */
  function describeGroup(g) {
    var names = g.list.map(function (op) {
      return CR.date.fmtTime(op.startTime) + ' ' + op.title;
    });
    return {
      title: CR.date.fmtDate(g.day) + ' 有 ' + g.list.length + ' 个活动时间重叠',
      lines: names
    };
  }

  /**
   * 截止雷达：所有带 deadline 的机会，按截止时间升序。
   * @param {Array} list
   * @param {object} opts { includePassed:boolean, withinDays:number }
   */
  function deadlineRadar(list, opts) {
    opts = opts || {};
    var now = opts.now || Date.now();
    var rows = list.filter(function (op) { return !!op.deadline; })
      .map(function (op) {
        return {
          op: op,
          at: op.deadline,
          left: op.deadline - now,
          passed: op.deadline - now <= 0
        };
      })
      .sort(function (a, b) { return a.at - b.at; });

    if (!opts.includePassed) rows = rows.filter(function (r) { return !r.passed; });
    if (opts.withinDays) {
      var limit = opts.withinDays * CR.date.DAY;
      rows = rows.filter(function (r) { return r.left <= limit; });
    }
    return rows;
  }

  /**
   * 合并关联通知：补充通知单独列出，原文保持不变。
   * @returns {{supplements:Array, original:object|null}}
   */
  function relations(op, all) {
    if (!op) return { supplements: [], original: null };
    var supplements = all.filter(function (x) {
      return x.sourceType === 'supplement' && (x.relatedIds || []).indexOf(op.id) >= 0;
    });
    var original = null;
    if (op.sourceType === 'supplement' && op.relatedIds && op.relatedIds.length) {
      original = all.filter(function (x) { return x.id === op.relatedIds[0]; })[0] || null;
    }
    return { supplements: supplements, original: original };
  }

  /**
   * 状态判定：完全依据数据与实际时间，缺失信息不臆测。
   * 返回 trust.STATUS 的键。
   */
  function statusOf(op, now) {
    var t = now || Date.now();
    if (op.riskLevel === 'high') return 'risk';
    if (op.riskLevel === 'suspect') return 'suspect';
    if (op.statusHint) return op.statusHint; // 例如 longterm（长期开放）
    if (op.deadline && op.deadline - t > 0 && op.deadline - t <= 2 * CR.date.DAY) return 'closing';
    if (op.startTime && CR.date.isSameDay(op.startTime, t)) {
      if (op.endTime && op.endTime < t) return 'ended';
      return 'today';
    }
    if (op.startTime && t > op.startTime && (!op.endTime || t > op.endTime)) {
      // 已结束，但可能有回放
      if (op.replayAt) return 'replay';
      return 'ended';
    }
    if (op.needSignup && op.deadline && op.deadline - t > 0) return 'open';
    if (op.needSignup === false && op.startTime && op.startTime - t > 0) return 'upcoming';
    if (op.deadline && op.deadline - t > 0) return 'open';
    if (op.startTime && op.startTime - t > 0) return 'upcoming';
    if (op.trustLevel === 'pending') return 'pending';
    if (op.startTime && t > op.startTime) return op.replayAt ? 'replay' : 'ended';
    return 'pending';
  }

  /** 状态筛选 chips（发现页用） */
  var STATUS_FILTERS = [
    { key: 'today', label: '今日' },
    { key: 'closing', label: '即将截止' },
    { key: 'open', label: '报名中' },
    { key: 'ended', label: '已结束' },
    { key: 'longterm', label: '长期' },
    { key: 'pending', label: '待确认' },
    { key: 'risk', label: '风险' }
  ];

  /** 判断机会是否命中某个状态筛选 */
  function matchStatusFilter(op, key, now) {
    var s = op.status || statusOf(op, now);
    if (key === 'today') return s === 'today';
    if (key === 'closing') return s === 'closing';
    if (key === 'open') return s === 'open' || s === 'upcoming';
    if (key === 'ended') return s === 'ended' || s === 'replay';
    if (key === 'longterm') return s === 'longterm';
    if (key === 'pending') return s === 'pending' || op.trustLevel === 'pending' ||
      (op.missingFields && op.missingFields.length > 0);
    if (key === 'risk') return op.riskLevel === 'high' || op.riskLevel === 'suspect';
    return true;
  }

  CR.conflict = {
    spanOf: spanOf,
    detect: detect,
    groupByDay: groupByDay,
    describeGroup: describeGroup,
    deadlineRadar: deadlineRadar,
    relations: relations,
    statusOf: statusOf,
    STATUS_FILTERS: STATUS_FILTERS,
    matchStatusFilter: matchStatusFilter
  };
})(window);
