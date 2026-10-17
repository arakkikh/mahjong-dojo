// 4人対局（段階②）のテスト

// 牌の表記から id を作る（同じ種類は 0,1,2,3 枚目と順に使う）。skip に入っている id は使わない。
function ids(text, skip) {
  const used = new Set(skip || []);
  return K(text).map(k => { let id = k * 4; while (used.has(id)) id++; used.add(id); return id; });
}

// あなた（席0）も CPU と同じ考え方で打たせて、局の終わりまで進める
function playHand(g, humanRons) {
  let guard = 0;
  while (g.h.phase !== 'end') {
    if (++guard > 1000) throw new Error('局が終わらない');
    if (gameStep(g)) continue;
    const h = g.h;
    if (h.phase === 'discard') {
      if (canTsumo(g, HUMAN)) gameTsumo(g, HUMAN);
      else gameDiscard(g, HUMAN, cpuChooseDiscard(g, HUMAN));
    } else if (h.phase === 'call') {
      if (humanRons === false) gameSkip(g, HUMAN); else gameRon(g, HUMAN);
    }
  }
}

function sum(a) { return a.reduce((x, y) => x + y, 0); }

// 局の途中の牌：手牌・ツモ牌・捨て牌・山の残り・王牌 がちょうど136枚で重ならない
function checkTiles(g) {
  const h = g.h;
  const all = [];
  for (const hd of h.hands) all.push(...hd);
  if (h.drawn != null) all.push(h.drawn);
  for (const ds of h.discards) for (const d of ds) all.push(d.id);
  all.push(...h.wall.live.slice(h.wall.next));
  all.push(...h.wall.dead);
  eq(all.length, 136, '牌の枚数');
  eq(new Set(all).size, 136, '牌が重なっていない');
}

// 局の途中に置きかえる：席 seat に手番を渡して、ツモった牌 drawn を持たせる
function setTurn(g, seat, hand13, drawn) {
  const h = g.h;
  h.hands[seat] = sortIds(hand13);
  h.turn = seat;
  h.drawn = drawn;
  h.phase = 'discard';
}

test('配牌: 4人とも13枚、親から始まる、25000点', () => {
  const g = gameNew(10);
  for (let s = 0; s < 4; s++) eq(g.h.hands[s].length, 13);
  eq(g.h.turn, dealerOf(g));
  eq(g.h.phase, 'draw');
  eq(g.points, [25000, 25000, 25000, 25000]);
  eq(wallLeft(g.h.wall), 70);
  checkTiles(g);
  eq(seatWind(g, dealerOf(g)), 0);
  eq(roundLabel(g), '東1局');
});

test('同じシードなら同じ対局になる', () => {
  const a = gameNew(77, Object.assign({}, DEFAULT_RULES, { length: 'tonpu' }));
  const b = gameNew(77, Object.assign({}, DEFAULT_RULES, { length: 'tonpu' }));
  while (!a.over) { playHand(a); gameNextHand(a); }
  while (!b.over) { playHand(b); gameNextHand(b); }
  eq(a.points, b.points);
  eq(a.history, b.history);
});

test('自動で東風戦を最後まで: 点数の合計は100000点のまま、牌の数も正しい', () => {
  for (let seed = 1; seed <= 6; seed++) {
    const g = gameNew(seed, Object.assign({}, DEFAULT_RULES, { length: 'tonpu' }));
    let hands = 0;
    while (!g.over) {
      checkTiles(g);
      // 局の途中でも牌の数が合っているか（ツモと打牌を何回か進める）
      for (let i = 0; i < 9 && g.h.phase !== 'end'; i++) { if (!gameStep(g)) break; checkTiles(g); }
      playHand(g);
      eq(sum(g.points), 100000, 'seed ' + seed);
      ok(gameNextHand(g));
      if (++hands > 60) throw new Error('対局が終わらない');
    }
    ok(hands >= 4 || g.points.some(p => p < 0), '東風戦は4局以上');
    eq(g.history.length, hands);
    eq(gameRanking(g).length, 4);
  }
});

test('自動で半荘戦を最後まで', () => {
  const g = gameNew(123);
  while (!g.over) { playHand(g); gameNextHand(g); }
  ok(g.history.length >= 8 || g.points.some(p => p < 0));
  eq(sum(g.points), 100000);
  const r = gameRanking(g);
  for (let i = 1; i < 4; i++) ok(g.points[r[i - 1]] >= g.points[r[i]], '順位は点数順');
});

