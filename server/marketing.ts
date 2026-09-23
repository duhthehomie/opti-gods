import { APP_VERSION } from "../client/src/generated/version";

const PUBLIC_SITE_ORIGIN = "https://optigods.com";

export type MarketingMetadata = {
  title: string;
  description: string;
  index: boolean;
};

const ROUTE_SEO: Record<string, MarketingMetadata> = {
  "/": {
    title: `Opti Gods V${APP_VERSION} — Windows Gaming PC Optimizer by leaq`,
    description: `Opti Gods V${APP_VERSION} by leaq: 608+ hardware-aware Windows 10/11 tweaks, game packs, green presets, and transparent scripts.`,
    index: true,
  },
  "/showcase": {
    title: `Opti Gods V${APP_VERSION} Showcase — Gaming PC Optimization by leaq`,
    description: "See Opti Gods V5 in action with transparent Windows tweaks, game optimization packs, and real product previews.",
    index: true,
  },
  "/updates": {
    title: `Opti Gods V${APP_VERSION} Updates — V5 Changelog`,
    description: `Follow the Opti Gods V${APP_VERSION} changelog for Windows optimizer improvements, game packs, native app updates, and fixes.`,
    index: true,
  },
  "/pro": {
    title: `Opti Gods V${APP_VERSION} Pro — Lifetime Windows Gaming Optimization`,
    description: "Unlock hardware-aware Windows tweaks, game packs, AI tools, presets, and transparent script generation with lifetime Pro access.",
    index: true,
  },
  "/game-profiles": {
    title: `Opti Gods V${APP_VERSION} Game Profiles — FiveM, Fortnite, CoD, Rust & Roblox`,
    description: "Explore Opti Gods V5 game-specific Windows optimization profiles for FiveM, Fortnite, Call of Duty, Rust, Roblox, and more.",
    index: true,
  },
  "/game-profiles/fivem": {
    title: `FiveM FPS Optimization V${APP_VERSION} — Opti Gods by leaq`,
    description: "Hardware-aware FiveM and GTA V Windows optimization tools, transparent tweaks, and game-specific recommendations.",
    index: true,
  },
  "/game-profiles/fortnite": {
    title: `Fortnite FPS Optimization V${APP_VERSION} — Opti Gods by leaq`,
    description: "Hardware-aware Fortnite Windows optimization tools for FPS, latency, input, GPU, and memory settings.",
    index: true,
  },
  "/game-profiles/call-of-duty": {
    title: `Call of Duty Optimization V${APP_VERSION} — Opti Gods by leaq`,
    description: "Windows optimization tools for Call of Duty and Warzone with transparent network, input, memory, and performance tweaks.",
    index: true,
  },
  "/game-profiles/rust": {
    title: `Rust FPS Optimization V${APP_VERSION} — Opti Gods by leaq`,
    description: "Hardware-aware Rust game optimization tools for Windows gaming performance and transparent script generation.",
    index: true,
  },
  "/game-profiles/roblox": {
    title: `Roblox Performance Optimization V${APP_VERSION} — Opti Gods by leaq`,
    description: "Windows performance recommendations for Roblox with hardware-aware tweaks and transparent optimization scripts.",
    index: true,
  },
};

const DEFAULT_METADATA: MarketingMetadata = {
  title: `Opti Gods V${APP_VERSION} — Windows Gaming PC Optimizer by leaq`,
  description: `Opti Gods V${APP_VERSION}: hardware-aware Windows gaming optimization with transparent tweaks and game-specific tools.`,
  index: false,
};

export function isPublicMarketingPath(pathname: string) {
  return pathname in ROUTE_SEO;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setMetaContent(template: string, attribute: "name" | "property", key: string, value: string) {
  const escapedValue = escapeHtml(value);
  const metaPattern = new RegExp(
    `<meta\\s+([^>]*\\b${attribute}="${key}"[^>]*)>`,
    "i",
  );
  return template.replace(metaPattern, (_match, attributes: string) => {
    const updatedAttributes = attributes.replace(
      /\bcontent="[^"]*"/i,
      `content="${escapedValue}"`,
    );
    return `<meta ${updatedAttributes}>`;
  });
}

