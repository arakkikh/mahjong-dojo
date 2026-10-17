// 牌の絵（SVG）。起動時に34種＋赤3枚＋裏面を <symbol> として1回だけ作り、<use> で使い回す。
// 絵の座標は 幅60 × 高さ80。
const TILE_COLORS = { blue: '#1f4fa3', green: '#1d7a43', red: '#c62828', ink: '#1b1b1b' };

function pinDot(cx, cy, r, color) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${(r * 0.3).toFixed(2)}"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${(r * 0.42).toFixed(2)}" fill="${color}"/>`;
}

// 筒子の丸の位置と色（b=青 g=緑 r=赤）
const PIN_LAYOUT = {
  2: [[30, 24, 10, 'g'], [30, 56, 10, 'b']],
  3: [[16, 18, 8.5, 'b'], [30, 40, 8.5, 'r'], [44, 62, 8.5, 'g']],
  4: [[18, 24, 9, 'b'], [42, 24, 9, 'g'], [18, 56, 9, 'g'], [42, 56, 9, 'b']],
  5: [[16, 18, 8, 'b'], [44, 18, 8, 'g'], [30, 40, 8, 'r'], [16, 62, 8, 'g'], [44, 62, 8, 'b']],
  6: [[19, 16, 7.5, 'g'], [41, 16, 7.5, 'g'], [19, 44, 7.5, 'r'], [41, 44, 7.5, 'r'], [19, 64, 7.5, 'r'], [41, 64, 7.5, 'r']],
  7: [[14, 12, 6.5, 'g'], [30, 20, 6.5, 'g'], [46, 28, 6.5, 'g'], [19, 47, 7, 'r'], [41, 47, 7, 'r'], [19, 66, 7, 'r'], [41, 66, 7, 'r']],
  8: [[19, 13, 7, 'b'], [41, 13, 7, 'b'], [19, 31, 7, 'b'], [41, 31, 7, 'b'], [19, 49, 7, 'b'], [41, 49, 7, 'b'], [19, 67, 7, 'b'], [41, 67, 7, 'b']],
  9: [[15, 16, 7, 'b'], [30, 16, 7, 'b'], [45, 16, 7, 'b'], [15, 40, 7, 'r'], [30, 40, 7, 'r'], [45, 40, 7, 'r'], [15, 64, 7, 'g'], [30, 64, 7, 'g'], [45, 64, 7, 'g']],
};
const COLOR_OF = { b: TILE_COLORS.blue, g: TILE_COLORS.green, r: TILE_COLORS.red };

function pinFace(n, red) {
  if (n === 1) {
    return `<circle cx="30" cy="40" r="20" fill="none" stroke="${TILE_COLORS.green}" stroke-width="3"/>` +
      `<circle cx="30" cy="40" r="14" fill="none" stroke="${TILE_COLORS.blue}" stroke-width="3" stroke-dasharray="4 2.5"/>` +
      `<circle cx="30" cy="40" r="8" fill="${TILE_COLORS.red}"/>` +
      `<circle cx="30" cy="40" r="3" fill="#fbf8ef"/>`;
  }
  return PIN_LAYOUT[n].map(([x, y, r, c]) => pinDot(x, y, r, red ? TILE_COLORS.red : COLOR_OF[c])).join('');
}

function stick(cx, cy, h, color) {
  const w = 7;
  const x = cx - w / 2;
  const y = cy - h / 2;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${color}"/>` +
    `<line x1="${cx}" y1="${y + 2}" x2="${cx}" y2="${y + h - 2}" stroke="#fbf8ef" stroke-width="1.2" opacity=".55"/>` +
    `<rect x="${x - 0.8}" y="${cy - 1.2}" width="${w + 1.6}" height="2.4" rx="1" fill="${color}"/>`;
}

// 索子の棒の位置 [x, y, 高さ, 色]
const SOU_LAYOUT = {
  2: [[30, 22, 26, 'g'], [30, 58, 26, 'g']],
  3: [[30, 22, 26, 'g'], [18, 58, 26, 'g'], [42, 58, 26, 'g']],
  4: [[18, 22, 26, 'g'], [42, 22, 26, 'g'], [18, 58, 26, 'g'], [42, 58, 26, 'g']],
  5: [[15, 22, 26, 'g'], [45, 22, 26, 'g'], [30, 40, 26, 'r'], [15, 58, 26, 'g'], [45, 58, 26, 'g']],
  6: [[15, 22, 26, 'g'], [30, 22, 26, 'g'], [45, 22, 26, 'g'], [15, 58, 26, 'g'], [30, 58, 26, 'g'], [45, 58, 26, 'g']],
  7: [[30, 14, 18, 'r'], [15, 40, 18, 'g'], [30, 40, 18, 'g'], [45, 40, 18, 'g'], [15, 64, 18, 'g'], [30, 64, 18, 'g'], [45, 64, 18, 'g']],
  8: [[12, 22, 26, 'g'], [24, 22, 26, 'g'], [36, 22, 26, 'g'], [48, 22, 26, 'g'], [12, 58, 26, 'g'], [24, 58, 26, 'g'], [36, 58, 26, 'g'], [48, 58, 26, 'g']],
  9: [[15, 16, 18, 'g'], [30, 16, 18, 'r'], [45, 16, 18, 'g'], [15, 40, 18, 'g'], [30, 40, 18, 'r'], [45, 40, 18, 'g'], [15, 64, 18, 'g'], [30, 64, 18, 'r'], [45, 64, 18, 'g']],
};

