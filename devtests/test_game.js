// 4人対局のテスト（段階③：鳴き・リーチ・役・点数）

function sum(a) { return a.reduce((x, y) => x + y, 0); }

// あなた（席0）も CPU と同じ考え方で打たせる
function humanAuto(g) {
  const h = g.h;
  if (h.phase === 'discard') return autoTurn(g, HUMAN);
  if (h.phase === 'call') {
    const ho = h.claims.human;
    const id = h.last.id;
    if (ho.ron) return gameCall(g, 'ron');
    if (ho.pon && cpuWantsCall(g, HUMAN, 'pon', id)) return gameCall(g, 'pon');
    if (ho.chi) { const o = cpuChooseChi(g, HUMAN, id, h.claims.chiOptions); if (o) return gameCall(g, 'chi', o); }
    return gameCall(g, 'pass');
  }
  return false;
}

function playHand(g, onStep) {
  let guard = 0;
  while (g.h.phase !== 'end') {
    if (++guard > 2000) throw new Error('局が終わらない');
    if (!gameStep(g)) ok(humanAuto(g), 'あなたの番で何もできない: ' + g.h.phase);
    if (onStep && g.h.phase !== 'end') onStep(g);
  }
}

// 局の途中の牌：手牌・ツモ牌・鳴き・捨て牌・山・王牌 がちょうど136枚で重ならない
function checkTiles(g) {
  const h = g.h;
  const all = [];
  for (const hd of h.hands) all.push(...hd);
  if (h.drawn != null) all.push(h.drawn);
  for (const ms of h.melds) for (const m of ms) all.push(...m.ids);
  for (const ds of h.discards) for (const d of ds) if (!d.called) all.push(d.id);
  if (h.pendingKakan) all.push(h.pendingKakan.id);
  all.push(...h.wall.live.slice(h.wall.next));
  all.push(...h.wall.dead.slice(h.wall.rinshan));
  eq(all.length, 136, '牌の枚数');
  eq(new Set(all).size, 136, '牌が重なっていない');
  // 手牌の枚数：13 − 3×鳴き（手番の人はツモ牌が別）
  for (let s = 0; s < 4; s++) {
    const n = h.hands[s].length + (h.turn === s && h.drawn != null ? 1 : 0) + h.melds[s].length * 3;
    const turnAfterCall = h.turn === s && h.phase === 'discard' && h.drawn == null;
    eq(n, h.turn === s && (h.drawn != null || turnAfterCall) ? 14 : 13, '席' + s + 'の手牌の枚数');
  }
}

// 王牌の位置 index に kind の牌を入れる（山の別の場所と入れかえる）
function putInDead(w, index, kind) {
  const live = w.live.findIndex(id => kindOf(id) === kind);
  if (live >= 0) { const t = w.live[live]; w.live[live] = w.dead[index]; w.dead[index] = t; return; }
  const d = w.dead.findIndex((id, i) => i !== 4 && i !== 5 && kindOf(id) === kind);
  const t = w.dead[d]; w.dead[d] = w.dead[index]; w.dead[index] = t;
}

// 1巡目の特別な扱い（天和・ダブル立直など）をなくして、局の途中にする。
// ドラ表示牌・裏ドラ表示牌は南（ドラは西）にして、赤ドラもなしにする（点数を決まった値にするため）
function midGame(g, dealerSeat) {
  g.rules = Object.assign({}, g.rules, { aka: 0 });
  putInDead(g.h.wall, 4, 28);
  putInDead(g.h.wall, 5, 28);
  if (dealerSeat != null) { g.chicha = dealerSeat; g.kyoku = 0; }
  g.h.firstTurn = [false, false, false, false];
  g.h.interrupted = true;
  g.h.discards = [[], [], [], []];
  // 山の牌とテストで使う牌が重ならないよう、手牌は空にしておく（必要な席だけ入れる）
  g.h.hands = [[], [], [], []];
}

// 席 seat に手番を渡して、ツモった牌 drawn を持たせる
function setTurn(g, seat, hand, drawn) {
  const h = g.h;
  h.hands[seat] = sortIds(hand);
  h.turn = seat;
  h.drawn = drawn;
  h.phase = 'discard';
}

