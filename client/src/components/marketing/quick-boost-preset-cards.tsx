import { motion } from "framer-motion";
import { CheckCircle2, Zap, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type QuickBoostPresetCard = {
  id: string;
  title: string;
  tag: string;
  desc: string;
  icon: LucideIcon;
  color: string;
  border: string;
  glow: string;
  activeBg: string;
  accentBar: string;
  iconBg: string;
  tagBg: string;
  actionLabel: string;
};

type QuickBoostPresetCardsProps = {
  presets: QuickBoostPresetCard[];
  activeId?: string | null;
  disabled?: boolean;
  compact?: boolean;
  onSelect: (id: string) => void;
};

/**
 * Shared, side-effect-free presentation for the real dashboard's Quick Boost
 * cards and the website's non-operational preview.
 */
export function QuickBoostPresetCards({
  presets,
  activeId = null,
  disabled = false,
  compact = false,
  onSelect,
}: QuickBoostPresetCardsProps) {
  return (
    <div className={cn("grid grid-cols-1 gap-3", compact ? "min-[1300px]:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-4")}>
      {presets.map((preset, index) => {
        const isActive = activeId === preset.id;
        const Icon = preset.icon;
        return (
          <motion.button
            key={preset.id}
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 + index * 0.05 }}
            onClick={() => onSelect(preset.id)}
            disabled={disabled}
            data-testid={`button-quick-boost-${preset.id}`}
            className={cn(
              "group relative overflow-hidden rounded-xl border text-left transition-all duration-300",
              isActive
                ? `${preset.activeBg} ${preset.border} ${preset.glow}`
                : `bg-black/50 ${preset.border}`,
            )}
          >
            <div className={cn("h-[3px] w-full", preset.accentBar)} />
            <div className="p-4">
              {isActive && (
                <span className="absolute right-3 top-3">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                </span>
              )}
              <div className={cn("mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover:scale-110", preset.iconBg)}>
                <Icon className={cn("h-5 w-5", preset.color)} />
              </div>
              <div className={cn("mb-2 ml-2 inline-flex align-middle rounded border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest", preset.tagBg)}>
                {preset.tag}
              </div>
              <h3 className="mb-1.5 text-sm font-bold leading-tight text-white">{preset.title}</h3>
              <p className="mb-4 text-[11px] leading-relaxed text-zinc-500">{preset.desc}</p>
              <div className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold", preset.tagBg)}>
                <Zap className="h-2.5 w-2.5" />
                {preset.actionLabel}
              </div>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
