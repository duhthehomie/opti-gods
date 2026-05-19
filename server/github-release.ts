export interface GhRelease {
  version: string;
  exeUrl: string;
  pageUrl: string;
  fetchedAt: number;
}

const GH_REPO = "duhthehomie/opti-gods";
const GH_CACHE_TTL = 10 * 60 * 1000;

let _cache: GhRelease | null = null;
let _fetching = false;

export async function getLatestGhRelease(): Promise<GhRelease | null> {
  if (_cache && Date.now() - _cache.fetchedAt < GH_CACHE_TTL) return _cache;
  if (_fetching) return _cache;
  _fetching = true;
  try {
    const r = await fetch(
      `https://api.github.com/repos/${GH_REPO}/releases/latest`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "optigods-server/1.0",
        },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!r.ok) return _cache;
    const data = (await r.json()) as Record<string, unknown>;
    const tag = String(data.tag_name ?? "");
    const version = tag.replace(/^v/, "");
    const assets = Array.isArray(data.assets) ? data.assets : [];
    const exeAsset = assets.find(
      (a: unknown) =>
        typeof a === "object" &&
        a !== null &&
        /\.exe$/i.test(String((a as Record<string, unknown>).name ?? ""))
    ) as Record<string, unknown> | undefined;
    const exeUrl = String(exeAsset?.browser_download_url ?? "");
    const pageUrl = String(data.html_url ?? "");
    if (!version) return _cache;
    _cache = { version, exeUrl, pageUrl, fetchedAt: Date.now() };
    console.log(`[GitHub] Latest release auto-detected: v${version} — ${exeUrl}`);
    return _cache;
  } catch (err) {
    console.warn("[GitHub] Release fetch failed:", err);
    return _cache;
  } finally {
    _fetching = false;
  }
}

export function bustGhCache(): void {
  _cache = null;
}
