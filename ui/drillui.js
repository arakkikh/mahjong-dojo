// 練習ドリルの画面
const DRILL = { type: null, hard: false, q: null, picked: [], answered: false, right: false, streak: 0 };

function drillStats(type) { return APP.save.drills[type] || { tried: 0, correct: 0 }; }

function drillOpen() {
  DRILL.type = null;
  const items = DRILLS.map(d => {
    const st = drillStats(d.id);
    const rate = st.tried ? `${st.correct}／${st.tried}問 正解` : 'まだ解いていません';
    const btn = (opt, label) => `<button class="mode" data-act="start" data-type="${d.id}"${opt ? ' data-hard="1"' : ''}>` +
      `<span class="mode-icon">${d.icon}</span><span class="mode-body"><b>${esc(d.title)}${label || ''}</b>` +
      `<small>${esc(d.text)}</small><small class="rate">${rate}</small></span></button>`;
    return d.id === 'wait' ? btn(false, '（ふつう）') + btn(true, '（1色・むずかしい）') : btn(false);
  }).join('');
  $app().innerHTML =
    `<header class="bar"><button class="back" data-go="home">← ホーム</button><b>練習ドリル</b></header>` +
    `<p class="guide">問題は毎回ちがいます。答えると理由が出るので、読んでから次へ進もう。</p>` +
    `<nav class="modes">${items}</nav>`;
}

function drillNew() {
  const q = drillMake(DRILL.type, makeRng(randomSeed()), { hard: DRILL.hard });
  DRILL.q = q;
  DRILL.picked = [];
  DRILL.answered = false;
  DRILL.right = false;
  drillRender();
  window.scrollTo(0, 0);
}

// kind の並びを牌の絵に
function kindsHtml(kinds, cls) { return kinds.map(k => tileSvgKind(k, cls)).join(''); }

function windText(ctx) { return `自風 ${WIND_NAME[ctx.seatWind]}・場風 ${WIND_NAME[ctx.roundWind]}`; }

// 和了の手を、和了牌を離して表示
function winHandHtml(q) {
  const rest = q.kinds.slice();
  rest.splice(rest.indexOf(q.winKind), 1);
  return `<div class="dhand">${kindsHtml(rest, 'dt')}<span class="draw-gap"></span>` +
    `<span class="wintile">${tileSvgKind(q.winKind, 'dt')}<small>${q.ctx.tsumo ? 'ツモ' : 'ロン'}</small></span></div>`;
}

function drillQuestionHtml() {
  const q = DRILL.q;
  const ans = DRILL.answered;
  const sel = k => DRILL.picked.indexOf(k) >= 0;
  if (q.type === 'nanikiru') {
    const btns = q.kinds.map((k, i) => `<button class="dk${sel(i) ? ' sel' : ''}" data-act="pick1" data-v="${i}"${ans ? ' disabled' : ''}>${tileSvgKind(k, 'dt')}</button>`).join('');
    return `<p class="qtitle">14枚から1枚捨てるなら、どれ？</p><p class="note-l">手がいちばん早く進む（受け入れが多い）牌を選ぼう。</p>` +
      `<div class="dhand">${btns}</div>`;
  }
  if (q.type === 'wait') {
    const pal = [0, 1, 2, 3].map(r => {
      const ks = [];
      for (let k = r * 9; k < Math.min(r * 9 + 9, KIND_COUNT); k++) ks.push(k);
      return `<div class="pal-row">` + ks.map(k => `<button class="dk${sel(k) ? ' sel' : ''}" data-act="toggle" data-v="${k}"${ans ? ' disabled' : ''}>${tileSvgKind(k, 'pt')}</button>`).join('') + `</div>`;
    }).join('');
    return `<p class="qtitle">この13枚の待ちは？</p><p class="note-l">待ちを<b>全部</b>選んで「答える」。</p>` +
      `<div class="dhand">${kindsHtml(q.kinds, 'dt')}</div><div class="palette">${pal}</div>`;
  }
  if (q.type === 'yaku') {
    const opts = q.options.map(o => `<button class="qopt${sel(o) ? ' sel' : ''}" data-act="toggle" data-v="${esc(o)}"${ans ? ' disabled' : ''}>${esc(o)}</button>`).join('');
    return `<p class="qtitle">この和了の役を全部選ぼう</p>` + winHandHtml(q) +
      `<p class="cond">鳴きなし・${q.ctx.riichi ? 'リーチあり' : 'リーチなし'}・${windText(q.ctx)}・ドラなし</p>` +
      `<div class="qopts grid2">${opts}</div>`;
  }
  if (q.type === 'score') {
    const sc = q.score;
    const opts = q.options.map(o => `<button class="qopt" data-act="pickv" data-v="${esc(o)}"${ans ? ' disabled' : ''}>${esc(o)}</button>`).join('');
    return `<p class="qtitle">${q.isOya ? '親' : '子'}が${q.tsumo ? 'ツモ' : 'ロン'}で和了りました。何点？</p>` + winHandHtml(q) +
      `<p class="cond">役：${sc.yaku.map(y => `${esc(y.name)} ${y.han}翻`).join('・')}<br><b>${sc.han}翻 ${sc.fu}符</b></p>` +
      `<div class="qopts grid2">${opts}</div>`;
  }
  if (q.type === 'danger') {
    const river = q.river.map((k, i) => `<span class="${i === q.river.length - 1 ? 'rr' : ''}">${tileSvgKind(k, 'pt')}</span>`).join('');
    const btns = q.hand.map((k, i) => `<button class="dk${sel(i) ? ' sel' : ''}" data-act="pick1" data-v="${i}"${ans ? ' disabled' : ''}>${tileSvgKind(k, 'dt')}</button>`).join('');
    return `<p class="qtitle">対面がリーチ！ いちばん安全な牌は？</p>` +
      `<p class="note-l">対面の捨て牌（赤い枠がリーチ宣言牌）</p><div class="driver">${river}</div>` +
      `<p class="note-l">あなたの手（あなたの手はまだ遠いので、オリます）</p><div class="dhand">${btns}</div>`;
  }
  return '';
}

