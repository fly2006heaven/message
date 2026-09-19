/* 结构自检：标签闭合、id 唯一性、DOM 契约（data-action 是否都有处理分支） */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const files = ['js/utils/date.js','js/utils/trust.js','js/utils/conflict.js','js/storage.js','js/data/seed.js','js/store.js','js/components/badge.js','js/components/toast.js','js/components/card.js','js/views/discover.js','js/views/detail.js','js/views/calendar.js','js/views/publish.js','js/views/mine.js','js/views/onboarding.js','js/router.js'];

class El {
  constructor(t){this.tagName=(t||'div').toUpperCase();this.children=[];this.attrs={};this._html='';this.classList={add(){},remove(){},toggle(){},contains(){return false}};}
  setAttribute(k,v){this.attrs[k]=String(v);} getAttribute(k){return k in this.attrs?this.attrs[k]:null;}
  removeAttribute(k){delete this.attrs[k];} appendChild(c){this.children.push(c);return c;} removeChild(c){return c;}
  addEventListener(){} querySelector(){return null;} querySelectorAll(){return[];} closest(){return null;} contains(){return false;}
  set innerHTML(v){this._html=String(v);} get innerHTML(){return this._html;}
}
const st = {};
const doc = { readyState:'complete', hidden:false, documentElement:new El('html'), body:new El('body'),
  createElement:(t)=>new El(t), getElementById:()=>null, querySelector:()=>null, querySelectorAll:()=>[],
  addEventListener(){}, removeEventListener(){} };
const w = { localStorage:{getItem:k=>k in st?st[k]:null,setItem:(k,v)=>{st[k]=String(v)},removeItem:k=>{delete st[k]}},
  document:doc, location:{hash:'',pathname:'/',search:''}, history:{replaceState(){}}, navigator:{},
  addEventListener(){}, setTimeout, clearTimeout, setInterval:()=>0, clearInterval(){}, console, indexedDB:undefined,
  scrollTo(){}, scrollY:0 };
w.window = w;
const ctx = vm.createContext(w);
files.forEach(f=>vm.runInContext(fs.readFileSync(path.join(ROOT,f),'utf8'),ctx,{filename:f}));
const CR = w.CampusRadar;

const results = [];
const check = (n,c,e)=>results.push({n,ok:!!c,e:e===undefined?'':String(e)});

/* ---------- 1. 标签闭合 ---------- */
const VOID = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
function balance(html, label) {
  const stack = [];
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*?)(\/?)>/g;
  let m, bad = null;
  while ((m = re.exec(html))) {
    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();
    const selfClose = m[4] === '/';
    if (VOID.has(tag) || selfClose) continue;
    if (!closing) stack.push(tag);
    else {
      const top = stack.pop();
      if (top !== tag) { bad = '期望 </' + top + '> 但遇到 </' + tag + '>'; break; }
    }
  }
  if (!bad && stack.length) bad = '未闭合：' + stack.slice(-4).join(', ');
  check('HTML 标签闭合：' + label, !bad, bad || 'ok');
  return html;
}

function render(label, fn) {
  const root = new El('div');
  fn(root);
  const html = root.innerHTML;
  balance(html, label);
  // id 唯一性
  const ids = (html.match(/ id="([^"]+)"/g) || []).map(s => s.slice(5, -1));
  const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
  check('id 唯一：' + label, dup.length === 0, dup.join(','));
  // aria 属性引号完整
  check('属性无残留模板符：' + label, !html.includes('undefined') && !html.includes('NaN'), 
    (html.match(/undefined|NaN/) || []).slice(0, 3).join(','));
  return html;
}

