/* 临时自检脚本：在 Node 中模拟浏览器环境，验证种子数据 / 筛选 / 排序 / 冲突 / 渲染片段 */
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

// --- 极简沙箱 ---
const store = {};
const localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; }
};

class El {
  constructor(tag) {
    this.tagName = (tag || 'div').toUpperCase();
    this.children = [];
    this.attrs = {};
    this._html = '';
    this.style = {};
    this.classList = { add() {}, remove() {}, toggle() {}, contains() { return false; } };
  }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  appendChild(c) { this.children.push(c); return c; }
  removeChild(c) { this.children = this.children.filter((x) => x !== c); return c; }
  addEventListener() {}
  removeEventListener() {}
  querySelector() { return null; }
  querySelectorAll() { return []; }
  closest() { return null; }
  contains() { return false; }
  set innerHTML(v) { this._html = String(v); }
  get innerHTML() { return this._html; }
  set textContent(v) { this._text = String(v); }
  get textContent() { return this._text || ''; }
}

const documentStub = {
  readyState: 'complete',
  hidden: false,
  documentElement: new El('html'),
  body: new El('body'),
  createElement: (t) => new El(t),
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
  removeEventListener: () => {}
};

const windowStub = {
  localStorage,
  document: documentStub,
  location: { hash: '', pathname: '/index.html', search: '' },
  history: { replaceState() {} },
  navigator: { clipboard: null, userAgent: 'node' },
  addEventListener: () => {},
  removeEventListener: () => {},
  setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {},
  console,
  Notification: undefined,
  indexedDB: undefined,
  scrollTo: () => {},
  scrollY: 0
};
windowStub.window = windowStub;

const ctx = vm.createContext(windowStub);
for (const f of files) {
  const code = fs.readFileSync(path.join(ROOT, f), 'utf8');
  vm.runInContext(code, ctx, { filename: f });
}

const CR = windowStub.CampusRadar;
const results = [];
function check(name, cond, extra) {
  results.push({ name, ok: !!cond, extra: extra === undefined ? '' : String(extra) });
}

// 1) 种子数据
check('种子条数 = 26', CR.seed.opportunities.length === 26, CR.seed.opportunities.length);
const ids = CR.seed.opportunities.map((o) => o.id);
check('编号 01—26 齐全', ids.join(',') === Array.from({ length: 26 }, (_, i) => String(i + 1).padStart(2, '0')).join(','), ids.join(','));

// 2) 关联关系
const n09 = CR.seed.byId('09');
const n20 = CR.seed.byId('20');
check('09 关联 01', n09.relatedIds[0] === '01');
check('20 关联 03', n20.relatedIds[0] === '03');
const rel01 = CR.conflict.relations(CR.seed.byId('01'), CR.seed.opportunities);
check('01 显示补充通知 09', rel01.supplements.length === 1 && rel01.supplements[0].id === '09');
const rel03 = CR.conflict.relations(CR.seed.byId('03'), CR.seed.opportunities);
check('03 显示补充说明 20', rel03.supplements.length === 1 && rel03.supplements[0].id === '20');
const rel09 = CR.conflict.relations(n09, CR.seed.opportunities);
check('09 指向原文 01', rel09.original && rel09.original.id === '01');

// 3) 风险
check('24 高风险', CR.seed.byId('24').riskLevel === 'high');
check('25 疑似推广', CR.seed.byId('25').riskLevel === 'suspect');
const risky = CR.store.splitByRisk(CR.store.allOpportunities());
check('风险条目被分离', risky.risky.length === 2 && risky.normal.length === 24, risky.risky.length + '/' + risky.normal.length);

// 4) 状态判定（基准时间 2026-09-19）
const base = CR.date.d(2026, 9, 19, 12, 0);
const statusAt = (id) => CR.conflict.statusOf(CR.seed.byId(id), base);
check('02 今日', statusAt('02') === 'today', statusAt('02'));
check('04 可回放', statusAt('04') === 'replay', statusAt('04'));
check('05 即将截止', statusAt('05') === 'closing', statusAt('05'));
check('08 长期', statusAt('08') === 'longterm', statusAt('08'));
check('17 长期', statusAt('17') === 'longterm', statusAt('17'));
check('19 报名已截止', CR.seed.byId('19').deadline < base);
check('24 风险状态', statusAt('24') === 'risk');

