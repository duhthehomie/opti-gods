import { useState } from "react";
import { CustomSwitch } from "./ui/custom-switch";
import { Label } from "./ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { AlertTriangle, ShieldAlert, X } from "lucide-react";

interface TweakRowProps {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  delay?: number;
  badge?: string;
  impact?: "HIGH" | "MED" | "LOW";
  warning?: string;
}

const IMPACT_STYLES = {
  HIGH: { dot: "bg-red-500", label: "HIGH", text: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
  MED:  { dot: "bg-amber-400", label: "MED",  text: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/20" },
  LOW:  { dot: "bg-zinc-500",  label: "LOW",  text: "text-zinc-500",  bg: "bg-zinc-800 border-zinc-700" },
};

export function TweakRow({ id, title, description, checked, onCheckedChange, delay = 0, badge, impact, warning }: TweakRowProps) {
  const imp = impact ? IMPACT_STYLES[impact] : null;
  const [pendingEnable, setPendingEnable] = useState(false);

  const handleChange = (val: boolean) => {
    if (val && warning && !checked) {
      setPendingEnable(true);
    } else {
      onCheckedChange(val);
    }
  };

  const confirmEnable = () => {
    setPendingEnable(false);
    onCheckedChange(true);
  };

  const cancelEnable = () => {
    setPendingEnable(false);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: delay * 0.04 }}
        className={cn(
          "flex flex-row items-center justify-between rounded-lg border p-4 transition-all duration-200 group",
          checked
            ? "bg-red-500/5 border-red-500/25 shadow-[inset_0_0_12px_-6px_rgba(239,68,68,0.15)]"
            : "bg-black/40 border-white/5 hover:border-white/10 hover:bg-black/60"
        )}
      >
        <div className="space-y-1 w-[80%]">
          <div className="flex items-center flex-wrap gap-1.5">
            <Label
              htmlFor={id}
              className={cn(
                "text-sm font-medium cursor-pointer transition-colors",
                checked ? "text-white" : "text-zinc-300 group-hover:text-zinc-200"
              )}
            >
              {title}
            </Label>

            {warning && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/25 uppercase tracking-wide">
                <AlertTriangle className="w-2.5 h-2.5" />
                CAUTION
              </span>
            )}

            {badge && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/15 text-red-400 border border-red-500/20 uppercase tracking-wide">
                {badge}
              </span>
            )}

            {imp && (
              <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wide", imp.bg, imp.text)}>
                <span className={cn("w-1.5 h-1.5 rounded-full", imp.dot)} />
                {imp.label}
              </span>
            )}

            {checked && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 uppercase tracking-wide">
                ON
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 leading-snug">{description}</p>
        </div>
        <CustomSwitch
          id={id}
          checked={checked}
          onCheckedChange={handleChange}
          data-testid={`toggle-tweak-${id}`}
        />
      </motion.div>

      {/* Warning confirmation dialog */}
      <AnimatePresence>
        {pendingEnable && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
            onClick={(e) => { if (e.target === e.currentTarget) cancelEnable(); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 8 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-zinc-950 shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header stripe */}
              <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-red-500" />

              <div className="p-6 space-y-4">
                {/* Icon + title */}
                <div className="flex items-start gap-4">
                  <div className="shrink-0 w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center">
                    <ShieldAlert className="w-6 h-6 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Caution Required</span>
                    </div>
                    <h3 className="text-base font-bold text-white leading-snug">{title}</h3>
                  </div>
                  <button
                    onClick={cancelEnable}
                    className="shrink-0 p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/5 transition-colors"
                    data-testid={`button-cancel-warning-${id}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Warning text */}
                <div className="ml-16 px-4 py-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
                  <p className="text-sm text-zinc-300 leading-relaxed">{warning}</p>
                </div>

                {/* Fine print */}
                <p className="ml-16 text-xs text-zinc-600 leading-relaxed">
                  This tweak will only take effect after you download and run the PowerShell script as Administrator. You can turn it back off at any time before downloading.
                </p>

                {/* Action buttons */}
                <div className="ml-16 flex items-center gap-3 pt-1">
                  <button
                    data-testid={`button-enable-anyway-${id}`}
                    onClick={confirmEnable}
                    className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold transition-colors"
                  >
                    Enable Anyway
                  </button>
                  <button
                    data-testid={`button-cancel-${id}`}
                    onClick={cancelEnable}
                    className="flex-1 py-2.5 rounded-xl border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white text-sm font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
