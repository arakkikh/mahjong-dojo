// 4人対局（段階②・鳴きなし）の画面
const GAME = { g: null, sel: null, timer: null, shown: null };
const CPU_DELAY = 280;     // CPU が1手打つまでの間（ミリ秒）
const GAME_SAVE_KEY = 'mahjong-dojo-game-v1';

// 席を画面の場所に。0 = 下（あなた）、1 = 右（下家）、2 = 上（対面）、3 = 左（上家）
const SEAT_POS = ['bottom', 'right', 'top', 'left'];

// --- 途中の対局の保存（局の途中でも、閉じたところから続けられる） ---
function gameSaveCurrent() {
  try {
    if (!GAME.g || GAME.g.over) localStorage.removeItem(GAME_SAVE_KEY);
    else localStorage.setItem(GAME_SAVE_KEY, JSON.stringify(GAME.g));
  } catch (e) {}
}
function gameLoadSaved() {
  try {
    const raw = localStorage.getItem(GAME_SAVE_KEY);
    if (!raw) return null;
    const g = JSON.parse(raw);
    if (!g || g.version !== 1 || !g.h || !Array.isArray(g.points) || g.points.length !== 4 || g.over) return null;
    g.rules = normalizeRules(g.rules);
    return g;
  } catch (e) { return null; }
}
function gameDropSaved() { try { localStorage.removeItem(GAME_SAVE_KEY); } catch (e) {} }

// --- 始める ---
function gameOpen() {
  const saved = gameLoadSaved();
  GAME.g = null;
  $app().innerHTML =
    `<header class="bar"><button class="back" data-go="home">← ホーム</button><b>4人対局</b></header>` +
    `<section class="start">` +
    `<p class="guide">あなたと CPU 3人で対局します。<br>` +
    `いまは<b>段階②</b>：チー・ポン・カン・リーチはまだありません。<b>和了の形</b>ができれば役がなくても和了れます（点数は仮に1翻30符で計算）。</p>` +
    (saved ? `<button class="big wide" data-act="resume">続きから（${esc(roundLabel(saved))} ${saved.honba}本場）</button>` : '') +
    `<button class="${saved ? '' : 'big '}wide" data-act="start-tonpu">東風戦を始める（4局〜）</button>` +
    `<button class="wide" data-act="start-hanchan">半荘戦を始める（8局〜）</button>` +
    `</section>`;
}

function gameBegin(g) {
  GAME.g = g;
  GAME.sel = null;
  GAME.shown = null;
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
  if (!g || APP.screen !== 'game') return;
  if (g.over) { gameShowFinal(); return; }
  if (g.h.phase === 'end') { gameShowResult(); return; }
  if (waitingHuman(g)) { gameSaveCurrent(); return; }
  // ツモはすぐ、CPU の打牌は少し間をあける
  const delay = g.h.phase === 'draw' ? 60 : CPU_DELAY;
  GAME.timer = setTimeout(() => {
    GAME.timer = null;
    if (GAME.g !== g || APP.screen !== 'game') return;
    gameStep(g);
    gameRender();
    gameSchedule();
  }, delay);
}

// --- 描画 ---
function riverHtml(g, seat) {
  const h = g.h;
  const last = h.last && h.last.seat === seat ? h.discards[seat].length - 1 : -1;
  return h.discards[seat].map((d, i) =>
    `<span class="rt${i === last ? ' last' : ''}${d.tsumogiri ? ' tg' : ''}">${tileSvgId(d.id, g.rules)}</span>`).join('');
}

function seatLabelHtml(g, seat) {
  const h = g.h;
  const wind = seatWind(g, seat);
  const turn = h.phase !== 'end' && h.turn === seat;
  return `<div class="seat seat-${SEAT_POS[seat]}${turn ? ' turn' : ''}">` +
    `<span class="wind${wind === 0 ? ' oya' : ''}">${WIND_NAME[wind]}</span>` +
    `<span class="pname">${SEAT_NAME[seat]}</span>` +
    `<b class="pts">${g.points[seat]}</b></div>`;
}

