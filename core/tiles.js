// 牌の定義。
// 牌そのもの（136枚の1枚1枚）は 0〜135 の番号（id）で持つ。種類（kind）は id を4で割った 0〜33。
//   kind 0〜8 = 1〜9萬（m）、9〜17 = 1〜9筒（p）、18〜26 = 1〜9索（s）、27〜33 = 東南西北白發中（z）
// 文字の表記は "1m" "5p" "7z" など。赤ドラの5は "0m" "0p" "0s" と書く。
const SUITS = ['m', 'p', 's', 'z'];
const SUIT_NAME = { m: '萬子', p: '筒子', s: '索子', z: '字牌' };
const HONOR_NAME = ['東', '南', '西', '北', '白', '發', '中'];
const KANJI_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const KIND_COUNT = 34;
const TILE_COUNT = 136;
// 赤ドラにする牌の id（各5の1枚目）。5萬=kind4、5筒=kind13、5索=kind22
const RED_IDS = [16, 52, 88];

function kindOf(id) { return id >> 2; }
function suitOf(kind) { return SUITS[Math.floor(kind / 9)]; }
function numOf(kind) { return kind < 27 ? kind % 9 + 1 : kind - 26; }
function isHonor(kind) { return kind >= 27; }
function isTerminal(kind) { return kind < 27 && (kind % 9 === 0 || kind % 9 === 8); }
function isYaochu(kind) { return isHonor(kind) || isTerminal(kind); }
function isRedId(id, rules) {
  const n = rules && rules.aka != null ? rules.aka : 3;
  return n > 0 && RED_IDS.indexOf(id) >= 0;
}

function kindCode(kind) { return numOf(kind) + suitOf(kind); }
function tileCode(id, rules) {
  const k = kindOf(id);
  return isRedId(id, rules) ? '0' + suitOf(k) : kindCode(k);
}

// 日本語名。例: 一萬、五筒、東
function kindName(kind) {
  if (isHonor(kind)) return HONOR_NAME[kind - 27];
  const n = numOf(kind);
  const s = suitOf(kind);
  if (s === 'm') return KANJI_NUM[n - 1] + '萬';
  if (s === 'p') return KANJI_NUM[n - 1] + '筒';
  return KANJI_NUM[n - 1] + '索';
}
function tileName(id, rules) {
  return (isRedId(id, rules) ? '赤' : '') + kindName(kindOf(id));
}

// "123m456p77z" → kind の配列。"0" は 5 として読む。
function parseKinds(text) {
  const out = [];
  let nums = [];
  for (const ch of text.replace(/\s+/g, '')) {
    if (ch >= '0' && ch <= '9') { nums.push(ch === '0' ? 5 : +ch); continue; }
    const si = SUITS.indexOf(ch);
    if (si < 0) throw new Error('牌の表記が読めません: ' + text);
    for (const n of nums) {
      if (n < 1 || (si === 3 && n > 7)) throw new Error('牌の表記が読めません: ' + text);
      out.push(si * 9 + n - 1);
    }
    nums = [];
  }
  if (nums.length) throw new Error('牌の表記が読めません: ' + text);
  return out;
}

function kindOfCode(code) { return parseKinds(code)[0]; }

function countsOf(kinds) {
  const c = new Array(KIND_COUNT).fill(0);
  for (const k of kinds) c[k]++;
  return c;
}
function countsOfIds(ids) { return countsOf(ids.map(kindOf)); }
function countsFrom(text) { return countsOf(parseKinds(text)); }
function countsTotal(c) { let n = 0; for (const x of c) n += x; return n; }

// kind の並びを "123m456p77z" の形に戻す（表示とテスト用）
function kindsText(kinds) {
  const sorted = kinds.slice().sort((a, b) => a - b);
  let out = '';
  let cur = '';
  let nums = '';
  for (const k of sorted) {
    const s = suitOf(k);
    if (s !== cur && nums) { out += nums + cur; nums = ''; }
    cur = s;
    nums += numOf(k);
  }
  if (nums) out += nums + cur;
  return out;
}

// 理牌（並べ替え）。種類順、同じ種類なら赤を先に。
function sortIds(ids) {
  return ids.slice().sort((a, b) => (kindOf(a) - kindOf(b)) || (a - b));
}

function allTileIds() {
  const a = [];
  for (let i = 0; i < TILE_COUNT; i++) a.push(i);
  return a;
}

// ドラ表示牌 → ドラの種類。9の次は1、北の次は東、中の次は白。
function doraFromIndicator(kind) {
  if (kind < 27) return Math.floor(kind / 9) * 9 + (kind % 9 + 1) % 9;
  if (kind <= 30) return 27 + (kind - 27 + 1) % 4;
  return 31 + (kind - 31 + 1) % 3;
}
