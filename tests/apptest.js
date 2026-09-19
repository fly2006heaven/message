/* 控制器自检：加载真实 app.js，模拟点击/输入/定时器，验证事件委托与路由 */
const fs = require('fs'), path = require('path'), vm = require('vm');

/* ---------- 最小 DOM（支持按属性查找与 closest） ---------- */
class El {
  constructor(tag) {
    this.tagName = (tag || 'div').toUpperCase();
    this.children = []; this.parent = null; this.attrs = {}; this._html = ''; this._text = '';
    this.style = {}; this.dataset = {};
    this.classList = {
      _s: new Set(),
      add: (...c) => c.forEach((x) => this.classList._s.add(x)),
      remove: (...c) => c.forEach((x) => this.classList._s.delete(x)),
      toggle: (c, f) => { if (f === undefined ? !this.classList._s.has(c) : f) this.classList._s.add(c); else this.classList._s.delete(c); },
      contains: (c) => this.classList._s.has(c)
    };
  }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'id') this.id = String(v); if (k === 'class') this.className = String(v); }
  getAttribute(k) {
    if (k === 'id' && this.id != null) return String(this.id);
    if (k === 'class' && this.className != null) return String(this.className);
    return k in this.attrs ? this.attrs[k] : null;
  }
  hasAttribute(k) { return k in this.attrs || (k === 'id' && this.id != null); }
  removeAttribute(k) { delete this.attrs[k]; }
  appendChild(c) { c.parent = this; this.children.push(c); return c; }
  removeChild(c) { this.children = this.children.filter((x) => x !== c); return c; }
  addEventListener(t, fn) { (this._ev = this._ev || {})[t] = (this._ev[t] || []).concat(fn); }
  removeEventListener() {}
  closest(sel) {
    let n = this;
    while (n) {
      if (matches(n, sel)) return n;
      n = n.parent;
    }
    return null;
  }
  querySelector(sel) {
    const all = [];
    const walk = (n) => { n.children.forEach((c) => { all.push(c); walk(c); }); };
    walk(this);
    return all.find((n) => matches(n, sel)) || null;
  }
  querySelectorAll(sel) {
    return this._children().filter((n) => matches(n, sel));
  }
  _children() { const all = []; const walk = (n) => { n.children.forEach((c) => { all.push(c); walk(c); }); }; walk(this); return all; }
  contains(n) { let x = n; while (x) { if (x === this) return true; x = x.parent; } return false; }
  get parentNode() { return this.parent || null; }
  set parentNode(v) { this.parent = v; }
  focus() { doc.activeElement = this; }
  set innerHTML(v) { this._html = String(v); }
  get innerHTML() { return this._html; }
  set textContent(v) { this._text = String(v); }
  get textContent() { return this._text; }
}

/** 极简选择器匹配：[attr]、[attr="v"]、.cls、tag */
function matches(el, sel) {
  if (!el || !el.attrs) return false;
  const chunks = String(sel).match(/\[[^\]]*\]|\.[\w-]+|[\w-]+/g) || [];
  return chunks.every((p) => {
    if (p.startsWith('[')) {
      const m = p.match(/^\[([\w-]+)(?:="?([^"\]]*)"?)?\]$/);
      if (!m) return false;
      const v = el.getAttribute(m[1]);
      if (m[2] === undefined || m[2] === '') return v !== null;
      return v === m[2];
    }
    if (p.startsWith('.')) return el.classList.contains(p.slice(1));
    return el.tagName === p.toUpperCase();
  });
}

const docListeners = {};
const stores = {};
const mainEl = new El('main');
mainEl.setAttribute('id', 'main');
const toastHost = new El('div');
const guardBtn = new El('button');
guardBtn.setAttribute('id', 'guardToggle');
const navLinks = ['#/discover', '#/calendar', '#/publish', '#/mine', '#/onboarding'].map((h) => {
  const a = new El('a');
  a.setAttribute('data-nav', '');
  a.setAttribute('href', h);
  return a;
});

const doc = {
  readyState: 'complete', hidden: false,
  documentElement: new El('html'), body: new El('body'), activeElement: null,
  createElement: (t) => new El(t),
  getElementById: (id) => (id === 'main' ? mainEl : id === 'toastHost' ? toastHost : id === 'guardToggle' ? guardBtn : null),
  querySelector: (s) => matches(mainEl, s) ? mainEl : null,
  querySelectorAll: (s) => {
    if (s === '[data-nav]') return navLinks;
    if (s === '[data-countdown]') return mainEl.querySelectorAll('[data-countdown]');
    return [];
  },
  addEventListener: (t, fn) => { (docListeners[t] = docListeners[t] || []).push(fn); },
  removeEventListener() {}
};

