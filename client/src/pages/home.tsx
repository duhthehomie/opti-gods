import { Link } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { useHardwareInfo } from "@/hooks/use-hardware-info";
import { useOsDetection } from "@/hooks/use-os-detection";
import { useProStatus } from "@/lib/pro-status";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { Activity, Settings2, Wrench, Crown, Sparkles, Cpu, MonitorPlay, MemoryStick, Zap, ArrowRight, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { OptiGodsWordmark } from "@/components/branding/opti-gods-wordmark";

function Card({ href, icon: Icon, title, desc, accent = "red", testid }: { href: string; icon: React.ComponentType<{ className?: string }>; title: string; desc: string; accent?: "red" | "violet" | "amber"; testid?: string }) {
  const color = accent === "violet" ? "text-violet-400 border-violet-500/20 bg-violet-500/5" : accent === "amber" ? "text-amber-400 border-amber-500/20 bg-amber-500/5" : "text-red-400 border-red-500/20 bg-red-500/5";
  return (
    <Link href={href}>
      <div data-testid={testid} className={cn("group p-5 rounded-xl border bg-zinc-950/40 hover:bg-zinc-900/60 transition-all cursor-pointer hover:-translate-y-0.5", color.split(" ").filter(c => c.startsWith("border")).join(" "))}>
        <div className={cn("w-10 h-10 rounded-lg border flex items-center justify-center mb-3", color)}>
          <Icon className="w-5 h-5" />
        </div>
        <p className="text-white font-bold text-sm">{title}</p>
        <p className="text-zinc-500 text-xs mt-1 leading-relaxed">{desc}</p>
        <div className={cn("flex items-center gap-1 mt-3 text-[11px] font-bold uppercase tracking-wide group-hover:translate-x-1 transition-transform", color.split(" ")[0])}>
          Open <ArrowRight className="w-3 h-3" />
        </div>
      </div>
    </Link>
  );
}

export default function HomePage() {
  const hw = useHardwareInfo();
  const os = useOsDetection();
  const isPro = useProStatus();
  const { tweaks } = useOptimizationStore();
  const enabled = Object.values(tweaks).filter(Boolean).length;

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Hero */}
        <div className="relative rounded-2xl border border-white/5 bg-gradient-to-br from-red-500/10 via-zinc-950 to-black p-8 overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-red-500/10 rounded-full blur-[120px] pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-red-400" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-400">Opti Gods · v3</span>
            </div>
            <div className="mb-6">
              <OptiGodsWordmark variant="hero" />
            </div>
            <h1 className="text-3xl md:text-4xl font-display font-black text-white leading-tight">
              Welcome back. <span className="text-red-500">Your rig is waiting.</span>
            </h1>
            <p className="text-zinc-400 mt-2 max-w-xl">
              Hardware-aware tweaks, one-click fixes, and the AI assistant — all in one dashboard.
            </p>
          </div>
        </div>

        {/* Quick stats */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Detected OS" value={os.loading ? "…" : os.os} />
          <Stat label="GPU" value={hw.loading ? "…" : (hw.gpuName?.split(" ").slice(-3).join(" ") || "Unknown")} />
          <Stat label="Tweaks Selected" value={String(enabled)} accent={enabled > 0} />
          <Stat label="Pro Status" value={isPro ? "Active" : "Locked"} accent={isPro} />
        </section>

        {/* Recommended preset (placeholder) */}
        <section className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">Recommended for your PC</p>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              The hardware-matched preset will appear here once your scan completes.{" "}
              {!hw.loading && hw.gpuName && (
                <span className="text-red-300">Detected: {hw.gpuName} · {hw.ramGB ? `${hw.ramGB}GB RAM` : "RAM unknown"}.</span>
              )}
            </p>
            <Link href="/system-scan">
              <button data-testid="button-view-scan" className="mt-3 text-[11px] font-bold uppercase tracking-wide px-3 py-1.5 rounded-md border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors">
                View Full Scan
              </button>
            </Link>
          </div>
        </section>

        {/* Quick nav */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-red-500/70 mb-4">Jump to</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Card href="/system-scan" icon={Activity} title="System Scan" desc="Hardware + OS detection report" testid="card-scan" />
            <Card href="/tweaks" icon={Settings2} title="Tweaks" desc="All optimization toggles, grouped" testid="card-tweaks" />
            <Card href="/tools" icon={Wrench} title="Tools & Fixes" desc="Crash fixes, game scanner, Custom OS" testid="card-tools" />
            <Card href="/ai" icon={Bot} title="Opti Gods AI" desc="Chat your way to the perfect preset" accent="violet" testid="card-ai" />
            <Card href="/pro" icon={Crown} title="Pro" desc={isPro ? "Manage your Pro unlock" : "Unlock everything for $15"} accent="amber" testid="card-pro" />
          </div>
        </section>

        {/* What's new */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-red-500/70 mb-4">What's new</h2>
          <div className="rounded-xl border border-white/5 bg-zinc-950/40 divide-y divide-white/5">
            {[
              { tag: "V3", title: "442+ tweaks across 15+ dedicated tabs", desc: "DPC Latency · Fortnite · Discord While Gaming · Game Detection · Background Manager · Laptop · AMD iGPU · Intel iGPU" },
              { tag: "PERF", title: "100+ FPS Fortnite · 120+ FPS FiveM · 300+ FPS Valorant", desc: "Verified on GTX 1650 Super + Ryzen 5 3500. Full laptop & OEM support: Dell, Lenovo, HP, ASUS" },
              { tag: "BAT", title: ".bat downloads — double-click and done", desc: "No PowerShell execution policy issues. Hardware-matched preset from native scan." },
              { tag: "AI", title: "Opti Gods AI — ask 'give me a smart preset'", desc: "Screenshot analysis, vision mode, streaming chat. V3 changelog aware." },
              { tag: "FIX", title: "V2.1 stability surgery applied", desc: "EnableMSIMode / DisableIPv6 / SetTimerResolution moved to opt-in — no more BSODs or FiveM crashes" },
            ].map(n => (
              <div key={n.title} className="flex items-start gap-3 px-4 py-3">
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/25 shrink-0 mt-0.5">{n.tag}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{n.title}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{n.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div data-testid={`home-stat-${label.replace(/\s+/g, "-").toLowerCase()}`} className={cn("p-4 rounded-xl border bg-zinc-950/40", accent ? "border-red-500/20" : "border-white/5")}>
      <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-1">{label}</p>
      <p className={cn("text-sm font-mono font-semibold truncate", accent ? "text-red-400" : "text-white")}>{value}</p>
    </div>
  );
}
