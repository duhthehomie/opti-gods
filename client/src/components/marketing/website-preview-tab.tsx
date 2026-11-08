import React, { useEffect, useState } from "react";
import { TWEAK_REGISTRY } from "@/lib/tweak-registry";
import { GAME_PROFILE_PAGES } from "@shared/marketing-pages";
import { DISCORD_INVITE, buildSupportMailto } from "@/lib/brand-links";
import { apiUrl } from "@/lib/api-base";
import { useQuery } from "@tanstack/react-query";
import { readBrowserHardware, type BrowserHardware } from "@/lib/website-preview-hardware";

type PreviewTabProps = {
  path: string;
  onNavigate: (path: string) => void;
  onApply: () => void;
};

const panel = "rounded-xl border border-white/10 bg-black/35 p-3 sm:p-4";
const button = "rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-semibold text-zinc-200 hover:border-red-500/40 hover:bg-red-500/10";
const action = `${button} border-red-500/30 bg-red-600 text-white hover:bg-red-500`;
const input = "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-zinc-200 focus:border-red-400 focus:outline-none";
const categoryLabels: Record<string, string> = {
  registry: "Windows", network: "Network", nvidia: "NVIDIA", amd: "AMD",
  intgpu: "Integrated GPU", fivem: "FiveM", memory: "Memory", laptop: "Laptop",
  fortnite: "Fortnite", discord: "Discord", debloat: "Debloat", wintitus: "WinTitus",
  startup: "Startup", processes: "Processes", "process-lasso": "Process Lasso",
  "game-detection": "Game Detection", rust: "Rust", roblox: "Roblox", cod: "Call of Duty",
  spotify: "Spotify", mouse: "Mouse", keyboard: "Keyboard",
};

