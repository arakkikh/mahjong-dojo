// 4人対局の進行（画面に依存しない）。
// 席（seat）は 0〜3。0 があなた、1 が下家（右）、2 が対面、3 が上家（左）。手番は 0→1→2→3 と回る。
// 起家（最初の親）はシードで決める。局が進むと親は次の席へ移る。
//
// 段階③：チー・ポン・カン（暗槓・明槓・加槓）、リーチ、役と点数計算、途中流局、流し満貫。
// - 同時にロンできる人が2人以上いたら、捨てた人から見て手番の近い1人だけが和了る（頭ハネ）。
// - フリテン：自分の捨て牌に待ちがある／ロンを見送った（次に自分が捨てるまで。リーチ後はその局ずっと）。
// - カンのドラはすぐにめくる。
// - 供託（リーチ棒）は次に和了った人がもらう。終局で残っていればトップがもらう。
const WIND_NAME = ['東', '南', '西', '北'];
const SEAT_NAME = ['あなた', '下家', '対面', '上家'];
const HUMAN = 0;
const GAME_VERSION = 2;

const HONBA_RON = 300;
const HONBA_TSUMO_EACH = 100;
const NOTEN_TOTAL = 3000;
const RIICHI_COST = 1000;

// 局ごとの山のシード（対局のシードと局の通し番号から作る）
function handSeed(matchSeed, index) {
  return (Math.imul(matchSeed ^ 0x5bd1e995, 0x9e3779b1) + Math.imul(index + 1, 0x85ebca6b)) >>> 0 || 1;
}

function gameNew(seed, rules) {
  rules = rules || DEFAULT_RULES;
  const rng = makeRng(seed);
  const g = {
    version: GAME_VERSION,
    seed,
    rules,
    chicha: Math.floor(rng() * 4),   // 起家の席
    points: [0, 1, 2, 3].map(() => rules.startPoints),
    round: 0,       // 0 = 東場、1 = 南場
    kyoku: 0,       // 0〜3（東1局〜東4局）
    honba: 0,
    kyotaku: 0,     // 場に出ているリーチ棒の本数
    handIndex: 0,   // 何局目か（通し番号。山のシードに使う）
    over: false,
    history: [],    // 局の結果の記録
    h: null,        // いまの局
  };
  handStart(g);
  return g;
}

function dealerOf(g) { return (g.chicha + g.kyoku) % 4; }
// 席 seat の自風（0 = 東 … 3 = 北）
function seatWind(g, seat) { return (seat - dealerOf(g) + 4) % 4; }
function roundLabel(g) { return `${WIND_NAME[g.round]}${g.kyoku + 1}局`; }
function roundsInMatch(rules) { return rules.length === 'tonpu' ? 1 : 2; }

function handStart(g) {
  const seed = handSeed(g.seed, g.handIndex);
  const wall = makeWall(seed);
  const dealer = dealerOf(g);
  const hands = [[], [], [], []];
  for (let i = 0; i < 4; i++) {
    const seat = (dealer + i) % 4;
    for (let j = 0; j < 13; j++) hands[seat].push(wallDraw(wall));
    hands[seat] = sortIds(hands[seat]);
  }
  const four = v => [v, v, v, v];
  g.h = {
    seed,
    wall,
    hands,                 // 手の中の牌（ツモった牌は drawn に別に持つ）
    melds: [[], [], [], []],  // 鳴いた面子 { type: 'chi'|'pon'|'minkan'|'ankan'|'kakan', ids, called, from }
    drawn: null,           // 手番の人がツモった牌
    rinshanDraw: false,    // drawn が嶺上牌か
    discards: [[], [], [], []],  // { id, tsumogiri, riichi, called }
    turn: dealer,
    phase: 'draw',         // 'draw' ツモる / 'discard' 打牌などを選ぶ / 'call' 鳴き・ロンを待つ / 'end' 局の終わり
    last: null,            // 直前の打牌（または加槓の牌） { seat, id, kakan }
    claims: null,          // 直前の打牌に対してできること
    riichi: four(false),
    doubleRiichi: four(false),
    ippatsu: four(false),
    riichiPending: null,   // リーチを宣言して捨てた人（ロンされなければ成立）
    tempFuriten: four(false),
    riichiFuriten: four(false),
    firstTurn: four(true), // まだ1回も捨てていない
    interrupted: false,    // 誰かが鳴いた（天和・地和・ダブル立直・九種九牌・四風連打がなくなる）
    forbidden: [],         // 鳴いた直後に捨てられない牌の種類（喰い替え）
    kans: [],              // カンした人（順に）
    calledOut: four(false),// 自分の捨て牌を鳴かれた（流し満貫の判定）
    turns: 0,
    result: null,
  };
}

