// Preloader: renders a spinning Bohr model of the element chosen by the inline script, then fades out
// once the lab reports it is ready (or after a short minimum, or a hard maximum so it never gets stuck).
import * as THREE from "three";
import { ELEMENTS } from "../lib/elements.js";

const root = document.getElementById("preloader");
if (root) run(root);

function run(root) {
  const Z = window.__ptlPre || 1 + Math.floor(Math.random() * 118), el = ELEMENTS[Z - 1];
  const start = performance.now(), quick = document.documentElement.classList.contains("pl-quick");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const MIN = quick ? 450 : 1500, MAX = 9000;
  const canvas = document.getElementById("pl-gl");
  let renderer = null, raf = 0, hidden = false;

  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch (_) { renderer = null; }
  if (renderer) {
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(36, 1, 0.1, 200);
    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const sun = new THREE.DirectionalLight(0xffffff, 0.8); sun.position.set(4, 7, 6); scene.add(sun);
    const chalk = document.documentElement.dataset.theme === "chalk";
    const atom = new THREE.Group(); scene.add(atom);
    // nucleus
    const A = el.Z + el.neutrons, ns = 0.2 / Math.pow(A, 0.12), R = A === 1 ? 0 : ns * 1.9 * Math.cbrt(A);
    const nGeo = new THREE.SphereGeometry(ns, 12, 9);
    const pMat = new THREE.MeshStandardMaterial({ color: 0xe5483a, roughness: 0.45 }), nMat = new THREE.MeshStandardMaterial({ color: 0x9aa6b4, roughness: 0.5 });
    const nucleus = new THREE.Group();
    for (let i = 0; i < A; i++) {
      const zz = 1 - 2 * (i + 0.5) / A, rr = Math.sqrt(Math.max(0, 1 - zz * zz)), ph = i * 2.399963, rad = A === 1 ? 0 : R * Math.cbrt((i * 0.618034) % 1 || 0.5);
      const m = new THREE.Mesh(nGeo, (i * 7) % A < el.Z ? pMat : nMat);
      m.position.set(Math.cos(ph) * rr * rad, zz * rad, Math.sin(ph) * rr * rad); nucleus.add(m);
    }
    atom.add(nucleus);
    // shells and electrons
    const eGeo = new THREE.SphereGeometry(0.1, 10, 8);
    const eMat = new THREE.MeshStandardMaterial({ color: 0x2f8cff, emissive: 0x0b3f94, emissiveIntensity: 0.6 });
    const vMat = new THREE.MeshStandardMaterial({ color: 0xffb02e, emissive: 0x7a4a00, emissiveIntensity: 0.6 });
    const ringMat = new THREE.LineBasicMaterial({ color: chalk ? 0xc9d4c6 : 0x6f7f93, transparent: true, opacity: 0.7 });
    const r0 = Math.max(R, 0.25) + 1, step = 0.85, electrons = [];
    el.shells.forEach((n, i) => {
      const r = r0 + i * step, g = new THREE.Group();
      g.rotation.set(i * 0.55 + 0.3, i * 0.9, i * 0.35);
      const pts = []; for (let k = 0; k <= 96; k++) { const a = k / 96 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0)); }
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ringMat));
      for (let k = 0; k < n; k++) { const m = new THREE.Mesh(eGeo, i === el.shells.length - 1 ? vMat : eMat); g.add(m); electrons.push({ m, r, ph: k / n * Math.PI * 2, w: 1.6 / Math.pow(i + 1, 0.9) }); }
      atom.add(g);
    });
    const rMax = r0 + (el.shells.length - 1) * step, dist = rMax * 2.75 + 1.2;
    const size = () => { const w = canvas.clientWidth, h = canvas.clientHeight; if (w && h) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); } };
    size(); window.addEventListener("resize", size);
    camera.position.set(0, dist * 0.35, dist); camera.lookAt(0, 0, 0);
    let t = 0, last = performance.now();
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      if (!reduced) { atom.rotation.y += dt * 0.5; nucleus.rotation.x += dt * 0.4; }
      for (const e of electrons) { const a = e.ph + t * e.w * (reduced ? 0.2 : 1); e.m.position.set(Math.cos(a) * e.r, Math.sin(a) * e.r, 0); }
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);
  }

  let ready = document.documentElement.classList.contains("lab-ready") || !document.getElementById("table");
  let loaded = document.readyState === "complete";
  const tryHide = () => { if (ready && loaded) setTimeout(hide, Math.max(0, MIN - (performance.now() - start))); };
  document.addEventListener("ptl:ready", () => { ready = true; tryHide(); });
  window.addEventListener("load", () => { loaded = true; tryHide(); });
  document.getElementById("pl-skip").addEventListener("click", hide);
  setTimeout(hide, MAX);
  tryHide();

  function hide() {
    if (hidden) return; hidden = true;
    root.classList.add("done");
    setTimeout(() => {
      cancelAnimationFrame(raf);
      if (renderer) { renderer.dispose(); renderer.forceContextLoss(); }
      root.remove();
    }, 600);
  }
}