// 5) 冲突检测：9/21 晚 19:00 科研入门、19:00 Git 工作坊、19:30 训练营
const watched = ['11', '14', '09', '05', '07'].map((id) => CR.store.getById(id));
const groups = CR.conflict.groupByDay(CR.conflict.detect(watched));
check('检测到 1 组冲突（9月21日）', groups.length === 1, JSON.stringify(groups.map((g) => g.list.map((o) => o.id))));
check('冲突包含 11/14/09', groups[0].list.map((o) => o.id).sort().join(',') === '09,11,14', groups[0].list.map((o) => o.id).join(','));
const desc = CR.conflict.describeGroup(groups[0]);
check('冲突描述含 3 个活动', /3 个活动/.test(desc.title), desc.title);

// 6) 截止雷达顺序
const radar = CR.conflict.deadlineRadar(CR.seed.opportunities, { includePassed: false, now: base });
const radarIds = radar.map((r) => r.op.id);
check('截止雷达首个为 05（9/20 12:00）', radarIds[0] === '05', radarIds.join(','));
check('截止雷达含 07 与 12', radarIds.includes('07') && radarIds.includes('12'), radarIds.join(','));
check('截止雷达按时间升序', radar.every((r, i) => i === 0 || radar[i - 1].at <= r.at));

// 7) 搜索
CR.store.state.preferences = Object.assign(CR.defaults.preferences(), { query: 'git' });
let f = CR.store.filterOpportunities();
check('搜索 git 命中 14/08', f.length === 2 && f.map((o) => o.id).sort().join(',') === '08,14', f.map((o) => o.id).join(','));
CR.store.state.preferences = Object.assign(CR.defaults.preferences(), { query: '志愿' });
f = CR.store.filterOpportunities();
check('搜索“志愿”命中 05/16', f.map((o) => o.id).sort().join(',') === '05,16', f.map((o) => o.id).join(','));
CR.store.state.preferences = Object.assign(CR.defaults.preferences(), { query: '明德楼' });
f = CR.store.filterOpportunities();
check('按地点搜索命中 21', f.length === 1 && f[0].id === '21');

// 8) 筛选
CR.store.state.preferences = Object.assign(CR.defaults.preferences(), { sources: ['college'] });
f = CR.store.filterOpportunities();
check('来源=学院 → 21/26', f.map((o) => o.id).sort().join(',') === '21,26', f.map((o) => o.id).join(','));
CR.store.state.preferences = Object.assign(CR.defaults.preferences(), { conditions: ['beginner'] });
f = CR.store.filterOpportunities();
check('条件=零基础 数量 > 5', f.length >= 8, f.length);
CR.store.state.preferences = Object.assign(CR.defaults.preferences(), { statuses: ['risk'] });
f = CR.store.filterOpportunities();
check('状态=风险 → 24/25', f.map((o) => o.id).sort().join(',') === '24,25', f.map((o) => o.id).join(','));
CR.store.state.preferences = Object.assign(CR.defaults.preferences(), { statuses: ['longterm'] });
f = CR.store.filterOpportunities();
check('状态=长期 → 08/16/17', f.map((o) => o.id).sort().join(',') === '08,16,17', f.map((o) => o.id).join(','));
CR.store.state.preferences = Object.assign(CR.defaults.preferences(), { audiences: ['freshman'] });
f = CR.store.filterOpportunities();
check('对象=大一 含 08/14', f.map((o) => o.id).includes('08') && f.map((o) => o.id).includes('14'), f.map((o) => o.id).join(','));
CR.store.state.preferences = Object.assign(CR.defaults.preferences(), { categories: ['资料'] });
f = CR.store.filterOpportunities();
check('类型=资料 → 17', f.length === 1 && f[0].id === '17');

// 9) 排序：风险降权
const sorted = CR.store.sortOpportunities(CR.store.allOpportunities(), 'smart', base);
const posHigh = sorted.findIndex((o) => o.id === '24');
const posGood = sorted.findIndex((o) => o.id === '02');
check('风险条目 24 排在很靠后', posHigh > 18, 'pos=' + posHigh + '/' + sorted.length);
check('今日公开课 02 排在前列', posGood < 12, 'pos=' + posGood);

