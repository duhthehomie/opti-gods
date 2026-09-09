import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/api-base";
import { getNativeAuthHeaders } from "@/lib/queryClient";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { useToast } from "@/hooks/use-toast";
import { applyTweak, createRestorePoint, getNativeAuthToken, isNative } from "@/lib/tauri-bridge";

type Allowance = { pro: boolean; limit: number | null; used: number; remaining: number | null };
const NATIVE_UNDO_KEY = "optigods-native-undo-tokens";

function saveUndoToken(id: string, token: string | null) {
  try {
    const all = JSON.parse(localStorage.getItem(NATIVE_UNDO_KEY) || "{}") as Record<string, string>;
    if (token) all[id] = token;
    localStorage.setItem(NATIVE_UNDO_KEY, JSON.stringify(all));
  } catch { /* best effort; native undo still remains available in-session */ }
}

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
  useEffect(() => { void refresh(); }, []);

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

  const chooseBest = async () => {
    if (authRequired) {
      toast({ title: "Discord login required", description: "Sign in with Discord so your 15 lifetime free tweak enables can be tracked securely.", variant: "destructive" });
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
        for (const id of ids) selected[id] = true;
        setAllTweaks(selected);
        toast({ title: `${ids.length} best tweaks enabled`, description: "These server-validated choices match your saved system scan. You can unselect any of them before running your script.", variant: "success" });
        await refresh();
        return;
      }

      // Native best mode is a real apply, not a visual toggle. Keep the same
      // server authorize -> trusted Rust apply -> completion sequence as the
      // individual TweakRow path, one tweak at a time.
      const nativeAuth = await getNativeAuthToken();
      if (!nativeAuth) throw new Error("Sign in to the Windows app before applying native tweaks.");
      await createRestorePoint("Before Opti Gods best 15 changes").catch(() => null);
      let applied = 0;
      for (const id of ids) {
        const idempotencyKey = crypto.randomUUID().replace(/[^A-Za-z0-9_-]/g, "");
        const auth = await fetch(apiUrl("/api/performance-allowance/native-ticket"), {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Native-Auth": nativeAuth },
          body: JSON.stringify({ tweakId: id, idempotencyKey }),
        });
        const authBody = await auth.json().catch(() => ({}));
        if (!auth.ok || typeof authBody.ticket !== "string") continue;
        let osApplied = false;
        try {
          const result = await applyTweak(id, authBody.ticket, nativeAuth);
          if (!result.ok) throw new Error(result.message || "Native apply failed");
          // Persist truthful OS state and Undo before the fallible ledger call.
          osApplied = true;
          setTweak(id, true);
          useOptimizationStore.getState().markApplied([id]);
          saveUndoToken(id, result.undo_token);
          applied++;
          if (result.message.includes("ALLOWANCE_SYNC_PENDING")) {
            toast({ title: "Applied; allowance sync pending", description: `${id} changed Windows successfully, but the server did not confirm the allowance. Undo remains available.`, variant: "destructive" });
          }
        } catch {
          if (!osApplied) {
            await fetch(apiUrl("/api/performance-allowance/native-ticket/cancel"), {
              method: "POST",
              headers: { "Content-Type": "application/json", "X-Native-Auth": nativeAuth },
              body: JSON.stringify({ ticket: authBody.ticket }),
            }).catch(() => {});
          }
          continue;
        }
      }
      toast({ title: `${applied} best tweaks enabled`, description: applied ? "Trusted native actions completed. Undo remains available for each successful tweak." : "No supported tweak could be applied.", variant: applied ? "success" : "destructive" });
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
  });

  if (!loaded || status?.pro) return null;

  return (
    <section className="rounded-xl border border-red-500/20 bg-red-500/5 p-5" data-testid="performance-allowance-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-white">15 Free Tweak Enables</h2>
          <p className="mt-1 text-xs text-zinc-400">
            {authRequired
              ? "Sign in with Discord to enable the 15 best free tweaks for your scanned system."
              : "Non-Pro accounts can enable 15 unique tweaks total. You can unselect choices before they run; Undo does not return an enable."}
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