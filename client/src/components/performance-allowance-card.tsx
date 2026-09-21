import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/api-base";
import { BEST_15_IDS_KEY, getNativeAuthHeaders } from "@/lib/queryClient";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { useToast } from "@/hooks/use-toast";
import { isNative } from "@/lib/tauri-bridge";
import { queueTweakBatch } from "@/lib/native-tweak-runner";
import { useLocation } from "wouter";
import { authorizeHardwarePreset } from "@/lib/hardware-preset";
import { playOptimizationActionSound } from "@/lib/action-sound";
import { FREE_NATIVE_TWEAK_LIMIT } from "@shared/native-tweak-ids";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Allowance = { pro: boolean; limit: number | null; used: number; remaining: number | null };
/** Small, non-Pro-only choice surface; the server remains authoritative. */
export function PerformanceAllowanceCard() {
  const [status, setStatus] = useState<Allowance | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmBest, setConfirmBest] = useState(false);
  const [, navigate] = useLocation();
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
    if (!isNative()) {
      setLoaded(true);
      return;
    }
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
      const ids = Array.from(new Set([...(body.activeIds || []), ...(body.authorizedIds || [])])).slice(0, FREE_NATIVE_TWEAK_LIMIT);
      try { localStorage.setItem(BEST_15_IDS_KEY, JSON.stringify(ids)); } catch { /* ignore */ }
      const selected = { ...useOptimizationStore.getState().tweaks };
      Object.keys(selected).forEach(id => { selected[id] = false; });
      for (const id of ids) selected[id] = true;
      setAllTweaks(selected);
    }).catch(() => {});
    return () => controller.abort();
  }, [authRequired, loaded, setAllTweaks, status?.pro]);

  const executeChooseBest = async () => {
    if (authRequired) {
      toast({ title: "Windows app required", description: "OG-AUTH-001 · Open Opti Gods in the Windows app to use your 15 free device slots.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const body = await authorizeHardwarePreset();
      const ids = body.authorizedIds as string[];
      const visibleIds = Array.from(new Set([...(body.activeIds || []), ...ids])).slice(0, FREE_NATIVE_TWEAK_LIMIT);
      try { localStorage.setItem(BEST_15_IDS_KEY, JSON.stringify(visibleIds)); } catch { /* ignore */ }
      if (!isNative()) {
        const selected = { ...tweaks };
        Object.keys(selected).forEach(id => { selected[id] = false; });
        for (const id of visibleIds) selected[id] = true;
        setAllTweaks(selected);
        toast({ title: `${visibleIds.length} best tweaks selected`, description: "These server-validated choices match your saved system scan. Windows changes are not confirmed in the browser; open the Windows app or run the generated script to apply them." });
        await refresh();
        return;
      }

      queueTweakBatch(ids);
      navigate("/applied-tweaks?run=1");
    } catch (e) {
      toast({ title: "Could not select best tweaks", description: e instanceof Error ? e.message : "A saved scan is required.", variant: "destructive" });
    } finally { setBusy(false); }
  };

  const chooseBest = () => {
    if (busy) return;
    playOptimizationActionSound();
    setConfirmBest(true);
  };

  const chooseMyself = async () => {
    if (authRequired) {
      toast({ title: "Windows app required", description: "Open Opti Gods in the Windows app to view recommendations for this PC.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const body = await authorizeHardwarePreset();
      const ids = Array.from(new Set([...(body.activeIds || []), ...(body.authorizedIds || [])])).slice(0, FREE_NATIVE_TWEAK_LIMIT);
      try { localStorage.setItem(BEST_15_IDS_KEY, JSON.stringify(ids)); } catch { /* ignore */ }
      navigate("/tweaks?best15=1");
    } catch (error) {
      toast({
        title: "Could not load your Best 15",
        description: error instanceof Error ? error.message : "A saved system scan is required.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  // The Dashboard's other bulk buttons route free users through this same
  // server-authorized flow instead of selecting the entire local registry.
  useEffect(() => {
    const trigger = () => { chooseBest(); };
    window.addEventListener("optigods:enable-best-free", trigger);
    return () => window.removeEventListener("optigods:enable-best-free", trigger);
  }, [authRequired, status?.remaining, tweaks]);

  // Guests can browse and select tweaks, but this card is specifically for
  // native Windows entitlement slots. Do not show an action that can only
  // return "Windows app required" in an unsigned browser session.
  if (!loaded || status?.pro || !isNative()) return null;

  return (
    <>
      <section className="rounded-xl border border-red-500/20 bg-red-500/5 p-5" data-testid="performance-allowance-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-white">15 Active Free Tweak Slots</h2>
          <p className="mt-1 text-xs text-zinc-400">
            {authRequired
              ? "Open the Opti Gods Windows app to enable the 15 best free tweaks for this PC. Discord is only required for Pro."
              : "Free accounts can keep up to 15 native tweaks enabled at once. Undo a tweak to free its slot for another choice."}
          </p>
          {status && <p className="mt-2 text-xs font-semibold text-red-300">{status.used} / {status.limit} used · {status.remaining} left</p>}
        </div>
        <div className="flex gap-2">
          <button type="button" disabled={busy || status?.remaining === 0} onClick={() => void chooseBest()} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
            {busy ? "Enabling…" : status?.remaining === 0 ? "15 / 15 Used" : "Enable Best 15 Tweaks"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void chooseMyself()}
            className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-zinc-300 transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-white"
          >
            {busy ? "Loading…" : "Choose Myself"}
          </button>
        </div>
        </div>
      </section>

      <AlertDialog open={confirmBest} onOpenChange={setConfirmBest}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enable the Best 15 free tweaks?</AlertDialogTitle>
            <AlertDialogDescription>
              Opti Gods will use your free allowance to authorize up to 15 compatible tweaks for
              this device. A restore point is required before Windows changes run. In the Windows
              app you will see each tweak live as applied or failed; browser selections alone do
              not unlock Pro or claim that Windows was changed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={() => {
                setConfirmBest(false);
                void executeChooseBest();
              }}
            >
              Confirm Best 15
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}