function fuPartsHtml(sc) {
  if (!sc.fuParts) return '';
  return `<table class="yaku"><tbody>` + sc.fuParts.map(p => `<tr><td>${esc(p.name)}</td><td>${p.fu}符</td></tr>`).join('') + `</tbody></table>`;
}

function scoreExplainHtml(q) {
  const sc = q.score;
  const lines = [];
  if (sc.base >= 2000) {
    lines.push(`${sc.han}翻なので <b>${sc.limit}</b>（基本点 ${sc.base}点）。`);
  } else {
    lines.push(`基本点 = 符 × 2<sup>(翻+2)</sup> = ${sc.fu} × ${Math.pow(2, sc.han + 2)} = <b>${sc.base}</b>点`);
  }
  if (!q.tsumo) {
    const mul = q.isOya ? 6 : 4;
    lines.push(`${q.isOya ? '親' : '子'}のロンは ×${mul} → ${sc.base * mul}点 → 100点単位に切り上げて <b>${q.answer}</b>`);
  } else if (q.isOya) {
    lines.push(`親のツモは子3人が ×2 ずつ → ${sc.base * 2}点 → 切り上げて <b>${q.answer}</b>`);
  } else {
    lines.push(`子のツモは 子が ×1（${sc.base}点）、親が ×2（${sc.base * 2}点）→ 切り上げて <b>${q.answer}</b>（子の払い・親の払い）`);
  }
  return `<p class="note-l">${lines.join('<br>')}</p><p class="note-l">符の内訳：</p>${fuPartsHtml(sc)}`;
}

function groupsOfWin(q) {
  const sc = q.score;
  if (sc.form === 'standard' && sc.part) {
    return partGroups(sc.part).map((gr, i, all) => groupHtml(gr, i === all.length - 1 ? '雀頭' : (gr[0] === gr[1] ? '刻子' : '順子'))).join('');
  }
  if (sc.form === 'chiitoi') {
    const pairs = [];
    countsOf(q.kinds).forEach((x, k) => { if (x === 2) pairs.push(k); });
    return pairs.map(k => groupHtml([k, k], '対子')).join('');
  }
  return '';
}

function drillExplainHtml() {
  const q = DRILL.q;
  if (q.type === 'nanikiru') {
    const rows = q.choices.slice(0, 6).map(c =>
      `<tr${q.answers.indexOf(c.kind) >= 0 ? ' class="best"' : ''}><td>${tileSvgKind(c.kind, 'mini')}</td>` +
      `<td>${c.shanten === 0 ? '聴牌' : c.shanten + 'シャンテン'}</td><td>${c.ukeire.length}種${c.total}枚</td>` +
      `<td class="uk">${c.ukeire.map(u => tileSvgKind(u.kind, 'mini')).join('')}</td></tr>`).join('');
    return `<p>正解：${q.answers.map(k => kindName(k)).join('・')}</p>` +
      `<p class="note-l">捨てた後のシャンテン数と、次に引いて手が進む牌（受け入れ）の数です。シャンテン数を保ったまま、受け入れがいちばん多い牌を捨てます。</p>` +
      `<table class="nk"><tbody>${rows}</tbody></table>`;
  }
  if (q.type === 'wait') {
    const parts = q.answers.map(k => {
      const c = countsOf(q.kinds); c[k]++;
      const ps = decompose(c);
      const how = ps.length ? partGroups(ps[0]).map(g => kindsHtml(g, 'mini')).join('<span class="sp"></span>') : (isChiitoi(c) ? '七対子' : '国士無双');
      return `<div class="wrow">${tileSvgKind(k, 'mid')}<span class="arrow">→</span><span class="how">${how}</span></div>`;
    }).join('');
    return `<p>正解：${q.answers.map(k => kindName(k)).join('・')}</p><p class="note-l">それぞれの牌で、こう和了の形になります。</p>${parts}`;
  }
  if (q.type === 'yaku') {
    const sc = q.score;
    return `<p>正解：${q.answers.map(esc).join('・')}</p>` +
      `<table class="yaku"><tbody>${sc.yaku.map(y => `<tr><td>${esc(y.name)}</td><td>${y.han}翻</td></tr>`).join('')}</tbody></table>` +
      `<div class="groups">${groupsOfWin(q)}</div>` +
      `<p class="note-l">合計 ${sc.han}翻${sc.fu}符。</p>`;
  }
  if (q.type === 'score') return `<p>正解：<b>${q.answer}</b></p>` + scoreExplainHtml(q);
  if (q.type === 'danger') {
    const rows = q.rated.map(r =>
      `<tr${q.answers.indexOf(r.kind) >= 0 ? ' class="best"' : ''}><td>${tileSvgKind(r.kind, 'mini')}</td><td>${esc(r.reason)}</td></tr>`).join('');
    return `<p>正解：${q.answers.map(k => kindName(k)).join('・')}</p><table class="nk dg"><tbody>${rows}</tbody></table>`;
  }
  return '';
}

