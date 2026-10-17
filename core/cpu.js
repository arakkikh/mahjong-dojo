// CPU の考え方。
// - 打牌：シャンテン数がいちばん小さく、受け入れ（和了に近づく牌の残り枚数）が多い牌を捨てる。
//   同じくらいなら使いにくい牌（字牌 → 1・9 → 2・8 → 真ん中）から。赤ドラはなるべく残す。
// - 誰かがリーチしていて自分の手が遠い（2シャンテン以上）ときは、安全な牌から捨てる（オリ）。
// - 聴牌して門前ならリーチする。
// - 鳴き：役牌はポンする。鳴いて手が進み、役（役牌・タンヤオ）がはっきりあるときだけチー・ポンする。
function tileUsefulness(kind) {
  if (isHonor(kind)) return 0;
  const n = numOf(kind);
  if (n === 1 || n === 9) return 1;
  if (n === 2 || n === 8) return 2;
  return 3;
}

function isYakuhaiFor(g, seat, kind) {
  return kind >= 31 || kind === 27 + seatWind(g, seat) || kind === 27 + g.round;
}

// 鳴いた面子に役牌があるか
function hasYakuhaiMeld(g, seat) {
  return g.h.melds[seat].some(m => m.type !== 'chi' && isYakuhaiFor(g, seat, kindOf(m.ids[0])));
}

// タンヤオを目指しているか（鳴いた面子が全部 2〜8 で、手にも1・9・字牌がほとんどない）
function tanyaoRoute(g, seat, extraIds) {
  if (g.rules.kuitan === false) return false;
  const melds = g.h.melds[seat];
  if (!melds.every(m => m.ids.every(id => !isYaochu(kindOf(id))))) return false;
  if (extraIds && extraIds.some(id => isYaochu(kindOf(id)))) return false;
  return true;
}

// 危険度の低さ（大きいほど安全）。リーチしている人 riichiSeats に対して。
function safetyOf(g, kind, riichiSeats) {
  const h = g.h;
  const vis = gameVisible(g);
  let worst = 100;
  for (const r of riichiSeats) {
    const river = h.discards[r].map(d => kindOf(d.id));
    // リーチの後に他の人が捨てて通った牌も安全
    const idx = h.discards[r].findIndex(d => d.riichi);
    let safe = river.indexOf(kind) >= 0;
    if (!safe && idx >= 0) {
      const after = h.discards[r].length - idx;
      for (let s = 0; s < 4 && !safe; s++) {
        if (s === r) continue;
        const ds = h.discards[s];
        if (ds.slice(Math.max(0, ds.length - after)).some(d => kindOf(d.id) === kind)) safe = true;
      }
    }
    let v;
    if (safe) v = 100;
    else if (isHonor(kind)) v = vis[kind] >= 3 ? 90 : vis[kind] === 2 ? 70 : 40;
    else {
      const n = numOf(kind);
      const suji = d => river.indexOf(kind + d) >= 0;
      let sujiSafe;
      if (n <= 3) sujiSafe = suji(3);
      else if (n >= 7) sujiSafe = suji(-3);
      else sujiSafe = suji(3) && suji(-3);
      if (sujiSafe) v = isTerminal(kind) ? 75 : 60;
      else if (isTerminal(kind)) v = 35;
      else if (n === 2 || n === 8) v = 20;
      else v = 10;
    }
    if (v < worst) worst = v;
  }
  return worst;
}

function cpuChooseDiscard(g, seat) {
  const h = g.h;
  const tiles = handTiles(g, seat).filter(id => canDiscardId(g, seat, id));
  const m = meldCount(g, seat);
  const counts = countsOfIds(handTiles(g, seat));
  let choices = discardChoices(counts, m, gameVisible(g)).filter(c => tiles.some(id => kindOf(id) === c.kind));
  const best = choices[0];
  let kind;
  const riichiSeats = [0, 1, 2, 3].filter(s => s !== seat && (h.riichi[s] || h.riichiPending === s));
  if (riichiSeats.length && best.shanten >= 2) {
    // オリ：いちばん安全な牌。同じなら手が進む方
    const scored = choices.map((c, i) => ({ c, i, safe: safetyOf(g, c.kind, riichiSeats) }));
    scored.sort((a, b) => (b.safe - a.safe) || (a.i - b.i));
    kind = scored[0].c.kind;
  } else {
    // 鳴いていて役牌がなければ、タンヤオに向けて1・9・字牌を先に捨てる
    const tanyao = m > 0 && !isMenzen(g, seat) && !hasYakuhaiMeld(g, seat);
    let top = choices.filter(c => c.shanten === best.shanten && (tanyao || c.total === best.total));
    if (tanyao) {
      const y = top.filter(c => isYaochu(c.kind));
      top = y.length ? y : top.filter(c => c.total === best.total);
    }
    top.sort((a, b) => (tileUsefulness(a.kind) - tileUsefulness(b.kind)) || (a.kind - b.kind));
    kind = top[0].kind;
  }
  const ids = tiles.filter(id => kindOf(id) === kind);
  // 赤ドラでない方を先に捨てる。ツモ切りできるならツモ切り。
  ids.sort((a, b) => (isRedId(a, g.rules) - isRedId(b, g.rules)) || ((b === h.drawn) - (a === h.drawn)));
  return ids[0];
}

