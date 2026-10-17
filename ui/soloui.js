// 1人打ち練習の画面
const SOLO = { s: null, sel: null, counted: false };

function soloStart(seed) {
  SOLO.s = soloNew(seed || randomSeed(), APP.rules);
  SOLO.sel = null;
  SOLO.counted = false;
  soloRender();
}

function shantenText(n) {
  if (n === -1) return '和了の形！「ツモ」を押そう';
  if (n === 0) return '聴牌（テンパイ）：あと1枚で和了';
  return `${n}シャンテン：聴牌まであと${n}枚`;
}

function soloHandHtml(s) {
  const tile = (id, extra) => {
    const sel = SOLO.sel === id ? ' sel' : '';
    const can = s.phase === 'discard';
    return `<button class="ht${sel}${extra || ''}" data-act="tile" data-id="${id}"${can ? '' : ' disabled'}>` +
      tileSvgId(id, s.rules) + `</button>`;
  };
  let html = s.hand.map(id => tile(id)).join('');
  if (s.drawn != null) html += `<span class="draw-gap"></span>` + tile(s.drawn, ' drawn');
  return html;
}

function soloRender() {
  const s = SOLO.s;
  const info = soloInfo(s);
  const show = APP.save.settings.showShanten;
  const ind = doraIndicators(s.wall)[0];
  const dora = doraFromIndicator(kindOf(ind));
  const river = s.discards.map(id => tileSvgId(id, s.rules, 'rv')).join('');
  const canTsumo = soloCanTsumo(s);
  let status;
  if (s.phase === 'win') status = 'ツモ和了！';
  else if (s.phase === 'end') status = info.waits.length ? '聴牌で終わりました' : 'ノーテンで終わりました';
  else if (show) status = shantenText(info.shanten);
  else status = '1枚選んで捨ててください';

  $app().innerHTML =
    `<header class="bar"><button class="back" data-go="home">← ホーム</button><b>1人打ち練習</b>` +
    `<span class="seed">配牌 #${s.seed}</span></header>` +
    `<section class="solo-info">` +
    `<div class="left">残りツモ <b>${info.left}</b> 回</div>` +
    `<div class="dora">ドラ表示牌 ${tileSvgId(ind, s.rules, 'mini')} → ドラ ${tileSvgKind(dora, 'mini')}</div>` +
    `</section>` +
    `<p class="guide">13枚＋ツモってきた1枚から、1枚を捨てます。<b>4つの面子＋1つの雀頭</b>（例: 123・555・東東）を作ると和了です。</p>` +
    `<section class="river" aria-label="捨て牌">${river || '<span class="empty">捨て牌はまだありません</span>'}</section>` +
    `<p class="status${canTsumo ? ' win' : ''}">${esc(status)}</p>` +
    `<section class="hand${s.phase === 'discard' ? '' : ' done'}">${soloHandHtml(s)}</section>` +
    `<p class="tap-help">${APP.rules.tapMode === 'single' ? '牌をタップすると捨てます' : '牌を1回タップで選び、もう1回タップで捨てます'}</p>` +
    `<section class="actions">` +
    `<button class="big tsumo" data-act="tsumo"${canTsumo ? '' : ' disabled'}>ツモ</button>` +
    `<button data-act="new">新しい配牌</button>` +
    `<button data-act="retry">同じ配牌でもう一度</button>` +
    `</section>` +
    `<label class="opt"><input type="checkbox" data-act="toggle-shanten"${show ? ' checked' : ''}> シャンテン数を表示する</label>`;
  if (s.phase !== 'discard' && !SOLO.counted) soloFinish();
}

function soloFinish() {
  const s = SOLO.s;
  SOLO.counted = true;
  const st = APP.save.solo;
  st.played++;
  if (s.phase === 'win') {
    st.wins++;
    if (!st.bestDraws || s.draws < st.bestDraws) st.bestDraws = s.draws;
  }
  writeSave(APP.save);
  soloShowResult();
}

function groupHtml(kinds, label) {
  return `<div class="grp"><div class="grp-tiles">${kinds.map(k => tileSvgKind(k, 'mid')).join('')}</div>` +
    `<small>${label}</small></div>`;
}

function soloShowResult() {
  const s = SOLO.s;
  const info = soloInfo(s);
  let body;
  if (s.phase === 'win') {
    const a = info.agari;
    let groups = '';
    let note = '';
    if (a.form === 'standard') {
      const part = a.parts[0];
      groups = partGroups(part).map((g, i, all) => {
        const label = i === all.length - 1 ? '雀頭' : (g[0] === g[1] ? '刻子' : '順子');
        return groupHtml(g, label);
      }).join('');
      if (a.parts.length > 1) note = `<p class="note">この手は ${a.parts.length} 通りの分け方ができます（点数は高い方で数えます）。</p>`;
    } else if (a.form === 'chiitoi') {
      const counts = soloCounts(s);
      const pairs = [];
      counts.forEach((x, k) => { if (x === 2) pairs.push(k); });
      groups = pairs.map(k => groupHtml([k, k], '対子')).join('');
      note = '<p class="note">対子7つの<b>七対子（チートイツ）</b>という特別な形です。</p>';
    } else {
      const kinds = [];
      soloCounts(s).forEach((x, k) => { for (let i = 0; i < x; i++) kinds.push(k); });
      groups = groupHtml(kinds, '么九牌13種');
      note = '<p class="note">1・9・字牌を全種集めた<b>国士無双</b>という役満の形です。</p>';
    }
    body = `<h2 class="win-title">ツモ！</h2><p>${s.draws}巡目で和了の形ができました。</p>` +
      `<div class="groups">${groups}</div>${note}`;
  } else {
    const w = info.waits;
    body = `<h2>終了</h2><p>${SOLO_MAX_DRAWS}回ツモって、和了れませんでした。</p>` +
      (w.length
        ? `<p>最後は<b>聴牌</b>でした。待ち: </p><div class="waits">${w.map(k => tileSvgKind(k, 'mid')).join('')}</div>`
        : `<p>最後は <b>${info.shanten}シャンテン</b> でした。</p>`);
  }
  showOverlay(body +
    `<div class="ov-actions"><button class="big" data-act="new">次の配牌</button>` +
    `<button data-act="retry">同じ配牌でもう一度</button>` +
    `<button data-act="close">手牌を見る</button></div>`);
}

function soloAction(act, el) {
  const s = SOLO.s;
  if (act === 'close') { hideOverlay(); return; }
  if (act === 'new') { hideOverlay(); soloStart(); return; }
  if (act === 'retry') { hideOverlay(); soloStart(s.seed); return; }
  if (act === 'toggle-shanten') {
    APP.save.settings.showShanten = el.checked;
    writeSave(APP.save);
    soloRender();
    return;
  }
  if (act === 'tsumo') { if (soloTsumo(s)) { SOLO.sel = null; soloRender(); } return; }
  if (act === 'tile') {
    const id = +el.getAttribute('data-id');
    if (APP.rules.tapMode === 'double' && SOLO.sel !== id) { SOLO.sel = id; soloRender(); return; }
    SOLO.sel = null;
    if (soloDiscard(s, id)) soloRender();
  }
}