test('ロン: 子が子からロンすると1000点、手番は終わる', () => {
  const g = gameNew(20);
  g.chicha = 0;  // 親はあなた
  // 席2 が 1z 2z のシャンポン待ち
  const hand2 = ids('123m456p789s1122z');
  g.h.hands[2] = sortIds(hand2);
  const win = ids('1z', hand2)[0];
  setTurn(g, 1, ids('2468m2468p2468s3z', hand2.concat([win])), win);
  ok(gameDiscard(g, 1, win));
  eq(g.h.phase, 'call');
  eq(g.h.callers, [2]);
  ok(gameStep(g));
  eq(g.h.phase, 'end');
  eq(g.h.result.type, 'ron');
  eq(g.h.result.winner, 2);
  eq(g.h.result.loser, 1);
  eq(g.h.result.pay, [0, -1000, 1000, 0]);
  eq(g.points, [25000, 24000, 26000, 25000]);
});

test('ロン: 頭ハネ（捨てた人から手番の近い人だけ）', () => {
  const g = gameNew(21);
  g.chicha = 0;
  g.h.hands[3] = sortIds(ids('123m456p789s1122z'));        // 1z 2z 待ち
  g.h.hands[1] = sortIds(ids('234m567p678s3331z', g.h.hands[3]));  // 1z 単騎
  const win = ids('1z', g.h.hands[1].concat(g.h.hands[3]))[0];
  setTurn(g, 2, ids('2468m2468p2468s4z'), win);
  ok(gameDiscard(g, 2, win));
  eq(g.h.callers, [3, 1]);
  ok(!gameRon(g, 1), '後の人はロンできない');
  ok(gameRon(g, 3));
  eq(g.h.result.winner, 3);
});

test('フリテン: 自分の捨て牌に待ちがあるとロンできない', () => {
  const g = gameNew(22);
  const hand2 = ids('123m456p789s1122z');
  g.h.hands[2] = sortIds(hand2);
  const old = ids('2z', hand2)[0];
  g.h.discards[2].push({ id: old, tsumogiri: false });
  ok(isFuriten(g, 2));
  const win = ids('1z', hand2)[0];
  setTurn(g, 1, ids('2468m2468p2468s3z'), win);
  gameDiscard(g, 1, win);
  eq(g.h.callers, [], '1z でもロンできない（2z を捨てているので）');
  eq(g.h.phase, 'draw');
  eq(g.h.turn, 2);
});

test('フリテン: ロンを見送ると次に捨てるまでロンできない', () => {
  const g = gameNew(23);
  g.chicha = 1;
  const hand0 = ids('123m456p789s1122z');
  g.h.hands[0] = sortIds(hand0);
  const used = hand0.slice();
  const w1 = ids('1z', used)[0]; used.push(w1);
  setTurn(g, 3, ids('2468m2468p2468s3z', used), w1);
  gameDiscard(g, 3, w1);
  eq(g.h.callers, [0]);
  ok(waitingHuman(g));
  ok(!gameStep(g), 'あなたの判断を待つ');
  ok(gameSkip(g, 0));
  eq(g.h.tempFuriten[0], true);
  eq(g.h.phase, 'draw');
  eq(g.h.turn, 0);
  // 自分のツモの前に、別の人の 2z ではロンできない
  g.h.tempFuriten[0] = true;
  ok(isFuriten(g, 0));
  // 自分が捨てるとフリテンが解ける（捨て牌に待ちがなければ）
  ok(gameDraw(g));
  gameDiscard(g, 0, g.h.drawn === null ? g.h.hands[0][0] : g.h.drawn);
  eq(g.h.tempFuriten[0], false);
});

test('ツモ: 子のツモは 親500・子300（本場は1人100点ずつ）', () => {
  const g = gameNew(24);
  g.chicha = 0;
  g.honba = 2;
  const hand = ids('123m456p789s11122z');
  setTurn(g, 2, hand.slice(0, 13), hand[13]);
  ok(canTsumo(g, 2));
  ok(gameStep(g), 'CPU はツモ和了する');
  eq(g.h.result.type, 'tsumo');
  eq(g.h.result.pay, [-700, -500, 1700, -500]);
  eq(g.h.hands[2].length, 14);
});

test('ツモ: 親のツモは500点オール', () => {
  const g = gameNew(25);
  g.chicha = 1;
  const hand = ids('123m456p789s11122z');
  setTurn(g, 1, hand.slice(1), hand[0]);
  ok(gameTsumo(g, 1));
  eq(g.h.result.pay, [-500, 1500, -500, -500]);
});