/** Uses the app's real catalog, but never imports its stores or apply hooks. */
export function PreviewTweakCatalog({ onApply, onlyCategory }: { onApply: () => void; onlyCategory?: string }) {
  const [category, setCategory] = useState(onlyCategory ?? "all");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(10);
  const categories = Array.from(new Set(TWEAK_REGISTRY.map(tweak => tweak.category)));
  const rows = TWEAK_REGISTRY.filter(tweak =>
    (category === "all" || tweak.category === category) &&
    `${tweak.title ?? tweak.id} ${tweak.plainEnglish}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <section className="space-y-3" aria-label="Tweak catalog preview">
      <div className="flex flex-wrap gap-2">
        <input className={input} aria-label="Search preview tweaks" placeholder="Search tweaks…" value={search} onChange={event => { setSearch(event.target.value); setLimit(10); }} />
        {!onlyCategory && (
          <select className={input} aria-label="Preview tweak category" value={category} onChange={event => { setCategory(event.target.value); setLimit(10); }}>
            <option value="all">All categories</option>
            {categories.map(value => <option key={value} value={value}>{categoryLabels[value] ?? value}</option>)}
          </select>
        )}
      </div>
      <p className="text-[10px] text-zinc-500">{rows.length} tweaks · Read descriptions freely; Apply requires the Windows app.</p>
      <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
        {rows.slice(0, limit).map(tweak => (
          <article key={tweak.id} className={panel}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-zinc-200">{tweak.title ?? tweak.id}</h3>
                <p className="mt-1 text-[9px] uppercase tracking-wide text-red-300">{categoryLabels[tweak.category] ?? tweak.category} · {tweak.safety}</p>
              </div>
              <button type="button" className={button} aria-label={`Apply ${tweak.title ?? tweak.id}`} onClick={onApply}>Apply</button>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-zinc-400">{tweak.plainEnglish}</p>
            {(tweak.description || tweak.warning) && (
              <details className="mt-2 text-[10px] text-zinc-400">
                <summary className="cursor-pointer text-zinc-300">Details</summary>
                <p className="mt-2 leading-relaxed">{tweak.description}</p>
                {tweak.warning && <p className="mt-2 text-amber-300">{tweak.warning}</p>}
              </details>
            )}
          </article>
        ))}
        {rows.length === 0 && <p className="p-4 text-xs text-zinc-400">No tweaks match this search.</p>}
        {rows.length > limit && <button type="button" className={button} onClick={() => setLimit(count => count + 10)}>Show more tweaks</button>}
      </div>
    </section>
  );
}

function PowerPlanPreview({ onApply }: Pick<PreviewTabProps, "onApply">) {
  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-zinc-400">Browse the available plan types. Selecting or applying a plan is available only in the Windows app; no website selection is saved.</p>
      {["Balanced", "High Performance", "Power Saver"].map(name => (
        <article key={name} className={`${panel} flex items-center justify-between gap-3 text-xs text-zinc-300`}>
          <div><h3 className="font-bold">{name}</h3><p className="mt-1 text-[10px] text-zinc-500">Read-only plan preview</p></div>
          <button type="button" className={button} onClick={onApply}>Use in Windows app</button>
        </article>
      ))}
    </div>
  );
}

function GameProfilesPreview({ onApply }: Pick<PreviewTabProps, "onApply">) {
  const [selected, setSelected] = useState<string | null>(null);
  const profile = selected ? GAME_PROFILE_PAGES[selected as keyof typeof GAME_PROFILE_PAGES] : null;
  return (
    <div className="space-y-3">
      <p className="text-[10px] text-zinc-400">Select a game to explore its profile without applying anything.</p>
      <div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
        {Object.entries(GAME_PROFILE_PAGES).map(([slug, game]) => (
          <button key={slug} type="button" className={`${button} text-left ${selected === slug ? "border-red-500 text-red-300" : ""}`} aria-expanded={selected === slug} onClick={() => setSelected(slug)}>View {game.name}</button>
        ))}
      </div>
      {profile && (
        <section className={panel}>
          <h3 className="text-sm font-bold">{profile.name}</h3>
          <p className="mt-2 text-[10px] leading-relaxed text-zinc-400">{profile.intro}</p>
          <ul className="my-3 list-inside list-disc space-y-1 text-[10px] text-zinc-300">{profile.features.map(feature => <li key={feature}>{feature}</li>)}</ul>
          <p className="my-2 text-[10px] text-zinc-500">Browsing this profile does not select it for optimization or detect it on your PC.</p>
          <button type="button" className={action} onClick={onApply}>Use game profile in Windows app</button>
        </section>
      )}
    </div>
  );
}

function BrowserHardwarePreview({ onApply }: Pick<PreviewTabProps, "onApply">) {
  const [hardware, setHardware] = useState<BrowserHardware | null>(null);
  useEffect(() => { setHardware(readBrowserHardware()); }, []);
  const total = new Set(TWEAK_REGISTRY.map(tweak => tweak.id)).size;
  return <section className={`${panel} space-y-3`} data-testid="preview-browser-hardware">
    <h3 className="text-sm font-bold">System Scan & AI Optimize</h3>
    <p className="text-[10px] leading-relaxed text-zinc-400">Only browser-reported details are shown below. Nothing is uploaded or changed. This is not a Windows hardware scan.</p>
    <dl className="grid gap-2 text-[10px] sm:grid-cols-2">
      {Object.entries(hardware ?? { cpu: "Checking browser information…", gpu: "Checking…", memory: "Checking…", os: "Checking…" }).map(([label, value]) => (
        <div key={label} className="rounded-lg border border-white/5 p-2"><dt className="uppercase text-zinc-500">{label === "memory" ? "RAM" : label}</dt><dd className="mt-1 break-words text-zinc-300">{value}</dd></div>
      ))}
    </dl>
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="rounded-lg border border-red-500/20 p-3"><p className="text-lg font-bold text-red-300" data-testid="preview-catalog-count">{total}</p><p className="text-[10px] text-zinc-400">Unique tweaks in the full catalog—not all are compatible with every PC.</p></div>
      <div className="rounded-lg border border-white/10 p-3"><p className="text-xs font-bold">Your compatible Full Optimize count</p><p className="mt-1 text-[10px] text-zinc-400">Calculated after a validated Windows scan. The browser cannot verify your exact CPU, installed RAM, VRAM, or Windows build, so no personal total is guessed here.</p></div>
    </div>
    <p className="text-[10px] text-zinc-400">Free Windows download: 15 free tweaks. Pro: the full compatible preset after your Windows scan.</p>
    <button type="button" className={action} onClick={onApply}>Full Optimize · Get the Windows app</button>
  </section>;
}

function ReleasePreview() {
  const { data, isError } = useQuery<{ latestVersion: string }>({
    queryKey: ["/api/version"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/api/version"));
      if (!response.ok) throw new Error("Could not check the latest release.");
      const release = await response.json();
      if (!/^\d+\.\d+\.\d+$/.test(release.latestVersion)) throw new Error("Invalid release version.");
      return release;
    },
    staleTime: 60_000,
  });
  return (
    <section className={`${panel} space-y-3`}>
      <h3 className="text-sm font-bold">Software Updates</h3>
      <p className="text-xs text-zinc-400">{data ? `Latest GitHub release: v${data.latestVersion}` : isError ? "Release details unavailable. The download link checks for the latest installer." : "Checking GitHub…"}</p>
      <p className="text-[10px] text-zinc-500">Free Windows download · Includes 15 free tweaks. No installed app is detected or updated in this preview.</p>
      <a className={`${action} inline-flex`} href={apiUrl("/api/download/latest")}>Download for Windows</a>
    </section>
  );
}

/** Read-only tab content; the parent supplies the single guarded apply handler. */
export function WebsitePreviewTab({ path, onNavigate, onApply }: PreviewTabProps) {
  let content;
  switch (path) {
    case "/tweaks":
      content = <PreviewTweakCatalog onApply={onApply} />;
      break;
    case "/ai-optimize":
      content = <div className="space-y-3">
        <BrowserHardwarePreview onApply={onApply} />
        <button type="button" className={button} onClick={() => onNavigate("/tweaks")}>Browse available tweaks</button>
      </div>;
      break;
    case "/applied-tweaks":
      content = <section className={`${panel} space-y-3`}>
        <h3 className="text-sm font-bold">Applied Tweaks</h3>
        <p className="text-xs text-zinc-400">No applied history is loaded in the website preview.</p>
        <p className="text-[10px] leading-relaxed text-zinc-500">The Windows app shows your confirmed changes and their Undo controls. Browsing this preview does not read or change your history.</p>
        <button type="button" className={button} onClick={() => onNavigate("/tweaks")}>Browse tweaks</button>
      </section>;
      break;
    case "/power-plans":
      content = <PowerPlanPreview onApply={onApply} />;
      break;
    case "/game-profiles":
      content = <GameProfilesPreview onApply={onApply} />;
      break;
    case "/graphics-studio":
      content = <section className={`${panel} space-y-3`} data-testid="preview-graphics-locked">
        <h3 className="text-sm font-bold">FiveM Graphics Studio · Locked on the website</h3>
        <p className="text-xs leading-relaxed text-zinc-400">The builder, settings, pack generation, and installation are available only inside the Windows app with the required access. Website visitors cannot select settings or generate a pack.</p>
        <a className={`${action} inline-flex`} href={apiUrl("/api/download/latest")}>Download the Windows app</a>
      </section>;
      break;
    case "/tools":
      content = <div className="space-y-3">
        <p className="text-xs text-zinc-400">Review recovery tools. Running a repair or restore changes Windows and must be done in the app.</p>
        {["Create Restore Point", "Open System Restore", "Run Windows Repair"].map(title => <section key={title} className={`${panel} flex flex-wrap items-center justify-between gap-3`}><h3 className="text-xs font-bold">{title}</h3><button type="button" className={button} onClick={onApply}>{title}</button></section>)}
      </div>;
      break;
    case "/support":
      content = <section className={`${panel} space-y-3`}>
        <h3 className="text-sm font-bold">Support</h3>
        <p className="text-xs text-zinc-400">Get help, report a problem, or ask about Opti Gods.</p>
        <a href={DISCORD_INVITE} target="_blank" rel="noreferrer" className={`${button} inline-flex`}>Open Discord support</a>
        <a href={buildSupportMailto()} className={`${button} ml-2 inline-flex`}>Email support</a>
        <details className="text-[10px] text-zinc-400"><summary className="cursor-pointer text-zinc-200">Can I try the app for free?</summary><p className="mt-2">Yes. The free Windows download includes 15 free tweaks.</p></details>
      </section>;
      break;
    case "/updates":
      content = <ReleasePreview />;
      break;
    case "/account":
      content = <section className={`${panel} space-y-3`}>
        <h3 className="text-sm font-bold">Account</h3>
        <p className="text-xs text-zinc-400">Account preview · no personal account loaded.</p>
        <dl className="space-y-2 text-[10px] text-zinc-400"><div><dt className="text-zinc-200">Discord account</dt><dd>Sign in inside the app to view your profile.</dd></div><div><dt className="text-zinc-200">Free access</dt><dd>15 free tweaks included with the Windows download.</dd></div><div><dt className="text-zinc-200">Pro status</dt><dd>Not checked in this preview.</dd></div></dl>
        <button type="button" className={button} onClick={() => onNavigate("/support")}>Browse support</button>
      </section>;
      break;
    default:
      throw new Error(`Unknown preview tab: ${path}`);
  }
  return <div data-testid={`preview-page-${path.slice(1)}`} className="space-y-3">{content}</div>;
}