// --- 手牌まわり ---
function handTiles(g, seat) {
  const h = g.h;
  return h.turn === seat && h.drawn != null ? h.hands[seat].concat([h.drawn]) : h.hands[seat].slice();
}
function handCounts(g, seat) { return countsOfIds(handTiles(g, seat)); }
function meldCount(g, seat) { return g.h.melds[seat].length; }
function isMenzen(g, seat) { return g.h.melds[seat].every(m => m.type === 'ankan'); }

// 見えている牌（全員の捨て牌・鳴いた面子・ドラ表示牌）。seat を渡すとその人の手牌は含めない（そもそも含めない）。
function gameVisible(g) {
  const v = new Array(KIND_COUNT).fill(0);
  const h = g.h;
  for (const ds of h.discards) for (const d of ds) if (!d.called) v[kindOf(d.id)]++;
  for (const ms of h.melds) for (const m of ms) for (const id of m.ids) v[kindOf(id)]++;
  for (const id of doraIndicators(h.wall)) v[kindOf(id)]++;
  return v;
}

// 手の中の牌（3n+1枚）の待ち
function seatWaits(g, seat) {
  const c = countsOfIds(g.h.hands[seat]);
  const m = meldCount(g, seat);
  return shanten(c, m) === 0 ? waits(c, m) : [];
}

function isFuriten(g, seat) {
  const h = g.h;
  if (h.tempFuriten[seat] || h.riichiFuriten[seat]) return true;
  const w = seatWaits(g, seat);
  if (!w.length) return false;
  return h.discards[seat].some(d => w.indexOf(kindOf(d.id)) >= 0);
}

// 和了の点数を計算する材料
function winContext(g, seat, winId, tsumo, extra) {
  const h = g.h;
  const concealed = tsumo ? handTiles(g, seat) : h.hands[seat].concat([winId]);
  const riichi = h.riichi[seat];
  const noCall = !h.interrupted && h.firstTurn[seat];
  return Object.assign({
    concealed,
    melds: h.melds[seat],
    winId,
    tsumo,
    seatWind: seatWind(g, seat),
    roundWind: g.round,
    riichi,
    doubleRiichi: h.doubleRiichi[seat],
    ippatsu: riichi && h.ippatsu[seat],
    rinshan: tsumo && h.rinshanDraw,
    chankan: false,
    haitei: tsumo && !h.rinshanDraw && wallLeft(h.wall) === 0,
    houtei: !tsumo && wallLeft(h.wall) === 0,
    tenhou: tsumo && noCall && seat === dealerOf(g),
    chiihou: tsumo && noCall && seat !== dealerOf(g),
    doraInd: doraIndicators(h.wall),
    uraInd: uraIndicators(h.wall),
    rules: g.rules,
  }, extra || {});
}

function tsumoScore(g, seat) {
  const h = g.h;
  if (h.phase !== 'discard' || h.turn !== seat || h.drawn == null) return null;
  if (!isAgari(handCounts(g, seat), meldCount(g, seat))) return null;
  return scoreHand(winContext(g, seat, h.drawn, true));
}
function canTsumo(g, seat) { return !!tsumoScore(g, seat); }

// ロンの点数（できなければ null）。和了の形でも役がない・フリテンなら null。
function ronScore(g, seat, id, chankan) {
  const h = g.h;
  if (!h.last || h.last.seat === seat) return null;
  const c = countsOfIds(h.hands[seat]);
  c[kindOf(id)]++;
  if (!isAgari(c, meldCount(g, seat))) return null;
  if (isFuriten(g, seat)) return null;
  return scoreHand(winContext(g, seat, id, false, { chankan: !!chankan, houtei: !chankan && wallLeft(h.wall) === 0 }));
}
function canRon(g, seat, id) { return !!ronScore(g, seat, id, g.h.last && g.h.last.kakan); }

