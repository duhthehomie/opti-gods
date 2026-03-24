import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { useQuery } from "@tanstack/react-query";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { useProStatus } from "@/lib/pro-status";
import { ProUnlockButton } from "@/components/pro-gate";
import {
  Bell, Tag, Clock, Megaphone, Loader2, AlertCircle,
  Zap, CheckCircle2, Download, Lock, ChevronDown, ChevronUp,
  RefreshCw, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type Announcement = {
  id: number;
  title: string;
  body: string;
  tag: string | null;
  tweakIds: string[] | null;
  createdAt: string;
};

const TAG_STYLES: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  update:       { bg: "bg-blue-500/10",   text: "text-blue-400",   border: "border-blue-500/20",   glow: "shadow-blue-500/10" },
  hotfix:       { bg: "bg-red-500/10",    text: "text-red-400",    border: "border-red-500/20",    glow: "shadow-red-500/10" },
  new:          { bg: "bg-green-500/10",  text: "text-green-400",  border: "border-green-500/20",  glow: "shadow-green-500/10" },
  announcement: { bg: "bg-violet-500/10", text: "text-violet-400", border: "border-violet-500/20", glow: "shadow-violet-500/10" },
  warning:      { bg: "bg-amber-500/10",  text: "text-amber-400",  border: "border-amber-500/20",  glow: "shadow-amber-500/10" },
};

function TagBadge({ tag }: { tag: string }) {
  const s = TAG_STYLES[tag.toLowerCase()] ?? TAG_STYLES.update;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border", s.bg, s.text, s.border)}>
      <Tag className="w-2.5 h-2.5" />
      {tag}
    </span>
  );
}

