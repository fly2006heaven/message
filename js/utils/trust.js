/* ==========================================================================
   js/utils/trust.js — 来源 / 可信度 / 风险 / 新生友好度
   规则完全基于“题目已提供的信息”，不编造任何缺失数据。
   ========================================================================== */
(function (global) {
  'use strict';

  var CR = (global.CampusRadar = global.CampusRadar || {});

  /* 来源类型 → 展示信息 */
  var SOURCE = {
    school:     { label: '学校/校内', badge: 'badge--school',     color: '#2563EB' },
    college:    { label: '学院',      badge: 'badge--college',    color: '#4F46E5' },
    project:    { label: '项目组',    badge: 'badge--project',    color: '#10B981' },
    contest:    { label: '竞赛',      badge: 'badge--contest',    color: '#F97316' },
    student:    { label: '学生自发',  badge: 'badge--student',    color: '#8B5CF6' },
    material:   { label: '资料',      badge: 'badge--material',   color: '#0D9488' },
    supplement: { label: '补充通知',  badge: 'badge--supplement', color: '#DB2777' },
    local:      { label: '本机发布',  badge: 'badge--pending',    color: '#F59E0B' }
  };

  /* 可信度等级 → 展示信息 */
  var TRUST = {
    official:  { label: '官方来源',     tone: 'ok',   desc: '来自学校或学院发布的信息。' },
    verified:  { label: '校内组织',     tone: 'ok',   desc: '来自校内项目组、竞赛或学习小组。' },
    informal:  { label: '学生自发',     tone: 'warn', desc: '由学生个人发起，信息完整度取决于发起人。' },
    pending:   { label: '待确认',       tone: 'warn', desc: '关键信息未注明，请以主办方通知为准。' },
    risk:      { label: '高风险',       tone: 'bad',  desc: '信息可疑，存在财产或隐私风险。' },
    suspect:   { label: '疑似推广',     tone: 'warn', desc: '内容与标题不符，疑似商家推广。' },
    supplement:{ label: '补充通知',     tone: 'info', desc: '对已有信息的补充，不覆盖原始信息。' }
  };

  /* 状态 → 展示信息（带图标语义，避免只靠颜色区分） */
  var STATUS = {
    'today':    { label: '今日',      badge: 'badge--today',    icon: 'clock' },
    'closing':  { label: '即将截止',  badge: 'badge--closing',  icon: 'alert' },
    'open':     { label: '报名中',    badge: 'badge--open',     icon: 'check' },
    'upcoming': { label: '即将开始',  badge: 'badge--upcoming', icon: 'clock' },
    'ended':    { label: '已结束',    badge: 'badge--ended',    icon: 'moon' },
    'replay':   { label: '已结束·可回放', badge: 'badge--replay', icon: 'play' },
    'longterm': { label: '长期开放',  badge: 'badge--longterm', icon: 'infinity' },
    'pending':  { label: '待确认',    badge: 'badge--pending',  icon: 'question' },
    'risk':     { label: '风险提示',  badge: 'badge--risk',     icon: 'shield' },
    'suspect':  { label: '疑似推广',  badge: 'badge--pending',  icon: 'alert' }
  };

  /* 缺失信息的统一文案 */
  var MISSING = '未注明，请以主办方通知为准';

  function sourceOf(type) { return SOURCE[type] || SOURCE.school; }
  function trustOf(level) { return TRUST[level] || TRUST.official; }
  function statusOf(key) { return STATUS[key] || STATUS.upcoming; }

  /** 来源徽章 className */
  function sourceClass(type) { return sourceOf(type).badge; }
  function sourceLabel(type) { return sourceOf(type).label; }

  /**
   * 风险级别：由数据结构中的 riskLevel 决定，不做额外推断。
   * high  → 24 号（要求加私人微信、无主办方/地点）
   * suspect → 25 号（标题技术交流、正文商家优惠与购买链接）
   */
  function riskOf(op) {
    if (!op || !op.riskLevel || op.riskLevel === 'none') return null;
    if (op.riskLevel === 'high') {
      return {
        level: 'high',
        tone: 'danger',
        title: '高风险信息',
        text: '本条要求添加私人微信获取详情，且未提供主办方、地点与完整内容。不建议添加私人微信、转账或提供身份证、银行卡等个人信息。'
      };
    }
    return {
      level: 'suspect',
      tone: 'warn',
      title: '疑似推广',
      text: '标题为技术交流，但正文主要介绍某商家优惠及购买链接，且未注明活动时间与地点。已降低推荐权重，请谨慎判断。'
    };
  }

  /** 是否为“待确认”（关键信息缺失） */
  function pendingItems(op) {
    var miss = [];
    if (!op.location) miss.push('地点');
    if (!op.startTime) miss.push('活动时间');
    if (!op.deadline && op.needSignup) miss.push('报名截止');
    if (!op.signupMethod && op.needSignup) miss.push('报名方式');
    if (!op.fee) miss.push('费用');
    if (!op.audience) miss.push('适用对象');
    return miss;
  }

  /** 新建本机发布时计算缺失项 */
  function missingOfLocal(post) {
    var miss = [];
    if (!post.location || !String(post.location).trim()) miss.push('地点');
    if (!post.startTime) miss.push('活动时间');
    if (!post.signupMethod || !String(post.signupMethod).trim()) miss.push('报名方式');
    if (!post.fee || !String(post.fee).trim()) miss.push('费用说明');
    if (!post.audience || !String(post.audience).trim()) miss.push('适用对象');
    if (post.people && !String(post.people).trim()) miss.push('人数');
    return miss;
  }

  /* ------------------------------------------------------------------
     新生护航模式：推荐理由全部来自数据中已提供的事实
     ------------------------------------------------------------------ */
  var AUDIENCE_LEVELS = {
    'freshman': '大一',
    'sophomore': '大二',
    'junior': '大三及以上',
    'senior': '大三及以上',
    'undergrad': '本科生',
    'all': '全校'
  };

  /**
   * 生成推荐理由字符串数组。
   * @param {object} op 机会对象
   * @param {object} profile 新生档案
   */
  function reasons(op, profile) {
    var out = [];
    var now = Date.now();
    var p = profile || {};

    if (op.beginnerFriendly) out.push('零基础可参加');
    if (op.audience === 'all') out.push('面向全校');
    if (op.needSignup === false && op.trustLevel !== 'pending') out.push('无需报名');
    if (op.capacityLimited) out.push('名额有限，先到先得');
    if (op.needReview) out.push('需预约，提交报名表不代表最终录取');

    // 今天的时间点信息
    if (op.startTime && new Date(op.startTime).getTime() > now) {
      var same = CR.date.isSameDay(op.startTime, now);
      if (same) out.push('今天 ' + CR.date.fmtTime(op.startTime));
      else if (op.startTime - now < 2 * CR.date.DAY) {
        out.push(CR.date.dayLabel(op.startTime) + ' ' + CR.date.fmtTime(op.startTime));
      }
    }

    // 截止临近
    if (op.deadline && op.deadline > now) {
      var left = op.deadline - now;
      if (left <= CR.date.DAY) out.push('截止临近：' + CR.date.countdownText(left));
      else if (left <= 3 * CR.date.DAY) out.push(CR.date.untilText(left) + '截止');
    }

    // 与用户档案匹配
    if (p.foundation === 'none' && op.beginnerFriendly) out.push('适合零基础起步');
    if (p.grade && op.audience === p.grade) out.push('正好面向' + AUDIENCE_LEVELS[p.grade]);
    if (p.hoursPerWeek && op.weeklyHours && op.weeklyHours <= Number(p.hoursPerWeek)) {
      out.push('每周约 ' + op.weeklyHours + ' 小时，符合你的时间预算');
    }
    if (p.interests && p.interests.length) {
      op.tags.forEach(function (t) {
        if (p.interests.indexOf(t) >= 0) out.push('匹配兴趣：' + t);
      });
    }

    if (op.trustLevel === 'official' || op.trustLevel === 'verified') out.push('校方/校内组织来源');

    // 去重并限制条数
    var seen = {};
    return out.filter(function (r) {
      if (seen[r]) return false;
      seen[r] = 1;
      return true;
    }).slice(0, 4);
  }

  /**
   * 新生友好度评分 0—100：纯规则，只看已有数据。
   */
  function freshmanScore(op) {
    var s = 46;
    if (op.beginnerFriendly) s += 14;
    if (op.needSignup === false) s += 8;
    if (op.audience === 'all') s += 8;
    if (op.audience === 'freshman') s += 10;
    if (op.trustLevel === 'official') s += 10;
    else if (op.trustLevel === 'verified') s += 6;
    else if (op.trustLevel === 'informal') s -= 4;
    if (op.riskLevel === 'high') s -= 60;
    else if (op.riskLevel === 'suspect') s -= 34;
    if (op.trustLevel === 'pending') s -= 10;
    if (op.needReview) s -= 4;
    if (op.capacityLimited) s -= 2;
    if (op.weeklyHours && op.weeklyHours >= 6) s -= 6; // 投入门槛高对新生不友好
    if (op.weeklyHours && op.weeklyHours <= 4 && op.weeklyHours > 0) s += 4;
    return Math.max(0, Math.min(100, s));
  }

  /**
   * 紧急度评分：截止越近越高；已截止给低分。
   */
  function urgencyScore(op, now) {
    var t = now || Date.now();
    if (op.deadline) {
      var left = op.deadline - t;
      if (left <= 0) return 6;
      if (left <= 6 * CR.date.HOUR) return 100;
      if (left <= CR.date.DAY) return 88;
      if (left <= 2 * CR.date.DAY) return 74;
      if (left <= 4 * CR.date.DAY) return 58;
      if (left <= 8 * CR.date.DAY) return 42;
      return 26;
    }
    if (op.startTime) {
      var s = op.startTime - t;
      if (s > 0 && s <= 6 * CR.date.HOUR) return 78;
      if (s > 0 && s <= CR.date.DAY) return 62;
      if (s > 0 && s <= 3 * CR.date.DAY) return 44;
      if (s <= 0) return 8;
      return 24;
    }
    return 14;
  }

  /** 时间就近度：越近越靠前 */
  function timeScore(op, now) {
    var t = now || Date.now();
    var base = op.startTime || op.deadline || t + 30 * CR.date.DAY;
    if (base < t) return 10;
    var days = (base - t) / CR.date.DAY;
    return Math.max(0, 60 - days * 3);
  }

  /** 默认排序：新生友好度 + 截止紧急度 + 时间，并降低风险/推广权重 */
  function defaultScore(op, now) {
    var t = now || Date.now();
    var score = freshmanScore(op) * 0.42 + urgencyScore(op, t) * 0.38 + timeScore(op, t) * 0.20;
    if (op.trustLevel === 'pending') score -= 6;
    return score;
  }

  CR.trust = {
    SOURCE: SOURCE,
    TRUST: TRUST,
    STATUS: STATUS,
    MISSING: MISSING,
    AUDIENCE_LEVELS: AUDIENCE_LEVELS,
    sourceOf: sourceOf,
    trustOf: trustOf,
    statusOf: statusOf,
    sourceClass: sourceClass,
    sourceLabel: sourceLabel,
    riskOf: riskOf,
    pendingItems: pendingItems,
    missingOfLocal: missingOfLocal,
    reasons: reasons,
    freshmanScore: freshmanScore,
    urgencyScore: urgencyScore,
    timeScore: timeScore,
    defaultScore: defaultScore
  };
})(window);