function setCanonical(template: string, canonical: string) {
  return template.replace(
    /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
  );
}

function publicBody(pathname: string) {
  if (pathname === "/") {
    return `
      <main style="background:#050505;color:#fff;font-family:Arial,sans-serif;line-height:1.6;padding:48px 24px">
        <h1>Your PC has more performance in it.</h1>
        <p>Opti Gods scans your Windows PC, matches recommendations to your exact hardware, and gives you control over the tweaks that matter for gaming.</p>
        <p><a href="/showcase" style="color:#f87171">See real results</a> · <a href="/leaq" style="color:#f87171">About leaq</a> · <a href="/updates" style="color:#f87171">V5 updates</a></p>
        <h2>Hardware-aware Windows optimization</h2>
        <p>Review transparent registry, GPU, network, memory, power, and game-specific recommendations for Windows 10 and Windows 11 PCs.</p>
        <h2>Built for gaming PCs, laptops, and OEM systems</h2>
        <p>Opti Gods supports NVIDIA, AMD, Intel integrated graphics, FiveM, Fortnite, Call of Duty, Valorant, Rust, Roblox, and more.</p>
        <p><a href="/game-profiles" style="color:#f87171">Explore game profiles</a> · <a href="/pro" style="color:#f87171">See Pro access</a></p>
      </main>
    `;
  }

  if (pathname === "/showcase") {
    return `
      <main style="background:#080808;color:#fff;font-family:Arial,sans-serif;line-height:1.6;padding:48px 24px">
        <h1>Opti Gods — the Windows PC optimizer that actually works.</h1>
        <p>Real results from FiveM, Fortnite, and integrated-graphics systems, with hardware-aware tweaks for desktops and laptops.</p>
        <h2>Real results</h2>
        <ul>
          <li>FiveM Roleplay: 48 FPS to 120+ FPS on an i7-10700 and GTX 1650 Super.</li>
          <li>Fortnite Freebuild: 120 FPS to 300+ FPS on a GTX 1650 Super.</li>
          <li>Fortnite Creative: 60 FPS to 300+ FPS on integrated graphics.</li>
          <li>FiveM TMFRZ: 187 FPS to 250+ FPS on a GTX 1650 Super.</li>
        </ul>
        <h2>What is included</h2>
        <p>608+ transparent Windows tweaks, game profiles, GPU tuning, network latency tools, memory optimization, and lifetime Pro access.</p>
        <p><a href="/" style="color:#f87171">Back to Opti Gods</a> · <a href="/leaq" style="color:#f87171">Meet leaq</a> · <a href="https://discord.gg/nQagPU5a4Z" style="color:#f87171">Join Discord</a></p>
      </main>
    `;
  }

  return "";
}

export function renderPublicShell(template: string, requestPath: string) {
  const pathname = requestPath.split("?")[0] || "/";
  const metadata = ROUTE_SEO[pathname] ?? DEFAULT_METADATA;
  const canonicalPath = pathname === "/" ? "/" : pathname;
  const canonical = `${PUBLIC_SITE_ORIGIN}${canonicalPath}`;
  let page = template.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeHtml(metadata.title)}</title>`,
  );

  for (const [attribute, key, value] of [
    ["name", "description", metadata.description],
    ["name", "robots", metadata.index ? "index, follow" : "noindex, nofollow"],
    ["property", "og:url", canonical],
    ["property", "og:title", metadata.title],
    ["property", "og:description", metadata.description],
    ["name", "twitter:url", canonical],
    ["name", "twitter:title", metadata.title],
    ["name", "twitter:description", metadata.description],
  ] as const) {
    page = setMetaContent(page, attribute, key, value);
  }
  page = setCanonical(page, canonical);

  const body = publicBody(pathname);
  return body ? page.replace('<div id="root"></div>', `<div id="root">${body}</div>`) : page;
}