// 画面の切り替えとホーム画面。
const APP = { screen: 'home', save: null, rules: DEFAULT_RULES };

const MODES = [
  { id: 'solo', icon: '🀄', title: '1人打ち練習', text: '牌を引いて捨てて、和了の形を作る練習', ready: true },
  { id: 'lesson', icon: '📖', title: '入門レッスン', text: '牌の種類から点数まで、順番に学ぶ', ready: false },
  { id: 'drill', icon: '✏️', title: '練習ドリル', text: '何切る・待ち当て・役当て・点数・危険牌', ready: false },
  { id: 'hint', icon: '💡', title: 'ヒント付き対局', text: 'おすすめの打牌と理由を見ながら打つ', ready: false },
  { id: 'game', icon: '🎲', title: '4人対局', text: 'CPU 3人と東風戦・半荘戦（いまは鳴き・リーチなし）', ready: true },
  { id: 'mission', icon: '🎯', title: 'チャレンジ', text: '「タンヤオで和了る」などの目標', ready: false },
  { id: 'book', icon: '📚', title: '役図鑑・成績', text: '和了った役のコレクションと成績', ready: false },
];

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function $app() { return document.getElementById('app'); }

function showOverlay(html) {
  const o = document.getElementById('overlay');
  o.innerHTML = `<div class="ov-box">${html}</div>`;
  o.hidden = false;
}
function hideOverlay() {
  const o = document.getElementById('overlay');
  o.hidden = true;
  o.innerHTML = '';
}

function go(screen) {
  APP.screen = screen;
  gameStop();
  hideOverlay();
  window.scrollTo(0, 0);
  if (screen === 'solo') soloStart();
  else if (screen === 'game') gameOpen();
  else renderHome();
}

function renderHome() {
  const s = APP.save.solo;
  const gs = APP.save.game;
  const items = MODES.map(m =>
    `<button class="mode${m.ready ? '' : ' soon'}" data-go="${m.id}"${m.ready ? '' : ' disabled'}>` +
    `<span class="mode-icon">${m.icon}</span>` +
    `<span class="mode-body"><b>${esc(m.title)}</b><small>${esc(m.text)}</small></span>` +
    (m.ready ? '' : '<span class="soon-tag">準備中</span>') +
    `</button>`).join('');
  const tiles = ['1m', '0p', '9s', '1z', '6z', '7z'].map(c => tileSvg(c)).join('');
  $app().innerHTML =
    `<header class="home-head">` +
    `<div class="home-tiles">${tiles}</div>` +
    `<h1>はじめての麻雀道場</h1>` +
    `<p class="lead">リーチ麻雀を基礎から。遊びながら強くなろう。</p>` +
    `</header>` +
    `<nav class="modes">${items}</nav>` +
    `<p class="home-stat">1人打ち練習：${s.played}回／和了 ${s.wins}回` +
    (s.bestDraws ? `／最速 ${s.bestDraws}巡目` : '') + `<br>` +
    `4人対局：${gs.played}回` + (gs.played ? `（${gs.ranks.map((n, i) => `${i + 1}位 ${n}`).join('・')}）` : '') + `</p>`;
}

function appBoot() {
  buildTileSprite();
  APP.save = loadSave();
  document.addEventListener('click', e => {
    const g = e.target.closest('[data-go]');
    if (g && !g.disabled) { go(g.getAttribute('data-go')); return; }
    const a = e.target.closest('[data-act]');
    if (!a || a.disabled) return;
    if (APP.screen === 'game') gameAction(a.getAttribute('data-act'), a);
    else soloAction(a.getAttribute('data-act'), a);
  });
  go('home');
}
