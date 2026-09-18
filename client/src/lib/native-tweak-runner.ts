import { apiUrl } from "@/lib/api-base";
import { applyTweak, createRestorePoint, getNativeAuthToken, isNative } from "@/lib/tauri-bridge";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { getTweakCompatibility } from "@/lib/tweak-compatibility";
import { getNativeAuthHeaders, getPersistentDeviceId } from "@/lib/queryClient";

const NATIVE_UNDO_KEY = "optigods-native-undo-tokens";
const RESTORE_CREATED_KEY = "optigods-native-restore-created";
export const NATIVE_RUN_QUEUE_KEY = "optigods-native-run-queue";
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
  status: "queued" | "running" | "applied" | "failed";
  message?: string;
};

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
};

export async function applyTweakBatch(
  ids: readonly string[],
  onProgress?: (progress: TweakRunProgress) => void,
): Promise<BulkTweakResult> {
  const uniqueIds = Array.from(new Set(ids));
  const native = isNative();
  // All bulk actions use one visible runner. Individual pages must not start
  // long elevated runs in-place where navigation or a re-render can hide
  // progress and make a working button look unresponsive.
  if (native && window.location.pathname !== "/applied-tweaks") {
    // Keep every requested ID in the queue.  The runner must show unsupported,
    // unentitled, and execution failures instead of silently dropping them.
    queueTweakBatch(uniqueIds);
    window.location.assign("/applied-tweaks?run=1");
    // The Applied Tweaks page owns native terminal feedback.  Never resolve
    // here with a synthetic zero-applied result: callers on the originating
    // page would otherwise show a false success toast before navigation.
    return new Promise<never>(() => {});
  }
  const nativeAuth = native ? await getNativeAuthToken() : null;
  const deviceId = getPersistentDeviceId();
  const credential = nativeAuth || (deviceId ? `device:${deviceId}` : null);
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
  const compatibleIds = uniqueIds.filter(id => getTweakCompatibility(id).ok);
  // Native ticket issuance is the authoritative entitlement check.  Do not
  // slice native batches by the cached remaining count: active free tweaks
  // may already occupy allowance slots, and Best 15 must report each ticket
  // result (rather than silently omitting IDs).
  const entitledIds = native
    ? compatibleIds
    : allowance.pro
      ? compatibleIds
      : compatibleIds.slice(0, Math.max(0, allowance.remaining ?? 0));
  const supportedIds = entitledIds;
  const unsupportedIds = uniqueIds.filter(id => !getTweakCompatibility(id).ok);
  const unsupportedFailures = unsupportedIds.map(id => ({
    id,
    message: getTweakCompatibility(id).reason || "This tweak is not compatible with this PC.",
  }));
  unsupportedIds.forEach((id, index) => onProgress?.({
    id, index, total: uniqueIds.length, status: "failed",
    message: unsupportedFailures.find(failure => failure.id === id)?.message,
  }));

  if (!native) {
    for (const id of entitledIds) useOptimizationStore.getState().setTweak(id, true);
    return { appliedIds: [], selectedIds: entitledIds, unsupportedIds, failures: [] };
  }

  if (!credential) {
    const message = "OG-AUTH-001 · Windows device identity unavailable. Reopen the Windows app to refresh the device identity.";
    supportedIds.forEach((id, index) => onProgress?.({ id, index, total: uniqueIds.length, status: "failed", message }));
    return {
      appliedIds: [],
      selectedIds: [],
      unsupportedIds,
      failures: supportedIds.map(id => ({ id, message })).concat(unsupportedFailures),
    };
  }

  if (!supportedIds.length) {
    return { appliedIds: [], selectedIds: [], unsupportedIds, failures: unsupportedFailures };
  }

  if (!sessionStorage.getItem(RESTORE_CREATED_KEY)) {
    try {
      const restorePoint = await withTimeout(
        createRestorePoint("Before Opti Gods tweak changes"),
        NATIVE_EXECUTION_TIMEOUT_MS,
        "OG-NATIVE-002 · Windows did not finish creating the restore point within 90 seconds.",
      );
      if (!restorePoint?.sequence_number) {
        const message = "Windows did not confirm a restore point. Turn on System Protection for drive C: and try Full Optimize again.";
        supportedIds.forEach((id, index) => onProgress?.({ id, index, total: uniqueIds.length, status: "failed", message }));
        return {
          appliedIds: [],
          selectedIds: [],
          unsupportedIds,
          failures: supportedIds.map(id => ({ id, message })).concat(unsupportedFailures),
        };
      }
      sessionStorage.setItem(RESTORE_CREATED_KEY, String(restorePoint.sequence_number));
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Could not create a verified restore point.";
      const message = `Restore point failed: ${detail} Turn on System Protection for drive C: and try again.`;
      supportedIds.forEach((id, index) => onProgress?.({ id, index, total: uniqueIds.length, status: "failed", message }));
      return {
        appliedIds: [],
          selectedIds: [],
        unsupportedIds,
        failures: supportedIds.map(id => ({ id, message })).concat(unsupportedFailures),
      };
    }
  }

  const appliedIds: string[] = [];
  const failures: { id: string; message: string }[] = [];
  supportedIds.forEach((id, index) => onProgress?.({ id, index, total: uniqueIds.length, status: "queued" }));
  for (let index = 0; index < supportedIds.length; index++) {
    const id = supportedIds[index];
    let ticket: string | null = null;
    let osApplied = false;
    onProgress?.({ id, index, total: uniqueIds.length, status: "running" });
    try {
      const authorization = await fetchWithTimeout(
        apiUrl("/api/performance-allowance/native-ticket"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getNativeAuthHeaders() },
          body: JSON.stringify({
            tweakId: id,
            idempotencyKey: crypto.randomUUID().replace(/[^A-Za-z0-9_-]/g, ""),
          }),
        },
        NATIVE_REQUEST_TIMEOUT_MS,
        `OG-NET-002 · Authorization timed out for ${id}.`,
      );
      const authorizationBody = await authorization.json().catch(() => ({}));
      if (!authorization.ok || typeof authorizationBody.ticket !== "string") {
        throw new Error(`${authorizationBody.code || `OG-HTTP-${authorization.status}`} · ${authorizationBody.error || "Authorization failed."}`);
      }
      ticket = authorizationBody.ticket;
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
      onProgress?.({ id, index, total: uniqueIds.length, status: "applied", message: result.message });
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
      onProgress?.({ id, index, total: uniqueIds.length, status: "failed", message });
    }
  }

  window.dispatchEvent(new Event("optigods:allowance-changed"));
  localStorage.removeItem(NATIVE_RUN_QUEUE_KEY);
  return { appliedIds, selectedIds: [], unsupportedIds, failures: failures.concat(unsupportedFailures) };
}