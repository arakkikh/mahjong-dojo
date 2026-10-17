// 成績・チャレンジ・役図鑑のための記録（画面に依存しない）。
// 局が終わるたびに handEvent、対局が終わったら matchEvent を作り、記録とチャレンジの判定に使う。

// 役の名前を図鑑の見出しにそろえる（「役牌 白」「自風 東」「場風 南」は全部「役牌」）
function yakuKey(name) {
  if (/^(役牌|自風|場風) /.test(name)) return '役牌';
  return name;
}

// 和了の点数（本場・供託を除いた手の値段）
function handValue(score, isOya, tsumo) {
  const p = handPayment(score.base, isOya, tsumo);
  if (!tsumo) return p.ron;
  return isOya ? p.ko * 3 : p.oya + p.ko * 2;
}

// 局の結果から、あなた（席0）にとっての出来事をまとめる
function handEvent(g) {
  const h = g.h;
  const r = h.result;
  const me = HUMAN;
  const isOya = dealerOf(g) === me;
  const ev = {
    kind: 'hand',
    type: r.type,
    win: (r.type === 'ron' || r.type === 'tsumo') && r.winner === me,
    dealIn: r.type === 'ron' && r.loser === me,
    tsumo: r.type === 'tsumo',
    isOya,
    riichi: h.riichi[me],
    open: !isMenzen(g, me),
    tenpaiDraw: r.type === 'draw' && r.tenpai[me],
    nagashi: r.type === 'draw' && (r.nagashi || []).indexOf(me) >= 0,
    score: null, yaku: [], points: 0, dora: 0,
  };
  if (ev.win) {
    const sc = r.score;
    ev.score = sc;
    ev.yaku = sc.yaku.map(y => y.name);
    ev.points = handValue(sc, isOya, ev.tsumo);
    ev.dora = (sc.dora || 0) + (sc.aka || 0) + (sc.ura || 0);
  }
  return ev;
}

// 対局の結果から
function matchEvent(g) {
  const rank = gameRanking(g).indexOf(HUMAN) + 1;
  const hist = g.history;
  return {
    kind: 'match',
    rank,
    length: g.rules.length,
    points: g.points[HUMAN],
    hands: hist.length,
    wins: hist.filter(x => (x.type === 'ron' || x.type === 'tsumo') && x.winner === HUMAN).length,
    dealIns: hist.filter(x => x.type === 'ron' && x.loser === HUMAN).length,
  };
}

