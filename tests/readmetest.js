/* 校验 README 的目录锚点、代码块配对与关键声明数字 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const md = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');

const results = [];
const check = (n, c, e) => results.push({ n, ok: !!c, e: e === undefined ? '' : String(e) });
const countLines = (file) => fs.readFileSync(file, 'utf8').split('\n').length;

/* 本文件自身的断言数量（写死以免自引用递归）；新增断言时同步加一 */
const SELF_ASSERTIONS = 19;

/* 1. 代码块配对 */
const fences = (md.match(/^```/gm) || []).length;
check('代码块围栏成对出现', fences % 2 === 0, fences + ' 个 ```');

/* 2. 从标题生成 GitHub 风格锚点（中文保留、英文小写、空格转 -、去掉标点） */
function slug(text) {
  return text
    .replace(/`/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .toLowerCase()
    .trim()
    .replace(/[\s\u3000]+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]/g, '')
    .replace(/-+/g, '-');
}

const headings = [];
const lines = md.split('\n');
let inFence = false;
lines.forEach((line) => {
  if (/^```/.test(line)) { inFence = !inFence; return; }
  if (inFence) return;
  const m = line.match(/^(#{1,4})\s+(.+?)\s*$/);
  if (m) headings.push({ level: m[1].length, text: m[2], slug: slug(m[2]) });
});

const slugs = new Set(headings.map((h) => h.slug));

/* 3. 目录内部链接全部可达 */
const links = [];
const linkRe = /\]\(#([^)]+)\)/g;
let m;
while ((m = linkRe.exec(md))) links.push(decodeURIComponent(m[1]));
check('存在目录内部链接', links.length > 0, links.length + ' 条');
const dead = links.filter((l) => !slugs.has(l));
check('所有内部锚点都能对应到标题', dead.length === 0, dead.join(' | '));

/* 4. 标题层级不跳级（## → ####） */
let jump = null;
for (let i = 1; i < headings.length; i++) {
  if (headings[i].level - headings[i - 1].level > 1) {
    jump = headings[i - 1].text + ' → ' + headings[i].text;
    break;
  }
}
check('标题层级未跳级', !jump, jump || 'ok');

/* 5. 关键声明与源码一致 */
const seed = fs.readFileSync(path.join(ROOT, 'js/data/seed.js'), 'utf8');
const seedCount = (seed.match(/^\s{4}make\(\{/gm) || []).length;
check('README 声称的 26 条种子数据与实际一致', seedCount === 26, seedCount);

const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const scriptCount = (indexHtml.match(/<script src=/g) || []).length;
check('README 声称的 17 个脚本与 index.html 一致', scriptCount === 17, scriptCount);

const jsFiles = [];
(function walk(dir) {
  fs.readdirSync(dir).forEach((f) => {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.js')) jsFiles.push(p);
  });
})(path.join(ROOT, 'js'));
check('README 声称的 17 个 JS 模块与实际一致', jsFiles.length === 17, jsFiles.length);
check('README 用约数描述代码量（避免行数口径歧义）',
  /约 6,000 行/.test(md) && /约 1,600 行/.test(md) && /约 1,400 行/.test(md),
  'ok');
const jsLines = jsFiles.reduce((sum, f) => sum + countLines(f), 0);
check('JS 代码量确实在 6,000 行量级', jsLines > 5000 && jsLines < 7000, jsLines);
const testLines = fs.readdirSync(path.join(ROOT, 'tests')).filter((f) => f.endsWith('.js'))
  .reduce((sum, f) => sum + countLines(path.join(ROOT, 'tests', f)), 0);
check('测试代码量确实在 1,600 行量级', testLines > 1400 && testLines < 1800, testLines);

/* 6. 表格格式：每行竖线数量与表头一致（粗略但有效） */
const tableIssues = [];
let block = [];
lines.forEach((line, i) => {
  if (/^\s*\|/.test(line)) { block.push({ line, i }); return; }
  if (block.length >= 2) {
    const counts = block.map((b) => (b.line.match(/\|/g) || []).length);
    if (new Set(counts).size > 1) {
      tableIssues.push('第 ' + (block[0].i + 1) + ' 行起的表格列数不一致: ' + counts.join(','));
    }
  }
  block = [];
});
check('markdown 表格列数一致', tableIssues.length === 0, tableIssues.slice(0, 3).join(' | '));

/* 7. 不要出现占位符或未替换内容
   注意排除两类正常文案：CSS 类名示例（.badge--xxx）、以及「补充说明」这类题目原文用词 */
const placeholders = md
  .replace(/`[^`]*`/g, '')                 // 去掉行内代码（含类名示例）
  .match(/\bTODO\b|\bFIXME\b|【待填|待补充写|占位符|PLACEHOLDER/gi) || [];
check('无 TODO / FIXME / 占位符残留', placeholders.length === 0, placeholders.slice(0, 3).join(' | '));

/* 8. 徽章链接格式正确（shields.io 图片 + 合法 URL） */
const badges = (md.match(/!\[[^\]]*\]\(https:\/\/img\.shields\.io[^)]+\)/g) || []);
check('存在状态徽章', badges.length >= 4, badges.length + ' 个');
check('徽章链接格式合法', badges.every((b) => /\)$/.test(b) && b.includes('style=flat-square')),
  badges.length + ' 个');

/* 9. 断言总数与套件清单保持一致
   直接运行每个套件并解析其自报的断言数，避免手写数字过期（readmetest 自身除外） */
const { spawnSync } = require('child_process');
const suiteFiles = fs.readdirSync(path.join(ROOT, 'tests'))
  .filter((f) => f.endsWith('.js') && f !== 'run-all.js');
check('README 列出的套件数量与实际文件一致', suiteFiles.length === 7, suiteFiles.length);
const notListed = suiteFiles.filter((f) => !md.includes('`' + f + '`'));
check('README 中列出了每一个测试套件', notListed.length === 0, notListed.join(','));

const measured = {};
suiteFiles.filter((f) => f !== 'readmetest.js').forEach((f) => {
  const res = spawnSync(process.execPath, [path.join(ROOT, 'tests', f)], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024
  });
  const m = String(res.stdout || '').match(/共\s*(\d+)\s*项/);
  measured[f] = m ? Number(m[1]) : null;
});

const badSuites = Object.keys(measured).filter((f) => measured[f] == null);
check('每个套件都能自报断言数', badSuites.length === 0, badSuites.join(','));

/* README 表格中每个套件的断言数都应等于其实测值 */
const mismatch = [];
Object.keys(measured).forEach((f) => {
  if (measured[f] == null) return;
  const re = new RegExp('`' + f.replace('.', '\\.') + '`\\s*\\|\\s*(\\d+)\\s*\\|');
  const hit = md.match(re);
  if (!hit) { mismatch.push(f + ': 表格中未找到'); return; }
  if (Number(hit[1]) !== measured[f]) mismatch.push(f + ': README ' + hit[1] + ' vs 实测 ' + measured[f]);
});
check('README 表格中各套件断言数与实测一致', mismatch.length === 0, mismatch.join(' | '));

/* 声明总数 = 各套件实测值之和（含 readmetest 自身运行时的数量） */
const selfMatch = fs.readFileSync(__filename, 'utf8');
const selfCount = Number((selfMatch.match(/const SELF_ASSERTIONS = (\d+)/) || [])[1] || 0);
const measuredTotal = Object.keys(measured).reduce((s, k) => s + (measured[k] || 0), 0) + selfCount;
check('README 声明的断言总数与实测之和一致',
  md.includes(measuredTotal.toLocaleString('en-US') + ' 项断言'),
  '实测合计 ' + measuredTotal);

let failed = 0;
results.forEach((r) => { if (!r.ok) failed++; console.log((r.ok ? 'PASS ' : 'FAIL ') + r.n + (r.e ? '   [' + r.e + ']' : '')); });
console.log('\n共 ' + results.length + ' 项，失败 ' + failed + ' 项');
console.log('标题数: ' + headings.length + ' · 内部链接: ' + links.length);
process.exit(failed ? 1 : 0);
