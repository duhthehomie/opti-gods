import { apiUrl } from "@/lib/api-base";
import { applyTweak, cancelNvidiaPresetImport, createRestorePoint, detectAppliedTweaks, getNativeAuthToken, getRecordedAppliedTweaks, importNvidiaPreset, isNative, listenScriptTweakProgress, resetNvidiaPresetImportCancel, runTrustedScriptTweak } from "@/lib/tauri-bridge";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { getTweakCompatibility } from "@/lib/tweak-compatibility";
import { getNativeAuthHeaders, getPersistentDeviceId, PRO_SESSION_KEY } from "@/lib/queryClient";
import { NATIVE_RESTORE_CREATED_KEY } from "@/lib/native-readiness";
import { getCompatibilitySkipMessage } from "@/lib/tweak-run-outcome";
import { NVIDIA_PRESET_REQUEUE_RELEASE_KEY, isCurrentNvidiaPresetVerified } from "@/lib/nvidia-preset-eligibility";
import { FREE_NATIVE_TWEAK_LIMIT, NATIVE_TWEAK_ID_SET } from "@shared/native-tweak-ids";

const NATIVE_UNDO_KEY = "optigods-native-undo-tokens";
export const NATIVE_RUN_QUEUE_KEY = "optigods-native-run-queue";
export const NATIVE_RUN_FORCE_KEY = "optigods-native-run-force";
export const NATIVE_RUN_SKIPPED_KEY = "optigods-native-run-skipped";
export const NATIVE_RUN_SKIP_MESSAGES_KEY = "optigods-native-run-skip-messages";
export const NATIVE_RUN_STATE_KEY = "optigods-native-run-state";
export const NVIDIA_PRESET_ACTION_ID = "NvidiaControlPanelSettings";
const NVIDIA_PRESET_TICKET_ID = "ImportNvidiaPresetPro";
const SCRIPT_ONLY_EXCLUDED_IDS = new Set([NVIDIA_PRESET_ACTION_ID, NVIDIA_PRESET_TICKET_ID, "OpenMsiUtilityPro"]);
const NATIVE_RUN_EVENT = "optigods:native-run-state";
const NATIVE_REQUEST_TIMEOUT_MS = 30_000;
const NATIVE_EXECUTION_TIMEOUT_MS = 90_000;

function isRunActionCompatible(id: string, native: boolean) {
  if (native && id === NVIDIA_PRESET_ACTION_ID) return true;
  return getTweakCompatibility(id).ok;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      value => { window.clearTimeout(timer); resolve(value); },
      error => { window.clearTimeout(timer); reject(error); },
    );
  });
}

function getThrownMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error.trim();
  if (error && typeof error === "object") {
    const details = error as Record<string, unknown>;
    for (const key of ["message", "error", "reason"]) {
      const value = details[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return fallback;
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  message: string,
): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new Error(message);
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * Only a tweak currently reported by the native Windows detector can be
 * reconciled into the server's free active-tweak ledger. Browser app history
 * can skip a rerun, but is not proof for server-side allowance accounting.
 */
async function reconcileConfirmedNativeTweak(id: string): Promise<void> {
  const authorization = await fetchWithTimeout(
    apiUrl("/api/performance-allowance/native-confirmed"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getNativeAuthHeaders() },
      body: JSON.stringify({
        tweakId: id,
        sessionToken: localStorage.getItem(PRO_SESSION_KEY) ?? undefined,
      }),
    },
    NATIVE_REQUEST_TIMEOUT_MS,
    `OG-NET-004 · Allowance sync timed out for ${id}.`,
  );
  const authorizationBody = await authorization.json().catch(() => ({})) as { error?: string; code?: string };
  if (!authorization.ok) {
    throw new Error(`${authorizationBody.code || `OG-HTTP-${authorization.status}`} · ${authorizationBody.error || "Allowance sync was rejected."}`);
  }
}

export type TweakRunProgress = {
  id: string;
  index: number;
  total: number;
  status: "queued" | "running" | "applied" | "skipped" | "failed" | "stopped";
  message?: string;
};

export type NativeTweakRunState = {
  runId: string;
  ids: string[];
  items: TweakRunProgress[];
  status: "running" | "stopping" | "completed" | "stopped" | "failed";
  startedAt: number;
  lastProgressAt?: number;
  finishedAt?: number;
  stopRequested?: boolean;
};

export type TweakBatchOptions = {
  /** Re-run these IDs even when detection or successful app history says applied. */
  forceReapplyIds?: readonly string[];
  /** IDs excluded by the pre-navigation hardware compatibility check. */
  initialSkippedIds?: readonly string[];
  /** User-facing reasons for items deliberately recorded as skipped. */
  initialSkippedMessages?: Readonly<Record<string, string>>;
  /** Optional UI source label for analytics and run history. */
  source?: string;
};

let activeRunPromise: Promise<BulkTweakResult> | null = null;
let stopRequested = false;

export function hasNativeTweakRunInFlight(): boolean {
  return activeRunPromise !== null;
}

function dispatchRunState() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(NATIVE_RUN_EVENT));
}

