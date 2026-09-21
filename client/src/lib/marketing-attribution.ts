import { apiUrl } from "@/lib/api-base";

export type MarketingAttribution = {
  platform: "tiktok" | "instagram" | "youtube";
  campaign: string;
  content?: string;
};

const STORAGE_KEY = "optigods_marketing_attribution";
const VALUE_PATTERN = /^[a-z0-9_-]{1,64}$/;
const PLATFORMS = new Set(["tiktok", "instagram", "youtube"]);

declare global {
  interface Window {
    umami?: { track(name: string, data?: Record<string, string | number | boolean>): void };
  }
}

function clean(value: string | null): string | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized && VALUE_PATTERN.test(normalized) ? normalized : undefined;
}

export function captureMarketingAttribution(): MarketingAttribution | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const platform = clean(params.get("utm_source"));
  const campaign = clean(params.get("utm_campaign"));
  const content = clean(params.get("utm_content"));
  if (!platform || !PLATFORMS.has(platform) || !campaign) return getMarketingAttribution();

  const attribution = { platform, campaign, ...(content ? { content } : {}) } as MarketingAttribution;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(attribution)); } catch {}
  return attribution;
}

export function getMarketingAttribution(): MarketingAttribution | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") as MarketingAttribution | null;
    if (!parsed || !PLATFORMS.has(parsed.platform) || !clean(parsed.campaign)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function trackMarketingEvent(eventType: "landing_visit" | "installer_download" | "discord_join_click" | "pro_purchase"): void {
  const attribution = getMarketingAttribution();
  if (!attribution) return;
  try { window.umami?.track(eventType, attribution); } catch {}
  // The actual installer request is recorded server-side so redirects and
  // successful file responses remain the source of truth for that outcome.
  if (eventType === "installer_download" || eventType === "pro_purchase") return;
  fetch(apiUrl("/api/marketing/event"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType, ...attribution }),
    keepalive: true,
  }).catch(() => {});
}

export function marketingCheckoutFields(): MarketingAttribution | Record<string, never> {
  return getMarketingAttribution() ?? {};
}