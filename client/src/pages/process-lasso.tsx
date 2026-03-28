import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { TweakRow } from "@/components/tweak-row";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { Cpu, Pin, XCircle, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const PROCESSES = [
  { name: "FiveM.exe", cpu: "12.4", priority: "High", pinned: true, color: "red" },
  { name: "GTA5.exe", cpu: "18.7", priority: "High", pinned: true, color: "red" },
  { name: "Discord.exe", cpu: "3.2", priority: "Normal", pinned: false, color: "zinc" },
  { name: "chrome.exe", cpu: "9.1", priority: "Normal", pinned: false, color: "zinc" },
  { name: "SearchIndexer.exe", cpu: "4.4", priority: "Low", pinned: false, color: "zinc" },
  { name: "SysMain", cpu: "2.1", priority: "Normal", pinned: false, color: "zinc" },
  { name: "WmiPrvSE.exe", cpu: "1.8", priority: "Low", pinned: false, color: "zinc" },
  { name: "OneDrive.exe", cpu: "2.3", priority: "Normal", pinned: false, color: "zinc" },
  { name: "MsMpEng.exe (Defender)", cpu: "5.6", priority: "Normal", pinned: false, color: "zinc" },
  { name: "RuntimeBroker.exe", cpu: "0.9", priority: "Normal", pinned: false, color: "zinc" },
];

const PRIORITY_OPTIONS = ["Realtime", "High", "AboveNormal", "Normal", "BelowNormal", "Low"] as const;

export default function ProcessLasso() {
  const { tweaks, setTweak } = useOptimizationStore();
  const { toast } = useToast();
  const [processList, setProcessList] = useState(PROCESSES);
  const [showAll, setShowAll] = useState(false);

  const visible = showAll ? processList : processList.slice(0, 6);

  const handlePin = (name: string) => {
    setProcessList(prev => prev.map(p => p.name === name ? { ...p, pinned: !p.pinned, color: !p.pinned ? "red" : "zinc" } : p));
    toast({ title: `Priority pinned`, description: `${name} will always run at High priority.` });
  };

  const handleSetPriority = (name: string, priority: string) => {
    setProcessList(prev => prev.map(p => p.name === name ? { ...p, priority } : p));
  };

  const handleKill = () => {
    toast({ title: "Script queued", description: "Non-essential background tasks will be killed on next Apply." });
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl pb-10">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-8"
        >
          <div className="p-3 bg-zinc-900 rounded-lg border border-white/5">
            <Cpu className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">Process Lasso Config</h1>
            <p className="text-zinc-500 text-sm">CPU affinity, priority pinning, and process management</p>
          </div>
        </motion.div>

        <div className="space-y-8">
          <section>
            <div className="flex items-center justify-between mb-4 px-1">
              <h2 className="text-sm font-bold uppercase tracking-wider text-red-500">Active Processes</h2>
              <span className="text-xs text-zinc-500 font-mono">{processList.filter(p => p.pinned).length} PINNED</span>
            </div>
            <div className="space-y-2">
              <AnimatePresence>
                {visible.map((proc, i) => (
                  <motion.div
                    key={proc.name}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ delay: i * 0.04 }}
                    data-testid={`row-process-${i}`}
                    className={cn(
                      "p-4 rounded-xl bg-black/40 border flex items-center gap-4 transition-all duration-200",
                      proc.pinned ? "border-l-2 border-l-red-500 border-white/10" : "border-white/5 hover:border-white/10"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-white font-medium text-sm truncate">{proc.name}</h3>
                        {proc.pinned && (
                          <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                            PINNED
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={cn("text-xs font-mono", proc.cpu > "8" ? "text-red-400" : "text-zinc-500")}>
                          {proc.cpu}% CPU
                        </span>
                        <select
                          data-testid={`select-priority-${i}`}
                          value={proc.priority}
                          onChange={(e) => handleSetPriority(proc.name, e.target.value)}
                          className="text-xs bg-zinc-900 border border-white/10 rounded px-2 py-0.5 text-zinc-300 focus:outline-none focus:border-red-500/50 cursor-pointer"
                        >
                          {PRIORITY_OPTIONS.map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        data-testid={`button-pin-${i}`}
                        size="icon"
                        variant="ghost"
                        onClick={() => handlePin(proc.name)}
                        className={cn(
                          "h-8 w-8 rounded-lg transition-all",
                          proc.pinned
                            ? "text-red-500 bg-red-500/10 hover:bg-red-500/20"
                            : "text-zinc-600 hover:text-red-400 hover:bg-red-500/10"
                        )}
                        title={proc.pinned ? "Unpin priority" : "Pin to High priority"}
                      >
                        <Pin className="w-4 h-4" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <div className="flex gap-3 mt-4">
              <Button
                data-testid="button-show-more"
                variant="ghost"
                size="sm"
                onClick={() => setShowAll(!showAll)}
                className="text-zinc-400 hover:text-white hover:bg-white/5 text-xs gap-2"
              >
                {showAll ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {showAll ? "Show Less" : `Show All ${processList.length} Processes`}
              </Button>
              <Button
                data-testid="button-kill-nonessential"
                onClick={handleKill}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold border border-red-500/30 gap-2"
              >
                <XCircle className="w-4 h-4" />
                Kill Non-Essential Background Tasks
              </Button>
            </div>
          </section>

          {(() => {
            const probalanceTweaks = [
              { id: "ProcessLassoProBalance", title: "Enable ProBalance (CPU Throttling)", desc: "Automatically lowers the priority of processes that hog CPU while the foreground app is running.", impact: "HIGH" as const, recommended: true },
              { id: "ProcessLassoSmartTrim", title: "Enable SmartTrim (RAM)", desc: "Trims working set of background processes to free physical memory for your game.", impact: "HIGH" as const, recommended: true },
              { id: "ProcessLassoRestrain", title: "Restrain Background Apps After 5s Idle", desc: "Drops background process CPU priority 5 seconds after they stop receiving input.", impact: "MED" as const, recommended: true },
              { id: "ProcessLassoAffinityGaming", title: "Auto-Affinity: Gaming Mode", desc: "Moves background tasks to a subset of cores so your game gets dedicated CPU access.", impact: "HIGH" as const, recommended: true },
              { id: "ProcessLassoInstanceBalancer", title: "CPU Scheduler: Short Quantum + Max Foreground Boost (Win32PrioritySeparation=26)", desc: "Sets Win32PrioritySeparation=26 — short time quanta, variable mode, maximum foreground boost. This is the gaming-optimal Windows scheduler mode. (Previous value 38 was a server scheduling mode that reduced foreground priority — fixed.)", impact: "MED" as const },
            ];
            const recIds = probalanceTweaks.filter(t => t.recommended).map(t => t.id);
            const allOn = recIds.length > 0 && recIds.every(id => tweaks[id]);
            return (
              <section>
                <div className="flex items-center gap-2 mb-4 px-1">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-red-500">ProBalance Rules</h2>
                  <div className="flex-1 h-px bg-white/5 ml-2" />
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => recIds.forEach(id => setTweak(id, true))}
                    disabled={allOn}
                    data-testid="button-enable-recommended-probalance"
                    className="text-[10px] font-bold uppercase tracking-wider text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40 px-2.5 py-1 h-auto rounded-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    {allOn ? "Recommended ON" : `Enable Recommended (${recIds.length})`}
                  </Button>
                </div>
                <div className="space-y-3">
                  {probalanceTweaks.map((item, i) => (
                    <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                      impact={item.impact} badge={item.recommended ? "RECOMMENDED" : undefined}
                      checked={tweaks[item.id] || false} onCheckedChange={(v) => setTweak(item.id, v)} delay={i + 1} />
                  ))}
                </div>
              </section>
            );
          })()}

          {(() => {
            const memTweaks = [
              { id: "ProcessTrimWorkingSet", title: "Trim Working Set on Minimize", desc: "Reduces a process's RAM footprint when it is minimized — frees memory for active apps.", impact: "MED" as const, recommended: true },
              { id: "ProcessDisableWindowsErrorReporting", title: "Disable Windows Error Reporting", desc: "Stops WER from freezing a crashed process for minutes while collecting a dump.", impact: "LOW" as const },
              { id: "ProcessAutoKillHung", title: "Auto-Kill Hung Processes (15s)", desc: "Automatically terminates unresponsive processes after 15 seconds instead of waiting.", impact: "MED" as const, recommended: true },
            ];
            const recIds = memTweaks.filter(t => t.recommended).map(t => t.id);
            const allOn = recIds.length > 0 && recIds.every(id => tweaks[id]);
            return (
              <section>
                <div className="flex items-center gap-2 mb-4 px-1">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-red-500">Memory Optimization</h2>
                  <div className="flex-1 h-px bg-white/5 ml-2" />
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => recIds.forEach(id => setTweak(id, true))}
                    disabled={allOn}
                    data-testid="button-enable-recommended-mem-opt"
                    className="text-[10px] font-bold uppercase tracking-wider text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40 px-2.5 py-1 h-auto rounded-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    {allOn ? "Recommended ON" : `Enable Recommended (${recIds.length})`}
                  </Button>
                </div>
                <div className="space-y-3">
                  {memTweaks.map((item, i) => (
                    <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                      impact={item.impact} badge={item.recommended ? "RECOMMENDED" : undefined}
                      checked={tweaks[item.id] || false} onCheckedChange={(v) => setTweak(item.id, v)} delay={i + 1} />
                  ))}
                </div>
              </section>
            );
          })()}
        </div>
      </div>
    </AppLayout>
  );
}