(async () => {
  await CR.store.init();

  const discoverHtml = render('发现页', (r) => CR.views.discover.render(r));
  render('详情页-01', (r) => CR.views.detail.render(r, { id: '01' }));
  render('详情页-24', (r) => CR.views.detail.render(r, { id: '24' }));
  render('详情页-16', (r) => CR.views.detail.render(r, { id: '16' }));
  render('日历页', (r) => CR.views.calendar.render(r));
  render('发布页', (r) => CR.views.publish.render(r));
  render('我的', (r) => CR.views.mine.render(r));
  render('新生引导', (r) => CR.views.onboarding.render(r));
  render('引导完成页', (r) => { CR.views.onboarding.restart(); CR.views.onboarding.next(); CR.views.onboarding.render(r); });

  /* ---------- 2. DOM 契约：每个 data-action 都有处理分支 ---------- */
  const appSrc = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
  const used = new Set();
  (discoverHtml.match(/data-action="([^"]+)"/g) || []).forEach(s => used.add(s.replace(/data-action="|"/g, "")));
  ['detail','calendar','publish','mine','onboarding'].forEach((v) => {
    const src = fs.readFileSync(path.join(ROOT, 'js/views/' + v + '.js'), 'utf8');
    (src.match(/data-action="([^"]+)"/g) || []).forEach(s => used.add(s.replace(/data-action="|"/g, "")));
  });
  (fs.readFileSync(path.join(ROOT, 'js/components/card.js'), 'utf8').match(/data-action="([^"]+)"/g) || [])
    .forEach(s => used.add(s.replace(/data-action="|"/g, "")));
  const unhandled = [...used].filter((a) => {
    if (a === 'search') return false;      // 输入框，由 input 事件处理
    if (a === 'sort') return false;        // 下拉框，由 change 事件处理
    if (a === 'noteInput') return false;   // 文本域，保存时按 id 读取
    if (a === 'guardCheck') return false;  // 复选框，由 change 事件处理
    if (a.indexOf('+') >= 0) return false; // 源码模板拼接片段
    return !new RegExp("case '" + a + "'").test(appSrc);
  });
  check('所有 data-action 均有处理分支', unhandled.length === 0, unhandled.join(','));

  /* ---------- 3. DOM 契约：所有 data-field 都在发布表单存在 ---------- */
  const pubSrc = fs.readFileSync(path.join(ROOT, 'js/views/publish.js'), 'utf8');
  const fields = new Set((pubSrc.match(/name: '([a-zA-Z]+)'/g) || []).map(s => s.replace(/name: '|'/g, '')));
  fields.add('longTerm'); fields.add('needReview'); fields.add('beginnerFriendly');
  const pubHtml = (() => { const r = new El('div'); CR.views.publish.render(r); return r.innerHTML; })();
  const declared = new Set((pubHtml.match(/data-field="([^"]+)"/g) || []).map(s => s.replace(/data-field="|"/g, "")));
  const missingField = [...declared].filter((f) => !fields.has(f));
  check('发布表单字段与渲染一致', missingField.length === 0, missingField.join(','));

  /* ---------- 4. 无障碍契约 ---------- */
  check('发现页存在搜索 label', /<label class="sr-only" for="q">/.test(discoverHtml));
  check('输入框带 id 与 label', /<label class="field__label" for="f-title">/.test(pubHtml));
  const detail24 = (() => { const r = new El('div'); CR.views.detail.render(r, { id: '24' }); return r.innerHTML; })();
  check('对话框/操作栏具 aria', /aria-pressed/.test(detail24) && /aria-labelledby/.test(detail24));
  check('风险提示带文字而非仅颜色', /高风险信息/.test(detail24));
  const calHtml = (() => { const r = new El('div'); CR.views.calendar.render(r); return r.innerHTML; })();
  check('日历使用 role=grid / gridcell', /role="grid"/.test(calHtml) && /role="gridcell"/.test(calHtml));
  check('日历图例含文字说明', /报名截止/.test(calHtml) && /学生自发/.test(calHtml));

  /* ---------- 5. 关键内容抽查 ---------- */
  check('发现页含 26 条（含本机发布计数）', /共 26 条机会/.test(discoverHtml), (discoverHtml.match(/共 \d+ 条机会/) || [])[0]);
  check('截止雷达含 9月24日 22:00', /9月24日 22:00/.test(discoverHtml));
  check('截止雷达含 10月5日 23:59', /10月5日 23:59/.test(discoverHtml));
  check('补充通知在发现页独立成卡', /程序设计训练营补充通知/.test(discoverHtml));
  const d01 = (() => { const r = new El('div'); CR.views.detail.render(r, { id: '01' }); return r.innerHTML; })();
  check('详情 01 关联 09 且不覆盖原文', /补充通知（关联 01）/.test(d01) && /9 月 24 日 22:00/.test(d01));
  const d17 = (() => { const r = new El('div'); CR.views.detail.render(r, { id: '17' }); return r.innerHTML; })();
  check('详情 17 说明提取信息有效期', /网盘提取信息有效期/.test(d17));
  const d19 = (() => { const r = new El('div'); CR.views.detail.render(r, { id: '19' }); return r.innerHTML; })();
  check('详情 19 候补说明', /如现场仍有余位，可接受候补入场/.test(d19));
  const d8 = (() => { const r = new El('div'); CR.views.detail.render(r, { id: '08' }); return r.innerHTML; })();
  check('详情 08 显示长期开放', /长期开放/.test(d8));

  let failed = 0;
  results.forEach((r) => { if (!r.ok) failed++; console.log((r.ok ? 'PASS ' : 'FAIL ') + r.n + (r.e ? '   [' + r.e + ']' : '')); });
  console.log('\n共 ' + results.length + ' 项，失败 ' + failed + ' 项');
  process.exit(failed ? 1 : 0);
})();
