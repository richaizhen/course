// Generates the Open Graph share-card image for /yizhichan/ in public/.
// Text is outlined to vector paths from the Noto Serif SC + Noto Sans SC
// variable fonts, so the rasterized PNG needs no font installed on the
// build machine. Re-run with `npm run build:og` after changing copy/layout.
//
// Layout: 1200×630, two centered lines (title, tagline) + bottom-right
// ConeLab logo. Mirrors the card system in ../conelab-website/scripts/build-og.mjs
// (same colours, same corner-logo placement) but adapted for CJK: Noto Serif SC
// for the title (matches the page's own <h1> font), Noto Sans SC Light with
// extra letter-spacing for the tagline.

import * as fontkitNS from "fontkit";
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const fontkit = fontkitNS.default ?? fontkitNS;
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const COLOR = {
  bg: "#FAF9F5",
  ink: "#141413",
  orange: "#D97757",
};

const W = 1200;
const H = 630;

const notoSerifSC = fontkit.openSync(join(__dirname, "fonts", "NotoSerifSC-Bold.ttf"));
const notoSansSC = fontkit.openSync(join(__dirname, "fonts", "NotoSansSC-Light.ttf"));

const variationCache = new Map();
function instance(font, settings) {
  const key = (font === notoSerifSC ? "serif" : "sans") + JSON.stringify(settings);
  if (!variationCache.has(key)) variationCache.set(key, font.getVariation(settings));
  return variationCache.get(key);
}

// Advance width of a text run at a given size + optional per-character
// tracking (extra px added after every character, including the last —
// callers that need "gaps between characters only" should subtract one
// tracking unit from the returned width when centering).
function measure(font, settings, text, size, tracking = 0) {
  const run = instance(font, settings).layout(text);
  const scale = size / font.unitsPerEm;
  let adv = 0;
  for (const p of run.positions) adv += p.xAdvance;
  return adv * scale + tracking * text.length;
}

function textLine(font, settings, text, x, baseline, size, fill, tracking = 0) {
  const run = instance(font, settings).layout(text);
  const scale = size / font.unitsPerEm;
  let penX = 0;
  let paths = "";
  run.glyphs.forEach((glyph, i) => {
    const pos = run.positions[i];
    const d = glyph.path.toSVG();
    if (d && d.trim()) {
      const gx = x + (penX + (pos.xOffset || 0)) * scale;
      const gy = baseline - (pos.yOffset || 0) * scale;
      paths += `<path d="${d}" transform="translate(${gx.toFixed(2)} ${gy.toFixed(2)}) scale(${scale.toFixed(5)} ${(-scale).toFixed(5)})"/>`;
    }
    penX += pos.xAdvance + tracking / scale;
  });
  return `<g fill="${fill}">${paths}</g>`;
}

function centeredLine(font, settings, text, baseline, size, fill, tracking = 0) {
  const width = measure(font, settings, text, size, tracking) - tracking;
  const x = (W - width) / 2;
  return textLine(font, settings, text, x, baseline, size, fill, tracking);
}

const extractSvgInner = (raw) =>
  raw.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
const logoInner = extractSvgInner(
  readFileSync(join(root, "public", "logo-horizontal.svg"), "utf8"),
);
const LOGO_VB_W = 832.468;
const LOGO_VB_H = 191.775;
const logoWidth = (heightPx) => LOGO_VB_W * (heightPx / LOGO_VB_H);
const logoAt = (x, y, heightPx) => {
  const k = heightPx / LOGO_VB_H;
  return `<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${k.toFixed(5)})">${logoInner}</g>`;
};

function renderStack(rows) {
  const totalGap = rows.slice(0, -1).reduce((s, r) => s + r.gap, 0);
  const above0 = rows[0].above;
  const belowLast = rows[rows.length - 1].below;
  let baseline = H / 2 - (totalGap + belowLast - above0) / 2;
  let svg = "";
  for (const r of rows) {
    svg += r.render(baseline);
    baseline += r.gap;
  }
  return svg;
}

function textRow(font, settings, text, size, fill, gap, tracking = 0) {
  return {
    above: (font.capHeight / font.unitsPerEm) * size,
    below: (Math.abs(font.descent) / font.unitsPerEm) * size,
    gap,
    render: (baseline) => centeredLine(font, settings, text, baseline, size, fill, tracking),
  };
}

const svgDoc = (inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
  `<rect width="${W}" height="${H}" fill="${COLOR.bg}"/>` +
  inner +
  `</svg>`;

function buildCard() {
  const content = renderStack([
    textRow(notoSerifSC, { wght: 700 }, "产品一纸禅", 128, COLOR.ink, 96),
    textRow(notoSansSC, { wght: 300 }, "从0到1，构建你的第一个AI出海产品", 40, COLOR.orange, 0, 40 * 0.08),
  ]);
  const cornerH = 40;
  const corner = logoAt(W - 64 - logoWidth(cornerH), H - 64 - cornerH, cornerH);
  return svgDoc(content + corner);
}

await sharp(Buffer.from(buildCard())).png().toFile(join(root, "public", "og-yizhichan.png"));
console.log("wrote public/og-yizhichan.png");
