import { useEffect, useState } from "react";
import { startForegroundPolling } from "@/lib/foreground-polling";
import { getWindowsProcessCount, isNative } from "@/lib/tauri-bridge";
import { boundedWindowsRead } from "@/lib/applied-tweak-state";
import { subscribeNativeTweakRun } from "@/lib/native-tweak-runner";

export function WindowsProcessCount() {
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!isNative()) return;
    let mounted = true;
    let busy = false;
    const refresh = async () => {
      if (busy) return;
      busy = true;
      try {
        const value = await boundedWindowsRead(getWindowsProcessCount(), "Process count", 3000);
        if (mounted) { setCount(value); setError(""); }
      } catch {
        if (mounted) { setCount(null); setError("Live process count unavailable"); }
      } finally { busy = false; }
    };
    const stop = startForegroundPolling(refresh, 15_000);
    const unsubscribe = subscribeNativeTweakRun(state => {
      if (!document.hidden && document.hasFocus() && state && ["completed", "failed", "stopped"].includes(state.status)) void refresh();
    });
    return () => { mounted = false; stop(); unsubscribe(); };
  }, []);
  if (!isNative()) return null;
  return (
    <section className="rounded-lg border border-red-500/20 bg-zinc-950/60 px-4 py-3 text-sm" data-testid="windows-process-count">
      <strong className="text-zinc-100">Apps open: {error || (count ?? "Reading…")}</strong>
    </section>
  );
}
