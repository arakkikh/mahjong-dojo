// 4人対局の画面
const GAME = { g: null, sel: null, timer: null, shown: null, mode: null, hint: false, advice: null, after: null };
// hint: ヒント付き対局か。advice: いま出しているおすすめ。after: おすすめと違う牌を捨てたときのひとこと
// mode: null ふつう / 'riichi' リーチで捨てる牌を選ぶ / 'chi' チーの組を選ぶ
const CPU_DELAY = 280;     // CPU が1手打つまでの間（ミリ秒）
const GAME_SAVE_KEY = 'mahjong-dojo-game-v1';

// 席を画面の場所に。0 = 下（あなた）、1 = 右（下家）、2 = 上（対面）、3 = 左（上家）
const SEAT_POS = ['bottom', 'right', 'top', 'left'];

// --- 途中の対局の保存（局の途中でも、閉じたところから続けられる）。ヒント付きは別に保存 ---
function gameSaveKey(hint) { return GAME_SAVE_KEY + (hint ? '-hint' : ''); }
function gameSaveCurrent() {
  try {
    if (!GAME.g || GAME.g.over) localStorage.removeItem(gameSaveKey(GAME.hint));
    else localStorage.setItem(gameSaveKey(GAME.hint), JSON.stringify(GAME.g));
  } catch (e) {}
}
function gameLoadSaved() {
  try {
    const raw = localStorage.getItem(gameSaveKey(GAME.hint));
    if (!raw) return null;
    const g = JSON.parse(raw);
    // 前の段階で保存した対局は形が違うので続けられない
    if (!g || g.version !== GAME_VERSION || !g.h || !Array.isArray(g.points) || g.points.length !== 4 || g.over) return null;
    g.rules = normalizeRules(g.rules);
    return g;
  } catch (e) { return null; }
}
function gameDropSaved() { try { localStorage.removeItem(gameSaveKey(GAME.hint)); } catch (e) {} }
function onGameScreen() { return APP.screen === 'game' || APP.screen === 'hint'; }
function gameTitle() { return GAME.hint ? 'ヒント付き対局' : '4人対局'; }

// --- 始める ---
function gameOpen(hint) {
  GAME.hint = !!hint;
  const saved = gameLoadSaved();
  GAME.g = null;
  $app().innerHTML =
    `<header class="bar"><button class="back" data-go="home">← ホーム</button><b>${gameTitle()}</b></header>` +
    `<section class="start">` +
    (GAME.hint
      ? `<p class="guide">あなたの番になるたびに、<b>おすすめの打牌と理由</b>を出します（光っている牌がおすすめ）。鳴きやリーチのときもアドバイスします。<br>` +
        `おすすめと違う牌を捨てても大丈夫。そのときは、おすすめとの違いを教えます。</p>`
      : `<p class="guide">あなたと CPU 3人で対局します。チー・ポン・カン・リーチもできます。<br>` +
        `和了るには<b>役が1つ以上</b>必要です（リーチ・タンヤオ・役牌など）。</p>`) +
    (saved ? `<button class="big wide" data-act="resume">続きから（${esc(roundLabel(saved))} ${saved.honba}本場）</button>` : '') +
    `<button class="${saved ? '' : 'big '}wide" data-act="start-tonpu">東風戦を始める（4局〜）</button>` +
    `<button class="wide" data-act="start-hanchan">半荘戦を始める（8局〜）</button>` +
    `</section>`;
}

function gameBegin(g) {
  GAME.g = g;
  GAME.sel = null;
  GAME.mode = null;
  GAME.shown = null;
  GAME.advice = null;
  GAME.after = null;
  gameSaveCurrent();
  gameRender();
  gameSchedule();
}

function gameStop() {
  if (GAME.timer) clearTimeout(GAME.timer);
  GAME.timer = null;
}

