/* 一键运行全部自检：node tests/run-all.js */
const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const suites = ['selftest.js', 'flowtest.js', 'apptest.js', 'structuretest.js', 'clocktest.js', 'filtertest.js', 'readmetest.js'];
let failed = 0;

for (const s of suites) {
  console.log('\n================ ' + s + ' ================');
  const res = spawnSync(process.execPath, [path.join(__dirname, s)], {
    cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'inherit', 'inherit']
  });
  if (res.status !== 0) failed++;
}

console.log('\n' + (failed ? '有 ' + failed + ' 个测试套件失败' : '全部测试套件通过 ✅'));
process.exit(failed ? 1 : 0);
