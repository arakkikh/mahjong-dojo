// 段階②：4人対局（鳴きなし）。画面に依存しない対局の進行。
// 席（seat）は 0〜3。0 があなた、1 が下家（右）、2 が対面、3 が上家（左）。手番は 0→1→2→3 と回る。
// 起家（最初の親）はシードで決める。局が進むと親は次の席へ移る。
//
// この段階での決まり（段階③で本来のルールに置きかえる）:
// - チー・ポン・カン・リーチはなし。
// - 役はまだ数えない。和了の形になれば和了れる。
// - 点数は仮に「1翻30符」で計算する（子のロン1000点・ツモ300/500点、親のロン1500点・ツモ500点オール）。
// - 同時にロンできる人が2人以上いたら、捨てた人から見て手番の近い1人だけが和了る（頭ハネ）。
// - フリテンあり：自分の捨て牌に待ちの牌があるとロンできない。ロンを見送ると次に自分が捨てるまでロンできない。
const WIND_NAME = ['東', '南', '西', '北'];
const SEAT_NAME = ['あなた', '下家', '対面', '上家'];
const HUMAN = 0;

// 仮の点数（1翻30符）
const PROVISIONAL = { ronKo: 1000, ronOya: 1500, tsumoKoFromKo: 300, tsumoKoFromOya: 500, tsumoOyaAll: 500 };
const HONBA_RON = 300;
const HONBA_TSUMO_EACH = 100;
const NOTEN_TOTAL = 3000;

// 局ごとの山のシード（対局のシードと局の通し番号から作る）
function handSeed(matchSeed, index) {
  return (Math.imul(matchSeed ^ 0x5bd1e995, 0x9e3779b1) + Math.imul(index + 1, 0x85ebca6b)) >>> 0 || 1;
}