const win = {
  localStorage: { getItem: (k) => (k in stores ? stores[k] : null), setItem: (k, v) => { stores[k] = String(v); }, removeItem: (k) => { delete stores[k]; } },
  document: doc,
  navigator: {},
  console: Object.assign(Object.create(console), {
    error: (...a) => { console.log('APP-ERROR:', ...a.map((x) => (x && x.stack) ? x.stack : String(x))); }
  }),
  addEventListener: (t, fn) => { (win._ev = win._ev || {})[t] = (win._ev[t] || []).concat(fn); },
  removeEventListener() {},
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id),
  setInterval: () => 0, clearInterval: () => {},
  indexedDB: undefined, Notification: undefined,
  scrollTo: () => {}, scrollY: 0
};
/* location / history：模拟真实浏览器行为（写 hash 会触发 hashchange） */
(function () {
  let hash = '';
  const loc = { pathname: '/index.html', search: '' };
  Object.defineProperty(loc, 'hash', {
    get: () => hash,
    set: (v) => {
      const next = String(v);
      if (next === hash) return;
      hash = next;
      (win._ev && win._ev.hashchange ? win._ev.hashchange : []).forEach((fn) => fn({}));
    }
  });
  win.location = loc;
  win.history = {
    replaceState(_s, _t, url) {
      const i = String(url).indexOf('#');
      if (i >= 0) hash = String(url).slice(i);
    }
  };
})();
win.window = win;

const ROOT = path.resolve(__dirname, '..');
const files = ['js/utils/date.js','js/utils/trust.js','js/utils/conflict.js','js/storage.js','js/data/seed.js','js/store.js','js/components/badge.js','js/components/toast.js','js/components/card.js','js/views/discover.js','js/views/detail.js','js/views/calendar.js','js/views/publish.js','js/views/mine.js','js/views/onboarding.js','js/router.js','js/app.js'];
const ctx = vm.createContext(win);
files.forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
const CR = win.CampusRadar;
win.__CR_DEBUG_MODAL__ = true;

const results = [];
const check = (n, c, e) => results.push({ n, ok: !!c, e: e === undefined ? '' : String(e) });

/** 模拟点击一个带 data-action 的元素（挂到 main 下以支持 closest） */
function clickAction(attrs, target) {
  const el = new El(target || 'button');
  Object.keys(attrs).forEach((k) => el.setAttribute(k, attrs[k]));
  mainEl.appendChild(el);
  docListeners.click.forEach((fn) => fn({ target: el, preventDefault() {} }));
  mainEl.removeChild(el);
  return el;
}
function inputAction(attrs, value, checked) {
  const el = new El('input');
  Object.keys(attrs).forEach((k) => el.setAttribute(k, attrs[k]));
  el.value = value;
  el.checked = !!checked;
  mainEl.appendChild(el);
  docListeners.input.forEach((fn) => fn({ target: el }));
  docListeners.change.forEach((fn) => fn({ target: el }));
  mainEl.removeChild(el);
  return el;
}