// --- チャレンジ ---
const MISSION_LEVELS = ['初級', '中級', '上級'];
const has = (ev, name) => ev.yaku.indexOf(name) >= 0;
const MISSIONS = [
  { id: 'first_win', level: 0, title: '和了る', text: 'どんな役でもいいので和了る', check: ev => ev.win },
  { id: 'riichi_win', level: 0, title: 'リーチで和了る', text: 'リーチをかけて和了る', check: ev => ev.win && ev.riichi },
  { id: 'tanyao', level: 0, title: 'タンヤオで和了る', text: '2〜8の牌だけで和了る', check: ev => ev.win && has(ev, '断幺九') },
  { id: 'yakuhai', level: 0, title: '役牌で和了る', text: '白・發・中や自風・場風の刻子で和了る', check: ev => ev.win && ev.yaku.some(n => yakuKey(n) === '役牌') },
  { id: 'tsumo', level: 0, title: 'ツモで和了る', text: '自分で引いた牌で和了る', check: ev => ev.win && ev.tsumo },
  { id: 'pinfu', level: 0, title: '平和で和了る', text: '順子4つ・両面待ちで和了る', check: ev => ev.win && has(ev, '平和') },
  { id: 'tenpai_draw', level: 0, title: '流局で聴牌', text: '山がなくなったとき聴牌している', check: ev => ev.tenpaiDraw },
  { id: 'chiitoi', level: 1, title: '七対子で和了る', text: '対子7つで和了る', check: ev => ev.win && has(ev, '七対子') },
  { id: 'call_win', level: 1, title: '鳴いて和了る', text: 'チー・ポンして和了る', check: ev => ev.win && ev.open },
  { id: 'oya_win', level: 1, title: '親で和了る', text: '親のときに和了る（点数1.5倍）', check: ev => ev.win && ev.isOya },
  { id: 'ippatsu', level: 1, title: '一発', text: 'リーチして1巡以内に和了る', check: ev => ev.win && has(ev, '一発') },
  { id: 'dora3', level: 1, title: 'ドラ3', text: 'ドラ・赤ドラ・裏ドラを合わせて3つ以上で和了る', check: ev => ev.win && ev.dora >= 3 },
  { id: 'mangan', level: 1, title: '満貫', text: '満貫以上（子8000点・親12000点以上）で和了る', check: ev => ev.win && ev.score.base >= 2000 },
  { id: 'top', level: 1, title: 'トップ', text: '対局で1位になる', check: ev => ev.kind === 'match' && ev.rank === 1 },
  { id: 'no_dealin', level: 1, title: '振り込まない', text: '1回もロンされずに対局を終える', check: ev => ev.kind === 'match' && ev.dealIns === 0 },
  { id: 'haneman', level: 2, title: '跳満', text: '跳満以上（子12000点以上）で和了る', check: ev => ev.win && ev.score.base >= 3000 },
  { id: 'sanshoku', level: 2, title: '三色同順', text: '同じ数字の順子を3色で作って和了る', check: ev => ev.win && has(ev, '三色同順') },
  { id: 'ittsu', level: 2, title: '一気通貫', text: '1色で123・456・789を作って和了る', check: ev => ev.win && has(ev, '一気通貫') },
  { id: 'someone', level: 2, title: '染め手', text: '混一色か清一色で和了る', check: ev => ev.win && (has(ev, '混一色') || has(ev, '清一色')) },
  { id: 'toitoi', level: 2, title: '対々和', text: '刻子4つで和了る', check: ev => ev.win && has(ev, '対々和') },
  { id: 'three_wins', level: 2, title: '3回和了る', text: '1回の対局で3回以上和了る', check: ev => ev.kind === 'match' && ev.wins >= 3 },
  { id: 'top_hanchan', level: 2, title: '半荘戦でトップ', text: '半荘戦で1位になる', check: ev => ev.kind === 'match' && ev.length === 'hanchan' && ev.rank === 1 },
  { id: 'yakuman', level: 2, title: '役満', text: '役満で和了る', check: ev => ev.win && ev.score.yakuman > 0 },
];

// 出来事 ev で新しく達成したチャレンジの id
function missionsNewlyDone(ev, done) {
  return MISSIONS.filter(m => done.indexOf(m.id) < 0 && safeCheck(m, ev)).map(m => m.id);
}
function safeCheck(m, ev) {
  try { return !!m.check(ev); } catch (e) { return false; }
}

// --- 成績 ---
function defaultRecords() {
  return {
    hands: 0, wins: 0, tsumo: 0, dealIns: 0, riichi: 0, calls: 0, winPoints: 0,
    best: null,        // いちばん高かった和了 { points, label, yaku, date }
    recent: [],        // 最近の対局 { date, rank, points, length }（新しい順、20件まで）
  };
}

function recordHand(rec, ev, date) {
  rec.hands++;
  if (ev.riichi) rec.riichi++;
  if (ev.open) rec.calls++;
  if (ev.dealIn) rec.dealIns++;
  if (ev.win) {
    rec.wins++;
    if (ev.tsumo) rec.tsumo++;
    rec.winPoints += ev.points;
    if (!rec.best || ev.points > rec.best.points) {
      const sc = ev.score;
      const label = sc.yakuman ? sc.limit : `${sc.han}翻${sc.fu}符` + (sc.limit ? ' ' + sc.limit : '');
      rec.best = { points: ev.points, label, yaku: ev.yaku.slice(), date: date || '' };
    }
  }
}

function recordMatch(rec, ev, date) {
  rec.recent.unshift({ date: date || '', rank: ev.rank, points: ev.points, length: ev.length });
  if (rec.recent.length > 20) rec.recent.length = 20;
}

// 表示用の割合（小数1桁の％）
function percent(n, d) { return d ? (Math.round(n / d * 1000) / 10) + '%' : '—'; }
