import { detectAppliedTweaks, isNative } from "@/lib/tauri-bridge";
import { useOptimizationStore } from "@/store/use-optimization-store";

/**
 * Combines Windows-detected state with tweaks that this app has successfully
 * applied. The store's appliedAt ledger is only written after confirmed success.
 */
export async function getAppliedTweakState(): Promise<Record<string, boolean>> {
  const { appliedAt } = useOptimizationStore.getState();
  let detected: Record<string, boolean> = {};

  if (isNative()) {
    try {
      detected = await detectAppliedTweaks();
    } catch (error) {
      if (Object.keys(appliedAt).length === 0) throw error;
      console.warn("Windows tweak detection failed; showing confirmed app history only.", error);
    }
  }

  return {
    ...detected,
    ...Object.fromEntries(Object.keys(appliedAt).map(id => [id, true])),
  };
}
