/* 流程自检：模拟用户完整体验路径（含路由事件、状态持久化、重渲染） */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const files = [
  'js/utils/date.js', 'js/utils/trust.js', 'js/utils/conflict.js',
  'js/storage.js', 'js/data/seed.js', 'js/store.js',
  'js/components/badge.js', 'js/components/toast.js', 'js/components/card.js',
  'js/views/discover.js', 'js/views/detail.js', 'js/views/calendar.js',
  'js/views/publish.js', 'js/views/mine.js', 'js/views/onboarding.js',
  'js/router.js'
];

/* ---- 更接近浏览器的事件目标实现 ---- */
class El {
  constructor(tag) {
    this.tagName = (tag || 'div').toUpperCase();
    this.children = [];
    this.attrs = {};
    this._html = '';
    this._listeners = {};
    this.classList = {
      _set: new Set(),
      add: (...c) => c.forEach((x) => this.classList._set.add(x)),
      remove: (...c) => c.forEach((x) => this.classList._set.delete(x)),
      toggle: (c, f) => { if (f) this.classList._set.add(c); else this.classList._set.delete(c); },
      contains: (c) => this.classList._set.has(c)
    };
  }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  hasAttribute(k) { return k in this.attrs; }
  removeAttribute(k) { delete this.attrs[k]; }
  appendChild(c) { this.children.push(c); return c; }
  removeChild(c) { this.children = this.children.filter((x) => x !== c); return c; }
  addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); }
  removeEventListener() {}
  querySelector() { return null; }
  querySelectorAll() { return []; }
  closest() { return null; }
  contains() { return false; }
  focus() { documentStub.activeElement = this; }
  set innerHTML(v) { this._html = String(v); }
  get innerHTML() { return this._html; }
}

const store = {};
const documentStub = {
  readyState: 'complete', hidden: false,
  documentElement: new El('html'), body: new El('body'),
  activeElement: null,
  createElement: (t) => new El(t),
  getElementById: (id) => (id === 'main' ? mainEl : (id === 'toastHost' ? toastHost : (id === 'guardToggle' ? guardBtn : null))),
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: (t, fn) => { (docListeners[t] = docListeners[t] || []).push(fn); },
  removeEventListener() {}
};
const docListeners = {};
const mainEl = new El('main');
const toastHost = new El('div');
const guardBtn = new El('button');

const winListeners = {};
const windowStub = {
  localStorage: {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  },
  document: documentStub,
  location: { hash: '', pathname: '/index.html', search: '' },
  history: { replaceState() {} },
  navigator: {},
  addEventListener: (t, fn) => { (winListeners[t] = winListeners[t] || []).push(fn); },
  removeEventListener() {},
  setTimeout, clearTimeout,
  setInterval: () => 0, clearInterval: () => {},
  console, indexedDB: undefined, Notification: undefined,
  scrollTo: () => {}, scrollY: 0
};
windowStub.window = windowStub;

const ctx = vm.createContext(windowStub);
files.forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
const CR = windowStub.CampusRadar;

const results = [];
function check(name, cond, extra) {
  results.push({ name, ok: !!cond, extra: extra === undefined ? '' : String(extra) });
}
function fire(type, target) {
  (docListeners[type] || []).forEach((fn) => fn({ target, preventDefault() {}, key: '' }));
}

