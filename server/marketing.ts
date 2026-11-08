import { APP_VERSION } from "../client/src/generated/version";
import { GAME_PROFILE_PAGES, type GameProfileSlug } from "../shared/marketing-pages";

const PUBLIC_SITE_ORIGIN = "https://optigods.com";
const OG_IMAGE = `${PUBLIC_SITE_ORIGIN}/optigods_banner.png`;

export type MarketingMetadata = {
  title: string;
  description: string;
  index: boolean;
};

const ROUTE_SEO: Record<string, MarketingMetadata> = {
  "/": {
    title: "Windows PC Optimizer for Gaming & FPS | Opti Gods",
    description: "Optimize a Windows gaming PC with hardware-aware recommendations, reviewable tweaks, and game profiles for FiveM, Fortnite, Call of Duty, and more.",
    index: true,
  },
  "/showcase": {
    title: "See the Opti Gods Windows PC Optimizer | Showcase",
    description: "Explore the Opti Gods desktop app, its reviewable Windows settings, game profiles, and hardware-aware optimization workflow.",
    index: true,
  },
  "/updates": {
    title: "Opti Gods Updates | Windows Optimizer Release Notes",
    description: "Read Opti Gods release notes for desktop app changes, Windows optimization features, game profiles, and fixes.",
    index: true,
  },
  "/pro": {
    title: "Opti Gods Pro | Lifetime Windows PC Optimization",
    description: "See what is included with Opti Gods Pro: the full tweak library, custom scripts, AI assistance, presets, and lifetime updates.",
    index: true,
  },
  "/game-profiles": {
    title: "PC Game Optimization Profiles for Windows | Opti Gods",
    description: "Explore Windows game profiles for FiveM, Fortnite, Call of Duty, Rust, Roblox, VALORANT, and other supported games.",
    index: true,
  },
  ...Object.fromEntries(
    Object.entries(GAME_PROFILE_PAGES).map(([slug, page]) => [
      `/game-profiles/${slug}`,
      { title: page.title, description: page.description, index: true },
    ]),
  ),
};

const DEFAULT_METADATA: MarketingMetadata = {
  title: "Windows PC Optimizer for Gaming & FPS | Opti Gods",
  description: "Hardware-aware Windows gaming optimization with reviewable tweaks and game-specific tools from Opti Gods.",
  index: false,
};

