import { useEffect, useRef, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { detectAppliedTweaks, isNative, undoTweak } from "@/lib/tauri-bridge";
import { apiUrl } from "@/lib/api-base";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { getTweakMeta } from "@/lib/tweak-registry";
import { useToast } from "@/hooks/use-toast";
import { applyTweakBatch, NATIVE_RUN_QUEUE_KEY, readQueuedTweakBatch, type TweakRunProgress } from "@/lib/native-tweak-runner";
import { AlertCircle, CheckCircle2, Loader2, Play, RefreshCw, Undo2, ShieldCheck, Radio, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";

const TOKEN_KEY = "optigods-native-undo-tokens";
function tokenFor(id: string) { try { return (JSON.parse(localStorage.getItem(TOKEN_KEY) || "{}") as Record<string,string>)[id] || null; } catch { return null; } }

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
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `OptiGods-Undo-${id}.bat`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return granular;
}

export default function AppliedTweaksPage() {
  const { tweaks, appliedAt, setTweak, clearApplied } = useOptimizationStore();
  const { toast } = useToast();
  const [nativeState, setNativeState] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [undoing, setUndoing] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchUndoing, setBatchUndoing] = useState(false);
  const [showRestartPrompt, setShowRestartPrompt] = useState(false);
  const [runItems, setRunItems] = useState<TweakRunProgress[]>([]);
  const [running, setRunning] = useState(false);
  const [runFinished, setRunFinished] = useState(false);
  const startedRef = useRef(false);
  useEffect(() => { detectAppliedTweaks().then(setNativeState).finally(() => setLoading(false)); }, []);
  useEffect(() => {
    if (startedRef.current || !isNative()) return;
    const queued = readQueuedTweakBatch();
    if (!queued.length) return;
    startedRef.current = true;
    localStorage.removeItem(NATIVE_RUN_QUEUE_KEY);
    setRunning(true);
    setRunItems(queued.map((id, index) => ({ id, index, total: queued.length, status: "queued" })));
    void applyTweakBatch(queued, progress => {
      setRunItems(items => items.map(item => item.id === progress.id ? progress : item));
    }).then(result => {
      setRunFinished(true);
      setShowRestartPrompt(result.appliedIds.length > 0);
      toast({
        title: result.appliedIds.length ? `${result.appliedIds.length} tweaks applied` : "No tweaks were applied",
        description: result.failures.length
          ? `${result.failures.length} failed. Review the in-app results below.`
          : "Every selected Windows change was confirmed. Restart your PC for the full boost.",
        variant: result.appliedIds.length ? "success" : "destructive",
      });
    }).catch(error => {
      setRunFinished(true);
      toast({ title: "Tweak run stopped", description: error instanceof Error ? error.message : "Windows could not start the in-app runner.", variant: "destructive" });
    }).finally(() => {
      setRunning(false);
      detectAppliedTweaks().then(setNativeState);
    });
  }, [toast]);
  // Keep provenance separate: a local timestamp is a session record, not proof
  // that Windows currently has the value. Native detection is the only source
  // that can produce a "confirmed" label.
  const nativeIds = Object.keys(nativeState).filter(id => nativeState[id]);
  const sessionIds = Object.keys(appliedAt).filter(id => !nativeState[id]);
  const ids = Array.from(new Set([...nativeIds, ...sessionIds]));
  const undo = async (id: string, quiet = false): Promise<boolean> => {
    setUndoing(id);
    try {
      if (!isNative()) { if (!quiet) toast({ title: "Native undo unavailable", description: "Open the Windows app to undo applied system changes." }); return false; }
      const nativeToken = tokenFor(id);
      if (nativeToken) {
        const result = await undoTweak(id, nativeToken);
        if (result.ok) {
          setTweak(id, false); clearApplied(id);
          if (!quiet) toast({ title: "Tweak undone", description: result.message, variant: "success" });
          setNativeState(s => ({ ...s, [id]: false }));
          setSelected(s => { const next = new Set(s); next.delete(id); return next; });
          if (!quiet) setShowRestartPrompt(true);
          return true;
        }
      }
      const granular = await downloadUndoScript(id);
      if (granular) {
        setTweak(id, false); clearApplied(id);
        if (!quiet) toast({ title: "Undo script downloaded", description: "Run it as Administrator to reverse this tweak.", variant: "success" });
      } else {
        if (!quiet) toast({ title: "Undo script downloaded", description: "Run it as Administrator. For this tweak, the script will guide you to Restore Last Working State.", variant: "success" });
      }
      if (!quiet) setShowRestartPrompt(true);
      return granular;
    } catch (error) { if (!quiet) toast({ title: "Undo failed", description: error instanceof Error ? error.message : "The safe native action could not complete.", variant: "destructive" }); return false; }
    finally { setUndoing(null); }
  };
  const undoSelected = async () => {
    if (!selected.size || batchUndoing) return;
    setBatchUndoing(true);
    let completed = 0;
    for (const id of Array.from(selected)) {
      if (await undo(id, true)) completed++;
    }
    setBatchUndoing(false);
    toast({
      title: completed ? `${completed} tweak${completed === 1 ? "" : "s"} undone` : "No tweaks were undone",
      description: completed ? "The selected Windows changes were reversed." : "The selected tweaks could not be reversed automatically.",
      variant: completed ? "success" : "destructive",
    });
    if (completed) setShowRestartPrompt(true);
  };
  return <AppLayout><div className="og-page-enter space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-[10px] font-bold uppercase tracking-[.22em] text-red-400">Native state ledger</p><h1 className="text-3xl font-display font-bold text-white">Applied Tweaks</h1><p className="mt-1 text-sm text-zinc-500">Only changes confirmed by the native engine appear here. Undo is per tweak, never a category reset.</p></div>
      <div className="flex items-center gap-2">
        {ids.length > 0 && <button disabled={!selected.size || batchUndoing} onClick={undoSelected} className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/[.07] px-3 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500/15 disabled:opacity-40"><Undo2 className="h-3.5 w-3.5" />{batchUndoing ? "Undoing…" : `Undo selected (${selected.size})`}</button>}
        <button onClick={() => { setLoading(true); detectAppliedTweaks().then(setNativeState).finally(() => setLoading(false)); }} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-zinc-300 hover:border-red-500/40 hover:text-white"><RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Refresh state</button>
      </div>
    </header>
    <div className="grid grid-cols-3 gap-3">
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[.04] p-4"><p className="text-[10px] uppercase tracking-widest text-emerald-300">Tracked</p><p className="mt-1 text-2xl font-mono font-bold text-white">{ids.length}</p></div>
      <div className="rounded-xl border border-white/10 bg-black/20 p-4"><p className="text-[10px] uppercase tracking-widest text-zinc-500">Native mode</p><p className="mt-1 text-sm font-bold text-zinc-200">{isNative() ? "Windows bridge online" : "Browser preview"}</p></div>
      <div className="rounded-xl border border-white/10 bg-black/20 p-4"><p className="text-[10px] uppercase tracking-widest text-zinc-500">Safety</p><p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-emerald-400"><ShieldCheck className="h-4 w-4" /> Direct undo only</p></div>
    </div>
    {runItems.length > 0 && <section className="overflow-hidden rounded-2xl border border-red-500/25 bg-black/30">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-5 py-4">
        <div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-red-400">In-app Windows runner</p><h2 className="mt-1 text-base font-bold text-white">{running ? "Applying selected tweaks…" : runFinished ? "Tweak run complete" : "Ready to apply"}</h2></div>
        <div className="flex items-center gap-2 text-xs font-bold text-zinc-300">{running && <Loader2 className="h-4 w-4 animate-spin text-red-400" />} {runItems.filter(item => item.status === "applied").length} / {runItems.length} confirmed</div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-900"><div className="h-full bg-gradient-to-r from-red-600 to-emerald-500 transition-all duration-300" style={{ width: `${Math.round((runItems.filter(item => item.status === "applied" || item.status === "failed").length / runItems.length) * 100)}%` }} /></div>
      </div>
      <div className="max-h-80 space-y-1 overflow-y-auto p-3">
        {runItems.map(item => { const meta = getTweakMeta(item.id); return <div key={item.id} className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[.02] px-3 py-2">
          {item.status === "running" ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-red-400" /> : item.status === "applied" ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" /> : item.status === "failed" ? <AlertCircle className="h-4 w-4 shrink-0 text-red-400" /> : <Play className="h-4 w-4 shrink-0 text-zinc-600" />}
          <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-zinc-200">{meta?.title || item.id}</p>{item.message && <p className={cn("mt-0.5 truncate text-[10px]", item.status === "failed" ? "text-red-300" : "text-zinc-500")}>{item.message}</p>}</div>
          <span className={cn("text-[9px] font-black uppercase tracking-wider", item.status === "applied" ? "text-emerald-400" : item.status === "failed" ? "text-red-400" : item.status === "running" ? "text-red-300" : "text-zinc-600")}>{item.status}</span>
        </div>; })}
      </div>
    </section>}
    {ids.length === 0 ? <div className="og-scanline rounded-2xl border border-dashed border-white/10 bg-black/20 p-14 text-center"><Radio className="mx-auto h-8 w-8 text-zinc-700" /><p className="mt-3 text-sm font-bold text-zinc-300">No applied changes detected</p><p className="mt-1 text-xs text-zinc-600">Enable a supported tweak or run a native state scan.</p></div> :
      <div className="space-y-2"><div className="flex justify-end"><button onClick={() => setSelected(selected.size === ids.length ? new Set() : new Set(ids))} className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 hover:text-white">{selected.size === ids.length ? "Clear selection" : "Select all applied"}</button></div>{ids.map(id => { const meta = getTweakMeta(id); const confirmed = Boolean(nativeState[id]); const timestamp = appliedAt[id]; const provenance = confirmed ? "native confirmed" : (isNative() ? "session-recorded · pending verification" : "session-recorded · browser mode"); return <div key={id} className={cn("flex items-center gap-4 rounded-xl border bg-black/30 px-4 py-3 transition-colors hover:border-red-500/30", selected.has(id) ? "border-red-500/40" : "border-white/8")}><input type="checkbox" checked={selected.has(id)} onChange={() => setSelected(s => { const next = new Set(s); next.has(id) ? next.delete(id) : next.add(id); return next; })} aria-label={`Select ${meta?.title || id}`} className="h-4 w-4 accent-red-600" /><div className={cn("flex h-9 w-9 items-center justify-center rounded-lg border", confirmed ? "border-emerald-500/25 bg-emerald-500/10" : "border-amber-500/25 bg-amber-500/10")}><CheckCircle2 className={cn("h-4 w-4", confirmed ? "text-emerald-400" : "text-amber-400")} /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-zinc-100">{meta?.title || id}</p><p className="text-[11px] text-zinc-600">{meta?.category || "System tweak"} · {provenance}</p>{timestamp && <p className="mt-0.5 text-[10px] text-emerald-300/75">Applied {new Date(timestamp).toLocaleString()}</p>}</div><span className={cn("text-[10px] font-mono", confirmed ? "text-emerald-400" : "text-amber-300")}>{confirmed ? "CONFIRMED" : "RECORDED"}</span><button disabled={undoing === id || batchUndoing} onClick={() => void undo(id)} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/25 bg-amber-500/[.06] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-amber-300 hover:bg-amber-500/15 disabled:opacity-50"><Undo2 className="h-3.5 w-3.5" /> {undoing === id ? "Undoing" : "Undo"}</button></div>; })}</div>}
    {showRestartPrompt && <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4"><div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-zinc-950 p-6 shadow-2xl"><button onClick={() => setShowRestartPrompt(false)} className="float-right text-zinc-600 hover:text-white"><X className="h-4 w-4" /></button><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-red-500/25 bg-red-500/10"><RotateCcw className="h-6 w-6 text-red-400" /></div><h2 className="text-xl font-bold text-white">{runFinished ? "Tweaks successfully applied" : "Tweaks undone"}</h2><p className="mt-2 text-sm leading-relaxed text-zinc-400">{runFinished ? "Restart your PC now to finish applying every confirmed change and get the full performance boost." : "You can restart Windows now to finish restoring every changed system setting."}</p><button onClick={() => setShowRestartPrompt(false)} className="mt-5 w-full rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white hover:bg-red-500">Got it</button></div></div>}
  </div></AppLayout>;
}