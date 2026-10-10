// Generates the pixel-art icons for the Retro Desktop style into ../assets/icons/.
// Run with: node retro/tools/gen-icons.mjs   (from the MyPortfolio folder)
// Each icon is drawn on a small pixel grid and written as a crisp SVG.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'icons');
mkdirSync(out, { recursive: true });

class Pix {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.d = Array.from({ length: h }, () => Array(w).fill(null));
  }
  px(x, y, c) {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y][x] = c;
  }
  rect(x, y, w, h, c) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.px(i, j, c);
  }
  box(x, y, w, h, fill, line = K) {
    this.rect(x, y, w, h, line);
    this.rect(x + 1, y + 1, w - 2, h - 2, fill);
  }
  line(x0, y0, x1, y1, c) {
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  disc(cx, cy, r, c, keep = () => true) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r + r * 0.6 && keep(x, y)) this.px(x, y, c);
  }
  map(rows, palette, ox = 0, oy = 0) {
    rows.forEach((row, y) => [...row].forEach((ch, x) => palette[ch] && this.px(ox + x, oy + y, palette[ch])));
    return this;
  }
  /** 1px outline around every painted pixel (4-neighbourhood). */
  outline(c = K) {
    const snap = this.d.map((r) => r.slice());
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (snap[y][x]) continue;
        const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
          const v = snap[y + dy] && snap[y + dy][x + dx];
          return v && v !== c;
        });
        if (near) this.d[y][x] = c;
      }
    return this;
  }
  /** Hard 1px drop shadow to the bottom-right. */
  shadow(c = SHADOW) {
    const snap = this.d.map((r) => r.slice());
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (snap[y][x]) continue;
        const src = snap[y - 1] && snap[y - 1][x - 1];
        if (src && src !== SHADOW) this.d[y][x] = c;
      }
    return this;
  }
  toSVG() {
    const byColor = new Map();
    for (let y = 0; y < this.h; y++) {
      let x = 0;
      while (x < this.w) {
        const c = this.d[y][x];
        if (!c) { x++; continue; }
        let run = 1;
        while (x + run < this.w && this.d[y][x + run] === c) run++;
        if (!byColor.has(c)) byColor.set(c, []);
        byColor.get(c).push(`M${x} ${y}h${run}v1h-${run}z`);
        x += run;
      }
    }
    const paths = [...byColor].map(([c, d]) => `<path fill="${c}" d="${d.join('')}"/>`).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.w}" height="${this.h}" viewBox="0 0 ${this.w} ${this.h}" shape-rendering="crispEdges">${paths}</svg>\n`;
  }
}

/** Layer `top` over `bottom` (same size). */
function merge(bottom, top) {
  const p = new Pix(bottom.w, bottom.h);
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) p.d[y][x] = top.d[y][x] || bottom.d[y][x];
  return p;
}

// Palette
const K = '#000000', W = '#ffffff', G1 = '#c0c0c0', G2 = '#808080', G3 = '#404040';
const N = '#000080', Y = '#ffd84a', Y2 = '#e0a800', R = '#d8262c', R2 = '#8e1519', O = '#f08a24';
const B2 = '#9fd0ff', T = '#159a9c', TL = '#5cc9c6', GR = '#3fa34d', LG = '#33ff66', BR = '#a8723a', BR2 = '#5c3a17', SK = '#f2c39b';
const SHADOW = '#00000047';

const icons = {};

// About: ID card with a portrait and text lines
icons.about = (() => {
  const p = new Pix(32, 32);
  p.box(2, 7, 28, 19, W);
  p.rect(3, 8, 26, 3, N);
  p.rect(5, 9, 6, 1, W);
  p.box(5, 13, 9, 10, B2);
  p.disc(9.5, 16, 2.2, SK);
  p.rect(7, 19, 6, 3, T);
  p.rect(16, 14, 10, 1, G2);
  p.rect(16, 17, 10, 1, G2);
  p.rect(16, 20, 7, 1, G2);
  p.rect(3, 24, 26, 1, G1);
  return p.shadow();
})();

// Skills: red toolbox with handle and latch
icons.skills = (() => {
  const p = new Pix(32, 32);
  p.rect(11, 6, 10, 2, G3);
  p.rect(11, 6, 2, 6, G3);
  p.rect(19, 6, 2, 6, G3);
  p.box(3, 11, 26, 16, R);
  p.rect(4, 12, 24, 1, '#ff6a6a');
  p.rect(4, 16, 24, 2, R2);
  p.box(14, 15, 4, 4, G1);
  p.rect(4, 25, 24, 1, R2);
  p.rect(27, 13, 1, 12, R2);
  return p.shadow();
})();

