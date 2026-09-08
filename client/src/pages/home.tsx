import { Link } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { useHardwareInfo } from "@/hooks/use-hardware-info";
import { useOsDetection } from "@/hooks/use-os-detection";
import { useProStatus } from "@/lib/pro-status";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { Activity, Settings2, Wrench, Crown, Sparkles, Cpu, MonitorPlay, MemoryStick, Zap, ArrowRight, Bot, Gauge, ShieldCheck, ScanLine, Gamepad2 } from "lucide-react";
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
        {/* Control center */}
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.65fr)]">
          <section className="relative min-h-[390px] overflow-hidden rounded-2xl border border-red-500/20 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.12),transparent_45%),linear-gradient(135deg,#0b1114,#050708)] p-6 md:p-8">
            <div className="absolute inset-0 pointer-events-none opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.22)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.22)_1px,transparent_1px)] [background-size:52px_52px]" />
            <div className="relative flex h-full flex-col items-center justify-between gap-8">
              <div className="flex w-full items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-red-400">
                    <ScanLine className="h-3.5 w-3.5" /> Performance control
                  </div>
                  <h1 className="mt-2 font-display text-2xl font-black text-white md:text-3xl">Welcome back.</h1>
                  <p className="mt-1 max-w-md text-xs leading-relaxed text-zinc-500">Scan your hardware, review matched recommendations, and build a transparent script for your next session.</p>
                </div>
                <span className="hidden rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300 sm:inline-flex">
                  <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400" /> Ready
                </span>
              </div>

              <div className="relative flex flex-col items-center">
                <div className="absolute h-64 w-64 rounded-full border border-red-500/10 shadow-[0_0_80px_-18px_rgba(239,68,68,0.8)]" />
                <div className="absolute h-52 w-52 rounded-full border border-red-500/20" />
                <div className="relative flex h-40 w-40 flex-col items-center justify-center rounded-full border-2 border-red-400/70 bg-[#070b0d] shadow-[0_0_50px_-12px_rgba(239,68,68,0.9)]">
                  <Gauge className="mb-2 h-5 w-5 text-red-400" />
                  <span className="font-display text-3xl font-black tracking-tight text-red-300">START</span>
                  <span className="mt-1 text-[9px] uppercase tracking-[0.18em] text-zinc-600">No changes applied</span>
                </div>
                <Link href="/system-scan" className="relative mt-5">
                  <button data-testid="button-run-instant-scan" className="inline-flex items-center gap-2 rounded-full border border-red-400/40 bg-red-600/80 px-6 py-3 text-xs font-bold text-white shadow-[0_0_30px_-10px_rgba(239,68,68,0.95)] transition-colors hover:bg-red-500">
                    <ScanLine className="h-3.5 w-3.5" /> Run instant scan <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </Link>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] text-zinc-500">
                <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5">{os.loading ? "Detecting OS…" : os.os}</span>
                <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5">{hw.loading ? "Detecting GPU…" : hw.gpuName || "GPU pending"}</span>
                <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5">{hw.ramGB ? `${hw.ramGB} GB RAM` : "RAM pending"}</span>
              </div>
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <StatusCard icon={Cpu} label="System profile" value={hw.loading ? "Scanning…" : (hw.gpuName || "Run scan")} detail={hw.isLaptop ? "Laptop detected" : "Hardware-aware matching"} />
            <StatusCard icon={ShieldCheck} label="Optimization state" value={`${enabled} selected`} detail="Review before generating a script" accent={enabled > 0} />
            <StatusCard icon={Gamepad2} label="Current plan" value={isPro ? "Pro lifetime" : "Free plan"} detail={isPro ? "AI, presets, and updates unlocked" : "Upgrade when you are ready"} accent={isPro} href={isPro ? undefined : "/pro"} />
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
            <Card href="/pro" icon={Crown} title="Pro" desc={isPro ? "Manage your Pro unlock" : "Unlock everything for $20"} accent="amber" testid="card-pro" />
          </div>
        </section>

        {/* What's new */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-red-500/70 mb-4">What's new</h2>
          <div className="rounded-xl border border-white/5 bg-zinc-950/40 divide-y divide-white/5">
            {[
              { tag: "V4", title: "580+ tweaks across 15+ dedicated tabs — nothing missed", desc: "DPC Latency · Fortnite · Discord While Gaming · Game Detection · Background Manager · Laptop · AMD iGPU · Intel iGPU · full audit every system" },
              { tag: "PERF", title: "100+ FPS Fortnite · 120+ FPS FiveM · 300+ FPS Valorant", desc: "Verified on GTX 1650 Super + Ryzen 5 3500. Works on any Windows PC — Alienware, CyberPowerPC, Dell, Lenovo, HP, ASUS, iBUYPOWER & more" },
              { tag: "BAT", title: ".bat downloads — double-click and done", desc: "No PowerShell execution policy issues. Hardware-matched preset from native scan." },
              { tag: "AI", title: "Opti Gods AI — ask 'give me a smart preset'", desc: "Screenshot analysis, vision mode, streaming chat. V4 changelog aware." },
              { tag: "FIX", title: "FiveM Graphics mesh fix + freeze time in every pack", desc: "No more meshy faces/arms from graphics packs. Freeze time toggle ships in every pack." },
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

function StatusCard({
  icon: Icon,
  label,
  value,
  detail,
  accent,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail: string;
  accent?: boolean;
  href?: string;
}) {
  const content = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/5">
          <Icon className="h-4 w-4 text-red-300" />
        </span>
        {href && <ArrowRight className="h-3.5 w-3.5 text-zinc-700 transition-transform group-hover:translate-x-0.5" />}
      </div>
      <p className="mt-5 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-600">{label}</p>
      <p className={cn("mt-1 truncate font-display text-lg font-black", accent ? "text-red-300" : "text-white")}>{value}</p>
      <p className="mt-1 text-[10px] leading-relaxed text-zinc-600">{detail}</p>
    </>
  );

  return href ? (
    <Link href={href} className="group rounded-2xl border border-white/[0.07] bg-[#080e10]/80 p-4 transition-colors hover:border-red-500/30 hover:bg-red-500/5">
      {content}
    </Link>
  ) : (
    <div className="rounded-2xl border border-white/[0.07] bg-[#080e10]/80 p-4">{content}</div>
  );
}