// CPU の番なら少し待って1手進める
function gameSchedule() {
  gameStop();
  const g = GAME.g;
  if (!g || !onGameScreen()) return;
  if (g.over) { gameShowFinal(); return; }
  if (g.h.phase === 'end') { gameShowResult(); return; }
  if (waitingHuman(g)) { gameSaveCurrent(); return; }
  // ツモはすぐ、打牌は少し間をあける
  const delay = g.h.phase === 'draw' ? 60 : CPU_DELAY;
  GAME.timer = setTimeout(() => {
    GAME.timer = null;
    if (GAME.g !== g || !onGameScreen()) return;
    gameStep(g);
    gameRender();
    gameSchedule();
  }, delay);
}

// --- 描画 ---
function riverHtml(g, seat) {
  const h = g.h;
  const ds = h.discards[seat];
  const last = h.last && !h.last.kakan && h.last.seat === seat ? ds.length - 1 : -1;
  // 鳴かれた牌は河から消す
  return ds.map((d, i) => d.called ? '' :
    `<span class="rt${i === last ? ' last' : ''}${d.tsumogiri ? ' tg' : ''}${d.riichi ? ' rr' : ''}">${tileSvgId(d.id, g.rules)}</span>`).join('');
}

// 鳴いた面子。暗槓は両端を裏向きに、鳴いた牌は印をつける
function meldHtml(g, m, cls) {
  return `<span class="meld">` + m.ids.map((id, i) => {
    if (m.type === 'ankan' && (i === 0 || i === 3)) return tileSvg('back', cls);
    return `<span class="${id === m.called ? 'called' : ''}">${tileSvgId(id, g.rules, cls)}</span>`;
  }).join('') + `</span>`;
}

function seatLabelHtml(g, seat) {
  const h = g.h;
  const wind = seatWind(g, seat);
  const turn = h.phase !== 'end' && h.turn === seat;
  return `<div class="seat seat-${SEAT_POS[seat]}${turn ? ' turn' : ''}">` +
    `<span class="wind${wind === 0 ? ' oya' : ''}">${WIND_NAME[wind]}</span>` +
    `<span class="pname">${SEAT_NAME[seat]}</span>` +
    (h.riichi[seat] ? `<span class="rbadge">リーチ</span>` : '') +
    `<b class="pts">${g.points[seat]}</b></div>`;
}

function tableHtml(g) {
  const h = g.h;
  const rivers = [0, 1, 2, 3].map(s =>
    `<div class="rv-cell rv-${SEAT_POS[s]}"><div class="river4">${riverHtml(g, s)}</div></div>`).join('');
  // 相手の鳴きは四隅に（その人から見て右側の角）
  const corners = { 1: 'tr', 2: 'tl', 3: 'bl' };
  const melds = [1, 2, 3].map(s =>
    `<div class="mcorner mc-${corners[s]}">${h.melds[s].map(m => meldHtml(g, m, 'mt')).join('')}</div>`).join('');
  const inds = doraIndicators(h.wall).map(id => tileSvgId(id, g.rules, 'mini')).join('');
  const center =
    `<div class="center">` +
    [0, 1, 2, 3].map(s => seatLabelHtml(g, s)).join('') +
    `<div class="c-mid"><b>${esc(roundLabel(g))}</b><small>${g.honba}本場` + (g.kyotaku ? `・供託${g.kyotaku}` : '') + `</small>` +
    `<small>残り <b>${wallLeft(h.wall)}</b></small>` +
    `<small class="c-dora">ドラ表示 ${inds}</small></div>` +
    `</div>`;
  return `<section class="table">${rivers}${melds}${center}</section>`;
}

function gameHandHtml(g) {
  const h = g.h;
  const myTurn = h.phase === 'discard' && h.turn === HUMAN;
  const riichiIds = GAME.mode === 'riichi' ? riichiCandidates(g, HUMAN) : null;
  const tile = (id, extra) => {
    let can = myTurn && canDiscardId(g, HUMAN, id);
    if (riichiIds) can = riichiIds.indexOf(id) >= 0;
    const rec = GAME.advice && GAME.advice.id === id && GAME.mode !== 'riichi' ? ' rec' : '';
    const cls = (GAME.sel === id ? ' sel' : '') + (extra || '') + (myTurn && !can ? ' ng' : '') + (riichiIds && can ? ' rc' : '') + rec;
    return `<button class="ht${cls}" data-act="gtile" data-id="${id}"${can ? '' : ' disabled'}>` + tileSvgId(id, g.rules) + `</button>`;
  };
  let html = h.hands[HUMAN].map(id => tile(id)).join('');
  if (h.turn === HUMAN && h.drawn != null) html += `<span class="draw-gap"></span>` + tile(h.drawn, ' drawn');
  return html;
}

