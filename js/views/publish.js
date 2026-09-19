/* ==========================================================================
   js/views/publish.js — 发布页（学生自主发布）
   分步表单 · 自动保存草稿（IndexedDB）· 发布后进入发现/日历/收藏流程
   发布内容标注“本机发布，仅本机可见；纯前端模拟”，缺失信息自动提示“待确认”
   ========================================================================== */
(function (global) {
  'use strict';

  var CR = (global.CampusRadar = global.CampusRadar || {});
  var U = CR.ui;
  var S = CR.store;

  var TYPES = [
    { key: '约球', desc: '运动、约球、组局', beginner: false },
    { key: '搭子', desc: '找学习/兴趣搭子', beginner: true },
    { key: '招募', desc: '招人或找队友', beginner: false },
    { key: '交流', desc: '交流分享、线下闲聊', beginner: true },
    { key: '其他', desc: '以上都不是', beginner: false }
  ];

  var form = blank();
  var step = 1;
  var editingId = null;
  var errors = {};

  function blank() {
    return {
      title: '',
      category: '约球',
      startDate: '',
      startTime: '',
      endTime: '',
      deadline: '',
      location: '',
      online: false,
      people: '',
      fee: '',
      audience: '',
      signupMethod: '',
      notes: '',
      longTerm: false,
      needReview: false,
      beginnerFriendly: false,
      author: '本机用户'
    };
  }

  /** 读取并校验草稿 */
  function restoreDraft() {
    var d = S.getDraft();
    if (!d || !d.data) return false;
    form = Object.assign(blank(), d.data);
    step = d.step || 1;
    return true;
  }

  function loadForEdit(id) {
    var p = S.state.posts.filter(function (x) { return String(x.id) === String(id); })[0];
    if (!p) return false;
    editingId = p.id;
    form = {
      title: p.title || '',
      category: p.category || '其他',
      startDate: p.startTime ? CR.date.toLocalInput(p.startTime).slice(0, 10) : '',
      startTime: p.startTime ? CR.date.toLocalInput(p.startTime).slice(11, 16) : '',
      endTime: p.endTime ? CR.date.toLocalInput(p.endTime).slice(11, 16) : '',
      deadline: p.deadline ? CR.date.toLocalInput(p.deadline) : '',
      location: p.location || '',
      online: p.online === true,
      people: p.people || '',
      fee: p.fee || '',
      audience: p.audience || '',
      signupMethod: p.signupMethod || '',
      notes: p.notes || '',
      longTerm: !!p.longTerm,
      needReview: !!p.needReview,
      beginnerFriendly: !!p.beginnerFriendly,
      author: p.author || '本机用户'
    };
    step = 1;
    return true;
  }

  function resetForm() {
    form = blank();
    step = 1;
    editingId = null;
    errors = {};
  }

  /* --------------------------------------------------------- 校验 -------- */
  function validate(currentStep, forPublish) {
    var e = {};
    if (currentStep >= 1) {
      if (!form.title.trim()) e.title = '请填写标题，便于同学搜索到。';
      else if (form.title.trim().length < 4) e.title = '标题太短，建议写清做什么（至少 4 个字）。';
      if (!form.startDate && !form.longTerm) e.startDate = '请选择活动日期，或勾选“长期有效”。';
      if (form.deadline && form.startDate) {
        var dl = new Date(form.deadline).getTime();
        var st = new Date(form.startDate + 'T' + (form.startTime || '00:00')).getTime();
        if (dl > st) e.deadline = '报名截止不应晚于活动开始时间。';
      }
    }
    if (currentStep >= 3) {
      if (!form.signupMethod.trim() && !forPublish) e.signupMethod = '建议填写报名方式；留空将显示为“待确认”。';
    }
    errors = e;
    return e;
  }

  function combineDateTime(dateStr, timeStr) {
    if (!dateStr) return null;
    var t = timeStr || '00:00';
    return CR.date.fromLocalInput(dateStr + 'T' + t);
  }

  /* --------------------------------------------------------- 渲染 -------- */
  function field(opts) {
    var err = errors[opts.name];
    var req = opts.required ? '<span class="req" aria-hidden="true">*</span>' : '';
    var id = 'f-' + opts.name;
    var control;
    if (opts.type === 'textarea') {
      control = '<textarea class="textarea" id="' + id + '" name="' + opts.name + '" data-field="' + opts.name + '"' +
        ' placeholder="' + U.esc(opts.placeholder || '') + '"' +
        (err ? ' aria-invalid="true" aria-describedby="' + id + '-err"' : '') + '>' +
        U.esc(opts.value || '') + '</textarea>';
    } else if (opts.type === 'select') {
      control = '<select class="select" id="' + id + '" name="' + opts.name + '" data-field="' + opts.name + '"' +
        (err ? ' aria-invalid="true"' : '') + '>' +
        opts.options.map(function (o) {
          return '<option value="' + U.esc(o) + '"' + (o === opts.value ? ' selected' : '') + '>' +
            U.esc(o) + '</option>';
        }).join('') + '</select>';
    } else {
      control = '<input class="input" id="' + id + '" name="' + opts.name + '" type="' + (opts.type || 'text') + '"' +
        ' data-field="' + opts.name + '" value="' + U.esc(opts.value || '') + '"' +
        ' placeholder="' + U.esc(opts.placeholder || '') + '"' +
        (err ? ' aria-invalid="true" aria-describedby="' + id + '-err"' : '') + ' />';
    }
    return '<div class="field">' +
      '<label class="field__label" for="' + id + '">' + U.esc(opts.label) + req +
        (opts.optional ? '<span class="t-faint" style="font-weight:400">（选填）</span>' : '') + '</label>' +
      control +
      (opts.hint ? '<div class="field__hint">' + U.esc(opts.hint) + '</div>' : '') +
      (err ? '<div class="field__error" id="' + id + '-err">' + U.icon('alert') + U.esc(err) + '</div>' : '') +
      '</div>';
  }

  function checkLine(name, label, hint, checked) {
    return '<div class="field"><label class="checkline">' +
      '<input type="checkbox" data-field="' + name + '"' + (checked ? ' checked' : '') + ' />' +
      '<span>' + U.esc(label) + (hint ? '<br><span class="field__hint">' + U.esc(hint) + '</span>' : '') + '</span>' +
      '</label></div>';
  }

  function stepIndicator() {
    var labels = ['基本信息', '参与条件', '报名方式'];
    return '<div class="steps" role="list">' + labels.map(function (l, i) {
      var n = i + 1;
      var cls = 'step-dot' + (step === n ? ' is-on' : '') + (step > n ? ' is-done' : '');
      return '<span class="' + cls + '" role="listitem"><span class="step-dot__num">' +
        (step > n ? '✓' : n) + '</span>' + U.esc(l) + '</span>' +
        (n < labels.length ? '<span class="step-sep"></span>' : '');
    }).join('') + '</div>';
  }

  function previewCard() {
    var draftPost = {
      id: 'preview',
      title: form.title || '（未填写标题）',
      category: form.category,
      startTime: combineDateTime(form.startDate, form.startTime),
      endTime: form.endTime ? combineDateTime(form.startDate, form.endTime) : null,
      deadline: form.deadline ? CR.date.fromLocalInput(form.deadline) : null,
      location: form.location,
      people: form.people,
      fee: form.fee,
      audience: form.audience,
      signupMethod: form.signupMethod,
      notes: form.notes,
      longTerm: form.longTerm,
      needReview: form.needReview,
      beginnerFriendly: form.beginnerFriendly,
      locationPending: !form.location.trim(),
      createdAt: Date.now()
    };
    var op = S.postToOpportunity(draftPost);
    op.status = CR.conflict.statusOf(op);
    return '<section class="panel">' +
      '<div class="section__head" style="margin-bottom:8px"><h2 style="font-size:18px">预览</h2>' +
      '<span class="section__hint">发布后即为卡片样式</span></div>' +
      CR.card.opportunityCard(op, { hideRiskNote: true }) +
      (op.missingFields.length
        ? '<div class="banner banner--pending" style="margin-top:12px">' + U.icon('question') +
          '<div><div class="banner__title">待确认</div><div class="banner__text">' +
          '以下信息尚未填写：' + U.esc(op.missingFields.join('、')) +
          '。发布后卡片会显示“待确认”，同学可据此判断。</div></div></div>'
        : '<div class="banner banner--info" style="margin-top:12px">' + U.icon('check') +
          '<div><div class="banner__title">信息完整度良好</div><div class="banner__text">' +
          '关键字段都已填写，发布后会有更好的可读性。</div></div></div>') +
      '</section>';
  }

  function formStep() {
    if (step === 1) {
      return '<div class="stack-lg">' +
        field({
          name: 'title', label: '标题', required: true, value: form.title,
          placeholder: '例如：周三晚图书馆自习搭子', hint: '写清“做什么 + 什么时候”，同学更容易搜到。'
        }) +
        '<div class="field">' +
          '<div class="field__label">类型<span class="req">*</span></div>' +
          '<div class="choice-grid">' + TYPES.map(function (t) {
            var on = form.category === t.key;
            return '<button class="choice' + (on ? ' is-on' : '') + '" type="button" data-action="pickType" ' +
              'data-value="' + U.esc(t.key) + '" role="radio" aria-checked="' + on + '">' +
              '<span class="choice__title">' + U.esc(t.key) +
              (on ? '<span class="choice__check">✓</span>' : '') + '</span>' +
              '<span class="choice__desc">' + U.esc(t.desc) + '</span></button>';
          }).join('') + '</div></div>' +
        '<div class="row" style="gap:12px;align-items:flex-start">' +
          '<div style="flex:1 1 160px">' + field({
            name: 'startDate', label: '活动日期', required: !form.longTerm, type: 'date',
            value: form.startDate, hint: form.longTerm ? '已勾选长期有效，可留空' : '未填且未勾选长期 → 显示“待确认”'
          }) + '</div>' +
          '<div style="flex:1 1 120px">' + field({
            name: 'startTime', label: '开始时间', optional: true, type: 'time', value: form.startTime
          }) + '</div>' +
          '<div style="flex:1 1 120px">' + field({
            name: 'endTime', label: '结束时间', optional: true, type: 'time', value: form.endTime
          }) + '</div>' +
        '</div>' +
        field({
          name: 'location', label: '地点', optional: true, value: form.location,
          placeholder: '例如：东区体育馆 3 号场；不确定可写“待定”',
          hint: '留空发布会显示“地点待确认”。'
        }) +
        field({
          name: 'deadline', label: '报名截止', optional: true, type: 'datetime-local', value: form.deadline,
          hint: '填写后会出现在截止雷达与日历中。'
        }) +
        checkLine('longTerm', '长期有效（不定截止）', '例如长期招募、长期开放的搭子群', form.longTerm) +
        '</div>';
    }

    if (step === 2) {
      return '<div class="stack-lg">' +
        field({
          name: 'people', label: '人数', optional: true, value: form.people,
          placeholder: '例如：6—8 人 / 限 20 人'
        }) +
        field({
          name: 'fee', label: '费用说明', optional: true, value: form.fee,
          placeholder: '例如：费用 AA / 免费 / 每人 20 元',
          hint: '留空发布会显示“未注明，请以主办方通知为准”。'
        }) +
        field({
          name: 'audience', label: '适用对象', optional: true, value: form.audience,
          placeholder: '例如：全校学生 / 仅限大一 / 不限专业'
        }) +
        checkLine('beginnerFriendly', '零基础也欢迎', '勾选后会在卡片与筛选中体现“零基础”条件', form.beginnerFriendly) +
        field({
          name: 'notes', label: '补充说明', optional: true, type: 'textarea', value: form.notes,
          placeholder: '例如：自带球拍 / 有场地信息会在群里同步'
        }) +
        '</div>';
    }

    return '<div class="stack-lg">' +
      field({
        name: 'signupMethod', label: '报名方式', optional: true, value: form.signupMethod,
        placeholder: '例如：在本页留言 / 添加发起人 QQ / 到现场直接参加',
        hint: '请勿使用需要转账或提供身份证信息的方式。'
      }) +
      checkLine('needReview', '需要审核', '勾选后会提示“提交报名表不代表最终录取”', form.needReview) +
      U.banner('info', '发布前请确认',
        '本机发布的内容仅保存在你自己的浏览器（IndexedDB），不会上传到任何服务器，其他人看不到。' +
        '请勿发布涉及转账、私人微信、身份证等敏感信息。', 'shield') +
      '</div>';
  }

  function myPostsPanel() {
    var list = S.state.posts;
    if (!list.length) {
      return U.empty({
        title: '还没有本机发布',
        text: '在上面填写表单发布后，会出现在这里，也会进入发现页与日历。'
      });
    }
    return '<div class="stack">' + list.map(function (p) {
      var op = S.postToOpportunity(p);
      var status = CR.trust.statusOf(CR.conflict.statusOf(op));
      return '<div class="mini-item" data-op="' + U.esc(p.id) + '">' +
        '<div class="mini-item__main">' +
          '<div class="mini-item__title"><a href="#/detail/' + U.esc(p.id) + '">' + U.esc(p.title) + '</a></div>' +
          '<div class="mini-item__sub">' +
            U.esc(p.category) + ' · ' +
            (op.startTime ? U.esc(CR.date.fmtDateShort(op.startTime)) : '时间待确认') + ' · ' +
            U.esc(status.label) +
            (op.missingFields.length ? ' · 待确认：' + U.esc(op.missingFields.join('、')) : '') +
          '</div>' +
        '</div>' +
        '<div class="mini-item__actions">' +
          '<button class="btn btn--sm btn--ghost" type="button" data-action="editPost" data-id="' +
            U.esc(p.id) + '">' + U.icon('edit') + '编辑</button>' +
          '<button class="btn btn--sm btn--danger" type="button" data-action="removePost" data-id="' +
            U.esc(p.id) + '">' + U.icon('trash') + '下架</button>' +
        '</div></div>';
    }).join('') + '</div>';
  }

  function render(root) {
    var notice = CR.store.state.notices.filter(function (msg) { return /IndexedDB/.test(msg); })[0];

    var html = '<div class="view"><div class="discover-layout">';

    /* 表单区 */
    html += '<div>';
    html += '<section class="panel">' +
      '<div class="section__head"><h1 style="font-size:22px">' +
        (editingId ? '编辑本机发布' : '发布一个机会') + '</h1>' +
        '<span class="section__hint">' + (editingId ? '编号 ' + U.esc(editingId) : '分 3 步，约 1 分钟') + '</span>' +
      '</div>' +
      U.banner('info', '本机发布，仅本机可见；纯前端模拟',
        '发布内容保存在你浏览器的 IndexedDB 中，不会真正对外提交，也不会被其他同学看到。' +
        (notice ? '<br>' + U.esc(notice) : ''), 'home') +
      '<div style="height:16px"></div>' +
      stepIndicator() +
      '<form id="publishForm" novalidate>' + formStep() + '</form>' +
      '<div class="row" style="margin-top:20px">' +
        (step > 1
          ? '<button class="btn btn--ghost" type="button" data-action="prevStep">' + U.icon('back') + '上一步</button>'
          : '<button class="btn btn--ghost" type="button" data-action="resetForm">清空表单</button>') +
        '<span class="spacer"></span>' +
        (step < 3
          ? '<button class="btn btn--primary" type="button" data-action="nextStep">下一步</button>'
          : '<button class="btn btn--primary" type="button" data-action="publish">' +
            U.icon('check') + (editingId ? '保存修改' : '立即发布') + '</button>') +
        (editingId
          ? '<button class="btn btn--ghost" type="button" data-action="cancelEdit">取消编辑</button>' : '') +
      '</div>' +
      '<p class="t-small t-faint" style="margin-top:10px">输入内容会自动保存为草稿（IndexedDB），刷新后可继续填写。</p>' +
      '</section>';

    html += '<div style="height:16px"></div>';
    html += previewCard();

    html += '<div style="height:16px"></div>';
    html += '<section class="panel">' +
      '<div class="section__head" style="margin-bottom:10px"><h2 style="font-size:18px">我的发布</h2>' +
      '<span class="section__hint">' + S.state.posts.length + ' 条 · 可编辑/下架</span></div>' +
      myPostsPanel() +
      '</section>';

    html += '</div>';

    /* 右列：发布须知 */
    html += '<aside class="discover-aside"><section class="panel">' +
      '<h2 style="font-size:18px;margin-bottom:10px">发布须知</h2>' +
      '<ul class="stack t-small" style="color:var(--text-2)">' +
      '<li>· 信息尽量写清时间、地点、人数与费用，缺失的地方会自动显示“待确认”。</li>' +
      '<li>· 请勿发布需要转账、索要身份证件或私人微信的内容。</li>' +
      '<li>· 本机发布的内容同样可以被搜索、筛选、收藏、加入日历。</li>' +
      '<li>· 下架后可在“我的 → 我的发布”中查看已下架记录。</li>' +
      '</ul>' +
      '<div class="divider"></div>' +
      '<button class="btn btn--ghost btn--sm btn--block" type="button" data-action="goMine">' +
        U.icon('list') + '前往“我的”查看全部</button>' +
      '</section></aside>';

    html += '</div></div>';
    root.innerHTML = html;
  }

  /** 表单字段变化统一入口 */
  function setField(name, value, checked) {
    if (name === 'longTerm' || name === 'needReview' || name === 'beginnerFriendly' || name === 'online') {
      form[name] = !!checked;
    } else {
      form[name] = value;
    }
    if (errors[name]) {
      delete errors[name];
      // 只重绘错误提示，避免输入时丢焦点
      var el = document.querySelector('[data-field="' + name + '"]');
      if (el) {
        el.removeAttribute('aria-invalid');
        var field = el.closest('.field');
        var err = field && field.querySelector('.field__error');
        if (err) err.remove();
      }
    }
    S.saveDraft({ data: form, step: step });
  }

  function goStep(n) {
    var e = validate(step, false);
    if (n > step && Object.keys(e).length) {
      CR.toast.warn('请先修正表单中的提示项');
      return false;
    }
    step = Math.max(1, Math.min(3, n));
    S.saveDraft({ data: form, step: step });
    return true;
  }

  /** 发布 / 保存修改 */
  function publish() {
    var e = validate(3, true);
    if (Object.keys(e).length) {
      CR.toast.error('请先填写必填项：' + Object.keys(e).join('、'));
      step = 1;
      return { ok: false, step: 1 };
    }
    var payload = {
      title: form.title.trim(),
      category: form.category,
      tags: [],
      startTime: combineDateTime(form.startDate, form.startTime),
      endTime: form.endTime ? combineDateTime(form.startDate, form.endTime) : null,
      deadline: form.deadline ? CR.date.fromLocalInput(form.deadline) : null,
      location: form.location.trim(),
      online: form.online ? true : false,
      people: form.people.trim(),
      fee: form.fee.trim(),
      audience: form.audience.trim(),
      signupMethod: form.signupMethod.trim(),
      notes: form.notes.trim(),
      longTerm: form.longTerm,
      needReview: form.needReview,
      beginnerFriendly: form.beginnerFriendly,
      author: form.author
    };
    // 自动打标签，便于搜索与筛选
    var tagPool = [payload.category];
    if (payload.beginnerFriendly) tagPool.push('零基础');
    if (payload.longTerm) tagPool.push('长期');
    payload.tags = tagPool;

    if (editingId) {
      S.updatePost(editingId, payload);
      CR.toast.success('修改已保存（本机）');
      var id = editingId;
      resetForm();
      S.clearDraft();
      return { ok: true, id: id, edited: true };
    }
    var post = S.createPost(payload);
    resetForm();
    S.clearDraft();
    CR.toast.success('发布成功：已加入发现列表与日历');
    return { ok: true, id: post.id };
  }

  CR.views = CR.views || {};
  CR.views.publish = {
    title: '发布',
    render: render,
    setField: setField,
    goStep: goStep,
    publish: publish,
    pickType: function (v) { form.category = v; S.saveDraft({ data: form, step: step }); },
    resetForm: function () { resetForm(); S.clearDraft(); },
    restore: function () {
      resetForm();
      restoreDraft();
    },
    loadForEdit: function (id) {
      var ok = loadForEdit(id);
      if (!ok) CR.toast.warn('找不到要编辑的发布，可能已被下架');
      return ok;
    },
    cancelEdit: function () { resetForm(); },
    editingId: function () { return editingId; },
    form: function () { return form; },
    step: function () { return step; }
  };
})(window);