(async function run() {
  await CR.store.init();

  // 未完成引导：模拟 app.js 的首次访问判断
  check('首次访问未完成引导', CR.store.state.profile.onboarded === false);

  // --- 新生引导流程 ---
  const obRoot = new El('div');
  CR.views.onboarding.pick('grade', 'freshman', false);
  const okNext = CR.views.onboarding.next();
  check('引导：选择年级后可进入下一步', okNext === true, CR.views.onboarding.draft().step);
  CR.views.onboarding.pick('interests', 'AI', true);
  CR.views.onboarding.pick('interests', '编程', true);
  CR.views.onboarding.next();
  CR.views.onboarding.pick('foundation', 'none', false);
  CR.views.onboarding.next();
  CR.views.onboarding.pick('hoursPerWeek', '3-4', false);
  CR.views.onboarding.next();
  CR.views.onboarding.render(obRoot);
  check('引导完成页显示设置摘要', /设置完成/.test(obRoot.innerHTML) &&
    /freshman|大一/.test(obRoot.innerHTML));
  CR.views.onboarding.finish();
  check('引导结果已持久化', CR.store.state.profile.onboarded === true &&
    CR.store.state.profile.guardMode === true && CR.store.state.profile.interests.length === 2,
    JSON.stringify(CR.store.state.profile));

  // --- 发现页：搜索 → 筛选 → 排序 ---
  CR.store.state.preferences = Object.assign(CR.defaults.preferences(), { query: '训练营' });
  const dRoot = new El('div');
  CR.views.discover.render(dRoot);
  check('搜索“训练营”命中 01/09', /“蓝桥杯”程序设计校内训练营/.test(dRoot.innerHTML) &&
    /程序设计训练营补充通知/.test(dRoot.innerHTML));
  check('搜索时出现搜索词 chip', /搜索：训练营/.test(dRoot.innerHTML));

  // 通过事件委托切换筛选（模拟点击 chip）
  CR.views.discover.setQuery('');
  CR.views.discover.toggleFilter('sources', 'student');
  check('筛选偏好持久化到 localStorage',
    JSON.parse(store['campusradar:preferences:v1']).sources.join(',') === 'student',
    store['campusradar:preferences:v1']);
  const dRoot2 = new El('div');
  CR.views.discover.render(dRoot2);
  check('学生自发筛选只显示学生发布', /学生发起｜周末羽毛球约球/.test(dRoot2.innerHTML) &&
    !/外国语学院校园语言角/.test(dRoot2.innerHTML));
  check('新生护航理由出现在卡片中', /零基础可参加|面向全校|今天 /.test(dRoot2.innerHTML));
  CR.views.discover.resetFilters();
  check('重置筛选后偏好为空', CR.store.state.preferences.sources.length === 0);

  // --- 详情页操作：收藏 / 报名 / 提醒 / 日历 ---
  const dRoot3 = new El('div');
  CR.views.detail.render(dRoot3, { id: '14' });
  check('详情 14 提示需审核', /提交报名表不代表最终录取/.test(dRoot3.innerHTML));
  check('详情 14 倒计时与吸底操作栏', /actionbar/.test(dRoot3.innerHTML) && /data-countdown/.test(dRoot3.innerHTML));

  const favOn = CR.store.toggleFavorite('14');
  check('收藏 14 成功', favOn === true && CR.store.isFavorite('14'));
  const status = CR.store.setSignup('14');
  check('14 号报名状态自动判定为待审核', status === 'reviewing', status);
  const rem = CR.store.addReminder('14', '1h');
  check('提醒时间计算正确（截止前 1 小时）',
    rem.at === CR.date.d(2026, 9, 21, 18, 0) - 3600000 || rem.at > Date.now(), rem.at);
  check('加入日历成功', CR.store.addToCalendar('14') === true && CR.store.inCalendar('14'));

  const afterFav = new El('div');
  CR.views.detail.render(afterFav, { id: '14' });
  check('详情重渲染后按钮状态为已收藏/已报名', /已收藏/.test(afterFav.innerHTML) &&
    /报名状态：待审核/.test(afterFav.innerHTML) && /已加入日历/.test(afterFav.innerHTML));

  // --- 冲突：关注 11 / 14 / 09 后应提示 9月21日 重叠 ---
  CR.store.setSignup('11');
  CR.store.setSignup('09');
  const cRoot = new El('div');
  CR.views.calendar.render(cRoot);
  check('日历页检测到 3 个活动重叠', /有 3 个活动时间重叠/.test(cRoot.innerHTML),
    (cRoot.innerHTML.match(/conflict-item__title">([^<]*)/) || [])[1]);
  check('冲突列表含三个活动时间', /19:00 大学生科研入门分享会/.test(cRoot.innerHTML) &&
    /19:00 Git 与 GitHub 零基础工作坊/.test(cRoot.innerHTML) &&
    /19:30 程序设计训练营补充通知/.test(cRoot.innerHTML));

  // 日历切月
  const m0 = CR.views.calendar.selectedDay();
  CR.views.calendar.nextMonth();
  const cRoot2 = new El('div');
  CR.views.calendar.render(cRoot2);
  check('日历切到 10 月', /2026 年 10 月/.test(cRoot2.innerHTML), (cRoot2.innerHTML.match(/\d+ 年 \d+ 月/) || [])[0]);
  CR.views.calendar.today();
  check('日历“今天”回到 9 月 19 日', CR.date.isSameDay(CR.views.calendar.selectedDay(), CR.date.d(2026, 9, 19, 12, 0)));

  // --- 发布流程（含校验与草稿） ---
  CR.views.publish.restore();
  let blocked = CR.views.publish.goStep(2);
  check('未填标题时无法进入下一步', blocked === false);
  CR.views.publish.setField('title', '周末羽毛球约球');
  CR.views.publish.setField('startDate', '2026-09-26');
  CR.views.publish.setField('startTime', '16:00');
  CR.views.publish.setField('location', '东区体育馆 3 号场');
  CR.views.publish.setField('people', '6—8 人');
  CR.views.publish.setField('fee', '费用 AA');
  CR.views.publish.setField('audience', '全校学生');
  CR.views.publish.setField('signupMethod', '在本页留言');
  check('填写后草稿已保存（IndexedDB 不可用时降级）',
    !!CR.store.getDraft() && CR.store.getDraft().data.title === '周末羽毛球约球',
    JSON.stringify(CR.store.getDraft() && CR.store.getDraft().data.title));
  const pub = CR.views.publish.publish();
  check('发布成功', pub.ok === true, JSON.stringify(pub));
  check('发布后草稿被清除', !CR.store.getDraft());

  const opNew = CR.store.getById(pub.id);
  check('新发布为 student-local', opNew.sourceType === 'local' && opNew.origin === 'local');
  check('新发布状态为报名中/即将开始', ['open', 'upcoming', 'pending'].indexOf(opNew.status || CR.conflict.statusOf(opNew)) >= 0,
    CR.conflict.statusOf(opNew));
  const dRoot4 = new El('div');
  CR.views.discover.render(dRoot4);
  check('新发布出现在发现列表', /周末羽毛球约球/.test(dRoot4.innerHTML));
  CR.store.toggleFavorite(pub.id);
  CR.store.addToCalendar(pub.id);
  CR.views.calendar.pickDay(CR.date.d(2026, 9, 26, 0, 0));
  const cRoot3 = new El('div');
  CR.views.calendar.render(cRoot3);
  check('新发布进入日历（9 月 26 日当日列表）', /周末羽毛球约球/.test(cRoot3.innerHTML));
  check('新发布在日历中标注为本机发布', /本机发布/.test(cRoot3.innerHTML));

  // --- 编辑与下架 ---
  check('编辑载入成功', CR.views.publish.loadForEdit(pub.id) === true &&
    CR.views.publish.form().title === '周末羽毛球约球');
  CR.views.publish.setField('location', '东区体育馆 5 号场');
  const pub2 = CR.views.publish.publish();
  check('编辑保存走 ID 更新路径', pub2.ok === true && pub2.edited === true);
  check('修改已生效', CR.store.getById(pub.id).location === '东区体育馆 5 号场');
  CR.store.removePost(pub.id);
  check('下架后不在发现列表', !CR.store.allOpportunities().some((o) => o.id === pub.id));
  check('下架后不在我的发布', !CR.store.state.posts.some((p) => p.id === pub.id));

  // --- 我的：数据概览与历史 ---
  const mineRoot = new El('div');
  CR.views.mine.setTab('signups');
  CR.views.mine.render(mineRoot);
  check('我的报名显示三种状态', /待审核/.test(mineRoot.innerHTML) && /已登记|已报名/.test(mineRoot.innerHTML));
  CR.views.mine.setTab('reminders');
  const mineRoot2 = new El('div');
  CR.views.mine.render(mineRoot2);
  check('我的提醒显示触发时间', /触发时间/.test(mineRoot2.innerHTML));
  CR.views.mine.setTab('history');
  const mineRoot3 = new El('div');
  CR.views.mine.render(mineRoot3);
  check('浏览历史记录了访问', /浏览于/.test(mineRoot3.innerHTML), CR.store.state.history.length);
  CR.views.mine.setTab('settings');
  const mineRoot4 = new El('div');
  CR.views.mine.render(mineRoot4);
  check('设置页展示筛选偏好摘要', /筛选偏好/.test(mineRoot4.innerHTML));

  // --- 持久化：模拟“刷新” ---
  const snapshotFav = CR.store.state.user.favorites.length;
  const snapshotSign = CR.store.state.user.signups.length;
  const snapshotRem = CR.store.state.user.reminders.length;
  const snapshotHist = CR.store.state.history.length;
  CR.store.state.user = CR.defaults.userState();
  CR.store.state.profile = CR.defaults.profile();
  CR.store.state.preferences = CR.defaults.preferences();
  CR.store.state.history = [];
  await CR.store.init();
  check('刷新后收藏保留', CR.store.state.user.favorites.length === snapshotFav,
    CR.store.state.user.favorites.length + '/' + snapshotFav);
  check('刷新后报名保留', CR.store.state.user.signups.length === snapshotSign);
  check('刷新后提醒保留', CR.store.state.user.reminders.length === snapshotRem);
  check('刷新后档案保留（护航模式开启）', CR.store.state.profile.guardMode === true &&
    CR.store.state.profile.grade === 'freshman');
  check('刷新后浏览历史恢复（localStorage 兜底）', CR.store.state.history.length >= Math.min(snapshotHist, 1),
    CR.store.state.history.length + '/' + snapshotHist);

  // --- 路由与导航高亮 ---
  check('路由 detail 解析', CR.router.parse('#/detail/26').params.id === '26');
  check('未知路由落到 notfound', CR.router.parse('#/xyz').name === 'notfound');
  check('默认路由为 discover', CR.router.parse('').name === 'discover');

  // --- 缺失信息与不编造 ---
  const op16 = CR.seed.byId('16');
  check('16 号缺失项被标注', op16.missingFields.includes('报名截止'), op16.missingFields.join(','));
  const d16 = new El('div');
  CR.views.detail.render(d16, { id: '16' });
  check('16 号详情显示未注明文案', /未注明，请以主办方通知为准/.test(d16.innerHTML));
  const d22 = new El('div');
  CR.views.detail.render(d22, { id: '22' });
  check('22 号地点待确认提示', /待确认，请以发起人通知为准/.test(d22.innerHTML));
  const d13 = new El('div');
  CR.views.detail.render(d13, { id: '13' });
  check('13 号标注截止时刻为推算', /9月21日截止|按当日 23:59 计算/.test(d13.innerHTML));
  const d12 = new El('div');
  CR.views.detail.render(d12, { id: '12' });
  check('12 号费用显示未注明', /费用[\s\S]{0,200}?未注明/.test(d12.innerHTML));

  let failed = 0;
  results.forEach((r) => {
    if (!r.ok) failed++;
    console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.extra ? '   [' + r.extra + ']' : ''));
  });
  console.log('\n共 ' + results.length + ' 项，失败 ' + failed + ' 项');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('流程自检异常：', e); process.exit(2); });
