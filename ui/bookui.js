// チャレンジ・役図鑑・成績の画面
const BOOK = { tab: 'yaku', open: null };

function missionOpen() {
  const done = APP.save.missions;
  const n = MISSIONS.filter(m => done.indexOf(m.id) >= 0).length;
  const groups = MISSION_LEVELS.map((lv, i) => {
    const ms = MISSIONS.filter(m => m.level === i);
    const got = ms.filter(m => done.indexOf(m.id) >= 0).length;
    return `<h3 class="sec">${lv} <small>${got}／${ms.length}</small></h3>` +
      `<div class="mlist">` + ms.map(m => {
        const ok = done.indexOf(m.id) >= 0;
        return `<div class="mitem${ok ? ' ok' : ''}"><span class="mcheck">${ok ? '✓' : ''}</span>` +
          `<span class="mode-body"><b>${esc(m.title)}</b><small>${esc(m.text)}</small></span></div>`;
      }).join('') + `</div>`;
  }).join('');
  $app().innerHTML =
    `<header class="bar"><button class="back" data-go="home">← ホーム</button><b>チャレンジ</b><span class="seed">${n}／${MISSIONS.length}</span></header>` +
    `<div class="progress"><span style="width:${Math.round(n / MISSIONS.length * 100)}%"></span></div>` +
    `<p class="guide">4人対局・ヒント付き対局で、目標を達成すると ✓ がつきます。</p>` + groups +
    `<div class="lnav"><button class="big wide" data-go="game">4人対局へ</button></div>`;
}

function bookOpen() {
  BOOK.open = null;
  bookRender();
}

function bookRender() {
  const tabs = `<div class="tabs"><button class="${BOOK.tab === 'yaku' ? 'on' : ''}" data-act="tab" data-v="yaku">役図鑑</button>` +
    `<button class="${BOOK.tab === 'stats' ? 'on' : ''}" data-act="tab" data-v="stats">成績</button></div>`;
  $app().innerHTML =
    `<header class="bar"><button class="back" data-go="home">← ホーム</button><b>役図鑑・成績</b></header>` +
    tabs + (BOOK.tab === 'yaku' ? yakuBookHtml() : statsHtml());
}

function yakuBookHtml() {
  const seen = APP.save.yakuSeen;
  const got = YAKU_BOOK.filter(e => seen[e.name]).length;
  const sections = [
    ['1翻', e => e.han === 1], ['2翻', e => e.han === 2], ['3翻以上', e => e.han >= 3 && e.han < 13], ['役満', e => e.han >= 13],
  ];
  const body = sections.map(([title, f]) => {
    const list = YAKU_BOOK.filter(f);
    return `<h3 class="sec">${title}</h3><div class="ybook">` + list.map(e => {
      const n = seen[e.name] || 0;
      const open = BOOK.open === e.name;
      return `<button class="yentry${n ? ' got' : ''}${open ? ' open' : ''}" data-act="yopen" data-v="${esc(e.name)}">` +
        `<span class="yname"><b>${esc(e.name)}</b><small>${esc(e.yomi)}</small></span>` +
        `<span class="yhan">${esc(yakuHanText(e))}</span>` +
        `<span class="ycount">${n ? `${n}回` : '未'}</span>` +
        (open ? `<span class="ydetail">${esc(e.text)}` +
          `<span class="ytiles">${bookTilesHtml(e)}</span></span>` : '') +
        `</button>`;
    }).join('') + `</div>`;
  }).join('');
  return `<p class="guide">対局で和了った役が集まります（ヒント付き対局もOK）。タップすると説明と例が出ます。<b>${got}／${YAKU_BOOK.length}</b> 種類</p>` + body;
}

// 例の手：手の中の牌、鳴き、最後に和了牌を離して
function bookTilesHtml(e) {
  const kinds = parseKinds(e.ex);
  const win = kinds.pop();
  const hand = kinds.map(k => tileSvgKind(k, 'yt')).join('');
  const melds = (e.melds || []).map(([type, t]) => {
    const ks = parseKinds(t);
    return `<span class="ymeld">` + ks.map((k, i) => type === 'ankan' && (i === 0 || i === 3) ? tileSvg('back', 'yt') : tileSvgKind(k, 'yt')).join('') + `</span>`;
  }).join('');
  return `<span class="yhand">${hand}</span>${melds}<span class="ywin">${tileSvgKind(win, 'yt')}</span>`;
}

function statsHtml() {
  const r = APP.save.records;
  const gs = APP.save.game;
  const totalRank = gs.ranks.reduce((s, n, i) => s + n * (i + 1), 0);
  const avgRank = gs.played ? (totalRank / gs.played).toFixed(2) : '—';
  const row = (label, value, note) => `<tr><td>${label}</td><td><b>${value}</b></td><td class="snote">${note || ''}</td></tr>`;
  const rankBars = gs.ranks.map((n, i) => {
    const w = gs.played ? Math.round(n / gs.played * 100) : 0;
    return `<div class="rbar"><span class="rl">${i + 1}位</span><span class="rb"><span style="width:${w}%"></span></span><span class="rn">${n}回</span></div>`;
  }).join('');
  const best = r.best
    ? `<p class="best">いちばん高い和了：<b>${r.best.points}点</b>（${esc(r.best.label)}）<br><small>${esc(r.best.yaku.join('・'))}${r.best.date ? '　' + esc(r.best.date) : ''}</small></p>`
    : '';
  const recent = r.recent.length
    ? `<h3 class="sec">最近の対局</h3><table class="pay recent"><tbody>` + r.recent.slice(0, 10).map(x =>
      `<tr><td>${esc(x.date)}</td><td>${x.length === 'hanchan' ? '半荘' : '東風'}</td><td>${x.rank}位</td><td>${x.points}</td></tr>`).join('') + `</tbody></table>`
    : '';
  return `<p class="guide">4人対局の成績です（ヒント付き対局は数えません）。</p>` +
    `<h3 class="sec">順位</h3><div class="ranks">${rankBars}</div>` +
    `<table class="stats"><tbody>` +
    row('対局数', `${gs.played}回`) +
    row('平均順位', avgRank, '1.00〜4.00。2.50より小さければ平均より上') +
    row('局数', `${r.hands}局`) +
    row('和了率', percent(r.wins, r.hands), '和了った局の割合（目安 20%）') +
    row('放銃率', percent(r.dealIns, r.hands), 'ロンされた局の割合（目安 12%以下）') +
    row('リーチ率', percent(r.riichi, r.hands), 'リーチした局の割合') +
    row('副露率', percent(r.calls, r.hands), '鳴いた局の割合') +
    row('ツモ率', percent(r.tsumo, r.wins), '和了のうちツモの割合') +
    row('平均打点', r.wins ? `${Math.round(r.winPoints / r.wins)}点` : '—', '和了1回の平均（本場・供託を除く）') +
    `</tbody></table>` + best + recent;
}

function bookAction(act, el) {
  if (act === 'tab') { BOOK.tab = el.getAttribute('data-v'); BOOK.open = null; bookRender(); return; }
  if (act === 'yopen') {
    const v = el.getAttribute('data-v');
    BOOK.open = BOOK.open === v ? null : v;
    bookRender();
  }
}
