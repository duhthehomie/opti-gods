import { Info, ToggleRight, ArrowRight, Download, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageGuideProps {
  pageName?: string;
  className?: string;
}

export function PageGuide({ pageName, className }: PageGuideProps) {
  return (
    <div className={cn(
      "flex items-start gap-3 px-4 py-3.5 rounded-xl border border-blue-500/20 bg-blue-500/5",
      className
    )}>
      <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-blue-300 mb-1.5">
          How to use {pageName ? `the ${pageName} page` : "this page"}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="flex items-center gap-1.5 text-xs text-zinc-400">
            <ToggleRight className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            Toggle tweaks <span className="text-white font-semibold">ON</span> that you want applied
          </span>
          <ArrowRight className="w-3 h-3 text-zinc-600 shrink-0 hidden sm:block" />
          <span className="flex items-center gap-1.5 text-xs text-zinc-400">
            <Download className="w-3.5 h-3.5 text-red-400 shrink-0" />
            Click <span className="text-red-400 font-bold">GET MY SCRIPT</span> at the top when done
          </span>
          <ArrowRight className="w-3 h-3 text-zinc-600 shrink-0 hidden sm:block" />
          <span className="flex items-center gap-1.5 text-xs text-zinc-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            Double-click the <span className="text-white font-semibold">.bat file</span> → click Yes on the admin popup
          </span>
        </div>
        <p className="text-[10px] text-zinc-600 mt-2">
          Not sure which to pick? Go back to the Dashboard and use a Quick Boost preset — it enables the best ones automatically.
        </p>
      </div>
    </div>
  );
}