function gameStatus(g) {
  const h = g.h;
  const show = APP.save.settings.showShanten;
  const m = meldCount(g, HUMAN);
  if (h.phase === 'call' && h.claims && h.claims.human) {
    const ho = h.claims.human;
    const who = h.last.kakan ? `${SEAT_NAME[h.last.seat]}の加槓` : SEAT_NAME[h.last.seat];
    if (ho.ron) return { text: `${who}の ${tileName(h.last.id, g.rules)} でロンできます！`, win: true };
    return { text: `${who}の ${tileName(h.last.id, g.rules)} を鳴けます` };
  }
  if (h.phase === 'discard' && h.turn === HUMAN) {
    if (GAME.mode === 'riichi') return { text: 'リーチ：光っている牌から1枚選んで捨ててください' };
    const sc = tsumoScore(g, HUMAN);
    if (sc) return { text: `和了！「ツモ」を押そう（${scoreLabel(sc)}）`, win: true };
    if (h.forbidden.length && h.drawn == null) return { text: '鳴いた牌と同じ牌・筋の牌は捨てられません（喰い替え）' };
    if (!show) return { text: 'あなたの番：1枚選んで捨ててください' };
    const s = shanten(handCounts(g, HUMAN), m);
    if (s === -1) return { text: 'あなたの番：和了の形ですが役がありません' };
    return { text: 'あなたの番：' + (s === 0 ? '聴牌（テンパイ）' : `${s}シャンテン`) };
  }
  if (h.phase === 'end') return { text: '' };
  const w = seatWaits(g, HUMAN);
  if (show && w.length) {
    return { text: (h.riichi[HUMAN] ? 'リーチ中' : '聴牌中') + (isFuriten(g, HUMAN) ? '（フリテン：ロンできません）' : ''), waits: w };
  }
  if (h.riichi[HUMAN]) return { text: 'リーチ中' };
  return { text: `${SEAT_NAME[h.turn]}の番` };
}

function scoreLabel(sc) {
  if (sc.yakuman) return sc.limit;
  return `${sc.han}翻${sc.fu}符` + (sc.limit ? ' ' + sc.limit : '');
}

function actionButtons(g) {
  const h = g.h;
  if (h.phase === 'end') {
    return `<button class="big" data-act="next">次へ</button><button data-act="show-result">結果を見る</button>`;
  }
  if (h.phase === 'call' && h.claims && h.claims.human) {
    const ho = h.claims.human;
    if (GAME.mode === 'chi') {
      const opts = h.claims.chiOptions.map((p, i) =>
        `<button class="chi-opt" data-act="chi-opt" data-i="${i}">` +
        sortIds(p.concat([h.last.id])).map(id => tileSvgId(id, g.rules, 'mini')).join('') + `</button>`).join('');
      return opts + `<button data-act="cancel">もどる</button>`;
    }
    const r = a => GAME.advice && GAME.advice.action === a ? ' rec' : '';
    let b = '';
    if (ho.ron) b += `<button class="big ron${r('ron')}" data-act="ron">ロン</button>`;
    if (ho.pon) b += `<button class="call${r('pon')}" data-act="pon">ポン</button>`;
    if (ho.kan) b += `<button class="call${r('kan')}" data-act="mkan">カン</button>`;
    if (ho.chi) b += `<button class="call${r('chi')}" data-act="chi">チー</button>`;
    return b + `<button class="${r('pass').trim()}" data-act="pass">スキップ</button>`;
  }
  const myTurn = h.phase === 'discard' && h.turn === HUMAN;
  if (myTurn && GAME.mode === 'riichi') return `<button data-act="cancel">リーチをやめる</button>`;
  let b = `<button class="big tsumo" data-act="gtsumo"${myTurn && canTsumo(g, HUMAN) ? '' : ' disabled'}>ツモ</button>`;
  const recR = GAME.advice && GAME.advice.action === 'riichi' ? ' rec' : '';
  if (myTurn && riichiCandidates(g, HUMAN).length) b += `<button class="call riichi${recR}" data-act="riichi">リーチ</button>`;
  if (myTurn) {
    for (const o of kanOptions(g, HUMAN)) {
      b += `<button class="call" data-act="kan" data-kind="${o.kind}">${o.type === 'ankan' ? '暗槓' : '加槓'} ${tileSvgKind(o.kind, 'mini')}</button>`;
    }
    if (canKyuushu(g, HUMAN)) b += `<button data-act="kyuushu">九種九牌で流す</button>`;
  }
  return b + `<button data-act="quit">中断してホームへ</button>`;
}

