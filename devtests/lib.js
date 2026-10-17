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

// 牌の表記から id を作る。"0m" などは赤ドラ。同じ種類は赤でない牌から順に使う。
// used に入っている id（または前に作った id）は使わない。
function IDS(text, used) {
  const u = new Set(used || []);
  const out = [];
  let nums = [];
  for (const ch of text.replace(/\s+/g, '')) {
    if (ch >= '0' && ch <= '9') { nums.push(ch); continue; }
    const si = SUITS.indexOf(ch);
    for (const d of nums) {
      let id;
      if (d === '0') id = RED_IDS[si];
      else {
        const k = si * 9 + (+d) - 1;
        const order = [1, 2, 3, 0].map(i => k * 4 + i);
        id = order.find(x => !u.has(x) && RED_IDS.indexOf(x) < 0);
        if (id == null) id = order.find(x => !u.has(x));
      }
      if (id == null || u.has(id)) throw new Error('牌が足りない: ' + text);
      u.add(id);
      out.push(id);
    }
    nums = [];
  }
  return out;
}
