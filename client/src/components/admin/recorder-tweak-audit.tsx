import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, ClipboardList, HelpCircle, RefreshCw, X } from "lucide-react";
import { useHardwareInfo } from "@/hooks/use-hardware-info";
import { useOsDetection } from "@/hooks/use-os-detection";
import { detectAppliedTweaks, getRecordedAppliedTweaks } from "@/lib/tauri-bridge";
import { computeSmartRecs, getEligibleSmartRecommendationIds } from "@/lib/smart-recommendations";
import { getTweakCompatibility } from "@/lib/tweak-compatibility";
import { TWEAK_BY_ID } from "@/lib/tweak-registry";
import type { TweakCategory, TweakMeta } from "@/lib/tweak-registry";
import { cn } from "@/lib/utils";

/** Read-only. Separates verified-applied, verified-missing, unverified and history. */
export type RecorderTweakAuditSnapshot = {
  captured_at: string;
  game_id: string | null;
  game_category: TweakCategory | null;
  os: { caption: string; build: string; source: "live_sample" | "hardware_scan" | "browser_estimate" };
  hardware: { cpu: string; gpu: string; ram_gb: number; scanned: boolean };
  target_ids: string[];
  verified_applied: string[];
  verified_missing: string[];
  unverified: string[];
  recorded_history: Record<string, number>;
  readback_errors: { detected: string | null; history: string | null };
};

export type RecorderLiveOs = { caption?: string | null; version?: string | null; build?: string | null } | null;

type Props = {
  gameId: string | null;
  liveOs: RecorderLiveOs;
  onSnapshot: (snapshot: RecorderTweakAuditSnapshot) => void;
};

/** Game-specific tweak categories. Other games' categories are excluded from an audit. */
const GAME_TWEAK_CATEGORIES = new Set<TweakCategory>(["fivem", "fortnite", "rust", "roblox", "cod"]);
const GAME_TO_CATEGORY: Record<string, TweakCategory> = {
  fivem: "fivem",
  fortnite: "fortnite",
  rust: "rust",
  roblox: "roblox",
  cod: "cod",
  warzone: "cod",
};

type Status = "applied" | "missing" | "unverified";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function registryTarget(tweak: TweakMeta | undefined): string | null {
  const action = tweak?.nativeAction;
  if (action?.type !== "registry" || !action.params) return null;
  const { hive, path, name, value } = action.params as Record<string, unknown>;
  if (typeof path !== "string" || typeof name !== "string") return null;
  return `${typeof hive === "string" ? hive : "HK??"}\\${path} · ${name} = ${String(value)}`;
}

