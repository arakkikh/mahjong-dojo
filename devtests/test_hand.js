// 牌・和了判定・シャンテン数・待ち・受け入れのテスト

test('牌の番号と種類', () => {
  eq(TILE_COUNT, 136);
  eq(kindOf(0), 0);
  eq(kindOf(135), 33);
  eq(kindCode(0), '1m');
  eq(kindCode(17), '9p');
  eq(kindCode(27), '1z');
  eq(kindName(4), '五萬');
  eq(kindName(31), '白');
  eq(kindName(26), '九索');
  // 赤ドラは各5の1枚目
  eq(RED_IDS.map(kindOf).map(kindCode), ['5m', '5p', '5s']);
  eq(tileCode(16, { aka: 3 }), '0m');
  eq(tileCode(16, { aka: 0 }), '5m');
  eq(tileName(52, { aka: 3 }), '赤五筒');
});

test('牌の表記の読み書き', () => {
  eq(codes(K('123m0p7z')), ['1m', '2m', '3m', '5p', '7z']);
  eq(kindsText(K('7z321m99s')), '123m99s7z');
  let threw = false;
  try { K('8z'); } catch (e) { threw = true; }
  ok(threw, '8z は字牌にない');
});

test('ドラ表示牌からドラ', () => {
  const d = t => kindCode(doraFromIndicator(K(t)[0]));
  eq(d('1m'), '2m');
  eq(d('9m'), '1m');
  eq(d('9s'), '1s');
  eq(d('4z'), '1z');  // 北 → 東
  eq(d('2z'), '3z');  // 南 → 西
  eq(d('5z'), '6z');  // 白 → 發
  eq(d('7z'), '5z');  // 中 → 白
});

test('理牌は種類順・同じ種類は赤が先', () => {
  eq(sortIds([135, 17, 16, 0]), [0, 16, 17, 135]);
});

test('一般形の和了', () => {
  ok(isAgari(C('123m456p789s11122z')));
  ok(isAgari(C('11122233344455m')));
  ok(!isAgari(C('123m456p789s11z22z3z')));
  ok(!isAgari(C('123m456p789s1z')), '13枚は和了ではない');
  eq(agariForm(C('123m456p789s11122z'), 0), 'standard');
});

test('面子の分け方をすべて出す', () => {
  // 111222333m は 刻子3つ とも 順子3つ とも取れる
  const parts = decompose(C('111222333m456p11s'));
  eq(parts.length, 2);
  const types = parts.map(p => p.mentsu.map(m => m.type).join(',')).sort();
  eq(types, ['koutsu,koutsu,koutsu,shuntsu', 'shuntsu,shuntsu,shuntsu,shuntsu']);
  ok(parts.every(p => p.pair === K('1s')[0]));
  // 二盃口の形は1通り
  eq(decompose(C('112233m445566p55s')).length, 1);
  // 雀頭の候補が2つある形: 11123m → 11+123 / 111+23 は不可 … 全体で確かめる
  const p2 = decompose(C('11123m456p789s999s'));
  ok(p2.length >= 1);
  ok(p2.every(p => p.mentsu.length === 4));
});

test('七対子と国士無双', () => {
  eq(agariForm(C('1133557799m1122p'), 0), 'chiitoi');
  // 同じ牌4枚は七対子にならない
  ok(!isChiitoi(C('1111m335577p99s11z')));
  eq(agariForm(C('1111m335577p99s11z'), 0), null);
  eq(agariForm(C('19m19p19s12345677z'), 0), 'kokushi');
  ok(!isKokushi(C('19m19p19s1234567z')), '13枚では和了ではない');
  // 二盃口は七対子でもあるが一般形として扱う（点数は役判定で高い方を選ぶ）
  ok(isChiitoi(C('112233m445566p55s')));
  eq(agariForm(C('112233m445566p55s'), 0), 'standard');
  // 鳴いていると七対子・国士無双は不可
  eq(agariForm(C('1133557799m1122p'), 1), null);
});

