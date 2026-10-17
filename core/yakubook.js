// 役図鑑の中身。name は scoreHand が返す役の名前（役牌は yakuKey でまとめた「役牌」）。
// ex: 例の手（14枚。最後の1枚が和了牌）、ctx: 例の状況（scoreHand の ctx に足す）、melds: 例の鳴き
// han: 門前の翻、open: 鳴いたときの翻（null は鳴くとつかない）
const YAKU_BOOK = [
  // 1翻
  { name: '立直', yomi: 'リーチ', han: 1, open: null, text: '鳴かずに聴牌したら宣言できる。1000点を出す。役がない手でも和了れるようになる。', ex: '234m567p234s67s55p8s', ctx: { riichi: true } },
  { name: '一発', yomi: 'イッパツ', han: 1, open: null, text: 'リーチしてから1巡以内（自分の次の打牌まで）に和了る。途中で誰かが鳴くと消える。', ex: '234m567p234s67s55p8s', ctx: { riichi: true, ippatsu: true } },
  { name: '門前清自摸和', yomi: 'メンゼンツモ', han: 1, open: null, text: '鳴かずに、自分で引いた牌で和了る。', ex: '234m567p234s67s55p8s', ctx: { tsumo: true } },
  { name: '断幺九', yomi: 'タンヤオ', han: 1, open: 1, text: '2〜8の牌だけで作る。鳴いてもよい（喰いタン）。', ex: '234m567p234s67s55p8s' },
  { name: '平和', yomi: 'ピンフ', han: 1, open: null, text: '面子が全部順子、雀頭が役牌でない、両面待ち。符がつかない形。', ex: '123m456p789s23s55p4s' },
  { name: '一盃口', yomi: 'イーペーコー', han: 1, open: null, text: '同じ順子を2つ作る（例：223344萬）。', ex: '223344m456p789s5s5s' },
  { name: '役牌', yomi: 'ヤクハイ', han: 1, open: 1, text: '白・發・中の刻子。自分の風（自風）と場の風（場風）の刻子も1翻ずつ。', ex: '234m567p23s88s555z4s' },
  { name: '嶺上開花', yomi: 'リンシャンカイホウ', han: 1, open: 1, text: 'カンした後に引く嶺上牌で和了る。', ex: '234m567p234s67s55p8s', ctx: { tsumo: true, rinshan: true } },
  { name: '槍槓', yomi: 'チャンカン', han: 1, open: 1, text: '他の人が加槓した牌でロンする。', ex: '234m567p234s67s55p8s', ctx: { chankan: true } },
  { name: '海底摸月', yomi: 'ハイテイモーユエ', han: 1, open: 1, text: '山の最後の牌をツモって和了る。', ex: '234m567p234s67s55p8s', ctx: { tsumo: true, haitei: true } },
  { name: '河底撈魚', yomi: 'ホウテイラオユイ', han: 1, open: 1, text: '最後の捨て牌でロンする。', ex: '234m567p234s67s55p8s', ctx: { houtei: true } },
  // 2翻
  { name: 'ダブル立直', yomi: 'ダブルリーチ', han: 2, open: null, text: '最初の打牌でリーチする（それまでに誰も鳴いていないとき）。', ex: '234m567p234s67s55p8s', ctx: { riichi: true, doubleRiichi: true } },
  { name: '七対子', yomi: 'チートイツ', han: 2, open: null, text: '対子を7つ。符は25符ちょうど。同じ牌4枚は2つの対子にできない。', ex: '1133m55p77s22z44z6z6z' },
  { name: '三色同順', yomi: 'サンショクドウジュン', han: 2, open: 1, text: '萬子・筒子・索子で同じ数字の順子（例：123萬・123筒・123索）。', ex: '123m123p789m55s12s3s' },
  { name: '一気通貫', yomi: 'イッキツウカン', han: 2, open: 1, text: '1つの色で 123・456・789 を作る。', ex: '12345678m777z11z9m' },
  { name: '混全帯幺九', yomi: 'チャンタ', han: 2, open: 1, text: 'すべての面子と雀頭に1・9・字牌が入っている（字牌を含む）。', ex: '123m789p789s11z99m9m' },
  { name: '対々和', yomi: 'トイトイ', han: 2, open: 2, text: '面子が全部刻子（または槓子）。', ex: '111m999p111z22z99s9s' },
  { name: '三暗刻', yomi: 'サンアンコウ', han: 2, open: 2, text: '鳴かずに作った刻子（暗刻）が3つ。ロンで完成した刻子は数えない。', ex: '111m222p333s456s7z7z' },
  { name: '三色同刻', yomi: 'サンショクドウコウ', han: 2, open: 2, text: '萬子・筒子・索子で同じ数字の刻子。', ex: '222m222p222s345m6s6s' },
  { name: '三槓子', yomi: 'サンカンツ', han: 2, open: 2, text: 'カンを3回する。', ex: '345m7s7s', melds: [['ankan', '2222m'], ['minkan', '4444p'], ['minkan', '6666s']] },
  { name: '混老頭', yomi: 'ホンロウトウ', han: 2, open: 2, text: '1・9・字牌だけで作る（対々和か七対子と一緒につく）。', ex: '111m999p111z22z99s9s' },
  { name: '小三元', yomi: 'ショウサンゲン', han: 2, open: 2, text: '白・發・中のうち2つが刻子、残り1つが雀頭。役牌2つもつくので実質4翻。', ex: '555z666z77z123m45p6p' },
  // 3翻以上
  { name: '混一色', yomi: 'ホンイツ', han: 3, open: 2, text: '1つの色の数牌と字牌だけで作る。', ex: '12345678m777z11z9m' },
  { name: '純全帯幺九', yomi: 'ジュンチャン', han: 3, open: 2, text: 'すべての面子と雀頭に1か9が入っている（字牌なし）。', ex: '123m789p789s11s99m9m' },
  { name: '二盃口', yomi: 'リャンペーコー', han: 3, open: null, text: '一盃口を2つ作る。', ex: '112233m445566p7s7s' },
  { name: '清一色', yomi: 'チンイツ', han: 6, open: 5, text: '1つの色の数牌だけで作る。', ex: '1233455677892m2m' },
  // 役満
  { name: '国士無双', yomi: 'コクシムソウ', han: 13, open: null, text: '1・9・字牌13種を全部と、どれか1つをもう1枚。', ex: '19m19p19s1234567z1m' },
  { name: '四暗刻', yomi: 'スーアンコウ', han: 13, open: null, text: '鳴かずに刻子を4つ。ロンで和了るときは単騎待ちだけ。', ex: '111m222p333s44z55z4z', ctx: { tsumo: true } },
  { name: '大三元', yomi: 'ダイサンゲン', han: 13, open: 13, text: '白・發・中を3つとも刻子にする。', ex: '555z666z777z11m23m4m' },
  { name: '字一色', yomi: 'ツーイーソー', han: 13, open: 13, text: '字牌だけで作る。', ex: '111z222z333z55z66z6z' },
  { name: '緑一色', yomi: 'リューイーソー', han: 13, open: 13, text: '緑の牌（2・3・4・6・8索と發）だけで作る。', ex: '234s234s666s88s66z6z' },
  { name: '清老頭', yomi: 'チンロウトウ', han: 13, open: 13, text: '1と9の牌だけで作る。', ex: '111m999m111p99p99s9p' },
  { name: '小四喜', yomi: 'ショウスーシー', han: 13, open: 13, text: '東・南・西・北のうち3つが刻子、残り1つが雀頭。', ex: '111z222z333z44z12m3m' },
  { name: '大四喜', yomi: 'ダイスーシー', han: 13, open: 13, text: '東・南・西・北を4つとも刻子にする。', ex: '111z222z333z444z5m5m' },
  { name: '四槓子', yomi: 'スーカンツ', han: 13, open: 13, text: 'カンを4回する。', ex: '7s7s', melds: [['ankan', '2222m'], ['minkan', '4444p'], ['minkan', '6666s'], ['minkan', '9999m']] },
  { name: '九蓮宝燈', yomi: 'チューレンポウトウ', han: 13, open: null, text: '1つの色で 1112345678999 ＋どれか1枚。', ex: '1112345678999m5m' },
  { name: '天和', yomi: 'テンホウ', han: 13, open: null, text: '親が配牌（最初のツモ）で和了っている。', ex: '123m456p789s11122z', ctx: { tsumo: true, tenhou: true } },
  { name: '地和', yomi: 'チーホウ', han: 13, open: null, text: '子が最初のツモで和了る（それまでに誰も鳴いていないとき）。', ex: '123m456p789s11122z', ctx: { tsumo: true, chiihou: true } },
];

// 翻の書き方
function yakuHanText(e) {
  if (e.han >= 13) return '役満';
  const base = `${e.han}翻`;
  if (e.open === null) return base + '（鳴くとつかない）';
  if (e.open !== e.han) return base + `（鳴くと${e.open}翻）`;
  return base;
}
