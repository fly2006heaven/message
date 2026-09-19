/* 筛选面板遮挡回归自检
   1) 解析 styles.css 的层叠顺序，确认 .filter-aside 的基础态是 display:none，
      且「全屏遮罩 / is-open」相关规则只存在于移动端媒体查询内（这是遮挡 bug 的根因）
   2) 运行时确认筛选面板只在 __open 时带上 is-open，并提供可点击的遮罩关闭区
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

const results = [];
const check = (n, c, e) => results.push({ n, ok: !!c, e: e === undefined ? '' : String(e) });

/* ---------------------------------------------------------- 1. CSS 层叠 -- */
const cssRaw = fs.readFileSync(path.join(ROOT, 'css/styles.css'), 'utf8');
// 去掉注释，避免注释文字被误当成选择器
const css = cssRaw.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * 把样式表解析成 (媒体查询, 选择器, 声明体) 序列，保留层叠顺序。
 * 只处理本项目用到的单层 @media，足够精确。
 */
function parseRules(source) {
  const rules = [];
  let i = 0, depth = 0, media = null, buf = '';
  while (i < source.length) {
    const ch = source[i];
    if (ch === '{') {
      const head = buf.trim();
      buf = '';
      depth++;
      if (head.startsWith('@')) { media = head; i++; continue; }
      let body = '';
      let d = 1;
      i++;
      while (i < source.length && d > 0) {
        if (source[i] === '{') d++;
        else if (source[i] === '}') { d--; if (d === 0) break; }
        body += source[i];
        i++;
      }
      rules.push({ depth, media, selector: head, body });
      i++;
      depth--;
      continue;
    }
    if (ch === '}') { depth--; if (depth <= 0) { media = null; depth = 0; } buf = ''; i++; continue; }
    buf += ch;
    i++;
  }
  return rules;
}

const rules = parseRules(css);

/** 找出选择器列表中包含 sel 的规则（按层叠顺序） */
function rulesFor(sel) {
  return rules.filter((r) => r.selector.split(',').map((s) => s.trim()).indexOf(sel) >= 0);
}
function isMobileMedia(media) { return !!media && /max-width:\s*899px/.test(media); }
function isDesktopMedia(media) { return !!media && /min-width:\s*900px/.test(media); }
function idx(pred) { return rules.reduce((acc, r, i) => (pred(r) ? i : acc), -1); }

/* --- 基础态：移动端必须隐藏，否则会整页遮挡 --- */
const baseAside = rulesFor('.filter-aside').filter((r) => !r.media);
check('存在 .filter-aside 基础规则', baseAside.length > 0, baseAside.length);
check('.filter-aside 基础态为 display:none',
  baseAside.some((r) => /display:\s*none/.test(r.body)),
  baseAside.map((r) => r.body.trim().slice(0, 60)).join(' | '));

/* --- 关键回归点：全屏遮罩只允许出现在移动端媒体查询内 --- */
const fullscreenRules = rules.filter((r) =>
  /^\.filter-aside(\.is-open)?$/.test(r.selector.trim()) && /position:\s*fixed/.test(r.body));
check('全屏定位规则只存在于移动端媒体查询内',
  fullscreenRules.length > 0 && fullscreenRules.every((r) => isMobileMedia(r.media)),
  fullscreenRules.map((r) => (r.media || '（全局！这就是 bug）')).join(' | '));

check('不存在全局 .filter-aside.is-open 规则（原 bug 根因）',
  rulesFor('.filter-aside.is-open').filter((r) => !r.media).length === 0,
  JSON.stringify(rulesFor('.filter-aside.is-open').filter((r) => !r.media).map((r) => r.body.trim().slice(0, 60))));

