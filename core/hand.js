// 手牌の計算：和了判定・面子分解・シャンテン数・待ち・受け入れ。
// どれも「種類ごとの枚数」の配列（長さ34。tiles.js の countsOf で作る）を受け取る。
// melds は鳴いた面子（暗槓も含む）の数。手の中で作る面子の数は 4 - melds になる。

// 一般形（4面子1雀頭）への分け方をすべて返す。
// 例: [{ pair: 0, mentsu: [{ type: 'shuntsu', kind: 1 }, { type: 'koutsu', kind: 9 }, …] }]
// shuntsu の kind は順子のいちばん小さい牌。
function decompose(counts) {
  const c = counts.slice();
  const total = countsTotal(c);
  const out = [];
  if (total % 3 !== 2) return out;
  const ms = [];
  function take(i, pair) {
    while (i < KIND_COUNT && c[i] === 0) i++;
    if (i >= KIND_COUNT) { out.push({ pair, mentsu: ms.slice() }); return; }
    if (c[i] >= 3) {
      c[i] -= 3; ms.push({ type: 'koutsu', kind: i });
      take(i, pair);
      ms.pop(); c[i] += 3;
    }
    const n = i < 27 ? i % 9 : -1;
    if (n >= 0 && n <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
      c[i]--; c[i + 1]--; c[i + 2]--; ms.push({ type: 'shuntsu', kind: i });
      take(i, pair);
      ms.pop(); c[i]++; c[i + 1]++; c[i + 2]++;
    }
  }
  for (let p = 0; p < KIND_COUNT; p++) {
    if (c[p] < 2) continue;
    c[p] -= 2;
    take(0, p);
    c[p] += 2;
  }
  return out;
}

function isChiitoi(counts) {
  let pairs = 0;
  for (const x of counts) {
    if (x === 2) pairs++;
    else if (x !== 0) return false;
  }
  return pairs === 7;
}

const YAOCHU_KINDS = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];

function isKokushi(counts) {
  if (countsTotal(counts) !== 14) return false;
  let pair = false;
  for (const k of YAOCHU_KINDS) {
    if (counts[k] === 0) return false;
    if (counts[k] === 2) pair = true;
  }
  return pair;
}

// 和了の形か。form は 'standard' / 'chiitoi' / 'kokushi' / null
function agariForm(counts, melds) {
  if (isKokushi(counts) && !melds) return 'kokushi';
  if (decompose(counts).length) return 'standard';
  if (!melds && isChiitoi(counts)) return 'chiitoi';
  return null;
}
function isAgari(counts, melds) { return agariForm(counts, melds || 0) !== null; }

// 一般形のシャンテン数。-1 = 和了、0 = 聴牌。
// 面子 m・搭子（あと1枚で面子）t・雀頭 p を数えて 2×(作る面子数) − 2m − t − p。
// 面子と搭子は合わせて「作る面子数」までしか数えない。
// 速くするため、色（萬子・筒子・索子・字牌）ごとに取れる (m, t, p) の組を調べて覚えておき、最後に組み合わせる。
const SUIT_SHAPES = new Map();

function suitShapes(c, from, len) {
  let key = from >= 27 ? 'z' : 'n';
  for (let i = 0; i < len; i++) key += c[from + i];
  const cached = SUIT_SHAPES.get(key);
  if (cached) return cached;
  const a = c.slice(from, from + len);
  const honor = from >= 27;
  const seen = new Set();
  const out = [];
  function dfs(i, m, t, p) {
    while (i < len && a[i] === 0) i++;
    if (i >= len) {
      const k = m * 32 + t * 2 + p;
      if (!seen.has(k)) { seen.add(k); out.push([m, t, p]); }
      return;
    }
    if (a[i] >= 3) { a[i] -= 3; dfs(i, m + 1, t, p); a[i] += 3; }
    if (!honor && i <= 6 && a[i + 1] > 0 && a[i + 2] > 0) {
      a[i]--; a[i + 1]--; a[i + 2]--;
      dfs(i, m + 1, t, p);
      a[i]++; a[i + 1]++; a[i + 2]++;
    }
    if (a[i] >= 2) {
      a[i] -= 2;
      if (!p) dfs(i, m, t, 1);
      dfs(i, m, t + 1, p);
      a[i] += 2;
    }
    if (!honor) {
      if (i <= 7 && a[i + 1] > 0) { a[i]--; a[i + 1]--; dfs(i, m, t + 1, p); a[i]++; a[i + 1]++; }
      if (i <= 6 && a[i + 2] > 0) { a[i]--; a[i + 2]--; dfs(i, m, t + 1, p); a[i]++; a[i + 2]++; }
    }
    // 残ったこの種類の牌は孤立牌として使わない
    const keep = a[i];
    a[i] = 0;
    dfs(i + 1, m, t, p);
    a[i] = keep;
  }
  dfs(0, 0, 0, 0);
  if (SUIT_SHAPES.size > 50000) SUIT_SHAPES.clear();
  SUIT_SHAPES.set(key, out);
  return out;
}

