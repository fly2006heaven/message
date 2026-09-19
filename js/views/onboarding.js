/* ==========================================================================
   js/views/onboarding.js — 新生引导页
   年级 / 兴趣 / 基础 / 每周可投入时间 → 开启“新生护航模式”
   推荐理由全部来自题目已提供的信息，不编造任何数据。
   ========================================================================== */
(function (global) {
  'use strict';

  var CR = (global.CampusRadar = global.CampusRadar || {});
  var U = CR.ui;
  var S = CR.store;

  var STEPS = [
    { key: 'grade', title: '你是哪个年级？', desc: '用于匹配“面向大一/大二及以上”的活动。' },
    { key: 'interests', title: '你对哪些方向感兴趣？', desc: '可多选，用于匹配标签（如编程、AI、科研）。' },
    { key: 'foundation', title: '你的基础情况？', desc: '用于优先展示“零基础可参加”的机会。' },
    { key: 'hoursPerWeek', title: '每周大约能投入多少时间？', desc: '用于避开每周投入要求过高的长期项目。' }
  ];

  var draft = { step: 0, grade: '', interests: [], foundation: '', hoursPerWeek: '', guardMode: true };
  var synced = false;   // 只在首次进入时同步档案，避免覆盖用户当前正在做的选择
  var visited = {};     // 记录用户已主动选择过的字段（含空选择）

  /** 把已保存的档案带入草稿（仅首次渲染时执行一次） */
  function syncFromProfile() {
    if (synced) return;
    synced = true;
    var p = S.state.profile;
    if (!visited.grade) draft.grade = p.grade || draft.grade;
    if (!visited.interests) draft.interests = (p.interests || []).slice();
    if (!visited.foundation) draft.foundation = p.foundation || draft.foundation;
    if (!visited.hoursPerWeek) draft.hoursPerWeek = p.hoursPerWeek || draft.hoursPerWeek;
    draft.guardMode = p.onboarded ? !!p.guardMode : true;
  }

  function choice(options, value, group, multi) {
    var sel = multi ? (value || []) : [value];
    return '<div class="choice-grid">' + options.map(function (o) {
      var key = o.key != null ? o.key : o;
      var label = o.label != null ? o.label : o;
      var desc = o.desc || '';
      var on = sel.indexOf(key) >= 0;
      return '<button class="choice' + (on ? ' is-on' : '') + '" type="button" data-action="pick" ' +
        'data-group="' + group + '" data-value="' + U.esc(key) + '" data-multi="' + !!multi + '" ' +
        'role="' + (multi ? 'checkbox' : 'radio') + '" aria-checked="' + on + '">' +
        '<span class="choice__title">' + U.esc(label) + (on ? '<span class="choice__check">✓</span>' : '') + '</span>' +
        (desc ? '<span class="choice__desc">' + U.esc(desc) + '</span>' : '') +
        '</button>';
    }).join('') + '</div>';
  }

  function stepIndicator() {
    return '<div class="steps">' + STEPS.map(function (s, i) {
      var n = i + 1;
      var cls = 'step-dot' + (draft.step === i ? ' is-on' : '') + (draft.step > i ? ' is-done' : '');
      return '<span class="' + cls + '"><span class="step-dot__num">' + (draft.step > i ? '✓' : n) + '</span>' +
        U.esc(s.title.replace(/[？?]/g, '')) + '</span>' + (n < STEPS.length ? '<span class="step-sep"></span>' : '');
    }).join('') + '</div>';
  }

  /** 基于所选档案，给出推荐预览（只使用已有数据） */
  function preview() {
    var profile = {
      grade: draft.grade, interests: draft.interests,
      foundation: draft.foundation, hoursPerWeek: draft.hoursPerWeek, guardMode: true
    };
    var pool = S.allOpportunities().filter(function (op) {
      return op.riskLevel !== 'high' && op.riskLevel !== 'suspect' && !S.isHidden(op.id);
    });
    var list = S.sortOpportunities(pool, 'friendly').slice(0, 4);
    return '<div class="card-list card-list--single">' + list.map(function (op) {
      return CR.card.opportunityCard(op, { profile: profile });
    }).join('') + '</div>';
  }

  function render(root) {
    syncFromProfile();
    var total = STEPS.length;
    var done = draft.step >= total;

    var html = '<div class="view view--narrow">';

    html += '<div class="section__head"><h1 style="font-size:24px">新生引导</h1>' +
      '<span class="section__hint">' + Math.min(draft.step + 1, total) + ' / ' + total + '</span></div>';

    html += U.banner('info', '开启“新生护航模式”后会发生什么？',
      '雷达会按你的年级、兴趣、基础与时间预算，给每张卡片补充推荐理由（例如“零基础可参加”“面向全校”' +
      '“今天 19:00”“无需报名”“截止临近”“需预约，提交不代表录取”）。这些理由全部来自已有信息，不会编造。',
      'shield');

    html += '<div style="height:16px"></div>';

    if (done) {
      /* 完成页 */
      var p = S.state.profile;
      html += '<section class="panel">' +
        '<h2 style="font-size:20px;margin-bottom:8px">设置完成 🎉</h2>' +
        '<p class="t-muted">你的选择已保存在本机（localStorage），随时可以在“我的 → 新生模式设置”里修改。</p>' +
        '<div class="divider"></div>' +
        '<div class="profile-line">' +
          '<span class="badge badge--school">年级：' + U.esc(label(CR.views.mine.GRADES, draft.grade) || '未选择') + '</span>' +
          '<span class="badge badge--student">兴趣：' +
            U.esc(draft.interests.length ? draft.interests.join('、') : '未选择') + '</span>' +
          '<span class="badge badge--college">基础：' +
            U.esc(label(CR.views.mine.FOUNDATIONS, draft.foundation) || '未选择') + '</span>' +
          '<span class="badge badge--project">每周：' +
            U.esc(label(CR.views.mine.HOURS, draft.hoursPerWeek) || '未选择') + '</span>' +
          '<span class="badge ' + (draft.guardMode ? 'badge--open' : 'badge--ended') + '">新生护航：' +
            (draft.guardMode ? '开启' : '关闭') + '</span>' +
        '</div>' +
        '<div class="row" style="margin-top:16px">' +
          '<button class="btn btn--primary" type="button" data-action="finish">' +
            U.icon('radar') + '进入发现页</button>' +
          '<button class="btn btn--ghost" type="button" data-action="restart">重新选择</button>' +
        '</div>' +
        '</section>';
      html += '<div class="section"><div class="section__head"><h2 style="font-size:18px">为你预览的推荐</h2>' +
        '<span class="section__hint">按新生友好度排序</span></div>' + preview() + '</div>';
    } else {
      var s = STEPS[draft.step];
      var body = '';
      if (s.key === 'grade') body = choice(CR.views.mine.GRADES, draft.grade, 'grade', false);
      if (s.key === 'interests') body = choice(CR.views.mine.INTERESTS.map(function (i) {
        return { key: i, label: i };
      }), draft.interests, 'interests', true);
      if (s.key === 'foundation') body = choice(CR.views.mine.FOUNDATIONS, draft.foundation, 'foundation', false);
      if (s.key === 'hoursPerWeek') body = choice(CR.views.mine.HOURS, draft.hoursPerWeek, 'hoursPerWeek', false);

      html += '<section class="panel">' +
        stepIndicator() +
        '<h2 style="font-size:20px;margin:12px 0 4px">' + U.esc(s.title) + '</h2>' +
        '<p class="t-muted t-small" style="margin-bottom:14px">' + U.esc(s.desc) + '</p>' +
        body +
        '<div class="field" style="margin-top:16px"><label class="checkline">' +
          '<input type="checkbox" data-action="guardCheck"' + (draft.guardMode ? ' checked' : '') + ' />' +
          '<span>同时开启<strong>新生护航模式</strong>' +
          '<br><span class="field__hint">关闭后仍会保存档案，但列表不显示推荐理由。</span></span>' +
        '</label></div>' +
        '<div class="row" style="margin-top:16px">' +
          (draft.step > 0
            ? '<button class="btn btn--ghost" type="button" data-action="prev">' + U.icon('back') + '上一步</button>'
            : '<button class="btn btn--ghost" type="button" data-action="skip">跳过（先自己逛逛）</button>') +
          '<span class="spacer"></span>' +
          '<button class="btn btn--primary" type="button" data-action="next">' +
            (draft.step === total - 1 ? '完成设置' : '下一步') + '</button>' +
        '</div>' +
        '</section>';
    }

    html += '<div class="section"><div class="section__head"><h2 style="font-size:18px">关于数据</h2></div>' +
      U.banner('info', '我们只使用已有的信息',
        '种子数据版本 ' + U.esc(CR.seed.SEED_VERSION) + '（基准 ' + U.esc(CR.seed.BASE_LABEL) + '）。' +
        '凡未提供的信息，页面统一显示“未注明，请以主办方通知为准”，不做任何推断或补全。', 'question') +
      '</div>';

    html += '</div>';
    root.innerHTML = html;
  }

  function label(options, key) {
    var o = options.filter(function (x) { return x.key === key; })[0];
    return o ? o.label : '';
  }

  function validStep() {
    var k = STEPS[draft.step].key;
    if (k === 'grade') return !!draft.grade;
    if (k === 'foundation') return !!draft.foundation;
    if (k === 'hoursPerWeek') return !!draft.hoursPerWeek;
    return true; // 兴趣可跳过
  }

  CR.views = CR.views || {};
  CR.views.onboarding = {
    title: '新生引导',
    render: render,
    pick: function (group, value, multi) {
      visited[group] = true;
      if (multi) {
        var arr = draft[group] || [];
        var i = arr.indexOf(value);
        if (i >= 0) arr.splice(i, 1); else arr.push(value);
        draft[group] = arr;
      } else {
        draft[group] = value;
      }
    },
    setGuard: function (on) { draft.guardMode = !!on; },
    next: function () {
      if (!validStep()) {
        CR.toast.warn('请先选择一项再继续（兴趣可跳过）');
        return false;
      }
      draft.step = Math.min(STEPS.length, draft.step + 1);
      return true;
    },
    prev: function () { draft.step = Math.max(0, draft.step - 1); },
    restart: function () { draft.step = 0; },
    /** 允许外部（例如重新做引导）强制重新同步档案 */
    resync: function () { synced = false; visited = {}; syncFromProfile(); },
    skip: function () {
      S.saveProfile({ onboarded: true, guardMode: false });
      CR.toast.info('已跳过引导，你随时可以回来开启新生护航模式');
      return true;
    },
    finish: function () {
      S.saveProfile({
        onboarded: true,
        guardMode: !!draft.guardMode,
        grade: draft.grade,
        interests: draft.interests,
        foundation: draft.foundation,
        hoursPerWeek: draft.hoursPerWeek
      });
      CR.toast.success(draft.guardMode ? '新生护航模式已开启' : '档案已保存（护航模式关闭）');
      return true;
    },
    draft: function () { return draft; }
  };
})(window);
