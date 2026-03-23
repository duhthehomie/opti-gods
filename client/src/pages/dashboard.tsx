import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import {
  ShieldAlert, Zap, Cpu, HardDrive, Monitor, Save, Trash2,
  FolderOpen, Plus, CheckCircle2, Download, Terminal, RotateCcw, ChevronRight,
  MemoryStick, Wifi
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { useToast } from "@/hooks/use-toast";
import { useOsDetection } from "@/hooks/use-os-detection";
import { useHardwareInfo } from "@/hooks/use-hardware-info";
import { cn } from "@/lib/utils";

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

export default function Dashboard() {
  const osInfo = useOsDetection();
  const hw = useHardwareInfo();
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
  const optColor = enabledCount === 0 ? "text-zinc-500" : enabledCount < 10 ? "text-yellow-400" : enabledCount < 25 ? "text-orange-400" : "text-red-400";

  // Hardware stat cards — all values from real browser APIs
  const hwCards = [
    {
      title: "Operating System",
      value: osInfo.loading ? "Detecting..." : osInfo.os,
      sub: osInfo.build ? `Build ${osInfo.build} · via UA Client Hints` : "via browser detection",
      icon: <HardDrive className="w-5 h-5 text-zinc-400" />,
      accurate: true,
    },
    {
      title: "CPU Threads",
      value: hw.loading ? "Detecting..." : hw.cpuCores > 0 ? `${hw.cpuCores} Threads` : "Unknown",
      sub: hw.cpuCores > 0
        ? `~${Math.max(1, Math.floor(hw.cpuCores / 2))} physical cores estimated`
        : "navigator.hardwareConcurrency",
      icon: <Cpu className="w-5 h-5 text-red-400" />,
      accurate: true,
    },
    {
      title: "System RAM",
      value: hw.loading ? "Detecting..." : hw.ramGB > 0 ? `~${hw.ramGB} GB` : "Unknown",
      sub: hw.ramGB > 0 ? "approximate (browser privacy limit)" : "navigator.deviceMemory",
      icon: <MemoryStick className="w-5 h-5 text-zinc-400" />,
      accurate: true,
    },
    {
      title: "Graphics Card",
      value: hw.loading ? "Detecting..." : hw.gpuName.length > 22 ? hw.gpuName.slice(0, 22) + "…" : hw.gpuName,
      sub: hw.gpuVendor || "via WebGL renderer info",
      icon: <Monitor className="w-5 h-5 text-zinc-400" />,
      accurate: true,
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-8 pb-10">

        {/* Hero Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative rounded-2xl overflow-hidden winui-panel p-8 md:p-12 border-l-4 border-l-red-500"
        >
          <div className="absolute right-0 top-0 w-1/2 h-full bg-gradient-to-l from-red-500/10 to-transparent pointer-events-none" />
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono mb-6">
              <span className={cn("w-2 h-2 rounded-full bg-red-500", osInfo.loading ? "animate-pulse" : "")} />
              {osInfo.loading ? "DETECTING SYSTEM..." : `SYSTEM DETECTED — ${osInfo.displayName}`}
            </div>
            <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-4 leading-tight">
              OPTI GODS <span className="text-red-500">by leaq</span>
            </h1>
            <p className="text-lg text-zinc-400 mb-8 leading-relaxed">
              Deep registry tweaks, process priority pinning, bloatware removal, and one-click PowerShell deployment.
              Optimized for Windows 10 and 11 competitive gaming.
            </p>
            <div className="flex gap-4">
              <Button
                data-testid="button-restore-point"
                variant="outline"
                className="border-white/10 hover:bg-white/5 hover:text-white text-zinc-300 font-medium"
              >
                <ShieldAlert className="w-4 h-4 mr-2" />
                Create Restore Point First
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Hardware Stats — REAL data from browser APIs */}
        <div>
          <div className="flex items-center gap-2 mb-3 px-1">
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Your System</span>
            <div className="flex-1 h-px bg-white/5" />
            <span className="text-[10px] text-zinc-600 font-mono">detected via browser APIs — no server required</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {hwCards.map((card, i) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                data-testid={`card-stat-${i}`}
                className="p-5 rounded-xl bg-black/40 border border-white/5 hover:border-white/10 transition-colors"
              >
                <div className="flex justify-between items-start mb-4">
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">{card.title}</p>
                  {card.icon}
                </div>
                <h3 className="text-base font-bold text-white font-display truncate" title={card.value}>{card.value}</h3>
                <p className="text-[10px] text-zinc-600 mt-1 leading-relaxed">{card.sub}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Tweaks Counter */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Tweaks Enabled", value: String(enabledCount), sub: `of ${totalTweaks} available` },
            { label: "Optimization Level", value: optLevel, sub: enabledCount === 0 ? "Enable tweaks to begin" : `${enabledCount} active`, color: optColor },
            { label: "Screen Resolution", value: hw.loading ? "..." : hw.resolution || "Unknown", sub: "detected" },
            { label: "GPU Vendor", value: hw.loading ? "..." : hw.isNvidia ? "NVIDIA" : hw.isAMD ? "AMD" : hw.isIntel ? "Intel" : "Unknown", sub: hw.isNvidia ? "HAGS + MSI Mode available" : hw.isAMD ? "HAGS available (RX 6000+)" : "Check GPU settings" },
          ].map((c, i) => (
            <motion.div key={c.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.06 }}
              className="p-4 rounded-xl bg-black/40 border border-white/5">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">{c.label}</p>
              <p className={cn("text-xl font-bold font-display", c.color || "text-white")}>{c.value}</p>
              <p className="text-[10px] text-zinc-600 mt-1">{c.sub}</p>
            </motion.div>
          ))}
        </div>

        {/* ── HOW TO USE ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
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
                transition={{ delay: 0.45 + i * 0.07 }}
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
              <span className="text-white font-medium">Pro tip:</span> Save your configuration as a Preset (below) before applying — you can load it again anytime without re-enabling each tweak manually.
              All tweaks start <span className="text-white font-medium">OFF</span> for every new visitor — nothing is applied to your PC until you download and run the script.
            </p>
          </div>
        </motion.div>

        {/* Preset Management */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="p-6 rounded-2xl bg-black/40 border border-white/5"
        >
          <div className="flex items-center gap-2 mb-6">
            <FolderOpen className="w-4 h-4 text-red-500" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300">Preset Management</h2>
            <span className="ml-auto text-xs text-zinc-600">{savedPresets.length} saved</span>
          </div>

          <div className="flex gap-3 mb-6">
            <AnimatePresence>
              {saving ? (
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
              ) : null}
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
