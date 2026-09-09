import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { isNative, listPowerPlans, setPowerPlan, type NativePowerPlan } from "@/lib/tauri-bridge";
import { useToast } from "@/hooks/use-toast";
import { BatteryCharging, Check, RefreshCw, ShieldAlert, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PowerPlansPage() {
  const [plans, setPlans] = useState<NativePowerPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);
  const { toast } = useToast();
  const refresh = () => { setLoading(true); listPowerPlans().then(setPlans).catch(e => toast({ title: "Power plan read failed", description: e instanceof Error ? e.message : "Windows did not return plan data.", variant: "destructive" })).finally(() => setLoading(false)); };
  useEffect(refresh, []);
  const choose = async (guid: string) => { setSwitching(guid); try { await setPowerPlan(guid); toast({ title: "Power plan changed", description: "Windows confirmed the active plan." }); refresh(); } catch (e) { toast({ title: "Could not change plan", description: e instanceof Error ? e.message : "The native action failed.", variant: "destructive" }); } finally { setSwitching(null); } };
  return <AppLayout><div className="og-page-enter space-y-5">
    <header className="flex items-end justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.22em] text-red-400">Windows power control</p><h1 className="text-3xl font-display font-bold text-white">Power Plans</h1><p className="mt-1 text-sm text-zinc-500">Read and switch real Windows plans through the elevated native bridge. Nothing is simulated.</p></div><button onClick={refresh} className="rounded-lg border border-white/10 p-2 text-zinc-400 hover:border-red-500/40 hover:text-white"><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /></button></header>
    {!isNative() && <div className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[.05] p-4"><ShieldAlert className="mt-0.5 h-4 w-4 text-amber-400" /><div><p className="text-sm font-bold text-amber-200">Windows app required</p><p className="mt-1 text-xs text-amber-200/60">The browser cannot read or modify operating-system power plans. Launch Opti Gods Desktop to connect to Windows.</p></div></div>}
    {isNative() && !loading && plans.length === 0 && <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center"><BatteryCharging className="mx-auto h-8 w-8 text-zinc-700" /><p className="mt-3 text-sm font-bold text-zinc-300">No plans returned</p><p className="mt-1 text-xs text-zinc-600">Windows did not expose any power plans to the native bridge.</p></div>}
    <div className="grid gap-3 md:grid-cols-2">{plans.map(plan => <button key={plan.guid} onClick={() => choose(plan.guid)} disabled={!!switching || plan.active} className={cn("group flex items-center gap-4 rounded-xl border p-5 text-left transition-all", plan.active ? "border-emerald-500/45 bg-emerald-500/[.07]" : "border-white/8 bg-black/25 hover:border-red-500/30 hover:bg-red-500/[.03]")}><div className={cn("flex h-11 w-11 items-center justify-center rounded-xl border", plan.active ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400" : "border-white/10 bg-white/[.03] text-zinc-500 group-hover:text-red-300")}><Zap className="h-5 w-5" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-white">{plan.name}</p><p className="mt-1 truncate font-mono text-[10px] text-zinc-600">{plan.guid}</p></div>{plan.active ? <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400"><Check className="h-3.5 w-3.5" /> Active</span> : <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">{switching === plan.guid ? "Switching" : "Use plan"}</span>}</button>)}</div>
  </div></AppLayout>;
}