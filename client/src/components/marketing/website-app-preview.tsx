import { useState } from "react";
import { apiUrl } from "@/lib/api-base";
import { TOTAL_TWEAKS_LABEL } from "@/lib/tweak-count";
import {
  Check,
  Crosshair,
  Cpu,
  Download,
  Flame,
  Monitor,
  Radio,
  Rocket,
  Shield,
  X,
  Zap,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QuickBoostPresetCards } from "@/components/marketing/quick-boost-preset-cards";
import { APP_PRIMARY_NAV } from "@/components/marketing/app-sidebar-items";
import { WebsitePreviewTab } from "@/components/marketing/website-preview-tab";

/**
 * Display-only rendering of the current Windows dashboard, built from the
 * dashboard and AppLayout visual language. It intentionally does not mount
 * AppLayout or Dashboard: neither hardware hooks nor optimization stores run
 * in a website preview.
 */
export function WebsiteAppPreview({ path, onNavigate, workspace = false }: {
  path?: string; onNavigate?: (path: string) => void; workspace?: boolean;
} = {}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [localPath, setLocalPath] = useState("/dashboard");
  const activePath = path ?? localPath;
  const setActivePath = (next: string) => {
    if (onNavigate) onNavigate(next);
    else setLocalPath(next);
  };

  return (
    <section
      aria-label="Opti Gods Windows app website preview"
      data-testid="landing-product-preview"
      className="relative w-full"
    >
      <div className="pointer-events-none absolute -inset-5 rounded-[2rem] bg-red-600/[0.08] blur-3xl" />
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#040708] text-white shadow-[0_30px_90px_-38px_rgba(220,38,38,0.5)]">
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] bg-[#071013]/90 px-3 py-2.5 sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 font-display text-[9px] font-black text-red-400">OG</div>
            <div className="min-w-0">
              <p className="truncate font-display text-[10px] font-bold tracking-wide">OPTI <span className="text-red-500">GODS</span></p>
              <p className="text-[8px] uppercase tracking-[0.14em] text-zinc-600">Performance workspace</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full border border-amber-400/20 bg-amber-400/[0.06] px-2 py-1 text-[8px] font-bold uppercase tracking-wider text-amber-200">
              Website preview
            </span>
            <a
              href={apiUrl("/api/download/latest")}
              aria-label="Get the Windows app"
              className="hidden items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-600/90 px-2.5 py-1.5 text-[9px] font-bold text-white transition-colors hover:bg-red-500 sm:inline-flex"
            >
              <Download className="h-3 w-3" /> Windows app
            </a>
          </div>
        </div>

        <div className={`grid grid-cols-[48px_minmax(0,1fr)] sm:grid-cols-[150px_minmax(0,1fr)] md:grid-cols-[174px_minmax(0,1fr)] ${workspace ? "min-h-[calc(100vh-140px)]" : "min-h-[420px] md:min-h-[490px]"}`}>
          <aside className="border-r border-white/[0.07] bg-black/20 px-1.5 py-3 sm:px-2.5">
            <p className="mb-2 hidden px-2 text-[8px] font-bold uppercase tracking-[0.2em] text-zinc-600 sm:block">Workspace</p>
            <nav aria-label="Preview navigation" className="space-y-1">
              {APP_PRIMARY_NAV.map(({ title, url, icon: Icon }) => {
                const active = url === activePath;
                return (
                <button
                  key={url}
                  type="button"
                  title={title}
                  aria-label={`${title} (Windows app preview)`}
                  aria-pressed={active}
                  data-testid={`preview-nav-${url.slice(1)}`}
                  onClick={() => setActivePath(url)}
                  className={`flex w-full items-center justify-center gap-2 rounded-lg px-1.5 py-2 text-left text-[9px] font-semibold transition-colors sm:justify-start sm:px-2 md:px-2.5 ${
                    active
                      ? "border border-red-500/25 bg-red-500/10 text-white"
                      : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? "text-red-400" : "text-zinc-600"}`} />
                  <span className="hidden truncate sm:inline">{title}</span>
                </button>
                );
              })}
            </nav>
            <div className="mt-5 hidden border-t border-white/[0.07] pt-3 sm:block">
              <p className="px-2 text-[8px] font-semibold uppercase tracking-wider text-zinc-600">Detected System</p>
              <p className="mt-1 px-2 text-[9px] leading-relaxed text-zinc-700">Only available in the Windows app</p>
            </div>
          </aside>

          <main className="min-w-0 overflow-hidden p-2.5 sm:p-3.5 md:p-5">
            <div className="mb-3 flex min-h-7 items-center justify-between gap-2 border-b border-white/[0.07] pb-2">
              <p className="text-[8px] font-bold uppercase tracking-[0.18em] text-red-400 sm:text-[9px]">{APP_PRIMARY_NAV.find(item => item.url === activePath)?.title}</p>
              <span className="inline-flex items-center gap-1 text-[8px] text-zinc-600 sm:text-[9px]">
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
                Not connected
              </span>
            </div>

            {activePath === "/dashboard" ? <>
            <div className="relative mb-3 overflow-hidden rounded-xl border border-white/[0.07] border-l-[3px] border-l-red-500 bg-black/50 p-3 sm:p-4 md:p-5">
              <div className="pointer-events-none absolute right-0 top-0 h-full w-2/3 bg-gradient-to-l from-red-500/[0.06] to-transparent" />
              <div className="relative">
                <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/10 px-2 py-1 font-mono text-[8px] text-red-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
                  SYSTEM STATUS — PREVIEW ONLY
                </div>
                <h2 className="font-display text-lg font-bold leading-tight tracking-tight text-white sm:text-2xl md:text-3xl">
                  OPTI GODS <span className="text-red-500">by leaq</span>
                </h2>
                <p className="mt-1.5 text-[10px] font-medium leading-relaxed text-zinc-400 sm:text-xs">
                  {TOTAL_TWEAKS_LABEL} tweaks. Zero compromise.
                </p>
                <p className="mt-2 max-w-lg text-[9px] leading-relaxed text-zinc-500 sm:text-[10px]">
                  Hardware-aware recommendations are available in the Windows app. This website preview has no access to your PC.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setDialogOpen(true)}
                    className="inline-flex min-h-8 items-center rounded-lg border border-red-500/30 bg-red-600 px-2.5 py-1.5 text-[9px] font-bold text-white transition-colors hover:bg-red-500 sm:px-3"
                  >
                    <Rocket className="mr-1.5 h-3 w-3" /> Full Optimize
                  </button>
                  <button
                    type="button"
                    onClick={() => setDialogOpen(true)}
                    className="inline-flex min-h-8 items-center rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[9px] font-bold text-red-300"
                  >
                    <Zap className="mr-1.5 h-3 w-3" /> Get 15 Free Tweaks
                  </button>
                  <button
                    type="button"
                    onClick={() => setDialogOpen(true)}
                    className="inline-flex min-h-8 items-center rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[9px] font-semibold text-zinc-300 transition-colors hover:bg-white/[0.07] sm:px-3"
                  >
                    <Shield className="mr-1.5 h-3 w-3" /> Create Restore Point First
                  </button>
                </div>
              </div>
            </div>

            <section className="mb-3 rounded-xl border border-white/[0.07] bg-black/35 p-2.5 sm:p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Rocket className="h-3.5 w-3.5 text-red-500" />
                  <h3 className="text-[9px] font-bold uppercase tracking-wider text-zinc-200 sm:text-[10px]">Quick Boost Presets</h3>
                </div>
                <span className="text-[8px] text-zinc-600 sm:text-[9px]">Requires the Windows app</span>
              </div>
              <p className="mb-2.5 text-[9px] leading-relaxed text-zinc-500">
                Review a preset and its compatible options on your PC before applying.
              </p>
              <QuickBoostPresetCards
                compact
                presets={[
                  {
                    id: "safe",
                    title: "Safe Boost",
                    tag: "NO RISK",
                    desc: "Pure registry tweaks — CPU scheduling, power plan, privacy, memory, and game packs. Zero service stops. Safe for any PC.",
                    icon: Shield,
                    color: "text-white",
                    border: "border-white/30 hover:border-white/60",
                    glow: "shadow-[0_0_28px_-6px_rgba(255,255,255,0.25)]",
                    activeBg: "bg-white/[0.06]",
                    accentBar: "bg-gradient-to-r from-white to-zinc-300",
                    iconBg: "bg-white/10 border border-white/20",
                    tagBg: "bg-white/10 border-white/25 text-white",
                    actionLabel: "Preset",
                  },
                  {
                    id: "maxfps",
                    title: "Max FPS Gaming",
                    tag: "RECOMMENDED",
                    desc: "Runs the same hardware-aware Full Optimize flow, including the compatible Windows, game, GPU, memory, and performance recommendations for this PC.",
                    icon: Flame,
                    color: "text-red-400",
                    border: "border-red-500/30 hover:border-red-500/60",
                    glow: "shadow-[0_0_28px_-6px_rgba(239,68,68,0.3)]",
                    activeBg: "bg-red-950/30",
                    accentBar: "bg-gradient-to-r from-red-600 to-red-400",
                    iconBg: "bg-red-500/10 border border-red-500/20",
                    tagBg: "bg-red-500/10 border-red-500/25 text-red-400",
                    actionLabel: "Full Optimize",
                  },
                  {
                    id: "competitive",
                    title: "Competitive Shooter",
                    tag: "GPU TUNED",
                    desc: "Max FPS + full NVIDIA & AMD driver packs, MSI interrupt mode, Process Lasso engine, Discord footprint crush.",
                    icon: Crosshair,
                    color: "text-emerald-400",
                    border: "border-emerald-500/30 hover:border-emerald-500/60",
                    glow: "shadow-[0_0_28px_-6px_rgba(52,211,153,0.25)]",
                    activeBg: "bg-emerald-950/30",
                    accentBar: "bg-gradient-to-r from-emerald-500 to-emerald-400",
                    iconBg: "bg-emerald-500/10 border border-emerald-500/20",
                    tagBg: "bg-emerald-500/10 border-emerald-500/25 text-emerald-400",
                    actionLabel: "Preset",
                  },
                  {
                    id: "streamer",
                    title: "Streamer Mode",
                    tag: "OBS STABLE",
                    desc: "Game perf balanced with stable OBS encoder threads — no stutter drops. Full Discord + Spotify yield. Boot cleanup.",
                    icon: Radio,
                    color: "text-blue-400",
                    border: "border-blue-500/30 hover:border-blue-500/60",
                    glow: "shadow-[0_0_28px_-6px_rgba(59,130,246,0.3)]",
                    activeBg: "bg-blue-950/30",
                    accentBar: "bg-gradient-to-r from-blue-600 to-blue-400",
                    iconBg: "bg-blue-500/10 border border-blue-500/20",
                    tagBg: "bg-blue-500/10 border-blue-500/25 text-blue-400",
                    actionLabel: "Preset",
                  },
                ]}
                onSelect={() => setDialogOpen(true)}
              />
            </section>

            <div className="grid gap-2 sm:grid-cols-2">
              <section className="rounded-xl border border-white/[0.07] bg-black/35 p-2.5 sm:p-3">
                <div className="mb-2 flex items-center gap-1.5">
                  <Monitor className="h-3 w-3 text-red-400" />
                  <h3 className="text-[8px] font-bold uppercase tracking-wider text-zinc-500">System Profile</h3>
                </div>
                <p className="text-[9px] font-semibold text-zinc-300 sm:text-[10px]">No device data in this preview</p>
                <p className="mt-1 text-[8px] leading-relaxed text-zinc-600">Run a hardware scan in the Windows app to view your PC profile.</p>
              </section>
              <section className="rounded-xl border border-white/[0.07] bg-black/35 p-2.5 sm:p-3">
                <div className="mb-2 flex items-center gap-1.5">
                  <Cpu className="h-3 w-3 text-red-400" />
                  <h3 className="text-[8px] font-bold uppercase tracking-wider text-zinc-500">System Snapshot</h3>
                </div>
                <p className="text-[9px] font-semibold text-zinc-300 sm:text-[10px]">Live stats unavailable here</p>
                <p className="mt-1 text-[8px] leading-relaxed text-zinc-600">CPU, GPU and memory details stay on your Windows device.</p>
              </section>
            </div>
            </> : (
              <WebsitePreviewTab
                key={activePath}
                path={activePath}
                onNavigate={setActivePath}
                onApply={() => setDialogOpen(true)}
              />
            )}
          </main>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-white/[0.07] bg-black/30 px-3 py-2">
          <p className="min-w-0 truncate text-[8px] text-zinc-600">Browse the app · PC changes require Windows</p>
          <a
            href={apiUrl("/api/download/latest")}
            aria-label="Get the Windows installer"
            className="shrink-0 rounded-md p-1 text-red-300 transition-colors hover:bg-red-500/10 hover:text-red-200 sm:hidden"
          >
            <Download className="h-3.5 w-3.5" />
          </a>
          <span className="hidden items-center gap-1 text-[8px] text-zinc-700 sm:flex"><Check className="h-3 w-3" /> Website preview</span>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="border-white/10 bg-[#0b0c10] text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Windows app required</DialogTitle>
            <DialogDescription className="leading-relaxed text-zinc-400">
              Browsing is free. Applying tweaks, choosing a power plan, and running optimization require the Windows app. The free download includes 15 free tweaks; Full Optimize requires Pro in the Windows app.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <a href="/pro" className="inline-flex min-h-10 items-center justify-center rounded-lg border border-red-500/30 px-4 py-2 text-sm font-bold text-red-300">
              View Pro options
            </a>
            <a
              href={apiUrl("/api/download/latest")}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0c10]"
            >
              <Download className="h-4 w-4" /> Download for Windows
            </a>
            <button
              type="button"
              onClick={() => setDialogOpen(false)}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-zinc-300 transition-colors hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            >
              <X className="h-4 w-4" /> Close
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
