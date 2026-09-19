/* ==========================================================================
   js/storage.js — 持久化层
   · localStorage：轻量结构化状态（收藏 / 报名 / 提醒 / 档案 / 偏好 / 浏览历史）
   · IndexedDB   ：体量较大或需独立管理的数据（本机发布 / 备注 / 浏览历史 / 草稿）
   所有读取都做了容错：损坏数据不会导致页面崩溃。
   ========================================================================== */
(function (global) {
  'use strict';

  var CR = (global.CampusRadar = global.CampusRadar || {});

  var KEYS = {
    userState: 'campusradar:userState:v1',
    profile: 'campusradar:profile:v1',
    preferences: 'campusradar:preferences:v1',
    seedVersion: 'campusradar:seedVersion',
    version: 'campusradar:appVersion'
  };

  var APP_VERSION = '1.0.0';

  /* ---------------------------------------------------------------- ls ---- */
  function safeParse(raw, fallback) {
    if (raw == null) return fallback;
    try {
      var v = JSON.parse(raw);
      return v == null ? fallback : v;
    } catch (e) {
      console.warn('[CampusRadar] localStorage 数据损坏，已回退默认值：', e);
      return fallback;
    }
  }

  function lsGet(key, fallback) {
    try {
      return safeParse(global.localStorage.getItem(key), fallback);
    } catch (e) {
      return fallback;
    }
  }

  function lsSet(key, value) {
    try {
      global.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('[CampusRadar] 写入 localStorage 失败：', e);
      return false;
    }
  }

  function lsDel(key) {
    try { global.localStorage.removeItem(key); } catch (e) { /* ignore */ }
  }

  /* --------------------------------------------------------------- idb ---- */
  var DB_NAME = 'campusradar';
  var DB_VERSION = 1;
  var STORES = ['posts', 'notes', 'history', 'drafts'];
  var dbPromise = null;
  var idbAvailable = typeof global.indexedDB !== 'undefined';

  function openDB() {
    if (!idbAvailable) return Promise.reject(new Error('IndexedDB 不可用'));
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      var req;
      try {
        req = global.indexedDB.open(DB_NAME, DB_VERSION);
      } catch (e) {
        reject(e);
        return;
      }
      req.onupgradeneeded = function (ev) {
        var db = ev.target.result;
        STORES.forEach(function (name) {
          if (!db.objectStoreNames.contains(name)) {
            var store = db.createObjectStore(name, { keyPath: 'id' });
            if (name === 'history') store.createIndex('visitedAt', 'visitedAt', { unique: false });
          }
        });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('IndexedDB 打开失败')); };
      req.onblocked = function () { reject(new Error('IndexedDB 被其他标签页占用')); };
    });
    // 失败后允许下次重试
    dbPromise.catch(function () { dbPromise = null; });
    return dbPromise;
  }

  function withStore(name, mode, fn) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(name, mode);
        var store = tx.objectStore(name);
        var result;
        try {
          result = fn(store);
        } catch (e) {
          reject(e);
          return;
        }
        tx.oncomplete = function () {
          resolve(result && result.__req ? result.__req.result : result);
        };
        tx.onerror = function () { reject(tx.error); };
        tx.onabort = function () { reject(tx.error || new Error('事务被中止')); };
      });
    });
  }

  function idbGetAll(name) {
    if (!idbAvailable) return Promise.resolve([]);
    return withStore(name, 'readonly', function (store) {
      var req = store.getAll();
      return { __req: req };
    }).then(function (rows) {
      return Array.isArray(rows) ? rows : (rows ? [rows] : []);
    }).catch(function (e) {
      console.warn('[CampusRadar] 读取 IndexedDB 失败（' + name + '）：', e && e.message ? e.message : e);
      return [];
    });
  }

  function idbPut(name, value) {
    if (!idbAvailable) return Promise.resolve(null);
    return withStore(name, 'readwrite', function (store) {
      store.put(value);
      return value;
    }).catch(function (e) {
      console.warn('[CampusRadar] 写入 IndexedDB 失败（' + name + '）：', e && e.message ? e.message : e);
      return null;
    });
  }

  function idbDelete(name, id) {
    if (!idbAvailable) return Promise.resolve(null);
    return withStore(name, 'readwrite', function (store) {
      store.delete(id);
      return id;
    }).catch(function () { return null; });
  }

  function idbClear(name) {
    if (!idbAvailable) return Promise.resolve(false);
    return withStore(name, 'readwrite', function (store) {
      store.clear();
      return true;
    }).catch(function () { return false; });
  }

  /* ------------------------------------------------------------ 默认值 ---- */
  function defaultUserState() {
    return {
      version: 1,
      favorites: [],   // [{id, at}]
      signups: [],     // [{id, status, at, note}]
      reminders: [],   // [{id, at, offset, mode}]
      hidden: [],      // [{id, at}]
      calendar: [],    // [{id, at, source:'seed'|'local'}]
      history: [],     // 最近浏览（localStorage 兜底副本，最多 30 条）
      notes: {}        // { opId: '备注文本' }
    };
  }

  function defaultProfile() {
    return {
      onboarded: false,
      guardMode: false,      // 新生护航模式
      grade: '',
      interests: [],
      foundation: '',
      hoursPerWeek: '',
      updatedAt: null
    };
  }

  function defaultPreferences() {
    return {
      query: '',
      sources: [],
      categories: [],
      audiences: [],
      conditions: [],
      statuses: [],
      sort: 'smart',
      view: 'list'
    };
  }

  /** 把旧版本数据补齐到最新结构（不覆盖用户已有内容） */
  function migrateUserState(raw) {
    var base = defaultUserState();
    if (!raw || typeof raw !== 'object') return base;
    Object.keys(base).forEach(function (k) {
      if (raw[k] === undefined || raw[k] === null) {
        raw[k] = base[k];
      } else if (Array.isArray(base[k]) && !Array.isArray(raw[k])) {
        raw[k] = base[k];
      }
    });
    raw.version = 1;
    return raw;
  }

  var storage = {
    KEYS: KEYS,
    APP_VERSION: APP_VERSION,
    STORES: STORES,
    idbAvailable: idbAvailable,

    readUserState: function () { return migrateUserState(lsGet(KEYS.userState, null)); },
    writeUserState: function (state) { return lsSet(KEYS.userState, state); },

    readProfile: function () {
      var p = lsGet(KEYS.profile, null);
      return Object.assign(defaultProfile(), p || {});
    },
    writeProfile: function (p) { return lsSet(KEYS.profile, p); },

    readPreferences: function () {
      var p = lsGet(KEYS.preferences, null);
      return Object.assign(defaultPreferences(), p || {});
    },
    writePreferences: function (p) { return lsSet(KEYS.preferences, p); },

    readSeedVersion: function () { return lsGet(KEYS.seedVersion, null); },
    writeSeedVersion: function (v) { return lsSet(KEYS.seedVersion, v); },

    /** 种子版本迁移：只记录版本，绝不触碰用户状态 */
    syncSeedVersion: function (seedVersion) {
      var prev = storage.readSeedVersion();
      if (prev !== seedVersion) {
        storage.writeSeedVersion(seedVersion);
        return { from: prev, to: seedVersion, migrated: prev != null };
      }
      return { from: prev, to: seedVersion, migrated: false };
    },

    clearAll: function () {
      Object.keys(KEYS).forEach(function (k) { lsDel(KEYS[k]); });
      return Promise.all(STORES.map(idbClear)).catch(function () { return []; });
    },

    /* IndexedDB 封装 */
    getAll: idbGetAll,
    put: idbPut,
    remove: idbDelete,
    clearStore: idbClear,

    getPosts: function () { return idbGetAll('posts'); },
    putPost: function (post) { return idbPut('posts', post); },
    removePost: function (id) { return idbDelete('posts', id); },

    getNotes: function () { return idbGetAll('notes'); },
    putNote: function (note) { return idbPut('notes', note); },

    getHistoryStore: function () { return idbGetAll('history'); },
    putHistory: function (row) { return idbPut('history', row); },
    clearHistoryStore: function () { return idbClear('history'); },

    getDraft: function () { return idbGetAll('drafts'); },
    putDraft: function (row) { return idbPut('drafts', row); },
    removeDraft: function (id) { return idbDelete('drafts', id); },

    /* 兼容性提示：某些浏览器在 file:// 下禁用 IndexedDB */
    fallbackNotice: function () {
      return idbAvailable ? '' : '当前浏览器禁用了 IndexedDB，本机发布将仅保存在内存中（刷新后可能丢失）。';
    }
  };

  CR.storage = storage;
  CR.defaults = {
    userState: defaultUserState,
    profile: defaultProfile,
    preferences: defaultPreferences
  };
})(window);
