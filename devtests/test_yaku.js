// 役と点数のテスト

// 和了の手を作って点数を出す。hand は和了牌を含む手の中の牌（最後の1枚が和了牌）。
// melds は [['pon', '555z'], ['chi', '234s'], ['ankan', '1111m']] のように書く。
function score(hand, opt) {
  opt = opt || {};
  const melds = [];
  const used = [];
  for (const [type, text] of opt.melds || []) {
    const ids = IDS(text, used);
    used.push(...ids);
    melds.push({ type, ids });
  }
  const concealed = IDS(hand, used);
  used.push(...concealed);
  const ctx = Object.assign({
    concealed, melds, winId: concealed[concealed.length - 1], tsumo: false,
    seatWind: 1, roundWind: 0, riichi: false, doubleRiichi: false, ippatsu: false,
    rinshan: false, chankan: false, haitei: false, houtei: false, tenhou: false, chiihou: false,
    doraInd: [], uraInd: [], rules: DEFAULT_RULES,
  }, opt.ctx || {});
  if (opt.dora) ctx.doraInd = IDS(opt.dora, used);
  if (opt.ura) ctx.uraInd = IDS(opt.ura, used.concat(ctx.doraInd));
  return scoreHand(ctx);
}
function names(sc) { return sc.yaku.map(y => y.name); }
function ronKo(sc) { return handPayment(sc.base, false, false).ron; }
function ronOya(sc) { return handPayment(sc.base, true, false).ron; }

test('立直・門前ツモ・平和・断幺九：4翻20符 = 子のツモ 1300/2600', () => {
  const sc = score('234m567p234s67s55p8s', { ctx: { tsumo: true, riichi: true } });
  eq(names(sc).sort(), ['平和', '断幺九', '立直', '門前清自摸和'].sort());
  eq([sc.han, sc.fu], [4, 20]);
  eq(handPayment(sc.base, false, true), { oya: 2600, ko: 1300 });
});

test('鳴いたタンヤオのロン：1翻30符 = 1000点', () => {
  const sc = score('234m567p55p67s8s', { melds: [['chi', '234s']] });
  eq(names(sc), ['断幺九']);
  eq([sc.han, sc.fu], [1, 30]);
  eq(ronKo(sc), 1000);
});

test('喰いタンなしのルールでは鳴いたタンヤオは役にならない', () => {
  const sc = score('234m567p55p67s8s', { melds: [['chi', '234s']], ctx: { rules: Object.assign({}, DEFAULT_RULES, { kuitan: false }) } });
  eq(sc, null);
});

test('役がなければ和了れない', () => {
  eq(score('123m456p99m78s9s', { melds: [['chi', '234s']] }), null);
  eq(score('123m456p789s11z23m4m'), null, '門前ロンで役なし（東は場風だが雀頭）');
});

test('役牌 中のポン・嵌張：1翻30符', () => {
  const sc = score('234m567p11p46s5s', { melds: [['pon', '777z']] });
  eq(names(sc), ['役牌 中']);
  eq([sc.han, sc.fu], [1, 30]);
  eq(ronKo(sc), 1000);
});

test('七対子は25符', () => {
  const sc = score('1133m55p77s22z44z6z6z');
  eq(names(sc), ['七対子']);
  eq([sc.han, sc.fu], [2, 25]);
  eq(ronKo(sc), 1600);
  const r = score('1133m55p77s22z44z6z6z', { ctx: { riichi: true } });
  eq(ronKo(r), 3200);
});

test('混一色・一気通貫・役牌 中：6翻 = 跳満 12000点', () => {
  // 手は 123456789m 777z 11z で 9m 和了り（78m の両面待ち）
  const sc = score('12345678m777z11z9m');
  eq(names(sc).sort(), ['一気通貫', '役牌 中', '混一色'].sort());
  eq(sc.han, 6);
  eq(sc.limit, '跳満');
  eq(ronKo(sc), 12000);
  eq(ronOya(sc), 18000);
});

