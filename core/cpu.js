// CPU の打牌。シャンテン数がいちばん小さく、受け入れ（和了に近づく牌の残り枚数）が多い牌を捨てる。
// 同じくらいなら、使いにくい牌（字牌 → 1・9 → 2・8 → 真ん中）から捨てる。赤ドラはなるべく残す。
function tileUsefulness(kind) {
  if (isHonor(kind)) return 0;
  const n = numOf(kind);
  if (n === 1 || n === 9) return 1;
  if (n === 2 || n === 8) return 2;
  return 3;
}

function cpuChooseDiscard(g, seat) {
  const tiles = handTiles(g, seat);
  const choices = discardChoices(countsOfIds(tiles), 0, gameVisible(g));
  const best = choices[0];
  const top = choices.filter(c => c.shanten === best.shanten && c.total === best.total);
  top.sort((a, b) => (tileUsefulness(a.kind) - tileUsefulness(b.kind)) || (a.kind - b.kind));
  const kind = top[0].kind;
  const ids = tiles.filter(id => kindOf(id) === kind);
  // 赤ドラでない方を先に捨てる。ツモ切りできるならツモ切り。
  ids.sort((a, b) => (isRedId(a, g.rules) - isRedId(b, g.rules)) || ((b === g.h.drawn) - (a === g.h.drawn)));
  return ids[0];
}
