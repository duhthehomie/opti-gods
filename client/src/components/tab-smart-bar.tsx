import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, CheckCircle2, Info, ChevronDown, ChevronUp, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useOptimizationStore } from "@/store/use-optimization-store";

interface TabSmartBarProps {
  tweakIds: string[];
  recommendedIds: string[];
  label: string;
  context?: string;
  tips?: string[];
  impactLabel?: string;
  applyLabel?: string;
}

export function TabSmartBar({
  tweakIds,
  recommendedIds,
  label,
  context,
  tips = [],
  impactLabel,
  applyLabel,
}: TabSmartBarProps) {
  const { tweaks, setTweak } = useOptimizationStore();
  const { toast } = useToast();
  const [showTips, setShowTips] = useState(false);

  const active = tweakIds.filter(id => tweaks[id]).length;
  const total = tweakIds.length;
  const recNotApplied = recommendedIds.filter(id => !tweaks[id]);
  const allRecOn = recommendedIds.length > 0 && recNotApplied.length === 0;
  const pct = total > 0 ? Math.round((active / total) * 100) : 0;

  const impactClass =
    pct >= 75 ? "text-red-400 bg-red-500/10 border-red-500/20" :
    pct >= 40 ? "text-amber-400 bg-amber-500/10 border-amber-500/20" :
    "text-zinc-500 bg-zinc-800 border-zinc-700";

  function handleApplyRecommended() {
    recNotApplied.forEach(id => setTweak(id, true));
    toast({
      title: `${label} — Recommended Applied`,
      description: `${recNotApplied.length} tweak${recNotApplied.length !== 1 ? "s" : ""} enabled.`,
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-white/5 bg-zinc-900/60 overflow-hidden"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <Flame className="w-4 h-4 text-red-500 shrink-0" />

        {/* Active count */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xs font-bold text-white">{active}/{total}</span>
          <span className="text-xs text-zinc-500">tweaks active</span>
          {active > 0 && (
            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded border", impactClass)}>
              {impactLabel ?? (pct >= 75 ? "HIGH IMPACT" : pct >= 40 ? "MED IMPACT" : "LOW IMPACT")}
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className="hidden sm:flex items-center gap-2">
          <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-500 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[10px] text-zinc-600 font-mono w-7">{pct}%</span>
        </div>

        {/* Apply recommended button */}
        {recommendedIds.length > 0 && !allRecOn && (
          <Button
            data-testid={`button-apply-recommended-${label.replace(/\s+/g, "-").toLowerCase()}`}
            size="sm"
            onClick={handleApplyRecommended}
            className="shrink-0 text-[10px] font-bold uppercase tracking-wide bg-red-600/20 hover:bg-red-600/40 border border-red-500/30 text-red-400 hover:text-red-300 h-7 px-2.5 gap-1"
          >
            <Zap className="w-3 h-3" />
            {applyLabel ?? `Apply ${recNotApplied.length} Recommended`}
          </Button>
        )}
        {allRecOn && (
          <div className="shrink-0 flex items-center gap-1 text-[10px] text-green-500 font-bold">
            <CheckCircle2 className="w-3 h-3" /> Recommended ON
          </div>
        )}

        {/* Tips toggle */}
        {(context || tips.length > 0) && (
          <button
            onClick={() => setShowTips(v => !v)}
            className="shrink-0 p-1 rounded text-zinc-600 hover:text-zinc-300 transition-colors"
          >
            {showTips ? <ChevronUp className="w-3.5 h-3.5" /> : <Info className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      <AnimatePresence>
        {showTips && (context || tips.length > 0) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-white/5"
          >
            <div className="px-4 py-3 space-y-2">
              {context && (
                <p className="text-xs text-zinc-500 leading-relaxed">{context}</p>
              )}
              {tips.map((tip, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-red-500 text-xs shrink-0">›</span>
                  <span className="text-xs text-zinc-500 leading-relaxed">{tip}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
