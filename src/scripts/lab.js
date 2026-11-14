// Periodic Table Lab client: simulation engine (WebGL + hand-drawn canvas) and the notebook interface.
import * as THREE from "three";
import {
  ORDER, CAP, NOBLE, fill, subOrder, SHELL_NAMES, ELEMENTS, stateAt, fmt, CATEGORIES, CAT_NAME, CAT_HUE, CRYSTAL_NAME,
  SPECTRA, FLAME, HAZ, HAZ_DEF, stabilityOf, nmColor, BYSYM, STABLE, LONG_LIVED
} from "../lib/elements.js";
import { openCompare } from "./nuccompare.js";

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const store = {
  get(k, d) { try { const v = localStorage.getItem("ptl:" + k); return v === null ? d : JSON.parse(v); } catch (_) { return d; } },
  set(k, v) { try { localStorage.setItem("ptl:" + k, JSON.stringify(v)); } catch (_) {} }
};

/* ---------- Palette (read from CSS so both paper styles share one source) ---------- */
let PAL = {};
function readPalette() {
  const cs = getComputedStyle(document.documentElement), g = n => cs.getPropertyValue(n).trim();
  PAL = { paper: g("--paper"), ink: g("--ink"), ink2: g("--ink-2"), rule: g("--rule"), accent: g("--accent"), red: g("--sk-red"), blue: g("--sk-blue"),
    gold: g("--sk-gold"), orange: g("--sk-orange"), green: g("--sk-green"), purple: g("--sk-purple"), grey: g("--sk-grey"),
    chalk: document.documentElement.dataset.theme === "chalk" };
}
const catColor = (cat, a) => "hsla(" + (CAT_HUE[cat] || 215) + "," + (PAL.chalk ? 55 : 62) + "%," + (PAL.chalk ? 68 : 58) + "%," + (a === undefined ? 1 : a) + ")";

/* ---------- Ink: a tiny hand-drawn stroke kit for canvas ---------- */
const Ink = (() => {
  let R = Math.random, AMP = 1;
  const seed = s => { R = rng(s); };
  const setAmp = a => { AMP = a; };
  const j = a => (R() * 2 - 1) * a * AMP;
  // Every function appends to the current path; callers beginPath() and stroke()/fill().
  function line(c, x1, y1, x2, y2, o) {
    o = o || {};
    const len = Math.hypot(x2 - x1, y2 - y1) || 1, w = o.wob !== undefined ? o.wob : Math.min(2.2, 0.5 + len * 0.012), passes = o.passes || 2;
    for (let p = 0; p < passes; p++) {
      const ax = x1 + j(w), ay = y1 + j(w), bx = x2 + j(w), by = y2 + j(w);
      const nx = -(by - ay) / len, ny = (bx - ax) / len, bend = j(w * 1.4);
      c.moveTo(ax, ay); c.quadraticCurveTo((ax + bx) / 2 + nx * bend, (ay + by) / 2 + ny * bend, bx, by);
    }
  }
  function circle(c, cx, cy, r, o) {
    o = o || {};
    const passes = o.passes || 1, w = o.wob !== undefined ? o.wob : Math.max(0.35, r * 0.06);
    for (let p = 0; p < passes; p++) {
      const n = Math.max(8, Math.min(30, Math.round(r * 0.9))), a0 = R() * 6.2832, total = 6.2832 + 0.25 + R() * 0.4;
      const sx = 1 + j(0.05), sy = 1 + j(0.05);
      for (let i = 0; i <= n; i++) {
        const a = a0 + total * i / n, rr = r + j(w), x = cx + Math.cos(a) * rr * sx, y = cy + Math.sin(a) * rr * sy;
        i ? c.lineTo(x, y) : c.moveTo(x, y);
      }
    }
  }
  function blob(c, cx, cy, r, w) {
    const n = 9, pts = [];
    for (let i = 0; i < n; i++) { const a = i / n * 6.2832, rr = r + j(w); pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
    const mid = i => { const a = pts[i % n], b = pts[(i + 1) % n]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
    let m = mid(n - 1); c.moveTo(m[0], m[1]);
    for (let i = 0; i < n; i++) { m = mid(i); c.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); }
    c.closePath();
  }
  function poly(c, pts, closed, w) {
    for (let i = 0; i < pts.length; i += 2) { const x = pts[i] + j(w), y = pts[i + 1] + j(w); i ? c.lineTo(x, y) : c.moveTo(x, y); }
    if (closed) c.lineTo(pts[0] + j(w), pts[1] + j(w));
  }
  // Parallel strokes across a circle; `from` (-1..1) starts the hatching partway, to shade one side.
  function hatch(c, cx, cy, r, ang, gap, from) {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    for (let d = from * r; d < r; d += gap) {
      const h = Math.sqrt(Math.max(0, r * r - d * d)) * 0.9; if (h < 0.8) continue;
      const px = cx + ca * d, py = cy + sa * d;
      c.moveTo(px - sa * h + j(0.6), py + ca * h + j(0.6)); c.lineTo(px + sa * h + j(0.6), py - ca * h + j(0.6));
    }
  }
  function arrow(c, x1, y1, x2, y2, bend) {
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const cx = (x1 + x2) / 2 + nx * bend * L + j(2), cy = (y1 + y2) / 2 + ny * bend * L + j(2);
    c.moveTo(x1 + j(1), y1 + j(1)); c.quadraticCurveTo(cx, cy, x2, y2);
    const tx = x2 - cx, ty = y2 - cy, tl = Math.hypot(tx, ty) || 1, ux = tx / tl, uy = ty / tl, h = 8;
    for (const s of [-1, 1]) { const a = 0.45 * s, rx = ux * Math.cos(a) - uy * Math.sin(a), ry = ux * Math.sin(a) + uy * Math.cos(a);
      c.moveTo(x2, y2); c.lineTo(x2 - rx * h + j(1), y2 - ry * h + j(1)); }
  }
  function squiggle(c, x1, y1, x2, y2, amp, waves) {
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, steps = waves * 2;
    c.moveTo(x1, y1);
    for (let i = 1; i <= steps; i++) { const t = i / steps, s = (i % 2 ? 1 : -1) * amp * (i === steps ? 0 : 1);
      c.lineTo(x1 + dx * t + nx * s + j(0.4), y1 + dy * t + ny * s + j(0.4)); }
  }
  function text(c, s, x, y, size, color, align, weight) {
    c.font = (weight || 700) + " " + size + "px Caveat, 'Patrick Hand', cursive";
    c.fillStyle = color; c.textAlign = align || "left"; c.textBaseline = "middle"; c.fillText(s, x, y);
  }
  return { seed, setAmp, j, line, circle, blob, poly, hatch, arrow, squiggle, text };
})();

const SUPS = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "−": "⁻" };
const chargeText = q => q === 0 ? "" : (Math.abs(q) === 1 ? "" : String(Math.abs(q))) + (q > 0 ? "+" : "−");
const sup = t => String(t).split("").map(ch => SUPS[ch] || ch).join("");

