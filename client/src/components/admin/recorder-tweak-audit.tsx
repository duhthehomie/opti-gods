import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, ClipboardList, Copy, HelpCircle, RefreshCw, X } from "lucide-react";
import { useHardwareInfo } from "@/hooks/use-hardware-info";
import { useOsDetection } from "@/hooks/use-os-detection";
import { detectAppliedTweaks, getRecordedAppliedTweaks, isNative } from "@/lib/tauri-bridge";
import { buildAcceptedValues, checkValue, readTweakRegistry, regKey, type RegistryReadback } from "@/lib/tweak-readback";
import { getScoredRecommendationIds, useInstalledProfileGameIds } from "@/lib/recommendation-scope";
import { canRunNvidiaPreset, isCurrentNvidiaPresetVerified } from "@/lib/nvidia-preset-eligibility";
import { GAME_TWEAK_IDS } from "@/lib/game-library";
import { TWEAK_REGISTRY_TARGETS, type TweakRegistryTarget } from "@/generated/tweak-registry-targets";
import { useToast } from "@/hooks/use-toast";
import { computeSmartRecs } from "@/lib/smart-recommendations";
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
  /** Per missing tweak: each registry value that differs, with current and needed values. */
  missing_values: Record<string, Array<{ key: string; current: string; needed: string }>>;
  recorded_history: Record<string, number>;
  readback_errors: { detected: string | null; history: string | null; registry: string | null };
};

export type RecorderLiveOs = { caption?: string | null; version?: string | null; build?: string | null } | null;

type Props = {
  gameId: string | null;
  /** Shared game-library id (e.g. game_fortnite) for per-game tweak targets. */
  libraryGameId: string | null;
  gameLabel: string | null;
  liveOs: RecorderLiveOs;
  onSnapshot: (snapshot: RecorderTweakAuditSnapshot) => void;
};

/** Maps a detected game to its tweak category (shown in the snapshot). */
const GAME_TO_CATEGORY: Record<string, TweakCategory> = {
  fivem: "fivem",
  fortnite: "fortnite",
  rust: "rust",
  roblox: "roblox",
  cod: "cod",
  warzone: "cod",
  game_fivem: "fivem",
  game_gta5: "fivem",
  game_fortnite: "fortnite",
  game_rust: "rust",
  game_roblox: "roblox",
  game_cod: "cod",
  game_warzone: "cod",
};

/** .reg text for the values that are not set as needed (copied, never applied here).
 *  Each value is preceded by a comment with what this PC has now, for diagnosis. */
function regFile(targets: TweakRegistryTarget[], currentOf?: (t: TweakRegistryTarget) => string): string {
  const byKey = new Map<string, { header: string; rows: Map<string, string> }>();
  for (const t of targets) {
    const header = `[${t.hive === "HKLM" ? "HKEY_LOCAL_MACHINE" : "HKEY_CURRENT_USER"}\\${t.path}]`;
    const name = t.name === "(Default)" ? "@" : `"${t.name.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    // Control Panel values are text in Windows; writing them as DWORD breaks them.
    const asText = t.type === "sz" || /^control panel\\/i.test(t.path);
    let data: string;
    if (asText) data = `"${String(t.value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    else if (t.type === "dword") data = `dword:${(Number(t.value) >>> 0).toString(16).padStart(8, "0")}`;
    else {
      let v = BigInt(t.value);
      const bytes: string[] = [];
      for (let i = 0; i < 8; i++) { bytes.push((v & BigInt(255)).toString(16).padStart(2, "0")); v >>= BigInt(8); }
      data = `hex(b):${bytes.join(",")}`;
    }
    const group = byKey.get(header.toLowerCase()) ?? { header, rows: new Map<string, string>() };
    const note = currentOf ? `; now: ${currentOf(t)}\r\n` : "";
    group.rows.set(name.toLowerCase(), `${note}${name}=${data}`);
    byKey.set(header.toLowerCase(), group);
  }
  return ["Windows Registry Editor Version 5.00", ...Array.from(byKey.values(), ({ header, rows }) => `\r\n${header}\r\n${Array.from(rows.values()).join("\r\n")}`)].join("\r\n") + "\r\n";
}

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

