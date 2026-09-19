/* 时钟无关性自检：模拟 2027 年的系统时间，验证「今日焦点」回退与状态降级不出错 */
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

// 把系统时间挪到 2027-03-05
const OFFSET = new Date('2027-03-05T10:00:00').getTime() - Date.now();
const RealDate = Date;
class FakeDate extends RealDate {
  constructor(...args) {
    if (args.length === 0) super(RealDate.now() + OFFSET);
    else super(...args);
  }
  static now() { return RealDate.now() + OFFSET; }
}

const st = {};
const doc = { readyState:'complete', hidden:false, documentElement:new El('html'), body:new El('body'),
  createElement:(t)=>new El(t), getElementById:()=>null, querySelector:()=>null, querySelectorAll:()=>[],
  addEventListener(){}, removeEventListener(){} };
const w = { localStorage:{getItem:k=>k in st?st[k]:null,setItem:(k,v)=>{st[k]=String(v)},removeItem:k=>{delete st[k]}},
  document:doc, location:{hash:'',pathname:'/',search:''}, history:{replaceState(){}}, navigator:{},
  addEventListener(){}, setTimeout, clearTimeout, setInterval:()=>0, clearInterval(){}, console,
  indexedDB:undefined, scrollTo(){}, scrollY:0, Date: FakeDate };
w.window = w;
const ctx = vm.createContext(w);
files.forEach(f=>vm.runInContext(fs.readFileSync(path.join(ROOT,f),'utf8'),ctx,{filename:f}));
const CR = w.CampusRadar;

const results = [];
const check = (n,c,e)=>results.push({n,ok:!!c,e:e===undefined?'':String(e)});

CR.store.init().then(() => {
  const r = new El('div');
  CR.views.discover.render(r);
  const html = r.innerHTML;

  check('异时钟下发现页仍可渲染', html.length > 5000, html.length);
  check('今日焦点回退到基准日前后两天', /数据基准日 2026年9月19日 周六 前后两天/.test(html),
    (html.match(/section__hint">[^<]*/) || [])[0]);
  check('今日焦点仍显示卡片（不空白）', /pulse-card/.test(html),
    (html.match(/pulse-card/g) || []).length);
  check('截止雷达含已截止标记', /已截止/.test(html));
  check('详情页在异时钟下仍可渲染', (() => {
    const d = new El('div');
    CR.views.detail.render(d, { id: '05' });
    return /已截止|报名截止倒计时/.test(d.innerHTML) && d.innerHTML.length > 3000;
  })());
  check('日历页在异时钟下仍可渲染', (() => {
    const d = new El('div');
    CR.views.calendar.render(d);
    return /cal-grid/.test(d.innerHTML);
  })());
  check('状态徽章在异时钟下不报错', CR.conflict.statusOf(CR.seed.byId('02')) === 'ended',
    CR.conflict.statusOf(CR.seed.byId('02')));

  let failed = 0;
  results.forEach(rr => { if (!rr.ok) failed++; console.log((rr.ok?'PASS ':'FAIL ')+rr.n+(rr.e?'   ['+rr.e+']':'')); });
  console.log('\n共 ' + results.length + ' 项，失败 ' + failed + ' 项');
  process.exit(failed ? 1 : 0);
});
