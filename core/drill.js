// 練習ドリルの問題づくりと答え合わせ。どれも rng（makeRng で作る乱数）を受け取るので、同じシードなら同じ問題になる。
// 問題の牌は kind（種類）で持つ。表示するときに id がいる場合は kindsToIds で作る。

const DRILLS = [
  { id: 'nanikiru', icon: '✂️', title: '何切る', text: '14枚から1枚捨てるなら？ 手がいちばん進む牌を選ぶ' },
  { id: 'wait', icon: '⏳', title: '待ち当て', text: '聴牌している13枚の待ちを全部選ぶ' },
  { id: 'yaku', icon: '🏷️', title: '役当て', text: '和了った手の役を全部選ぶ' },
  { id: 'score', icon: '🧮', title: '点数', text: '翻と符から点数を答える' },
  { id: 'danger', icon: '🛡️', title: '危険牌', text: 'リーチされたとき、いちばん安全な牌はどれ？' },
];

function rngInt(rng, n) { return Math.floor(rng() * n); }
function rngPick(rng, list) { return list[rngInt(rng, list.length)]; }

// kind の並びを id の並びに（同じ種類は 1枚目, 2枚目…。赤ドラは使わない）
function kindsToIds(kinds) {
  const used = {};
  return kinds.map(k => {
    const n = used[k] || 0;
    used[k] = n + 1;
    // 赤ドラの id（各5の0枚目）を避けるため 1,2,3,0 の順に使う
    return k * 4 + [1, 2, 3, 0][n];
  });
}

// --- 和了の形をつくる ---
// spec: { sets: [{ type: 'shuntsu'|'koutsu'|'any', kinds: [使ってよい kind] } ×4], pair: [kind] }
// 1種類4枚までを守る。作れなければ null。
function buildComplete(rng, spec) {
  for (let tryN = 0; tryN < 50; tryN++) {
    const c = new Array(KIND_COUNT).fill(0);
    const kinds = [];
    let ok = true;
    for (const s of spec.sets) {
      const cand = [];
      for (const k of s.kinds) {
        if ((s.type === 'koutsu' || s.type === 'any') && c[k] <= 1) cand.push({ t: 'k', k });
        if ((s.type === 'shuntsu' || s.type === 'any') && k < 27 && k % 9 <= 6 && c[k] < 4 && c[k + 1] < 4 && c[k + 2] < 4) cand.push({ t: 's', k });
      }
      if (!cand.length) { ok = false; break; }
      // 順子をやや多めに
      const pick = rngPick(rng, cand.concat(cand.filter(x => x.t === 's')));
      if (pick.t === 'k') { c[pick.k] += 3; kinds.push(pick.k, pick.k, pick.k); }
      else { for (let i = 0; i < 3; i++) { c[pick.k + i]++; kinds.push(pick.k + i); } }
    }
    if (!ok) continue;
    const pc = spec.pair.filter(k => c[k] <= 2);
    if (!pc.length) continue;
    const p = rngPick(rng, pc);
    kinds.push(p, p);
    return kinds.sort((a, b) => a - b);
  }
  return null;
}

const ALL_KINDS = Array.from({ length: KIND_COUNT }, (_, i) => i);
const NUMBER_KINDS = ALL_KINDS.filter(k => k < 27);
const SIMPLE_KINDS = NUMBER_KINDS.filter(k => !isTerminal(k));
const suitKinds = su => NUMBER_KINDS.filter(k => Math.floor(k / 9) === su);
const anySet = kinds => ({ type: 'any', kinds });

// --- 何切る ---
function drillNanikiru(rng) {
  for (let t = 0; t < 400; t++) {
    const tiles = shuffleWith(rng, allTileIds()).slice(0, 14);
    const kinds = tiles.map(kindOf).sort((a, b) => a - b);
    const counts = countsOf(kinds);
    const d = shantenDetail(counts, 0);
    if (d.form !== 'standard' || d.shanten < 1 || d.shanten > 2) continue;
    const choices = discardChoices(counts, 0, null);
    const best = choices[0];
    const answers = choices.filter(c => c.shanten === best.shanten && c.total === best.total).map(c => c.kind);
    // 正解が多すぎる問題は避ける
    if (answers.length > 2) continue;
    return { type: 'nanikiru', kinds, answers, choices };
  }
  return null;
}

// --- 待ち当て ---
// hard = true なら1色だけの手（清一色の形）で待ちが2種類以上
function drillWait(rng, hard) {
  for (let t = 0; t < 400; t++) {
    let spec;
    if (hard) {
      const ks = suitKinds(rngInt(rng, 3));
      spec = { sets: [anySet(ks), anySet(ks), anySet(ks), anySet(ks)], pair: ks };
    } else {
      spec = { sets: [anySet(NUMBER_KINDS), anySet(NUMBER_KINDS), anySet(NUMBER_KINDS), anySet(ALL_KINDS)], pair: ALL_KINDS };
    }
    const full = buildComplete(rng, spec);
    if (!full) continue;
    const kinds = full.slice();
    kinds.splice(rngInt(rng, kinds.length), 1);
    const w = waits(countsOf(kinds), 0);
    if (!w.length) continue;
    if (hard && w.length < 2) continue;
    if (!hard && w.length > 3) continue;
    return { type: 'wait', kinds, answers: w, hard: !!hard };
  }
  return null;
}

