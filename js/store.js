/* ==========================================================================
   js/store.js — 应用状态中心
   · 种子数据只读，用户状态独立持久化，互不覆盖
   · 收藏 / 报名 / 提醒 / 日历 / 不感兴趣 / 浏览历史 / 本机发布 / 档案 / 偏好
   ========================================================================== */
(function (global) {
  'use strict';

  var CR = (global.CampusRadar = global.CampusRadar || {});
  var storage = CR.storage;

  var state = {
    ready: false,
    user: CR.defaults.userState(),
    profile: CR.defaults.profile(),
    preferences: CR.defaults.preferences(),
    posts: [],          // IndexedDB 中的本机发布
    notes: [],          // IndexedDB 中的用户备注
    history: [],        // 浏览历史（IndexedDB + localStorage 兜底）
    drafts: [],
    notices: [],        // 启动提示（例如 IndexedDB 不可用）
    seedVersion: CR.seed.SEED_VERSION,
    seededAt: CR.seed.SEED_BASE,
    lastError: null
  };

  var listeners = [];

  /* ------------------------------------------------------------ 工具函数 -- */
  function uid(prefix) {
    return (prefix || 'id') + '-' + Date.now().toString(36) + '-' +
      Math.random().toString(36).slice(2, 7);
  }

  function indexOfById(list, id) {
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(id)) return i;
    }
    return -1;
  }

  function includes(list, id) { return indexOfById(list, id) >= 0; }

  /** 把本机发布对象转换为统一的机会对象 */
  function postToOpportunity(post) {
    var op = {
      id: post.id,
      title: post.title,
      summary: post.notes || '',
      sourceType: 'local',
      sourceName: post.author || '本机发布',
      category: post.category || '其他',
      tags: post.tags || [],
      audience: post.audienceKey || null,
      audienceExtra: post.audience || null,
      startTime: post.startTime || null,
      endTime: post.endTime || null,
      deadline: post.deadline || null,
      replayAt: null,
      location: post.location || null,
      locationPending: post.locationPending === true || !post.location,
      online: post.online == null ? null : post.online,
      requirements: [],
      signupMethod: post.signupMethod || null,
      needSignup: true,
      needReview: !!post.needReview,
      beginnerFriendly: !!post.beginnerFriendly,
      capacityLimited: !!post.people,
      capacity: post.people || null,
      people: post.people || null,
      fee: post.fee || null,
      weeklyHours: null,
      statusHint: post.longTerm ? 'longterm' : null,
      trustLevel: 'local',
      riskLevel: 'none',
      relatedIds: [],
      notes: post.notesList || (post.notes ? [post.notes] : []),
      missingFields: CR.trust.missingOfLocal(post),
      guardHints: [],
      origin: 'local',
      isLocal: true,
      publishedAt: post.createdAt,
      updatedAt: post.updatedAt,
      author: post.author || '本机用户'
    };
    return op;
  }

  /** 全部机会：种子（含只读标记）+ 本机发布 */
  function allOpportunities() {
    return CR.seed.opportunities.concat(state.posts.map(postToOpportunity));
  }

  function getById(id) {
    var s = CR.seed.byId(id);
    if (s) return s;
    var p = state.posts.filter(function (x) { return String(x.id) === String(id); })[0];
    return p ? postToOpportunity(p) : null;
  }

  /* ------------------------------------------------------------ 订阅机制 -- */
  function subscribe(fn) {
    listeners.push(fn);
    return function () {
      var i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    };
  }

  function persistUser() {
    storage.writeUserState(state.user);
  }

  function persistPrefs() {
    storage.writePreferences(state.preferences);
  }

  function emit(reason) {
    listeners.slice().forEach(function (fn) {
      try { fn(state, reason); } catch (e) { console.error('[CampusRadar] 订阅回调异常：', e); }
    });
  }

  /* ---------------------------------------------------------------- 初始化 */
  function init() {
    state.user = storage.readUserState();
    state.profile = storage.readProfile();
    state.preferences = storage.readPreferences();

    var notice = storage.fallbackNotice();
    if (notice) state.notices.push(notice);

    var sync = storage.syncSeedVersion(CR.seed.SEED_VERSION);
    if (sync.migrated) {
      state.notices.push('检测到种子数据版本更新（' + sync.from + ' → ' + sync.to + '），已保留你的收藏、报名与发布内容。');
    }

    return Promise.all([
      storage.getPosts(),
      storage.getNotes(),
      storage.getHistoryStore(),
      storage.getDraft()
    ]).then(function (res) {
      // 与内存中已有内容合并（例如 IndexedDB 不可用时会话内新发布的帖子），
      // 避免重复初始化时丢失；下架（软删除）的发布不进入列表
      var mergedPosts = {};
      state.posts.forEach(function (p) { if (p && p.id) mergedPosts[p.id] = p; });
      (res[0] || []).forEach(function (p) { if (p && p.id) mergedPosts[p.id] = p; });
      state.posts = Object.keys(mergedPosts).map(function (k) { return mergedPosts[k]; })
        .filter(function (p) { return !p.removed; })
        .sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });

      var mergedNotes = {};
      state.notes.forEach(function (n) { if (n && n.id) mergedNotes[n.id] = n; });
      (res[1] || []).forEach(function (n) { if (n && n.id) mergedNotes[n.id] = n; });
      state.notes = Object.keys(mergedNotes).map(function (k) { return mergedNotes[k]; });
      state.drafts = (res[3] && res[3].length) ? res[3] : state.drafts;

      var idbHistory = (res[2] || []).slice().sort(function (a, b) {
        return (b.visitedAt || 0) - (a.visitedAt || 0);
      }).slice(0, 60);

      // IndexedDB 与 localStorage 兜底副本合并（以时间较新者为准）
      var merged = {};
      idbHistory.concat(state.user.history || []).forEach(function (row) {
        if (!row || !row.id) return;
        var prev = merged[row.id];
        if (!prev || (row.visitedAt || 0) > (prev.visitedAt || 0)) merged[row.id] = row;
      });
      state.history = Object.keys(merged).map(function (k) { return merged[k]; })
        .sort(function (a, b) { return (b.visitedAt || 0) - (a.visitedAt || 0); })
        .slice(0, 60);

      state.ready = true;
      // 历史写回 localStorage 兜底
      state.user.history = state.history.slice(0, 30);
      persistUser();
      emit('init');
      return state;
    }).catch(function (e) {
      state.lastError = e;
      state.ready = true;
      state.notices.push('本机存储（IndexedDB）不可用，本机发布与浏览历史本次会话内有效，' +
        '刷新后可能丢失；收藏、报名、提醒与设置仍保存在 localStorage 中。');
      emit('init-error');
      return state;
    });
  }

  /* -------------------------------------------------------------- 收藏 --- */
  function toggleFavorite(id) {
    var on = includes(state.user.favorites, id);
    if (on) {
      state.user.favorites.splice(indexOfById(state.user.favorites, id), 1);
    } else {
      state.user.favorites.unshift({ id: String(id), at: Date.now() });
    }
    persistUser();
    emit('favorite');
    return !on;
  }

  function isFavorite(id) { return includes(state.user.favorites, id); }

  /* ----------------------------------------------------- 报名 / 意向登记 -- */
  var SIGNUP_STATUS = {
    registered: { label: '已登记', tone: 'info' },
    signed: { label: '已报名', tone: 'ok' },
    reviewing: { label: '待审核', tone: 'warn' },
    waitlist: { label: '候补关注', tone: 'warn' }
  };

  /**
   * 报名状态由信息本身决定，不臆造：
   * 需审核 → 待审核；已截止但可候补 → 候补关注；有“意向登记”表述 → 已登记；其余 → 已报名
   */
  function suggestedSignupStatus(op) {
    if (!op) return 'signed';
    if (op.waitlist) return 'waitlist';
    if (op.needReview) return 'reviewing';
    var text = (op.signupMethod || '') + (op.title || '') + (op.requirements || []).join(' ');
    if (/意向登记/.test(text)) return 'registered';
    return 'signed';
  }

  function setSignup(id, status) {
    var op = getById(id);
    var next = status || suggestedSignupStatus(op);
    var i = indexOfById(state.user.signups, id);
    if (i >= 0) {
      state.user.signups[i].status = next;
      state.user.signups[i].at = state.user.signups[i].at || Date.now();
    } else {
      state.user.signups.unshift({
        id: String(id),
        status: next,
        at: Date.now(),
        title: op ? op.title : ''
      });
    }
    persistUser();
    emit('signup');
    return next;
  }

  function removeSignup(id) {
    var i = indexOfById(state.user.signups, id);
    if (i >= 0) state.user.signups.splice(i, 1);
    persistUser();
    emit('signup');
  }

  function getSignup(id) {
    var i = indexOfById(state.user.signups, id);
    return i >= 0 ? state.user.signups[i] : null;
  }

  /* -------------------------------------------------------------- 提醒 --- */
  var REMINDER_OFFSETS = [
    { key: '1d', label: '提前 1 天', ms: 86400000 },
    { key: '3h', label: '提前 3 小时', ms: 3 * 3600000 },
    { key: '1h', label: '提前 1 小时', ms: 3600000 },
    { key: '30m', label: '提前 30 分钟', ms: 1800000 }
  ];

  /**
   * 计算提醒触发点：以报名截止为准，无截止则用活动开始时间。
   * 若计算出的时间已过，则顺延为“现在 + 1 分钟”，避免产生无效提醒。
   */
  function reminderTime(op, offsetKey) {
    var off = REMINDER_OFFSETS.filter(function (o) { return o.key === offsetKey; })[0] || REMINDER_OFFSETS[2];
    var base = op && (op.deadline || op.startTime);
    if (!base) return Date.now() + 60000;
    var at = base - off.ms;
    if (at <= Date.now()) at = Date.now() + 60000;
    return at;
  }

  function addReminder(id, offsetKey) {
    var op = getById(id);
    var off = offsetKey || '1h';
    var at = reminderTime(op, off);
    var i = indexOfById(state.user.reminders, id);
    var row = {
      id: String(id),
      offset: off,
      at: at,
      base: op && op.deadline ? 'deadline' : 'start',
      createdAt: Date.now(),
      title: op ? op.title : ''
    };
    if (i >= 0) state.user.reminders[i] = row;
    else state.user.reminders.unshift(row);
    persistUser();
    emit('reminder');
    return row;
  }

  function removeReminder(id) {
    var i = indexOfById(state.user.reminders, id);
    if (i >= 0) state.user.reminders.splice(i, 1);
    persistUser();
    emit('reminder');
  }

  function getReminder(id) {
    var i = indexOfById(state.user.reminders, id);
    return i >= 0 ? state.user.reminders[i] : null;
  }

  /* --------------------------------------------------------- 不感兴趣 --- */
  function toggleHidden(id) {
    var on = includes(state.user.hidden, id);
    if (on) state.user.hidden.splice(indexOfById(state.user.hidden, id), 1);
    else state.user.hidden.unshift({ id: String(id), at: Date.now() });
    persistUser();
    emit('hidden');
    return !on;
  }

  function isHidden(id) { return includes(state.user.hidden, id); }

  /* ---------------------------------------------------------- 加入日历 -- */
  function addToCalendar(id) {
    if (includes(state.user.calendar, id)) return false;
    state.user.calendar.unshift({ id: String(id), at: Date.now() });
    persistUser();
    emit('calendar');
    return true;
  }

  function removeFromCalendar(id) {
    var i = indexOfById(state.user.calendar, id);
    if (i >= 0) state.user.calendar.splice(i, 1);
    persistUser();
    emit('calendar');
  }

  function inCalendar(id) { return includes(state.user.calendar, id); }

  /** 日历中显示的机会集合：加入日历的 + 收藏的 + 已报名的（去重） */
  function calendarOpportunities() {
    var ids = {};
    state.user.calendar.forEach(function (r) { ids[r.id] = 1; });
    state.user.favorites.forEach(function (r) { ids[r.id] = 1; });
    state.user.signups.forEach(function (r) { ids[r.id] = 1; });
    return Object.keys(ids).map(getById).filter(Boolean);
  }

  /* ------------------------------------------------------------ 备注 --- */
  function noteOf(id) {
    var row = state.notes.filter(function (n) { return String(n.id) === String(id); })[0];
    if (row) return row.text || '';
    return (state.user.notes && state.user.notes[id]) || '';
  }

  function saveNote(id, text) {
    var clean = String(text || '').trim();
    var row = { id: String(id), text: clean, updatedAt: Date.now() };
    var i = -1;
    state.notes.forEach(function (n, idx) { if (String(n.id) === String(id)) i = idx; });
    if (i >= 0) state.notes[i] = row; else state.notes.push(row);
    state.user.notes = state.user.notes || {};
    if (clean) state.user.notes[id] = clean; else delete state.user.notes[id];
    persistUser();
    storage.putNote(row);
    emit('note');
    return clean;
  }

  /* -------------------------------------------------------- 浏览历史 --- */
  function recordVisit(id) {
    var op = getById(id);
    if (!op) return;
    var row = {
      id: String(id),
      title: op.title,
      sourceType: op.sourceType,
      category: op.category,
      visitedAt: Date.now()
    };
    var i = -1;
    state.history.forEach(function (h, idx) { if (String(h.id) === String(id)) i = idx; });
    if (i >= 0) state.history.splice(i, 1);
    state.history.unshift(row);
    state.history = state.history.slice(0, 60);
    state.user.history = state.history.slice(0, 30);
    persistUser();
    storage.putHistory(row);
    // 历史不作为渲染依赖，静默更新即可
  }

  function clearHistory() {
    state.history = [];
    state.user.history = [];
    persistUser();
    storage.clearHistoryStore();
    emit('history');
  }

  function removeHistory(id) {
    state.history = state.history.filter(function (h) { return String(h.id) !== String(id); });
    state.user.history = state.history.slice(0, 30);
    persistUser();
    storage.remove('history', String(id));
    emit('history');
  }

  /* ------------------------------------------------------ 本机发布 ---- */
  function createPost(data) {
    var now = Date.now();
    var post = {
      id: uid('local'),
      title: String(data.title || '').trim(),
      category: data.category || '其他',
      tags: data.tags || [],
      startTime: data.startTime || null,
      endTime: data.endTime || null,
      deadline: data.deadline || null,
      location: String(data.location || '').trim(),
      online: data.online == null ? null : data.online,
      people: String(data.people || '').trim(),
      fee: String(data.fee || '').trim(),
      audience: String(data.audience || '').trim(),
      audienceKey: data.audienceKey || null,
      locationPending: data.locationPending === true || !String(data.location || '').trim(),
      signupMethod: String(data.signupMethod || '').trim(),
      notes: String(data.notes || '').trim(),
      notesList: data.notes ? [String(data.notes).trim()] : [],
      longTerm: !!data.longTerm,
      needReview: !!data.needReview,
      beginnerFriendly: !!data.beginnerFriendly,
      author: data.author || '本机用户',
      sourceType: 'student-local',
      localOnly: true,
      createdAt: now,
      updatedAt: now,
      removed: false
    };
    state.posts.unshift(post);
    storage.putPost(post);
    emit('post');
    return post;
  }

  function updatePost(id, data) {
    var i = -1;
    state.posts.forEach(function (p, idx) { if (String(p.id) === String(id)) i = idx; });
    if (i < 0) return null;
    var post = state.posts[i];
    Object.keys(data).forEach(function (k) {
      if (k === 'id' || k === 'createdAt') return;
      post[k] = data[k];
    });
    if (data.notes !== undefined) post.notesList = data.notes ? [String(data.notes).trim()] : [];
    post.updatedAt = Date.now();
    storage.putPost(post);
    emit('post');
    return post;
  }

  /** 下架：软删除，保留在 IndexedDB 中可恢复 */
  function removePost(id, hard) {
    var i = -1;
    state.posts.forEach(function (p, idx) { if (String(p.id) === String(id)) i = idx; });
    if (i < 0) return false;
    if (hard) {
      state.posts.splice(i, 1);
      storage.removePost(id);
    } else {
      state.posts[i].removed = true;
      state.posts[i].removedAt = Date.now();
      storage.putPost(state.posts[i]);
      state.posts.splice(i, 1);
    }
    // 同时清理与之关联的用户状态
    ['favorites', 'signups', 'reminders', 'hidden', 'calendar'].forEach(function (k) {
      var j = indexOfById(state.user[k], id);
      if (j >= 0) state.user[k].splice(j, 1);
    });
    persistUser();
    emit('post');
    return true;
  }

  function myPosts(includeRemoved) {
    if (includeRemoved) {
      return storage.getPosts().then(function (list) {
        return (list || []).slice().sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
      });
    }
    return Promise.resolve(state.posts.slice());
  }

  /* ------------------------------------------------------ 草稿 -------- */
  /**
   * 保存发布页草稿。
   * 兼容两种调用：saveDraft({data, step}) 或 saveDraft(formObject)
   */
  function saveDraft(payload) {
    var row;
    if (payload && payload.data && typeof payload.data === 'object') {
      row = { id: 'publish-draft', data: payload.data, step: payload.step || 1, savedAt: Date.now() };
    } else {
      row = { id: 'publish-draft', data: payload || {}, step: 1, savedAt: Date.now() };
    }
    var found = false;
    state.drafts.forEach(function (d, i) { if (d.id === row.id) { state.drafts[i] = row; found = true; } });
    if (!found) state.drafts.push(row);
    storage.putDraft(row);
    return row;
  }

  function getDraft() {
    return state.drafts.filter(function (d) { return d.id === 'publish-draft'; })[0] || null;
  }

  function clearDraft() {
    state.drafts = state.drafts.filter(function (d) { return d.id !== 'publish-draft'; });
    storage.removeDraft('publish-draft');
  }

  /* --------------------------------------------------- 档案 / 偏好 ---- */
  function saveProfile(patch) {
    Object.keys(patch || {}).forEach(function (k) { state.profile[k] = patch[k]; });
    state.profile.updatedAt = Date.now();
    storage.writeProfile(state.profile);
    emit('profile');
    return state.profile;
  }

  function toggleGuardMode(force) {
    var next = typeof force === 'boolean' ? force : !state.profile.guardMode;
    return saveProfile({ guardMode: next });
  }

  function savePreferences(patch) {
    Object.keys(patch || {}).forEach(function (k) { state.preferences[k] = patch[k]; });
    storage.writePreferences(state.preferences);
    emit('preferences');
    return state.preferences;
  }

  function resetPreferences() {
    state.preferences = CR.defaults.preferences();
    persistPrefs();
    emit('preferences');
  }

  function clearAllData() {
    return storage.clearAll().then(function () {
      state.user = CR.defaults.userState();
      state.profile = CR.defaults.profile();
      state.preferences = CR.defaults.preferences();
      state.posts = [];
      state.notes = [];
      state.history = [];
      state.drafts = [];
      emit('reset');
      return true;
    });
  }

  /* --------------------------------------------------- 匹配与排序 ---- */
  var CONDITIONS = [
    { key: 'beginner', label: '零基础', test: function (op) { return !!op.beginnerFriendly; } },
    { key: 'noSignup', label: '无需报名', test: function (op) { return op.needSignup === false; } },
    { key: 'needSignup', label: '需预约', test: function (op) { return op.needSignup === true; } },
    { key: 'review', label: '需审核', test: function (op) { return !!op.needReview; } },
    { key: 'limited', label: '限人数', test: function (op) { return !!op.capacityLimited; } }
  ];

  function audienceKeys() {
    return [
      { key: 'all', label: '全校' },
      { key: 'freshman', label: '大一' },
      { key: 'sophomore', label: '大二及以上' },
      { key: 'undergrad', label: '本科生' },
      { key: 'unlimited', label: '不限专业' }
    ];
  }

  function matchAudience(op, key) {
    if (!op.audience) return false;
    if (key === 'all') return op.audience === 'all';
    if (key === 'freshman') return op.audience === 'freshman';
    if (key === 'sophomore') return op.audience === 'sophomore' || op.audience === 'senior';
    if (key === 'undergrad') return op.audience === 'undergrad' || op.audience === 'freshman' ||
      op.audience === 'sophomore' || op.audience === 'senior';
    if (key === 'unlimited') {
      return /不限专业/.test(op.audienceExtra || '') || op.audience === 'all';
    }
    return false;
  }

  function searchText(op) {
    return [
      op.title,
      op.summary,
      op.sourceName,
      op.category,
      op.location || '',
      op.audienceExtra || '',
      (op.tags || []).join(' '),
      (op.requirements || []).join(' '),
      op.signupMethod || ''
    ].join(' ').toLowerCase();
  }

  function matchQuery(op, q) {
    if (!q) return true;
    var terms = String(q).toLowerCase().split(/\s+/).filter(Boolean);
    var text = searchText(op);
    return terms.every(function (t) { return text.indexOf(t) >= 0; });
  }

  /**
   * 过滤：不传参数则使用当前保存的偏好（筛选偏好会被持久化）。
   * opts.ignoreHidden 为 true 时不过滤“不感兴趣”。
   */
  function filterOpportunities(opts) {
    opts = opts || {};
    var prefs = state.preferences;
    var q = opts.query != null ? opts.query : prefs.query;
    var sources = opts.sources || prefs.sources || [];
    var categories = opts.categories || prefs.categories || [];
    var audiences = opts.audiences || prefs.audiences || [];
    var conditions = opts.conditions || prefs.conditions || [];
    var statuses = opts.statuses || prefs.statuses || [];
    var now = opts.now || Date.now();

    return allOpportunities().filter(function (op) {
      if (!opts.ignoreHidden && !opts.includeHidden && isHidden(op.id)) return false;
      if (!matchQuery(op, q)) return false;
      if (sources.length && sources.indexOf(op.sourceType) < 0) return false;
      if (categories.length && categories.indexOf(op.category) < 0) return false;
      if (audiences.length && !audiences.some(function (k) { return matchAudience(op, k); })) return false;
      if (conditions.length) {
        var ok = conditions.every(function (key) {
          var c = CONDITIONS.filter(function (x) { return x.key === key; })[0];
          return c ? c.test(op) : true;
        });
        if (!ok) return false;
      }
      if (statuses.length) {
        var hit = statuses.some(function (k) { return CR.conflict.matchStatusFilter(op, k, now); });
        if (!hit) return false;
      }
      return true;
    });
  }

  var SORTS = [
    { key: 'smart', label: '智能排序（新生友好度 + 截止紧急度 + 时间）' },
    { key: 'deadline', label: '截止最近优先' },
    { key: 'time', label: '活动时间最近优先' },
    { key: 'friendly', label: '新生友好度优先' },
    { key: 'recent', label: '最新发布优先' }
  ];

  function sortOpportunities(list, sortKey, now) {
    var t = now || Date.now();
    var key = sortKey || state.preferences.sort || 'smart';
    var arr = list.slice();
    arr.sort(function (a, b) {
      if (key === 'deadline') {
        var ad = a.deadline || Infinity, bd = b.deadline || Infinity;
        if (ad !== bd) return ad - bd;
        return CR.trust.defaultScore(b, t) - CR.trust.defaultScore(a, t);
      }
      if (key === 'time') {
        var at = a.startTime || a.deadline || Infinity;
        var bt = b.startTime || b.deadline || Infinity;
        if (at !== bt) return at - bt;
        return CR.trust.defaultScore(b, t) - CR.trust.defaultScore(a, t);
      }
      if (key === 'friendly') {
        var af = CR.trust.freshmanScore(a), bf = CR.trust.freshmanScore(b);
        if (af !== bf) return bf - af;
        return CR.trust.urgencyScore(b, t) - CR.trust.urgencyScore(a, t);
      }
      if (key === 'recent') {
        var ap = a.publishedAt || (a.origin === 'local' ? a.startTime : 0) || 0;
        var bp = b.publishedAt || (b.origin === 'local' ? b.startTime : 0) || 0;
        if (ap !== bp) return bp - ap;
        return 0;
      }
      return CR.trust.defaultScore(b, t) - CR.trust.defaultScore(a, t);
    });
    return arr;
  }

  /** 发现页的“危险信息”分离 */
  function splitByRisk(list) {
    var normal = [], risky = [];
    list.forEach(function (op) {
      if (op.riskLevel === 'high' || op.riskLevel === 'suspect') risky.push(op);
      else normal.push(op);
    });
    return { normal: normal, risky: risky };
  }

  function counts() {
    return {
      favorites: state.user.favorites.length,
      signups: state.user.signups.length,
      reminders: state.user.reminders.length,
      posts: state.posts.length,
      calendar: state.user.calendar.length,
      history: state.history.length
    };
  }

  var store = {
    state: state,
    SIGNUP_STATUS: SIGNUP_STATUS,
    REMINDER_OFFSETS: REMINDER_OFFSETS,
    CONDITIONS: CONDITIONS,
    SORTS: SORTS,
    init: init,
    subscribe: subscribe,
    emit: emit,
    uid: uid,
    allOpportunities: allOpportunities,
    getById: getById,
    postToOpportunity: postToOpportunity,
    audienceKeys: audienceKeys,

    toggleFavorite: toggleFavorite,
    isFavorite: isFavorite,

    setSignup: setSignup,
    removeSignup: removeSignup,
    getSignup: getSignup,
    suggestedSignupStatus: suggestedSignupStatus,

    addReminder: addReminder,
    removeReminder: removeReminder,
    getReminder: getReminder,
    reminderTime: reminderTime,
    hasReminder: function (id) { return !!getReminder(id); },

    toggleHidden: toggleHidden,
    isHidden: isHidden,

    addToCalendar: addToCalendar,
    removeFromCalendar: removeFromCalendar,
    inCalendar: inCalendar,
    calendarOpportunities: calendarOpportunities,

    noteOf: noteOf,
    saveNote: saveNote,

    recordVisit: recordVisit,
    clearHistory: clearHistory,
    removeHistory: removeHistory,

    createPost: createPost,
    updatePost: updatePost,
    removePost: removePost,
    myPosts: myPosts,

    saveDraft: saveDraft,
    getDraft: getDraft,
    clearDraft: clearDraft,

    saveProfile: saveProfile,
    toggleGuardMode: toggleGuardMode,
    savePreferences: savePreferences,
    resetPreferences: resetPreferences,
    clearAllData: clearAllData,

    filterOpportunities: filterOpportunities,
    sortOpportunities: sortOpportunities,
    splitByRisk: splitByRisk,
    matchAudience: matchAudience,
    counts: counts
  };

  CR.store = store;
})(window);