function readRunStateSafely(): NativeTweakRunState | null {
  try {
    const raw = localStorage.getItem(NATIVE_RUN_STATE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as NativeTweakRunState;
    return value && Array.isArray(value.items) && Array.isArray(value.ids) ? value : null;
  } catch {
    return null;
  }
}

function writeRunState(state: NativeTweakRunState) {
  try { localStorage.setItem(NATIVE_RUN_STATE_KEY, JSON.stringify({ ...state, lastProgressAt: Date.now() })); } catch { /* best effort */ }
  dispatchRunState();
}

export function readNativeTweakRun(): NativeTweakRunState | null {
  return readRunStateSafely();
}

export function recordScriptTweakProgress(id: string, message: string): void {
  const state = readRunStateSafely();
  if (!state || !state.items.some(item => item.id === id)) return;
  writeRunState({
    ...state,
    status: "running",
    finishedAt: undefined,
    error: undefined,
    stopRequested: false,
    items: state.items.map(item => item.id === id
      ? { ...item, status: "running", message }
      : item),
  });
}

export function recordScriptTweakResult(
  id: string,
  status: "applied" | "skipped" | "failed",
  message: string,
): void {
  const state = readRunStateSafely();
  if (!state || !state.items.some(item => item.id === id)) return;
  const items = state.items.map(item => item.id === id ? { ...item, status, message } : item);
  writeRunState({
    ...state,
    items,
    status: items.some(item => item.status === "running" || item.status === "queued")
      ? "running" : items.some(item => item.status === "failed") ? "failed" : "completed",
    finishedAt: items.some(item => item.status === "running" || item.status === "queued") ? undefined : Date.now(),
  });
}

export function isScriptOnlyTweakId(id: string): boolean {
  return !NATIVE_TWEAK_ID_SET.has(id) && !SCRIPT_ONLY_EXCLUDED_IDS.has(id);
}

export async function runScriptOnlyTweak(
  id: string,
  onProgress?: (message: string) => void,
): Promise<string> {
  if (!isNative()) throw new Error("Script-only tweaks can run only in the Opti Gods Windows app.");
  if (!isScriptOnlyTweakId(id)) throw new Error("This action does not use the script-only runner.");
  const nativeAuth = await getNativeAuthToken();
  const proSession = localStorage.getItem(PRO_SESSION_KEY);
  const deviceId = getPersistentDeviceId();
  if (!nativeAuth && !proSession) {
    throw new Error("Sign in to your Pro account in the Windows app before running this script.");
  }
  const unlisten = await listenScriptTweakProgress(payload => {
    if (payload.id === id) onProgress?.(payload.message);
  });
  try {
    const message = await runTrustedScriptTweak(id, nativeAuth, proSession, deviceId);
    useOptimizationStore.getState().markApplied([id]);
    return message;
  } finally {
    await unlisten();
  }
}

export function isNativeTweakRunStuck(state: NativeTweakRunState | null, now = Date.now()): boolean {
  if (!state || (state.status !== "running" && state.status !== "stopping")) return false;
  const lastProgress = state.lastProgressAt ?? state.startedAt;
  if (state.status === "stopping" || state.stopRequested) return now - lastProgress >= 8_000;
  const current = state.items.find(item => item.status === "running");
  const threshold = current?.id === NVIDIA_PRESET_ACTION_ID ? 30_000 : 120_000;
  if (!hasNativeTweakRunInFlight() && !current) return true;
  return now - lastProgress >= threshold;
}

export async function recoverStuckNativeTweakRun(
  force = false,
): Promise<{ recovered: boolean; reason?: string }> {
  const state = readRunStateSafely();
  if (!state || (state.status !== "running" && state.status !== "stopping")) {
    return { recovered: false, reason: "There is no stuck Windows run to recover." };
  }
  if (!force && !isNativeTweakRunStuck(state)) {
    return { recovered: false, reason: "The Windows run is still making progress." };
  }
  const orphanedNvidiaImport = !hasNativeTweakRunInFlight()
    && state.items.some(item => item.id === NVIDIA_PRESET_ACTION_ID && item.status === "running");
  stopNativeTweakRun();
  if (orphanedNvidiaImport) {
    await cancelNvidiaPresetImport().catch(() => {});
    await new Promise(resolve => window.setTimeout(resolve, 250));
  }
  const deadline = Date.now() + 8_000;
  while (hasNativeTweakRunInFlight() && Date.now() < deadline) {
    await new Promise(resolve => window.setTimeout(resolve, 100));
  }
  if (hasNativeTweakRunInFlight()) {
    return { recovered: false, reason: "Windows is still stopping the current action. Refresh State again in a few seconds." };
  }
  const latest = readRunStateSafely();
  if (!latest) return { recovered: false, reason: "The saved Windows run state could not be read." };
  const items = latest.items.map(item =>
    item.status === "running" || item.status === "queued"
      ? { ...item, status: "stopped" as const, message: "Recovered from a stuck run. Retry this tweak to try again." }
      : item,
  );
  writeRunState({
    ...latest,
    items,
    status: "stopped",
    stopRequested: true,
    finishedAt: Date.now(),
  });
  clearQueuedTweakBatch();
  return { recovered: true };
}

/** A utility launch is not an applied Windows tweak. Retain failures for export. */
export function recordNativeToolResult(id: string, message: string, success: boolean): boolean {
  if (hasNativeTweakRunInFlight()) return false;
  const timestamp = Date.now();
  const state: NativeTweakRunState = {
    runId: `tool-${timestamp}`, ids: [id], startedAt: timestamp, finishedAt: timestamp,
    status: success ? "completed" : "failed",
    items: [{ id, index: 0, total: 1, status: success ? "skipped" : "failed", message }],
  };
  localStorage.setItem(NATIVE_RUN_STATE_KEY, JSON.stringify(state));
  window.dispatchEvent(new Event(NATIVE_RUN_EVENT));
  return true;
}

export function subscribeNativeTweakRun(listener: (state: NativeTweakRunState | null) => void): () => void {
  const handler = () => listener(readRunStateSafely());
  window.addEventListener(NATIVE_RUN_EVENT, handler);
  return () => window.removeEventListener(NATIVE_RUN_EVENT, handler);
}

function beginPersistedRun(
  ids: string[],
  skippedIds: readonly string[] = [],
  skippedMessages: Readonly<Record<string, string>> = {},
): string {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const skipped = new Set(skippedIds);
  stopRequested = false;
  writeRunState({
    runId,
    ids,
    items: ids.map((id, index) => ({
      id,
      index,
      total: ids.length,
      status: skipped.has(id) ? "skipped" : "queued",
      ...(skipped.has(id) ? {
        message: skippedMessages[id] || getTweakCompatibility(id).reason || "This tweak was excluded by the hardware compatibility check.",
      } : {}),
    })),
    status: "running",
    startedAt: Date.now(),
  });
  return runId;
}

function updatePersistedProgress(runId: string, progress: TweakRunProgress) {
  const state = readRunStateSafely();
  if (!state || state.runId !== runId) return;
  writeRunState({
    ...state,
    items: state.items.map(item => item.id === progress.id ? progress : item),
  });
}

function finishPersistedRun(runId: string, result?: BulkTweakResult, error?: unknown) {
  const state = readRunStateSafely();
  if (!state || state.runId !== runId) return;
  const stopped = Boolean(state.stopRequested || stopRequested);
  writeRunState({
    ...state,
    status: error || result?.failures.length ? "failed" : stopped ? "stopped" : "completed",
    finishedAt: Date.now(),
    stopRequested: stopped,
    items: error
      ? state.items.map(item => item.status === "applied" || item.status === "skipped" || item.status === "failed" || item.status === "stopped"
        ? item
        : { ...item, status: "failed", message: getThrownMessage(error, "The runner stopped unexpectedly.") })
      : state.items,
  });
  void result;
}

export function stopNativeTweakRun(): boolean {
  const state = readRunStateSafely();
  if (!state || (state.status !== "running" && state.status !== "stopping")) return false;
  stopRequested = true;
  writeRunState({ ...state, status: "stopping", stopRequested: true });
  if (state.items.some(item => item.id === NVIDIA_PRESET_ACTION_ID && item.status === "running")) {
    void cancelNvidiaPresetImport().catch(error => {
      console.error("[native-runner] Could not cancel NVIDIA Profile Inspector:", error);
    });
  }
  return true;
}

export function queueTweakBatch(
  ids: readonly string[],
  options: TweakBatchOptions = {},
  skippedIds: readonly string[] = [],
) {
  localStorage.setItem(NATIVE_RUN_QUEUE_KEY, JSON.stringify(Array.from(new Set(ids))));
  localStorage.setItem(NATIVE_RUN_FORCE_KEY, JSON.stringify(Array.from(new Set(options.forceReapplyIds ?? []))));
  localStorage.setItem(NATIVE_RUN_SKIPPED_KEY, JSON.stringify(Array.from(new Set(skippedIds))));
  localStorage.setItem(NATIVE_RUN_SKIP_MESSAGES_KEY, JSON.stringify(options.initialSkippedMessages ?? {}));
}

export function readQueuedTweakBatch(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(NATIVE_RUN_QUEUE_KEY) || "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function readQueuedTweakBatchSkippedIds(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(NATIVE_RUN_SKIPPED_KEY) || "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function readQueuedTweakBatchOptions(): TweakBatchOptions {
  try {
    const value = JSON.parse(localStorage.getItem(NATIVE_RUN_FORCE_KEY) || "[]");
    const rawMessages = JSON.parse(localStorage.getItem(NATIVE_RUN_SKIP_MESSAGES_KEY) || "{}");
    return {
      forceReapplyIds: Array.isArray(value)
        ? value.filter((id): id is string => typeof id === "string")
        : [],
      initialSkippedMessages: rawMessages && typeof rawMessages === "object" && !Array.isArray(rawMessages)
        ? Object.fromEntries(Object.entries(rawMessages).filter((entry): entry is [string, string] =>
          typeof entry[0] === "string" && typeof entry[1] === "string"))
        : {},
    };
  } catch {
    return {};
  }
}

export function clearQueuedTweakBatch() {
  localStorage.removeItem(NATIVE_RUN_QUEUE_KEY);
  localStorage.removeItem(NATIVE_RUN_FORCE_KEY);
  localStorage.removeItem(NATIVE_RUN_SKIPPED_KEY);
  localStorage.removeItem(NATIVE_RUN_SKIP_MESSAGES_KEY);
}

function saveUndoToken(id: string, token: string | null) {
  try {
    const all = JSON.parse(localStorage.getItem(NATIVE_UNDO_KEY) || "{}") as Record<string, string>;
    if (token) all[id] = token;
    localStorage.setItem(NATIVE_UNDO_KEY, JSON.stringify(all));
  } catch {
    // Applied state remains available for this session even if local storage is unavailable.
  }
}

export type BulkTweakResult = {
  appliedIds: string[];
  selectedIds: string[];
  unsupportedIds: string[];
  skippedIds: string[];
  failures: { id: string; message: string }[];
  stoppedIds?: string[];
};

export async function applyTweakBatch(
  ids: readonly string[],
  onProgress?: (progress: TweakRunProgress) => void,
  options: TweakBatchOptions = {},
): Promise<BulkTweakResult> {
  const uniqueIds = Array.from(new Set(ids));
  const initialSkippedIds = Array.from(new Set(options.initialSkippedIds ?? []))
    .filter(id => !uniqueIds.includes(id));
  const batchIds = Array.from(new Set([...uniqueIds, ...initialSkippedIds]));
  const native = isNative();
  if (native && window.location.pathname === "/applied-tweaks") {
    if (activeRunPromise) return activeRunPromise;
    if (batchIds.includes(NVIDIA_PRESET_ACTION_ID)) {
      await resetNvidiaPresetImportCancel();
    }
    const runId = beginPersistedRun(batchIds, initialSkippedIds, options.initialSkippedMessages);
    const runOptions = initialSkippedIds.length ? { ...options, initialSkippedIds } : options;
    const promise = applyTweakBatchInternal(uniqueIds, onProgress, runOptions, runId)
      .then(result => {
        finishPersistedRun(runId, result);
        return result;
      })
      .catch(error => {
        finishPersistedRun(runId, undefined, error);
        throw error;
      });
    activeRunPromise = promise.finally(() => {
      activeRunPromise = null;
    });
    return activeRunPromise;
  }
  return applyTweakBatchInternal(uniqueIds, onProgress, options);
}

async function applyTweakBatchInternal(
  uniqueIds: string[],
  onProgress?: (progress: TweakRunProgress) => void,
  options: TweakBatchOptions = {},
  persistedRunId?: string,
): Promise<BulkTweakResult> {
  const native = isNative();
  const initialSkippedIds = Array.from(new Set(options.initialSkippedIds ?? []))
    .filter(id => !uniqueIds.includes(id));
  const initialSkippedSet = new Set(initialSkippedIds);
  const batchIds = Array.from(new Set([...uniqueIds, ...initialSkippedIds]));
  const batchTotal = batchIds.length;
  const progressIndexById = new Map(batchIds.map((id, index) => [id, index]));
  const emitProgress = (progress: TweakRunProgress) => {
    onProgress?.(progress);
    if (persistedRunId) updatePersistedProgress(persistedRunId, progress);
  };
  // All bulk actions use one visible runner. Individual pages must not start
  // long elevated runs in-place where navigation or a re-render can hide
  // progress and make a working button look unresponsive.
  if (native && window.location.pathname !== "/applied-tweaks") {
    // Free users may only instant-apply the signed native allowlist. Filter
    // script-only IDs before navigation so they never reach the ticket API and
    // produce the misleading "could not apply" toast seen on the Tweaks page.
    // Pro keeps the full trusted server command surface.
    const compatibleIds = uniqueIds.filter(id => isRunActionCompatible(id, native));
    const unsupportedIds = Array.from(new Set([
      ...initialSkippedIds,
      ...uniqueIds.filter(id => !isRunActionCompatible(id, native)),
    ]));
    // If entitlement status is temporarily unavailable, fail closed to the
    // free-device ceiling rather than letting a stale queue run oversized.
    let queuedIds = compatibleIds;
    try {
      const allowanceResponse = await fetchWithTimeout(
        apiUrl("/api/performance-allowance"),
        { headers: getNativeAuthHeaders() },
        NATIVE_REQUEST_TIMEOUT_MS,
        "Allowance status unavailable; keeping the selected IDs for review.",
      );
      if (allowanceResponse.ok) {
        const allowance = await allowanceResponse.json() as { pro?: boolean };
        if (typeof allowance.pro !== "boolean") throw new Error("Access check was incomplete. No partial batch was queued.");
        if (allowance.pro === false) {
          // Keep the hardware filter in force for the free path too. The
          // previous code replaced compatibleIds with every native ID, which
          // reintroduced GTX 1060 entries after the first filter.
          queuedIds = compatibleIds.filter(id => NATIVE_TWEAK_ID_SET.has(id)).slice(0, FREE_NATIVE_TWEAK_LIMIT);
        } else {
          queuedIds = compatibleIds;
        }
      } else {
        throw new Error("Access check failed. No partial batch was queued; try again.");
      }
    } catch (error) {
      throw error instanceof Error ? error : new Error("Access check failed. No partial batch was queued; try again.");
    }
    if (!queuedIds.length) {
      if (!compatibleIds.length && unsupportedIds.length) {
        queueTweakBatch([], options, unsupportedIds);
        window.location.assign("/applied-tweaks?run=1");
        return new Promise<never>(() => {});
      }
      return {
        appliedIds: [],
        selectedIds: batchIds,
        unsupportedIds,
        skippedIds: unsupportedIds,
        failures: compatibleIds.map(id => ({
          id,
          message: "This tweak is script-only and is not available for instant apply.",
        })),
      };
    }
    queueTweakBatch(queuedIds, options, unsupportedIds);
    window.location.assign("/applied-tweaks?run=1");
    // The Applied Tweaks page owns native terminal feedback.  Never resolve
    // here with a synthetic zero-applied result: callers on the originating
    // page would otherwise show a false success toast before navigation.
    return new Promise<never>(() => {});
  }
  const compatibleIds = uniqueIds.filter(id => !initialSkippedSet.has(id) && isRunActionCompatible(id, native));
  const unsupportedIds = Array.from(new Set([
    ...initialSkippedIds,
    ...uniqueIds.filter(id => !initialSkippedSet.has(id) && !isRunActionCompatible(id, native)),
  ]));
  const skippedIds = [...unsupportedIds];
  unsupportedIds.forEach((id, index) => emitProgress({
    id,
    index: progressIndexById.get(id) ?? index,
    total: batchTotal,
    status: "skipped",
    message: options.initialSkippedMessages?.[id] || getTweakCompatibility(id).reason || "This tweak was excluded by the hardware compatibility check.",
  }));

  // Browser mode is selection/script mode, not native execution mode. Do not
  // call the Windows-only allowance endpoint here: guests may browse, select,
  // and generate a script without a Discord session or device identity.
  if (!native) {
    for (const id of compatibleIds) useOptimizationStore.getState().setTweak(id, true);
    return { appliedIds: [], selectedIds: batchIds, unsupportedIds, skippedIds, failures: [] };
  }

  if (!compatibleIds.length) {
    clearQueuedTweakBatch();
    return { appliedIds: [], selectedIds: batchIds, unsupportedIds, skippedIds, failures: [] };
  }

  // A full optimize rerun can contain hundreds of IDs that already succeeded
  // in an earlier run. Check both live Windows detection and the successful
  // app-run ledger so those IDs are not mutated or charged a second time.
  let alreadyConfirmedIds: string[] = [];
  let windowsDetectedIds: string[] = [];
  if (native) {
    const [detected, machineHistory] = await Promise.all([
      detectAppliedTweaks().catch(() => ({} as Record<string, boolean>)),
      getRecordedAppliedTweaks().catch(() => ({} as Record<string, number>)),
    ]);
    const appliedAt = useOptimizationStore.getState().appliedAt;
    const forcedIds = new Set(options.forceReapplyIds ?? []);
    if (batchIds.includes(NVIDIA_PRESET_ACTION_ID) && !isCurrentNvidiaPresetVerified()) {
      forcedIds.add(NVIDIA_PRESET_ACTION_ID);
    }
    alreadyConfirmedIds = compatibleIds.filter(id =>
      !forcedIds.has(id) && (
        detected[id] === true ||
        (detected[id] !== false && (id in appliedAt || (machineHistory[id] ?? 0) > 0))
      ),
    );
    windowsDetectedIds = compatibleIds.filter(id =>
      !forcedIds.has(id) && Boolean(detected[id]),
    );
    alreadyConfirmedIds.forEach((id, index) => {
      const store = useOptimizationStore.getState();
      if (detected[id] && !(id in store.appliedAt)) store.markApplied([id]);
      emitProgress({
        id,
        index,
        total: batchTotal,
        status: "applied",
          message: "Already recorded as applied; skipped.",
      });
    });
  }
  const pendingIds = compatibleIds.filter(id => !alreadyConfirmedIds.includes(id));
  const nativeAuth = native ? await getNativeAuthToken() : null;
  const deviceId = getPersistentDeviceId();
  const proSession = localStorage.getItem(PRO_SESSION_KEY);
  const credential = nativeAuth || (proSession ? `pro:${proSession}` : null) || (deviceId ? `device:${deviceId}` : null);
  const allowanceResponse = await fetchWithTimeout(
    apiUrl("/api/performance-allowance"),
    { headers: getNativeAuthHeaders() },
    NATIVE_REQUEST_TIMEOUT_MS,
    "OG-NET-001 · The entitlement service timed out. No tweak was run.",
  ).catch(() => null);
  if (!allowanceResponse?.ok) {
    throw new Error(native ? "OG-AUTH-001 · Windows device identity unavailable." : "OG-AUTH-001 · Open Opti Gods in the Windows app.");
  }
  const allowance = await allowanceResponse.json() as { pro: boolean; remaining: number | null };
  // Native ticket issuance is the authoritative entitlement check.  Do not
  // slice native batches by the cached remaining count: active free tweaks
  // may already occupy allowance slots, and Best 15 must report each ticket
  // result (rather than silently omitting IDs).
  const entitledIds = native
    ? pendingIds
    : allowance.pro
      ? pendingIds
      : pendingIds.slice(0, Math.max(0, allowance.remaining ?? 0));
  const supportedIds = entitledIds;
  const reconcileConfirmedIds = async () => {
    if (allowance.pro || !windowsDetectedIds.length) return;
    for (const id of windowsDetectedIds) {
      if (!NATIVE_TWEAK_ID_SET.has(id)) continue;
      try {
        await reconcileConfirmedNativeTweak(id);
      } catch (error) {
        // Keep the Windows result authoritative. A later allowance refresh or
        // rerun can retry accounting without falsely marking the tweak failed.
        console.warn("[native-tweak-runner] Could not sync confirmed allowance", id, error);
      }
    }
  };

  if (!credential) {
    const message = "OG-AUTH-001 · Windows device identity unavailable. Reopen the Windows app to refresh the device identity.";
    supportedIds.forEach((id, index) => emitProgress({
      id, index: progressIndexById.get(id) ?? index, total: batchTotal, status: "failed", message,
    }));
    return {
      appliedIds: alreadyConfirmedIds,
      selectedIds: batchIds,
      unsupportedIds,
      skippedIds,
      failures: supportedIds.map(id => ({ id, message })),
    };
  }

  if (!supportedIds.length) {
    await reconcileConfirmedIds();
    clearQueuedTweakBatch();
    return { appliedIds: alreadyConfirmedIds, selectedIds: batchIds, unsupportedIds, skippedIds, failures: [] };
  }

  if (!sessionStorage.getItem(NATIVE_RESTORE_CREATED_KEY)) {
    try {
      const restorePoint = await withTimeout(
        createRestorePoint("Before Opti Gods tweak changes"),
        NATIVE_EXECUTION_TIMEOUT_MS,
        "OG-NATIVE-002 · Windows did not finish creating the restore point within 90 seconds.",
      );
      if (!restorePoint?.sequence_number) {
        const message = "Windows did not confirm a restore point. Turn on System Protection for drive C: and try Full Optimize again.";
        supportedIds.forEach((id, index) => emitProgress({
          id, index: progressIndexById.get(id) ?? index, total: batchTotal, status: "failed", message,
        }));
        return {
          appliedIds: alreadyConfirmedIds,
          selectedIds: batchIds,
          unsupportedIds,
          skippedIds,
          failures: supportedIds.map(id => ({ id, message })),
        };
      }
      sessionStorage.setItem(NATIVE_RESTORE_CREATED_KEY, String(restorePoint.sequence_number));
    } catch (error) {
      const detail = getThrownMessage(error, "Could not create a verified restore point.");
      const message = `Restore point failed: ${detail} Turn on System Protection for drive C: and try again.`;
      supportedIds.forEach((id, index) => emitProgress({
        id, index: progressIndexById.get(id) ?? index, total: batchTotal, status: "failed", message,
      }));
      return {
        appliedIds: alreadyConfirmedIds,
        selectedIds: batchIds,
        unsupportedIds,
          skippedIds,
          failures: supportedIds.map(id => ({ id, message })),
      };
    }
  }

  const appliedIds: string[] = [...alreadyConfirmedIds];
  const failures: { id: string; message: string }[] = [];
  const stoppedIds: string[] = [];
  supportedIds.forEach((id, index) => emitProgress({
    id, index: progressIndexById.get(id) ?? index, total: batchTotal, status: "queued",
  }));

  // Authorization is independent of the Windows mutation. Pipeline one
  // ticket ahead so the network round-trip is hidden behind PowerShell/native
  // execution, while keeping actual system writes strictly serial.
  const authorize = (actionId: string) => {
    const tweakId = actionId === NVIDIA_PRESET_ACTION_ID ? NVIDIA_PRESET_TICKET_ID : actionId;
    return fetchWithTimeout(
      apiUrl("/api/performance-allowance/native-ticket"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getNativeAuthHeaders() },
        body: JSON.stringify({
          tweakId,
          sessionToken: localStorage.getItem(PRO_SESSION_KEY) ?? undefined,
          idempotencyKey: crypto.randomUUID().replace(/[^A-Za-z0-9_-]/g, ""),
        }),
      },
      NATIVE_REQUEST_TIMEOUT_MS,
      `OG-NET-002 · Authorization timed out for ${actionId}.`,
    );
  };
  let nextAuthorization: Promise<Response> | null = null;
  let nextAuthorizationId: string | null = null;

  for (let index = 0; index < supportedIds.length; index++) {
    const id = supportedIds[index];
    const persistedStopRequested = persistedRunId
      ? (() => {
        const state = readRunStateSafely();
        return state?.runId === persistedRunId && Boolean(state.stopRequested);
      })()
      : false;
    if (stopRequested || persistedStopRequested) {
      if (nextAuthorization && nextAuthorizationId) {
        const response = await nextAuthorization.catch(() => null);
        const body = await response?.json().catch(() => ({})) as { ticket?: string };
        if (typeof body.ticket === "string") {
          await fetchWithTimeout(
            apiUrl("/api/performance-allowance/native-ticket/cancel"),
            {
              method: "POST",
              headers: { "Content-Type": "application/json", ...getNativeAuthHeaders() },
              body: JSON.stringify({ ticket: body.ticket }),
            },
            NATIVE_REQUEST_TIMEOUT_MS,
            `OG-NET-003 · Ticket cleanup timed out for ${nextAuthorizationId}.`,
          ).catch(() => {});
        }
      }
      nextAuthorization = null;
      nextAuthorizationId = null;
      for (let remainingIndex = index; remainingIndex < supportedIds.length; remainingIndex++) {
        const remainingId = supportedIds[remainingIndex];
        stoppedIds.push(remainingId);
        emitProgress({
          id: remainingId,
          index: progressIndexById.get(remainingId) ?? remainingIndex,
          total: batchTotal,
          status: "stopped",
          message: "Stopped by user before Windows changed this tweak.",
        });
      }
      break;
    }
    let ticket: string | null = null;
    let osApplied = false;
    emitProgress({ id, index: progressIndexById.get(id) ?? index, total: batchTotal, status: "running" });
    let compatibilitySkipMessage: string | null = null;
    try {
      const authorization = nextAuthorizationId === id && nextAuthorization
        ? await nextAuthorization
        : await authorize(id);
      nextAuthorization = null;
      nextAuthorizationId = null;
      const authorizationBody = await authorization.json().catch(() => ({}));
      if (!authorization.ok || typeof authorizationBody.ticket !== "string") {
        throw new Error(`${authorizationBody.code || `OG-HTTP-${authorization.status}`} · ${authorizationBody.error || "Authorization failed."}`);
      }
      ticket = authorizationBody.ticket;
      const nextId = supportedIds[index + 1];
      if (nextId && !stopRequested) {
        nextAuthorization = authorize(nextId);
        nextAuthorizationId = nextId;
      }
      // Rust enforces the real 90-second process deadline and kills timed-out
      // PowerShell before returning. Do not add a renderer-only timeout here:
      // it could report failure while Windows continued mutating in the background.
      if (id === NVIDIA_PRESET_ACTION_ID && !credential) {
        throw new Error("Windows device authorization is unavailable.");
      }
      const result = id === NVIDIA_PRESET_ACTION_ID
        ? {
          ok: true,
          message: await importNvidiaPreset(ticket!, credential!),
          error_kind: undefined,
          undo_token: null,
        }
        : await applyTweak(id, ticket, credential);
      if (!result.ok) {
        if (result.error_kind === "compatibility") {
          compatibilitySkipMessage = result.message || "This tweak is not compatible with this PC.";
        }
        throw new Error(result.message || "Windows rejected the change.");
      }
      osApplied = true;
      const store = useOptimizationStore.getState();
      if (id === NVIDIA_PRESET_ACTION_ID) {
        if (result.message?.includes("Verified 15/15") && result.message.startsWith("Digital Vibrance applied")) {
          try { localStorage.setItem(NVIDIA_PRESET_REQUEUE_RELEASE_KEY, "verified"); } catch { /* retry safely if storage is unavailable */ }
        }
        store.setTweak(id, true);
        store.markApplied([id]);
        saveUndoToken(id, null);
      } else {
        store.markApplied([id]);
        saveUndoToken(id, result.undo_token);
      }
      appliedIds.push(id);
      emitProgress({
        id, index: progressIndexById.get(id) ?? index, total: batchTotal, status: "applied",
        message: result.message,
      });
      // Keep allowance cards and the Applied Tweaks page current during a
      // long run, not only after the final item. The server result callback
      // has already finalized this ticket before applyTweak resolves.
      window.dispatchEvent(new Event("optigods:allowance-changed"));
    } catch (error) {
      if (ticket && !osApplied) {
        await fetchWithTimeout(
          apiUrl("/api/performance-allowance/native-ticket/cancel"),
          {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getNativeAuthHeaders() },
            body: JSON.stringify({ ticket }),
          },
          NATIVE_REQUEST_TIMEOUT_MS,
          `OG-NET-003 · Ticket cleanup timed out for ${id}.`,
        ).catch(() => {});
      }
      const message = getThrownMessage(error, "Windows rejected the change.");
      if (stopRequested) {
        stoppedIds.push(id);
        emitProgress({
          id, index: progressIndexById.get(id) ?? index, total: batchTotal,
          status: "stopped", message: "Stopped by user before Windows confirmed this tweak.",
        });
        break;
      }
      const classifiedSkipMessage = compatibilitySkipMessage
        || getCompatibilitySkipMessage(undefined, message);
      if (classifiedSkipMessage) {
        skippedIds.push(id);
        emitProgress({
          id, index: progressIndexById.get(id) ?? index, total: batchTotal, status: "skipped", message: classifiedSkipMessage,
        });
        continue;
      }
      failures.push({ id, message });
      emitProgress({ id, index: progressIndexById.get(id) ?? index, total: batchTotal, status: "failed", message });
    }
  }

  await reconcileConfirmedIds();
  window.dispatchEvent(new Event("optigods:allowance-changed"));
  clearQueuedTweakBatch();
  return { appliedIds, selectedIds: batchIds, unsupportedIds, skippedIds, failures, stoppedIds };
}