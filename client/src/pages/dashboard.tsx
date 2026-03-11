import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { ShieldAlert, Zap, Cpu, HardDrive, Activity, Save, Trash2, FolderOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

function GaugeBar({ label, value, color = "red" }: { label: string; value: number; color?: string }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">{label}</span>
        <span className={cn("text-sm font-mono font-bold", color === "red" ? "text-red-400" : color === "orange" ? "text-orange-400" : "text-blue-400")}>
          {value}%
        </span>
      </div>
      <div className="h-2 bg-zinc-900 rounded-full overflow-hidden border border-white/5">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className={cn(
            "h-full rounded-full",
            value > 80 ? "bg-red-500" : value > 50 ? "bg-orange-500" : color === "red" ? "bg-red-600" : color === "orange" ? "bg-orange-600" : "bg-blue-600"
          )}
          style={{ boxShadow: value > 40 ? `0 0 8px ${value > 80 ? "#ef4444" : "#f97316"}` : undefined }}
        />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery<{ cpu: number; gpu: number; memory: number; os: string; processCount: number; highImpactCount: number }>({
    queryKey: [api.system.stats.path],
    refetchInterval: 3000,
  });

  const { tweaks, nvidiaPreset, setAllTweaks } = useOptimizationStore();
  const { data: savedPresets = [], refetch: refetchPresets } = useQuery<any[]>({
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
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              SYSTEM DETECTED — {stats?.os || "Windows 10 Pro (22H2)"}
            </div>
            <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-4 leading-tight">
              OPTI GODS <span className="text-red-500">by leaq</span>
            </h1>
            <p className="text-lg text-zinc-400 mb-8 leading-relaxed">
              Deep registry surgery, process priority pinning, bloatware removal, and one-click PowerShell deployment. Built for Windows 10 competitive gaming.
            </p>
            <div className="flex gap-4">
              <Button
                data-testid="button-restore-point"
                variant="outline"
                className="border-white/10 hover:bg-white/5 hover:text-white text-zinc-300 font-medium"
              >
                <ShieldAlert className="w-4 h-4 mr-2" />
                Create Restore Point
              </Button>
            </div>
          </div>
        </motion.div>

        {/* System Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { title: "Operating System", value: stats?.os || "Windows 10 Pro", sub: "Build 19045.4170", icon: <HardDrive className="w-5 h-5 text-zinc-400" /> },
            { title: "Active Processes", value: String(stats?.processCount || 84), sub: `${stats?.highImpactCount || 12} High Impact`, icon: <Cpu className="w-5 h-5 text-red-400" /> },
            { title: "Tweaks Enabled", value: String(enabledCount), sub: "of 50+ available", icon: <Zap className="w-5 h-5 text-yellow-500" /> },
            { title: "Optimization Level", value: enabledCount > 20 ? "High" : enabledCount > 10 ? "Medium" : "Low", sub: enabledCount > 20 ? "Well tuned" : "Tweaks required", icon: <Activity className="w-5 h-5 text-green-400" /> },
          ].map((card, i) => (
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
              <h3 className="text-xl font-bold text-white font-display truncate">{card.value}</h3>
              <p className="text-xs text-zinc-600 mt-1">{card.sub}</p>
            </motion.div>
          ))}
        </div>

        {/* Real-Time Gauges */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-6 rounded-2xl bg-black/40 border border-white/5"
        >
          <div className="flex items-center gap-2 mb-6">
            <Activity className="w-4 h-4 text-red-500" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300">Real-Time Usage</h2>
            <span className="ml-auto text-[10px] font-mono text-zinc-600 bg-zinc-900 px-2 py-0.5 rounded-full border border-white/5">
              LIVE · 3s refresh
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <GaugeBar label="CPU" value={isLoading ? 0 : (stats?.cpu ?? 0)} color="red" />
            <GaugeBar label="GPU" value={isLoading ? 0 : (stats?.gpu ?? 0)} color="orange" />
            <GaugeBar label="RAM" value={isLoading ? 0 : (stats?.memory ?? 0)} color="blue" />
          </div>
        </motion.div>

        {/* Preset Management */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="p-6 rounded-2xl bg-black/40 border border-white/5"
        >
          <div className="flex items-center gap-2 mb-6">
            <FolderOpen className="w-4 h-4 text-red-500" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300">Preset Management</h2>
            <span className="ml-auto text-xs text-zinc-600">{savedPresets.length} saved</span>
          </div>

          {/* Save New Preset */}
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

          {/* Preset List */}
          {savedPresets.length === 0 ? (
            <div className="text-center py-8 text-zinc-600 text-sm border border-dashed border-zinc-800 rounded-xl">
              No presets saved yet. Configure your tweaks and save a preset above.
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
