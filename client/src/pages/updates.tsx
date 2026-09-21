import { useEffect, useMemo, useState } from "react";
import { apiUrl } from "@/lib/api-base";
import { getNativeAuthHeaders } from "@/lib/queryClient";
import { motion, AnimatePresence } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { useQuery } from "@tanstack/react-query";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { useProStatus, getStoredToken } from "@/lib/pro-status";
import { ProUnlockButton } from "@/components/pro-gate";
import { useHardwareInfo } from "@/hooks/use-hardware-info";
import { useOsDetection } from "@/hooks/use-os-detection";
import { getAnnouncementRelevance } from "@/lib/announcement-relevance";
import {
  Bell, Tag, Clock, Megaphone, Loader2, AlertCircle,
  Zap, CheckCircle2, Download, Lock, ChevronDown, ChevronUp,
  RefreshCw, Sparkles, Cpu, MonitorSmartphone, Target, Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { applyTweakBatch } from "@/lib/native-tweak-runner";
import { checkForUpdate, isNative, performUpdate } from "@/lib/tauri-bridge";
import { useVersionInfo, compareVersions } from "@/hooks/use-auth";
import { APP_VERSION } from "@/generated/version";
import { simpleUpdateNotes } from "@/lib/update-notes";

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

  const applyNew = async () => {
    try {
      const result = await applyTweakBatch(newOnes);
      setApplied(true);
      toast({
        title: isNative() ? `${result.appliedIds.length} new tweaks applied` : `${result.selectedIds.length} new tweaks selected`,
        description: isNative()
          ? `${result.appliedIds.length} Windows changes confirmed${result.selectedIds.length ? ` · ${result.selectedIds.length} script-only choices selected` : ""}.`
          : "Download and run the .bat to apply the selected tweaks.",
        variant: result.failures.length && !result.appliedIds.length ? "destructive" : "success",
      });
    } catch (error) {
      toast({ title: "Could not apply new tweaks", description: error instanceof Error ? error.message : "The action failed.", variant: "destructive" });
    }
  };

  const downloadUpdateScript = async () => {
    const targetIds = allDone ? tweakIds : newOnes;
    const tweakMap: Record<string, boolean> = {};
    targetIds.forEach(id => { tweakMap[id] = true; });

    setDownloading(true);
    try {
      const sessionToken = getStoredToken();
      const res = await fetch(apiUrl("/api/script/download"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getNativeAuthHeaders() },
        body: JSON.stringify({ tweaks: tweakMap, nvidiaPreset: "Balanced", sessionToken }),
      });
      if (!res.ok) throw new Error("Failed to generate script");
      const text = await res.text();
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `OptiGods-Update-${annId}.bat`;
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

type UpdateCenterStatus = "checking" | "ready" | "downloading" | "installing" | "done" | "error";

function UpdateCenterCard() {
  const { data } = useVersionInfo();
  const native = isNative();
  const [status, setStatus] = useState<UpdateCenterStatus>("checking");
  const [progress, setProgress] = useState(0);
  const [nativeVersion, setNativeVersion] = useState<string | null>(null);
  const [nativeNotes, setNativeNotes] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!native) {
      setStatus("ready");
      return;
    }
    let mounted = true;
    void checkForUpdate()
      .then(update => {
        if (!mounted) return;
        setNativeVersion(update?.latest_version ?? null);
        setNativeNotes(update?.notes ?? null);
        setStatus(update?.error ? "error" : "ready");
        if (update?.error) setError(update.error);
      })
      .catch(err => {
        if (!mounted) return;
        setStatus("error");
        setError(err instanceof Error ? err.message : "Could not check for updates.");
      });
    return () => { mounted = false; };
  }, [native]);

  const currentVersion = APP_VERSION || data?.currentVersion || "unknown";
  const latestVersion = nativeVersion ?? data?.latestVersion ?? currentVersion;
  const updateAvailable = compareVersions(latestVersion, currentVersion) > 0;
  const notes = simpleUpdateNotes(nativeNotes ?? data?.notes);

  const startUpdate = async () => {
    if (!updateAvailable || status === "downloading" || status === "installing") return;
    setError(null);
    setProgress(5);
    setStatus("downloading");

    if (native) {
      try {
        await performUpdate((percent, installing) => {
          setProgress(Math.max(5, percent));
          if (installing) setStatus("installing");
        });
        setProgress(100);
        setStatus("done");
      } catch (err) {
        // Old shells or a temporarily unavailable Tauri updater still get a
        // working installer path from the public server endpoint.
        setError("Native install was unavailable. Downloading the latest installer instead.");
        const anchor = document.createElement("a");
        anchor.href = apiUrl(data?.updaterCmdUrl || "/api/download/latest");
        anchor.download = `OptiGods-Setup-${latestVersion}.exe`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setProgress(100);
        setStatus("done");
      }
      return;
    }

    const targetUrl = apiUrl(data?.updaterCmdUrl || "/api/download/latest");
    const anchor = document.createElement("a");
    anchor.href = targetUrl;
    anchor.download = `OptiGods-Setup-${latestVersion}.exe`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setProgress(100);
    setStatus("done");
  };

  const busy = status === "downloading" || status === "installing";
  const statusText =
    status === "checking" ? "Checking release status…" :
    status === "downloading" ? `Downloading ${latestVersion}…` :
    status === "installing" ? "Installing update — please wait…" :
    status === "done" ? (native ? "Update installed — the app will restart." : "Installer downloaded — run it to finish.") :
    status === "error" ? "Update check or installation needs attention." :
    updateAvailable ? `Update available · v${latestVersion}` :
    `You are up to date · v${currentVersion}`;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      data-testid="update-center"
      className="rounded-2xl border border-red-500/25 bg-red-500/[0.035] p-5 shadow-[0_0_28px_-18px_rgba(239,68,68,.8)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-2.5">
            <Download className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-400">Opti Gods Update Center</p>
            <h2 className="mt-1 text-lg font-black text-white">Software Updates</h2>
            <p className="mt-1 text-xs text-zinc-500">Keep Opti Gods current with security, stability, and compatibility fixes.</p>
          </div>
        </div>
        <span className={cn(
          "rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider",
          updateAvailable ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
        )}>
          {updateAvailable ? "Update required" : "Current"}
        </span>
      </div>

      <div className="mt-4 rounded-xl border border-white/8 bg-black/20 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold text-white">{statusText}</p>
            <p className="mt-1 text-[10px] text-zinc-600">Installed v{currentVersion} · Latest v{latestVersion}</p>
          </div>
          {updateAvailable && (
            <button
              type="button"
              data-testid="button-download-install-update"
              onClick={() => void startUpdate()}
              disabled={busy || status === "checking"}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-[11px] font-bold text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              {native ? "Download and install update" : "Download latest installer"}
            </button>
          )}
        </div>
        {(busy || status === "done") && (
          <div className="mt-3">
            <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
              <div className="h-full bg-red-500 transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-1 text-right text-[9px] text-zinc-600">{progress}%</p>
          </div>
        )}
        {error && <p className="mt-2 text-[10px] text-red-400">{error}</p>}
      </div>

      <div className="mt-4">
        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">What changed for you</p>
        <div className="grid gap-2 md:grid-cols-3">
          {notes.slice(0, 6).map(note => (
            <div key={note} className="rounded-lg border border-white/8 bg-black/15 px-3 py-2.5">
              <p className="text-[11px] leading-relaxed text-zinc-300">{note}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

export default function Updates() {
  const { data: announcements = [], isLoading, isError, refetch, isFetching } = useQuery<Announcement[]>({
    queryKey: ["/api/announcements"],
    refetchInterval: 60000,
  });
  const { tweaks, setTweak } = useOptimizationStore();
  const isPro = useProStatus();
  const hw = useHardwareInfo();
  const os = useOsDetection();
  const [filter, setFilter] = useState<"system" | "all">("system");

  // Compute relevance per-announcement once.
  const relevanceById = useMemo(() => {
    const m: Record<number, ReturnType<typeof getAnnouncementRelevance>> = {};
    for (const a of announcements) m[a.id] = getAnnouncementRelevance(a, hw, os);
    return m;
  }, [announcements, hw, os]);

  const systemAnnouncements = useMemo(
    () => announcements.filter(a => relevanceById[a.id]?.isRelevant),
    [announcements, relevanceById],
  );
  const visibleAnnouncements = filter === "system" ? systemAnnouncements : announcements;

  const totalNewTweaks = systemAnnouncements.reduce((acc, ann) => {
    if (!ann.tweakIds?.length) return acc;
    return acc + ann.tweakIds.filter(id => !tweaks[id]).length;
  }, 0);

  const criticalCount = systemAnnouncements.filter(
    a => relevanceById[a.id]?.isCritical && (a.tweakIds || []).some(id => !tweaks[id]),
  ).length;

  const detectedLine = hw.loading
    ? "Detecting your system..."
    : [
        os.isWindows11 ? "Windows 11" : os.isWindows10 ? "Windows 10" : os.isWindows ? "Windows" : os.os,
        hw.isLaptop ? "Laptop" : null,
        hw.isNvidia ? "NVIDIA GPU" : hw.isAMD ? "AMD GPU" : hw.isAmdApu ? "AMD APU" : hw.isIntel ? "Intel Graphics" : null,
      ].filter(Boolean).join(" · ");

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl pb-10">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between gap-4 mb-2"
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
              <p className="text-zinc-500 text-sm">Detection-based — only the patches and tweaks that match your system.</p>
            </div>
          </div>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            data-testid="button-refresh-updates"
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] text-zinc-500 hover:text-zinc-300 text-xs transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn("w-3 h-3", isFetching && "animate-spin")} />
            Refresh
          </button>
        </motion.div>

        <UpdateCenterCard />

        {/* Detected-system panel */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          data-testid="panel-detected-system"
          className="rounded-xl border border-white/5 bg-zinc-950/40 p-4 flex flex-wrap items-center gap-x-5 gap-y-2"
        >
          <div className="flex items-center gap-2 min-w-0">
            <MonitorSmartphone className="w-4 h-4 text-red-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold">Detected</p>
              <p className="text-xs font-semibold text-white truncate" data-testid="text-detected-system">{detectedLine}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-red-500 shrink-0" />
            <div>
              <p className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold">Matched updates</p>
              <p className="text-xs font-semibold text-white" data-testid="text-matched-count">
                {systemAnnouncements.length} of {announcements.length}
              </p>
            </div>
          </div>
          {criticalCount > 0 && (
            <div className="flex items-center gap-2 ml-auto px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] font-bold text-red-300 uppercase tracking-wider">
                {criticalCount} critical for your PC
              </span>
            </div>
          )}
        </motion.div>

        {/* Filter toggle */}
        {announcements.length > systemAnnouncements.length && (
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-zinc-600" />
            <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold mr-2">View</span>
            <button
              data-testid="button-filter-system"
              onClick={() => setFilter("system")}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-bold transition-colors",
                filter === "system"
                  ? "bg-red-500/15 text-red-300 border border-red-500/30"
                  : "bg-white/[0.02] text-zinc-500 border border-white/5 hover:text-zinc-300"
              )}
            >
              For My System ({systemAnnouncements.length})
            </button>
            <button
              data-testid="button-filter-all"
              onClick={() => setFilter("all")}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-bold transition-colors",
                filter === "all"
                  ? "bg-red-500/15 text-red-300 border border-red-500/30"
                  : "bg-white/[0.02] text-zinc-500 border border-white/5 hover:text-zinc-300"
              )}
            >
              Show All ({announcements.length})
            </button>
          </div>
        )}

        {/* Pro banner if there are pending tweaks */}
        {isPro && totalNewTweaks > 0 && !isLoading && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            data-testid="banner-pending-tweaks"
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/5"
          >
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
            <p className="text-sm text-red-300 font-medium flex-1">
              <span className="font-bold text-white">{totalNewTweaks} new tweak{totalNewTweaks !== 1 ? "s" : ""}</span> match your system and haven't been applied to your build yet.
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

        {!isLoading && !isError && visibleAnnouncements.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <Cpu className="w-10 h-10 text-zinc-700 mx-auto mb-4" />
            <p className="text-zinc-400 text-sm">You're up to date.</p>
            <p className="text-zinc-600 text-xs mt-1">No outstanding updates match your detected system right now.</p>
            {announcements.length > 0 && (
              <button
                onClick={() => setFilter("all")}
                data-testid="button-show-all-empty"
                className="mt-4 text-[11px] text-red-400 hover:text-red-300 underline"
              >
                Show all {announcements.length} updates anyway
              </button>
            )}
          </motion.div>
        )}

        {!isLoading && visibleAnnouncements.length > 0 && (
          <div className="space-y-3">
            {visibleAnnouncements.map((ann, i) => {
              const rel = relevanceById[ann.id];
              return (
                <div key={ann.id} className="relative">
                  {rel?.isCritical && (
                    <div className="absolute -left-2 top-5 bottom-5 w-1 rounded-full bg-red-500/70 animate-pulse" data-testid={`bar-critical-${ann.id}`} />
                  )}
                  <AnnouncementCard
                    ann={ann}
                    index={i}
                    tweaks={tweaks}
                    setTweak={setTweak}
                  />
                  {rel && rel.reasons.length > 0 && (
                    <div className="mt-1 ml-14 flex items-center gap-1.5 text-[10px] text-zinc-500">
                      <Target className="w-2.5 h-2.5 text-red-500/70" />
                      <span>Targets: <span className="text-red-400 font-semibold">{rel.reasons.join(", ")}</span></span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