// ヒントの欄
function hintPanelHtml(g) {
  let html = '';
  if (GAME.after) html += `<div class="hint after">${GAME.after}</div>`;
  const a = GAME.advice;
  if (!a) return html;
  const choices = a.choices && a.mode !== 'defense' && a.action !== 'tsumo'
    ? `<details><summary>ほかの候補とくらべる</summary><table class="nk"><tbody>` +
      a.choices.map(c => `<tr${c.kind === a.kind ? ' class="best"' : ''}><td>${tileSvgKind(c.kind, 'mini')}</td>` +
        `<td>${c.shanten === 0 ? '聴牌' : c.shanten + 'シャンテン'}</td><td>${c.ukeire.length}種${c.total}枚</td></tr>`).join('') +
      `</tbody></table></details>`
    : (a.choices && a.mode === 'defense'
      ? `<details><summary>ほかの牌の安全さ</summary><table class="nk dg"><tbody>` +
        a.choices.map(c => `<tr${c.kind === a.kind ? ' class="best"' : ''}><td>${tileSvgKind(c.kind, 'mini')}</td><td>${esc(c.safeReason)}</td></tr>`).join('') +
        `</tbody></table></details>`
      : '');
  html += `<div class="hint"><b>💡 ${esc(a.title)}</b>` +
    a.reasons.map(r => `<p>${esc(r)}</p>`).join('') + choices + `</div>`;
  return html;
}

function updateAdvice(g) {
  GAME.advice = null;
  if (!GAME.hint || !waitingHuman(g)) return;
  const h = g.h;
  if (h.phase === 'discard') GAME.advice = hintTurn(g, HUMAN);
  else if (h.phase === 'call') GAME.advice = hintCall(g);
}

function gameRender() {
  const g = GAME.g;
  if (!g || g.over) return;
  const h = g.h;
  updateAdvice(g);
  const st = gameStatus(g);
  const myTurn = h.phase === 'discard' && h.turn === HUMAN;
  const show = APP.save.settings.showShanten;
  const waitsHtml = st.waits ? ` <span class="st-waits">待ち ${st.waits.map(k => tileSvgKind(k, 'mini')).join('')}</span>` : '';
  const myMelds = h.melds[HUMAN].length
    ? `<div class="my-melds">${h.melds[HUMAN].map(m => meldHtml(g, m, 'mid')).join('')}</div>` : '';
  $app().innerHTML =
    `<header class="bar"><button class="back" data-act="quit">← ホーム</button><b>${gameTitle()}</b>` +
    `<span class="seed">対局 #${g.seed}</span></header>` +
    tableHtml(g) +
    `<p class="status${st.win ? ' win' : ''}">${esc(st.text)}${waitsHtml}</p>` +
    myMelds +
    `<section class="hand${myTurn ? '' : ' done'}">${gameHandHtml(g)}</section>` +
    `<section class="actions g-actions">${actionButtons(g)}</section>` +
    (GAME.hint ? hintPanelHtml(g) : '') +
    `<label class="opt"><input type="checkbox" data-act="gtoggle-shanten"${show ? ' checked' : ''}> シャンテン数・待ちを表示する</label>`;
}