// Education: graduation cap with a tassel
icons.education = (() => {
  const p = new Pix(32, 32);
  const top = new Pix(32, 32);
  for (let i = 0; i <= 13; i++) top.rect(16 - i, 6 + Math.floor(i / 2), i * 2 + 1, 1, '#2b2b2b');
  for (let i = 0; i <= 13; i++) top.rect(16 - (13 - i), 13 + Math.floor(i / 2), (13 - i) * 2 + 1, 1, '#2b2b2b');
  top.rect(10, 11, 12, 1, G3);
  top.outline();
  p.d = top.d;
  p.box(9, 18, 14, 7, '#2b2b2b');
  p.rect(10, 19, 12, 1, G3);
  p.line(16, 12, 25, 15, Y2);
  p.rect(25, 15, 1, 8, Y);
  p.rect(24, 22, 3, 3, Y);
  return p.shadow();
})();

// Languages: two overlapping speech bubbles
icons.languages = (() => {
  const back = new Pix(32, 32);
  back.rect(12, 4, 17, 11, Y);
  back.map(['XXX', 'XX.', 'X..'], { X: Y }, 24, 15);
  back.rect(15, 7, 10, 2, Y2);
  back.rect(15, 11, 6, 2, Y2);
  back.outline();
  const front = new Pix(32, 32);
  front.rect(3, 12, 17, 11, W);
  front.map(['XXX', '.XX', '..X'], { X: W }, 5, 23);
  front.rect(6, 15, 11, 2, N);
  front.rect(6, 19, 7, 2, N);
  front.outline();
  return merge(back, front).shadow();
})();

// CV: document with folded corner and a red "PDF" band
icons.cv = (() => {
  const p = new Pix(32, 32);
  p.box(6, 2, 20, 28, W);
  // Folded top-right corner: cut the corner off, then draw the fold below the diagonal
  for (let t = 0; t < 5; t++) {
    for (let x = 22 + t; x <= 25; x++) p.px(x, 2 + t, null);
    p.px(21 + t, 2 + t, K);
    for (let x = 22; x < 21 + t; x++) p.px(x, 2 + t, G1);
  }
  p.rect(21, 2, 1, 5, K);
  p.rect(21, 6, 5, 1, K);
  p.rect(9, 8, 10, 1, G2);
  p.rect(9, 11, 14, 1, G2);
  p.rect(9, 14, 14, 1, G2);
  p.rect(4, 18, 20, 9, R);
  p.rect(4, 18, 20, 1, '#ff6a6a');
  p.map(
    ['PPP.PP..PPP', 'P.P.P.P.P..', 'PPP.P.P.PP.', 'P...P.P.P..', 'P...PP..P..'],
    { P: W },
    9,
    20,
  );
  return p.outline().shadow();
})();

// Contact: envelope with a stamp
icons.contact = (() => {
  const p = new Pix(32, 32);
  p.box(2, 8, 28, 18, W);
  p.line(3, 9, 16, 18, G2);
  p.line(28, 9, 16, 18, G2);
  p.line(3, 24, 12, 16, G1);
  p.line(28, 24, 20, 16, G1);
  p.box(22, 10, 6, 6, R);
  p.rect(24, 12, 2, 2, Y);
  return p.shadow();
})();

// Terminal: monitor with a green prompt
icons.terminal = (() => {
  const p = new Pix(32, 32);
  p.box(2, 3, 28, 21, G1);
  p.rect(3, 4, 26, 1, W);
  p.box(5, 6, 22, 15, '#111111');
  p.map(['G...', '.G..', '..G.', '.G..', 'G...'], { G: LG }, 8, 9);
  p.rect(13, 15, 5, 1, LG);
  p.rect(27, 5, 1, 18, G2);
  p.box(12, 24, 8, 3, G2);
  p.box(8, 27, 16, 3, G1);
  return p.shadow();
})();

// Exit: open door with a green arrow pointing out
icons.exit = (() => {
  const p = new Pix(32, 32);
  p.box(4, 3, 16, 26, G3);
  p.rect(5, 4, 14, 24, '#1a1a1a');
  // open door leaf (in perspective)
  for (let x = 0; x < 8; x++) p.rect(5 + x, 4 + Math.floor(x / 2), 1, 24 - x, x === 0 ? BR2 : BR);
  p.rect(12, 15, 1, 2, Y);
  // arrow
  p.rect(16, 15, 9, 3, GR);
  p.map(['G...', 'GG..', 'GGG.', 'GGGG', 'GGG.', 'GG..', 'G...'], { G: GR }, 25, 13);
  p.rect(16, 15, 9, 1, '#62c46e');
  p.rect(2, 29, 22, 1, K);
  return p.outline().shadow();
})();

// Start button mark (18x15): pixel sunrise
icons.start = (() => {
  const p = new Pix(18, 15);
  const above = (_x, y) => y <= 11;
  p.disc(9, 11, 8, R, above);
  p.disc(9, 11, 6, O, above);
  p.disc(9, 11, 4, Y, above);
  p.disc(9, 11, 2, W, above);
  p.rect(0, 12, 18, 1, K);
  p.rect(1, 13, 16, 1, T);
  p.rect(3, 14, 12, 1, TL);
  return p;
})();

for (const [name, pix] of Object.entries(icons)) writeFileSync(join(out, `${name}.svg`), pix.toSVG());
console.log(`wrote ${Object.keys(icons).length} icons to ${out}`);
