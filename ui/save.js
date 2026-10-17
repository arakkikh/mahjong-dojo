// 進行状況・成績の保存（localStorage）。読めない・書けないときも遊べるようにする。
const SAVE_KEY = 'mahjong-dojo-save-v1';

function defaultSave() {
  return {
    version: 1,
    settings: { showShanten: true, speed: 'normal' },  // speed: CPU の速さ 'slow' / 'normal' / 'fast'
    rules: Object.assign({}, DEFAULT_RULES),
    solo: { played: 0, wins: 0, bestDraws: null },
    game: { played: 0, ranks: [0, 0, 0, 0] },  // 4人対局の回数と、1位〜4位になった回数
    lessons: [],   // 終わったレッスンの id
    drills: {},    // ドリルごとの { tried, correct }
    missions: [],  // 達成したチャレンジの id
    yakuSeen: {},  // 役図鑑：和了った役（図鑑の見出し）ごとの回数
    records: defaultRecords(),  // 4人対局の成績
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
    if (d && d.settings && ['slow', 'normal', 'fast'].indexOf(d.settings.speed) >= 0) out.settings.speed = d.settings.speed;
    if (d && d.rules) out.rules = normalizeRules(d.rules);
    if (d && Array.isArray(d.missions)) out.missions = d.missions.filter(x => typeof x === 'string');
    if (d && d.yakuSeen && typeof d.yakuSeen === 'object') {
      for (const k of Object.keys(d.yakuSeen)) if (Number.isInteger(d.yakuSeen[k]) && d.yakuSeen[k] > 0) out.yakuSeen[k] = d.yakuSeen[k];
    }
    if (d && d.records && typeof d.records === 'object') {
      const r = d.records;
      for (const k of ['hands', 'wins', 'tsumo', 'dealIns', 'riichi', 'calls', 'winPoints']) {
        if (Number.isInteger(r[k]) && r[k] >= 0) out.records[k] = r[k];
      }
      if (r.best && Number.isInteger(r.best.points)) out.records.best = r.best;
      if (Array.isArray(r.recent)) out.records.recent = r.recent.filter(x => x && Number.isInteger(x.rank)).slice(0, 20);
    }
    if (d && Array.isArray(d.lessons)) out.lessons = d.lessons.filter(x => typeof x === 'string');
    if (d && d.drills && typeof d.drills === 'object') {
      for (const k of Object.keys(d.drills)) {
        const v = d.drills[k];
        if (v && Number.isInteger(v.tried) && Number.isInteger(v.correct) && v.tried >= 0 && v.correct >= 0) {
          out.drills[k] = { tried: v.tried, correct: Math.min(v.correct, v.tried) };
        }
      }
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
