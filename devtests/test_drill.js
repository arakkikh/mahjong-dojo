// ヒント・ドリル・レッスンのテスト

// --- レッスン ---
test('レッスン: 牌の表記が読めて、クイズの正解番号が選択肢の中にある', () => {
  const ids = new Set();
  for (const l of LESSONS) {
    ok(!ids.has(l.id), 'id が重ならない ' + l.id);
    ids.add(l.id);
    ok(l.pages.length >= 3, l.id + ' のページ');
    for (const p of l.pages) for (const m of p.match(/\{([0-9mpsz]+)\}/g) || []) parseKinds(m.slice(1, -1));
    ok(l.quiz.length >= 1, l.id + ' のクイズ');
    for (const q of l.quiz) {
      ok(q.answer >= 0 && q.answer < q.options.length, l.id + ': ' + q.q);
      if (q.tiles) parseKinds(q.tiles);
    }
  }
});

test('レッスン: 例の手と答えが本当に正しい', () => {
  eq(codes(waits(C('234m678p345s99s46m'), 0)), ['5m']);
  eq(codes(waits(C('111p234p567s88s23m'), 0)), ['1m', '4m']);
  eq(codes(waits(C('123m456p789s55s67p'), 0)), ['5p', '8p']);
  eq(codes(waits(C('123m456p789s23s55p'), 0)), ['1s', '4s']);
  ok(isAgari(C('234m678p345s99s555z')));
  ok(!isAgari(C('123m456p789s1234z5z')));
  ok(isAgari(C('123m456p789s11122z')));
  ok(isChiitoi(C('1133m55p77s22z44z66z')));
  ok(isKokushi(C('19m19p19s12345677z')));
  eq(kindCode(doraFromIndicator(kindOfCode('9s'))), '1s');
  eq(kindCode(doraFromIndicator(kindOfCode('4z'))), '1z');
  eq(kindCode(doraFromIndicator(kindOfCode('7z'))), '5z');
  // 点数の表
  const ko = (han, fu) => handPayment(basePoints(han, fu), false, false).ron;
  const oya = (han, fu) => handPayment(basePoints(han, fu), true, false).ron;
  eq([ko(1, 30), ko(2, 30), ko(3, 30), ko(4, 30)], [1000, 2000, 3900, 7700]);
  eq([oya(1, 30), oya(2, 30), oya(3, 30), oya(4, 30)], [1500, 2900, 5800, 11600]);
  eq([ko(5, 30), ko(6, 30), ko(8, 30), ko(11, 30)], [8000, 12000, 16000, 24000]);
  eq(handPayment(basePoints(1, 30), false, true), { oya: 500, ko: 300 });
});

// --- ドリル ---
test('何切る: 正解はシャンテン数を保ち、受け入れがいちばん多い', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const q = drillNanikiru(makeRng(seed));
    ok(q, 'seed ' + seed);
    eq(q.kinds.length, 14);
    const base = shanten(countsOf(q.kinds), 0);
    for (const k of q.answers) {
      const c = countsOf(q.kinds);
      c[k]--;
      eq(shanten(c, 0), base, '正解を切ってもシャンテン数は同じ');
    }
    ok(drillCheck(q, [q.answers[0]]));
    const wrong = q.choices.find(c => q.answers.indexOf(c.kind) < 0);
    if (wrong) ok(!drillCheck(q, [wrong.kind]));
  }
});

test('待ち当て: 13枚で聴牌、答えの牌で和了の形になる', () => {
  for (let seed = 1; seed <= 30; seed++) {
    for (const hard of [false, true]) {
      const q = drillWait(makeRng(seed), hard);
      ok(q, 'seed ' + seed);
      eq(q.kinds.length, 13);
      const c = countsOf(q.kinds);
      ok(c.every(x => x <= 4));
      eq(shanten(c, 0), 0);
      for (const k of q.answers) { c[k]++; ok(isAgari(c, 0)); c[k]--; }
      if (hard) {
        ok(q.answers.length >= 2);
        eq(new Set(q.kinds.map(k => Math.floor(k / 9))).size, 1, '1色だけ');
      }
      ok(drillCheck(q, q.answers.slice().reverse()), '順番は関係ない');
      ok(!drillCheck(q, q.answers.slice(1)) || q.answers.length === 0);
    }
  }
});

