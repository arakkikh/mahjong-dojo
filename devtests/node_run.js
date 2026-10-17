// jsc がない環境（Linux など）でテストを動かす。jsc と同じく、各ファイルを同じグローバルで順に読む。
// 使い方: node devtests/node_run.js file1.js file2.js ... -e "report('x')"
const fs = require('fs');
const vm = require('vm');
globalThis.print = (...a) => console.log(...a);
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '-e') { vm.runInThisContext(args[++i], { filename: '-e' }); continue; }
  vm.runInThisContext(fs.readFileSync(args[i], 'utf8'), { filename: args[i] });
}