// --- 局の結果・終局 ---
function payRows(g, pay) {
  return [0, 1, 2, 3].map(s => {
    const d = pay[s];
    const cls = d > 0 ? 'plus' : d < 0 ? 'minus' : '';
    return `<tr${s === HUMAN ? ' class="me"' : ''}><td>${WIND_NAME[seatWind(g, s)]}</td><td>${SEAT_NAME[s]}</td>` +
      `<td class="${cls}">${d > 0 ? '+' : ''}${d || '±0'}</td><td>${g.points[s]}</td></tr>`;
  }).join('');
}

function agariGroupsHtml(g, r, seat) {
  const h = g.h;
  const counts = countsOfIds(h.hands[seat]);
  let html;
  if (r.form === 'standard') {
    html = partGroups(r.parts[0]).map((gr, i, all) =>
      groupHtml(gr, i === all.length - 1 ? '雀頭' : (gr[0] === gr[1] ? '刻子' : '順子'))).join('');
  } else if (r.form === 'chiitoi') {
    const pairs = [];
    counts.forEach((x, k) => { if (x === 2) pairs.push(k); });
    html = pairs.map(k => groupHtml([k, k], '対子')).join('');
  } else {
    const kinds = [];
    counts.forEach((x, k) => { for (let i = 0; i < x; i++) kinds.push(k); });
    html = groupHtml(kinds, '国士無双');
  }
  const meldName = { chi: 'チー', pon: 'ポン', minkan: '明槓', ankan: '暗槓', kakan: '加槓' };
  html += h.melds[seat].map(m =>
    `<div class="grp"><div class="grp-tiles">${meldHtml(g, m, 'mid')}</div><small>${meldName[m.type]}</small></div>`).join('');
  return html;
}

function yakuListHtml(g, r) {
  const sc = r.score;
  let rows = sc.yaku.map(y => `<tr><td>${esc(y.name)}</td><td>${sc.yakuman ? '役満' : y.han + '翻'}</td></tr>`).join('');
  if (!sc.yakuman) {
    if (sc.dora) rows += `<tr><td>ドラ</td><td>${sc.dora}翻</td></tr>`;
    if (sc.aka) rows += `<tr><td>赤ドラ</td><td>${sc.aka}翻</td></tr>`;
    if (sc.ura) rows += `<tr><td>裏ドラ</td><td>${sc.ura}翻</td></tr>`;
  }
  const isOya = r.winner === dealerOf(g);
  const p = handPayment(sc.base, isOya, r.type === 'tsumo');
  let pts;
  if (r.type === 'ron') pts = `${p.ron}点`;
  else if (isOya) pts = `${p.ko}点オール`;
  else pts = `${p.ko}・${p.oya}点`;
  const ura = r.ura && r.ura.length
    ? `<p class="note">裏ドラ表示 ${r.ura.map(id => tileSvgId(id, g.rules, 'mini')).join('')}</p>` : '';
  return `<table class="yaku"><tbody>${rows}</tbody></table>` +
    `<p class="score-line"><b>${scoreLabel(sc)}</b>　${pts}</p>` + ura;
}