export function RecorderTweakAudit({ gameId, libraryGameId, gameLabel, liveOs, onSnapshot }: Props) {
  const hw = useHardwareInfo();
  const os = useOsDetection();
  const { toast } = useToast();
  const category = (libraryGameId ? GAME_TO_CATEGORY[libraryGameId] : null)
    ?? (gameId ? GAME_TO_CATEGORY[gameId.toLowerCase()] ?? null : null);
  const recIdsKey = Array.from(computeSmartRecs(hw, os).ids).sort().join("|");
  const installedProfileGames = useInstalledProfileGameIds();
  // The recorder is admin-only, and admins are Pro: same preset rule as the dashboard.
  const nvidiaPresetEligible = canRunNvidiaPreset({
    native: isNative(),
    pro: true,
    hardwareScanned: hw.scanned,
    dedicatedNvidiaGpuCount: hw.gpus.filter(gpu => gpu.vendor === "nvidia" && !gpu.isIntegrated).length,
  });
  const profileKey = installedProfileGames.ids.join("|");
  const targetIds = useMemo(() => {
    const ids = recIdsKey ? recIdsKey.split("|") : [];
    // Exactly the dashboard's scored list, so "X of Y" matches the dashboard score.
    const scored = getScoredRecommendationIds(ids, nvidiaPresetEligible, profileKey ? profileKey.split("|") : []);
    // The detected game's own optimisation list (same list Game Detection uses).
    const perGame = (libraryGameId ? GAME_TWEAK_IDS[libraryGameId] ?? [] : [])
      .filter(id => TWEAK_BY_ID.has(id) && getTweakCompatibility(id).ok);
    return Array.from(new Set([...scored, ...perGame]));
  }, [recIdsKey, nvidiaPresetEligible, profileKey, libraryGameId]);
  const targetKey = targetIds.join("|");
  const perGameIds = useMemo(() => new Set(libraryGameId ? GAME_TWEAK_IDS[libraryGameId] ?? [] : []), [libraryGameId]);

  const [detected, setDetected] = useState<Record<string, boolean> | null>(null);
  const [history, setHistory] = useState<Record<string, number> | null>(null);
  const [detectedError, setDetectedError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [registry, setRegistry] = useState<RegistryReadback | null>(null);
  const [registryError, setRegistryError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [capturedAt, setCapturedAt] = useState<string | null>(null);
  const busyRef = useRef(false);
  const onSnapshotRef = useRef(onSnapshot);
  onSnapshotRef.current = onSnapshot;

  const refresh = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setRefreshing(true);
    const [liveResult, historyResult, registryResult] = await Promise.allSettled([
      detectAppliedTweaks(),
      getRecordedAppliedTweaks(),
      readTweakRegistry(targetKey ? targetKey.split("|") : []),
    ]);
    if (registryResult.status === "fulfilled") {
      setRegistry(registryResult.value);
      setRegistryError(null);
    } else {
      setRegistry(null);
      setRegistryError(errorMessage(registryResult.reason));
    }
    setDetected(liveResult.status === "fulfilled" ? liveResult.value : null);
    setDetectedError(liveResult.status === "rejected" ? errorMessage(liveResult.reason) : null);
    setHistory(historyResult.status === "fulfilled" ? historyResult.value : null);
    setHistoryError(historyResult.status === "rejected" ? errorMessage(historyResult.reason) : null);
    setCapturedAt(new Date().toISOString());
    setRefreshing(false);
    busyRef.current = false;
  }, [targetKey]);

  // Read once on open and again when the detected game or target list changes.
  useEffect(() => { void refresh(); }, [refresh]);

  // Same accepted values as the dashboard: any value another tweak writes to the key.
  const accepted = useMemo(() => buildAcceptedValues(Object.keys(TWEAK_REGISTRY_TARGETS)), []);

  const rows = useMemo(() => targetIds.map(id => {
    const tweak = TWEAK_BY_ID.get(id);
    const live = detected?.[id];
    const targets = TWEAK_REGISTRY_TARGETS[id] ?? [];
    const checks = registry && targets.length ? targets.map(t => checkValue(t, registry.get(regKey(t)), accepted)) : [];
    // Native detector first; otherwise every registry value the tweak writes must match.
    // The NVIDIA preset is verified by exporting the driver profile, not the registry.
    const presetVerified = id === "NvidiaControlPanelSettings" ? isCurrentNvidiaPresetVerified() : undefined;
    const status: Status = presetVerified !== undefined ? (presetVerified ? "applied" : "missing")
      : live === true ? "applied"
      : live === false ? "missing"
      : checks.length ? (checks.every(c => c.ok) ? "applied" : "missing")
      : "unverified";
    const wrong = checks.filter(c => !c.ok);
    return {
      id,
      title: tweak?.title ?? id,
      category: tweak?.category ?? "system",
      forGame: perGameIds.has(id),
      status,
      checks: status === "missing" ? wrong : [],
      missingTargets: status === "missing" ? targets.filter(t => !checkValue(t, registry?.get(regKey(t)), accepted).ok) : [],
      registry: status === "missing" && !wrong.length ? registryTarget(tweak) : null,
      history: history?.[id] ?? 0,
    };
  }).sort((a, b) => {
    const order: Record<Status, number> = { missing: 0, unverified: 1, applied: 2 };
    return order[a.status] - order[b.status] || a.title.localeCompare(b.title);
  }), [targetIds, detected, history, registry, perGameIds, accepted]);

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
      missing_values: Object.fromEntries(rows.filter(r => r.checks.length).map(r => [r.id, r.checks.map(({ key, current, needed }) => ({ key, current, needed }))])),
      recorded_history: history ?? {},
      readback_errors: { detected: detectedError, history: historyError, registry: registryError },
    });
    // osView is derived from the listed primitives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capturedAt, rows, gameId, category, hw.cpuLabel, hw.gpuName, hw.ramGB, hw.scanned, osView.caption, osView.build, osView.source, detectedError, historyError, registryError]);

  const verifiedTotal = counts.applied + counts.missing;
  const missingTargets = rows.flatMap(r => r.missingTargets);
  const copyMissing = async () => {
    try {
      await navigator.clipboard.writeText(regFile(missingTargets, t => checkValue(t, registry?.get(regKey(t)), accepted).current));
      toast({ title: "Copied", description: `${missingTargets.length} registry values as a .reg file. Nothing was changed on this PC.` });
    } catch (copyError) {
      toast({ title: "Copy failed", description: errorMessage(copyError), variant: "destructive" });
    }
  };

  return (
    <section className="rounded-xl border border-red-500/20 bg-black/25 p-4" data-testid="recorder-tweak-audit">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-red-400">
            <ClipboardList className="h-3.5 w-3.5" />
            Read-only tweak audit
          </div>
          <h3 className="mt-1 font-display text-base font-bold text-zinc-100">
            {gameLabel ? `${gameLabel} + system tweaks for this PC` : "System tweaks for this PC"}
          </h3>
          <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-zinc-500">
            Targets are the same compatible tweaks the dashboard scores, plus the detected game's own tweaks. Each tweak's
            registry values (and service startup types) are read back and compared; nothing is written.
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
          ["Verified applied", verifiedTotal ? `${counts.applied} of ${verifiedTotal}` : "—", "registry values read live"],
          ["Read at", capturedAt ? new Date(capturedAt).toLocaleTimeString() : "Not read", `${counts.unverified} without a live detector`],
        ].map(([label, value, hint]) => (
          <div key={label} className="min-w-0 rounded-lg border border-white/5 bg-zinc-950/70 px-3 py-2">
            <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">{label}</div>
            <div className="mt-1 truncate text-[12px] font-bold text-zinc-200" title={value}>{value}</div>
            <div className="truncate text-[10px] text-zinc-600">{hint}</div>
          </div>
        ))}
      </div>

      {(detectedError || historyError || registryError) && (
        <div className="mt-3 space-y-1 rounded-lg border border-amber-500/20 bg-amber-950/20 px-3 py-2 text-[11px] text-amber-300">
          <div className="flex items-center gap-2 font-bold"><AlertTriangle className="h-3.5 w-3.5" /> Readback did not complete</div>
          {detectedError && <p>Live detector: {detectedError}</p>}
          {historyError && <p>Recorded history: {historyError}</p>}
          {registryError && <p>Registry readback: {registryError}</p>}
        </div>
      )}

      {!hw.scanned && (
        <p className="mt-3 rounded-lg border border-white/5 bg-zinc-950/50 px-3 py-2 text-[11px] text-zinc-500">
          Hardware has not been scanned yet, so recommendations are not tailored to this exact PC. Run System Scan first for an exact list.
        </p>
      )}

      <div className="mt-3 max-h-80 overflow-auto rounded-lg border border-white/5">
        <div className="sticky top-0 grid grid-cols-[1fr_auto] gap-3 border-b border-white/5 bg-zinc-950 px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-zinc-600">
          <span>{counts.missing} missing · {counts.applied} applied · {counts.unverified} no live check</span>
          {missingTargets.length ? (
            <button type="button" onClick={() => void copyMissing()} data-testid="button-copy-missing-reg" className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300">
              <Copy className="h-3 w-3" /> Copy missing as .reg
            </button>
          ) : <span>Live state</span>}
        </div>
        {!rows.length ? (
          <p className="px-3 py-4 text-[11px] text-zinc-600">{detected === null && !detectedError ? "Reading this PC…" : "No eligible recommendations for this hardware."}</p>
        ) : rows.map(row => (
          <div key={row.id} className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-white/[0.035] px-3 py-2 last:border-0" data-testid={`audit-row-${row.id}`}>
            <div className="min-w-0">
              <div className="truncate text-[11px] text-zinc-200">{row.title}</div>
              <div className="truncate font-mono text-[9px] text-zinc-600">
                {row.id} · {row.forGame ? `${gameLabel ?? "game"} tweak` : row.category}{row.history ? ` · applied ${row.history}× in history` : ""}
              </div>
              {row.checks.map(check => (
                <div key={check.key} className="truncate font-mono text-[9px] text-amber-500/80" title={`${check.key}: now ${check.current}, needs ${check.needed}`}>
                  {check.key}: now {check.current} → needs {check.needed}
                </div>
              ))}
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
        Recorded history never counts as applied. "No live check" means the tweak changes something other than a fixed registry value (services, apps, power plans, hardware-dependent values), so it cannot be read back here.
      </p>
    </section>
  );
}