// 他の人の手（使わない牌で13枚）
function filler(used) {
  const u = new Set(used);
  const out = [];
  for (const k of [0, 2, 4, 6, 8, 9, 11, 13, 15, 17, 18, 20, 22, 24, 26, 29, 30]) {
    const id = [0, 1, 2, 3].map(i => k * 4 + i).find(x => !u.has(x));
    if (id != null && out.length < 13) out.push(id);
  }
  return out;
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
  const rules = Object.assign({}, DEFAULT_RULES, { length: 'tonpu' });
  const a = gameNew(77, rules);
  const b = gameNew(77, rules);
  while (!a.over) { playHand(a); gameNextHand(a); }
  while (!b.over) { playHand(b); gameNextHand(b); }
  eq(a.points, b.points);
  eq(a.history, b.history);
});

test('自動で東風戦を最後まで: 点数＋供託は100000点のまま、牌の数も正しい', () => {
  const kinds = {};
  for (let seed = 1; seed <= 12; seed++) {
    const g = gameNew(seed, Object.assign({}, DEFAULT_RULES, { length: 'tonpu' }));
    let hands = 0;
    while (!g.over) {
      checkTiles(g);
      playHand(g, checkTiles);
      eq(sum(g.points) + g.kyotaku * 1000, 100000, 'seed ' + seed);
      const r = g.h.result;
      kinds[r.type] = (kinds[r.type] || 0) + 1;
      if (r.score) for (const y of r.score.yaku) kinds[y.name] = (kinds[y.name] || 0) + 1;
      for (const ms of g.h.melds) for (const m of ms) kinds['鳴き:' + m.type] = (kinds['鳴き:' + m.type] || 0) + 1;
      ok(gameNextHand(g));
      if (++hands > 60) throw new Error('対局が終わらない');
    }
    eq(sum(g.points), 100000, '終局で供託はトップへ');
    ok(hands >= 4 || g.points.some(p => p < 0), '東風戦は4局以上');
    eq(g.history.length, hands);
  }
  // CPU が鳴き・リーチ・いろいろな役を使っている
  ok(kinds['鳴き:pon'] > 0, 'ポンがある');
  ok(kinds['鳴き:chi'] > 0, 'チーがある');
  ok(kinds['立直'] > 0, 'リーチの和了がある');
  ok(kinds.ron > 0 && kinds.tsumo > 0 && kinds.draw > 0, 'ロン・ツモ・流局がある');
});

test('自動で半荘戦を最後まで', () => {
  const g = gameNew(123);
  while (!g.over) { playHand(g); gameNextHand(g); }
  ok(g.history.length >= 8 || g.points.some(p => p < 0));
  eq(sum(g.points), 100000);
  const r = gameRanking(g);
  for (let i = 1; i < 4; i++) ok(g.points[r[i - 1]] >= g.points[r[i]], '順位は点数順');
});

test('ロン: 子が子から平和・タンヤオでロン = 2000点', () => {
  const g = gameNew(20);
  midGame(g, 0);
  const hand2 = IDS('234m567p234s67s55p');  // 58s 待ち
  g.h.hands[2] = sortIds(hand2);
  const win = IDS('8s', hand2)[0];
  setTurn(g, 1, filler(hand2.concat([win])), win);
  ok(gameDiscard(g, 1, win));
  eq(g.h.phase, 'end', 'CPU はロンする');
  eq(g.h.result.type, 'ron');
  eq(g.h.result.winner, 2);
  eq(g.h.result.loser, 1);
  eq(g.h.result.score.yaku.map(y => y.name).sort(), ['平和', '断幺九'].sort());
  eq(g.h.result.pay, [0, -2000, 2000, 0]);
});

test('ロン: 頭ハネ（捨てた人から手番の近い人だけ）', () => {
  const g = gameNew(21);
  midGame(g, 0);
  g.h.hands[3] = sortIds(IDS('234m567p234s67s55p'));
  g.h.hands[1] = sortIds(IDS('345m678p345s67s22p', g.h.hands[3]));
  const used = g.h.hands[1].concat(g.h.hands[3]);
  const win = IDS('8s', used)[0];
  setTurn(g, 2, filler(used.concat([win])), win);
  ok(gameDiscard(g, 2, win));
  eq(g.h.result.winner, 3);
});

test('ロン: あなたが先ならあなたに聞く。見送ると後の CPU がロンする', () => {
  const g = gameNew(22);
  midGame(g, 1);
  g.h.hands[0] = sortIds(IDS('234m567p234s67s55p'));
  g.h.hands[1] = sortIds(IDS('345m678p345s67s22p', g.h.hands[0]));
  const used = g.h.hands[0].concat(g.h.hands[1]);
  const win = IDS('8s', used)[0];
  setTurn(g, 3, filler(used.concat([win])), win);
  gameDiscard(g, 3, win);
  eq(g.h.phase, 'call');
  ok(waitingHuman(g));
  eq(g.h.claims.human, { ron: true, pon: false, kan: false, chi: false });
  ok(gameCall(g, 'pass'));
  eq(g.h.result.winner, 1);
});

