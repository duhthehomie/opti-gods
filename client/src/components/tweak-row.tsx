import { CustomSwitch } from "./ui/custom-switch";
import { Label } from "./ui/label";
import { motion } from "framer-motion";

interface TweakRowProps {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  delay?: number;
}

export function TweakRow({ id, title, description, checked, onCheckedChange, delay = 0 }: TweakRowProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: delay * 0.05 }}
      className="flex flex-row items-center justify-between rounded-lg border border-white/5 bg-black/40 p-4 hover:bg-black/60 transition-colors"
    >
      <div className="space-y-1 w-[80%]">
        <Label htmlFor={id} className="text-base font-medium cursor-pointer text-zinc-200">
          {title}
        </Label>
        <p className="text-sm text-zinc-500 leading-snug">
          {description}
        </p>
      </div>
      <CustomSwitch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
    </motion.div>
  );
}
