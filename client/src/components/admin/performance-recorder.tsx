import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity, AlertTriangle, Check, Cpu, Download, Gamepad2, Gauge, MemoryStick, Monitor, Pencil, PlayCircle, RefreshCw, Thermometer, X, XCircle,
} from "lucide-react";
import { GAMES, KNOWN_SERVER_NAMES, type GameEntry } from "@/lib/game-library";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/api-base";
import { startForegroundPolling } from "@/lib/foreground-polling";
import {
  isNative,
  performanceCaptureStatus,
  readFpsCapture,
  readLivePerformance,
  savePerformanceRecording,
  scanHardware,
  startFpsCapture,
  startPerformanceCapture,
  stopFpsCapture,
  stopPerformanceCapture,
} from "@/lib/tauri-bridge";
import type {
  NativeFpsCaptureStatus, NativeHardwareScan, NativeLivePerformance, NativeRecordingStatus,
} from "@/lib/tauri-bridge";
import { RecorderTweakAudit, type RecorderTweakAuditSnapshot } from "@/components/admin/recorder-tweak-audit";
import { GamingModePanel } from "@/components/admin/gaming-mode-panel";

type RecorderPhase = "before" | "after";

type RecorderSample = NativeLivePerformance & {
  at: string;
  elapsed_seconds: number;
  phase: RecorderPhase;
  session_id: number;
  server_name: string | null;
  process_names: string[];
  visible_app_names: string[];
};

type RecorderError = { at: string; phase: RecorderPhase; message: string };
type RecorderServerIdentity = { target: string; name: string | null };

const STALE_AFTER_MS = 10_000;
const PRESENTMON_NOTE =
  "Downloads Intel's official PresentMon 2.3.0 console tool (about 400 KB) from GitHub once, checks its SHA-256, and keeps it in Opti Gods' app data. "
  + "It reads Windows frame-presentation events. It does not inject into the game, change settings or touch anti-cheat files. "
  + "It measures frames the game presents, which can differ slightly from an in-game FPS counter.";

export function normalizeRecorderServerTarget(raw: string | null | undefined): string | null {
  const target = raw?.trim().replace(/^["']|["']$/g, "");
  if (!target) return null;
  const joinMatch = target.match(/cfx\.re\/join\/([A-Za-z0-9]{4,8})/i);
  if (joinMatch) return joinMatch[1].toLowerCase();
  return target.replace(/^connect\s+/i, "").replace(/^https?:\/\//i, "").replace(/\/+$/, "") || null;
}

async function lookupRecorderServer(target: string): Promise<RecorderServerIdentity> {
  const cfxCode = target.match(/^[A-Za-z0-9]{4,8}$/)?.[0] ?? null;
  if (cfxCode) {
    const response = await fetch(apiUrl(`/api/fivem/server-info/${cfxCode}`), { credentials: "include" });
    if (!response.ok) return { target, name: null };
    const payload = await response.json() as { Data?: { hostname?: string } };
    return { target, name: payload.Data?.hostname?.replace(/\^\d/g, "").trim() || null };
  }
  const hostMatch = target.match(/^([^:]+)(?::(\d{1,5}))?$/);
  if (!hostMatch) return { target, name: null };
  const response = await fetch(
    apiUrl(`/api/fivem/server-info-by-host?host=${encodeURIComponent(hostMatch[1])}&port=${hostMatch[2] ?? "30120"}`),
    { credentials: "include" },
  );
  if (!response.ok) return { target, name: null };
  const payload = await response.json() as { name?: string };
  return { target, name: payload.name?.trim() || null };
}

const num = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);
const pct = (value: unknown) => (num(value) == null ? "—" : `${(value as number).toFixed(0)}%`);
const temp = (value: unknown) => (num(value) == null ? "—" : `${(value as number).toFixed(0)}°C`);

function stats(values: Array<number | null | undefined>) {
  const rows = values.filter((v): v is number => num(v) != null);
  if (!rows.length) return null;
  return {
    samples: rows.length,
    average: Math.round((rows.reduce((sum, v) => sum + v, 0) / rows.length) * 10) / 10,
    min: Math.min(...rows),
    max: Math.max(...rows),
  };
}

// Native game ids that differ from the shared library's ids.
const LIBRARY_ALIASES: Record<string, string> = { league: "game_lol", game_silenthilltownfall: "" };
const EXTRA_COVERS: Record<string, string> = {
  cs2: "/game-covers/counter-strike-2.webp",
  game_silenthilltownfall: "/game-covers/silent-hill-townfall.png",
};

/** Match the detected game to the shared game library (cover, name, per-game tweaks). */
export function findLibraryGame(live: NativeLivePerformance | null): GameEntry | null {
  if (!live?.game_running) return null;
  const id = live.game_id ? LIBRARY_ALIASES[live.game_id] ?? `game_${live.game_id}` : "";
  const byId = id ? GAMES.find(game => game.id === id) : undefined;
  if (byId) return byId;
  const process = live.game_process?.toLowerCase();
  // FiveM.exe is the launcher; the game is FiveM_*_GTAProcess and is handled by id above.
  return process ? GAMES.find(game => game.processName.toLowerCase() === process && game.id !== "game_fivem") ?? null : null;
}

const SERVER_NAMES_KEY = "og-recorder-server-names";
function readServerNames(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(SERVER_NAMES_KEY) || "{}") as Record<string, string>; } catch { return {}; }
}