test('鳴きがあるときの和了と聴牌', () => {
  ok(isAgari(C('123m11p'), 3));
  ok(isAgari(C('11p'), 4));
  eq(shanten(C('123m1p'), 3), 0);
  eq(codes(waits(C('123m1p'), 3)), ['1p']);
  eq(shanten(C('1p'), 4), 0);
});

test('シャンテン数（決まった手）', () => {
  eq(shanten(C('123m456p789s11122z')), -1);
  eq(shanten(C('123m456p789s1122z')), 0);           // シャンポン待ち
  eq(shanten(C('123m456p789s1z2z3z4z')), 2);         // 面子3つ＋孤立4枚
  eq(shanten(C('147m258p369s1234z')), 6);            // バラバラ。七対子の6が最小
  eq(shantenStandard(C('147m258p369s1234z')), 8);
  eq(shantenKokushi(C('147m258p369s1234z')), 7);
  eq(shantenDetail(C('19m19p19s1234567z')), { shanten: 0, form: 'kokushi' });
  eq(shantenDetail(C('1133m5577p99s11z2z')), { shanten: 0, form: 'chiitoi' });
  eq(shanten(C('123m456p789s12z34z')), 2);
  eq(shanten(C('12m45m78m12p45p7s1z')), 4);           // 搭子5つ、面子0
  eq(shanten(C('123m456m789m123p5s')), 0);
  eq(shanten(C('123m456m78m12p55s9s')), 1);          // 面子2・搭子2・雀頭1 → 1シャンテン
});