// 10) 渲染片段
CR.store.state.preferences = CR.defaults.preferences();
const root1 = new El('div');
CR.views.discover.render(root1);
const html = root1.innerHTML;
check('发现页含问候与日期', /2026年9月19日，周六/.test(html));
check('发现页含今日焦点 / 截止雷达', /今日焦点/.test(html) && /截止雷达/.test(html));
check('发现页含 26 条种子卡片标题', /“蓝桥杯”程序设计校内训练营/.test(html) && /外国语学院校园语言角/.test(html));
check('发现页渲染出风险折叠区', /风险 \/ 疑似推广信息/.test(html));

const root2 = new El('div');
CR.views.detail.render(root2, { id: '01' });
const d1 = root2.innerHTML;
check('详情 01 显示补充通知 09', /程序设计训练营补充通知/.test(d1));
check('详情 01 显示倒计时', /报名截止倒计时/.test(d1) && /data-countdown/.test(d1));
check('详情含缺失信息文案', /未注明，请以主办方通知为准/.test(d1));

const root3 = new El('div');
CR.views.detail.render(root3, { id: '24' });
check('详情 24 高风险提示', /高风险信息/.test(root3.innerHTML) && /不建议添加私人微信/.test(root3.innerHTML));
const root4 = new El('div');
CR.views.detail.render(root4, { id: '25' });
check('详情 25 疑似推广提示', /疑似推广/.test(root4.innerHTML));
const root5 = new El('div');
CR.views.detail.render(root5, { id: '19' });
check('详情 19 候补提示', /可候补关注|候补入场/.test(root5.innerHTML));

const root6 = new El('div');
CR.views.calendar.render(root6);
check('日历页含月视图与图例', /cal-grid/.test(root6.innerHTML) && /报名截止/.test(root6.innerHTML));
check('日历页含冲突检测区块', /冲突检测/.test(root6.innerHTML));

const root7 = new El('div');
CR.views.publish.render(root7);
check('发布页含本机发布说明', /本机发布，仅本机可见/.test(root7.innerHTML));

const root8 = new El('div');
CR.views.mine.render(root8);
check('我的页含数据概览', /stat-grid/.test(root8.innerHTML) && /收藏/.test(root8.innerHTML));

const root9 = new El('div');
CR.views.onboarding.render(root9);
check('引导页含四个设置步骤', /你是哪个年级/.test(root9.innerHTML));

// 11) 状态条 / 徽章
const b = CR.ui.badgeRow(CR.seed.byId('01'));
check('徽章含来源与状态', /badge--school/.test(b) && /badge/.test(b));
check('徽章含待确认提示（01 无地点）', /待确认/.test(b), b);

// 12) 本机发布流程（IndexedDB 不可用时的降级）
const post = CR.store.createPost({
  title: '周三晚自习搭子', category: '搭子',
  startTime: CR.date.d(2026, 9, 23, 19, 0), location: '', people: '4 人',
  fee: '', audience: '全校', signupMethod: '', notes: '图书馆二楼'
});
check('本机发布 id 生成', !!post.id, post.id);
const opLocal = CR.store.getById(post.id);
check('本机发布 sourceType=student-local', opLocal.sourceType === 'local');
check('本机发布缺失信息识别', opLocal.missingFields.includes('地点') && opLocal.missingFields.includes('费用说明'), opLocal.missingFields.join(','));
check('本机发布进入发现列表', CR.store.allOpportunities().length === 27);
CR.store.toggleFavorite(post.id);
CR.store.addToCalendar(post.id);
check('本机发布可收藏/加日历', CR.store.isFavorite(post.id) && CR.store.inCalendar(post.id));

// 13) 持久化
check('userState 已写入 localStorage', !!store['campusradar:userState:v1']);
const reloaded = CR.storage.readUserState();
check('重新读取保留收藏', reloaded.favorites.length >= 1);
CR.store.saveProfile({ grade: 'freshman', interests: ['AI'], guardMode: true, onboarded: true });
check('档案已持久化', CR.storage.readProfile().grade === 'freshman' && CR.storage.readProfile().guardMode === true);

// 14) 新生护航推荐理由
const reasons = CR.trust.reasons(CR.seed.byId('02'), CR.store.state.profile);
check('理由含“零基础可参加”', reasons.some((r) => /零基础可参加/.test(r)), reasons.join(' | '));
check('理由含“面向全校”', reasons.some((r) => /面向全校/.test(r)), reasons.join(' | '));
check('理由含“无需报名”', reasons.some((r) => /无需报名/.test(r)), reasons.join(' | '));
const reasons14 = CR.trust.reasons(CR.seed.byId('14'), CR.store.state.profile);
check('14 号理由含“需预约/不代表录取”', reasons14.some((r) => /不代表最终录取/.test(r)), reasons14.join(' | '));

