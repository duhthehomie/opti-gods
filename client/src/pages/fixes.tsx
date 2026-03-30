import { useState } from "react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import {
  AlertTriangle, Download, CheckCircle2, RotateCcw, Cpu, Wifi, MemoryStick,
  Monitor, Power, Settings2, MonitorPlay, Flame, Activity, Gamepad2, ShieldAlert,
  ChevronDown, ChevronUp, Siren, CheckCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const CATEGORIES = [
  {
    id: "cpu",
    label: "CPU Scheduling & Timer",
    icon: Cpu,
    color: "text-red-400",
    border: "border-red-500/20",
    bg: "bg-red-500/5",
    desc: "Resets Win32PrioritySeparation, system timer, game scheduler, MSI interrupt mode, and dynamic tick to Windows defaults.",
    restores: [
      "Win32PrioritySeparation → 2 (Windows default)",
      "SystemResponsiveness → 20",
      "Game Scheduler: High → Medium",
      "MSI Mode disabled on GPU",
      "Dynamic tick restored",
      "Timer resolution flags cleared",
    ],
  },
  {
    id: "network",
    label: "Network & TCP Stack",
    icon: Wifi,
    color: "text-blue-400",
    border: "border-blue-500/20",
    bg: "bg-blue-500/5",
    desc: "Restores Nagle's algorithm, TCP ACK frequency, NetworkThrottlingIndex, IPv6, NDU, DNS cache TTL, and AFD buffer sizes.",
    restores: [
      "NetworkThrottlingIndex → 10 (default)",
      "Nagle's algorithm re-enabled",
      "TCP ACK frequency keys removed",
      "NDU service re-enabled",
      "IPv6 re-enabled on all adapters",
      "DNS cache TTL reset to default",
      "AFD send/receive buffers reset",
    ],
  },
  {
    id: "memory",
    label: "Memory Management",
    icon: MemoryStick,
    color: "text-violet-400",
    border: "border-violet-500/20",
    bg: "bg-violet-500/5",
    desc: "Re-enables Memory Compression, Prefetch/Superfetch, restores pagefile to automatic, and resets kernel paging.",
    restores: [
      "Memory Compression re-enabled",
      "Prefetch + Superfetch re-enabled",
      "Pagefile restored to automatic",
      "ClearPageFileAtShutdown disabled",
      "Pagefile encryption re-enabled",
      "Heap decommit threshold reset",
    ],
  },
  {
    id: "visual",
    label: "Visual Effects & Gaming",
    icon: Monitor,
    color: "text-zinc-300",
    border: "border-zinc-700",
    bg: "bg-zinc-900/40",
    desc: "Re-enables Game Bar, GameDVR, mouse pointer precision, UI animations, Fast Startup, and Windows Error Reporting.",
    restores: [
      "Xbox Game DVR re-enabled",
      "HAGS disabled (HwSchMode=1)",
      "Mouse pointer precision restored",
      "UI animations re-enabled",
      "Fast Startup re-enabled",
      "Windows Error Reporting re-enabled",
    ],
  },
  {
    id: "power",
    label: "Power Plan",
    icon: Power,
    color: "text-yellow-400",
    border: "border-yellow-500/20",
    bg: "bg-yellow-500/5",
    desc: "Switches back to Balanced power plan, re-enables USB selective suspend, core parking, and power throttling.",
    restores: [
      "Power plan → Balanced",
      "USB Selective Suspend re-enabled",
      "CPU Core Parking re-enabled",
      "Power Throttling re-enabled",
      "Dynamic tick restored",
    ],
  },
  {
    id: "services",
    label: "Windows Services",
    icon: Settings2,
    color: "text-orange-400",
    border: "border-orange-500/20",
    bg: "bg-orange-500/5",
    desc: "Restarts DiagTrack, Windows Search, SysMain (Superfetch), Windows Update, and Defender real-time protection.",
    restores: [
      "DiagTrack re-enabled + started",
      "WSearch (Windows Search) re-enabled",
      "SysMain (Superfetch) re-enabled",
      "Windows Update re-enabled",
      "Defender real-time protection on",
    ],
  },
  {
    id: "nvidia",
    label: "NVIDIA",
    icon: MonitorPlay,
    color: "text-green-400",
    border: "border-green-500/20",
    bg: "bg-green-500/5",
    desc: "Re-enables NVIDIA telemetry services, removes pre-rendered frame limit, disables HAGS, clears GraphicsDrivers hints.",
    restores: [
      "NvTelemetryContainer re-enabled",
      "NvDisplayContainerLS re-enabled",
      "Pre-rendered frames limit removed",
      "HAGS set back to off",
      "GraphicsDrivers hints cleared",
    ],
  },
  {
    id: "amd",
    label: "AMD",
    icon: Flame,
    color: "text-red-400",
    border: "border-red-500/20",
    bg: "bg-red-500/5",
    desc: "Re-enables AMD ULPS, Radeon Chill, power gating, and AMD telemetry services.",
    restores: [
      "ULPS re-enabled on AMD GPU",
      "Radeon Chill re-enabled",
      "GPU power gating restored",
      "AMD telemetry services re-enabled",
    ],
  },
  {
    id: "process",
    label: "Process Priority & IFEO",
    icon: Activity,
    color: "text-amber-400",
    border: "border-amber-500/20",
    bg: "bg-amber-500/5",
    desc: "Clears all IFEO PerfOptions for 15 game executables, restores app kill timeouts, and re-enables WER.",
    restores: [
      "All game IFEO PerfOptions cleared (15 executables)",
      "AutoEndTasks disabled",
      "WaitToKillAppTimeout → 20000ms",
      "Windows Error Reporting re-enabled",
    ],
  },
  {
    id: "fivem",
    label: "FiveM / GTA V",
    icon: Gamepad2,
    color: "text-cyan-400",
    border: "border-cyan-500/20",
    bg: "bg-cyan-500/5",
    desc: "Fixes FiveM_GTAProcess.exe memory write crashes and FiveM_ChromeBrowser 0xe0000008 heap errors. Also removes IFEO entries, cleans CitizenFX.ini tweaks, and re-enables NvTelemetry.",
    restores: [
      "LargeSystemCache → 0 (fixes GTA process memory write crash 0xDEED)",
      "Memory Compression re-enabled (fixes CEF/ChromeBrowser 0xe0000008 crash)",
      "GTA5.exe IFEO PerfOptions removed",
      "FiveM.exe IFEO PerfOptions removed",
      "CitizenFX.ini P2P entry removed",
      "CitizenFX.ini StreamingDistance removed",
      "NvTelemetryContainer re-enabled",
    ],
  },
  {
    id: "bcdedit",
    label: "BCD Boot Config (bcdedit Fixes)",
    icon: Settings2,
    color: "text-yellow-400",
    border: "border-yellow-500/20",
    bg: "bg-yellow-500/5",
    desc: "Restores bcdedit entries that can cause boot issues or unexpected behavior — removes useplatformtick override, restores dynamic tick, and resets hypervisor launch type.",
    restores: [
      "useplatformtick → removed (Windows default)",
      "uselegacyapicmode → removed",
      "disabledynamictick → removed (restored to default)",
      "hypervisorlaunchtype → Auto (safe default)",
      "nx → OptIn (re-enables DEP protection)",
    ],
  },
  {
    id: "gpu-usage",
    label: "High GPU Usage / Driver Issues",
    icon: MonitorPlay,
    color: "text-purple-400",
    border: "border-purple-500/20",
    bg: "bg-purple-500/5",
    desc: "Fixes idle/background GPU usage spiking caused by HAGS, TDR settings, or NVIDIA overlay processes. Re-enables TDR defaults and resets GPU scheduling.",
    restores: [
      "HAGS (HwSchMode) → 1 — disabled by default",
      "TdrLevel → 3 (Windows default)",
      "TdrDelay → 2 seconds (default)",
      "PagingAllocation → removed (default GPU paging)",
      "NVIDIA overlay container processes reset",
      "GraphicsDrivers Scheduler hint cleared",
    ],
  },
  {
    id: "time-sync",
    label: "Windows Time & Clock Sync",
    icon: Activity,
    color: "text-teal-400",
    border: "border-teal-500/20",
    bg: "bg-teal-500/5",
    desc: "Fixes clock drift and wrong time caused by disabling W32Time service (often disabled by WinUtil). Re-enables Windows Time service and syncs with time.windows.com.",
    restores: [
      "W32Time service re-enabled (Manual start)",
      "w32tm /resync — forces immediate NTP sync",
      "NTP server reset to time.windows.com",
      "Time sync on startup re-enabled",
      "Fixes clock that runs fast/slow after WinUtil tweaks",
    ],
  },
];