/** Stable key for naming the current server: log target first, else the window-title hostname. */
function serverKey(live: NativeLivePerformance | null): string | null {
  if (!live?.game_running || live.game_id !== "fivem" || live.fivem_session_state === "main_menu") return null;
  const target = normalizeRecorderServerTarget(live.server_target);
  if (target) return target.toLowerCase();
  // Unidentified server: still allow naming it so a wrong/empty label can be fixed.
  return live.server_title ? `title:${live.server_title.toLowerCase()}` : "fivem:unidentified";
}

function fivemStatus(
  live: NativeLivePerformance | null,
  identity: RecorderServerIdentity | null,
  customName: string | null,
): string {
  if (!live?.game_running || live.game_id !== "fivem") {
    return live?.fivem_running ? "FiveM launcher open (game not started)" : "Only shown for FiveM";
  }
  if (live.fivem_session_state === "main_menu") return "FiveM main menu (not on a server)";
  if (customName) return customName;
  const target = normalizeRecorderServerTarget(live.server_target);
  const known = target ? KNOWN_SERVER_NAMES[target.replace(/:\d+$/, "").toLowerCase()] : undefined;
  return known ?? identity?.name ?? live.server_title ?? identity?.target ?? live.server_target ?? "Server not identified yet";
}

export function PerformanceRecorder() {
  const { toast } = useToast();
  const native = isNative();
  const [phase, setPhase] = useState<RecorderPhase>("before");
  const [label, setLabel] = useState("perf-test");
  const [samples, setSamples] = useState<RecorderSample[]>([]);
  const [hardware, setHardware] = useState<NativeHardwareScan | null>(null);
  const [error, setError] = useState("");
  const [recorderErrors, setRecorderErrors] = useState<RecorderError[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState<NativeRecordingStatus | null>(null);
  const [serverIdentity, setServerIdentity] = useState<RecorderServerIdentity | null>(null);
  const [liveGame, setLiveGame] = useState<NativeLivePerformance | null>(null);
  const [liveError, setLiveError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [fps, setFps] = useState<NativeFpsCaptureStatus | null>(null);
  const [fpsStarting, setFpsStarting] = useState(false);
  const [fpsError, setFpsError] = useState("");
  const [fpsConsentOpen, setFpsConsentOpen] = useState(false);
  const [tweakAudit, setTweakAudit] = useState<RecorderTweakAuditSnapshot | null>(null);
  const [serverNames, setServerNames] = useState<Record<string, string>>(() => readServerNames());
  const [editingServer, setEditingServer] = useState(false);
  const [serverDraft, setServerDraft] = useState("");
  const [failedCover, setFailedCover] = useState<string | null>(null);
  const iconCacheRef = useRef(new Map<string, string>());
  const [now, setNow] = useState(() => Date.now());
  const sessionIdRef = useRef(0);
  const mountedRef = useRef(true);
  const serverCacheRef = useRef(new Map<string, RecorderServerIdentity>());
  const serverLookupRef = useRef(new Set<string>());

  const activePhase = recording?.active ? recording.phase : null;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Freshness clock only; no Windows queries.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Resume an in-progress native recording or FPS capture after navigation.
  useEffect(() => {
    if (!native) return;
    void performanceCaptureStatus().then(status => {
      if (!mountedRef.current || !status) return;
      if (status.active) {
        sessionIdRef.current += 1;
        setRecording(status);
        if (status.latest) setLiveGame(status.latest);
      }
    }).catch(() => undefined);
    void readFpsCapture().then(status => { if (mountedRef.current && status) setFps(status); }).catch(() => undefined);
  }, [native]);

  const resolveServer = useCallback((live: NativeLivePerformance | null) => {
    const target = live?.game_id === "fivem" && live.fivem_session_state !== "main_menu"
      ? normalizeRecorderServerTarget(live.server_target)
      : null;
    if (!target) { setServerIdentity(null); return; }
    const cached = serverCacheRef.current.get(target);
    setServerIdentity(cached ?? { target, name: null });
    if (cached || serverLookupRef.current.has(target)) return;
    serverLookupRef.current.add(target);
    lookupRecorderServer(target)
      .catch(() => ({ target, name: null }))
      .then(identity => {
        serverCacheRef.current.set(target, identity);
        if (mountedRef.current) setServerIdentity(identity);
      });
  }, []);

  useEffect(() => { resolveServer(liveGame); }, [liveGame?.server_target, liveGame?.fivem_session_state, liveGame?.game_id, resolveServer]);

  const refreshLive = useCallback(async () => {
    if (!native) return;
    setRefreshing(true);
    try {
      if (recording?.active) {
        // The native recorder is already sampling; read its latest row instead of running a second scan.
        const status = await performanceCaptureStatus();
        if (!mountedRef.current || !status) return;
        setRecording(status.active ? status : null);
        if (status.latest) setLiveGame(status.latest);
        setLiveError(status.latest?.telemetry_error || status.latest_error || "");
      } else {
        const live = await readLivePerformance();
        if (!mountedRef.current) return;
        if (!live) throw new Error("Windows telemetry was unavailable.");
        setLiveGame(live);
        setLiveError(live.telemetry_error || "");
      }
    } catch (refreshError) {
      if (mountedRef.current) setLiveError(String(refreshError));
    } finally {
      if (mountedRef.current) setRefreshing(false);
    }
  }, [native, recording?.active]);

  // Foreground-only, non-overlapping. While recording, sampling happens natively
  // even when the game has focus; this only refreshes the display.
  useEffect(() => {
    if (!native) return;
    return startForegroundPolling(refreshLive, recording?.active ? 2000 : 3000);
  }, [native, recording?.active, refreshLive]);

  // Cheap FPS readout (no PowerShell) while capture is on.
  useEffect(() => {
    if (!native || !fps?.active) return;
    return startForegroundPolling(async () => {
      const status = await readFpsCapture();
      if (!mountedRef.current || !status) return;
      setFps(status);
      if (status.error) setFpsError(status.error);
    }, 1000);
  }, [native, fps?.active]);

  const enableFps = async () => {
    setFpsConsentOpen(false);
    setFpsStarting(true);
    setFpsError("");
    try {
      const status = await startFpsCapture();
      setFps(status);
      toast({
        title: "FPS counter running",
        description: status.game_pid
          ? "PresentMon is ready. The FPS tile updates every second while a game is presenting frames."
          : "PresentMon is ready. Open a game and the FPS tile will start reading.",
      });
    } catch (startError) {
      setFpsError(String(startError));
      toast({ title: "FPS counter did not start", description: String(startError), variant: "destructive" });
    } finally {
      setFpsStarting(false);
    }
  };

  const disableFps = async () => {
    try {
      await stopFpsCapture();
      setFps(await readFpsCapture());
    } catch (stopError) {
      setFpsError(String(stopError));
    }
  };

  const start = async () => {
    if (!native || activePhase || busy) return;
    setBusy(true);
    setError("");
    try {
      if (!hardware) {
        try {
          setHardware(await scanHardware());
        } catch (scanError) {
          setError(`Hardware snapshot unavailable: ${String(scanError)}`);
        }
      }
      const status = await startPerformanceCapture(phase);
      sessionIdRef.current += 1;
      setRecording(status);
    } catch (startError) {
      setError(String(startError));
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    if (!activePhase || busy) return;
    setBusy(true);
    try {
      const result = await stopPerformanceCapture();
      const sessionId = sessionIdRef.current;
      const rows: RecorderSample[] = result.samples.map(sample => {
        const target = normalizeRecorderServerTarget(sample.server_target);
        const sampledAt = sample.sampled_at_ms ?? result.started_at_ms;
        return {
          ...sample,
          at: new Date(sampledAt).toISOString(),
          elapsed_seconds: Math.round((sampledAt - result.started_at_ms) / 100) / 10,
          phase: result.phase,
          session_id: sessionId,
          server_name: (() => {
            const key = serverKey(sample);
            return (key ? serverNames[key] : null)
              ?? (target ? KNOWN_SERVER_NAMES[target.replace(/:\d+$/, "").toLowerCase()] ?? serverCacheRef.current.get(target)?.name : null)
              ?? sample.server_title ?? null;
          })(),
          process_names: (sample.process_names_text ?? "").split(/\r?\n/).filter(Boolean),
          visible_app_names: (sample.visible_app_names_text ?? "").split(/\r?\n/).filter(Boolean),
        };
      });
      const telemetryIssues = result.samples
        .filter(sample => sample.telemetry_error)
        .map(sample => ({ at: new Date(sample.sampled_at_ms ?? Date.now()).toISOString(), phase: result.phase, message: sample.telemetry_error as string }));
      const nextSamples = [...samples, ...rows];
      const nextErrors = [
        ...recorderErrors,
        ...result.errors.map(item => ({ at: new Date(item.at_ms).toISOString(), phase: result.phase, message: item.message })),
        ...telemetryIssues,
      ];
      const nextTruncated = truncated || result.truncated;
      setSamples(nextSamples);
      setRecorderErrors(nextErrors);
      setTruncated(nextTruncated);
      setRecording(null);
      // Save automatically to Downloads so every before/after run is on disk.
      const path = await saveRecording(nextSamples, nextErrors, nextTruncated, result.phase);
      toast({
        title: `${result.phase === "before" ? "Before" : "After"} recording saved`,
        description: path ? `${rows.length} samples · saved to ${path}` : `${rows.length} samples captured, but the file could not be saved.`,
        variant: path ? undefined : "destructive",
      });
    } catch (stopError) {
      setError(String(stopError));
    } finally {
      setBusy(false);
    }
  };

  const sessionSummary = (rows: RecorderSample[]) => ({
    samples: rows.length,
    started_at: rows[0]?.at ?? null,
    ended_at: rows.at(-1)?.at ?? null,
    cpu_load_pct: stats(rows.map(r => r.cpu_load_pct)),
    gpu_load_pct: stats(rows.map(r => r.gpu_load_pct)),
    ram_used_pct: stats(rows.map(r => r.ram_used_pct)),
    cpu_temp_c: stats(rows.map(r => r.cpu_temp_c)),
    gpu_temp_c: stats(rows.map(r => r.gpu_temp_c)),
    presented_fps_2s_windows: stats(rows.map(r => r.fps)),
    frame_time_ms_2s_windows: stats(rows.map(r => r.frame_time_ms)),
    running_processes_count: stats(rows.map(r => r.running_processes_count)),
    visible_apps_count: stats(rows.map(r => r.visible_apps_count)),
    game_detected_samples: rows.filter(r => r.game_running).length,
    fivem_server_samples: rows.filter(r => r.fivem_session_state === "server").length,
    fivem_main_menu_samples: rows.filter(r => r.fivem_session_state === "main_menu").length,
    game_labels: Array.from(new Set(rows.map(r => r.game_label).filter(Boolean))),
    server_targets: Array.from(new Set(rows.map(r => r.server_target).filter(Boolean))),
    server_names: Array.from(new Set(rows.map(r => r.server_name).filter(Boolean))),
    process_name_union: Array.from(new Set(rows.flatMap(r => r.process_names))),
  });

  /** Writes the combined before/after file to Downloads; returns the path or null after a failure toast. */
  const saveRecording = async (
    allSamples: RecorderSample[], allErrors: RecorderError[], wasTruncated: boolean, phaseTag: RecorderPhase | "combined",
  ): Promise<string | null> => {
    setSaving(true);
    try {
      const samples = allSamples;
      const recorderErrors = allErrors;
      const truncated = wasTruncated;
      const latest = samples.at(-1) ?? null;
      const content = JSON.stringify({
        schema_version: 3,
        recorder: "Opti Gods admin performance recorder",
        label: label.trim() || "perf-test",
        created_at: new Date().toISOString(),
        app_mode: "native-admin-only",
        note: "Native sampling every 2 seconds, continuing while the game has focus. FPS is presented frames measured by PresentMon over a 2-second window when FPS capture was enabled; otherwise it is null, never estimated. FiveM server state comes from current-session CitizenFX log events; in-server script menus are not observable.",
        windows: { caption: latest?.os_caption ?? null, version: latest?.os_version ?? null, build: latest?.os_build ?? null },
        hardware,
        tweak_audit: tweakAudit,
        fps_capture: { active: Boolean(fps?.active), source: fps?.source ?? null, last_error: fpsError || fps?.error || null },
        errors: recorderErrors,
        error_count: recorderErrors.length,
        truncated,
        sessions: {
          before: sessionSummary(samples.filter(s => s.phase === "before")),
          after: sessionSummary(samples.filter(s => s.phase === "after")),
        },
        samples,
      }, null, 2);
      const safeLabel = (label.trim() || "perf-test").replace(/[^A-Za-z0-9_-]+/g, "-").slice(0, 40);
      const filename = `OptiGods-Performance-Recording-${safeLabel}-${phaseTag}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      return await savePerformanceRecording(filename, content);
    } catch (saveError) {
      toast({ title: "Recording could not be saved to Downloads", description: String(saveError), variant: "destructive" });
      return null;
    } finally {
      setSaving(false);
    }
  };

  const download = async () => {
    if (!samples.length || saving) return;
    const path = await saveRecording(samples, recorderErrors, truncated, "combined");
    if (path) toast({ title: "Recording saved", description: `Saved to ${path}` });
  };

  const onAuditSnapshot = useCallback((snapshot: RecorderTweakAuditSnapshot) => setTweakAudit(snapshot), []);

  const ageMs = liveGame?.sampled_at_ms ? Math.max(0, now - liveGame.sampled_at_ms) : null;
  const stale = ageMs == null || ageMs > STALE_AFTER_MS;
  const libraryGame = findLibraryGame(liveGame);
  const gameStatus = liveGame?.game_running
    ? (liveGame.game_id === "unlisted" && libraryGame ? libraryGame.name : liveGame.game_label) || "Game detected"
    : "Game not detected";
  const currentServerKey = serverKey(liveGame);
  const customServerName = currentServerKey ? serverNames[currentServerKey] ?? null : null;
  const serverStatus = fivemStatus(liveGame, serverIdentity, customServerName);
  const saveServerName = () => {
    if (!currentServerKey) return;
    const name = serverDraft.trim().slice(0, 60);
    const next = { ...serverNames };
    if (name) next[currentServerKey] = name; else delete next[currentServerKey];
    setServerNames(next);
    try { localStorage.setItem(SERVER_NAMES_KEY, JSON.stringify(next)); } catch { /* storage full or blocked: name lasts this session */ }
    setEditingServer(false);
  };
  const fpsHint = !fps?.active ? "Enable below"
    : fps.fps_status === "measured" && fps.frame_time_ms != null ? `${fps.frame_time_ms.toFixed(1)} ms frame time`
      : fps.frame_column_missing ? "PresentMon format not recognised"
        : fps.fps_status === "no_recent_frames"
          ? (fps.frames_seen ? `No frames from this game · ${fps.frames_seen} from other apps` : "PresentMon has not seen any frames yet")
          : "Presented frames";
  const fpsValue = fps?.active ? fps.fps : liveGame?.fps ?? null;
  const fpsText = fps?.active
    ? fps.fps_status === "measured" && fpsValue != null ? `${Math.round(fpsValue)}`
      : fps.fps_status === "no_game" ? "No game"
        : "No frames"
    : "Off";
  const beforeCount = samples.filter(s => s.phase === "before").length;
  const afterCount = samples.filter(s => s.phase === "after").length;
  // Unlisted games: the .exe icon arrives in the latest sample only; keep it per process.
  if (liveGame?.game_process && liveGame.game_icon_png_base64) {
    iconCacheRef.current.set(liveGame.game_process, `data:image/png;base64,${liveGame.game_icon_png_base64}`);
  }
  const gameCoverUrl = !liveGame?.game_running ? undefined
    : libraryGame?.coverUrl
      ?? (liveGame.game_id ? EXTRA_COVERS[liveGame.game_id] : undefined)
      ?? (liveGame.game_process ? iconCacheRef.current.get(liveGame.game_process) : undefined);
  const detectionNote = liveGame?.game_detection === "library_path" ? " · found in a game library folder"
    : liveGame?.game_detection === "gpu_usage" ? " · found by GPU use" : "";

  return (
    <div className="space-y-4" data-testid="admin-performance-recorder">
      <div className="rounded-xl border border-red-500/20 bg-red-950/10 p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-red-400 text-[10px] font-bold uppercase tracking-widest">
              <Activity className="w-4 h-4" />
              Admin-only PC performance recorder
            </div>
            <h2 className="mt-2 text-xl font-display font-bold text-white">Before / After capture</h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-zinc-400">
              Works with any game. Record the same test before and after changes. Recording runs inside the Windows app, so it keeps sampling while the game is fullscreen.
            </p>
          </div>
          <span className={cn(
            "rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest",
            native ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-amber-500/30 bg-amber-500/10 text-amber-400",
          )}>
            {native ? "Windows native build" : "Preview only"}
          </span>
        </div>

        {!native ? (
          <div className="rounded-lg border border-amber-500/20 bg-amber-950/20 px-3 py-2 text-xs text-amber-300">
            Install the Windows executable to collect real hardware telemetry. The browser preview only shows the admin UI.
          </div>
        ) : (
          <>
            <GamingModePanel />

            <div data-testid="live-game-menu" className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/40">
                    {gameCoverUrl && failedCover !== gameCoverUrl
                      ? <img src={gameCoverUrl} alt="" className="h-full w-full object-cover" onError={() => setFailedCover(gameCoverUrl)} />
                      : <Gamepad2 className="h-6 w-6 text-zinc-600" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-500">Live game</span>
                      <span
                        data-testid="status-live-freshness"
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest",
                          stale ? "bg-amber-500/10 text-amber-400" : "bg-emerald-500/10 text-emerald-400",
                        )}
                      >
                        {ageMs == null ? "No reading yet" : stale ? `Stale · ${Math.round(ageMs / 1000)}s old` : `Live · ${Math.round(ageMs / 1000)}s ago`}
                      </span>
                    </div>
                    <h3 className="mt-1 truncate text-lg font-display font-bold text-white" data-testid="text-live-game">
                      {refreshing && !liveGame ? "Checking…" : gameStatus}
                    </h3>
                    <p className="truncate text-[11px] text-zinc-500">
                      {liveGame?.game_process
                        ? `Detected from ${liveGame.game_process}${liveGame.game_pid ? ` · PID ${liveGame.game_pid}` : ""}${detectionNote}`
                        : liveGame?.fivem_running ? "FiveM is open, but the game process is not running" : "No game detected. Open any game and it shows here."}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  data-testid="button-refresh-live-game"
                  onClick={() => void refreshLive()}
                  disabled={refreshing}
                  className="flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:cursor-wait disabled:opacity-60"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
                  Refresh
                </button>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-white/5 bg-black/25 px-3 py-2">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">FiveM server / menu</div>
                  {editingServer ? (
                    <form className="mt-1 flex items-center gap-1" onSubmit={event => { event.preventDefault(); saveServerName(); }}>
                      <input
                        autoFocus
                        value={serverDraft}
                        onChange={event => setServerDraft(event.target.value)}
                        maxLength={60}
                        placeholder="Server name"
                        data-testid="input-server-name"
                        className="h-7 min-w-0 flex-1 rounded border border-white/10 bg-black/60 px-2 text-sm text-white outline-none focus:border-emerald-500/50"
                      />
                      <button type="submit" aria-label="Save server name" data-testid="button-save-server-name" className="rounded p-1 text-emerald-400 hover:bg-emerald-500/10"><Check className="h-4 w-4" /></button>
                      <button type="button" aria-label="Cancel" onClick={() => setEditingServer(false)} className="rounded p-1 text-zinc-500 hover:bg-white/5"><X className="h-4 w-4" /></button>
                    </form>
                  ) : (
                    <div className="mt-1 flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-sm font-bold text-white" data-testid="text-fivem-server">{serverStatus}</span>
                      {currentServerKey && (
                        <button
                          type="button"
                          aria-label="Rename server"
                          title="Set your own name for this server (saved on this PC)"
                          data-testid="button-rename-server"
                          onClick={() => { setServerDraft(customServerName ?? serverStatus); setEditingServer(true); }}
                          className="shrink-0 rounded p-1 text-zinc-500 hover:bg-white/5 hover:text-white"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                  {liveGame?.game_id === "fivem" && liveGame.server_evidence && (
                    <div className="mt-0.5 truncate text-[10px] text-zinc-600" title={liveGame.server_evidence}>{liveGame.server_evidence}</div>
                  )}
                </div>
                <div className="rounded-lg border border-white/5 bg-black/25 px-3 py-2">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Windows</div>
                  <div className="mt-1 truncate text-sm font-bold text-white" data-testid="text-live-os">
                    {liveGame?.os_caption ? `${liveGame.os_caption.replace(/^Microsoft\s+/i, "")} · build ${liveGame.os_build ?? "?"}` : "—"}
                  </div>
                </div>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {([
                  ["FPS", fpsText, Gauge, fpsHint],
                  ["CPU load", pct(liveGame?.cpu_load_pct), Cpu, ""],
                  ["GPU load", pct(liveGame?.gpu_load_pct), Monitor, ""],
                  ["RAM", pct(liveGame?.ram_used_pct), MemoryStick, num(liveGame?.ram_total_gb) != null && num(liveGame?.ram_free_gb) != null ? `${((liveGame!.ram_total_gb as number) - (liveGame!.ram_free_gb as number)).toFixed(1)} / ${(liveGame!.ram_total_gb as number).toFixed(0)} GB` : ""],
                  ["CPU temp", temp(liveGame?.cpu_temp_c), Thermometer, ""],
                  ["GPU temp", temp(liveGame?.gpu_temp_c), Thermometer, ""],
                ] as const).map(([name, value, Icon, hint]) => (
                  <div key={name} className="rounded-lg border border-white/5 bg-black/30 px-3 py-2" data-testid={`live-metric-${name.toLowerCase().replace(/\s+/g, "-")}`}>
                    <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-zinc-600"><Icon className="h-3 w-3" />{name}</div>
                    <div className={cn("mt-1 font-mono text-lg font-bold", value === "—" || value === "Off" ? "text-zinc-600" : "text-white")}>{value}</div>
                    {hint && <div className="truncate text-[10px] text-zinc-600">{hint}</div>}
                  </div>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {fps?.active ? (
                  <Button size="sm" variant="outline" data-testid="button-stop-fps" onClick={() => void disableFps()} className="border-zinc-700 text-zinc-200 hover:bg-zinc-800">
                    Stop FPS counter
                  </Button>
                ) : (
                  <Button size="sm" data-testid="button-enable-fps" disabled={fpsStarting} onClick={() => setFpsConsentOpen(true)} className="bg-emerald-600 text-white hover:bg-emerald-500">
                    {fpsStarting ? "Downloading and starting PresentMon…" : "Enable FPS counter"}
                  </Button>
                )}
                <span className="text-[10px] text-zinc-600">
                  {recording?.active ? "Display refreshes every 2 s from the native recorder." : "Checks Windows every 3 s while this window is focused."}
                </span>
              </div>
              {fpsConsentOpen && (
                <div className="mt-2 rounded-lg border border-emerald-500/20 bg-black/40 p-3 text-[11px] leading-relaxed text-zinc-300" data-testid="panel-fps-consent">
                  {PRESENTMON_NOTE}
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" data-testid="button-confirm-fps" disabled={fpsStarting} onClick={() => void enableFps()} className="bg-emerald-600 text-white hover:bg-emerald-500">Download and start</Button>
                    <Button size="sm" variant="outline" onClick={() => setFpsConsentOpen(false)} className="border-zinc-700 text-zinc-300">Cancel</Button>
                  </div>
                </div>
              )}
              {(fpsError || liveError) && (
                <div className="mt-2 space-y-1 text-[10px] text-amber-400">
                  {fpsError && <p data-testid="text-fps-error">FPS: {fpsError}</p>}
                  {liveError && <p data-testid="text-telemetry-error">Telemetry: {liveError}</p>}
                </div>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                Test label
                <input
                  data-testid="input-performance-recording-label"
                  value={label}
                  onChange={event => setLabel(event.target.value)}
                  disabled={Boolean(activePhase)}
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-black px-3 py-2 text-sm font-normal normal-case tracking-normal text-white outline-none focus:border-red-500/50"
                  placeholder="perf-test"
                />
              </label>
              <div className="flex items-end gap-2">
                {(["before", "after"] as RecorderPhase[]).map(option => (
                  <button
                    key={option}
                    type="button"
                    data-testid={`button-recording-phase-${option}`}
                    onClick={() => setPhase(option)}
                    disabled={Boolean(activePhase)}
                    className={cn(
                      "rounded-lg border px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                      phase === option ? "border-red-500/50 bg-red-600 text-white" : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500",
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!activePhase ? (
                <Button data-testid="button-start-performance-recording" disabled={busy} onClick={() => void start()} className="gap-2 bg-red-600 font-bold text-white hover:bg-red-500">
                  <PlayCircle className="w-4 h-4" />
                  Start {phase} recording
                </Button>
              ) : (
                <Button data-testid="button-stop-performance-recording" disabled={busy} onClick={() => void stop()} className="gap-2 bg-zinc-100 font-bold text-black hover:bg-white">
                  <XCircle className="w-4 h-4" />
                  {busy ? "Stopping…" : `Stop ${activePhase} recording`}
                </Button>
              )}
              <Button
                data-testid="button-download-performance-recording"
                onClick={() => void download()}
                disabled={!samples.length || Boolean(activePhase) || saving}
                variant="outline"
                className="gap-2 border-zinc-700 text-zinc-200 hover:bg-zinc-800"
              >
                <Download className="w-4 h-4" />
                {saving ? "Saving…" : "Download recording file"}
              </Button>
              <span className="text-[11px] text-zinc-500">
                {activePhase
                  ? `Recording ${activePhase}: ${recording?.sample_count ?? 0} samples (every 2 s)${recording?.error_count ? ` · ${recording.error_count} errors` : ""}`
                  : "Each recording saves to your Downloads folder when you stop it."}
              </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              {[
                ["Before samples", beforeCount],
                ["After samples", afterCount],
                ["Recorder issues", recorderErrors.length],
              ].map(([name, value]) => (
                <div key={String(name)} className="rounded-lg border border-white/5 bg-black/30 px-3 py-2">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">{name}</div>
                  <div className="mt-1 font-mono text-sm font-bold text-zinc-200">{value}</div>
                </div>
              ))}
            </div>
            {error && <p className="text-xs text-amber-400" data-testid="text-recorder-error">{error}</p>}
            {recorderErrors.length > 0 && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-950/20 px-3 py-2 text-xs text-amber-300">
                <div className="flex items-center gap-2 font-bold"><AlertTriangle className="h-3.5 w-3.5" />{recorderErrors.length} recorder issue{recorderErrors.length === 1 ? "" : "s"} recorded</div>
                <div className="mt-1 truncate text-amber-400/80">{recorderErrors.at(-1)?.message}</div>
              </div>
            )}

            <RecorderTweakAudit
              gameId={liveGame?.game_running ? liveGame.game_id ?? null : null}
              libraryGameId={libraryGame?.id ?? null}
              gameLabel={liveGame?.game_running ? gameStatus : null}
              liveOs={liveGame?.os_caption ? { caption: liveGame.os_caption, version: liveGame.os_version, build: liveGame.os_build } : null}
              onSnapshot={onAuditSnapshot}
            />

            <p className="text-[11px] leading-relaxed text-zinc-600">
              The file contains Windows version, hardware, the tweak audit, CPU/GPU/RAM load and temperatures, FPS when the counter is on,
              process and visible-app names, FiveM server or main-menu state, and recorder errors. It stays on this PC.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