test('役がない和了の形ではロンできない（見逃しでフリテン）', () => {
  const g = gameNew(23);
  midGame(g, 1);
  const hand0 = IDS('123m456p789s11z23m');  // 14m 待ち、役なし（ドラ・場風なし）
  g.h.hands[0] = sortIds(hand0);
  const win = IDS('4m', hand0)[0];
  setTurn(g, 2, filler(hand0.concat([win])), win);
  gameDiscard(g, 2, win);
  eq(g.h.phase, 'draw', 'ロンできないので次の人がツモる');
  eq(g.h.tempFuriten[0], true);
});

test('フリテン: 自分の捨て牌に待ちがあるとロンできない', () => {
  const g = gameNew(24);
  midGame(g, 0);
  const hand2 = IDS('234m567p234s67s55p');
  g.h.hands[2] = sortIds(hand2);
  const old = IDS('5s', hand2)[0];
  g.h.discards[2].push({ id: old, tsumogiri: false, riichi: false, called: false });
  ok(isFuriten(g, 2));
  const win = IDS('8s', hand2.concat([old]))[0];
  setTurn(g, 1, filler(hand2.concat([win, old])), win);
  gameDiscard(g, 1, win);
  eq(g.h.phase, 'draw');
  eq(g.h.turn, 2);
});

test('ツモ: 立直・門前ツモ・平和・断幺九 = 子 1300/2600、親 2600オール', () => {
  const g = gameNew(25);
  midGame(g, 0);
  const hand = IDS('234m567p234s67s55p8s');
  setTurn(g, 2, hand.slice(0, 13), hand[13]);
  g.h.riichi[2] = true;
  g.honba = 1;
  g.kyotaku = 2;
  ok(canTsumo(g, 2));
  ok(gameStep(g), 'CPU はツモ和了する');
  eq(g.h.result.type, 'tsumo');
  // 1本場で1人100点ずつ、供託2本
  eq(g.h.result.pay, [-2700, -1400, 2700 + 1400 + 1400 + 2000, -1400]);
  eq(g.kyotaku, 0);
  const o = gameNew(26);
  midGame(o, 1);
  setTurn(o, 1, hand.slice(0, 13), hand[13]);
  o.h.riichi[1] = true;
  ok(gameTsumo(o, 1));
  eq(o.h.result.pay, [-2600, 7800, -2600, -2600]);
});

test('天和: 親の最初のツモで和了の形なら役満', () => {
  const g = gameNew(27);
  g.chicha = 0;
  g.kyoku = 0;
  const hand = IDS('123m456p789s11122z');
  g.h.hands[0] = sortIds(hand.slice(0, 13));
  g.h.turn = 0;
  g.h.drawn = hand[13];
  g.h.phase = 'discard';
  // 他の人の手と重ならないように
  g.h.hands[1] = g.h.hands[2] = g.h.hands[3] = [];
  const sc = tsumoScore(g, 0);
  ok(sc.yaku.some(y => y.name === '天和'));
  ok(gameTsumo(g, 0));
  eq(g.h.result.pay[0], 48000);
});

test('ポン: CPU の捨てた中をあなたがポンできる。鳴いた後は同じ牌を捨てられない', () => {
  const g = gameNew(30);
  midGame(g, 1);
  const hand0 = IDS('77z234m567p23s88p1z');
  g.h.hands[0] = sortIds(hand0);
  const chun = IDS('7z', hand0)[0];
  setTurn(g, 2, filler(hand0.concat([chun])), chun);
  gameDiscard(g, 2, chun);
  eq(g.h.phase, 'call');
  eq(g.h.claims.human.pon, true);
  eq(g.h.claims.human.chi, false, 'チーは上家からだけ');
  ok(gameCall(g, 'pon'));
  eq(g.h.turn, 0);
  eq(g.h.phase, 'discard');
  eq(g.h.drawn, null);
  eq(g.h.melds[0].length, 1);
  eq(g.h.melds[0][0].type, 'pon');
  eq(g.h.melds[0][0].from, 2);
  eq(g.h.hands[0].length, 11);
  ok(g.h.discards[2][0].called, '鳴かれた牌に印');
  eq(g.h.interrupted, true);
  ok(gameDiscard(g, 0, g.h.hands[0].find(id => kindOf(id) === 27)));
  eq(g.h.phase, 'draw');
  eq(g.h.turn, 1);
});