test('流局: ノーテン罰符は合計3000点', () => {
  eq(notenPayments([true, false, false, false]), [3000, -1000, -1000, -1000]);
  eq(notenPayments([true, true, false, false]), [1500, 1500, -1500, -1500]);
  eq(notenPayments([true, true, true, false]), [1000, 1000, 1000, -3000]);
  eq(notenPayments([false, false, false, false]), [0, 0, 0, 0]);
  eq(notenPayments([true, true, true, true]), [0, 0, 0, 0]);
});

test('流局: 山がなくなると流局し、親が聴牌なら連荘', () => {
  const g = gameNew(26);
  g.chicha = 0;
  // 山を最後の1枚まで進める
  g.h.wall.next = g.h.wall.live.length - 1;
  g.h.hands[0] = sortIds(ids('123m456p789s1122z'));
  g.h.turn = 3;
  g.h.phase = 'draw';
  ok(gameDraw(g));
  const d = g.h.drawn;
  gameDiscard(g, 3, d);
  if (g.h.phase === 'call') gameSkip(g, 0);
  eq(g.h.phase, 'end');
  eq(g.h.result.type, 'draw');
  eq(g.h.result.tenpai[0], true);
  eq(sum(g.h.result.pay), 0);
  gameNextHand(g);
  eq(g.kyoku, 0, '親が聴牌なので連荘');
  eq(g.honba, 1);
  eq(dealerOf(g), 0);
});

test('局の進み方: 子が和了ると親が移り、本場は0に', () => {
  const g = gameNew(27);
  g.chicha = 0;
  g.honba = 3;
  g.h.phase = 'end';
  g.h.result = { type: 'ron', winner: 1, loser: 2, pay: [0, 0, 0, 0] };
  gameNextHand(g);
  eq(g.kyoku, 1);
  eq(g.honba, 0);
  eq(dealerOf(g), 1);
  eq(roundLabel(g), '東2局');
  // 親の和了は連荘
  g.h.phase = 'end';
  g.h.result = { type: 'tsumo', winner: 1, loser: null, pay: [0, 0, 0, 0] };
  gameNextHand(g);
  eq(g.kyoku, 1);
  eq(g.honba, 1);
  // 親がノーテンの流局は親が移り、本場は増える
  g.h.phase = 'end';
  g.h.result = { type: 'draw', tenpai: [true, false, false, false], pay: [0, 0, 0, 0] };
  gameNextHand(g);
  eq(g.kyoku, 2);
  eq(g.honba, 2);
});

test('終局: 東風戦は東4局のあと、半荘戦は南4局のあとで終わる', () => {
  const t = gameNew(28, Object.assign({}, DEFAULT_RULES, { length: 'tonpu' }));
  t.kyoku = 3;
  t.h.phase = 'end';
  t.h.result = { type: 'ron', winner: (dealerOf(t) + 1) % 4, loser: 0, pay: [0, 0, 0, 0] };
  gameNextHand(t);
  ok(t.over);
  const hc = gameNew(28);
  hc.kyoku = 3;
  hc.h.phase = 'end';
  hc.h.result = { type: 'ron', winner: (dealerOf(hc) + 1) % 4, loser: 0, pay: [0, 0, 0, 0] };
  gameNextHand(hc);
  ok(!hc.over);
  eq(roundLabel(hc), '南1局');
});

test('終局: 誰かが0点未満になったら終わる（トビ）', () => {
  const g = gameNew(29);
  g.points = [-100, 50000, 25100, 25000];
  g.h.phase = 'end';
  g.h.result = { type: 'ron', winner: 1, loser: 0, pay: [0, 0, 0, 0] };
  gameNextHand(g);
  ok(g.over);
  eq(gameRanking(g), [1, 2, 3, 0]);
});

test('CPU: 字牌の孤立牌から捨てる・和了の形は崩さない', () => {
  const g = gameNew(30);
  const hand = ids('123m456p789s11z55m');
  setTurn(g, 1, hand.filter(id => kindOf(id) !== 27).concat(ids('7z', hand)), hand.find(id => kindOf(id) === 27));
  // 13枚＋ツモ1枚 = 123m456p789s55m 1z 7z → どちらかの字牌を捨てるはず
  const d = cpuChooseDiscard(g, 1);
  ok(isHonor(kindOf(d)), '字牌を捨てる: ' + tileCode(d));
});