// 15) 路由
check('路由解析 detail', CR.router.parse('#/detail/09').params.id === '09',
  JSON.stringify(CR.router.parse('#/detail/09')));
check('路由解析 publish?edit', CR.router.parse('#/publish?edit=local-1').query.edit === 'local-1');
check('路由默认 discover', CR.router.parse('').name === 'discover');

// 16) 初始化后（IndexedDB 不可用的降级路径）应能正常工作
CR.store.init().then(() => {
  check('init 后 ready = true', CR.store.state.ready === true);
  check('seedVersion 已写入 localStorage', !!store['campusradar:seedVersion'],
    store['campusradar:seedVersion']);
  check('init 后给出降级提示', CR.store.state.notices.some((n) => /IndexedDB/.test(n)), CR.store.state.notices.join(' | '));
  check('init 后收藏仍在（localStorage 兜底）', CR.store.state.user.favorites.length >= 1,
    CR.store.state.user.favorites.length);
  check('init 后本机发布不丢失（内存合并）',
    CR.store.state.posts.some((p) => p.id === post.id), CR.store.state.posts.length);
  check('init 后浏览历史可用（localStorage 兜底）', CR.store.state.history.length >= 1,
    CR.store.state.history.length);
  check('init 后档案仍在', CR.store.state.profile.grade === 'freshman');

  // 我的页面（切到设置 tab，验证数据概览与清除入口）
  CR.views.mine.setTab('settings');
  const rootMine = new El('div');
  CR.views.mine.render(rootMine);
  check('我的页含数据概览', /stat-grid/.test(rootMine.innerHTML) && /收藏/.test(rootMine.innerHTML));
  check('我的页含清除数据入口', /清除全部本地数据/.test(rootMine.innerHTML));
  CR.views.mine.setTab('favorites');
  const rootMine2 = new El('div');
  CR.views.mine.render(rootMine2);
  check('我的→收藏展示已收藏条目', /已收藏/.test(rootMine2.innerHTML),
    'favs=' + CR.store.state.user.favorites.length + ' len=' + rootMine2.innerHTML.length);

  // 发布流程（表单 → 发布）
  CR.views.publish.restore();
  CR.views.publish.setField('title', '周末羽毛球约球（自检）');
  CR.views.publish.setField('startDate', '2026-09-26');
  CR.views.publish.setField('startTime', '16:00');
  CR.views.publish.setField('location', '东区体育馆 3 号场');
  CR.views.publish.setField('fee', '费用 AA');
  CR.views.publish.pickType('约球');
  CR.views.publish.setField('beginnerFriendly', '', true);
  const published = CR.views.publish.publish();
  check('表单发布成功', published.ok === true, JSON.stringify(published));
  const newOp = CR.store.getById(published.id);
  check('新发布可检索到', !!newOp && newOp.title === '周末羽毛球约球（自检）');
  check('新发布进入发现筛选结果', CR.store.filterOpportunities({ includeHidden: true })
    .some((o) => o.id === published.id));
  check('新发布可加入日历', CR.store.addToCalendar(published.id) === true);
  check('新发布出现在“我的发布”', CR.store.state.posts.some((p) => p.id === published.id));
  const asText = CR.views.detail.plainText(newOp);
  check('复制信息文本含标题与来源', /周末羽毛球约球（自检）/.test(asText) && /本机发布/.test(asText));

  // 清除数据
  return CR.store.clearAllData();
}).then(() => {
  check('清除数据后收藏为 0', CR.store.state.user.favorites.length === 0);
  check('清除数据后发布为 0', CR.store.state.posts.length === 0);
  check('清除数据后档案重置', CR.store.state.profile.onboarded === false);

  let failed = 0;
  results.forEach((r) => {
    if (!r.ok) failed++;
    console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.extra ? '   [' + r.extra + ']' : ''));
  });
  console.log('\n共 ' + results.length + ' 项，失败 ' + failed + ' 项');
  process.exit(failed ? 1 : 0);
}).catch((e) => {
  console.error('自检异常：', e);
  process.exit(2);
});
