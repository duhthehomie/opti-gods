import { useEffect, useState } from "react";
import { isNative } from "@/lib/tauri-bridge";
import { getAppliedTweakState } from "@/lib/applied-tweak-state";

let request: ReturnType<typeof getAppliedTweakState> | null = null;
let snapshot: Record<string, boolean> | null = null;
let expiresAt = 0;
let generation = 0;
function readShared() {
  if (snapshot && Date.now() < expiresAt) return Promise.resolve(snapshot);
  if (!request) {
    const startedGeneration = generation;
    request = getAppliedTweakState().then(result => {
      if (startedGeneration === generation) {
        snapshot = result;
        expiresAt = Date.now() + 3000;
      }
      return result;
    }).finally(() => { request = null; });
  }
  return request;
}

/** Live false beats old history; checking is never counted as confirmed. */
export function useConfirmedTweaks() {
  const native = isNative();
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>(snapshot ?? {});
  const [ready, setReady] = useState(!native || Boolean(snapshot && Date.now() < expiresAt));
  useEffect(() => {
    if (!native) return;
    let cancelled = false;
    const refresh = async () => {
      setReady(false);
      try {
        const result = await readShared();
        if (!cancelled) { setConfirmed(result); setReady(true); }
      } catch (error) {
        console.warn("Could not verify section recommendation counts.", error);
        // Do not claim that unchecked history is Windows confirmation.
        if (!cancelled) setReady(false);
      }
    };
    const invalidate = () => {
      generation++;
      expiresAt = 0;
      void refresh();
    };
    void refresh();
    window.addEventListener("optigods:allowance-changed", invalidate);
    return () => { cancelled = true; window.removeEventListener("optigods:allowance-changed", invalidate); };
  }, [native]);
  return { confirmed, ready };
}
