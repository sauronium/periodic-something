import { SITE } from "../config/site.js";

// Allow all crawlers (search engines and AI answer engines) and point them at the sitemap.
export function GET() {
  const body = ["User-agent: *", "Allow: /", "", `Sitemap: ${SITE.url}/sitemap-index.xml`, ""].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
