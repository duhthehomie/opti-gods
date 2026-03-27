import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy, Trash2, Plus, Key, Link, Check, AlertCircle, Shield,
  LogOut, DollarSign, Users, BarChart3, Clock, Search, Zap,
  MessageSquare, Flame, RefreshCw, ChevronDown, ChevronUp, RotateCcw, ShieldOff,
  Mail, Send, XCircle, Inbox, Activity, Bot, Timer, TrendingUp, Wifi, WifiOff,
  PlayCircle, ChevronRight, Eye, Bell, Megaphone, Tag, Pencil, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useProStatus, setProSession, clearProStatus, getProStatus } from "@/lib/pro-status";
import { estimateFpsGain } from "@/lib/fps-impact-map";
import type { ProAccessCode, ProFriendToken, EmailRequest, ManualPayment } from "@shared/schema";

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
  color?: "red" | "zinc" | "green" | "amber" | "blue" | "violet";
}) {
  const iconColor = {
    red: "text-red-400",
    zinc: "text-zinc-400",
    green: "text-emerald-400",
    amber: "text-amber-400",
    blue: "text-blue-400",
    violet: "text-violet-400",
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

type Tab = "codes" | "friends" | "activity" | "email" | "announcements" | "analytics";

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
  const [importCode, setImportCode] = useState("");
  const [importCodeNote, setImportCodeNote] = useState("");
  const [searchCode, setSearchCode] = useState("");
  const [searchFriend, setSearchFriend] = useState("");
  const [filterCode, setFilterCode] = useState<"all" | "available" | "used">("all");
  const [filterFriend, setFilterFriend] = useState<"all" | "available" | "used">("all");
  const [confirmPurgeCodes, setConfirmPurgeCodes] = useState(false);
  const [confirmPurgeFriends, setConfirmPurgeFriends] = useState(false);
  const [editingCodeId, setEditingCodeId] = useState<number | null>(null);
  const [editingFriendId, setEditingFriendId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  // Manual payment logging form
  const [showLogPayment, setShowLogPayment] = useState(false);
  const [payAmount, setPayAmount] = useState("25");
  const [payMethod, setPayMethod] = useState<"cashapp" | "paypal">("cashapp");
  const [payNote, setPayNote] = useState("");

  const headers = { "Content-Type": "application/json", "x-admin-key": key };

  const statsQuery = useQuery<{
    totalCodes: number; usedCodes: number; availableCodes: number;
    totalFriends: number; usedFriends: number; availableFriends: number;
    revenueEstimate: number; codeRevenue: number; manualRevenue: number;
    emailRevenue: number; directRevenue: number;
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

  const downloadStatsQuery = useQuery<{
    totalDownloads: number;
    totalTweaksDeployed: number;
    avgTweaksPerDownload: number;
    last7Days: { date: string; count: number }[];
    topTweaks: { tweakId: string; count: number }[];
    recentDownloads: { id: number; tweakCount: number; tweakIds: string[]; downloadedAt: string }[];
  }>({
    queryKey: ["/api/admin/download-stats", key],
    queryFn: () => fetch("/api/admin/download-stats", { headers }).then(r => {
      if (!r.ok) throw new Error("Unauthorized");
      return r.json();
    }),
    enabled: authed,
    retry: false,
    refetchInterval: 60000,
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

  const importCodeMut = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/codes", {
        method: "POST",
        headers,
        body: JSON.stringify({ customCode: importCode.trim().toUpperCase(), note: importCodeNote.trim() || `Registered: ${importCode.trim().toUpperCase()}` }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to register code");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/codes", key] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats", key] });
      setImportCode("");
      setImportCodeNote("");
      toast({ title: "Code registered", description: "The code is now active in the system." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const delCode = useMutation({
    mutationFn: (id: number) => fetch(`/api/admin/codes/${id}`, { method: "DELETE", headers }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/codes", key] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats", key] });
    },
  });

  const renameCode = useMutation({
    mutationFn: ({ id, note }: { id: number; note: string | null }) =>
      fetch(`/api/admin/codes/${id}`, { method: "PATCH", headers, body: JSON.stringify({ note }) }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/codes", key] });
      setEditingCodeId(null);
      setEditValue("");
    },
  });

  const renameFriend = useMutation({
    mutationFn: ({ id, note }: { id: number; note: string | null }) =>
      fetch(`/api/admin/friends/${id}`, { method: "PATCH", headers, body: JSON.stringify({ note }) }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/friends", key] });
      setEditingFriendId(null);
      setEditValue("");
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

  const manualPaymentsQuery = useQuery<ManualPayment[]>({
    queryKey: ["/api/admin/manual-payments", key],
    queryFn: () => fetch("/api/admin/manual-payments", { headers }).then(r => r.json()),
    enabled: authed,
    retry: false,
    refetchInterval: 30000,
  });

  const logPayment = useMutation({
    mutationFn: ({ amount, method, note }: { amount: number; method: string; note: string }) =>
      fetch("/api/admin/manual-payments", {
        method: "POST", headers,
        body: JSON.stringify({ amount, method, note }),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/manual-payments", key] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats", key] });
      setShowLogPayment(false);
      setPayAmount("25");
      setPayNote("");
      toast({ title: "Payment logged", description: "Revenue total updated." });
    },
  });

  const delManualPayment = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/admin/manual-payments/${id}`, { method: "DELETE", headers }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/manual-payments", key] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats", key] });
    },
  });

  const emailRequestsQuery = useQuery<EmailRequest[]>({
    queryKey: ["/api/admin/email-requests", key],
    queryFn: () => fetch("/api/admin/email-requests", { headers }).then(r => {
      if (!r.ok) throw new Error("Unauthorized");
      return r.json();
    }),
    enabled: authed,
    retry: false,
    refetchInterval: 15000,
  });

  const emailConfiguredQuery = useQuery<{ configured: boolean }>({
    queryKey: ["/api/admin/email-configured", key],
    queryFn: () => fetch("/api/admin/email-configured", { headers }).then(r => r.json()),
    enabled: authed,
    retry: false,
  });

  type CustomerDeployStat = {
    sessionToken: string;
    codeRef: string | null;
    totalTweaks: number;
    downloadCount: number;
    lastDownloadAt: string;
    allTweakIds: string[];
  };
  const customerDeployStatsQuery = useQuery<CustomerDeployStat[]>({
    queryKey: ["/api/admin/customer-deploy-stats", key],
    queryFn: () => fetch("/api/admin/customer-deploy-stats", { headers }).then(r => r.json()),
    enabled: authed,
    retry: false,
    refetchInterval: 5000,
  });

  const sendEmailCode = useMutation({
    mutationFn: (id: number) => fetch(`/api/admin/email-requests/${id}/send`, {
      method: "POST", headers,
    }).then(async r => {
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed to send");
      return data;
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-requests", key] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/codes", key] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats", key] });
      toast({ title: "Code sent!", description: "The access code was emailed to the customer." });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
    },
  });

  const rejectEmailReq = useMutation({
    mutationFn: (id: number) => fetch(`/api/admin/email-requests/${id}/reject`, {
      method: "POST", headers, body: JSON.stringify({ note: "Rejected by admin" }),
    }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-requests", key] });
      toast({ title: "Request rejected" });
    },
  });

  const delEmailReq = useMutation({
    mutationFn: (id: number) => fetch(`/api/admin/email-requests/${id}`, {
      method: "DELETE", headers,
    }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-requests", key] });
    },
  });

  // System status (auto-send)
  const systemStatusQuery = useQuery<{
    autoSend: {
      enabled: boolean; thresholdMinutes: number; intervalMinutes: number;
      lastRunAt: string | null; lastSentCount: number; totalAutoSent: number;
      nextRunAt: string | null; isRunning: boolean;
    };
  }>({
    queryKey: ["/api/admin/system-status", key],
    queryFn: () => fetch("/api/admin/system-status", { headers }).then(r => r.json()),
    enabled: authed,
    retry: false,
    refetchInterval: 10000,
  });

  const triggerAutoSend = useMutation({
    mutationFn: () => fetch("/api/admin/auto-send/trigger", { method: "POST", headers }).then(r => r.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-requests", key] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/system-status", key] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/codes", key] });
      toast({ title: data.sent > 0 ? `Auto-sent ${data.sent} code(s)` : "No stale requests found", description: data.sent > 0 ? "Codes emailed to customers." : "All requests are under 30 min old." });
    },
  });

  // Announcements
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");
  const [annTag, setAnnTag] = useState("update");
  const [annTweakIds, setAnnTweakIds] = useState("");

  const announcementsQuery = useQuery<{ id: number; title: string; body: string; tag: string | null; tweakIds: string[] | null; createdAt: string }[]>({
    queryKey: ["/api/announcements"],
    enabled: authed,
    retry: false,
  });

  const parsedTweakIds = annTweakIds.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);

  const createAnn = useMutation({
    mutationFn: () => fetch("/api/admin/announcements", {
      method: "POST", headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ title: annTitle, body: annBody, tag: annTag, tweakIds: parsedTweakIds }),
    }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
      setAnnTitle(""); setAnnBody(""); setAnnTag("update"); setAnnTweakIds("");
      toast({ title: "Announcement posted" });
    },
    onError: () => toast({ title: "Failed to post announcement", variant: "destructive" }),
  });

  const deleteAnn = useMutation({
    mutationFn: (id: number) => fetch(`/api/admin/announcements/${id}`, { method: "DELETE", headers }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
      toast({ title: "Announcement deleted" });
    },
  });

  // Inactive timer
  const lastActivityRef = useRef<number>(Date.now());
  const [inactiveSec, setInactiveSec] = useState(0);
  const updateActivity = useCallback(() => { lastActivityRef.current = Date.now(); }, []);

  useEffect(() => {
    if (!authed) return;
    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    events.forEach(e => document.addEventListener(e, updateActivity, { passive: true }));
    const interval = setInterval(() => {
      setInactiveSec(Math.floor((Date.now() - lastActivityRef.current) / 1000));
    }, 1000);
    return () => {
      events.forEach(e => document.removeEventListener(e, updateActivity));
      clearInterval(interval);
    };
  }, [authed, updateActivity]);

  function formatInactive(sec: number): string {
    if (sec < 60) return `${sec}s`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
    return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
  }

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
      <div className="min-h-screen bg-[#070707] flex items-center justify-center p-5 relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-red-600/10 blur-[120px]" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-600/40 to-transparent" />
        </div>
        <div className="w-full max-w-sm space-y-5 relative z-10">
          {/* Logo */}
          <div className="text-center space-y-2 mb-6">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-red-600/30 to-red-900/20 border border-red-500/30 flex items-center justify-center shadow-[0_0_40px_-10px_rgba(239,68,68,0.5)]">
              <Shield className="w-8 h-8 text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-black font-display text-white tracking-widest uppercase">Opti Gods</h1>
              <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-mono mt-0.5">Admin Control · Restricted</p>
            </div>
          </div>

          <div className="bg-zinc-900/60 border border-white/8 rounded-2xl p-5 space-y-4 backdrop-blur-sm">
            <p className="text-[11px] text-zinc-500">Enter your <span className="text-zinc-300 font-mono bg-zinc-800/80 px-1.5 py-0.5 rounded">ADMIN_KEY</span> to unlock</p>
            <input
              data-testid="input-admin-key"
              type="password"
              placeholder="Enter admin key..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              className="w-full bg-black/80 border border-zinc-700 focus:border-red-500/60 rounded-xl px-4 py-3.5 text-sm text-white placeholder-zinc-700 focus:outline-none font-mono transition-colors"
              style={{ fontSize: "16px" }}
            />
            {authError && (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {authError}
              </div>
            )}
            <Button
              data-testid="button-admin-login"
              onClick={handleLogin}
              className="w-full bg-red-600 hover:bg-red-500 text-white border border-red-500/30 font-black text-base py-6 rounded-xl shadow-[0_4px_20px_-4px_rgba(239,68,68,0.4)] hover:shadow-[0_4px_30px_-4px_rgba(239,68,68,0.6)] transition-all"
            >
              <Shield className="w-4 h-4 mr-2" /> Unlock Admin
            </Button>
          </div>
          <p className="text-center text-[10px] text-zinc-700">by leaq · optigods.replit.app</p>
        </div>
      </div>
    );
  }

  const stats = statsQuery.data;
  const sys = systemStatusQuery.data?.autoSend;
  const pendingEmailCount = (emailRequestsQuery.data || []).filter(r => r.status === "pending").length;
  const inactiveMin = Math.floor(inactiveSec / 60);
  const inactiveColor = inactiveSec < 300 ? "text-emerald-400" : inactiveSec < 1500 ? "text-amber-400" : "text-red-400";
  const inactiveBg = inactiveSec < 300 ? "bg-emerald-500/10 border-emerald-500/20" : inactiveSec < 1500 ? "bg-amber-500/10 border-amber-500/20" : "bg-red-500/10 border-red-500/20";

  return (
    <div className="min-h-screen bg-[#060606] text-white pb-24 md:pb-6">
      {/* Top gradient bar */}
      <div className="h-1 w-full bg-gradient-to-r from-transparent via-red-600 to-transparent opacity-80" />

      <div className="max-w-5xl mx-auto px-3 py-3 md:px-6 md:py-5 space-y-4 md:space-y-5">

        {/* Header */}
        <div className="relative rounded-2xl overflow-hidden border border-red-500/15 bg-gradient-to-br from-zinc-900/80 via-black to-zinc-900/60 shadow-[inset_0_0_60px_-20px_rgba(239,68,68,0.08)]">
          <div className="absolute inset-0 bg-gradient-to-br from-red-950/25 to-transparent pointer-events-none" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/40 to-transparent" />
          <div className="relative px-4 py-4 md:px-6 md:py-5 flex flex-col md:flex-row md:items-center gap-3 md:gap-4">

            {/* Brand */}
            <div className="flex items-center gap-3 flex-1">
              <div className="relative">
                <div className="w-12 h-12 bg-gradient-to-br from-red-600/30 to-red-900/20 border border-red-500/40 rounded-xl flex items-center justify-center shadow-[0_0_20px_-6px_rgba(239,68,68,0.5)]">
                  <Shield className="w-6 h-6 text-red-400" />
                </div>
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-black animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-black font-display text-white tracking-wider uppercase">Opti Gods</h1>
                  <span className="px-1.5 py-0.5 rounded bg-red-600 text-[9px] font-bold tracking-widest text-white uppercase shadow-[0_0_8px_rgba(239,68,68,0.4)]">Admin</span>
                  {pendingEmailCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[9px] font-bold animate-pulse">
                      {pendingEmailCount} pending
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-mono">leaq · control panel · live</p>
              </div>
            </div>

            {/* Live indicators — horizontally scrollable on mobile */}
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5 md:pb-0 md:flex-wrap flex-nowrap md:flex-wrap"
              style={{ WebkitOverflowScrolling: "touch" }}>

              {/* Inactive timer */}
              <div className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-mono font-bold", inactiveBg, inactiveColor)}>
                <Timer className="w-3 h-3" />
                <span>Inactive: {formatInactive(inactiveSec)}</span>
                {inactiveSec >= 1500 && <span className="text-[9px] text-red-400 ml-1">→ auto-send firing soon</span>}
              </div>

              {/* Auto-send status */}
              <div className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-bold",
                sys?.enabled
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  : "bg-zinc-800/60 border-zinc-700 text-zinc-500"
              )}>
                <Bot className="w-3 h-3" />
                <span>{sys?.enabled ? `Auto-send ON · ${sys.thresholdMinutes}min` : "Auto-send OFF"}</span>
              </div>

              {/* Pro test toggle */}
              <button
                onClick={async () => {
                  if (isPro) {
                    clearProStatus();
                    toast({ title: "Switched to Free mode" });
                  } else {
                    try {
                      const res = await fetch("/api/admin/grant-pro-session", {
                        method: "POST", headers,
                      });
                      const data = await res.json();
                      if (data.sessionToken) {
                        setProSession(data.sessionToken);
                        toast({ title: "Pro Granted (Test)" });
                      }
                    } catch {
                      toast({ title: "Failed to grant Pro", variant: "destructive" });
                    }
                  }
                }}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-colors",
                  isPro ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-zinc-800/60 border-zinc-700 text-zinc-500 hover:text-zinc-300"
                )}
                title="Toggle Pro for testing"
              >
                <Eye className="w-3 h-3" />
                {isPro ? "PRO mode" : "Free mode"}
              </button>

              {/* Refresh all */}
              <button
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ["/api/admin/stats", key] });
                  queryClient.invalidateQueries({ queryKey: ["/api/admin/codes", key] });
                  queryClient.invalidateQueries({ queryKey: ["/api/admin/friends", key] });
                  queryClient.invalidateQueries({ queryKey: ["/api/admin/email-requests", key] });
                  queryClient.invalidateQueries({ queryKey: ["/api/admin/system-status", key] });
                }}
                className="p-2 rounded-lg bg-zinc-800/60 border border-zinc-700 hover:bg-zinc-700 text-zinc-500 hover:text-zinc-200 transition-colors"
                title="Refresh all data"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700 hover:bg-zinc-700 text-xs text-zinc-500 hover:text-zinc-200 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Auto-send warning if pending requests and admin is away */}
        {pendingEmailCount > 0 && sys?.enabled && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-amber-500/5 border border-amber-500/20"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
              <span className="text-xs text-amber-300 font-bold">{pendingEmailCount} email request{pendingEmailCount > 1 ? "s" : ""} pending</span>
              <span className="text-[10px] text-amber-700">— auto-sends after {sys.thresholdMinutes} min idle. Next server check in ~{sys.intervalMinutes} min.</span>
            </div>
            <button
              onClick={() => triggerAutoSend.mutate()}
              disabled={triggerAutoSend.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 text-[11px] font-bold transition-colors shrink-0"
            >
              <PlayCircle className="w-3 h-3" />
              {triggerAutoSend.isPending ? "Sending..." : "Send Now"}
            </button>
          </motion.div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Revenue — big card */}
          <div className="col-span-2 relative rounded-xl overflow-hidden border border-emerald-500/15 bg-gradient-to-br from-emerald-950/30 to-black p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 mb-2">Confirmed Revenue</p>
                <p className="text-4xl font-black text-emerald-400 font-mono">${stats?.revenueEstimate ?? 0}</p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="text-[10px] text-emerald-800 bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-0.5">
                    ${stats?.codeRevenue ?? 0} from codes
                  </span>
                  <span className="text-[10px] text-emerald-800 bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-0.5">
                    ${stats?.manualRevenue ?? 0} CashApp/PayPal
                  </span>
                  <span className="text-[10px] text-emerald-900 bg-emerald-500/5 border border-emerald-500/10 rounded px-2 py-0.5">
                    {stats?.emailRevenue ?? 0} email · {stats?.directRevenue ?? 0} direct
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  data-testid="button-log-payment"
                  onClick={() => setShowLogPayment(v => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600/15 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-600/25 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Log Payment
                </button>
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                </div>
              </div>
            </div>

            {/* Inline log-payment form */}
            <AnimatePresence>
              {showLogPayment && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 border-t border-emerald-500/10 pt-4 overflow-hidden"
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 mb-3">Log CashApp / PayPal Payment</p>
                  <div className="flex flex-wrap gap-2 items-end">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-zinc-500 uppercase tracking-widest">Amount $</label>
                      <input
                        data-testid="input-pay-amount"
                        type="number"
                        value={payAmount}
                        onChange={e => setPayAmount(e.target.value)}
                        className="w-20 px-2 py-1.5 bg-zinc-900 border border-white/10 rounded-lg text-white text-sm font-mono"
                        min="1"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-zinc-500 uppercase tracking-widest">Method</label>
                      <select
                        data-testid="select-pay-method"
                        value={payMethod}
                        onChange={e => setPayMethod(e.target.value as "cashapp" | "paypal")}
                        className="px-2 py-1.5 bg-zinc-900 border border-white/10 rounded-lg text-white text-sm"
                      >
                        <option value="cashapp">CashApp</option>
                        <option value="paypal">PayPal</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1 flex-1 min-w-32">
                      <label className="text-[10px] text-zinc-500 uppercase tracking-widest">Note (optional)</label>
                      <input
                        data-testid="input-pay-note"
                        type="text"
                        value={payNote}
                        onChange={e => setPayNote(e.target.value)}
                        placeholder="$cashtag, name, PayPal ref…"
                        className="px-2 py-1.5 bg-zinc-900 border border-white/10 rounded-lg text-white text-sm"
                      />
                    </div>
                    <button
                      data-testid="button-submit-payment"
                      disabled={logPayment.isPending || !payAmount || Number(payAmount) < 1}
                      onClick={() => logPayment.mutate({ amount: Number(payAmount), method: payMethod, note: payNote })}
                      className="px-4 py-1.5 bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-lg hover:bg-emerald-600/30 disabled:opacity-40 transition-colors"
                    >
                      {logPayment.isPending ? "Saving…" : "Save"}
                    </button>
                    <button
                      onClick={() => setShowLogPayment(false)}
                      className="px-3 py-1.5 text-zinc-500 hover:text-zinc-300 text-xs transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="absolute bottom-0 right-0 opacity-5">
              <TrendingUp className="w-24 h-24 text-emerald-400" />
            </div>
          </div>

          <StatCard icon={Key} label="Codes Ready" value={stats?.availableCodes ?? "—"} sub={`${stats?.usedCodes ?? 0} redeemed`} color="red" />
          <StatCard icon={Flame} label="Visits (24h)" value={stats?.visits?.today ?? "—"} sub={`${stats?.visits?.total ?? 0} all-time`} color="red" />
          <StatCard icon={Users} label="Friend Links Active" value={stats?.availableFriends ?? "—"} sub={`${stats?.usedFriends ?? 0} redeemed`} color="amber" />
          <StatCard icon={Bot} label="Auto-Sent" value={sys?.totalAutoSent ?? "—"} sub={sys?.lastRunAt ? `Last: ${timeAgo(sys.lastRunAt)}` : "Never run yet"} color="zinc" />
          <StatCard icon={BarChart3} label="Scripts Downloaded" value={downloadStatsQuery.data?.totalDownloads ?? "—"} sub={`${downloadStatsQuery.data?.totalTweaksDeployed ?? 0} tweaks deployed`} color="blue" />
          <StatCard icon={Inbox} label="Pending Emails" value={pendingEmailCount} sub={`${(emailRequestsQuery.data ?? []).length} total requests`} color="violet" />
        </div>

        {/* Payment Quick Links */}
        <div className="flex flex-wrap gap-2 p-3 bg-zinc-900/30 border border-white/5 rounded-xl">
          <span className="text-[10px] text-zinc-700 uppercase tracking-widest self-center mr-1 font-bold">Payment</span>
          <a href="https://cash.app/$my1ik" target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-400 hover:bg-emerald-600/20 transition-colors font-mono">
            <DollarSign className="w-3 h-3" /> $my1ik
          </a>
          <a href="https://paypal.me/accountslg" target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/10 border border-blue-500/20 rounded-lg text-xs text-blue-400 hover:bg-blue-600/20 transition-colors font-mono">
            <Zap className="w-3 h-3" /> paypal.me/accountslg
          </a>
          <a href="https://discord.gg/C8WrQknN9k" target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/10 border border-indigo-500/20 rounded-lg text-xs text-indigo-400 hover:bg-indigo-600/20 transition-colors font-mono">
            <MessageSquare className="w-3 h-3" /> Discord
          </a>
        </div>

        {/* Manual payment log */}
        {(manualPaymentsQuery.data?.length ?? 0) > 0 && (
          <div className="rounded-xl border border-white/5 bg-zinc-900/40 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">CashApp / PayPal Log</span>
              <span className="text-[10px] text-zinc-600">{manualPaymentsQuery.data?.length} entries</span>
            </div>
            <div className="divide-y divide-white/5">
              {manualPaymentsQuery.data?.map(p => (
                <div key={p.id} data-testid={`row-manual-payment-${p.id}`} className="flex items-center gap-3 px-4 py-2.5">
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded",
                    p.method === "cashapp"
                      ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                      : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                  )}>
                    {p.method === "cashapp" ? "CashApp" : "PayPal"}
                  </span>
                  <span className="text-emerald-400 font-mono font-bold text-sm">${p.amount}</span>
                  {p.note && <span className="text-zinc-400 text-xs flex-1 truncate">{p.note}</span>}
                  {!p.note && <span className="flex-1" />}
                  <span className="text-[10px] text-zinc-600">{fmt(p.paidAt?.toString())}</span>
                  <button
                    data-testid={`button-delete-payment-${p.id}`}
                    onClick={() => delManualPayment.mutate(p.id)}
                    className="text-zinc-700 hover:text-red-400 transition-colors p-1 rounded"
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabs — horizontally scrollable on mobile */}
        <div className="flex items-center border-b border-white/5 overflow-x-auto scrollbar-none"
          style={{ WebkitOverflowScrolling: "touch" }}>
          {(["codes", "friends", "activity", "email", "announcements", "analytics"] as Tab[]).map(t => {
            const pendingEmails = (emailRequestsQuery.data || []).filter(r => r.status === "pending").length;
            const TAB_ICONS: Record<Tab, React.ElementType> = {
              codes: Key,
              friends: Link,
              activity: Activity,
              email: Mail,
              announcements: Bell,
              analytics: TrendingUp,
            };
            const TIcon = TAB_ICONS[t];
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "shrink-0 flex items-center gap-1.5 px-3 py-2.5 md:px-4 text-xs font-bold uppercase tracking-widest transition-all border-b-2 -mb-px whitespace-nowrap",
                  tab === t
                    ? "text-red-400 border-red-500"
                    : "text-zinc-600 border-transparent hover:text-zinc-300"
                )}
              >
                <TIcon className="w-3 h-3 shrink-0" />
                <span className="hidden sm:inline">
                  {t === "codes" ? `Codes (${stats?.totalCodes ?? 0})` :
                   t === "friends" ? `Friends (${stats?.totalFriends ?? 0})` :
                   t === "email" ? "Email" :
                   t === "announcements" ? "Updates" :
                   t === "analytics" ? "Analytics" :
                   `Activity (${activityItems.length})`}
                </span>
                <span className="sm:hidden">
                  {t === "codes" ? `${stats?.totalCodes ?? 0}` :
                   t === "friends" ? `${stats?.totalFriends ?? 0}` :
                   t === "email" ? "" :
                   t === "announcements" ? "" :
                   t === "analytics" ? "" :
                   `${activityItems.length}`}
                </span>
                {t === "email" && pendingEmails > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[9px] font-bold shadow-[0_0_6px_rgba(239,68,68,0.5)]">
                    {pendingEmails}
                  </span>
                )}
              </button>
            );
          })}
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

            {/* Register existing code (for codes DM'd manually without going through the system) */}
            <div className="bg-amber-950/20 border border-amber-500/20 rounded-xl p-4 space-y-3">
              <p className="text-[11px] text-amber-400/80 leading-relaxed">
                <span className="font-black text-amber-300">Already sent someone a code manually?</span>{" "}
                Register it here so the system recognises it — prevents "Invalid code" errors when they try to unlock.
              </p>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <input
                    data-testid="input-import-code"
                    type="text"
                    placeholder="Paste code e.g. ZF3W-P4VC-HQ9Z"
                    value={importCode}
                    onChange={e => setImportCode(e.target.value.toUpperCase())}
                    className="flex-1 bg-black border border-amber-500/30 focus:border-amber-500/60 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none transition-colors font-mono tracking-widest"
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    data-testid="input-import-code-note"
                    type="text"
                    placeholder="Customer name / note (e.g. Lovers Rack)"
                    value={importCodeNote}
                    onChange={e => setImportCodeNote(e.target.value)}
                    className="flex-1 bg-black border border-zinc-700 focus:border-amber-500/30 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-700 focus:outline-none transition-colors"
                  />
                  <Button
                    data-testid="button-import-code"
                    onClick={() => importCodeMut.mutate()}
                    disabled={importCodeMut.isPending || importCode.trim().length < 5}
                    className="bg-amber-700 hover:bg-amber-600 text-white border border-amber-500/30 shrink-0 gap-1.5 font-bold"
                  >
                    <Key className="w-4 h-4" /> Register
                  </Button>
                </div>
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
                    {editingCodeId === c.id ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          data-testid={`input-rename-code-${c.id}`}
                          autoFocus
                          type="text"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter") renameCode.mutate({ id: c.id, note: editValue.trim() || null });
                            if (e.key === "Escape") { setEditingCodeId(null); setEditValue(""); }
                          }}
                          placeholder="Customer name..."
                          className="flex-1 bg-zinc-800 border border-red-500/30 focus:border-red-500/60 rounded px-2 py-0.5 text-xs text-white placeholder-zinc-600 focus:outline-none"
                        />
                        <button
                          data-testid={`button-confirm-rename-code-${c.id}`}
                          onClick={() => renameCode.mutate({ id: c.id, note: editValue.trim() || null })}
                          disabled={renameCode.isPending}
                          className="p-1 rounded bg-red-600/20 hover:bg-red-600/40 text-red-400 transition-colors"
                          title="Save name"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          data-testid={`button-cancel-rename-code-${c.id}`}
                          onClick={() => { setEditingCodeId(null); setEditValue(""); }}
                          className="p-1 rounded hover:bg-zinc-700 text-zinc-600 hover:text-zinc-400 transition-colors"
                          title="Cancel"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (() => {
                      const codeDeploy = (customerDeployStatsQuery.data || []).find(s => s.codeRef === c.code);
                      const fps = codeDeploy ? estimateFpsGain(codeDeploy.allTweakIds) : null;
                      return (
                        <div className="flex items-center gap-1.5 group/note flex-wrap">
                          {c.note
                            ? <p className="text-xs text-zinc-300 truncate">{c.note}</p>
                            : <p className="text-xs text-zinc-600 italic">No name</p>
                          }
                          {fps && fps.high > 0 && (
                            <span
                              data-testid={`badge-fps-code-${c.id}`}
                              className="flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded border text-emerald-400 bg-emerald-500/10 border-emerald-500/20 shrink-0"
                              title={`${codeDeploy!.totalTweaks} tweaks deployed · ${codeDeploy!.downloadCount} download${codeDeploy!.downloadCount !== 1 ? 's' : ''}`}
                            >
                              <TrendingUp className="w-2.5 h-2.5" />
                              +{fps.low}–{fps.high} FPS
                            </span>
                          )}
                          <button
                            data-testid={`button-rename-code-${c.id}`}
                            onClick={() => { setEditingCodeId(c.id); setEditValue(c.note || ""); }}
                            className="p-0.5 rounded opacity-0 group-hover/note:opacity-100 hover:bg-zinc-700 text-zinc-600 hover:text-zinc-300 transition-all"
                            title="Rename customer"
                          >
                            <Pencil className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      );
                    })()}
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
                      {editingFriendId === t.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            data-testid={`input-rename-friend-${t.id}`}
                            autoFocus
                            type="text"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter") renameFriend.mutate({ id: t.id, note: editValue.trim() || null });
                              if (e.key === "Escape") { setEditingFriendId(null); setEditValue(""); }
                            }}
                            placeholder="Person's name..."
                            className="flex-1 bg-zinc-800 border border-red-500/30 focus:border-red-500/60 rounded px-2 py-0.5 text-xs text-white placeholder-zinc-600 focus:outline-none"
                          />
                          <button
                            data-testid={`button-confirm-rename-friend-${t.id}`}
                            onClick={() => renameFriend.mutate({ id: t.id, note: editValue.trim() || null })}
                            disabled={renameFriend.isPending}
                            className="p-1 rounded bg-red-600/20 hover:bg-red-600/40 text-red-400 transition-colors"
                            title="Save name"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            data-testid={`button-cancel-rename-friend-${t.id}`}
                            onClick={() => { setEditingFriendId(null); setEditValue(""); }}
                            className="p-1 rounded hover:bg-zinc-700 text-zinc-600 hover:text-zinc-400 transition-colors"
                            title="Cancel"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 group/note">
                          {t.note
                            ? <p className="text-xs font-medium text-zinc-300 truncate">{t.note}</p>
                            : <p className="text-xs text-zinc-600 italic">No name</p>
                          }
                          <button
                            data-testid={`button-rename-friend-${t.id}`}
                            onClick={() => { setEditingFriendId(t.id); setEditValue(t.note || ""); }}
                            className="p-0.5 rounded opacity-0 group-hover/note:opacity-100 hover:bg-zinc-700 text-zinc-600 hover:text-zinc-300 transition-all"
                            title="Rename person"
                          >
                            <Pencil className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      )}
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

        {/* ─── EMAIL REQUESTS TAB ───────────────────────────────────── */}
        {tab === "email" && (
          <div className="space-y-4">
            {/* Email config status */}
            {emailConfiguredQuery.data && !emailConfiguredQuery.data.configured && (
              <div className="flex items-start gap-3 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-amber-300">Email not configured</p>
                  <p className="text-[11px] text-amber-600 mt-1 leading-relaxed">
                    Set <span className="font-mono text-amber-400">EMAIL_USER</span> (your Gmail address) and{" "}
                    <span className="font-mono text-amber-400">EMAIL_PASS</span> (Gmail App Password) in environment secrets to enable auto-sending.
                    Until then you can still see requests here and send codes manually via Discord.
                  </p>
                </div>
              </div>
            )}

            {emailConfiguredQuery.data?.configured && (
              <div className="flex items-center gap-2 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <p className="text-[11px] text-emerald-400 font-bold">Email configured — codes will be auto-sent when you click "Send Code"</p>
              </div>
            )}

            <div className="text-[10px] text-zinc-600 leading-relaxed">
              Customers submit their email + payment proof here. Review each request and click{" "}
              <strong className="text-zinc-400">Send Code</strong> to automatically pick an available code and email it to them.
              You do not need to be online — click when you check in.
            </div>

            {emailRequestsQuery.isLoading ? (
              <div className="p-12 text-center text-xs text-zinc-600 animate-pulse">Loading email requests...</div>
            ) : !emailRequestsQuery.data?.length ? (
              <div className="p-12 text-center">
                <Inbox className="w-8 h-8 text-zinc-800 mx-auto mb-3" />
                <p className="text-xs text-zinc-600">No email requests yet.</p>
                <p className="text-[10px] text-zinc-700 mt-1">Customers use the "Get Code via Email" button on the site.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-white/5 overflow-hidden divide-y divide-white/5">
                {emailRequestsQuery.data
                  .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
                  .map(req => {
                    // Cross-reference sentCodeId with the codes list to detect customer redemption
                    const sentCode = req.sentCodeId
                      ? (codesQuery.data || []).find(c => c.id === req.sentCodeId)
                      : null;
                    const customerRedeemed = !!(sentCode?.usedAt);
                    // Per-customer deploy stats — matched by code value
                    const deployStat = sentCode?.code
                      ? (customerDeployStatsQuery.data || []).find(s => s.codeRef === sentCode.code)
                      : null;
                    const isSentStatus = req.status === "sent" || req.status === "auto-sent";

                    return (
                    <div
                      key={req.id}
                      data-testid={`row-email-req-${req.id}`}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 transition-colors",
                        req.status === "pending" ? "hover:bg-zinc-900/40" : "opacity-60 hover:opacity-80"
                      )}
                    >
                      <div className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                        isSentStatus && customerRedeemed ? "bg-blue-500/10 border border-blue-500/20"
                          : isSentStatus ? "bg-emerald-500/10 border border-emerald-500/20"
                          : req.status === "rejected" ? "bg-zinc-800 border border-zinc-700"
                          : "bg-red-500/10 border border-red-500/20"
                      )}>
                        <Mail className={cn(
                          "w-3.5 h-3.5",
                          isSentStatus && customerRedeemed ? "text-blue-400"
                            : isSentStatus ? "text-emerald-400"
                            : req.status === "rejected" ? "text-zinc-600"
                            : "text-red-400"
                        )} />
                      </div>

                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs font-medium text-white truncate">{req.email}</p>
                          <span className={cn(
                            "text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0",
                            isSentStatus ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                              : req.status === "rejected" ? "text-zinc-600 bg-zinc-800 border-zinc-700"
                              : "text-amber-400 bg-amber-500/10 border-amber-500/20"
                          )}>
                            {req.status.toUpperCase()}
                          </span>
                          {/* Redemption status — only shown for sent requests */}
                          {isSentStatus && (
                            customerRedeemed ? (
                              <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border text-blue-400 bg-blue-500/10 border-blue-500/20 shrink-0">
                                <Check className="w-2.5 h-2.5" /> Customer Redeemed
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border text-zinc-500 bg-zinc-800/50 border-zinc-700 shrink-0">
                                <Clock className="w-2.5 h-2.5" /> Awaiting Redemption
                              </span>
                            )
                          )}
                          {/* Tweaks deployed + FPS estimate — live every 5s */}
                          {deployStat && (() => {
                            const fps = estimateFpsGain(deployStat.allTweakIds);
                            return (
                              <>
                                <span
                                  data-testid={`badge-tweaks-deployed-${req.id}`}
                                  className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border text-red-400 bg-red-500/10 border-red-500/20 shrink-0"
                                  title={`${deployStat.downloadCount} download${deployStat.downloadCount !== 1 ? 's' : ''} · last: ${deployStat.lastDownloadAt}`}
                                >
                                  <Zap className="w-2.5 h-2.5" />
                                  {deployStat.totalTweaks} tweaks deployed
                                </span>
                                {fps.high > 0 && (
                                  <span
                                    data-testid={`badge-fps-est-${req.id}`}
                                    className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border text-emerald-400 bg-emerald-500/10 border-emerald-500/20 shrink-0"
                                    title={`Estimated FPS gain from ${deployStat.allTweakIds.length} unique tweaks applied`}
                                  >
                                    <TrendingUp className="w-2.5 h-2.5" />
                                    +{fps.low}–{fps.high} FPS est.
                                  </span>
                                )}
                              </>
                            );
                          })()}
                        </div>
                        <p className="text-[10px] text-zinc-500">
                          <span className="uppercase font-bold text-zinc-600">{req.paymentMethod}</span>
                          {" — "}
                          <span className="font-mono">{req.paymentRef}</span>
                        </p>
                        {sentCode && (
                          <p className="text-[10px] text-zinc-700 font-mono">
                            Code: <span className="text-zinc-500">{sentCode.code}</span>
                            {customerRedeemed && sentCode.usedAt && (
                              <span className="text-blue-600 ml-2">· redeemed {timeAgo(sentCode.usedAt)}</span>
                            )}
                          </p>
                        )}
                        <p className="text-[10px] text-zinc-700">{timeAgo(req.createdAt)} · {fmt(req.createdAt)}</p>
                        {req.note && <p className="text-[10px] text-zinc-600 italic">{req.note}</p>}
                      </div>

                      {req.status === "pending" && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            data-testid={`button-send-email-${req.id}`}
                            onClick={() => sendEmailCode.mutate(req.id)}
                            disabled={sendEmailCode.isPending}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-600/80 hover:bg-red-600 text-white text-[11px] font-bold transition-colors disabled:opacity-50"
                          >
                            <Send className="w-3 h-3" />
                            Send Code
                          </button>
                          <button
                            data-testid={`button-reject-email-${req.id}`}
                            onClick={() => rejectEmailReq.mutate(req.id)}
                            disabled={rejectEmailReq.isPending}
                            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-600 hover:text-amber-400 transition-colors"
                            title="Reject request"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      <button
                        data-testid={`button-del-email-${req.id}`}
                        onClick={() => delEmailReq.mutate(req.id)}
                        className="p-1.5 rounded hover:bg-red-500/10 text-zinc-700 hover:text-red-400 transition-colors shrink-0"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                  })}
              </div>
            )}
          </div>
        )}

        {/* ─── ANNOUNCEMENTS TAB ────────────────────────────────────── */}
        {tab === "announcements" && (
          <div className="space-y-5">
            <div className="text-[10px] text-zinc-600 leading-relaxed">
              Post update notes, hotfixes, and announcements that appear on the public <span className="text-zinc-400 font-mono">/updates</span> page. Visible to all users — no Pro required.
            </div>

            {/* Compose form */}
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 space-y-3">
              <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                <Megaphone className="w-3.5 h-3.5 text-red-500" /> New Announcement
              </h3>
              <input
                data-testid="input-ann-title"
                value={annTitle}
                onChange={e => setAnnTitle(e.target.value)}
                placeholder="Title (e.g. v2.4 — NVIDIA tweak update)"
                className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-500/40"
              />
              <textarea
                data-testid="input-ann-body"
                value={annBody}
                onChange={e => setAnnBody(e.target.value)}
                placeholder="Body — describe what changed, what's new, or any warnings..."
                rows={4}
                className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-500/40 resize-none"
              />

              {/* Tweak IDs — optional, links update to specific tweaks */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Zap className="w-3 h-3 text-red-500 shrink-0" />
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Linked Tweaks (optional)</span>
                  {parsedTweakIds.length > 0 && (
                    <span className="px-1.5 py-0.5 bg-red-500/15 text-red-400 rounded text-[9px] font-bold">{parsedTweakIds.length} tweaks</span>
                  )}
                </div>
                <textarea
                  data-testid="input-ann-tweakids"
                  value={annTweakIds}
                  onChange={e => setAnnTweakIds(e.target.value)}
                  placeholder={"Enter tweak IDs — one per line or comma-separated:\nNvidiaPowerMizer\nNvidiaThreadedOpt\nFiveMHighPriority"}
                  rows={3}
                  className="w-full bg-zinc-900/60 border border-white/5 rounded-lg px-3 py-2 text-xs text-zinc-300 font-mono placeholder-zinc-700 focus:outline-none focus:border-red-500/30 resize-none"
                />
                <p className="text-[10px] text-zinc-700 leading-relaxed">
                  Pro users on the Updates page will see which of these tweaks they haven't applied yet, with a one-click "Apply New Tweaks" button. Leave blank for general announcements.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <Tag className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <select
                    data-testid="select-ann-tag"
                    value={annTag}
                    onChange={e => setAnnTag(e.target.value)}
                    className="bg-zinc-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-red-500/40"
                  >
                    <option value="update">Update</option>
                    <option value="hotfix">Hotfix</option>
                    <option value="new">New</option>
                    <option value="announcement">Announcement</option>
                    <option value="warning">Warning</option>
                  </select>
                </div>
                <button
                  data-testid="button-post-announcement"
                  disabled={!annTitle.trim() || !annBody.trim() || createAnn.isPending}
                  onClick={() => createAnn.mutate()}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  {createAnn.isPending ? "Posting..." : "Post Announcement"}
                </button>
              </div>
            </div>

            {/* Existing announcements */}
            <div className="space-y-2">
              {announcementsQuery.isLoading && (
                <div className="py-8 text-center text-xs text-zinc-600 animate-pulse">Loading announcements...</div>
              )}
              {!announcementsQuery.isLoading && !(announcementsQuery.data?.length) && (
                <div className="py-8 text-center">
                  <Bell className="w-8 h-8 text-zinc-800 mx-auto mb-3" />
                  <p className="text-xs text-zinc-600">No announcements yet.</p>
                </div>
              )}
              {(announcementsQuery.data || []).map(ann => (
                <div
                  key={ann.id}
                  data-testid={`card-admin-ann-${ann.id}`}
                  className="flex items-start gap-3 p-4 rounded-xl border border-white/5 bg-white/[0.01]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-white truncate">{ann.title}</span>
                      {ann.tag && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20 shrink-0">
                          {ann.tag}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2">{ann.body}</p>
                    <p className="text-[10px] text-zinc-700 mt-1">{new Date(ann.createdAt).toLocaleString()}</p>
                  </div>
                  <button
                    data-testid={`button-del-ann-${ann.id}`}
                    onClick={() => deleteAnn.mutate(ann.id)}
                    disabled={deleteAnn.isPending}
                    className="p-1.5 rounded hover:bg-red-500/10 text-zinc-700 hover:text-red-400 transition-colors shrink-0"
                    title="Delete announcement"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── IMPACT ANALYTICS TAB ──────────────────────────────────── */}
        {tab === "analytics" && (
          <div className="space-y-5">
            <div className="text-[10px] text-zinc-600 leading-relaxed">
              Every time a user downloads a script, the tweaks they had enabled are recorded. Data is fully anonymous — no IP, no account info, just tweak IDs and timestamps.
            </div>

            {downloadStatsQuery.isLoading ? (
              <div className="flex items-center gap-3 py-10 justify-center text-zinc-600 text-sm">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Loading analytics...
              </div>
            ) : (() => {
              const ds = downloadStatsQuery.data;
              if (!ds) return <div className="text-zinc-600 text-sm py-6 text-center">No data yet</div>;

              const maxDay = Math.max(...ds.last7Days.map(d => d.count), 1);
              const maxTweak = Math.max(...ds.topTweaks.map(t => t.count), 1);

              return (
                <div className="space-y-5">
                  {/* Hero stats */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      {
                        label: "Scripts Downloaded",
                        value: ds.totalDownloads.toLocaleString(),
                        sub: "total users helped",
                        color: "text-red-400",
                        icon: <TrendingUp className="w-4 h-4 text-red-400" />,
                      },
                      {
                        label: "Tweaks Deployed",
                        value: ds.totalTweaksDeployed.toLocaleString(),
                        sub: "applied across all users",
                        color: "text-emerald-400",
                        icon: <Zap className="w-4 h-4 text-emerald-400" />,
                      },
                      {
                        label: "Avg per Script",
                        value: `${ds.avgTweaksPerDownload}`,
                        sub: "tweaks per download",
                        color: "text-blue-400",
                        icon: <BarChart3 className="w-4 h-4 text-blue-400" />,
                      },
                    ].map((s) => (
                      <div key={s.label} className="relative p-4 rounded-xl border border-white/5 bg-zinc-900/40 overflow-hidden">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">{s.label}</p>
                          {s.icon}
                        </div>
                        <p className={`text-3xl font-black font-mono ${s.color}`}>{s.value}</p>
                        <p className="text-[10px] text-zinc-700 mt-1">{s.sub}</p>
                      </div>
                    ))}
                  </div>

                  {/* 7-day trend bar chart */}
                  <div className="rounded-xl border border-white/5 bg-zinc-900/40 p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <BarChart3 className="w-3.5 h-3.5 text-zinc-500" />
                      <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Downloads — Last 7 Days</h3>
                    </div>
                    <div className="flex items-end gap-2 h-24">
                      {ds.last7Days.map((day) => {
                        const barH = maxDay > 0 ? Math.max((day.count / maxDay) * 100, day.count > 0 ? 8 : 2) : 2;
                        const label = new Date(day.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
                        return (
                          <div key={day.date} className="flex-1 flex flex-col items-center gap-1" title={`${day.date}: ${day.count} downloads`}>
                            <span className="text-[9px] text-zinc-600 font-mono">{day.count > 0 ? day.count : ""}</span>
                            <div className="w-full rounded-t-sm bg-red-500/70" style={{ height: `${barH}%`, minHeight: "2px" }} />
                            <span className="text-[8px] text-zinc-700 font-bold">{label}</span>
                          </div>
                        );
                      })}
                    </div>
                    {ds.last7Days.every(d => d.count === 0) && (
                      <p className="text-[10px] text-zinc-700 text-center mt-2">No downloads in the last 7 days yet — data populates as users download scripts.</p>
                    )}
                  </div>

                  {/* Top tweaks */}
                  {ds.topTweaks.length > 0 ? (
                    <div className="rounded-xl border border-white/5 bg-zinc-900/40 p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <Flame className="w-3.5 h-3.5 text-red-500" />
                        <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Most Popular Tweaks</h3>
                        <span className="ml-auto text-[9px] text-zinc-700">top {ds.topTweaks.length} by frequency</span>
                      </div>
                      <div className="space-y-2">
                        {ds.topTweaks.map((t, i) => (
                          <div key={t.tweakId} className="flex items-center gap-3">
                            <span className="text-[9px] font-bold text-zinc-700 w-4 shrink-0 text-right">{i + 1}</span>
                            <span className="text-[11px] font-mono text-zinc-300 w-44 shrink-0 truncate" title={t.tweakId}>{t.tweakId}</span>
                            <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-red-600 to-red-400"
                                style={{ width: `${(t.count / maxTweak) * 100}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-mono text-zinc-500 w-8 text-right shrink-0">{t.count}×</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-white/5 bg-zinc-900/40 p-6 text-center">
                      <Flame className="w-6 h-6 text-zinc-700 mx-auto mb-2" />
                      <p className="text-xs text-zinc-600">Top tweaks will appear here after the first script is downloaded.</p>
                    </div>
                  )}

                  {/* Recent script generations */}
                  <div className="rounded-xl border border-white/5 bg-zinc-900/40 overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
                      <Activity className="w-3.5 h-3.5 text-emerald-500" />
                      <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Recent Script Generations</h3>
                      <span className="ml-auto text-[9px] text-zinc-700">last {Math.min(ds.recentDownloads?.length ?? 0, 30)} events</span>
                    </div>
                    {!ds.recentDownloads || ds.recentDownloads.length === 0 ? (
                      <div className="py-8 text-center">
                        <Activity className="w-5 h-5 text-zinc-700 mx-auto mb-2" />
                        <p className="text-[10px] text-zinc-700">No script generations yet. Data appears here when users download their optimization script.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-white/5">
                        {ds.recentDownloads.map((dl) => {
                          const when = timeAgo(dl.downloadedAt);
                          const topIds = dl.tweakIds.slice(0, 4);
                          const extra = dl.tweakIds.length - topIds.length;
                          const heat = dl.tweakCount >= 50 ? "text-red-400" : dl.tweakCount >= 25 ? "text-amber-400" : "text-emerald-400";
                          return (
                            <div key={dl.id} data-testid={`row-download-${dl.id}`} className="flex items-start gap-3 px-4 py-2.5 hover:bg-white/2 transition-colors">
                              <span className="text-[9px] text-zinc-700 font-mono w-5 shrink-0 pt-0.5 text-right">#{dl.id}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {topIds.map(tid => (
                                    <span key={tid} className="text-[9px] font-mono bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded truncate max-w-[140px]" title={tid}>{tid}</span>
                                  ))}
                                  {extra > 0 && <span className="text-[9px] text-zinc-600">+{extra} more</span>}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`text-[11px] font-black font-mono ${heat}`}>{dl.tweakCount}</span>
                                <span className="text-[9px] text-zinc-700">tweaks</span>
                                <span className="text-[9px] text-zinc-600 pl-1">{when}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ─── MOBILE FLOATING ACTION BAR ───────────────────────────── */}
        <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
          <div className="bg-zinc-950/95 border-t border-white/8 backdrop-blur-xl px-4 py-3 pb-safe-area-inset-bottom">
            <div className="flex items-center gap-2">
              {/* Quick Generate Code */}
              <button
                data-testid="mobile-fab-gen-code"
                onClick={() => { setTab("codes"); genCode.mutate(); }}
                disabled={genCode.isPending}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-sm transition-all shadow-[0_4px_20px_-4px_rgba(239,68,68,0.5)] active:scale-95"
              >
                <Plus className="w-4 h-4" />
                {genCode.isPending ? "Generating..." : "Gen Code"}
              </button>

              {/* Email Tab Shortcut */}
              <button
                data-testid="mobile-fab-email"
                onClick={() => setTab("email")}
                className={cn(
                  "relative flex items-center justify-center w-12 h-12 rounded-xl border transition-all active:scale-95",
                  tab === "email"
                    ? "bg-red-500/15 border-red-500/40 text-red-400"
                    : "bg-zinc-800/80 border-zinc-700 text-zinc-400"
                )}
              >
                <Mail className="w-5 h-5" />
                {pendingEmailCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full text-[8px] font-bold text-white flex items-center justify-center">
                    {pendingEmailCount}
                  </span>
                )}
              </button>

              {/* Quick Send Now (if pending) */}
              {pendingEmailCount > 0 && sys?.enabled && (
                <button
                  data-testid="mobile-fab-send-now"
                  onClick={() => triggerAutoSend.mutate()}
                  disabled={triggerAutoSend.isPending}
                  className="flex items-center justify-center gap-1.5 px-3 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs transition-all active:scale-95"
                >
                  <PlayCircle className="w-4 h-4" />
                  Send All
                </button>
              )}

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="flex items-center justify-center w-12 h-12 rounded-xl bg-zinc-800/80 border border-zinc-700 text-zinc-500 transition-all active:scale-95"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
