// Generates social share images (public/og/*.png) and PNG icons from SVG templates with sharp.
// Runs automatically before `npm run build`; run `npm run og` to regenerate on its own.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { ELEMENTS, CAT_NAME, CAT_HUE, CATEGORIES, fmt } from "../src/lib/elements.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pub = path.join(root, "public"), ogDir = path.join(pub, "og");
await fs.mkdir(ogDir, { recursive: true });

const HAND = "'Segoe Print', 'Comic Sans MS', 'Patrick Hand', 'Chalkboard SE', cursive";
const MONO = "'Courier New', 'Courier Prime', monospace";
const INK = "#2a2b36", INK2 = "#6a6356", PAPER = "#fbf7ec";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const SUP = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
const pretty = (c) => c.replace(/(\d[spdf]) (\d+)/g, (m, a, b) => a + String(b).split("").map((d) => SUP[d]).join(""));
const tile = (h, l = 85) => `hsl(${h}, 64%, ${l}%)`;

function paper(inner) {
  const rules = Array.from({ length: 22 }, (_, i) => `<line x1="0" x2="1200" y1="${40 + i * 28}" y2="${40 + i * 28}" stroke="rgba(70,110,180,.16)" stroke-width="1.5"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#efe6d2"/>
  <rect x="24" y="22" width="1152" height="586" rx="6" fill="${PAPER}" stroke="rgba(80,58,22,.25)" stroke-width="2"/>
  <g clip-path="url(#c)">${rules}</g>
  <clipPath id="c"><rect x="24" y="22" width="1152" height="586" rx="6"/></clipPath>
  <line x1="62" x2="62" y1="22" y2="608" stroke="rgba(214,84,84,.45)" stroke-width="2"/>
  ${inner}
</svg>`;
}

function atomSketch(cx, cy, shells) {
  const n = shells.length, r0 = 34, step = Math.min(30, 150 / Math.max(1, n));
  let s = `<circle cx="${cx}" cy="${cy}" r="18" fill="#d2473b" stroke="${INK}" stroke-width="2.5"/>`;
  shells.forEach((count, i) => {
    const r = r0 + i * step, ry = r * 0.42, rot = -25 + i * 23, last = i === n - 1;
    s += `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${ry}" fill="none" stroke="${last ? "#d98a0b" : "#8d877b"}" stroke-width="${last ? 3 : 2}" transform="rotate(${rot} ${cx} ${cy})"/>`;
    const shown = Math.min(count, 18);
    for (let k = 0; k < shown; k++) {
      const a = (k / shown) * Math.PI * 2 + i, x = r * Math.cos(a), y = ry * Math.sin(a), t = (rot * Math.PI) / 180;
      s += `<circle cx="${(cx + x * Math.cos(t) - y * Math.sin(t)).toFixed(1)}" cy="${(cy + x * Math.sin(t) + y * Math.cos(t)).toFixed(1)}" r="5.5" fill="${last ? "#d98a0b" : "#2c5bd2"}" stroke="${INK}" stroke-width="1.5"/>`;
    }
  });
  return s;
}

function elementSvg(el) {
  const h = CAT_HUE[el.cat], nameSize = el.name.length > 11 ? 74 : 92;
  return paper(`
  <g transform="rotate(-2 245 300)">
    <rect x="90" y="110" width="310" height="350" rx="14" fill="${tile(h)}" stroke="${INK}" stroke-width="4"/>
    <text x="114" y="160" font-family="${MONO}" font-weight="700" font-size="34" fill="${INK}">${el.Z}</text>
    <text x="245" y="345" text-anchor="middle" font-family="${HAND}" font-weight="700" font-size="170" fill="${INK}">${esc(el.sym)}</text>
    <text x="245" y="430" text-anchor="middle" font-family="${MONO}" font-size="28" fill="${INK}">${fmt(el.mass, 6)}</text>
  </g>
  <text x="450" y="190" font-family="${HAND}" font-weight="700" font-size="${nameSize}" fill="${INK}">${esc(el.name)}</text>
  <text x="452" y="248" font-family="${HAND}" font-size="36" fill="${INK2}">${esc(CAT_NAME[el.cat])} · element ${el.Z}</text>
  <text x="452" y="304" font-family="${MONO}" font-size="30" fill="${INK}">${esc(pretty(el.config))}</text>
  ${atomSketch(1000, 440, el.shells)}
  <text x="90" y="565" font-family="${HAND}" font-weight="700" font-size="34" fill="${INK}">Periodic Table <tspan fill="${INK}" style="paint-order:stroke" stroke="#ffdd30" stroke-width="16" stroke-opacity=".65">Lab</tspan></text>`);
}

function homeSvg() {
  let cells = "";
  const W = 30, G = 3, x0 = 1150 - 18 * (W + G), y0 = 262;
  for (const e of ELEMENTS) {
    const r = e.row > 7 ? e.row - 0.5 : e.row - 1, c = e.col - 1;
    cells += `<rect x="${x0 + c * (W + G)}" y="${y0 + r * (W + G) * 0.86}" width="${W}" height="${W * 0.8}" rx="4" fill="${tile(CAT_HUE[e.cat])}" stroke="${INK}" stroke-width="1.5"/>`;
  }
  return paper(`
  <text x="90" y="140" font-family="${HAND}" font-weight="700" font-size="92" fill="${INK}">Periodic Table <tspan stroke="#ffdd30" stroke-width="22" stroke-opacity=".65" style="paint-order:stroke">Lab</tspan></text>
  <text x="92" y="200" font-family="${HAND}" font-size="34" fill="${INK2}">All 118 elements in a lab notebook</text>
  <text x="92" y="290" font-family="${HAND}" font-size="30" fill="${INK}">3D and hand-drawn atoms</text>
  <text x="92" y="340" font-family="${HAND}" font-size="30" fill="${INK}">Orbitals, crystals, spectra</text>
  <text x="92" y="390" font-family="${HAND}" font-size="30" fill="${INK}">Trends, equations, quizzes</text>
  ${cells}`);
}

const png = (svg, file) => sharp(Buffer.from(svg)).png({ compressionLevel: 9, palette: true, quality: 90 }).toFile(file);
await png(homeSvg(), path.join(ogDir, "home.png"));
for (const el of ELEMENTS) await png(elementSvg(el), path.join(ogDir, `${el.slug}.png`));

const fav = await fs.readFile(path.join(pub, "favicon.svg"));
for (const [name, size] of [["favicon-32.png", 32], ["apple-touch-icon.png", 180], ["icon-192.png", 192], ["icon-512.png", 512]]) {
  await sharp(fav, { density: 384 }).resize(size, size).png().toFile(path.join(pub, name));
}
console.log(`og: wrote ${ELEMENTS.length + 1} share images and 4 icons`);
