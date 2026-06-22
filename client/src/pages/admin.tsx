import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { apiUrl } from "@/lib/api-base";
import { isNative, openExternal } from "@/lib/tauri-bridge";
import { computeSmartRecs } from "@/lib/smart-recommendations";
import type { HardwareInfo } from "@/hooks/use-hardware-info";
import type { OsInfo } from "@/hooks/use-os-detection";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy, Trash2, Plus, Key, Link, Check, AlertCircle, Shield,
  LogOut, DollarSign, Users, BarChart3, Clock, Search, Zap, ArrowLeft,
  MessageSquare, Flame, RefreshCw, ChevronDown, ChevronUp, RotateCcw, ShieldOff,
  Mail, Send, XCircle, Inbox, Activity, Bot, Timer, TrendingUp, Wifi, WifiOff,
  PlayCircle, ChevronRight, Eye, Bell, Megaphone, Tag, Pencil, X, CreditCard,
  MapPin, AlertTriangle, Globe, Ban, ShieldAlert, ShieldCheck, Radar,
  ServerCrash, Network, Flag, CheckCircle2, Cpu, Download, Monitor, MemoryStick, Laptop, Sliders,
  Percent, Crown, UserX, Palette,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useProStatus, setProSession, clearProStatus } from "@/lib/pro-status";
import { useAuth } from "@/hooks/use-auth";
import { estimateFpsGain } from "@/lib/fps-impact-map";
import type { ProAccessCode, ProFriendToken, EmailRequest, ManualPayment, SecurityEvent, SecuritySeverity, IpBan } from "@shared/schema";
import { AdminSilverMark } from "@/components/branding/admin-silver-mark";
import { HardwareDbTab, SuggestionsInboxTab, NvidiaTrackerTab } from "@/components/admin/hardware-db-tabs";
import { ProPaymentDialog } from "@/components/pro-gate";

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

