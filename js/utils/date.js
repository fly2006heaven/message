/* ==========================================================================
   js/utils/date.js — 时间与倒计时工具
   种子数据中的时间均按本机时区（东八区校园时间）构造。
   ========================================================================== */
(function (global) {
  'use strict';

  var CR = (global.CampusRadar = global.CampusRadar || {});

  var WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  var MIN = 60000;
  var HOUR = 3600000;
  var DAY = 86400000;

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /** 构造本地时间：d(2026,9,19,19,0) */
  function d(y, m, day, hh, mm) {
    return new Date(y, (m || 1) - 1, day || 1, hh || 0, mm || 0, 0, 0).getTime();
  }

  /** 结果：今天/明天/昨天/明天之后按 M月D日 */
  function dayLabel(ts) {
    var gap = startOfDay(ts) - startOfDay(Date.now());
    var n = Math.round(gap / DAY);
    if (n === 0) return '今天';
    if (n === 1) return '明天';
    if (n === 2) return '后天';
    if (n === -1) return '昨天';
    return fmtDate(ts);
  }

  /** 9月19日 */
  function fmtDate(ts) {
    var x = new Date(ts);
    return (x.getMonth() + 1) + '月' + x.getDate() + '日';
  }

  /** 2026年9月19日 */
  function fmtFullDate(ts) {
    var x = new Date(ts);
    return x.getFullYear() + '年' + (x.getMonth() + 1) + '月' + x.getDate() + '日';
  }

  /** 19:30 */
  function fmtTime(ts) {
    var x = new Date(ts);
    return pad(x.getHours()) + ':' + pad(x.getMinutes());
  }

  /** 9月19日 19:30 */
  function fmtDateShort(ts) { return fmtDate(ts) + ' ' + fmtTime(ts); }

  /** 9月19日 周六 */
  function fmtDateWeek(ts) {
    return fmtDate(ts) + ' ' + WEEK[new Date(ts).getDay()];
  }

  function weekday(ts) { return WEEK[new Date(ts).getDay()]; }

  /**
   * 时间区间展示：
   *  同日 → 9月19日 15:00—16:30
   *  跨日 → 9月27日 08:30 — 9月28日 17:00
   */
  function fmtRange(start, end) {
    if (!start) return '未注明';
    if (!end) return fmtDateShort(start);
    var a = new Date(start), b = new Date(end);
    var sameDay = a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    if (sameDay) return fmtDate(start) + ' ' + fmtTime(start) + '—' + fmtTime(end);
    return fmtDateShort(start) + ' — ' + fmtDateShort(end);
  }

  function startOfDay(ts) {
    var x = new Date(ts);
    x.setHours(0, 0, 0, 0);
    return x.getTime();
  }

  function endOfDay(ts) { return startOfDay(ts) + DAY - 1; }

  function startOfMonth(ts) {
    var x = new Date(ts);
    return new Date(x.getFullYear(), x.getMonth(), 1).getTime();
  }

  function addDays(ts, n) {
    var x = new Date(ts);
    x.setDate(x.getDate() + n);
    return x.getTime();
  }

  function addMonths(ts, n) {
    var x = new Date(ts);
    x.setDate(1);
    x.setMonth(x.getMonth() + n);
    return x.getTime();
  }

  function isSameDay(a, b) { return startOfDay(a) === startOfDay(b); }

  /** 判断 ts 是否落在 [start, end] 内（end 缺省表示单点或当天） */
  function inRange(ts, start, end) {
    if (!start) return false;
    var e = end || start;
    return ts >= start && ts <= e;
  }

  /** 两个时间段是否重叠 */
  function overlaps(s1, e1, s2, e2) {
    if (s1 == null || s2 == null) return false;
    var a1 = s1, a2 = e1 == null ? s1 + 30 * MIN : e1;
    var b1 = s2, b2 = e2 == null ? s2 + 30 * MIN : e2;
    return a1 < b2 && b1 < a2;
  }

  /** 自然语言时长：3天5小时 / 5小时20分 / 已结束 */
  function humanize(ms) {
    if (ms <= 0) return '已结束';
    var totalMin = Math.floor(ms / MIN);
    var days = Math.floor(totalMin / 1440);
    var hours = Math.floor((totalMin % 1440) / 60);
    var mins = totalMin % 60;
    if (days > 0) return days + '天' + (hours > 0 ? hours + '小时' : '');
    if (hours > 0) return hours + '小时' + (mins > 0 ? mins + '分' : '');
    return mins + '分';
  }

  /** 倒计时 D/H/M/S 结构 */
  function breakdown(ms) {
    var t = Math.max(0, Math.floor(ms / 1000));
    return {
      d: Math.floor(t / 86400),
      h: Math.floor((t % 86400) / 3600),
      m: Math.floor((t % 3600) / 60),
      s: t % 60
    };
  }

  /** 紧凑倒计时：2天3小时 / 05:12:33 */
  function countdownText(ms) {
    if (ms <= 0) return '已截止';
    var b = breakdown(ms);
    if (b.d >= 1) return b.d + '天' + b.h + '小时';
    return pad(b.h) + ':' + pad(b.m) + ':' + pad(b.s);
  }

  /** 中文长倒计时：2 天 3 小时 5 分 12 秒 */
  function countdownLong(ms) {
    if (ms <= 0) return '已结束';
    var b = breakdown(ms);
    if (b.d >= 1) return b.d + ' 天 ' + b.h + ' 小时 ' + b.m + ' 分';
    return b.h + ' 小时 ' + b.m + ' 分 ' + b.s + ' 秒';
  }

  /** 距离文案：还有 3 天 / 已过 2 小时 */
  function untilText(ms) {
    if (ms <= 0) return '已过 ' + humanize(-ms);
    return '还有 ' + humanize(ms);
  }

  /** input[type=datetime-local] 值 ↔ 时间戳 */
  function toLocalInput(ts) {
    if (!ts) return '';
    var x = new Date(ts);
    return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate()) +
      'T' + pad(x.getHours()) + ':' + pad(x.getMinutes());
  }

  function fromLocalInput(v) {
    if (!v) return null;
    var t = new Date(v).getTime();
    return isNaN(t) ? null : t;
  }

  /** 把日期列表按月分组，用于日历 */
  function monthMatrix(monthTs) {
    var first = startOfMonth(monthTs);
    var firstDow = new Date(first).getDay(); // 0=周日
    var gridStart = addDays(first, -firstDow);
    var cells = [];
    for (var i = 0; i < 42; i++) {
      var ts = addDays(gridStart, i);
      cells.push({ ts: ts, inMonth: new Date(ts).getMonth() === new Date(first).getMonth() });
    }
    return cells;
  }

  CR.date = {
    WEEK: WEEK,
    MIN: MIN,
    HOUR: HOUR,
    DAY: DAY,
    d: d,
    pad: pad,
    dayLabel: dayLabel,
    fmtDate: fmtDate,
    fmtFullDate: fmtFullDate,
    fmtTime: fmtTime,
    fmtDateShort: fmtDateShort,
    fmtDateWeek: fmtDateWeek,
    weekday: weekday,
    fmtRange: fmtRange,
    startOfDay: startOfDay,
    endOfDay: endOfDay,
    startOfMonth: startOfMonth,
    addDays: addDays,
    addMonths: addMonths,
    isSameDay: isSameDay,
    inRange: inRange,
    overlaps: overlaps,
    humanize: humanize,
    breakdown: breakdown,
    countdownText: countdownText,
    countdownLong: countdownLong,
    untilText: untilText,
    toLocalInput: toLocalInput,
    fromLocalInput: fromLocalInput,
    monthMatrix: monthMatrix
  };
})(window);
