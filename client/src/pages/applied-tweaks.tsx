import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { detectAppliedTweaks, isNative, undoTweak } from "@/lib/tauri-bridge";
import { apiUrl } from "@/lib/api-base";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { getTweakMeta } from "@/lib/tweak-registry";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, RefreshCw, Undo2, ShieldCheck, Radio } from "lucide-react";
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
  useEffect(() => { detectAppliedTweaks().then(setNativeState).finally(() => setLoading(false)); }, []);
  // Keep provenance separate: a local timestamp is a session record, not proof
  // that Windows currently has the value. Native detection is the only source
  // that can produce a "confirmed" label.
  const nativeIds = Object.keys(nativeState).filter(id => nativeState[id]);
  const sessionIds = Object.keys(appliedAt).filter(id => !nativeState[id]);
  const ids = Array.from(new Set([...nativeIds, ...sessionIds]));
  const undo = async (id: string) => {
    setUndoing(id);
    try {
      if (!isNative()) { toast({ title: "Native undo unavailable", description: "Open the Windows app to undo applied system changes." }); return; }
      const nativeToken = tokenFor(id);
      if (nativeToken) {
        const result = await undoTweak(id, nativeToken);
        if (result.ok) {
          setTweak(id, false); clearApplied(id);
          toast({ title: "Tweak undone", description: result.message, variant: "success" });
          setNativeState(s => ({ ...s, [id]: false }));
          return;
        }
      }
      const granular = await downloadUndoScript(id);
      if (granular) {
        setTweak(id, false); clearApplied(id);
        toast({ title: "Undo script downloaded", description: "Run it as Administrator to reverse this tweak.", variant: "success" });
      } else {
        toast({ title: "Undo script downloaded", description: "Run it as Administrator. For this tweak, the script will guide you to Restore Last Working State.", variant: "success" });
      }
    } catch (error) { toast({ title: "Undo failed", description: error instanceof Error ? error.message : "The safe native action could not complete.", variant: "destructive" }); }
    finally { setUndoing(null); }
  };
  return <AppLayout><div className="og-page-enter space-y-5">
    <header className="flex items-end justify-between gap-4">
      <div><p className="text-[10px] font-bold uppercase tracking-[.22em] text-red-400">Native state ledger</p><h1 className="text-3xl font-display font-bold text-white">Applied Tweaks</h1><p className="mt-1 text-sm text-zinc-500">Only changes confirmed by the native engine appear here. Undo is per tweak, never a category reset.</p></div>
      <button onClick={() => { setLoading(true); detectAppliedTweaks().then(setNativeState).finally(() => setLoading(false)); }} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-zinc-300 hover:border-red-500/40 hover:text-white"><RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Refresh state</button>
    </header>
    <div className="grid grid-cols-3 gap-3">
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[.04] p-4"><p className="text-[10px] uppercase tracking-widest text-emerald-300">Tracked</p><p className="mt-1 text-2xl font-mono font-bold text-white">{ids.length}</p></div>
      <div className="rounded-xl border border-white/10 bg-black/20 p-4"><p className="text-[10px] uppercase tracking-widest text-zinc-500">Native mode</p><p className="mt-1 text-sm font-bold text-zinc-200">{isNative() ? "Windows bridge online" : "Browser preview"}</p></div>
      <div className="rounded-xl border border-white/10 bg-black/20 p-4"><p className="text-[10px] uppercase tracking-widest text-zinc-500">Safety</p><p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-emerald-400"><ShieldCheck className="h-4 w-4" /> Direct undo only</p></div>
    </div>
    {ids.length === 0 ? <div className="og-scanline rounded-2xl border border-dashed border-white/10 bg-black/20 p-14 text-center"><Radio className="mx-auto h-8 w-8 text-zinc-700" /><p className="mt-3 text-sm font-bold text-zinc-300">No applied changes detected</p><p className="mt-1 text-xs text-zinc-600">Enable a supported tweak or run a native state scan.</p></div> :
      <div className="space-y-2">{ids.map(id => { const meta = getTweakMeta(id); const confirmed = Boolean(nativeState[id]); const provenance = confirmed ? "native confirmed" : (isNative() ? "session-recorded · pending verification" : "session-recorded · browser mode"); return <div key={id} className="flex items-center gap-4 rounded-xl border border-white/8 bg-black/30 px-4 py-3 transition-colors hover:border-red-500/30"><div className={cn("flex h-9 w-9 items-center justify-center rounded-lg border", confirmed ? "border-emerald-500/25 bg-emerald-500/10" : "border-amber-500/25 bg-amber-500/10")}><CheckCircle2 className={cn("h-4 w-4", confirmed ? "text-emerald-400" : "text-amber-400")} /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-zinc-100">{meta?.title || id}</p><p className="text-[11px] text-zinc-600">{meta?.category || "System tweak"} · {provenance}</p></div><span className={cn("text-[10px] font-mono", confirmed ? "text-emerald-400" : "text-amber-300")}>{confirmed ? "CONFIRMED" : "RECORDED"}</span><button disabled={undoing === id} onClick={() => undo(id)} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/25 bg-amber-500/[.06] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-amber-300 hover:bg-amber-500/15 disabled:opacity-50"><Undo2 className="h-3.5 w-3.5" /> {undoing === id ? "Undoing" : "Undo"}</button></div>; })}</div>}
  </div></AppLayout>;
}