function gameShowResult() {
  const g = GAME.g;
  const h = g.h;
  if (GAME.shown === h.seed + ':' + g.handIndex) return;
  GAME.shown = h.seed + ':' + g.handIndex;
  GAME.mode = null;
  gameSaveCurrent();
  const r = h.result;
  let body;
  if (r.type === 'abort') {
    const why = {
      kyuushu: `${r.seat === HUMAN ? 'あなた' : SEAT_NAME[r.seat]}が九種九牌（最初の手番で1・9・字牌が9種類以上）で流しました。`,
      suufon: '最初の4枚がみんな同じ風牌でした。',
      suucha: '4人ともリーチしました。',
      suukan: 'カンが4回（2人以上で）ありました。',
    }[r.reason];
    body = `<h2>途中流局</h2><p><b>${ABORTIVE_NAME[r.reason]}</b></p><p class="note">${why}点数の動きはなく、同じ親でやり直します。</p>`;
  } else if (r.type === 'draw') {
    const rows = [0, 1, 2, 3].map(s =>
      `<li><b>${SEAT_NAME[s]}</b> ${r.tenpai[s]
        ? `聴牌 <span class="waits-inline">${r.waits[s].map(k => tileSvgKind(k, 'mini')).join('')}</span>`
        : 'ノーテン'}${r.nagashi && r.nagashi.indexOf(s) >= 0 ? ' <b class="nagashi">流し満貫</b>' : ''}</li>`).join('');
    const note = r.nagashi && r.nagashi.length
      ? '捨て牌が全部1・9・字牌で、鳴かれなかった人は<b>流し満貫</b>（満貫のツモと同じ点）です。'
      : '山がなくなりました。聴牌の人がノーテンの人から合計3000点を受け取ります。';
    body = `<h2>流局</h2><p class="note">${note}</p><ul class="tenpai-list">${rows}</ul>`;
  } else {
    const who = SEAT_NAME[r.winner];
    const title = r.type === 'tsumo' ? 'ツモ' : 'ロン';
    const from = r.type === 'ron' ? `${SEAT_NAME[r.loser]}の ${tileName(r.winTile, g.rules)} で和了` : `${tileName(r.winTile, g.rules)} をツモって和了`;
    const mine = r.winner === HUMAN;
    body = `<h2 class="win-title${mine ? '' : ' other'}">${title}！</h2>` +
      `<p><b>${who}</b>が${from}</p>` +
      `<div class="groups">${agariGroupsHtml(g, r, r.winner)}</div>` +
      yakuListHtml(g, r);
  }
  const dealer = dealerOf(g);
  let next;
  if (r.type === 'abort') next = '';
  else {
    const renchan = r.type === 'draw' ? r.tenpai[dealer] : r.winner === dealer;
    next = `<p class="note">${renchan ? '親が' + (r.type === 'draw' ? '聴牌' : '和了') + 'したので、もう一度同じ親で続けます（連荘）。' : '次の局は親が交代します。'}</p>`;
  }
  body += `<table class="pay"><tbody>${payRows(g, r.pay)}</tbody></table>` + next;
  showOverlay(body + `<div class="ov-actions"><button class="big" data-act="next">次へ</button>` +
    `<button data-act="close">卓を見る</button></div>`);
}

function gameShowFinal() {
  const g = GAME.g;
  if (GAME.shown === 'final') return;
  GAME.shown = 'final';
  const rank = gameRanking(g);
  const myRank = rank.indexOf(HUMAN) + 1;
  if (!GAME.hint) {
    const st = APP.save.game;
    st.played++;
    st.ranks[myRank - 1]++;
    writeSave(APP.save);
  }
  gameDropSaved();
  const rows = rank.map((s, i) =>
    `<tr${s === HUMAN ? ' class="me"' : ''}><td>${i + 1}位</td><td>${SEAT_NAME[s]}</td><td>${g.points[s]}</td></tr>`).join('');
  const msg = myRank === 1 ? 'トップ！おめでとう！' : myRank === 4 ? '次はがんばろう' : `${myRank}位でした`;
  showOverlay(`<h2>終局</h2><p class="final-msg">${msg}</p>` +
    `<table class="pay final"><tbody>${rows}</tbody></table>` +
    `<p class="note">${g.history.length}局 打ちました。</p>` +
    `<div class="ov-actions"><button class="big" data-act="again">もう一度対局する</button>` +
    `<button data-go="home">ホームへ</button></div>`);
}

function afterHumanAct() {
  GAME.sel = null;
  GAME.mode = null;
  gameRender();
  gameSchedule();
}

// おすすめと違う選択をしたとき、ひとこと残す（次にあなたの番が来るまで表示）
function noteChoice(kind, action) {
  const a = GAME.advice;
  GAME.after = null;
  if (!GAME.hint || !a) return;
  if (action === 'discard' && (a.action === 'discard' || a.action === 'riichi') && kind !== a.kind) {
    GAME.after = `${esc(kindName(kind))} を捨てました。おすすめは ${esc(kindName(a.kind))} でした：${esc(a.reasons[0])}`;
  } else if (action === 'discard' && a.action === 'tsumo') {
    GAME.after = 'ツモ和了できる牌を捨てました（見逃し）。';
  } else if (action !== 'discard' && action !== a.action) {
    const name = { ron: 'ロン', pon: 'ポン', chi: 'チー', kan: 'カン', pass: 'スキップ' };
    GAME.after = `${name[action] || action}を選びました。おすすめは「${name[a.action] || a.action}」でした：${esc(a.reasons[0])}`;
  }
}

