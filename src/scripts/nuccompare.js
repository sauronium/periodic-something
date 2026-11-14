// Side-by-side 3D comparison of two nuclei. Shared particles sit in the same places in both atoms;
// the extra neutrons, protons and electrons are placed on the outside and glow so they stand out.
import * as THREE from "three";
import { ELEMENTS, stabilityOf } from "../lib/elements.js";

const $ = (id) => document.getElementById(id);
const DECAY = { alpha: "α decay", "beta-": "β⁻ decay", "beta+": "β⁺ decay" };
const COL = { p: 0xe5483a, n: 0x9aa6b4, xn: 0x2fd36b, xp: 0xff9a1f, e: 0x2f8cff, ev: 0xffb02e, xe: 0xb56cff };
const nm = (z, n) => ELEMENTS[z - 1].sym + "-" + (z + n);
const status = (st) => (st.stable ? "stable" : st.long ? "radioactive, lasts billions of years" : st.mode ? "unstable · " + DECAY[st.mode] : "unstable");
const plural = (k, w) => k + " " + w + (k === 1 ? "" : "s");
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function daughter(z, n) {
  const st = stabilityOf(z, n);
  if (st.stable || !st.mode) return null;
  return st.mode === "alpha" ? [z - 2, n - 2, st.mode] : st.mode === "beta-" ? [z + 1, n - 1, st.mode] : [z - 1, n + 1, st.mode];
}

const C = { renderer: null, scene: null, camera: null, a: null, b: null, raf: 0, spin: true, hi: true, mode: "nucleus", t: 0, rotX: 0.35, rotY: 0, zoom: 1, mats: null, opts: null, pair: null, built: [] };

function ensureRenderer() {
  if (C.renderer !== null) return !!C.renderer;
  try {
    C.renderer = new THREE.WebGLRenderer({ canvas: $("ncGl"), antialias: true, alpha: true });
    C.renderer.setClearColor(0x000000, 0); C.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  } catch (_) { C.renderer = false; $("ncFallback").hidden = false; return false; }
  C.scene = new THREE.Scene(); C.camera = new THREE.PerspectiveCamera(34, 1, 0.05, 500);
  C.scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const d = new THREE.DirectionalLight(0xffffff, 0.85); d.position.set(4, 7, 8); C.scene.add(d);
  const m = (c, extra) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.45, transparent: true }, extra || {}));
  C.mats = {
    p: m(COL.p), n: m(COL.n),
    xp: m(COL.xp, { emissive: COL.xp, emissiveIntensity: 0.6 }), xn: m(COL.xn, { emissive: COL.xn, emissiveIntensity: 0.6 }),
    e: m(COL.e, { emissive: 0x0b3f94, emissiveIntensity: 0.6 }), ev: m(COL.ev, { emissive: 0x7a4a00, emissiveIntensity: 0.6 }),
    xe: m(COL.xe, { emissive: COL.xe, emissiveIntensity: 0.7 }),
    ring: new THREE.LineBasicMaterial({ color: 0x7d8ea3, transparent: true, opacity: 0.55 }),
    halo: new THREE.MeshBasicMaterial({ color: COL.xn, transparent: true, opacity: 0.18, depthWrite: false }),
    haloP: new THREE.MeshBasicMaterial({ color: COL.xp, transparent: true, opacity: 0.18, depthWrite: false })
  };
  new ResizeObserver(resize).observe($("ncStage"));
  // drag to turn both models, wheel to zoom
  const st = $("ncStage"); let drag = null;
  st.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY }; try { st.setPointerCapture(e.pointerId); } catch (_) {} });
  st.addEventListener("pointermove", (e) => { if (!drag) return; C.rotY += (e.clientX - drag.x) * 0.01; C.rotX = Math.max(-1.3, Math.min(1.3, C.rotX + (e.clientY - drag.y) * 0.01)); drag = { x: e.clientX, y: e.clientY }; });
  const up = () => { drag = null; }; st.addEventListener("pointerup", up); st.addEventListener("pointercancel", up);
  st.addEventListener("wheel", (e) => { e.preventDefault(); C.zoom = Math.max(0.4, Math.min(2.5, C.zoom * Math.exp(e.deltaY * 0.0012))); }, { passive: false });
  return true;
}

