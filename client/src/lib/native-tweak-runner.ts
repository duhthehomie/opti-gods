import { apiUrl } from "@/lib/api-base";
import { applyTweak, createRestorePoint, detectAppliedTweaks, getNativeAuthToken, isNative } from "@/lib/tauri-bridge";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { getTweakCompatibility } from "@/lib/tweak-compatibility";
import { getNativeAuthHeaders, getPersistentDeviceId, PRO_SESSION_KEY } from "@/lib/queryClient";
import { NATIVE_RESTORE_CREATED_KEY } from "@/lib/native-readiness";
import { NATIVE_TWEAK_ID_SET } from "@shared/native-tweak-ids";

const NATIVE_UNDO_KEY = "optigods-native-undo-tokens";
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
    // Free users may only instant-apply the signed native allowlist. Filter
    // script-only IDs before navigation so they never reach the ticket API and
    // produce the misleading "could not apply" toast seen on the Tweaks page.
    // Pro keeps the full trusted server command surface.
    let queuedIds = uniqueIds;
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
          queuedIds = uniqueIds.filter(id => NATIVE_TWEAK_ID_SET.has(id));
        }
      }
    } catch {
      // The Applied Tweaks runner will report the actual server result if the
      // allowance check could not be read before navigation.
    }
    if (!queuedIds.length) {
      return {
        appliedIds: [],
        selectedIds: uniqueIds,
        unsupportedIds: uniqueIds,
        failures: uniqueIds.map(id => ({
          id,
          message: "This tweak is script-only and is not available for instant apply.",
        })),
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
  unsupportedIds.forEach((id, index) => onProgress?.({
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
    alreadyConfirmedIds = compatibleIds.filter(id => Boolean(detected[id]));
    alreadyConfirmedIds.forEach((id, index) => {
      const store = useOptimizationStore.getState();
      store.setTweak(id, true);
      store.markApplied([id]);
      onProgress?.({
        id,
        index,
        total: uniqueIds.length,
        status: "applied",
        message: "Already confirmed by Windows; skipped.",
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
    supportedIds.forEach((id, index) => onProgress?.({ id, index, total: uniqueIds.length, status: "failed", message }));
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
        supportedIds.forEach((id, index) => onProgress?.({ id, index, total: uniqueIds.length, status: "failed", message }));
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
      supportedIds.forEach((id, index) => onProgress?.({ id, index, total: uniqueIds.length, status: "failed", message }));
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
            sessionToken: localStorage.getItem(PRO_SESSION_KEY) ?? undefined,
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
  return { appliedIds, selectedIds: uniqueIds, unsupportedIds, failures: failures.concat(unsupportedFailures) };
}