// --- 自分の番にできること ---

// リーチできるか、できるならどの牌を捨ててリーチできるか（牌の id の一覧）
function riichiCandidates(g, seat) {
  const h = g.h;
  if (h.phase !== 'discard' || h.turn !== seat || h.drawn == null) return [];
  if (h.riichi[seat] || !isMenzen(g, seat)) return [];
  if (g.points[seat] < RIICHI_COST || wallLeft(h.wall) < 4) return [];
  const tiles = handTiles(g, seat);
  const m = meldCount(g, seat);
  const okKind = {};
  return tiles.filter(id => {
    const k = kindOf(id);
    if (okKind[k] == null) {
      const c = countsOfIds(tiles);
      c[k]--;
      okKind[k] = shanten(c, m) === 0 && waits(c, m).length > 0;
    }
    return okKind[k];
  });
}

// 暗槓・加槓できる牌の種類。[{ type: 'ankan'|'kakan', kind }]
function kanOptions(g, seat) {
  const h = g.h;
  if (h.phase !== 'discard' || h.turn !== seat || h.drawn == null) return [];
  if (h.kans.length >= 4 || wallLeft(h.wall) <= 0) return [];
  const tiles = handTiles(g, seat);
  const c = countsOfIds(tiles);
  const out = [];
  for (let k = 0; k < KIND_COUNT; k++) {
    if (c[k] !== 4) continue;
    if (h.riichi[seat] && !riichiAnkanOk(g, seat, k)) continue;
    out.push({ type: 'ankan', kind: k });
  }
  if (!h.riichi[seat]) {
    for (const m of h.melds[seat]) {
      const k = kindOf(m.ids[0]);
      if (m.type === 'pon' && c[k] >= 1) out.push({ type: 'kakan', kind: k });
    }
  }
  return out;
}

// リーチ後の暗槓は、ツモった牌でのカンで、待ちが変わらないときだけ
function riichiAnkanOk(g, seat, kind) {
  const h = g.h;
  if (kindOf(h.drawn) !== kind) return false;
  const before = seatWaits(g, seat);
  const c = countsOfIds(h.hands[seat]);
  c[kind] -= 3;
  const m = meldCount(g, seat) + 1;
  if (shanten(c, m) !== 0) return false;
  const after = waits(c, m);
  // 手の中で kind を順子に使う見方があると、カンで形が変わる
  if (decompose(countsOfIds(h.hands[seat].concat([h.drawn]))).some(p => p.mentsu.some(x => x.type === 'shuntsu' && kind >= x.kind && kind <= x.kind + 2))) return false;
  return JSON.stringify(before) === JSON.stringify(after);
}

// 九種九牌で流局できるか
function canKyuushu(g, seat) {
  const h = g.h;
  if (!g.rules.abortiveDraws) return false;
  if (h.phase !== 'discard' || h.turn !== seat || h.drawn == null) return false;
  if (!h.firstTurn[seat] || h.interrupted) return false;
  const c = handCounts(g, seat);
  return YAOCHU_KINDS.filter(k => c[k] > 0).length >= 9;
}

// 捨てられる牌か（リーチ後はツモ切りだけ、鳴いた直後の喰い替えは禁止）
function canDiscardId(g, seat, id) {
  const h = g.h;
  if (h.phase !== 'discard' || h.turn !== seat) return false;
  const tiles = handTiles(g, seat);
  if (tiles.indexOf(id) < 0) return false;
  if (h.riichi[seat] && h.drawn != null) return id === h.drawn;
  if (h.forbidden.length && h.forbidden.indexOf(kindOf(id)) >= 0) {
    return tiles.every(t => h.forbidden.indexOf(kindOf(t)) >= 0);
  }
  return true;
}

// --- 進行 ---

// ツモる。山がなければ流局。
function gameDraw(g) {
  const h = g.h;
  if (h.phase !== 'draw') return false;
  const id = wallDraw(h.wall);
  if (id == null) { endExhaustive(g); return true; }
  h.drawn = id;
  h.rinshanDraw = false;
  h.forbidden = [];
  h.turns++;
  h.phase = 'discard';
  return true;
}