// リーチするなら捨てる牌の id、しないなら null
function cpuChooseRiichi(g, seat) {
  const cand = riichiCandidates(g, seat);
  if (!cand.length) return null;
  const h = g.h;
  const vis = gameVisible(g);
  const tiles = handTiles(g, seat);
  const m = meldCount(g, seat);
  let best = null, bestLeft = -1;
  for (const id of cand) {
    const c = countsOfIds(tiles);
    c[kindOf(id)]--;
    const left = waits(c, m).reduce((s, k) => s + Math.max(0, 4 - c[k] - vis[k] - (kindOf(id) === k ? 1 : 0)), 0);
    const better = left > bestLeft || (left === bestLeft && isRedId(best, g.rules) && !isRedId(id, g.rules));
    if (better) { best = id; bestLeft = left; }
  }
  // 待ちが残っていなければリーチしない（ダマで手を変える）
  if (bestLeft <= 0) return null;
  return best;
}

// 鳴くか。type は 'pon' 'kan'。
function cpuWantsCall(g, seat, type, id) {
  const h = g.h;
  const k = kindOf(id);
  const before = shanten(countsOfIds(h.hands[seat]), meldCount(g, seat));
  const c = countsOfIds(h.hands[seat]);
  c[k] -= type === 'kan' ? 3 : 2;
  const m = meldCount(g, seat) + 1;
  if (type === 'kan') {
    // 明槓は役牌のときだけ（手が悪くならないなら）
    return isYakuhaiFor(g, seat, k) && shanten(c, m) <= before;
  }
  // 3n+2 枚のシャンテン数は「1枚捨てた後」の値。-1（形が完成）でも捨てると聴牌なので 0 として比べる
  const after = Math.max(0, shanten(c, m));
  if (isYakuhaiFor(g, seat, k)) return after <= before;  // 役牌は役ができるので手が遅くならなければポン
  if (after >= before) return false;
  if (hasYakuhaiMeld(g, seat)) return true;
  return !isYaochu(k) && tanyaoRoute(g, seat, []) && yaochuInHand(h.hands[seat]) <= 2;
}

function yaochuInHand(ids) { return ids.filter(id => isYaochu(kindOf(id))).length; }

// チーするならその2枚、しないなら null
function cpuChooseChi(g, seat, id, opts) {
  const h = g.h;
  const before = shanten(countsOfIds(h.hands[seat]), meldCount(g, seat));
  const yakuhai = hasYakuhaiMeld(g, seat);
  let best = null, bestS = before;
  for (const p of opts) {
    const set = p.concat([id]);
    if (!yakuhai && !(tanyaoRoute(g, seat, set) && yaochuInHand(h.hands[seat]) <= 2)) continue;
    const c = countsOfIds(h.hands[seat].filter(t => t !== p[0] && t !== p[1]));
    const s = Math.max(0, shanten(c, meldCount(g, seat) + 1));
    if (s < bestS) { best = p; bestS = s; }
  }
  return best;
}

// 暗槓・加槓するならその種類、しないなら null
function cpuChooseKan(g, seat) {
  const opts = kanOptions(g, seat);
  if (!opts.length) return null;
  const h = g.h;
  const tiles = handTiles(g, seat);
  const m = meldCount(g, seat);
  const before = shanten(countsOfIds(tiles), m);
  for (const o of opts) {
    if (o.type === 'kakan') return o.kind;
    if (h.riichi[seat]) return o.kind;  // kanOptions で待ちが変わらないことは確かめてある
    const c = countsOfIds(tiles);
    c[o.kind] -= 4;
    // 4枚目を使い切っても手が遅くならないなら
    if (shanten(c, m + 1) <= before) return o.kind;
  }
  return null;
}

// 九種九牌で流すか（字牌・1・9 が11種以上なら国士無双を狙う）
function cpuWantsKyuushu(g, seat) {
  const c = handCounts(g, seat);
  return YAOCHU_KINDS.filter(k => c[k] > 0).length < 11;
}