// Country name → ISO 3166-1 alpha-2 code → regional indicator emoji flag
const COUNTRY_TO_ISO: Record<string, string> = {
  "United States": "US", "USA": "US", "United Kingdom": "GB", "UK": "GB",
  "Canada": "CA", "Germany": "DE", "France": "FR", "Spain": "ES", "Italy": "IT",
  "Netherlands": "NL", "Belgium": "BE", "Sweden": "SE", "Norway": "NO", "Finland": "FI",
  "Denmark": "DK", "Poland": "PL", "Russia": "RU", "Ukraine": "UA", "Turkey": "TR",
  "Brazil": "BR", "Argentina": "AR", "Mexico": "MX", "Chile": "CL", "Colombia": "CO",
  "Australia": "AU", "New Zealand": "NZ", "Japan": "JP", "China": "CN", "South Korea": "KR",
  "India": "IN", "Indonesia": "ID", "Singapore": "SG", "Malaysia": "MY", "Thailand": "TH",
  "Vietnam": "VN", "Philippines": "PH", "Pakistan": "PK", "Bangladesh": "BD",
  "Saudi Arabia": "SA", "United Arab Emirates": "AE", "Israel": "IL", "Egypt": "EG",
  "South Africa": "ZA", "Nigeria": "NG", "Morocco": "MA", "Kenya": "KE",
  "Ireland": "IE", "Portugal": "PT", "Greece": "GR", "Czechia": "CZ", "Romania": "RO",
  "Hungary": "HU", "Austria": "AT", "Switzerland": "CH", "Bulgaria": "BG",
};
function countryFlag(country: string | null | undefined): string {
  if (!country) return "";
  const iso = COUNTRY_TO_ISO[country] ?? (country.length === 2 ? country.toUpperCase() : "");
  if (iso.length !== 2) return "";
  const A = 0x1F1E6, base = "A".charCodeAt(0);
  return String.fromCodePoint(A + iso.charCodeAt(0) - base, A + iso.charCodeAt(1) - base);
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

function timeUntil(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return "soon";
  const m = Math.floor(diff / 60000);
  if (m < 1) return "< 1 min";
  if (m < 60) return `in ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `in ${h}h ${m % 60}m`;
  return `in ${Math.floor(h / 24)}d`;
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

type Tab = "codes" | "friends" | "activity" | "email" | "sessions" | "pro" | "announcements" | "analytics" | "security" | "preset" | "aether" | "tickets" | "discounts" | "rigs" | "suggestions" | "drivers";

// ── Aether Security Intelligence Center ─────────────────────────────────────
type BlockedIp = { key: string; ip: string; path: string; resetAt: number; minutesLeft: number };

type AutoResolveRunEntry = {
  id: number;
  resolvedCount: number;
  windowDays: number;
  ranAt: string | null;
};

type SecurityStats = {
  threatScore: number;
  flagsToday: number;
  activeBans: number;
  suspiciousCodes: number;
  countriesSeen: number;
  topCountries: { country: string; count: number }[];
  openEvents: number;
  lastAutoResolved: number;
  lastAutoResolvedAt: string | null;
  autoResolveWindowDays: number;
  nextAutoResolveAt: string | null;
  autoResolveHistory: AutoResolveRunEntry[];
  totalAutoResolved: number;
  autoResolveRunCount: number;
};

function severityBadge(severity: string) {
  const cfg: Record<string, string> = {
    critical: "bg-red-500/20 text-red-400 border border-red-500/30",
    high:     "bg-orange-500/20 text-orange-400 border border-orange-500/30",
    medium:   "bg-amber-500/20 text-amber-400 border border-amber-500/30",
    low:      "bg-zinc-800 text-zinc-500 border border-white/5",
  };
  return (
    <span className={cn("text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded", cfg[severity] ?? cfg.low)}>
      {severity}
    </span>
  );
}

function typeBadge(type: string) {
  const cfg: Record<string, { label: string; cls: string }> = {
    code_sharing: { label: "CODE SHARE", cls: "bg-red-500/15 text-red-400" },
    vpn_detected: { label: "VPN",         cls: "bg-violet-500/15 text-violet-400" },
    rate_block:   { label: "RATE BLOCK",  cls: "bg-amber-500/15 text-amber-400" },
    multi_ip:     { label: "MULTI-IP",    cls: "bg-orange-500/15 text-orange-400" },
    manual_flag:  { label: "MANUAL",      cls: "bg-zinc-700 text-zinc-400" },
  };
  const c = cfg[type] ?? cfg.manual_flag;
  return <span className={cn("text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded", c.cls)}>{c.label}</span>;
}

function ThreatGauge({ score }: { score: number }) {
  const color = score >= 70 ? "text-red-400" : score >= 40 ? "text-amber-400" : "text-emerald-400";
  const bgColor = score >= 70 ? "bg-red-500" : score >= 40 ? "bg-amber-500" : "bg-emerald-500";
  const label = score >= 70 ? "HIGH THREAT" : score >= 40 ? "MODERATE" : "ALL CLEAR";
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 p-4 bg-zinc-900/70 border border-white/5 rounded-xl">
      <Radar className={cn("w-8 h-8", color)} />
      <div className={cn("text-3xl font-display font-bold", color)}>{score}</div>
      <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", bgColor)} style={{ width: `${score}%` }} />
      </div>
      <p className={cn("text-[9px] font-bold uppercase tracking-widest", color)}>{label}</p>
    </div>
  );
}

function SecurityTab({ headers }: { headers: Record<string, string> }) {
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<"feed" | "sharing" | "vpn" | "bans" | "rate" | "alerts">("feed");
  const [resolving, setResolving] = useState<number | null>(null);
  const [banning, setBanning] = useState<string | null>(null);
  const [banForm, setBanForm] = useState<{ ip: string; reason: string; permanent: boolean } | null>(null);
  const [unblocking, setUnblocking] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [manualFlagOpen, setManualFlagOpen] = useState(false);
  const [manualFlag, setManualFlag] = useState<{ ip: string; codeRef: string; details: string; severity: SecuritySeverity }>({ ip: "", codeRef: "", details: "", severity: "medium" });
  const [flagging, setFlagging] = useState(false);
  const [alertForm, setAlertForm] = useState<{ discordWebhookUrl: string; alertEmail: string; autoResolveDays: string; alertOnNewRig: boolean; alertOnNewNvidiaDriver: boolean; auditLogEnabled: boolean; auditWebhookUrl: string } | null>(null);
  const [pollingDrivers, setPollingDrivers] = useState(false);
  const [savingAlerts, setSavingAlerts] = useState(false);
  const [runningAutoResolve, setRunningAutoResolve] = useState(false);
  const [autoResolvePreview, setAutoResolvePreview] = useState<{ count: number; days: number } | null>(null);
  const [loadingAutoResolvePreview, setLoadingAutoResolvePreview] = useState(false);

  const refresh = () => setRefreshKey(k => k + 1);

  const statsQ = useQuery<SecurityStats>({
    queryKey: ["/api/admin/security/stats", refreshKey],
    queryFn: () => fetch(apiUrl("/api/admin/security/stats"), { headers }).then(r => r.json()),
    refetchInterval: 30_000,
  });

  const eventsQ = useQuery<SecurityEvent[]>({
    queryKey: ["/api/admin/security/events", refreshKey],
    queryFn: () => fetch(apiUrl("/api/admin/security/events?limit=200"), { headers }).then(r => r.json()),
    refetchInterval: 30_000,
  });

  const bansQ = useQuery<IpBan[]>({
    queryKey: ["/api/admin/security/bans", refreshKey],
    queryFn: () => fetch(apiUrl("/api/admin/security/bans"), { headers }).then(r => r.json()),
  });

  const [blocks, setBlocks] = useState<BlockedIp[]>([]);
  const [blocksLoading, setBlocksLoading] = useState(false);
  const loadBlocks = () => {
    setBlocksLoading(true);
    fetch(apiUrl("/api/admin/blocked-ips"), { headers }).then(r => r.json()).then(setBlocks).finally(() => setBlocksLoading(false));
  };
  useEffect(() => { loadBlocks(); }, [refreshKey]);

  const alertSettingsQ = useQuery<{ discordWebhookUrl: string | null; alertEmail: string | null; autoResolveDays: number | null; alertOnNewRig: boolean | null; alertOnNewNvidiaDriver: boolean | null; auditLogEnabled: boolean | null; auditWebhookUrl: string | null }>({
    queryKey: ["/api/admin/settings"],
    queryFn: () => fetch(apiUrl("/api/admin/settings"), { headers }).then(r => r.json()),
  });

  const events = eventsQ.data ?? [];
  const stats = statsQ.data;
  const bans = bansQ.data ?? [];

  const codeSharingEvents = events.filter(e => e.type === "code_sharing" && !e.resolvedAt);
  const vpnEvents = events.filter(e => e.type === "vpn_detected" && !e.resolvedAt);
  const feedEvents = events.slice(0, 60);

  const resolveEvent = async (id: number) => {
    setResolving(id);
    try {
      await fetch(apiUrl(`/api/admin/security/resolve/${id}`), { method: "POST", headers });
      refresh();
      toast({ title: "Event resolved" });
    } catch {
      toast({ title: "Failed to resolve event", variant: "destructive" });
    } finally {
      setResolving(null);
    }
  };

  const banIp = async (ip: string, reason: string, permanent: boolean) => {
    setBanning(ip);
    try {
      await fetch(apiUrl("/api/admin/security/ban-ip"), {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ ip, reason, permanent }),
      });
      refresh();
      setBanForm(null);
      toast({ title: `Banned ${ip}${permanent ? " (permanent)" : ""}`, variant: "destructive" });
    } catch {
      toast({ title: `Failed to ban ${ip}`, variant: "destructive" });
    } finally {
      setBanning(null);
    }
  };

  const unbanIp = async (ip: string) => {
    try {
      await fetch(apiUrl("/api/admin/security/ban-ip"), {
        method: "DELETE",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ ip }),
      });
      refresh();
      toast({ title: `Unbanned ${ip}` });
    } catch {
      toast({ title: `Failed to unban ${ip}`, variant: "destructive" });
    }
  };

  const unblockRate = async (b: BlockedIp) => {
    setUnblocking(b.key);
    try {
      await fetch(apiUrl("/api/admin/blocked-ips"), {
        method: "DELETE",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ key: b.key }),
      });
      setBlocks(prev => prev.filter(x => x.key !== b.key));
      toast({ title: `Unblocked ${b.ip}` });
    } catch {
      toast({ title: `Failed to unblock ${b.ip}`, variant: "destructive" });
    } finally {
      setUnblocking(null);
    }
  };

  const alertSettings = alertSettingsQ.data;
  const hasAlertConfig = !!(alertSettings?.discordWebhookUrl || alertSettings?.alertEmail);

  const SECTIONS = [
    { id: "feed",    label: "Threat Feed",    icon: ShieldAlert, badge: events.filter(e => !e.resolvedAt).length },
    { id: "sharing", label: "Code Sharing",   icon: Network,     badge: codeSharingEvents.length },
    { id: "vpn",     label: "VPN Flags",      icon: ServerCrash, badge: vpnEvents.length },
    { id: "bans",    label: "IP Bans",        icon: Ban,         badge: bans.length },
    { id: "rate",    label: "Rate Blocks",    icon: ShieldOff,   badge: blocks.length },
    { id: "alerts",  label: "Alert Config",   icon: Bell,        badge: hasAlertConfig ? 1 : 0 },
  ] as const;

  return (
    <div className="space-y-5">
      {/* Aether Header */}
      <div className="flex items-center gap-2 pb-1 border-b border-white/5">
        <div className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
          <Radar className="w-4 h-4 text-red-400" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-bold text-white">Aether Intelligence Center</p>
          <p className="text-[9px] text-zinc-600 uppercase tracking-widest">Security Operations — Opti Gods</p>
        </div>
        <button
          data-testid="button-refresh-security"
          onClick={refresh}
          className="p-1.5 rounded hover:bg-white/5 text-zinc-600 hover:text-zinc-300 transition-colors"
          title="Refresh all"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", (statsQ.isFetching || eventsQ.isFetching) && "animate-spin")} />
        </button>
      </div>

      {/* Threat Score + Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ThreatGauge score={stats.threatScore} />
          <div className="grid grid-cols-2 gap-2 sm:col-span-2">
            {[
              { label: "Flags Today",     value: stats.flagsToday,       icon: Flag,         color: "text-red-400",     testId: "stat-flags-today" },
              { label: "Active Bans",     value: stats.activeBans,       icon: Ban,          color: "text-orange-400",  testId: "stat-active-bans" },
              { label: "Suspicious Codes",value: stats.suspiciousCodes,  icon: AlertTriangle,color: "text-amber-400",   testId: "stat-suspicious-codes" },
              { label: "Countries",       value: stats.countriesSeen,    icon: Globe,        color: "text-blue-400",    testId: "stat-countries" },
              {
                label: `Total Auto-Resolved${stats.autoResolveRunCount > 0 ? ` · ${stats.autoResolveRunCount} run${stats.autoResolveRunCount !== 1 ? "s" : ""}` : ""}`,
                value: stats.totalAutoResolved,
                icon: CheckCircle2,
                color: "text-emerald-400",
                testId: "stat-total-auto-resolved",
              },
            ].map(s => (
              <div key={s.label} data-testid={s.testId} className="bg-zinc-900/70 border border-white/5 rounded-xl p-3 flex items-center gap-2.5">
                <s.icon className={cn("w-4 h-4 shrink-0", s.color)} />
                <div>
                  <p className="text-lg font-bold font-display text-white">{s.value}</p>
                  <p className="text-[9px] text-zinc-600 uppercase tracking-wider">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section tabs */}
      <div className="flex gap-1 flex-wrap">
        {SECTIONS.map(s => (
          <button
            key={s.id}
            data-testid={`button-security-section-${s.id}`}
            onClick={() => setActiveSection(s.id)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
              activeSection === s.id
                ? "bg-red-500/15 text-red-400 border border-red-500/20"
                : "text-zinc-600 hover:text-zinc-300 hover:bg-white/5 border border-transparent"
            )}
          >
            <s.icon className="w-3 h-3" />
            {s.label}
            {s.badge > 0 && (
              <span className={cn("px-1 rounded text-[8px]", activeSection === s.id ? "bg-red-500/30 text-red-300" : "bg-zinc-800 text-zinc-500")}>
                {s.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Threat Feed ── */}
      {activeSection === "feed" && (
        <div className="space-y-2">
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest">Recent security events — newest first</p>
          {stats && stats.lastAutoResolved > 0 && (
            <div data-testid="text-auto-resolved-notice" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/8 border border-emerald-500/15 text-emerald-500 text-[10px]">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>
                Auto-resolved <strong>{stats.lastAutoResolved}</strong> stale low/medium event{stats.lastAutoResolved !== 1 ? "s" : ""} older than {stats.autoResolveWindowDays} days
                {stats.lastAutoResolvedAt ? ` · ${timeAgo(stats.lastAutoResolvedAt)}` : ""}
              </span>
            </div>
          )}
          {eventsQ.isLoading ? (
            <div className="p-8 text-center text-xs text-zinc-600 animate-pulse">Loading threat feed…</div>
          ) : feedEvents.length === 0 ? (
            <div className="p-10 text-center rounded-xl border border-white/5 bg-zinc-900/30">
              <ShieldCheck className="w-7 h-7 text-emerald-600 mx-auto mb-2" />
              <p className="text-xs text-zinc-500 font-bold">No threats detected</p>
              <p className="text-[10px] text-zinc-700 mt-1">All clear — no security events on record.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-white/5 overflow-hidden divide-y divide-white/5">
              {feedEvents.map(e => (
                <div key={e.id} data-testid={`row-event-${e.id}`} className={cn("px-3 py-3 flex items-start gap-3", e.resolvedAt ? "opacity-40" : "")}>
                  <div className="shrink-0 mt-0.5">{typeBadge(e.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {severityBadge(e.severity)}
                      <span className="text-[10px] font-mono text-zinc-400">{e.ip}</span>
                      {e.country && (
                        <span className="text-[10px] text-zinc-600 flex items-center gap-1">
                          {countryFlag(e.country) && <span className="text-sm leading-none">{countryFlag(e.country)}</span>}
                          {e.country}
                        </span>
                      )}
                      {e.codeRef && <span className="text-[10px] font-mono text-zinc-600">· {e.codeRef}</span>}
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed">{e.details}</p>
                    <p className="text-[9px] text-zinc-700 mt-0.5">{timeAgo(e.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!e.resolvedAt && (
                      <>
                        <button
                          data-testid={`button-resolve-event-${e.id}`}
                          onClick={() => resolveEvent(e.id)}
                          disabled={resolving === e.id}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-bold hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          {resolving === e.id ? "…" : "Resolve"}
                        </button>
                        <button
                          data-testid={`button-ban-event-ip-${e.id}`}
                          onClick={() => setBanForm({ ip: e.ip, reason: e.details.slice(0, 100), permanent: false })}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[9px] font-bold hover:bg-red-500/20 transition-colors"
                        >
                          <Ban className="w-3 h-3" />
                          Ban IP
                        </button>
                      </>
                    )}
                    {e.resolvedAt && <span className="text-[9px] text-emerald-600 font-bold">RESOLVED</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Code Sharing ── */}
      {activeSection === "sharing" && (
        <div className="space-y-2">
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest">Codes used from multiple IPs — possible sharing</p>
          {codeSharingEvents.length === 0 ? (
            <div className="p-10 text-center rounded-xl border border-white/5 bg-zinc-900/30">
              <ShieldCheck className="w-7 h-7 text-emerald-600 mx-auto mb-2" />
              <p className="text-xs text-zinc-500 font-bold">No sharing detected</p>
              <p className="text-[10px] text-zinc-700 mt-1">All codes are clean so far.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-white/5 overflow-hidden divide-y divide-white/5">
              {codeSharingEvents.map(e => (
                <div key={e.id} className="px-3 py-3 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {severityBadge(e.severity)}
                    {e.codeRef && <span className="text-xs font-mono font-bold text-red-400">{e.codeRef}</span>}
                    <span className="text-[10px] text-zinc-500">{timeAgo(e.createdAt)}</span>
                  </div>
                  <p className="text-[10px] text-zinc-400 leading-relaxed">{e.details}</p>
                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={() => resolveEvent(e.id)}
                      disabled={resolving === e.id}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-bold hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3 h-3" />Resolve
                    </button>
                    <button
                      onClick={() => setBanForm({ ip: e.ip, reason: `Code sharing: ${e.codeRef}`, permanent: false })}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[9px] font-bold hover:bg-red-500/20 transition-colors"
                    >
                      <Ban className="w-3 h-3" />Ban IP
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── VPN Flags ── */}
      {activeSection === "vpn" && (
        <div className="space-y-2">
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest">Redemptions via VPN or datacenter IPs</p>
          {vpnEvents.length === 0 ? (
            <div className="p-10 text-center rounded-xl border border-white/5 bg-zinc-900/30">
              <ShieldCheck className="w-7 h-7 text-emerald-600 mx-auto mb-2" />
              <p className="text-xs text-zinc-500 font-bold">No VPN activity</p>
            </div>
          ) : (
            <div className="rounded-xl border border-white/5 overflow-hidden divide-y divide-white/5">
              {vpnEvents.map(e => (
                <div key={e.id} className="px-3 py-3 flex items-start gap-3">
                  <div className="shrink-0 mt-0.5">{severityBadge(e.severity)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-zinc-400">{e.ip}</span>
                      {e.country && (
                        <span className="text-[10px] text-zinc-600 flex items-center gap-1">
                          {countryFlag(e.country) && <span className="text-sm leading-none">{countryFlag(e.country)}</span>}
                          {e.country}
                        </span>
                      )}
                      {e.codeRef && <span className="text-[10px] font-mono text-zinc-600">· {e.codeRef}</span>}
                    </div>
                    {e.isp && <p className="text-[9px] text-violet-400 mt-0.5">ISP: {e.isp}</p>}
                    <p className="text-[9px] text-zinc-700 mt-0.5">{timeAgo(e.createdAt)}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => resolveEvent(e.id)}
                      disabled={resolving === e.id}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-bold hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3 h-3" />OK
                    </button>
                    <button
                      onClick={() => setBanForm({ ip: e.ip, reason: `VPN usage: ${e.isp ?? "unknown ISP"}`, permanent: false })}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[9px] font-bold hover:bg-red-500/20 transition-colors"
                    >
                      <Ban className="w-3 h-3" />Ban
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── IP Bans ── */}
      {activeSection === "bans" && (
        <div className="space-y-2">
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest">Persistent IP bans — survive server restarts</p>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              data-testid="button-manual-ban-ip"
              onClick={() => setBanForm({ ip: "", reason: "", permanent: false })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold hover:bg-red-500/20 transition-colors"
            >
              <Plus className="w-3 h-3" />Ban IP Manually
            </button>
            <button
              data-testid="button-manual-flag-event"
              onClick={() => setManualFlagOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold hover:bg-amber-500/20 transition-colors"
            >
              <Flag className="w-3 h-3" />Manually Flag Event
            </button>
          </div>
          {bans.length === 0 ? (
            <div className="p-8 text-center rounded-xl border border-white/5 bg-zinc-900/30">
              <ShieldCheck className="w-7 h-7 text-emerald-600 mx-auto mb-2" />
              <p className="text-xs text-zinc-500 font-bold">No banned IPs</p>
            </div>
          ) : (
            <div className="rounded-xl border border-white/5 overflow-hidden divide-y divide-white/5">
              {bans.map(b => (
                <div key={b.id} data-testid={`row-ban-${b.ip}`} className="flex items-center gap-3 px-3 py-3">
                  <div className={cn("w-2 h-2 rounded-full shrink-0", b.permanent ? "bg-red-500 ring-2 ring-red-500/20" : "bg-amber-500 ring-2 ring-amber-500/20")} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-white font-mono">{b.ip}</p>
                      {b.permanent && <span className="text-[8px] font-bold bg-red-500/20 text-red-400 px-1 py-0.5 rounded uppercase">PERMANENT</span>}
                    </div>
                    <p className="text-[10px] text-zinc-600 truncate">{b.reason}</p>
                    <p className="text-[9px] text-zinc-700">{timeAgo(b.bannedAt)}</p>
                  </div>
                  <button
                    data-testid={`button-unban-${b.ip}`}
                    onClick={() => unbanIp(b.ip)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-bold hover:bg-emerald-500/20 transition-colors"
                  >
                    <Shield className="w-3 h-3" />Unban
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Rate Blocks ── */}
      {activeSection === "rate" && (
        <div className="space-y-2">
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest">Temporary rate-limit blocks (in-memory, reset on restart)</p>
          {blocksLoading ? (
            <div className="p-8 text-center text-xs text-zinc-600 animate-pulse">Checking for blocks…</div>
          ) : blocks.length === 0 ? (
            <div className="p-10 text-center rounded-xl border border-white/5 bg-zinc-900/30">
              <ShieldOff className="w-7 h-7 text-zinc-700 mx-auto mb-2" />
              <p className="text-xs text-zinc-500 font-bold">No rate-limit blocks</p>
            </div>
          ) : (
            <div className="rounded-xl border border-white/5 overflow-hidden divide-y divide-white/5">
              {blocks.map(b => (
                <div key={b.key} data-testid={`row-block-${b.ip}`} className="flex items-center gap-3 px-3 py-3">
                  <div className="w-2 h-2 rounded-full bg-red-500 ring-2 ring-red-500/20 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white font-mono">{b.ip}</p>
                    <p className="text-[10px] text-zinc-600 truncate">
                      {b.path} · <span className="text-amber-500">{b.minutesLeft}m left</span>
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      data-testid={`button-unblock-${b.ip}`}
                      onClick={() => unblockRate(b)}
                      disabled={unblocking === b.key}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-bold hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                    >
                      <Shield className="w-3 h-3" />{unblocking === b.key ? "…" : "Unblock"}
                    </button>
                    <button
                      onClick={() => setBanForm({ ip: b.ip, reason: `Rate-limit abuse on ${b.path}`, permanent: false })}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[9px] font-bold hover:bg-red-500/20 transition-colors"
                    >
                      <Ban className="w-3 h-3" />Ban
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Alert Config ── */}
      {activeSection === "alerts" && (
        <div className="space-y-4">
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest">Critical event notifications — push alerts when severity=critical is logged</p>

          {alertSettingsQ.isLoading ? (
            <div className="p-6 text-center text-xs text-zinc-600 animate-pulse">Loading settings…</div>
          ) : (
            <div className="space-y-4">
              {/* Current config display */}
              <div className="bg-zinc-900/70 border border-white/5 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Bell className="w-3.5 h-3.5 text-amber-400" />
                  <p className="text-xs font-bold text-white">Active Alert Channels</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", alertSettings?.discordWebhookUrl ? "bg-emerald-500" : "bg-zinc-700")} />
                      <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Discord Webhook</span>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {alertSettings?.discordWebhookUrl ? alertSettings.discordWebhookUrl.replace(/\/[^/]+$/, "/…") : "not configured"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", alertSettings?.alertEmail ? "bg-emerald-500" : "bg-zinc-700")} />
                      <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Alert Email</span>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {alertSettings?.alertEmail || "not configured"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Auto-resolve After</span>
                    </div>
                    <span data-testid="text-auto-resolve-days" className="text-[10px] text-zinc-500 font-mono">
                      {alertSettings?.autoResolveDays ?? 30} days
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Next Auto-resolve</span>
                    </div>
                    <span data-testid="text-next-auto-resolve" className="text-[10px] text-zinc-500 font-mono">
                      {stats ? timeUntil(stats.nextAutoResolveAt) : "—"}
                    </span>
                  </div>
                </div>
                {!hasAlertConfig && (
                  <div className="flex items-start gap-2 pt-1 mt-1 border-t border-white/5">
                    <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-amber-400/80">No alert channels configured. Critical events will only appear in this panel.</p>
                  </div>
                )}
              </div>

              {/* Edit form */}
              {alertForm === null && (
                <div className="flex flex-wrap gap-2">
                  <button
                    data-testid="button-edit-alert-settings"
                    onClick={() => setAlertForm({
                      discordWebhookUrl: alertSettings?.discordWebhookUrl ?? "",
                      alertEmail: alertSettings?.alertEmail ?? "",
                      autoResolveDays: String(alertSettings?.autoResolveDays ?? 30),
                      alertOnNewRig: alertSettings?.alertOnNewRig ?? true,
                      alertOnNewNvidiaDriver: alertSettings?.alertOnNewNvidiaDriver ?? true,
                      auditLogEnabled: alertSettings?.auditLogEnabled ?? false,
                      auditWebhookUrl: alertSettings?.auditWebhookUrl ?? "",
                    })}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-zinc-300 text-xs font-bold hover:bg-white/10 transition-colors"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    Edit Alert Settings
                  </button>
                  <button
                    data-testid="button-run-auto-resolve"
                    disabled={runningAutoResolve || loadingAutoResolvePreview}
                    onClick={async () => {
                      setLoadingAutoResolvePreview(true);
                      try {
                        const r = await fetch(apiUrl("/api/admin/security/auto-resolve/preview"), { headers });
                        if (!r.ok) throw new Error("Preview failed");
                        const data: { count: number; days: number } = await r.json();
                        setAutoResolvePreview(data);
                      } catch {
                        toast({ title: "Preview failed", description: "Could not fetch event count. Try again.", variant: "destructive" });
                      } finally {
                        setLoadingAutoResolvePreview(false);
                      }
                    }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-300 text-xs font-bold hover:bg-blue-600/30 transition-colors disabled:opacity-50"
                  >
                    <PlayCircle className="w-3.5 h-3.5" />
                    {loadingAutoResolvePreview ? "Checking…" : "Run Auto-resolve Now"}
                  </button>
                  <button
                    data-testid="button-poll-nvidia-drivers"
                    disabled={pollingDrivers}
                    onClick={async () => {
                      setPollingDrivers(true);
                      try {
                        const r = await fetch(apiUrl("/api/admin/nvidia-drivers/poll"), { method: "POST", headers });
                        if (!r.ok) throw new Error("Poll failed");
                        const data: { fetched: number; inserted: number; alerted: number; errors: string[] } = await r.json();
                        toast({
                          title: "NVIDIA poll complete",
                          description: `${data.fetched} fetched · ${data.inserted} new · ${data.alerted} alert${data.alerted !== 1 ? "s" : ""} sent${data.errors.length ? ` · ${data.errors.length} error(s)` : ""}`,
                        });
                      } catch (e) {
                        toast({ title: "NVIDIA poll failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
                      } finally {
                        setPollingDrivers(false);
                      }
                    }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold hover:bg-emerald-600/30 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={cn("w-3.5 h-3.5", pollingDrivers && "animate-spin")} />
                    {pollingDrivers ? "Polling…" : "Poll NVIDIA Drivers Now"}
                  </button>
                </div>
              )}

              {/* Auto-resolve confirmation dialog */}
              {autoResolvePreview !== null && (
                <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <p className="text-xs text-amber-300 font-bold mb-1">Confirm Auto-resolve</p>
                  <p className="text-[11px] text-zinc-400 mb-3">
                    This will resolve{" "}
                    <span className="text-white font-bold">{autoResolvePreview.count} low/medium event{autoResolvePreview.count !== 1 ? "s" : ""}</span>{" "}
                    older than{" "}
                    <span className="text-white font-bold">{autoResolvePreview.days} days</span>.
                    {autoResolvePreview.count === 0 && " No events currently match — running anyway will be a no-op."}
                    {" "}This cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <button
                      data-testid="button-confirm-auto-resolve"
                      disabled={runningAutoResolve}
                      onClick={async () => {
                        setAutoResolvePreview(null);
                        setRunningAutoResolve(true);
                        try {
                          const r = await fetch(apiUrl("/api/admin/security/auto-resolve"), {
                            method: "POST",
                            headers,
                          });
                          if (!r.ok) throw new Error("Request failed");
                          const data: { resolved: number; days: number } = await r.json();
                          refresh();
                          if (data.resolved > 0) {
                            toast({
                              title: "Auto-resolve complete",
                              description: `Resolved ${data.resolved} stale low/medium event${data.resolved !== 1 ? "s" : ""} older than ${data.days} days.`,
                            });
                          } else {
                            toast({ title: "Auto-resolve complete", description: "No events matched the auto-resolve threshold." });
                          }
                        } catch {
                          toast({ title: "Auto-resolve failed", description: "Could not run the job. Try again.", variant: "destructive" });
                        } finally {
                          setRunningAutoResolve(false);
                        }
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-600/30 border border-amber-500/40 text-amber-200 text-xs font-bold hover:bg-amber-600/50 transition-colors disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {runningAutoResolve ? "Running…" : "Confirm"}
                    </button>
                    <button
                      data-testid="button-cancel-auto-resolve"
                      onClick={() => setAutoResolvePreview(null)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-zinc-400 text-xs font-bold hover:bg-white/10 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Auto-resolve run history */}
              {stats && stats.autoResolveHistory && stats.autoResolveHistory.length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/5">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Run History (last {stats.autoResolveHistory.length})</p>
                  <div className="space-y-1" data-testid="list-auto-resolve-history">
                    {stats.autoResolveHistory.map((run, i) => (
                      <div
                        key={run.id}
                        data-testid={`row-auto-resolve-run-${run.id}`}
                        className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-zinc-900/50 border border-white/5"
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${i === 0 ? "bg-emerald-500" : "bg-zinc-600"}`} />
                          <span className="text-[10px] text-zinc-400 font-mono">
                            {run.resolvedCount > 0
                              ? <><span className="text-emerald-400 font-bold">{run.resolvedCount}</span> resolved</>
                              : <span className="text-zinc-600">0 resolved</span>
                            }
                          </span>
                          <span className="text-[9px] text-zinc-600 font-mono">· {run.windowDays}d window</span>
                        </div>
                        <span className="text-[9px] text-zinc-600 font-mono">
                          {run.ranAt ? timeAgo(run.ranAt) : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {alertForm !== null && (
                <div className="bg-zinc-900/70 border border-white/5 rounded-xl p-4 space-y-3">
                  <p className="text-[10px] font-bold text-white uppercase tracking-wider mb-2">Configure Alerts</p>

                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Discord Webhook URL</label>
                    <input
                      data-testid="input-discord-webhook"
                      value={alertForm.discordWebhookUrl}
                      onChange={e => setAlertForm(f => f ? { ...f, discordWebhookUrl: e.target.value } : f)}
                      placeholder="https://discord.com/api/webhooks/..."
                      className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-950 border border-white/10 text-xs text-white font-mono placeholder:text-zinc-700 focus:outline-none focus:border-violet-500/50"
                    />
                    <p className="text-[9px] text-zinc-600 mt-1">Go to Discord channel → Edit Channel → Integrations → Webhooks → New Webhook → Copy URL</p>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Alert Email Address</label>
                    <input
                      data-testid="input-alert-email"
                      value={alertForm.alertEmail}
                      onChange={e => setAlertForm(f => f ? { ...f, alertEmail: e.target.value } : f)}
                      placeholder="you@example.com"
                      type="email"
                      className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-950 border border-white/10 text-xs text-white font-mono placeholder:text-zinc-700 focus:outline-none focus:border-amber-500/50"
                    />
                    <p className="text-[9px] text-zinc-600 mt-1">Requires EMAIL_USER and EMAIL_PASS env vars configured for email delivery</p>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Auto-resolve After (days)</label>
                    <input
                      data-testid="input-auto-resolve-days"
                      value={alertForm.autoResolveDays}
                      onChange={e => setAlertForm(f => f ? { ...f, autoResolveDays: e.target.value } : f)}
                      placeholder="30"
                      type="number"
                      min={1}
                      max={365}
                      className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-950 border border-white/10 text-xs text-white font-mono placeholder:text-zinc-700 focus:outline-none focus:border-blue-500/50"
                    />
                    <p className="text-[9px] text-zinc-600 mt-1">Unresolved low/medium severity events older than this will be resolved automatically by the daily job (1–365 days)</p>
                  </div>

                  {/* Audit log toggle (Task #39) */}
                  <div className="pt-2 mt-2 border-t border-white/5 space-y-2">
                    <p className="text-[10px] font-bold text-white uppercase tracking-wider">Discord Audit Log</p>
                    <label className="flex items-start gap-3 px-3 py-2 rounded-lg bg-zinc-950 border border-white/10 cursor-pointer hover:bg-zinc-900/60 transition-colors">
                      <input
                        data-testid="toggle-auditLogEnabled"
                        type="checkbox"
                        checked={alertForm.auditLogEnabled}
                        onChange={e => setAlertForm(f => f ? { ...f, auditLogEnabled: e.target.checked } : f)}
                        className="mt-0.5 accent-violet-500 w-4 h-4 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-zinc-200">Post every applied tweak to Discord</p>
                        <p className="text-[9px] text-zinc-500 mt-0.5">When enabled, every script download / undo / restore fires a webhook to the channel below. Separate from the security alerts channel.</p>
                      </div>
                    </label>
                    <div>
                      <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Audit Webhook URL</label>
                      <input
                        data-testid="input-audit-webhook"
                        value={alertForm.auditWebhookUrl}
                        onChange={e => setAlertForm(f => f ? { ...f, auditWebhookUrl: e.target.value } : f)}
                        placeholder="https://discord.com/api/webhooks/..."
                        className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-950 border border-white/10 text-xs text-white font-mono placeholder:text-zinc-700 focus:outline-none focus:border-violet-500/50 disabled:opacity-50"
                        disabled={!alertForm.auditLogEnabled}
                      />
                      <p className="text-[9px] text-zinc-600 mt-1">Required when audit log is enabled. Use a separate Discord channel to avoid spamming your security alerts.</p>
                    </div>
                  </div>

                  {/* Aether intelligence toggles (Task #36) */}
                  <div className="pt-2 mt-2 border-t border-white/5 space-y-2">
                    <p className="text-[10px] font-bold text-white uppercase tracking-wider">Aether Intelligence Alerts</p>
                    {[
                      { key: "alertOnNewRig" as const, label: "Alert on new rig", help: "Discord + email ping when a fresh hardware scan posts a never-seen rig" },
                      { key: "alertOnNewNvidiaDriver" as const, label: "Alert on new NVIDIA driver", help: "Daily poller fires once per newly-released NVIDIA driver version" },
                    ].map(t => (
                      <label key={t.key} className="flex items-start gap-3 px-3 py-2 rounded-lg bg-zinc-950 border border-white/10 cursor-pointer hover:bg-zinc-900/60 transition-colors">
                        <input
                          data-testid={`toggle-${t.key}`}
                          type="checkbox"
                          checked={alertForm[t.key]}
                          onChange={e => setAlertForm(f => f ? { ...f, [t.key]: e.target.checked } : f)}
                          className="mt-0.5 accent-violet-500 w-4 h-4 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-zinc-200">{t.label}</p>
                          <p className="text-[9px] text-zinc-500 mt-0.5">{t.help}</p>
                        </div>
                      </label>
                    ))}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setAlertForm(null)}
                      className="flex-1 px-3 py-2 rounded-lg bg-zinc-800 text-zinc-400 text-xs font-bold hover:bg-zinc-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      data-testid="button-save-alert-settings"
                      disabled={savingAlerts}
                      onClick={async () => {
                        setSavingAlerts(true);
                        try {
                          const parsedDays = parseInt(alertForm.autoResolveDays, 10);
                          if (isNaN(parsedDays) || parsedDays < 1 || parsedDays > 365) {
                            toast({ title: "Invalid value", description: "Auto-resolve days must be between 1 and 365.", variant: "destructive" });
                            setSavingAlerts(false);
                            return;
                          }
                          const body: Record<string, string | number | boolean | null> = {};
                          body.discordWebhookUrl = alertForm.discordWebhookUrl.trim() || null;
                          body.alertEmail = alertForm.alertEmail.trim() || null;
                          body.autoResolveDays = parsedDays;
                          body.alertOnNewRig = alertForm.alertOnNewRig;
                          body.alertOnNewNvidiaDriver = alertForm.alertOnNewNvidiaDriver;
                          body.auditLogEnabled = alertForm.auditLogEnabled;
                          body.auditWebhookUrl = alertForm.auditWebhookUrl.trim() || null;
                          if (alertForm.auditLogEnabled && !alertForm.auditWebhookUrl.trim()) {
                            toast({ title: "Audit webhook required", description: "Provide a Discord webhook URL when enabling the audit log.", variant: "destructive" });
                            setSavingAlerts(false);
                            return;
                          }
                          const r = await fetch(apiUrl("/api/admin/settings"), {
                            method: "POST",
                            headers: { ...headers, "Content-Type": "application/json" },
                            body: JSON.stringify(body),
                          });
                          if (!r.ok) {
                            const err = await r.json().catch(() => ({}));
                            throw new Error(err?.error ? JSON.stringify(err.error) : "Save failed");
                          }
                          await alertSettingsQ.refetch();
                          setAlertForm(null);
                          toast({ title: "Alert settings saved" });
                        } catch (e: unknown) {
                          toast({ title: "Failed to save", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
                        } finally {
                          setSavingAlerts(false);
                        }
                      }}
                      className="flex-1 px-3 py-2 rounded-lg bg-amber-600 text-white text-xs font-bold hover:bg-amber-500 transition-colors disabled:opacity-50"
                    >
                      {savingAlerts ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              )}

              {/* Info about deduplication */}
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-blue-500/8 border border-blue-500/15">
                <Shield className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] text-blue-300 font-bold">De-duplicated alerts</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">
                    Each security event only triggers one alert — re-detection of the same event will not send a second notification. Alerts fire on severity=critical events only.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Country breakdown (always visible when stats loaded) */}
      {stats && stats.topCountries.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-white/5">
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
            <Globe className="w-3 h-3" />Global Reach — Top Countries
          </p>
          <div className="space-y-1.5">
            {stats.topCountries.map((c, i) => {
              const max = stats.topCountries[0]?.count ?? 1;
              return (
                <div key={c.country} className="flex items-center gap-2">
                  <span className="text-[9px] text-zinc-600 w-4 text-right">{i + 1}</span>
                  <span className="text-[10px] text-zinc-400 w-24 truncate">{c.country}</span>
                  <div className="flex-1 bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full bg-red-500/60 rounded-full" style={{ width: `${(c.count / max) * 100}%` }} />
                  </div>
                  <span className="text-[9px] text-zinc-500 w-6 text-right">{c.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Ban IP modal */}
      {banForm !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setBanForm(null)}>
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-5 w-full max-w-sm mx-4 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <Ban className="w-4 h-4 text-red-400" />
              <p className="text-sm font-bold text-white">Ban IP Address</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">IP Address</label>
                <input
                  data-testid="input-ban-ip"
                  value={banForm.ip}
                  onChange={e => setBanForm(f => f ? { ...f, ip: e.target.value } : f)}
                  className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 font-mono focus:outline-none focus:border-red-500/50"
                  placeholder="e.g. 192.168.1.100"
                />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Reason</label>
                <input
                  data-testid="input-ban-reason"
                  value={banForm.reason}
                  onChange={e => setBanForm(f => f ? { ...f, reason: e.target.value } : f)}
                  className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-red-500/50"
                  placeholder="Code sharing, VPN abuse, etc."
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  data-testid="checkbox-ban-permanent"
                  type="checkbox"
                  checked={banForm.permanent}
                  onChange={e => setBanForm(f => f ? { ...f, permanent: e.target.checked } : f)}
                  className="accent-red-500"
                />
                <span className="text-xs text-zinc-400">Permanent ban (no expiry)</span>
              </label>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setBanForm(null)}
                className="flex-1 px-3 py-2 rounded-lg bg-zinc-800 text-zinc-400 text-xs font-bold hover:bg-zinc-700 transition-colors"
              >Cancel</button>
              <button
                data-testid="button-confirm-ban"
                onClick={() => banIp(banForm.ip, banForm.reason, banForm.permanent)}
                disabled={!banForm.ip || !banForm.reason || banning === banForm.ip}
                className="flex-1 px-3 py-2 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-500 transition-colors disabled:opacity-50"
              >
                {banning === banForm.ip ? "Banning…" : "Ban IP"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Flag modal */}
      {manualFlagOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setManualFlagOpen(false)}>
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-5 w-full max-w-sm mx-4 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <Flag className="w-4 h-4 text-amber-400" />
              <p className="text-sm font-bold text-white">Manually Flag Security Event</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">IP Address</label>
                <input
                  data-testid="input-flag-ip"
                  value={manualFlag.ip}
                  onChange={e => setManualFlag(m => ({ ...m, ip: e.target.value }))}
                  placeholder="123.45.67.89"
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-950 border border-white/10 text-xs text-white font-mono placeholder:text-zinc-700 focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Code (optional)</label>
                <input
                  data-testid="input-flag-code"
                  value={manualFlag.codeRef}
                  onChange={e => setManualFlag(m => ({ ...m, codeRef: e.target.value }))}
                  placeholder="ABCD1234"
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-950 border border-white/10 text-xs text-white font-mono placeholder:text-zinc-700 focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Severity</label>
                <select
                  data-testid="select-flag-severity"
                  value={manualFlag.severity}
                  onChange={e => {
                    const v = e.target.value;
                    if (v === "low" || v === "medium" || v === "high" || v === "critical") {
                      setManualFlag(m => ({ ...m, severity: v }));
                    }
                  }}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-950 border border-white/10 text-xs text-white focus:outline-none focus:border-amber-500/50"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Details</label>
                <textarea
                  data-testid="input-flag-details"
                  value={manualFlag.details}
                  onChange={e => setManualFlag(m => ({ ...m, details: e.target.value }))}
                  placeholder="What happened? Why are you flagging this?"
                  rows={3}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-950 border border-white/10 text-xs text-white placeholder:text-zinc-700 focus:outline-none focus:border-amber-500/50 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setManualFlagOpen(false)}
                className="flex-1 px-3 py-2 rounded-lg bg-zinc-800 text-zinc-400 text-xs font-bold hover:bg-zinc-700 transition-colors"
              >Cancel</button>
              <button
                data-testid="button-confirm-flag"
                disabled={!manualFlag.ip || !manualFlag.details || flagging}
                onClick={async () => {
                  setFlagging(true);
                  try {
                    const r = await fetch(apiUrl("/api/admin/security/flag"), {
                      method: "POST",
                      headers: { ...headers, "Content-Type": "application/json" },
                      body: JSON.stringify(manualFlag),
                    });
                    if (!r.ok) throw new Error("flag failed");
                    setManualFlagOpen(false);
                    setManualFlag({ ip: "", codeRef: "", details: "", severity: "medium" });
                    refresh();
                    toast({ title: "Event flagged", description: "Added to threat feed" });
                  } catch {
                    toast({ title: "Failed to flag event", variant: "destructive" });
                  } finally {
                    setFlagging(false);
                  }
                }}
                className="flex-1 px-3 py-2 rounded-lg bg-amber-600 text-white text-xs font-bold hover:bg-amber-500 transition-colors disabled:opacity-50"
              >
                {flagging ? "Flagging…" : "Flag Event"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Admin Preset Generator ─────────────────────────────────────────────────
// V2.2 — response shape from /api/ai/preset (canonical buildSafePreset).
type SafePresetResponse = {
  profile: string;
  goal: string;
  hardwareSummary: string;
  core: string[];
  expert: string[];
  blocked: { id: string; reason: string }[];
  reasons: string[];
};

// Infer CPU brand, thread count, generation, and Ryzen model from a typed CPU name
function parseCpuModel(model: string): { brand: "intel" | "amd"; threads: number; cores: number; generation: number; cpuLabel: string; isRyzen: boolean; isIntelCore: boolean } {
  const m = model.trim().toLowerCase();
  // Intel detection
  if (m.includes("intel") || /\bi[3579]-\d/.test(m) || m.includes("core ultra") || m.includes("pentium") || m.includes("celeron") || m.includes("xeon")) {
    let threads = 8;
    let generation = 0;
    // Match i3/i5/i7/i9-XYYY or i5-12600K style
    const match = m.match(/i[3579]-?(\d{4,5})/);
    if (match) {
      const num = match[1];
      generation = parseInt(num.slice(0, num.length - 3)) || 0;
      const tier = m.includes("i9") ? 4 : m.includes("i7") ? 3 : m.includes("i5") ? 2 : 1;
      if (generation >= 12) {
        // 12th+ gen has E-cores
        if (tier === 4) threads = 32; // i9-12900K = 24C/32T
        else if (tier === 3) threads = 20; // i7-12700K = 12C/20T
        else if (tier === 2) threads = 16; // i5-12600K = 10C/16T
        else threads = 8;
      } else if (generation >= 10) {
        if (tier === 4) threads = 20;
        else if (tier === 3) threads = 16;
        else if (tier === 2) threads = 12;
        else threads = 8;
      } else {
        if (tier === 4) threads = 16;
        else if (tier === 3) threads = 12;
        else if (tier === 2) threads = 8;
        else threads = 4;
      }
    }
    // Core Ultra
    if (m.includes("ultra 9")) threads = 24;
    else if (m.includes("ultra 7")) threads = 20;
    else if (m.includes("ultra 5")) threads = 14;
    const label = model.trim() || `Intel ${threads}T`;
    return { brand: "intel", threads, cores: Math.max(1, Math.floor(threads / 2)), generation, cpuLabel: label, isRyzen: false, isIntelCore: true };
  }
  // AMD Ryzen detection
  if (m.includes("ryzen") || m.includes("amd") || /r[3579]\s*\d{4}/.test(m) || m.includes("threadripper")) {
    let threads = 12;
    let cores = 6;
    let generation = 0;
    // Ryzen X 3000/5000/7000 — model number gives generation
    const genMatch = m.match(/ryzen\s*[3579]\s*(\d)(\d{3})/);
    if (genMatch) {
      generation = parseInt(genMatch[1]);
      const tier = m.includes("ryzen 9") ? 4 : m.includes("ryzen 7") ? 3 : m.includes("ryzen 5") ? 2 : 1;
      // 3500 = 6C/6T (no SMT), 5600 = 6C/12T, 5800X = 8C/16T, 5900X = 12C/24T, 5950X = 16C/32T
      if (m.includes("3500") || m.includes("3300")) { cores = 6; threads = 6; }
      else if (m.includes("5800")) { cores = 8; threads = 16; }
      else if (m.includes("5900")) { cores = 12; threads = 24; }
      else if (m.includes("5950")) { cores = 16; threads = 32; }
      else if (tier === 4) { cores = 12; threads = 24; }
      else if (tier === 3) { cores = 8; threads = 16; }
      else if (tier === 2) { cores = 6; threads = 12; }
      else { cores = 4; threads = 8; }
    }
    if (m.includes("threadripper")) threads = 64;
    const label = model.trim() || `AMD Ryzen ${threads}T`;
    return { brand: "amd", threads, generation, cpuLabel: label, isRyzen: true, isIntelCore: false, cores };
  }
  // Unknown — default
  return { brand: "intel", threads: 8, cores: 4, generation: 0, cpuLabel: model.trim() || "Unknown CPU", isRyzen: false, isIntelCore: true };
}

type PresetInitValues = { gpuVendor: "nvidia" | "amd" | "intel"; gpuName: string; cpuModel: string; cpuCores?: number; cpuThreads?: number; ramGb: number; osVersion: "win11" | "win10"; isLaptop: boolean };
type CustomerHW = {
  codeRef: string;
  gpuVendor: string | null;
  gpuName: string | null;
  cpuModel: string | null;
  cpuCores: number | null;
  cpuThreads: number | null;
  ramGb: number | null;
  osVersion: string | null;
  isLaptop: boolean | null;
  // Extended fields from native scan (hardware_rigs table)
  discordUsername?: string | null;
  source?: "hw" | "rig";
  lastSeenAt?: string | null;
  rigId?: number | null;
  seenCount?: number | null;
  motherboard?: string | null;
  vramMb?: number | null;
  ramMhz?: number | null;
  refreshHz?: number | null;
};

function AdminPresetGenerator({
  initialValues,
  allHardware = [],
  allCodes = [],
  apiKey = "",
}: {
  initialValues?: PresetInitValues;
  allHardware?: CustomerHW[];
  allCodes?: Array<{ code: string; note: string | null }>;
  apiKey?: string;
}) {
  const { toast } = useToast();
  const [gpuVendor, setGpuVendor] = useState<"nvidia" | "amd" | "intel">(initialValues?.gpuVendor ?? "nvidia");
  const [gpuName, setGpuName] = useState(initialValues?.gpuName ?? "");
  const [cpuModel, setCpuModel] = useState(initialValues?.cpuModel ?? "");
  const [ramGB, setRamGB] = useState(initialValues?.ramGb?.toString() ?? "16");
  const [osVersion, setOsVersion] = useState<"win11" | "win10">(initialValues?.osVersion ?? "win11");
  const [isLaptop, setIsLaptop] = useState(initialValues?.isLaptop ?? false);
  const [selectedUser, setSelectedUser] = useState<string | null>(initialValues ? null : null);
  const [hwSearch, setHwSearch] = useState("");
  // Actual core counts from WMI scan (override parseCpuModel estimates when available)
  const [actualCores, setActualCores] = useState(initialValues?.cpuCores ?? 0);
  const [actualThreads, setActualThreads] = useState(initialValues?.cpuThreads ?? 0);
  const [generated, setGenerated] = useState<{ name: string; tweakCount: number } | null>(null);
  const [fixGenerated, setFixGenerated] = useState<{ name: string; tweakCount: number } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generatingFix, setGeneratingFix] = useState(false);
  // V2.2 — server-resolved preset preview + admin opt-in selections
  const [safePreset, setSafePreset] = useState<SafePresetResponse | null>(null);
  const [adminOptInIds, setAdminOptInIds] = useState<Set<string>>(new Set());
  // Admin always gets full preset — all expert tweaks included by default
  const [includeAllExpert, setIncludeAllExpert] = useState(true);

  const loadUser = (hw: CustomerHW) => {
    setSelectedUser(hw.codeRef);
    if (hw.gpuVendor && ["nvidia","amd","intel"].includes(hw.gpuVendor)) setGpuVendor(hw.gpuVendor as "nvidia"|"amd"|"intel");
    if (hw.gpuName) setGpuName(hw.gpuName);
    if (hw.cpuModel) setCpuModel(hw.cpuModel);
    if (hw.ramGb) setRamGB(String(hw.ramGb));
    if (hw.osVersion && ["win11","win10"].includes(hw.osVersion)) setOsVersion(hw.osVersion as "win11"|"win10");
    if (hw.isLaptop !== null) setIsLaptop(hw.isLaptop);
    setActualCores(hw.cpuCores ?? 0);
    setActualThreads(hw.cpuThreads ?? 0);
    setGenerated(null);
    setFixGenerated(null);
  };

  const filteredHW = allHardware.filter(hw => {
    if (!hwSearch.trim()) return true;
    const q = hwSearch.toLowerCase();
    const label = allCodes.find(c => c.code === hw.codeRef)?.note || hw.codeRef;
    return label.toLowerCase().includes(q)
      || (hw.gpuName || "").toLowerCase().includes(q)
      || (hw.cpuModel || "").toLowerCase().includes(q)
      || hw.codeRef.toLowerCase().includes(q);
  });

  const buildFakeHW = (): HardwareInfo => {
    const cpu = parseCpuModel(cpuModel);
    // Use actual WMI-scanned thread/core counts when available — far more accurate than estimates
    const cores = actualThreads > 0 ? actualThreads : cpu.threads;
    const physCores = actualCores > 0 ? actualCores : cpu.cores;
    const ram = parseInt(ramGB) || 16;
    const isNvidia = gpuVendor === "nvidia";
    const isAmdGpu = gpuVendor === "amd";
    const isAmdApu = gpuVendor === "amd" && isLaptop && ram <= 16;
    const isIntel = gpuVendor === "intel";
    const isAMD = isAmdGpu || isAmdApu;
    const gpuNameLower = gpuName.toLowerCase();
    const nvidiaIsRTX = isNvidia && (gpuNameLower.includes("rtx") || gpuNameLower.includes(" 30") || gpuNameLower.includes(" 40") || gpuNameLower.includes(" 50"));
    const nvidiaIsLowEnd = isNvidia && !nvidiaIsRTX;
    const gpuLabel = gpuName || (isNvidia ? "NVIDIA GPU" : isAmdGpu ? "AMD GPU" : "Intel GPU");
    const ramLabel = `${ram}GB`;
    return {
      loading: false, scanned: true,
      gpuName: gpuLabel, gpuVendor: gpuVendor,
      cpuLabel: cpu.cpuLabel, cpuCores: cores, cpuPhysicalCores: physCores,
      ramGB: ram, ramLabel, ramNote: "",
      isNvidia, isAmdGpu, isAmdApu, isAMD, isIntel, isLaptop,
      isAmd: isAMD,
      nvidiaIsRTX, nvidiaIsLowEnd,
      cpuBrand: cpu.brand, isRyzen: cpu.isRyzen, isIntelCore: cpu.isIntelCore,
      cpuGeneration: cpu.generation,
      resolution: "1920x1080",
      gpus: [],
      hasIntegratedGpu: isIntel || isAmdApu,
      hasDiscreteGpu: isNvidia || isAmdGpu,
      isHybridGpu: false,
      systemModel: "",
      ramMhz: 0,
    } as HardwareInfo;
  };

  const buildFakeOS = (): OsInfo => {
    return {
      loading: false,
      os: osVersion === "win11" ? "Windows 11 Pro (23H2)" : "Windows 10 Pro (22H2)",
      displayName: osVersion === "win11" ? "Windows 11 Pro (23H2)" : "Windows 10 Pro (22H2)",
      isWindows: true,
      isWindows11: osVersion === "win11",
      isWindows10: osVersion === "win10",
      build: osVersion === "win11" ? "22631" : "19045",
    } as OsInfo;
  };

  // V2.2 — buildSafePreset is the single canonical preset path. Admin previews
  // the structured response (core + red opt-in expert section) before downloading.
  // Generate preset, optionally with directly-supplied hw values (bypasses async state for load+generate)
  type DirectHW = { gpuVendor: "nvidia"|"amd"|"intel"; gpuName: string; cpuModel: string; ramGb: number; osVersion: "win11"|"win10"; isLaptop: boolean };

  const generateFromHW = async (hw: DirectHW) => {
    setGenerating(true);
    try {
      const cpu = parseCpuModel(hw.cpuModel);
      const safePresetRes = await fetch(apiUrl("/api/ai/preset"), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": apiKey },
        body: JSON.stringify({
          hardware: {
            gpuVendor: hw.gpuVendor,
            gpuName: hw.gpuName,
            cpuBrand: cpu.brand,
            cpuLabel: hw.cpuModel,
            cpuCores: cpu.threads,
            ramGB: hw.ramGb,
            osVersion: hw.osVersion,
            isLaptop: hw.isLaptop,
            hasDiscreteGpu: hw.gpuVendor === "nvidia" || hw.gpuVendor === "amd",
          },
          goal: "balanced",
          optInFlags: [],
        }),
      });
      if (!safePresetRes.ok) throw new Error("Preset build failed");
      const preset = (await safePresetRes.json()) as SafePresetResponse;
      setSafePreset(preset);
      // Pre-select all expert tweaks when includeAllExpert is on
      if (includeAllExpert) setAdminOptInIds(new Set(preset.expert));
      toast({ title: `Preset loaded — ${preset.core.length + (includeAllExpert ? preset.expert.length : 0)} tweaks ready`, description: "Review below, then hit Generate to download the .bat" });
    } catch (e) {
      toast({ title: "Auto-generate failed", description: String(e), variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const loadAndGenerate = (hw: CustomerHW) => {
    loadUser(hw);
    const vendor = (hw.gpuVendor && ["nvidia","amd","intel"].includes(hw.gpuVendor)) ? hw.gpuVendor as "nvidia"|"amd"|"intel" : "nvidia";
    generateFromHW({
      gpuVendor: vendor,
      gpuName: hw.gpuName || "",
      cpuModel: hw.cpuModel || "",
      ramGb: hw.ramGb || 16,
      osVersion: hw.osVersion === "win11" ? "win11" : "win10",
      isLaptop: hw.isLaptop || false,
    });
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const fakeHW = buildFakeHW();
      const fakeOS = buildFakeOS();

      // computeSmartRecs sweeps ALL TWEAK_REGISTRY entries via its catch-all pass,
      // giving the most comprehensive hardware-gated preset possible (600+ on some rigs).
      const recs = computeSmartRecs(fakeHW, fakeOS);
      const tweakMap: Record<string, boolean> = {};
      recs.ids.forEach(id => { tweakMap[id] = true; });

      // Include expert / risk tweaks when the admin "include all expert" toggle is on.
      if (includeAllExpert) {
        const expertCandidates = [
          "DisableMemoryCompression", "MemDisableCompression", "DisablePagefileEncryption",
          "DisableDefender", "SysHypervisorOff",
          ...(fakeOS.isWindows11 ? ["Win11DisableVBS", "Win11DisableHVCI"] : []),
          ...(fakeHW.isLaptop && fakeHW.isIntelCore ? ["Lap_Intel_DisableECores"] : []),
        ];
        expertCandidates.forEach(id => { tweakMap[id] = true; });
        // Also pull any expert IDs from the V2.2 safePreset preview if it was loaded.
        if (safePreset) safePreset.expert.forEach(id => { tweakMap[id] = true; });
      } else {
        adminOptInIds.forEach(id => { tweakMap[id] = true; });
      }

      // Belt-and-suspenders: merge safePreset core so server-resolved IDs aren't missed.
      if (safePreset) safePreset.core.forEach(id => { tweakMap[id] = true; });

      const tweakIds = Object.keys(tweakMap);

      const res = await fetch(apiUrl("/api/script/download-bat"), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": apiKey },
        body: JSON.stringify({ tweaks: tweakMap, nvidiaPreset: "Balanced" }),
      });

      if (!res.ok) throw new Error("Script generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `OptiGods_Custom_Preset.bat`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setGenerated({ name: recs.profile, tweakCount: tweakIds.length });
      toast({
        title: `Preset generated — ${tweakIds.length} tweaks`,
        description: `Send the .bat file to the user — they just double-click it.`,
      });
    } catch (e) {
      toast({ title: "Generation failed", description: String(e), variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateFix = async () => {
    setGeneratingFix(true);
    try {
      const fixTweaks = [
        "DisableCoreParking",
        "DisableHungAppDetection",
        "DisablePointerPrecision",
        "DisableAnimations",
        "SysVisualBestPerf",
        "DisableTelemetry",
        "DisableFastStartup",
        "DisableWindowsError",
        "SetHighPerformancePlan",
        "DisableUSBSuspend",
        "OptimizeRAMUsage",
        "MemDisableCompression",
        "MemTrimStandbyList",
        "ServiceDiagTrack",
        "ServiceSysMain",
        "PrivacyTelemetry",
        "PrivacyAdvertisingID",
        "PrivacyLocationTracking"
      ];
      const tweakMap: Record<string, boolean> = {};
      fixTweaks.forEach(id => { tweakMap[id] = true; });
      const res = await fetch(apiUrl("/api/script/download-bat"), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": apiKey },
        body: JSON.stringify({ tweaks: tweakMap, nvidiaPreset: "Balanced" }),
      });
      if (!res.ok) throw new Error("Fix generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `OptiGods_Fix_FPS_Drops.bat`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setFixGenerated({ name: "FPS Drop Fix", tweakCount: fixTweaks.length });
      toast({ title: "Fix generated", description: "Send the .bat fix file to the user." });
    } catch (e) {
      toast({ title: "Fix generation failed", description: String(e), variant: "destructive" });
    } finally {
      setGeneratingFix(false);
    }
  };

  const inputCls = "w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-red-500/50 transition-colors";
  const labelCls = "text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1 block";

  return (
    <div className="p-5 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
          <Sliders className="w-5 h-5 text-red-400" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-white">Custom Preset Generator</h2>
          <p className="text-xs text-zinc-500">Input a user's specs → downloads a hardware-optimized .bat script</p>
        </div>
      </div>

      {/* ── Detected Users List ──────────────────────────────────────── */}
      <div className="rounded-xl border border-white/8 bg-zinc-900/60 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-red-400" />
            <span className="text-[11px] font-black uppercase tracking-widest text-red-400">Detected Users</span>
            <span className="text-[10px] text-zinc-600 font-mono">({allHardware.length})</span>
          </div>
          {allHardware.length > 0 && selectedUser && (
            <button
              onClick={() => { setSelectedUser(null); }}
              className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              Clear selection
            </button>
          )}
        </div>

        {allHardware.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <Cpu className="w-6 h-6 text-zinc-700 mx-auto mb-2" />
            <p className="text-xs text-zinc-600 font-semibold">No hardware scans yet</p>
            <p className="text-[10px] text-zinc-700 mt-0.5">Customers need to drop their sysinfo.json to scan hardware</p>
          </div>
        ) : (
          <>
            <div className="px-3 py-2 border-b border-white/5">
              <div className="relative">
                <Search className="w-3 h-3 text-zinc-600 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by name, GPU, CPU…"
                  value={hwSearch}
                  onChange={e => setHwSearch(e.target.value)}
                  className="w-full bg-zinc-950/60 border border-zinc-800 rounded-lg pl-7 pr-3 py-1.5 text-xs text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-red-500/40 transition-colors"
                />
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-white/4">
              {filteredHW.length === 0 ? (
                <p className="text-[10px] text-zinc-600 px-4 py-3">No users match your search</p>
              ) : filteredHW.map(hw => {
                const codeData = allCodes.find(c => c.code === hw.codeRef);
                const label = codeData?.note?.split(" | stripe:")[0] || hw.codeRef;
                const isSelected = selectedUser === hw.codeRef;
                const vendorColor = hw.gpuVendor === "nvidia" ? "bg-green-500" : hw.gpuVendor === "amd" ? "bg-red-500" : "bg-blue-500";
                const vendorText = hw.gpuVendor === "nvidia" ? "text-green-400 border-green-500/30 bg-green-500/10" : hw.gpuVendor === "amd" ? "text-red-400 border-red-500/30 bg-red-500/10" : "text-blue-400 border-blue-500/30 bg-blue-500/10";
                return (
                  <button
                    key={hw.codeRef}
                    data-testid={`btn-load-user-${hw.codeRef}`}
                    onClick={() => loadAndGenerate(hw)}
                    className={cn(
                      "w-full text-left px-4 py-3 transition-all hover:bg-white/4 group",
                      isSelected && "bg-red-500/8 border-l-2 border-l-red-500"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {/* GPU dot */}
                      <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", vendorColor)} />
                      <div className="flex-1 min-w-0 space-y-1">
                        {/* Row 1: name + badges */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Discord username (if available) or code label */}
                          {hw.discordUsername ? (
                            <span className={cn("text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border flex items-center gap-1", isSelected ? "text-[#a5adff] bg-[#5865F2]/20 border-[#5865F2]/40" : "text-[#a5adff] bg-[#5865F2]/10 border-[#5865F2]/20")}>
                              <span className="text-[8px]">⬤</span>{hw.discordUsername.length > 18 ? hw.discordUsername.slice(0, 18) + "…" : hw.discordUsername}
                            </span>
                          ) : (
                            <span className={cn("text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border", isSelected ? "text-red-300 bg-red-500/15 border-red-500/30" : "text-zinc-400 bg-zinc-800 border-zinc-700")}>
                              {label.length > 22 ? label.slice(0, 22) + "…" : label}
                            </span>
                          )}
                          {hw.source === "rig" && (
                            <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">SCAN</span>
                          )}
                          {hw.isLaptop && (
                            <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400">LAPTOP</span>
                          )}
                          {hw.osVersion && (
                            <span className="text-[9px] text-zinc-600">{hw.osVersion === "win11" ? "Win11" : "Win10"}</span>
                          )}
                          {hw.seenCount && hw.seenCount > 1 && (
                            <span className="text-[9px] text-zinc-700">{hw.seenCount}x</span>
                          )}
                        </div>
                        {/* Row 2: GPU + CPU */}
                        <div className="flex items-center gap-3 flex-wrap">
                          {hw.gpuName && (
                            <span className={cn("text-[10px] font-bold flex items-center gap-1 px-1.5 py-0.5 rounded border", vendorText)}>
                              <Monitor className="w-2.5 h-2.5" />{hw.gpuName.length > 20 ? hw.gpuName.slice(0,20)+"…" : hw.gpuName}
                            </span>
                          )}
                          {hw.cpuModel && (
                            <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                              <Cpu className="w-2.5 h-2.5 text-zinc-600" />{hw.cpuModel.length > 22 ? hw.cpuModel.slice(0,22)+"…" : hw.cpuModel}
                            </span>
                          )}
                        </div>
                        {/* Row 3: RAM + extras */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {hw.ramGb && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400">
                              <MemoryStick className="w-2.5 h-2.5 inline mr-0.5" />{hw.ramGb}GB
                            </span>
                          )}
                          {(hw.cpuCores || hw.cpuThreads) && (
                            <span className="text-[9px] text-zinc-600">
                              {hw.cpuCores ? `${hw.cpuCores}C` : ""}{hw.cpuCores && hw.cpuThreads ? "/" : ""}{hw.cpuThreads ? `${hw.cpuThreads}T` : ""}
                            </span>
                          )}
                          {hw.vramMb && (
                            <span className="text-[9px] text-zinc-700">{Math.round(hw.vramMb / 1024)}GB VRAM</span>
                          )}
                          {hw.refreshHz && (
                            <span className="text-[9px] text-zinc-700">{hw.refreshHz}Hz</span>
                          )}
                          <span className={cn(
                            "ml-auto text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded transition-all",
                            isSelected
                              ? "bg-red-500/20 text-red-400 border border-red-500/30"
                              : "bg-zinc-800/0 text-zinc-700 group-hover:bg-red-600 group-hover:text-white border border-transparent group-hover:border-red-500"
                          )}>
                            {isSelected ? (generating ? "⟳ Generating…" : "✓ Loaded") : "Load + Gen →"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* GPU Vendor */}
        <div>
          <label className={labelCls}>GPU Vendor</label>
          <div className="flex gap-2">
            {(["nvidia", "amd", "intel"] as const).map(v => (
              <button key={v} onClick={() => setGpuVendor(v)}
                className={cn("flex-1 py-2 rounded-lg text-xs font-bold uppercase border transition-all",
                  gpuVendor === v
                    ? v === "nvidia" ? "bg-green-500/15 border-green-500/40 text-green-400"
                      : v === "amd" ? "bg-red-500/15 border-red-500/40 text-red-400"
                      : "bg-blue-500/15 border-blue-500/40 text-blue-400"
                    : "bg-zinc-900 border-zinc-800 text-zinc-600 hover:border-zinc-600"
                )}>
                <Monitor className="w-3 h-3 inline mr-1" />{v}
              </button>
            ))}
          </div>
        </div>

        {/* GPU Name */}
        <div>
          <label className={labelCls}>GPU Model (optional)</label>
          <input
            data-testid="input-gpu-name"
            value={gpuName}
            onChange={e => setGpuName(e.target.value)}
            placeholder={gpuVendor === "nvidia" ? "e.g. RTX 3060, GTX 1660" : gpuVendor === "amd" ? "e.g. RX 6600, RX 580" : "e.g. UHD 770"}
            className={inputCls}
          />
        </div>

        {/* CPU Model */}
        <div className="sm:col-span-2">
          <label className={labelCls}>CPU Model</label>
          <input
            data-testid="input-cpu-model"
            value={cpuModel}
            onChange={e => setCpuModel(e.target.value)}
            placeholder="e.g. i7-12700K, Ryzen 5 5600X, i9-13900K"
            className={inputCls}
          />
          {cpuModel.trim() && (() => {
            const parsed = parseCpuModel(cpuModel);
            return (
              <p className="text-[10px] text-zinc-500 mt-1 flex gap-2">
                <span className={parsed.brand === "intel" ? "text-blue-400" : "text-red-400"}>
                  {parsed.brand === "intel" ? "Intel" : "AMD Ryzen"}
                </span>
                <span>·</span>
                <span>{parsed.cores} cores / {parsed.threads} threads detected</span>
                {parsed.generation > 0 && <><span>·</span><span>Gen {parsed.generation}</span></>}
              </p>
            );
          })()}
        </div>

        {/* RAM */}
        <div>
          <label className={labelCls}>RAM (GB)</label>
          <select data-testid="select-ram" value={ramGB} onChange={e => setRamGB(e.target.value)} className={inputCls}>
            {["4","8","12","16","24","32","48","64"].map(v => (
              <option key={v} value={v}>{v}GB</option>
            ))}
          </select>
        </div>

        {/* OS */}
        <div>
          <label className={labelCls}>Windows Version</label>
          <div className="flex gap-2">
            {([["win11", "Windows 11"], ["win10", "Windows 10"]] as const).map(([v, label]) => (
              <button key={v} onClick={() => setOsVersion(v)}
                className={cn("flex-1 py-2 rounded-lg text-xs font-bold border transition-all",
                  osVersion === v
                    ? "bg-red-500/15 border-red-500/40 text-red-400"
                    : "bg-zinc-900 border-zinc-800 text-zinc-600 hover:border-zinc-600"
                )}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Laptop toggle */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
        <Laptop className="w-4 h-4 text-zinc-500 shrink-0" />
        <div className="flex-1">
          <p className="text-xs font-bold text-zinc-300">Laptop</p>
          <p className="text-[10px] text-zinc-600">Enable laptop-specific tweaks and battery optimizations</p>
        </div>
        <button
          data-testid="toggle-laptop"
          onClick={() => setIsLaptop(v => !v)}
          className={cn(
            "w-10 h-5 rounded-full transition-all relative shrink-0",
            isLaptop ? "bg-red-600" : "bg-zinc-700"
          )}
        >
          <div className={cn("w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all", isLaptop ? "left-5" : "left-0.5")} />
        </button>
      </div>

      {/* Preview */}
      {(() => {
        const fakeHW = buildFakeHW();
        const fakeOS = buildFakeOS();
        const recs = computeSmartRecs(fakeHW, fakeOS);
        return (
          <div className="rounded-xl border border-white/5 bg-zinc-900/40 p-4 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Preset Preview</p>
            <div className="flex flex-wrap gap-2">
              <span className="px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold">{recs.ids.size} tweaks</span>
              <span className="px-2 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 text-xs">{recs.profile}</span>
              <span className="px-2 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 text-xs">{recs.gpuLabel}</span>
              <span className="px-2 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 text-xs">{recs.cpuLabel}</span>
              <span className="px-2 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 text-xs">{recs.osLabel}</span>
              {isLaptop && <span className="px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">Laptop</span>}
            </div>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {recs.reasons.slice(0, 6).map((r, i) => (
                <p key={i} className="text-[10px] text-zinc-500 flex gap-1.5"><span className="text-red-500/50 shrink-0">•</span>{r}</p>
              ))}
            </div>
          </div>
        );
      })()}

      {/* V2.2 — Structured safe preset preview (rendered after first generate). */}
      {safePreset && (
        <div data-testid="safe-preset-preview" className="rounded-xl border border-red-500/20 bg-zinc-900/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Resolved by buildSafePreset</p>
              <p className="text-xs text-zinc-300 mt-0.5">{safePreset.profile} <span className="text-zinc-600">— {safePreset.hardwareSummary}</span></p>
            </div>
            <span className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold">
              {safePreset.core.length} CORE
            </span>
          </div>

          {/* Core tweaks chip list */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-1">Core (auto-applied)</p>
            <div className="flex flex-wrap gap-1">
              {safePreset.core.map(id => (
                <span key={id} className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-zinc-800 border border-zinc-700 text-zinc-400">{id}</span>
              ))}
            </div>
          </div>

          {/* Red opt-in section */}
          {safePreset.expert.length > 0 && (
            <div className="rounded-lg border border-red-500/40 bg-red-950/30 p-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <span className="text-[10px] font-black uppercase tracking-widest text-red-400">
                  Advanced — Opt-in Required ({safePreset.expert.length})
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 leading-relaxed">
                V1 stability casualties — BSOD / FiveM crash / boot hang. Tick to include. Re-click <strong>Generate</strong> to rebuild the script.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {safePreset.expert.map(id => (
                  <button
                    key={id}
                    data-testid={`button-admin-optin-${id}`}
                    onClick={() => setAdminOptInIds(prev => {
                      const next = new Set(prev);
                      if (next.has(id)) next.delete(id); else next.add(id);
                      return next;
                    })}
                    className={cn(
                      "px-2 py-1 rounded text-[10px] font-mono border transition-all",
                      adminOptInIds.has(id)
                        ? "bg-red-600 text-white border-red-500"
                        : "bg-zinc-900 text-zinc-400 border-zinc-700 hover:border-red-500/40 hover:text-zinc-200"
                    )}
                  >
                    {adminOptInIds.has(id) ? "✓ " : ""}{id}
                  </button>
                ))}
              </div>
            </div>
          )}

          {safePreset.blocked.length > 0 && (
            <details className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-2">
              <summary className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 cursor-pointer">
                Blocked ({safePreset.blocked.length}) — hardware mismatch / forbidden
              </summary>
              <div className="mt-2 space-y-1 max-h-28 overflow-y-auto">
                {safePreset.blocked.map((b, i) => (
                  <p key={i} className="text-[10px] text-zinc-500"><span className="font-mono text-zinc-400">{b.id}</span> — {b.reason}</p>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Include all expert tweaks toggle */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-950/30 border border-red-500/20">
        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
        <div className="flex-1">
          <p className="text-xs font-bold text-red-300">Include all opt-in expert tweaks</p>
          <p className="text-[10px] text-zinc-500">Lazy-user full preset — DisableDefender, VBS/HVCI off, etc. included in .bat</p>
        </div>
        <button
          data-testid="toggle-include-all-expert"
          onClick={() => setIncludeAllExpert(v => !v)}
          className={cn(
            "w-10 h-5 rounded-full transition-all relative shrink-0",
            includeAllExpert ? "bg-red-600" : "bg-zinc-700"
          )}
        >
          <div className={cn("w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all", includeAllExpert ? "left-5" : "left-0.5")} />
        </button>
      </div>

      {/* Generate button */}
      <button
        data-testid="button-generate-preset"
        onClick={handleGenerate}
        disabled={generating}
        className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm border border-red-500/30 flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <Download className="w-4 h-4" />
        {generating ? "Generating Preset..." : `Generate ${includeAllExpert ? "Full" : "Core"} Preset Script`}
      </button>

      <button
        data-testid="button-generate-fix"
        onClick={handleGenerateFix}
        disabled={generatingFix}
        className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-sm border border-zinc-700 flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <Download className="w-4 h-4" />
        {generatingFix ? "Generating Fix..." : "Generate Fix Script"}
      </button>

      {generated && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <p className="text-xs text-emerald-300">
            Generated: <strong>{generated.name}</strong> — {generated.tweakCount} tweaks downloaded. Send the .bat file to the user — they double-click it, click Yes, done.
          </p>
        </div>
      )}

      {fixGenerated && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
          <p className="text-xs text-blue-300">
            Fix generated: <strong>{fixGenerated.name}</strong> — {fixGenerated.tweakCount} tweaks downloaded.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Aether Admin AI Chat ─────────────────────────────────────────────────────
type AetherMsg = { role: "user" | "assistant"; content: string };

function AetherAdminChat({ headers }: { headers: Record<string, string> }) {
  const [messages, setMessages] = useState<AetherMsg[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || isStreaming) return;
    setInput("");

    const userMsg: AetherMsg = { role: "user", content: msg };
    setMessages(prev => [...prev, userMsg]);

    const assistantMsg: AetherMsg = { role: "assistant", content: "" };
    setMessages(prev => [...prev, assistantMsg]);
    setIsStreaming(true);

    try {
      const res = await fetch(apiUrl("/api/admin/aether-chat"), {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        toast({ title: "Aether Error", description: err.error || "Failed to reach Aether", variant: "destructive" });
        setMessages(prev => prev.slice(0, -1));
        setIsStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(trimmed.slice(6));
            if (data.done && data.fullText) {
              setMessages(prev => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                if (last?.role === "assistant") {
                  copy[copy.length - 1] = { ...last, content: data.fullText };
                }
                return copy;
              });
            } else if (data.token) {
              setMessages(prev => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                if (last?.role === "assistant") {
                  copy[copy.length - 1] = { ...last, content: last.content + data.token };
                }
                return copy;
              });
            }
          } catch {}
        }
      }
    } catch (err: unknown) {
      toast({ title: "Stream Error", description: err instanceof Error ? err.message : "Connection failed", variant: "destructive" });
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, messages, headers, toast]);

  const ADMIN_STARTERS = [
    "How's revenue looking today?",
    "Summarize open user tickets",
    "What tweaks should I add next?",
    "How many scripts downloaded this week?",
    "Any security events I should handle?",
    "How can I boost conversion rate?",
  ];

  return (
    <div data-testid="aether-admin-chat" className="mt-6 bg-zinc-900/50 border border-white/5 rounded-2xl overflow-hidden flex flex-col" style={{ height: "600px" }}>
      <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2 shrink-0">
        <div className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <Bot className="w-4 h-4 text-red-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">Aether Admin AI</h3>
          <p className="text-[10px] text-zinc-500">Live data • Revenue • Tickets • Analytics</p>
        </div>
        {messages.length > 0 && (
          <button
            data-testid="button-clear-aether-chat"
            onClick={() => setMessages([])}
            className="ml-auto text-zinc-600 hover:text-zinc-300 transition-colors p-1.5 rounded-lg hover:bg-white/5"
            title="Clear chat"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full pb-8">
            <Bot className="w-10 h-10 text-red-500/30 mb-4" />
            <p className="text-sm text-zinc-500 mb-1">Ask Aether about your app</p>
            <p className="text-[10px] text-zinc-700 mb-6">Revenue, tickets, downloads, security — all live data</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
              {ADMIN_STARTERS.map(q => (
                <button
                  key={q}
                  data-testid={`button-aether-starter-${q.slice(0, 15).replace(/\s/g, "-")}`}
                  onClick={() => sendMessage(q)}
                  className="text-left px-3 py-2 rounded-xl bg-zinc-800/60 border border-white/5 text-xs text-zinc-400 hover:text-zinc-200 hover:border-red-500/20 hover:bg-red-500/5 transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}>
              {msg.role === "assistant" && (
                <div className="w-6 h-6 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-3 h-3 text-red-400" />
                </div>
              )}
              <div className={cn(
                "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                msg.role === "user"
                  ? "bg-red-600/20 border border-red-500/25 text-zinc-200 rounded-br-sm"
                  : "bg-zinc-800/80 border border-white/5 text-zinc-300 rounded-bl-sm"
              )}>
                {msg.content || (isStreaming && i === messages.length - 1 ? (
                  <span className="flex items-center gap-1.5 text-zinc-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" style={{ animationDelay: "0.15s" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" style={{ animationDelay: "0.3s" }} />
                  </span>
                ) : "")}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 pb-4 pt-2 border-t border-white/5 shrink-0">
        <div className="flex items-end gap-2 bg-zinc-800/80 border border-white/8 rounded-2xl px-3 py-2 focus-within:border-red-500/30 transition-colors">
          <textarea
            ref={inputRef}
            data-testid="input-aether-message"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Ask Aether about revenue, tickets, analytics…"
            rows={1}
            disabled={isStreaming}
            className="flex-1 resize-none bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none leading-relaxed max-h-24 disabled:opacity-50"
            style={{ height: "auto", minHeight: "24px" }}
            onInput={e => {
              const t = e.currentTarget;
              t.style.height = "auto";
              t.style.height = Math.min(t.scrollHeight, 96) + "px";
            }}
          />
          <button
            data-testid="button-send-aether"
            onClick={() => sendMessage()}
            disabled={isStreaming || !input.trim()}
            className={cn(
              "p-2 rounded-xl transition-all shrink-0 mb-0.5",
              !input.trim() || isStreaming
                ? "text-zinc-700 bg-zinc-800/50 cursor-not-allowed"
                : "text-white bg-red-600 hover:bg-red-500 shadow-lg shadow-red-600/20"
            )}
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Admin Discounts Tab ───────────────────────────────────────────────────────
function DiscountsTab({ headers }: { headers: Record<string, string> }) {
  const { toast } = useToast();
  const [codes, setCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [code, setCode] = useState("");
  const [percentOff, setPercentOff] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [note, setNote] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/admin/discount-codes"), { headers });
      if (!res.ok) throw new Error(await res.text());
      setCodes(await res.json());
    } catch (e: any) {
      toast({ title: "Error loading codes", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!code.trim() || !percentOff) return;
    setSaving(true);
    try {
      const res = await fetch(apiUrl("/api/admin/discount-codes"), {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), percentOff: Number(percentOff), maxUses: maxUses ? Number(maxUses) : null, note: note || null }),
      });
      if (!res.ok) throw new Error(await res.text());
      setCode(""); setPercentOff(""); setMaxUses(""); setNote("");
      toast({ title: "Discount code created" });
      await load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeleting(id);
    try {
      const res = await fetch(apiUrl(`/api/admin/discount-codes/${id}`), { method: "DELETE", headers });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: "Deleted" });
      await load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-zinc-900/40 border border-white/5 rounded-xl p-4 space-y-3">
        <p className="text-[11px] text-zinc-500">Create a discount code for card (Stripe) payments. Users enter it in the payment modal to get a % off.</p>
        <div className="grid grid-cols-2 gap-2">
          <input data-testid="input-discount-code-admin" value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="e.g. MANUAL20" className="col-span-2 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 font-mono focus:outline-none focus:border-red-500/50" />
          <input data-testid="input-discount-percent" value={percentOff} onChange={e => setPercentOff(e.target.value)} placeholder="% Off (e.g. 20)" type="number" min="1" max="99" className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-500/50" />
          <input data-testid="input-discount-max-uses" value={maxUses} onChange={e => setMaxUses(e.target.value)} placeholder="Max uses (blank = ∞)" type="number" min="1" className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-500/50" />
          <input data-testid="input-discount-note" value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)" className="col-span-2 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-500/50" />
        </div>
        <button data-testid="button-create-discount" onClick={handleCreate} disabled={saving || !code.trim() || !percentOff} className="w-full py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-bold transition-all">
          {saving ? "Creating..." : "Create Discount Code"}
        </button>
      </div>
      <div className="space-y-2">
        {loading && <p className="text-xs text-zinc-500 text-center py-4">Loading...</p>}
        {!loading && codes.length === 0 && <p className="text-xs text-zinc-600 text-center py-8">No discount codes yet.</p>}
        {codes.map((dc: any) => (
          <div key={dc.id} className="flex items-center gap-3 bg-zinc-900/40 border border-white/5 rounded-xl p-3">
            <Percent className="w-4 h-4 text-red-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm font-bold text-white">{dc.code}</span>
                <span className="px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-[10px] font-bold">{dc.percentOff}% OFF</span>
                <span className="text-[10px] text-zinc-500">{dc.usedCount}{dc.maxUses != null ? `/${dc.maxUses}` : ""} used</span>
                {dc.expiresAt && <span className="text-[10px] text-zinc-600">expires {new Date(dc.expiresAt).toLocaleDateString()}</span>}
              </div>
              {dc.note && <p className="text-[11px] text-zinc-500 mt-0.5">{dc.note}</p>}
            </div>
            <button data-testid={`button-delete-discount-${dc.id}`} onClick={() => handleDelete(dc.id)} disabled={deleting === dc.id} className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Admin Pro Users Tab (Task #41) ───────────────────────────────────────────
type ProEntitlementRow = {
  discordUserId: string;
  source: string;
  grantedAt: string | null;
  grantedBy: string | null;
  notes: string | null;
  revokedAt: string | null;
  username: string | null;
  avatarUrl: string | null;
};

function ProUsersTab({ headers }: { headers: Record<string, string> }) {
  const { toast } = useToast();
  const [grantId, setGrantId] = useState("");
  const [grantNotes, setGrantNotes] = useState("");

  const entQuery = useQuery<ProEntitlementRow[]>({
    queryKey: ["/api/admin/pro-entitlements"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/admin/pro-entitlements"), { headers });
      if (!res.ok) throw new Error("Failed to load Pro entitlements");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const grantMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(apiUrl("/api/admin/pro-entitlements"), {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ discordUserId: grantId.trim(), source: "admin", notes: grantNotes || null }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Grant failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pro-entitlements"] });
      setGrantId("");
      setGrantNotes("");
      toast({ title: "Pro granted" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const revokeMutation = useMutation({
    mutationFn: async (discordUserId: string) => {
      const res = await fetch(apiUrl(`/api/admin/pro-entitlements/${encodeURIComponent(discordUserId)}`), {
        method: "DELETE",
        headers,
      });
      if (!res.ok) throw new Error("Revoke failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pro-entitlements"] });
      toast({ title: "Pro revoked" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const rows = entQuery.data || [];
  const active = rows.filter(r => !r.revokedAt);
  const revoked = rows.filter(r => r.revokedAt);

  const sourceBadge = (s: string) => {
    const cfg: Record<string, string> = {
      stripe:   "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      code:     "bg-red-500/20 text-red-400 border-red-500/30",
      friend:   "bg-amber-500/20 text-amber-400 border-amber-500/30",
      legacy:   "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
      admin:    "bg-purple-500/20 text-purple-400 border-purple-500/30",
      cashapp:  "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      paypal:   "bg-blue-500/20 text-blue-400 border-blue-500/30",
    };
    return (
      <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border", cfg[s] || "bg-zinc-700 text-zinc-400 border-zinc-600")}>
        {s === "admin" ? "Manually Granted" : s}
      </span>
    );
  };

  return (
    <div data-testid="pro-users-tab" className="mt-6 space-y-4">
      <div className="bg-zinc-900/40 border border-white/5 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Crown className="w-4 h-4 text-amber-400" />
          Manual Pro Grant (by Discord ID)
        </h3>
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          Paste a Discord user ID (15–25 digit snowflake) to grant a lifetime Pro
          entitlement. The user will be Pro on every device they sign into.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            data-testid="input-grant-discord-id"
            type="text"
            placeholder="Discord user ID (e.g. 188739918734802944)"
            value={grantId}
            onChange={(e) => setGrantId(e.target.value)}
            className="flex-1 bg-zinc-950 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-red-500 focus:outline-none"
          />
          <input
            data-testid="input-grant-notes"
            type="text"
            placeholder="Notes (optional)"
            value={grantNotes}
            onChange={(e) => setGrantNotes(e.target.value)}
            className="flex-1 bg-zinc-950 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-red-500 focus:outline-none"
          />
          <Button
            data-testid="button-grant-pro"
            onClick={() => grantMutation.mutate()}
            disabled={grantMutation.isPending || !/^\d{15,25}$/.test(grantId.trim())}
            className="bg-red-600 hover:bg-red-500 text-white"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Grant Pro
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Crown className="w-4 h-4 text-amber-400" />
          Active Entitlements ({active.length})
        </h3>
      </div>

      {entQuery.isLoading && (
        <div className="text-xs text-zinc-500">Loading entitlements…</div>
      )}

      {!entQuery.isLoading && active.length === 0 && (
        <div className="text-xs text-zinc-600 bg-zinc-900/40 border border-white/5 rounded-xl p-6 text-center">
          No active Pro entitlements yet.
        </div>
      )}

      <div className="space-y-1.5">
        {active.map((row) => (
          <div
            key={row.discordUserId}
            data-testid={`row-pro-${row.discordUserId}`}
            className="bg-zinc-900/40 border border-white/5 rounded-lg px-3 py-2 flex items-center gap-3 hover:border-white/10 transition-colors"
          >
            {row.avatarUrl ? (
              <img src={row.avatarUrl} alt="" className="w-8 h-8 rounded-full shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-zinc-800 shrink-0 flex items-center justify-center text-zinc-600">
                <Users className="w-4 h-4" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-white truncate" data-testid={`text-pro-username-${row.discordUserId}`}>
                {row.username || "(unknown user)"}
              </div>
              <div className="text-[10px] text-zinc-600 font-mono truncate">
                {row.discordUserId}{row.notes ? ` · ${row.notes}` : ""}
              </div>
            </div>
            {sourceBadge(row.source)}
            <div className="text-[10px] text-zinc-600 hidden md:block tabular-nums">
              {row.grantedAt ? new Date(row.grantedAt).toLocaleDateString() : "—"}
            </div>
            <button
              data-testid={`button-revoke-pro-${row.discordUserId}`}
              onClick={() => {
                if (window.confirm(`Revoke Pro for ${row.username || row.discordUserId}? They will lose access on every device.`)) {
                  revokeMutation.mutate(row.discordUserId);
                }
              }}
              disabled={revokeMutation.isPending}
              className="text-zinc-600 hover:text-red-400 p-1.5 rounded transition-colors"
              title="Revoke Pro"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {revoked.length > 0 && (
        <>
          <h3 className="text-sm font-bold text-zinc-500 flex items-center gap-2 pt-4">
            <ShieldOff className="w-4 h-4 text-zinc-600" />
            Revoked ({revoked.length})
          </h3>
          <div className="space-y-1.5 opacity-60">
            {revoked.map((row) => (
              <div
                key={row.discordUserId}
                data-testid={`row-pro-revoked-${row.discordUserId}`}
                className="bg-zinc-900/20 border border-white/5 rounded-lg px-3 py-2 flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-zinc-400 truncate">{row.username || "(unknown)"}</div>
                  <div className="text-[10px] text-zinc-600 font-mono truncate">{row.discordUserId}</div>
                </div>
                {sourceBadge(row.source)}
                <button
                  data-testid={`button-regrant-pro-${row.discordUserId}`}
                  onClick={() => {
                    setGrantId(row.discordUserId);
                    setGrantNotes(`re-grant of ${row.source}`);
                  }}
                  className="text-[10px] text-zinc-500 hover:text-amber-400 font-bold uppercase tracking-wider"
                >
                  Re-grant
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Admin Tickets Tab ────────────────────────────────────────────────────────
type UserReport = {
  id: number;
  category: string;
  description: string;
  systemInfo: Record<string, unknown> | null;
  status: string;
  adminNote: string | null;
  createdAt: string | null;
  resolvedAt: string | null;
};

function TicketsTab({ headers }: { headers: Record<string, string> }) {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [noteInputs, setNoteInputs] = useState<Record<number, string>>({});

  const reportsQuery = useQuery<UserReport[]>({
    queryKey: ["/api/admin/reports"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/admin/reports"), { headers });
      if (!res.ok) throw new Error("Failed to load reports");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, adminNote }: { id: number; status: string; adminNote?: string }) => {
      const res = await fetch(apiUrl(`/api/admin/reports/${id}/status`), {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminNote }),
      });
      if (!res.ok) throw new Error("Update failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reports"] });
      toast({ title: "Ticket updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const reports = reportsQuery.data || [];
  const filtered = statusFilter === "all" ? reports : reports.filter(r => r.status === statusFilter);
  const counts = {
    all: reports.length,
    open: reports.filter(r => r.status === "open").length,
    acknowledged: reports.filter(r => r.status === "acknowledged").length,
    resolved: reports.filter(r => r.status === "resolved").length,
  };

  const categoryLabel: Record<string, string> = {
    script_not_working: "Script Issue",
    tweak_problem: "Tweak Problem",
    crash: "Crash / Error",
    other: "Other",
  };

  const statusBadge = (s: string) => {
    const cfg: Record<string, string> = {
      open: "bg-red-500/20 text-red-400 border-red-500/30",
      acknowledged: "bg-amber-500/20 text-amber-400 border-amber-500/30",
      resolved: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    };
    return (
      <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border", cfg[s] || "bg-zinc-700 text-zinc-400 border-zinc-600")}>
        {s}
      </span>
    );
  };

  return (
    <div data-testid="tickets-tab" className="mt-6 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Flag className="w-4 h-4 text-red-400" />
          User Reports
        </h3>
        <div className="flex items-center gap-1 ml-auto">
          {(["all", "open", "acknowledged", "resolved"] as const).map(s => (
            <button
              key={s}
              data-testid={`button-filter-${s}`}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                statusFilter === s
                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                  : "text-zinc-600 hover:text-zinc-300 border border-transparent"
              )}
            >
              {s} ({counts[s]})
            </button>
          ))}
        </div>
      </div>

      {reportsQuery.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-5 h-5 text-zinc-600 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-zinc-600 text-sm">
          {reports.length === 0 ? "No user reports yet" : `No ${statusFilter} tickets`}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => (
            <div
              key={r.id}
              data-testid={`ticket-row-${r.id}`}
              className="bg-zinc-900/70 border border-white/5 rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
              >
                <span className="text-[10px] font-mono text-zinc-600">#{r.id}</span>
                {statusBadge(r.status)}
                <span className="text-xs font-bold text-zinc-300 truncate flex-1">
                  {categoryLabel[r.category] || r.category}
                </span>
                <span className="text-[10px] text-zinc-600 shrink-0">{timeAgo(r.createdAt)}</span>
                <ChevronDown className={cn("w-3.5 h-3.5 text-zinc-600 transition-transform", expandedId === r.id && "rotate-180")} />
              </button>

              {expandedId === r.id && (
                <div className="px-4 pb-4 space-y-3 border-t border-white/5">
                  <p className="text-sm text-zinc-300 leading-relaxed pt-3">{r.description}</p>

                  {r.systemInfo && Object.keys(r.systemInfo).length > 0 && (
                    <div className="bg-zinc-950/60 rounded-lg p-3 space-y-1">
                      <p className="text-[10px] font-bold uppercase text-zinc-500 tracking-widest mb-1">System Info</p>
                      {Object.entries(r.systemInfo).map(([k, v]) => (
                        <div key={k} className="flex items-center gap-2 text-[11px]">
                          <span className="text-zinc-600 font-mono">{k}:</span>
                          <span className="text-zinc-400">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {r.adminNote && (
                    <div className="bg-amber-500/5 border border-amber-500/15 rounded-lg px-3 py-2">
                      <p className="text-[10px] font-bold text-amber-400 mb-0.5">Admin Note</p>
                      <p className="text-xs text-zinc-400">{r.adminNote}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      data-testid={`input-ticket-note-${r.id}`}
                      type="text"
                      placeholder="Add admin note…"
                      value={noteInputs[r.id] || ""}
                      onChange={e => setNoteInputs(prev => ({ ...prev, [r.id]: e.target.value }))}
                      className="flex-1 min-w-[150px] px-3 py-1.5 rounded-lg bg-zinc-800 border border-white/8 text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-red-500/30"
                    />
                    {r.status === "open" && (
                      <button
                        data-testid={`button-ack-${r.id}`}
                        onClick={() => updateStatus.mutate({ id: r.id, status: "acknowledged", adminNote: noteInputs[r.id] || undefined })}
                        disabled={updateStatus.isPending}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold hover:bg-amber-500/25 transition-colors disabled:opacity-50"
                      >
                        <Eye className="w-3 h-3" />
                        Acknowledge
                      </button>
                    )}
                    {r.status !== "resolved" && (
                      <button
                        data-testid={`button-resolve-${r.id}`}
                        onClick={() => updateStatus.mutate({ id: r.id, status: "resolved", adminNote: noteInputs[r.id] || undefined })}
                        disabled={updateStatus.isPending}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        Resolve
                      </button>
                    )}
                    {r.status === "resolved" && (
                      <button
                        data-testid={`button-reopen-${r.id}`}
                        onClick={() => updateStatus.mutate({ id: r.id, status: "open", adminNote: noteInputs[r.id] || undefined })}
                        disabled={updateStatus.isPending}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-700/50 border border-zinc-600 text-zinc-400 text-xs font-bold hover:bg-zinc-700 transition-colors disabled:opacity-50"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Reopen
                      </button>
                    )}
                  </div>

                  <p className="text-[10px] text-zinc-700">
                    Created: {fmt(r.createdAt)} {r.resolvedAt ? ` • Resolved: ${fmt(r.resolvedAt)}` : ""}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Admin() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const isPro = useProStatus();
  const { user, isLoading: authLoading } = useAuth();
  const [key, setKey] = useState("");
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
  const [searchActivity, setSearchActivity] = useState("");
  const [filterCode, setFilterCode] = useState<"all" | "available" | "used" | "discord" | "no-discord">("all");
  const [filterFriend, setFilterFriend] = useState<"all" | "available" | "used">("all");
  const [confirmPurgeCodes, setConfirmPurgeCodes] = useState(false);
  const [confirmPurgeFriends, setConfirmPurgeFriends] = useState(false);
  const [editingCodeId, setEditingCodeId] = useState<number | null>(null);
  const [editingFriendId, setEditingFriendId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [expandedCodeIps, setExpandedCodeIps] = useState<Set<number>>(new Set());
  const [linkingDiscordCodeId, setLinkingDiscordCodeId] = useState<number | null>(null);
  const [linkingDiscordInput, setLinkingDiscordInput] = useState("");

  // Preset generator pre-fill state (for "Gen Preset" button on each code row)
  type PresetFillValues = { gpuVendor: "nvidia" | "amd" | "intel"; gpuName: string; cpuModel: string; cpuCores?: number; cpuThreads?: number; ramGb: number; osVersion: "win11" | "win10"; isLaptop: boolean };
  const [presetFillData, setPresetFillData] = useState<PresetFillValues | null>(null);
  const [presetFillKey, setPresetFillKey] = useState("default");

  // T007: Read hardware params from URL (set by game scanner v1.1+) and pre-fill preset gen
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlTab = params.get("tab");
    const gpu = params.get("gpu");
    const cpu = params.get("cpu");
    const ram = params.get("ram");
    const vendor = params.get("vendor");
    const os = params.get("os");
    const laptop = params.get("laptop");
    if (urlTab === "preset" && authed) {
      setTab("preset" as Tab);
      if (gpu || cpu) {
        const v = (vendor && ["nvidia","amd","intel"].includes(vendor)) ? vendor as "nvidia"|"amd"|"intel" : "nvidia";
        const fill: PresetFillValues = {
          gpuVendor: v,
          gpuName: gpu || "",
          cpuModel: cpu || "",
          ramGb: parseInt(ram || "16") || 16,
          osVersion: os === "win11" ? "win11" : "win10",
          isLaptop: laptop === "true",
        };
        setPresetFillData(fill);
        setPresetFillKey(`url-${Date.now()}`);
      }
    }
  }, [authed]);

  // Pro paywall preview dialog
  const [previewPaywallOpen, setPreviewPaywallOpen] = useState(false);

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
    queryFn: () => fetch(apiUrl("/api/admin/stats"), { headers }).then(r => {
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
    queryFn: () => fetch(apiUrl("/api/admin/download-stats"), { headers }).then(r => {
      if (!r.ok) throw new Error("Unauthorized");
      return r.json();
    }),
    enabled: authed,
    retry: false,
    refetchInterval: 60000,
  });

  const codesQuery = useQuery<(ProAccessCode & { lastSessionAt: string | null; sessionIp: string | null; ipCity: string | null; ipRegion: string | null; ipCountry: string | null })[]>({
    queryKey: ["/api/admin/codes", key],
    queryFn: () => fetch(apiUrl("/api/admin/codes"), { headers }).then(r => {
      if (!r.ok) throw new Error("Unauthorized");
      return r.json();
    }),
    enabled: authed,
    retry: false,
  });

  const friendsQuery = useQuery<ProFriendToken[]>({
    queryKey: ["/api/admin/friends", key],
    queryFn: () => fetch(apiUrl("/api/admin/friends"), { headers }).then(r => {
      if (!r.ok) throw new Error("Unauthorized");
      return r.json();
    }),
    enabled: authed,
    retry: false,
  });

  type IpLog = { id: number; codeRef: string; ipAddress: string; city: string | null; region: string | null; country: string | null; isp: string | null; lat: string | null; lon: string | null; seenAt: string };
  const ipLogsQuery = useQuery<IpLog[]>({
    queryKey: ["/api/admin/ip-logs", key],
    queryFn: () => fetch(apiUrl("/api/admin/ip-logs"), { headers }).then(r => {
      if (!r.ok) throw new Error("Unauthorized");
      return r.json();
    }),
    enabled: authed,
    retry: false,
    refetchInterval: 30000,
  });

  const genCode = useMutation({
    mutationFn: () => fetch(apiUrl("/api/admin/codes"), {
      method: "POST", headers, body: JSON.stringify({ note: noteCode.trim() || null }),
    }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/codes", key] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats", key] });
      setNoteCode("");
      setFilterCode("all");
      toast({ title: "Code generated", description: "New access code is ready to send." });
    },
  });

  const importCodeMut = useMutation({
    mutationFn: async () => {
      const res = await fetch(apiUrl("/api/admin/codes"), {
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
    mutationFn: (id: number) => fetch(apiUrl(`/api/admin/codes/${id}`), { method: "DELETE", headers }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/codes", key] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats", key] });
    },
  });

  const resetCode = useMutation({
    mutationFn: (id: number) => fetch(apiUrl(`/api/admin/codes/${id}/reset`), { method: "POST", headers }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/codes", key] });
      toast({ title: "Code reset", description: "Code is available again — customer can re-enter it." });
    },
  });

  const renameCode = useMutation({
    mutationFn: ({ id, note }: { id: number; note: string | null }) =>
      fetch(apiUrl(`/api/admin/codes/${id}`), { method: "PATCH", headers, body: JSON.stringify({ note }) }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/codes", key] });
      setEditingCodeId(null);
      setEditValue("");
    },
  });

  const renameFriend = useMutation({
    mutationFn: ({ id, note }: { id: number; note: string | null }) =>
      fetch(apiUrl(`/api/admin/friends/${id}`), { method: "PATCH", headers, body: JSON.stringify({ note }) }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/friends", key] });
      setEditingFriendId(null);
      setEditValue("");
    },
  });

  const purgeUsedCodes = useMutation({
    mutationFn: () => fetch(apiUrl("/api/admin/codes/used/purge"), { method: "DELETE", headers }).then(r => r.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/codes", key] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats", key] });
      setConfirmPurgeCodes(false);
      toast({ title: `Purged ${data.deleted} used codes`, description: "Redeemed codes cleared." });
    },
  });

  const reviveDeadCodes = useMutation({
    mutationFn: () => fetch(apiUrl("/api/admin/codes/revive-dead"), { method: "POST", headers }).then(r => r.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/codes", key] });
      if (data.revived === 0) {
        toast({ title: "No dead codes found", description: "All used codes already have active sessions." });
      } else {
        toast({ title: `Revived ${data.revived} code${data.revived !== 1 ? "s" : ""}`, description: "Customers can now re-enter their codes to get access back." });
      }
    },
  });

  const linkDiscordToCode = useMutation({
    mutationFn: ({ codeId, discordUserId }: { codeId: number; discordUserId: string }) =>
      fetch(apiUrl(`/api/admin/codes/${codeId}/link-discord`), {
        method: "POST", headers, body: JSON.stringify({ discordUserId }),
      }).then(async r => { if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || "Link failed"); } return r.json(); }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/codes", key] });
      setLinkingDiscordCodeId(null);
      setLinkingDiscordInput("");
      toast({ title: "Discord linked", description: "The code now shows the Discord connection." });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const unlinkDiscordFromCode = useMutation({
    mutationFn: ({ codeId, discordUserId }: { codeId: number; discordUserId: string }) =>
      fetch(apiUrl(`/api/admin/codes/${codeId}/unlink-discord`), {
        method: "POST", headers, body: JSON.stringify({ discordUserId }),
      }).then(async r => { if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || "Unlink failed"); } return r.json(); }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/codes", key] });
      toast({ title: "Discord unlinked", description: "Entitlement revoked and code reset — customer can re-enter it to relink." });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const genFriend = useMutation({
    mutationFn: () => fetch(apiUrl("/api/admin/friends"), {
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
    mutationFn: (id: number) => fetch(apiUrl(`/api/admin/friends/${id}`), { method: "DELETE", headers }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/friends", key] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats", key] });
    },
  });

  const purgeUsedFriends = useMutation({
    mutationFn: () => fetch(apiUrl("/api/admin/friends/used/purge"), { method: "DELETE", headers }).then(r => r.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/friends", key] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats", key] });
      setConfirmPurgeFriends(false);
      toast({ title: `Purged ${data.deleted} used links`, description: "Used friend links cleared." });
    },
  });

  const manualPaymentsQuery = useQuery<ManualPayment[]>({
    queryKey: ["/api/admin/manual-payments", key],
    queryFn: () => fetch(apiUrl("/api/admin/manual-payments"), { headers }).then(r => r.json()),
    enabled: authed,
    retry: false,
    refetchInterval: 30000,
  });

  const logPayment = useMutation({
    mutationFn: ({ amount, method, note }: { amount: number; method: string; note: string }) =>
      fetch(apiUrl("/api/admin/manual-payments"), {
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
      fetch(apiUrl(`/api/admin/manual-payments/${id}`), { method: "DELETE", headers }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/manual-payments", key] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats", key] });
    },
  });

  const emailRequestsQuery = useQuery<EmailRequest[]>({
    queryKey: ["/api/admin/email-requests", key],
    queryFn: () => fetch(apiUrl("/api/admin/email-requests"), { headers }).then(r => {
      if (!r.ok) throw new Error("Unauthorized");
      return r.json();
    }),
    enabled: authed,
    retry: false,
    refetchInterval: 15000,
  });

  const emailConfiguredQuery = useQuery<{ configured: boolean }>({
    queryKey: ["/api/admin/email-configured", key],
    queryFn: () => fetch(apiUrl("/api/admin/email-configured"), { headers }).then(r => r.json()),
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
    queryFn: () => fetch(apiUrl("/api/admin/customer-deploy-stats"), { headers }).then(r => r.json()),
    enabled: authed,
    retry: false,
    refetchInterval: 5000,
  });

  const customerHardwareQuery = useQuery<CustomerHW[]>({
    queryKey: ["/api/admin/customer-hardware", key],
    queryFn: () => fetch(apiUrl("/api/admin/customer-hardware"), { headers }).then(r => r.json()),
    enabled: authed,
    retry: false,
    refetchInterval: 30000,
  });

  // Native scan users from hardware_rigs table (instant native scan → detected users)
  const rigsDetectedQuery = useQuery<CustomerHW[]>({
    queryKey: ["/api/admin/rigs-detected", key],
    queryFn: () => fetch(apiUrl("/api/admin/rigs-detected"), { headers }).then(r => r.json()),
    enabled: authed,
    retry: false,
    refetchInterval: 15000,
  });

  const hardwareMap = Object.fromEntries((customerHardwareQuery.data || []).map(h => [h.codeRef, h]));

  const sendEmailCode = useMutation({
    mutationFn: (id: number) => fetch(apiUrl(`/api/admin/email-requests/${id}/send`), {
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
    mutationFn: (id: number) => fetch(apiUrl(`/api/admin/email-requests/${id}/reject`), {
      method: "POST", headers, body: JSON.stringify({ note: "Rejected by admin" }),
    }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-requests", key] });
      toast({ title: "Request rejected" });
    },
  });

  const delEmailReq = useMutation({
    mutationFn: (id: number) => fetch(apiUrl(`/api/admin/email-requests/${id}`), {
      method: "DELETE", headers,
    }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-requests", key] });
    },
  });

  // Revoke all Pro sessions tied to a code — instantly kills access for a cheater
  const revokeByCode = useMutation({
    mutationFn: (codeRef: string) => fetch(apiUrl(`/api/admin/sessions/by-code/${encodeURIComponent(codeRef)}`), {
      method: "DELETE", headers,
    }).then(r => r.json()),
    onSuccess: (data) => {
      toast({
        title: data.revoked > 0 ? `Access revoked (${data.revoked} session${data.revoked > 1 ? "s" : ""} killed)` : "No active sessions found",
        description: data.revoked > 0 ? "That user can no longer access Pro." : "They may have already lost access.",
      });
    },
  });

  // Pro Sessions — all active sessions with identity info
  type SessionRow = {
    id: number; sessionToken: string; tokenMasked: string;
    codeRef: string | null; createdAt: string | null; lastCheckedAt: string | null; ipAddress: string | null;
    email: string | null; discordUsername: string | null; discordId: string | null; discordAvatarUrl: string | null;
    codeNote: string | null;
    ipCity: string | null; ipRegion: string | null; ipCountry: string | null;
  };
  const sessionsQuery = useQuery<SessionRow[]>({
    queryKey: ["/api/admin/sessions", key],
    queryFn: () => fetch(apiUrl("/api/admin/sessions"), { headers }).then(r => r.json()),
    enabled: authed,
    refetchInterval: 30_000, // refresh every 30s so online status stays current
  });

  const revokeSession = useMutation({
    mutationFn: (token: string) => fetch(apiUrl(`/api/admin/sessions/${encodeURIComponent(token)}`), {
      method: "DELETE", headers,
    }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sessions", key] });
      toast({ title: "Session revoked", description: "That token is now dead — user loses Pro on next page load." });
    },
  });

  const sweepOrphans = useMutation({
    mutationFn: () => fetch(apiUrl("/api/admin/sessions/orphans"), { method: "DELETE", headers }).then(r => r.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sessions", key] });
      toast({
        title: data.swept > 0 ? `Swept ${data.swept} orphan session${data.swept !== 1 ? "s" : ""}` : "No orphans found",
        description: data.swept > 0
          ? "All sessions with no matching code have been deleted. Those users lost Pro access instantly."
          : "Every session already has a valid matching code.",
      });
    },
  });

  // Graphics Studio grants
  type GraphicsGrant = { discordUserId: string; grantedAt: string | null; grantedBy: string | null; notes: string | null };
  const graphicsGrantsQuery = useQuery<GraphicsGrant[]>({
    queryKey: ["/api/admin/graphics-studio/grants", key],
    queryFn: () => fetch(apiUrl("/api/admin/graphics-studio/grants"), { headers }).then(r => r.json()),
    enabled: authed,
  });
  const graphicsGrantedIds = new Set((graphicsGrantsQuery.data ?? []).map(g => g.discordUserId));

  const grantGraphicsStudio = useMutation({
    mutationFn: (discordId: string) => fetch(apiUrl("/api/admin/graphics-studio/grant"), {
      method: "POST", headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ discordId }),
    }).then(r => r.json()),
    onSuccess: (_data, discordId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/graphics-studio/grants", key] });
      toast({ title: "Graphics Studio granted", description: `Discord ID ${discordId} now has access.` });
    },
  });

  const revokeGraphicsStudio = useMutation({
    mutationFn: (discordId: string) => fetch(apiUrl(`/api/admin/graphics-studio/revoke/${encodeURIComponent(discordId)}`), {
      method: "DELETE", headers,
    }).then(r => r.json()),
    onSuccess: (_data, discordId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/graphics-studio/grants", key] });
      toast({ title: "Graphics Studio revoked", description: `Discord ID ${discordId} access removed.` });
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
    queryFn: () => fetch(apiUrl("/api/admin/system-status"), { headers }).then(r => r.json()),
    enabled: authed,
    retry: false,
    refetchInterval: 10000,
  });

  const triggerAutoSend = useMutation({
    mutationFn: () => fetch(apiUrl("/api/admin/auto-send/trigger"), { method: "POST", headers }).then(r => r.json()),
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

  // ── Version & Updates form state (Task #27) ────────────────────────────
  const versionSettingsQ = useQuery<{
    currentVersion: string | null;
    latestVersion: string | null;
    updaterCmdUrl: string | null;
    updatePageUrl: string | null;
  }>({
    queryKey: ["/api/admin/settings", key],
    queryFn: () => fetch(apiUrl("/api/admin/settings"), { headers }).then(r => r.json()),
    enabled: authed,
  });
  const ghReleaseQ = useQuery<{
    version: string | null;
    exeUrl: string | null;
    pageUrl: string | null;
    fetchedAt: number | null;
    stale: boolean;
  }>({
    queryKey: ["/api/admin/github-release", key],
    queryFn: () => fetch(apiUrl("/api/admin/github-release"), { headers }).then(r => r.json()),
    enabled: authed,
    refetchInterval: 60_000,
  });

  const resolvedDownloadQ = useQuery<{
    source: string;
    version: string | null;
    url: string | null;
    filename?: string;
    pageUrl?: string;
  }>({
    queryKey: ["/api/download/version", key],
    queryFn: () => fetch(apiUrl("/api/download/version")).then(r => r.json()),
    enabled: authed,
    refetchInterval: 2 * 60_000,
  });
  const [ghRefreshing, setGhRefreshing] = useState(false);
  const refreshGhRelease = async () => {
    setGhRefreshing(true);
    try {
      await fetch(apiUrl("/api/admin/github-release/refresh"), { method: "POST", headers });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/github-release"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/version"] });
      toast({ title: "GitHub release refreshed" });
    } catch { toast({ title: "Refresh failed", variant: "destructive" }); }
    finally { setGhRefreshing(false); }
  };
  const [verCurrent, setVerCurrent] = useState("");
  const [verLatest, setVerLatest] = useState("");
  const [verCmdUrl, setVerCmdUrl] = useState("");
  const [verPageUrl, setVerPageUrl] = useState("");
  const [verSaving, setVerSaving] = useState(false);
  useEffect(() => {
    if (!versionSettingsQ.data) return;
    setVerCurrent(versionSettingsQ.data.currentVersion ?? "");
    setVerLatest(versionSettingsQ.data.latestVersion ?? "");
    setVerCmdUrl(versionSettingsQ.data.updaterCmdUrl ?? "");
    setVerPageUrl(versionSettingsQ.data.updatePageUrl ?? "");
  }, [versionSettingsQ.data]);
  const saveVersionSettings = async () => {
    setVerSaving(true);
    try {
      const r = await fetch(apiUrl("/api/admin/settings"), {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          currentVersion: verCurrent.trim() || null,
          latestVersion: verLatest.trim() || null,
          updaterCmdUrl: verCmdUrl.trim() || null,
          updatePageUrl: verPageUrl.trim() || null,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/version"] });
      toast({ title: "Version settings saved" });
    } catch (e: any) {
      toast({ title: "Failed to save version settings", description: String(e?.message ?? e), variant: "destructive" });
    } finally {
      setVerSaving(false);
    }
  };

  const announcementsQuery = useQuery<{ id: number; title: string; body: string; tag: string | null; tweakIds: string[] | null; createdAt: string }[]>({
    queryKey: ["/api/announcements"],
    enabled: authed,
    retry: false,
  });

  const parsedTweakIds = annTweakIds.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);

  const createAnn = useMutation({
    mutationFn: () => fetch(apiUrl("/api/admin/announcements"), {
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
    mutationFn: (id: number) => fetch(apiUrl(`/api/admin/announcements/${id}`), { method: "DELETE", headers }).then(r => r.json()),
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

  // Auto-login intentionally removed — admin panel always requires explicit key entry.

  const handleLogin = async () => {
    setAuthError("");
    const res = await fetch(apiUrl("/api/admin/codes"), { headers: { "x-admin-key": input } });
    if (res.ok) {
      setKey(input);
      setAuthed(true);
    } else {
      setAuthError("Wrong key. Set ADMIN_KEY in your environment secrets.");
    }
  };

  const handleLogout = () => {
    setKey(""); setInput(""); setAuthed(false);
  };

  const filteredCodes = useMemo(() => {
    return (codesQuery.data || [])
      .filter(c => {
        const cx = c as typeof c & { discordLinked?: boolean };
        if (filterCode === "available") return !c.usedAt && !(c as any).usedByIp;
        if (filterCode === "used") return !!c.usedAt || !!(c as any).usedByIp;
        if (filterCode === "discord") return !!cx.discordLinked;
        if (filterCode === "no-discord") return !!c.usedAt && !cx.discordLinked;
        return true;
      })
      .filter(c => {
        if (!searchCode) return true;
        const q = searchCode.toLowerCase();
        const cx = c as typeof c & { discordUsername?: string | null };
        return (
          c.code.toLowerCase().includes(q) ||
          (c.note || "").toLowerCase().includes(q) ||
          (cx.discordUsername || "").toLowerCase().includes(q)
        );
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
      .map(c => ({
        type: "code" as const,
        label: c.note || c.code,
        detail: c.code,
        at: c.usedAt!,
        city: c.ipCity ?? null,
        region: c.ipRegion ?? null,
        country: c.ipCountry ?? null,
      }));
    const friendEvents = (friendsQuery.data || [])
      .filter(f => f.usedAt)
      .map(f => ({
        type: "friend" as const,
        label: f.note || f.token.slice(0, 8) + "…",
        detail: f.token,
        at: f.usedAt!,
        city: null as string | null,
        region: null as string | null,
        country: null as string | null,
      }));
    return [...codeEvents, ...friendEvents]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 30);
  }, [codesQuery.data, friendsQuery.data]);

  function dmTemplate(code: string): string {
    return `Hey! Here's your Opti Gods Pro key: ${code}\n\nDownload + redeem at: https://optigods.com\nOpen the app → click GET PRO → enter your code. Takes 10 seconds.\n\nThanks for purchasing — enjoy the gains! 🔥`;
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
          <p className="text-center text-[10px] text-zinc-700">by leaq · optigods.com</p>
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

      <div className="w-full px-3 py-3 md:px-6 md:py-5 space-y-4 md:space-y-5">

        {/* Header */}
        <div className="relative rounded-2xl overflow-hidden border border-red-500/15 bg-gradient-to-br from-zinc-900/80 via-black to-zinc-900/60 shadow-[inset_0_0_60px_-20px_rgba(239,68,68,0.08)]">
          <div className="absolute inset-0 bg-gradient-to-br from-red-950/25 to-transparent pointer-events-none" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/40 to-transparent" />
          <div className="relative px-4 py-4 md:px-6 md:py-5 flex flex-col md:flex-row md:items-center gap-3 md:gap-4">

            {/* Brand */}
            <div className="flex items-center gap-3 flex-1">
              <button
                data-testid="button-exit-admin"
                onClick={() => setLocation("/")}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800/60 border border-white/8 hover:bg-zinc-700/60 hover:border-white/15 transition-colors text-zinc-400 hover:text-white text-[11px] font-medium shrink-0"
                title="Back to dashboard"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Dashboard</span>
              </button>
              <div className="relative">
                <div className="w-20 h-20 bg-gradient-to-br from-zinc-700/60 to-zinc-900 border border-red-500/40 rounded-xl flex items-center justify-center overflow-hidden shadow-[0_0_28px_-6px_rgba(239,68,68,0.7)]">
                  <AdminSilverMark className="w-20 h-20" />
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

              {/* Pro preview toggle — uses real server-side session (requires admin key) */}
              <button
                onClick={async () => {
                  if (isPro) {
                    clearProStatus();
                    toast({ title: "Preview: Free mode" });
                  } else {
                    try {
                      const res = await fetch(apiUrl("/api/admin/grant-pro-session"), {
                        method: "POST",
                        headers: { "Content-Type": "application/json", "x-admin-key": key },
                      });
                      if (!res.ok) throw new Error("unauthorized");
                      const data = await res.json();
                      setProSession(data.sessionToken);
                      toast({ title: "Preview: Pro mode" });
                    } catch {
                      toast({ title: "Failed — check your admin key", variant: "destructive" });
                    }
                  }
                }}
                data-testid="button-pro-preview-toggle"
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-colors",
                  isPro ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-zinc-800/60 border-zinc-700 text-zinc-500 hover:text-zinc-300"
                )}
                title="Toggle Pro preview for testing"
              >
                <Eye className="w-3 h-3" />
                {isPro ? "PRO preview" : "Free mode"}
              </button>

              {/* Open the real paywall modal for live preview */}
              <button
                onClick={() => setPreviewPaywallOpen(true)}
                data-testid="button-preview-paywall"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800/60 text-[11px] font-bold text-zinc-500 hover:text-zinc-300 transition-colors"
                title="Open paywall modal preview"
              >
                <CreditCard className="w-3 h-3" />
                Paywall
              </button>
              <ProPaymentDialog open={previewPaywallOpen} onOpenChange={setPreviewPaywallOpen} />

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
          <button onClick={() => {
            const link = "https://buy.stripe.com/5kQdRacgM48Yb4Y4WD14400";
            if (isNative()) { openExternal(link); } else { window.open(link, "_blank"); }
          }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600/10 border border-rose-500/20 rounded-lg text-xs text-rose-400 hover:bg-rose-600/20 transition-colors font-mono">
            <CreditCard className="w-3 h-3" /> Stripe (Card)
          </button>
          <a href="https://discord.gg/optigods" target="_blank" rel="noreferrer"
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
          {(["codes", "friends", "activity", "email", "sessions", "pro", "announcements", "analytics", "security", "preset", "aether", "tickets", "discounts", "rigs", "suggestions", "drivers"] as Tab[]).map(t => {
            const pendingEmails = (emailRequestsQuery.data || []).filter(r => r.status === "pending").length;
            const TAB_ICONS: Record<Tab, React.ElementType> = {
              codes: Key,
              friends: Link,
              activity: Activity,
              email: Mail,
              sessions: Users,
              pro: Crown,
              announcements: Bell,
              analytics: TrendingUp,
              security: Shield,
              preset: Sliders,
              aether: Bot,
              tickets: Flag,
              discounts: Percent,
              rigs: Cpu,
              suggestions: Inbox,
              drivers: Monitor,
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
                   t === "sessions" ? "Sessions" :
                   t === "pro" ? "Pro Users" :
                   t === "announcements" ? "Updates" :
                   t === "analytics" ? "Analytics" :
                   t === "security" ? "Security" :
                   t === "preset" ? "Preset Gen" :
                   t === "aether" ? "Aether AI" :
                   t === "tickets" ? "Tickets" :
                   t === "discounts" ? "Discounts" :
                   t === "rigs" ? "Hardware DB" :
                   t === "suggestions" ? "Suggestions" :
                   t === "drivers" ? "NVIDIA Drivers" :
                   `Activity (${activityItems.length})`}
                </span>
                <span className="sm:hidden">
                  {t === "codes" ? `${stats?.totalCodes ?? 0}` :
                   t === "friends" ? `${stats?.totalFriends ?? 0}` :
                   t === "email" ? "" :
                   t === "sessions" ? "" :
                   t === "announcements" ? "" :
                   t === "analytics" ? "" :
                   t === "security" ? "" :
                   t === "preset" ? "" :
                   t === "aether" ? "" :
                   t === "tickets" ? "" :
                   t === "discounts" ? "" :
                   t === "rigs" ? "" :
                   t === "suggestions" ? "" :
                   t === "drivers" ? "" :
                   `${activityItems.length}`}
                </span>
                {t === "email" && pendingEmails > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[9px] font-bold shadow-[0_0_6px_rgba(239,68,68,0.5)]">
                    {pendingEmails}
                  </span>
                )}
                {t === "sessions" && (sessionsQuery.data?.length ?? 0) > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-emerald-600 text-white text-[9px] font-bold">
                    {sessionsQuery.data!.length}
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
                  placeholder="Search codes, labels, or Discord username..."
                  value={searchCode}
                  onChange={e => setSearchCode(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/5 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
                />
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {([
                  { id: "all", label: "All" },
                  { id: "available", label: "Available" },
                  { id: "used", label: "Used" },
                  { id: "discord", label: "🔗 Discord" },
                  { id: "no-discord", label: "⚠ No Discord" },
                ] as const).map(f => (
                  <button
                    key={f.id}
                    onClick={() => setFilterCode(f.id)}
                    className={cn(
                      "px-2.5 py-1.5 rounded text-[10px] font-bold tracking-wide transition-colors whitespace-nowrap",
                      filterCode === f.id
                        ? f.id === "no-discord"
                          ? "bg-amber-500/15 border border-amber-500/40 text-amber-400"
                          : f.id === "discord"
                            ? "bg-emerald-500/15 border border-emerald-500/40 text-emerald-400"
                            : "bg-red-600/20 border border-red-500/30 text-red-400"
                        : "bg-zinc-900 border border-white/5 text-zinc-600 hover:text-zinc-300"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                {/* Revive dead codes button — always visible if any used codes have no session */}
                {(codesQuery.data?.filter(c => c.usedAt && !c.lastSessionAt).length ?? 0) > 0 && (
                  <button
                    data-testid="button-revive-dead-codes"
                    onClick={() => reviveDeadCodes.mutate()}
                    disabled={reviveDeadCodes.isPending}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded text-[10px] text-blue-400 hover:bg-blue-500/20 hover:border-blue-500/40 transition-colors font-medium"
                    title="Reset all dead codes (used but no active session) back to available"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Revive dead ({codesQuery.data?.filter(c => c.usedAt && !c.lastSessionAt).length})
                  </button>
                )}
                {(codesQuery.data?.filter(c => c.usedAt).length ?? 0) > 0 && (
                  confirmPurgeCodes ? (
                    <div className="flex items-center gap-1.5">
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
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-900 border border-white/5 rounded text-[10px] text-zinc-500 hover:text-red-400 hover:border-red-500/20 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" /> Purge used
                    </button>
                  )
                )}
              </div>
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
                    "group px-3 py-3 border-b border-white/5 last:border-0 transition-colors",
                    c.usedAt ? "opacity-40" : (c as any).usedByIp ? "opacity-60" : "hover:bg-zinc-900/40"
                  )}
                >
                  {/* Row 1: index + code (full width) + status badge */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="shrink-0 w-5 text-[10px] text-zinc-700 text-right tabular-nums">{i + 1}</span>
                    <span className="font-mono text-sm font-bold text-white tracking-wider flex-1 min-w-0">{c.code}</span>
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded border shrink-0",
                      c.usedAt
                        ? "text-zinc-600 bg-zinc-800/50 border-zinc-700"
                        : (c as any).usedByIp
                          ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                          : "text-red-400 bg-red-500/10 border-red-500/20"
                    )}>
                      {c.usedAt ? `USED ${timeAgo(c.usedAt)}` : (c as any).usedByIp ? "PARTIAL — Reset needed" : "AVAILABLE"}
                    </span>
                    {c.usedAt && (() => {
                      const cx = c as typeof c & { discordLinked?: boolean; discordUsername?: string | null; discordManuallyLinked?: boolean; discordUserId?: string | null };
                      if (cx.discordLinked) {
                        return (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 text-emerald-400 bg-emerald-500/10 border-emerald-500/20 flex items-center gap-1" title={cx.discordManuallyLinked ? `Manually linked by admin` : `Discord-locked`}>
                            🔒 {cx.discordUsername || cx.discordUserId?.slice(0, 12) || "Discord"}
                          </span>
                        );
                      }
                      if (linkingDiscordCodeId === c.id) {
                        return (
                          <div className="flex items-center gap-1 shrink-0">
                            <input
                              autoFocus
                              type="text"
                              placeholder="Discord user ID…"
                              value={linkingDiscordInput}
                              onChange={e => setLinkingDiscordInput(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === "Enter" && /^\d{15,25}$/.test(linkingDiscordInput.trim())) linkDiscordToCode.mutate({ codeId: c.id, discordUserId: linkingDiscordInput.trim() });
                                if (e.key === "Escape") { setLinkingDiscordCodeId(null); setLinkingDiscordInput(""); }
                              }}
                              className="bg-zinc-800 border border-red-500/30 focus:border-red-500/60 rounded px-2 py-0.5 text-[10px] text-white placeholder-zinc-600 focus:outline-none w-40"
                            />
                            <button
                              onClick={() => { if (/^\d{15,25}$/.test(linkingDiscordInput.trim())) linkDiscordToCode.mutate({ codeId: c.id, discordUserId: linkingDiscordInput.trim() }); }}
                              disabled={linkDiscordToCode.isPending || !/^\d{15,25}$/.test(linkingDiscordInput.trim())}
                              className="p-1 rounded bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 transition-colors disabled:opacity-40"
                            ><Check className="w-3 h-3" /></button>
                            <button onClick={() => { setLinkingDiscordCodeId(null); setLinkingDiscordInput(""); }} className="p-1 rounded hover:bg-zinc-700 text-zinc-600 hover:text-zinc-400 transition-colors"><X className="w-3 h-3" /></button>
                          </div>
                        );
                      }
                      return (
                        <button
                          onClick={() => { setLinkingDiscordCodeId(c.id); setLinkingDiscordInput(""); }}
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 text-amber-400 bg-amber-500/10 border-amber-500/30 flex items-center gap-1 hover:bg-amber-500/20 transition-colors"
                          title="Click to connect a Discord account to this code"
                        >
                          ⚠ No Discord
                        </button>
                      );
                    })()}
                  </div>
                  {/* Row 2: name/note + date on left, actions on right */}
                  <div className="flex items-center gap-1.5 pl-7">
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
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            data-testid={`button-cancel-rename-code-${c.id}`}
                            onClick={() => { setEditingCodeId(null); setEditValue(""); }}
                            className="p-1 rounded hover:bg-zinc-700 text-zinc-600 hover:text-zinc-400 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (() => {
                        const codeDeploy = (customerDeployStatsQuery.data || []).find(s => s.codeRef === c.code);
                        const fps = codeDeploy ? estimateFpsGain(codeDeploy.allTweakIds) : null;
                        return (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {(() => {
                              const isStripe = c.code.startsWith('STRIPE-');
                              const displayNote = isStripe && c.note
                                ? c.note.split(' | stripe:')[0]
                                : c.note;
                              return (
                                <>
                                  {isStripe && (
                                    <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border text-emerald-400 bg-emerald-500/10 border-emerald-500/20 shrink-0">
                                      <CreditCard className="w-2.5 h-2.5" />CARD
                                    </span>
                                  )}
                                  {displayNote
                                    ? <p className="text-xs text-zinc-300 truncate max-w-[140px] sm:max-w-none">{displayNote}</p>
                                    : <p className="text-xs text-zinc-600 italic">No name</p>
                                  }
                                </>
                              );
                            })()}
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
                              className="p-0.5 rounded hover:bg-zinc-700 text-zinc-600 hover:text-zinc-300 transition-all"
                              title="Rename customer"
                            >
                              <Pencil className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        );
                      })()}
                      <p className="text-[10px] text-zinc-600 whitespace-nowrap">
                        Created {fmt(c.createdAt)}
                        {c.usedAt && c.lastSessionAt && (
                          <span className="ml-1.5 text-blue-500/70">· Active {timeAgo(c.lastSessionAt)}</span>
                        )}
                        {c.usedAt && !c.lastSessionAt && (
                          <span className="ml-1.5 text-zinc-700">· No session</span>
                        )}
                        {c.sessionIp && (
                          <span className="ml-1.5 text-amber-500/70 font-mono">· {c.sessionIp}</span>
                        )}
                      </p>
                    </div>
                    {/* Actions — always visible on mobile (no hover-only) */}
                    <div className="flex items-center gap-0.5 shrink-0">
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
                          <MessageSquare className="w-3 h-3" /> <span className="hidden sm:inline">DM</span>
                        </button>
                      )}
                      {c.usedAt && (
                        <button
                          data-testid={`button-reset-code-${c.id}`}
                          onClick={() => resetCode.mutate(c.id)}
                          disabled={resetCode.isPending}
                          className="flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-blue-500/10 text-zinc-600 hover:text-blue-400 transition-colors"
                          title={c.code.startsWith('STRIPE-') ? "Revive — restore their access (they revisit payment page to get new session)" : "Reset — let customer re-enter this code"}
                        >
                          <RotateCcw className="w-3 h-3" /> <span className="hidden sm:inline">{c.code.startsWith('STRIPE-') ? 'Revive' : 'Reset'}</span>
                        </button>
                      )}
                      {(c as any).discordLinked && (c as any).discordUserId && (
                        <button
                          data-testid={`button-unlink-discord-${c.id}`}
                          onClick={() => {
                            const ca = c as any;
                            if (confirm(`Unlink Discord from ${c.code}?\n\nThis revokes ${ca.discordUsername || ca.discordUserId}'s entitlement and resets the code so they can re-enter it fresh.`)) {
                              unlinkDiscordFromCode.mutate({ codeId: c.id, discordUserId: ca.discordUserId! });
                            }
                          }}
                          disabled={unlinkDiscordFromCode.isPending}
                          className="flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-orange-500/10 text-zinc-600 hover:text-orange-400 transition-colors"
                          title={`Unlink Discord (${(c as any).discordUsername || (c as any).discordUserId}) — revoke entitlement and reset code`}
                        >
                          <UserX className="w-3 h-3" /> <span className="hidden sm:inline">Unlink</span>
                        </button>
                      )}
                      {(c as any).discordLinked && (c as any).discordUserId && (() => {
                        const did: string = (c as any).discordUserId;
                        const hasGrant = graphicsGrantedIds.has(did);
                        return (
                          <button
                            data-testid={`button-graphics-code-${c.id}`}
                            onClick={() => {
                              const name = (c as any).discordUsername || did;
                              if (hasGrant) {
                                if (confirm(`Revoke FiveM Graphics Studio from ${name}?`))
                                  revokeGraphicsStudio.mutate(did);
                              } else {
                                if (confirm(`Grant FiveM Graphics Studio to ${name}?`))
                                  grantGraphicsStudio.mutate(did);
                              }
                            }}
                            disabled={grantGraphicsStudio.isPending || revokeGraphicsStudio.isPending}
                            className={cn(
                              "flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors",
                              hasGrant
                                ? "text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
                                : "text-zinc-600 hover:bg-zinc-700/30 hover:text-zinc-400"
                            )}
                            title={hasGrant ? "Revoke FiveM Graphics Studio" : "Grant FiveM Graphics Studio"}
                          >
                            <Palette className="w-3 h-3" />
                            <span className="hidden sm:inline">{hasGrant ? "Studio ✓" : "Studio"}</span>
                          </button>
                        );
                      })()}
                      {c.usedAt && (
                        <button
                          data-testid={`button-kill-code-${c.id}`}
                          onClick={() => {
                            if (confirm(`Kill ALL Pro access for ${c.note?.split(' | stripe:')[0] || c.code}?\n\nThis revokes their session immediately. They lose access on next page load.`)) {
                              revokeByCode.mutate(c.code);
                            }
                          }}
                          disabled={revokeByCode.isPending}
                          className="flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-red-500/10 text-zinc-600 hover:text-red-400 transition-colors"
                          title="Kill — instantly revoke all Pro sessions for this buyer"
                        >
                          <Ban className="w-3 h-3" /> <span className="hidden sm:inline">Kill</span>
                        </button>
                      )}
                      {(() => {
                        const hw = hardwareMap[c.code];
                        if (!hw) return null;
                        return (
                          <button
                            data-testid={`button-gen-preset-${c.id}`}
                            onClick={() => {
                              setPresetFillData({
                                gpuVendor: (hw.gpuVendor as "nvidia" | "amd" | "intel") || "nvidia",
                                gpuName: hw.gpuName || "",
                                cpuModel: hw.cpuModel || "",
                                cpuCores: hw.cpuCores ?? undefined,
                                cpuThreads: hw.cpuThreads ?? undefined,
                                ramGb: hw.ramGb || 16,
                                osVersion: (hw.osVersion as "win11" | "win10") || "win11",
                                isLaptop: hw.isLaptop ?? false,
                              });
                              setPresetFillKey(c.code + "-" + Date.now());
                              setTab("preset");
                            }}
                            className="flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-purple-500/10 text-zinc-500 hover:text-purple-400 transition-colors border border-purple-500/20"
                            title={`Generate preset for ${hw.gpuName || hw.gpuVendor || "this customer"}`}
                          >
                            <Sliders className="w-3 h-3" /> <span className="hidden sm:inline">Gen Preset</span>
                          </button>
                        );
                      })()}
                      {(() => {
                        const codeLogs = (ipLogsQuery.data || []).filter(l => l.codeRef === c.code);
                        const hasNewIp = codeLogs.length > 1;
                        const isOpen = expandedCodeIps.has(c.id);
                        if (!c.usedAt) return null;
                        return (
                          <button
                            data-testid={`button-ips-code-${c.id}`}
                            onClick={() => setExpandedCodeIps(prev => {
                              const next = new Set(prev);
                              if (next.has(c.id)) next.delete(c.id); else next.add(c.id);
                              return next;
                            })}
                            className={cn(
                              "flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors",
                              hasNewIp
                                ? "text-red-400 hover:bg-red-500/10 border border-red-500/20"
                                : "text-zinc-500 hover:bg-zinc-800"
                            )}
                            title="View IP history"
                          >
                            {hasNewIp && <AlertTriangle className="w-3 h-3" />}
                            <Globe className="w-3 h-3" />
                            <span className="hidden sm:inline">{codeLogs.length} IP{codeLogs.length !== 1 ? "s" : ""}</span>
                            {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        );
                      })()}
                      <button
                        data-testid={`button-del-code-${c.id}`}
                        onClick={() => delCode.mutate(c.id)}
                        className="p-1.5 rounded hover:bg-red-500/10 text-zinc-700 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* IP History Panel */}
                  {expandedCodeIps.has(c.id) && (() => {
                    const codeLogs = (ipLogsQuery.data || []).filter(l => l.codeRef === c.code);
                    if (codeLogs.length === 0) return (
                      <div className="mt-2 pl-7 text-[10px] text-zinc-600 italic">No IPs logged yet.</div>
                    );
                    return (
                      <div className="mt-2 pl-7 space-y-1.5">
                        {codeLogs.map((log, idx) => {
                          const isFirst = idx === 0;
                          const location = [log.city, log.region, log.country].filter(Boolean).join(", ");
                          return (
                            <div
                              key={log.id}
                              className={cn(
                                "rounded-lg border px-3 py-2 space-y-0.5",
                                isFirst
                                  ? "border-emerald-500/20 bg-emerald-500/5"
                                  : "border-red-500/25 bg-red-500/5"
                              )}
                            >
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={cn(
                                  "text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0",
                                  isFirst
                                    ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                                    : "text-red-400 border-red-500/30 bg-red-500/10"
                                )}>
                                  {isFirst ? "ORIGINAL" : "⚠ NEW IP"}
                                </span>
                                <span className="font-mono text-xs text-white">{log.ipAddress}</span>
                                {log.isp && (
                                  <span className="text-[10px] text-zinc-500 truncate">{log.isp}</span>
                                )}
                                <span className="text-[10px] text-zinc-600 ml-auto whitespace-nowrap">
                                  {new Date(log.seenAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                              {location && (
                                <div className="flex items-center gap-1 text-[10px] text-zinc-400">
                                  <MapPin className="w-2.5 h-2.5 shrink-0" />
                                  <span>{location}</span>
                                  {log.lat && log.lon && (
                                    <a
                                      href={`https://www.google.com/maps?q=${log.lat},${log.lon}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-blue-400/60 hover:text-blue-400 transition-colors ml-1 text-[9px]"
                                    >
                                      Map
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
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
                      "group px-3 py-3 border-b border-white/5 last:border-0 transition-colors",
                      t.usedAt ? "opacity-40" : "hover:bg-zinc-900/40"
                    )}
                  >
                    {/* Row 1: index + status badge */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="shrink-0 w-5 text-[10px] text-zinc-700 text-right tabular-nums">{i + 1}</span>
                      {editingFriendId === t.id ? (
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
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
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            data-testid={`button-cancel-rename-friend-${t.id}`}
                            onClick={() => { setEditingFriendId(null); setEditValue(""); }}
                            className="p-1 rounded hover:bg-zinc-700 text-zinc-600 hover:text-zinc-400 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          {t.note
                            ? <p className="text-xs font-medium text-zinc-300 truncate">{t.note}</p>
                            : <p className="text-xs text-zinc-600 italic">No name</p>
                          }
                          <button
                            data-testid={`button-rename-friend-${t.id}`}
                            onClick={() => { setEditingFriendId(t.id); setEditValue(t.note || ""); }}
                            className="p-0.5 rounded hover:bg-zinc-700 text-zinc-600 hover:text-zinc-300 transition-all"
                          >
                            <Pencil className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      )}
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded border shrink-0",
                        t.usedAt
                          ? "text-zinc-600 bg-zinc-800/50 border-zinc-700"
                          : "text-red-400 bg-red-500/10 border-red-500/20"
                      )}>
                        {t.usedAt ? `USED ${timeAgo(t.usedAt)}` : "AVAILABLE"}
                      </span>
                    </div>
                    {/* Row 2: link + copy + delete */}
                    <div className="flex items-center gap-1.5 pl-7">
                      <span className="font-mono text-[10px] text-zinc-500 truncate flex-1 min-w-0">{link}</span>
                      <CopyButton text={link} />
                      <button
                        data-testid={`button-del-friend-${t.id}`}
                        onClick={() => delFriend.mutate(t.id)}
                        className="p-1.5 rounded hover:bg-red-500/10 text-zinc-700 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[10px] text-zinc-700 pl-7 mt-1">
                      Created {fmt(t.createdAt)}
                      {(t as any).usedByIp && (
                        <span className="ml-1.5 text-amber-500/70 font-mono">· {(t as any).usedByIp}</span>
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── ACTIVITY TAB ─────────────────────────────────────────── */}
        {tab === "activity" && (
          <div className="space-y-3">
            {/* Search bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600 pointer-events-none" />
              <input
                data-testid="input-search-activity"
                type="text"
                placeholder="Search by name, code, or type…"
                value={searchActivity}
                onChange={e => setSearchActivity(e.target.value)}
                className="w-full bg-zinc-900/70 border border-white/8 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-red-500/40 transition-colors"
              />
              {searchActivity && (
                <button
                  onClick={() => setSearchActivity("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  <XCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {(() => {
              const q = searchActivity.trim().toLowerCase();
              const filtered = q
                ? activityItems.filter(item =>
                    item.label.toLowerCase().includes(q) ||
                    item.detail.toLowerCase().includes(q) ||
                    item.type.toLowerCase().includes(q) ||
                    (item.city ?? "").toLowerCase().includes(q) ||
                    (item.region ?? "").toLowerCase().includes(q) ||
                    (item.country ?? "").toLowerCase().includes(q)
                  )
                : activityItems;
              return filtered.length === 0 ? (
              <div className="p-12 text-center text-xs text-zinc-600">
                {q ? `No activity matching "${searchActivity}"` : "No redemptions yet — activity shows here once codes or links are used."}
              </div>
            ) : (
              <div className="rounded-xl border border-white/5 overflow-hidden">
                {filtered.map((item, i) => (
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
                      {(item.city || item.country) && (
                        <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                          {countryFlag(item.country)}{countryFlag(item.country) ? " " : ""}
                          {[item.city, item.region, item.country].filter(Boolean).join(", ")}
                        </p>
                      )}
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
            );
            })()}

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
                        "px-3 py-3 transition-colors",
                        req.status === "pending" ? "hover:bg-zinc-900/40" : "opacity-60 hover:opacity-80"
                      )}
                    >
                      {/* Row 1: icon + email + status badge */}
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className={cn(
                          "w-6 h-6 rounded-lg flex items-center justify-center shrink-0",
                          isSentStatus && customerRedeemed ? "bg-blue-500/10 border border-blue-500/20"
                            : isSentStatus ? "bg-emerald-500/10 border border-emerald-500/20"
                            : req.status === "rejected" ? "bg-zinc-800 border border-zinc-700"
                            : "bg-red-500/10 border border-red-500/20"
                        )}>
                          <Mail className={cn(
                            "w-3 h-3",
                            isSentStatus && customerRedeemed ? "text-blue-400"
                              : isSentStatus ? "text-emerald-400"
                              : req.status === "rejected" ? "text-zinc-600"
                              : "text-red-400"
                          )} />
                        </div>
                        <p className="text-xs font-semibold text-white truncate flex-1 min-w-0">{req.email}</p>
                        <span className={cn(
                          "text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0",
                          isSentStatus ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                            : req.status === "rejected" ? "text-zinc-600 bg-zinc-800 border-zinc-700"
                            : "text-amber-400 bg-amber-500/10 border-amber-500/20"
                        )}>
                          {req.status.toUpperCase()}
                        </span>
                        <button
                          data-testid={`button-del-email-${req.id}`}
                          onClick={() => delEmailReq.mutate(req.id)}
                          className="p-1.5 rounded hover:bg-red-500/10 text-zinc-700 hover:text-red-400 transition-colors shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Row 2: payment ref + discord + amount + badges */}
                      <div className="pl-8 space-y-1">
                        <p className="text-[10px] text-zinc-500">
                          <span className="uppercase font-bold text-zinc-600">{req.paymentMethod}</span>
                          {" — "}
                          <span className="font-mono break-all">{req.paymentRef}</span>
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {(req as any).discordUsername && (
                            <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded">
                              Discord: {(req as any).discordUsername}
                            </span>
                          )}
                          {(req as any).amountPaid != null && (
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                              Paid: ${(req as any).amountPaid}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {isSentStatus && (
                            customerRedeemed ? (
                              <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border text-blue-400 bg-blue-500/10 border-blue-500/20">
                                <Check className="w-2.5 h-2.5" /> Redeemed
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border text-zinc-500 bg-zinc-800/50 border-zinc-700">
                                <Clock className="w-2.5 h-2.5" /> Awaiting Redemption
                              </span>
                            )
                          )}
                          {deployStat && (() => {
                            const fps = estimateFpsGain(deployStat.allTweakIds);
                            return (
                              <>
                                <span
                                  data-testid={`badge-tweaks-deployed-${req.id}`}
                                  className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border text-red-400 bg-red-500/10 border-red-500/20"
                                >
                                  <Zap className="w-2.5 h-2.5" />
                                  {deployStat.totalTweaks} tweaks
                                </span>
                                {fps.high > 0 && (
                                  <span
                                    data-testid={`badge-fps-est-${req.id}`}
                                    className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                                  >
                                    <TrendingUp className="w-2.5 h-2.5" />
                                    +{fps.low}–{fps.high} FPS
                                  </span>
                                )}
                              </>
                            );
                          })()}
                        </div>
                        {sentCode && (
                          <p className="text-[10px] text-zinc-700 font-mono">
                            Code: <span className="text-zinc-500">{sentCode.code}</span>
                            {customerRedeemed && sentCode.usedAt && (
                              <span className="text-blue-600 ml-2">· redeemed {timeAgo(sentCode.usedAt)}</span>
                            )}
                          </p>
                        )}
                        <p className="text-[10px] text-zinc-700 whitespace-nowrap">{timeAgo(req.createdAt)} · {fmt(req.createdAt)}</p>
                        {req.note && <p className="text-[10px] text-zinc-600 italic">{req.note}</p>}

                        {/* Action buttons */}
                        {req.status === "pending" && (
                          <div className="flex gap-2 pt-1.5">
                            <button
                              data-testid={`button-send-email-${req.id}`}
                              onClick={() => sendEmailCode.mutate(req.id)}
                              disabled={sendEmailCode.isPending}
                              className="flex items-center justify-center gap-1.5 flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-black transition-colors disabled:opacity-50"
                            >
                              <Send className="w-3 h-3" />
                              Send Code Now
                            </button>
                            <button
                              data-testid={`button-reject-email-${req.id}`}
                              onClick={() => rejectEmailReq.mutate(req.id)}
                              disabled={rejectEmailReq.isPending}
                              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-400 text-xs font-bold transition-colors"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Reject
                            </button>
                          </div>
                        )}
                        {/* Revoke — kills active Pro sessions for this customer instantly */}
                        {isSentStatus && sentCode && (
                          <button
                            data-testid={`button-revoke-${req.id}`}
                            onClick={() => {
                              if (confirm(`Revoke ALL Pro access for ${req.email}?\n\nThis kills their session immediately. They will lose access on their next page load.`))
                                revokeByCode.mutate(sentCode.code);
                            }}
                            disabled={revokeByCode.isPending}
                            className="flex items-center gap-1.5 mt-1.5 px-3 py-1.5 rounded-lg bg-red-950/60 border border-red-500/20 text-red-400 hover:bg-red-900/60 hover:border-red-500/40 text-[10px] font-bold transition-colors disabled:opacity-50"
                          >
                            <XCircle className="w-3 h-3" />
                            Revoke Pro Access
                          </button>
                        )}
                      </div>
                    </div>
                  );
                  })}
              </div>
            )}
          </div>
        )}

        {/* ─── PRO SESSIONS TAB ──────────────────────────────────────── */}
        {tab === "sessions" && (() => {
          const sessions = sessionsQuery.data ?? [];
          const now = Date.now();
          // "Online" = last ping within 2 hours (covers .exe users who ping once on open)
          const isOnline = (s: { lastCheckedAt: string | null }) =>
            s.lastCheckedAt ? now - new Date(s.lastCheckedAt).getTime() < 2 * 60 * 60_000 : false;
          const onlineCount = sessions.filter(isOnline).length;

          // Orphan sessions: codeRef doesn't start with admin-/friend: AND doesn't match any real code
          const validCodeSet = new Set((codesQuery.data ?? []).map(c => c.code));
          const orphanSessions = sessions.filter(s => {
            const ref = s.codeRef ?? "";
            if (!ref || ref.startsWith("admin-") || ref.startsWith("friend:")) return false;
            return !validCodeSet.has(ref);
          });

          return (
            <div className="space-y-4">
              {/* Orphan warning — shown whenever there are unmatched sessions */}
              {orphanSessions.length > 0 && (
                <div
                  data-testid="banner-orphan-sessions"
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-red-500/40 bg-red-500/8"
                >
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 animate-pulse" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-red-300">
                      {orphanSessions.length} orphan session{orphanSessions.length !== 1 ? "s" : ""} detected
                    </p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      These sessions have no matching code in the database. They may be from deleted codes or old data —
                      anyone holding them currently has free Pro access.
                    </p>
                  </div>
                  <button
                    data-testid="button-sweep-orphans"
                    onClick={() => {
                      if (confirm(`Delete all ${orphanSessions.length} orphan session${orphanSessions.length !== 1 ? "s" : ""}?\n\nThose users will lose Pro access immediately on their next page load. This cannot be undone.`))
                        sweepOrphans.mutate();
                    }}
                    disabled={sweepOrphans.isPending}
                    className="shrink-0 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    {sweepOrphans.isPending ? "Sweeping…" : "Sweep Now"}
                  </button>
                </div>
              )}

              {/* Summary bar */}
              <div className="rounded-xl border border-white/5 bg-zinc-900/40 overflow-hidden">
                {/* Top row: count + actions */}
                <div className="flex items-center gap-3 px-3 py-2.5 border-b border-white/5">
                  <Users className="w-4 h-4 text-zinc-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white">{sessions.length} active Pro session{sessions.length !== 1 ? "s" : ""}</p>
                  </div>
                  <button
                    data-testid="button-sweep-orphans-quiet"
                    onClick={() => sweepOrphans.mutate()}
                    disabled={sweepOrphans.isPending}
                    title="Sweep orphan sessions (sessions with no matching code)"
                    className="p-1.5 rounded hover:bg-red-500/10 text-zinc-700 hover:text-red-400 transition-colors disabled:opacity-40"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    data-testid="button-refresh-sessions"
                    onClick={() => sessionsQuery.refetch()}
                    className="p-1.5 rounded hover:bg-white/5 text-zinc-600 hover:text-zinc-300 transition-colors"
                    title="Refresh"
                  >
                    <RefreshCw className={cn("w-3.5 h-3.5", sessionsQuery.isFetching && "animate-spin")} />
                  </button>
                </div>

                {/* Online now panel */}
                <div className="px-3 py-2.5">
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.7)]" />
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-400">
                      {onlineCount > 0 ? `${onlineCount} online now` : "Nobody online right now"}
                    </p>
                    <span className="text-[9px] text-zinc-700 ml-1">· last 15 min</span>
                  </div>

                  {onlineCount === 0 ? (
                    <p className="text-[10px] text-zinc-700 italic">No users have checked in recently.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {sessions
                        .filter(isOnline)
                        .sort((a, b) =>
                          new Date(b.lastCheckedAt ?? 0).getTime() - new Date(a.lastCheckedAt ?? 0).getTime()
                        )
                        .map(s => {
                          const name = s.discordUsername ?? s.email?.split("@")[0] ?? s.codeNote?.split(" | ")[0] ?? s.tokenMasked;
                          const minutesAgo = s.lastCheckedAt
                            ? Math.floor((Date.now() - new Date(s.lastCheckedAt).getTime()) / 60_000)
                            : null;
                          return (
                            <div
                              key={s.id}
                              data-testid={`chip-online-${s.id}`}
                              className="flex items-center gap-1.5 bg-emerald-950/30 border border-emerald-500/20 rounded-lg px-2 py-1"
                              title={`Last seen: ${minutesAgo === 0 ? "just now" : `${minutesAgo}m ago`}${s.ipCity ? ` · ${[s.ipCity, s.ipCountry].filter(Boolean).join(", ")}` : ""}`}
                            >
                              {/* Avatar: letter fallback always rendered underneath; img overlays it and hides on error */}
                              <div className="relative w-5 h-5 shrink-0">
                                <div className="absolute inset-0 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                                  <span className="text-[8px] text-zinc-500 font-bold uppercase">{name.charAt(0)}</span>
                                </div>
                                {s.discordAvatarUrl && (
                                  <img
                                    src={s.discordAvatarUrl}
                                    alt={name}
                                    className="absolute inset-0 w-5 h-5 rounded-full ring-1 ring-emerald-500/30 object-cover"
                                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                                  />
                                )}
                              </div>
                              <span className="text-[11px] text-emerald-300 font-semibold max-w-[120px] truncate">{name}</span>
                              {minutesAgo !== null && (
                                <span className="text-[9px] text-emerald-600 shrink-0">
                                  {minutesAgo === 0 ? "now" : `${minutesAgo}m`}
                                </span>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>

              {/* Session breakdown — shows exactly where all sessions come from */}
              {sessions.length > 0 && (() => {
                const fromCodes   = sessions.filter(s => s.codeRef && !s.codeRef.startsWith("admin-") && !s.codeRef.startsWith("friend:") && validCodeSet.has(s.codeRef)).length;
                const fromFriends = sessions.filter(s => s.codeRef?.startsWith("friend:")).length;
                const fromAdmin   = sessions.filter(s => s.codeRef?.startsWith("admin-")).length;
                const fromOrphans = orphanSessions.length;
                return (
                  <div className="grid grid-cols-4 gap-2" data-testid="session-breakdown">
                    {[
                      { label: "Real codes",    count: fromCodes,   color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
                      { label: "Friend links",  count: fromFriends, color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20" },
                      { label: "Admin test",    count: fromAdmin,   color: "text-violet-400",  bg: "bg-violet-500/10 border-violet-500/20" },
                      { label: "Orphans",       count: fromOrphans, color: fromOrphans > 0 ? "text-red-400" : "text-zinc-600", bg: fromOrphans > 0 ? "bg-red-500/10 border-red-500/30" : "bg-zinc-900 border-zinc-800" },
                    ].map(({ label, count, color, bg }) => (
                      <div key={label} className={cn("rounded-lg border px-3 py-2 text-center", bg)}>
                        <p className={cn("text-base font-bold", color)}>{count}</p>
                        <p className="text-[9px] text-zinc-600 uppercase tracking-wider mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                );
              })()}

              <div className="text-[10px] text-zinc-600 leading-relaxed">
                Each row is a device that redeemed a Pro code or friend link. "Online" means they loaded the app in the last 15 min. Revoking kills their session immediately — they're locked out on next page load. Sessions = codes (1 active session per code — re-entering a code on a new device replaces the old session).
              </div>

              {sessionsQuery.isLoading ? (
                <div className="p-12 text-center text-xs text-zinc-600 animate-pulse">Loading sessions…</div>
              ) : sessions.length === 0 ? (
                <div className="p-12 text-center">
                  <Users className="w-8 h-8 text-zinc-800 mx-auto mb-3" />
                  <p className="text-xs text-zinc-600">No active Pro sessions yet.</p>
                  <p className="text-[10px] text-zinc-700 mt-1">Sessions appear here once a customer redeems a code.</p>
                </div>
              ) : (
                <div className="rounded-xl border border-white/5 overflow-hidden divide-y divide-white/5">
                  {[...sessions]
                    .sort((a, b) => (isOnline(b) ? 1 : 0) - (isOnline(a) ? 1 : 0) ||
                      new Date(b.lastCheckedAt ?? 0).getTime() - new Date(a.lastCheckedAt ?? 0).getTime())
                    .map(s => {
                      const online = isOnline(s);
                      const isFriend = s.codeRef?.startsWith("friend:");
                      const isAdminTest = s.codeRef?.startsWith("admin-");
                      const isOrphan = !isFriend && !isAdminTest && !!s.codeRef && !validCodeSet.has(s.codeRef);
                      return (
                        <div
                          key={s.id}
                          data-testid={`row-session-${s.id}`}
                          className={cn(
                            "px-3 py-3 transition-colors",
                            isOrphan ? "bg-red-950/20 border-l-2 border-l-red-500/60" :
                            online ? "hover:bg-emerald-950/10" : "opacity-60 hover:opacity-80"
                          )}
                        >
                          {/* Row 1: status dot + identity */}
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className={cn(
                              "w-2 h-2 rounded-full shrink-0 ring-2",
                              online
                                ? "bg-emerald-400 ring-emerald-400/30 shadow-[0_0_6px_rgba(52,211,153,0.5)]"
                                : "bg-zinc-700 ring-zinc-700/30"
                            )} />
                            <div className="flex-1 min-w-0">
                              {s.email ? (
                                <p className="text-xs font-semibold text-white truncate">{s.email}</p>
                              ) : s.codeNote && !isFriend && !isAdminTest && !isOrphan ? (
                                <p className="text-xs font-semibold text-amber-300 truncate">{s.codeNote.split(" | stripe:")[0]}</p>
                              ) : (
                                <p className={cn("text-xs font-semibold italic", isOrphan ? "text-red-400" : "text-zinc-500")}>
                                  {isFriend ? "Friend link user" : isAdminTest ? "Admin test session" : isOrphan ? "⚠ ORPHAN — code deleted" : s.codeRef ?? "No session data"}
                                </p>
                              )}
                              {s.discordUsername && (
                                <p className="text-[10px] text-indigo-400 font-bold truncate">Discord: {s.discordUsername}</p>
                              )}
                              {s.ipAddress && (
                                <p className="text-[10px] text-zinc-500 font-mono truncate">
                                  IP: {s.ipAddress}
                                  {(s.ipCity || s.ipRegion) && (
                                    <span className="text-zinc-400 not-italic ml-1.5">
                                      — {[s.ipCity, s.ipRegion, s.ipCountry].filter(Boolean).join(", ")}
                                    </span>
                                  )}
                                </p>
                              )}
                            </div>
                            <span className={cn(
                              "text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0",
                              online
                                ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                                : "text-zinc-600 bg-zinc-800 border-zinc-700"
                            )}>
                              {online ? "ONLINE" : "OFFLINE"}
                            </span>
                            {s.discordId && (
                              <button
                                data-testid={`button-graphics-studio-${s.id}`}
                                onClick={() => {
                                  if (graphicsGrantedIds.has(s.discordId!)) {
                                    if (confirm(`Revoke Graphics Studio from ${s.discordUsername ?? s.discordId}?`))
                                      revokeGraphicsStudio.mutate(s.discordId!);
                                  } else {
                                    if (confirm(`Grant Graphics Studio to ${s.discordUsername ?? s.discordId}?`))
                                      grantGraphicsStudio.mutate(s.discordId!);
                                  }
                                }}
                                disabled={grantGraphicsStudio.isPending || revokeGraphicsStudio.isPending}
                                className={cn(
                                  "p-1.5 rounded transition-colors shrink-0",
                                  graphicsGrantedIds.has(s.discordId)
                                    ? "text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
                                    : "text-zinc-600 hover:bg-zinc-700/30 hover:text-zinc-400"
                                )}
                                title={graphicsGrantedIds.has(s.discordId) ? "Revoke Graphics Studio" : "Grant Graphics Studio"}
                              >
                                <Palette className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              data-testid={`button-revoke-session-${s.id}`}
                              onClick={() => {
                                if (confirm(`Revoke session for ${s.email ?? s.tokenMasked}?\n\nThey lose Pro access immediately.`))
                                  revokeSession.mutate(s.sessionToken);
                              }}
                              disabled={revokeSession.isPending}
                              className="p-1.5 rounded hover:bg-red-500/10 text-zinc-700 hover:text-red-400 transition-colors shrink-0"
                              title="Revoke this session"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Row 2: code info + timestamps */}
                          <div className="pl-4 space-y-0.5">
                            {s.codeRef && (
                              <p className="text-[10px] text-zinc-600 font-mono">
                                <span className="text-zinc-700 uppercase font-bold">Code: </span>
                                {isFriend ? (
                                  <span className="text-amber-600">friend link</span>
                                ) : isAdminTest ? (
                                  <span className="text-violet-600">admin test</span>
                                ) : (
                                  <span className="text-zinc-500">{s.codeRef}</span>
                                )}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                              <p className="text-[10px] text-zinc-700">
                                <span className="text-zinc-600">Activated: </span>
                                {s.createdAt ? timeAgo(s.createdAt) : "—"}
                              </p>
                              <p className="text-[10px] text-zinc-700">
                                <span className="text-zinc-600">Last active: </span>
                                {s.lastCheckedAt ? timeAgo(s.lastCheckedAt) : "—"}
                              </p>
                              <p className="text-[10px] text-zinc-800 font-mono">Token: {s.tokenMasked}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          );
        })()}

        {/* ─── ANNOUNCEMENTS TAB ────────────────────────────────────── */}
        {tab === "announcements" && (
          <div className="space-y-4">

            {/* Live Download Status */}
            {(() => {
              const rd = resolvedDownloadQ.data;
              const sourceLabels: Record<string, string> = {
                github: "GitHub Release",
                local: "Local file",
                env: "DOWNLOAD_URL env",
                admin_override: "Admin override",
                none: "No installer",
                error: "Error",
              };
              const sourceColors: Record<string, string> = {
                github: "border-emerald-500/25 bg-emerald-500/[0.04]",
                local: "border-blue-500/25 bg-blue-500/[0.04]",
                env: "border-yellow-500/25 bg-yellow-500/[0.04]",
                admin_override: "border-yellow-500/25 bg-yellow-500/[0.04]",
                none: "border-zinc-700 bg-white/[0.02]",
                error: "border-red-500/25 bg-red-500/[0.04]",
              };
              const dotColors: Record<string, string> = {
                github: "bg-emerald-400 animate-pulse",
                local: "bg-blue-400 animate-pulse",
                env: "bg-yellow-400 animate-pulse",
                admin_override: "bg-yellow-400 animate-pulse",
                none: "bg-zinc-600",
                error: "bg-red-400",
              };
              const labelColors: Record<string, string> = {
                github: "text-emerald-400",
                local: "text-blue-400",
                env: "text-yellow-400",
                admin_override: "text-yellow-400",
                none: "text-zinc-500",
                error: "text-red-400",
              };
              const src = rd?.source ?? "none";
              return (
                <div
                  className={`rounded-xl border p-4 space-y-2 ${sourceColors[src] ?? "border-zinc-700 bg-white/[0.02]"}`}
                  data-testid="section-live-download"
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${dotColors[src] ?? "bg-zinc-600"}`} />
                    <span className={`text-xs font-bold uppercase tracking-wider ${labelColors[src] ?? "text-zinc-500"}`}>
                      Live download — {sourceLabels[src] ?? src}
                    </span>
                  </div>
                  {rd ? (
                    <div className="space-y-1 text-[11px] pl-4">
                      {rd.version && (
                        <div className="text-zinc-400">
                          Version served: <span className="text-white font-mono font-bold">v{rd.version}</span>
                        </div>
                      )}
                      {rd.url && (
                        <div className="text-zinc-400 truncate">
                          URL: <span className="text-zinc-300 font-mono">{rd.url}</span>
                        </div>
                      )}
                      {rd.filename && (
                        <div className="text-zinc-400">
                          File: <span className="text-zinc-300 font-mono">{rd.filename}</span>
                        </div>
                      )}
                      {src === "none" && (
                        <div className="text-zinc-500">No installer is available yet. Set DOWNLOAD_URL, drop an .exe in client/public/downloads/, or publish a GitHub Release.</div>
                      )}
                    </div>
                  ) : (
                    <div className="text-[10px] text-zinc-600 pl-4">Resolving…</div>
                  )}
                </div>
              );
            })()}

            {/* GitHub Auto-Detect */}
            <div className={`rounded-xl border p-4 space-y-3 ${ghReleaseQ.data?.version ? "border-emerald-500/25 bg-emerald-500/[0.04]" : "border-zinc-700 bg-white/[0.02]"}`} data-testid="section-version-updates">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${ghReleaseQ.data?.version ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"}`} />
                  <span className={`text-xs font-bold uppercase tracking-wider ${ghReleaseQ.data?.version ? "text-emerald-400" : "text-zinc-500"}`}>
                    {ghReleaseQ.data?.version ? "GitHub auto-detect: live" : "GitHub auto-detect: offline"}
                  </span>
                </div>
                <button
                  data-testid="button-gh-refresh"
                  onClick={refreshGhRelease}
                  disabled={ghRefreshing}
                  className="text-zinc-400 hover:text-white text-[10px] font-mono border border-white/10 rounded px-2 py-0.5 hover:border-white/20 transition-colors disabled:opacity-40"
                >
                  {ghRefreshing ? "…" : "↺ Refresh"}
                </button>
              </div>

              {ghReleaseQ.data?.version ? (
                <div className="space-y-1 text-[11px] pl-4">
                  <div className="text-zinc-400">Version: <span className="text-white font-mono font-bold">v{ghReleaseQ.data.version}</span></div>
                  <div className="text-zinc-400 truncate">Download: <span className="text-zinc-300 font-mono">{ghReleaseQ.data.exeUrl ?? "—"}</span></div>
                  {ghReleaseQ.data.fetchedAt && (
                    <div className="text-zinc-600">Cached {Math.round((Date.now() - ghReleaseQ.data.fetchedAt) / 60000)}m ago · auto-refreshes every 10m</div>
                  )}
                </div>
              ) : (
                <p className="text-[10px] text-zinc-600 pl-4">Could not reach GitHub. Use the override below to force an update prompt.</p>
              )}
            </div>

            <p className="text-[10px] text-zinc-600 leading-relaxed">
              Push to GitHub → Actions builds the .exe → Replit detects the new release within 10 min → anyone on an older version sees the update splash on next launch. <span className="text-zinc-400">No action needed.</span>
            </p>

            {/* Manual override — only needed to force/test */}
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 space-y-3">
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Force override <span className="text-zinc-600 normal-case font-normal">(leave blank to use GitHub auto)</span></h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1 block">Latest version</label>
                  <input
                    data-testid="input-version-latest"
                    value={verLatest}
                    onChange={e => setVerLatest(e.target.value)}
                    placeholder={ghReleaseQ.data?.version ? `Auto: ${ghReleaseQ.data.version}` : "e.g. 2.3.7"}
                    className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-red-500/40"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1 block">Download URL</label>
                  <input
                    data-testid="input-version-cmd-url"
                    value={verCmdUrl}
                    onChange={e => setVerCmdUrl(e.target.value)}
                    placeholder={ghReleaseQ.data?.exeUrl ?? "Auto from GitHub"}
                    className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-red-500/40"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  data-testid="button-save-version-settings"
                  onClick={saveVersionSettings}
                  disabled={verSaving}
                  className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold"
                >
                  {verSaving ? "Saving…" : "Save"}
                </Button>
              </div>
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

        {tab === "security" && <SecurityTab headers={headers} />}
        {tab === "preset" && (
          <AdminPresetGenerator
            key={presetFillKey}
            initialValues={presetFillData ?? undefined}
            allHardware={[
              // Native scan rigs first (most recent, richest data — from instant native scan)
              ...(rigsDetectedQuery.data || []).map(r => ({ ...r, source: "rig" as const })),
              // Then code-linked hardware snapshots (may have OS version info)
              ...(customerHardwareQuery.data || []).map(h => ({ ...h, source: "hw" as const })),
            ]}
            allCodes={(codesQuery.data || []).map(c => ({ code: c.code, note: c.note ?? null }))}
            apiKey={key}
          />
        )}

        {tab === "aether" && <AetherAdminChat headers={headers} />}
        {tab === "tickets" && <TicketsTab headers={headers} />}
        {tab === "pro" && <ProUsersTab headers={headers} />}
        {tab === "discounts" && <DiscountsTab headers={headers} />}
        {tab === "rigs" && <HardwareDbTab headers={headers} />}
        {tab === "suggestions" && <SuggestionsInboxTab headers={headers} />}
        {tab === "drivers" && <NvidiaTrackerTab headers={headers} />}

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

              {/* Security / Aether Shortcut */}
              <button
                data-testid="mobile-fab-security"
                onClick={() => setTab("security")}
                className={cn(
                  "relative flex items-center justify-center w-12 h-12 rounded-xl border transition-all active:scale-95",
                  tab === "security"
                    ? "bg-red-500/15 border-red-500/40 text-red-400"
                    : "bg-zinc-800/80 border-zinc-700 text-zinc-400"
                )}
                title="Aether Security"
              >
                <Shield className="w-5 h-5" />
              </button>

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