// 打牌。riichi = true でリーチ宣言。
function gameDiscard(g, seat, id, riichi) {
  const h = g.h;
  if (!canDiscardId(g, seat, id)) return false;
  if (riichi && riichiCandidates(g, seat).indexOf(id) < 0) return false;
  const tiles = handTiles(g, seat);
  const tsumogiri = id === h.drawn;
  h.hands[seat] = sortIds(tiles.filter(t => t !== id));
  h.discards[seat].push({ id, tsumogiri, riichi: !!riichi, called: false });
  h.drawn = null;
  h.rinshanDraw = false;
  h.forbidden = [];
  if (!h.riichi[seat]) h.tempFuriten[seat] = false;
  if (h.riichi[seat]) h.ippatsu[seat] = false;  // リーチの次の自分の打牌で一発は消える
  if (riichi) {
    h.riichiPending = seat;
    h.doubleRiichi[seat] = h.firstTurn[seat] && !h.interrupted;
  }
  h.firstTurn[seat] = false;
  h.last = { seat, id, kakan: false };
  openClaims(g);
  return true;
}

// 打牌（または加槓）に対して、誰が何をできるかを調べる
function openClaims(g) {
  const h = g.h;
  const { seat, id, kakan } = h.last;
  const k = kindOf(id);
  const canCall = !kakan && wallLeft(h.wall) > 0;
  const cl = { ron: [], ronShape: [], pon: null, kan: null, chi: null, chiOptions: [], decided: {}, human: null };
  for (let i = 1; i < 4; i++) {
    const s = (seat + i) % 4;
    const c = countsOfIds(h.hands[s]);
    c[k]++;
    if (isAgari(c, meldCount(g, s))) {
      cl.ronShape.push(s);
      if (ronScore(g, s, id, kakan)) cl.ron.push(s);
    }
    if (!canCall || h.riichi[s]) continue;
    const have = h.hands[s].filter(t => kindOf(t) === k).length;
    if (have >= 2) cl.pon = s;
    if (have >= 3 && h.kans.length < 4) cl.kan = s;
    if (i === 1 && k < 27) {
      const opts = chiOptions(g, s, id);
      if (opts.length) { cl.chi = s; cl.chiOptions = opts; }
    }
  }
  h.claims = cl;
  // CPU の判断を先に決めておく
  for (const s of cl.ron) if (s !== HUMAN) cl.decided[s] = 'ron';
  if (cl.pon != null && cl.pon !== HUMAN) {
    if (cl.kan === cl.pon && cpuWantsCall(g, cl.pon, 'kan', id)) cl.decided[cl.pon] = 'kan';
    else if (cpuWantsCall(g, cl.pon, 'pon', id)) cl.decided[cl.pon] = 'pon';
  }
  if (cl.chi != null && cl.chi !== HUMAN && cl.decided[cl.chi] == null) {
    const opt = cpuChooseChi(g, cl.chi, id, cl.chiOptions);
    if (opt) { cl.decided[cl.chi] = 'chi'; cl.cpuChi = opt; }
  }
  cl.human = humanCallOptions(g);
  h.phase = 'call';
  if (!cl.human) resolveClaims(g, null);
}

// チーに使える手牌の組（id 2枚）の一覧
function chiOptions(g, seat, id) {
  const h = g.h;
  const k = kindOf(id);
  if (k >= 27) return [];
  const n = k % 9;
  const byKind = kind => {
    const list = h.hands[seat].filter(t => kindOf(t) === kind);
    // 赤ドラでない方を先に使う
    list.sort((a, b) => isRedId(a, g.rules) - isRedId(b, g.rules));
    return list;
  };
  const out = [];
  for (const [a, b] of [[-2, -1], [-1, 1], [1, 2]]) {
    if (n + a < 0 || n + b > 8) continue;
    const la = byKind(k + a), lb = byKind(k + b);
    if (!la.length || !lb.length) continue;
    // 赤ドラの有無で選べるときは両方出す
    const pairs = [];
    for (const x of la) for (const y of lb) {
      if (!pairs.some(p => isRedId(p[0], g.rules) === isRedId(x, g.rules) && isRedId(p[1], g.rules) === isRedId(y, g.rules))) pairs.push([x, y]);
    }
    for (const p of pairs) {
      // 鳴いた後に捨てられる牌が残っているか
      const rest = h.hands[seat].filter(t => t !== p[0] && t !== p[1]);
      const forb = kuikaeKinds('chi', k, p.map(kindOf));
      if (rest.some(t => forb.indexOf(kindOf(t)) < 0)) out.push(p);
    }
  }
  return out;
}