test('国士無双：役満 子32000点・親48000点', () => {
  const sc = score('19m19p19s1234567z1m');
  eq(names(sc), ['国士無双']);
  eq(sc.yakuman, 1);
  eq(ronKo(sc), 32000);
  eq(ronOya(sc), 48000);
});

test('四暗刻：ツモなら役満、シャンポンのロンなら対々和＋三暗刻', () => {
  const t = score('111m222p333s44z55z4z', { ctx: { tsumo: true } });
  ok(names(t).indexOf('四暗刻') >= 0);
  eq(handPayment(t.base, false, true), { oya: 16000, ko: 8000 });
  const r = score('111m222p333s44z55z4z');
  eq(names(r).sort(), ['三暗刻', '対々和'].sort());
  // 符: 20 + 門前ロン10 + 111m暗刻8 + 222p暗刻4 + 333s暗刻4 + 444z明刻4 + 白の雀頭2 = 52 → 60
  eq([r.han, r.fu], [4, 60]);
  eq(ronKo(r), 8000, '4翻60符は満貫');
});

test('四暗刻単騎はロンでも役満', () => {
  const sc = score('111m222p333s444z5z5z');
  ok(names(sc).indexOf('四暗刻') >= 0);
});

test('大三元・字一色・緑一色・清老頭・九蓮宝燈・大四喜', () => {
  ok(names(score('555z666z777z11m23m4m')).indexOf('大三元') >= 0);
  ok(names(score('111z222z333z55z66z6z')).indexOf('字一色') >= 0);
  ok(names(score('234s234s666s88s66z6z')).indexOf('緑一色') >= 0);
  ok(names(score('111m999m111p99p99s9p')).indexOf('清老頭') >= 0);
  ok(names(score('1112345678999m5m')).indexOf('九蓮宝燈') >= 0);
  ok(names(score('111z222z333z44z55m4z')).indexOf('大四喜') >= 0);
});

test('天和・地和', () => {
  ok(names(score('123m456p789s11z22z2z', { ctx: { tsumo: true, tenhou: true } })).indexOf('天和') >= 0);
  ok(names(score('123m456p789s11z22z2z', { ctx: { tsumo: true, chiihou: true } })).indexOf('地和') >= 0);
});

test('三色同順（鳴くと1翻下がる）・一盃口・二盃口', () => {
  const m = score('123m123p789m55s12s3s', { melds: [] });
  ok(names(m).indexOf('三色同順') >= 0);
  eq(m.yaku.find(y => y.name === '三色同順').han, 2);
  const o = score('123p789m55s12s3s', { melds: [['chi', '123m']] });
  eq(o.yaku.find(y => y.name === '三色同順').han, 1);
  const i = score('112233m456p789s5s5s');
  ok(names(i).indexOf('一盃口') >= 0);
  const r = score('112233m445566p7s7s');
  ok(names(r).indexOf('二盃口') >= 0);
  ok(names(r).indexOf('一盃口') < 0);
  ok(names(r).indexOf('七対子') < 0, '二盃口の方が高い');
});

test('混全帯幺九・純全帯幺九・混老頭・対々和', () => {
  ok(names(score('123m789p789s11z99m9m')).indexOf('混全帯幺九') >= 0);
  ok(names(score('123m789p789s11s99m9m')).indexOf('純全帯幺九') >= 0);
  const h = score('111m999p111z22z99s9s');
  ok(names(h).indexOf('混老頭') >= 0);
  ok(names(h).indexOf('対々和') >= 0);
  ok(names(h).indexOf('混全帯幺九') < 0);
});

test('小三元・三色同刻・三槓子', () => {
  ok(names(score('555z666z77z123m45p6p')).indexOf('小三元') >= 0);
  ok(names(score('222m222p222s345m6s6s')).indexOf('三色同刻') >= 0);
  const k = score('345m7s7s', { melds: [['ankan', '2222m'], ['minkan', '4444p'], ['minkan', '6666s']] });
  ok(names(k).indexOf('三槓子') >= 0);
});

test('清一色（門前6翻・鳴き5翻）', () => {
  const sc = score('1233455677892m2m');
  eq(sc.yaku.find(y => y.name === '清一色').han, 6);
  const o = score('11234567m99m9m', { melds: [['chi', '789m']] });
  eq(o.yaku.find(y => y.name === '清一色').han, 5);
});