function shantenStandard(counts, melds) {
  const k = 4 - (melds || 0);
  // 色ごとの組を足し合わせる（雀頭は全体で1つまで）
  let states = [[0, 0, 0]];
  for (const [from, len] of [[0, 9], [9, 9], [18, 9], [27, 7]]) {
    const shapes = suitShapes(counts, from, len);
    const seen = new Set();
    const next = [];
    for (const [m1, t1, p1] of states) {
      for (const [m2, t2, p2] of shapes) {
        if (p1 + p2 > 1) continue;
        const m = m1 + m2, t = t1 + t2, p = p1 + p2;
        const key = m * 64 + t * 2 + p;
        if (seen.has(key)) continue;
        seen.add(key);
        next.push([m, t, p]);
      }
    }
    states = next;
  }
  let best = 2 * k;
  for (const [m0, t0, p] of states) {
    const m = Math.min(m0, k);
    const t = m + t0 > k ? k - m : t0;
    const s = 2 * k - 2 * m - t - p;
    if (s < best) best = s;
  }
  return best;
}

// 七対子のシャンテン数。同じ牌4枚は1組の対子としか数えない。
function shantenChiitoi(counts) {
  let pairs = 0;
  let kinds = 0;
  for (const x of counts) {
    if (x > 0) kinds++;
    if (x >= 2) pairs++;
  }
  return 6 - pairs + Math.max(0, 7 - kinds);
}

function shantenKokushi(counts) {
  let kinds = 0;
  let pair = false;
  for (const k of YAOCHU_KINDS) {
    if (counts[k] > 0) kinds++;
    if (counts[k] >= 2) pair = true;
  }
  return 13 - kinds - (pair ? 1 : 0);
}

// 3つの形のうちいちばん小さいシャンテン数。form でどの形かも返す。
function shantenDetail(counts, melds) {
  melds = melds || 0;
  const res = { shanten: shantenStandard(counts, melds), form: 'standard' };
  if (!melds && countsTotal(counts) >= 13) {
    const ci = shantenChiitoi(counts);
    if (ci < res.shanten) { res.shanten = ci; res.form = 'chiitoi'; }
    const ko = shantenKokushi(counts);
    if (ko < res.shanten) { res.shanten = ko; res.form = 'kokushi'; }
  }
  return res;
}
function shanten(counts, melds) { return shantenDetail(counts, melds).shanten; }

// 聴牌している手（3n+1枚）の待ち。手の中に4枚とも持っている牌では和了れないので除く。
function waits(counts, melds) {
  const c = counts.slice();
  const out = [];
  for (let k = 0; k < KIND_COUNT; k++) {
    if (c[k] >= 4) continue;
    c[k]++;
    if (isAgari(c, melds)) out.push(k);
    c[k]--;
  }
  return out;
}

// 受け入れ：引くとシャンテン数が1つ下がる牌と、その残り枚数。
// visible は見えている牌の枚数（捨て牌・ドラ表示牌・鳴いた牌など。手牌は含めない）。
function ukeire(counts, melds, visible) {
  const c = counts.slice();
  const base = shanten(c, melds);
  const tiles = [];
  let total = 0;
  for (let k = 0; k < KIND_COUNT; k++) {
    if (c[k] >= 4) continue;
    c[k]++;
    const s = shanten(c, melds);
    c[k]--;
    if (s < base) {
      const left = Math.max(0, 4 - counts[k] - (visible ? visible[k] : 0));
      tiles.push({ kind: k, left });
      total += left;
    }
  }
  return { shanten: base, tiles, total };
}

// 14枚（3n+2枚）の手で、どれを捨てるとどうなるか。受け入れの多い順に並べて返す。
function discardChoices(counts, melds, visible) {
  const c = counts.slice();
  const out = [];
  for (let k = 0; k < KIND_COUNT; k++) {
    if (!c[k]) continue;
    c[k]--;
    const u = ukeire(c, melds, visible);
    out.push({ kind: k, shanten: u.shanten, ukeire: u.tiles, total: u.total });
    c[k]++;
  }
  out.sort((a, b) => (a.shanten - b.shanten) || (b.total - a.total) || (a.kind - b.kind));
  return out;
}
