// 小さなテスト用の道具。jsc で core/*.js の後に読み込む。
const T = { pass: 0, fail: 0, fails: [] };

function test(name, fn) {
  try {
    fn();
    T.pass++;
  } catch (e) {
    T.fail++;
    T.fails.push(name + ': ' + (e && e.message ? e.message : e));
  }
}

function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function eq(actual, expected, msg) {
  if (!same(actual, expected)) {
    throw new Error((msg ? msg + ' ' : '') + '期待 ' + JSON.stringify(expected) + ' / 実際 ' + JSON.stringify(actual));
  }
}
function ok(cond, msg) { if (!cond) throw new Error(msg || '条件が成り立たない'); }

function report(label) {
  for (const f of T.fails) print('FAIL ' + f);
  print(label + ': ' + T.pass + '/' + (T.pass + T.fail) + (T.fail ? ' FAIL' : ' OK'));
}

// テスト用の記法: 牌の表記から kind の並び（"1m" 単位）を作る
function K(text) { return parseKinds(text); }
function C(text) { return countsFrom(text); }
function codes(kinds) { return kinds.map(kindCode); }