function gameAction(act, el) {
  const g = GAME.g;
  if (act === 'start-tonpu' || act === 'start-hanchan') {
    gameBegin(gameNew(randomSeed(), Object.assign({}, APP.rules, { length: act === 'start-tonpu' ? 'tonpu' : 'hanchan' })));
    return;
  }
  if (act === 'resume') { const s = gameLoadSaved(); if (s) gameBegin(s); else gameOpen(); return; }
  if (act === 'again') { hideOverlay(); gameBegin(gameNew(randomSeed(), g.rules)); return; }
  if (act === 'gtsumo' || act === 'kan' || act === 'kyuushu') GAME.after = null;
  if (act === 'quit') { gameStop(); gameSaveCurrent(); go('home'); return; }
  if (!g) return;
  if (act === 'close') { hideOverlay(); return; }
  if (act === 'show-result') { GAME.shown = null; gameShowResult(); return; }
  if (act === 'next') {
    hideOverlay();
    GAME.after = null;
    gameNextHand(g);
    GAME.sel = null;
    GAME.mode = null;
    gameSaveCurrent();
    if (!g.over) gameRender();
    gameSchedule();
    return;
  }
  if (act === 'gtoggle-shanten') {
    APP.save.settings.showShanten = el.checked;
    writeSave(APP.save);
    gameRender();
    return;
  }
  if (act === 'cancel') { GAME.mode = null; GAME.sel = null; gameRender(); return; }
  // 鳴き・ロンの返事
  if (act === 'ron') { noteChoice(null, 'ron'); if (gameCall(g, 'ron')) afterHumanAct(); return; }
  if (act === 'pon') { noteChoice(null, 'pon'); if (gameCall(g, 'pon')) afterHumanAct(); return; }
  if (act === 'mkan') { noteChoice(null, 'kan'); if (gameCall(g, 'kan')) afterHumanAct(); return; }
  if (act === 'pass') { noteChoice(null, 'pass'); if (gameCall(g, 'pass')) afterHumanAct(); return; }
  if (act === 'chi') {
    const opts = g.h.claims && g.h.claims.chiOptions;
    if (!opts) return;
    if (opts.length === 1) { noteChoice(null, 'chi'); if (gameCall(g, 'chi', opts[0])) afterHumanAct(); return; }
    GAME.mode = 'chi';
    gameRender();
    return;
  }
  if (act === 'chi-opt') {
    const o = g.h.claims && g.h.claims.chiOptions[+el.getAttribute('data-i')];
    if (o) noteChoice(null, 'chi');
    if (o && gameCall(g, 'chi', o)) afterHumanAct();
    return;
  }
  // 自分の番
  if (act === 'gtsumo') { if (gameTsumo(g, HUMAN)) afterHumanAct(); return; }
  if (act === 'riichi') { GAME.mode = 'riichi'; GAME.sel = null; gameRender(); return; }
  if (act === 'kan') { if (gameKan(g, HUMAN, +el.getAttribute('data-kind'))) afterHumanAct(); return; }
  if (act === 'kyuushu') { if (gameKyuushu(g, HUMAN)) afterHumanAct(); return; }
  if (act === 'gtile') {
    if (!waitingHuman(g) || g.h.phase !== 'discard') return;
    const id = +el.getAttribute('data-id');
    if (APP.rules.tapMode === 'double' && GAME.sel !== id) { GAME.sel = id; gameRender(); return; }
    const riichi = GAME.mode === 'riichi';
    if (canDiscardId(g, HUMAN, id)) noteChoice(kindOf(id), 'discard');
    if (gameDiscard(g, HUMAN, id, riichi)) afterHumanAct();
  }
}