test('役当て: 手は和了の形で、答えは scoreHand の役、選択肢に全部ある', () => {
  const themes = {};
  for (let seed = 1; seed <= 60; seed++) {
    const q = drillYaku(makeRng(seed));
    ok(q, 'seed ' + seed);
    themes[q.theme] = 1;
    eq(q.kinds.length, 14);
    ok(isAgari(countsOf(q.kinds), 0));
    ok(q.answers.length >= 1);
    for (const a of q.answers) ok(q.options.indexOf(a) >= 0, a + ' が選択肢にある');
    eq(new Set(q.options).size, q.options.length);
    ok(drillCheck(q, q.answers));
  }
  ok(Object.keys(themes).length >= 8, 'いろいろな手が出る');
});

test('点数: 正解は1つ、選択肢は4つで重ならない', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const q = drillScore(makeRng(seed));
    ok(q, 'seed ' + seed);
    eq(q.options.length, 4);
    eq(new Set(q.options).size, 4);
    ok(q.options.indexOf(q.answer) >= 0);
    eq(q.answer, paymentText(q.score.base, q.isOya, q.tsumo));
    ok(drillCheck(q, [q.answer]));
  }
});

test('危険牌: 正解は手の中でいちばん安全な牌（現物か筋）', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const q = drillDanger(makeRng(seed));
    ok(q, 'seed ' + seed);
    eq(q.hand.length, 14);
    for (const a of q.answers) {
      ok(q.hand.indexOf(a) >= 0);
      ok(q.rated[0].safe >= 60);
    }
    const ok1 = q.answers.every(a => q.river.indexOf(a) >= 0 || tileSafety(a, q.river, [], countsOf(q.river.concat(q.hand))).safe >= 60);
    ok(ok1);
  }
});

test('安全度: 現物 > 字牌3枚見え > 筋 > 1・9 > 真ん中', () => {
  const v = countsOf([]);
  const river = K('4m');
  ok(tileSafety(kindOfCode('4m'), river, [], v).safe === 100);
  ok(tileSafety(kindOfCode('1m'), river, [], v).safe > tileSafety(kindOfCode('1p'), river, [], v).safe, '筋の1萬 > 筋でない1筒');
  ok(tileSafety(kindOfCode('7m'), river, [], v).safe > tileSafety(kindOfCode('7p'), river, [], v).safe);
  ok(tileSafety(kindOfCode('5m'), river, [], v).safe === 10, '5萬は 2萬も8萬もないので筋ではない');
  const v3 = countsOf(K('111z'));
  ok(tileSafety(27, [], [], v3).safe > tileSafety(kindOfCode('1m'), river, [], v3).safe);
});

// --- ヒント ---
function hintGame(seed) {
  const g = gameNew(seed);
  g.h.firstTurn = [false, false, false, false];
  g.h.interrupted = true;
  g.h.hands = [[], [], [], []];
  g.h.discards = [[], [], [], []];
  g.rules = Object.assign({}, g.rules, { aka: 0 });
  return g;
}

test('ヒント: 孤立した字牌を捨てるようすすめ、理由を言う', () => {
  const g = hintGame(50);
  const hand = IDS('234m56p78p123s55s1z7m');
  g.h.hands[0] = sortIds(hand.slice(0, 13)); g.h.turn = 0; g.h.drawn = hand[13]; g.h.phase = 'discard';
  const ht = hintTurn(g, 0);
  eq(ht.action, 'discard');
  eq(ht.kind, 27, '東を捨てる');
  ok(ht.reasons.some(r => r.indexOf('字牌') >= 0));
  ok(canDiscardId(g, 0, ht.id));
});