function TweakDiffPanel({
  tweakIds,
  tweaks,
  setTweak,
  annId,
}: {
  tweakIds: string[];
  tweaks: Record<string, boolean>;
  setTweak: (id: string, v: boolean) => void;
  annId: number;
}) {
  const isPro = useProStatus();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [applied, setApplied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const alreadyOn = tweakIds.filter(id => tweaks[id]);
  const newOnes = tweakIds.filter(id => !tweaks[id]);
  const allDone = newOnes.length === 0;

  const applyNew = () => {
    newOnes.forEach(id => setTweak(id, true));
    setApplied(true);
    toast({
      title: `${newOnes.length} new tweak${newOnes.length !== 1 ? "s" : ""} applied!`,
      description: "Your tweak selection has been updated. Download your script to run them.",
    });
  };

  const downloadUpdateScript = async () => {
    const targetIds = allDone ? tweakIds : newOnes;
    const tweakMap: Record<string, boolean> = {};
    targetIds.forEach(id => { tweakMap[id] = true; });

    setDownloading(true);
    try {
      const res = await fetch("/api/script/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tweaks: tweakMap, nvidiaPreset: "Balanced" }),
      });
      if (!res.ok) throw new Error("Failed to generate script");
      const text = await res.text();
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `OptiGods-Update-${annId}.ps1`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        title: `Downloaded Update Script (${targetIds.length} tweaks)`,
        description: "Double-click the .bat file → click Yes on the admin popup → done.",
      });
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-white/8 bg-black/30 overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <Zap className="w-4 h-4 text-red-500 shrink-0" />
          <span className="text-xs font-bold text-white">
            {tweakIds.length} Tweak{tweakIds.length !== 1 ? "s" : ""} in this update
          </span>
          {alreadyOn.length > 0 && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {alreadyOn.length} already applied
            </span>
          )}
          {newOnes.length > 0 && !applied && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse">
              {newOnes.length} new
            </span>
          )}
          {(applied || allDone) && newOnes.length === 0 && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              All done ✓
            </span>
          )}
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          className="text-zinc-600 hover:text-zinc-300 transition-colors flex items-center gap-1 text-[10px]"
        >
          {expanded ? "hide" : "show"} tweaks
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Tweak list */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-3 space-y-1.5 max-h-48 overflow-y-auto">
              {tweakIds.map(id => {
                const on = tweaks[id];
                return (
                  <div key={id} className="flex items-center gap-2">
                    {on ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full border border-zinc-700 shrink-0" />
                    )}
                    <span className={cn("text-xs font-mono", on ? "text-emerald-400" : "text-zinc-400")}>{id}</span>
                    {!on && (
                      <span className="text-[9px] text-red-400 font-bold ml-auto">NEW</span>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action bar */}
      <div className="px-4 py-3 flex flex-wrap items-center gap-2 border-t border-white/5 bg-black/20">
        {!isPro ? (
          <ProUnlockButton className="flex-1">
            <div className="flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-red-500/20 bg-red-500/5 text-red-400 text-xs font-bold cursor-pointer hover:bg-red-500/10 transition-colors">
              <Lock className="w-3 h-3" />
              Unlock Pro to apply these tweaks
            </div>
          </ProUnlockButton>
        ) : allDone || applied ? (
          <>
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4" />
              {applied ? "Tweaks applied to your selection!" : "All tweaks already in your build"}
            </div>
            <button
              data-testid={`button-download-update-${annId}`}
              onClick={downloadUpdateScript}
              disabled={downloading}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors disabled:opacity-50"
            >
              {downloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
              {downloading ? "Generating..." : "Download Script"}
            </button>
          </>
        ) : (
          <>
            <button
              data-testid={`button-apply-tweaks-${annId}`}
              onClick={applyNew}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors"
            >
              <Zap className="w-3 h-3" />
              Apply {newOnes.length} New Tweak{newOnes.length !== 1 ? "s" : ""}
            </button>
            <div className="flex flex-col items-start gap-0.5">
              <button
                data-testid={`button-download-update-${annId}`}
                onClick={downloadUpdateScript}
                disabled={downloading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {downloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                Download Script Only
              </button>
              <span className="text-[9px] text-zinc-600 px-1">Downloads just this update's tweaks — ignores your saved selections</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AnnouncementCard({
  ann,
  index,
  tweaks,
  setTweak,
}: {
  ann: Announcement;
  index: number;
  tweaks: Record<string, boolean>;
  setTweak: (id: string, v: boolean) => void;
}) {
  const date = new Date(ann.createdAt);
  const formatted = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const hasTweaks = (ann.tweakIds?.length ?? 0) > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      data-testid={`card-announcement-${ann.id}`}
      className={cn(
        "rounded-xl border p-5 transition-all",
        hasTweaks
          ? "border-red-500/20 bg-red-500/[0.03] hover:border-red-500/30"
          : "border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.03]"
      )}
    >
      <div className="flex items-start gap-3 mb-3">
        <div className={cn("p-2 rounded-lg shrink-0 mt-0.5", hasTweaks ? "bg-red-500/15" : "bg-red-500/10")}>
          {hasTweaks ? (
            <Sparkles className="w-4 h-4 text-red-400" />
          ) : (
            <Megaphone className="w-4 h-4 text-red-500" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="font-bold text-white text-sm leading-snug">{ann.title}</h3>
            {ann.tag && <TagBadge tag={ann.tag} />}
            {hasTweaks && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-600/20 text-red-300 border border-red-500/30">
                <Zap className="w-2.5 h-2.5" /> {ann.tweakIds!.length} tweaks included
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-zinc-600 text-[10px]">
            <Clock className="w-3 h-3" />
            <span>{formatted}</span>
          </div>
        </div>
      </div>
      <p className="text-sm text-zinc-400 leading-relaxed whitespace-pre-wrap pl-11">{ann.body}</p>

      {hasTweaks && (
        <div className="pl-11">
          <TweakDiffPanel
            tweakIds={ann.tweakIds!}
            tweaks={tweaks}
            setTweak={setTweak}
            annId={ann.id}
          />
        </div>
      )}
    </motion.div>
  );
}

export default function Updates() {
  const { data: announcements = [], isLoading, isError, refetch, isFetching } = useQuery<Announcement[]>({
    queryKey: ["/api/announcements"],
    refetchInterval: 60000,
  });
  const { tweaks, setTweak } = useOptimizationStore();
  const isPro = useProStatus();

  const totalNewTweaks = announcements.reduce((acc, ann) => {
    if (!ann.tweakIds?.length) return acc;
    return acc + ann.tweakIds.filter(id => !tweaks[id]).length;
  }, 0);

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl pb-10">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between gap-4 mb-6"
        >
          <div className="flex items-center gap-3">
            <div className="p-3 bg-zinc-900 rounded-lg border border-white/5 relative">
              <Bell className="w-6 h-6 text-red-500" />
              {totalNewTweaks > 0 && isPro && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-600 text-[8px] font-bold text-white flex items-center justify-center leading-none">
                  {totalNewTweaks > 9 ? "9+" : totalNewTweaks}
                </span>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold">Live Updates</h1>
              <p className="text-zinc-500 text-sm">Latest patches, new tweaks, and announcements from the Opti Gods team</p>
            </div>
          </div>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] text-zinc-500 hover:text-zinc-300 text-xs transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn("w-3 h-3", isFetching && "animate-spin")} />
            Refresh
          </button>
        </motion.div>

        {/* Pro banner if there are pending tweaks */}
        {isPro && totalNewTweaks > 0 && !isLoading && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/5"
          >
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
            <p className="text-sm text-red-300 font-medium flex-1">
              <span className="font-bold text-white">{totalNewTweaks} new tweak{totalNewTweaks !== 1 ? "s" : ""}</span> across recent updates haven't been applied to your build yet.
            </p>
          </motion.div>
        )}

        {!isPro && !isLoading && announcements.some(a => (a.tweakIds?.length ?? 0) > 0) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-900/40"
          >
            <Lock className="w-4 h-4 text-zinc-600 shrink-0" />
            <p className="text-xs text-zinc-500">
              <span className="text-zinc-300 font-medium">Pro users</span> can see exactly which new tweaks apply to them and apply updates with one click.
            </p>
          </motion.div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-20 gap-3 text-zinc-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading announcements...</span>
          </div>
        )}

        {isError && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-red-500/20 bg-red-500/5 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Failed to load announcements. Try refreshing the page.
          </div>
        )}

        {!isLoading && !isError && announcements.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <Bell className="w-10 h-10 text-zinc-700 mx-auto mb-4" />
            <p className="text-zinc-500 text-sm">No announcements yet.</p>
            <p className="text-zinc-700 text-xs mt-1">Check back soon for updates, hotfixes, and new tweaks.</p>
          </motion.div>
        )}

        {!isLoading && announcements.length > 0 && (
          <div className="space-y-3">
            {announcements.map((ann, i) => (
              <AnnouncementCard
                key={ann.id}
                ann={ann}
                index={i}
                tweaks={tweaks}
                setTweak={setTweak}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
