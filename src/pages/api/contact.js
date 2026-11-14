// Contact form endpoint: validates the message and sends it through Zoho Mail SMTP.
// Runs on the server only (the rest of the site is pre-rendered). Settings come from .env via astro:env.
import nodemailer from "nodemailer";
import { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, CONTACT_TO, CONTACT_FROM } from "astro:env/server";

export const prerender = false;

const TOPICS = ["General question", "Report a data error", "Feature idea", "Teaching or classroom use", "Something else"];
const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/;
const hits = new Map(); // ip -> timestamps of recent submissions
const LIMIT = 5, WINDOW = 15 * 60 * 1000;

function rateLimited(ip) {
  const now = Date.now(), list = (hits.get(ip) || []).filter((t) => now - t < WINDOW);
  list.push(now); hits.set(ip, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (now - v[v.length - 1] > WINDOW) hits.delete(k);
  return list.length > LIMIT;
}
const clean = (s, max) => String(s ?? "").replace(/\r/g, "").trim().slice(0, max);
const oneLine = (s) => s.replace(/[\n\t]+/g, " ");
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function transport(port, secure) {
  return nodemailer.createTransport({
    host: SMTP_HOST, port, secure, requireTLS: !secure,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000
  });
}
// Try the configured port (465 SSL by default); if the connection itself fails, retry on 587 with STARTTLS.
async function send(mail) {
  try { return await transport(SMTP_PORT, SMTP_SECURE).sendMail(mail); }
  catch (err) {
    const network = ["ECONNECTION", "ETIMEDOUT", "ESOCKET", "ECONNREFUSED", "ECONNRESET"].includes(err && err.code);
    if (!network || SMTP_PORT === 587) throw err;
    return await transport(587, false).sendMail(mail);
  }
}

function reply(request, status, body) {
  const wantsJson = (request.headers.get("accept") || "").includes("application/json");
  if (wantsJson) return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
  // Plain form post (no JavaScript): go back to the home page with the result in the URL.
  return new Response(null, { status: 303, headers: { Location: "/?contact=" + (body.ok ? "sent" : "error") + "#contact" } });
}

export async function POST({ request, clientAddress }) {
  let data;
  try {
    const type = request.headers.get("content-type") || "";
    data = type.includes("application/json") ? await request.json() : Object.fromEntries(await request.formData());
  } catch { return reply(request, 400, { ok: false, error: "The form data could not be read." }); }

  // Honeypot: real people never see or fill this field. Pretend it worked so bots learn nothing.
  if (clean(data.website, 200)) return reply(request, 200, { ok: true });

  const name = oneLine(clean(data.name, 120)), email = oneLine(clean(data.email, 200)), message = clean(data.message, 5000);
  const topic = TOPICS.includes(data.topic) ? data.topic : "General question";
  const problems = [];
  if (!name) problems.push("your name");
  if (!EMAIL_RE.test(email)) problems.push("a valid email address");
  if (message.length < 10) problems.push("a message of at least 10 characters");
  if (problems.length) return reply(request, 400, { ok: false, error: "Please add " + problems.join(", ") + "." });

  let ip = "unknown"; try { ip = clientAddress || "unknown"; } catch { /* not available in every environment */ }
  if (rateLimited(ip)) return reply(request, 429, { ok: false, error: "Too many messages from this connection. Please try again in a few minutes." });

  if (!SMTP_USER || !SMTP_PASS) {
    console.error("[contact] SMTP_USER or SMTP_PASS is not set; message not sent.");
    return reply(request, 503, { ok: false, error: "Sending is not set up on the server yet." });
  }

  const from = `"Periodic Table Lab" <${CONTACT_FROM}>`;
  try {
    await send({
      from, to: CONTACT_TO, replyTo: `"${name.replace(/"/g, "'")}" <${email}>`,
      subject: `[Periodic Table Lab] ${topic}: ${name}`,
      text: `From: ${name} <${email}>\nTopic: ${topic}\n\n${message}\n`,
      html: `<p><b>From:</b> ${esc(name)} &lt;${esc(email)}&gt;<br><b>Topic:</b> ${esc(topic)}</p><p style="white-space:pre-wrap">${esc(message)}</p>`
    });
  } catch (err) {
    console.error("[contact] could not send message:", err && (err.code || err.message));
    return reply(request, 502, { ok: false, error: "The message could not be sent right now." });
  }

  // Short confirmation to the visitor. It doesn't repeat their message, so the form can't be used to mail arbitrary text to others.
  let confirmed = true;
  try {
    await send({
      from, to: email, replyTo: CONTACT_TO,
      subject: "We got your note · Periodic Table Lab",
      text: `Hi ${name},\n\nThanks for writing to Periodic Table Lab. Your message about "${topic}" reached us and we'll reply to this address.\n\n— Periodic Table Lab\n${CONTACT_TO}\n`,
      html: `<p>Hi ${esc(name)},</p><p>Thanks for writing to Periodic Table Lab. Your message about “${esc(topic)}” reached us and we'll reply to this address.</p><p>— Periodic Table Lab<br>${esc(CONTACT_TO)}</p>`
    });
  } catch (err) {
    confirmed = false;
    console.error("[contact] confirmation email failed:", err && (err.code || err.message));
  }
  return reply(request, 200, { ok: true, confirmed });
}

export function GET() {
  return new Response("Method not allowed", { status: 405, headers: { Allow: "POST" } });
}