function tableHtml(g) {
  const h = g.h;
  const ind = doraIndicators(h.wall)[0];
  const rivers = [0, 1, 2, 3].map(s =>
    `<div class="rv-cell rv-${SEAT_POS[s]}"><div class="river4">${riverHtml(g, s)}</div></div>`).join('');
  const center =
    `<div class="center">` +
    [0, 1, 2, 3].map(s => seatLabelHtml(g, s)).join('') +
    `<div class="c-mid"><b>${esc(roundLabel(g))}</b><small>${g.honba}本場</small>` +
    `<small>残り <b>${wallLeft(h.wall)}</b></small>` +
    `<small class="c-dora">ドラ表示 ${tileSvgId(ind, g.rules, 'mini')}</small></div>` +
    `</div>`;
  return `<section class="table">${rivers}${center}</section>`;
}

function gameHandHtml(g) {
  const h = g.h;
  const myTurn = h.phase === 'discard' && h.turn === HUMAN;
  const tile = (id, extra) =>
    `<button class="ht${GAME.sel === id ? ' sel' : ''}${extra || ''}" data-act="gtile" data-id="${id}"${myTurn ? '' : ' disabled'}>` +
    tileSvgId(id, g.rules) + `</button>`;
  let html = h.hands[HUMAN].map(id => tile(id)).join('');
  if (h.turn === HUMAN && h.drawn != null) html += `<span class="draw-gap"></span>` + tile(h.drawn, ' drawn');
  return html;
}

function gameStatus(g) {
  const h = g.h;
  const show = APP.save.settings.showShanten;
  if (h.phase === 'call' && h.callers[0] === HUMAN) return { text: `${SEAT_NAME[h.last.seat]}の ${tileName(h.last.id, g.rules)} でロンできます！`, win: true };
  if (h.phase === 'discard' && h.turn === HUMAN) {
    if (canTsumo(g, HUMAN)) return { text: '和了の形！「ツモ」を押そう', win: true };
    if (!show) return { text: 'あなたの番：1枚選んで捨ててください' };
    const s = shanten(handCounts(g, HUMAN), 0);
    return { text: 'あなたの番：' + (s === 0 ? '聴牌（テンパイ）。何を捨てても待ちが残る牌を選ぼう' : `${s}シャンテン`) };
  }
  if (h.phase === 'end') return { text: '' };
  const w = seatWaits(g, HUMAN);
  if (show && w.length) {
    return { text: '聴牌中' + (isFuriten(g, HUMAN) ? '（フリテン：ロンできません）' : ''), waits: w };
  }
  return { text: `${SEAT_NAME[h.turn]}の番` };
}

