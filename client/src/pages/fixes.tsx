import { useState } from "react";
import { apiUrl } from "@/lib/api-base";
import { getNativeAuthHeaders } from "@/lib/queryClient";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import {
  AlertTriangle, Download, CheckCircle2, RotateCcw, Cpu, Wifi, MemoryStick,
  Monitor, Power, Settings2, MonitorPlay, Flame, Activity, Gamepad2,
  ChevronDown, ChevronUp, Siren, CheckCheck, Server, Shield, MonitorOff, WifiOff,
  Gamepad, Film, Volume2, Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// ─── Accent color map ─────────────────────────────────────────────────────────
const A = {
  red:    { card: "border-red-600/60 bg-red-950/40",      hdr: "bg-red-700/30",     hdrBorder: "border-red-600/40",    icon: "text-red-400",    btn: "bg-red-700 hover:bg-red-600 border-red-500/40",    glow: "shadow-[0_0_24px_-4px_rgba(220,38,38,0.5)]"    },
  purple: { card: "border-purple-500/50 bg-purple-950/30", hdr: "bg-purple-600/20",  hdrBorder: "border-purple-500/30", icon: "text-purple-400", btn: "bg-purple-700 hover:bg-purple-600 border-purple-500/40", glow: "shadow-[0_0_24px_-4px_rgba(168,85,247,0.5)]" },
  orange: { card: "border-orange-500/40 bg-orange-950/20", hdr: "bg-orange-600/20",  hdrBorder: "border-orange-500/30", icon: "text-orange-400", btn: "bg-orange-700 hover:bg-orange-600 border-orange-500/40", glow: "shadow-[0_0_24px_-4px_rgba(249,115,22,0.5)]" },
  teal:   { card: "border-teal-500/40 bg-teal-950/30",    hdr: "bg-teal-600/20",    hdrBorder: "border-teal-500/30",   icon: "text-teal-400",   btn: "bg-teal-700 hover:bg-teal-600 border-teal-500/40",   glow: "shadow-[0_0_24px_-4px_rgba(20,184,166,0.5)]"  },
  blue:   { card: "border-blue-500/40 bg-blue-950/30",    hdr: "bg-blue-600/20",    hdrBorder: "border-blue-500/30",   icon: "text-blue-400",   btn: "bg-blue-700 hover:bg-blue-600 border-blue-500/40",   glow: "shadow-[0_0_24px_-4px_rgba(59,130,246,0.5)]"  },
  amber:  { card: "border-amber-500/40 bg-amber-950/20",  hdr: "bg-amber-600/20",   hdrBorder: "border-amber-500/30",  icon: "text-amber-400",  btn: "bg-amber-700 hover:bg-amber-600 border-amber-500/40",  glow: "shadow-[0_0_24px_-4px_rgba(245,158,11,0.5)]"  },
  green:  { card: "border-green-500/40 bg-green-950/20",  hdr: "bg-green-600/20",   hdrBorder: "border-green-500/30",  icon: "text-green-400",  btn: "bg-green-700 hover:bg-green-600 border-green-500/40",  glow: "shadow-[0_0_24px_-4px_rgba(34,197,94,0.5)]"   },
  sky:    { card: "border-sky-500/40 bg-sky-950/30",      hdr: "bg-sky-600/20",     hdrBorder: "border-sky-500/30",    icon: "text-sky-400",    btn: "bg-sky-700 hover:bg-sky-600 border-sky-500/40",    glow: "shadow-[0_0_24px_-4px_rgba(14,165,233,0.5)]"  },
} as const;
type AccentKey = keyof typeof A;

// ─── Restore categories ───────────────────────────────────────────────────────
const RESTORE_CATEGORIES = [
  {
    id: "cpu", label: "CPU Scheduling & Timer", icon: Cpu,
    color: "text-red-400", border: "border-red-500/20", bg: "bg-red-500/5",
    desc: "Resets Win32PrioritySeparation, system timer, game scheduler, MSI interrupt mode, and dynamic tick to Windows defaults.",
    restores: [
      "Win32PrioritySeparation → 2 (Windows default)", "SystemResponsiveness → 20",
      "Game Scheduler: High → Medium", "MSI Mode disabled on GPU",
      "Dynamic tick restored", "Timer resolution flags cleared",
    ],
  },
  {
    id: "network", label: "Network & TCP Stack", icon: Wifi,
    color: "text-blue-400", border: "border-blue-500/20", bg: "bg-blue-500/5",
    desc: "Restores Nagle's algorithm, TCP ACK frequency, NetworkThrottlingIndex, IPv6, NDU, DNS cache TTL, and AFD buffer sizes.",
    restores: [
      "NetworkThrottlingIndex → 10 (default)", "Nagle's algorithm re-enabled",
      "TCP ACK frequency keys removed", "NDU service re-enabled",
      "IPv6 re-enabled on all adapters", "DNS cache TTL reset to default", "AFD send/receive buffers reset",
    ],
  },
  {
    id: "memory", label: "Memory Management", icon: MemoryStick,
    color: "text-violet-400", border: "border-violet-500/20", bg: "bg-violet-500/5",
    desc: "Re-enables Memory Compression, Prefetch/Superfetch, restores pagefile to automatic, and resets kernel paging.",
    restores: [
      "Memory Compression re-enabled", "Prefetch + Superfetch re-enabled",
      "Pagefile restored to automatic", "ClearPageFileAtShutdown disabled",
      "Pagefile encryption re-enabled", "Heap decommit threshold reset",
    ],
  },
  {
    id: "visual", label: "Visual Effects & Gaming", icon: Monitor,
    color: "text-zinc-300", border: "border-zinc-700", bg: "bg-zinc-900/40",
    desc: "Re-enables Game Bar, GameDVR, mouse pointer precision, UI animations, Fast Startup, and Windows Error Reporting.",
    restores: [
      "Xbox Game DVR re-enabled", "HAGS disabled (HwSchMode=1)",
      "Mouse pointer precision restored", "UI animations re-enabled",
      "Fast Startup re-enabled", "Windows Error Reporting re-enabled",
    ],
  },
  {
    id: "power", label: "Power Plan", icon: Power,
    color: "text-yellow-400", border: "border-yellow-500/20", bg: "bg-yellow-500/5",
    desc: "Switches back to Balanced power plan, re-enables USB selective suspend, core parking, and power throttling.",
    restores: [
      "Power plan → Balanced", "USB Selective Suspend re-enabled",
      "CPU Core Parking re-enabled", "Power Throttling re-enabled", "Dynamic tick restored",
    ],
  },
  {
    id: "services", label: "Windows Services", icon: Settings2,
    color: "text-orange-400", border: "border-orange-500/20", bg: "bg-orange-500/5",
    desc: "Restarts DiagTrack, Windows Search, SysMain (Superfetch), Windows Update, and Defender real-time protection.",
    restores: [
      "DiagTrack re-enabled + started", "WSearch (Windows Search) re-enabled",
      "SysMain (Superfetch) re-enabled", "Windows Update re-enabled",
      "Defender real-time protection on",
    ],
  },
  {
    id: "nvidia", label: "NVIDIA", icon: MonitorPlay,
    color: "text-green-400", border: "border-green-500/20", bg: "bg-green-500/5",
    desc: "Re-enables NVIDIA telemetry services, removes pre-rendered frame limit, disables HAGS, clears GraphicsDrivers hints.",
    restores: [
      "NvTelemetryContainer re-enabled", "NvDisplayContainerLS re-enabled",
      "Pre-rendered frames limit removed", "HAGS set back to off",
      "GraphicsDrivers hints cleared",
    ],
  },
  {
    id: "amd", label: "AMD", icon: Flame,
    color: "text-red-400", border: "border-red-500/20", bg: "bg-red-500/5",
    desc: "Re-enables AMD ULPS, Radeon Chill, power gating, and AMD telemetry services.",
    restores: [
      "ULPS re-enabled on AMD GPU", "Radeon Chill re-enabled",
      "GPU power gating restored", "AMD telemetry services re-enabled",
    ],
  },
  {
    id: "process", label: "Process Priority & IFEO", icon: Activity,
    color: "text-amber-400", border: "border-amber-500/20", bg: "bg-amber-500/5",
    desc: "Clears all IFEO PerfOptions for 15 game executables, restores app kill timeouts, and re-enables WER.",
    restores: [
      "All game IFEO PerfOptions cleared (15 executables)", "AutoEndTasks disabled",
      "WaitToKillAppTimeout → 20000ms", "Windows Error Reporting re-enabled",
    ],
  },
  {
    id: "fivem", label: "FiveM / GTA V", icon: Gamepad2,
    color: "text-cyan-400", border: "border-cyan-500/20", bg: "bg-cyan-500/5",
    desc: "Fixes FiveM_GTAProcess.exe memory write crashes and FiveM_ChromeBrowser 0xe0000008 heap errors. Also removes IFEO entries, cleans CitizenFX.ini tweaks, and re-enables NvTelemetry.",
    restores: [
      "LargeSystemCache → 0 (fixes GTA process memory write crash 0xDEED)",
      "Memory Compression re-enabled (fixes CEF/ChromeBrowser 0xe0000008 crash)",
      "GTA5.exe IFEO PerfOptions removed", "FiveM.exe IFEO PerfOptions removed",
      "CitizenFX.ini P2P entry removed", "CitizenFX.ini StreamingDistance removed",
      "NvTelemetryContainer re-enabled",
    ],
  },
  {
    id: "bcdedit", label: "BCD Boot Config (bcdedit Fixes)", icon: Settings2,
    color: "text-yellow-400", border: "border-yellow-500/20", bg: "bg-yellow-500/5",
    desc: "Restores bcdedit entries that can cause boot issues or unexpected behavior — removes useplatformtick override, restores dynamic tick, and resets hypervisor launch type.",
    restores: [
      "useplatformtick → removed (Windows default)", "uselegacyapicmode → removed",
      "disabledynamictick → removed (restored to default)",
      "hypervisorlaunchtype → Auto (safe default)", "nx → OptIn (re-enables DEP protection)",
    ],
  },
  {
    id: "gpu-usage", label: "High GPU Usage / Driver Issues", icon: MonitorPlay,
    color: "text-purple-400", border: "border-purple-500/20", bg: "bg-purple-500/5",
    desc: "Fixes idle/background GPU usage spiking caused by HAGS, TDR settings, or NVIDIA overlay processes. Re-enables TDR defaults and resets GPU scheduling.",
    restores: [
      "HAGS (HwSchMode) → 1 — disabled by default", "TdrLevel → 3 (Windows default)",
      "TdrDelay → 2 seconds (default)", "PagingAllocation → removed (default GPU paging)",
      "NVIDIA overlay container processes reset", "GraphicsDrivers Scheduler hint cleared",
    ],
  },
  {
    id: "time-sync", label: "Windows Time & Clock Sync", icon: Activity,
    color: "text-teal-400", border: "border-teal-500/20", bg: "bg-teal-500/5",
    desc: "Fixes clock drift and wrong time caused by disabling W32Time service (often disabled by WinUtil). Re-enables Windows Time service and syncs with time.windows.com.",
    restores: [
      "W32Time service re-enabled (Manual start)", "w32tm /resync — forces immediate NTP sync",
      "NTP server reset to time.windows.com", "Time sync on startup re-enabled",
      "Fixes clock that runs fast/slow after WinUtil tweaks",
    ],
  },
  {
    id: "processes-reduction", label: "Processes Reduction (Service Restore)", icon: Server,
    color: "text-emerald-400", border: "border-emerald-500/20", bg: "bg-emerald-500/5",
    desc: "Restores all 31 services changed by the Processes Reduction tab back to their Windows default startup types. Auto-restarts the ones that should be running.",
    restores: [
      "DiagTrack, DPS, DusmSvc, DoSvc → Automatic + restarted",
      "BITS, WSearch, SysMain, TrkWks, MapsBroker → Automatic + restarted",
      "WerSvc, Xbox services, SSDP, UPnP, FD services → Manual (Windows default)",
      "WinRM, WbioSrvc, TabletInput, Bluetooth, Fax → Manual (Windows default)",
      "Geolocation, Phone, WMP Network, W32Time → Manual (Windows default)",
      "RemoteRegistry → Disabled (Windows default)",
    ],
  },
];

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({
  icon: Icon, iconClass, title, desc,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-center gap-3 pt-4 pb-1">
      <div className="p-1.5 bg-zinc-900 rounded-lg border border-white/5 shrink-0">
        <Icon className={cn("w-4 h-4", iconClass)} />
      </div>
      <div className="min-w-0">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider">{title}</h2>
        <p className="text-[11px] text-zinc-500 leading-none mt-0.5">{desc}</p>
      </div>
      <div className="flex-1 border-t border-white/5 ml-2" />
    </div>
  );
}

// ─── Fix card (compact, collapsible) ─────────────────────────────────────────
function FixCard({
  title, subtitle, tweaks, icon: Icon, accent, urgent = false,
  bullets, footer, btnLabel, downloading, onDownload, testId,
}: {
  title: string;
  subtitle: string;
  tweaks: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: AccentKey;
  urgent?: boolean;
  bullets: Array<[string, string]>;
  footer: string;
  btnLabel: string;
  downloading: boolean;
  onDownload: () => void;
  testId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const a = A[accent];
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("rounded-xl border-2 overflow-hidden", a.card)}
    >
      {/* Header bar */}
      <div className={cn("flex items-center gap-3 px-4 py-2.5 border-b", a.hdr, a.hdrBorder)}>
        <Icon className={cn("w-3.5 h-3.5 shrink-0", a.icon, urgent && "animate-pulse")} />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-white leading-none">{title}</p>
          <p className="text-[10px] text-zinc-400 mt-0.5 leading-snug">{subtitle}</p>
        </div>
        <span className={cn("text-[9px] font-mono hidden lg:block shrink-0 ml-2 opacity-50", a.icon)}>
          {tweaks}
        </span>
      </div>

      {/* Action row */}
      <div className="flex items-center gap-3 px-4 py-2.5">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 transition-colors text-[11px] shrink-0"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? "Hide details" : "What this fixes"}
        </button>
        <div className="flex-1" />
        <Button
          data-testid={testId}
          onClick={onDownload}
          disabled={downloading}
          className={cn("font-black text-xs px-4 py-1.5 border text-white whitespace-nowrap h-auto", a.btn, a.glow)}
        >
          <Download className="w-3.5 h-3.5 mr-1.5" />
          {downloading ? "Generating..." : btnLabel}
        </Button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-white/5">
          <div className="pt-3 space-y-1.5">
            {bullets.map(([bold, rest]) => (
              <div key={bold} className="flex items-start gap-2">
                <CheckCheck className={cn("w-3.5 h-3.5 shrink-0 mt-0.5", a.icon)} />
                <p className="text-[11px] text-zinc-300 leading-snug">
                  <span className="text-white font-semibold">{bold}</span> — {rest}
                </p>
              </div>
            ))}
          </div>
          <p className={cn("text-[10px] mt-2 opacity-60", a.icon)}>{footer}</p>
        </div>
      )}
    </motion.div>
  );
}

