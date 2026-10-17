// 役と点数の計算。
// 和了った手を受け取り、いちばん点数が高くなる見方（面子の分け方・和了牌の位置）で役・翻・符・点数を出す。
//
// ctx = {
//   concealed: 手の中の牌の id（和了牌を含む）, melds: 鳴いた面子 [{ type, ids }], winId: 和了牌,
//   tsumo, seatWind (0 = 東 … 3 = 北), roundWind,
//   riichi, doubleRiichi, ippatsu, rinshan, chankan, haitei, houtei, tenhou, chiihou,
//   doraInd: ドラ表示牌の id, uraInd: 裏ドラ表示牌の id（リーチのときだけ使う）, rules,
// }
// meld の type は 'chi' 'pon' 'minkan' 'ankan' 'kakan'。

const YAKUMAN_BASE = 8000;

function isDragon(kind) { return kind >= 31; }
function isWind(kind) { return kind >= 27 && kind <= 30; }
const GREEN_KINDS = [19, 20, 21, 23, 25, 32];  // 2・3・4・6・8索と發

// 鳴いた面子を役の計算用の形に
function meldSet(m) {
  const kinds = m.ids.map(kindOf).sort((a, b) => a - b);
  if (m.type === 'chi') return { type: 'shuntsu', kind: kinds[0], open: true };
  if (m.type === 'pon') return { type: 'koutsu', kind: kinds[0], open: true };
  return { type: 'kantsu', kind: kinds[0], open: m.type !== 'ankan' };
}

function waitTypeOf(m, winKind) {
  if (m.type === 'koutsu') return 'shanpon';
  if (winKind === m.kind + 1) return 'kanchan';
  if (winKind === m.kind) return m.kind % 9 === 6 ? 'penchan' : 'ryanmen';
  return m.kind % 9 === 0 ? 'penchan' : 'ryanmen';
}

// 和了の見方をすべて挙げる
function agariReadings(counts, meldCount, winKind) {
  const out = [];
  if (!meldCount && isKokushi(counts)) out.push({ form: 'kokushi' });
  if (!meldCount && isChiitoi(counts)) out.push({ form: 'chiitoi' });
  for (const part of decompose(counts)) {
    if (part.pair === winKind) out.push({ form: 'standard', part, winIndex: -1, wait: 'tanki' });
    part.mentsu.forEach((m, i) => {
      const has = m.type === 'koutsu' ? m.kind === winKind : (winKind >= m.kind && winKind <= m.kind + 2);
      if (has) out.push({ form: 'standard', part, winIndex: i, wait: waitTypeOf(m, winKind) });
    });
  }
  return out;
}

function ceil100(x) { return Math.ceil(x / 100) * 100; }

// 基本点（子のロンはこの4倍、親のロンは6倍）
function basePoints(han, fu, yakuman, rules) {
  if (yakuman) return YAKUMAN_BASE * yakuman;
  if (han >= 13) return 8000;
  if (han >= 11) return 6000;
  if (han >= 8) return 4000;
  if (han >= 6) return 3000;
  if (han >= 5) return 2000;
  if (rules && rules.kiriage && ((han === 4 && fu === 30) || (han === 3 && fu === 60))) return 2000;
  return Math.min(2000, fu * Math.pow(2, han + 2));
}

function limitName(han, yakuman, base) {
  if (yakuman) return yakuman > 1 ? `${yakuman}倍役満` : '役満';
  if (han >= 13) return '数え役満';
  if (base >= 6000) return '三倍満';
  if (base >= 4000) return '倍満';
  if (base >= 3000) return '跳満';
  if (base >= 2000) return '満貫';
  return '';
}

// 支払い。ron: 放銃者が払う点、tsumo: { oya, ko }（子のツモで親と子が払う点。親のツモは ko が全員分）
function handPayment(base, isOya, tsumo) {
  if (!tsumo) return { ron: ceil100(base * (isOya ? 6 : 4)) };
  if (isOya) return { oya: 0, ko: ceil100(base * 2) };
  return { oya: ceil100(base * 2), ko: ceil100(base) };
}

function countDora(ids, indicators) {
  let n = 0;
  for (const ind of indicators) {
    const d = doraFromIndicator(kindOf(ind));
    for (const id of ids) if (kindOf(id) === d) n++;
  }
  return n;
}

