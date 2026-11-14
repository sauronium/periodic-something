// @ts-check
import { defineConfig, envField } from "astro/config";
import sitemap from "@astrojs/sitemap";
import node from "@astrojs/node";
import vercel from "@astrojs/vercel";
import { SITE } from "./src/config/site.js";

// Vercel sets VERCEL=1 during its builds: use its adapter there, and the Node server everywhere else
// (local `npm run preview` / `npm start`, or any Node host).
const onVercel = !!process.env.VERCEL;

export default defineConfig({
  site: SITE.url,
  trailingSlash: "always",
  build: { format: "directory" },
  // Pages are pre-rendered at build time; only /api/contact runs on the server (it sends email).
  output: "static",
  adapter: onVercel ? vercel() : node({ mode: "standalone" }),
  // Contact form settings. "secret" values are read at runtime and are never bundled into the output.
  env: {
    schema: {
      SMTP_HOST: envField.string({ context: "server", access: "secret", default: "smtp.zoho.com" }),
      SMTP_PORT: envField.number({ context: "server", access: "secret", default: 465 }),
      SMTP_SECURE: envField.boolean({ context: "server", access: "secret", default: true }),
      SMTP_USER: envField.string({ context: "server", access: "secret", optional: true }),
      SMTP_PASS: envField.string({ context: "server", access: "secret", optional: true }),
      CONTACT_TO: envField.string({ context: "server", access: "secret", default: SITE.email }),
      CONTACT_FROM: envField.string({ context: "server", access: "secret", default: SITE.email })
    }
  },
  integrations: [
    sitemap({
      filter: (page) => !page.includes("/404") && !page.includes("/api/"),
      serialize(item) {
        item.lastmod = new Date(SITE.dataUpdated).toISOString();
        const path = new URL(item.url).pathname;
        item.changefreq = path === "/" ? "monthly" : "yearly";
        item.priority = path === "/" ? 1 : path === "/elements/" ? 0.9 : 0.7;
        return item;
      }
    })
  ],
  vite: {
    build: { chunkSizeWarningLimit: 900 }
  }
});