test('ヒント: 門前で聴牌できるならリーチをすすめる', () => {
  const g = hintGame(51);
  const hand = IDS('234m567p234s67s55p9m');
  g.h.hands[0] = sortIds(hand.slice(0, 13)); g.h.turn = 0; g.h.drawn = hand[13]; g.h.phase = 'discard';
  const ht = hintTurn(g, 0);
  eq(ht.action, 'riichi');
  eq(ht.kind, kindOfCode('9m'));
  eq(codes(ht.waits), ['5s', '8s']);
});

test('ヒント: 和了れるならツモをすすめる', () => {
  const g = hintGame(52);
  const hand = IDS('234m567p234s67s55p8s');
  g.h.hands[0] = sortIds(hand.slice(0, 13)); g.h.turn = 0; g.h.drawn = hand[13]; g.h.phase = 'discard';
  eq(hintTurn(g, 0).action, 'tsumo');
});

test('ヒント: リーチされて手が遠いときは現物を捨てる（守り）', () => {
  const g = hintGame(53);
  g.h.riichi[2] = true;
  const used = [];
  const river = IDS('5p', used); used.push(...river);
  g.h.discards[2] = river.map(id => ({ id, tsumogiri: false, riichi: true, called: false }));
  const hand = IDS('19m28p37s1357z46m5p', used);
  g.h.hands[0] = sortIds(hand.slice(0, 13)); g.h.turn = 0; g.h.drawn = hand[13]; g.h.phase = 'discard';
  const ht = hintTurn(g, 0);
  eq(ht.mode, 'defense');
  eq(ht.kind, kindOfCode('5p'));
  ok(ht.reasons.some(r => r.indexOf('現物') >= 0));
});

test('ヒント: 役牌はポン、役のない鳴きはスキップをすすめる', () => {
  const g = hintGame(54);
  g.chicha = 1; g.kyoku = 0;
  const hand0 = IDS('55z234m67p12389s4z');
  g.h.hands[0] = sortIds(hand0);
  const haku = IDS('5z', hand0)[0];
  g.h.hands[2] = IDS('2468m2468p2468s3z', hand0.concat([haku])).slice(0, 13);
  g.h.turn = 2; g.h.drawn = haku; g.h.phase = 'discard';
  gameDiscard(g, 2, haku);
  eq(g.h.phase, 'call');
  eq(hintCall(g).action, 'pon');

  const g2 = hintGame(55);
  g2.chicha = 1; g2.kyoku = 0;
  const h0 = IDS('11m99m234p678s19z5s');
  g2.h.hands[0] = sortIds(h0);
  const one = IDS('1m', h0)[0];
  g2.h.hands[2] = IDS('2468m2468p2468s3z', h0.concat([one])).slice(0, 13);
  g2.h.turn = 2; g2.h.drawn = one; g2.h.phase = 'discard';
  gameDiscard(g2, 2, one);
  eq(g2.h.phase, 'call');
  eq(hintCall(g2).action, 'pass');
});

test('ヒント: 対局の途中どこでも出せる（自動対局で確かめる）', () => {
  const g = gameNew(56, Object.assign({}, DEFAULT_RULES, { length: 'tonpu' }));
  let n = 0;
  for (let hand = 0; hand < 3 && !g.over; hand++) {
    while (g.h.phase !== 'end') {
      if (gameStep(g)) continue;
      if (g.h.phase === 'discard') {
        const ht = hintTurn(g, HUMAN);
        ok(ht.title && ht.reasons.length);
        if (ht.action === 'tsumo') gameTsumo(g, HUMAN);
        else ok(gameDiscard(g, HUMAN, ht.id, ht.action === 'riichi'), 'すすめた牌を捨てられる');
      } else if (g.h.phase === 'call') {
        const hc = hintCall(g);
        ok(hc.title);
        if (hc.action === 'chi') gameCall(g, 'chi', hc.opt);
        else gameCall(g, hc.action === 'kan' ? 'kan' : hc.action);
      }
      n++;
    }
    gameNextHand(g);
  }
  ok(n > 10);
});