function gameRender() {
  const g = GAME.g;
  if (!g || g.over) return;
  const h = g.h;
  const st = gameStatus(g);
  const myTurn = h.phase === 'discard' && h.turn === HUMAN;
  const myCall = h.phase === 'call' && h.callers[0] === HUMAN;
  const show = APP.save.settings.showShanten;
  const waitsHtml = st.waits ? ` <span class="st-waits">待ち ${st.waits.map(k => tileSvgKind(k, 'mini')).join('')}</span>` : '';
  let buttons;
  if (myCall) {
    buttons = `<button class="big ron" data-act="ron">ロン</button><button data-act="skip">見送る</button>`;
  } else if (h.phase === 'end') {
    buttons = `<button class="big" data-act="next">次へ</button><button data-act="show-result">結果を見る</button>`;
  } else {
    buttons = `<button class="big tsumo" data-act="gtsumo"${myTurn && canTsumo(g, HUMAN) ? '' : ' disabled'}>ツモ</button>` +
      `<button data-act="quit">中断してホームへ</button>`;
  }
  $app().innerHTML =
    `<header class="bar"><button class="back" data-act="quit">← ホーム</button><b>4人対局</b>` +
    `<span class="seed">対局 #${g.seed}</span></header>` +
    tableHtml(g) +
    `<p class="status${st.win ? ' win' : ''}">${esc(st.text)}${waitsHtml}</p>` +
    `<section class="hand${myTurn ? '' : ' done'}">${gameHandHtml(g)}</section>` +
    `<section class="actions g-actions">${buttons}</section>` +
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

function agariGroupsHtml(r, tiles) {
  const counts = countsOfIds(tiles);
  if (r.form === 'standard') {
    return partGroups(r.parts[0]).map((gr, i, all) =>
      groupHtml(gr, i === all.length - 1 ? '雀頭' : (gr[0] === gr[1] ? '刻子' : '順子'))).join('');
  }
  if (r.form === 'chiitoi') {
    const pairs = [];
    counts.forEach((x, k) => { if (x === 2) pairs.push(k); });
    return pairs.map(k => groupHtml([k, k], '対子')).join('');
  }
  const kinds = [];
  counts.forEach((x, k) => { for (let i = 0; i < x; i++) kinds.push(k); });
  return groupHtml(kinds, '国士無双');
}

function gameShowResult() {
  const g = GAME.g;
  const h = g.h;
  if (GAME.shown === h.seed + ':' + g.handIndex) return;
  GAME.shown = h.seed + ':' + g.handIndex;
  gameSaveCurrent();
  const r = h.result;
  let body;
  if (r.type === 'draw') {
    const rows = [0, 1, 2, 3].map(s =>
      `<li><b>${SEAT_NAME[s]}</b> ${r.tenpai[s]
        ? `聴牌 <span class="waits-inline">${r.waits[s].map(k => tileSvgKind(k, 'mini')).join('')}</span>`
        : 'ノーテン'}</li>`).join('');
    body = `<h2>流局</h2><p class="note">山がなくなりました。聴牌の人がノーテンの人から合計3000点を受け取ります。</p>` +
      `<ul class="tenpai-list">${rows}</ul>`;
  } else {
    const who = SEAT_NAME[r.winner];
    const title = r.type === 'tsumo' ? 'ツモ' : 'ロン';
    const from = r.type === 'ron' ? `${SEAT_NAME[r.loser]}の ${tileName(r.winTile, g.rules)} で和了` : `${tileName(r.winTile, g.rules)} をツモって和了`;
    const mine = r.winner === HUMAN;
    body = `<h2 class="win-title${mine ? '' : ' other'}">${title}！</h2>` +
      `<p><b>${who}</b>が${from}</p>` +
      `<div class="groups">${agariGroupsHtml(r, h.hands[r.winner])}</div>` +
      `<p class="note">段階②では役を数えず、点数は仮に1翻30符で計算しています${g.honba ? `（${g.honba}本場の分を加算）` : ''}。</p>`;
  }
  const dealer = dealerOf(g);
  const renchan = r.type === 'draw' ? r.tenpai[dealer] : r.winner === dealer;
  body += `<table class="pay"><tbody>${payRows(g, r.pay)}</tbody></table>` +
    `<p class="note">${renchan ? '親が' + (r.type === 'draw' ? '聴牌' : '和了') + 'したので、もう一度同じ親で続けます（連荘）。' : '次の局は親が交代します。'}</p>`;
  showOverlay(body + `<div class="ov-actions"><button class="big" data-act="next">次へ</button>` +
    `<button data-act="close">卓を見る</button></div>`);
}

function gameShowFinal() {
  const g = GAME.g;
  if (GAME.shown === 'final') return;
  GAME.shown = 'final';
  const rank = gameRanking(g);
  const myRank = rank.indexOf(HUMAN) + 1;
  const st = APP.save.game;
  st.played++;
  st.ranks[myRank - 1]++;
  writeSave(APP.save);
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

function gameAction(act, el) {
  const g = GAME.g;
  if (act === 'start-tonpu' || act === 'start-hanchan') {
    gameBegin(gameNew(randomSeed(), Object.assign({}, APP.rules, { length: act === 'start-tonpu' ? 'tonpu' : 'hanchan' })));
    return;
  }
  if (act === 'resume') { const s = gameLoadSaved(); if (s) gameBegin(s); else gameOpen(); return; }
  if (act === 'again') { hideOverlay(); gameBegin(gameNew(randomSeed(), g.rules)); return; }
  if (act === 'quit') { gameStop(); gameSaveCurrent(); go('home'); return; }
  if (!g) return;
  if (act === 'close') { hideOverlay(); return; }
  if (act === 'show-result') { GAME.shown = null; gameShowResult(); return; }
  if (act === 'next') {
    hideOverlay();
    gameNextHand(g);
    GAME.sel = null;
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
  if (act === 'ron') { if (gameRon(g, HUMAN)) { gameRender(); gameSchedule(); } return; }
  if (act === 'skip') { if (gameSkip(g, HUMAN)) { gameRender(); gameSchedule(); } return; }
  if (act === 'gtsumo') { if (gameTsumo(g, HUMAN)) { GAME.sel = null; gameRender(); gameSchedule(); } return; }
  if (act === 'gtile') {
    if (!waitingHuman(g) || g.h.phase !== 'discard') return;
    const id = +el.getAttribute('data-id');
    if (APP.rules.tapMode === 'double' && GAME.sel !== id) { GAME.sel = id; gameRender(); return; }
    GAME.sel = null;
    if (gameDiscard(g, HUMAN, id)) { gameRender(); gameSchedule(); }
  }
}