test('チー: 上家の牌だけ。喰い替え（同じ牌・筋の牌）は捨てられない', () => {
  const g = gameNew(31);
  midGame(g, 0);
  const hand0 = IDS('123m23p567p88s11z45m');
  g.h.hands[0] = sortIds(hand0);
  const t = IDS('3m', hand0)[0];
  setTurn(g, 3, filler(hand0.concat([t])), t);
  gameDiscard(g, 3, t);
  eq(g.h.claims.human.chi, true);
  // 3m を 12m・24m・45m でチーできる
  eq(g.h.claims.chiOptions.length, 3);
  const opt = g.h.claims.chiOptions.find(p => kindsText(p.map(kindOf)) === '45m');
  ok(gameCall(g, 'chi', opt));
  eq(g.h.melds[0][0].type, 'chi');
  eq(kindsText(g.h.melds[0][0].ids.map(kindOf)), '345m');
  // 345m を 3m でチー → 3m と 6m は捨てられない（6m は手にない）。3m も捨てられない
  ok(!canDiscardId(g, 0, g.h.hands[0].find(id => kindOf(id) === 2)), '3m は捨てられない');
  ok(canDiscardId(g, 0, g.h.hands[0].find(id => kindOf(id) === 27)));
});

test('明槓: 嶺上牌をツモり、新しいドラがめくれる', () => {
  const g = gameNew(32);
  midGame(g, 1);
  const hand0 = IDS('666z234m567p23s88p');
  g.h.hands[0] = sortIds(hand0);
  const t = IDS('6z', hand0)[0];
  setTurn(g, 2, filler(hand0.concat([t])), t);
  const left = wallLeft(g.h.wall);
  gameDiscard(g, 2, t);
  eq(g.h.claims.human.kan, true);
  eq(g.h.claims.human.pon, true);
  ok(gameCall(g, 'kan'));
  eq(g.h.melds[0][0].type, 'minkan');
  eq(g.h.melds[0][0].ids.length, 4);
  eq(g.h.wall.doraCount, 2);
  eq(g.h.rinshanDraw, true);
  ok(g.h.drawn != null);
  eq(wallLeft(g.h.wall), left - 1);
  eq(g.h.kans, [0]);
});

test('暗槓: 自分の番に4枚そろったらカンできる', () => {
  const g = gameNew(33);
  midGame(g, 0);
  const hand0 = IDS('5555m234p567s88s11z');
  setTurn(g, 0, hand0.slice(0, 13), hand0[13]);
  eq(kanOptions(g, 0), [{ type: 'ankan', kind: 4 }]);
  ok(gameKan(g, 0, 4));
  eq(g.h.melds[0][0].type, 'ankan');
  ok(isMenzen(g, 0), '暗槓は門前のまま');
  eq(g.h.wall.doraCount, 2);
  eq(g.h.phase, 'discard');
  ok(g.h.rinshanDraw);
});

test('加槓と槍槓: 加槓した牌で待っている人はロンできる', () => {
  const g = gameNew(34);
  midGame(g, 0);
  // 席1 がポンした 5p に 4枚目をつける
  const pon = IDS('555p');
  g.h.melds[1] = [{ type: 'pon', ids: pon, called: pon[0], from: 0 }];
  const hand1 = IDS('123m456m789s11z', pon);
  const used = pon.concat(hand1);
  const hand2 = IDS('234m678s234s46p88s', used);  // 5p 嵌張待ち
  used.push(...hand2);
  g.h.hands[2] = sortIds(hand2);
  const fourth = IDS('5p', used)[0];
  setTurn(g, 1, hand1.concat(IDS('9m', used.concat([fourth]))), fourth);
  ok(kanOptions(g, 1).some(o => o.type === 'kakan'));
  ok(gameKan(g, 1, kindOf(fourth)));
  eq(g.h.phase, 'end', 'CPU の席2 が槍槓でロン');
  eq(g.h.result.winner, 2);
  ok(g.h.result.score.yaku.some(y => y.name === '槍槓'));
  eq(g.h.melds[1][0].type, 'pon', 'カンは成立しない');
});