export function RecorderTweakAudit({ gameId, liveOs, onSnapshot }: Props) {
  const hw = useHardwareInfo();
  const os = useOsDetection();
  const category = gameId ? GAME_TO_CATEGORY[gameId.toLowerCase()] ?? null : null;
  const recIdsKey = Array.from(computeSmartRecs(hw, os).ids).sort().join("|");
  const targetIds = useMemo(() => {
    const ids = recIdsKey ? recIdsKey.split("|") : [];
    return getEligibleSmartRecommendationIds(ids, id => getTweakCompatibility(id).ok).filter(id => {
      const tweakCategory = TWEAK_BY_ID.get(id)?.category;
      // System-wide tweaks always count; game tweaks only for the game being played.
      return !tweakCategory || !GAME_TWEAK_CATEGORIES.has(tweakCategory) || tweakCategory === category;
    });
  }, [recIdsKey, category]);

  const [detected, setDetected] = useState<Record<string, boolean> | null>(null);
  const [history, setHistory] = useState<Record<string, number> | null>(null);
  const [detectedError, setDetectedError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [capturedAt, setCapturedAt] = useState<string | null>(null);
  const busyRef = useRef(false);
  const onSnapshotRef = useRef(onSnapshot);
  onSnapshotRef.current = onSnapshot;

  const refresh = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setRefreshing(true);
    const [liveResult, historyResult] = await Promise.allSettled([detectAppliedTweaks(), getRecordedAppliedTweaks()]);
    setDetected(liveResult.status === "fulfilled" ? liveResult.value : null);
    setDetectedError(liveResult.status === "rejected" ? errorMessage(liveResult.reason) : null);
    setHistory(historyResult.status === "fulfilled" ? historyResult.value : null);
    setHistoryError(historyResult.status === "rejected" ? errorMessage(historyResult.reason) : null);
    setCapturedAt(new Date().toISOString());
    setRefreshing(false);
    busyRef.current = false;
  }, []);

  // Read once on open and again when the detected game changes.
  useEffect(() => { void refresh(); }, [refresh, category]);

  const rows = useMemo(() => targetIds.map(id => {
    const tweak = TWEAK_BY_ID.get(id);
    const live = detected?.[id];
    const status: Status = live === true ? "applied" : live === false ? "missing" : "unverified";
    return {
      id,
      title: tweak?.title ?? id,
      category: tweak?.category ?? "system",
      status,
      registry: status === "missing" ? registryTarget(tweak) : null,
      history: history?.[id] ?? 0,
    };
  }).sort((a, b) => {
    const order: Record<Status, number> = { missing: 0, unverified: 1, applied: 2 };
    return order[a.status] - order[b.status] || a.title.localeCompare(b.title);
  }), [targetIds, detected, history]);

  const counts = useMemo(() => ({
    applied: rows.filter(r => r.status === "applied").length,
    missing: rows.filter(r => r.status === "missing").length,
    unverified: rows.filter(r => r.status === "unverified").length,
  }), [rows]);

  const osView = liveOs?.caption
    ? { caption: liveOs.caption.replace(/^Microsoft\s+/i, ""), build: liveOs.build ?? "", source: "live_sample" as const }
    : { caption: os.displayName, build: os.build, source: os.fromScan ? "hardware_scan" as const : "browser_estimate" as const };

  useEffect(() => {
    if (!capturedAt) return;
    onSnapshotRef.current({
      captured_at: capturedAt,
      game_id: gameId,
      game_category: category,
      os: osView,
      hardware: { cpu: hw.cpuLabel, gpu: hw.gpuName, ram_gb: hw.ramGB, scanned: hw.scanned },
      target_ids: targetIds,
      verified_applied: rows.filter(r => r.status === "applied").map(r => r.id),
      verified_missing: rows.filter(r => r.status === "missing").map(r => r.id),
      unverified: rows.filter(r => r.status === "unverified").map(r => r.id),
      recorded_history: history ?? {},
      readback_errors: { detected: detectedError, history: historyError },
    });
    // osView is derived from the listed primitives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capturedAt, rows, gameId, category, hw.cpuLabel, hw.gpuName, hw.ramGB, hw.scanned, osView.caption, osView.build, osView.source, detectedError, historyError]);

  const verifiedTotal = counts.applied + counts.missing;

  return (
    <section className="rounded-xl border border-red-500/20 bg-black/25 p-4" data-testid="recorder-tweak-audit">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-red-400">
            <ClipboardList className="h-3.5 w-3.5" />
            Read-only tweak audit
          </div>
          <h3 className="mt-1 font-display text-base font-bold text-zinc-100">
            {category ? `${gameId === "fivem" ? "FiveM" : category} + system tweaks for this PC` : "System tweaks for this PC"}
          </h3>
          <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-zinc-500">
            Targets are this PC's eligible Smart Recommendations, plus the current game's tweaks only. Expert, manual-only
            and other games' tweaks are excluded. Reading state never changes the registry, and no FPS gain is promised.
          </p>
        </div>
        <button
          type="button"
          data-testid="button-refresh-tweak-audit"
          onClick={() => void refresh()}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-lg border border-red-500/25 bg-red-950/30 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-red-200 hover:bg-red-900/40 disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          {refreshing ? "Reading…" : "Re-read PC"}
        </button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Windows", `${osView.caption}${osView.build ? ` · build ${osView.build}` : ""}`, osView.source === "live_sample" ? "read live from Windows" : osView.source === "hardware_scan" ? "from hardware scan" : "browser estimate"],
          ["CPU / GPU", `${hw.cpuLabel} / ${hw.gpuName}`, hw.scanned ? "hardware scan" : "not scanned yet"],
          ["Verified applied", verifiedTotal ? `${counts.applied} of ${verifiedTotal}` : "—", "live registry/state readback"],
          ["Read at", capturedAt ? new Date(capturedAt).toLocaleTimeString() : "Not read", `${counts.unverified} without a live detector`],
        ].map(([label, value, hint]) => (
          <div key={label} className="min-w-0 rounded-lg border border-white/5 bg-zinc-950/70 px-3 py-2">
            <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">{label}</div>
            <div className="mt-1 truncate text-[12px] font-bold text-zinc-200" title={value}>{value}</div>
            <div className="truncate text-[10px] text-zinc-600">{hint}</div>
          </div>
        ))}
      </div>

      {(detectedError || historyError) && (
        <div className="mt-3 space-y-1 rounded-lg border border-amber-500/20 bg-amber-950/20 px-3 py-2 text-[11px] text-amber-300">
          <div className="flex items-center gap-2 font-bold"><AlertTriangle className="h-3.5 w-3.5" /> Readback did not complete</div>
          {detectedError && <p>Live detector: {detectedError}</p>}
          {historyError && <p>Recorded history: {historyError}</p>}
        </div>
      )}

      {!hw.scanned && (
        <p className="mt-3 rounded-lg border border-white/5 bg-zinc-950/50 px-3 py-2 text-[11px] text-zinc-500">
          Hardware has not been scanned yet, so recommendations are not tailored to this exact PC. Run System Scan first for an exact list.
        </p>
      )}

      <div className="mt-3 max-h-80 overflow-auto rounded-lg border border-white/5">
        <div className="sticky top-0 grid grid-cols-[1fr_auto] gap-3 border-b border-white/5 bg-zinc-950 px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-zinc-600">
          <span>{counts.missing} missing · {counts.applied} applied · {counts.unverified} unverified</span>
          <span>Live state</span>
        </div>
        {!rows.length ? (
          <p className="px-3 py-4 text-[11px] text-zinc-600">{detected === null && !detectedError ? "Reading this PC…" : "No eligible recommendations for this hardware."}</p>
        ) : rows.map(row => (
          <div key={row.id} className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-white/[0.035] px-3 py-2 last:border-0" data-testid={`audit-row-${row.id}`}>
            <div className="min-w-0">
              <div className="truncate text-[11px] text-zinc-200">{row.title}</div>
              <div className="truncate font-mono text-[9px] text-zinc-600">
                {row.id} · {row.category}{row.history ? ` · applied ${row.history}× in history` : ""}
              </div>
              {row.registry && <div className="truncate font-mono text-[9px] text-amber-500/80" title={row.registry}>{row.registry}</div>}
            </div>
            <span className={cn(
              "inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider",
              row.status === "applied" ? "text-emerald-400" : row.status === "missing" ? "text-amber-400" : "text-zinc-500",
            )}>
              {row.status === "applied" ? <Check className="h-3 w-3" /> : row.status === "missing" ? <X className="h-3 w-3" /> : <HelpCircle className="h-3 w-3" />}
              {row.status === "applied" ? "Verified applied" : row.status === "missing" ? "Verified missing" : "No live check"}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-zinc-600">
        Recorded history is shown per row but never counts as currently applied. "No live check" means Windows state for that tweak cannot be read back.
      </p>
    </section>
  );
}
