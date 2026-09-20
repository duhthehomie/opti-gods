import { apiUrl } from "@/lib/api-base";
import { detectAppliedTweaks, isNative, undoTweak } from "@/lib/tauri-bridge";
import { useOptimizationStore } from "@/store/use-optimization-store";

const TOKEN_KEY = "optigods-native-undo-tokens";

export type UndoAppliedTweaksSummary = {
  requested: number;
  nativeUndone: number;
  scripts: number;
  restoreScripts: number;
  unavailable: number;
  failed: number;
};

function tokenFor(id: string): string | null {
  try {
    return (JSON.parse(localStorage.getItem(TOKEN_KEY) || "{}") as Record<string, string>)[id] || null;
  } catch {
    return null;
  }
}

async function downloadUndoScript(id: string): Promise<boolean> {
  const sessionToken = localStorage.getItem("optigods_session_v2");
  const res = await fetch(apiUrl("/api/script/undo"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, sessionToken }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message || `Undo failed (${res.status})`);
  }
  const granular = res.headers.get("X-Undo-Available") === "true";
  const text = await res.text();
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `OptiGods-Undo-${id}.bat`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
  return granular;
}

export async function getAppliedTweakIds(): Promise<string[]> {
  const nativeState = isNative()
    ? await detectAppliedTweaks().catch(() => ({} as Record<string, boolean>))
    : {};
  const { appliedAt } = useOptimizationStore.getState();
  return Array.from(new Set([
    ...Object.keys(nativeState).filter(id => nativeState[id]),
    ...Object.keys(appliedAt),
  ]));
}

export async function undoAppliedTweaks(
  ids: readonly string[],
  onNativeUndone?: (id: string) => void,
): Promise<UndoAppliedTweaksSummary> {
  const summary: UndoAppliedTweaksSummary = {
    requested: ids.length,
    nativeUndone: 0,
    scripts: 0,
    restoreScripts: 0,
    unavailable: 0,
    failed: 0,
  };

  for (const id of ids) {
    try {
      if (!isNative()) {
        summary.unavailable++;
        continue;
      }
      const nativeToken = tokenFor(id);
      if (nativeToken) {
        const result = await undoTweak(id, nativeToken);
        if (result.ok) {
          useOptimizationStore.getState().setTweak(id, false);
          useOptimizationStore.getState().clearApplied(id);
          onNativeUndone?.(id);
          summary.nativeUndone++;
          continue;
        }
      }
      const granular = await downloadUndoScript(id);
      if (granular) summary.scripts++;
      else summary.restoreScripts++;
    } catch {
      summary.failed++;
    }
  }

  return summary;
}
