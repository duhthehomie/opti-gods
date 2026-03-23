import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Copy, Trash2, Plus, Key, Link, Check, AlertCircle, Shield,
  LogOut, DollarSign, Users, BarChart3, Clock, Search, Zap,
  MessageSquare, Flame, RefreshCw, ChevronDown, ChevronUp, RotateCcw, ShieldOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useProStatus, setProStatus, getProStatus } from "@/lib/pro-status";
import type { ProAccessCode, ProFriendToken } from "@shared/schema";

const ADMIN_KEY_STORAGE = "optigods_admin_key";
const PRICE_PER_CODE = 25;

function getAppOrigin(): string {
  return window.location.origin;
}

function fmt(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function timeAgo(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200 transition-colors"
    >
      {copied
        ? <><Check className="w-3 h-3 text-red-400" />{label && <span className="text-red-400">Copied!</span>}</>
        : <><Copy className="w-3 h-3" />{label && <span>{label}</span>}</>
      }
    </button>
  );
}

function StatCard({
  icon: Icon, label, value, sub, color = "zinc",
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color?: "red" | "zinc" | "green" | "amber";
}) {
  const iconColor = {
    red: "text-red-400",
    zinc: "text-zinc-400",
    green: "text-emerald-400",
    amber: "text-amber-400",
  }[color];

  return (
    <div className="bg-zinc-900/70 border border-white/5 rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</span>
        <Icon className={cn("w-4 h-4", iconColor)} />
      </div>
      <div className={cn("text-2xl font-bold font-display", iconColor === "text-zinc-400" ? "text-white" : iconColor)}>
        {value}
      </div>
      {sub && <p className="text-[10px] text-zinc-600">{sub}</p>}
    </div>
  );
}

type Tab = "codes" | "friends" | "activity";