// 喰い替えで捨てられない種類
function kuikaeKinds(type, calledKind, usedKinds) {
  const out = [calledKind];
  if (type === 'chi') {
    const lo = Math.min(...usedKinds), hi = Math.max(...usedKinds);
    const suitBase = Math.floor(calledKind / 9) * 9;
    if (calledKind < lo && hi + 1 < suitBase + 9) out.push(hi + 1);
    if (calledKind > hi && lo - 1 >= suitBase) out.push(lo - 1);
  }
  return out;
}

// あなたが選べること（意味のあるものだけ）。なければ null。
function humanCallOptions(g) {
  const h = g.h;
  const cl = h.claims;
  const cpuRonBefore = s => cl.ron.some(x => x !== HUMAN && orderFrom(h.last.seat, x) < orderFrom(h.last.seat, s));
  const anyCpuRon = cl.ron.some(x => x !== HUMAN);
  const out = { ron: false, pon: false, kan: false, chi: false };
  if (cl.ron.indexOf(HUMAN) >= 0 && !cpuRonBefore(HUMAN)) out.ron = true;
  if (!anyCpuRon) {
    if (cl.pon === HUMAN) out.pon = true;
    if (cl.kan === HUMAN) out.kan = true;
    const cpuPon = cl.pon != null && cl.pon !== HUMAN && cl.decided[cl.pon];
    if (cl.chi === HUMAN && !cpuPon) out.chi = true;
  }
  return out.ron || out.pon || out.kan || out.chi ? out : null;
}

function orderFrom(from, seat) { return (seat - from + 4) % 4; }

// あなたの選択（'ron' 'pon' 'kan' 'chi' 'pass'）。chi のときは opt に手牌2枚。
function gameCall(g, choice, opt) {
  const h = g.h;
  if (h.phase !== 'call' || !h.claims || !h.claims.human) return false;
  const ho = h.claims.human;
  if (choice !== 'pass' && !ho[choice]) return false;
  if (choice === 'chi') {
    const o = opt || h.claims.chiOptions[0];
    if (!h.claims.chiOptions.some(p => p[0] === o[0] && p[1] === o[1])) return false;
    h.claims.humanChi = o;
  }
  resolveClaims(g, choice);
  return true;
}

// 互換のため：ロン・見送り
function gameRon(g, seat) {
  const h = g.h;
  if (h.phase !== 'call') return false;
  if (seat === HUMAN) return gameCall(g, 'ron');
  return false;
}
function gameSkip(g, seat) {
  if (seat !== HUMAN) return false;
  return gameCall(g, 'pass');
}

function resolveClaims(g, humanChoice) {
  const h = g.h;
  const cl = h.claims;
  const { seat: from, id, kakan } = h.last;
  const choiceOf = s => s === HUMAN ? humanChoice : cl.decided[s];
  // 1. ロン（頭ハネ）
  for (const s of cl.ron) {
    if (choiceOf(s) === 'ron') { endWin(g, s, from, id, kakan); return; }
  }
  // 見逃した人はフリテン
  for (const s of cl.ronShape) {
    if (h.riichi[s]) h.riichiFuriten[s] = true;
    else h.tempFuriten[s] = true;
  }
  h.claims = null;
  if (kakan) { finishKakan(g); return; }
  // リーチの成立
  if (h.riichiPending != null) {
    const s = h.riichiPending;
    h.riichiPending = null;
    h.riichi[s] = true;
    h.ippatsu[s] = true;
    g.points[s] -= RIICHI_COST;
    g.kyotaku++;
    if (g.rules.abortiveDraws && h.riichi.every(Boolean)) { endAbortive(g, 'suucha'); return; }
  }
  // 2. ポン・カン
  if (cl.pon != null) {
    const c = choiceOf(cl.pon);
    if (c === 'kan' && cl.kan === cl.pon) { doCall(g, cl.pon, 'minkan', null); return; }
    if (c === 'pon') { doCall(g, cl.pon, 'pon', null); return; }
  }
  // 3. チー
  if (cl.chi != null && choiceOf(cl.chi) === 'chi') {
    doCall(g, cl.chi, 'chi', cl.chi === HUMAN ? cl.humanChi : cl.cpuChi);
    return;
  }
  afterDiscard(g);
}