check('全局 .filter-aside 规则不含遮罩背景色',
  baseAside.every((r) => !/rgba\(15,\s*23,\s*42/.test(r.body)),
  baseAside.map((r) => r.body.trim().slice(0, 60)).join(' | '));

/* --- 桌面端：常驻侧栏，且必须在全屏遮罩媒体查询之后，保证后者优先 --- */
const desktopAside = rulesFor('.filter-aside').filter((r) => isDesktopMedia(r.media));
check('桌面端 .filter-aside 显示为侧栏',
  desktopAside.some((r) => /display:\s*block/.test(r.body) && /!important/.test(r.body)),
  desktopAside.map((r) => r.body.trim().slice(0, 60)).join(' | '));
check('桌面端规则不含 fixed / 遮罩背景',
  desktopAside.every((r) => !/position:\s*fixed/.test(r.body) && !/rgba\(15,\s*23,\s*42/.test(r.body)),
  desktopAside.map((r) => r.body.trim().slice(0, 60)).join(' | '));

const desktopIdx = idx((r) => isDesktopMedia(r.media) && r.selector === '.filter-aside');
const mobileIdx = idx((r) => isMobileMedia(r.media) && r.selector === '.filter-aside');
check('层叠顺序：桌面 !important 规则排在移动端遮罩规则之前',
  desktopIdx >= 0 && mobileIdx >= 0 && desktopIdx < mobileIdx,
  'desktop@' + desktopIdx + ' mobile@' + mobileIdx);

/* --- 遮罩元素与关闭交互 --- */
const scrimRules = rulesFor('.filter-aside__scrim');
check('存在遮罩 .filter-aside__scrim 规则', scrimRules.length > 0);
check('遮罩默认隐藏（桌面端与收起态都不显示）',
  scrimRules.some((r) => !r.media && /display:\s*none/.test(r.body)),
  scrimRules.map((r) => (r.media || 'GLOBAL') + ':' + r.body.trim().slice(0, 40)).join(' | '));
// 注意：移动端遮罩规则使用了更高特异度的 .filter-aside .filter-aside__scrim
const scrimMobileRules = rulesFor('.filter-aside .filter-aside__scrim');
check('遮罩半透明背景在移动端生效',
  scrimMobileRules.some((r) => isMobileMedia(r.media) && /background:\s*rgba\(15,\s*23,\s*42/.test(r.body)),
  scrimMobileRules.map((r) => (r.media || 'GLOBAL')).join(' | '));

/* --- 收起态不拦截点击（可访问性/可用性） --- */
const asideMobile = rulesFor('.filter-aside').filter((r) => isMobileMedia(r.media));
check('收起态面板 pointer-events: none（不挡住背后页面）',
  asideMobile.some((r) => /pointer-events:\s*none/.test(r.body)),
  asideMobile.map((r) => r.body.trim().replace(/\s+/g, ' ').slice(0, 80)).join(' | '));
check('展开态恢复 pointer-events（仅 .is-open）',
  rulesFor('.filter-aside.is-open').some((r) => /pointer-events:\s*auto/.test(r.body)));
check('抽屉默认 transform 移出视口、展开时归位',
  rulesFor('.filter-aside .filter-sheet').some((r) => /translateY\(100%\)/.test(r.body)) &&
  rulesFor('.filter-aside.is-open .filter-sheet').some((r) => /translateY\(0\)/.test(r.body)));

/* --- 滚动锁定 --- */
check('存在 body.filter-open 滚动锁定规则',
  rulesFor('body.filter-open').some((r) => /overflow:\s*hidden/.test(r.body)));

/* --- 关闭按钮：移动端可见、桌面端隐藏 --- */
check('桌面端隐藏抽屉关闭按钮',
  rulesFor('.filter-sheet .filter-close').some((r) => !r.media && /display:\s*none/.test(r.body)));

/* ------------------------------------------------- 2. 运行时 DOM 契约 -- */
const files = ['js/utils/date.js','js/utils/trust.js','js/utils/conflict.js','js/storage.js','js/data/seed.js','js/store.js','js/components/badge.js','js/components/toast.js','js/components/card.js','js/views/discover.js','js/views/detail.js','js/views/calendar.js','js/views/publish.js','js/views/mine.js','js/views/onboarding.js','js/router.js'];
class El {
  constructor(t){this.tagName=(t||'div').toUpperCase();this.children=[];this.attrs={};this._html='';this.classList={_s:new Set(),add(...c){c.forEach(x=>this._s.add(x))},remove(...c){c.forEach(x=>this._s.delete(x))},toggle(){},contains(c){return this._s.has(c)}};}
  setAttribute(k,v){this.attrs[k]=String(v);} getAttribute(k){return k in this.attrs?this.attrs[k]:null;}
  removeAttribute(k){delete this.attrs[k];} appendChild(c){this.children.push(c);return c;} removeChild(c){return c;}
  addEventListener(){} querySelector(){return null;} querySelectorAll(){return[];}
  closest(sel) {
    // 供事件委托使用的最小实现，支持 [attr] / [attr="v"] / .cls
    const chunks = String(sel).match(/\[[^\]]*\]|\.[\w-]+/g) || [];
    let n = this;
    while (n) {
      const hit = chunks.every((c) => {
        if (c.startsWith('[')) {
          const m = c.match(/^\[([\w-]+)(?:="?([^"\]]*)"?)?\]$/);
          if (!m) return false;
          const v = n.getAttribute ? n.getAttribute(m[1]) : null;
          return (m[2] === undefined || m[2] === '') ? v !== null : v === m[2];
        }
        return n.classList && n.classList.contains(c.slice(1));
      });
      if (hit) return n;
      n = n.parent;
    }
    return null;
  }
  contains(){return false;}
  set innerHTML(v){this._html=String(v);} get innerHTML(){return this._html;}
}
const st = {};
const doc = { readyState:'complete', hidden:false, documentElement:new El('html'), body:new El('body'),
  createElement:(t)=>new El(t), getElementById:()=>null, querySelector:()=>null, querySelectorAll:()=>[],
  addEventListener(){}, removeEventListener(){} };
const w = { localStorage:{getItem:k=>k in st?st[k]:null,setItem:(k,v)=>{st[k]=String(v)},removeItem:k=>{delete st[k]}},
  document:doc, location:{hash:'',pathname:'/',search:''}, history:{replaceState(){}}, navigator:{},
  addEventListener(){}, setTimeout, clearTimeout, setInterval:()=>0, clearInterval(){}, console,
  indexedDB:undefined, scrollTo(){}, scrollY:0 };
w.window = w;
const ctx = vm.createContext(w);
files.forEach(f=>vm.runInContext(fs.readFileSync(path.join(ROOT,f),'utf8'),ctx,{filename:f}));
const CR = w.CampusRadar;

CR.store.init().then(() => {
  const render = () => { const r = new El('div'); CR.views.discover.render(r); return r.innerHTML; };

  CR.store.state.preferences.__open = false;
  const closed = render();
  check('默认（未展开）面板不带 is-open', !/filter-aside is-open/.test(closed));
  check('默认渲染含遮罩元素', /filter-aside__scrim/.test(closed));
  check('遮罩绑定 closeFilters 动作', /class="filter-aside__scrim" data-action="closeFilters"/.test(closed));
  check('抽屉内提供 ✕ 关闭按钮', /data-action="closeFilters"[^>]*aria-label="关闭筛选"/.test(closed) ||
    /aria-label="关闭筛选"[^>]*data-action="closeFilters"/.test(closed));
  check('抽屉底部提供「查看结果」关闭入口', /data-action="closeFilters">查看结果/.test(closed));

  CR.store.state.preferences.__open = true;
  const opened = render();
  check('展开时面板带 is-open', /filter-aside is-open/.test(opened));
  check('面板不再是 aside.discover-aside 误用类', !/discover-aside[^"]*is-open/.test(opened));

  // 面板结构：遮罩 + 表单同级
  check('遮罩与筛选表单为同级兄弟节点',
    opened.indexOf('filter-aside__scrim') < opened.indexOf('filter-sheet'),
    'scrim@' + opened.indexOf('filter-aside__scrim') + ' sheet@' + opened.indexOf('filter-sheet'));

  CR.store.state.preferences.__open = false;

  // 事件委托：点遮罩 / 点 ✕ 都应关闭抽屉，并解除滚动锁定
  const files2 = ['js/app.js'];
  const listeners = {};
  const bodyClasses = new Set();
  const mainEl = new El('main');
  mainEl.setAttribute('id', 'main');
  const bodyEl = new El('body');
  bodyEl.classList = {
    toggle(c, f) { if (f) bodyClasses.add(c); else bodyClasses.delete(c); },
    add(c) { bodyClasses.add(c); },
    remove(c) { bodyClasses.delete(c); },
    contains(c) { return bodyClasses.has(c); }
  };
  const doc2 = {
    readyState: 'complete', hidden: false, activeElement: null,
    documentElement: new El('html'),
    body: bodyEl,
    createElement: (t) => new El(t),
    getElementById: (id) => (id === 'main' ? mainEl : null),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
    removeEventListener() {}
  };
  const st2 = {};
  const w2 = {
    localStorage: { getItem: (k) => (k in st2 ? st2[k] : null), setItem: (k, v) => { st2[k] = String(v); }, removeItem: (k) => { delete st2[k]; } },
    document: doc2,
    location: { hash: '#/discover', pathname: '/index.html', search: '' },
    history: { replaceState() {} },
    navigator: {}, addEventListener() {}, removeEventListener() {},
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {},
    console, indexedDB: undefined, Notification: undefined, scrollTo() {}, scrollY: 0
  };
  w2.window = w2;
  const ctx2 = vm.createContext(w2);
  files.concat(files2).forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx2, { filename: f }));
  const CR2 = w2.CampusRadar;

  const click = (attrs) => {
    const el = new El('button');
    Object.keys(attrs).forEach((k) => el.setAttribute(k, attrs[k]));
    el.parent = mainEl;
    (listeners.click || []).forEach((fn) => fn({ target: el, preventDefault() {} }));
  };

  CR2.store.init().then(() => {
    click({ 'data-action': 'openFilters' });
    check('打开抽屉后 body 加锁 filter-open', bodyClasses.has('filter-open'),
      [...bodyClasses].join(','));
    check('打开抽屉后模型标记 __open', CR2.store.state.preferences.__open === true);

    click({ 'data-action': 'closeFilters' });
    check('点遮罩/✕ 关闭后解除 body 锁', !bodyClasses.has('filter-open'), [...bodyClasses].join(','));
    check('关闭后模型标记 __open=false', CR2.store.state.preferences.__open === false);

    // 打开后切走路由：必须自动收起并解锁，否则页面无法滚动
    click({ 'data-action': 'openFilters' });
    check('再次打开后 body 处于锁定', bodyClasses.has('filter-open'));
    CR2.router.navigate('#/calendar');
    CR2.router.resolve();   // 模拟浏览器在 hash 变化后触发 hashchange
    check('切换路由后自动收起抽屉（解锁滚动）',
      !bodyClasses.has('filter-open') && CR2.store.state.preferences.__open === false,
      'classes=' + [...bodyClasses].join(',') + ' open=' + CR2.store.state.preferences.__open);

    let failed = 0;
    results.forEach(r => { if (!r.ok) failed++; console.log((r.ok ? 'PASS ' : 'FAIL ') + r.n + (r.e ? '   [' + r.e + ']' : '')); });
    console.log('\n共 ' + results.length + ' 项，失败 ' + failed + ' 项');
    process.exit(failed ? 1 : 0);
  });
});
