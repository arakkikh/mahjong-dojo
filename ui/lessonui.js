// 入門レッスンの画面
const LESSON = { id: null, page: 0, quiz: -1, picked: null, score: 0 };

// レッスンの文を HTML に。{123m} は牌、**太字**、改行。
function richText(text) {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\{([0-9mpsz]+)\}/g, (_, t) => `<span class="ltiles">${tilesHtml(t)}</span>`)
    .replace(/\n/g, '<br>');
}

// "123m0p" のような表記を牌の絵に（0 は赤ドラ）
function tilesHtml(text, cls) {
  const out = [];
  let nums = [];
  for (const ch of text) {
    if (ch >= '0' && ch <= '9') { nums.push(ch); continue; }
    for (const n of nums) out.push(tileSvg(n + ch, cls || 'lt'));
    nums = [];
  }
  return out.join('');
}

function lessonOpen() {
  LESSON.id = null;
  const done = APP.save.lessons;
  const items = LESSONS.map((l, i) => {
    const ok = done.indexOf(l.id) >= 0;
    return `<button class="mode lesson-item" data-act="open" data-id="${l.id}">` +
      `<span class="mode-icon lnum${ok ? ' ok' : ''}">${ok ? '✓' : i + 1}</span>` +
      `<span class="mode-body"><b>${esc(l.title)}</b><small>${l.pages.length}ページ・確認問題${l.quiz.length}問</small></span></button>`;
  }).join('');
  $app().innerHTML =
    `<header class="bar"><button class="back" data-go="home">← ホーム</button><b>入門レッスン</b>` +
    `<span class="seed">${done.filter(id => LESSONS.some(l => l.id === id)).length}／${LESSONS.length}</span></header>` +
    `<p class="guide">上から順番に読むのがおすすめです。最後に確認問題があります。</p>` +
    `<nav class="modes">${items}</nav>`;
}

function lessonCurrent() { return LESSONS.find(l => l.id === LESSON.id); }

function lessonRender() {
  const l = lessonCurrent();
  const total = l.pages.length + l.quiz.length;
  let body, step, buttons;
  if (LESSON.quiz < 0) {
    step = LESSON.page + 1;
    body = `<div class="lpage">${richText(l.pages[LESSON.page])}</div>`;
    buttons = (LESSON.page > 0 ? `<button data-act="prev">← もどる</button>` : `<button data-act="list">一覧へ</button>`) +
      `<button class="big" data-act="next">${LESSON.page === l.pages.length - 1 ? '確認問題へ →' : '次へ →'}</button>`;
  } else {
    const q = l.quiz[LESSON.quiz];
    step = l.pages.length + LESSON.quiz + 1;
    const answered = LESSON.picked != null;
    const opts = q.options.map((o, i) => {
      let cls = 'qopt';
      if (answered && i === q.answer) cls += ' right';
      else if (answered && i === LESSON.picked) cls += ' wrong';
      return `<button class="${cls}" data-act="pick" data-i="${i}"${answered ? ' disabled' : ''}>${esc(o)}</button>`;
    }).join('');
    const fb = answered
      ? `<div class="feedback ${LESSON.picked === q.answer ? 'good' : 'bad'}"><b>${LESSON.picked === q.answer ? '正解！' : 'ざんねん'}</b><p>${richText(q.explain)}</p></div>`
      : '';
    body = `<div class="lpage"><p class="qtitle">確認問題 ${LESSON.quiz + 1}</p><p>${esc(q.q)}</p>` +
      (q.tiles ? `<div class="qtiles">${tilesHtml(q.tiles, 'dt')}</div>` : '') +
      `<div class="qopts">${opts}</div>${fb}</div>`;
    buttons = answered
      ? `<button class="big wide" data-act="qnext">${LESSON.quiz === l.quiz.length - 1 ? '結果を見る' : '次の問題 →'}</button>`
      : '';
  }
  $app().innerHTML =
    `<header class="bar"><button class="back" data-act="list">← 一覧</button><b>${esc(l.title)}</b>` +
    `<span class="seed">${step}／${total}</span></header>` +
    `<div class="progress"><span style="width:${Math.round(step / total * 100)}%"></span></div>` +
    body + `<section class="lnav">${buttons}</section>`;
}

function lessonFinish() {
  const l = lessonCurrent();
  if (APP.save.lessons.indexOf(l.id) < 0) APP.save.lessons.push(l.id);
  writeSave(APP.save);
  const idx = LESSONS.indexOf(l);
  const next = LESSONS[idx + 1];
  showOverlay(`<h2>レッスン完了！</h2><p>「${esc(l.title)}」の確認問題 ${l.quiz.length}問中 <b>${LESSON.score}問</b> 正解。</p>` +
    (LESSON.score < l.quiz.length ? '<p class="note">まちがえたところは、もう一度読み直してみよう。</p>' : '') +
    `<div class="ov-actions">` +
    (next ? `<button class="big" data-act="open" data-id="${next.id}">次のレッスン「${esc(next.title)}」へ</button>` : '') +
    `<button data-act="list">一覧へ</button>` +
    (LESSON.score < l.quiz.length ? `<button data-act="open" data-id="${l.id}">もう一度読む</button>` : '') +
    `</div>`);
}

function lessonAction(act, el) {
  if (act === 'list') { hideOverlay(); lessonOpen(); window.scrollTo(0, 0); return; }
  if (act === 'open') {
    hideOverlay();
    Object.assign(LESSON, { id: el.getAttribute('data-id'), page: 0, quiz: -1, picked: null, score: 0 });
    lessonRender();
    window.scrollTo(0, 0);
    return;
  }
  const l = lessonCurrent();
  if (!l) return;
  if (act === 'prev') { LESSON.page = Math.max(0, LESSON.page - 1); lessonRender(); return; }
  if (act === 'next') {
    if (LESSON.page < l.pages.length - 1) LESSON.page++;
    else { LESSON.quiz = 0; LESSON.picked = null; }
    lessonRender();
    return;
  }
  if (act === 'pick') {
    if (LESSON.picked != null) return;
    LESSON.picked = +el.getAttribute('data-i');
    if (LESSON.picked === l.quiz[LESSON.quiz].answer) LESSON.score++;
    lessonRender();
    return;
  }
  if (act === 'qnext') {
    if (LESSON.quiz < l.quiz.length - 1) { LESSON.quiz++; LESSON.picked = null; lessonRender(); }
    else lessonFinish();
  }
}
