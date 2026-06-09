import { TweakRow } from "@/components/tweak-row";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { TWEAK_REGISTRY } from "@/lib/tweak-registry";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface V2TweakSectionProps {
  heading: string;
  ids: string[];
  accent?: "red" | "purple" | "amber" | "emerald" | "blue";
  description?: string;
  testIdSuffix: string;
}

const ACCENTS: Record<NonNullable<V2TweakSectionProps["accent"]>, { text: string; border: string; bg: string; hover: string }> = {
  red:     { text: "text-red-500",     border: "border-red-500/20 hover:border-red-500/40",     bg: "hover:bg-red-500/10",     hover: "hover:text-red-300" },
  purple:  { text: "text-purple-500",  border: "border-purple-500/20 hover:border-purple-500/40", bg: "hover:bg-purple-500/10",  hover: "hover:text-purple-300" },
  amber:   { text: "text-amber-500",   border: "border-amber-500/20 hover:border-amber-500/40",  bg: "hover:bg-amber-500/10",   hover: "hover:text-amber-300" },
  emerald: { text: "text-emerald-500", border: "border-emerald-500/20 hover:border-emerald-500/40", bg: "hover:bg-emerald-500/10", hover: "hover:text-emerald-300" },
  blue:    { text: "text-blue-500",    border: "border-blue-500/20 hover:border-blue-500/40",    bg: "hover:bg-blue-500/10",    hover: "hover:text-blue-300" },
};

export function V2TweakSection({ heading, ids, accent = "red", description, testIdSuffix }: V2TweakSectionProps) {
  const tweaks = useOptimizationStore(s => s.tweaks);
  const setTweak = useOptimizationStore(s => s.setTweak);
  const a = ACCENTS[accent];

  const items = ids
    .map(id => {
      const found = TWEAK_REGISTRY.find(t => t.id === id);
      if (!found && import.meta.env.DEV) {
        console.warn(`[V2TweakSection:${testIdSuffix}] Unknown tweak id "${id}" — missing from TWEAK_REGISTRY.`);
      }
      return found;
    })
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  if (items.length === 0) return null;

  const recIds = items.filter(t => t.recommended).map(t => t.id);
  const allRecOn = recIds.length > 0 && recIds.every(id => tweaks[id]);

  return (
    <section data-testid={`section-v2-${testIdSuffix}`}>
      <div className="flex items-center gap-2 mb-5 px-1">
        <h2 className={`text-sm font-bold uppercase tracking-wider ${a.text}`}>{heading}</h2>
        <span className="text-[10px] font-mono text-zinc-600">({items.length})</span>
        <div className="flex-1 h-px bg-white/5 ml-2" />
        {recIds.length > 0 && (
          <Button
            variant="ghost" size="sm"
            onClick={() => recIds.forEach(id => setTweak(id, true))}
            disabled={allRecOn}
            data-testid={`button-enable-recommended-v2-${testIdSuffix}`}
            className={`text-[10px] font-bold uppercase tracking-wider ${a.text} ${a.hover} ${a.bg} border ${a.border} px-2.5 py-1 h-auto rounded-md transition-all disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <CheckCircle2 className="w-3 h-3 mr-1" />
            {allRecOn ? "Recommended ON" : `Enable Recommended (${recIds.length})`}
          </Button>
        )}
      </div>
      {description && <p className="text-xs text-zinc-600 px-1 mb-5">{description}</p>}
      <div className="space-y-5">
        {items.map((item, i) => (
          <TweakRow
            key={item.id}
            id={item.id}
            title={item.title || item.id}
            description={item.description || item.plainEnglish}
            badge={item.badge}
            impact={item.impact}
            warning={item.warning}
            checked={tweaks[item.id] || false}
            onCheckedChange={(v) => setTweak(item.id, v)}
            delay={i + 1}
          />
        ))}
      </div>
    </section>
  );
}