// 打牌の後、誰も鳴かなかったとき
function afterDiscard(g) {
  const h = g.h;
  h.claims = null;
  // 四風連打：最初の4打が全部同じ風牌
  if (g.rules.abortiveDraws && !h.interrupted && h.discards.every(d => d.length === 1)) {
    const k = kindOf(h.discards[0][0].id);
    if (isWind(k) && h.discards.every(d => kindOf(d[0].id) === k)) { endAbortive(g, 'suufon'); return; }
  }
  // 四槓散了：4回のカンを2人以上でした
  if (g.rules.abortiveDraws && h.kans.length === 4 && new Set(h.kans).size > 1) { endAbortive(g, 'suukan'); return; }
  if (wallLeft(h.wall) <= 0) { endExhaustive(g); return; }
  h.turn = (h.turn + 1) % 4;
  h.phase = 'draw';
}

function takeFromHand(h, seat, kind, n, prefer) {
  const ids = [];
  const pool = h.hands[seat].filter(t => kindOf(t) === kind);
  // 赤ドラでない方から使う（prefer があればそれを使う）
  pool.sort((a, b) => (isRedId(a) - isRedId(b)));
  for (const id of prefer || pool.slice(0, n)) ids.push(id);
  h.hands[seat] = h.hands[seat].filter(t => ids.indexOf(t) < 0);
  return ids;
}

function breakIppatsuAll(h) {
  for (let s = 0; s < 4; s++) h.ippatsu[s] = false;
  h.interrupted = true;
}

// チー・ポン・明槓
function doCall(g, seat, type, chiIds) {
  const h = g.h;
  const { seat: from, id } = h.last;
  const k = kindOf(id);
  let used;
  if (type === 'chi') used = takeFromHand(h, seat, k, 2, chiIds);
  else used = takeFromHand(h, seat, k, type === 'minkan' ? 3 : 2);
  const disc = h.discards[from][h.discards[from].length - 1];
  disc.called = true;
  h.calledOut[from] = true;
  h.melds[seat].push({ type, ids: sortIds(used.concat([id])), called: id, from });
  breakIppatsuAll(h);
  h.turn = seat;
  h.drawn = null;
  h.last = null;
  h.phase = 'discard';
  h.forbidden = type === 'minkan' ? [] : kuikaeKinds(type, k, used.map(kindOf));
  if (type === 'minkan') {
    h.kans.push(seat);
    wallRevealDora(h.wall);
    drawRinshan(g, seat);
  }
}

function drawRinshan(g, seat) {
  const h = g.h;
  const id = wallDrawRinshan(h.wall);
  if (id == null) { endExhaustive(g); return; }
  h.turn = seat;
  h.drawn = id;
  h.rinshanDraw = true;
  h.forbidden = [];
  h.phase = 'discard';
}

// 暗槓・加槓
function gameKan(g, seat, kind) {
  const h = g.h;
  const opt = kanOptions(g, seat).find(o => o.kind === kind);
  if (!opt) return false;
  // ツモ牌も手に入れてから考える
  h.hands[seat] = sortIds(h.hands[seat].concat([h.drawn]));
  h.drawn = null;
  if (opt.type === 'ankan') {
    const used = takeFromHand(h, seat, kind, 4);
    h.melds[seat].push({ type: 'ankan', ids: sortIds(used), called: null, from: null });
    h.kans.push(seat);
    breakIppatsuAll(h);
    wallRevealDora(h.wall);
    drawRinshan(g, seat);
    return true;
  }
  // 加槓：槍槓（その牌でロン）ができる人がいるか先に見る
  const add = takeFromHand(h, seat, kind, 1)[0];
  h.pendingKakan = { seat, id: add };
  h.last = { seat, id: add, kakan: true };
  h.turn = seat;
  openClaims(g);
  return true;
}

function finishKakan(g) {
  const h = g.h;
  const { seat, id } = h.pendingKakan;
  h.pendingKakan = null;
  const m = h.melds[seat].find(x => x.type === 'pon' && kindOf(x.ids[0]) === kindOf(id));
  m.type = 'kakan';
  m.ids = sortIds(m.ids.concat([id]));
  h.kans.push(seat);
  h.last = null;
  breakIppatsuAll(h);
  wallRevealDora(h.wall);
  drawRinshan(g, seat);
}