test('一発・嶺上開花・槍槓・海底摸月・河底撈魚・ダブル立直', () => {
  ok(names(score('234m567p234s67s55p8s', { ctx: { riichi: true, ippatsu: true } })).indexOf('一発') >= 0);
  ok(names(score('234m567p234s67s55p8s', { ctx: { tsumo: true, rinshan: true } })).indexOf('嶺上開花') >= 0);
  ok(names(score('234m567p234s67s55p8s', { ctx: { chankan: true } })).indexOf('槍槓') >= 0);
  ok(names(score('234m567p234s67s55p8s', { ctx: { tsumo: true, haitei: true } })).indexOf('海底摸月') >= 0);
  ok(names(score('234m567p234s67s55p8s', { ctx: { houtei: true } })).indexOf('河底撈魚') >= 0);
  const d = score('234m567p234s67s55p8s', { ctx: { riichi: true, doubleRiichi: true } });
  ok(names(d).indexOf('ダブル立直') >= 0 && names(d).indexOf('立直') < 0);
});

test('ドラ・赤ドラ・裏ドラ（役がないとドラだけでは和了れない）', () => {
  const sc = score('234m067p234s67s55p8s', { dora: '4p', ctx: { riichi: true }, ura: '1s' });
  // ドラ表示4p → ドラ5p（2枚: 赤5pと55pのうち…）
  eq(sc.aka, 1);
  eq(sc.dora, 3, '5p が3枚');
  eq(sc.ura, 1, '裏ドラ表示1s → 2s が1枚');
  eq(score('123m456p99m78s9s', { melds: [['chi', '234s']], dora: '8m' }), null);
});

test('符：暗槓・明刻・単騎・連風牌の雀頭', () => {
  // 東場の東家：東の雀頭は連風牌。ルール 2符 / 4符
  const base = { melds: [['ankan', '1111m']], ctx: { seatWind: 0, roundWind: 0, riichi: true } };
  const a = score('234p567s888s1z1z', base);
  // 20 + 門前ロン10 + 暗槓(1m)32 + 暗刻888s 4 + 東東の雀頭2 + 単騎2 = 70
  eq(a.fu, 70);
  const b = score('234p567s888s1z1z', Object.assign({}, base, { ctx: Object.assign({}, base.ctx, { rules: Object.assign({}, DEFAULT_RULES, { doubleWindPair: 4 }) }) }));
  eq(b.fu, 80);
});

test('切り上げ満貫（4翻30符）', () => {
  const sc = score('234m567p234s67s55p8s', { ctx: { riichi: true, ippatsu: true } });
  // 立直・一発・平和・断幺九 = 4翻30符
  eq([sc.han, sc.fu], [4, 30]);
  eq(ronKo(sc), 7700);
  const k = score('234m567p234s67s55p8s', { ctx: { riichi: true, ippatsu: true, rules: Object.assign({}, DEFAULT_RULES, { kiriage: true }) } });
  eq(ronKo(k), 8000);
});

test('高い方の見方を選ぶ（両面と嵌張のどちらにも取れるとき）', () => {
  // 3m 和了り：123m の辺張と見ると役なし、345m の両面と見ると平和
  const sc = score('12345m678p456s22s3m');
  eq(names(sc), ['平和']);
  eq(sc.wait, 'ryanmen');
  eq(sc.fu, 30);
});

test('点数の表', () => {
  eq(basePoints(1, 30), 240);
  eq(ceil100(240 * 4), 1000);
  eq(basePoints(3, 30) * 4, 3840);
  eq(basePoints(5, 30), 2000);
  eq(basePoints(6, 30), 3000);
  eq(basePoints(8, 30), 4000);
  eq(basePoints(11, 30), 6000);
  eq(basePoints(13, 30), 8000);
  eq(handPayment(basePoints(2, 30), true, true), { oya: 0, ko: 1000 });
  eq(handPayment(basePoints(3, 40), false, true), { oya: 2600, ko: 1300 });
});
