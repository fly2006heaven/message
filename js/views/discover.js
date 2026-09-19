/* ==========================================================================
   js/views/discover.js — 发现页
   问候与日期 · 搜索 · 筛选（来源/类型/对象/条件/状态）· 排序
   今日焦点 · 截止雷达 · 机会卡片列表（风险信息折叠降权）
   ========================================================================== */
(function (global) {
  'use strict';

  var CR = (global.CampusRadar = global.CampusRadar || {});
  var U = CR.ui;
  var S = CR.store;

  var SOURCE_ORDER = ['school', 'college', 'project', 'contest', 'student', 'material', 'supplement', 'local'];

  var CATEGORY_ORDER = ['讲座', '竞赛', '招募', '志愿', '学习小组', '约球', '资料', '补充通知', '搭子', '交流', '其他'];

  function greeting() {
    var h = new Date().getHours();
    if (h < 6) return '夜深了';
    if (h < 11) return '早上好';
    if (h < 14) return '中午好';
    if (h < 18) return '下午好';
    return '晚上好';
  }

  function toggleList(arr, value) {
    var i = arr.indexOf(value);
    if (i >= 0) arr.splice(i, 1); else arr.push(value);
    return arr;
  }

  function chipGroup(label, options, selected, group) {
    var chips = options.map(function (o) {
      var on = selected.indexOf(o.key) >= 0;
      return '<button class="chip' + (on ? ' is-on' : '') + '" type="button" role="checkbox" ' +
        'aria-checked="' + on + '" data-filter="' + group + '" data-value="' + U.esc(o.key) + '">' +
        U.esc(o.label) +
        (o.count != null ? '<span class="chip__count">' + o.count + '</span>' : '') +
        '</button>';
    }).join('');
    return '<div class="filter-group">' +
      '<div class="filter-group__label">' + U.esc(label) + '</div>' +
      '<div class="chips">' + chips + '</div></div>';
  }

  function countBy(list, fn) {
    var map = {};
    list.forEach(function (op) {
      var k = fn(op);
      if (k == null) return;
      map[k] = (map[k] || 0) + 1;
    });
    return map;
  }

  function filterPanel(pool, prefs) {
    var srcCount = countBy(pool, function (o) { return o.sourceType; });
    var catCount = countBy(pool, function (o) { return o.category; });

    var sourceOptions = SOURCE_ORDER
      .filter(function (k) { return srcCount[k]; })
      .map(function (k) { return { key: k, label: CR.trust.sourceLabel(k), count: srcCount[k] }; });

    var categoryOptions = CATEGORY_ORDER
      .filter(function (c) { return catCount[c]; })
      .map(function (c) { return { key: c, label: c, count: catCount[c] }; });

    var audienceOptions = S.audienceKeys().map(function (a) {
      var n = pool.filter(function (op) { return S.matchAudience(op, a.key); }).length;
      return { key: a.key, label: a.label, count: n };
    });

    var condOptions = S.CONDITIONS.map(function (c) {
      var n = pool.filter(function (op) { return c.test(op); }).length;
      return { key: c.key, label: c.label, count: n };
    });

    var statusOptions = CR.conflict.STATUS_FILTERS.map(function (s) {
      var n = pool.filter(function (op) { return CR.conflict.matchStatusFilter(op, s.key); }).length;
      return { key: s.key, label: s.label, count: n };
    });

    var activeCount = prefs.sources.length + prefs.categories.length + prefs.audiences.length +
      prefs.conditions.length + prefs.statuses.length;

    return '<div class="filter-sheet">' +
      '<div class="filter-sheet__head">' +
        '<h3>筛选</h3>' +
        '<span class="tag">' + activeCount + ' 项生效</span>' +
        '<span class="spacer"></span>' +
        '<button class="btn btn--sm btn--ghost" type="button" data-action="resetFilters">重置</button>' +
        '<button class="btn btn--sm btn--ghost filter-close" type="button" data-action="closeFilters" ' +
          'aria-label="关闭筛选">✕</button>' +
      '</div>' +
      '<p class="t-small t-faint">数据为 2026-09-19 版本，共 ' + pool.length + ' 条机会（含本机发布）。</p>' +
      chipGroup('来源', sourceOptions, prefs.sources, 'sources') +
      chipGroup('类型', categoryOptions, prefs.categories, 'categories') +
      chipGroup('对象', audienceOptions, prefs.audiences, 'audiences') +
      chipGroup('条件', condOptions, prefs.conditions, 'conditions') +
      chipGroup('状态', statusOptions, prefs.statuses, 'statuses') +
      '<div class="divider"></div>' +
      '<button class="btn btn--primary btn--block" type="button" data-action="closeFilters">查看结果</button>' +
      '</div>';
  }

  function activeChips(prefs) {
    var chips = [];
    prefs.sources.forEach(function (k) { chips.push(['sources', k, CR.trust.sourceLabel(k)]); });
    prefs.categories.forEach(function (k) { chips.push(['categories', k, k]); });
    prefs.audiences.forEach(function (k) {
      var a = S.audienceKeys().filter(function (x) { return x.key === k; })[0];
      chips.push(['audiences', k, a ? a.label : k]);
    });
    prefs.conditions.forEach(function (k) {
      var c = S.CONDITIONS.filter(function (x) { return x.key === k; })[0];
      chips.push(['conditions', k, c ? c.label : k]);
    });
    prefs.statuses.forEach(function (k) {
      var s = CR.conflict.STATUS_FILTERS.filter(function (x) { return x.key === k; })[0];
      chips.push(['statuses', k, s ? s.label : k]);
    });
    if (prefs.query) chips.push(['query', prefs.query, '搜索：' + prefs.query]);
    return chips;
  }

  /**
   * 今日焦点：今天有时间点的活动，外加即将截止的高优先项。
   * 若系统时间与数据基准日差距较大导致「今天」为空，则回退为按基准日计算的最接近事件，
   * 保证该区块始终有可读内容，且不编造任何信息。
   */
  function focusList(pool, fallbackLabel) {
    var now = Date.now();
    var today = pool.filter(function (op) {
      return (op.startTime && CR.date.isSameDay(op.startTime, now)) ||
        (op.deadline && CR.date.isSameDay(op.deadline, now));
    });
    var urgent = pool.filter(function (op) {
      return op.deadline && op.deadline - now > 0 && op.deadline - now <= CR.date.DAY &&
        today.indexOf(op) < 0;
    });
    var list = today.concat(urgent);
    if (list.length) return { list: list, relative: true };

    // 回退：以数据基准日为「今天」，展示当天与次日事件
    var base = CR.seed.SEED_BASE + 12 * CR.date.HOUR;
    var baseList = pool.filter(function (op) {
      return (op.startTime && op.startTime >= base && op.startTime - base <= 2 * CR.date.DAY) ||
        (op.deadline && op.deadline >= base && op.deadline - base <= 2 * CR.date.DAY);
    });
    return { list: baseList, relative: false };
  }

  function render(root) {
    var prefs = S.state.preferences;
    var profile = S.state.profile;
    var pool = S.allOpportunities();
    var filtered = S.filterOpportunities();
    var sorted = S.sortOpportunities(filtered, prefs.sort);
    var split = S.splitByRisk(sorted);
    var now = Date.now();

    var focus = focusList(S.filterOpportunities({ ignoreHidden: true, includeHidden: true }));
    var radar = CR.conflict.deadlineRadar(S.allOpportunities(), { includePassed: true })
      .filter(function (r) { return !S.isHidden(r.op.id); })
      .slice(0, 7);

    var chips = activeChips(prefs);
    var guardOn = !!profile.guardMode;

    var html = '';

    /* —— 顶部问候 —— */
    html += '<header class="hero"><div class="hero__inner">' +
      '<span class="hero__date">' + U.icon('calendar') +
        ' 2026年9月19日，周六 · 数据版本 ' + U.esc(CR.seed.SEED_VERSION) + '</span>' +
      '<h1 class="hero__title">' + greeting() + '，欢迎使用' + U.esc(S.BRAND.name) +
        (guardOn ? '<span class="badge badge--open" style="margin-left:8px">' + U.icon('shield') + '新生护航已开启</span>' : '') +
      '</h1>' +
      '<p class="hero__sub">帮你看懂来源、对象、截止、是否需要审核，以及哪些信息有风险。</p>' +
      '<div class="hero__search searchbar">' + U.icon('search') +
        '<label class="sr-only" for="q">搜索机会</label>' +
        '<input id="q" type="search" placeholder="搜索标题、标签、来源、地点，例如：零基础 / Git / 志愿" ' +
          'value="' + U.esc(prefs.query) + '" data-action="search" autocomplete="off" />' +
        (prefs.query ? '<button class="searchbar__clear" type="button" data-action="clearQuery" aria-label="清空搜索">✕</button>' : '') +
      '</div>' +
      '<div class="hero__actions">' +
        '<button class="btn btn--ghost btn--sm" type="button" data-action="openFilters">' +
          U.icon('filter') + '筛选' + (chips.length ? '（' + chips.length + '）' : '') + '</button>' +
        (guardOn
          ? '<button class="btn btn--secondary btn--sm" type="button" data-action="toggleGuard">' +
            U.icon('shield') + '关闭新生护航模式</button>'
          : '<a class="btn btn--secondary btn--sm" href="#/onboarding">' + U.icon('spark') + '开启新生护航模式</a>') +
        '<span class="tag">共 ' + pool.length + ' 条机会</span>' +
      '</div>' +
      '</div></header>';

    html += '<div class="view">';

    /* 未完成引导时的温和提示（不强制跳转） */
    if (!profile.onboarded) {
      html += U.banner('info', '先花 20 秒完成新生引导？',
        '选择年级、兴趣与每周可投入时间后，雷达会按你的情况给出推荐理由。' +
        '<a href="#/onboarding">前往新生引导 →</a>', 'spark');
      html += '<div style="height:12px"></div>';
    }

    /* —— 今日焦点 —— */
    html += '<section class="section" aria-labelledby="focusTitle">' +
      '<div class="section__head"><h2 id="focusTitle">今日焦点</h2>' +
      '<span class="section__hint">' +
        (focus.relative ? '今天 / 24 小时内截止' : '数据基准日 ' + U.esc(CR.seed.BASE_LABEL) + ' 前后两天') +
      '</span></div>';
    if (focus.list.length) {
      html += '<div class="pulse-strip">' + focus.list.map(CR.card.pulseCard).join('') + '</div>';
    } else {
      html += '<div class="empty"><div class="empty__art">' +
        '<svg viewBox="0 0 96 96" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">' +
        '<circle cx="48" cy="48" r="30"/><path d="M48 30v18l12 8"/></svg></div>' +
        '<h3>今天暂时没有时间点明确的活动</h3>' +
        '<p>可以先看看下方的截止雷达与全部机会。</p></div>';
    }
    html += '</section>';

    /* —— 布局：筛选 + 结果 —— */
    html += '<div class="discover-layout" style="margin-top:24px">';
    // 筛选面板：移动端为底部抽屉（点遮罩或 ✕ 关闭），桌面端为常驻侧栏
    html += '<div class="filter-aside' + (prefs.__open ? ' is-open' : '') + '">' +
      '<div class="filter-aside__scrim" data-action="closeFilters" aria-hidden="true"></div>' +
      filterPanel(pool, prefs) +
      '</div>';
    html += '<div class="discover-results">';

    /* 截止雷达 */
    html += '<section class="section" style="margin-top:0" aria-labelledby="radarTitle">' +
      '<div class="section__head"><h2 id="radarTitle">截止雷达</h2>' +
      '<span class="section__hint">按截止时间排序 · 含已截止</span></div>' +
      '<div class="deadline-radar">' + radar.map(CR.card.deadlineItem).join('') + '</div>' +
      '</section>';

    /* 结果工具条 */
    html += '<section class="section" aria-labelledby="listTitle">' +
      '<div class="section__head"><h2 id="listTitle">机会列表</h2></div>' +
      '<div class="result-bar">' +
        '<span class="result-bar__count">' + split.normal.length + ' 条结果' +
          (split.risky.length ? ' · 另有 ' + split.risky.length + ' 条风险信息已折叠' : '') + '</span>' +
        '<label class="sr-only" for="sort">排序方式</label>' +
        '<select class="sort-select" id="sort" data-action="sort">' +
          S.SORTS.map(function (s) {
            return '<option value="' + s.key + '"' + (prefs.sort === s.key ? ' selected' : '') + '>' +
              U.esc(s.label) + '</option>';
          }).join('') +
        '</select>' +
      '</div>';

    /* 已选条件 */
    if (chips.length) {
      html += '<div class="chips" style="margin-bottom:12px">' +
        chips.map(function (c) {
          return '<button class="chip is-on" type="button" data-action="removeChip" data-group="' + c[0] +
            '" data-value="' + U.esc(c[1]) + '" title="移除该条件">' + U.esc(c[2]) + ' ✕</button>';
        }).join('') +
        '<button class="chip" type="button" data-action="resetFilters">清空全部</button>' +
        '</div>';
    }

    /* 列表 */
    if (!split.normal.length) {
      html += U.empty({
        title: '没有匹配的机会',
        text: '试着放宽筛选条件，或清空搜索词。',
        action: { href: '#/discover', label: '重置筛选' }
      });
      if (split.risky.length) {
        html += riskFold(split.risky, false);
      }
    } else {
      html += '<div class="card-list">' + split.normal.map(function (op) {
        return CR.card.opportunityCard(op, { profile: profile });
      }).join('') + '</div>';
      if (split.risky.length) html += riskFold(split.risky, true);
    }

    html += '</section></div></div></div>';

    root.innerHTML = html;
  }

  /** 风险信息折叠区：默认收起，并明确标注 */
  function riskFold(list, open) {
    return '<details class="fold"' + (open ? '' : '') + '>' +
      '<summary>' + U.icon('shield') + '风险 / 疑似推广信息（' + list.length + ' 条，已降低推荐权重）</summary>' +
      '<div class="fold__body">' +
        '<p class="t-small t-muted" style="margin-bottom:10px">' +
          '以下信息来自学生个人发布，主办方、地点或完整内容缺失，请勿添加私人微信、转账或提供个人证件信息。' +
        '</p>' +
        '<div class="card-list card-list--single">' +
          list.map(function (op) {
            return CR.card.opportunityCard(op, { hideRiskNote: false });
          }).join('') +
        '</div>' +
      '</div></details>';
  }

  var discover = {
    title: '发现',
    render: render,
    /* 交给 app.js 调用的过滤器操作 */
    setQuery: function (q) {
      S.savePreferences({ query: q });
    },
    toggleFilter: function (group, value) {
      var prefs = S.state.preferences;
      var arr = (prefs[group] || []).slice();
      toggleList(arr, value);
      var patch = {};
      patch[group] = arr;
      S.savePreferences(patch);
    },
    removeChip: function (group, value) {
      var prefs = S.state.preferences;
      if (group === 'query') {
        S.savePreferences({ query: '' });
        return;
      }
      var arr = (prefs[group] || []).filter(function (x) { return x !== value; });
      var patch = {};
      patch[group] = arr;
      S.savePreferences(patch);
    },
    resetFilters: function () {
      S.resetPreferences();
    }
  };

  CR.views = CR.views || {};
  CR.views.discover = discover;
})(window);