function souFace(n, red) {
  if (n === 1) {
    // 一索は鳥の絵（簡単な形）
    const g = TILE_COLORS.green, r = TILE_COLORS.red;
    return `<path d="M18 56 Q14 70 24 72 L22 62 Z" fill="${g}"/>` +
      `<path d="M22 58 Q22 74 32 72 L28 60 Z" fill="${TILE_COLORS.blue}"/>` +
      `<ellipse cx="30" cy="44" rx="13" ry="16" fill="${g}"/>` +
      `<ellipse cx="32" cy="46" rx="6" ry="9" fill="#fbf8ef" opacity=".35"/>` +
      `<circle cx="36" cy="22" r="8" fill="${r}"/>` +
      `<path d="M43 21 L51 24 L43 26 Z" fill="#d79a1e"/>` +
      `<circle cx="38" cy="20" r="1.8" fill="#fbf8ef"/>` +
      `<path d="M34 14 Q30 6 26 10 Q30 10 31 15 Z" fill="${r}"/>`;
  }
  return SOU_LAYOUT[n].map(([x, y, h, c]) => stick(x, y, h, red ? TILE_COLORS.red : COLOR_OF[c])).join('');
}

function manFace(n, red) {
  const top = red ? TILE_COLORS.red : TILE_COLORS.ink;
  return `<text x="30" y="35" text-anchor="middle" font-size="29" font-weight="700" fill="${top}">${KANJI_NUM[n - 1]}</text>` +
    `<text x="30" y="68" text-anchor="middle" font-size="29" font-weight="700" fill="${TILE_COLORS.red}">萬</text>`;
}

function honorFace(n) {
  if (n === 5) {
    return `<rect x="15" y="17" width="30" height="46" rx="3" fill="none" stroke="${TILE_COLORS.blue}" stroke-width="3"/>`;
  }
  const color = n === 6 ? TILE_COLORS.green : n === 7 ? TILE_COLORS.red : TILE_COLORS.ink;
  return `<text x="30" y="56" text-anchor="middle" font-size="42" font-weight="700" fill="${color}">${HONOR_NAME[n - 1]}</text>`;
}

const TILE_BASE = '<rect x="1" y="3" width="58" height="76" rx="7" fill="#c9b98f"/>' +
  '<rect x="1" y="1" width="58" height="74" rx="7" fill="#fbf8ef" stroke="#b8ab88" stroke-width="1.2"/>';

function tileFace(code) {
  const n = +code[0];
  const s = code[1];
  const red = n === 0;
  const num = red ? 5 : n;
  let face;
  if (s === 'm') face = manFace(num, red);
  else if (s === 'p') face = pinFace(num, red);
  else if (s === 's') face = souFace(num, red);
  else face = honorFace(num);
  const mark = red ? '<circle cx="52" cy="9" r="3" fill="#c62828"/>' : '';
  return TILE_BASE + `<g transform="translate(0 -1)">${face}</g>` + mark;
}

const TILE_BACK = '<rect x="1" y="3" width="58" height="76" rx="7" fill="#b86e12"/>' +
  '<rect x="1" y="1" width="58" height="74" rx="7" fill="#e8a33b" stroke="#a5620f" stroke-width="1.2"/>' +
  '<rect x="8" y="8" width="44" height="60" rx="4" fill="none" stroke="#f6c978" stroke-width="1.5" opacity=".7"/>';

function buildTileSprite() {
  if (typeof document === 'undefined' || document.getElementById('tile-sprite')) return;
  const codes = [];
  for (let k = 0; k < KIND_COUNT; k++) codes.push(kindCode(k));
  codes.push('0m', '0p', '0s');
  const symbols = codes.map(c => `<symbol id="t-${c}" viewBox="0 0 60 80">${tileFace(c)}</symbol>`).join('') +
    `<symbol id="t-back" viewBox="0 0 60 80">${TILE_BACK}</symbol>`;
  const wrap = document.createElement('div');
  wrap.innerHTML = `<svg id="tile-sprite" xmlns="http://www.w3.org/2000/svg" width="0" height="0" ` +
    `style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true" ` +
    `font-family="'Hiragino Mincho ProN','Yu Mincho','Noto Serif JP',serif">${symbols}</svg>`;
  document.body.insertBefore(wrap.firstChild, document.body.firstChild);
}

// 牌1枚の HTML。code は "1m" "0p" "7z" "back"。aria-label に日本語名を入れる。
function tileSvg(code, cls) {
  const label = code === 'back' ? '裏向きの牌' : (code[0] === '0' ? '赤' + kindName(kindOfCode(code)) : kindName(kindOfCode(code)));
  return `<svg class="tile${cls ? ' ' + cls : ''}" viewBox="0 0 60 80" role="img" aria-label="${label}">` +
    `<use href="#t-${code}"/></svg>`;
}

function tileSvgId(id, rules, cls) { return tileSvg(tileCode(id, rules), cls); }
function tileSvgKind(kind, cls) { return tileSvg(kindCode(kind), cls); }