// 1つの見方での役満
function yakumanOf(ctx, r, sets, pair, allKinds) {
  const out = [];
  const menzen = ctx.melds.every(m => m.type === 'ankan');
  if (ctx.tenhou) out.push('天和');
  if (ctx.chiihou) out.push('地和');
  if (r.form === 'kokushi') { out.push('国士無双'); return out; }
  if (allKinds.every(isHonor)) out.push('字一色');
  if (allKinds.every(k => GREEN_KINDS.indexOf(k) >= 0)) out.push('緑一色');
  if (allKinds.every(isTerminal)) out.push('清老頭');
  if (r.form !== 'standard') return out;
  const kou = sets.filter(s => s.type !== 'shuntsu');
  if (kou.filter(s => !s.open).length === 4) out.push('四暗刻');
  if (kou.filter(s => isDragon(s.kind)).length === 3) out.push('大三元');
  const windSets = kou.filter(s => isWind(s.kind)).length;
  if (windSets === 4) out.push('大四喜');
  else if (windSets === 3 && isWind(pair)) out.push('小四喜');
  if (sets.filter(s => s.type === 'kantsu').length === 4) out.push('四槓子');
  if (menzen && !ctx.melds.length) {
    const c = countsOf(allKinds);
    const suit = Math.floor(allKinds[0] / 9);
    if (allKinds[0] < 27 && allKinds.every(k => Math.floor(k / 9) === suit)) {
      const b = suit * 9;
      let okc = c[b] >= 3 && c[b + 8] >= 3;
      for (let i = 1; i < 8; i++) if (c[b + i] < 1) okc = false;
      if (okc) out.push('九蓮宝燈');
    }
  }
  return out;
}

// 1つの見方での役（役満でないもの）と符
function yakuOf(ctx, r, sets, pair, allKinds) {
  const y = [];
  const add = (name, han) => y.push({ name, han });
  const menzen = ctx.melds.every(m => m.type === 'ankan');
  const seatK = 27 + ctx.seatWind;
  const roundK = 27 + ctx.roundWind;
  const kuitanOk = menzen || !ctx.rules || ctx.rules.kuitan !== false;

  if (ctx.doubleRiichi) add('ダブル立直', 2);
  else if (ctx.riichi) add('立直', 1);
  if (ctx.ippatsu) add('一発', 1);
  if (menzen && ctx.tsumo) add('門前清自摸和', 1);
  if (kuitanOk && allKinds.every(k => !isYaochu(k))) add('断幺九', 1);
  if (ctx.rinshan) add('嶺上開花', 1);
  if (ctx.chankan) add('槍槓', 1);
  if (ctx.haitei) add('海底摸月', 1);
  if (ctx.houtei) add('河底撈魚', 1);

  // 色
  const suits = new Set(allKinds.filter(k => k < 27).map(k => Math.floor(k / 9)));
  const honors = allKinds.some(isHonor);
  if (suits.size === 1 && !honors) add('清一色', menzen ? 6 : 5);
  else if (suits.size === 1 && honors) add('混一色', menzen ? 3 : 2);
  const allYaochu = allKinds.every(isYaochu);
  if (allYaochu && honors && suits.size > 0) add('混老頭', 2);

  if (r.form === 'chiitoi') {
    add('七対子', 2);
    return { yaku: y, fu: 25, fuParts: [{ name: '七対子は25符ちょうど', fu: 25 }] };
  }

  // 一般形
  const shun = sets.filter(s => s.type === 'shuntsu');
  const kou = sets.filter(s => s.type !== 'shuntsu');
  const yakuhaiPair = isDragon(pair) || pair === seatK || pair === roundK;
  const pinfu = menzen && shun.length === 4 && !yakuhaiPair && r.wait === 'ryanmen';
  if (pinfu) add('平和', 1);

  if (menzen) {
    const ks = shun.map(s => s.kind).sort((a, b) => a - b);
    let pairs = 0;
    for (let i = 0; i + 1 < ks.length; i++) if (ks[i] === ks[i + 1]) { pairs++; i++; }
    if (pairs === 2) add('二盃口', 3);
    else if (pairs === 1) add('一盃口', 1);
  }

  for (const s of kou) {
    if (s.kind === 31) add('役牌 白', 1);
    if (s.kind === 32) add('役牌 發', 1);
    if (s.kind === 33) add('役牌 中', 1);
    if (s.kind === seatK) add('自風 ' + WIND_NAME[ctx.seatWind], 1);
    if (s.kind === roundK) add('場風 ' + WIND_NAME[ctx.roundWind], 1);
  }

  const has = (list, kind) => list.some(s => s.kind === kind);
  for (let n = 0; n < 9; n++) {
    if (n <= 6 && has(shun, n) && has(shun, n + 9) && has(shun, n + 18)) { add('三色同順', menzen ? 2 : 1); break; }
  }
  for (let n = 0; n < 9; n++) {
    if (has(kou, n) && has(kou, n + 9) && has(kou, n + 18)) { add('三色同刻', 2); break; }
  }
  for (let su = 0; su < 3; su++) {
    const b = su * 9;
    if (has(shun, b) && has(shun, b + 3) && has(shun, b + 6)) { add('一気通貫', menzen ? 2 : 1); break; }
  }

  const setHasYaochu = s => s.type === 'shuntsu' ? (s.kind % 9 === 0 || s.kind % 9 === 6) : isYaochu(s.kind);
  if (shun.length && sets.every(setHasYaochu) && isYaochu(pair)) {
    if (honors) add('混全帯幺九', menzen ? 2 : 1);
    else add('純全帯幺九', menzen ? 3 : 2);
  }

  if (kou.length === 4) add('対々和', 2);
  const anko = kou.filter(s => !s.open).length;
  if (anko === 3) add('三暗刻', 2);
  if (kou.filter(s => s.type === 'kantsu').length === 3) add('三槓子', 2);
  if (kou.filter(s => isDragon(s.kind)).length === 2 && isDragon(pair)) add('小三元', 2);

  // 符（内訳も残す）
  const fuParts = [];
  const fp = (name, f) => fuParts.push({ name, fu: f });
  let fu;
  if (pinfu) {
    fu = ctx.tsumo ? 20 : 30;
    fp(ctx.tsumo ? '平和のツモは20符ちょうど' : '平和のロンは30符ちょうど', fu);
  } else {
    fu = 20;
    fp('副底', 20);
    if (menzen && !ctx.tsumo) { fu += 10; fp('門前のロン', 10); }
    if (ctx.tsumo) { fu += 2; fp('ツモ', 2); }
    for (const s of kou) {
      let f = s.type === 'kantsu' ? 8 : 2;
      if (!s.open) f *= 2;
      if (isYaochu(s.kind)) f *= 2;
      fu += f;
      const what = (s.type === 'kantsu' ? (s.open ? '明槓' : '暗槓') : (s.open ? '明刻' : '暗刻'));
      fp(`${kindName(s.kind)}の${what}（${isYaochu(s.kind) ? '么九牌' : '中張牌'}）`, f);
    }
    let pf = 0;
    if (pair === seatK && pair === roundK) pf += (ctx.rules && ctx.rules.doubleWindPair) || 2;
    else if (pair === seatK || pair === roundK) pf += 2;
    if (isDragon(pair)) pf += 2;
    if (pf) { fu += pf; fp(`${kindName(pair)}の雀頭（役牌）`, pf); }
    if (r.wait === 'kanchan' || r.wait === 'penchan' || r.wait === 'tanki') {
      fu += 2;
      fp({ kanchan: '嵌張待ち', penchan: '辺張待ち', tanki: '単騎待ち' }[r.wait], 2);
    }
    const raw = fu;
    fu = Math.ceil(fu / 10) * 10;
    if (fu === 20) fu = 30;  // 鳴いた平和の形のロンなど
    if (fu !== raw) fp(`${raw}符を10符単位に切り上げ${raw <= 20 ? '（鳴いた手は最低30符）' : ''}`, fu - raw);
  }
  return { yaku: y, fu, fuParts };
}