function gameTsumo(g, seat) {
  const sc = tsumoScore(g, seat);
  if (!sc) return false;
  const h = g.h;
  const winTile = h.drawn;
  endWin(g, seat, null, winTile, false, sc);
  return true;
}

function gameKyuushu(g, seat) {
  if (!canKyuushu(g, seat)) return false;
  endAbortive(g, 'kyuushu', seat);
  return true;
}

// --- 局の終わり ---

function winPayments(g, winner, loser, sc) {
  const dealer = dealerOf(g);
  const isOya = winner === dealer;
  const pay = [0, 0, 0, 0];
  const p = handPayment(sc.base, isOya, loser == null);
  if (loser != null) {
    const x = p.ron + HONBA_RON * g.honba;
    pay[loser] -= x;
    pay[winner] += x;
  } else {
    for (let s = 0; s < 4; s++) {
      if (s === winner) continue;
      const x = (s === dealer ? p.oya : p.ko) + HONBA_TSUMO_EACH * g.honba;
      pay[s] -= x;
      pay[winner] += x;
    }
  }
  pay[winner] += g.kyotaku * RIICHI_COST;
  return pay;
}

function notenPayments(tenpai) {
  const pay = [0, 0, 0, 0];
  const n = tenpai.filter(Boolean).length;
  if (n === 0 || n === 4) return pay;
  for (let s = 0; s < 4; s++) pay[s] = tenpai[s] ? NOTEN_TOTAL / n : -NOTEN_TOTAL / (4 - n);
  return pay;
}

function endWin(g, winner, loser, winTile, chankan, sc) {
  const h = g.h;
  if (!sc) sc = ronScore(g, winner, winTile, chankan);
  if (loser != null) {
    h.hands[winner] = sortIds(h.hands[winner].concat([winTile]));
    // 加槓の牌でロンされたら、その牌はポンのまま
    if (chankan) h.pendingKakan = null;
  } else {
    h.hands[winner] = sortIds(h.hands[winner].concat([h.drawn]));
    h.drawn = null;
  }
  // リーチ宣言牌でロンされたらリーチは成立しない
  if (h.riichiPending != null) { h.doubleRiichi[h.riichiPending] = false; h.riichiPending = null; }
  const pay = winPayments(g, winner, loser, sc);
  g.kyotaku = 0;
  h.phase = 'end';
  h.claims = null;
  h.result = {
    type: loser == null ? 'tsumo' : 'ron',
    winner, loser, winTile,
    form: sc.form, parts: sc.part ? [sc.part] : [],
    score: sc,
    ura: h.riichi[winner] ? uraIndicators(h.wall) : [],
    pay,
  };
  applyPay(g, pay);
}

function endExhaustive(g) {
  const h = g.h;
  if (h.drawn != null) { h.hands[h.turn] = sortIds(h.hands[h.turn].concat([h.drawn])); h.drawn = null; }
  const tenpai = [0, 1, 2, 3].map(s => seatWaits(g, s).length > 0);
  const nagashi = g.rules.nagashi
    ? [0, 1, 2, 3].filter(s => !h.calledOut[s] && h.discards[s].length && h.discards[s].every(d => isYaochu(kindOf(d.id))))
    : [];
  let pay;
  if (nagashi.length) {
    pay = [0, 0, 0, 0];
    const dealer = dealerOf(g);
    for (const s of nagashi) {
      const p = handPayment(2000, s === dealer, true);
      for (let o = 0; o < 4; o++) {
        if (o === s) continue;
        const x = (o === dealer ? p.oya : p.ko) + HONBA_TSUMO_EACH * g.honba;
        pay[o] -= x;
        pay[s] += x;
      }
    }
  } else {
    pay = notenPayments(tenpai);
  }
  h.phase = 'end';
  h.claims = null;
  h.result = { type: 'draw', tenpai, waits: [0, 1, 2, 3].map(s => seatWaits(g, s)), nagashi, pay };
  applyPay(g, pay);
}

