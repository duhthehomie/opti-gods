import { storage } from "./storage";
import { sendNewDriverAlert } from "./alerts";

const DEFAULT_FEED_URL =
  process.env.NVIDIA_DRIVER_FEED_URL ||
  // GeForce Game Ready lookup — RTX 4090 / Win11-64 / DCH / WHQL — returns recent drivers.
  // Overridable via NVIDIA_DRIVER_FEED_URL for testing or alternative branches.
  "https://gfwsl.geforce.com/services_toolkit/services/com/nvidia/services/AjaxDriverService.php?func=DriverManualLookup&psid=127&pfid=985&osID=57&languageCode=1033&isWHQL=1&dch=1&sort1=0&numberOfResults=10";

const POLL_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h

type FetchedDriver = { version: string; releasedAt: Date | null; branch: string | null };

async function fetchFromNvidia(url: string): Promise<FetchedDriver[]> {
  const res = await fetch(url, {
    headers: { Accept: "application/json,text/plain,*/*", "User-Agent": "OptiGodsAether/1.0" },
  });
  if (!res.ok) throw new Error(`NVIDIA feed HTTP ${res.status}`);
  const text = await res.text();
  // GeForce endpoint returns JSON wrapped in whitespace; try to parse leniently.
  let data: any;
  try { data = JSON.parse(text); } catch {
    const m = text.match(/\{[\s\S]*\}$/);
    if (!m) throw new Error("NVIDIA feed: unparseable response");
    data = JSON.parse(m[0]);
  }
  const idArr: any[] = data?.IDS ?? data?.ids ?? [];
  const out: FetchedDriver[] = [];
  for (const entry of idArr) {
    const info = entry?.downloadInfo ?? entry?.DownloadInfo ?? entry;
    const version = String(info?.Version ?? info?.version ?? "").trim();
    if (!version) continue;
    const rel = info?.ReleaseDateTime ?? info?.releaseDateTime ?? info?.ReleaseDate ?? null;
    let releasedAt: Date | null = null;
    if (rel) {
      const d = new Date(rel);
      if (!isNaN(d.getTime())) releasedAt = d;
    }
    const branch = (info?.OSName as string | undefined)?.split(" ")[0] ?? null;
    out.push({ version, releasedAt, branch });
  }
  return out;
}

export async function pollNvidiaDrivers(opts: { adminPanelUrl: string }): Promise<{
  fetched: number; inserted: number; alerted: number; errors: string[];
}> {
  const errors: string[] = [];
  let fetched = 0, inserted = 0, alerted = 0;
  let drivers: FetchedDriver[] = [];
  try {
    drivers = await fetchFromNvidia(DEFAULT_FEED_URL);
    fetched = drivers.length;
  } catch (e) {
    const msg = `fetch: ${e instanceof Error ? e.message : String(e)}`;
    errors.push(msg);
    console.error("[nvidia-poller]", msg);
    return { fetched, inserted, alerted, errors };
  }

  const existing = await storage.listNvidiaDrivers();
  const known = new Set(existing.map(d => d.version));

  const settings = await storage.getAdminSettings();
  const allowAlerts = settings?.alertOnNewNvidiaDriver !== false;
  const discordWebhookUrl = settings?.discordWebhookUrl ?? process.env.DISCORD_WEBHOOK_URL ?? null;
  const alertEmail = settings?.alertEmail ?? process.env.ALERT_EMAIL ?? null;

  for (const d of drivers) {
    const isNew = !known.has(d.version);
    try {
      const row = await storage.upsertNvidiaDriver({
        version: d.version,
        releasedAt: d.releasedAt,
        branch: d.branch,
      });
      if (isNew) {
        inserted++;
        if (allowAlerts && (discordWebhookUrl || alertEmail)) {
          const result = await sendNewDriverAlert(row, {
            discordWebhookUrl, alertEmail, adminPanelUrl: opts.adminPanelUrl,
          });
          if (result.sentAny) alerted++;
        }
      }
    } catch (e) {
      errors.push(`${d.version}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(`[nvidia-poller] fetched=${fetched} inserted=${inserted} alerted=${alerted}${errors.length ? ` errors=${errors.length}` : ""}`);
  return { fetched, inserted, alerted, errors };
}

let timer: NodeJS.Timeout | null = null;

export function startNvidiaDriverPoller(): void {
  if (timer) return;
  const adminPanelUrl = (process.env.SITE_URL ? `${process.env.SITE_URL}/admin` : "/admin");
  // Initial run on boot, delayed slightly so DB connection is ready.
  setTimeout(() => { pollNvidiaDrivers({ adminPanelUrl }).catch(e => console.error("[nvidia-poller] boot poll failed:", e)); }, 30_000);
  timer = setInterval(() => {
    pollNvidiaDrivers({ adminPanelUrl }).catch(e => console.error("[nvidia-poller] interval poll failed:", e));
  }, POLL_INTERVAL_MS);
  console.log("[nvidia-poller] scheduler started (24h interval)");
}