function buildAtom(z, n, other) {
  const g = new THREE.Group(), owned = [], A = z + n;
  const cP = Math.min(z, other.z), cN = Math.min(n, other.n), xP = z - cP, xN = n - cN;
  const ns = 0.2 / Math.pow(Math.max(A, other.z + other.n), 0.12), R = A === 1 ? 0 : ns * 1.9 * Math.cbrt(A);
  const geo = new THREE.SphereGeometry(ns, 14, 10), hgeo = new THREE.SphereGeometry(ns * 1.9, 12, 9); owned.push(geo, hgeo);
  const rnd = rng(7919 + cP * 31 + cN * 17), common = [];
  for (let i = 0; i < cP; i++) common.push("p");
  for (let i = 0; i < cN; i++) common.push("n");
  for (let i = common.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [common[i], common[j]] = [common[j], common[i]]; }
  // shared particles fill the inside; the extra ones go on the outer surface so they are visible
  const types = common.concat(Array(xP).fill("xp"), Array(xN).fill("xn"));
  const nuc = new THREE.Group(), glow = [];
  types.forEach((t, i) => {
    const zz = 1 - 2 * (i + 0.5) / A, rr = Math.sqrt(Math.max(0, 1 - zz * zz)), ph = i * 2.399963;
    const rad = A === 1 ? 0 : (t === "xp" || t === "xn") ? R * 1.04 : R * Math.cbrt((i + 0.5) / Math.max(1, common.length));
    const mesh = new THREE.Mesh(geo, C.mats[t]); mesh.position.set(Math.cos(ph) * rr * rad, zz * rad, Math.sin(ph) * rr * rad);
    if (t === "xp" || t === "xn") { mesh.scale.setScalar(1.12); const h = new THREE.Mesh(hgeo, t === "xn" ? C.mats.halo : C.mats.haloP); h.position.copy(mesh.position); nuc.add(h); glow.push(h); }
    nuc.add(mesh);
  });
  g.add(nuc);
  // electron shells of the neutral atom; electrons the other atom lacks are marked
  const shells = ELEMENTS[z - 1].shells, oShells = ELEMENTS[other.z - 1].shells, eGeo = new THREE.SphereGeometry(0.1, 12, 9); owned.push(eGeo);
  const r0 = Math.max(R, 0.25) + 1, step = 0.85, electrons = [], eg = new THREE.Group();
  shells.forEach((cnt, i) => {
    const r = r0 + i * step, sg = new THREE.Group(); sg.rotation.set(i * 0.55 + 0.3, i * 0.9, i * 0.35);
    const pts = []; for (let k = 0; k <= 96; k++) { const a = k / 96 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0)); }
    const lg = new THREE.BufferGeometry().setFromPoints(pts); owned.push(lg); sg.add(new THREE.Line(lg, C.mats.ring));
    const extra = Math.max(0, cnt - (oShells[i] || 0)), last = i === shells.length - 1;
    for (let k = 0; k < cnt; k++) {
      const isX = k >= cnt - extra, mesh = new THREE.Mesh(eGeo, isX ? C.mats.xe : last ? C.mats.ev : C.mats.e);
      if (isX) mesh.scale.setScalar(1.5);
      sg.add(mesh); electrons.push({ mesh, r, ph: k / cnt * Math.PI * 2, w: 1.5 / Math.pow(i + 1, 0.9) });
    }
    eg.add(sg);
  });
  g.add(eg);
  const rMax = r0 + Math.max(0, shells.length - 1) * step;
  return { g, owned, nuc, eg, electrons, glow, R: Math.max(R, ns), rMax, xP, xN };
}

function layout() {
  if (!C.a) return;
  const nucMode = C.mode === "nucleus", ra = nucMode ? C.a.R * 1.35 + 0.15 : C.a.rMax, rb = nucMode ? C.b.R * 1.35 + 0.15 : C.b.rMax, r = Math.max(ra, rb);
  C.a.eg.visible = C.b.eg.visible = !nucMode;
  C.a.g.position.set(-r * 1.25, 0, 0); C.b.g.position.set(r * 1.25, 0, 0);
  C.half = r * 2.5;
}
function resize() {
  if (!C.renderer) return;
  const el = $("ncStage"), w = el.clientWidth, h = el.clientHeight; if (!w || !h) return;
  C.renderer.setSize(w, h, false); C.camera.aspect = w / h; C.camera.updateProjectionMatrix();
}
function frame(now) {
  C.raf = requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - (C.last || now)) / 1000); C.last = now; C.t += dt;
  if (!C.a) return;
  if (C.spin) C.rotY += dt * 0.35;
  for (const at of [C.a, C.b]) {
    at.nuc.rotation.set(C.rotX, C.rotY, 0); at.eg.rotation.set(C.rotX * 0.5, C.rotY * 0.6, 0);
    for (const e of at.electrons) { const a = e.ph + C.t * e.w; e.mesh.position.set(Math.cos(a) * e.r, Math.sin(a) * e.r, 0); }
  }
  const pulse = 0.45 + 0.4 * Math.sin(C.t * 4);
  C.mats.xn.emissiveIntensity = C.mats.xp.emissiveIntensity = pulse; C.mats.xe.emissiveIntensity = pulse + 0.2;
  C.mats.halo.opacity = C.mats.haloP.opacity = 0.1 + 0.12 * (1 + Math.sin(C.t * 4)) / 2 * 1.5;
  const fade = C.hi ? 0.28 : 1; C.mats.p.opacity = C.mats.n.opacity = fade;
  const vfov = C.camera.fov * Math.PI / 180, hfov = 2 * Math.atan(Math.tan(vfov / 2) * C.camera.aspect);
  const dist = Math.max((C.half * 1.12) / Math.tan(hfov / 2), (C.half * 0.55) / Math.tan(vfov / 2)) * C.zoom;
  C.camera.position.set(0, 0, dist); C.camera.lookAt(0, 0, 0);
  C.renderer.render(C.scene, C.camera);
}