function drillRender() {
  const q = DRILL.q;
  const d = DRILLS.find(x => x.id === DRILL.type);
  const st = drillStats(DRILL.type);
  if (!q) {
    $app().innerHTML = `<header class="bar"><button class="back" data-act="menu">← もどる</button><b>${esc(d.title)}</b></header>` +
      `<p class="status">問題を作れませんでした。もう一度試してください。</p><section class="lnav"><button class="big wide" data-act="again">次の問題</button></section>`;
    return;
  }
  const needConfirm = q.type === 'wait' || q.type === 'yaku' || ((q.type === 'nanikiru' || q.type === 'danger') && APP.rules.tapMode === 'double');
  let bottom;
  if (DRILL.answered) {
    bottom = `<div class="feedback ${DRILL.right ? 'good' : 'bad'}"><b>${DRILL.right ? '正解！' : 'ざんねん'}</b>` +
      (DRILL.streak >= 2 && DRILL.right ? `<span class="streak">${DRILL.streak}問連続！</span>` : '') +
      drillExplainHtml() + `</div>` +
      `<section class="lnav"><button data-act="menu">ドリル一覧</button><button class="big" data-act="again">次の問題 →</button></section>`;
  } else {
    bottom = needConfirm
      ? `<section class="lnav"><button data-act="menu">ドリル一覧</button><button class="big" data-act="answer"${DRILL.picked.length ? '' : ' disabled'}>答える</button></section>`
      : `<section class="lnav"><button data-act="menu">ドリル一覧</button></section>`;
  }
  $app().innerHTML =
    `<header class="bar"><button class="back" data-act="menu">← もどる</button><b>${esc(d.title)}${DRILL.type === 'wait' ? (DRILL.hard ? '（1色）' : '（ふつう）') : ''}</b>` +
    `<span class="seed">${st.correct}／${st.tried}</span></header>` +
    `<section class="drill">${drillQuestionHtml()}</section>` + bottom;
}

function drillPickedValues() {
  const q = DRILL.q;
  if (q.type === 'nanikiru') return DRILL.picked.map(i => q.kinds[i]);
  if (q.type === 'danger') return DRILL.picked.map(i => q.hand[i]);
  return DRILL.picked;
}

function drillAnswer() {
  if (DRILL.answered || !DRILL.picked.length) return;
  DRILL.answered = true;
  DRILL.right = drillCheck(DRILL.q, drillPickedValues());
  DRILL.streak = DRILL.right ? DRILL.streak + 1 : 0;
  const st = drillStats(DRILL.type);
  st.tried++;
  if (DRILL.right) st.correct++;
  APP.save.drills[DRILL.type] = st;
  writeSave(APP.save);
  drillRender();
}

function drillAction(act, el) {
  if (act === 'menu') { drillOpen(); window.scrollTo(0, 0); return; }
  if (act === 'start') {
    DRILL.type = el.getAttribute('data-type');
    DRILL.hard = el.getAttribute('data-hard') === '1';
    DRILL.streak = 0;
    drillNew();
    return;
  }
  if (act === 'again') { drillNew(); return; }
  if (!DRILL.q || DRILL.answered) return;
  if (act === 'pick1') {
    const v = +el.getAttribute('data-v');
    const sameKind = DRILL.picked.length && (DRILL.q.kinds || DRILL.q.hand)[DRILL.picked[0]] === (DRILL.q.kinds || DRILL.q.hand)[v];
    if (APP.rules.tapMode === 'single' || sameKind) { DRILL.picked = [v]; drillAnswer(); return; }
    DRILL.picked = [v];
    drillRender();
    return;
  }
  if (act === 'pickv') { DRILL.picked = [el.getAttribute('data-v')]; drillAnswer(); return; }
  if (act === 'toggle') {
    let v = el.getAttribute('data-v');
    if (DRILL.q.type === 'wait') v = +v;
    const i = DRILL.picked.indexOf(v);
    if (i >= 0) DRILL.picked.splice(i, 1); else DRILL.picked.push(v);
    drillRender();
    return;
  }
  if (act === 'answer') drillAnswer();
}