// --- 役当て・点数で使う和了の手 ---
const YAKU_CHOICES = ['立直', '門前清自摸和', '断幺九', '平和', '一盃口', '役牌 白', '役牌 發', '役牌 中',
  '三色同順', '一気通貫', '混全帯幺九', '対々和', '三暗刻', '七対子', '混一色', '清一色', '純全帯幺九', '二盃口', '小三元'];

// テーマを決めて手をつくる（ばらばらに作ると役がつきにくいので）
function themedHand(rng) {
  const themes = ['tanyao', 'pinfu', 'yakuhai', 'honitsu', 'chiitoi', 'toitoi', 'sanshoku', 'ittsu', 'iipeikou', 'chanta', 'chinitsu'];
  const theme = rngPick(rng, themes);
  if (theme === 'chiitoi') {
    const ks = shuffleWith(rng, ALL_KINDS).slice(0, 7);
    const kinds = [];
    for (const k of ks) kinds.push(k, k);
    return { theme, kinds: kinds.sort((a, b) => a - b) };
  }
  const su = rngInt(rng, 3);
  const honors = ALL_KINDS.filter(k => k >= 27);
  const yaochuSets = NUMBER_KINDS.filter(k => k % 9 === 0 || k % 9 === 6).concat(honors);
  let spec;
  switch (theme) {
    case 'tanyao': spec = { sets: [0, 1, 2, 3].map(() => anySet(SIMPLE_KINDS)), pair: SIMPLE_KINDS }; break;
    case 'pinfu': spec = { sets: [0, 1, 2, 3].map(() => ({ type: 'shuntsu', kinds: NUMBER_KINDS })), pair: NUMBER_KINDS }; break;
    case 'yakuhai': spec = { sets: [{ type: 'koutsu', kinds: [31, 32, 33] }, anySet(NUMBER_KINDS), anySet(NUMBER_KINDS), anySet(ALL_KINDS)], pair: ALL_KINDS }; break;
    case 'honitsu': spec = { sets: [0, 1, 2, 3].map(() => anySet(suitKinds(su).concat(honors))), pair: suitKinds(su).concat(honors) }; break;
    case 'chinitsu': spec = { sets: [0, 1, 2, 3].map(() => anySet(suitKinds(su))), pair: suitKinds(su) }; break;
    case 'toitoi': spec = { sets: [0, 1, 2, 3].map(() => ({ type: 'koutsu', kinds: ALL_KINDS })), pair: ALL_KINDS }; break;
    case 'sanshoku': {
      const n = rngInt(rng, 7);
      spec = { sets: [{ type: 'shuntsu', kinds: [n] }, { type: 'shuntsu', kinds: [n + 9] }, { type: 'shuntsu', kinds: [n + 18] }, anySet(ALL_KINDS)], pair: ALL_KINDS };
      break;
    }
    case 'ittsu': {
      const b = su * 9;
      spec = { sets: [{ type: 'shuntsu', kinds: [b] }, { type: 'shuntsu', kinds: [b + 3] }, { type: 'shuntsu', kinds: [b + 6] }, anySet(ALL_KINDS)], pair: ALL_KINDS };
      break;
    }
    case 'iipeikou': {
      const k = rngPick(rng, NUMBER_KINDS.filter(x => x % 9 <= 6));
      spec = { sets: [{ type: 'shuntsu', kinds: [k] }, { type: 'shuntsu', kinds: [k] }, { type: 'shuntsu', kinds: NUMBER_KINDS }, anySet(NUMBER_KINDS)], pair: NUMBER_KINDS };
      break;
    }
    case 'chanta': spec = { sets: [0, 1, 2, 3].map(() => anySet(yaochuSets)), pair: YAOCHU_KINDS }; break;
  }
  const kinds = buildComplete(rng, spec);
  return kinds ? { theme, kinds } : null;
}

// 和了の手と状況をつくって点数を出す。{ kinds, winKind, ctx, score }
function drillWinningHand(rng) {
  for (let t = 0; t < 500; t++) {
    const th = themedHand(rng);
    if (!th) continue;
    const kinds = th.kinds;
    const ids = kindsToIds(kinds);
    const winIndex = rngInt(rng, ids.length);
    const winId = ids[winIndex];
    const concealed = ids.slice(0, winIndex).concat(ids.slice(winIndex + 1)).concat([winId]);
    const tsumo = rng() < 0.4;
    const riichi = rng() < 0.35;
    const ctx = {
      concealed, melds: [], winId, tsumo,
      seatWind: rngInt(rng, 4), roundWind: rngInt(rng, 2),
      riichi, doubleRiichi: false, ippatsu: false, rinshan: false, chankan: false,
      haitei: false, houtei: false, tenhou: false, chiihou: false,
      doraInd: [], uraInd: [], rules: Object.assign({}, DEFAULT_RULES, { aka: 0 }),
    };
    const sc = scoreHand(ctx);
    if (!sc || sc.yakuman) continue;
    return { theme: th.theme, kinds: kinds.slice(), winKind: kindOf(winId), ctx, score: sc };
  }
  return null;
}

