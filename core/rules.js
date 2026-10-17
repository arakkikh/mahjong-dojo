// ルール設定。設定画面で変えられる項目と初期値。
const DEFAULT_RULES = {
  length: 'hanchan',      // 'tonpu' 東風戦 / 'hanchan' 半荘戦
  startPoints: 25000,
  returnPoints: 30000,
  kuitan: true,           // 喰いタン
  aka: 3,                 // 赤ドラの枚数 0 / 3
  abortiveDraws: true,    // 途中流局（九種九牌・四風連打・四家立直・四槓散了）
  nagashi: true,          // 流し満貫
  doubleWindPair: 2,      // 連風牌の雀頭の符 2 / 4
  kiriage: false,         // 切り上げ満貫
  tobi: true,             // トビ終了
  tapMode: 'double',      // 'double' 1回目で浮く・2回目で捨てる / 'single' 1タップで捨てる
};

function normalizeRules(r) {
  const out = Object.assign({}, DEFAULT_RULES);
  if (!r || typeof r !== 'object') return out;
  if (r.length === 'tonpu' || r.length === 'hanchan') out.length = r.length;
  for (const key of ['kuitan', 'abortiveDraws', 'nagashi', 'kiriage', 'tobi']) {
    if (typeof r[key] === 'boolean') out[key] = r[key];
  }
  if (r.aka === 0 || r.aka === 3) out.aka = r.aka;
  if (r.doubleWindPair === 2 || r.doubleWindPair === 4) out.doubleWindPair = r.doubleWindPair;
  if (r.tapMode === 'double' || r.tapMode === 'single') out.tapMode = r.tapMode;
  return out;
}