export default function Admin() {
  const { toast } = useToast();
  const isPro = useProStatus();
  const [key, setKey] = useState(() => localStorage.getItem(ADMIN_KEY_STORAGE) || "");
  const [input, setInput] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState("");

  const [tab, setTab] = useState<Tab>("codes");
  const [noteCode, setNoteCode] = useState("");
  const [noteFriend, setNoteFriend] = useState("");
  const [searchCode, setSearchCode] = useState("");
  const [searchFriend, setSearchFriend] = useState("");
  const [filterCode, setFilterCode] = useState<"all" | "available" | "used">("all");
  const [filterFriend, setFilterFriend] = useState<"all" | "available" | "used">("all");
  const [confirmPurgeCodes, setConfirmPurgeCodes] = useState(false);
  const [confirmPurgeFriends, setConfirmPurgeFriends] = useState(false);

  const headers = { "Content-Type": "application/json", "x-admin-key": key };

  const statsQuery = useQuery<{
    totalCodes: number; usedCodes: number; availableCodes: number;
    totalFriends: number; usedFriends: number; availableFriends: number;
    revenueEstimate: number;
    visits: { total: number; today: number; thisWeek: number };
  }>({
    queryKey: ["/api/admin/stats", key],
    queryFn: () => fetch("/api/admin/stats", { headers }).then(r => {
      if (!r.ok) throw new Error("Unauthorized");
      return r.json();
    }),
    enabled: authed,
    retry: false,
    refetchInterval: 30000,
  });

  const codesQuery = useQuery<ProAccessCode[]>({
    queryKey: ["/api/admin/codes", key],
    queryFn: () => fetch("/api/admin/codes", { headers }).then(r => {
      if (!r.ok) throw new Error("Unauthorized");
      return r.json();
    }),
    enabled: authed,
    retry: false,
  });

  const friendsQuery = useQuery<ProFriendToken[]>({
    queryKey: ["/api/admin/friends", key],
    queryFn: () => fetch("/api/admin/friends", { headers }).then(r => {
      if (!r.ok) throw new Error("Unauthorized");
      return r.json();
    }),
    enabled: authed,
    retry: false,
  });

  const genCode = useMutation({
    mutationFn: () => fetch("/api/admin/codes", {
      method: "POST", headers, body: JSON.stringify({ note: noteCode.trim() || null }),
    }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/codes", key] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats", key] });
      setNoteCode("");
      toast({ title: "Code generated", description: "New access code is ready to send." });
    },
  });

  const delCode = useMutation({
    mutationFn: (id: number) => fetch(`/api/admin/codes/${id}`, { method: "DELETE", headers }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/codes", key] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats", key] });
    },
  });

  const purgeUsedCodes = useMutation({
    mutationFn: () => fetch("/api/admin/codes/used/purge", { method: "DELETE", headers }).then(r => r.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/codes", key] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats", key] });
      setConfirmPurgeCodes(false);
      toast({ title: `Purged ${data.deleted} used codes`, description: "Redeemed codes cleared." });
    },
  });

  const genFriend = useMutation({
    mutationFn: () => fetch("/api/admin/friends", {
      method: "POST", headers, body: JSON.stringify({ note: noteFriend.trim() || null }),
    }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/friends", key] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats", key] });
      setNoteFriend("");
      toast({ title: "Friend link generated", description: "New free access link is ready." });
    },
  });

  const delFriend = useMutation({
    mutationFn: (id: number) => fetch(`/api/admin/friends/${id}`, { method: "DELETE", headers }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/friends", key] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats", key] });
    },
  });

  const purgeUsedFriends = useMutation({
    mutationFn: () => fetch("/api/admin/friends/used/purge", { method: "DELETE", headers }).then(r => r.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/friends", key] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats", key] });
      setConfirmPurgeFriends(false);
      toast({ title: `Purged ${data.deleted} used links`, description: "Used friend links cleared." });
    },
  });

  const handleLogin = async () => {
    setAuthError("");
    const res = await fetch("/api/admin/codes", { headers: { "x-admin-key": input } });
    if (res.ok) {
      localStorage.setItem(ADMIN_KEY_STORAGE, input);
      setKey(input);
      setAuthed(true);
    } else {
      setAuthError("Wrong key. Set ADMIN_KEY in your environment secrets.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(ADMIN_KEY_STORAGE);
    setKey(""); setInput(""); setAuthed(false);
  };

  const filteredCodes = useMemo(() => {
    return (codesQuery.data || [])
      .filter(c => {
        if (filterCode === "available") return !c.usedAt;
        if (filterCode === "used") return !!c.usedAt;
        return true;
      })
      .filter(c => {
        if (!searchCode) return true;
        const q = searchCode.toLowerCase();
        return c.code.toLowerCase().includes(q) || (c.note || "").toLowerCase().includes(q);
      })
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }, [codesQuery.data, searchCode, filterCode]);

  const filteredFriends = useMemo(() => {
    return (friendsQuery.data || [])
      .filter(f => {
        if (filterFriend === "available") return !f.usedAt;
        if (filterFriend === "used") return !!f.usedAt;
        return true;
      })
      .filter(f => {
        if (!searchFriend) return true;
        const q = searchFriend.toLowerCase();
        return f.token.toLowerCase().includes(q) || (f.note || "").toLowerCase().includes(q);
      })
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }, [friendsQuery.data, searchFriend, filterFriend]);

  const activityItems = useMemo(() => {
    const codeEvents = (codesQuery.data || [])
      .filter(c => c.usedAt)
      .map(c => ({ type: "code" as const, label: c.note || c.code, detail: c.code, at: c.usedAt! }));
    const friendEvents = (friendsQuery.data || [])
      .filter(f => f.usedAt)
      .map(f => ({ type: "friend" as const, label: f.note || f.token.slice(0, 8) + "…", detail: f.token, at: f.usedAt! }));
    return [...codeEvents, ...friendEvents]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 30);
  }, [codesQuery.data, friendsQuery.data]);

  function dmTemplate(code: string): string {
    return `Hey! Here's your Opti Gods Pro key: ${code}\n\nRedeem at: ${getAppOrigin()}\nThanks for purchasing — enjoy the gains! 🔥`;
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-5">
          <div className="space-y-1 mb-2">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-red-500" />
              <span className="font-bold text-xl text-white font-display tracking-wide">Admin Panel</span>
            </div>
            <p className="text-xs text-zinc-600 pl-7">Opti Gods by leaq — restricted access</p>
          </div>

          <div className="bg-zinc-900/60 border border-white/5 rounded-xl p-4 space-y-4">
            <p className="text-[11px] text-zinc-500">Enter your <span className="text-zinc-300 font-mono">ADMIN_KEY</span> to continue</p>
            <input
              data-testid="input-admin-key"
              type="password"
              placeholder="Admin key..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              className="w-full bg-black border border-zinc-700 focus:border-red-500/60 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-700 focus:outline-none font-mono transition-colors"
            />
            {authError && (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {authError}
              </div>
            )}
            <Button
              data-testid="button-admin-login"
              onClick={handleLogin}
              className="w-full bg-red-600 hover:bg-red-700 text-white border border-red-500/30 font-bold"
            >
              <Shield className="w-4 h-4 mr-2" /> Enter Admin Panel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const stats = statsQuery.data;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-600/20 border border-red-500/30 rounded-lg flex items-center justify-center">
              <Shield className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold font-display text-white tracking-wide">Opti Gods Admin</h1>
              <p className="text-[10px] text-zinc-600 uppercase tracking-widest">leaq control panel</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Pro status indicator + reset — lets you test the paywall */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-white/5 bg-zinc-900/60">
              <span className={cn(
                "w-1.5 h-1.5 rounded-full shrink-0",
                isPro ? "bg-red-500" : "bg-zinc-600"
              )} />
              <span className="text-[10px] text-zinc-500 font-mono">
                {isPro ? "PRO active (your browser)" : "No pro (your browser)"}
              </span>
              <button
                onClick={() => {
                  setProStatus(!isPro);
                  toast({
                    title: isPro ? "Pro Reset" : "Pro Granted (Test)",
                    description: isPro
                      ? "Your browser is back to free-user view. Regular users never had Pro."
                      : "Test mode: Pro set in your browser only. Users still need to pay.",
                  });
                }}
                className="ml-1 text-[10px] text-zinc-600 hover:text-red-400 transition-colors underline underline-offset-2"
                title={isPro ? "Clear my Pro status for testing" : "Set my Pro status for testing"}
              >
                {isPro ? "Reset" : "Grant (test)"}
              </button>
            </div>

            <button
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/admin/stats", key] });
                queryClient.invalidateQueries({ queryKey: ["/api/admin/codes", key] });
                queryClient.invalidateQueries({ queryKey: ["/api/admin/friends", key] });
              }}
              className="p-1.5 rounded hover:bg-zinc-800 text-zinc-600 hover:text-zinc-300 transition-colors"
              title="Refresh all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-200 transition-colors px-2 py-1 rounded hover:bg-zinc-800"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatCard
            icon={DollarSign}
            label="Est. Revenue"
            value={`$${stats?.revenueEstimate ?? 0}`}
            sub={`${stats?.usedCodes ?? 0} paid × $${PRICE_PER_CODE}`}
            color="green"
          />
          <StatCard
            icon={Key}
            label="Codes Available"
            value={stats?.availableCodes ?? "—"}
            sub={`${stats?.usedCodes ?? 0} redeemed`}
            color="red"
          />
          <StatCard
            icon={Users}
            label="Friends Granted"
            value={stats?.usedFriends ?? "—"}
            sub={`${stats?.availableFriends ?? 0} pending`}
            color="amber"
          />
          <StatCard
            icon={BarChart3}
            label="Total Link Clicks"
            value={stats?.visits?.total ?? "—"}
            sub="all-time unique sessions"
            color="zinc"
          />
          <StatCard
            icon={Flame}
            label="Clicks Today"
            value={stats?.visits?.today ?? "—"}
            sub={`${stats?.visits?.thisWeek ?? 0} this week`}
            color="red"
          />
          <StatCard
            icon={BarChart3}
            label="Total Generated"
            value={(stats?.totalCodes ?? 0) + (stats?.totalFriends ?? 0)}
            sub={`${stats?.totalCodes ?? 0} codes · ${stats?.totalFriends ?? 0} links`}
          />
        </div>

        {/* Payment Quick Links */}
        <div className="flex flex-wrap gap-2 p-3 bg-zinc-900/40 border border-white/5 rounded-xl">
          <span className="text-[10px] text-zinc-600 uppercase tracking-widest self-center mr-1">Payment Links</span>
          <a
            href="https://cash.app/$my1ik"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-400 hover:bg-emerald-600/20 transition-colors font-mono"
          >
            <DollarSign className="w-3 h-3" /> CashApp $my1ik
          </a>
          <a
            href="https://paypal.me/accountslg"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/10 border border-blue-500/20 rounded-lg text-xs text-blue-400 hover:bg-blue-600/20 transition-colors font-mono"
          >
            <Zap className="w-3 h-3" /> PayPal paypal.me/accountslg
          </a>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-white/5 pb-0">
          {(["codes", "friends", "activity"] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors border-b-2 -mb-px",
                tab === t
                  ? "text-red-400 border-red-500"
                  : "text-zinc-600 border-transparent hover:text-zinc-300"
              )}
            >
              {t === "codes" ? `Access Codes (${stats?.totalCodes ?? 0})` :
               t === "friends" ? `Friend Links (${stats?.totalFriends ?? 0})` :
               `Activity (${activityItems.length})`}
            </button>
          ))}
        </div>

        {/* ─── ACCESS CODES TAB ─────────────────────────────────────── */}
        {tab === "codes" && (
          <div className="space-y-4">
            <div className="bg-zinc-900/40 border border-white/5 rounded-xl p-4 space-y-3">
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Generate a code, then DM it to the customer after they pay.{" "}
                <span className="text-red-400">Each code works once</span> — it cannot be reused.
              </p>
              <div className="flex gap-2">
                <input
                  data-testid="input-code-note"
                  type="text"
                  placeholder="Label, e.g. John Doe, CashApp tx..."
                  value={noteCode}
                  onChange={e => setNoteCode(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && genCode.mutate()}
                  className="flex-1 bg-black border border-zinc-700 focus:border-red-500/40 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-700 focus:outline-none transition-colors"
                />
                <Button
                  data-testid="button-gen-code"
                  onClick={() => genCode.mutate()}
                  disabled={genCode.isPending}
                  className="bg-red-600 hover:bg-red-700 text-white border border-red-500/30 shrink-0 gap-1.5 font-bold"
                >
                  <Plus className="w-4 h-4" /> Generate
                </Button>
              </div>
            </div>

            {/* Filter + Search bar */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
                <input
                  type="text"
                  placeholder="Search codes or labels..."
                  value={searchCode}
                  onChange={e => setSearchCode(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/5 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
                />
              </div>
              <div className="flex items-center gap-1">
                {(["all", "available", "used"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilterCode(f)}
                    className={cn(
                      "px-2.5 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest transition-colors",
                      filterCode === f
                        ? "bg-red-600/20 border border-red-500/30 text-red-400"
                        : "bg-zinc-900 border border-white/5 text-zinc-600 hover:text-zinc-300"
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
              {(codesQuery.data?.filter(c => c.usedAt).length ?? 0) > 0 && (
                confirmPurgeCodes ? (
                  <div className="flex items-center gap-1.5 ml-auto">
                    <span className="text-[10px] text-red-400">Delete all used codes?</span>
                    <button
                      onClick={() => purgeUsedCodes.mutate()}
                      disabled={purgeUsedCodes.isPending}
                      className="px-2 py-1 bg-red-600/20 border border-red-500/30 rounded text-[10px] text-red-400 hover:bg-red-600/30 transition-colors"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmPurgeCodes(false)}
                      className="px-2 py-1 bg-zinc-800 rounded text-[10px] text-zinc-400 hover:bg-zinc-700 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmPurgeCodes(true)}
                    className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-900 border border-white/5 rounded text-[10px] text-zinc-500 hover:text-red-400 hover:border-red-500/20 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" /> Purge used
                  </button>
                )
              )}
            </div>

            {/* Codes list */}
            <div className="rounded-xl border border-white/5 overflow-hidden">
              {codesQuery.isLoading && (
                <div className="p-8 text-center text-xs text-zinc-600">Loading codes...</div>
              )}
              {!codesQuery.isLoading && filteredCodes.length === 0 && (
                <div className="p-8 text-center text-xs text-zinc-600">
                  {(codesQuery.data?.length ?? 0) === 0
                    ? "No codes yet. Generate one above."
                    : "No codes match your filter."}
                </div>
              )}
              {filteredCodes.map((c, i) => (
                <div
                  key={c.id}
                  data-testid={`row-code-${c.id}`}
                  className={cn(
                    "group flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 transition-colors",
                    c.usedAt ? "opacity-40 hover:opacity-60" : "hover:bg-zinc-900/40"
                  )}
                >
                  <div className="shrink-0 w-5 text-[10px] text-zinc-700 text-right">{i + 1}</div>
                  <span className="font-mono text-sm font-bold text-white tracking-wider w-[140px] shrink-0">{c.code}</span>
                  <CopyButton text={c.code} />
                  {!c.usedAt && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(dmTemplate(c.code));
                        toast({ title: "DM template copied!", description: "Paste directly into Discord or text." });
                      }}
                      className="flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-zinc-800 text-zinc-500 hover:text-amber-400 transition-colors"
                      title="Copy ready-to-send DM"
                    >
                      <MessageSquare className="w-3 h-3" /> DM
                    </button>
                  )}
                  <div className="flex-1 min-w-0">
                    {c.note && <p className="text-xs text-zinc-400 truncate">{c.note}</p>}
                    <p className="text-[10px] text-zinc-600">Created {fmt(c.createdAt)}</p>
                  </div>
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded border shrink-0",
                    c.usedAt
                      ? "text-zinc-600 bg-zinc-800/50 border-zinc-700"
                      : "text-red-400 bg-red-500/10 border-red-500/20"
                  )}>
                    {c.usedAt ? `USED ${timeAgo(c.usedAt)}` : "AVAILABLE"}
                  </span>
                  <button
                    data-testid={`button-del-code-${c.id}`}
                    onClick={() => delCode.mutate(c.id)}
                    className="p-1.5 rounded hover:bg-red-500/10 text-zinc-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── FRIEND LINKS TAB ─────────────────────────────────────── */}
        {tab === "friends" && (
          <div className="space-y-4">
            <div className="bg-zinc-900/40 border border-white/5 rounded-xl p-4 space-y-3">
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Generate a link per person — send it and they get Pro free.{" "}
                <span className="text-red-400">Each link works once only</span> — it can't be forwarded.
              </p>
              <div className="flex gap-2">
                <input
                  data-testid="input-friend-note"
                  type="text"
                  placeholder="Label, e.g. XxSniperx, Discord @user..."
                  value={noteFriend}
                  onChange={e => setNoteFriend(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && genFriend.mutate()}
                  className="flex-1 bg-black border border-zinc-700 focus:border-red-500/40 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-700 focus:outline-none transition-colors"
                />
                <Button
                  data-testid="button-gen-friend"
                  onClick={() => genFriend.mutate()}
                  disabled={genFriend.isPending}
                  className="bg-red-600 hover:bg-red-700 text-white border border-red-500/30 shrink-0 gap-1.5 font-bold"
                >
                  <Plus className="w-4 h-4" /> Generate
                </Button>
              </div>
            </div>

            {/* Filter + Search */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
                <input
                  type="text"
                  placeholder="Search labels or tokens..."
                  value={searchFriend}
                  onChange={e => setSearchFriend(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/5 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
                />
              </div>
              <div className="flex items-center gap-1">
                {(["all", "available", "used"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilterFriend(f)}
                    className={cn(
                      "px-2.5 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest transition-colors",
                      filterFriend === f
                        ? "bg-red-600/20 border border-red-500/30 text-red-400"
                        : "bg-zinc-900 border border-white/5 text-zinc-600 hover:text-zinc-300"
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
              {(friendsQuery.data?.filter(f => f.usedAt).length ?? 0) > 0 && (
                confirmPurgeFriends ? (
                  <div className="flex items-center gap-1.5 ml-auto">
                    <span className="text-[10px] text-red-400">Delete all used links?</span>
                    <button
                      onClick={() => purgeUsedFriends.mutate()}
                      disabled={purgeUsedFriends.isPending}
                      className="px-2 py-1 bg-red-600/20 border border-red-500/30 rounded text-[10px] text-red-400 hover:bg-red-600/30 transition-colors"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmPurgeFriends(false)}
                      className="px-2 py-1 bg-zinc-800 rounded text-[10px] text-zinc-400 hover:bg-zinc-700 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmPurgeFriends(true)}
                    className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-900 border border-white/5 rounded text-[10px] text-zinc-500 hover:text-red-400 hover:border-red-500/20 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" /> Purge used
                  </button>
                )
              )}
            </div>

            {/* Friends list */}
            <div className="rounded-xl border border-white/5 overflow-hidden">
              {friendsQuery.isLoading && (
                <div className="p-8 text-center text-xs text-zinc-600">Loading links...</div>
              )}
              {!friendsQuery.isLoading && filteredFriends.length === 0 && (
                <div className="p-8 text-center text-xs text-zinc-600">
                  {(friendsQuery.data?.length ?? 0) === 0
                    ? "No friend links yet. Generate one above."
                    : "No links match your filter."}
                </div>
              )}
              {filteredFriends.map((t, i) => {
                const link = `${getAppOrigin()}/?friend=${t.token}`;
                return (
                  <div
                    key={t.id}
                    data-testid={`row-friend-${t.id}`}
                    className={cn(
                      "group flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 transition-colors",
                      t.usedAt ? "opacity-40 hover:opacity-60" : "hover:bg-zinc-900/40"
                    )}
                  >
                    <div className="shrink-0 w-5 text-[10px] text-zinc-700 text-right">{i + 1}</div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      {t.note && <p className="text-xs font-medium text-zinc-300 truncate">{t.note}</p>}
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-[10px] text-zinc-500 truncate max-w-[300px]">{link}</span>
                        <CopyButton text={link} />
                      </div>
                      <p className="text-[10px] text-zinc-700">Created {fmt(t.createdAt)}</p>
                    </div>
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded border shrink-0",
                      t.usedAt
                        ? "text-zinc-600 bg-zinc-800/50 border-zinc-700"
                        : "text-red-400 bg-red-500/10 border-red-500/20"
                    )}>
                      {t.usedAt ? `USED ${timeAgo(t.usedAt)}` : "AVAILABLE"}
                    </span>
                    <button
                      data-testid={`button-del-friend-${t.id}`}
                      onClick={() => delFriend.mutate(t.id)}
                      className="p-1.5 rounded hover:bg-red-500/10 text-zinc-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── ACTIVITY TAB ─────────────────────────────────────────── */}
        {tab === "activity" && (
          <div className="space-y-3">
            {activityItems.length === 0 ? (
              <div className="p-12 text-center text-xs text-zinc-600">
                No redemptions yet — activity shows here once codes or links are used.
              </div>
            ) : (
              <div className="rounded-xl border border-white/5 overflow-hidden">
                {activityItems.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-zinc-900/30 transition-colors"
                  >
                    <div className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                      item.type === "code"
                        ? "bg-red-500/10 border border-red-500/20"
                        : "bg-amber-500/10 border border-amber-500/20"
                    )}>
                      {item.type === "code"
                        ? <Key className="w-3.5 h-3.5 text-red-400" />
                        : <Link className="w-3.5 h-3.5 text-amber-400" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white font-medium truncate">{item.label}</p>
                      <p className="text-[10px] text-zinc-600 font-mono truncate">{item.detail}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cn(
                        "text-[10px] font-bold",
                        item.type === "code" ? "text-red-400" : "text-amber-400"
                      )}>
                        {item.type === "code" ? `+$${PRICE_PER_CODE}` : "Free"}
                      </p>
                      <p className="text-[10px] text-zinc-600">{timeAgo(item.at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activityItems.length > 0 && (
              <div className="p-4 bg-zinc-900/40 border border-white/5 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white">
                    Total estimated revenue: <span className="text-emerald-400">${stats?.revenueEstimate ?? 0}</span>
                  </p>
                  <p className="text-[10px] text-zinc-600 mt-0.5">
                    {stats?.usedCodes ?? 0} paid codes × ${PRICE_PER_CODE} · {stats?.usedFriends ?? 0} free friends
                  </p>
                </div>
                <Flame className="w-6 h-6 text-red-500 opacity-60" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