// --- 役当て ---
function drillYaku(rng) {
  const w = drillWinningHand(rng);
  if (!w) return null;
  const answers = w.score.yaku.map(y => y.name);
  // 選択肢：正解＋ほかの役を合わせて8つ
  const others = shuffleWith(rng, YAKU_CHOICES.filter(n => answers.indexOf(n) < 0));
  // 自風・場風は正解のときだけ出る
  const options = shuffleWith(rng, answers.concat(others.slice(0, Math.max(0, 8 - answers.length))));
  return Object.assign({ type: 'yaku', answers, options }, w);
}

// 支払いの書き方。ron: "7700点"、子のツモ: "2000・3900点"、親のツモ: "3900点オール"
function paymentText(base, isOya, tsumo) {
  const p = handPayment(base, isOya, tsumo);
  if (!tsumo) return `${p.ron}点`;
  if (isOya) return `${p.ko}点オール`;
  return `${p.ko}・${p.oya}点`;
}

// --- 点数 ---
// 翻・符・親か子か・ロンかツモか を見せて、点数を4択で答える
function drillScore(rng) {
  const w = drillWinningHand(rng);
  if (!w) return null;
  const sc = w.score;
  const isOya = w.ctx.seatWind === 0;
  const tsumo = w.ctx.tsumo;
  const answer = paymentText(sc.base, isOya, tsumo);
  const opts = new Set([answer]);
  const variants = [];
  for (const dh of [-1, 1, 2]) for (const df of [-10, 0, 10, 20]) {
    const han = sc.han + dh, fu = sc.fu + df;
    if (han < 1 || fu < 20) continue;
    variants.push(paymentText(basePoints(han, fu, 0, w.ctx.rules), isOya, tsumo));
  }
  variants.push(paymentText(sc.base, !isOya, tsumo));
  for (const v of shuffleWith(rng, variants)) { if (opts.size >= 4) break; opts.add(v); }
  // 足りないとき（満貫以上など）は上の点数を足す
  for (const b of [2000, 3000, 4000, 6000, 8000, 1000, 640]) { if (opts.size >= 4) break; opts.add(paymentText(b, isOya, tsumo)); }
  return Object.assign({ type: 'score', isOya, tsumo, answer, options: shuffleWith(rng, Array.from(opts)) }, w);
}

// --- 危険牌 ---
// 1人がリーチ。捨て牌 river（最後がリーチ宣言牌）と自分の手14枚から、いちばん安全な牌を選ぶ
function drillDanger(rng) {
  for (let t = 0; t < 400; t++) {
    const tiles = shuffleWith(rng, allTileIds());
    const riverLen = 6 + rngInt(rng, 7);
    const river = tiles.slice(0, riverLen).map(kindOf);
    const hand = tiles.slice(riverLen, riverLen + 14).map(kindOf).sort((a, b) => a - b);
    const visible = countsOf(river.concat(hand));
    const seen = new Set();
    const rated = [];
    for (const k of hand) {
      if (seen.has(k)) continue;
      seen.add(k);
      rated.push(Object.assign({ kind: k }, tileSafety(k, river, [], visible)));
    }
    rated.sort((a, b) => (b.safe - a.safe) || (a.kind - b.kind));
    const best = rated[0].safe;
    const answers = rated.filter(r => r.safe === best).map(r => r.kind);
    // 現物か筋があり、正解がしぼれている問題だけ
    if (best < 60 || answers.length > 2) continue;
    if (rated[1] && rated[1].safe === best && answers.length === 2 && rng() < 0.5) continue;
    return { type: 'danger', river, hand, answers, rated };
  }
  return null;
}

function drillMake(type, rng, opt) {
  if (type === 'nanikiru') return drillNanikiru(rng);
  if (type === 'wait') return drillWait(rng, opt && opt.hard);
  if (type === 'yaku') return drillYaku(rng);
  if (type === 'score') return drillScore(rng);
  if (type === 'danger') return drillDanger(rng);
  return null;
}

// 答え合わせ。picked: 選んだもの（kind の配列・役の名前の配列・点数の文字）
function drillCheck(q, picked) {
  if (q.type === 'nanikiru' || q.type === 'danger') return q.answers.indexOf(picked[0]) >= 0;
  if (q.type === 'score') return picked[0] === q.answer;
  const a = q.answers.slice().map(String).sort();
  const b = picked.slice().map(String).sort();
  return JSON.stringify(a) === JSON.stringify(b);
}
