// 役図鑑・チャレンジ・成績のテスト

function bookScore(e) {
  const melds = [];
  const used = [];
  for (const [type, text] of e.melds || []) {
    const ids = IDS(text, used);
    used.push(...ids);
    melds.push({ type, ids });
  }
  const concealed = IDS(e.ex, used);
  return scoreHand(Object.assign({
    concealed, melds, winId: concealed[concealed.length - 1], tsumo: false,
    seatWind: 1, roundWind: 0, riichi: false, doubleRiichi: false, ippatsu: false,
    rinshan: false, chankan: false, haitei: false, houtei: false, tenhou: false, chiihou: false,
    doraInd: [], uraInd: [], rules: Object.assign({}, DEFAULT_RULES, { aka: 0 }),
  }, e.ctx || {}));
}

test('役図鑑: どの例の手も、その役で和了れる', () => {
  for (const e of YAKU_BOOK) {
    const sc = bookScore(e);
    ok(sc, e.name + ' の例が和了の形でない');
    const names = sc.yaku.map(y => yakuKey(y.name));
    ok(names.indexOf(e.name) >= 0, e.name + ' の例の役: ' + names.join(','));
    if (e.han < 13) {
      const y = sc.yaku.filter(x => yakuKey(x.name) === e.name);
      const menzen = !(e.melds || []).some(m => m[0] !== 'ankan');
      eq(y[0].han, menzen ? e.han : e.open, e.name + ' の翻');
    }
  }
});

test('役図鑑: scoreHand が出す役は全部のっている、名前は重ならない', () => {
  const book = new Set(YAKU_BOOK.map(e => e.name));
  eq(book.size, YAKU_BOOK.length);
  // yaku.js に出てくる役の名前を全部
  const all = ['立直', 'ダブル立直', '一発', '門前清自摸和', '断幺九', '嶺上開花', '槍槓', '海底摸月', '河底撈魚', '清一色', '混一色',
    '混老頭', '七対子', '平和', '二盃口', '一盃口', '役牌 白', '役牌 發', '役牌 中', '自風 東', '場風 南', '三色同順', '三色同刻', '一気通貫',
    '混全帯幺九', '純全帯幺九', '対々和', '三暗刻', '三槓子', '小三元', '天和', '地和', '国士無双', '字一色', '緑一色', '清老頭', '四暗刻',
    '大三元', '大四喜', '小四喜', '四槓子', '九蓮宝燈'];
  for (const n of all) ok(book.has(yakuKey(n)), n + ' が図鑑にない');
  eq(yakuHanText(YAKU_BOOK.find(e => e.name === '三色同順')), '2翻（鳴くと1翻）');
  eq(yakuHanText(YAKU_BOOK.find(e => e.name === '平和')), '1翻（鳴くとつかない）');
  eq(yakuHanText(YAKU_BOOK.find(e => e.name === '大三元')), '役満');
});

test('チャレンジ: id は重ならず、出来事で正しく達成する', () => {
  eq(new Set(MISSIONS.map(m => m.id)).size, MISSIONS.length);
  const sc = bookScore({ ex: '234m567p234s67s55p8s', ctx: { riichi: true, tsumo: true } });
  const ev = { kind: 'hand', win: true, tsumo: true, riichi: true, open: false, isOya: false, score: sc, yaku: sc.yaku.map(y => y.name), dora: 0, points: 5200 };
  const got = missionsNewlyDone(ev, []);
  for (const id of ['first_win', 'riichi_win', 'tanyao', 'tsumo', 'pinfu']) ok(got.indexOf(id) >= 0, id);
  ok(got.indexOf('mangan') < 0);
  ok(got.indexOf('top') < 0);
  eq(missionsNewlyDone(ev, got), [], '一度達成したものは出ない');
  const lose = { kind: 'hand', win: false, dealIn: true, tenpaiDraw: false, yaku: [], score: null };
  eq(missionsNewlyDone(lose, []), []);
  const m = { kind: 'match', rank: 1, length: 'hanchan', dealIns: 0, wins: 3, points: 40000 };
  eq(missionsNewlyDone(m, []).sort(), ['no_dealin', 'three_wins', 'top', 'top_hanchan'].sort());
});

test('成績: 局と対局の記録', () => {
  const rec = defaultRecords();
  const sc = bookScore({ ex: '234m567p234s67s55p8s', ctx: { riichi: true } });
  recordHand(rec, { win: true, tsumo: false, riichi: true, open: false, dealIn: false, score: sc, yaku: ['立直'], points: 3900 }, '2026-10-17');
  recordHand(rec, { win: false, riichi: false, open: true, dealIn: true }, '2026-10-17');
  eq([rec.hands, rec.wins, rec.dealIns, rec.riichi, rec.calls, rec.winPoints], [2, 1, 1, 1, 1, 3900]);
  eq(rec.best.points, 3900);
  for (let i = 0; i < 25; i++) recordMatch(rec, { rank: 1 + i % 4, points: 25000, length: 'tonpu' }, 'd' + i);
  eq(rec.recent.length, 20);
  eq(rec.recent[0].date, 'd24', '新しい順');
  eq(percent(1, 3), '33.3%');
  eq(percent(0, 0), '—');
});

test('対局の記録: 自動対局で handEvent・matchEvent が作れる', () => {
  const g = gameNew(61, Object.assign({}, DEFAULT_RULES, { length: 'tonpu' }));
  const rec = defaultRecords();
  const done = [];
  while (!g.over) {
    while (g.h.phase !== 'end') {
      if (gameStep(g)) continue;
      if (g.h.phase === 'discard') autoTurn(g, HUMAN);
      else gameCall(g, g.h.claims.human.ron ? 'ron' : 'pass');
    }
    const ev = handEvent(g);
    recordHand(rec, ev);
    done.push(...missionsNewlyDone(ev, done));
    if (ev.win) { ok(ev.points >= 1000); ok(ev.yaku.length > 0); }
    gameNextHand(g);
  }
  const me = matchEvent(g);
  ok(me.rank >= 1 && me.rank <= 4);
  eq(me.hands, g.history.length);
  eq(me.hands, rec.hands);
  done.push(...missionsNewlyDone(me, done));
  for (const id of done) ok(MISSIONS.some(m => m.id === id));
});

test('handValue: 本場・供託を除いた和了の点', () => {
  const b = basePoints(1, 30);
  eq(handValue({ base: b }, false, false), 1000);
  eq(handValue({ base: b }, false, true), 1100);
  eq(handValue({ base: b }, true, true), 1500);
});