test('リーチ: 1000点を出して供託に。その後はツモ切り、和了ったら供託をもらう', () => {
  const g = gameNew(35);
  midGame(g, 1);
  const hand0 = IDS('234m567p234s67s55p9m');
  setTurn(g, 0, hand0.slice(0, 13), hand0[13]);
  const cand = riichiCandidates(g, 0);
  eq(cand, [hand0[13]], '9m を捨ててリーチ');
  ok(!gameDiscard(g, 0, hand0[0], true), '聴牌にならない牌ではリーチできない');
  ok(gameDiscard(g, 0, hand0[13], true));
  eq(g.h.riichi[0], true);
  eq(g.points[0], 24000);
  eq(g.kyotaku, 1);
  eq(g.h.ippatsu[0], true);
  ok(g.h.discards[0][0].riichi);
  // 次の自分のツモ（和了でない牌）は自動でツモ切り
  g.h.turn = 3; g.h.phase = 'draw';
  ok(gameStep(g));  // 席3 ツモ
  const sol = g.h.drawn;
  gameDiscard(g, 3, sol);
  if (g.h.phase === 'end') return;  // まれに和了牌
  eq(g.h.ippatsu[0], true, '自分の次の打牌まで一発がある');
});

test('リーチ: 宣言牌でロンされたらリーチは成立しない（1000点は出さない）', () => {
  const g = gameNew(36);
  midGame(g, 1);
  const used = [];
  const hand0 = IDS('234m567p234s67s55p', used); used.push(...hand0);
  const hand1 = IDS('234m567p234s78s99m', used); used.push(...hand1);  // 69s 待ち
  g.h.hands[1] = sortIds(hand1);
  const nine = IDS('9s', used)[0];
  setTurn(g, 0, hand0, nine);
  ok(gameDiscard(g, 0, nine, true));
  eq(g.h.result.type, 'ron');
  eq(g.h.result.winner, 1);
  eq(g.kyotaku, 0);
  eq(g.h.result.pay[0] + g.h.result.pay[1], 0);
});

test('リーチ後の見逃しはその局ずっとフリテン', () => {
  const g = gameNew(37);
  midGame(g, 1);
  const hand0 = IDS('234m567p234s67s55p');
  g.h.hands[0] = sortIds(hand0);
  g.h.riichi[0] = true;
  const win = IDS('8s', hand0)[0];
  setTurn(g, 3, filler(hand0.concat([win])), win);
  gameDiscard(g, 3, win);
  ok(gameCall(g, 'pass'));
  eq(g.h.riichiFuriten[0], true);
  ok(isFuriten(g, 0));
});

test('流局: ノーテン罰符は合計3000点', () => {
  eq(notenPayments([true, false, false, false]), [3000, -1000, -1000, -1000]);
  eq(notenPayments([true, true, false, false]), [1500, 1500, -1500, -1500]);
  eq(notenPayments([true, true, true, false]), [1000, 1000, 1000, -3000]);
  eq(notenPayments([false, false, false, false]), [0, 0, 0, 0]);
});

test('流し満貫: 捨て牌が全部1・9・字牌で鳴かれていなければ満貫', () => {
  const g = gameNew(38);
  midGame(g, 0);
  for (let s = 0; s < 4; s++) g.h.hands[s] = IDS('2468m2468p2468s3z').slice(0, 13).map((id, i) => id);  // 形だけ
  // 手牌が重なるのは流局の計算には関係ない。捨て牌だけ作る
  g.h.discards[1] = IDS('19m19p19s1234567z').map(id => ({ id, tsumogiri: true, riichi: false, called: false }));
  g.h.discards[0] = IDS('5m').map(id => ({ id, tsumogiri: true, riichi: false, called: false }));
  g.h.wall.next = g.h.wall.live.length;
  g.h.turn = 3;
  g.h.phase = 'draw';
  gameDraw(g);
  eq(g.h.result.type, 'draw');
  eq(g.h.result.nagashi, [1]);
  eq(g.h.result.pay, [-4000, 8000, -2000, -2000]);
});

