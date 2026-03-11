import { CustomSwitch } from "./ui/custom-switch";
import { Label } from "./ui/label";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface TweakRowProps {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  delay?: number;
  badge?: string;
}

export function TweakRow({ id, title, description, checked, onCheckedChange, delay = 0, badge }: TweakRowProps) {
  return (
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
        <div className="flex items-center gap-2">
          <Label
            htmlFor={id}
            className={cn(
              "text-sm font-medium cursor-pointer transition-colors",
              checked ? "text-white" : "text-zinc-300 group-hover:text-zinc-200"
            )}
          >
            {title}
          </Label>
          {badge && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/15 text-red-400 border border-red-500/20 uppercase tracking-wide">
              {badge}
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
        onCheckedChange={onCheckedChange}
        data-testid={`toggle-tweak-${id}`}
      />
    </motion.div>
  );
}
