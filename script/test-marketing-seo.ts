import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GAME_PROFILE_PAGES } from "../shared/marketing-pages";
import { isPublicMarketingPath, renderPublicShell } from "../server/marketing";

const template = readFileSync("client/index.html", "utf8");
const sitemap = readFileSync("client/public/sitemap.xml", "utf8");
for (const [slug, profile] of Object.entries(GAME_PROFILE_PAGES)) {
  const path = `/game-profiles/${slug}`;
  assert(isPublicMarketingPath(path), `Missing public route: ${path}`);
  assert(sitemap.includes(`https://optigods.com${path}</loc>`), `Missing sitemap route: ${path}`);
  const html = renderPublicShell(template, path);
  assert(html.includes('<div id="root"><noscript>'), `Fallback must not flash before React loads: ${path}`);
  assert(html.includes(profile.name), `Missing crawlable game content: ${path}`);
  assert(html.includes(`<link rel="canonical" href="https://optigods.com${path}"`));
  assert(html.includes('content="index, follow"'));
  const schema = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert(schema, `Missing structured metadata: ${path}`);
  const data = JSON.parse(schema[1]);
  assert(data["@graph"].some((item: any) => item["@type"] === "BreadcrumbList"));
}
const home = renderPublicShell(template, "/");
assert(home.includes('<div id="root"><noscript>'), "Homepage fallback must only render without JavaScript.");
const visibleHome = home.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, "");
assert(visibleHome.includes('<div id="root"></div>'), "JavaScript visitors must start with the real app's empty mount point.");
assert(!visibleHome.includes("<main"), "Do not send a different visible page before the website loads.");
assert(home.includes('"downloadUrl":"https://optigods.com/api/download/latest"'));
assert(home.includes('"operatingSystem":"Windows 10, Windows 11"'));
console.log(`PASS: ${Object.keys(GAME_PROFILE_PAGES).length} game SEO pages, sitemap entries, canonicals, crawlable content, breadcrumbs and installer schema.`);
