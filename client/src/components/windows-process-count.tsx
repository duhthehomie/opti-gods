import { useEffect, useState } from "react";
import { getWindowsProcessCount, isNative } from "@/lib/tauri-bridge";
import { boundedWindowsRead } from "@/lib/applied-tweak-state";
import { readNativeTweakRun, subscribeNativeTweakRun } from "@/lib/native-tweak-runner";

export function WindowsProcessCount() {
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [run, setRun] = useState(readNativeTweakRun);
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
    void refresh();
    const timer = setInterval(() => void refresh(), 3000);
    const unsubscribe = subscribeNativeTweakRun(state => { setRun(state); void refresh(); });
    return () => { mounted = false; clearInterval(timer); unsubscribe(); };
  }, []);
  if (!isNative()) return null;
  return (
    <section className="rounded-lg border border-red-500/20 bg-zinc-950/60 px-4 py-3 text-sm" data-testid="windows-process-count">
      <strong className="text-zinc-100">Windows processes: {error || (count ?? "Reading…")}</strong>
      <p className="mt-1 text-xs text-zinc-400">
        Task Manager → Performance → CPU → Processes. Live snapshot; other apps may start or exit.
        {run?.processCountBefore != null && <> Last optimization: {run.processCountBefore} before{run.processCountAfter != null ? ` → ${run.processCountAfter} after` : " → measuring after completion"}.</>}
      </p>
    </section>
  );
}