test('途中流局: 四風連打・九種九牌・四家立直', () => {
  const g = gameNew(39);
  g.chicha = 0;
  g.kyoku = 0;
  g.h.hands = [[], [], [], []];
  const ton = IDS('1111z');
  for (let s = 0; s < 4; s++) {
    setTurn(g, s, filler(ton), ton[s]);
    ok(gameDiscard(g, s, ton[s]));
    if (s < 3) eq(g.h.phase, 'draw');
  }
  eq(g.h.result.type, 'abort');
  eq(g.h.result.reason, 'suufon');
  gameNextHand(g);
  eq(g.kyoku, 0, '途中流局は親がそのまま');
  eq(g.honba, 1);

  const k = gameNew(40);
  k.chicha = 0; k.kyoku = 0;
  k.h.hands = [[], [], [], []];
  const kh = IDS('19m19p19s1234z5678m');
  setTurn(k, 0, kh.slice(0, 13), kh[13]);
  ok(canKyuushu(k, 0));
  ok(gameKyuushu(k, 0));
  eq(k.h.result.reason, 'kyuushu');

  const r = gameNew(41);
  midGame(r, 0);
  r.h.riichi = [true, true, true, false];
  const used = [];
  const h3 = IDS('234m567p234s67s55p9m', used);
  setTurn(r, 3, h3.slice(0, 13), h3[13]);
  r.h.hands[0] = r.h.hands[1] = r.h.hands[2] = [];
  ok(gameDiscard(r, 3, h3[13], true));
  eq(r.h.result.type, 'abort');
  eq(r.h.result.reason, 'suucha');
  eq(r.kyotaku, 1);
});

test('局の進み方: 子が和了ると親が移り、本場は0に', () => {
  const g = gameNew(42);
  g.chicha = 0;
  g.honba = 3;
  g.h.phase = 'end';
  g.h.result = { type: 'ron', winner: 1, loser: 2, pay: [0, 0, 0, 0] };
  gameNextHand(g);
  eq(g.kyoku, 1);
  eq(g.honba, 0);
  eq(dealerOf(g), 1);
  eq(roundLabel(g), '東2局');
  g.h.phase = 'end';
  g.h.result = { type: 'tsumo', winner: 1, loser: null, pay: [0, 0, 0, 0] };
  gameNextHand(g);
  eq(g.kyoku, 1);
  eq(g.honba, 1);
  g.h.phase = 'end';
  g.h.result = { type: 'draw', tenpai: [true, false, false, false], pay: [0, 0, 0, 0] };
  gameNextHand(g);
  eq(g.kyoku, 2);
  eq(g.honba, 2);
});

test('終局: 東風戦は東4局のあと、半荘戦は南4局のあと。トビでも終わる', () => {
  const t = gameNew(43, Object.assign({}, DEFAULT_RULES, { length: 'tonpu' }));
  t.kyoku = 3;
  t.h.phase = 'end';
  t.h.result = { type: 'ron', winner: (dealerOf(t) + 1) % 4, loser: 0, pay: [0, 0, 0, 0] };
  gameNextHand(t);
  ok(t.over);
  const hc = gameNew(43);
  hc.kyoku = 3;
  hc.h.phase = 'end';
  hc.h.result = { type: 'ron', winner: (dealerOf(hc) + 1) % 4, loser: 0, pay: [0, 0, 0, 0] };
  gameNextHand(hc);
  ok(!hc.over);
  eq(roundLabel(hc), '南1局');
  const tb = gameNew(44);
  tb.points = [-100, 50000, 24100, 25000];
  tb.kyotaku = 1;
  tb.h.phase = 'end';
  tb.h.result = { type: 'ron', winner: 1, loser: 0, pay: [0, 0, 0, 0] };
  gameNextHand(tb);
  ok(tb.over);
  eq(gameRanking(tb), [1, 3, 2, 0]);
  eq(tb.points[1], 51000, '残った供託はトップへ');
});

test('CPU: リーチしている人がいて手が遠いときは安全な牌（現物）を捨てる', () => {
  const g = gameNew(45);
  midGame(g, 0);
  g.h.riichi[2] = true;
  const used = [];
  const river = IDS('5p', used); used.push(...river);
  g.h.discards[2] = river.map(id => ({ id, tsumogiri: false, riichi: true, called: false }));
  const hand = IDS('19m28p37s1357z46m5p', used);
  setTurn(g, 1, hand.slice(0, 13), hand[13]);
  eq(kindOf(cpuChooseDiscard(g, 1)), kindOf(river[0]), '現物の5p');
});

test('CPU: 役牌はポンする。役のない鳴きはしない', () => {
  const g = gameNew(46);
  midGame(g, 0);
  const used = [];
  const hand = IDS('55z234m67p12389s4z', used); used.push(...hand);
  g.h.hands[1] = sortIds(hand);
  ok(cpuWantsCall(g, 1, 'pon', IDS('5z', used)[0]), '白はポン');
  const h2 = IDS('11m99m234p678s19z', used); used.push(...h2);
  g.h.hands[3] = sortIds(h2);
  ok(!cpuWantsCall(g, 3, 'pon', IDS('1m', used)[0]), '役のない 1m はポンしない');
});