function CategoryCard({
  cat,
  selected,
  onToggle,
}: {
  cat: typeof CATEGORIES[number];
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
        selected ? `${cat.bg} ${cat.border}` : "bg-black/40 border-white/5 hover:border-white/10"
      )}
    >
      <div className="flex items-center gap-3 p-4">
        <button
          onClick={onToggle}
          data-testid={`toggle-restore-${cat.id}`}
          className={cn(
            "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all",
            selected
              ? "bg-red-500 border-red-500"
              : "border-zinc-700 hover:border-zinc-500"
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

export default function Fixes() {
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set(CATEGORIES.map((c) => c.id)));
  const [downloading, setDownloading] = useState(false);
  const [downloadingFix, setDownloadingFix] = useState(false);

  const downloadCrashFix = async () => {
    setDownloadingFix(true);
    try {
      const res = await fetch("/api/stability-fix-script");
      if (!res.ok) throw new Error("Failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "OptiGods-CrashFix-by-leaq.ps1";
      a.click();
      URL.revokeObjectURL(url);
      toast({
        title: "Crash Fix Downloaded",
        description: "Double-click the file — it will request admin automatically. Restart your PC when done.",
      });
    } catch {
      toast({ title: "Download failed", description: "Try again.", variant: "destructive" });
    } finally {
      setDownloadingFix(false);
    }
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectAll = () => setSelected(new Set(CATEGORIES.map((c) => c.id)));
  const selectNone = () => setSelected(new Set());

  const downloadRestore = async (cats: string[]) => {
    setDownloading(true);
    try {
      const res = await fetch("/api/generate-restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories: cats }),
      });
      if (!res.ok) throw new Error("Failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "OptiGods-RESTORE-by-leaq.ps1";
      a.click();
      URL.revokeObjectURL(url);
      toast({
        title: "Restore Script Downloaded",
        description: `Right-click the .ps1 file → "Run with PowerShell" → click Yes → restart your PC.`,
      });
    } catch {
      toast({ title: "Download failed", description: "Try again.", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const selectedList = Array.from(selected);

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl pb-10">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-8"
        >
          <div className="p-3 bg-zinc-900 rounded-lg border border-white/5">
            <RotateCcw className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">Fixes & Restore</h1>
            <p className="text-zinc-500 text-sm">Undo any tweak Opti Gods applied — download a restore script and run it as Administrator</p>
          </div>
        </motion.div>

        {/* ── EMERGENCY CRASH FIX BANNER ─────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.02 }}
          className="rounded-2xl border-2 border-red-500/40 bg-red-950/30 overflow-hidden"
        >
          {/* Top label strip */}
          <div className="flex items-center gap-2 px-4 py-2 bg-red-600/20 border-b border-red-500/30">
            <Siren className="w-3.5 h-3.5 text-red-400 animate-pulse shrink-0" />
            <span className="text-[10px] font-black uppercase tracking-widest text-red-400">
              Known Issue — FiveM &amp; Discord Crashing
            </span>
          </div>

          <div className="px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1 min-w-0 space-y-2">
              <p className="text-sm font-bold text-white leading-snug">
                Two optimizer settings were causing crashes. Run this fix.
              </p>
              <div className="space-y-1">
                <div className="flex items-start gap-2">
                  <CheckCheck className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-zinc-300 leading-snug">
                    <span className="text-white font-semibold">SystemResponsiveness was set to 0</span> — starved Discord's audio threads, causing it to randomly close during gameplay.
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCheck className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-zinc-300 leading-snug">
                    <span className="text-white font-semibold">Win32PrioritySeparation was set to 38</span> — put Windows in server scheduling mode, reducing game thread priority and causing FiveM instability.
                  </p>
                </div>
              </div>
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                Both values are corrected in the optimizer going forward. Run this script once to fix your current PC — it takes 5 seconds.
              </p>
            </div>

            <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0">
              <Button
                data-testid="button-download-crash-fix"
                onClick={downloadCrashFix}
                disabled={downloadingFix}
                className="bg-red-600 hover:bg-red-500 text-white font-black text-sm px-5 py-2.5 border border-red-400/30 shadow-[0_0_24px_-4px_rgba(220,38,38,0.5)] whitespace-nowrap"
              >
                <Download className="w-4 h-4 mr-2" />
                {downloadingFix ? "Generating..." : "Download Crash Fix"}
              </Button>
              <p className="text-[9px] text-zinc-600 text-center">
                Double-click → allow UAC prompt → restart PC
              </p>
            </div>
          </div>
        </motion.div>

        {/* Warning banner */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="flex items-start gap-3 px-4 py-4 rounded-xl border border-amber-500/25 bg-amber-500/5"
        >
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-amber-300">Before you restore</p>
            <p className="text-xs text-zinc-400 leading-relaxed">
              These scripts undo the registry and system changes made by Opti Gods. They do <span className="text-white font-medium">not</span> reinstall apps removed by the Debloat tab — those require a Windows feature repair or reinstall from the Store.
              Always create a <span className="text-white font-medium">System Restore Point</span> before running any script.
            </p>
          </div>
        </motion.div>

        {/* Remove ALL button */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-6 rounded-2xl border border-red-500/20 bg-black/60"
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-red-500" />
                <h2 className="text-base font-bold text-white">Remove ALL Applied Tweaks</h2>
              </div>
              <p className="text-xs text-zinc-500 max-w-lg">
                Downloads a single PowerShell script that reverses every optimization category —
                CPU, network, memory, power, services, NVIDIA, AMD, process priorities, and FiveM.
                Right-click and run with PowerShell, then restart your PC.
              </p>
            </div>
            <Button
              data-testid="button-download-restore-all"
              onClick={() => downloadRestore(CATEGORIES.map((c) => c.id))}
              disabled={downloading}
              className="bg-red-600 hover:bg-red-700 text-white border border-red-500/40 shadow-[0_0_20px_-4px_rgba(220,38,38,0.4)] font-bold px-6 py-2.5 text-sm tracking-wide shrink-0"
            >
              <Download className="w-4 h-4 mr-2" />
              {downloading ? "Generating..." : "Download FULL Restore Script"}
            </Button>
          </div>
        </motion.div>

        {/* Selective restore */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between px-1">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300">Selective Restore</h2>
              <p className="text-xs text-zinc-600 mt-0.5">Choose only the categories you want to undo, then download a targeted script.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={selectAll}
                data-testid="button-select-all-restore"
                className="text-[11px] text-zinc-500 hover:text-zinc-200 transition-colors px-2 py-1 rounded border border-white/5 hover:border-white/10"
              >
                All
              </button>
              <button
                onClick={selectNone}
                data-testid="button-select-none-restore"
                className="text-[11px] text-zinc-500 hover:text-zinc-200 transition-colors px-2 py-1 rounded border border-white/5 hover:border-white/10"
              >
                None
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {CATEGORIES.map((cat) => (
              <CategoryCard
                key={cat.id}
                cat={cat}
                selected={selected.has(cat.id)}
                onToggle={() => toggle(cat.id)}
              />
            ))}
          </div>

          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-zinc-600">
              <span className="text-zinc-300 font-semibold">{selectedList.length}</span> of {CATEGORIES.length} categories selected
            </p>
            <Button
              data-testid="button-download-restore-selected"
              onClick={() => downloadRestore(selectedList)}
              disabled={selectedList.length === 0 || downloading}
              variant="outline"
              className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-500/50 font-bold text-sm"
            >
              <Download className="w-4 h-4 mr-2" />
              Download Selected ({selectedList.length})
            </Button>
          </div>
        </motion.div>

        {/* How to run */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-5 rounded-xl border border-white/5 bg-black/40 space-y-3"
        >
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">How to run the restore script</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { step: "1", text: "Download the restore script above" },
              { step: "2", text: "Double-click the .bat file → click Yes on the admin popup" },
              { step: "3", text: "Restart your PC — all changes take effect on reboot" },
            ].map((s) => (
              <div key={s.step} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900/60 border border-white/5">
                <span className="w-6 h-6 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[11px] font-bold flex items-center justify-center shrink-0">
                  {s.step}
                </span>
                <p className="text-xs text-zinc-400">{s.text}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-zinc-600">
            If PowerShell blocks the script: open PowerShell as Administrator → type{" "}
            <code className="font-mono text-zinc-400">Set-ExecutionPolicy RemoteSigned</code> → press Y → then run the script again.
          </p>
        </motion.div>

        {/* Debloat note */}
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-zinc-800 bg-zinc-900/50">
          <AlertTriangle className="w-4 h-4 text-zinc-600 shrink-0 mt-0.5" />
          <p className="text-xs text-zinc-500 leading-relaxed">
            <span className="text-zinc-300 font-semibold">Debloat note:</span>{" "}
            Apps removed by the Debloat tab (OneDrive, Xbox, Cortana, etc.) cannot be restored by a script.
            To restore them, open the Microsoft Store and reinstall them individually, or use{" "}
            <code className="font-mono text-zinc-400">Get-AppxPackage -AllUsers | Add-AppxPackage</code> in PowerShell.
          </p>
        </div>

      </div>
    </AppLayout>
  );
}