function clear() {
  for (const at of [C.a, C.b]) if (at) { C.scene.remove(at.g); at.owned.forEach((o) => o.dispose()); }
  C.a = C.b = null;
}

function relationText(A, B) {
  const [za, na] = A, [zb, nb] = B, ea = ELEMENTS[za - 1], eb = ELEMENTS[zb - 1];
  const dn = nb - na, dz = zb - za, Aa = za + na, Ab = zb + nb, sa = stabilityOf(za, na), sb = stabilityOf(zb, nb);
  const more = (k, w) => plural(Math.abs(k), w) + (k > 0 ? " more" : " fewer");
  let t;
  if (za === zb) t = `<b>Isotopes of ${ea.name.toLowerCase()}.</b> Both have ${za} protons and, as neutral atoms, ${za} electrons, so they behave almost the same chemically. ${nm(zb, nb)} has ${more(dn, "neutron")}, which makes it about ${Math.abs(dn)} u ${dn > 0 ? "heavier" : "lighter"}.`;
  else if (Aa === Ab) t = `<b>Isobars with mass number ${Aa}.</b> Both nuclei hold ${Aa} particles, but they are different elements: ${nm(zb, nb)} has ${more(dz, "proton")} and ${more(dn, "neutron")} than ${nm(za, na)}, and ${Math.abs(dz) === 1 ? "one electron" : plural(Math.abs(dz), "electron")} ${dz > 0 ? "more" : "fewer"} as a neutral atom.`;
  else if (na === nb) t = `<b>Isotones with ${na} neutrons.</b> Same neutron count, different elements: ${nm(zb, nb)} has ${more(dz, "proton")}.`;
  else t = `${nm(zb, nb)} has ${more(dz, "proton")} and ${more(dn, "neutron")} than ${nm(za, na)}.`;
  const da = daughter(za, na), db = daughter(zb, nb);
  if (da && da[0] === zb && da[1] === nb) t += ` ${nm(za, na)} turns into ${nm(zb, nb)} by ${DECAY[da[2]]}${da[2] === "beta-" ? ": a neutron changes into a proton" : da[2] === "beta+" ? ": a proton changes into a neutron" : ": it throws out 2 protons and 2 neutrons"}.`;
  else if (db && db[0] === za && db[1] === na) t += ` ${nm(zb, nb)} turns into ${nm(za, na)} by ${DECAY[db[2]]}.`;
  if (sa.stable !== sb.stable) t += ` ${nm(sa.stable ? za : zb, sa.stable ? na : nb)} is stable; ${nm(sa.stable ? zb : za, sa.stable ? nb : na)} is not.`;
  return t;
}
function diffTable(A, B) {
  const [za, na] = A, [zb, nb] = B, ea = ELEMENTS[za - 1], eb = ELEMENTS[zb - 1], sa = stabilityOf(za, na), sb = stabilityOf(zb, nb);
  const pc = (s) => s.replace(/(\d[spdf]) (\d+)/g, "$1<sup>$2</sup>");
  const d = (x, y) => { const k = y - x; return k === 0 ? '<span class="muted">same</span>' : '<b class="' + (k > 0 ? "up" : "down") + '">' + (k > 0 ? "+" : "−") + Math.abs(k) + "</b>"; };
  const rows = [
    ["Element", ea.name, eb.name, za === zb ? '<span class="muted">same</span>' : "<b>different</b>"],
    ["Protons (Z)", za, zb, d(za, zb), "xp"],
    ["Neutrons (N)", na, nb, d(na, nb), "xn"],
    ["Mass number (A)", za + na, zb + nb, d(za + na, zb + nb)],
    ["Electrons (neutral)", za, zb, d(za, zb), "xe"],
    ["Shells", ea.shells.join(", "), eb.shells.join(", "), ea.shells.join() === eb.shells.join() ? '<span class="muted">same</span>' : "<b>different</b>"],
    ["Configuration", pc(ea.config), pc(eb.config), ea.config === eb.config ? '<span class="muted">same</span>' : "<b>different</b>"],
    ["Mass, roughly", "≈ " + (za + na) + " u", "≈ " + (zb + nb) + " u", d(za + na, zb + nb)],
    ["Nucleus", status(sa), status(sb), sa.stable === sb.stable && sa.mode === sb.mode ? '<span class="muted">same</span>' : "<b>different</b>"]
  ];
  return "<thead><tr><th></th><th>" + nm(za, na) + "</th><th>" + nm(zb, nb) + "</th><th>Change</th></tr></thead><tbody>" +
    rows.map((r) => '<tr class="' + (r[3].indexOf("same") < 0 ? "chg " : "") + (r[4] || "") + '"><td>' + r[0] + "</td><td>" + r[1] + "</td><td>" + r[2] + "</td><td>" + r[3] + "</td></tr>").join("") + "</tbody>";
}
function labelHtml(z, n, other) {
  const st = stabilityOf(z, n), xp = Math.max(0, z - other.z), xn = Math.max(0, n - other.n), xe = xp;
  const badges = [xn ? '<span class="nb xn">+' + plural(xn, "neutron") + "</span>" : "", xp ? '<span class="nb xp">+' + plural(xp, "proton") + "</span>" : "", xe ? '<span class="nb xe">+' + plural(xe, "electron") + "</span>" : ""].join("");
  return '<b class="nc-name">' + nm(z, n) + "</b><span>" + ELEMENTS[z - 1].name + " · " + z + " p · " + n + " n · " + z + " e</span><span class=\"muted\">" + status(st) + "</span>" + (badges ? '<span class="nc-badges">' + badges + "</span>" : "");
}