// ─── Restore category card ────────────────────────────────────────────────────
function CategoryCard({
  cat, selected, onToggle,
}: {
  cat: typeof RESTORE_CATEGORIES[number];
  selected: boolean;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-xl border transition-all duration-200",
        selected ? `${cat.bg} ${cat.border}` : "bg-black/40 border-white/5 hover:border-white/10",
      )}
    >
      <div className="flex items-center gap-3 p-4">
        <button
          onClick={onToggle}
          data-testid={`toggle-restore-${cat.id}`}
          className={cn(
            "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all",
            selected ? "bg-red-500 border-red-500" : "border-zinc-700 hover:border-zinc-500",
          )}
        >
          {selected && <CheckCircle2 className="w-3 h-3 text-white" />}
        </button>
        <cat.icon className={cn("w-4 h-4 shrink-0", cat.color)} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">{cat.label}</p>
          <p className="text-[11px] text-zinc-500 leading-snug mt-0.5">{cat.desc}</p>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          data-testid={`button-expand-${cat.id}`}
          className="text-zinc-600 hover:text-zinc-300 transition-colors ml-2 shrink-0"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>
      {expanded && (
        <div className="px-4 pb-4">
          <div className="border-t border-white/5 pt-3 space-y-1.5">
            {cat.restores.map((r) => (
              <div key={r} className="flex items-start gap-2">
                <span className={cn("w-1.5 h-1.5 rounded-full mt-1.5 shrink-0", cat.color.replace("text-", "bg-"))} />
                <span className="text-[11px] text-zinc-400 font-mono">{r}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Fixes() {
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set(RESTORE_CATEGORIES.map((c) => c.id)));
  const [restoring, setRestoring] = useState(false);
  const [dlState, setDlState] = useState<Record<string, boolean>>({});

  const dlFix = (id: string, endpoint: string, filename: string, toastTitle: string, toastDesc: string) => {
    setDlState((s) => ({ ...s, [id]: true }));
    fetch(apiUrl(endpoint))
      .then((r) => { if (!r.ok) throw new Error(); return r.blob(); })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
        toast({ title: toastTitle, description: toastDesc });
      })
      .catch(() => toast({ title: "Download failed", description: "Try again.", variant: "destructive" }))
      .finally(() => setDlState((s) => ({ ...s, [id]: false })));
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const selectAll = () => setSelected(new Set(RESTORE_CATEGORIES.map((c) => c.id)));
  const selectNone = () => setSelected(new Set());

  const downloadRestore = async (cats: string[]) => {
    setRestoring(true);
    try {
      const res = await fetch(apiUrl("/api/generate-restore"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getNativeAuthHeaders() },
        body: JSON.stringify({ categories: cats }),
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "OptiGods-RESTORE-by-leaq.bat"; a.click();
      URL.revokeObjectURL(url);
      toast({
        title: "Restore Script Downloaded",
        description: "Double-click the .bat file and click Yes on the UAC prompt. Restart your PC when done.",
      });
    } catch {
      toast({ title: "Download failed", description: "Try again.", variant: "destructive" });
    } finally {
      setRestoring(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-3 w-full pb-10">

        {/* ── Page header ──────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-zinc-900 rounded-lg border border-white/5">
            <RotateCcw className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">Fixes & Restore</h1>
            <p className="text-zinc-500 text-sm">
              Targeted crash fixes by game + full restore scripts to undo any Opti Gods tweak
            </p>
          </div>
        </motion.div>

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* SECTION 1 — GAME CRASH FIXES                                       */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        <SectionHeader
          icon={Gamepad2} iconClass="text-red-400"
          title="Game Crash Fixes"
          desc="One-click .bat for specific games — run as Admin, restart PC after"
        />

        {/* FiveM & GTA V */}
        <FixCard
          testId="button-download-fivem-crash-fix"
          accent="red"
          urgent
          icon={Siren}
          title="FiveM & GTA V — Memory / GPU Crash"
          subtitle="Silent exits · 'memory could not be written' · productId != ProductID::INVALID"
          tweaks="DisablePagingExecutive · IFEO GpuPriorityClass · PagingAllocation · TDR"
          bullets={[
            ["Fixes productId != ProductID::INVALID (CfxState.h:88)", "clears IFEO MitigationOptions + Debugger keys, purges stale CfxState priv cache, re-enables Rockstar Service → cfxline assertion crash fixed"],
            ["Clears Windows Exploit Protection / ACG flags", "ACG blocked FiveM's hook system from writing trampoline stubs → Assertion failure: status == MH_OK (Hooking.Stubs.cpp:20)"],
            ["Removes GpuPriorityClass=8 + DisableRenderingContextPreemption", "Real-time GPU starved the CEF browser, blocked GPU hang recovery → silent black screen exits"],
            ["Restores DisablePagingExecutive=0 + re-enables Memory Compression", "memory write crash fix + FiveM_ChromeBrowser 0xe0000008 heap failure fix"],
            ["Restores GPU VRAM paging + safe TDR delay (8s)", "PagingAllocation=0 killed game silently on VRAM fill; TdrDelay=60s caused display to go black with no report"],
          ]}
          footer="Universal fix — safe for all systems. Covers all 13 FiveM build numbers. ~5 seconds."
          btnLabel="Download FiveM Fix"
          downloading={!!dlState["fivem"]}
          onDownload={() => dlFix("fivem", "/api/fivem-crash-fix-script", "OptiGods-FiveM-Fix.bat", "FiveM Fix Downloaded", "Double-click → allow UAC → restart PC.")}
        />

        {/* Valorant / Vanguard */}
        <FixCard
          testId="button-download-valorant-fix"
          accent="purple"
          icon={Shield}
          title="Valorant / Vanguard — Anti-Cheat Blocked"
          subtitle="'This game requires VBS' · game black-screens at launch · BattlEye integrity error"
          tweaks="Expert tweaks only: Win11DisableVBS · Win11DisableHVCI · SysHypervisorOff"
          bullets={[
            ["Only applies if you opted in to expert tweaks", "Win11DisableVBS, Win11DisableHVCI, or SysHypervisorOff — NOT enabled by default. Core preset does not touch VBS."],
            ["Valorant/Vanguard requires VBS + HVCI on Windows 11", "When VBS/HVCI are disabled by expert tweaks, Vanguard's kernel driver cannot load → game black-screens or refuses to launch."],
            ["Fixes: re-enables VBS, HVCI, and hypervisor launch via bcdedit", "Also re-enables DeviceGuard. WSL2 and Hyper-V VMs will work again after reboot."],
            ["Also covers BattlEye games (Rainbow Six Siege, PUBG, EFT)", "If your anti-cheat game suddenly shows an integrity error after expert tweaks, run this fix first."],
          ]}
          footer="Reboot required after running. Valorant will launch normally after restart."
          btnLabel="Download Vanguard Fix"
          downloading={!!dlState["valorant"]}
          onDownload={() => dlFix("valorant", "/api/valorant-fix-script", "OptiGods-Valorant-Fix.bat", "Valorant Fix Downloaded", "Re-enables VBS/HVCI. Reboot required.")}
        />

        {/* Fortnite / EAC — NEW */}
        <FixCard
          testId="button-download-fortnite-fix"
          accent="orange"
          icon={Target}
          title="Fortnite / Easy Anti-Cheat — Launch Blocked"
          subtitle="EAC fails to load · game closes immediately · infinite loading · 'EasyAntiCheat_EOS error'"
          tweaks="FortniteHighPriority IFEO · DisableDefender (expert) · ProcessLasso IFEO"
          bullets={[
            ["Clears IFEO PerfOptions on Fortnite + EAC executables", "FortniteHighPriority tweak adds CpuPriorityClass=6 to IFEO — EAC's integrity scan can flag unexpected IFEO entries on its own executables."],
            ["Re-enables Defender real-time protection", "DisableDefender (expert opt-in only) blocks EAC from verifying file signatures — EAC refuses to launch without Defender or equivalent AV running."],
            ["Re-enables Windows Security Center (SecurityHealthService)", "EAC checks SecurityHealthService on startup — if stopped, EAC treats the environment as untrusted and refuses to load."],
            ["Clears EasyAntiCheat + Epic launcher cache", "Corrupted EAC cache causes the error loop that looks like an infinite loading screen. Clearing it forces EAC to re-validate from scratch."],
            ["Also covers Rocket League, Rust, Apex Legends, R6 Siege, EFT", "Any game using EasyAntiCheat or BattlEye benefits from this fix if Defender was disabled by expert tweaks."],
          ]}
          footer="Restart PC after running. Fortnite and all EAC/BattlEye games will launch normally. Defender real-time protection is re-enabled."
          btnLabel="Download Fortnite Fix"
          downloading={!!dlState["fortnite"]}
          onDownload={() => dlFix("fortnite", "/api/fortnite-fix-script", "OptiGods-Fortnite-Fix.bat", "Fortnite Fix Downloaded", "Re-enables Defender + clears EAC cache. Restart PC.")}
        />

        {/* Xbox Game Pass */}
        <FixCard
          testId="button-download-xbox-fix"
          accent="teal"
          icon={Gamepad}
          title="Xbox Game Pass / Microsoft Store Games Won't Launch"
          subtitle="Game closes after clicking Play · Store games crash at launch · Xbox cloud gaming broken"
          tweaks="Tweaks: DisableXboxGameBar · Xbox services via Debloat"
          bullets={[
            ["DisableXboxGameBar disables the GameBar Presence Server API", "Some Game Pass titles call the GameBar API on launch to log a session — if it's gone they exit silently. This re-registers the API without re-enabling Game Bar recording."],
            ["Xbox services disabled via Debloat breaks Game Pass DRM", "XblGameSave, XblAuthManager, XboxNetApiSvc must be running for Game Pass license validation — if stopped, games see an invalid license and refuse to start."],
            ["Fixes: re-enables only required Xbox services (not full bloat)", "Only XblGameSave, XblAuthManager, XboxNetApiSvc, and XboxGipSvc are restored — not Cortana, Xbox DVR, or telemetry."],
            ["Also clears AppCompatFlags blocking Microsoft Store executables", "Removes compatibility shims applied to WindowsApps executables that may prevent them from loading."],
          ]}
          footer="Restart PC after running. Game Pass games will launch normally. Xbox DVR/recording stays disabled."
          btnLabel="Download Xbox Fix"
          downloading={!!dlState["xbox"]}
          onDownload={() => dlFix("xbox", "/api/xbox-gamepass-fix-script", "OptiGods-Xbox-Fix.bat", "Xbox Fix Downloaded", "Re-enables Game Bar & Xbox services. Restart PC.")}
        />

        {/* Discord Voice */}
        <FixCard
          testId="button-download-discord-fix"
          accent="blue"
          icon={WifiOff}
          title="Discord Voice Drops / FiveM Auth / Xbox Party Chat"
          subtitle="Voice relay disconnecting mid-game · Xbox party failing · FiveM auth broken after clean install"
          tweaks="Expert opt-in ONLY: DisableIPv6"
          bullets={[
            ["Only applies if you opted in to DisableIPv6", "V3's core preset uses the safe prefer-IPv4 method instead. Only run this if you manually enabled DisableIPv6."],
            ["DisableIPv6 breaks Discord voice relay ICE negotiation", "Discord uses IPv6 TURN/STUN relay addresses when IPv4 relay is saturated — disabling IPv6 causes mid-call drops."],
            ["Also breaks Xbox party chat + FiveM Rockstar entitlement check", "Rockstar Social Club + Xbox Live both negotiate via IPv6 endpoints → authentication fails silently."],
            ["Also fixes SystemResponsiveness=0 starving Discord audio threads", "Sets SystemResponsiveness=10 (10% reserved for audio/background) — prevents Discord audio pipeline from dying under CPU load."],
          ]}
          footer="Restart Discord + PC after running. Voice relay, Xbox party, and FiveM auth will all work again."
          btnLabel="Download Discord Fix"
          downloading={!!dlState["discord"]}
          onDownload={() => dlFix("discord", "/api/discord-network-fix-script", "OptiGods-Discord-Fix.bat", "Discord Fix Downloaded", "Re-enables IPv6. Restart Discord + PC.")}
        />

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* SECTION 2 — WINDOWS & APP FIXES                                    */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        <SectionHeader
          icon={Monitor} iconClass="text-sky-400"
          title="Windows & App Fixes"
          desc="Fixes for system features that optimization tweaks may affect"
        />

        {/* Black Screen / Boot */}
        <FixCard
          testId="button-download-boot-fix"
          accent="amber"
          icon={MonitorOff}
          title="Black Screen / Boot Issues / Display Driver Crash"
          subtitle="Black screen after reboot · TDR crash on wake · monitor not detected · boot hangs at spinner"
          tweaks="Expert tweaks: SysHypervisorOff · Win11DisableVBS · bcdedit DisableDynamicTick"
          bullets={[
            ["SysHypervisorOff + Win11DisableVBS on hybrid GPU / Optimus laptops causes boot black screen", "When the hypervisor is disabled, the display driver can't load its kernel component on resume — manifests as a black screen requiring a hard reboot."],
            ["DisableDynamicTick (bcdedit) can cause boot hang on AMD Ryzen APUs and some Intel platforms", "V3 uses the safer disabledynamictick=yes — but on a few AMD APU models this still causes slow boot. This fix removes the BCD override entirely."],
            ["Resets bcdedit disabledynamictick, restores hypervisorlaunchtype=Auto, resets TDR to 2s", "Removes useplatformtick and uselegacyapicmode overrides. Re-enables VBS via registry. Resets MPO (multi-plane overlay) that causes post-wake black screen on NVIDIA+Intel combos."],
            ["Safe for all PCs — only removes bcdedit overrides, does not touch game tweaks", "Your performance settings, registry tweaks, and scheduler config are untouched. Only the boot config is reset."],
          ]}
          footer="Reboot required. Black screen and boot issues will be resolved after restart. Takes ~10 seconds."
          btnLabel="Download Boot Fix"
          downloading={!!dlState["boot"]}
          onDownload={() => dlFix("boot", "/api/boot-fix-script", "OptiGods-Boot-Fix.bat", "Boot Fix Downloaded", "Resets bcdedit + VBS. Restart PC.")}
        />

        {/* Audio Not Working — NEW */}
        <FixCard
          testId="button-download-audio-fix"
          accent="green"
          icon={Volume2}
          title="No Sound / Audio Crackling / Discord Voice Cutting Out"
          subtitle="Games muted · Discord audio dying mid-game · crackling or silence under CPU load"
          tweaks="SetResponsiveness (if 0) · MMCSS Games priority · audio service disabled"
          bullets={[
            ["Resets SystemResponsiveness to 10 (10% CPU for audio)", "If SystemResponsiveness was pushed too low, audio threads receive no CPU time → crackling, silence, or Discord voice drops. 10 is the safe baseline that keeps Discord and in-game audio stable."],
            ["Restarts AudioSrv + AudioEndpointBuilder services", "Some aggressive debloat tools stop the Windows Audio services. This re-enables them as Automatic and restarts them immediately — no reboot needed in most cases."],
            ["Resets MMCSS Audio + Pro Audio task profiles to defaults", "Extreme MMCSS Games priority values can starve the Audio scheduling class. This resets Audio to Medium and Pro Audio to High (Windows defaults)."],
            ["Clears audio interrupt priority override (DisableLowQoSInterrupt)", "This flag can prevent audio DPC (deferred procedure call) from being serviced, causing stuttering or silence — removing it restores normal audio interrupt handling."],
          ]}
          footer="Audio should work immediately — no restart required in most cases. If Discord voice is still cutting out, restart Discord after running."
          btnLabel="Download Audio Fix"
          downloading={!!dlState["audio"]}
          onDownload={() => dlFix("audio", "/api/audio-fix-script", "OptiGods-Audio-Fix.bat", "Audio Fix Downloaded", "Resets audio services + MMCSS. Restart Discord if needed.")}
        />

        {/* WMP / Photos */}
        <FixCard
          testId="button-download-wmp-fix"
          accent="sky"
          icon={Film}
          title="Windows Media Player / Photos — Can't Play Video Files"
          subtitle="'WMP encountered a problem' · Photos won't play MP4/MOV clips · codec missing error"
          tweaks="DebloatZune · ServiceWMPNetworkSvc · audio renderer keys"
          bullets={[
            ["Re-enables Windows Media Player optional feature via DISM", "Some debloat tools disable WMP as a Windows Feature — this re-enables it without a reinstall."],
            ["Re-registers WMP + DirectShow DLLs (wmp.dll, quartz.dll, devenum.dll…)", "Codec registrations can break after driver updates or debloat. regsvr32 re-links them to Windows."],
            ["Clears DRM cache + stale media library database (.wmdb)", "Corrupted DRM rights cache causes WMP to fail on files it previously played fine."],
            ["Resets WMP audio/video renderer back to auto-detect", "Some audio tweaks write a broken renderer preference — resetting it lets WMP pick the correct output again."],
            ["Resets Media Foundation pipeline — fixes Windows Photos MP4/MOV playback too", "FiveM players trimming clips in Photos benefit from this fix since both apps share the same codec pipeline."],
          ]}
          footer="Safe for all systems. Takes ~15 seconds. Restart PC after running."
          btnLabel="Download WMP Fix"
          downloading={!!dlState["wmp"]}
          onDownload={() => dlFix("wmp", "/api/wmp-fix-script", "OptiGods-WMP-Fix.bat", "WMP Fix Downloaded", "Re-registers codecs + DLLs. Restart PC.")}
        />

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* SECTION 3 — FULL SYSTEM RESTORE                                    */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        <SectionHeader
          icon={RotateCcw} iconClass="text-cyan-400"
          title="Full System Restore"
          desc="Select which tweak categories to undo, then download a combined .bat restore script"
        />

        {/* Warning */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 px-4 py-4 rounded-xl border border-amber-500/25 bg-amber-500/5"
        >
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-amber-300">Before you restore</p>
            <p className="text-xs text-zinc-400 leading-relaxed">
              These scripts undo the registry and system changes made by Opti Gods. They do{" "}
              <span className="text-white font-medium">not</span> reinstall apps removed by the Debloat tab —
              those require a Windows feature repair or reinstall from the Store.
              Always create a <span className="text-white font-medium">System Restore Point</span> before running any script.
            </p>
          </div>
        </motion.div>

        {/* Select all / none bar */}
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-zinc-500">
            {selected.size} of {RESTORE_CATEGORIES.length} categories selected
          </p>
          <div className="flex gap-2">
            <button
              onClick={selectAll}
              data-testid="button-select-all-restore"
              className="text-xs text-zinc-400 hover:text-white transition-colors px-2 py-1 rounded border border-zinc-800 hover:border-zinc-600"
            >
              Select All
            </button>
            <button
              onClick={selectNone}
              data-testid="button-select-none-restore"
              className="text-xs text-zinc-400 hover:text-white transition-colors px-2 py-1 rounded border border-zinc-800 hover:border-zinc-600"
            >
              None
            </button>
          </div>
        </div>

        {/* Category checkboxes */}
        <div className="space-y-2">
          {RESTORE_CATEGORIES.map((cat) => (
            <CategoryCard
              key={cat.id}
              cat={cat}
              selected={selected.has(cat.id)}
              onToggle={() => toggle(cat.id)}
            />
          ))}
        </div>

        {/* Download restore button */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="pt-2"
        >
          <Button
            data-testid="button-download-restore"
            onClick={() => downloadRestore(Array.from(selected))}
            disabled={restoring || selected.size === 0}
            className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-black text-base py-4 border border-zinc-700/50 hover:border-zinc-500/50 transition-all h-auto"
          >
            <Download className="w-5 h-5 mr-2" />
            {restoring
              ? "Generating restore script..."
              : `Download Restore Script (${selected.size} ${selected.size === 1 ? "category" : "categories"})`}
          </Button>
          <p className="text-center text-[10px] text-zinc-600 mt-2">
            Double-click → allow UAC → restart PC when done
          </p>
        </motion.div>

      </div>
    </AppLayout>
  );
}
