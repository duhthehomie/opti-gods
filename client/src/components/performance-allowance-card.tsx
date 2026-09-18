import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/api-base";
import { getNativeAuthHeaders } from "@/lib/queryClient";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { useToast } from "@/hooks/use-toast";
import { isNative } from "@/lib/tauri-bridge";
import { applyTweakBatch } from "@/lib/native-tweak-runner";

type Allowance = { pro: boolean; limit: number | null; used: number; remaining: number | null };
/** Small, non-Pro-only choice surface; the server remains authoritative. */
export function PerformanceAllowanceCard() {
  const [status, setStatus] = useState<Allowance | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [busy, setBusy] = useState(false);
  const tweaks = useOptimizationStore(s => s.tweaks);
  const setTweak = useOptimizationStore(s => s.setTweak);
  const setAllTweaks = useOptimizationStore(s => s.setAllTweaks);
  const { toast } = useToast();

  const refresh = () => fetch(apiUrl("/api/performance-allowance"), { headers: getNativeAuthHeaders() })
    .then(async r => {
      setAuthRequired(r.status === 401);
      setStatus(r.ok ? (await r.json() as Allowance) : null);
    })
    .catch(() => {
      setAuthRequired(false);
      setStatus(null);
    })
    .finally(() => setLoaded(true));
  useEffect(() => {
    void refresh();
    const onAllowanceChanged = () => { void refresh(); };
    window.addEventListener("optigods:allowance-changed", onAllowanceChanged);
    return () => window.removeEventListener("optigods:allowance-changed", onAllowanceChanged);
  }, []);

  // Old bulk actions could leave hundreds of free toggles persisted locally.
  // Once the server confirms a free/logged-out session, remove that misleading
  // oversized selection. The Best 15 button below then rebuilds it safely.
  useEffect(() => {
    if (!loaded || (!authRequired && status?.pro !== false)) return;
    if (Object.values(tweaks).filter(Boolean).length <= 15) return;
    const cleared = { ...tweaks };
    Object.keys(cleared).forEach(id => { cleared[id] = false; });
    setAllTweaks(cleared);
  }, [authRequired, loaded, setAllTweaks, status?.pro, tweaks]);

  useEffect(() => {
    if (!loaded || authRequired || status?.pro !== false) return;
    const controller = new AbortController();
    void fetch(apiUrl("/api/performance-allowance/authorize"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getNativeAuthHeaders() },
      body: JSON.stringify({ mode: "best", preview: true, idempotencyKey: crypto.randomUUID().replace(/[^A-Za-z0-9_-]/g, "") }),
      signal: controller.signal,
    }).then(async response => {
      if (!response.ok) return;
      const body = await response.json();
      const ids = [...(body.activeIds || []), ...(body.authorizedIds || [])].slice(0, 15);
      const selected = { ...useOptimizationStore.getState().tweaks };
      Object.keys(selected).forEach(id => { selected[id] = false; });
      for (const id of ids) selected[id] = true;
      setAllTweaks(selected);
    }).catch(() => {});
    return () => controller.abort();
  }, [authRequired, loaded, setAllTweaks, status?.pro]);

  const chooseBest = async () => {
    if (authRequired) {
      toast({ title: "Discord login required", description: "Sign in with Discord so your 15 active free tweak slots can be tracked securely.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const key = crypto.randomUUID().replace(/[^A-Za-z0-9_-]/g, "");
      const r = await fetch(apiUrl("/api/performance-allowance/authorize"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getNativeAuthHeaders() },
        body: JSON.stringify({ mode: "best", preview: true, idempotencyKey: key }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error || "A saved system scan is required.");
      const ids = (body.authorizedIds as string[]).slice(0, Math.max(0, Number(body.remaining ?? 15)));
      if (!isNative()) {
        const selected = { ...tweaks };
        Object.keys(selected).forEach(id => { selected[id] = false; });
        const visibleIds = [...(body.activeIds || []), ...ids].slice(0, 15);
        for (const id of visibleIds) selected[id] = true;
        setAllTweaks(selected);
        toast({ title: `${visibleIds.length} best tweaks selected`, description: "These server-validated choices match your saved system scan. Download and run the .bat to apply new selections.", variant: "success" });
        await refresh();
        return;
      }

      const result = await applyTweakBatch(ids);
      const applied = result.appliedIds.length;
      const failures = result.failures.map(failure => `${failure.id}: ${failure.message}`);
      toast({ title: `${applied} best tweaks enabled`, description: applied ? "Trusted native actions completed. Undo remains available for each successful tweak." : "No supported tweak could be applied.", variant: applied ? "success" : "destructive" });
      if (failures.length) {
        toast({
          title: `${failures.length} tweak${failures.length === 1 ? "" : "s"} not applied`,
          description: failures.slice(0, 3).join(" · "),
          variant: "destructive",
        });
      }
      await refresh();
    } catch (e) {
      toast({ title: "Could not select best tweaks", description: e instanceof Error ? e.message : "A saved scan is required.", variant: "destructive" });
    } finally { setBusy(false); }
  };

  // The Dashboard's other bulk buttons route free users through this same
  // server-authorized flow instead of selecting the entire local registry.
  useEffect(() => {
    const trigger = () => { void chooseBest(); };
    window.addEventListener("optigods:enable-best-free", trigger);
    return () => window.removeEventListener("optigods:enable-best-free", trigger);
  }, [authRequired, status?.remaining, tweaks]);

  if (!loaded || status?.pro) return null;

  return (
    <section className="rounded-xl border border-red-500/20 bg-red-500/5 p-5" data-testid="performance-allowance-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-white">15 Active Free Tweak Slots</h2>
          <p className="mt-1 text-xs text-zinc-400">
            {authRequired
              ? "Sign in with Discord to enable the 15 best free tweaks for your scanned system."
              : "Free accounts can keep up to 15 native tweaks enabled at once. Undo a tweak to free its slot for another choice."}
          </p>
          {status && <p className="mt-2 text-xs font-semibold text-red-300">{status.used} / {status.limit} used · {status.remaining} left</p>}
        </div>
        <div className="flex gap-2">
          <button type="button" disabled={busy || status?.remaining === 0} onClick={() => void chooseBest()} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
            {busy ? "Enabling…" : status?.remaining === 0 ? "15 / 15 Used" : "Enable Best 15 Tweaks"}
          </button>
          <span className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-zinc-300">Choose myself below</span>
        </div>
      </div>
    </section>
  );
}