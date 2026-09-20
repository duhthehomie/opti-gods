import { apiUrl } from "@/lib/api-base";
import { applyTweak, createRestorePoint, detectAppliedTweaks, getNativeAuthToken, isNative } from "@/lib/tauri-bridge";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { getTweakCompatibility } from "@/lib/tweak-compatibility";
import { getNativeAuthHeaders, getPersistentDeviceId, PRO_SESSION_KEY } from "@/lib/queryClient";
import { NATIVE_RESTORE_CREATED_KEY } from "@/lib/native-readiness";
import { NATIVE_TWEAK_ID_SET } from "@shared/native-tweak-ids";

const NATIVE_UNDO_KEY = "optigods-native-undo-tokens";
export const NATIVE_RUN_QUEUE_KEY = "optigods-native-run-queue";
export const NATIVE_RUN_STATE_KEY = "optigods-native-run-state";
const NATIVE_RUN_EVENT = "optigods:native-run-state";
const NATIVE_REQUEST_TIMEOUT_MS = 30_000;
const NATIVE_EXECUTION_TIMEOUT_MS = 90_000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      value => { window.clearTimeout(timer); resolve(value); },
      error => { window.clearTimeout(timer); reject(error); },
    );
  });
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

export type TweakRunProgress = {
  id: string;
  index: number;
  total: number;
  status: "queued" | "running" | "applied" | "failed" | "stopped";
  message?: string;
};

export type NativeTweakRunState = {
  runId: string;
  ids: string[];
  items: TweakRunProgress[];
  status: "running" | "stopping" | "completed" | "stopped" | "failed";
  startedAt: number;
  finishedAt?: number;
  stopRequested?: boolean;
};

export type TweakBatchOptions = {
  /** Re-run these IDs even when native Windows detection says they are applied. */
  forceReapplyIds?: readonly string[];
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
  try { localStorage.setItem(NATIVE_RUN_STATE_KEY, JSON.stringify(state)); } catch { /* best effort */ }
  dispatchRunState();
}

export function readNativeTweakRun(): NativeTweakRunState | null {
  return readRunStateSafely();
}

export function subscribeNativeTweakRun(listener: (state: NativeTweakRunState | null) => void): () => void {
  const handler = () => listener(readRunStateSafely());
  window.addEventListener(NATIVE_RUN_EVENT, handler);
  return () => window.removeEventListener(NATIVE_RUN_EVENT, handler);
}

function beginPersistedRun(ids: string[]): string {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  stopRequested = false;
  writeRunState({
    runId,
    ids,
    items: ids.map((id, index) => ({ id, index, total: ids.length, status: "queued" })),
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
    status: error ? "failed" : stopped ? "stopped" : "completed",
    finishedAt: Date.now(),
    stopRequested: stopped,
    items: error
      ? state.items.map(item => item.status === "applied" || item.status === "failed" || item.status === "stopped"
        ? item
        : { ...item, status: "failed", message: error instanceof Error ? error.message : "The runner stopped unexpectedly." })
      : state.items,
  });
  void result;
}

export function stopNativeTweakRun(): boolean {
  const state = readRunStateSafely();
  if (!state || (state.status !== "running" && state.status !== "stopping")) return false;
  stopRequested = true;
  writeRunState({ ...state, status: "stopping", stopRequested: true });
  return true;
}

export function queueTweakBatch(ids: readonly string[]) {
  localStorage.setItem(NATIVE_RUN_QUEUE_KEY, JSON.stringify(Array.from(new Set(ids))));
}

export function readQueuedTweakBatch(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(NATIVE_RUN_QUEUE_KEY) || "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
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
  failures: { id: string; message: string }[];
  stoppedIds?: string[];
};

