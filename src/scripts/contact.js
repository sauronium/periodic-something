// Contact popup: open/close, validation, and sending to /api/contact (emailed via Zoho SMTP).
const dialog = document.getElementById("contact");
const form = document.getElementById("contact-form");
const EMAIL = "talk@rinsedsoap.xyz";

if (dialog && form) {
  const err = document.getElementById("contact-err"), done = document.getElementById("contact-done");
  let opener = null;
  const open = (e) => {
    opener = e && e.currentTarget;
    err.hidden = true; done.hidden = true;
    if (dialog.open) return;
    if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", "");
    const first = form.querySelector("input[name=name]"); if (first) first.focus();
  };
  const close = () => { dialog.close ? dialog.close() : dialog.removeAttribute("open"); if (opener) opener.focus(); };
  document.querySelectorAll("[data-contact-open]").forEach((b) => b.addEventListener("click", open));
  dialog.querySelectorAll("[data-contact-close]").forEach((b) => b.addEventListener("click", close));
  dialog.addEventListener("click", (e) => { if (e.target === dialog) close(); }); // click on the backdrop
  if (location.hash === "#contact") open();

  const send = document.getElementById("contact-send"), more = document.getElementById("contact-done-more");
  const sp = new URLSearchParams(location.search);
  if (sp.get("contact")) { // result of a plain (no-JavaScript) form post
    open();
    if (sp.get("contact") === "sent") done.hidden = false;
    else { err.textContent = "Sorry, your message could not be sent. Please email " + EMAIL + " instead."; err.hidden = false; }
    history.replaceState(null, "", location.pathname + location.hash.replace("#contact", ""));
  }
  form.addEventListener("submit", async (e) => {
    const data = new FormData(form);
    const problems = [];
    if (!String(data.get("name") || "").trim()) problems.push("your name");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.get("email") || ""))) problems.push("a valid email");
    if (String(data.get("message") || "").trim().length < 10) problems.push("a message of at least 10 characters");
    if (problems.length) { e.preventDefault(); err.textContent = "Please add " + problems.join(", ") + "."; err.hidden = false; return; }
    e.preventDefault();
    err.hidden = true; done.hidden = true;
    send.disabled = true; const label = send.textContent; send.textContent = "Sending…";
    try {
      const res = await fetch(form.action, { method: "POST", headers: { Accept: "application/json" }, body: data });
      const out = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || !out.ok) throw new Error(out.error || "The message could not be sent right now.");
      more.textContent = out.confirmed === false
        ? "We couldn't send you a confirmation email, but your message reached us. Our reply may land in your spam or junk folder, so please check there too."
        : "We've emailed you a confirmation. If it isn't in your inbox within a few minutes, please check your spam or junk folder, and mark it as \"not spam\" so our reply reaches you.";
      done.hidden = false;
      form.querySelectorAll("input:not([type=hidden]), textarea").forEach((f) => { if (f.name !== "website") f.value = ""; });
    } catch (ex) {
      err.textContent = (ex && ex.message ? ex.message : "The message could not be sent.") + " You can also email " + EMAIL + " directly.";
      err.hidden = false;
    } finally { send.disabled = false; send.textContent = label; }
  });
}