// 和了の点数。役がなければ null。
function scoreHand(ctx) {
  const counts = countsOfIds(ctx.concealed);
  const winKind = kindOf(ctx.winId);
  const meldIds = [];
  for (const m of ctx.melds) meldIds.push(...m.ids);
  const allIds = ctx.concealed.concat(meldIds);
  const allKinds = allIds.map(kindOf);
  const meldSets = ctx.melds.map(meldSet);
  let best = null;
  for (const r of agariReadings(counts, ctx.melds.length, winKind)) {
    let sets = [];
    let pair = -1;
    if (r.form === 'standard') {
      sets = r.part.mentsu.map((m, i) => ({ type: m.type, kind: m.kind, open: !ctx.tsumo && i === r.winIndex && m.type === 'koutsu' }));
      sets = sets.concat(meldSets);
      pair = r.part.pair;
    }
    const ym = yakumanOf(ctx, r, sets, pair, allKinds);
    let res;
    if (ym.length) {
      res = { yaku: ym.map(name => ({ name, han: 13 })), yakuman: ym.length, han: 0, fu: 0 };
    } else {
      const { yaku, fu, fuParts } = yakuOf(ctx, r, sets, pair, allKinds);
      if (!yaku.length) continue;
      res = { yaku, yakuman: 0, han: yaku.reduce((s, x) => s + x.han, 0), fu, fuParts };
    }
    res.form = r.form;
    res.part = r.part || null;
    res.wait = r.wait || null;
    if (!res.yakuman) {
      res.dora = countDora(allIds, ctx.doraInd || []);
      res.aka = allIds.filter(id => isRedId(id, ctx.rules)).length;
      res.ura = ctx.riichi || ctx.doubleRiichi ? countDora(allIds, ctx.uraInd || []) : 0;
      res.han += res.dora + res.aka + res.ura;
    } else {
      res.dora = res.aka = res.ura = 0;
    }
    res.base = basePoints(res.han, res.fu, res.yakuman, ctx.rules);
    res.limit = limitName(res.han, res.yakuman, res.base);
    if (!best || res.base > best.base || (res.base === best.base && (res.han > best.han || (res.han === best.han && res.fu > best.fu)))) best = res;
  }
  return best;
}