export async function applyTweakBatch(
  ids: readonly string[],
  onProgress?: (progress: TweakRunProgress) => void,
  options: TweakBatchOptions = {},
): Promise<BulkTweakResult> {
  const uniqueIds = Array.from(new Set(ids));
  const native = isNative();
  if (native && window.location.pathname === "/applied-tweaks") {
    if (activeRunPromise) return activeRunPromise;
    const runId = beginPersistedRun(uniqueIds);
    const promise = applyTweakBatchInternal(uniqueIds, onProgress, options, runId)
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
    const compatibleIds = uniqueIds.filter(id => getTweakCompatibility(id).ok);
    const unsupportedIds = uniqueIds.filter(id => !getTweakCompatibility(id).ok);
    const unsupportedFailures = unsupportedIds.map(id => ({
      id,
      message: getTweakCompatibility(id).reason || "This tweak is not compatible with this PC.",
    }));
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
        if (allowance.pro === false) {
          // Keep the hardware filter in force for the free path too. The
          // previous code replaced compatibleIds with every native ID, which
          // reintroduced GTX 1060 entries after the first filter.
          queuedIds = compatibleIds.filter(id => NATIVE_TWEAK_ID_SET.has(id));
        }
      }
    } catch {
      // The Applied Tweaks runner will report the actual server result if the
      // allowance check could not be read before navigation.
    }
    if (!queuedIds.length) {
      return {
        appliedIds: [],
        selectedIds: compatibleIds,
        unsupportedIds,
        failures: unsupportedFailures.concat(compatibleIds.map(id => ({
          id,
          message: "This tweak is script-only and is not available for instant apply.",
        }))),
      };
    }
    queueTweakBatch(queuedIds);
    window.location.assign("/applied-tweaks?run=1");
    // The Applied Tweaks page owns native terminal feedback.  Never resolve
    // here with a synthetic zero-applied result: callers on the originating
    // page would otherwise show a false success toast before navigation.
    return new Promise<never>(() => {});
  }
  const compatibleIds = uniqueIds.filter(id => getTweakCompatibility(id).ok);
  const unsupportedIds = uniqueIds.filter(id => !getTweakCompatibility(id).ok);
  const unsupportedFailures = unsupportedIds.map(id => ({
    id,
    message: getTweakCompatibility(id).reason || "This tweak is not compatible with this PC.",
  }));
  unsupportedIds.forEach((id, index) => emitProgress({
    id, index, total: uniqueIds.length, status: "failed",
    message: unsupportedFailures.find(failure => failure.id === id)?.message,
  }));

  // Browser mode is selection/script mode, not native execution mode. Do not
  // call the Windows-only allowance endpoint here: guests may browse, select,
  // and generate a script without a Discord session or device identity.
  if (!native) {
    for (const id of compatibleIds) useOptimizationStore.getState().setTweak(id, true);
    return { appliedIds: [], selectedIds: compatibleIds, unsupportedIds, failures: unsupportedFailures };
  }

  // A full optimize rerun can contain hundreds of IDs that already succeeded
  // in an earlier run. Detect those first so reruns are fast, do not consume a
  // new allowance, and report them as confirmed immediately.
  let alreadyConfirmedIds: string[] = [];
  if (native) {
    const detected = await detectAppliedTweaks().catch(() => ({} as Record<string, boolean>));
    const forcedIds = new Set(options.forceReapplyIds ?? []);
    const locallyRecorded = useOptimizationStore.getState().appliedAt;
    alreadyConfirmedIds = compatibleIds.filter(id =>
      !forcedIds.has(id) && (Boolean(detected[id]) || Boolean(locallyRecorded[id])),
    );
    alreadyConfirmedIds.forEach((id, index) => {
      const store = useOptimizationStore.getState();
      store.setTweak(id, true);
      store.markApplied([id]);
      emitProgress({
        id,
        index,
        total: uniqueIds.length,
        status: "applied",
        message: detected[id]
          ? "Already confirmed by Windows; skipped."
          : "Previously confirmed by Opti Gods; skipped.",
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

  if (!credential) {
    const message = "OG-AUTH-001 · Windows device identity unavailable. Reopen the Windows app to refresh the device identity.";
    supportedIds.forEach((id, index) => emitProgress({ id, index, total: uniqueIds.length, status: "failed", message }));
    return {
      appliedIds: alreadyConfirmedIds,
      selectedIds: [],
      unsupportedIds,
      failures: supportedIds.map(id => ({ id, message })).concat(unsupportedFailures),
    };
  }

  if (!supportedIds.length) {
    localStorage.removeItem(NATIVE_RUN_QUEUE_KEY);
    return { appliedIds: alreadyConfirmedIds, selectedIds: uniqueIds, unsupportedIds, failures: unsupportedFailures };
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
        supportedIds.forEach((id, index) => emitProgress({ id, index, total: uniqueIds.length, status: "failed", message }));
        return {
          appliedIds: alreadyConfirmedIds,
          selectedIds: [],
          unsupportedIds,
          failures: supportedIds.map(id => ({ id, message })).concat(unsupportedFailures),
        };
      }
      sessionStorage.setItem(NATIVE_RESTORE_CREATED_KEY, String(restorePoint.sequence_number));
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Could not create a verified restore point.";
      const message = `Restore point failed: ${detail} Turn on System Protection for drive C: and try again.`;
      supportedIds.forEach((id, index) => emitProgress({ id, index, total: uniqueIds.length, status: "failed", message }));
      return {
        appliedIds: alreadyConfirmedIds,
        selectedIds: uniqueIds,
        unsupportedIds,
        failures: supportedIds.map(id => ({ id, message })).concat(unsupportedFailures),
      };
    }
  }

  const appliedIds: string[] = [...alreadyConfirmedIds];
  const failures: { id: string; message: string }[] = [];
  const stoppedIds: string[] = [];
  supportedIds.forEach((id, index) => emitProgress({ id, index, total: uniqueIds.length, status: "queued" }));

  // Authorization is independent of the Windows mutation. Pipeline one
  // ticket ahead so the network round-trip is hidden behind PowerShell/native
  // execution, while keeping actual system writes strictly serial.
  const authorize = (tweakId: string) => fetchWithTimeout(
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
    `OG-NET-002 · Authorization timed out for ${tweakId}.`,
  );
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
          index: remainingIndex,
          total: uniqueIds.length,
          status: "stopped",
          message: "Stopped by user before Windows changed this tweak.",
        });
      }
      break;
    }
    let ticket: string | null = null;
    let osApplied = false;
    emitProgress({ id, index, total: uniqueIds.length, status: "running" });
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
      const result = await applyTweak(id, ticket, credential);
      if (!result.ok) throw new Error(result.message || "Windows rejected the change.");
      osApplied = true;
      const store = useOptimizationStore.getState();
      store.setTweak(id, true);
      store.markApplied([id]);
      saveUndoToken(id, result.undo_token);
      appliedIds.push(id);
      emitProgress({ id, index, total: uniqueIds.length, status: "applied", message: result.message });
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
      const message = error instanceof Error ? error.message : "Windows rejected the change.";
      failures.push({ id, message });
      emitProgress({ id, index, total: uniqueIds.length, status: "failed", message });
    }
  }

  window.dispatchEvent(new Event("optigods:allowance-changed"));
  localStorage.removeItem(NATIVE_RUN_QUEUE_KEY);
  return { appliedIds, selectedIds: uniqueIds, unsupportedIds, failures: failures.concat(unsupportedFailures), stoppedIds };
}