/* ---------- Simulation: one scene graph, drawn either by WebGL (3D model) or by Ink (scribbles) ---------- */
const Scene3D = (() => {
  let renderer = null, scene, camera, stageEl, glEl, skEl, sk, current = null, mode = "3d";
  const orbit = { theta: 0.6, phi: 1.2, dist: 14, baseDist: 14, spin: true };
  const st = { T: 298, bonds: true, visible: true, wobble: true, t: 0 };
  const K = { W: 300, H: 280, F: 300, dpr: 1, frame: 0 };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const SQ3 = Math.sqrt(3) / 2;
  const hueColor = (cat, l) => new THREE.Color().setHSL((CAT_HUE[cat] || 215) / 360, 0.62, l || 0.52);
  const hex = c => "#" + c.getHexString();
  const _v = new THREE.Vector3();
  // Project a point (optionally through an object's world matrix) to [screenX, screenY, depth, pixelsPerUnit].
  function P(x, y, z, m) {
    _v.set(x, y, z); if (m) _v.applyMatrix4(m);
    _v.applyMatrix4(camera.matrixWorldInverse);
    const d = Math.max(0.05, -_v.z), s = K.F / d;
    return [K.W / 2 + _v.x * s, K.H / 2 - _v.y * s, d, s];
  }
  // Seed jitter per object so a stroke keeps its shape until the next "boil" frame.
  const sd = id => Ink.seed((K.frame * 7919 + id * 2654435761 + 17) >>> 0);

  /* ----- Bohr model ----- */
  function buildAtom(el) {
    const g = new THREE.Group(), owned = [];
    const N = el.neutrons, A = el.Z + N;
    const ns = 0.2 / Math.pow(A, 0.12), R = A === 1 ? 0 : ns * 1.9 * Math.cbrt(A);
    const geo = new THREE.SphereGeometry(ns, 14, 10);
    const mp = new THREE.MeshStandardMaterial({ color: 0xe5483a, roughness: 0.45 });
    const mn = new THREE.MeshStandardMaterial({ color: 0x9aa6b4, roughness: 0.5 });
    owned.push(geo, mp, mn);
    const rnd = rng(el.Z * 7919 + 13);
    const types = [];
    for (let i = 0; i < el.Z; i++) types.push(1);
    for (let i = 0; i < N; i++) types.push(0);
    for (let i = types.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [types[i], types[j]] = [types[j], types[i]]; }
    const nuc = new THREE.Group(), nucs = [];
    for (let i = 0; i < A; i++) {
      let x = 0, y = 0, z = 0;
      if (A > 1) {
        const zz = 1 - 2 * (i + 0.5) / A, rr = Math.sqrt(1 - zz * zz), ph = i * 2.399963, rad = R * Math.cbrt(rnd());
        x = Math.cos(ph) * rr * rad; y = zz * rad; z = Math.sin(ph) * rr * rad;
      }
      const m = new THREE.Mesh(geo, types[i] ? mp : mn); m.position.set(x, y, z); nuc.add(m); nucs.push({ m, p: types[i] });
    }
    g.add(nuc);
    const eGeo = new THREE.SphereGeometry(0.1, 12, 10);
    const eMat = new THREE.MeshStandardMaterial({ color: 0x2f8cff, emissive: 0x0b3f94, emissiveIntensity: 0.7, roughness: 0.3 });
    const vMat = new THREE.MeshStandardMaterial({ color: 0xffb02e, emissive: 0x7a4a00, emissiveIntensity: 0.7, roughness: 0.3 });
    const ringMat = new THREE.LineBasicMaterial({ color: 0x7d8ea3, transparent: true, opacity: 0.6 });
    owned.push(eGeo, eMat, vMat, ringMat);
    const r0 = Math.max(R, 0.25) + 1.0, step = 0.85, electrons = [], rings = [];
    el.shells.forEach((n, i) => {
      const r = r0 + i * step, sg = new THREE.Group();
      sg.rotation.set(i * 0.55 + 0.3, i * 0.9, i * 0.35);
      const pts = []; for (let k = 0; k < 120; k++) { const a = k / 120 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0)); }
      const rg = new THREE.BufferGeometry().setFromPoints(pts); owned.push(rg);
      sg.add(new THREE.LineLoop(rg, ringMat));
      const last = i === el.shells.length - 1;
      rings.push({ sg, r, n, last });
      for (let k = 0; k < n; k++) {
        const m = new THREE.Mesh(eGeo, last ? vMat : eMat); sg.add(m);
        electrons.push({ m, r, sg, val: last, ph: k / n * Math.PI * 2, w: 1.5 / Math.pow(i + 1, 0.9) });
      }
      g.add(sg);
    });
    const rMax = r0 + Math.max(0, el.shells.length - 1) * step, E = el.shells.reduce((a, b) => a + b, 0);
    let T = 0;
    return {
      group: g, owned, baseDist: rMax * 3.4 + 1.5,
      update(t, dt) { T = t; nuc.rotation.y += dt * 0.35; for (const e of electrons) { const a = e.ph + t * e.w; e.m.position.set(Math.cos(a) * e.r, Math.sin(a) * e.r, 0); } },
      tag: el.sym + "-" + A + (el.charge ? sup(chargeText(el.charge)) : "") + " · " + el.Z + " p⁺  " + N + " n⁰  " + E + " e⁻",
      note: () => el.shells.length ? "Shells K–" + SHELL_NAMES[el.shells.length - 1] + ". Outer (valence) shell in gold. Nucleus sizes exaggerated for visibility." : "No electrons left: this is a bare nucleus.",
      key: [["#e5483a", "Proton"], ["#9aa6b4", "Neutron"], ["#2f8cff", "Electron"], ["#ffb02e", "Outer shell"]], bonds: false,
      sketch(c) {
        const pal = PAL, o = P(0, 0, 0), roomy = K.W > 280;
        let outer = null;
        c.lineWidth = 1.3;
        rings.forEach((rg, i) => {
          sd(1000 + i);
          const pts = [];
          for (let k = 0; k < 60; k++) { const a = k / 60 * 6.2832, s = P(Math.cos(a) * rg.r, Math.sin(a) * rg.r, 0, rg.sg.matrixWorld); pts.push(s[0], s[1]); }
          c.strokeStyle = rg.last ? pal.gold : pal.ink2; c.globalAlpha = rg.last ? 0.95 : 0.7;
          c.beginPath(); Ink.poly(c, pts, true, 0.7); c.stroke(); c.globalAlpha = 1;
          let ti = 1; for (let k = 3; k < pts.length; k += 2) if (pts[k] < pts[ti]) ti = k;
          Ink.text(c, SHELL_NAMES[i] + " " + rg.n, pts[ti - 1], pts[ti] - 9, 15, pal.ink2, "center");
          if (rg.last) outer = pts;
        });
        const es = electrons.map((e, idx) => { const a = e.ph + T * e.w; return { e, a, idx, s: P(Math.cos(a) * e.r, Math.sin(a) * e.r, 0, e.sg.matrixWorld) }; });
        const drawE = q => {
          const { e, a, s } = q, col = e.val ? pal.gold : pal.blue, rr = Math.max(2.8, 0.1 * s[3] * 1.3);
          sd(3000 + q.idx);
          c.strokeStyle = col; c.globalAlpha = 0.5; c.lineWidth = 1.5; c.beginPath();
          for (let k = 0; k <= 6; k++) { const b = a - 0.06 - k * 0.08, p = P(Math.cos(b) * e.r, Math.sin(b) * e.r, 0, e.sg.matrixWorld); k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); }
          c.stroke(); c.globalAlpha = 1;
          c.fillStyle = col; c.beginPath(); Ink.blob(c, s[0], s[1], rr, rr * 0.15); c.fill();
          c.strokeStyle = pal.ink; c.lineWidth = 1; c.beginPath(); Ink.circle(c, s[0], s[1], rr + 0.6); c.stroke();
        };
        es.filter(q => q.s[2] > o[2]).forEach(drawE);
        const list = nucs.map((n, i) => ({ n, i, s: P(n.m.position.x, n.m.position.y, n.m.position.z, nuc.matrixWorld) })).sort((a, b) => b.s[2] - a.s[2]);
        for (const q of list) {
          const x = q.s[0], y = q.s[1], r = Math.max(1.8, ns * q.s[3]), pr = q.n.p;
          sd(q.i);
          if (r < 4.5) {
            c.fillStyle = pr ? pal.red : pal.paper; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
            c.strokeStyle = pal.ink; c.lineWidth = 0.8; c.stroke(); continue;
          }
          c.fillStyle = pal.paper; c.beginPath(); Ink.blob(c, x, y, r, r * 0.06); c.fill();
          c.strokeStyle = pr ? pal.red : pal.grey; c.lineWidth = pr ? 1.3 : 1; c.beginPath(); Ink.hatch(c, x, y, r * 0.92, pr ? 0.8 : -0.8, pr ? Math.max(1.8, r * 0.22) : Math.max(2.6, r * 0.32), -1); c.stroke();
          c.strokeStyle = pal.ink; c.lineWidth = 1.1; c.beginPath(); Ink.circle(c, x, y, r); c.stroke();
        }
        es.filter(q => q.s[2] <= o[2]).forEach(drawE);
        if (roomy) {
          sd(9001);
          const lx = K.W * 0.06, ly = K.H * 0.17, rN = Math.max(6, R * o[3]) + 5;
          Ink.text(c, "nucleus", lx, ly, 21, pal.ink, "left");
          Ink.text(c, el.Z + " p⁺, " + N + " n⁰", lx, ly + 17, 15, pal.ink2, "left");
          c.strokeStyle = pal.ink2; c.lineWidth = 1.3; c.beginPath(); Ink.arrow(c, lx + 34, ly + 30, o[0] - rN * 0.75, o[1] - rN * 0.75, 0.2); c.stroke();
          if (outer) {
            let ri = 0; for (let k = 2; k < outer.length; k += 2) if (outer[k] > outer[ri]) ri = k;
            const tx = K.W * 0.95, ty = K.H * 0.17;
            Ink.text(c, "valence shell", tx, ty, 21, pal.ink, "right");
            Ink.text(c, el.shells[el.shells.length - 1] + " e⁻ on the outside", tx, ty + 17, 15, pal.ink2, "right");
            c.strokeStyle = pal.gold; c.lineWidth = 1.4; c.beginPath(); Ink.arrow(c, tx - 50, ty + 30, outer[ri] + 3, outer[ri + 1] - 3, -0.22); c.stroke();
          }
        }
      }
    };
  }

  /* ----- Orbital clouds ----- */
  function sampleDir(l, j, rnd) {
    for (let tries = 0; tries < 300; tries++) {
      let x = rnd() * 2 - 1, y = rnd() * 2 - 1, z = rnd() * 2 - 1;
      const m = x * x + y * y + z * z; if (m > 1 || m < 1e-4) continue;
      const s = 1 / Math.sqrt(m); x *= s; y *= s; z *= s;
      let w = 1;
      if (l === 1) w = j === 0 ? x * x : j === 1 ? y * y : z * z;
      else if (l === 2) {
        if (j === 0) w = Math.pow(3 * z * z - 1, 2) / 4; else if (j === 1) w = 4 * x * x * z * z;
        else if (j === 2) w = 4 * y * y * z * z; else if (j === 3) w = 4 * x * x * y * y; else w = Math.pow(x * x - y * y, 2);
      } else if (l === 3) w = Math.pow(z * (5 * z * z - 3), 2) / 4;
      if (rnd() < w) {
        if (l === 3 && j > 0) {
          const a = j * 0.9, b = j * 1.3, y1 = y * Math.cos(a) - z * Math.sin(a), z1 = y * Math.sin(a) + z * Math.cos(a);
          return [x * Math.cos(b) + z1 * Math.sin(b), y1, -x * Math.sin(b) + z1 * Math.cos(b)];
        }
        return [x, y, z];
      }
    }
    return [0, 0, 1];
  }
  const LCOL = [[0.18, 0.51, 0.97], [0.94, 0.53, 0.24], [0.18, 0.63, 0.26], [0.64, 0.44, 0.97]];
  function buildCloud(el) {
    const g = new THREE.Group(), owned = [], rnd = rng(el.Z * 104729 + 7);
    const subs = el.subs.map(k => ({ n: +k[0], l: "spdf".indexOf(k[1]), e: el.occ[k], name: k }));
    const meanR = s => Math.pow((3 * s.n * s.n - s.l * (s.l + 1)) / 2, 0.6);
    const maxM = Math.max(1e-6, ...subs.map(meanR)), S = 5 / maxM;
    let total = 0; subs.forEach(s => { s.P = s.l === 0 ? 38 : 44; total += s.e * s.P; });
    const pos = new Float32Array(total * 3), col = new Float32Array(total * 3), lidx = new Uint8Array(total), tick = new Float32Array(total * 2);
    let p = 0;
    for (const s of subs) {
      const norb = 2 * s.l + 1, mean = S * meanR(s), c = LCOL[s.l];
      for (let e = 0; e < s.e; e++) for (let k = 0; k < s.P; k++) {
        const d = sampleDir(s.l, e % norb, rnd);
        const r = mean * (-Math.log((1 - rnd()) * (1 - rnd()) * (1 - rnd()) * (1 - rnd()))) / 4;
        pos[p * 3] = d[0] * r; pos[p * 3 + 1] = d[1] * r; pos[p * 3 + 2] = d[2] * r;
        col[p * 3] = c[0]; col[p * 3 + 1] = c[1]; col[p * 3 + 2] = c[2]; lidx[p] = s.l;
        const ta = rnd() * 6.2832, tl = 2 + rnd() * 1.8; tick[p * 2] = Math.cos(ta) * tl; tick[p * 2 + 1] = Math.sin(ta) * tl;
        p++;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({ size: 0.12, vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false });
    const nGeo = new THREE.SphereGeometry(0.16, 12, 10), nMat = new THREE.MeshStandardMaterial({ color: 0xe5483a });
    owned.push(geo, mat, nGeo, nMat);
    g.add(new THREE.Points(geo, mat)); g.add(new THREE.Mesh(nGeo, nMat));
    const present = [...new Set(subs.map(s => s.l))];
    const names = "spdf";
    return {
      group: g, owned, baseDist: 5 * 3.5 + 6, update() {},
      tag: "Orbitals · " + el.subs.map(k => k + " " + el.occ[k]).join(" "),
      note: () => "Each dot is a sampled electron position. Dumbbell p lobes, cloverleaf d lobes. Schematic, not to scale between elements.",
      key: present.map(l => ["#" + new THREE.Color(LCOL[l][0], LCOL[l][1], LCOL[l][2]).getHexString(), names[l] + " orbitals"]), bonds: false,
      sketch(c) {
        const pal = PAL, cols = [pal.blue, pal.orange, pal.green, pal.purple], L = 5.8;
        sd(5);
        const ax = [[L, 0, 0, "x"], [0, L, 0, "y"], [0, 0, L, "z"]];
        c.lineWidth = 1.1; c.strokeStyle = pal.ink2; c.globalAlpha = 0.6; c.beginPath();
        for (const a of ax) { const p1 = P(-a[0], -a[1], -a[2]), p2 = P(a[0], a[1], a[2]); Ink.arrow(c, p1[0], p1[1], p2[0], p2[1], 0); }
        c.stroke(); c.globalAlpha = 1;
        for (const a of ax) { const p2 = P(a[0] * 1.08, a[1] * 1.08, a[2] * 1.08); Ink.text(c, a[3], p2[0], p2[1], 19, pal.ink2, "center"); }
        const d0 = P(0, 0, 0)[2], paths = cols.map(() => [new Path2D(), new Path2D(), new Path2D()]);
        for (let i = 0; i < total; i++) {
          const s = P(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]), band = s[2] < d0 - 1.6 ? 0 : s[2] > d0 + 1.6 ? 2 : 1, pth = paths[lidx[i]][band];
          pth.moveTo(s[0], s[1]); pth.lineTo(s[0] + tick[i * 2], s[1] + tick[i * 2 + 1]);
        }
        const alpha = [1, 0.72, 0.4];
        c.lineWidth = 1.7;
        for (let l = 0; l < 4; l++) for (let b = 2; b >= 0; b--) { c.strokeStyle = cols[l]; c.globalAlpha = alpha[b]; c.stroke(paths[l][b]); }
        c.globalAlpha = 1;
        const o = P(0, 0, 0); sd(7);
        c.fillStyle = pal.red; c.beginPath(); Ink.blob(c, o[0], o[1], 4, 0.6); c.fill();
        c.strokeStyle = pal.ink; c.lineWidth = 1; c.beginPath(); Ink.circle(c, o[0], o[1], 4.8); c.stroke();
      }
    };
  }

  /* ----- Crystal lattice ----- */
  const FCC = [[0, 0, 0], [.5, .5, 0], [.5, 0, .5], [0, .5, .5]];
  const cubic = [[1, 0, 0], [0, 1, 0], [0, 0, 1]], hexv = [[1, 0, 0], [-.5, SQ3, 0], [0, 0, 1.633]];
  const rhoV = (() => { const al = 75 * Math.PI / 180, c = Math.cos(al), s = Math.sin(al), cy = (c - c * c) / s;
    return [[1, 0, 0], [c, s, 0], [c, cy, Math.sqrt(1 - c * c - cy * cy)]]; })();
  const LAT = {
    sc: { v: cubic, b: [[0, 0, 0]], n: [2, 2, 2] },
    bcc: { v: cubic, b: [[0, 0, 0], [.5, .5, .5]], n: [2, 2, 2] },
    fcc: { v: cubic, b: FCC, n: [2, 2, 2] },
    dia: { v: cubic, b: FCC.concat(FCC.map(b => [b[0] + .25, b[1] + .25, b[2] + .25])), n: [2, 1, 1] },
    hcp: { v: hexv, b: [[0, 0, 0], [1 / 3, 2 / 3, .5]], n: [2, 2, 1] },
    gra: { v: [[1.732, 0, 0], [-.866, 1.5, 0], [0, 0, 4.718]], b: [[0, 0, 0], [1 / 3, 2 / 3, 0], [0, 0, .5], [2 / 3, 1 / 3, .5]], n: [2, 2, 1] },
    rho: { v: rhoV, b: [[0, 0, 0]], n: [2, 2, 2] },
    tet: { v: [[1, 0, 0], [0, 1, 0], [0, 0, 1.35]], b: [[0, 0, 0], [.5, .5, .5]], n: [2, 2, 2] },
    ort: { v: [[1, 0, 0], [0, 1.25, 0], [0, 0, 1.7]], b: [[0, 0, 0], [.5, .5, 0]], n: [2, 2, 1] },
    mon: { v: [[1, 0, 0], [0, 1.2, 0], [-.26, 0, 1.48]], b: [[0, 0, 0], [.5, .5, 0]], n: [2, 2, 1] },
    hex: { v: [[1, 0, 0], [-.5, SQ3, 0], [0, 0, 1.2]], b: [[0, 0, 0]], n: [2, 2, 2] }
  };
  const EXACT = { sc: 1, bcc: 1, fcc: 1, dia: 1, hcp: 1, gra: 1 };

  function buildLattice(el) {
    const g = new THREE.Group(), owned = [];
    let code = el.crystal; const simplified = code === "cub"; if (simplified) code = "bcc";
    const spec = LAT[code];
    const stateOf = () => !el.melt ? "solid" : st.T < el.melt ? "solid" : (el.boil && st.T >= el.boil) ? "gas" : "liquid";
    const hint = () => {
      const s = stateOf();
      if (s === "solid") return "Solid: atoms vibrate about fixed lattice sites; vibration grows toward the melting point.";
      const lo = s === "liquid" ? "Liquid: the lattice has melted and atoms flow past each other." : "Gas: atoms move freely and bounce around the container.";
      return lo + " Below " + fmt(el.melt, 4) + " K it is a solid.";
    };
    if (!spec) return { group: g, owned, baseDist: 9, update() {}, tag: "Crystal · structure not determined",
      note: () => "The crystal structure of " + el.name + " has not been measured, so no lattice is drawn.", key: [], bonds: false,
      sketch(c) {
        sd(1);
        Ink.text(c, "?", K.W / 2, K.H / 2 - 14, 110, PAL.ink2, "center");
        Ink.text(c, "nobody has measured this one yet", K.W / 2, K.H / 2 + 54, 21, PAL.ink2, "center");
      } };
    const V = spec.v.map(a => new THREE.Vector3(a[0], a[1], a[2])), [n1, n2, n3] = spec.n, pts = [];
    for (let i = 0; i <= n1; i++) for (let j = 0; j <= n2; j++) for (let k = 0; k <= n3; k++) for (const b of spec.b) {
      const fx = i + b[0], fy = j + b[1], fz = k + b[2];
      if (fx > n1 + 1e-6 || fy > n2 + 1e-6 || fz > n3 + 1e-6) continue;
      pts.push(new THREE.Vector3().addScaledVector(V[0], fx).addScaledVector(V[1], fy).addScaledVector(V[2], fz));
    }
    let dnn = 1e9; for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) dnn = Math.min(dnn, pts[i].distanceTo(pts[j]));
    const sc = 1 / dnn; pts.forEach(p => p.multiplyScalar(sc)); V.forEach(v => v.multiplyScalar(sc));
    const box = new THREE.Box3().setFromPoints(pts), ctr = box.getCenter(new THREE.Vector3());
    pts.forEach(p => p.sub(ctr));
    const n = pts.length, base = new Float32Array(n * 3), cur = new Float32Array(n * 3);
    pts.forEach((p, i) => { base[i * 3] = p.x; base[i * 3 + 1] = p.y; base[i * 3 + 2] = p.z; });
    const pairs = []; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (pts[i].distanceTo(pts[j]) < 1.08) pairs.push(i, j);
    const geo = new THREE.SphereGeometry(0.3, 16, 12), mat = new THREE.MeshStandardMaterial({ color: hueColor(el.cat, 0.55), roughness: 0.4, metalness: 0.15 });
    const inst = new THREE.InstancedMesh(geo, mat, n);
    const bGeo = new THREE.BufferGeometry(); bGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pairs.length * 3), 3));
    const bMat = new THREE.LineBasicMaterial({ color: 0x8a97a8, transparent: true, opacity: 0.7 });
    const lines = new THREE.LineSegments(bGeo, bMat);
    const o = ctr.clone().negate(), cp = [], corner = (a, b, c) => o.clone().addScaledVector(V[0], a).addScaledVector(V[1], b).addScaledVector(V[2], c);
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) { cp.push(corner(a, b, 0), corner(a, b, 1), corner(a, 0, b), corner(a, 1, b), corner(0, a, b), corner(1, a, b)); }
    const cg = new THREE.BufferGeometry().setFromPoints(cp), cm = new THREE.LineBasicMaterial({ color: 0xe5483a, transparent: true, opacity: 0.85 });
    g.add(inst, lines, new THREE.LineSegments(cg, cm));
    owned.push(geo, mat, bGeo, bMat, cg, cm);
    const rnd = rng(el.Z * 31 + 5), ph = new Float32Array(n * 3), fr = new Float32Array(n * 3), vel = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) { ph[i] = rnd() * 6.283; fr[i] = 6 + rnd() * 6; vel[i] = rnd() * 2 - 1; }
    let ext = 0; for (let i = 0; i < n * 3; i++) ext = Math.max(ext, Math.abs(base[i])); ext += 0.8;
    const melt = el.melt || 1500, dummy = new THREE.Object3D(); let lastSt = "";
    const initGas = () => { for (let i = 0; i < n * 3; i++) { cur[i] = (rnd() * 2 - 1) * ext; vel[i] = (rnd() * 2 - 1) * 0.9; } };
    return {
      group: g, owned, baseDist: ext * 3.2 + 3,
      update(t, dt) {
        const s = stateOf();
        if (s !== lastSt) { if (s === "gas") initGas(); lastSt = s; }
        const f = Math.min(st.T, melt) / melt;
        if (s === "gas") {
          const sp = Math.min(7, 1.4 + 3 * Math.sqrt(st.T / 1000));
          for (let i = 0; i < n * 3; i++) { cur[i] += vel[i] * dt * sp; if (cur[i] > ext) { cur[i] = ext; vel[i] = -Math.abs(vel[i]); } else if (cur[i] < -ext) { cur[i] = -ext; vel[i] = Math.abs(vel[i]); } }
        } else {
          const amp = s === "solid" ? 0.015 + 0.1 * Math.sqrt(f) : 0.32, ex = s === "solid" ? 1 + 0.05 * f : 1.2, sl = s === "solid" ? 1 : 0.28;
          for (let i = 0; i < n * 3; i++) cur[i] = base[i] * ex + amp * Math.sin(t * fr[i] * sl + ph[i]);
        }
        for (let i = 0; i < n; i++) { dummy.position.set(cur[i * 3], cur[i * 3 + 1], cur[i * 3 + 2]); dummy.updateMatrix(); inst.setMatrixAt(i, dummy.matrix); }
        inst.instanceMatrix.needsUpdate = true;
        lines.visible = st.bonds && s === "solid";
        if (lines.visible) {
          const a = bGeo.attributes.position.array;
          for (let k = 0; k < pairs.length; k += 2) { const i = pairs[k] * 3, j = pairs[k + 1] * 3, q = k * 3;
            a[q] = cur[i]; a[q + 1] = cur[i + 1]; a[q + 2] = cur[i + 2]; a[q + 3] = cur[j]; a[q + 4] = cur[j + 1]; a[q + 5] = cur[j + 2]; }
          bGeo.attributes.position.needsUpdate = true;
        }
      },
      tag: "Crystal · " + CRYSTAL_NAME[el.crystal === "cub" ? "bcc" : el.crystal].split(" (")[0] + " · " + n1 + "×" + n2 + "×" + n3 + " cells",
      note: () => hint() + (simplified ? " Shown as simplified BCC; the real cell holds 58 atoms." : EXACT[code] ? "" : " Schematic cell."),
      key: [[hex(hueColor(el.cat, 0.55)), el.name + " atom"], ["#e5483a", "Unit cell"]], bonds: true,
      sketch(c) {
        const pal = PAL, s = stateOf();
        sd(11); c.strokeStyle = pal.red; c.lineWidth = 1.5; c.globalAlpha = s === "solid" ? 0.85 : 0.35; c.beginPath();
        for (let k = 0; k < cp.length; k += 2) { const a = P(cp[k].x, cp[k].y, cp[k].z), b = P(cp[k + 1].x, cp[k + 1].y, cp[k + 1].z); Ink.line(c, a[0], a[1], b[0], b[1]); }
        c.stroke(); c.globalAlpha = 1;
        if (st.bonds && s === "solid") {
          sd(12); c.strokeStyle = pal.ink2; c.lineWidth = 1.1; c.beginPath();
          for (let k = 0; k < pairs.length; k += 2) { const i = pairs[k] * 3, j = pairs[k + 1] * 3, a = P(cur[i], cur[i + 1], cur[i + 2]), b = P(cur[j], cur[j + 1], cur[j + 2]);
            Ink.line(c, a[0], a[1], b[0], b[1], { passes: 1 }); }
          c.stroke();
        }
        const list = [];
        for (let i = 0; i < n; i++) list.push([i, P(cur[i * 3], cur[i * 3 + 1], cur[i * 3 + 2])]);
        list.sort((a, b) => b[1][2] - a[1][2]);
        const wash = catColor(el.cat, 1);
        for (const [i, p] of list) {
          const x = p[0], y = p[1], r = Math.max(3, 0.24 * p[3]);
          sd(100 + i);
          if (s !== "solid") {
            let ux, uy;
            if (s === "gas") { const t = P(cur[i * 3] - vel[i * 3] * 0.5, cur[i * 3 + 1] - vel[i * 3 + 1] * 0.5, cur[i * 3 + 2] - vel[i * 3 + 2] * 0.5); ux = x - t[0]; uy = y - t[1]; }
            else { ux = Math.cos(i * 2.1); uy = Math.sin(i * 2.1); }
            const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
            c.strokeStyle = pal.ink2; c.lineWidth = 1; c.globalAlpha = 0.6; c.beginPath();
            for (const off of [-0.45, 0.45]) {
              const bx = x - ux * r * 1.25 - uy * r * off, by = y - uy * r * 1.25 + ux * r * off;
              Ink.squiggle(c, bx, by, bx - ux * r * (s === "gas" ? 1.8 : 0.9), by - uy * r * (s === "gas" ? 1.8 : 0.9), r * 0.12, 3);
            }
            c.stroke(); c.globalAlpha = 1;
          }
          c.fillStyle = pal.paper; c.beginPath(); Ink.blob(c, x, y, r, r * 0.05); c.fill();
          c.globalAlpha = pal.chalk ? 0.7 : 0.62; c.fillStyle = wash; c.beginPath(); Ink.blob(c, x + r * 0.07, y + r * 0.05, r * 0.95, r * 0.1); c.fill();
          c.globalAlpha = 0.55; c.strokeStyle = pal.ink2; c.lineWidth = 0.9; c.beginPath(); Ink.hatch(c, x, y, r * 0.92, 0.785, Math.max(2, r * 0.17), 0.12); c.stroke();
          c.globalAlpha = 1; c.strokeStyle = pal.ink; c.lineWidth = 1.3; c.beginPath(); Ink.circle(c, x, y, r, { passes: r > 12 ? 2 : 1 }); c.stroke();
        }
      }
    };
  }

  /* ----- Light: emission spectrum and flame test (flat 2D drawing) ----- */
  function buildLight(el) {
    const lines = SPECTRA[el.Z], flame = FLAME[el.Z];
    const top = lines ? lines.slice().sort((a, b) => b[1] - a[1]).slice(0, 3) : [];
    return {
      group: new THREE.Group(), owned: [], baseDist: 10, flat: true, update() {}, key: [], bonds: false,
      tag: "Light · " + (lines ? "emission spectrum" : "no line data") + (flame ? " · flame test" : ""),
      note: () => (lines ? "Each bright line is light given off when an excited electron drops to a lower shell. " : "No visible line data for " + el.name + " in this notebook; try H, He, Na, Ne, Hg or Cu. ") +
        (flame ? el.name + " colours a flame " + flame[1] + "." : "No well-known flame colour."),
      sketch(c) {
        const pal = PAL, W = K.W, H = K.H, x0 = 22, x1 = W - 18, sw = x1 - x0, X = nm => x0 + (nm - 380) / 370 * sw;
        const y0 = 62, sh = Math.max(44, H * 0.15);
        sd(1); Ink.text(c, "emission spectrum", x0, y0 - 14, 20, pal.ink, "left");
        c.fillStyle = "#0e0e14"; c.beginPath(); Ink.poly(c, [x0, y0, x1, y0, x1, y0 + sh, x0, y0 + sh], true, 0.8); c.fill();
        if (lines) {
          for (const [nm, I] of lines) {
            if (nm < 380 || nm > 750) continue;
            const x = X(nm); sd(Math.round(nm * 10));
            c.strokeStyle = nmColor(nm); c.globalAlpha = 0.35 + 0.65 * I; c.lineWidth = 1.3 + 2.6 * I; c.beginPath();
            c.moveTo(x + Ink.j(0.5), y0 + 3); c.lineTo(x + Ink.j(0.5), y0 + sh - 3); c.stroke();
          }
          c.globalAlpha = 1;
        } else Ink.text(c, "no line data for " + el.sym, (x0 + x1) / 2, y0 + sh / 2, 18, "#9a9aa8", "center");
        sd(2); c.strokeStyle = pal.ink; c.lineWidth = 1.5; c.beginPath(); Ink.poly(c, [x0, y0, x1, y0, x1, y0 + sh, x0, y0 + sh], true, 0.8); c.stroke();
        const ry = y0 + sh + 8, rh = 10;
        for (let nm = 380; nm < 750; nm += 2) { c.fillStyle = nmColor(nm); c.fillRect(X(nm), ry, sw / 185 + 0.7, rh); }
        c.strokeStyle = pal.ink; c.lineWidth = 1; c.beginPath(); Ink.poly(c, [x0, ry, x1, ry, x1, ry + rh, x0, ry + rh], true, 0.5); c.stroke();
        c.font = "11px 'Courier Prime', monospace"; c.fillStyle = pal.ink2; c.textAlign = "center"; c.textBaseline = "top"; c.beginPath();
        for (let nm = 400; nm <= 700; nm += 50) { const x = X(nm); c.moveTo(x, ry + rh); c.lineTo(x, ry + rh + 4); c.fillText(nm + (nm === 700 ? " nm" : ""), x, ry + rh + 6); }
        c.stroke();
        top.forEach(([nm], i) => { const x = X(nm); Ink.text(c, nm.toFixed(1), x, y0 + sh + 46 + (i % 2) * 15, 15, pal.ink2, "center"); });
        // flame test
        const base = H - 34, cx = W / 2, tubeH = Math.min(78, H * 0.16), fh = Math.max(60, base - tubeH - (ry + rh + 90));
        sd(3); c.strokeStyle = pal.ink; c.lineWidth = 1.5;
        c.beginPath(); Ink.poly(c, [cx - 13, base - tubeH, cx + 13, base - tubeH, cx + 13, base, cx - 13, base], true, 0.7); c.fillStyle = pal.paper; c.fill(); c.stroke();
        c.strokeStyle = pal.ink2; c.lineWidth = 1; c.beginPath(); Ink.hatch(c, cx + 4, base - tubeH / 2, 9, 0.6, 3, -0.2); c.stroke();
        c.strokeStyle = pal.ink; c.lineWidth = 1.5; c.beginPath(); Ink.poly(c, [cx - 40, base, cx + 40, base, cx + 34, base + 10, cx - 34, base + 10], true, 0.7); c.stroke();
        const t = st.t, tipX = cx + Math.sin(t * 6.3) * 5 + Math.sin(t * 11) * 2, tipY = base - tubeH - fh + Math.sin(t * 8) * 4, w = Math.max(26, fh * 0.2) + Math.sin(t * 5) * 2, by = base - tubeH;
        const path = () => { c.beginPath(); c.moveTo(cx - 11, by); c.bezierCurveTo(cx - w * 1.4, by - fh * 0.35, cx - w * 0.5, by - fh * 0.75, tipX, tipY); c.bezierCurveTo(cx + w * 0.5, by - fh * 0.75, cx + w * 1.4, by - fh * 0.35, cx + 11, by); c.closePath(); };
        path();
        const gr = c.createLinearGradient(0, by, 0, tipY);
        if (flame) { gr.addColorStop(0, "rgba(90,140,255,.85)"); gr.addColorStop(0.18, flame[0]); gr.addColorStop(1, "rgba(255,255,255,0)"); }
        else { gr.addColorStop(0, "rgba(70,120,255,.8)"); gr.addColorStop(0.4, "rgba(120,160,255,.35)"); gr.addColorStop(1, "rgba(160,190,255,0)"); }
        c.fillStyle = gr; c.globalAlpha = 0.9; c.fill(); c.globalAlpha = 1;
        sd(4 + K.frame); c.strokeStyle = flame ? flame[0] : pal.blue; c.lineWidth = 1.4; path(); c.stroke();
        Ink.text(c, flame ? "flame test: " + flame[1] : "no distinctive flame colour", cx + 52, by - fh * 0.45, 19, pal.ink, "left");
      }
    };
  }

  /* ----- Decay particles (shared by both renderers) ----- */
  const parts = [];
  function emit(kind, done) {
    const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.6 + 0.2, Math.random() - 0.5).normalize();
    const g = new THREE.Group(), owned = [];
    const mk = (col, r, x, y, z) => { const geo = new THREE.SphereGeometry(r, 12, 10), m = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.3 }); owned.push(geo, m); const ms = new THREE.Mesh(geo, m); ms.position.set(x, y, z); g.add(ms); };
    if (kind === "alpha") { mk(0xe5483a, 0.17, 0.1, 0.1, 0); mk(0xe5483a, 0.17, -0.1, -0.1, 0.05); mk(0x9aa6b4, 0.17, -0.1, 0.1, -0.05); mk(0x9aa6b4, 0.17, 0.1, -0.1, 0.05); }
    else mk(kind === "beta-" ? 0x2f8cff : 0xff5fa2, 0.13, 0, 0, 0);
    scene.add(g); parts.push({ kind, dir, g, owned, t0: st.t, done });
  }
  function stepParticles() {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i], age = st.t - p.t0;
      p.g.position.copy(p.dir).multiplyScalar(0.4 + age * 3 + age * age * 6);
      if (age > 1.6) { scene.remove(p.g); p.owned.forEach(o => o.dispose()); parts.splice(i, 1); if (p.done) p.done(); }
    }
  }
  function drawParticles(c) {
    for (const p of parts) {
      const w = p.g.position, s = P(w.x, w.y, w.z), b = P(w.x - p.dir.x * 1.4, w.y - p.dir.y * 1.4, w.z - p.dir.z * 1.4);
      const col = p.kind === "alpha" ? PAL.red : p.kind === "beta-" ? PAL.blue : PAL.purple, nx = -(s[1] - b[1]), ny = s[0] - b[0], nl = Math.hypot(nx, ny) || 1;
      sd(7777); c.strokeStyle = PAL.ink2; c.lineWidth = 1.2; c.globalAlpha = 0.6; c.beginPath();
      for (const o of [-5, 0, 5]) Ink.line(c, b[0] + nx / nl * o, b[1] + ny / nl * o, s[0] + nx / nl * o * 0.3, s[1] + ny / nl * o * 0.3, { passes: 1 });
      c.stroke(); c.globalAlpha = 1;
      const r = Math.max(4, (p.kind === "alpha" ? 0.3 : 0.14) * s[3]);
      c.fillStyle = col; c.beginPath(); Ink.blob(c, s[0], s[1], r, r * 0.12); c.fill();
      c.strokeStyle = PAL.ink; c.lineWidth = 1.2; c.beginPath(); Ink.circle(c, s[0], s[1], r + 0.5); c.stroke();
      Ink.text(c, p.kind === "alpha" ? "α particle (2p, 2n)" : p.kind === "beta-" ? "β⁻ electron" : "β⁺ positron", s[0] + r + 6, s[1] - r - 8, 18, PAL.ink, "left");
    }
  }

  /* ----- Scene management ----- */
  function teardown() {
    if (!current) return;
    scene.remove(current.group); current.owned.forEach(o => o.dispose()); current = null;
  }
  function show(el, view) {
    teardown();
    const b = view === "cloud" ? buildCloud(el) : view === "lattice" ? buildLattice(el) : view === "light" ? buildLight(el) : buildAtom(el);
    const ratio = orbit.dist / orbit.baseDist; orbit.baseDist = b.baseDist; orbit.dist = b.baseDist * ratio;
    scene.add(b.group); current = b; applyCanvas();
    return { tag: b.tag, note: b.note(), key: b.key, bonds: b.bonds };
  }
  function note() { return current ? current.note() : ""; }
  function resize() {
    const w = stageEl.clientWidth, h = stageEl.clientHeight; if (!w || !h) return;
    K.W = w; K.H = h; K.dpr = Math.min(window.devicePixelRatio || 1, 2);
    camera.aspect = w / h; camera.updateProjectionMatrix(); K.F = (h / 2) / Math.tan(camera.fov * Math.PI / 360);
    skEl.width = Math.round(w * K.dpr); skEl.height = Math.round(h * K.dpr);
    if (renderer) renderer.setSize(w, h, false);
  }
  function placeCamera() {
    const sp = Math.sin(orbit.phi);
    camera.position.set(orbit.dist * sp * Math.sin(orbit.theta), orbit.dist * Math.cos(orbit.phi), orbit.dist * sp * Math.cos(orbit.theta));
    camera.lookAt(0, 0, 0);
  }
  function zoom(f) { orbit.dist = clamp(orbit.dist * f, orbit.baseDist * 0.3, orbit.baseDist * 2.6); }
  function drawSketch() {
    scene.updateMatrixWorld(); camera.updateMatrixWorld();
    const c = sk; c.setTransform(K.dpr, 0, 0, K.dpr, 0, 0); c.clearRect(0, 0, K.W, K.H);
    if (!current || !current.sketch) return;
    c.lineCap = "round"; c.lineJoin = "round"; c.globalAlpha = 1;
    K.frame = st.wobble ? Math.floor(st.t * 7) : 0;
    current.sketch(c);
    drawParticles(c);
  }
  const use2d = () => mode === "sketch" || !!(current && current.flat);
  let shown2d = null;
  function applyCanvas() {
    if (!glEl) return;
    const u = use2d();
    if (u !== shown2d) { shown2d = u; glEl.hidden = u; skEl.hidden = !u; }
    stageEl.dataset.mode = u ? "sketch" : "3d";
  }
  function frame() {
    placeCamera(); applyCanvas();
    if (use2d()) { Ink.setAmp(mode === "sketch" ? 1 : 0.12); drawSketch(); Ink.setAmp(1); } else renderer.render(scene, camera);
  }

  function init(glCanvas, skCanvas, stage, reduced) {
    stageEl = stage; glEl = glCanvas; skEl = skCanvas; sk = skEl.getContext("2d"); orbit.spin = !reduced; st.wobble = !reduced;
    scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const d1 = new THREE.DirectionalLight(0xffffff, 0.85); d1.position.set(5, 8, 6); scene.add(d1);
    const d2 = new THREE.DirectionalLight(0xffffff, 0.35); d2.position.set(-6, -3, -5); scene.add(d2);
    try {
      renderer = new THREE.WebGLRenderer({ canvas: glEl, antialias: true, alpha: true });
      renderer.setClearColor(0x000000, 0); renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    } catch (e) { renderer = null; mode = "sketch"; }
    resize(); new ResizeObserver(resize).observe(stage);
    new IntersectionObserver(es => { st.visible = es[0].isIntersecting; }).observe(stage);
    const ptrs = new Map(); let pinch = 0;
    stage.addEventListener("pointerdown", e => { try { stage.setPointerCapture(e.pointerId); } catch (_) {} ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); });
    stage.addEventListener("pointermove", e => {
      const p = ptrs.get(e.pointerId); if (!p) return;
      if (ptrs.size === 1) { orbit.theta -= (e.clientX - p.x) * 0.008; orbit.phi = clamp(orbit.phi - (e.clientY - p.y) * 0.008, 0.15, Math.PI - 0.15); }
      p.x = e.clientX; p.y = e.clientY;
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch) zoom(pinch / d); pinch = d; }
    });
    const up = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = 0; };
    stage.addEventListener("pointerup", up); stage.addEventListener("pointercancel", up);
    stage.addEventListener("wheel", e => { e.preventDefault(); zoom(Math.exp(e.deltaY * 0.0012)); }, { passive: false });
    let last = performance.now();
    const loop = now => {
      requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!st.visible || document.hidden) return;
      st.t += dt;
      if (orbit.spin && !ptrs.size) orbit.theta += dt * 0.3;
      if (current) current.update(st.t, dt);
      stepParticles();
      frame();
    };
    requestAnimationFrame(loop);
    return !!renderer;
  }
  // Returns a PNG data URL of the current drawing on a paper background, with a handwritten caption.
  function snapshot(caption) {
    frame();
    const W = K.W, H = K.H, d = 2, cv = document.createElement("canvas");
    cv.width = W * d; cv.height = (H + 46) * d;
    const c = cv.getContext("2d"); c.scale(d, d);
    c.fillStyle = PAL.paper; c.fillRect(0, 0, W, H + 46);
    c.strokeStyle = PAL.rule; c.lineWidth = 1; c.beginPath();
    for (let x = 0; x < W; x += 20) { c.moveTo(x + .5, 0); c.lineTo(x + .5, H); }
    for (let y = 0; y < H; y += 20) { c.moveTo(0, y + .5); c.lineTo(W, y + .5); }
    c.stroke();
    c.drawImage(use2d() ? skEl : glEl, 0, 0, W, H);
    Ink.seed(42); c.strokeStyle = PAL.ink2; c.lineWidth = 1.2; c.beginPath(); Ink.line(c, 12, H + 4, W - 12, H + 4, { passes: 1 }); c.stroke();
    Ink.text(c, caption, 14, H + 25, 23, PAL.ink, "left");
    return cv.toDataURL("image/png");
  }
  return {
    init, show, note, snapshot, emit,
    hasGL: () => !!renderer,
    busy: () => parts.length > 0,
    setMode(m) { mode = renderer ? m : "sketch"; shown2d = null; applyCanvas(); return mode; },
    setT(T) { st.T = T; },
    setBonds(b) { st.bonds = b; },
    setSpin(b) { orbit.spin = b; },
    setWobble(b) { st.wobble = b; },
    reset() { orbit.theta = 0.6; orbit.phi = 1.2; orbit.dist = orbit.baseDist; }
  };
})();


