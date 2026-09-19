/* ==========================================================================
   js/router.js — Hash 路由
   支持：#/discover、#/detail/:id、#/calendar、#/publish、#/mine、#/onboarding
   兼容查询串：#/publish?edit=<id>
   ========================================================================== */
(function (global) {
  'use strict';

  var CR = (global.CampusRadar = global.CampusRadar || {});

  var ROUTES = [
    { name: 'discover', pattern: '#/discover', params: [] },
    { name: 'detail', pattern: '#/detail/:id', params: ['id'] },
    { name: 'calendar', pattern: '#/calendar', params: [] },
    { name: 'publish', pattern: '#/publish', params: [] },
    { name: 'mine', pattern: '#/mine', params: [] },
    { name: 'onboarding', pattern: '#/onboarding', params: [] }
  ];

  var DEFAULT_ROUTE = '#/discover';
  var handlers = [];
  var current = { name: null, params: {}, raw: '' };

  function toRegex(pattern) {
    // 先转义正则元字符（注意 \: 不是必需转义，":" 本身是字面量），
    // 再把 :param 转成捕获组；替换串不能用 "$&"，因此使用函数形式
    var escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var source = escaped.replace(/:([A-Za-z]+)/g, function () { return '([^/?]+)'; });
    return new RegExp('^' + source + '/?$');
  }

  ROUTES.forEach(function (r) { r.regex = toRegex(r.pattern); });

  /** 规范化 hash：空值补默认路由 */
  function normalize(hash) {
    if (!hash || hash === '#' || hash === '#/') return DEFAULT_ROUTE;
    return hash;
  }

  function parse(hash) {
    var raw = normalize(hash);
    var qIndex = raw.indexOf('?');
    var path = qIndex >= 0 ? raw.slice(0, qIndex) : raw;
    var query = {};
    if (qIndex >= 0) {
      raw.slice(qIndex + 1).split('&').forEach(function (kv) {
        if (!kv) return;
        var i = kv.indexOf('=');
        var k = i >= 0 ? kv.slice(0, i) : kv;
        var v = i >= 0 ? kv.slice(i + 1) : '';
        query[decodeURIComponent(k)] = decodeURIComponent(v);
      });
    }

    for (var i = 0; i < ROUTES.length; i++) {
      var r = ROUTES[i];
      var m = path.match(r.regex);
      if (m) {
        var params = {};
        r.params.forEach(function (p, idx) {
          params[p] = decodeURIComponent(m[idx + 1]);
        });
        return { name: r.name, params: params, query: query, raw: raw, path: path };
      }
    }
    return { name: 'notfound', params: {}, query: query, raw: raw, path: path };
  }

  function resolve() {
    var route = parse(global.location.hash);
    current = route;
    handlers.slice().forEach(function (fn) {
      try { fn(route); } catch (e) { console.error('[CampusRadar] 路由处理异常：', e); }
    });
    return route;
  }

  function navigate(target, replace) {
    var hash = normalize(target);
    if (replace) {
      var url = global.location.pathname + global.location.search + hash;
      global.history.replaceState(null, '', url);
      resolve();
    } else if (global.location.hash === hash) {
      resolve();
    } else {
      global.location.hash = hash;
    }
  }

  function onChange(fn) {
    handlers.push(fn);
    return function () {
      var i = handlers.indexOf(fn);
      if (i >= 0) handlers.splice(i, 1);
    };
  }

  function start() {
    if (!global.location.hash) {
      // 首次进入：写入默认路由，保持历史记录干净
      try {
        global.history.replaceState(null, '', global.location.pathname + global.location.search + DEFAULT_ROUTE);
      } catch (e) {
        global.location.hash = DEFAULT_ROUTE;
      }
    }
    global.addEventListener('hashchange', resolve);
    return resolve();
  }

  CR.router = {
    ROUTES: ROUTES,
    DEFAULT_ROUTE: DEFAULT_ROUTE,
    parse: parse,
    resolve: resolve,
    navigate: navigate,
    onChange: onChange,
    start: start,
    current: function () { return current; }
  };
})(window);
