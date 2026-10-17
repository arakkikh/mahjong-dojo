// 進行状況・成績の保存（localStorage）。読めない・書けないときも遊べるようにする。
const SAVE_KEY = 'mahjong-dojo-save-v1';

function defaultSave() {
  return {
    version: 1,
    settings: { showShanten: true },
    solo: { played: 0, wins: 0, bestDraws: null },
    game: { played: 0, ranks: [0, 0, 0, 0] },  // 4人対局の回数と、1位〜4位になった回数
  };
}

function loadSave(storage) {
  const st = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  const out = defaultSave();
  let raw = null;
  try { raw = st ? st.getItem(SAVE_KEY) : null; } catch (e) { return out; }
  if (!raw) return out;
  try {
    const d = JSON.parse(raw);
    if (d && d.settings && typeof d.settings.showShanten === 'boolean') out.settings.showShanten = d.settings.showShanten;
    if (d && d.solo) {
      const s = d.solo;
      if (Number.isInteger(s.played) && s.played >= 0) out.solo.played = s.played;
      if (Number.isInteger(s.wins) && s.wins >= 0) out.solo.wins = Math.min(s.wins, out.solo.played);
      if (Number.isInteger(s.bestDraws) && s.bestDraws > 0) out.solo.bestDraws = s.bestDraws;
    }
    if (d && d.game && Array.isArray(d.game.ranks) && d.game.ranks.length === 4 &&
        d.game.ranks.every(n => Number.isInteger(n) && n >= 0)) {
      out.game.ranks = d.game.ranks.slice();
      out.game.played = out.game.ranks.reduce((x, y) => x + y, 0);
    }
  } catch (e) {
    // 壊れたデータは消さずに別の名前で残しておく
    try { st.setItem(SAVE_KEY + '-broken', raw); } catch (e2) {}
  }
  return out;
}

function writeSave(data, storage) {
  const st = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  try { if (st) st.setItem(SAVE_KEY, JSON.stringify(data)); return true; } catch (e) { return false; }
}