// 途中流局。reason: 'kyuushu' 九種九牌 / 'suufon' 四風連打 / 'suucha' 四家立直 / 'suukan' 四槓散了
const ABORTIVE_NAME = { kyuushu: '九種九牌', suufon: '四風連打', suucha: '四家立直', suukan: '四槓散了' };
function endAbortive(g, reason, seat) {
  const h = g.h;
  if (h.drawn != null) { h.hands[h.turn] = sortIds(h.hands[h.turn].concat([h.drawn])); h.drawn = null; }
  h.phase = 'end';
  h.claims = null;
  h.result = { type: 'abort', reason, seat: seat == null ? null : seat, pay: [0, 0, 0, 0] };
}

function applyPay(g, pay) {
  for (let s = 0; s < 4; s++) g.points[s] += pay[s];
}

// 局の結果から次の局へ進める。対局が終わったら g.over = true。
function gameNextHand(g) {
  const h = g.h;
  if (!h || h.phase !== 'end' || g.over) return false;
  const r = h.result;
  const dealer = dealerOf(g);
  g.history.push({ label: roundLabel(g), honba: g.honba, type: r.type, winner: r.winner, loser: r.loser, pay: r.pay.slice() });
  let renchan;
  if (r.type === 'abort') renchan = true;
  else if (r.type === 'draw') renchan = r.tenpai[dealer];
  else renchan = r.winner === dealer;
  if (renchan) {
    g.honba++;
  } else {
    g.honba = r.type === 'draw' ? g.honba + 1 : 0;
    g.kyoku++;
    if (g.kyoku >= 4) { g.kyoku = 0; g.round++; }
  }
  g.handIndex++;
  if (g.round >= roundsInMatch(g.rules) || (g.rules.tobi && g.points.some(p => p < 0))) {
    g.over = true;
    // 残った供託はトップがもらう
    if (g.kyotaku) { g.points[gameRanking(g)[0]] += g.kyotaku * RIICHI_COST; g.kyotaku = 0; }
    return true;
  }
  handStart(g);
  return true;
}

// 順位（点数の高い順。同点なら起家に近い席が上）
function gameRanking(g) {
  const seats = [0, 1, 2, 3];
  seats.sort((a, b) => (g.points[b] - g.points[a]) || (((a - g.chicha + 4) % 4) - ((b - g.chicha + 4) % 4)));
  return seats;
}

// --- 自動で進める ---

// その席の人に、CPU と同じ考え方で1手させる（自分の番のとき）
function autoTurn(g, seat) {
  const h = g.h;
  if (canTsumo(g, seat)) return gameTsumo(g, seat);
  if (canKyuushu(g, seat) && cpuWantsKyuushu(g, seat)) return gameKyuushu(g, seat);
  const kan = cpuChooseKan(g, seat);
  if (kan != null) return gameKan(g, seat, kan);
  if (h.riichi[seat]) return gameDiscard(g, seat, h.drawn);
  const r = cpuChooseRiichi(g, seat);
  if (r != null) return gameDiscard(g, seat, r, true);
  return gameDiscard(g, seat, cpuChooseDiscard(g, seat));
}

// 対局をCPUの番だけ自動で進める。あなたの判断が必要になったら止まる。
// 1回呼ぶと1つだけ進める（画面で少しずつ見せるため）。進めたら true。
function gameStep(g) {
  const h = g.h;
  if (g.over || h.phase === 'end') return false;
  if (h.phase === 'draw') return gameDraw(g);
  if (h.phase === 'discard') {
    if (h.turn === HUMAN) {
      // リーチ後は和了・カンができないときは自動でツモ切り
      if (h.riichi[HUMAN] && h.drawn != null && !canTsumo(g, HUMAN) && !kanOptions(g, HUMAN).length) return gameDiscard(g, HUMAN, h.drawn);
      return false;
    }
    return autoTurn(g, h.turn);
  }
  return false;  // 'call' はあなたの判断待ち（CPU だけなら openClaims の中で決まっている）
}

// あなたの判断を待っているか
function waitingHuman(g) {
  const h = g.h;
  if (g.over || !h) return false;
  if (h.phase === 'discard' && h.turn === HUMAN) {
    return !(h.riichi[HUMAN] && h.drawn != null && !canTsumo(g, HUMAN) && !kanOptions(g, HUMAN).length);
  }
  if (h.phase === 'call' && h.claims && h.claims.human) return true;
  return false;
}
