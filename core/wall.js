// 山。136枚をシードで混ぜ、後ろの14枚を王牌（ワンパイ）にする。
// 王牌の並び: [0..3] 嶺上牌、[4] ドラ表示牌、[5] 裏ドラ表示牌、[6][7] 槓ドラ1枚目と裏、[8][9]…
const DEAD_WALL = 14;

function makeWall(seed) {
  const tiles = shuffleWith(makeRng(seed), allTileIds());
  return {
    seed,
    live: tiles.slice(0, TILE_COUNT - DEAD_WALL),
    dead: tiles.slice(TILE_COUNT - DEAD_WALL),
    next: 0,          // 次にツモる live の位置
    rinshan: 0,       // 使った嶺上牌の数
    doraCount: 1,     // めくれているドラ表示牌の数
  };
}

// 残りのツモ回数。嶺上牌を使った分だけ海底が手前に来る。
function wallLeft(w) { return w.live.length - w.rinshan - w.next; }

function wallDraw(w) {
  if (wallLeft(w) <= 0) return null;
  return w.live[w.next++];
}

function doraIndicators(w) {
  const out = [];
  for (let i = 0; i < w.doraCount; i++) out.push(w.dead[4 + i * 2]);
  return out;
}
function uraIndicators(w) {
  const out = [];
  for (let i = 0; i < w.doraCount; i++) out.push(w.dead[5 + i * 2]);
  return out;
}

// 嶺上牌を1枚引く（カンの後）。海底が1枚手前に来る。
function wallDrawRinshan(w) {
  if (w.rinshan >= 4 || wallLeft(w) <= 0) return null;
  return w.dead[w.rinshan++];
}

// 新しいドラ表示牌をめくる（カンの後）
function wallRevealDora(w) {
  if (w.doraCount < 5) w.doraCount++;
}
