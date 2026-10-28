import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compareReleaseVersions, resolveLatestVersion } from "../shared/release-policy";
import { getLatestGhRelease, bustGhCache } from "../server/github-release";

async function main() {
  assert.equal(resolveLatestVersion("5.2.80", "5.2.78", "5.2.78"), "5.2.80");
  assert.equal(resolveLatestVersion("5.2.80", "5.2.80", "5.2.78"), "5.2.80");
  assert.equal(resolveLatestVersion("5.2.81", "5.2.80", "5.2.78"), "5.2.81");
  assert.equal(resolveLatestVersion("5.2.80", "5.2.81", "5.2.78"), "5.2.80");
  assert.equal(compareReleaseVersions("5.2.80", "5.2.80"), 0);
  assert(compareReleaseVersions("5.2.80", "5.2.72") > 0);
  assert(compareReleaseVersions("5.2.80", "5.2.81") < 0);
  assert.equal(compareReleaseVersions("v5.2.80", "5.2.80"), 0);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify([
    { tag_name: "v5.2.90", draft: true, assets: [{ name: "Setup.exe" }] },
    { tag_name: "v5.2.81", draft: false, assets: [{ name: "latest.json" }] },
    { tag_name: "v5.2.78", draft: false, prerelease: false, assets: [{ name: "Setup.exe" }] },
    { tag_name: "v5.2.80", draft: false, prerelease: true, html_url: "https://github.com/duhthehomie/opti-gods/releases/tag/v5.2.80",
      assets: [{ name: "OptiGods-Setup-5.2.80.exe", browser_download_url: "https://github.com/duhthehomie/opti-gods/releases/download/v5.2.80/OptiGods-Setup-5.2.80.exe" }] },
  ]));
  try {
    bustGhCache();
    const release = await getLatestGhRelease();
    assert.equal(release?.version, "5.2.80");
    assert(release?.exeUrl.endsWith("/v5.2.80/OptiGods-Setup-5.2.80.exe"));
  } finally { globalThis.fetch = originalFetch; bustGhCache(); }
  const page = readFileSync("client/src/pages/updates.tsx", "utf8");
  assert(!page.includes("/api/announcements") && !page.includes("AnnouncementCard"));
  assert(!page.includes("performUpdate") && !page.includes("checkForUpdate"));
  assert(!page.includes("Update installed") && !page.includes("setProgress(100)"));
  assert(page.includes("Installer download opened") && page.includes("You are on the latest version"));
  const modal = readFileSync("client/src/components/update-modal.tsx", "utf8");
  assert(modal.includes("useInstalledVersion") && !modal.includes("checkForUpdate"));
  const routes = readFileSync("server/routes.ts", "utf8");
  assert.match(routes, /app\.get\("\/api\/announcements"[\s\S]*?res\.json\(\[\]\)/);
  console.log("Release regressions passed: .72 → .80, .80 current, .81 future, stale override, prereleases, missing installers, retired feed, honest download status.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