export function isPublicMarketingPath(pathname: string) {
  return pathname in ROUTE_SEO || pathname === "/leaq";
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

function marketingMain(title: string, body: string) {
  return `
    <main style="background:#050505;color:#f4f4f5;font-family:Arial,sans-serif;line-height:1.7;padding:clamp(28px,6vw,72px);min-height:100vh">
      <div style="width:100%">
        <a href="/" style="color:#f87171;font-weight:700;text-decoration:none">Opti Gods</a>
        ${body.replace("__PAGE_TITLE__", title)}
        <nav aria-label="Explore Opti Gods" style="display:flex;flex-wrap:wrap;gap:18px;margin-top:42px;border-top:1px solid #27272a;padding-top:20px">
          <a href="/game-profiles" style="color:#f87171">Game profiles</a>
          <a href="/showcase" style="color:#f87171">See the app</a>
          <a href="/pro" style="color:#f87171">Opti Gods Pro</a>
          <a href="/leaq" style="color:#f87171">About the creator</a>
        </nav>
      </div>
    </main>
  `;
}

function gameProfileBody(slug: string) {
  if (!(slug in GAME_PROFILE_PAGES)) return "";
  const profile = GAME_PROFILE_PAGES[slug as GameProfileSlug];
  const features = profile.features
    .map((feature) => `<li style="margin:8px 0">${escapeHtml(feature)}</li>`)
    .join("");
  const body = `
    <section>
      <h1 style="font-size:clamp(34px,6vw,64px);line-height:1.08;max-width:980px">__PAGE_TITLE__</h1>
      <p style="font-size:19px;max-width:900px;color:#d4d4d8">${escapeHtml(profile.intro)}</p>
      <h2 style="margin-top:34px">What you can review</h2>
      <ul style="padding-left:24px">${features}</ul>
      <p style="max-width:900px;color:#a1a1aa">Available settings depend on your Windows version, hardware, game version, and current configuration. Performance results vary; Opti Gods does not promise a specific FPS increase.</p>
      <p style="display:flex;flex-wrap:wrap;gap:14px;margin-top:28px">
        <a href="/api/download/latest" style="display:inline-block;background:#dc2626;color:white;padding:12px 18px;border-radius:8px;font-weight:700;text-decoration:none">Download Opti Gods for Windows</a>
        <a href="/game-profiles" style="display:inline-block;border:1px solid #52525b;color:#fafafa;padding:12px 18px;border-radius:8px;text-decoration:none">Browse game profiles</a>
      </p>
      <p style="margin-top:32px;color:#71717a;font-size:13px">Game titles are trademarks of their respective owners. Opti Gods is independently developed and is not affiliated with or endorsed by game publishers.</p>
    </section>
  `;
  return marketingMain(profile.title, body);
}

function publicBody(pathname: string) {
  if (pathname === "/") {
    return marketingMain("Windows PC optimizer for gaming", `
      <section>
        <h1 style="font-size:clamp(38px,7vw,76px);line-height:1.04;max-width:1000px">A Windows PC optimizer built for gaming.</h1>
        <p style="font-size:20px;max-width:900px;color:#d4d4d8">Opti Gods helps Windows 10 and Windows 11 gamers review hardware-aware settings for their PC, then choose which changes to apply. Start with a free download; no fixed FPS gains are promised.</p>
        <p style="display:flex;flex-wrap:wrap;gap:14px;margin-top:26px">
          <a href="/api/download/latest" style="display:inline-block;background:#dc2626;color:white;padding:12px 18px;border-radius:8px;font-weight:700;text-decoration:none">Download Opti Gods for Windows</a>
          <a href="/showcase" style="display:inline-block;border:1px solid #52525b;color:#fafafa;padding:12px 18px;border-radius:8px;text-decoration:none">Explore the app</a>
        </p>
      </section>
      <section style="margin-top:48px;max-width:1100px">
        <h2>Optimize with your hardware in mind</h2>
        <p>Review Windows, GPU, network, memory, power, and game-related settings. Opti Gods presents compatible recommendations so you can inspect the changes rather than run an unknown tweak bundle.</p>
        <h2>Game-specific Windows profiles</h2>
        <p>Explore settings for FiveM, Fortnite, Call of Duty, Rust, Roblox, and VALORANT. The options available depend on your PC and game setup.</p>
        <ul style="display:flex;flex-wrap:wrap;gap:18px;padding:0;list-style:none">
          ${Object.entries(GAME_PROFILE_PAGES).map(([slug, game]) => `<li><a href="/game-profiles/${slug}" style="color:#f87171">${escapeHtml(game.name)} PC optimization</a></li>`).join("")}
        </ul>
        <h2>Review before you apply</h2>
        <p>See what a setting changes, use the Windows desktop app to review your choices, and use available backup or undo options when needed. Results vary with hardware, drivers, temperatures, Windows configuration, and game settings.</p>
      </section>
      <section id="faq" style="margin-top:48px;max-width:1100px">
        <h2>Frequently asked questions</h2>
        <h3>Does Opti Gods work on Windows 11?</h3>
        <p>Opti Gods is a Windows desktop app for Windows 10 and Windows 11 PCs. The available recommendations depend on your hardware and system configuration.</p>
        <h3>How much FPS will I gain?</h3>
        <p>There is no universal FPS increase. Performance depends on your PC, game, drivers, thermals, and settings. Review changes individually and compare results on your own system.</p>
        <h3>Can I see which games are supported?</h3>
        <p>Yes. Browse the <a href="/game-profiles" style="color:#f87171">game optimization profiles</a> for current titles and details.</p>
      </section>
    `);
  }

  if (pathname === "/showcase") {
    return marketingMain("See the Opti Gods app", `
      <section>
        <h1 style="font-size:clamp(36px,6vw,64px);line-height:1.08">See how Opti Gods helps you tune a Windows gaming PC</h1>
        <p style="font-size:19px;max-width:900px;color:#d4d4d8">Explore the desktop optimizer, reviewable Windows settings, game profiles, and the workflow from hardware scan to selected changes.</p>
        <h2 style="margin-top:32px">A clear optimization workflow</h2>
        <ol style="padding-left:24px">
          <li>Check your PC and Windows configuration.</li>
          <li>Review available recommendations and what they change.</li>
          <li>Select applicable options and generate or apply your changes.</li>
          <li>Review applied settings and use available undo options when needed.</li>
        </ol>
        <p>Opti Gods supports game-related settings for FiveM, Fortnite, Call of Duty, Rust, Roblox, VALORANT, and other listed profiles. Performance results vary by system and game.</p>
        <p><a href="/api/download/latest" style="color:#f87171;font-weight:700">Download the Windows app</a> · <a href="/game-profiles" style="color:#f87171">Browse game profiles</a></p>
      </section>
    `);
  }

  if (pathname === "/pro") {
    return marketingMain("Opti Gods Pro", `
      <section>
        <h1 style="font-size:clamp(36px,6vw,64px);line-height:1.08">Opti Gods Pro: one-time access for Windows PC optimization</h1>
        <p style="font-size:19px;max-width:900px;color:#d4d4d8">The Windows app is free to download. Pro is a one-time $20 purchase for the full tweak library, custom script generation, unlimited Opti Gods AI assistance, presets, priority Discord support, and lifetime updates.</p>
        <p style="margin-top:24px"><a href="/api/download/latest" style="display:inline-block;background:#dc2626;color:white;padding:12px 18px;border-radius:8px;font-weight:700;text-decoration:none">Download the free app</a> <a href="/" style="margin-left:14px;color:#f87171">See all features</a></p>
        <h2 style="margin-top:32px">What Pro includes</h2>
        <ul style="padding-left:24px">
          <li>Access to the complete optimization library.</li>
          <li>Personalized Windows script generation.</li>
          <li>Unlimited AI assistance and preset generation.</li>
          <li>Priority Discord support and lifetime updates.</li>
        </ul>
        <p>Review the current purchase options and access details in the Opti Gods app before checkout.</p>
      </section>
    `);
  }

  if (pathname === "/game-profiles") {
    return marketingMain("PC game optimization profiles", `
      <section>
        <h1 style="font-size:clamp(36px,6vw,64px);line-height:1.08">Windows optimization profiles for PC games</h1>
        <p style="font-size:19px;max-width:900px;color:#d4d4d8">Explore game-specific settings available in Opti Gods. Profiles group relevant Windows and game configuration so you can review options for your PC.</p>
        <ul style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px;padding:0;list-style:none;margin-top:28px">
          ${Object.entries(GAME_PROFILE_PAGES).map(([slug, game]) => `<li style="padding:20px;border:1px solid #27272a;border-radius:12px"><h2 style="margin-top:0"><a href="/game-profiles/${slug}" style="color:#f87171">${escapeHtml(game.name)} optimization</a></h2><p>${escapeHtml(game.description)}</p></li>`).join("")}
        </ul>
        <p>Available settings vary by game version, Windows configuration, and detected hardware. No universal FPS result is guaranteed.</p>
        <p><a href="/api/download/latest" style="color:#f87171;font-weight:700">Download Opti Gods for Windows</a></p>
      </section>
    `);
  }

  if (pathname === "/updates") {
    return marketingMain("Opti Gods updates", `
      <section>
        <h1 style="font-size:clamp(36px,6vw,64px);line-height:1.08">Opti Gods Windows app updates</h1>
        <p style="font-size:19px;max-width:900px;color:#d4d4d8">Follow updates to the Opti Gods desktop optimizer, including Windows compatibility work, game-profile changes, new tools, and fixes.</p>
        <p>Open the Updates page in the app for current release notes and announcements. See the <a href="/showcase" style="color:#f87171">app overview</a> or browse <a href="/game-profiles" style="color:#f87171">game profiles</a>.</p>
      </section>
    `);
  }

  const profileMatch = pathname.match(/^\/game-profiles\/([^/]+)$/);
  if (profileMatch) return gameProfileBody(profileMatch[1]);
  return "";
}

function schemaForPage(pathname: string, metadata: MarketingMetadata, canonical: string) {
  const graph: Record<string, unknown>[] = [
    {
      "@type": "Organization",
      "@id": `${PUBLIC_SITE_ORIGIN}/#organization`,
      name: "Opti Gods",
      url: PUBLIC_SITE_ORIGIN,
      logo: `${PUBLIC_SITE_ORIGIN}/assets/optigods-pfp.png`,
      sameAs: [
        "https://www.instagram.com/leaqinq/",
        "https://www.youtube.com/@mqhleek",
        "https://discord.gg/nQagPU5a4Z",
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${PUBLIC_SITE_ORIGIN}/#website`,
      name: "Opti Gods",
      url: PUBLIC_SITE_ORIGIN,
      inLanguage: "en",
      publisher: { "@id": `${PUBLIC_SITE_ORIGIN}/#organization` },
    },
    {
      "@type": "WebPage",
      "@id": `${canonical}#webpage`,
      url: canonical,
      name: metadata.title,
      description: metadata.description,
      inLanguage: "en",
      isPartOf: { "@id": `${PUBLIC_SITE_ORIGIN}/#website` },
      publisher: { "@id": `${PUBLIC_SITE_ORIGIN}/#organization` },
    },
  ];

  if (pathname === "/") {
    graph.push({
      "@type": "SoftwareApplication",
      "@id": `${PUBLIC_SITE_ORIGIN}/#software`,
      name: "Opti Gods",
      description: "A Windows desktop app for reviewing hardware-aware PC and game optimization settings.",
      url: PUBLIC_SITE_ORIGIN,
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "Windows 10, Windows 11",
      softwareVersion: APP_VERSION,
      downloadUrl: `${PUBLIC_SITE_ORIGIN}/api/download/latest`,
      installUrl: `${PUBLIC_SITE_ORIGIN}/api/download/latest`,
      featureList: [
        "Hardware-aware Windows gaming recommendations",
        "Reviewable game optimization packs",
        "Windows repair and diagnostic logs",
        "Desktop-only tweak application",
      ],
      publisher: { "@id": `${PUBLIC_SITE_ORIGIN}/#organization` },
    });
  }

  if (pathname === "/pro") {
    graph.push({
      "@type": "Product",
      name: "Opti Gods Pro lifetime access",
      description: "A one-time purchase that unlocks the full Opti Gods Pro feature set.",
      image: OG_IMAGE,
      brand: { "@type": "Brand", name: "Opti Gods" },
      offers: {
        "@type": "Offer",
        price: "20.00",
        priceCurrency: "USD",
        url: `${PUBLIC_SITE_ORIGIN}/pro`,
        availability: "https://schema.org/InStock",
      },
    });
  }

  const profileMatch = pathname.match(/^\/game-profiles\/([^/]+)$/);
  const profile = profileMatch ? GAME_PROFILE_PAGES[profileMatch[1] as keyof typeof GAME_PROFILE_PAGES] : null;
  if (profile) {
    graph.push({
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Opti Gods", item: PUBLIC_SITE_ORIGIN },
        { "@type": "ListItem", position: 2, name: "Game profiles", item: `${PUBLIC_SITE_ORIGIN}/game-profiles` },
        { "@type": "ListItem", position: 3, name: profile.name, item: canonical },
      ],
    });
  }
  return JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replaceAll("<", "\\u003c");
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
    ["property", "og:site_name", "Opti Gods"],
    ["property", "og:locale", "en_US"],
    ["property", "og:title", metadata.title],
    ["property", "og:description", metadata.description],
    ["property", "og:image", OG_IMAGE],
    ["property", "og:image:alt", "Opti Gods Windows PC optimizer"],
    ["property", "og:image:width", "1408"],
    ["property", "og:image:height", "768"],
    ["name", "twitter:url", canonical],
    ["name", "twitter:card", "summary_large_image"],
    ["name", "twitter:title", metadata.title],
    ["name", "twitter:description", metadata.description],
    ["name", "twitter:image", OG_IMAGE],
    ["name", "twitter:image:alt", "Opti Gods Windows PC optimizer"],
  ] as const) {
    page = setMetaContent(page, attribute, key, value);
  }
  page = setCanonical(page, canonical);

  const body = publicBody(pathname);
  page = page
    .replace(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<meta\s+name=["']keywords["'][^>]*\/?>/gi, "")
    .replace(/<a\b[^>]*style=["'][^"']*display\s*:\s*none[^"']*["'][^>]*>[\s\S]*?<\/a>/gi, "");
  page = page.replace(
    "</head>",
    `  <script type="application/ld+json">${schemaForPage(pathname, metadata, canonical)}</script>\n  </head>`,
  );
  // This is a no-JavaScript fallback, not a second website to paint before
  // React mounts. Keeping it in noscript prevents a flash of the old layout.
  return body ? page.replace('<div id="root"></div>', `<div id="root"><noscript>${body}</noscript></div>`) : page;
}