function render() {
  const [A, B] = C.pair, a = { z: A[0], n: A[1] }, b = { z: B[0], n: B[1] };
  $("ncTitle").textContent = nm(a.z, a.n) + " vs " + nm(b.z, b.n);
  $("ncA").innerHTML = labelHtml(a.z, a.n, b); $("ncB").innerHTML = labelHtml(b.z, b.n, a);
  $("ncRel").innerHTML = relationText(A, B); $("ncDiff").innerHTML = diffTable(A, B);
  $("ncLoadA").textContent = "Open " + nm(a.z, a.n) + " in the lab"; $("ncLoadB").textContent = "Open " + nm(b.z, b.n) + " in the lab";
  if (!ensureRenderer()) return;
  clear();
  C.a = buildAtom(a.z, a.n, b); C.b = buildAtom(b.z, b.n, a);
  C.scene.add(C.a.g, C.b.g);
  // the nucleus view is the natural default when only the nucleus differs (isotopes)
  layout();
}
function setMode(m) { C.mode = m; $("ncNuc").setAttribute("aria-pressed", String(m === "nucleus")); $("ncAtom").setAttribute("aria-pressed", String(m === "atom")); layout(); }

let wired = false;
function wire() {
  if (wired) return; wired = true;
  const dlg = $("nuccmp");
  $("ncClose").addEventListener("click", () => dlg.close());
  // the close event arrives asynchronously, so ignore it if the dialog was reopened in the meantime
  dlg.addEventListener("close", () => { if (dlg.open) return; cancelAnimationFrame(C.raf); C.raf = 0; C.last = 0; });
  $("ncNuc").addEventListener("click", () => setMode("nucleus"));
  $("ncAtom").addEventListener("click", () => setMode("atom"));
  $("ncHi").addEventListener("click", (e) => { C.hi = !C.hi; e.currentTarget.setAttribute("aria-pressed", String(C.hi)); });
  $("ncSpin").addEventListener("click", (e) => { C.spin = !C.spin; e.currentTarget.setAttribute("aria-pressed", String(C.spin)); });
  $("ncSwap").addEventListener("click", () => { C.pair = [C.pair[1], C.pair[0]]; render(); });
  $("ncLoadA").addEventListener("click", () => { const p = C.pair[0]; dlg.close(); C.opts.onLoad(p[0], p[1]); });
  $("ncLoadB").addEventListener("click", () => { const p = C.pair[1]; dlg.close(); C.opts.onLoad(p[0], p[1]); });
}

// a, b: { z, n }. opts.onLoad(z, n) opens a nucleus in the main lab.
export function openCompare(a, b, opts) {
  wire();
  C.opts = opts || { onLoad() {} };
  C.pair = [[a.z, a.n], [b.z, b.n]];
  C.zoom = 1; C.rotX = 0.35;
  const dlg = $("nuccmp");
  if (!dlg.open) { if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", ""); }
  render();
  setMode(a.z === b.z ? "nucleus" : (opts && opts.mode) || "nucleus");
  resize();
  if (C.renderer && !C.raf) C.raf = requestAnimationFrame(frame);
}
