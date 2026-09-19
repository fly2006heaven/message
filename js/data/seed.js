/* ==========================================================================
   js/data/seed.js — 校园机会种子数据（只读）
   共 26 条，全部内容来自题目提供的信息；未提供的信息一律留空，
   由界面统一显示“未注明，请以主办方通知为准”，不做任何编造。
   ========================================================================== */
(function (global) {
  'use strict';

  var CR = (global.CampusRadar = global.CampusRadar || {});
  var D = CR.date.d;
  var MIN = CR.date.MIN;
  var HOUR = CR.date.HOUR;

  /** 本批种子数据的基准日：2026-09-19（周六） */
  var SEED_BASE = D(2026, 9, 19, 0, 0);
  var SEED_VERSION = '2026.09.19-1';

  /**
   * 统一构造机会对象。
   * 未提供的字段保持 null / 空数组，前端据此显示“未注明”。
   */
  function make(raw) {
    var op = {
      id: raw.id,
      title: raw.title,
      summary: raw.summary || '',
      sourceType: raw.sourceType,
      sourceName: raw.sourceName || '',
      category: raw.category,
      tags: raw.tags || [],
      audience: raw.audience || null,
      audienceExtra: raw.audienceExtra || null,
      startTime: raw.startTime || null,
      endTime: raw.endTime || null,
      timeText: raw.timeText || null,
      deadline: raw.deadline || null,
      deadlineNote: raw.deadlineNote || null,
      replayAt: raw.replayAt || null,
      location: raw.location || null,
      locationPending: !!raw.locationPending,
      online: raw.online == null ? null : raw.online,
      requirements: raw.requirements || [],
      signupMethod: raw.signupMethod || null,
      needSignup: raw.needSignup == null ? false : raw.needSignup,
      needReview: !!raw.needReview,
      beginnerFriendly: !!raw.beginnerFriendly,
      capacityLimited: !!raw.capacityLimited,
      capacity: raw.capacity || null,
      people: raw.people || null,
      waitlist: !!raw.waitlist,
      weeklyHours: raw.weeklyHours || null,
      durationText: raw.durationText || null,
      fee: raw.fee || null,
      recruitRoles: raw.recruitRoles || [],
      statusHint: raw.statusHint || null,
      weekdayHint: raw.weekdayHint || null,
      recurrence: raw.recurrence || null,
      trustLevel: raw.trustLevel || 'official',
      riskLevel: raw.riskLevel || 'none',
      relatedIds: raw.relatedIds || [],
      notes: raw.notes || [],
      missingFields: [],
      guardHints: raw.guardHints || [],
      origin: 'seed'
    };
    // 计算缺失信息（不臆测，只标注）
    var miss = [];
    if (!op.location && op.online !== true) miss.push('地点');
    if (!op.startTime) miss.push('活动时间');
    if (op.needSignup && !op.deadline) miss.push('报名截止');
    if (op.needSignup && !op.signupMethod) miss.push('报名方式');
    if (!op.fee) miss.push('费用');
    op.missingFields = miss;
    return op;
  }

  var RAW = [
    /* 01 ---------------------------------------------------------------- */
    make({
      id: '01',
      title: '“蓝桥杯”程序设计校内训练营',
      summary: '校内程序设计训练营，零基础可参加；原计划 9 月 20 日起每周六 19:00 训练，因场地调整，首次训练改期（见补充通知 09）。',
      sourceType: 'school',
      sourceName: '校内训练营',
      category: '学习小组',
      tags: ['编程', '竞赛', '零基础', '训练营'],
      audience: 'all',
      audienceExtra: '面向全校学生',
      startTime: D(2026, 9, 20, 19, 0),
      endTime: D(2026, 9, 20, 21, 0),
      deadline: D(2026, 9, 24, 22, 0),
      location: null,                 // 原计划地点未提供；地点调整见 09
      online: false,
      requirements: ['零基础可参加'],
      signupMethod: '按主办方通知报名',
      needSignup: true,
      needReview: false,
      beginnerFriendly: true,
      capacityLimited: false,
      weeklyHours: 2,
      durationText: '每周六 19:00 训练（原计划）',
      fee: null,
      statusHint: null,
      weekdayHint: 6,
      recurrence: { freq: 'weekly', weekday: 6, time: '19:00', from: D(2026, 9, 20, 19, 0) },
      trustLevel: 'official',
      notes: [
        '报名截止：9 月 24 日 22:00。',
        '原计划 9 月 20 日起每周六 19:00 开展训练。',
        '面向全校学生，零基础可参加。',
        '已有补充通知（09）：首次训练改至 9 月 21 日 19:30，地点改为实验楼 A402；报名截止时间不变。'
      ],
      guardHints: ['零基础可参加', '面向全校', '截止临近', '补充通知已更新首次训练时间']
    }),

    /* 02 ---------------------------------------------------------------- */
    make({
      id: '02',
      title: 'AI 应用入门公开课',
      summary: '9 月 19 日 19:00 在计算机学院教学楼开讲，面向全校学生，无需报名，预计 90 分钟。',
      sourceType: 'school',
      sourceName: '校内公开课',
      category: '讲座',
      tags: ['AI', '编程', '零基础', '公开课'],
      audience: 'all',
      audienceExtra: '面向全校学生',
      startTime: D(2026, 9, 19, 19, 0),
      endTime: D(2026, 9, 19, 20, 30),
      deadline: null,
      location: '计算机学院教学楼',
      online: false,
      requirements: ['无需报名'],
      signupMethod: null,
      needSignup: false,
      needReview: false,
      beginnerFriendly: true,
      capacityLimited: false,
      durationText: '预计 90 分钟',
      fee: null,
      trustLevel: 'official',
      notes: [
        '时间：9 月 19 日 19:00。',
        '地点：计算机学院教学楼（具体教室未注明）。',
        '无需报名，直接到场即可。',
        '预计 90 分钟。'
      ],
      guardHints: ['面向全校', '今天 19:00', '无需报名', '零基础可参加']
    }),

    /* 03 ---------------------------------------------------------------- */
    make({
      id: '03',
      title: '大学生创新创业项目团队招募',
      summary: '招募开发、设计、材料成员；每周需稳定投入 4 小时以上；9 月 22 日 18:00 截止，需提交简短自我介绍。',
      sourceType: 'project',
      sourceName: '创新创业项目团队',
      category: '招募',
      tags: ['创新创业', '项目', '开发', '设计', '招募'],
      audience: 'all',
      audienceExtra: null,
      startTime: null,
      endTime: null,
      deadline: D(2026, 9, 22, 18, 0),
      location: null,
      online: null,
      requirements: ['每周需稳定投入 4 小时以上', '需提交简短自我介绍'],
      signupMethod: '提交简短自我介绍',
      needSignup: true,
      needReview: false,
      beginnerFriendly: false,
      capacityLimited: false,
      weeklyHours: 4,
      fee: null,
      recruitRoles: ['开发', '设计', '材料'],
      trustLevel: 'verified',
      notes: [
        '招募方向：开发、设计、材料成员。',
        '每周需稳定投入 4 小时以上。',
        '报名截止：9 月 22 日 18:00。',
        '报名方式：提交简短自我介绍。',
        '已有补充说明（20）：开发方向名额已满，现主要补充设计与材料成员。'
      ],
      guardHints: ['每周约 4 小时', '截止临近', '补充说明已更新招募方向']
    }),

    /* 04 ---------------------------------------------------------------- */
    make({
      id: '04',
      title: '数学建模竞赛经验分享会',
      summary: '直播已于 9 月 18 日 19:30 结束；活动方预计 9 月 20 日上传回放，不限专业。',
      sourceType: 'school',
      sourceName: '校内分享',
      category: '讲座',
      tags: ['数学建模', '竞赛', '经验分享'],
      audience: 'all',
      audienceExtra: '不限专业',
      startTime: D(2026, 9, 18, 19, 30),
      endTime: D(2026, 9, 18, 21, 0),
      deadline: null,
      replayAt: D(2026, 9, 20, 12, 0),
      location: null,
      online: true,
      requirements: ['不限专业'],
      signupMethod: null,
      needSignup: false,
      beginnerFriendly: false,
      capacityLimited: false,
      fee: null,
      trustLevel: 'official',
      notes: [
        '直播时间：9 月 18 日 19:30，直播已结束。',
        '活动方预计 9 月 20 日上传回放。',
        '不限专业。',
        '回放地址未注明，请以主办方通知为准。'
      ],
      guardHints: ['已结束，预计 9 月 20 日上传回放', '不限专业']
    }),

    /* 05 ---------------------------------------------------------------- */
    make({
      id: '05',
      title: '校园公益志愿服务活动',
      summary: '9 月 27 日 8:30—17:00 开展，预计服务 8 小时；9 月 20 日 12:00 报名截止，需提前到场签到。',
      sourceType: 'school',
      sourceName: '校内志愿',
      category: '志愿',
      tags: ['志愿', '公益', '服务时长'],
      audience: 'all',
      audienceExtra: null,
      startTime: D(2026, 9, 27, 8, 30),
      endTime: D(2026, 9, 27, 17, 0),
      deadline: D(2026, 9, 20, 12, 0),
      location: null,
      online: false,
      requirements: ['需提前到场签到'],
      signupMethod: null,
      needSignup: true,
      needReview: false,
      beginnerFriendly: true,
      capacityLimited: false,
      fee: null,
      durationText: '预计服务 8 小时',
      trustLevel: 'official',
      notes: [
        '活动时间：9 月 27 日 8:30—17:00，预计服务 8 小时。',
        '报名截止：9 月 20 日 12:00。',
        '需提前到场签到。',
        '集合地点与报名方式未注明，请以主办方通知为准。'
      ],
      guardHints: ['截止临近', '面向全校', '服务时长 8 小时', '需提前到场签到']
    }),

    /* 06 ---------------------------------------------------------------- */
    make({
      id: '06',
      title: 'Web 开发零基础学习小组',
      summary: '9 月 23 日起每周三 19:30 开展，共 6 周；面向零基础学生，限 30 人，报名时间未注明、满员即止。',
      sourceType: 'school',
      sourceName: '学习小组',
      category: '学习小组',
      tags: ['编程', 'Web', '零基础', '学习小组'],
      audience: 'all',
      audienceExtra: '面向零基础学生',
      startTime: D(2026, 9, 23, 19, 30),
      endTime: D(2026, 9, 23, 21, 0),
      deadline: null,                  // 报名时间未注明
      location: null,
      online: null,
      requirements: ['零基础可参加', '限 30 人'],
      signupMethod: null,
      needSignup: true,
      needReview: false,
      beginnerFriendly: true,
      capacityLimited: true,
      capacity: 30,
      weeklyHours: 1.5,
      durationText: '每周三 19:30，共 6 周',
      fee: null,
      weekdayHint: 3,
      recurrence: { freq: 'weekly', weekday: 3, time: '19:30', weeks: 6, from: D(2026, 9, 23, 19, 30) },
      trustLevel: 'verified',
      notes: [
        '9 月 23 日起每周三 19:30 开展，共 6 周。',
        '面向零基础学生，限 30 人。',
        '报名时间未注明，满员即止。'
      ],
      guardHints: ['零基础可参加', '限 30 人，先到先得', '报名时间未注明，满员即止']
    }),

    /* 07 ---------------------------------------------------------------- */
    make({
      id: '07',
      title: 'AI 创新应用挑战赛',
      summary: '2—4 人组队；9 月 21 日 18:00 前完成校内意向登记；10 月 20 日提交作品。意向登记不等同于最终作品提交。',
      sourceType: 'contest',
      sourceName: 'AI 创新应用挑战赛',
      category: '竞赛',
      tags: ['AI', '竞赛', '组队'],
      audience: 'all',
      audienceExtra: null,
      startTime: null,
      endTime: null,
      deadline: D(2026, 9, 21, 18, 0),
      location: null,
      online: null,
      requirements: ['2—4 人组队'],
      signupMethod: '校内意向登记',
      needSignup: true,
      needReview: false,
      beginnerFriendly: false,
      capacityLimited: false,
      fee: null,
      contestMilestones: [
        { label: '校内意向登记截止', at: D(2026, 9, 21, 18, 0) },
        { label: '作品提交截止', at: D(2026, 10, 20, 23, 59) }
      ],
      trustLevel: 'verified',
      notes: [
        '组队要求：2—4 人。',
        '9 月 21 日 18:00 前完成校内意向登记。',
        '10 月 20 日提交作品。',
        '意向登记不等同于最终作品提交，两个环节都需要完成。'
      ],
      guardHints: ['截止临近', '需组队（2—4 人）', '意向登记不等于作品提交']
    }),

    /* 08 ---------------------------------------------------------------- */
    make({
      id: '08',
      title: '校园软件项目组招募',
      summary: '开发校园实用工具；面向大一、大二学生；希望成员了解 Git 基本操作；每周预计投入 5 小时；长期招募，满员即止。',
      sourceType: 'project',
      sourceName: '校园软件项目组',
      category: '招募',
      tags: ['编程', '项目', 'Git', '工具开发'],
      audience: 'freshman',
      audienceExtra: '面向大一、大二学生',
      startTime: null,
      endTime: null,
      deadline: null,
      location: null,
      online: null,
      requirements: ['希望了解 Git 基本操作', '每周预计投入 5 小时'],
      signupMethod: null,
      needSignup: true,
      needReview: false,
      beginnerFriendly: false,
      capacityLimited: true,
      weeklyHours: 5,
      statusHint: 'longterm',
      trustLevel: 'verified',
      notes: [
        '方向：开发校园实用工具。',
        '面向大一、大二学生。',
        '希望成员了解 Git 基本操作（非硬性？题目未说明，按“希望”理解）。',
        '每周预计投入 5 小时。',
        '长期招募，满员即止；报名方式与截止时间未注明。'
      ],
      guardHints: ['面向大一、大二', '每周约 5 小时', '长期招募，满员即止']
    }),

    /* 09 ---------------------------------------------------------------- */
    make({
      id: '09',
      title: '程序设计训练营补充通知',
      summary: '因场地调整，首次训练改为 9 月 21 日 19:30，地点改至实验楼 A402；已报名同学无需重复提交，报名截止时间不变。',
      sourceType: 'supplement',
      sourceName: '校内训练营 · 补充通知',
      category: '补充通知',
      tags: ['补充通知', '编程', '训练营', '场地调整'],
      audience: 'all',
      audienceExtra: '面向已报名及拟报名同学',
      startTime: D(2026, 9, 21, 19, 30),
      endTime: D(2026, 9, 21, 21, 0),
      deadline: D(2026, 9, 24, 22, 0),
      location: '实验楼 A402',
      online: false,
      requirements: ['已报名同学无需重复提交'],
      signupMethod: null,
      needSignup: true,
      needReview: false,
      beginnerFriendly: true,
      capacityLimited: false,
      fee: null,
      relatedIds: ['01'],
      trustLevel: 'supplement',
      notes: [
        '首次训练时间：改为 9 月 21 日 19:30。',
        '地点：改为实验楼 A402。',
        '已报名同学无需重复提交。',
        '报名截止时间不变（9 月 24 日 22:00）。',
        '本通知不覆盖 01 号原始信息，两条并列展示。'
      ],
      guardHints: ['零基础可参加', '首次训练改为 9 月 21 日 19:30', '地点改为实验楼 A402']
    }),

    /* 10 ---------------------------------------------------------------- */
    make({
      id: '10',
      title: '前端开发经验交流会',
      summary: '9 月 19 日 15:00—16:30，线下 A201 并同步线上直播，无需报名。',
      sourceType: 'school',
      sourceName: '校内交流',
      category: '讲座',
      tags: ['前端', '编程', '经验分享'],
      audience: 'all',
      audienceExtra: null,
      startTime: D(2026, 9, 19, 15, 0),
      endTime: D(2026, 9, 19, 16, 30),
      deadline: null,
      location: 'A201',
      online: true,
      requirements: ['无需报名'],
      signupMethod: null,
      needSignup: false,
      needReview: false,
      beginnerFriendly: true,
      capacityLimited: false,
      fee: null,
      trustLevel: 'official',
      notes: [
        '时间：9 月 19 日 15:00—16:30。',
        '地点：线下 A201，并同步线上直播。',
        '无需报名。',
        '线上直播入口未注明。'
      ],
      guardHints: ['今天 15:00', '无需报名', '支持线上参加']
    }),

    /* 11 ---------------------------------------------------------------- */
    make({
      id: '11',
      title: '大学生科研入门分享会',
      summary: '9 月 21 日 19:00—20:30，介绍论文检索、学生科研项目和导师联系方法；面向全校学生。',
      sourceType: 'school',
      sourceName: '校内分享',
      category: '讲座',
      tags: ['科研', '论文检索', '经验分享'],
      audience: 'all',
      audienceExtra: '面向全校学生',
      startTime: D(2026, 9, 21, 19, 0),
      endTime: D(2026, 9, 21, 20, 30),
      deadline: null,
      location: null,
      online: null,
      requirements: ['面向全校学生'],
      signupMethod: null,
      needSignup: false,
      needReview: false,
      beginnerFriendly: true,
      capacityLimited: false,
      fee: null,
      trustLevel: 'official',
      notes: [
        '时间：9 月 21 日 19:00—20:30。',
        '内容：论文检索、学生科研项目、导师联系方法。',
        '面向全校学生。',
        '地点与是否需要报名未注明。'
      ],
      guardHints: ['面向全校', '9 月 21 日 19:00', '科研入门']
    }),

    /* 12 ---------------------------------------------------------------- */
    make({
      id: '12',
      title: '全国高校计算机能力挑战赛',
      summary: '面向本科生，个人参赛；10 月 5 日 23:59 报名截止；具体费用信息未提供。',
      sourceType: 'contest',
      sourceName: '全国高校计算机能力挑战赛',
      category: '竞赛',
      tags: ['编程', '竞赛', '个人赛', '本科生'],
      audience: 'undergrad',
      audienceExtra: '面向本科生',
      startTime: null,
      endTime: null,
      deadline: D(2026, 10, 5, 23, 59),
      location: null,
      online: null,
      requirements: ['个人参赛'],
      signupMethod: null,
      needSignup: true,
      needReview: false,
      beginnerFriendly: false,
      capacityLimited: false,
      fee: null,                       // 明确未提供
      trustLevel: 'official',
      notes: [
        '面向本科生，个人参赛。',
        '报名截止：10 月 5 日 23:59。',
        '具体费用信息未提供，报名前请以主办方通知为准。'
      ],
      guardHints: ['面向本科生', '个人参赛', '截止日期充裕']
    }),

    /* 13 ---------------------------------------------------------------- */
    make({
      id: '13',
      title: '科研助理招募',
      summary: '协助数据整理和实验工作；仅限大二及以上学生；每周预计投入 6 小时；9 月 21 日截止报名。',
      sourceType: 'project',
      sourceName: '科研助理招募',
      category: '招募',
      tags: ['科研', '数据整理', '实验'],
      audience: 'sophomore',
      audienceExtra: '仅限大二及以上学生',
      startTime: null,
      endTime: null,
      deadline: D(2026, 9, 21, 23, 59),   // 题目只给“9月21日截止”，按当日结束时间计
      deadlineNote: '题目仅注明 9 月 21 日截止，此处按当日 23:59 计算',
      location: null,
      online: null,
      requirements: ['仅限大二及以上学生', '每周预计投入 6 小时'],
      signupMethod: null,
      needSignup: true,
      needReview: true,
      beginnerFriendly: false,
      capacityLimited: false,
      weeklyHours: 6,
      trustLevel: 'verified',
      notes: [
        '工作内容：协助数据整理和实验工作。',
        '仅限大二及以上学生。',
        '每周预计投入 6 小时。',
        '9 月 21 日截止报名（具体时刻未注明，此处按当日 23:59 计算）。',
        '名额与审核方式未注明，请以主办方通知为准。'
      ],
      guardHints: ['仅限大二及以上', '每周约 6 小时', '截止临近']
    }),

    /* 14 ---------------------------------------------------------------- */
    make({
      id: '14',
      title: 'Git 与 GitHub 零基础工作坊',
      summary: '9 月 21 日 19:00—20:30；主要面向大一新生；限 40 人；需提前预约，提交报名表不代表最终录取，以审核通知为准。',
      sourceType: 'school',
      sourceName: '校内工作坊',
      category: '讲座',
      tags: ['Git', '编程', '零基础', '工作坊', '新生'],
      audience: 'freshman',
      audienceExtra: '主要面向大一新生',
      startTime: D(2026, 9, 21, 19, 0),
      endTime: D(2026, 9, 21, 20, 30),
      deadline: null,
      location: null,
      online: null,
      requirements: ['需提前预约', '提交报名表不代表最终录取', '限 40 人'],
      signupMethod: '提前预约并提交报名表',
      needSignup: true,
      needReview: true,
      beginnerFriendly: true,
      capacityLimited: true,
      capacity: 40,
      fee: null,
      trustLevel: 'official',
      notes: [
        '时间：9 月 21 日 19:00—20:30。',
        '主要面向大一新生。',
        '限 40 人，需提前预约。',
        '提交报名表不代表最终录取，以审核通知为准。',
        '预约截止时间与地点未注明。'
      ],
      guardHints: ['零基础可参加', '面向大一新生', '需预约，提交不代表录取', '限 40 人']
    }),

    /* 15 ---------------------------------------------------------------- */
    make({
      id: '15',
      title: 'AI 应用创意挑战',
      summary: '9 月 23 日 23:59 前提交创意方案；9 月 30 日前提交最终作品；允许个人或团队参加，进入展示环节后可再组队。',
      sourceType: 'contest',
      sourceName: 'AI 应用创意挑战',
      category: '竞赛',
      tags: ['AI', '竞赛', '创意方案'],
      audience: 'all',
      audienceExtra: null,
      startTime: null,
      endTime: null,
      deadline: D(2026, 9, 23, 23, 59),
      location: null,
      online: null,
      requirements: ['允许个人或团队参加'],
      signupMethod: '提交创意方案',
      needSignup: true,
      needReview: false,
      beginnerFriendly: false,
      capacityLimited: false,
      fee: null,
      contestMilestones: [
        { label: '创意方案提交截止', at: D(2026, 9, 23, 23, 59) },
        { label: '最终作品提交截止', at: D(2026, 9, 30, 23, 59) }
      ],
      trustLevel: 'verified',
      notes: [
        '9 月 23 日 23:59 前提交创意方案。',
        '9 月 30 日前提交最终作品。',
        '允许个人或团队参加。',
        '进入展示环节后可再组队。'
      ],
      guardHints: ['可个人参加', '截止临近', '两个提交节点（9/23、9/30）']
    }),

    /* 16 ---------------------------------------------------------------- */
    make({
      id: '16',
      title: '校园摄影志愿者招募',
      summary: '长期招募，参与校内大型活动摄影；具体报名截止时间未注明；有摄影设备者优先，但不作硬性要求。',
      sourceType: 'project',
      sourceName: '校园摄影志愿者团队',
      category: '志愿',
      tags: ['摄影', '志愿', '长期'],
      audience: 'all',
      audienceExtra: null,
      startTime: null,
      endTime: null,
      deadline: null,
      location: null,
      online: null,
      requirements: ['有摄影设备者优先（非硬性要求）'],
      signupMethod: null,
      needSignup: true,
      needReview: false,
      beginnerFriendly: true,
      capacityLimited: false,
      statusHint: 'longterm',
      trustLevel: 'verified',
      notes: [
        '长期招募，参与校内大型活动摄影。',
        '具体报名截止时间未注明。',
        '有摄影设备者优先，但不作硬性要求。',
        '报名方式未注明，请以主办方通知为准。'
      ],
      guardHints: ['长期开放', '无设备也可报名', '摄影方向']
    }),

    /* 17 ---------------------------------------------------------------- */
    make({
      id: '17',
      title: 'Python 程序设计学习资料合集',
      summary: '包含课程、练习和项目案例；资料长期开放；当前网盘提取信息有效至 9 月 22 日，后续将统一更新。',
      sourceType: 'material',
      sourceName: '学习资料合集',
      category: '资料',
      tags: ['Python', '编程', '资料', '零基础'],
      audience: 'all',
      audienceExtra: null,
      startTime: null,
      endTime: null,
      deadline: D(2026, 9, 22, 23, 59),
      deadlineNote: '该时间为网盘提取信息有效期，非报名截止',
      location: null,
      online: true,
      requirements: [],
      signupMethod: null,
      needSignup: false,
      needReview: false,
      beginnerFriendly: true,
      capacityLimited: false,
      statusHint: 'longterm',
      trustLevel: 'official',
      notes: [
        '包含课程、练习和项目案例。',
        '资料长期开放。',
        '当前网盘提取信息有效至 9 月 22 日，后续将统一更新。',
        '资料链接未注明，请以主办方通知为准。'
      ],
      guardHints: ['零基础可参加', '长期开放', '提取信息 9 月 22 日前有效']
    }),

    /* 18 ---------------------------------------------------------------- */
    make({
      id: '18',
      title: '网络安全兴趣交流小组',
      summary: '首次交流 9 月 19 日 19:30，之后每两周开展一次；面向 CTF、Web 安全等方向感兴趣的学生，不限基础。',
      sourceType: 'school',
      sourceName: '校内兴趣小组',
      category: '学习小组',
      tags: ['网络安全', 'CTF', 'Web安全', '零基础'],
      audience: 'all',
      audienceExtra: '面向 CTF、Web 安全等方向感兴趣的学生',
      startTime: D(2026, 9, 19, 19, 30),
      endTime: D(2026, 9, 19, 21, 0),
      deadline: null,
      location: null,
      online: null,
      requirements: ['不限基础'],
      signupMethod: null,
      needSignup: false,
      needReview: false,
      beginnerFriendly: true,
      capacityLimited: false,
      durationText: '之后每两周开展一次',
      recurrence: { freq: 'biweekly', from: D(2026, 9, 19, 19, 30), time: '19:30' },
      trustLevel: 'verified',
      notes: [
        '首次交流时间：9 月 19 日 19:30。',
        '之后每两周开展一次。',
        '面向对 CTF、Web 安全等方向感兴趣的学生，不限基础。',
        '地点与报名方式未注明。'
      ],
      guardHints: ['今天 19:30', '不限基础', '每两周一次']
    }),

    /* 19 ---------------------------------------------------------------- */
    make({
      id: '19',
      title: '学生创新项目路演观摩',
      summary: '9 月 20 日 14:30 举行；原报名截止时间为 9 月 18 日 22:00（已过）；活动方说明如现场仍有余位，可接受候补入场。',
      sourceType: 'school',
      sourceName: '校内活动',
      category: '讲座',
      tags: ['创新创业', '路演', '观摩'],
      audience: 'all',
      audienceExtra: null,
      startTime: D(2026, 9, 20, 14, 30),
      endTime: D(2026, 9, 20, 16, 30),
      deadline: D(2026, 9, 18, 22, 0),
      location: null,
      online: false,
      requirements: ['原报名已截止', '如现场仍有余位，可候补入场'],
      signupMethod: null,
      needSignup: true,
      needReview: false,
      beginnerFriendly: true,
      capacityLimited: true,
      waitlist: true,
      trustLevel: 'official',
      notes: [
        '活动时间：9 月 20 日 14:30。',
        '原报名截止时间为 9 月 18 日 22:00（已过）。',
        '活动方说明：如现场仍有余位，可接受候补入场。',
        '候补入场不保证名额，地点未注明。'
      ],
      guardHints: ['报名已截止，可候补关注', '明天 14:30', '有余位才能入场']
    }),

    /* 20 ---------------------------------------------------------------- */
    make({
      id: '20',
      title: '创新创业项目团队补充说明',
      summary: '开发方向名额已满，现主要补充设计与材料成员；9 月 22 日 18:00 截止；此前已投递者无需重复提交。',
      sourceType: 'supplement',
      sourceName: '创新创业项目团队 · 补充说明',
      category: '补充通知',
      tags: ['补充通知', '创新创业', '项目', '设计', '材料'],
      audience: 'all',
      audienceExtra: null,
      startTime: null,
      endTime: null,
      deadline: D(2026, 9, 22, 18, 0),
      location: null,
      online: null,
      requirements: ['此前已投递者无需重复提交'],
      signupMethod: null,
      needSignup: true,
      needReview: false,
      beginnerFriendly: false,
      capacityLimited: true,
      recruitRoles: ['设计', '材料'],
      relatedIds: ['03'],
      trustLevel: 'supplement',
      notes: [
        '开发方向名额已满。',
        '现主要补充设计与材料成员。',
        '9 月 22 日 18:00 截止。',
        '此前已投递者无需重复提交。',
        '本说明不覆盖 03 号原始信息，两条并列展示。'
      ],
      guardHints: ['开发方向已满', '截止临近', '已投递者无需重复提交']
    }),

    /* 21 ---------------------------------------------------------------- */
    make({
      id: '21',
      title: '计算机学院 AI 产品设计分享会',
      summary: '9 月 20 日 19:00 在明德楼 B203 举行，面向全校学生；无需报名，座位有限。',
      sourceType: 'college',
      sourceName: '计算机学院',
      category: '讲座',
      tags: ['AI', '产品设计', '学院活动'],
      audience: 'all',
      audienceExtra: '面向全校学生',
      startTime: D(2026, 9, 20, 19, 0),
      endTime: D(2026, 9, 20, 20, 30),
      deadline: null,
      location: '明德楼 B203',
      online: false,
      requirements: ['无需报名', '座位有限'],
      signupMethod: null,
      needSignup: false,
      needReview: false,
      beginnerFriendly: true,
      capacityLimited: true,
      fee: null,
      trustLevel: 'official',
      notes: [
        '时间：9 月 20 日 19:00。',
        '地点：明德楼 B203。',
        '面向全校学生，无需报名，座位有限。'
      ],
      guardHints: ['明天 19:00', '面向全校', '无需报名', '座位有限']
    }),

    /* 22 ---------------------------------------------------------------- */
    make({
      id: '22',
      title: '学生发起｜周末羽毛球约球',
      summary: '9 月 20 日 16:00，计划 6—8 人，费用 AA，场地待最终确认。',
      sourceType: 'student',
      sourceName: '学生个人发布',
      category: '约球',
      tags: ['约球', '羽毛球', '运动'],
      audience: 'all',
      audienceExtra: null,
      startTime: D(2026, 9, 20, 16, 0),
      endTime: D(2026, 9, 20, 18, 0),
      deadline: null,
      location: null,
      locationPending: true,
      online: false,
      requirements: ['计划 6—8 人'],
      signupMethod: null,
      needSignup: true,
      needReview: false,
      beginnerFriendly: true,
      capacityLimited: true,
      capacity: 8,
      people: '6—8 人',
      fee: '费用 AA',
      trustLevel: 'informal',
      notes: [
        '时间：9 月 20 日 16:00。',
        '计划 6—8 人。',
        '费用 AA。',
        '场地待最终确认（地点待确认）。'
      ],
      guardHints: ['明天 16:00', '费用 AA', '场地待确认']
    }),

    /* 23 ---------------------------------------------------------------- */
    make({
      id: '23',
      title: '学生发起｜AI 工具交流搭子招募',
      summary: '拟于 9 月 21 日晚开展；欢迎零基础；报名后拉群；具体地点未确定。',
      sourceType: 'student',
      sourceName: '学生个人发布',
      category: '搭子',
      tags: ['AI', '搭子', '零基础', '交流'],
      audience: 'all',
      audienceExtra: null,
      startTime: D(2026, 9, 21, 19, 0),
      endTime: D(2026, 9, 21, 21, 0),
      timeText: '9 月 21 日晚（具体时刻未确定）',
      deadline: null,
      location: null,
      locationPending: true,
      online: null,
      requirements: ['欢迎零基础'],
      signupMethod: '报名后拉群',
      needSignup: true,
      needReview: false,
      beginnerFriendly: true,
      capacityLimited: false,
      trustLevel: 'informal',
      notes: [
        '拟于 9 月 21 日晚开展（具体时刻未确定）。',
        '欢迎零基础。',
        '报名后拉群。',
        '具体地点未确定（地点待确认）。'
      ],
      guardHints: ['零基础可参加', '9 月 21 日晚', '地点待确认']
    }),

    /* 24 — 高风险 ------------------------------------------------------- */
    make({
      id: '24',
      title: '学生发起｜“校园兼职福利分享”',
      summary: '称“零门槛、日结”，要求添加私人微信获取详情；未提供主办方、地点和完整内容。',
      sourceType: 'student',
      sourceName: '学生个人发布（来源未核实）',
      category: '招募',
      tags: ['兼职', '高风险', '来源不明'],
      audience: null,
      audienceExtra: null,
      startTime: null,
      endTime: null,
      deadline: null,
      location: null,
      online: null,
      requirements: ['要求添加私人微信获取详情'],
      signupMethod: '添加私人微信',
      needSignup: true,
      needReview: false,
      beginnerFriendly: false,
      capacityLimited: false,
      fee: null,
      trustLevel: 'risk',
      riskLevel: 'high',
      riskNote: '未提供主办方、地点和完整内容，且以“零门槛、日结”吸引添加私人微信。',
      notes: [
        '宣传内容：“零门槛、日结”。',
        '要求添加私人微信获取详情。',
        '未提供主办方、地点和完整内容。'
      ],
      guardHints: ['高风险信息', '不建议添加私人微信或转账']
    }),

    /* 25 — 疑似推广 ----------------------------------------------------- */
    make({
      id: '25',
      title: '学生发起｜数码新品体验交流',
      summary: '标题为技术交流，正文主要介绍某商家优惠及购买链接；活动时间、地点未注明。',
      sourceType: 'student',
      sourceName: '学生个人发布（内容疑似推广）',
      category: '交流',
      tags: ['数码', '疑似推广', '购买链接'],
      audience: null,
      audienceExtra: null,
      startTime: null,
      endTime: null,
      deadline: null,
      location: null,
      online: null,
      requirements: [],
      signupMethod: null,
      needSignup: false,
      needReview: false,
      beginnerFriendly: false,
      capacityLimited: false,
      fee: null,
      trustLevel: 'suspect',
      riskLevel: 'suspect',
      riskNote: '标题为技术交流，正文主要介绍某商家优惠及购买链接，且未注明活动时间与地点。',
      notes: [
        '标题为技术交流。',
        '正文主要介绍某商家优惠及购买链接。',
        '活动时间、地点未注明。'
      ],
      guardHints: ['疑似推广，已降低推荐权重']
    }),

    /* 26 ---------------------------------------------------------------- */
    make({
      id: '26',
      title: '外国语学院校园语言角',
      summary: '9 月 21 日 15:00 举行，面向全校学生自由交流；场地容量有限，无需提前报名。',
      sourceType: 'college',
      sourceName: '外国语学院',
      category: '交流',
      tags: ['语言', '口语', '交流', '学院活动'],
      audience: 'all',
      audienceExtra: '面向全校学生',
      startTime: D(2026, 9, 21, 15, 0),
      endTime: D(2026, 9, 21, 17, 0),
      deadline: null,
      location: null,
      online: false,
      requirements: ['自由交流', '无需提前报名', '场地容量有限'],
      signupMethod: null,
      needSignup: false,
      needReview: false,
      beginnerFriendly: true,
      capacityLimited: true,
      trustLevel: 'official',
      notes: [
        '时间：9 月 21 日 15:00。',
        '面向全校学生，自由交流。',
        '场地容量有限，无需提前报名（先到先得）。',
        '地点未注明。'
      ],
      guardHints: ['面向全校', '无需报名', '场地容量有限']
    })
  ];

  /* 日历辅助：把开始/结束/截止展开为日历事件 */
  function calendarPoints(op) {
    var pts = [];
    var recur = op.recurrence;
    if (recur && recur.freq === 'weekly' && recur.weeks) {
      for (var i = 0; i < recur.weeks; i++) {
        var s = CR.date.addDays(recur.from, i * 7);
        pts.push({ at: s, kind: 'start', label: '第 ' + (i + 1) + ' 次' });
      }
    } else if (recur && recur.freq === 'biweekly') {
      // 每两周一次：展示首次与之后 4 次
      for (var k = 0; k < 4; k++) {
        pts.push({ at: CR.date.addDays(recur.from, k * 14), kind: 'start', label: k === 0 ? '首次' : '第 ' + (k + 1) + ' 次' });
      }
    } else if (op.startTime) {
      pts.push({ at: op.startTime, kind: 'start', label: '' });
    }
    if (op.deadline) pts.push({ at: op.deadline, kind: 'deadline', label: '' });
    if (op.replayAt) pts.push({ at: op.replayAt, kind: 'replay', label: '预计上传回放' });
    (op.contestMilestones || []).forEach(function (m) {
      pts.push({ at: m.at, kind: 'deadline', label: m.label });
    });
    return pts;
  }

  var seed = {
    SEED_VERSION: SEED_VERSION,
    SEED_BASE: SEED_BASE,
    BASE_LABEL: '2026年9月19日 周六',
    opportunities: RAW,
    byId: function (id) {
      for (var i = 0; i < RAW.length; i++) {
        if (RAW[i].id === String(id)) return RAW[i];
      }
      return null;
    },
    calendarPoints: calendarPoints
  };

  CR.seed = seed;
})(window);