function gameNew(seed, rules) {
  rules = rules || DEFAULT_RULES;
  const rng = makeRng(seed);
  const g = {
    version: 1,
    seed,
    rules,
    chicha: Math.floor(rng() * 4),   // 起家の席
    points: [0, 1, 2, 3].map(() => rules.startPoints),
    round: 0,       // 0 = 東場、1 = 南場
    kyoku: 0,       // 0〜3（東1局〜東4局）
    honba: 0,
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
  g.h = {
    seed,
    wall,
    hands,                       // 13枚。ツモった牌は drawn に別に持つ
    drawn: null,                 // 手番の人がツモった牌
    discards: [[], [], [], []],  // { id, tsumogiri }
    turn: dealer,
    phase: 'draw',               // 'draw' ツモる / 'discard' 打牌かツモ和了を選ぶ / 'call' ロンを待つ / 'end' 局の終わり
    last: null,                  // 直前の打牌 { seat, id }
    callers: [],                 // ロンできる人（頭ハネの順）
    tempFuriten: [false, false, false, false],
    turns: 0,                    // ツモの回数（全員の合計）
    result: null,
  };
}

function handTiles(g, seat) {
  const h = g.h;
  return h.turn === seat && h.drawn != null ? h.hands[seat].concat([h.drawn]) : h.hands[seat].slice();
}
function handCounts(g, seat) { return countsOfIds(handTiles(g, seat)); }

// 見えている牌（全員の捨て牌とドラ表示牌）
function gameVisible(g) {
  const v = new Array(KIND_COUNT).fill(0);
  for (const ds of g.h.discards) for (const d of ds) v[kindOf(d.id)]++;
  for (const id of doraIndicators(g.h.wall)) v[kindOf(id)]++;
  return v;
}

// 13枚の手の待ち
function seatWaits(g, seat) {
  const c = countsOfIds(g.h.hands[seat]);
  return shanten(c, 0) === 0 ? waits(c, 0) : [];
}

// 自分の捨て牌に待ちの牌があればフリテン。ロンを見送った後も（次に捨てるまで）フリテン。
function isFuriten(g, seat) {
  if (g.h.tempFuriten[seat]) return true;
  const w = seatWaits(g, seat);
  if (!w.length) return false;
  return g.h.discards[seat].some(d => w.indexOf(kindOf(d.id)) >= 0);
}

function canTsumo(g, seat) {
  const h = g.h;
  return h.phase === 'discard' && h.turn === seat && h.drawn != null && isAgari(handCounts(g, seat), 0);
}

function canRon(g, seat, id) {
  const h = g.h;
  if (!h.last || h.last.seat === seat) return false;
  const c = countsOfIds(h.hands[seat]);
  c[kindOf(id)]++;
  if (!isAgari(c, 0)) return false;
  return !isFuriten(g, seat);
}

// ツモる。山がなければ流局。
function gameDraw(g) {
  const h = g.h;
  if (h.phase !== 'draw') return false;
  const id = wallDraw(h.wall);
  if (id == null) { endExhaustive(g); return true; }
  h.drawn = id;
  h.turns++;
  h.phase = 'discard';
  return true;
}

function gameDiscard(g, seat, id) {
  const h = g.h;
  if (h.phase !== 'discard' || h.turn !== seat) return false;
  const tiles = handTiles(g, seat);
  if (tiles.indexOf(id) < 0) return false;
  h.hands[seat] = sortIds(tiles.filter(t => t !== id));
  h.discards[seat].push({ id, tsumogiri: id === h.drawn });
  h.drawn = null;
  h.tempFuriten[seat] = false;
  h.last = { seat, id };
  // ロンできる人を、捨てた人の次の席から順に並べる（頭ハネ）
  h.callers = [];
  for (let i = 1; i < 4; i++) {
    const s = (seat + i) % 4;
    if (canRon(g, s, id)) h.callers.push(s);
  }
  if (h.callers.length) h.phase = 'call';
  else afterDiscard(g);
  return true;
}

// 打牌の後、誰もロンしなかったとき
function afterDiscard(g) {
  const h = g.h;
  h.callers = [];
  if (wallLeft(h.wall) <= 0) { endExhaustive(g); return; }
  h.turn = (h.turn + 1) % 4;
  h.phase = 'draw';
}

function gameTsumo(g, seat) {
  if (!canTsumo(g, seat)) return false;
  const h = g.h;
  const winTile = h.drawn;
  h.hands[seat] = sortIds(h.hands[seat].concat([winTile]));
  h.drawn = null;
  endWin(g, seat, null, winTile);
  return true;
}

// ロンする（いちばん手番の近い人だけができる）
function gameRon(g, seat) {
  const h = g.h;
  if (h.phase !== 'call' || h.callers[0] !== seat) return false;
  const winTile = h.last.id;
  h.hands[seat] = sortIds(h.hands[seat].concat([winTile]));
  endWin(g, seat, h.last.seat, winTile);
  return true;
}

// ロンを見送る。見送った人は次に自分が捨てるまでフリテン。
function gameSkip(g, seat) {
  const h = g.h;
  if (h.phase !== 'call' || h.callers[0] !== seat) return false;
  h.tempFuriten[seat] = true;
  h.callers.shift();
  if (!h.callers.length) afterDiscard(g);
  return true;
}

// 点数の動き（仮の点数）
function winPayments(g, winner, loser) {
  const dealer = dealerOf(g);
  const pay = [0, 0, 0, 0];
  const isOya = winner === dealer;
  if (loser != null) {
    const p = (isOya ? PROVISIONAL.ronOya : PROVISIONAL.ronKo) + HONBA_RON * g.honba;
    pay[loser] -= p;
    pay[winner] += p;
  } else {
    for (let s = 0; s < 4; s++) {
      if (s === winner) continue;
      let p;
      if (isOya) p = PROVISIONAL.tsumoOyaAll;
      else p = s === dealer ? PROVISIONAL.tsumoKoFromOya : PROVISIONAL.tsumoKoFromKo;
      p += HONBA_TSUMO_EACH * g.honba;
      pay[s] -= p;
      pay[winner] += p;
    }
  }
  return pay;
}

function notenPayments(tenpai) {
  const pay = [0, 0, 0, 0];
  const n = tenpai.filter(Boolean).length;
  if (n === 0 || n === 4) return pay;
  for (let s = 0; s < 4; s++) pay[s] = tenpai[s] ? NOTEN_TOTAL / n : -NOTEN_TOTAL / (4 - n);
  return pay;
}

function endWin(g, winner, loser, winTile) {
  const h = g.h;
  const counts = countsOfIds(h.hands[winner]);
  const form = agariForm(counts, 0);
  const pay = winPayments(g, winner, loser);
  h.phase = 'end';
  h.callers = [];
  h.result = {
    type: loser == null ? 'tsumo' : 'ron',
    winner, loser, winTile, form,
    parts: form === 'standard' ? decompose(counts) : [],
    pay,
  };
  applyPay(g, pay);
}

function endExhaustive(g) {
  const h = g.h;
  h.drawn = null;
  const tenpai = [0, 1, 2, 3].map(s => seatWaits(g, s).length > 0);
  const pay = notenPayments(tenpai);
  h.phase = 'end';
  h.callers = [];
  h.result = { type: 'draw', tenpai, waits: [0, 1, 2, 3].map(s => seatWaits(g, s)), pay };
  applyPay(g, pay);
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
  const renchan = r.type === 'draw' ? r.tenpai[dealer] : r.winner === dealer;
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

// 対局をCPUの番だけ自動で進める。あなたの判断が必要になったら止まる。
// 1回呼ぶと1つだけ進める（画面で少しずつ見せるため）。進めたら true。
function gameStep(g) {
  const h = g.h;
  if (g.over || h.phase === 'end') return false;
  if (h.phase === 'draw') return gameDraw(g);
  if (h.phase === 'discard') {
    if (h.turn === HUMAN) return false;
    if (canTsumo(g, h.turn)) return gameTsumo(g, h.turn);
    return gameDiscard(g, h.turn, cpuChooseDiscard(g, h.turn));
  }
  if (h.phase === 'call') {
    const s = h.callers[0];
    if (s === HUMAN) return false;
    return gameRon(g, s);  // CPU は和了れるときは必ず和了る
  }
  return false;
}

// あなたの判断を待っているか
function waitingHuman(g) {
  const h = g.h;
  if (g.over || !h) return false;
  if (h.phase === 'discard' && h.turn === HUMAN) return true;
  if (h.phase === 'call' && h.callers[0] === HUMAN) return true;
  return false;
}
