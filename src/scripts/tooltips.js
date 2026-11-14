// Paper-style tooltips for every control. Uses data-tip; title attributes and aria-labels on
// buttons are picked up automatically, so native tooltips never double up with these.
const SEL = "[data-tip],[title],button[aria-label],a[aria-label],[role=slider][aria-label]";
let tip = null, target = null, showTimer = 0, lastHide = 0;

function tipEl() {
  if (!tip) { tip = document.createElement("div"); tip.id = "tip"; tip.className = "tip"; tip.setAttribute("role", "tooltip"); tip.hidden = true; document.body.appendChild(tip); }
  return tip;
}
function textFor(el) {
  if (el.hasAttribute("title")) { if (!el.dataset.tip) el.dataset.tip = el.getAttribute("title"); el.removeAttribute("title"); }
  return el.dataset.tip || el.getAttribute("aria-label") || "";
}
function findTarget(node) {
  const el = node && node.closest ? node.closest(SEL) : null;
  if (!el || el.closest(".tile") || el.closest("#hovercard") || el.matches("svg *")) return null;
  return el;
}
function place() {
  if (!target || !tip) return;
  const r = target.getBoundingClientRect(), vw = document.documentElement.clientWidth, vh = window.innerHeight;
  const w = tip.offsetWidth, h = tip.offsetHeight;
  let x = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), vw - w - 8);
  let y = r.top - h - 10, below = false;
  if (y < 8) { y = r.bottom + 10; below = true; }
  if (y + h > vh - 8) y = Math.max(8, vh - h - 8);
  tip.style.left = Math.round(x) + "px"; tip.style.top = Math.round(y) + "px";
  tip.dataset.below = String(below);
  tip.style.setProperty("--ax", Math.round(Math.min(Math.max(12, r.left + r.width / 2 - x), w - 12)) + "px");
}
function show(el) {
  const text = textFor(el); if (!text) return;
  const t = tipEl();
  const host = el.closest("dialog[open]") || document.body;
  if (t.parentNode !== host) host.appendChild(t);
  t.textContent = text; t.hidden = false; target = el;
  el.setAttribute("aria-describedby", "tip");
  place();
}
function hide() {
  clearTimeout(showTimer);
  if (tip && !tip.hidden) { tip.hidden = true; lastHide = performance.now(); }
  if (target) { target.removeAttribute("aria-describedby"); target = null; }
}
function schedule(el) {
  clearTimeout(showTimer);
  const warm = performance.now() - lastHide < 500 || (tip && !tip.hidden);
  showTimer = setTimeout(() => show(el), warm ? 60 : 420);
}

document.addEventListener("pointerover", (e) => {
  if (e.pointerType === "touch") return;
  const el = findTarget(e.target);
  if (el === target) return;
  if (!el) { hide(); return; }
  if (el.hasAttribute("title")) textFor(el); // strip the native tooltip right away
  hide(); schedule(el);
});
document.addEventListener("pointerdown", hide, true);
document.addEventListener("focusin", (e) => {
  const el = findTarget(e.target);
  if (!el || !el.matches(":focus-visible")) return;
  hide(); show(el);
});
document.addEventListener("focusout", hide);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") hide(); });
window.addEventListener("scroll", hide, { passive: true, capture: true });
window.addEventListener("resize", hide);
// keep the text current if a control updates its tip while it is showing (e.g. Expand → Shrink)
new MutationObserver(() => { if (target && tip && !tip.hidden) { tip.textContent = textFor(target); place(); } })
  .observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ["data-tip"] });