/* ---------- Interface ---------- */
(() => {
  const $ = id => document.getElementById(id);
  const tableEl = $("table"), qEl = $("q"), modeEl = $("mode"), tempEl = $("temp"), tempOut = $("tempout");
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
  const dprOf = () => Math.min(window.devicePixelRatio || 1, 2);
  const PAGE_EL = clamp(+document.body.dataset.element || 26, 1, 118);
  const S = { sel: 0, view: "atom", T: 298, mode: "cat", cat: null, q: "", formula: null, M: 0, hoverZ: 0,
    theme: store.get("theme", "paper"), render: store.get("render", "3d"), wobble: store.get("wobble", true),
    trend: store.get("trend", "en"), nb: store.get("nb", "trends"), pins: store.get("pins", []), notes: store.get("notes", {}),
    charge: 0, N: null, build: null, timeline: null, hoverSt: 0, nucZoom: "close", nucHover: null };
  if (!Array.isArray(S.pins)) S.pins = [];
  if (!S.notes || typeof S.notes !== "object") S.notes = {};
  const tiles = {};
  const VIR = [[68,1,84],[59,82,139],[33,144,141],[93,200,99],[253,231,37]];
  const rampRGB = t => { t = clamp(t, 0, 1); const x = t * (VIR.length - 1), i = Math.min(VIR.length - 2, Math.floor(x)), f = x - i;
    return VIR[i].map((v, k) => Math.round(v + (VIR[i + 1][k] - v) * f)); };
  const lum = c => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  const STATE_COL = { solid: ["#3b528b", "#fff"], liquid: ["#21908d", "#fff"], gas: ["#e8c61a", "#10161d"], unknown: ["#a59f92", "#10161d"] };
  const STATE_LBL = { solid: "Solid", liquid: "Liquid", gas: "Gas", unknown: "Unknown" };
  const BLOCK_HUE = { s: 8, p: 45, d: 200, f: 290 };
  const MODES = {
    en:    { get: e => e.en,   unit: " (Pauling)", log: false },
    mass:  { get: e => e.mass, unit: " u", log: false },
    rad:   { get: e => e.rad,  unit: " pm", log: false },
    dens:  { get: e => e.dens, unit: " g/cm³", log: true },
    melt:  { get: e => e.melt, unit: " K", log: false },
    boil:  { get: e => e.boil, unit: " K", log: false },
    year:  { get: e => e.year || 1600, unit: "", log: false },
    ie:    { get: e => e.ie, unit: " kJ/mol", log: false },
    ea:    { get: e => e.ea, unit: " kJ/mol", log: false },
    crust: { get: e => e.crust, unit: " mg/kg", log: true },
    body:  { get: e => e.body, unit: " %", log: true }
  };
  const crustText = v => !v ? "n/a" : v >= 10000 ? fmt(v / 10000, 3) + " %" : fmt(v, 3) + " mg/kg";
  const prettyConfig = s => s.replace(/(\d[spdf]) (\d+)/g, "$1<sup>$2</sup>");
  let toastT = 0;
  function toast(msg) { const t = $("toast"); const host = $("simmodal") && $("simmodal").open ? $("simmodal") : document.body; if (t.parentNode !== host) host.appendChild(t); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2000); }

  /* ----- Sound: soft pencil scratches made from filtered noise (off by default) ----- */
  const Sound = (() => {
    let ac = null, buf = null, pen = null, on = !!store.get("sound", false);
    function ctx() {
      if (!ac) {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
        const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ac.state === "suspended") ac.resume();
      return ac;
    }
    function chain() {
      const a = ctx(), src = a.createBufferSource(); src.buffer = buf; src.loop = true; src.playbackRate.value = 0.8 + Math.random() * 0.4;
      const bp = a.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 2400 + Math.random() * 1600; bp.Q.value = 0.8;
      const hp = a.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 900;
      const g = a.createGain(); g.gain.value = 0.0001;
      src.connect(bp); bp.connect(hp); hp.connect(g); g.connect(a.destination); src.start();
      return { src, g };
    }
    function scribble(dur) {
      if (!on) return;
      try {
        const a = ctx(), ch = chain(), t = a.currentTime, n = Math.max(1, Math.round(dur * 7));
        for (let i = 0; i < n; i++) { const s = t + i * dur / n + Math.random() * 0.02; ch.g.gain.setValueAtTime(0.0001, s); ch.g.gain.linearRampToValueAtTime(0.06 + Math.random() * 0.05, s + 0.03); ch.g.gain.linearRampToValueAtTime(0.0001, s + dur / n * 0.9); }
        ch.src.stop(t + dur + 0.15);
      } catch (_) {}
    }
    function penStart() { if (!on) return; try { pen = chain(); } catch (_) { pen = null; } }
    function penMove(speed) { if (pen) try { pen.g.gain.setTargetAtTime(Math.min(0.12, speed * 0.012), ac.currentTime, 0.02); } catch (_) {} }
    function penEnd() { if (!pen) return; const p = pen; pen = null; try { p.g.gain.setTargetAtTime(0.0001, ac.currentTime, 0.03); p.src.stop(ac.currentTime + 0.25); } catch (_) {} }
    return { scribble, penStart, penMove, penEnd, isOn: () => on, set(b) { on = b; store.set("sound", b); if (b) { try { ctx(); } catch (_) {} scribble(0.4); } } };
  })();

  /* ----- Electron state: ions and the build-up animation ----- */
  function ionOcc(el, E) {
    const occ = Object.assign({}, el.occ);
    let d = el.Z - E;
    while (d > 0) {
      const ks = Object.keys(occ).filter(k => occ[k] > 0).sort((a, b) => (+b[0] - +a[0]) || ("spdf".indexOf(b[1]) - "spdf".indexOf(a[1])));
      if (!ks.length) break; occ[ks[0]]--; d--;
    }
    while (d < 0) { const k = ORDER.find(k => (occ[k] || 0) < CAP[k[1]]); if (!k) break; occ[k] = (occ[k] || 0) + 1; d++; }
    return occ;
  }
  function variantOf(el) {
    const building = S.build !== null, E = building ? S.build : el.Z - S.charge;
    const occ = building ? (S.build === el.Z ? Object.assign({}, el.occ) : fill(S.build, false)) : (E === el.Z ? el.occ : ionOcc(el, E));
    const subs = Object.keys(occ).filter(k => occ[k] > 0).sort(subOrder);
    const shells = []; subs.forEach(k => { shells[+k[0] - 1] = (shells[+k[0] - 1] || 0) + occ[k]; });
    for (let i = 0; i < shells.length; i++) shells[i] = shells[i] || 0;
    let core = 0;
    for (const n of NOBLE) if (n < E) { const co = fill(n, false); if (Object.keys(co).every(k => (occ[k] || 0) >= co[k])) core = n; }
    const co = core ? fill(core, false) : {};
    const rest = subs.map(k => [k, occ[k] - (co[k] || 0)]).filter(x => x[1] > 0);
    const config = ((core ? "[" + ELEMENTS[core - 1].sym + "] " : "") + rest.map(x => x[0] + " " + x[1]).join(" ")).trim();
    const v = Object.create(el);
    Object.assign(v, { occ, subs, shells, rest, core: core ? ELEMENTS[core - 1].sym : "", config: config || "no electrons",
      neutrons: S.N === null ? el.neutrons : S.N, E, charge: building ? 0 : el.Z - E });
    return v;
  }

  /* ----- Table ----- */
  function buildTable() {
    tableEl.querySelectorAll(".tile[data-z]").forEach(b => {
      const el = ELEMENTS[+b.dataset.z - 1];
      tiles[el.Z] = b;
      b.addEventListener("click", () => Q.on ? quizAnswer(el) : select(el.Z, true));
    });
    tableEl.querySelectorAll(".ph[data-cat]").forEach(d => d.addEventListener("click", () => { S.cat = S.cat === d.dataset.cat ? null : d.dataset.cat; refresh(); }));
  }

  function matches(el) {
    if (S.cat && el.cat !== S.cat) return false;
    const q = S.q.trim().toLowerCase(); if (!q) return true;
    return el.name.toLowerCase().includes(q) || el.sym.toLowerCase() === q || String(el.Z) === q || el.sym.toLowerCase().startsWith(q) && q.length < 3;
  }

  function refresh() {
    const m = S.mode, md = MODES[m];
    let lo = 0, hi = 1, unknown = 0;
    const counts = { solid: 0, liquid: 0, gas: 0, unknown: 0 };
    if (md) {
      const vals = ELEMENTS.map(md.get).filter(v => v > 0).map(v => md.log ? Math.log10(v) : v);
      lo = Math.min(...vals); hi = Math.max(...vals);
    }
    const tl = S.timeline;
    ELEMENTS.forEach(el => {
      const t = tiles[el.Z], s = stateAt(el, S.T); counts[s]++;
      t.querySelector(".st").dataset.s = s;
      t.classList.toggle("dim", !Q.on && !matches(el));
      t.classList.toggle("hl", !Q.on && S.nb === "molar" && !!(S.formula && S.formula[el.sym]));
      t.classList.toggle("undisc", tl !== null && (el.year || 0) > tl);
      t.classList.toggle("fresh", tl !== null && tl > 1600 && !!el.year && el.year <= tl && el.year > tl - 6);
      t.classList.toggle("has-note", !!S.notes[el.Z]);
      t.style.color = "";
      if (m === "cat") { t.style.backgroundColor = ""; t.style.setProperty("--h", CAT_HUE[el.cat]); }
      else if (m === "block") { t.style.backgroundColor = ""; t.style.setProperty("--h", BLOCK_HUE[el.block]); }
      else if (m === "haz") { const h = el.haz[0]; if (h) { t.style.backgroundColor = ""; t.style.setProperty("--h", HAZ[h][3]); } else t.style.backgroundColor = "var(--paper-2)"; }
      else if (m === "state") { t.style.backgroundColor = STATE_COL[s][0]; t.style.color = STATE_COL[s][1]; }
      else {
        const v = md.get(el);
        if (!(v > 0)) { unknown++; t.style.backgroundColor = "var(--paper-2)"; t.style.color = "var(--ink-2)"; }
        else { const x = md.log ? Math.log10(v) : v, rgb = rampRGB((x - lo) / (hi - lo || 1));
          t.style.backgroundColor = "rgb(" + rgb.join(",") + ")"; t.style.color = lum(rgb) < 135 ? "#fff" : "#10161d"; }
      }
    });
    const kb = $("keybox");
    if (m === "cat") {
      kb.innerHTML = '<div class="legend">' + CATEGORIES.map(c => '<button type="button" class="lg" data-c="' + c[0] + '" aria-pressed="' + (S.cat === c[0]) + '" data-tip="Highlight the ' + c[1].toLowerCase() + 's (tap again to clear)"><i style="--h:' + c[2] + '"></i>' + c[1] + '</button>').join("") + '</div><p class="keytxt">Tap a category to highlight it. Tap an element to open its page.</p>';
      kb.querySelectorAll(".lg").forEach(b => b.addEventListener("click", () => { S.cat = S.cat === b.dataset.c ? null : b.dataset.c; refresh(); }));
    } else if (m === "block") {
      kb.innerHTML = '<div class="legend">' + Object.keys(BLOCK_HUE).map(k => '<span class="lg" style="cursor:default"><i style="--h:' + BLOCK_HUE[k] + '"></i>' + k + '-block</span>').join("") +
        '</div><p class="keytxt">The block is the subshell that the last electron fills: s on the left, p on the right, d in the middle, f below.</p>';
    } else if (m === "haz") {
      kb.innerHTML = '<div class="legend">' + HAZ_DEF.map(h => '<span class="lg" style="cursor:default"><i style="--h:' + h[3] + '"></i>' + h[1] + " " + h[2] + '</span>').join("") +
        '<span class="lg" style="cursor:default"><i style="background:var(--paper-2)"></i>No major hazard</span></div><p class="keytxt">Main hazard of the pure element. Rough guide only; compounds can behave very differently.</p>';
    } else if (m === "state") {
      kb.innerHTML = '<div class="legend">' + ["solid", "liquid", "gas", "unknown"].map(k => '<span class="lg" style="cursor:default"><i style="background:' + STATE_COL[k][0] + '"></i>' + STATE_LBL[k] + ' (' + counts[k] + ')</span>').join("") +
        '</div><p class="keytxt">State of each element at ' + S.T + ' K (' + fmt(S.T - 273.15, 4) + ' °C) and 1 atm. Drag the temperature slider to melt and boil the table.</p>';
    } else {
      const f = x => { const v = md.log ? Math.pow(10, x) : x; return m === "year" ? (v <= 1600 ? "antiquity" : Math.round(v)) : m === "crust" ? crustText(v) : fmt(v, 3) + md.unit; };
      const stops = [0, .25, .5, .75, 1].map(t => "rgb(" + rampRGB(t).join(",") + ")").join(",");
      kb.innerHTML = '<div class="ramp" style="background:linear-gradient(90deg,' + stops + ')"></div><div class="ramp-l"><span>' + f(lo) + '</span><span>' + (md.log ? "log scale" : "") + '</span><span>' + f(hi) + '</span></div><p class="keytxt">' +
        (unknown ? unknown + " elements have no value (left blank)." : "All elements have a value.") + '</p>';
    }
  }

  /* ----- Details panel ----- */
  const row = (k, v) => '<div><dt>' + k + '</dt><dd>' + v + '</dd></div>';
  function orbitalBoxes(v) {
    let h = v.core ? '<div class="og"><div class="obs"><span class="ob coreb">[' + v.core + ']</span></div><small>core</small></div>' : "";
    for (const [k, n] of v.rest) {
      const m = 2 * "spdf".indexOf(k[1]) + 1, up = Math.min(n, m), dn = Math.max(0, n - m);
      h += '<div class="og"><div class="obs">' + Array.from({ length: m }, (_, i) => '<span class="ob">' + (i < up ? "↑" : "") + (i < dn ? "↓" : "") + '</span>').join("") + '</div><small>' + k + '</small></div>';
    }
    return h || '<span class="muted">No electrons.</span>';
  }
  function renderLewis(el, v) {
    const nmax = el.shells.length;
    let ve = 0; for (const k of v.subs) if (+k[0] === nmax && (k[1] === "s" || k[1] === "p")) ve += v.occ[k];
    const sides = [0, 0, 0, 0];
    if (ve === 2 && el.Z === 2) sides[0] = 2; else for (let i = 0; i < ve; i++) sides[i % 4]++;
    const cx = 60, cy = 54, dot = (x, y) => '<circle cx="' + x + '" cy="' + y + '" r="3.4" fill="currentColor"/>';
    let h = '<text x="60" y="56" text-anchor="middle" dominant-baseline="middle" font-family="Caveat, cursive" font-weight="700" font-size="40" fill="currentColor">' + el.sym + '</text>';
    sides.forEach((n, i) => {
      (n === 1 ? [0] : n === 2 ? [-7, 7] : []).forEach(o => {
        if (i === 0) h += dot(cx + o, cy - 29); else if (i === 1) h += dot(cx + 29, cy + o); else if (i === 2) h += dot(cx + o, cy + 29); else h += dot(cx - 29, cy + o);
      });
    });
    if (v.charge) {
      h += '<path d="M24 16 L16 16 L16 92 L24 92 M96 16 L104 16 L104 92 L96 92" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
        '<text x="108" y="14" font-family="Caveat, cursive" font-weight="700" font-size="20" fill="currentColor">' + chargeText(v.charge) + '</text>';
    }
    const svg = $("lewis"); svg.innerHTML = h; svg.style.color = "var(--ink)";
    $("lewisnote").textContent = el.block === "d" || el.block === "f" ? "outer s electrons only" : ve === 8 || (el.Z === 2 && ve === 2) ? "full outer shell" : ve + " valence electron" + (ve === 1 ? "" : "s");
  }
  function renderPanel(el) {
    const v = variantOf(el), est = el.Z >= 100 || el.Z === 85 || el.Z === 87, e = est ? " (est.)" : "";
    $("bigsym").style.setProperty("--h", CAT_HUE[el.cat]);
    $("bigz").textContent = el.Z; $("bigs").textContent = el.sym;
    $("ename").textContent = el.name;
    $("ecat").textContent = CAT_NAME[el.cat] + (el.predicted ? " · properties predicted" : "") + (v.charge ? " · ion " + el.sym + sup(chargeText(v.charge)) : "") +
      (S.N !== null && S.N !== el.neutrons ? " · isotope " + el.sym + "-" + (el.Z + S.N) : "");
    $("esum").textContent = el.sum;
    const s = stateAt(el, S.T), f = el.cat === "lanthanide" || el.cat === "actinide";
    const dens = !el.dens ? "n/a" : el.dens < 0.01 ? fmt(el.dens * 1000, 3) + " g/L" : fmt(el.dens, 4) + " g/cm³";
    $("props").innerHTML = [
      row("Atomic mass", fmt(el.mass, 6) + " u"),
      row("Group / period", (f ? "–" : el.group) + " / " + el.period),
      row("Block", el.block + "-block"),
      row("State at " + S.T + " K", STATE_LBL[s]),
      row("Electronegativity", fmt(el.en, 3)),
      row("Atomic radius", el.rad ? el.rad + " pm" : "n/a"),
      row("Density", dens + (el.dens ? e : "")),
      row("Melting point", el.melt ? fmt(el.melt, 5) + " K (" + fmt(el.melt - 273.15, 5) + " °C)" + e : "n/a"),
      row("Boiling point", el.boil ? fmt(el.boil, 5) + " K (" + fmt(el.boil - 273.15, 5) + " °C)" + e : "n/a"),
      row("1st ionization energy", el.ie ? fmt(el.ie, 4) + " kJ/mol" + (el.predicted ? " (pred.)" : "") : "n/a"),
      row("Electron affinity", el.ea ? fmt(el.ea, 3) + " kJ/mol" : "n/a"),
      row("Oxidation states", el.oxi || "n/a"),
      row("Crust abundance", crustText(el.crust)),
      row("In the human body", el.body ? fmt(el.body, 3) + " %" : "trace or none"),
      row("Discovered", el.year ? el.year : "Antiquity"),
      row("Protons / neutrons", el.Z + " / ~" + el.neutrons),
      row("Valence electrons", el.shells[el.shells.length - 1]),
      row("Crystal structure", CRYSTAL_NAME[el.crystal])
    ].join("");
    $("config").innerHTML = prettyConfig(v.config) + (v.charge ? ' <span class="muted">(' + el.sym + sup(chargeText(v.charge)) + ')</span>' : "");
    $("obox").innerHTML = orbitalBoxes(v);
    $("shellbar").innerHTML = v.shells.map((n, i) => "<span><b>" + SHELL_NAMES[i] + "</b>" + n + "</span>").join("");
    renderLewis(el, v);
    $("haz").innerHTML = el.haz.length ? el.haz.map(h => '<span class="hz"><i>' + HAZ[h][1] + '</i>' + HAZ[h][2] + '</span>').join("") : '<span class="muted">No major hazard as the pure element.</span>';
    const pinned = S.pins.includes(el.Z), pb = $("pin");
    pb.setAttribute("aria-pressed", String(pinned)); pb.dataset.tip = pinned ? "Unpin from the Compare page" : "Pin this element to the Compare page (up to four)"; pb.setAttribute("aria-label", pinned ? "Unpin from compare" : "Pin to compare");
    renderPhase(el);
    renderNuclides(el, v);
    drawNuclides();
    if (document.activeElement !== $("enote")) $("enote").value = S.notes[el.Z] || "";
  }

  const DECAY_NAME = { alpha: "α decay", "beta-": "β⁻ decay", "beta+": "β⁺ decay" };
  function renderAtomCtl(el) {
    const v = variantOf(el);
    const vw = S.view;
    $("chrow").hidden = !(vw === "atom" || vw === "cloud");
    $("nrow").hidden = vw !== "atom";
    $("brow").hidden = !(vw === "atom" || vw === "cloud");
    $("latrow").hidden = vw !== "lattice";
    $("lightrow").hidden = vw !== "light";
    renderCtxExtras(el);
    const maxQ = Math.min(8, el.Z), building = S.build !== null;
    $("chout").textContent = v.charge > 0 ? "+" + v.charge : v.charge < 0 ? "−" + (-v.charge) : "0";
    $("chm").disabled = building || S.charge <= -3;
    $("chp").disabled = building || S.charge >= maxQ;
    const ions = [...new Set((el.oxi.match(/[+−-]\d+/g) || []).map(t => parseInt(t.replace("−", "-"), 10)))].filter(q => q && q >= -3 && q <= maxQ);
    $("ionchips").innerHTML = (S.charge ? '<button type="button" class="chip" data-q="0" data-tip="Back to the neutral atom">neutral</button>' : "") +
      ions.map(q => '<button type="button" class="chip" data-q="' + q + '"' + (q === S.charge ? ' aria-pressed="true"' : "") + ' data-tip="Show the common ion ' + el.sym + sup(chargeText(q)) + ': ' + (q > 0 ? "lost " : "gained ") + Math.abs(q) + " electron" + (Math.abs(q) > 1 ? "s" : "") + '">' + el.sym + sup(chargeText(q)) + '</button>').join("");
    const N0 = el.neutrons, sl = $("nsl"), N = v.neutrons;
    sl.min = Math.max(0, N0 - 10); sl.max = N0 + 12; sl.value = N;
    $("nout").textContent = N;
    const stb = stabilityOf(el.Z, N), st = $("stab");
    st.textContent = el.sym + "-" + (el.Z + N) + ": " + stb.text + (!stb.stable && stb.mode ? ", " + DECAY_NAME[stb.mode] : "");
    st.className = "stab " + (stb.stable ? "ok" : stb.long ? "long" : "bad");
    const db = $("decay"); db.disabled = stb.stable || !stb.mode || Scene3D.busy() || building;
    db.textContent = !stb.stable && stb.mode ? "Decay (" + (stb.mode === "alpha" ? "α" : stb.mode === "beta-" ? "β⁻" : "β⁺") + ")" : "Decay";
    $("build").textContent = building ? "Stop" : "Build up electrons";
    $("build").setAttribute("aria-pressed", String(building));
  }

  function renderCtxExtras(el) {
    if (S.view === "lattice") {
      const s = stateAt(el, S.T);
      $("latstate").innerHTML = el.melt ? '<i class="sd ' + s + '"></i><b>' + STATE_LBL[s] + '</b> at ' + S.T + ' K' : "never measured";
      const opts = [];
      if (el.melt) {
        opts.push(["Solid", Math.max(0, Math.round(Math.min(el.melt * 0.6, 298))), "Cool it until it is a solid"]);
        opts.push(["Melt it", Math.min(6000, Math.round(el.boil ? (el.melt + el.boil) / 2 : el.melt + 40)), "Set the temperature between its melting and boiling points"]);
        if (el.boil) opts.push(["Boil it", Math.min(6000, Math.round(el.boil * 1.12 + 25)), "Heat it past its boiling point so the atoms fly apart"]);
      }
      opts.push(["Room", 298, "Back to room temperature (25 °C)"]);
      $("latinfo").textContent = el.melt ? el.name + " melts at " + fmt(el.melt - 273.15, 4) + " °C" + (el.boil ? " and boils at " + fmt(el.boil - 273.15, 4) + " °C" : "") + ". Use the buttons or the temperature slider at the top to watch the lattice shake apart into a liquid, then fly apart as a gas." : "Not enough " + el.name + " has ever existed at once to measure its melting point.";
      $("latchips").innerHTML = opts.map(o => '<button type="button" class="chip" data-t="' + o[1] + '" data-tip="' + o[2] + ': ' + o[1] + ' K">' + o[0] + '</button>').join("");
    }
    if (S.view === "light") {
      const lines = SPECTRA[el.Z], flame = FLAME[el.Z];
      $("lightinfo").textContent = (lines ? "Brightest lines: " + lines.slice().sort((a, b) => b[1] - a[1]).slice(0, 3).map(l => l[0].toFixed(1) + " nm").join(", ") + ". " : "No visible line data for " + el.name + ". ") +
        (flame ? "Flame test: " + flame[1] + "." : "No well-known flame colour.");
    }
  }
  function updateSimTitle() {
    const el = ELEMENTS[S.sel - 1]; if (!el) return;
    $("simtitle").textContent = el.name + " (" + el.sym + ") · " + { atom: "Atom", cloud: "Orbitals", lattice: "Crystal", light: "Light" }[S.view];
  }

  function renderScene() {
    const el = ELEMENTS[S.sel - 1], info = Scene3D.show(variantOf(el), S.view);
    $("tag3d").textContent = info.tag; $("note").textContent = info.note;
    $("key3d").innerHTML = info.key.map(k => '<span><i style="background:' + k[0] + '"></i>' + k[1] + '</span>').join("");
    $("bonds").disabled = !info.bonds;
    updateSimTitle();
    if (stageDoodle) stageDoodle.load();
    renderAtomCtl(el);
  }

  let decayToken = 0, buildTimer = 0;
  function select(Z, fromUser, keep) {
    Z = clamp(Z, 1, 118);
    if (!keep) { S.charge = 0; S.N = null; if (S.build !== null) { clearTimeout(buildTimer); S.build = null; } $("buildnote").textContent = ""; decayToken++; }
    else S.N = keep.N === undefined ? null : keep.N;
    if (S.sel && tiles[S.sel]) tiles[S.sel].setAttribute("aria-pressed", "false");
    S.sel = Z; tiles[Z].setAttribute("aria-pressed", "true");
    $("enote").value = S.notes[Z] || "";
    const ln = $("elink"); if (ln) { ln.href = "/elements/" + ELEMENTS[Z - 1].slug + "/"; ln.textContent = "Read the full " + ELEMENTS[Z - 1].name + " page →"; ln.hidden = Z === PAGE_EL && document.body.dataset.element !== undefined; }
    renderPanel(ELEMENTS[Z - 1]); renderScene(); drawTrends(); drawStates(); updateTempMarks();
    updateHash();
    if (S.render === "sketch" && fromUser !== undefined) Sound.scribble(0.45);
    if (fromUser) {
      const r = $("simbox").getBoundingClientRect();
      if (r.top > window.innerHeight * 0.55 || r.bottom < 80) $("bigsym").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    }
  }
  function rerender() { const el = ELEMENTS[S.sel - 1]; renderPanel(el); renderScene(); updateHash(); }

  function setCharge(q) {
    const el = ELEMENTS[S.sel - 1]; if (S.build !== null) return;
    S.charge = clamp(q, -3, Math.min(8, el.Z)); rerender();
  }
  function doDecay() {
    const el = ELEMENTS[S.sel - 1], v = variantOf(el), stb = stabilityOf(el.Z, v.neutrons);
    if (stb.stable || !stb.mode || Scene3D.busy() || S.build !== null) return;
    let Z = el.Z, N = v.neutrons;
    if (stb.mode === "alpha") { Z -= 2; N -= 2; } else if (stb.mode === "beta-") { Z += 1; N -= 1; } else { Z -= 1; N += 1; }
    if (Z < 1 || Z > 118 || N < 0) return;
    const token = ++decayToken, from = el.sym + "-" + (el.Z + v.neutrons);
    Sound.scribble(0.5); $("decay").disabled = true;
    Scene3D.emit(stb.mode, () => {
      if (token !== decayToken) return;
      S.charge = 0;
      select(Z, false, { N: N === ELEMENTS[Z - 1].neutrons ? undefined : N });
      toast(from + " → " + ELEMENTS[Z - 1].sym + "-" + (Z + N) + " by " + DECAY_NAME[stb.mode]);
    });
  }
  function buildStep() {
    const el = ELEMENTS[S.sel - 1];
    if (S.build === null) return;
    if (S.build >= el.Z) { stopBuild(false); return; }
    S.build++;
    const k = S.build, prev = k === 1 ? {} : fill(k - 1, false), now = k === el.Z ? el.occ : fill(k, false);
    const added = Object.keys(now).filter(s => (now[s] || 0) > (prev[s] || 0)), moved = Object.keys(prev).some(s => (now[s] || 0) < prev[s]);
    $("buildnote").textContent = "electron " + k + " of " + el.Z + (added.length ? " → " + added.join(", ") : "") + (moved ? " (electrons shuffle: " + el.name + " is an exception)" : "");
    renderPanel(el); renderScene(); Sound.scribble(0.12);
    buildTimer = setTimeout(buildStep, clamp(9000 / el.Z, 110, 520));
  }
  function stopBuild(early) {
    clearTimeout(buildTimer);
    const was = S.build !== null; S.build = null;
    if (!early) $("buildnote").textContent = "done: " + ELEMENTS[S.sel - 1].config.replace(/(\d[spdf]) (\d+)/g, (m0, a, b) => a + sup(b));
    else $("buildnote").textContent = "";
    if (was) { renderPanel(ELEMENTS[S.sel - 1]); renderScene(); }
  }
  function toggleBuild() {
    if (S.build !== null) { stopBuild(true); return; }
    S.charge = 0; S.build = 0; buildStep();
  }

  let prevStates = null;
  const CHG = { melt: ["💧", "melts"], boil: ["♨", "boils"], freeze: ["❄", "freezes"], cond: ["☁", "condenses"] };
  const chgTimers = {};
  function setTemp(T) {
    S.T = T; tempEl.value = T;
    tempOut.textContent = T + " K · " + fmt(T - 273.15, 4) + " °C";
    tempEl.setAttribute("aria-valuetext", T + " kelvin, " + fmt(T - 273.15, 4) + " degrees Celsius");
    Scene3D.setT(T);
    const now = {}, changes = [];
    ELEMENTS.forEach(el => { const st = stateAt(el, T); now[el.Z] = st; const p = prevStates && prevStates[el.Z]; if (p && p !== st && p !== "unknown" && st !== "unknown") changes.push([el, p, st]); });
    prevStates = now;
    refresh();
    markChanges(changes);
    renderTempNews(changes, now);
    if (S.sel) { renderPanel(ELEMENTS[S.sel - 1]); renderCtxExtras(ELEMENTS[S.sel - 1]); $("note").textContent = Scene3D.note(); updateHash(); }
    if (S.nb === "compare") renderCompare();
    if (S.nb === "states") drawStates();
    updateTempMarks();
    if (HC.tile) showCard(HC.tile, true);
  }
  function changeKind(p, s) { return s === "gas" ? "boil" : s === "liquid" ? (p === "solid" ? "melt" : "cond") : "freeze"; }
  function markChanges(changes) {
    for (const [el, p, st] of changes) {
      const t = tiles[el.Z], k = changeKind(p, st), badge = t.querySelector(".chg");
      if (badge) badge.textContent = CHG[k][0];
      t.classList.remove("chg-melt", "chg-boil", "chg-freeze", "chg-cond"); void t.offsetWidth; t.classList.add("chg-" + k);
      clearTimeout(chgTimers[el.Z]);
      chgTimers[el.Z] = setTimeout(() => t.classList.remove("chg-" + k), 1600);
    }
  }
  function renderTempNews(changes, now) {
    const box = $("tempnews"); if (!box) return;
    const c = { solid: 0, liquid: 0, gas: 0, unknown: 0 }; Object.values(now).forEach(v => c[v]++);
    const counts = ["solid", "liquid", "gas", "unknown"].map(k => '<span class="tn" data-tip="' + c[k] + ' elements are ' + (k === "unknown" ? "of unknown state" : k) + ' at ' + S.T + ' K"><i class="sd ' + k + '"></i>' + c[k] + '</span>').join("");
    let news = "";
    if (changes.length) {
      const by = {}; changes.forEach(([el, p, st]) => { const k = changeKind(p, st); (by[k] = by[k] || []).push(el.sym); });
      news = Object.keys(by).map(k => '<span class="tn-chg">' + CHG[k][0] + " " + (by[k].length > 5 ? by[k].slice(0, 5).join(", ") + " +" + (by[k].length - 5) : by[k].join(", ")) + " " + (by[k].length > 1 ? CHG[k][1].replace(/s$/, "") : CHG[k][1]) + '</span>').join(" ");
    }
    box.innerHTML = counts + (news ? '<span class="tn-news">' + news + '</span>' : "");
  }
  function updateTempMarks() {
    const el = ELEMENTS[S.sel - 1], m = $("tm-melt"), b = $("tm-boil"); if (!el || !m) return;
    const pos = (node, t, what) => {
      node.hidden = !(t > 0 && t <= 6000);
      if (node.hidden) return;
      node.style.left = "calc(" + (t / 6000) + " * (100% - 17px) + 8.5px)";
      node.dataset.tip = el.name + " " + what + " at " + fmt(t, 5) + " K (" + fmt(t - 273.15, 4) + " °C). Click to jump there.";
      node.dataset.t = Math.round(t) + (what === "melts" ? 1 : 1);
    };
    pos(m, el.melt, "melts"); pos(b, el.boil, "boils");
  }
  const PH_X = t => Math.sqrt(clamp(t, 0, 6000) / 6000);
  const PH_T = x => Math.round(6000 * clamp(x, 0, 1) * clamp(x, 0, 1));
  function renderPhase(el) {
    const bar = $("phasebar"), lab = $("phaselabels"); if (!bar) return;
    const seg = (k, a, b) => '<span class="pseg ' + k + '" style="left:' + (PH_X(a) * 100).toFixed(2) + '%;width:' + ((PH_X(b) - PH_X(a)) * 100).toFixed(2) + '%"></span>';
    let h = "";
    if (!el.melt) h = seg("unknown", 0, 6000);
    else { h = seg("solid", 0, el.melt); h += el.boil ? seg("liquid", el.melt, Math.min(el.boil, 6000)) + (el.boil < 6000 ? seg("gas", el.boil, 6000) : "") : seg("liquid", el.melt, 6000); }
    h += [0, 300, 1000, 3000, 6000].map(t => '<span class="ptick" style="left:' + (PH_X(t) * 100) + '%"><small>' + (t >= 1000 ? t / 1000 + "k" : t) + '</small></span>').join("");
    h += '<span class="pnow" style="left:' + (PH_X(S.T) * 100).toFixed(2) + '%"></span>';
    bar.innerHTML = h;
    bar.setAttribute("aria-valuenow", S.T); bar.setAttribute("aria-valuetext", S.T + " K");
    const st = stateAt(el, S.T);
    lab.innerHTML = el.melt ? '<span><i class="sd solid"></i>melts ' + fmt(el.melt - 273.15, 4) + ' °C</span>' + (el.boil ? '<span><i class="sd gas"></i>boils ' + fmt(el.boil - 273.15, 4) + ' °C</span>' : '<span class="muted">boiling point unknown</span>') +
      '<span>now: <b>' + STATE_LBL[st].toLowerCase() + '</b> at ' + S.T + ' K</span>' : '<span class="muted">Melting and boiling points have not been measured.</span>';
  }

  /* ----- States notebook page: solid, liquid and gas ranges of every element ----- */
  let SG = null;
  const ST_COL = { solid: "rgba(59,82,139,.78)", liquid: "rgba(33,144,141,.8)", gas: "rgba(232,198,26,.62)", unknown: "rgba(165,159,146,.3)" };
  function drawStates() {
    const cv = $("stchart"); if (!cv || S.nb !== "states") return;
    const g = sizeCanvas(cv, 360); if (!g) return;
    const { c, W, H } = g, m = { l: 52, r: 12, t: 16, b: 34 }, pw = W - m.l - m.r, ph = H - m.t - m.b, cw = pw / 118;
    const Y = t => m.t + ph - PH_X(t) * ph, X = z => m.l + (z - 1) * cw;
    for (const e of ELEMENTS) {
      const x = X(e.Z) + 0.6, w = Math.max(1, cw - 1.2);
      const box = (k, a, b) => { c.fillStyle = ST_COL[k]; c.fillRect(x, Y(b), w, Y(a) - Y(b)); };
      if (!e.melt) box("unknown", 0, 6000);
      else { box("solid", 0, e.melt); if (e.boil) { box("liquid", e.melt, Math.min(e.boil, 6000)); if (e.boil < 6000) box("gas", e.boil, 6000); } else box("liquid", e.melt, 6000); }
      if (e.Z === S.sel || e.Z === S.hoverSt) { c.strokeStyle = e.Z === S.sel ? PAL.accent : PAL.ink; c.lineWidth = 1.6; c.strokeRect(x - 0.5, m.t, w + 1, ph); }
    }
    Ink.seed(9);
    const bounds = [2, 10, 18, 36, 54, 86];
    c.strokeStyle = PAL.ink2; c.globalAlpha = 0.45; c.setLineDash([3, 4]); c.lineWidth = 1; c.beginPath();
    bounds.forEach(n => { const x = X(n + 1); c.moveTo(x, m.t); c.lineTo(x, m.t + ph); }); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
    c.strokeStyle = PAL.ink; c.lineWidth = 1.4; c.beginPath(); Ink.line(c, m.l, m.t - 4, m.l, m.t + ph, { wob: 0.8 }); Ink.line(c, m.l, m.t + ph, m.l + pw + 4, m.t + ph, { wob: 0.8 }); c.stroke();
    c.font = "11px 'Courier Prime', monospace"; c.fillStyle = PAL.ink2; c.textAlign = "right"; c.textBaseline = "middle";
    [0, 100, 300, 1000, 2000, 4000, 6000].forEach(t => c.fillText(t + (t === 6000 ? " K" : ""), m.l - 6, Y(t)));
    c.textAlign = "center"; c.textBaseline = "top"; [1, 20, 40, 60, 80, 100, 118].forEach(z => c.fillText(z, X(z) + cw / 2, m.t + ph + 6));
    const y = Y(S.T);
    c.strokeStyle = PAL.red; c.lineWidth = 2; c.beginPath(); Ink.line(c, m.l, y, m.l + pw, y, { passes: 1, wob: 0.6 }); c.stroke();
    Ink.text(c, S.T + " K", m.l + 6, y - 11, 17, PAL.red, "left");
    if (S.hoverSt) {
      const e = ELEMENTS[S.hoverSt - 1], st = stateAt(e, S.T), right = X(e.Z) > W - 220;
      Ink.text(c, e.sym + ": " + STATE_LBL[st].toLowerCase() + (e.melt ? " · melts " + fmt(e.melt - 273.15, 4) + " °C" : "") + (e.boil ? " · boils " + fmt(e.boil - 273.15, 4) + " °C" : ""),
        X(e.Z) + (right ? -8 : cw + 8), m.t + 12, 16, PAL.ink, right ? "right" : "left");
    }
    SG = { m, pw, ph, cw, X, Y };
    // summary
    const at = st => ELEMENTS.filter(e => stateAt(e, S.T) === st);
    const liq = at("liquid"), nextMelt = ELEMENTS.filter(e => e.melt > S.T).sort((a, b) => a.melt - b.melt).slice(0, 4),
      nextBoil = liq.filter(e => e.boil).sort((a, b) => a.boil - b.boil).slice(0, 4), nextFreeze = liq.slice().sort((a, b) => b.melt - a.melt).slice(0, 4);
    const nm = (list, key) => list.map(e => '<button class="linkish" type="button" data-z="' + e.Z + '" data-tip="Open ' + e.name + '">' + e.name + '</button>' + (key ? " (" + fmt(e[key], 5) + " K)" : "")).join(", ");
    $("stnote").innerHTML = '<b>At ' + S.T + ' K</b> (' + fmt(S.T - 273.15, 4) + ' °C): ' + at("solid").length + ' solid, ' + liq.length + ' liquid' + (liq.length && liq.length <= 8 ? " (" + nm(liq) + ")" : "") + ', ' + at("gas").length + ' gas, ' + at("unknown").length + ' unknown.' +
      (nextMelt.length ? '<br>Next to melt as it warms: ' + nm(nextMelt, "melt") + '.' : "") +
      (nextBoil.length ? '<br>Next to boil: ' + nm(nextBoil, "boil") + '.' : "") +
      (nextFreeze.length ? '<br>First to freeze if it cools: ' + nm(nextFreeze, "melt") + '.' : "");
  }
  function statesHit(e) {
    if (!SG) return null;
    const r = $("stchart").getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const z = Math.floor((x - SG.m.l) / SG.cw) + 1, f = (SG.m.t + SG.ph - y) / SG.ph;
    return { z: z >= 1 && z <= 118 ? z : 0, t: PH_T(f) };
  }

  /* ----- Isotopes and isobars ----- */
  const NUC_LABEL = st => st.stable ? "stable" : st.long ? "lasts billions of years" : st.mode ? "unstable, " + DECAY_NAME[st.mode] : "unstable";
  const NUC_CLASS = st => st.stable ? "nk-stable" : st.long ? "nk-long" : st.mode === "beta-" ? "nk-bm" : st.mode === "beta+" ? "nk-bp" : "nk-a";
  // centre of the band of known nuclides for each Z (mean stable neutron count, or the beta-stability line)
  const NUC_CENTER = (() => {
    const c = [];
    for (let z = 1; z <= 118; z++) {
      const st = STABLE[z];
      if (st && st.length) { c[z] = st.reduce((a, b) => a + b, 0) / st.length - z; continue; }
      let best = z, bd = 1e9;
      for (let a = z; a < z * 3.2 + 4; a++) { const d = Math.abs(a / (1.98 + 0.0155 * Math.pow(a, 2 / 3)) - z); if (d < bd) { bd = d; best = a; } }
      c[z] = best - z;
    }
    return c;
  })();
  const nucBand = z => { const w = 3.5 + z * 0.065; return [Math.max(0, Math.round(NUC_CENTER[z] - w)), Math.round(NUC_CENTER[z] + w)]; };
  const nucName = (z, n) => ELEMENTS[z - 1].sym + "-" + (z + n);
  function renderNuclides(el, v) {
    const N = v.neutrons, A = el.Z + N, A0 = el.Z + el.neutrons;
    const set = new Set([...(STABLE[el.Z] || []), ...(LONG_LIVED[el.Z] || []), A0, A]);
    if (set.size < 5) for (let d = -2; d <= 2; d++) if (A0 + d - el.Z >= 0) set.add(A0 + d);
    const isos = [...set].filter(a => a - el.Z >= 0).sort((a, b) => a - b);
    $("isochips").innerHTML = isos.map(a => {
      const n = a - el.Z, st = stabilityOf(el.Z, n);
      return '<button type="button" class="chip nucchip ' + NUC_CLASS(st) + '" data-n="' + n + '"' + (a === A ? ' aria-pressed="true"' : "") +
        ' data-tip="' + nucName(el.Z, n) + ": " + el.Z + " protons, " + n + " neutrons · " + NUC_LABEL(st) + (a === A0 ? " · the isotope shown by default" : "") + '">' + nucName(el.Z, n) + '</button>';
    }).join("");
    $("isobarA").textContent = "(A = " + A + ")";
    const bars = [];
    for (let z = Math.max(1, el.Z - 4); z <= Math.min(118, el.Z + 4); z++) { const n = A - z; if (n >= 0) bars.push([z, n, stabilityOf(z, n)]); }
    $("isobchips").innerHTML = bars.map(([z, n, st]) => '<button type="button" class="chip nucchip ' + NUC_CLASS(st) + '" data-z="' + z + '" data-n="' + n + '"' + (z === el.Z ? ' aria-pressed="true"' : "") +
      ' data-tip="' + ELEMENTS[z - 1].name + "-" + A + ": " + z + " protons, " + n + " neutrons · " + NUC_LABEL(st) + '">' + nucName(z, n) + '</button>').join("");
    const stableIso = isos.filter(a => stabilityOf(el.Z, a - el.Z).stable), stableBar = bars.filter(b => b[2].stable && b[0] !== el.Z);
    $("nucnote").textContent = "Every " + el.name.toLowerCase() + " isotope has " + el.Z + " protons; only the neutrons change" +
      (stableIso.length ? " (" + stableIso.length + " stable)." : ", and none of them is stable.") +
      " Isobars of mass number " + A + " are different elements with " + A + " nucleons in total" +
      (stableBar.length ? "; " + stableBar.map(b => nucName(b[0], b[1])).join(" and ") + (stableBar.length > 1 ? " are" : " is") + " also stable." : ". β decay turns one into the next along this list.");
  }
  let NG = null;
  function drawNuclides() {
    const cv = $("nucchart"); if (!cv || S.nb !== "nuclides" || !S.sel) return;
    const el = ELEMENTS[S.sel - 1], N0 = S.N === null ? el.neutrons : S.N, A0 = el.Z + N0, close = S.nucZoom !== "all";
    const g = sizeCanvas(cv, close ? 420 : 460); if (!g) return;
    const { c, W, H } = g, m = { l: 44, r: 12, t: 14, b: 34 }, pw = W - m.l - m.r, ph = H - m.t - m.b;
    const z1 = close ? Math.max(1, el.Z - 6) : 1, z2 = close ? Math.min(118, el.Z + 6) : 118;
    const span = close ? Math.max(14, Math.round((z2 - z1 + 1) * pw / ph)) : 190;
    const n1 = close ? Math.max(0, N0 - Math.floor(span / 2)) : 0, n2 = n1 + span;
    const cs = Math.min(pw / (n2 - n1 + 1), ph / (z2 - z1 + 1));
    const X = n => m.l + (n - n1) * cs, Y = z => m.t + ph - (z - z1 + 1) * cs;
    const COL = { "nk-stable": PAL.ink, "nk-long": "#e9b04a", "nk-bm": "#a9c3f2", "nk-bp": "#f2b4ac", "nk-a": "#f2dc7c" };
    const CELL_TXT = "#1f2430";
    // labels sit on a paper box so they stay readable on top of the coloured cells
    const tag = (txt, x, y, size, col, align) => {
      c.font = "700 " + size + "px Caveat, 'Patrick Hand', cursive";
      const w = c.measureText(txt).width, x0 = align === "right" ? x - w : align === "center" ? x - w / 2 : x, h = size * 1.15;
      c.fillStyle = PAL.paper; c.fillRect(x0 - 6, y - h / 2, w + 12, h);
      c.strokeStyle = col; c.lineWidth = 1.3; c.strokeRect(x0 - 6 + 0.5, y - h / 2 + 0.5, w + 11, h - 1);
      Ink.text(c, txt, x, y, size, col, align);
    };
    // isotope row and isobar diagonal highlights
    c.fillStyle = PAL.chalk ? "rgba(255,211,106,.12)" : "rgba(255,221,48,.28)"; c.fillRect(m.l, Y(el.Z), pw, cs);
    c.font = (close ? Math.max(9, Math.min(13, cs * 0.3)) : 0) + "px 'Courier Prime', monospace"; c.textAlign = "center"; c.textBaseline = "middle";
    for (let z = z1; z <= z2; z++) {
      const [b1, b2] = nucBand(z);
      for (let n = Math.max(b1, n1); n <= Math.min(b2, n2); n++) {
        const st = stabilityOf(z, n), k = NUC_CLASS(st), x = X(n), y = Y(z), pad = close ? 1.5 : 0.3;
        c.fillStyle = COL[k]; c.fillRect(x + pad, y + pad, cs - 2 * pad, cs - 2 * pad);
        if (close && cs > 22) {
          c.fillStyle = k === "nk-stable" ? PAL.paper : CELL_TXT;
          c.fillText(ELEMENTS[z - 1].sym, x + cs / 2, y + cs * 0.38);
          c.fillText(z + n, x + cs / 2, y + cs * 0.68);
        }
      }
    }
    Ink.seed(17);
    // N = Z reference
    c.strokeStyle = PAL.ink2; c.globalAlpha = 0.5; c.setLineDash([4, 4]); c.lineWidth = 1; c.beginPath();
    const zz1 = Math.max(z1, n1), zz2 = Math.min(z2, n2 + 1);
    if (zz2 > zz1) { c.moveTo(X(zz1), Y(zz1) + cs); c.lineTo(X(zz2), Y(zz2)); }
    c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
    if (zz2 > zz1) tag("N = Z", X(zz2) + 8, Y(zz2) + 10, 15, PAL.ink2, "left");
    // isobar diagonal (Z + N = A)
    c.strokeStyle = PAL.accent; c.lineWidth = close ? 2.5 : 1.6; c.beginPath();
    const za = Math.max(z1, A0 - n2), zb = Math.min(z2, A0 - n1);
    if (zb >= za) Ink.line(c, X(A0 - za) + cs / 2, Y(za) + cs / 2, X(A0 - zb) + cs / 2, Y(zb) + cs / 2, { passes: 2, wob: 0.8 });
    c.stroke();
    if (zb >= za) tag("isobars: A = " + A0, X(A0 - zb) + cs / 2 + 12, Math.max(m.t + 10, Y(zb) + cs / 2), 16, PAL.accent, "left");
    // row label and the current nucleus
    tag("isotopes of " + el.name.toLowerCase() + " (Z = " + el.Z + ")", m.l + pw - 8, Y(el.Z) + cs / 2, 16, PAL.ink, "right");
    c.strokeStyle = PAL.red; c.lineWidth = 2.4; c.beginPath(); Ink.circle(c, X(N0) + cs / 2, Y(el.Z) + cs / 2, Math.max(6, cs * 0.75), { passes: 2 }); c.stroke();
    // axes
    c.strokeStyle = PAL.ink; c.lineWidth = 1.4; c.beginPath(); Ink.line(c, m.l, m.t, m.l, m.t + ph, { wob: 0.6 }); Ink.line(c, m.l, m.t + ph, m.l + pw, m.t + ph, { wob: 0.6 }); c.stroke();
    c.font = "11px 'Courier Prime', monospace"; c.fillStyle = PAL.ink2; c.textAlign = "right"; c.textBaseline = "middle";
    const zs = close ? 2 : 20; for (let z = Math.ceil(z1 / zs) * zs; z <= z2; z += zs) c.fillText(z, m.l - 6, Y(z) + cs / 2);
    c.textAlign = "center"; c.textBaseline = "top";
    const ns = close ? 2 : 20; for (let n = Math.ceil(n1 / ns) * ns; n <= n2; n += ns) c.fillText(n, X(n) + cs / 2, m.t + ph + 6);
    Ink.text(c, "neutrons N →", m.l + pw, H - 7, 15, PAL.ink2, "right");
    Ink.text(c, "protons Z", 4, m.t + 4, 14, PAL.ink2, "left");
    if (S.nucHover) {
      const [hz, hn] = S.nucHover;
      if (hz >= z1 && hz <= z2 && hn >= n1 && hn <= n2) {
        c.strokeStyle = PAL.ink; c.lineWidth = 1.8; c.strokeRect(X(hn) + 0.5, Y(hz) + 0.5, cs - 1, cs - 1);
        const st = stabilityOf(hz, hn), right = X(hn) > W - 240;
        tag(ELEMENTS[hz - 1].name + "-" + (hz + hn) + ": " + NUC_LABEL(st), X(hn) + (right ? -12 : cs + 12), Y(hz) + cs / 2, 16, PAL.ink, right ? "right" : "left");
      }
    }
    NG = { X0: m.l, Y0: m.t + ph, cs, n1, z1, n2, z2 };
    renderNucLists(el, N0);
    // text summary
    const st = stabilityOf(el.Z, N0), stableIso = (STABLE[el.Z] || []).map(a => el.sym + "-" + a);
    const bars = []; for (let z = Math.max(1, el.Z - 3); z <= Math.min(118, el.Z + 3); z++) { const n = A0 - z; if (n >= 0) bars.push([z, n, stabilityOf(z, n)]); }
    const left = bars.find(b => b[0] === el.Z - 1), right = bars.find(b => b[0] === el.Z + 1);
    const lk = (z, n) => '<button class="linkish" type="button" data-z="' + z + '" data-n="' + n + '" data-tip="Open ' + ELEMENTS[z - 1].name + "-" + (z + n) + '">' + nucName(z, n) + '</button>';
    $("nucpage").innerHTML = '<b>' + nucName(el.Z, N0) + '</b> (' + el.Z + ' protons, ' + N0 + ' neutrons): ' + NUC_LABEL(st) + '.<br>' +
      '<b>Isotopes</b> sit on the highlighted row: ' + (stableIso.length ? el.name + " has " + stableIso.length + " stable isotope" + (stableIso.length > 1 ? "s" : "") + " (" + stableIso.join(", ") + ")." : "no " + el.name.toLowerCase() + " isotope is stable.") + '<br>' +
      '<b>Isobars</b> sit on the blue diagonal, where protons + neutrons = ' + A0 + ': ' + bars.map(b => lk(b[0], b[1]) + " (" + (b[2].stable ? "stable" : b[2].long ? "long-lived" : b[2].mode === "beta-" ? "β⁻" : b[2].mode === "beta+" ? "β⁺" : "α") + ")").join(", ") + '. ' +
      (left && left[2].mode === "beta-" ? nucName(left[0], left[1]) + " turns into " + nucName(el.Z, N0) + " by β⁻ decay. " : "") +
      (right && right[2].mode === "beta+" ? nucName(right[0], right[1]) + " turns into " + nucName(el.Z, N0) + " by β⁺ decay. " : "") + "Beta decay keeps the mass number, so it moves a nucleus along its isobar line toward the stable one.";
  }
  function renderNucLists(el, N0) {
    const A0 = el.Z + N0;
    const status = st => st.stable ? "stable" : st.long ? "long-lived" : st.mode ? DECAY_NAME[st.mode] : "unstable";
    const decayTo = (z, n, st) => {
      if (st.stable || !st.mode) return "—";
      const d = st.mode === "alpha" ? [z - 2, n - 2] : st.mode === "beta-" ? [z + 1, n - 1] : [z - 1, n + 1];
      return d[0] >= 1 && d[1] >= 0 ? '<button class="linkish" type="button" data-z="' + d[0] + '" data-n="' + d[1] + '" data-pz="' + z + '" data-pn="' + n + '" data-tip="Compare ' + nucName(z, n) + " with what it decays into, " + ELEMENTS[d[0] - 1].name + "-" + (d[0] + d[1]) + '">' + nucName(d[0], d[1]) + "</button>" : "—";
    };
    const head = '<thead><tr><th>Nucleus</th><th style="text-align:right">Z</th><th style="text-align:right">N</th><th>Stability</th><th>Decays into</th></tr></thead>';
    const row = (z, n, cur) => {
      const st = stabilityOf(z, n);
      return "<tr" + (cur ? ' class="cur" aria-current="true"' : "") + '><td><button class="linkish nucbtn" type="button" data-z="' + z + '" data-n="' + n + '" data-tip="Compare ' + ELEMENTS[z - 1].name + "-" + (z + n) + ' side by side with the nucleus in the lab">' + nucName(z, n) + "</button></td>" +
        '<td class="n">' + z + '</td><td class="n">' + n + '</td><td><i class="sd ' + NUC_CLASS(st) + '"></i>' + status(st) + "</td><td>" + decayTo(z, n, st) + "</td></tr>";
    };
    const [b1, b2] = nucBand(el.Z), isoRows = [];
    for (let n = b1; n <= b2; n++) isoRows.push(n);
    if (!isoRows.includes(N0)) { isoRows.push(N0); isoRows.sort((a, b) => a - b); }
    const isoStable = isoRows.filter(n => stabilityOf(el.Z, n).stable).length;
    $("isoH").textContent = "Isotopes of " + el.name.toLowerCase() + " (Z = " + el.Z + ") · " + isoRows.length + " shown, " + isoStable + " stable";
    $("isotab").innerHTML = head + "<tbody>" + isoRows.map(n => row(el.Z, n, n === N0)).join("") + "</tbody>";
    const barRows = [];
    for (let z = Math.max(1, el.Z - 6); z <= Math.min(118, el.Z + 6); z++) { const n = A0 - z, [c1, c2] = nucBand(z); if (n >= 0 && (n >= c1 && n <= c2 || z === el.Z)) barRows.push(z); }
    const barStable = barRows.filter(z => stabilityOf(z, A0 - z).stable).length;
    $("isobH").textContent = "Isobars with mass number A = " + A0 + " · " + barRows.length + " shown, " + barStable + " stable";
    $("isobtab").innerHTML = head + "<tbody>" + barRows.map(z => row(z, A0 - z, z === el.Z)).join("") + "</tbody>";
  }
  function nucHit(e) {
    if (!NG) return null;
    const r = $("nucchart").getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const n = NG.n1 + Math.floor((x - NG.X0) / NG.cs), z = NG.z1 + Math.floor((NG.Y0 - y) / NG.cs);
    if (z < NG.z1 || z > NG.z2 || n < NG.n1 || n > NG.n2) return null;
    const [b1, b2] = nucBand(z); return n >= b1 && n <= b2 ? [z, n] : null;
  }
  // Selecting an isotope or isobar opens a side-by-side comparison with the nucleus currently in the lab.
  function compareWith(z, n, from) {
    const el = ELEMENTS[S.sel - 1], cur = { z: el.Z, n: S.N === null ? el.neutrons : S.N };
    let ref = from || cur;
    if (ref.z === z && ref.n === n) {
      const d = ELEMENTS[z - 1].neutrons;
      if (d !== n) ref = { z, n: d }; else { openNuclide(z, n, true); return; }
    }
    if (Draw.on) setDraw(false);
    hideCard();
    openCompare(ref, { z, n }, { onLoad: (zz, nn) => openNuclide(zz, nn, true), mode: ref.z === z ? "nucleus" : "atom" });
  }
  function openNuclide(z, n, toAtom) {
    if (S.build !== null) stopBuild(true);
    S.charge = 0;
    if (toAtom && S.view !== "atom") setView("atom");
    if (z === S.sel) { S.N = n === ELEMENTS[z - 1].neutrons ? null : n; decayToken++; rerender(); drawNuclides(); }
    else select(z, false, { N: n === ELEMENTS[z - 1].neutrons ? undefined : n });
  }

  /* ----- Full-screen simulation ----- */
  let simHome = null;
  function setMax(on) {
    const box = $("simbox"), dlg = $("simmodal");
    if (on === !!simHome) return;
    if (on) {
      if (Draw.on) setDraw(false);
      simHome = document.createElement("div"); simHome.className = "simph"; simHome.style.height = box.offsetHeight + "px";
      box.parentNode.insertBefore(simHome, box);
      $("simslot").appendChild(box);
      if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
      document.body.classList.add("sim-max");
    } else {
      simHome.parentNode.insertBefore(box, simHome); simHome.remove(); simHome = null;
      if (dlg.open) dlg.close();
      document.body.classList.remove("sim-max");
    }
    const mb = $("maxbtn");
    mb.setAttribute("aria-pressed", String(on)); $("maxlabel").textContent = on ? "Shrink" : "Expand";
    mb.dataset.tip = on ? "Back to the side panel (Esc or F)" : "Open the simulation full screen (F key)";
    mb.setAttribute("aria-label", on ? "Shrink the simulation" : "Expand the simulation");
    updateSimTitle();
  }

  /* ----- Hover card with the basics of an element ----- */
  const HC = { tile: null, timer: 0, hideTimer: 0 };
  function hoverCardEl() {
    let c = $("hovercard");
    if (!c) { c = document.createElement("div"); c.id = "hovercard"; c.className = "hovercard sheet"; c.setAttribute("role", "tooltip"); c.hidden = true; document.body.appendChild(c); }
    return c;
  }
  function showCard(tile, refreshOnly) {
    if (Q.on || Draw.on || !tile) return;
    const el = ELEMENTS[+tile.dataset.z - 1], st = stateAt(el, S.T), c = hoverCardEl(), f = el.cat === "lanthanide" || el.cat === "actinide";
    const row = (k, v) => '<div><dt>' + k + '</dt><dd>' + v + '</dd></div>';
    c.innerHTML = '<div class="hc-head"><span class="hc-sym" style="--h:' + CAT_HUE[el.cat] + '"><small>' + el.Z + '</small>' + el.sym + '</span><div><b>' + el.name + '</b><small>' + CAT_NAME[el.cat] + (el.predicted ? " · predicted" : "") + '</small></div></div>' +
      '<dl class="hc-grid">' + row("Atomic mass", fmt(el.mass, 6) + " u") + row("State at " + S.T + " K", '<i class="sd ' + st + '"></i>' + STATE_LBL[st]) +
      row("Melts", el.melt ? fmt(el.melt - 273.15, 4) + " °C" : "n/a") + row("Boils", el.boil ? fmt(el.boil - 273.15, 4) + " °C" : "n/a") +
      row("Electronegativity", fmt(el.en, 3)) + row(f ? "Period" : "Group / period", f ? el.period : el.group + " / " + el.period) +
      row("Density", !el.dens ? "n/a" : el.dens < 0.01 ? fmt(el.dens * 1000, 3) + " g/L" : fmt(el.dens, 4) + " g/cm³") + row("Discovered", el.year || "antiquity") + '</dl>' +
      '<div class="hc-cfg">' + prettyConfig(el.config) + '</div>' +
      (S.notes[el.Z] ? '<div class="hc-note">📝 ' + esc(S.notes[el.Z]) + '</div>' : "") +
      '<div class="hc-sum">' + esc(el.sum) + '</div><div class="hc-foot">Click to open · arrow keys move around the table</div>';
    const host = $("simmodal") && $("simmodal").open ? $("simmodal") : document.body;
    if (c.parentNode !== host) host.appendChild(c);
    c.hidden = false;
    const r = tile.getBoundingClientRect(), w = c.offsetWidth, h = c.offsetHeight, vw = document.documentElement.clientWidth, vh = window.innerHeight;
    let x = r.right + 12, y = clamp(r.top + r.height / 2 - h / 2, 8, vh - h - 8);
    if (x + w > vw - 8) x = r.left - w - 12;
    if (x < 8) { x = clamp(r.left + r.width / 2 - w / 2, 8, vw - w - 8); y = r.bottom + h + 10 < vh ? r.bottom + 8 : Math.max(8, r.top - h - 8); }
    c.style.left = Math.round(x) + "px"; c.style.top = Math.round(y) + "px";
    if (!refreshOnly) { if (HC.tile && HC.tile !== tile) HC.tile.removeAttribute("aria-describedby"); HC.tile = tile; tile.setAttribute("aria-describedby", "hovercard"); }
  }
  function hideCard() {
    clearTimeout(HC.timer); clearTimeout(HC.hideTimer);
    const c = $("hovercard"); if (c) c.hidden = true;
    if (HC.tile) HC.tile.removeAttribute("aria-describedby");
    HC.tile = null;
  }

  /* ----- Render style, view and theme ----- */
  function setRender(m) {
    const prev = S.render;
    S.render = Scene3D.setMode(m); store.set("render", S.render);
    $("r3d").setAttribute("aria-pressed", String(S.render === "3d")); $("rsk").setAttribute("aria-pressed", String(S.render === "sketch"));
    $("wobble").disabled = S.render !== "sketch";
    if (prev !== S.render && S.render === "sketch") Sound.scribble(0.6);
    if (S.sel) updateHash();
  }
  function setView(v) {
    S.view = v;
    document.querySelectorAll(".tab").forEach(o => o.setAttribute("aria-selected", String(o.dataset.view === v)));
  }
  const ICON_MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>';
  const ICON_SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  function setTheme(t) {
    S.theme = t === "chalk" ? "chalk" : "paper"; store.set("theme", S.theme);
    document.documentElement.dataset.theme = S.theme; readPalette();
    $("theme").innerHTML = S.theme === "paper" ? ICON_MOON + "Chalkboard" : ICON_SUN + "Paper";
    drawTrends(); drawTimeline(); drawScale(); drawStates(); drawNuclides();
    if (tableDoodle) { tableDoodle.draw(); stageDoodle.draw(); }
    if (S.sel) { renderLewis(ELEMENTS[S.sel - 1], variantOf(ELEMENTS[S.sel - 1])); updateHash(); }
  }

  /* ----- Trends chart ----- */
  const TREND_INFO = {
    en: ["Electronegativity", "Pauling", "Electronegativity climbs across each period toward fluorine and drops down each group. Most noble gases have no value, so the line breaks there."],
    rad: ["Atomic radius", "pm", "Radius jumps up at every alkali metal, where a new shell starts, then shrinks across the period as the nucleus pulls harder."],
    mass: ["Atomic mass", "u", "Mass rises almost steadily with atomic number, since each step adds a proton and usually a neutron or two."],
    dens: ["Density", "g/cm³, log scale", "Gases sit at the bottom. Density peaks in the middle of period 6, where osmium and iridium are the densest natural elements."],
    melt: ["Melting point", "K", "Melting points peak in the middle of each period: carbon in period 2, tungsten among the metals. Alkali metals and noble gases sit in the dips."],
    boil: ["Boiling point", "K", "Boiling points follow the same rise-and-fall rhythm as melting points, with noble gases at the bottom of each dip."],
    ie: ["First ionization energy", "kJ/mol", "It takes the most energy to pull an electron off a noble gas and the least off an alkali metal, so the line saws upward across each period and drops at the start of the next."],
    ea: ["Electron affinity", "kJ/mol", "Halogens release the most energy when they gain an electron. Noble gases, nitrogen and the group 2 metals don't hold an extra electron, so they sit at zero (left out)."],
    crust: ["Abundance in Earth's crust", "mg/kg, log scale", "Oxygen and silicon make up about three quarters of the crust. Elements with even atomic numbers tend to be more common than their odd neighbours, and the heavy precious metals are extremely rare."],
    year: ["Year discovered", "year", "Elements known since antiquity sit at the bottom. The synthetic heavy elements at the right were made in the second half of the 1900s and later."]
  };
  let TG = null;
  function valueText(key, v) {
    if (key === "year") return v <= 1600 ? "antiquity" : String(Math.round(v));
    if (key === "dens") return v < 0.01 ? fmt(v * 1000, 3) + " g/L" : fmt(v, 4) + " g/cm³";
    if (key === "crust") return crustText(v);
    return fmt(v, 4) + MODES[key].unit;
  }
  function sizeCanvas(cv, H) {
    const W = cv.parentElement.clientWidth; if (!W) return null;
    const d = dprOf();
    if (cv.width !== Math.round(W * d) || cv.height !== Math.round(H * d)) { cv.width = Math.round(W * d); cv.height = Math.round(H * d); }
    cv.style.height = H + "px";
    const c = cv.getContext("2d"); c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, W, H); c.lineCap = "round"; c.lineJoin = "round";
    Ink.setAmp(1);
    return { c, W, H };
  }
  function drawTrends() {
    const cv = $("trend"); if (!cv || S.nb !== "trends") return;
    const W0 = cv.parentElement.clientWidth; if (!W0) return;
    const g0 = sizeCanvas(cv, Math.round(clamp(W0 * 0.4, 240, 340))); if (!g0) return;
    const { c, W, H } = g0;
    const key = S.trend, md = MODES[key], info = TREND_INFO[key];
    $("trendTitle").textContent = info[0] + " vs atomic number"; $("trendNote").textContent = info[2];
    const tv = v => md.log ? Math.log10(v) : v;
    const pts = ELEMENTS.map(e => [e, md.get(e)]).filter(p => p[1] > 0);
    const tvals = pts.map(p => tv(p[1]));
    let lo = Math.min(...tvals), hi = Math.max(...tvals); const pad = (hi - lo) * 0.06 || 1; lo -= pad; hi += pad;
    const m = { l: 58, r: 16, t: 30, b: 40 }, pw = W - m.l - m.r, ph = H - m.t - m.b;
    const X = z => m.l + (z - 0.5) / 118 * pw, Y = v => m.t + ph - (tv(v) - lo) / (hi - lo) * ph;
    Ink.seed(3);
    const bounds = [0, 2, 10, 18, 36, 54, 86, 118];
    c.lineWidth = 1; c.strokeStyle = PAL.ink2; c.globalAlpha = 0.4; c.setLineDash([3, 5]); c.beginPath();
    for (let i = 1; i < bounds.length - 1; i++) { const x = X(bounds[i] + 0.5); c.moveTo(x, m.t - 4); c.lineTo(x, m.t + ph); }
    c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
    for (let i = 0; i < 7; i++) Ink.text(c, "P" + (i + 1), (X(bounds[i] + 0.5) + X(bounds[i + 1] + 0.5)) / 2, m.t - 14, 16, PAL.ink2, "center");
    c.strokeStyle = PAL.ink; c.lineWidth = 1.5; c.beginPath();
    Ink.line(c, m.l, m.t - 8, m.l, m.t + ph, { wob: 1 }); Ink.line(c, m.l, m.t + ph, m.l + pw + 6, m.t + ph, { wob: 1 }); c.stroke();
    c.font = "12px 'Courier Prime', monospace"; c.fillStyle = PAL.ink2; c.textAlign = "center"; c.textBaseline = "top"; c.lineWidth = 1.2; c.beginPath();
    for (const z of [1, 20, 40, 60, 80, 100, 118]) { const x = X(z); c.moveTo(x, m.t + ph); c.lineTo(x, m.t + ph + 5); c.fillText(z, x, m.t + ph + 8); }
    c.textAlign = "right"; c.textBaseline = "middle";
    const raw = (hi - lo) / 5, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    let step = [1, 2, 2.5, 5, 10].find(k => k * mag >= raw) * mag; if (md.log) step = Math.max(1, Math.round(step));
    for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) {
      const y = m.t + ph - (t - lo) / (hi - lo) * ph, v = md.log ? Math.pow(10, t) : t;
      c.moveTo(m.l - 5, y); c.lineTo(m.l, y);
      c.fillText(key === "year" ? (v <= 1600 ? "old" : Math.round(v)) : md.log ? (v >= 1 ? String(Math.round(v)) : v.toExponential(0)) : String(+v.toFixed(6)), m.l - 8, y);
    }
    c.stroke();
    Ink.text(c, "atomic number →", m.l + pw, H - 7, 17, PAL.ink2, "right");
    Ink.text(c, info[1], 6, m.t - 14, 15, PAL.ink2, "left");
    c.strokeStyle = PAL.blue; c.lineWidth = 1.8; c.beginPath(); let prev = -1;
    for (const [e, v] of pts) { const x = X(e.Z), y = Y(v); if (prev === e.Z - 1) c.lineTo(x + Ink.j(0.5), y + Ink.j(0.5)); else c.moveTo(x, y); prev = e.Z; }
    c.stroke();
    const geo = [];
    for (const [e, v] of pts) {
      const x = X(e.Z), y = Y(v); geo.push([e.Z, x, y, v]);
      c.fillStyle = catColor(e.cat); c.beginPath(); c.arc(x, y, 2.9, 0, 6.2832); c.fill(); c.strokeStyle = PAL.ink; c.lineWidth = 0.8; c.stroke();
    }
    TG = { geo };
    const mark = (z, col, strong) => {
      const gq = geo.find(p => p[0] === z); if (!gq) return false;
      const e = ELEMENTS[z - 1];
      c.strokeStyle = col; c.lineWidth = strong ? 2 : 1.4; c.beginPath(); Ink.circle(c, gq[1], gq[2], 9, { passes: 2 }); c.stroke();
      const right = gq[1] > W - 170, above = gq[2] > m.t + 44;
      Ink.text(c, e.sym + " · " + valueText(key, gq[3]), gq[1] + (right ? -15 : 15), gq[2] + (above ? -22 : 24), 19, col, right ? "right" : "left");
      return true;
    };
    if (S.hoverZ && S.hoverZ !== S.sel) {
      const gq = geo.find(p => p[0] === S.hoverZ);
      if (gq) { c.strokeStyle = PAL.ink2; c.globalAlpha = 0.5; c.lineWidth = 1; c.beginPath(); Ink.line(c, gq[1], m.t, gq[1], m.t + ph, { passes: 1, wob: 0.8 }); c.stroke(); c.globalAlpha = 1; }
      mark(S.hoverZ, PAL.ink2, false);
    }
    if (S.sel && !mark(S.sel, PAL.accent, true)) Ink.text(c, ELEMENTS[S.sel - 1].name + " has no value here", m.l + pw, m.t + 6, 17, PAL.accent, "right");
  }
  function trendHit(e) {
    if (!TG) return 0;
    const r = $("trend").getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    let best = 0, bd = 24;
    for (const gq of TG.geo) { const d = Math.abs(gq[1] - x) + Math.abs(gq[2] - y) * 0.3; if (d < bd) { bd = d; best = gq[0]; } }
    return best;
  }

  /* ----- Formula parsing (shared by molar mass and equations) ----- */
  function parseFormula(raw) {
    const subs = "₀₁₂₃₄₅₆₇₈₉";
    const str = raw.replace(/\s+/g, "").replace(/[₀-₉]/g, d => String(subs.indexOf(d)));
    if (!str) throw new Error("Type a formula.");
    const total = {}, order = [];
    const add = (sym, n) => { if (!(sym in total)) { total[sym] = 0; order.push(sym); } total[sym] += n; };
    for (const part of str.split(/[·•*.]/)) {
      if (!part) continue;
      let i = 0;
      const num = () => { let s = ""; while (i < part.length && /\d/.test(part[i])) s += part[i++]; return s ? parseInt(s, 10) : 1; };
      const mult = /^\d/.test(part) ? num() : 1;
      const group = depth => {
        const acc = {};
        while (i < part.length) {
          const ch = part[i];
          if (ch === "(" || ch === "[") {
            i++; const inner = group(depth + 1);
            if (part[i] !== ")" && part[i] !== "]") throw new Error("A bracket is not closed.");
            i++; const k = num(); for (const s in inner) acc[s] = (acc[s] || 0) + inner[s] * k;
          } else if (ch === ")" || ch === "]") {
            if (!depth) throw new Error("There is a closing bracket with no opening one.");
            return acc;
          } else if (/[A-Z]/.test(ch)) {
            let sym = ch; i++;
            if (i < part.length && /[a-z]/.test(part[i]) && BYSYM[sym + part[i]]) sym += part[i++];
            if (!BYSYM[sym]) throw new Error('"' + sym + '" is not an element symbol.');
            const k = num(); acc[sym] = (acc[sym] || 0) + k;
          } else if (/[a-z]/.test(ch)) {
            throw new Error('Symbols start with a capital letter. Did you mean "' + ch.toUpperCase() + '"?');
          } else throw new Error('I can\'t read "' + ch + '".');
        }
        if (depth) throw new Error("A bracket is not closed.");
        return acc;
      };
      const g = group(0);
      for (const s in g) add(s, g[s] * mult);
    }
    if (!order.length) throw new Error("Type a formula.");
    return { total, order };
  }
  const molarOf = counts => Object.keys(counts).reduce((a, s) => a + BYSYM[s].mass * counts[s], 0);
  const prettyFormula = s => esc(s).replace(/([A-Za-z\)\]])(\d+)/g, "$1<sub>$2</sub>").replace(/[*.]/g, "·");
  const AVO = 6.02214076e23;
  const numIn = s => { const t = String(s).trim().replace(/,/g, "").replace(/\s*[×x]\s*10\s*\^?\s*/i, "e"); const v = parseFloat(t); return isFinite(v) ? v : NaN; };
  const sci = v => !isFinite(v) ? "" : (v !== 0 && (Math.abs(v) >= 1e6 || Math.abs(v) < 1e-3)) ? v.toExponential(4).replace("e+", "e") : String(+v.toPrecision(6));

  /* ----- Molar mass, converter, empirical formula ----- */
  let convMol = 1;
  function renderMolar() {
    const v = $("fx").value.trim(), out = $("fxout");
    if (!v) { S.formula = null; S.M = 0; out.innerHTML = '<p class="muted">Type a chemical formula to get its molar mass and what share of the mass each element carries. Brackets and hydrates work too, for example Ca(OH)2 or CuSO4·5H2O. The elements light up on the table.</p>'; renderConv(); refresh(); return; }
    try {
      const r = parseFormula(v), M = molarOf(r.total);
      S.formula = r.total; S.M = M;
      const rows = r.order.map(s => { const e = BYSYM[s], part = e.mass * r.total[s]; return { e, n: r.total[s], part, pct: part / M * 100 }; });
      out.innerHTML = '<div class="fx-pretty">' + prettyFormula(v) + '</div>' +
        '<div class="fx-total">' + fmt(M, 6) + ' <small>g/mol</small></div>' +
        '<div class="fx-bar" aria-hidden="true">' + rows.map(x => '<span style="--h:' + CAT_HUE[x.e.cat] + ';width:' + x.pct.toFixed(2) + '%">' + (x.pct > 7 ? x.e.sym : "") + '</span>').join("") + '</div>' +
        '<table class="grid"><thead><tr><th>Element</th><th style="text-align:right">Atoms</th><th style="text-align:right">Mass (g/mol)</th><th style="text-align:right">Share</th></tr></thead><tbody>' +
        rows.map(x => '<tr><td><button class="linkish" type="button" data-z="' + x.e.Z + '">' + x.e.name + ' (' + x.e.sym + ')</button></td><td class="n">' + x.n + '</td><td class="n">' + fmt(x.part, 6) + '</td><td class="n">' + x.pct.toFixed(2) + ' %</td></tr>').join("") +
        '</tbody></table>';
    } catch (err) {
      S.formula = null; S.M = 0; out.innerHTML = '<p class="err">' + esc(err.message) + '</p>';
    }
    renderConv(); refresh();
  }
  function renderConv() {
    const box = $("convbox");
    if (!S.M) { box.innerHTML = ""; return; }
    box.innerHTML = '<h4 class="subhead">Grams, moles and particles</h4><div class="conv">' +
      '<label class="field"><span>Grams</span><input id="cg" type="text" inputmode="decimal"></label><span class="eqs">=</span>' +
      '<label class="field"><span>Moles</span><input id="cm" type="text" inputmode="decimal"></label><span class="eqs">=</span>' +
      '<label class="field"><span>Particles</span><input id="cn" type="text" inputmode="decimal"></label></div>' +
      '<p class="muted">Type in any box. Uses ' + fmt(S.M, 6) + ' g/mol and Avogadro’s number, 6.022 × 10²³ per mole. Write big numbers like 3e23.</p>';
    fillConv(null);
    ["cg", "cm", "cn"].forEach(id => $(id).addEventListener("input", () => {
      const v = numIn($(id).value); if (isNaN(v)) return;
      convMol = id === "cg" ? v / S.M : id === "cm" ? v : v / AVO; fillConv(id);
    }));
  }
  function fillConv(skip) { if (skip !== "cg") $("cg").value = sci(convMol * S.M); if (skip !== "cm") $("cm").value = sci(convMol); if (skip !== "cn") $("cn").value = sci(convMol * AVO); }
  function renderEmp() {
    const raw = $("pc").value.trim(), out = $("pcout");
    if (!raw) { out.innerHTML = ""; return; }
    const items = [], re = /([A-Z][a-z]?)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*%?/g; let m;
    while ((m = re.exec(raw))) {
      const e = BYSYM[m[1]];
      if (!e) { out.innerHTML = '<p class="err">"' + esc(m[1]) + '" is not an element symbol.</p>'; return; }
      if (items.some(i => i.e === e)) { out.innerHTML = '<p class="err">' + e.sym + ' is listed twice.</p>'; return; }
      items.push({ e, pct: +m[2] });
    }
    if (!items.length || items.some(i => !(i.pct > 0))) { out.innerHTML = '<p class="err">Write it like: C 40, H 6.7, O 53.3</p>'; return; }
    const sum = items.reduce((a, i) => a + i.pct, 0);
    items.forEach(i => { i.mol = i.pct / i.e.mass; });
    const minMol = Math.min(...items.map(i => i.mol));
    items.forEach(i => { i.r = i.mol / minMol; });
    let mult = 1;
    for (let k = 1; k <= 8; k++) if (items.every(i => Math.abs(i.r * k - Math.round(i.r * k)) < 0.1)) { mult = k; break; }
    items.forEach(i => { i.n = Math.max(1, Math.round(i.r * mult)); });
    const hasC = items.some(i => i.e.sym === "C");
    const rank = i => hasC && i.e.sym === "C" ? "0" : hasC && i.e.sym === "H" ? "1" : "2" + i.e.sym;
    const ord = items.slice().sort((a, b) => rank(a) < rank(b) ? -1 : 1);
    const fstr = k => ord.map(i => i.e.sym + (i.n * k > 1 ? i.n * k : "")).join("");
    const empM = items.reduce((a, i) => a + i.n * i.e.mass, 0), M = numIn($("pcm").value);
    let molHTML = "";
    if (M > 0) { const k = Math.max(1, Math.round(M / empM)); molHTML = '<p>Molecular formula: <span class="fx-pretty">' + prettyFormula(fstr(k)) + '</span> <span class="muted">(' + fmt(M, 5) + ' ÷ ' + fmt(empM, 5) + ' ≈ ' + k + ')</span></p>'; }
    out.innerHTML = '<table class="grid"><thead><tr><th>Element</th><th style="text-align:right">%</th><th style="text-align:right">÷ atomic mass = mol</th><th style="text-align:right">÷ smallest</th>' + (mult > 1 ? '<th style="text-align:right">× ' + mult + '</th>' : "") + '</tr></thead><tbody>' +
      ord.map(i => '<tr><td>' + i.e.name + '</td><td class="n">' + i.pct + '</td><td class="n">' + i.mol.toFixed(4) + '</td><td class="n">' + i.r.toFixed(2) + '</td>' + (mult > 1 ? '<td class="n">' + (i.r * mult).toFixed(2) + '</td>' : "") + '</tr>').join("") +
      '</tbody></table><p>Empirical formula: <span class="fx-pretty">' + prettyFormula(fstr(1)) + '</span> <span class="muted">(' + fmt(empM, 5) + ' g/mol)</span></p>' + molHTML +
      (Math.abs(sum - 100) > 2 ? '<p class="err">Your percentages add up to ' + fmt(sum, 4) + ' %, not 100 %.</p>' : "");
  }

  /* ----- Equation balancer ----- */
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { const t = a % b; a = b; b = t; } return a; };
  const fr = (p, q) => { q = q === undefined ? 1 : q; if (q < 0) { p = -p; q = -q; } const g = gcd(p, q) || 1; return [p / g, q / g]; };
  const fsub = (a, b) => fr(a[0] * b[1] - b[0] * a[1], a[1] * b[1]);
  const fmul = (a, b) => fr(a[0] * b[0], a[1] * b[1]);
  const fdiv = (a, b) => fr(a[0] * b[1], a[1] * b[0]);
  function balanceEq(str) {
    const sides = str.split(/\s*(?:->|→|=>|⟶|⇌|=)\s*/);
    if (sides.length !== 2 || !sides[0].trim() || !sides[1].trim()) throw new Error("Write it with one arrow, like Fe + O2 -> Fe2O3.");
    const species = [];
    sides.forEach((side, si) => side.split("+").forEach(raw => {
      const f = raw.trim().replace(/\((s|l|g|aq)\)/g, "").replace(/^\d+\s*/, "").trim();
      if (!f) throw new Error("There is an empty term next to a + sign. Charges like Fe3+ aren't supported.");
      species.push({ f, counts: parseFormula(f).total, side: si ? -1 : 1 });
    }));
    const elems = [...new Set(species.flatMap(s => Object.keys(s.counts)))];
    for (const e of elems) {
      const l = species.some(s => s.side > 0 && s.counts[e]), r = species.some(s => s.side < 0 && s.counts[e]);
      if (!(l && r)) throw new Error(e + " appears on only one side, so this can't balance.");
    }
    const n = species.length, M = elems.map(e => species.map(s => fr((s.counts[e] || 0) * s.side)));
    const pivots = []; let r = 0;
    for (let col = 0; col < n && r < M.length; col++) {
      let i = r; while (i < M.length && M[i][col][0] === 0) i++;
      if (i === M.length) continue;
      [M[i], M[r]] = [M[r], M[i]];
      const pv = M[r][col]; M[r] = M[r].map(x => fdiv(x, pv));
      for (let k = 0; k < M.length; k++) if (k !== r && M[k][col][0] !== 0) { const f = M[k][col]; M[k] = M[k].map((x, j) => fsub(x, fmul(f, M[r][j]))); }
      pivots.push(col); r++;
    }
    const free = [...Array(n).keys()].filter(j => !pivots.includes(j));
    if (free.length !== 1) throw new Error(free.length ? "This has more than one balanced form; it may be two reactions mixed together." : "This can't be balanced. Check the formulas.");
    const fv = free[0], x = Array(n).fill(null).map(() => fr(0)); x[fv] = fr(1);
    pivots.forEach((pc, row) => { x[pc] = fmul(fr(-1), M[row][fv]); });
    const L = x.reduce((l, f) => l / gcd(l, f[1]) * f[1], 1);
    let ints = x.map(f => f[0] * (L / f[1]));
    if (ints.every(v => v <= 0)) ints = ints.map(v => -v);
    if (ints.some(v => v <= 0)) throw new Error("This can't be balanced with positive amounts. Check which side each substance is on.");
    const g = ints.reduce((a, b) => gcd(a, b)); ints = ints.map(v => v / g);
    return { species, coef: ints, elems };
  }
  function renderEq() {
    const v = $("eq").value.trim(), out = $("eqout");
    if (!v) { out.innerHTML = '<p class="muted">Type a chemical equation with an arrow (-> or =). The smallest whole-number coefficients are found so every kind of atom is counted the same on both sides.</p>'; return; }
    try {
      const r = balanceEq(v), idx = r.species.map((s, i) => i);
      const term = i => '<span class="co">' + (r.coef[i] > 1 ? r.coef[i] : "") + '</span>' + prettyFormula(r.species[i].f);
      const left = idx.filter(i => r.species[i].side > 0), right = idx.filter(i => r.species[i].side < 0);
      const count = (list, e) => list.reduce((a, i) => a + r.coef[i] * (r.species[i].counts[e] || 0), 0);
      const mass = list => list.reduce((a, i) => a + r.coef[i] * molarOf(r.species[i].counts), 0);
      out.innerHTML = '<div class="eq-out">' + left.map(term).join(" + ") + " → " + right.map(term).join(" + ") + '</div>' +
        '<table class="grid"><thead><tr><th>Atom</th><th style="text-align:right">Left</th><th style="text-align:right">Right</th><th></th></tr></thead><tbody>' +
        r.elems.map(e => { const a = count(left, e), b = count(right, e); return '<tr><td>' + BYSYM[e].name + ' (' + e + ')</td><td class="n">' + a + '</td><td class="n">' + b + '</td><td>' + (a === b ? '<span class="ok-mark">✓</span>' : "✗") + '</td></tr>'; }).join("") +
        '</tbody></table><p>Mass check: ' + fmt(mass(left), 6) + ' g in = ' + fmt(mass(right), 6) + ' g out, per mole of reaction <span class="ok-mark">✓</span></p>';
    } catch (e) { out.innerHTML = '<p class="err">' + esc(e.message) + '</p>'; }
  }

  /* ----- Compare and sizes to scale ----- */
  const CMP_ROWS = [
    ["Atomic number", e => e.Z, v => String(v), true],
    ["Atomic mass", e => e.mass, v => fmt(v, 6) + " u"],
    ["Electronegativity", e => e.en, v => fmt(v, 3)],
    ["Atomic radius", e => e.rad, v => v + " pm"],
    ["1st ionization energy", e => e.ie, v => fmt(v, 4) + " kJ/mol"],
    ["Electron affinity", e => e.ea, v => fmt(v, 3) + " kJ/mol"],
    ["Density", e => e.dens, v => v < 0.01 ? fmt(v * 1000, 3) + " g/L" : fmt(v, 4) + " g/cm³"],
    ["Melting point", e => e.melt, v => fmt(v, 5) + " K"],
    ["Boiling point", e => e.boil, v => fmt(v, 5) + " K"],
    ["Crust abundance", e => e.crust, v => crustText(v), true],
    ["Valence electrons", e => e.shells[e.shells.length - 1], v => String(v)],
    ["Oxidation states", e => e.oxi || "n/a"],
    ["Category", e => CAT_NAME[e.cat]],
    ["State now", e => STATE_LBL[stateAt(e, S.T)]],
    ["Block", e => e.block + "-block"],
    ["Discovered", e => e.year ? String(e.year) : "Antiquity"],
    ["Configuration", e => prettyConfig(e.config)],
    ["Crystal", e => CRYSTAL_NAME[e.crystal]]
  ];
  function togglePin(Z) {
    const i = S.pins.indexOf(Z);
    if (i >= 0) S.pins.splice(i, 1); else { S.pins.push(Z); if (S.pins.length > 4) S.pins.shift(); }
    store.set("pins", S.pins); renderCompare();
    if (S.sel) renderPanel(ELEMENTS[S.sel - 1]);
  }
  function renderCompare() {
    const out = $("cmpout"), els = S.pins.map(z => ELEMENTS[z - 1]);
    $("cmpclear").hidden = !els.length;
    if (!els.length) { out.innerHTML = '<p class="muted">Pin up to four elements with the pin button on the element page, then read them side by side here, with their sizes drawn to scale.</p>' + (S.sel ? '<p><button class="btn" type="button" id="cmpadd">Pin ' + ELEMENTS[S.sel - 1].name + '</button></p>' : ""); const b = $("cmpadd"); if (b) b.addEventListener("click", () => togglePin(S.sel)); return; }
    let h = '<div class="cmpwrap"><table class="cmp"><thead><tr><th></th>' + els.map(e => '<th><div class="mini"><span class="ms2" style="--h:' + CAT_HUE[e.cat] + '">' + e.sym + '</span><b>' + e.name + '</b><button class="x" type="button" data-unpin="' + e.Z + '" data-tip="Remove ' + e.name + ' from the comparison">remove</button></div></th>').join("") + '</tr></thead><tbody>';
    for (const [label, get, f, nobar] of CMP_ROWS) {
      const vals = els.map(get), numeric = !!f, max = numeric ? Math.max(...vals.map(v => v || 0)) : 0;
      h += '<tr><td>' + label + '</td>' + vals.map(v => {
        if (!numeric) return '<td>' + v + '</td>';
        if (!v) return '<td><span class="v">n/a</span></td>';
        return '<td><span class="v">' + f(v) + '</span>' + (max && !nobar ? '<div class="bar" style="width:' + Math.max(4, v / max * 100).toFixed(1) + '%"></div>' : "") + '</td>';
      }).join("") + '</tr>';
    }
    out.innerHTML = h + '</tbody></table></div><h4 class="subhead">Sizes to scale</h4><canvas id="scale" aria-label="Pinned atoms drawn to scale by atomic radius"></canvas>';
    drawScale();
  }
  function drawScale() {
    const cv = $("scale"); if (!cv || S.nb !== "compare") return;
    const g = sizeCanvas(cv, 220); if (!g) return;
    const { c, W, H } = g, els = S.pins.map(z => ELEMENTS[z - 1]).filter(e => e.rad);
    if (!els.length) { Ink.seed(1); Ink.text(c, "No radius data for these elements.", 10, H / 2, 19, PAL.ink2, "left"); return; }
    const gap = 26, base = H - 44, maxR = Math.max(...els.map(e => e.rad)), sumD = els.reduce((a, e) => a + 2 * e.rad, 0);
    const k = Math.min((base - 30) / (2 * maxR), (W - 30 - gap * (els.length - 1)) / sumD);
    let x = 15;
    c.strokeStyle = PAL.ink2; c.lineWidth = 1.2; Ink.seed(2); c.beginPath(); Ink.line(c, 8, base, W - 8, base, { passes: 1 }); c.stroke();
    els.forEach(e => {
      const r = e.rad * k, cx = x + r, cy = base - r;
      Ink.seed(e.Z * 13);
      c.globalAlpha = PAL.chalk ? 0.7 : 0.6; c.fillStyle = catColor(e.cat); c.beginPath(); Ink.blob(c, cx + r * 0.04, cy + r * 0.03, r * 0.97, r * 0.05); c.fill();
      c.globalAlpha = 0.45; c.strokeStyle = PAL.ink2; c.lineWidth = 0.9; c.beginPath(); Ink.hatch(c, cx, cy, r * 0.93, 0.785, Math.max(3, r * 0.09), 0.2); c.stroke();
      c.globalAlpha = 1; c.strokeStyle = PAL.ink; c.lineWidth = 1.4; c.beginPath(); Ink.circle(c, cx, cy, r, { passes: 2 }); c.stroke();
      Ink.text(c, e.sym, cx, cy, Math.max(14, Math.min(34, r * 0.7)), PAL.ink, "center");
      Ink.text(c, e.rad + " pm", cx, base + 18, 16, PAL.ink2, "center");
      x += 2 * r + gap;
    });
    const bar = 100 * k; c.strokeStyle = PAL.ink; c.lineWidth = 1.4; c.beginPath(); Ink.line(c, W - 14 - bar, 16, W - 14, 16, { passes: 1, wob: 0.6 });
    c.moveTo(W - 14 - bar, 11); c.lineTo(W - 14 - bar, 21); c.moveTo(W - 14, 11); c.lineTo(W - 14, 21); c.stroke();
    Ink.text(c, "100 pm", W - 14 - bar / 2, 32, 15, PAL.ink2, "center");
  }

  /* ----- Quiz: find, timed, flashcards ----- */
  const Q = { on: false, mode: "find", n: 0, total: 10, score: 0, cur: null, lock: false, hist: [], timer: 0, tick: 0, ends: 0, best: store.get("best", {}) };
  if (!Q.best || typeof Q.best !== "object") Q.best = {};
  const pick = a => a[Math.floor(Math.random() * a.length)];
  function makeQ() {
    const pool = ELEMENTS.filter(e => e.Z <= 103), k = pick(["name", "name", "name", "z", "cat", "pos", "config", "en", "rad"]);
    if (k === "name") { const e = pick(pool); return { text: "Find <b>" + e.name + "</b>", ok: x => x.Z === e.Z, ans: [e.Z] }; }
    if (k === "z") { const e = pick(pool); return { text: "Find element number <b>" + e.Z + "</b>", ok: x => x.Z === e.Z, ans: [e.Z] }; }
    if (k === "cat") { const c = pick(CATEGORIES); return { text: "Find any <b>" + c[1].toLowerCase() + "</b>", ok: x => x.cat === c[0], ans: ELEMENTS.filter(e => e.cat === c[0]).map(e => e.Z) }; }
    if (k === "config") { const e = pick(ELEMENTS.filter(x => x.Z <= 56)); return { text: "Find the element with configuration <b>" + e.config.replace(/(\d[spdf]) (\d+)/g, (m0, a, b) => a + sup(b)) + "</b>", ok: x => x.Z === e.Z, ans: [e.Z] }; }
    if (k === "en" || k === "rad") {
      const prop = k === "en" ? "en" : "rad", minD = k === "en" ? 0.4 : 20, cand = ELEMENTS.filter(e => e.Z <= 86 && e[prop] > 0);
      let a, b, n = 0; do { a = pick(cand); b = pick(cand); n++; } while ((a === b || Math.abs(a[prop] - b[prop]) < minD) && n < 200);
      const w = a[prop] > b[prop] ? a : b;
      return { text: (k === "en" ? "Which is more electronegative: " : "Which atom is bigger: ") + "<b>" + a.name + "</b> or <b>" + b.name + "</b>?", ok: x => x.Z === w.Z, ans: [w.Z], pair: [a.Z, b.Z] };
    }
    const e = pick(ELEMENTS.filter(x => x.block !== "f")); return { text: "Find the element in <b>group " + e.group + ", period " + e.period + "</b>", ok: x => x.Z === e.Z, ans: [e.Z] };
  }
  function clearMarks() { ELEMENTS.forEach(e => tiles[e.Z].classList.remove("q-ok", "q-bad", "q-ans", "q-pair")); }
  const bestKey = () => Q.mode === "timed" ? "timed" : String(Q.total);
  function quizBar(feed, good) {
    $("qprompt").innerHTML = Q.cur ? Q.cur.text : "";
    $("qmeta").textContent = Q.mode === "timed" ? "⏱ " + Math.max(0, Math.ceil((Q.ends - performance.now()) / 1000)) + " s left · score " + Q.score : "question " + Q.n + " of " + Q.total + " · score " + Q.score;
    if (feed !== undefined) { const f = $("qfeed"); f.textContent = feed || ""; f.className = "qfeed" + (feed ? good ? " good" : " bad" : ""); }
  }
  function quizStart() {
    if (S.nb === "timeline") showPage("quiz");
    Q.mode = $("qmode").value === "timed" ? "timed" : "find";
    Q.on = true; Q.n = 0; Q.score = 0; Q.hist = []; Q.total = Q.mode === "timed" ? Infinity : (+$("qcount").value || 10);
    if (Draw.on) setDraw(false);
    hideCard();
    document.body.classList.add("quizzing"); $("quizbar").hidden = false;
    S.cat = null; S.q = ""; qEl.value = ""; refresh();
    if (Q.mode === "timed") { Q.ends = performance.now() + 60000; clearInterval(Q.tick); Q.tick = setInterval(() => { if (performance.now() >= Q.ends) quizStop(true); else quizBar(); }, 250); }
    nextQ(); renderQuiz();
    $("quizbar").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function quizStop(finished) {
    clearTimeout(Q.timer); clearInterval(Q.tick); Q.on = false; Q.cur = null; clearMarks();
    document.body.classList.remove("quizzing"); $("quizbar").hidden = true;
    if (finished) { const k = bestKey(); if (!Q.best[k] || Q.score > Q.best[k]) { Q.best[k] = Q.score; store.set("best", Q.best); } }
    refresh(); renderQuiz(finished);
  }
  function nextQ() {
    clearTimeout(Q.timer); clearMarks();
    if (!Q.on) return;
    if (Q.n >= Q.total) { quizStop(true); return; }
    Q.n++; Q.cur = makeQ(); Q.lock = false;
    if (Q.cur.pair) Q.cur.pair.forEach(z => tiles[z].classList.add("q-pair"));
    quizBar(""); renderQuiz();
  }
  function quizAnswer(el) {
    if (Q.lock || !Q.cur) return;
    Q.lock = true;
    const good = Q.cur.ok(el);
    tiles[el.Z].classList.add(good ? "q-ok" : "q-bad");
    if (good) Q.score++; else Q.cur.ans.forEach(z => tiles[z].classList.add("q-ans"));
    Q.hist.push(good);
    quizBar(good ? "Yes, " + el.name + "!" : "That's " + el.name + (Q.cur.ans.length === 1 ? ". Look for " + ELEMENTS[Q.cur.ans[0] - 1].name + "." : "."), good);
    select(el.Z, false); renderQuiz();
    Q.timer = setTimeout(nextQ, Q.mode === "timed" ? (good ? 550 : 1300) : (good ? 1000 : 2000));
  }
  const FC = { box: store.get("cards", {}), cur: 0 };
  if (!FC.box || typeof FC.box !== "object") FC.box = {};
  const deck = () => ELEMENTS.filter(e => e.Z <= (+$("qdeck").value || 36));
  function nextCard() {
    const d = deck(), w = d.map(e => Math.pow(2, 5 - (FC.box[e.Z] || 1)));
    let r = Math.random() * w.reduce((a, b) => a + b, 0), i = 0;
    for (; i < d.length - 1; i++) { r -= w[i]; if (r <= 0) break; }
    let z = d[i].Z; if (z === FC.cur && d.length > 1) z = d[(i + 1) % d.length].Z;
    FC.cur = z; renderCards();
  }
  function renderCards() {
    const out = $("quizout"), e = ELEMENTS[FC.cur - 1], d = deck(), counts = [1, 2, 3, 4, 5].map(b => d.filter(x => (FC.box[x.Z] || 1) === b).length);
    out.innerHTML = '<div class="fc-wrap"><button class="fcard" id="fcard" type="button" aria-label="Flashcard: ' + e.sym + '. Click to flip."><span class="in">' +
      '<span class="fc front"><span class="big">' + e.sym + '</span><small>Which element is this? Click to flip.</small></span>' +
      '<span class="fc back"><span class="nm2">' + e.name + '</span><small>Z = ' + e.Z + ' · ' + CAT_NAME[e.cat] + ' · ' + fmt(e.mass, 5) + ' u</small><small>' + esc(e.sum) + '</small></span></span></button>' +
      '<div class="ex"><button class="btn" id="fcno" type="button" disabled>Missed it</button><button class="btn primary" id="fcyes" type="button" disabled>Knew it</button></div>' +
      '<div class="boxes">' + counts.map((c, i) => '<span>box ' + (i + 1) + ': <b>' + c + '</b></span>').join("") + '</div>' +
      '<p class="muted">Cards you miss go back to box 1 and come up often. Cards you know move up a box and come up less. Progress stays on this device.</p></div>';
    $("fcard").addEventListener("click", () => { const c = $("fcard"); c.classList.toggle("flip"); $("fcno").disabled = $("fcyes").disabled = !c.classList.contains("flip"); });
    $("fcyes").addEventListener("click", () => { FC.box[FC.cur] = Math.min(5, (FC.box[FC.cur] || 1) + 1); store.set("cards", FC.box); nextCard(); });
    $("fcno").addEventListener("click", () => { FC.box[FC.cur] = 1; store.set("cards", FC.box); nextCard(); });
  }
  function renderQuiz(finished) {
    const out = $("quizout"), mode = $("qmode").value;
    $("qcountf").hidden = mode !== "find"; $("qdeckf").hidden = mode !== "cards";
    if (mode === "cards" && !Q.on) { if (!FC.cur || FC.cur > (+$("qdeck").value || 36)) nextCard(); else renderCards(); return; }
    const dots = Q.hist.length ? '<div class="dots" aria-label="Answers so far">' + Q.hist.map(g => '<span class="' + (g ? "g" : "b") + '">' + (g ? "✓" : "✗") + '</span>').join("") + '</div>' : "";
    const bk = mode === "timed" ? "timed" : String(+$("qcount").value || 10), best = Q.best[bk];
    if (Q.on) { out.innerHTML = '<p>The question is above the table. Names and numbers are hidden from the tiles while you play.</p>' + dots + '<p><button class="btn" type="button" id="qstop2">Stop quiz</button></p>'; $("qstop2").addEventListener("click", () => quizStop(false)); return; }
    let h = "";
    if (finished) {
      if (Q.mode === "timed") h += '<p><span class="grade">' + Q.score + '</span>  <span class="fx-pretty">right in 60 seconds</span></p>' + dots;
      else { const p = Q.score / Q.total, word = p === 1 ? "Perfect!" : p >= 0.8 ? "Great work" : p >= 0.5 ? "Not bad" : "Keep practising";
        h += '<p><span class="grade">' + Q.score + ' / ' + Q.total + '</span>  <span class="fx-pretty">' + word + '</span></p>' + dots; }
    }
    h += mode === "timed" ? '<p>Answer as many as you can in 60 seconds. Questions ask for elements by name, number, category, position or configuration, and which of two is bigger or more electronegative.</p>'
      : '<p>Find elements by name, atomic number, category, position or configuration, and pick which of two is bigger or more electronegative. Names and numbers are hidden from the tiles while you play.</p>';
    h += (best !== undefined ? '<p class="muted">Best score' + (mode === "timed" ? " in 60 seconds" : " for " + bk + " questions") + ': ' + best + '</p>' : "") +
      '<p><button class="btn primary" type="button" id="qgo" data-tip="Start a new round">' + (finished ? "Play again" : "Start quiz") + '</button></p>';
    out.innerHTML = h; $("qgo").addEventListener("click", quizStart);
  }

  /* ----- Discovery timeline ----- */
  let tlTimer = 0;
  function setTimeline(y) {
    S.timeline = y; $("tl").value = y;
    $("tlout").textContent = y <= 1600 ? "Antiquity" : String(y);
    const known = ELEMENTS.filter(e => (e.year || 0) <= y), recent = ELEMENTS.filter(e => e.year && e.year <= y && e.year > y - 6).sort((a, b) => b.year - a.year);
    $("tlnote").innerHTML = '<b>' + known.length + '</b> elements known' + (y <= 1600 ? ' since ancient times: ' + ELEMENTS.filter(e => !e.year).map(e => e.name).join(", ") + "." :
      recent.length ? ". Newly found: " + recent.map(e => e.name + " (" + e.year + ")").join(", ") + "." : ".") + (y >= 1869 && y < 1875 ? " In 1869 Mendeleev published his periodic table, leaving gaps for elements not yet found." : "");
    refresh(); drawTimeline();
  }
  function drawTimeline() {
    const cv = $("tlchart"); if (!cv || S.nb !== "timeline") return;
    const g = sizeCanvas(cv, 170); if (!g) return;
    const { c, W, H } = g, m = { l: 40, r: 14, t: 14, b: 28 }, pw = W - m.l - m.r, ph = H - m.t - m.b;
    const X = y => m.l + (Math.max(1600, y) - 1600) / 410 * pw, Y = n => m.t + ph - n / 118 * ph;
    Ink.seed(5); c.strokeStyle = PAL.ink; c.lineWidth = 1.4; c.beginPath();
    Ink.line(c, m.l, m.t - 4, m.l, m.t + ph, { wob: 0.8 }); Ink.line(c, m.l, m.t + ph, m.l + pw + 4, m.t + ph, { wob: 0.8 }); c.stroke();
    c.font = "11px 'Courier Prime', monospace"; c.fillStyle = PAL.ink2; c.textAlign = "center"; c.textBaseline = "top";
    for (const y of [1600, 1700, 1800, 1900, 2000]) c.fillText(y === 1600 ? "old" : y, X(y), m.t + ph + 6);
    c.textAlign = "right"; c.textBaseline = "middle"; for (const n of [0, 50, 100]) c.fillText(n, m.l - 6, Y(n));
    c.strokeStyle = PAL.ink2; c.globalAlpha = 0.5; c.setLineDash([3, 4]); c.beginPath(); c.moveTo(X(1869), m.t); c.lineTo(X(1869), m.t + ph); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
    Ink.text(c, "Mendeleev 1869", X(1869) + 5, m.t + 8, 15, PAL.ink2, "left");
    const yrs = ELEMENTS.map(e => e.year || 1600).sort((a, b) => a - b);
    c.strokeStyle = PAL.blue; c.lineWidth = 1.8; c.beginPath(); let n = 0, y0 = 1600;
    c.moveTo(X(1600), Y(0));
    for (const y of yrs) { c.lineTo(X(y), Y(n)); n++; c.lineTo(X(y), Y(n)); y0 = y; }
    c.lineTo(X(2010), Y(n)); c.stroke();
    const yy = S.timeline === null ? 2010 : S.timeline, cnt = ELEMENTS.filter(e => (e.year || 0) <= yy).length;
    c.strokeStyle = PAL.accent; c.lineWidth = 2; c.beginPath(); Ink.circle(c, X(yy), Y(cnt), 7, { passes: 2 }); c.stroke();
    Ink.text(c, cnt + " known", X(yy) + (X(yy) > W - 90 ? -12 : 12), Y(cnt) + (Y(cnt) < 30 ? 14 : -12), 17, PAL.accent, X(yy) > W - 90 ? "right" : "left");
  }
  function toggleTimelinePlay() {
    if (tlTimer) { clearInterval(tlTimer); tlTimer = 0; $("tlplay").textContent = "Play"; return; }
    if (+$("tl").value >= 2010) setTimeline(1600);
    $("tlplay").textContent = "Pause";
    tlTimer = setInterval(() => { const y = Math.min(2010, +$("tl").value + 2); setTimeline(y); if (y >= 2010) toggleTimelinePlay(); }, 90);
  }

  /* ----- Printing ----- */
  function doPrint(kind) {
    const pa = $("printArea"); let h = "";
    const card = e => '<div class="pcard"><small>' + e.Z + ' · ' + fmt(e.mass, 5) + ' u</small><div class="s">' + e.sym + '</div><div class="n">' + e.name + '</div><small>' + CAT_NAME[e.cat] + '</small><small>' + esc(e.config) + '</small></div>';
    if (kind.indexOf("cards") === 0) {
      const list = kind === "cards-all" ? ELEMENTS : kind === "cards-36" ? ELEMENTS.slice(0, 36) : S.pins.map(z => ELEMENTS[z - 1]);
      if (!list.length) { toast("Pin some elements first"); return; }
      h = '<div class="pcards">' + list.map(card).join("") + '</div>';
    } else if (kind === "worksheet") {
      h = '<div class="pws"><h1>The periodic table</h1><p>Name: ____________________ &nbsp; Date: ____________</p>' +
        '<div class="pgrid" style="grid-template-rows:repeat(7,auto) 10px repeat(2,auto)">' + ELEMENTS.map(e => '<div style="grid-row:' + e.row + ';grid-column:' + e.col + '">' + e.Z + '</div>').join("") + '</div>' +
        '<ol><li>Write the symbol in each box.</li><li>Colour the alkali metals red, the halogens green and the noble gases blue.</li><li>Draw a thick line between the metals and the non-metals.</li>' +
        '<li>Circle the element with the highest electronegativity.</li><li>Which group are the noble gases in? ________</li><li>How many electrons does a neutral oxygen atom have? ________</li>' +
        '<li>Name one element that is a liquid at room temperature: ________</li></ol></div>';
    } else {
      const el = ELEMENTS[S.sel - 1], img = Scene3D.snapshot(el.name + " (" + el.sym + ")"), note = S.notes[el.Z];
      h = '<div class="ppage"><h1>' + el.name + ' (' + el.sym + ') · ' + el.Z + '</h1><p>' + esc(el.sum) + '</p><img src="' + img + '" alt="">' +
        '<dl class="props">' + $("props").innerHTML + '</dl><p><b>Electron configuration:</b> ' + prettyConfig(el.config) + '</p>' +
        (note ? '<p><b>My note:</b> ' + esc(note) + '</p>' : "") + '</div>';
    }
    pa.innerHTML = h; document.body.classList.add("printmode");
    const done = () => { document.body.classList.remove("printmode"); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done);
    setTimeout(() => window.print(), 60);
  }

  /* ----- Pencil tool: doodles on the table and on each drawing ----- */
  let DOODLES = store.get("doodles", {});
  if (!DOODLES || typeof DOODLES !== "object") DOODLES = {};
  const Draw = { on: false, tool: "pen", col: "ink", last: null };
  function Doodle(host, keyFn) {
    const cv = document.createElement("canvas"); cv.className = "doodle"; cv.setAttribute("aria-hidden", "true"); host.appendChild(cv);
    const c = cv.getContext("2d"); let key = "", strokes = [], cur = null, W = 0, H = 0, lastPt = null;
    function resize() { W = host.clientWidth; H = host.clientHeight; const d = dprOf(); cv.width = Math.max(1, Math.round(W * d)); cv.height = Math.max(1, Math.round(H * d)); c.setTransform(d, 0, 0, d, 0, 0); draw(); }
    function stroke(s) {
      const p = s.p; if (!p || p.length < 4) return;
      c.save(); c.lineCap = "round"; c.lineJoin = "round";
      if (s.t === "hi") { c.globalAlpha = PAL.chalk ? 0.35 : 0.45; c.strokeStyle = PAL.chalk ? "#ffd36a" : "#ffd84a"; c.lineWidth = 16; if (!PAL.chalk) c.globalCompositeOperation = "multiply"; }
      else { c.strokeStyle = PAL[s.c] || PAL.ink; c.lineWidth = 2.3; c.globalAlpha = 0.92; }
      c.beginPath(); c.moveTo(p[0] * W, p[1] * H);
      for (let i = 2; i < p.length - 2; i += 2) c.quadraticCurveTo(p[i] * W, p[i + 1] * H, (p[i] + p[i + 2]) / 2 * W, (p[i + 1] + p[i + 3]) / 2 * H);
      c.lineTo(p[p.length - 2] * W, p[p.length - 1] * H); c.stroke(); c.restore();
    }
    function draw() { c.clearRect(0, 0, W, H); strokes.forEach(stroke); if (cur && !cur.erase) stroke(cur); }
    function load() { key = keyFn(); strokes = Array.isArray(DOODLES[key]) ? DOODLES[key].slice() : []; draw(); }
    function save() { if (strokes.length) DOODLES[key] = strokes; else delete DOODLES[key]; store.set("doodles", DOODLES); }
    const pos = e => { const r = cv.getBoundingClientRect(); return [+((e.clientX - r.left) / r.width).toFixed(4), +((e.clientY - r.top) / r.height).toFixed(4)]; };
    function eraseAt(p) {
      const rx = 12 / W, ry = 12 / H, n = strokes.length;
      strokes = strokes.filter(s => { for (let i = 0; i < s.p.length; i += 2) if (Math.abs(s.p[i] - p[0]) < rx && Math.abs(s.p[i + 1] - p[1]) < ry) return false; return true; });
      if (strokes.length !== n) { save(); draw(); }
    }
    cv.addEventListener("pointerdown", e => {
      if (!Draw.on) return;
      e.preventDefault(); e.stopPropagation(); try { cv.setPointerCapture(e.pointerId); } catch (_) {}
      Draw.last = api; const p = pos(e);
      if (Draw.tool === "er") { cur = { erase: true }; eraseAt(p); return; }
      cur = { t: Draw.tool, c: Draw.col, p: [p[0], p[1]] }; lastPt = [e.clientX, e.clientY, performance.now()]; Sound.penStart();
    });
    cv.addEventListener("pointermove", e => {
      if (!cur) return; e.stopPropagation();
      const p = pos(e); if (cur.erase) { eraseAt(p); return; }
      cur.p.push(p[0], p[1]);
      const now = performance.now(); Sound.penMove(Math.hypot(e.clientX - lastPt[0], e.clientY - lastPt[1]) / Math.max(1, now - lastPt[2]) * 16); lastPt = [e.clientX, e.clientY, now];
      draw();
    });
    const end = e => { if (!cur) return; e.stopPropagation(); if (!cur.erase && cur.p.length >= 4) { strokes.push(cur); save(); } cur = null; Sound.penEnd(); draw(); };
    cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end);
    cv.addEventListener("wheel", e => { if (Draw.on) e.stopPropagation(); }, { passive: true });
    new ResizeObserver(resize).observe(host);
    const api = { load, draw, setActive(b) { cv.classList.toggle("on", b); }, undo() { if (!strokes.length) return false; strokes.pop(); save(); draw(); return true; }, clear() { strokes = []; save(); draw(); } };
    return api;
  }
  let tableDoodle = null, stageDoodle = null;
  function setDraw(on) {
    Draw.on = on; document.body.classList.toggle("drawing", on);
    $("drawbar").hidden = !on; $("drawbtn").setAttribute("aria-pressed", String(on));
    tableDoodle.setActive(on); stageDoodle.setActive(on);
    if (on) toast("Draw on the table or on the drawing. Press Done when finished.");
  }

  /* ----- Share links: state lives in the URL hash ----- */
  let lastHash = "";
  function updateHash() {
    if (!S.sel) return;
    const p = ["el=" + S.sel];
    if (S.view !== "atom") p.push("v=" + S.view);
    if (S.render !== "3d") p.push("r=" + S.render);
    if (S.T !== 298) p.push("t=" + S.T);
    if (S.charge) p.push("c=" + S.charge);
    if (S.N !== null) p.push("n=" + S.N);
    if (S.mode !== "cat") p.push("m=" + S.mode);
    if (S.theme !== "paper") p.push("th=" + S.theme);
    const h = p.length === 1 && S.sel === PAGE_EL ? "" : "#" + p.join("&");
    if (h === lastHash) return;
    lastHash = h;
    try { history.replaceState(null, "", h || location.pathname + location.search); } catch (_) {}
  }
  function readHash() {
    const h = location.hash, m1 = /^#el-(\d{1,3})$/.exec(h);
    if (m1) return { el: m1[1] };
    const o = {}; h.replace(/^#/, "").split("&").forEach(kv => { const i = kv.indexOf("="); if (i > 0) o[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1)); });
    return o;
  }
  function applyHash(o, first) {
    if (o.th === "chalk" || o.th === "paper") setTheme(o.th);
    if (o.r === "3d" || o.r === "sketch") setRender(o.r);
    if (o.m && MODES[o.m] || ["cat", "state", "block", "haz"].includes(o.m)) { modeEl.value = o.m; S.mode = o.m; }
    if (o.t !== undefined && o.t !== "" && !isNaN(+o.t)) { S.T = clamp(Math.round(+o.t), 0, 6000); tempEl.value = S.T; tempOut.textContent = S.T + " K · " + fmt(S.T - 273.15, 4) + " °C"; Scene3D.setT(S.T); }
    if (["atom", "cloud", "lattice", "light"].includes(o.v)) setView(o.v); else if (!first) setView("atom");
    const z = +o.el, Z = z >= 1 && z <= 118 ? z : (S.sel || PAGE_EL);
    const n = o.n !== undefined && o.n !== "" && !isNaN(+o.n) ? clamp(Math.round(+o.n), 0, 200) : undefined;
    S.charge = 0;
    select(Z, undefined, { N: n });
    if (o.c !== undefined && !isNaN(+o.c) && +o.c) setCharge(Math.round(+o.c));
    refresh();
  }

  /* ----- Arrow keys move around the table grid ----- */
  const GRID = {}; ELEMENTS.forEach(e => { GRID[e.row + "," + e.col] = e.Z; });
  const ROWS = [1, 2, 3, 4, 5, 6, 7, 9, 10];
  function gridMove(Z, key) {
    const e = ELEMENTS[Z - 1], r = e.row, c = e.col;
    if (key === "ArrowLeft" || key === "ArrowRight") {
      const d = key === "ArrowLeft" ? -1 : 1;
      for (let cc = c + d; cc >= 1 && cc <= 18; cc += d) if (GRID[r + "," + cc]) return GRID[r + "," + cc];
      return Z;
    }
    const d = key === "ArrowUp" ? -1 : 1;
    for (let ri = ROWS.indexOf(r) + d; ri >= 0 && ri < ROWS.length; ri += d) {
      const rr = ROWS[ri]; if (GRID[rr + "," + c]) return GRID[rr + "," + c];
      let best = 0, bd = 99; for (let cc = 1; cc <= 18; cc++) if (GRID[rr + "," + cc] && Math.abs(cc - c) < bd) { bd = Math.abs(cc - c); best = GRID[rr + "," + cc]; }
      if (best && bd <= 1) return best;
    }
    return Z;
  }

  /* ----- Notebook pages ----- */
  const PAGES = ["trends", "states", "nuclides", "molar", "equation", "compare", "quiz", "timeline", "print"];
  function showPage(pg) {
    if (S.nb === "timeline" && pg !== "timeline") { if (tlTimer) toggleTimelinePlay(); S.timeline = null; refresh(); }
    S.nb = pg; store.set("nb", pg);
    document.querySelectorAll(".nb-tab").forEach(t => t.setAttribute("aria-selected", String(t.dataset.pg === pg)));
    PAGES.forEach(p => { $("pg-" + p).hidden = p !== pg; });
    refresh();
    if (pg === "trends") drawTrends();
    if (pg === "compare") renderCompare();
    if (pg === "quiz") renderQuiz();
    if (pg === "timeline") setTimeline(+$("tl").value);
    if (pg === "states") drawStates();
    if (pg === "nuclides") drawNuclides();
  }

  /* ----- Wiring ----- */
  function toggleBtn(id, fn) { $(id).addEventListener("click", e => { const on = e.currentTarget.getAttribute("aria-pressed") !== "true"; e.currentTarget.setAttribute("aria-pressed", String(on)); fn(on); }); }
  function init() {
    document.documentElement.dataset.theme = S.theme; readPalette();
    buildTable();
    $("chips").innerHTML = [["0 K", 0], ["Room", 298], ["Boiling water", 373], ["1000 K", 1000], ["3000 K", 3000], ["6000 K", 6000]].map(c => '<button type="button" class="chip" data-t="' + c[1] + '" data-tip="Set the temperature to ' + c[1] + ' K (' + fmt(c[1] - 273.15, 4) + ' °C)">' + c[0] + '</button>').join("");
    $("chips").addEventListener("click", e => { const b = e.target.closest(".chip"); if (b) setTemp(+b.dataset.t); });
    tempEl.addEventListener("input", () => setTemp(+tempEl.value));
    modeEl.addEventListener("change", () => { S.mode = modeEl.value; refresh(); updateHash(); });
    qEl.addEventListener("input", () => { S.q = qEl.value; refresh(); });
    qEl.addEventListener("keydown", e => { if (e.key === "Enter") { const m = ELEMENTS.find(matches); if (m && S.q.trim()) select(m.Z, true); } });
    $("prev").addEventListener("click", () => select(S.sel === 1 ? 118 : S.sel - 1));
    $("next").addEventListener("click", () => select(S.sel === 118 ? 1 : S.sel + 1));
    $("rand").addEventListener("click", () => select(1 + Math.floor(Math.random() * 118)));
    $("pin").addEventListener("click", () => togglePin(S.sel));
    $("totable").addEventListener("click", () => { const t = tiles[S.sel]; document.querySelector(".tablewrap").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); if (t) t.focus({ preventScroll: true }); });
    $("link").addEventListener("click", async () => {
      updateHash(); const url = location.href;
      try { await navigator.clipboard.writeText(url); toast("Link copied"); }
      catch (_) {
        const ta = document.createElement("textarea"); ta.value = url; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select();
        let ok = false; try { ok = document.execCommand("copy"); } catch (__) {} ta.remove();
        toast(ok ? "Link copied" : "Copy the link from the address bar");
      }
    });
    document.querySelectorAll(".tab").forEach(t => t.addEventListener("click", () => { setView(t.dataset.view); renderScene(); updateHash(); }));
    $("r3d").addEventListener("click", () => setRender("3d"));
    $("rsk").addEventListener("click", () => setRender("sketch"));
    toggleBtn("spin", on => Scene3D.setSpin(on));
    toggleBtn("bonds", on => Scene3D.setBonds(on));
    toggleBtn("wobble", on => { S.wobble = on; store.set("wobble", on); Scene3D.setWobble(on); });
    $("reset").addEventListener("click", () => Scene3D.reset());
    $("save").addEventListener("click", () => {
      const el = ELEMENTS[S.sel - 1], vname = { atom: "atom", cloud: "orbitals", lattice: "crystal", light: "light" }[S.view];
      const url = Scene3D.snapshot(el.name + " (" + el.sym + ") · " + vname + (S.render === "sketch" ? " · sketched" : ""));
      const a = document.createElement("a"); a.href = url; a.download = el.name.toLowerCase() + "-" + vname + (S.render === "sketch" ? "-sketch" : "") + ".png";
      document.body.appendChild(a); a.click(); a.remove();
    });
    // atom controls
    $("chm").addEventListener("click", () => setCharge(S.charge - 1));
    $("chp").addEventListener("click", () => setCharge(S.charge + 1));
    $("ionchips").addEventListener("click", e => { const b = e.target.closest("[data-q]"); if (b) setCharge(+b.dataset.q === S.charge ? 0 : +b.dataset.q); });
    $("nsl").addEventListener("input", () => { const el = ELEMENTS[S.sel - 1], v = +$("nsl").value; S.N = v === el.neutrons ? null : v; decayToken++; rerender(); });
    $("decay").addEventListener("click", doDecay);
    $("nuc").addEventListener("click", e => {
      const b = e.target.closest("[data-n]"); if (!b) return;
      compareWith(b.dataset.z ? +b.dataset.z : S.sel, +b.dataset.n);
    });
    const nc = $("nucchart");
    nc.addEventListener("pointermove", e => { const h = nucHit(e); const k = h ? h.join(",") : ""; if (k !== (S.nucHover ? S.nucHover.join(",") : "")) { S.nucHover = h; nc.style.cursor = h ? "pointer" : "default"; drawNuclides(); } });
    nc.addEventListener("pointerleave", () => { if (S.nucHover) { S.nucHover = null; drawNuclides(); } });
    nc.addEventListener("click", e => { const h = nucHit(e); if (h) compareWith(h[0], h[1]); });
    $("nucpage").addEventListener("click", e => { const b = e.target.closest("[data-z]"); if (b) compareWith(+b.dataset.z, +b.dataset.n); });
    $("nuclists").addEventListener("click", e => { const b = e.target.closest("[data-z]"); if (!b) return; compareWith(+b.dataset.z, +b.dataset.n, b.dataset.pz ? { z: +b.dataset.pz, n: +b.dataset.pn } : null); });
    const setZoom = zm => { S.nucZoom = zm; $("nuczc").setAttribute("aria-pressed", String(zm === "close")); $("nucza").setAttribute("aria-pressed", String(zm === "all")); drawNuclides(); };
    $("nuczc").addEventListener("click", () => setZoom("close"));
    $("nucza").addEventListener("click", () => setZoom("all"));
    $("latchips").addEventListener("click", e => { const b = e.target.closest("[data-t]"); if (b) setTemp(+b.dataset.t); });
    $("maxbtn").addEventListener("click", () => setMax(!simHome));
    $("simclose").addEventListener("click", () => setMax(false));
    $("simprev").addEventListener("click", () => select(S.sel === 1 ? 118 : S.sel - 1));
    $("simnext").addEventListener("click", () => select(S.sel === 118 ? 1 : S.sel + 1));
    $("simmodal").addEventListener("close", () => { if (simHome) setMax(false); });
    document.querySelectorAll(".tmark").forEach(mk => mk.addEventListener("click", () => setTemp(clamp(+mk.dataset.t, 0, 6000))));
    // phase strip: click or drag to set the temperature, arrow keys to nudge it
    const pb = $("phasebar"); let pdrag = false;
    const pset = e => { const r = pb.getBoundingClientRect(); setTemp(PH_T((e.clientX - r.left) / r.width)); };
    pb.addEventListener("pointerdown", e => { pdrag = true; try { pb.setPointerCapture(e.pointerId); } catch (_) {} pset(e); });
    pb.addEventListener("pointermove", e => { if (pdrag) pset(e); });
    pb.addEventListener("pointerup", () => { pdrag = false; }); pb.addEventListener("pointercancel", () => { pdrag = false; });
    pb.addEventListener("keydown", e => { const d = e.shiftKey ? 100 : 10; if (e.key === "ArrowRight" || e.key === "ArrowUp") { setTemp(clamp(S.T + d, 0, 6000)); e.preventDefault(); e.stopPropagation(); } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") { setTemp(clamp(S.T - d, 0, 6000)); e.preventDefault(); e.stopPropagation(); } });
    // states chart: drag up and down to change temperature, click a column to open that element
    const sc = $("stchart"); let sdrag = null;
    sc.addEventListener("pointerdown", e => { const h = statesHit(e); if (!h) return; sdrag = { x: e.clientX, y: e.clientY, moved: false }; try { sc.setPointerCapture(e.pointerId); } catch (_) {} });
    sc.addEventListener("pointermove", e => {
      const h = statesHit(e); if (!h) return;
      if (sdrag) { if (Math.abs(e.clientY - sdrag.y) > 4) sdrag.moved = true; if (sdrag.moved) setTemp(h.t); return; }
      if (h.z !== S.hoverSt) { S.hoverSt = h.z; sc.style.cursor = h.z ? "pointer" : "default"; drawStates(); }
    });
    sc.addEventListener("pointerup", e => { const h = statesHit(e); if (sdrag && !sdrag.moved && h && h.z) select(h.z, false); sdrag = null; });
    sc.addEventListener("pointerleave", () => { if (S.hoverSt) { S.hoverSt = 0; drawStates(); } });
    $("stnote").addEventListener("click", e => { const b = e.target.closest("[data-z]"); if (b) select(+b.dataset.z, true); });
    // hover card on the table
    tableEl.addEventListener("pointerover", e => {
      if (e.pointerType === "touch") return;
      const t = e.target.closest(".tile"); if (!t || t === HC.tile) { clearTimeout(HC.hideTimer); return; }
      clearTimeout(HC.timer); clearTimeout(HC.hideTimer);
      const shown = $("hovercard") && !$("hovercard").hidden;
      HC.timer = setTimeout(() => showCard(t), shown ? 40 : 160);
    });
    tableEl.addEventListener("pointerout", e => { if (!e.relatedTarget || !e.relatedTarget.closest || !e.relatedTarget.closest(".tile")) { clearTimeout(HC.timer); HC.hideTimer = setTimeout(hideCard, 90); } });
    tableEl.addEventListener("focusin", e => { const t = e.target.closest(".tile"); if (t) showCard(t); });
    tableEl.addEventListener("focusout", () => { HC.hideTimer = setTimeout(hideCard, 60); });
    tableEl.addEventListener("click", hideCard);
    window.addEventListener("scroll", hideCard, { passive: true, capture: true });
    $("build").addEventListener("click", toggleBuild);
    // theme, pencil, sound
    $("theme").addEventListener("click", () => setTheme(S.theme === "paper" ? "chalk" : "paper"));
    $("drawbtn").addEventListener("click", () => setDraw(!Draw.on));
    $("soundbtn").setAttribute("aria-pressed", String(Sound.isOn()));
    toggleBtn("soundbtn", on => Sound.set(on));
    $("drawbar").addEventListener("click", e => {
      const t = e.target.closest("[data-tool]"), sw = e.target.closest("[data-col]");
      if (t) { Draw.tool = t.dataset.tool; document.querySelectorAll("[data-tool]").forEach(b => b.setAttribute("aria-pressed", String(b === t))); }
      if (sw) { Draw.col = sw.dataset.col; if (Draw.tool !== "pen") { Draw.tool = "pen"; document.querySelectorAll("[data-tool]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.tool === "pen"))); } document.querySelectorAll("[data-col]").forEach(b => b.setAttribute("aria-pressed", String(b === sw))); }
    });
    $("dundo").addEventListener("click", () => { if (!(Draw.last && Draw.last.undo())) { if (!stageDoodle.undo()) tableDoodle.undo(); } });
    $("dclear").addEventListener("click", () => { if (window.confirm("Clear your drawings on the table and on this element's view?")) { tableDoodle.clear(); stageDoodle.clear(); } });
    $("ddone").addEventListener("click", () => setDraw(false));
    $("enote").addEventListener("input", () => {
      const v = $("enote").value; if (v.trim()) S.notes[S.sel] = v; else delete S.notes[S.sel];
      store.set("notes", S.notes); tiles[S.sel].classList.toggle("has-note", !!S.notes[S.sel]);
    });
    // notebook
    document.querySelectorAll(".nb-tab").forEach(t => t.addEventListener("click", () => showPage(t.dataset.pg)));
    $("trendProp").value = S.trend in TREND_INFO ? S.trend : "en"; S.trend = $("trendProp").value;
    $("trendProp").addEventListener("change", () => { S.trend = $("trendProp").value; store.set("trend", S.trend); drawTrends(); });
    const tc = $("trend");
    tc.addEventListener("pointermove", e => { const z = trendHit(e); if (z !== S.hoverZ) { S.hoverZ = z; tc.style.cursor = z ? "pointer" : "default"; drawTrends(); } });
    tc.addEventListener("pointerleave", () => { if (S.hoverZ) { S.hoverZ = 0; drawTrends(); } });
    tc.addEventListener("click", e => { const z = trendHit(e); if (z) select(z, false); });
    new ResizeObserver(() => { drawTrends(); drawTimeline(); drawScale(); drawStates(); drawNuclides(); }).observe($("pg-trends").parentElement);
    $("fxex").innerHTML = ["H2O", "CO2", "NaCl", "C6H12O6", "CaCO3", "Ca(OH)2", "H2SO4", "CuSO4·5H2O"].map(f => '<button type="button" class="chip" data-f="' + f + '" data-tip="Work out the molar mass of ' + f + '">' + prettyFormula(f) + '</button>').join("");
    $("fxex").addEventListener("click", e => { const b = e.target.closest(".chip"); if (b) { $("fx").value = b.dataset.f; renderMolar(); } });
    $("fx").addEventListener("input", renderMolar);
    $("fxout").addEventListener("click", e => { const b = e.target.closest("[data-z]"); if (b) select(+b.dataset.z, true); });
    const PCEX = [["C 40, H 6.7, O 53.3", "180"], ["Fe 69.9, O 30.1", ""], ["C 85.6, H 14.4", "56"], ["Na 39.3, Cl 60.7", ""]];
    $("pcex").innerHTML = PCEX.map((p, i) => '<button type="button" class="chip" data-i="' + i + '" data-tip="Try this example">' + p[0] + (p[1] ? " · M " + p[1] : "") + '</button>').join("");
    $("pcex").addEventListener("click", e => { const b = e.target.closest("[data-i]"); if (b) { const p = PCEX[+b.dataset.i]; $("pc").value = p[0]; $("pcm").value = p[1]; renderEmp(); } });
    $("pc").addEventListener("input", renderEmp); $("pcm").addEventListener("input", renderEmp);
    const EQEX = ["H2 + O2 -> H2O", "Fe + O2 -> Fe2O3", "C3H8 + O2 -> CO2 + H2O", "Al + HCl -> AlCl3 + H2", "NaOH + H2SO4 -> Na2SO4 + H2O", "C6H12O6 + O2 -> CO2 + H2O", "KMnO4 + HCl -> KCl + MnCl2 + H2O + Cl2"];
    $("eqex").innerHTML = EQEX.map(q => '<button type="button" class="chip" data-q="' + esc(q) + '" data-tip="Balance this example">' + prettyFormula(q).replace(/-&gt;/g, "→") + '</button>').join("");
    $("eqex").addEventListener("click", e => { const b = e.target.closest("[data-q]"); if (b) { $("eq").value = b.dataset.q; renderEq(); } });
    $("eq").addEventListener("input", renderEq);
    $("cmpout").addEventListener("click", e => { const b = e.target.closest("[data-unpin]"); if (b) togglePin(+b.dataset.unpin); });
    $("cmpclear").addEventListener("click", () => { S.pins = []; store.set("pins", S.pins); renderCompare(); if (S.sel) renderPanel(ELEMENTS[S.sel - 1]); });
    $("qmode").addEventListener("change", () => { if (Q.on) quizStop(false); else renderQuiz(); });
    $("qcount").addEventListener("change", () => { if (!Q.on) renderQuiz(); });
    $("qdeck").addEventListener("change", () => { FC.cur = 0; renderQuiz(); });
    $("qskip").addEventListener("click", () => { if (!Q.on || Q.lock) return; Q.hist.push(false); nextQ(); });
    $("qstop").addEventListener("click", () => quizStop(false));
    $("tl").addEventListener("input", () => setTimeline(+$("tl").value));
    $("tlplay").addEventListener("click", toggleTimelinePlay);
    document.querySelectorAll("[data-print]").forEach(b => b.addEventListener("click", () => doPrint(b.dataset.print)));
    document.addEventListener("keydown", e => {
      const t = e.target, tag = t && t.tagName;
      if (($("contact") && $("contact").open) || ($("nuccmp") && $("nuccmp").open)) return;
      if (e.key === "Escape") { if (Q.on) { quizStop(false); return; } if (Draw.on) { setDraw(false); return; } }
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || e.ctrlKey || e.metaKey || e.altKey || (t && t.getAttribute && t.getAttribute("role") === "tab")) return;
      if (t && t.classList && t.classList.contains("tile") && /^Arrow/.test(e.key)) {
        const z = +t.dataset.z, nz = gridMove(z, e.key);
        if (nz !== z) { tiles[nz].focus(); if (!Q.on) select(nz); showCard(tiles[nz]); }
        e.preventDefault(); return;
      }
      if (e.key === "ArrowRight") { select(S.sel === 118 ? 1 : S.sel + 1); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { select(S.sel === 1 ? 118 : S.sel - 1); e.preventDefault(); }
      else if (e.key === "/") { qEl.focus(); e.preventDefault(); }
      else if (e.key === "s" || e.key === "S") setRender(S.render === "3d" ? "sketch" : "3d");
      else if ((e.key === "d" || e.key === "D") && !simHome) setDraw(!Draw.on);
      else if (e.key === "f" || e.key === "F") setMax(!simHome);
    });
    window.addEventListener("hashchange", () => { if (location.hash !== lastHash && location.hash) applyHash(readHash(), false); });
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) $("spin").setAttribute("aria-pressed", "false");
    const gl = Scene3D.init($("gl"), $("sk"), $("stage"), reduced);
    if (!gl) { $("r3d").disabled = true; $("r3d").title = "3D needs WebGL, which this browser could not start"; }
    S.wobble = S.wobble && !reduced; $("wobble").setAttribute("aria-pressed", String(S.wobble)); Scene3D.setWobble(S.wobble);
    tableDoodle = Doodle(tableEl, () => "table"); tableDoodle.load();
    stageDoodle = Doodle($("stage"), () => "el" + S.sel + "-" + S.view);
    setTheme(S.theme);
    setRender(S.render);
    setTemp(298);
    renderMolar(); renderEq();
    applyHash(readHash(), true);
    showPage(PAGES.includes(S.nb) ? S.nb : "trends");
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { drawTrends(); drawTimeline(); drawScale(); });
    document.documentElement.classList.add("lab-ready");
    document.dispatchEvent(new CustomEvent("ptl:ready"));
  }
  init();
})();
