// 段階①：1人打ちの練習。配牌13枚 → ツモ → 打牌 をくり返し、和了の形になったらツモ和了できる。
// 実際の対局に近づけるため、ツモは18回まで（4人打ちで1人がツモる回数くらい）。
const SOLO_MAX_DRAWS = 18;

function soloNew(seed, rules) {
  const wall = makeWall(seed);
  const hand = [];
  for (let i = 0; i < 13; i++) hand.push(wallDraw(wall));
  const s = {
    seed,
    rules: rules || DEFAULT_RULES,
    wall,
    hand: sortIds(hand),
    drawn: null,       // ツモってきた牌（手牌の右に離して置く）
    discards: [],
    draws: 0,
    phase: 'discard',  // 'discard' 打牌を選ぶ / 'win' ツモ和了 / 'end' ツモ切れで終わり
    log: [],           // 打牌の記録 { drawn, discard, shanten }
  };
  soloDraw(s);
  return s;
}

function soloDraw(s) {
  if (s.draws >= SOLO_MAX_DRAWS) { s.phase = 'end'; s.drawn = null; return null; }
  const id = wallDraw(s.wall);
  if (id == null) { s.phase = 'end'; s.drawn = null; return null; }
  s.drawn = id;
  s.draws++;
  s.phase = 'discard';
  return id;
}

// いま手にある牌（14枚のときはツモ牌も含む）
function soloTiles(s) { return s.drawn == null ? s.hand.slice() : s.hand.concat([s.drawn]); }
function soloCounts(s) { return countsOfIds(soloTiles(s)); }

// 見えている牌：自分の捨て牌とドラ表示牌
function soloVisible(s) {
  const v = new Array(KIND_COUNT).fill(0);
  for (const id of s.discards) v[kindOf(id)]++;
  for (const id of doraIndicators(s.wall)) v[kindOf(id)]++;
  return v;
}

function soloCanTsumo(s) {
  return s.phase === 'discard' && s.drawn != null && isAgari(soloCounts(s), 0);
}

function soloDiscard(s, id) {
  if (s.phase !== 'discard') return false;
  const tiles = soloTiles(s);
  if (tiles.indexOf(id) < 0) return false;
  const rest = tiles.filter(t => t !== id);
  s.hand = sortIds(rest);
  s.discards.push(id);
  s.log.push({ drawn: s.drawn, discard: id, shanten: shanten(countsOfIds(rest), 0) });
  s.drawn = null;
  soloDraw(s);
  return true;
}

function soloTsumo(s) {
  if (!soloCanTsumo(s)) return false;
  s.phase = 'win';
  return true;
}

// 画面に出す情報：シャンテン数、聴牌なら待ち、和了なら面子の分け方
function soloInfo(s) {
  const counts = soloCounts(s);
  const detail = shantenDetail(counts, 0);
  const info = { shanten: detail.shanten, form: detail.form, waits: [], agari: null, left: SOLO_MAX_DRAWS - s.draws };
  if (s.phase === 'win') {
    const form = agariForm(counts, 0);
    info.agari = { form, parts: form === 'standard' ? decompose(counts) : [] };
  } else if (s.drawn == null) {
    info.waits = detail.shanten === 0 ? waits(counts, 0) : [];
  }
  return info;
}

// 1つの分け方を表示用の牌のかたまりに直す。例: [[1,2,3],[9,9,9],[27,27]]
function partGroups(part) {
  const groups = part.mentsu.map(m => m.type === 'koutsu' ? [m.kind, m.kind, m.kind] : [m.kind, m.kind + 1, m.kind + 2]);
  groups.sort((a, b) => a[0] - b[0]);
  groups.push([part.pair, part.pair]);
  return groups;
}
