/* ==========================================================================
   js/app.js — 应用入口
   · 事件委托（统一处理所有 data-action）
   · 每秒倒计时刷新、到点提醒检查
   · 路由渲染、导航高亮、首次访问引导
   ========================================================================== */
(function (global) {
  'use strict';

  var CR = (global.CampusRadar = global.CampusRadar || {});
  var U = CR.ui;
  var S = CR.store;
  var R = CR.router;

  var mainEl = null;
  var firedReminders = {};   // 本次会话内已提示过的提醒
  var searchTimer = null;
  var ticking = false;

  /* ------------------------------------------------------------ 工具 ---- */
  function nav(hash) { R.navigate(hash); }

  /** 整页重渲染（keepScroll=true 时不改变滚动位置） */
  function reRender(keepScroll) {
    renderRoute(R.current() || R.parse(global.location.hash), keepScroll);
  }

  function getOpFromEl(el) {
    return el && el.getAttribute('data-id');
  }

  /* ------------------------------------------------------- 模态对话框 ---- */
  var lastFocused = null;
  var openModals = [];   // 已打开的对话框引用（关闭时按引用移除，最可靠）

  function closeModal() {
    // 移除所有对话框（引用 + DOM 双保险，避免极端情况下叠加）
    openModals.slice().forEach(function (node) {
      if (node && node.parentNode) node.parentNode.removeChild(node);
    });
    openModals = [];
    var all = document.querySelectorAll ? document.querySelectorAll('#crModal') : [];
    for (var i = 0; i < all.length; i++) {
      if (all[i] && all[i].parentNode) all[i].parentNode.removeChild(all[i]);
    }
    if (lastFocused && lastFocused.focus) {
      try { lastFocused.focus(); } catch (e) { /* 忽略 */ }
    }
    lastFocused = null;
  }

  /** 关闭对话框但不恢复焦点（用于整页重渲染前清理） */
  function clearModal() {
    openModals.slice().forEach(function (node) {
      if (node && node.parentNode) node.parentNode.removeChild(node);
    });
    openModals = [];
    var all = document.querySelectorAll ? document.querySelectorAll('#crModal') : [];
    for (var i = 0; i < all.length; i++) {
      if (all[i] && all[i].parentNode) all[i].parentNode.removeChild(all[i]);
    }
  }

  /**
   * 通用模态框
   * @param {object} opts { title, text, bodyHtml, actions:[{label, type, value, primary}] }
   * @param {function} onPick 返回值或 null（取消）
   */
  function openModal(opts, onPick) {
    // 先彻底移除可能残留的对话框，避免叠加
    clearModal();
    var active = document.activeElement;
    lastFocused = (active && active.closest && active.closest('[data-modal]')) ? null : active;
    var host = document.createElement('div');
    host.id = 'crModal';
    host.className = 'filter-aside is-open';
    host.setAttribute('role', 'dialog');
    host.setAttribute('aria-modal', 'true');
    host.setAttribute('aria-label', opts.title || '对话框');
    host.innerHTML = '<div class="filter-sheet" tabindex="-1" style="max-height:70vh">' +
      '<div class="filter-sheet__head"><h3>' + U.esc(opts.title || '') + '</h3>' +
      '<span class="spacer"></span>' +
      '<button class="btn btn--sm btn--ghost" type="button" data-modal="cancel" aria-label="关闭">✕</button></div>' +
      (opts.text ? '<p class="t-small t-muted" style="margin-bottom:12px">' + opts.text + '</p>' : '') +
      (opts.bodyHtml || '') +
      '<div class="stack" style="margin-top:12px">' +
      (opts.actions || []).map(function (a) {
        return '<button class="btn ' + (a.primary ? 'btn--primary' : 'btn--ghost') + ' btn--block" type="button" ' +
          'data-modal="pick" data-value="' + U.esc(a.value == null ? a.label : a.value) + '">' +
          U.esc(a.label) + '</button>';
      }).join('') + '</div>' +
      '<button class="btn btn--ghost btn--block" type="button" data-modal="cancel" style="margin-top:8px">取消</button>' +
      '</div>';
    document.body.appendChild(host);
    openModals.push(host);

    // 键盘可访问：打开后把焦点移入对话框
    var sheet = host.querySelector('.filter-sheet');
    if (sheet && sheet.focus) {
      try { sheet.focus(); } catch (e) { /* 忽略 */ }
    }

    host.addEventListener('click', function (e) {
      if (!e.target || !e.target.closest) return;
      var t = e.target.closest('[data-modal]');
      if (e.target === host) { closeModal(); onPick && onPick(null); return; }
      if (!t) return;
      var kind = t.getAttribute('data-modal');
      if (kind === 'cancel') { closeModal(); onPick && onPick(null); return; }
      if (kind === 'pick') {
        var v = t.getAttribute('data-value');
        closeModal();
        onPick && onPick(v);
      }
    });
  }

  /* ------------------------------------------------------- 各类操作 ------ */
  function actFav(id, btn) {
    var on = S.toggleFavorite(id);
    if (btn) {
      btn.classList.add('pop');
      setTimeout(function () { btn.classList.remove('pop'); }, 260);
    }
    CR.toast.fav(on ? '已收藏，可在“我的 → 我的收藏”查看' : '已取消收藏');
    reRender(true);
  }

  function actSignup(id) {
    var op = S.getById(id);
    if (!op) return;
    var existing = S.getSignup(id);
    var suggested = S.suggestedSignupStatus(op);
    var text = '状态会保存在本机，纯前端模拟，不会真正提交给主办方。' +
      (op.needReview ? '<br><strong>该活动需要审核：提交报名表不代表最终录取。</strong>' : '') +
      (op.waitlist ? '<br>原报名已截止，可标记为“候补关注”。' : '');
    openModal({
      title: existing ? '修改报名状态' : '报名 / 意向登记',
      text: text,
      actions: [
        { label: '已登记（如仅完成意向登记）', value: 'registered' },
        { label: '已报名', value: 'signed', primary: suggested === 'signed' },
        { label: '待审核', value: 'reviewing', primary: suggested === 'reviewing' },
        { label: '候补关注（报名已截止）', value: 'waitlist', primary: suggested === 'waitlist' },
        { label: '取消我的报名记录', value: '__remove' }
      ]
    }, function (v) {
      if (!v) return;
      if (v === '__remove') {
        S.removeSignup(id);
        CR.toast.info('已取消报名记录');
      } else {
        var st = S.setSignup(id, v);
        CR.toast.signup('已记录为“' + S.SIGNUP_STATUS[st].label + '”（仅本机）');
      }
      reRender(true);
    });
  }

  function actReminder(id) {
    var op = S.getById(id);
    if (!op) return;
    var base = op.deadline ? '报名截止 ' + CR.date.fmtDateShort(op.deadline)
      : (op.startTime ? '活动开始 ' + CR.date.fmtDateShort(op.startTime) : '');
    if (!base) {
      CR.toast.warn('这条机会没有明确时间，暂时无法设置提醒');
      return;
    }
    var existing = S.getReminder(id);
    openModal({
      title: existing ? '修改提醒' : '设置提醒',
      text: '基准时间：' + U.esc(base) + '。提醒保存在本机，页面打开时到点会弹出提示。',
      actions: S.REMINDER_OFFSETS.map(function (o) {
        return { label: o.label, value: o.key, primary: existing && existing.offset === o.key };
      }).concat(existing ? [{ label: '删除提醒', value: '__remove' }] : [])
    }, function (v) {
      if (!v) return;
      if (v === '__remove') {
        S.removeReminder(id);
        CR.toast.info('已删除提醒');
      } else {
        var row = S.addReminder(id, v);
        requestNotifyPermission();
        CR.toast.bell('已设置提醒：' + CR.date.fmtDateShort(row.at) + ' ' + CR.date.fmtTime(row.at) +
          '（' + CR.date.untilText(row.at - Date.now()) + '）');
      }
      reRender(true);
    });
  }

  function requestNotifyPermission() {
    try {
      if (global.Notification && global.Notification.permission === 'default') {
        global.Notification.requestPermission();
      }
    } catch (e) { /* 某些浏览器在 file:// 下会抛错，忽略即可 */ }
  }

  function actCalendar(id) {
    if (S.inCalendar(id)) {
      S.removeFromCalendar(id);
      CR.toast.info('已从日历移除');
    } else {
      S.addToCalendar(id);
      var watched = S.calendarOpportunities();
      var pairs = CR.conflict.detect(watched);
      if (pairs.length) {
        var hit = pairs.filter(function (p) { return p.a.id === id || p.b.id === id; })[0];
        if (hit) {
          var other = hit.a.id === id ? hit.b : hit.a;
          CR.toast.warn('已加入日历，但与「' + other.title + '」时间重叠，可在日历页查看冲突');
        } else {
          CR.toast.calendar('已加入日历');
        }
      } else {
        CR.toast.calendar('已加入日历，可在“日历”页查看');
      }
    }
    reRender(true);
  }

  function actHide(id) {
    var on = S.toggleHidden(id);
    CR.toast.info(on ? '已标记不感兴趣，列表中将不再显示' : '已取消“不感兴趣”标记');
    reRender(true);
  }

  function copyText(text) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', 'readonly');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      document.body.appendChild(ta);
      var ok = false;
      try {
        if (ta.select) ta.select();
        if (ta.setSelectionRange) ta.setSelectionRange(0, text.length);
        ok = document.execCommand('copy');
      } catch (e) { ok = false; }
      if (ta.parentNode) ta.parentNode.removeChild(ta);
      return ok;
    }
    if (global.navigator.clipboard && global.navigator.clipboard.writeText) {
      global.navigator.clipboard.writeText(text).then(function () {
        CR.toast.success('已复制到剪贴板');
      }).catch(function () {
        CR.toast[fallback() ? 'success' : 'warn'](fallback() ? '已复制到剪贴板' : '复制失败，请手动选择文本');
      });
    } else {
      CR.toast[fallback() ? 'success' : 'warn'](fallback() ? '已复制到剪贴板' : '复制失败，请手动选择文本');
    }
  }

  function actCopy(id) {
    var op = S.getById(id);
    if (!op) return;
    copyText(CR.views.detail.plainText(op));
  }

  function actSaveNote(id) {
    var input = document.getElementById('noteInput');
    if (!input) return;
    var text = S.saveNote(id, input.value);
    CR.toast.success(text ? '备注已保存到本机' : '备注已清空');
  }

  function actRemovePost(id) {
    var op = S.getById(id);
    openModal({
      title: '下架这条本机发布？',
      text: '下架后不再出现在发现列表、日历与筛选中。内容仍保留在本机 IndexedDB 中，可在“我的 → 我的发布”查看。',
      actions: [{ label: '确认下架', value: 'yes', primary: true }]
    }, function (v) {
      if (v !== 'yes') return;
      S.removePost(id);
      CR.toast.warn('已下架：' + (op ? op.title : id));
      nav('#/mine');
      reRender();
    });
  }

  function actClearAll() {
    openModal({
      title: '清除全部本地数据？',
      text: '将删除收藏、报名、提醒、本机发布、浏览历史、备注与新生引导设置（localStorage + IndexedDB），且不可撤销。',
      actions: [{ label: '确认清除全部数据', value: 'yes', primary: true }]
    }, function (v) {
      if (v !== 'yes') return;
      S.clearAllData().then(function () {
        CR.toast.warn('本地数据已清除');
        nav('#/onboarding');
        reRender();
      });
    });
  }

  /* ------------------------------------------------------- 事件委托 ------ */
  function onDocumentClick(e) {
    // 发现页筛选 chip（使用 data-filter，独立于 data-action 以区分语义）
    var filterEl = e.target.closest('[data-filter]');
    if (filterEl) {
      e.preventDefault();
      CR.views.discover.toggleFilter(filterEl.getAttribute('data-filter'),
        filterEl.getAttribute('data-value'));
      reRender(true);
      return;
    }

    // 1) 普通链接：主卡片遮罩层等由 <a href="#/..."> 直接处理
    var actionEl = e.target.closest('[data-action]');
    var link = e.target.closest('a[href^="#/"]');

    if (!actionEl) {
      if (link) {
        // 交给浏览器默认行为触发 hashchange
        return;
      }
      return;
    }

    var action = actionEl.getAttribute('data-action');
    var id = getOpFromEl(actionEl) || (actionEl.closest('[data-op]') &&
      actionEl.closest('[data-op]').getAttribute('data-op'));

    switch (action) {
      /* 卡片 / 详情通用 */
      case 'fav': e.preventDefault(); actFav(id, actionEl); break;
      case 'signup': e.preventDefault(); actSignup(id); break;
      case 'reminder': e.preventDefault(); actReminder(id); break;
      case 'calendar': e.preventDefault(); actCalendar(id); break;
      case 'hide': e.preventDefault(); actHide(id); break;
      case 'copy': e.preventDefault(); actCopy(id); break;
      case 'saveNote': e.preventDefault(); actSaveNote(id); break;
      case 'editPost':
        e.preventDefault();
        if (CR.views.publish.loadForEdit(id)) {
          nav('#/publish?edit=' + encodeURIComponent(id));
          reRender();
          CR.toast.info('已载入内容，可修改后保存');
        }
        break;
      case 'removePost': e.preventDefault(); actRemovePost(id); break;
      case 'restorePost':
        e.preventDefault();
        CR.toast.info('已下架的内容仍保留在本机 IndexedDB 中（此处仅作演示，不提供恢复入口）');
        break;

      /* 发现页筛选 */
      case 'search': break;
      case 'clearQuery':
        e.preventDefault();
        S.savePreferences({ query: '' });
        reRender(true);
        break;
      case 'openFilters':
        e.preventDefault();
        S.state.preferences.__open = true;
        syncFilterOpenState();
        reRender(true);
        break;
      case 'closeFilters':
        e.preventDefault();
        S.state.preferences.__open = false;
        syncFilterOpenState();
        reRender(true);
        break;
      case 'resetFilters':
        e.preventDefault();
        S.resetPreferences();
        S.state.preferences.__open = false;
        syncFilterOpenState();
        CR.toast.info('已重置搜索与筛选条件');
        reRender(true);
        break;
      case 'removeChip':
        e.preventDefault();
        CR.views.discover.removeChip(actionEl.getAttribute('data-group'), actionEl.getAttribute('data-value'));
        reRender(true);
        break;
      case 'toggleGuard':
        e.preventDefault();
        var pf = S.toggleGuardMode();
        CR.toast.info(pf.guardMode ? '新生护航模式已开启' : '新生护航模式已关闭');
        reRender(true);
        break;

      /* 日历 */
      case 'prevMonth': e.preventDefault(); CR.views.calendar.prevMonth(); reRender(); break;
      case 'nextMonth': e.preventDefault(); CR.views.calendar.nextMonth(); reRender(); break;
      case 'todayMonth': e.preventDefault(); CR.views.calendar.today(); reRender(); break;
      case 'pickDay': e.preventDefault(); CR.views.calendar.pickDay(actionEl.getAttribute('data-day')); reRender(); break;

      /* 发布页 */
      case 'pickType':
        e.preventDefault();
        CR.views.publish.pickType(actionEl.getAttribute('data-value'));
        reRender();
        break;
      case 'nextStep':
        e.preventDefault();
        if (CR.views.publish.goStep(CR.views.publish.step() + 1)) reRender();
        break;
      case 'prevStep':
        e.preventDefault();
        CR.views.publish.goStep(CR.views.publish.step() - 1);
        reRender();
        break;
      case 'resetForm':
        e.preventDefault();
        CR.views.publish.resetForm();
        CR.toast.info('表单已清空（草稿也已删除）');
        reRender();
        break;
      case 'cancelEdit':
        e.preventDefault();
        CR.views.publish.cancelEdit();
        nav('#/publish');
        reRender();
        break;
      case 'publish': {
        e.preventDefault();
        var res = CR.views.publish.publish();
        if (res.ok) {
          if (res.edited) {
            nav('#/detail/' + encodeURIComponent(res.id));
            reRender();
          } else {
            nav('#/discover');
            reRender();
          }
        } else {
          reRender();
        }
        break;
      }
      case 'goMine': e.preventDefault(); nav('#/mine'); reRender(); break;

      /* 我的 */
      case 'mineTab':
        e.preventDefault();
        CR.views.mine.setTab(actionEl.getAttribute('data-value'));
        reRender();
        break;
      case 'unfav': e.preventDefault(); actFav(id); break;
      case 'unsignup':
        e.preventDefault();
        S.removeSignup(id);
        CR.toast.info('已删除报名记录');
        reRender();
        break;
      case 'unremind':
        e.preventDefault();
        S.removeReminder(id);
        CR.toast.info('已删除提醒');
        reRender();
        break;
      case 'clearHistory':
        e.preventDefault();
        S.clearHistory();
        CR.toast.info('浏览历史已清空');
        reRender();
        break;
      case 'removeHistory':
        e.preventDefault();
        S.removeHistory(id);
        reRender();
        break;
      case 'clearAll': e.preventDefault(); actClearAll(); break;

      /* 新生引导 */
      case 'pick':
        e.preventDefault();
        CR.views.onboarding.pick(actionEl.getAttribute('data-group'),
          actionEl.getAttribute('data-value'),
          actionEl.getAttribute('data-multi') === 'true');
        reRender();
        break;
      case 'next':
        e.preventDefault();
        if (CR.views.onboarding.next()) reRender();
        break;
      case 'prev': e.preventDefault(); CR.views.onboarding.prev(); reRender(); break;
      case 'restart': e.preventDefault(); CR.views.onboarding.restart(); reRender(); break;
      case 'skip':
        e.preventDefault();
        CR.views.onboarding.skip();
        nav('#/discover');
        reRender();
        break;
      case 'finish':
        e.preventDefault();
        CR.views.onboarding.finish();
        nav('#/discover');
        reRender();
        break;

      default:
        break;
    }
  }

  function onDocumentInput(e) {
    var el = e.target;
    if (!el || !el.getAttribute) return;

    var field = el.getAttribute('data-field');
    if (field) {
      CR.views.publish.setField(field, el.value, el.checked);
      return;
    }

    var action = el.getAttribute('data-action');
    if (action === 'search') {
      if (searchTimer) clearTimeout(searchTimer);
      var value = el.value;
      searchTimer = setTimeout(function () {
        S.savePreferences({ query: value });
        reRender(true);
      }, 200);
    }
  }

  function onDocumentChange(e) {
    var el = e.target;
    if (!el || !el.getAttribute) return;

    var action = el.getAttribute('data-action');
    if (action === 'sort') {
      S.savePreferences({ sort: el.value });
      reRender(true);
      CR.toast.info('排序已切换：' + (S.SORTS.filter(function (s) { return s.key === el.value; })[0] || {}).label);
      return;
    }
    if (action === 'guardCheck') {
      CR.views.onboarding.setGuard(el.checked);
      return;
    }
    if (el.getAttribute('data-field')) {
      CR.views.publish.setField(el.getAttribute('data-field'), el.value, el.checked);
      return;
    }

    var setting = el.getAttribute('data-setting');
    if (setting) {
      var multi = el.getAttribute('data-toggle') !== '1' &&
        el.getAttribute('data-setting') === 'interests';
      if (setting === 'guardMode') {
        S.toggleGuardMode(el.checked);
        CR.toast.info(el.checked ? '新生护航模式已开启' : '新生护航模式已关闭');
      } else if (multi) {
        var arr = (S.state.profile.interests || []).slice();
        var i = arr.indexOf(el.getAttribute('data-value'));
        if (i >= 0) arr.splice(i, 1); else arr.push(el.getAttribute('data-value'));
        S.saveProfile({ interests: arr });
      }
      reRender();
    }
  }

  /** 我的页面 / 引导页的 chip 按钮（使用 data-setting） */
  function onSettingChip(e) {
    var el = e.target.closest('[data-setting][data-value]');
    if (!el) return;
    var setting = el.getAttribute('data-setting');
    if (setting === 'guardMode') return; // 由 checkbox 处理
    var value = el.getAttribute('data-value');
    var multi = el.getAttribute('data-multi') === 'true';
    if (multi) {
      var arr = (S.state.profile[setting] || []).slice();
      var i = arr.indexOf(value);
      if (i >= 0) arr.splice(i, 1); else arr.push(value);
      S.saveProfile(wrap(setting, arr));
    } else {
      S.saveProfile(wrap(setting, value));
    }
    CR.toast.success('设置已保存（本机）');
    reRender();
  }

  function wrap(key, value) {
    var o = {};
    o[key] = value;
    return o;
  }

  function onKeydown(e) {
    if (e.key === 'Escape') {
      closeModal();
      // 移动端筛选抽屉：Esc 关闭
      if (S.state.preferences.__open) {
        S.state.preferences.__open = false;
        syncFilterOpenState();
        reRender(true);
      }
    }
  }

  /**
   * 筛选抽屉打开时锁定背景滚动，避免抽屉背后的页面跟着滚动。
   * 桌面端不使用 is-open，因此不会锁定。
   */
  function syncFilterOpenState() {
    var open = !!(S.state.preferences && S.state.preferences.__open);
    if (document.body && document.body.classList) {
      document.body.classList.toggle('filter-open', open);
    }
  }

  /* ---------------------------------------------------- 倒计时与提醒 ---- */
  function tick() {
    var now = Date.now();
    var nodes = document.querySelectorAll('[data-countdown]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var target = Number(el.getAttribute('data-countdown'));
      var mode = el.getAttribute('data-mode');
      var left = target - now;
      var text;
      if (mode === 'start') text = '开始 ' + CR.date.countdownText(left);
      else if (mode === 'box') text = left > 0 ? CR.date.countdownLong(left) : '已截止';
      else text = CR.date.countdownText(left);

      if (el.textContent !== text) el.textContent = text;

      if (left <= 0) {
        el.classList.add(mode === 'box' ? 'countdown-cell--pass' : 'is-pass');
        if (mode === 'deadline' || mode === 'box') {
          var cell = el.closest('.countdown-cell');
          if (cell) { cell.classList.remove('countdown-cell--warn', 'countdown-cell--danger'); cell.classList.add('countdown-cell--pass'); }
        }
        el.classList.remove('countdown--asap');
      } else if (left <= CR.date.HOUR && (mode === 'deadline')) {
        el.classList.add('countdown--asap');
      }
    }
    checkReminders(now);
  }

  function checkReminders(now) {
    if (document.hidden) return;
    S.state.user.reminders.forEach(function (r) {
      var key = r.id + '@' + r.at;
      if (firedReminders[key]) return;
      if (r.at <= now && now - r.at < 6 * CR.date.HOUR) {
        firedReminders[key] = 1;
        var op = S.getById(r.id);
        var text = (op ? op.title : '你关注的机会') +
          (r.base === 'deadline' ? ' 报名截止时间快到了' : ' 即将开始');
        CR.toast.bell(text + '（' + CR.date.fmtDateShort(r.at) + ' ' + CR.date.fmtTime(r.at) + '）', 6000);
        try {
          if (global.Notification && global.Notification.permission === 'granted') {
            new global.Notification(S.BRAND.name + ' · 提醒', { body: text });
          }
        } catch (e) { /* 忽略 */ }
      }
    });
  }

  /* ------------------------------------------------------------ 渲染 ---- */
  function setActiveNav(name) {
    var links = document.querySelectorAll('[data-nav]');
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href') || '';
      var isOn = href === '#/' + name;
      links[i].classList.toggle('is-active', isOn);
      if (isOn) links[i].setAttribute('aria-current', 'page');
      else links[i].removeAttribute('aria-current');
    }
    var toggle = document.getElementById('guardToggle');
    if (toggle) {
      var on = !!S.state.profile.guardMode;
      toggle.classList.toggle('is-on', on);
      toggle.setAttribute('aria-pressed', String(on));
      toggle.title = on ? '新生护航模式：已开启' : '新生护航模式：已关闭';
    }
  }

  function renderRoute(route, keepScroll) {
    if (!mainEl) return;
    clearModal();
    // 筛选抽屉只属于发现页：切到其他页面时必须收起，否则残留的滚动锁定会让页面无法滚动
    if (route.name !== 'discover') S.state.preferences.__open = false;

    var view = CR.views[route.name];
    if (!view) {
      mainEl.innerHTML = '<div class="view">' + U.empty({
        title: '页面不存在',
        text: '找不到路由：' + U.esc(route.raw),
        action: { href: '#/discover', label: '返回发现页' }
      }) + '</div>';
      return;
    }

    try {
      // 发布页：进入时恢复草稿 / 载入待编辑内容
      if (route.name === 'publish') {
        if (route.query && route.query.edit) CR.views.publish.loadForEdit(route.query.edit);
        else CR.views.publish.restore();
      }
      view.render(mainEl, route.params || {});
    } catch (err) {
      console.error('[CampusRadar] 渲染失败：', err);
      mainEl.innerHTML = '<div class="view">' + U.banner('danger', '页面渲染出错',
        '已捕获异常，其他数据不受影响。错误信息：' + U.esc(err && err.message ? err.message : String(err))) +
        '<div class="section"><a class="btn btn--primary" href="#/discover">返回发现页</a></div></div>';
    }

    setActiveNav(route.name);
    syncFilterOpenState();
    if (!keepScroll) window.scrollTo(0, 0);
    tick();
  }

  /* ------------------------------------------------------------ 启动 ---- */
  function boot() {
    mainEl = document.getElementById('main');

    mainEl.innerHTML = '<div class="view">' + U.loading(S.BRAND.name + '启动中…') + '</div>';

    S.init().then(function () {
      // 首次访问自动进入新生引导
      var hash = global.location.hash;
      var isBlank = !hash || hash === '#' || hash === '#/';
      if (isBlank && !S.state.profile.onboarded) {
        try {
          global.history.replaceState(null, '', global.location.pathname + global.location.search + '#/onboarding');
        } catch (e) {
          global.location.hash = '#/onboarding';
        }
        // 部分环境（例如 file:// 下的受限浏览器）可能不支持 replaceState，
        // 此时直接写 hash 作为兜底，保证仍会进入引导页。
        if (!global.location.hash || global.location.hash === '#' || global.location.hash === '#/') {
          global.location.hash = '#/onboarding';
        }
        CR.toast.info('欢迎！先完成新生引导，雷达会更懂你', 3200);
      }

      R.onChange(function (route) { renderRoute(route, false); });
      var route = R.start();
      syncFilterOpenState();

      // 顶部“新生护航模式”快捷开关
      var toggle = document.getElementById('guardToggle');
      if (toggle) {
        toggle.addEventListener('click', function () {
          var pf = S.toggleGuardMode();
          setActiveNav(R.current().name);
          CR.toast.info(pf.guardMode ? '新生护航模式已开启' : '新生护航模式已关闭');
          reRender(true);
        });
      }

      // 全局事件委托
      document.addEventListener('click', function (e) {
        var chip = e.target.closest && e.target.closest('[data-setting][data-value]');
        if (chip && !chip.hasAttribute('data-action')) { onSettingChip(e); return; }
        onDocumentClick(e);
      }, false);
      document.addEventListener('input', onDocumentInput, false);
      document.addEventListener('change', onDocumentChange, false);
      document.addEventListener('keydown', onKeydown, false);
      global.addEventListener('hashchange', function () { closeModal(); });

      // 倒计时与提醒：每秒一次（页面隐藏时降低开销）
      setInterval(tick, 1000);
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) tick();
      });

      // 启动提示
      S.state.notices.forEach(function (n, i) {
        setTimeout(function () { CR.toast.warn(n, 5000); }, 400 + i * 600);
      });

      console.info('%c' + S.BRAND.full, 'color:#2563EB;font-weight:700',
        '\n种子版本：' + CR.seed.SEED_VERSION + '（基准 ' + CR.seed.BASE_LABEL + '）' +
        '\n路由：' + R.ROUTES.map(function (r) { return r.pattern; }).join('  ') +
        '\n持久化：localStorage(' + CR.storage.KEYS.userState + ') + IndexedDB(' + CR.storage.STORES.join('/') + ')');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  CR.app = {
    reRender: reRender,
    nav: nav,
    openModal: openModal,
    closeModal: closeModal,
    clearModal: clearModal,
    tick: tick
  };
})(window);
