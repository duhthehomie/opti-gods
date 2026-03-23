import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import {
  ShieldAlert, Zap, Cpu, HardDrive, Monitor, Save, Trash2,
  FolderOpen, Plus, CheckCircle2, Download, Terminal, RotateCcw, ChevronRight,
  MemoryStick, Wifi, Settings2, Gamepad2, Crosshair, Power, Search, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { useToast } from "@/hooks/use-toast";
import { useOsDetection } from "@/hooks/use-os-detection";
import { useHardwareInfo } from "@/hooks/use-hardware-info";
import { cn } from "@/lib/utils";
import { getProStatus } from "@/lib/pro-status";
import { ProUnlockButton } from "@/components/pro-gate";

// Feature categories
const FEATURES = [
  { icon: Settings2, title: "Registry Tweaks", desc: "Deep Windows registry optimizations for latency and responsiveness" },
  { icon: Wifi, title: "Network Stack", desc: "TCP/IP tuning, nagle disable, DNS and connection optimizations" },
  { icon: Monitor, title: "GPU / NVIDIA", desc: "HAGS, MSI interrupt mode, driver tweaks, and shader cache control" },
  { icon: MemoryStick, title: "Memory Optimizer", desc: "RAM priority pinning, pagefile control, and heap management" },
  { icon: Power, title: "Power Plan", desc: "Processor performance states, C-states, and idle inhibit" },
  { icon: Gamepad2, title: "FiveM Optimizer", desc: "GTA V and FiveM-specific process tweaks for max FPS" },
  { icon: Crosshair, title: "Fortnite Pack", desc: "Epic Games launcher, Fortnite CPU affinity and priority tweaks" },
  { icon: Search, title: "Game Detection", desc: "Auto-detect 14 games and apply per-game optimization packs" },
  { icon: Trash2, title: "Win10/11 Debloat", desc: "Remove bloatware, telemetry, and unnecessary background services" },
];

// How to use steps
const HOW_TO_STEPS = [
  {
    icon: Terminal,
    title: "Browse & Toggle",
    desc: "Open any tab in the sidebar (Registry, FiveM, Fortnite, etc.) and flip the toggles for every optimization you want. Red = will be applied.",
  },
  {
    icon: Download,
    title: "Download Your Script",
    desc: "Click DOWNLOAD .PS1 in the top bar. This generates a personalized PowerShell script containing only the tweaks you enabled — nothing else.",
  },
  {
    icon: ShieldAlert,
    title: "Run as Administrator",
    desc: "Open your Downloads folder, right-click OptiGods-by-leaq.ps1, and choose Run with PowerShell. Click Yes on the Administrator prompt.",
  },
  {
    icon: RotateCcw,
    title: "Restart & Done",
    desc: "After the script finishes, restart your PC. All changes take effect on the next boot. Create a Windows Restore Point first as a precaution.",
  },
];

// Pro pricing bullet points
const PRO_BULLETS = [
  "130+ registry, network, memory, and GPU tweaks",
  "FiveM, Fortnite, CS2, Valorant, and Apex packs",
  "Download your personalized .PS1 script",
  "Game auto-detection for 14 titles",
  "Preset save/load for quick re-apply",
  "Lifetime access — pay once, no subscription",
];

export default function Dashboard() {
  const osInfo = useOsDetection();
  const hw = useHardwareInfo();
  const isPro = getProStatus();
  const { tweaks, nvidiaPreset, setAllTweaks } = useOptimizationStore();
  const { data: savedPresets = [] } = useQuery<any[]>({
    queryKey: [api.presets.list.path],
  });
  const qc = useQueryClient();
  const { toast } = useToast();
  const [presetName, setPresetName] = useState("");
  const [saving, setSaving] = useState(false);

  const createPreset = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch(api.presets.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, config: { tweaks, nvidiaPreset }, isDefault: false }),
      });
      if (!res.ok) throw new Error("Failed to save preset");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [api.presets.list.path] });
      setPresetName("");
      setSaving(false);
      toast({ title: "Preset saved!", description: `"${presetName}" has been saved.` });
    },
    onError: () => toast({ title: "Error", description: "Could not save preset.", variant: "destructive" }),
  });

  const deletePreset = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/presets/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [api.presets.list.path] });
      toast({ title: "Preset deleted" });
    },
  });

  const loadPreset = (preset: any) => {
    setAllTweaks({ ...tweaks, ...preset.config.tweaks });
    toast({ title: `Loaded: ${preset.name}`, description: "Tweak states have been applied." });
  };

  const enabledCount = Object.values(tweaks).filter(Boolean).length;
  const totalTweaks = Object.keys(tweaks).length;
  const optLevel = enabledCount === 0 ? "None" : enabledCount < 10 ? "Low" : enabledCount < 25 ? "Medium" : "High";
  const optColor = enabledCount === 0 ? "text-zinc-500" : enabledCount < 10 ? "text-zinc-300" : enabledCount < 25 ? "text-zinc-100" : "text-red-400";

  return (
    <AppLayout>
      <div className="space-y-8 pb-10">

        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative rounded-2xl overflow-hidden bg-black/60 border border-white/5 border-l-4 border-l-red-500 p-8 md:p-12"
        >
          <div className="absolute right-0 top-0 w-2/3 h-full bg-gradient-to-l from-red-500/8 to-transparent pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />

          <div className="relative z-10 max-w-2xl">
            {/* OS badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono mb-6">
              <span className={cn("w-2 h-2 rounded-full bg-red-500", osInfo.loading ? "animate-pulse" : "")} />
              {osInfo.loading ? "DETECTING SYSTEM..." : `SYSTEM DETECTED — ${osInfo.displayName}`}
            </div>

            <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-3 leading-none tracking-tight">
              OPTI GODS <span className="text-red-500">by leaq</span>
            </h1>
            <p className="text-base md:text-lg text-zinc-400 mb-8 leading-relaxed font-medium">
              130+ tweaks. One script. Zero compromise.
            </p>

            <div className="flex flex-wrap gap-3">
              {isPro ? (
                <div
                  data-testid="badge-pro-active"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-bold"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Pro Access Active — All Features Unlocked
                </div>
              ) : (
                <ProUnlockButton>
                  <Button
                    data-testid="button-hero-unlock-pro"
                    className="bg-red-600 hover:bg-red-700 text-white border border-red-500/40 shadow-[0_0_20px_-4px_rgba(220,38,38,0.5)] font-display font-bold px-7 py-2.5 text-sm tracking-wide transition-all"
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    Unlock Pro — $9.99 Lifetime
                  </Button>
                </ProUnlockButton>
              )}

              <Button
                data-testid="button-restore-point"
                variant="outline"
                className="border-white/10 hover:bg-white/5 hover:text-white text-zinc-400 font-medium text-sm"
              >
                <ShieldAlert className="w-4 h-4 mr-2" />
                Create Restore Point First
              </Button>
            </div>
          </div>
        </motion.div>


        
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <div className="flex items-center gap-2 mb-4 px-1">
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">What's Included</span>
            <div className="flex-1 h-px bg-white/5" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {FEATURES.map((feat, i) => (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.18 + i * 0.04 }}
                className="flex items-start gap-3 p-4 rounded-xl bg-black/40 border border-white/5 hover:border-red-500/15 hover:bg-red-500/3 transition-all group"
              >
                <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 shrink-0 group-hover:bg-red-500/15 transition-colors">
                  <feat.icon className="w-4 h-4 text-red-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">{feat.title}</h3>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">{feat.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
          {/* Pricing card */}
          <div className="lg:col-span-2 relative rounded-2xl bg-black/60 border border-red-500/20 overflow-hidden p-7">
            <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-red-500/5 to-transparent pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <div className="inline-block text-[10px] font-bold uppercase tracking-widest bg-red-600 text-white px-2 py-0.5 rounded-sm mb-3">
                    One-Time Lifetime Access
                  </div>
                  <h2 className="text-3xl font-display font-bold text-white leading-none">$9.99</h2>
                  <p className="text-sm text-zinc-400 mt-1">No subscription. No expiry.</p>
                </div>
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                  <Zap className="w-6 h-6 text-red-500" />
                </div>
              </div>

              <div className="space-y-2 mb-7">
                {PRO_BULLETS.map((item, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    <span className="text-sm text-zinc-300">{item}</span>
                  </div>
                ))}
              </div>

              {isPro ? (
                <div
                  data-testid="badge-pricing-pro-active"
                  className="inline-flex items-center gap-2 w-full justify-center px-5 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 font-bold text-sm"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Pro Access Active
                </div>
              ) : (
                <ProUnlockButton className="w-full">
                  <Button
                    data-testid="button-pricing-unlock-pro"
                    className="w-full bg-red-600 hover:bg-red-700 text-white border border-red-500/40 shadow-[0_0_20px_-4px_rgba(220,38,38,0.4)] font-display font-bold py-3 text-sm tracking-wide transition-all"
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    Unlock Pro — $9.99
                  </Button>
                </ProUnlockButton>
              )}
            </div>
          </div>

          {/* Tweaks counter */}
          <div className="flex flex-col gap-3">
            {[
              {
                label: "Tweaks Enabled",
                value: String(enabledCount),
                sub: `of ${totalTweaks} available`,
                color: optColor,
              },
              {
                label: "Optimization Level",
                value: optLevel,
                sub: enabledCount === 0 ? "Enable tweaks to begin" : `${enabledCount} active`,
                color: optColor,
              },
              {
                label: "Resolution",
                value: hw.loading ? "..." : hw.resolution || "Unknown",
                sub: "detected",
                color: "text-white",
              },
              {
                label: "GPU Vendor",
                value: hw.loading ? "..." : hw.isNvidia ? "NVIDIA" : hw.isAMD ? "AMD" : hw.isIntel ? "Intel" : "Unknown",
                sub: hw.isNvidia ? "HAGS + MSI Mode available" : hw.isAMD ? "HAGS (RX 6000+)" : "Check GPU settings",
                color: "text-white",
              },
            ].map((c, i) => (
              <div key={c.label} className="flex-1 p-4 rounded-xl bg-black/40 border border-white/5">
                <p className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1.5">{c.label}</p>
                <p className={cn("text-xl font-bold font-display", c.color)}>{c.value}</p>
                <p className="text-[10px] text-zinc-600 mt-1">{c.sub}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* System Status Bar */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          className="flex items-center divide-x divide-white/5 rounded-xl bg-black/40 border border-white/5 overflow-hidden"
        >
          {[
            { label: "OS", value: osInfo.loading ? "Detecting…" : osInfo.os, icon: <HardDrive className="w-3.5 h-3.5 text-zinc-500" />, testid: "card-stat-0" },
            { label: "CPU", value: hw.loading ? "…" : hw.cpuCores > 0 ? `${hw.cpuCores} Threads` : "Unknown", icon: <Cpu className="w-3.5 h-3.5 text-red-500" />, testid: "card-stat-1" },
            { label: "RAM", value: hw.loading ? "…" : hw.ramGB > 0 ? `~${hw.ramGB} GB` : "Unknown", icon: <MemoryStick className="w-3.5 h-3.5 text-zinc-500" />, testid: "card-stat-2" },
            { label: "GPU", value: hw.loading ? "…" : hw.gpuName.length > 24 ? hw.gpuName.slice(0, 24) + "…" : hw.gpuName || "Unknown", icon: <Monitor className="w-3.5 h-3.5 text-zinc-500" />, testid: "card-stat-3" },
          ].map((stat) => (
            <div key={stat.label} data-testid={stat.testid} className="flex-1 flex items-center gap-2 px-4 py-3 min-w-0">
              {stat.icon}
              <span className="text-[10px] text-zinc-600 uppercase tracking-wider shrink-0">{stat.label}</span>
              <span className="text-xs font-semibold text-zinc-200 truncate" title={stat.value}>{stat.value}</span>
            </div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="p-6 rounded-2xl bg-black/40 border border-red-500/15"
        >
          <div className="flex items-center gap-2 mb-6">
            <Zap className="w-4 h-4 text-red-500" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-200">How to Use Opti Gods</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {HOW_TO_STEPS.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.07 }}
                className="relative p-4 rounded-xl bg-red-500/5 border border-red-500/10 hover:border-red-500/20 transition-colors"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-7 h-7 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center shrink-0">
                    <span className="text-[11px] font-bold text-red-400">{i + 1}</span>
                  </div>
                  <step.icon className="w-4 h-4 text-red-400" />
                </div>
                <h3 className="text-sm font-bold text-white mb-2">{step.title}</h3>
                <p className="text-xs text-zinc-500 leading-relaxed">{step.desc}</p>
                {i < HOW_TO_STEPS.length - 1 && (
                  <ChevronRight className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-700 z-10" />
                )}
              </motion.div>
            ))}
          </div>
          <div className="mt-5 p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-zinc-400 leading-relaxed">
              <span className="text-white font-medium">Pro tip:</span> Save your configuration as a Preset (below) before applying — you can reload it anytime.
              All tweaks start <span className="text-white font-medium">OFF</span> for every new visitor — nothing is applied until you download and run the script.
            </p>
          </div>
        </motion.div>

        
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="p-6 rounded-2xl bg-black/40 border border-white/5"
        >
          <div className="flex items-center gap-2 mb-6">
            <FolderOpen className="w-4 h-4 text-red-500" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300">Preset Management</h2>
            <span className="ml-auto text-xs text-zinc-600">{savedPresets.length} saved</span>
          </div>

          <div className="flex gap-3 mb-6">
            <AnimatePresence>
              {saving && (
                <motion.input
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: "100%", opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  data-testid="input-preset-name"
                  type="text"
                  placeholder="Preset name (e.g. FiveM Night Session)..."
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && presetName.trim()) createPreset.mutate(presetName.trim()); }}
                  className="flex-1 bg-zinc-900 border border-white/10 rounded-lg px-4 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-500/50"
                  autoFocus
                />
              )}
            </AnimatePresence>
            {saving ? (
              <div className="flex gap-2 shrink-0">
                <Button
                  data-testid="button-save-confirm"
                  size="sm"
                  disabled={!presetName.trim() || createPreset.isPending}
                  onClick={() => createPreset.mutate(presetName.trim())}
                  className="bg-red-600 hover:bg-red-700 text-white border border-red-500/30"
                >
                  <Save className="w-3 h-3 mr-1" />
                  Save
                </Button>
                <Button
                  data-testid="button-save-cancel"
                  size="sm"
                  variant="ghost"
                  onClick={() => { setSaving(false); setPresetName(""); }}
                  className="text-zinc-400 hover:text-white"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                data-testid="button-new-preset"
                onClick={() => setSaving(true)}
                variant="outline"
                size="sm"
                className="border-white/10 hover:bg-white/5 text-zinc-300 hover:text-white gap-2"
              >
                <Plus className="w-3 h-3" />
                Save Current Config as Preset
              </Button>
            )}
          </div>

          {savedPresets.length === 0 ? (
            <div className="text-center py-8 text-zinc-600 text-sm border border-dashed border-zinc-800 rounded-xl">
              No presets saved yet. Configure your tweaks across the tabs, then save here for quick reload.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {savedPresets.map((preset: any) => (
                <motion.div
                  key={preset.id}
                  data-testid={`card-preset-${preset.id}`}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-colors group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-medium text-white text-sm truncate">{preset.name}</h3>
                    <button
                      data-testid={`button-delete-preset-${preset.id}`}
                      onClick={() => deletePreset.mutate(preset.id)}
                      className="text-zinc-700 hover:text-red-500 transition-colors ml-2 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-zinc-600 mb-3">
                    {Object.values(preset.config?.tweaks || {}).filter(Boolean).length} tweaks enabled
                  </p>
                  <Button
                    data-testid={`button-load-preset-${preset.id}`}
                    size="sm"
                    onClick={() => loadPreset(preset)}
                    className="w-full bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/20 text-xs"
                  >
                    Load Preset
                  </Button>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </AppLayout>
  );
}