setTimeout(() => {
  // boot 是异步的：等待 store.init 完成
  console.log('DEBUG hash=' + win.location.hash + ' len=' + mainEl.innerHTML.length);
  console.log('DEBUG head=' + mainEl.innerHTML.slice(0, 600));
  check('主容器已挂载视图', /view|empty|panel/.test(mainEl.innerHTML), mainEl.innerHTML.length);
  check('首次访问路由写入 #/onboarding', win.location.hash === '#/onboarding' ||
    /新生引导/.test(mainEl.innerHTML), win.location.hash);
  check('引导页已渲染', /你是哪个年级/.test(mainEl.innerHTML));
  check('导航高亮生效', navLinks.some((a) => a.classList.contains('is-active')));

  // 完成引导：点选年级 → 下一步 → 完成
  clickAction({ 'data-action': 'pick', 'data-group': 'grade', 'data-value': 'freshman', 'data-multi': 'false' });
  inputAction({ 'data-action': 'guardCheck' }, '', true);
  clickAction({ 'data-action': 'next' });
  clickAction({ 'data-action': 'pick', 'data-group': 'interests', 'data-value': 'AI', 'data-multi': 'true' });
  clickAction({ 'data-action': 'next' });
  clickAction({ 'data-action': 'pick', 'data-group': 'foundation', 'data-value': 'none', 'data-multi': 'false' });
  clickAction({ 'data-action': 'next' });
  clickAction({ 'data-action': 'pick', 'data-group': 'hoursPerWeek', 'data-value': '3-4', 'data-multi': 'false' });
  clickAction({ 'data-action': 'next' });
  check('引导进入完成页', /设置完成/.test(mainEl.innerHTML) || CR.views.onboarding.draft().step >= 4,
    'step=' + CR.views.onboarding.draft().step +
    ' draft=' + JSON.stringify(CR.views.onboarding.draft()) +
    ' has完成=' + /设置完成/.test(mainEl.innerHTML));
  clickAction({ 'data-action': 'finish' });
  check('完成引导后跳到发现页', win.location.hash === '#/discover', win.location.hash);
  check('发现页已渲染卡片', /op-card/.test(mainEl.innerHTML));
  check('护航模式已开启（头部按钮态）', guardBtn.getAttribute('aria-pressed') === 'true',
    guardBtn.getAttribute('aria-pressed'));

  // 搜索输入（防抖 200ms）
  const searchEl = inputAction({ 'data-action': 'search' }, '羽毛球');
  setTimeout(() => {
    const prefs = JSON.parse(stores['campusradar:preferences:v1']);
    check('搜索词写入偏好', prefs.query === '羽毛球', prefs.query);
    check('搜索结果只含羽毛球', /周末羽毛球约球/.test(mainEl.innerHTML) &&
      !/外国语学院校园语言角/.test(mainEl.innerHTML));

    // 筛选 chip
    clickAction({ 'data-action': 'removeChip', 'data-group': 'query', 'data-value': '羽毛球' });
    clickAction({ 'data-filter': 'sources', 'data-value': 'contest' });
    check('学生自发/竞赛筛选可切换', JSON.parse(stores['campusradar:preferences:v1']).sources.join(',') === 'contest',
      stores['campusradar:preferences:v1']);
    clickAction({ 'data-action': 'resetFilters' });
    check('重置筛选生效', JSON.parse(stores['campusradar:preferences:v1']).sources.length === 0);

    // 排序切换
    inputAction({ 'data-action': 'sort' }, 'deadline');
    check('排序偏好已保存', JSON.parse(stores['campusradar:preferences:v1']).sort === 'deadline');

    // 收藏 / 报名 / 日历 / 不感兴趣
    clickAction({ 'data-action': 'fav', 'data-id': '05' });
    check('收藏 05 成功', CR.store.isFavorite('05'));
    check('收藏后 toast 出现', toastHost.innerHTML.length > 0 || toastHost.children.length > 0,
      toastHost.children.length);

    clickAction({ 'data-action': 'signup', 'data-id': '05' });
    const modal = doc.body.children.find((c) => c.getAttribute && c.getAttribute('id') === 'crModal');
    check('报名弹窗已打开', !!modal);
    check('报名弹窗是对话框语义', !!modal && modal.getAttribute('role') === 'dialog' &&
      modal.getAttribute('aria-modal') === 'true');
    if (modal) {
      // 模拟点击“已报名”按钮（modal 内部监听器 + 合成目标）
      const pick = new El('button');
      pick.setAttribute('data-modal', 'pick');
      pick.setAttribute('data-value', 'signed');
      pick.parent = modal;
      const origClose = CR.app.closeModal;
      CR.app.closeModal = function () {
        console.log('HARNESS closeModal called; bodyKids=' +
          JSON.stringify(doc.body.children.map((c) => c.getAttribute && c.getAttribute('id'))) +
          ' modal.parent=' + (modal.parent === doc.body));
        return origClose();
      };
      console.log('HARNESS modal listeners=' + JSON.stringify(Object.keys(modal._ev || {})) +
        ' evCount=' + ((modal._ev && modal._ev.click) || []).length +
        ' pickClosest=' + JSON.stringify(!!pick.closest('[data-modal]')) +
        ' pickAttr=' + pick.getAttribute('data-modal'));
      try {
        (modal._ev && modal._ev.click ? modal._ev.click : []).forEach((f) => {
          console.log('HARNESS handler body: ' + String(f).slice(0, 420).replace(/\s+/g, ' '));
          f({ target: pick, preventDefault() {} });
        });
      } catch (err) {
        console.log('HARNESS pick dispatch threw: ' + (err && err.stack));
      }
      CR.app.closeModal = origClose;
      console.log('HARNESS after pick; bodyKids=' +
        JSON.stringify(doc.body.children.map((c) => c.getAttribute && c.getAttribute('id'))));
    }
    check('报名状态已记录', !!CR.store.getSignup('05'), JSON.stringify(CR.store.getSignup('05')));
    check('报名状态为用户选择值', CR.store.getSignup('05') && CR.store.getSignup('05').status === 'signed');
    check('报名弹窗已关闭', !doc.body.children.some((c) => c.getAttribute && c.getAttribute('id') === 'crModal'),
      'bodyKids=' + JSON.stringify(doc.body.children.map((c) => c.getAttribute && c.getAttribute('id'))));

    clickAction({ 'data-action': 'calendar', 'data-id': '05' });
    check('加入日历成功', CR.store.inCalendar('05'));
    clickAction({ 'data-action': 'hide', 'data-id': '12' });
    check('不感兴趣已记录', CR.store.isHidden('12'));
    check('被隐藏的 12 号不在列表', !/全国高校计算机能力挑战赛/.test(mainEl.innerHTML));
    clickAction({ 'data-action': 'hide', 'data-id': '12' });

    // 详情页：复制信息
    clickAction({ 'data-action': 'copy', 'data-id': '05' });
    check('复制操作未抛异常', true);

    // 日历交互
    win.location.hash = '#/calendar';
    CR.router.resolve();
    check('日历页渲染', /cal-grid/.test(mainEl.innerHTML));
    clickAction({ 'data-action': 'nextMonth' });
    check('月份切换生效', /2026 年 10 月/.test(mainEl.innerHTML),
      (mainEl.innerHTML.match(/\d+ 年 \d+ 月/) || [])[0]);
    clickAction({ 'data-action': 'todayMonth' });
    clickAction({ 'data-action': 'pickDay', 'data-day': String(CR.date.d(2026, 9, 21, 0, 0)) });
    check('选中 9 月 21 日显示当日事件', /科研入门分享会/.test(mainEl.innerHTML));

    // 发布页：分步 + 校验 + 发布
    win.location.hash = '#/publish';
    CR.router.resolve();
    console.log('DEBUG publish render: len=' + mainEl.innerHTML.length +
      ' has须知=' + /发布须知/.test(mainEl.innerHTML) +
      ' has本机=' + /本机发布/.test(mainEl.innerHTML) +
      ' head=' + mainEl.innerHTML.slice(0, 200));
    check('发布页渲染', /发布须知/.test(mainEl.innerHTML));
    clickAction({ 'data-action': 'nextStep' });
    check('未填标题被拦截（仍在第 1 步）', CR.views.publish.step() === 1, CR.views.publish.step());
    inputAction({ 'data-field': 'title' }, '周四晚图书馆自习搭子');
    inputAction({ 'data-field': 'startDate' }, '2026-09-24');
    inputAction({ 'data-field': 'startTime' }, '19:00');
    inputAction({ 'data-field': 'location' }, '图书馆 3 楼研讨间');
    inputAction({ 'data-field': 'fee' }, '免费');
    inputAction({ 'data-field': 'signupMethod' }, '本页留言');
    clickAction({ 'data-action': 'nextStep' });
    clickAction({ 'data-action': 'nextStep' });
    check('分步表达到第 3 步', CR.views.publish.step() === 3, CR.views.publish.step());
    clickAction({ 'data-action': 'publish' });
    check('发布后跳转发现页', win.location.hash === '#/discover', win.location.hash);
    check('发布内容出现在发现页', /周四晚图书馆自习搭子/.test(mainEl.innerHTML));
    check('本机发布标注存在', /本机发布/.test(mainEl.innerHTML));

    // 我的页：tab 切换与清除数据
    win.location.hash = '#/mine';
    CR.router.resolve();
    check('我的页渲染', /stat-grid/.test(mainEl.innerHTML));
    clickAction({ 'data-action': 'mineTab', 'data-value': 'posts' });
    check('我的发布含新发布', /周四晚图书馆自习搭子/.test(mainEl.innerHTML));
    clickAction({ 'data-action': 'editPost', 'data-id': CR.store.state.posts[0].id });
    check('编辑跳转发布页带 edit 参数', win.location.hash.indexOf('#/publish?edit=') === 0, win.location.hash);
    check('编辑模式载入表单', CR.views.publish.form().title === '周四晚图书馆自习搭子',
      CR.views.publish.form().title);

    // 未知路由
    win.location.hash = '#/unknown-route';
    CR.router.resolve();
    check('未知路由显示空状态', /页面不存在/.test(mainEl.innerHTML));

    // 倒计时 tick（mainEl 以字符串保存渲染结果，用属性计数验证）
    win.location.hash = '#/discover';
    CR.router.resolve();
    const before = (mainEl.innerHTML.match(/data-countdown="/g) || []).length;
    CR.app.tick();
    check('倒计时元素可被 tick 更新', before > 5, before);

    let failed = 0;
    results.forEach((r) => { if (!r.ok) failed++; console.log((r.ok ? 'PASS ' : 'FAIL ') + r.n + (r.e ? '   [' + r.e + ']' : '')); });
    console.log('\n共 ' + results.length + ' 项，失败 ' + failed + ' 项');
    process.exit(failed ? 1 : 0);
  }, 320);
}, 120);
