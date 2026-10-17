// 設定の画面：ルールと遊びやすさ
const SETTING_ITEMS = [
  { key: 'kuitan', label: '喰いタン', text: '鳴いた手でもタンヤオをつける', values: [[true, 'あり'], [false, 'なし']] },
  { key: 'aka', label: '赤ドラ', text: '赤い5（各色1枚）をドラにする', values: [[3, 'あり（3枚）'], [0, 'なし']] },
  { key: 'abortiveDraws', label: '途中流局', text: '九種九牌・四風連打・四家立直・四槓散了', values: [[true, 'あり'], [false, 'なし']] },
  { key: 'nagashi', label: '流し満貫', text: '捨て牌が全部1・9・字牌なら満貫', values: [[true, 'あり'], [false, 'なし']] },
  { key: 'doubleWindPair', label: '連風牌の雀頭', text: '自風と場風が同じ牌の雀頭の符', values: [[2, '2符'], [4, '4符']] },
  { key: 'kiriage', label: '切り上げ満貫', text: '4翻30符・3翻60符を満貫にする', values: [[false, 'なし'], [true, 'あり']] },
  { key: 'tobi', label: 'トビ終了', text: '誰かが0点未満になったら対局を終える', values: [[true, 'あり'], [false, 'なし']] },
  { key: 'tapMode', label: '牌の捨て方', text: '1回目で浮かせて2回目で捨てる／1回で捨てる', values: [['double', '2回タップ'], ['single', '1回タップ']] },
];
const SPEED_VALUES = [['slow', 'ゆっくり'], ['normal', 'ふつう'], ['fast', 'はやい']];

function settingsOpen() {
  const r = APP.save.rules;
  const seg = (key, values, cur) => `<div class="seg">` + values.map(([v, label]) =>
    `<button class="${v === cur ? 'on' : ''}" data-act="set" data-k="${key}" data-v="${esc(JSON.stringify(v))}">${esc(label)}</button>`).join('') + `</div>`;
  const items = SETTING_ITEMS.map(it =>
    `<div class="sitem"><div><b>${esc(it.label)}</b><small>${esc(it.text)}</small></div>${seg(it.key, it.values, r[it.key])}</div>`).join('');
  $app().innerHTML =
    `<header class="bar"><button class="back" data-go="home">← ホーム</button><b>設定</b></header>` +
    `<h3 class="sec">遊びやすさ</h3>` +
    `<div class="sitem"><div><b>CPU の速さ</b><small>CPU が牌を捨てるまでの間</small></div>${seg('speed', SPEED_VALUES, APP.save.settings.speed)}</div>` +
    `<div class="sitem"><div><b>シャンテン数・待ちの表示</b><small>1人打ち・対局で表示する</small></div>${seg('showShanten', [[true, '表示'], [false, '隠す']], APP.save.settings.showShanten)}</div>` +
    `<h3 class="sec">ルール</h3><p class="guide">ルールの変更は、次に始める対局から使われます。</p>${items}` +
    `<div class="lnav"><button data-act="reset-rules">ルールを最初に戻す</button></div>` +
    `<h3 class="sec">記録</h3>` +
    `<div class="lnav"><button class="danger" data-act="reset-records">成績・役図鑑・チャレンジを消す</button></div>`;
}

function settingsAction(act, el) {
  if (act === 'set') {
    const k = el.getAttribute('data-k');
    const v = JSON.parse(el.getAttribute('data-v'));
    if (k === 'speed' || k === 'showShanten') APP.save.settings[k] = v;
    else {
      APP.save.rules = normalizeRules(Object.assign({}, APP.save.rules, { [k]: v }));
      APP.rules = APP.save.rules;
    }
    writeSave(APP.save);
    settingsOpen();
    return;
  }
  if (act === 'reset-rules') {
    APP.save.rules = Object.assign({}, DEFAULT_RULES);
    APP.rules = APP.save.rules;
    writeSave(APP.save);
    settingsOpen();
    return;
  }
  if (act === 'reset-records') {
    showOverlay(`<h2>記録を消しますか？</h2><p>4人対局の成績、役図鑑、チャレンジの達成を消します。元に戻せません。<br>（レッスン・ドリル・1人打ちの記録は残ります）</p>` +
      `<div class="ov-actions"><button class="big danger" data-act="reset-yes">消す</button><button data-act="reset-no">やめる</button></div>`);
    return;
  }
  if (act === 'reset-yes') {
    APP.save.records = defaultRecords();
    APP.save.yakuSeen = {};
    APP.save.missions = [];
    APP.save.game = { played: 0, ranks: [0, 0, 0, 0] };
    writeSave(APP.save);
    hideOverlay();
    settingsOpen();
    return;
  }
  if (act === 'reset-no') hideOverlay();
}