test('待ち（決まった手）', () => {
  eq(codes(waits(C('123m456p789s1122z'))), ['1z', '2z']);
  eq(codes(waits(C('1112345678999m'))), ['1m', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m']); // 九蓮宝燈
  eq(waits(C('19m19p19s1234567z')).length, 13);       // 国士無双13面
  eq(codes(waits(C('1133m5577p99s11z2z'))), ['2z']);
  eq(codes(waits(C('2345m111p222p333p'))), ['2m', '5m']); // ノベタン
  eq(codes(waits(C('123m456p789s13m55z'))).join(), '2m'); // 嵌張
  eq(codes(waits(C('12m456p789s123s55z'))).join(), '3m'); // 辺張
  eq(codes(waits(C('23m456p789s123s55z'))), ['1m', '4m']); // 両面
  // 4枚とも持っている牌は待ちにならない
  eq(shanten(C('1111m234p567s789s')), 0);
  eq(waits(C('1111m234p567s789s')), []);
});

test('受け入れ枚数', () => {
  // 両面待ち 23m: 1m と 4m 各4枚 = 8枚
  const u = ukeire(C('23m456p789s123s55z'), 0, null);
  eq(u.shanten, 0);
  eq(codes(u.tiles.map(t => t.kind)), ['1m', '4m']);
  eq(u.total, 8);
  // 見えている牌は引けない
  const vis = new Array(34).fill(0);
  vis[K('1m')[0]] = 3;
  eq(ukeire(C('23m456p789s123s55z'), 0, vis).total, 5);
  // 手の中にある牌も数から引く: 55z のシャンポンは 5z が残り2枚
  eq(ukeire(C('123m456p789s55z11p'), 0, null).total, 4);
});

test('打牌の候補', () => {
  // 面子3つ＋雀頭＋孤立の字牌2枚: 字牌を切って1シャンテン
  const ch = discardChoices(C('123m456p789s55z1z7z'), 0, null);
  eq(ch[0].shanten, 1);
  ok(['1z', '7z'].indexOf(kindCode(ch[0].kind)) >= 0);
  // 面子を崩す打牌はシャンテン数が上がる
  const worst = ch.find(c => kindCode(c.kind) === '5p');
  eq(worst.shanten, 2);
});

// ランダムな手で、計算どうしの食い違いがないかを確かめる
function randomHand(rng, n) {
  return shuffleWith(rng, allTileIds()).slice(0, n).map(kindOf);
}
// 面子を組み合わせて作る手（和了・聴牌に近い手を多く試すため）
function builtHand(rng) {
  const c = new Array(34).fill(0);
  const add = (k, n) => { if (c[k] + n > 4) return false; c[k] += n; return true; };
  let made = 0;
  let guard = 0;
  while (made < 4 && guard++ < 50) {
    if (rng() < 0.6) {
      const s = Math.floor(rng() * 3), n = Math.floor(rng() * 7), k = s * 9 + n;
      if (c[k] < 4 && c[k + 1] < 4 && c[k + 2] < 4) { c[k]++; c[k + 1]++; c[k + 2]++; made++; }
    } else if (add(Math.floor(rng() * 34), 3)) made++;
  }
  guard = 0;
  while (guard++ < 50 && !add(Math.floor(rng() * 34), 2)) {}
  const kinds = [];
  c.forEach((x, k) => { for (let i = 0; i < x; i++) kinds.push(k); });
  return kinds;
}

test('ランダムな手: 和了判定とシャンテン数 -1 が一致', () => {
  const rng = makeRng(12345);
  let agari = 0;
  for (let i = 0; i < 1500; i++) {
    const kinds = i % 2 ? randomHand(rng, 14) : builtHand(rng);
    if (kinds.length !== 14) continue;
    const c = countsOf(kinds);
    const a = isAgari(c, 0);
    if (a) agari++;
    eq(shanten(c, 0) === -1, a, kindsText(kinds));
  }
  ok(agari > 300, '和了の手を十分に試せていない: ' + agari);
});

test('ランダムな手: 聴牌と待ちが一致し、14枚のシャンテン数は打牌後の最小と同じ', () => {
  const rng = makeRng(777);
  let tenpai = 0;
  for (let i = 0; i < 600; i++) {
    const k14 = i % 2 ? randomHand(rng, 14) : builtHand(rng);
    if (k14.length !== 14) continue;
    const c14 = countsOf(k14);
    let best = 99;
    for (let k = 0; k < 34; k++) {
      if (!c14[k]) continue;
      c14[k]--;
      const s = shanten(c14, 0);
      if (s < best) best = s;
      const w = waits(c14, 0);
      const hasFour = c14.some(x => x === 4);
      if (w.length) { eq(s, 0, kindsText(k14) + ' から ' + kindCode(k)); tenpai++; }
      else if (s === 0) ok(hasFour, '聴牌なのに待ちがない: ' + kindsText(k14) + ' から ' + kindCode(k));
      c14[k]++;
    }
    // 和了の14枚（-1）だけは、どれを切っても聴牌（0）止まり
    const s14 = shanten(c14, 0);
    eq(s14 === -1 ? 0 : s14, best, kindsText(k14));
  }
  ok(tenpai > 300, '聴牌の手を十分に試せていない: ' + tenpai);
});

test('ランダムな手: 受け入れの牌を引くとシャンテン数が1つ下がる', () => {
  const rng = makeRng(99);
  for (let i = 0; i < 200; i++) {
    const k13 = randomHand(rng, 13);
    const c = countsOf(k13);
    const s = shanten(c, 0);
    const u = ukeire(c, 0, null);
    for (let k = 0; k < 34; k++) {
      if (c[k] >= 4) continue;
      c[k]++;
      const after = shanten(c, 0);
      c[k]--;
      ok(after >= s - 1, '1枚で2つ以上下がった');
      eq(u.tiles.some(t => t.kind === k), after === s - 1, kindsText(k13) + ' +' + kindCode(k));
    }
  }
});

test('計算の速さ: 打牌候補の計算 200回', () => {
  const rng = makeRng(5);
  const t0 = Date.now();
  for (let i = 0; i < 200; i++) discardChoices(countsOf(randomHand(rng, 14)), 0, null);
  const ms = Date.now() - t0;
  ok(ms < 8000, '遅すぎる: ' + ms + 'ms');
  T.speed = ms;
});
