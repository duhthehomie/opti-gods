import { apiUrl } from "@/lib/api-base";
import { applyTweak, createRestorePoint, getNativeAuthToken, isNative } from "@/lib/tauri-bridge";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { getTweakCompatibility } from "@/lib/tweak-compatibility";
import { getNativeAuthHeaders, getPersistentDeviceId } from "@/lib/queryClient";

const NATIVE_UNDO_KEY = "optigods-native-undo-tokens";
const RESTORE_CREATED_KEY = "optigods-native-restore-created";
export const NATIVE_RUN_QUEUE_KEY = "optigods-native-run-queue";

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
    const compatibleIds = uniqueIds.filter(id => getTweakCompatibility(id).ok);
    queueTweakBatch(compatibleIds);
    window.location.assign("/applied-tweaks?run=1");
    return {
      appliedIds: [],
      selectedIds: compatibleIds,
      unsupportedIds: uniqueIds.filter(id => !getTweakCompatibility(id).ok),
      failures: [],
    };
  }
  const nativeAuth = native ? await getNativeAuthToken() : null;
  const deviceId = getPersistentDeviceId();
  const credential = nativeAuth || (deviceId ? `device:${deviceId}` : null);
  const allowanceResponse = await fetch(apiUrl("/api/performance-allowance"), {
    headers: getNativeAuthHeaders(),
  }).catch(() => null);
  if (!allowanceResponse?.ok) {
    throw new Error(native ? "OG-AUTH-001 · Windows device identity unavailable." : "OG-AUTH-001 · Open Opti Gods in the Windows app.");
  }
  const allowance = await allowanceResponse.json() as { pro: boolean; remaining: number | null };
  const compatibleIds = uniqueIds.filter(id => getTweakCompatibility(id).ok);
  const entitledIds = allowance.pro
    ? compatibleIds
    : compatibleIds.slice(0, Math.max(0, allowance.remaining ?? 0));
  const supportedIds = entitledIds;
  const unsupportedIds = uniqueIds.filter(id => !getTweakCompatibility(id).ok);

  if (!native) {
    for (const id of entitledIds) useOptimizationStore.getState().setTweak(id, true);
    return { appliedIds: [], selectedIds: entitledIds, unsupportedIds, failures: [] };
  }

  if (!credential) throw new Error("OG-AUTH-001 · Windows device identity unavailable.");

  if (!supportedIds.length) {
    return { appliedIds: [], selectedIds: [], unsupportedIds, failures: [] };
  }

  if (!sessionStorage.getItem(RESTORE_CREATED_KEY)) {
    try {
      const restorePoint = await createRestorePoint("Before Opti Gods tweak changes");
      if (!restorePoint?.sequence_number) {
        const message = "Windows did not confirm a restore point. Turn on System Protection for drive C: and try Full Optimize again.";
        uniqueIds.forEach((id, index) => onProgress?.({ id, index, total: uniqueIds.length, status: "failed", message }));
        return {
          appliedIds: [],
          selectedIds: [],
          unsupportedIds,
          failures: uniqueIds.map(id => ({ id, message })),
        };
      }
      sessionStorage.setItem(RESTORE_CREATED_KEY, String(restorePoint.sequence_number));
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Could not create a verified restore point.";
      const message = `Restore point failed: ${detail} Turn on System Protection for drive C: and try again.`;
      uniqueIds.forEach((id, index) => onProgress?.({ id, index, total: uniqueIds.length, status: "failed", message }));
      return {
        appliedIds: [],
          selectedIds: [],
        unsupportedIds,
        failures: uniqueIds.map(id => ({ id, message })),
      };
    }
  }

  const appliedIds: string[] = [];
  const failures: { id: string; message: string }[] = [];
  supportedIds.forEach((id, index) => onProgress?.({ id, index, total: supportedIds.length, status: "queued" }));
  for (let index = 0; index < supportedIds.length; index++) {
    const id = supportedIds[index];
    let ticket: string | null = null;
    let osApplied = false;
    onProgress?.({ id, index, total: supportedIds.length, status: "running" });
    try {
      const authorization = await fetch(apiUrl("/api/performance-allowance/native-ticket"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getNativeAuthHeaders() },
        body: JSON.stringify({
          tweakId: id,
          idempotencyKey: crypto.randomUUID().replace(/[^A-Za-z0-9_-]/g, ""),
        }),
      });
      const authorizationBody = await authorization.json().catch(() => ({}));
      if (!authorization.ok || typeof authorizationBody.ticket !== "string") {
        throw new Error(`${authorizationBody.code || `OG-HTTP-${authorization.status}`} · ${authorizationBody.error || "Authorization failed."}`);
      }
      ticket = authorizationBody.ticket;
      const result = await applyTweak(id, ticket, credential);
      if (!result.ok) throw new Error(result.message || "Windows rejected the change.");
      osApplied = true;
      const store = useOptimizationStore.getState();
      store.setTweak(id, true);
      store.markApplied([id]);
      saveUndoToken(id, result.undo_token);
      appliedIds.push(id);
      onProgress?.({ id, index, total: supportedIds.length, status: "applied", message: result.message });
    } catch (error) {
      if (ticket && !osApplied) {
        await fetch(apiUrl("/api/performance-allowance/native-ticket/cancel"), {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getNativeAuthHeaders() },
          body: JSON.stringify({ ticket }),
        }).catch(() => {});
      }
      const message = error instanceof Error ? error.message : "Windows rejected the change.";
      failures.push({ id, message });
      onProgress?.({ id, index, total: supportedIds.length, status: "failed", message });
    }
  }

  window.dispatchEvent(new Event("optigods:allowance-changed"));
  localStorage.removeItem(NATIVE_RUN_QUEUE_KEY);
  return { appliedIds, selectedIds: [], unsupportedIds, failures };
}