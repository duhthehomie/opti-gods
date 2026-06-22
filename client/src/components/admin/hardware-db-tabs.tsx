import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { HardwareRig, TweakSuggestion, NvidiaDriver, SuggestionStatus } from "@shared/schema";
import {
  Cpu, Search, Download, X, Inbox, CheckCircle2, Pencil, XCircle, Eye,
  MonitorSmartphone, RefreshCw, Sparkles, ShieldCheck, AlertTriangle,
} from "lucide-react";

type Headers = Record<string, string>;

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function timeAgo(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [cols.join(","), ...rows.map(r => cols.map(c => esc(r[c])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ────────────────────────────────────────────────────────────────────────────
// Hardware Database
// ────────────────────────────────────────────────────────────────────────────
export function HardwareDbTab({ headers }: { headers: Headers }) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"lastSeenAt" | "seenCount" | "firstSeenAt">("lastSeenAt");
  const [openRig, setOpenRig] = useState<HardwareRig | null>(null);
  const [suggestText, setSuggestText] = useState("");
  const [suggestCategory, setSuggestCategory] = useState("network");

  const rigsQ = useQuery<{ rigs: HardwareRig[] }>({
    queryKey: ["/api/admin/rigs", sort],
    queryFn: () => fetch(`/api/admin/rigs?sort=${sort}&limit=500`, { headers }).then(r => r.json()),
  });

  const rigs = rigsQ.data?.rigs ?? [];
  const filtered = useMemo(() => {
    if (!search.trim()) return rigs;
    const q = search.toLowerCase().trim();
    return rigs.filter(r =>
      r.cpu.toLowerCase().includes(q) ||
      r.gpu.toLowerCase().includes(q) ||
      (r.chassis ?? "").toLowerCase().includes(q) ||
      (r.motherboard ?? "").toLowerCase().includes(q) ||
      r.hash.includes(q) ||
      (r.proCode ?? "").toLowerCase().includes(q) ||
      (r.discordUserId ?? "").includes(q)
    );
  }, [rigs, search]);

  const suggestMut = useMutation({
    mutationFn: async (data: { rigHash: string; suggestion: string; category: string }) => {
      const res = await fetch("/api/admin/suggestions", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Suggestion added to inbox" });
      setSuggestText("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/suggestions"] });
    },
    onError: () => toast({ title: "Failed to create suggestion", variant: "destructive" }),
  });

  const exportCsv = () => {
    downloadCsv("opti-gods-rigs.csv", filtered.map(r => ({
      hash: r.hash,
      cpu: r.cpu,
      gpu: r.gpu,
      vramMb: r.vramMb,
      ramGb: r.ramGb,
      ramMhz: r.ramMhz,
      chassis: r.chassis,
      motherboard: r.motherboard,
      seenCount: r.seenCount,
      firstSeenAt: r.firstSeenAt,
      lastSeenAt: r.lastSeenAt,
      discordUserId: r.discordUserId,
    })));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-1 border-b border-white/5">
        <div className="p-1.5 rounded-lg bg-zinc-700/30 border border-zinc-500/20">
          <Cpu className="w-4 h-4 text-zinc-300" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-bold text-white">Hardware Database</p>
          <p className="text-[9px] text-zinc-600 uppercase tracking-widest">Every rig the desktop scanner has reported</p>
        </div>
        <button
          data-testid="button-refresh-rigs"
          onClick={() => rigsQ.refetch()}
          className="p-1.5 rounded hover:bg-white/5 text-zinc-500 hover:text-zinc-200"
          title="Refresh"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", rigsQ.isFetching && "animate-spin")} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-zinc-600 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            data-testid="input-search-rigs"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by CPU, GPU, code (NENG-B8KK-GT6B), hash…"
            className="w-full pl-8 pr-3 py-2 rounded-lg bg-zinc-900/70 border border-white/5 text-xs text-white placeholder:text-zinc-700 focus:outline-none focus:border-zinc-500/30"
          />
        </div>
        <select
          data-testid="select-rigs-sort"
          value={sort}
          onChange={e => setSort(e.target.value as typeof sort)}
          className="px-3 py-2 rounded-lg bg-zinc-900/70 border border-white/5 text-xs text-white focus:outline-none"
        >
          <option value="lastSeenAt">Last seen</option>
          <option value="seenCount">Seen count</option>
          <option value="firstSeenAt">First seen</option>
        </select>
        <button
          data-testid="button-export-rigs-csv"
          onClick={exportCsv}
          disabled={!filtered.length}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 border border-white/5 text-[10px] font-bold uppercase tracking-wider text-zinc-300 hover:bg-zinc-700 disabled:opacity-40"
        >
          <Download className="w-3 h-3" /> CSV
        </button>
        <span className="text-[10px] text-zinc-600">{filtered.length} / {rigs.length}</span>
      </div>

      {rigsQ.isLoading ? (
        <div className="p-8 text-center text-xs text-zinc-600 animate-pulse">Loading rigs…</div>
      ) : !filtered.length ? (
        <div className="p-10 text-center rounded-xl border border-white/5 bg-zinc-900/30">
          <MonitorSmartphone className="w-7 h-7 text-zinc-600 mx-auto mb-2" />
          <p className="text-xs text-zinc-400 font-bold">No rigs yet</p>
          <p className="text-[10px] text-zinc-600 mt-1">Once the desktop scanner uploads its first scan, it'll show up here.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/5 overflow-hidden">
          <table className="w-full text-[11px]">
            <thead className="bg-zinc-900/70 text-zinc-500 text-[9px] uppercase tracking-widest">
              <tr>
                <th className="text-left px-3 py-2 font-bold">Code</th>
                <th className="text-left px-3 py-2 font-bold">CPU</th>
                <th className="text-left px-3 py-2 font-bold">GPU</th>
                <th className="text-right px-3 py-2 font-bold hidden md:table-cell">RAM</th>
                <th className="text-left px-3 py-2 font-bold hidden md:table-cell">Chassis</th>
                <th className="text-right px-3 py-2 font-bold">Last</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map(r => (
                <tr
                  key={r.id}
                  data-testid={`row-rig-${r.id}`}
                  onClick={() => setOpenRig(r)}
                  className="hover:bg-white/5 cursor-pointer"
                >
                  <td className="px-3 py-2">
                    {r.proCode ? (
                      <span className="font-mono text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                        {r.proCode}
                      </span>
                    ) : (
                      <span className="text-zinc-700 text-[9px]">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-zinc-200 max-w-[160px] truncate">{r.cpu}</td>
                  <td className="px-3 py-2 text-zinc-200 max-w-[160px] truncate">{r.gpu}</td>
                  <td className="px-3 py-2 text-right text-zinc-400 hidden md:table-cell">{r.ramGb ? `${r.ramGb}GB` : "—"}</td>
                  <td className="px-3 py-2 text-zinc-500 hidden md:table-cell">{r.chassis ?? "—"}</td>
                  <td className="px-3 py-2 text-right text-zinc-500">{timeAgo(r.lastSeenAt)}</td>
                  <td className="px-3 py-2 text-right">
                    <Eye className="w-3.5 h-3.5 text-zinc-600 inline" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail side-panel */}
      {openRig && (
        <div className="fixed inset-0 z-50 flex" data-testid="panel-rig-detail">
          <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={() => setOpenRig(null)} />
          <div className="w-full max-w-md h-full bg-zinc-950 border-l border-white/10 overflow-y-auto">
            <div className="sticky top-0 bg-zinc-950/95 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-white">Rig Detail</p>
                <p className="text-[9px] font-mono text-zinc-600 truncate max-w-[260px]">{openRig.hash}</p>
              </div>
              <button onClick={() => setOpenRig(null)} className="p-1.5 rounded hover:bg-white/5 text-zinc-500" data-testid="button-close-rig-detail">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3 text-[11px]">
              {[
                ["CPU", openRig.cpu],
                ["GPU", openRig.gpu],
                ["VRAM", openRig.vramMb ? `${openRig.vramMb} MB` : "—"],
                ["RAM", openRig.ramGb ? `${openRig.ramGb} GB${openRig.ramMhz ? ` @ ${openRig.ramMhz} MHz` : ""}` : "—"],
                ["Motherboard", openRig.motherboard ?? "—"],
                ["Chassis", openRig.chassis ?? "—"],
                ["Cooling", openRig.coolingType ?? "—"],
                ["Refresh", openRig.refreshHz ? `${openRig.refreshHz} Hz` : "—"],
                ["NIC", openRig.nicVendor ?? "—"],
                ["Anticheats", (openRig.anticheats ?? []).join(", ") || "—"],
                ["Discord ID", openRig.discordUserId ?? "—"],
                ["Seen", `${openRig.seenCount}× · first ${fmtDate(openRig.firstSeenAt)} · last ${fmtDate(openRig.lastSeenAt)}`],
              ].map(([k, v]) => (
                <div key={k as string} className="flex justify-between gap-3 border-b border-white/5 pb-1.5">
                  <span className="text-zinc-600 uppercase tracking-wider text-[9px] font-bold">{k}</span>
                  <span className="text-zinc-300 text-right break-all">{v}</span>
                </div>
              ))}
              {openRig.storageSummary && (
                <div className="border-b border-white/5 pb-1.5">
                  <p className="text-zinc-600 uppercase tracking-wider text-[9px] font-bold mb-1">Storage</p>
                  <pre className="text-[10px] text-zinc-400 bg-zinc-900/60 p-2 rounded overflow-x-auto">{JSON.stringify(openRig.storageSummary, null, 2)}</pre>
                </div>
              )}

              <div className="mt-4 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3" /> Suggest tweaks for this rig
                </p>
                <select
                  data-testid="select-suggest-category"
                  value={suggestCategory}
                  onChange={e => setSuggestCategory(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg bg-zinc-900/70 border border-white/5 text-[11px] text-white"
                >
                  <option value="network">Network</option>
                  <option value="gpu">GPU</option>
                  <option value="cpu">CPU</option>
                  <option value="memory">Memory</option>
                  <option value="game">Game-specific</option>
                  <option value="other">Other</option>
                </select>
                <textarea
                  data-testid="textarea-suggest-text"
                  value={suggestText}
                  onChange={e => setSuggestText(e.target.value)}
                  placeholder="What tweak should we write for this rig?"
                  rows={3}
                  className="w-full px-2 py-1.5 rounded-lg bg-zinc-900/70 border border-white/5 text-[11px] text-white placeholder:text-zinc-700 resize-none"
                />
                <button
                  data-testid="button-create-suggestion"
                  disabled={!suggestText.trim() || suggestMut.isPending}
                  onClick={() => suggestMut.mutate({ rigHash: openRig.hash, suggestion: suggestText.trim(), category: suggestCategory })}
                  className="w-full py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {suggestMut.isPending ? "Adding…" : "Add to Suggestions Inbox"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Tweak Suggestions Inbox
// ────────────────────────────────────────────────────────────────────────────
const STATUS_ORDER: SuggestionStatus[] = ["open", "triaged", "written", "declined"];
const STATUS_CFG: Record<SuggestionStatus, { label: string; cls: string; icon: React.ElementType }> = {
  open:     { label: "Open",     cls: "bg-red-500/15 text-red-400 border-red-500/20",         icon: Inbox },
  triaged:  { label: "Triaged",  cls: "bg-amber-500/15 text-amber-400 border-amber-500/20",   icon: Eye },
  written:  { label: "Written",  cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20", icon: CheckCircle2 },
  declined: { label: "Declined", cls: "bg-zinc-700/40 text-zinc-500 border-white/5",          icon: XCircle },
};

export function SuggestionsInboxTab({ headers }: { headers: Headers }) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const sQ = useQuery<{ suggestions: TweakSuggestion[] }>({
    queryKey: ["/api/admin/suggestions"],
    queryFn: () => fetch("/api/admin/suggestions", { headers }).then(r => r.json()),
  });
  const rigsQ = useQuery<{ rigs: HardwareRig[] }>({
    queryKey: ["/api/admin/rigs", "lastSeenAt"],
    queryFn: () => fetch("/api/admin/rigs?limit=500", { headers }).then(r => r.json()),
  });

  const rigByHash = useMemo(() => {
    const m = new Map<string, HardwareRig>();
    (rigsQ.data?.rigs ?? []).forEach(r => m.set(r.hash, r));
    return m;
  }, [rigsQ.data]);

  const suggestions = sQ.data?.suggestions ?? [];
  const grouped = useMemo(() => {
    const m: Record<SuggestionStatus, TweakSuggestion[]> = { open: [], triaged: [], written: [], declined: [] };
    for (const s of suggestions) m[s.status]?.push(s);
    return m;
  }, [suggestions]);

  const updateMut = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: SuggestionStatus }) => {
      const res = await fetch(`/api/admin/suggestions/${id}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/suggestions"] }),
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const bulkUpdate = async (status: SuggestionStatus) => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    await Promise.all(ids.map(id => updateMut.mutateAsync({ id, status })));
    toast({ title: `Moved ${ids.length} suggestion${ids.length !== 1 ? "s" : ""} to ${status}` });
    setSelected(new Set());
  };

  const toggle = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-1 border-b border-white/5">
        <div className="p-1.5 rounded-lg bg-zinc-700/30 border border-zinc-500/20">
          <Inbox className="w-4 h-4 text-zinc-300" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-bold text-white">Tweak Suggestions Inbox</p>
          <p className="text-[9px] text-zinc-600 uppercase tracking-widest">Triage Aether's new-rig findings</p>
        </div>
        <button
          data-testid="button-refresh-suggestions"
          onClick={() => sQ.refetch()}
          className="p-1.5 rounded hover:bg-white/5 text-zinc-500 hover:text-zinc-200"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", sQ.isFetching && "animate-spin")} />
        </button>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900/70 border border-white/5">
          <span className="text-[10px] text-zinc-400 font-bold">{selected.size} selected</span>
          <div className="flex-1" />
          {STATUS_ORDER.map(st => (
            <button
              key={st}
              data-testid={`button-bulk-${st}`}
              onClick={() => bulkUpdate(st)}
              className={cn("flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider border", STATUS_CFG[st].cls)}
            >
              → {STATUS_CFG[st].label}
            </button>
          ))}
          <button
            onClick={() => setSelected(new Set())}
            className="p-1 rounded hover:bg-white/5 text-zinc-500"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {sQ.isLoading ? (
        <div className="p-8 text-center text-xs text-zinc-600 animate-pulse">Loading inbox…</div>
      ) : !suggestions.length ? (
        <div className="p-10 text-center rounded-xl border border-white/5 bg-zinc-900/30">
          <Inbox className="w-7 h-7 text-zinc-600 mx-auto mb-2" />
          <p className="text-xs text-zinc-400 font-bold">Inbox is empty</p>
          <p className="text-[10px] text-zinc-600 mt-1">Open a rig in the Hardware Database and click "Suggest tweaks" to start.</p>
        </div>
      ) : (
        STATUS_ORDER.map(st => {
          const items = grouped[st];
          if (!items.length) return null;
          const Cfg = STATUS_CFG[st];
          const Icon = Cfg.icon;
          return (
            <div key={st} className="space-y-2">
              <div className="flex items-center gap-2">
                <Icon className="w-3.5 h-3.5 text-zinc-500" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{Cfg.label}</p>
                <span className="text-[10px] text-zinc-600">{items.length}</span>
              </div>
              <div className="rounded-xl border border-white/5 overflow-hidden divide-y divide-white/5">
                {items.map(s => {
                  const rig = rigByHash.get(s.rigHash);
                  return (
                    <div key={s.id} data-testid={`row-suggestion-${s.id}`} className="px-3 py-3 flex items-start gap-3">
                      <input
                        type="checkbox"
                        data-testid={`checkbox-suggestion-${s.id}`}
                        checked={selected.has(s.id)}
                        onChange={() => toggle(s.id)}
                        className="mt-1 accent-red-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn("text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border", Cfg.cls)}>{Cfg.label}</span>
                          <span className="text-[10px] text-zinc-500 font-mono uppercase">{s.category}</span>
                          {rig && <span className="text-[10px] text-zinc-500 truncate">{rig.cpu} · {rig.gpu}</span>}
                        </div>
                        <p className="text-[11px] text-zinc-200 mt-1 leading-relaxed">{s.suggestion}</p>
                        <p className="text-[9px] text-zinc-700 mt-0.5">{timeAgo(s.createdAt)} · rig {s.rigHash.slice(0, 10)}…</p>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        {STATUS_ORDER.filter(x => x !== st).map(target => (
                          <button
                            key={target}
                            data-testid={`button-move-${s.id}-${target}`}
                            onClick={() => updateMut.mutate({ id: s.id, status: target })}
                            className={cn("text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border", STATUS_CFG[target].cls)}
                          >
                            → {STATUS_CFG[target].label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// NVIDIA Driver Tracker
// ────────────────────────────────────────────────────────────────────────────
function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(n => parseInt(n, 10) || 0);
  const pb = b.split(".").map(n => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export function NvidiaTrackerTab({ headers }: { headers: Headers }) {
  const { toast } = useToast();
  const [sortKey, setSortKey] = useState<"version" | "released" | "rigs">("released");

  const dQ = useQuery<{ drivers: NvidiaDriver[] }>({
    queryKey: ["/api/admin/nvidia-drivers"],
    queryFn: () => fetch("/api/admin/nvidia-drivers", { headers }).then(r => r.json()),
  });

  const drivers = dQ.data?.drivers ?? [];
  const sorted = useMemo(() => {
    const copy = [...drivers];
    copy.sort((a, b) => {
      if (sortKey === "version") return compareVersions(b.version, a.version);
      if (sortKey === "rigs") return (b.detectedOnRigsCount ?? 0) - (a.detectedOnRigsCount ?? 0);
      return (new Date(b.releasedAt ?? 0).getTime()) - (new Date(a.releasedAt ?? 0).getTime());
    });
    return copy;
  }, [drivers, sortKey]);

  const latest = useMemo(() => {
    if (!drivers.length) return null;
    return [...drivers].sort((a, b) => compareVersions(b.version, a.version))[0];
  }, [drivers]);
  const latestValidated = useMemo(() => {
    const v = drivers.filter(d => d.tweaksValidated);
    if (!v.length) return null;
    return v.sort((a, b) => compareVersions(b.version, a.version))[0];
  }, [drivers]);

  const validateMut = useMutation({
    mutationFn: async ({ version, tweaksValidated }: { version: string; tweaksValidated: boolean }) => {
      const res = await fetch("/api/admin/nvidia-drivers", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ version, tweaksValidated }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/nvidia-drivers"] }),
    onError: () => toast({ title: "Failed to update driver", variant: "destructive" }),
  });

  const banner = (() => {
    if (!latest) return null;
    const inSync = latestValidated && compareVersions(latest.version, latestValidated.version) === 0;
    return (
      <div
        data-testid="banner-driver-status"
        className={cn(
          "rounded-xl border p-3 flex items-center gap-3",
          inSync ? "bg-emerald-500/8 border-emerald-500/20" : "bg-amber-500/8 border-amber-500/20"
        )}
      >
        {inSync ? <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />}
        <div className="flex-1 text-[11px]">
          <p className={cn("font-bold", inSync ? "text-emerald-300" : "text-amber-300")}>
            {inSync ? "Tweak library in sync with the latest NVIDIA driver" : "Tweak library is behind"}
          </p>
          <p className="text-zinc-400 mt-0.5">
            Latest detected: <span className="font-mono text-white">{latest.version}</span>
            {" · "}
            Latest validated: <span className="font-mono text-white">{latestValidated?.version ?? "none"}</span>
          </p>
        </div>
      </div>
    );
  })();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-1 border-b border-white/5">
        <div className="p-1.5 rounded-lg bg-zinc-700/30 border border-zinc-500/20">
          <Cpu className="w-4 h-4 text-zinc-300" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-bold text-white">NVIDIA Driver Tracker</p>
          <p className="text-[9px] text-zinc-600 uppercase tracking-widest">Driver coverage for the tweak library</p>
        </div>
        <select
          value={sortKey}
          onChange={e => setSortKey(e.target.value as typeof sortKey)}
          className="px-2 py-1 rounded bg-zinc-900/70 border border-white/5 text-[10px] text-white"
          data-testid="select-driver-sort"
        >
          <option value="released">Released</option>
          <option value="version">Version</option>
          <option value="rigs">Rigs</option>
        </select>
        <button
          data-testid="button-refresh-drivers"
          onClick={() => dQ.refetch()}
          className="p-1.5 rounded hover:bg-white/5 text-zinc-500 hover:text-zinc-200"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", dQ.isFetching && "animate-spin")} />
        </button>
      </div>

      {banner}

      {dQ.isLoading ? (
        <div className="p-8 text-center text-xs text-zinc-600 animate-pulse">Loading drivers…</div>
      ) : !sorted.length ? (
        <div className="p-10 text-center rounded-xl border border-white/5 bg-zinc-900/30">
          <Cpu className="w-7 h-7 text-zinc-600 mx-auto mb-2" />
          <p className="text-xs text-zinc-400 font-bold">No driver versions tracked</p>
          <p className="text-[10px] text-zinc-600 mt-1">Run the seed script or wait for scans to populate this list.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/5 overflow-hidden">
          <table className="w-full text-[11px]">
            <thead className="bg-zinc-900/70 text-zinc-500 text-[9px] uppercase tracking-widest">
              <tr>
                <th className="text-left px-3 py-2 font-bold">Version</th>
                <th className="text-left px-3 py-2 font-bold">Branch</th>
                <th className="text-left px-3 py-2 font-bold">Released</th>
                <th className="text-right px-3 py-2 font-bold">Rigs</th>
                <th className="text-center px-3 py-2 font-bold">Validated</th>
                <th className="text-right px-3 py-2 font-bold">Last seen</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {sorted.map(d => (
                <tr key={d.version} data-testid={`row-driver-${d.version}`}>
                  <td className="px-3 py-2 text-white font-mono">{d.version}</td>
                  <td className="px-3 py-2 text-zinc-400">{d.branch ?? "—"}</td>
                  <td className="px-3 py-2 text-zinc-500">{fmtDate(d.releasedAt)}</td>
                  <td className="px-3 py-2 text-right text-zinc-400">{d.detectedOnRigsCount}</td>
                  <td className="px-3 py-2 text-center">
                    {d.tweaksValidated
                      ? <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">Validated</span>
                      : <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-white/5">Pending</span>}
                  </td>
                  <td className="px-3 py-2 text-right text-zinc-500">{timeAgo(d.lastSeenAt)}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      data-testid={`button-validate-${d.version}`}
                      onClick={() => validateMut.mutate({ version: d.version, tweaksValidated: !d.tweaksValidated })}
                      disabled={validateMut.isPending}
                      className={cn(
                        "text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded border",
                        d.tweaksValidated
                          ? "bg-zinc-800 text-zinc-400 border-white/5 hover:bg-zinc-700"
                          : "bg-emerald-500/15 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/25"
                      )}
                    >
                      {d.tweaksValidated ? "Unvalidate" : "Mark validated"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
