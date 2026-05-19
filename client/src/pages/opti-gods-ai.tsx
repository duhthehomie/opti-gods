import { useState, useRef, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useProStatus } from "@/lib/pro-status";
import { apiUrl } from "@/lib/api-base";
import { getNativeAuthHeaders } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Send, ImagePlus, X, Zap, Cpu, RotateCcw, ChevronRight, ScanLine, Sparkles, Download, Flag, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { useHardwareInfo } from "@/hooks/use-hardware-info";
import { useOsDetection } from "@/hooks/use-os-detection";

type Message = {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  timestamp: string;
};

const SESSION_KEY = "optigods_ai_session_id";
const HISTORY_KEY = "optigods_ai_history";

function generateSessionId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function getOrCreateSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = generateSessionId();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

const STARTER_QUESTIONS = [
  "Give me a smart FPS preset for my dashboard",
  "How do I fix FiveM lag spikes?",
  "Best NVIDIA settings for RTX 3070?",
  "Why does my Fortnite stutter?",
  "How to reduce Discord CPU usage?",
  "What registry tweaks boost FPS?",
];

const SAVE_PRESET_REGEX = /\[SAVE_PRESET:[^\]]+\]/g;

type SafePresetResponse = {
  profile: string;
  goal: string;
  hardwareSummary: string;
  core: string[];
  expert: string[];
  blocked: { id: string; reason: string }[];
  reasons: string[];
};

// V2.2 — translates the local useHardwareInfo / useOsDetection signal into
// the PresetHardware shape `/api/ai/preset` expects. Server is the single
// source of truth for what tweaks land in `core` vs `expert`.
function hardwareToPresetPayload(hw: ReturnType<typeof useHardwareInfo>, os: ReturnType<typeof useOsDetection>) {
  const gpuVendor: "nvidia" | "amd" | "intel" | "unknown" =
    hw.isNvidia ? "nvidia" : hw.isAmdGpu || hw.isAmdApu ? "amd" : hw.isIntel ? "intel" : "unknown";
  return {
    gpuVendor,
    gpuName: hw.gpuName || undefined,
    cpuBrand: (hw.cpuBrand as "intel" | "amd" | "unknown") || "unknown",
    cpuLabel: hw.cpuLabel || undefined,
    cpuCores: hw.cpuCores || undefined,
    cpuGeneration: hw.cpuGeneration || undefined,
    ramGB: hw.ramGB || undefined,
    osVersion: (os.isWindows11 ? "win11" : os.isWindows10 ? "win10" : "unknown") as "win11" | "win10" | "unknown",
    isLaptop: Boolean(hw.isLaptop),
    hasDiscreteGpu: hw.isNvidia || hw.isAmdGpu,
  };
}

function SavePresetCard() {
  const { tweaks, setAllTweaks } = useOptimizationStore();
  const { toast } = useToast();
  const hw = useHardwareInfo();
  const os = useOsDetection();
  const [saved, setSaved] = useState(false);
  const [preset, setPreset] = useState<SafePresetResponse | null>(null);
  const [loadingPreset, setLoadingPreset] = useState(false);
  const [optInIds, setOptInIds] = useState<Set<string>>(new Set());

  const isReady = !hw.loading && !os.loading;

  // Fetch the server-resolved preset whenever hardware becomes available.
  useEffect(() => {
    if (!isReady || !hw.scanned) return;
    let cancelled = false;
    setLoadingPreset(true);
    fetch(apiUrl("/api/ai/preset"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getNativeAuthHeaders() },
      body: JSON.stringify({
        hardware: hardwareToPresetPayload(hw, os),
        goal: "balanced",
        optInFlags: Array.from(optInIds),
      }),
    })
      .then(r => r.ok ? r.json() : null)
      .then((p: SafePresetResponse | null) => { if (!cancelled) setPreset(p); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingPreset(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, hw.scanned, hw.gpuName, hw.cpuLabel, os.isWindows11, optInIds]);

  const tweakCount = preset ? preset.core.length + preset.expert.filter(id => optInIds.has(id)).length : 0;

  // If hardware not scanned, show scan prompt
  if (!hw.scanned && isReady) {
    return (
      <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <ScanLine className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Hardware Scan Required</span>
        </div>
        <p className="text-[11px] text-zinc-400 leading-relaxed">
          Run a hardware scan first so the AI can select the exact right tweaks for your GPU, CPU, and OS. Without it, the preset can't be hardware-optimized.
        </p>
        <Link href="/">
          <button
            data-testid="button-go-scan"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white border border-amber-500/40 cursor-pointer transition-all"
          >
            <ScanLine className="w-3.5 h-3.5" />
            Go to Dashboard → Run Scan
          </button>
        </Link>
      </div>
    );
  }

  const save = async () => {
    if (!preset) return;
    const presetTweaks: Record<string, boolean> = {};
    preset.core.forEach(k => { presetTweaks[k] = true; });
    // Only expert tweaks the user explicitly opted in to (red section toggles).
    preset.expert.forEach(k => { if (optInIds.has(k)) presetTweaks[k] = true; });
    try {
      await fetch(apiUrl("/api/presets"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getNativeAuthHeaders() },
        body: JSON.stringify({
          name: `AI Smart Preset — ${preset.profile}`,
          config: { tweaks: presetTweaks },
        }),
      });
      setAllTweaks({ ...tweaks, ...presetTweaks });
      setSaved(true);
      toast({
        title: "Smart Preset saved!",
        description: `${Object.keys(presetTweaks).length} hardware-matched tweaks applied. Download your script to activate.`,
      });
    } catch {
      toast({ title: "Save failed", description: "Try again.", variant: "destructive" });
    }
  };

  if (loadingPreset && !preset) {
    return (
      <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/5 p-3">
        <p className="text-[11px] text-zinc-500">Resolving smart preset for your hardware…</p>
      </div>
    );
  }
  if (!preset) {
    return (
      <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
        <p className="text-[11px] text-amber-400">Preset build failed — try again or pick tweaks manually.</p>
      </div>
    );
  }

  const toggleOptIn = (id: string) => {
    setOptInIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setSaved(false);
  };

  return (
    <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/5 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Zap className="w-4 h-4 text-red-400 shrink-0" />
        <span className="text-xs font-bold text-red-400 uppercase tracking-wider">
          AI Smart Preset — {preset.profile}
        </span>
      </div>
      <p className="text-[11px] text-zinc-400 leading-relaxed">
        {preset.core.length} hardware-matched tweaks for <span className="text-zinc-300">{preset.hardwareSummary}</span>. Every tweak is GPU/CPU/OS-compatible — no AMD tweaks on NVIDIA, no Win11-only tweaks on Win10.
      </p>

      {preset.blocked.length > 0 && (
        <div data-testid="blocked-section" className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-2.5 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
              Withheld for safety ({preset.blocked.length})
            </span>
          </div>
          <p className="text-[10px] text-zinc-500 leading-relaxed">
            These tweaks were refused for your system. Hover to see why.
          </p>
          <ul className="space-y-0.5">
            {preset.blocked.slice(0, 8).map(b => (
              <li
                key={b.id}
                data-testid={`blocked-${b.id}`}
                title={b.reason}
                className="text-[10px] font-mono text-zinc-400 truncate"
              >
                <span className="text-amber-400">✗</span> {b.id} <span className="text-zinc-600">— {b.reason.length > 70 ? b.reason.slice(0, 70) + "…" : b.reason}</span>
              </li>
            ))}
            {preset.blocked.length > 8 && (
              <li className="text-[10px] text-zinc-600 italic">+ {preset.blocked.length - 8} more</li>
            )}
          </ul>
        </div>
      )}

      {preset.expert.length > 0 && (
        <div data-testid="advanced-optin-section" className="rounded-lg border border-red-500/40 bg-red-950/30 p-2.5 space-y-2">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
            <span className="text-[10px] font-black uppercase tracking-widest text-red-400">
              Advanced — Opt-in Only ({preset.expert.length})
            </span>
          </div>
          <p className="text-[10px] text-zinc-500 leading-relaxed">
            These tweaks gave V1 users BSODs / FiveM crashes / boot hangs. They're NOT in the preset unless you explicitly tick them.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {preset.expert.map(id => (
              <button
                key={id}
                data-testid={`button-optin-${id}`}
                onClick={() => toggleOptIn(id)}
                className={cn(
                  "px-2 py-1 rounded text-[10px] font-mono border transition-all",
                  optInIds.has(id)
                    ? "bg-red-600 text-white border-red-500"
                    : "bg-zinc-900 text-zinc-400 border-zinc-700 hover:border-red-500/40 hover:text-zinc-200"
                )}
              >
                {optInIds.has(id) ? "✓ " : ""}{id}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        data-testid="button-save-preset"
        onClick={save}
        disabled={saved}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
          saved
            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-default"
            : "bg-red-600 hover:bg-red-500 text-white border border-red-500/40 cursor-pointer"
        )}
      >
        <Download className="w-3.5 h-3.5" />
        {saved ? "Saved to Dashboard ✓" : `Save ${tweakCount} Tweaks to Dashboard`}
      </button>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-3 justify-start">
      <div className="w-7 h-7 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center shrink-0">
        <Zap className="w-3.5 h-3.5 text-red-400" />
      </div>
      <div className="bg-zinc-900 border border-white/5 rounded-2xl rounded-bl-sm px-4 py-3">
        <div className="flex gap-1.5 items-center h-4">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-bounce [animation-delay:0ms]" />
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-bounce [animation-delay:150ms]" />
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ msg, displayContent }: { msg: Message; displayContent?: string }) {
  const isUser = msg.role === "user";
  const lines = (displayContent ?? msg.content).split("\n");

  const formatted = lines.map((line, i) => {
    if (line.startsWith("**") && line.endsWith("**")) {
      return <p key={i} className="font-bold text-white mt-2 first:mt-0">{line.slice(2, -2)}</p>;
    }
    if (line.startsWith("- ") || line.startsWith("• ")) {
      return (
        <p key={i} className="flex gap-2 mt-1">
          <span className="text-red-400 shrink-0 mt-0.5">•</span>
          <span>{line.slice(2)}</span>
        </p>
      );
    }
    if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^(\d+)\.\s/)?.[1];
      return (
        <p key={i} className="flex gap-2 mt-1">
          <span className="text-red-400 font-bold shrink-0 w-4">{num}.</span>
          <span>{line.replace(/^\d+\.\s/, "")}</span>
        </p>
      );
    }
    if (line.trim() === "") return <div key={i} className="h-1" />;
    return <p key={i} className="mt-1 first:mt-0">{line}</p>;
  });

  return (
    <div className={cn("flex items-end gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center shrink-0">
          <Zap className="w-3.5 h-3.5 text-red-400" />
        </div>
      )}
      <div className={cn(
        "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
        isUser
          ? "bg-red-600/20 border border-red-500/25 text-zinc-200 rounded-br-sm"
          : "bg-zinc-900 border border-white/5 text-zinc-300 rounded-bl-sm"
      )}>
        {msg.imageUrl && (
          <img
            src={msg.imageUrl}
            alt="Uploaded screenshot"
            className="mb-2 rounded-lg max-h-48 object-contain border border-white/10"
          />
        )}
        <div className="space-y-0">{formatted}</div>
        {!isUser && msg.content.includes("Unlock Pro") && (
          <Link href="/get-code">
            <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/25 cursor-pointer hover:bg-red-500/20 transition-colors">
              <Zap className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span className="text-xs font-bold text-red-400">Unlock Pro — Full Scripts & Advanced Tweaks</span>
              <ChevronRight className="w-3 h-3 text-red-500/60 ml-auto" />
            </div>
          </Link>
        )}
      </div>
      {isUser && (
        <div className="w-7 h-7 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center shrink-0">
          <Cpu className="w-3.5 h-3.5 text-zinc-400" />
        </div>
      )}
    </div>
  );
}

function EmptyState({ onSelect }: { onSelect: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 pb-12">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6 box-glow">
        <Zap className="w-8 h-8 text-red-400" />
      </div>
      <h2 className="text-xl font-display font-bold text-white tracking-tight mb-1">
        Opti Gods <span className="text-red-500">AI</span>
      </h2>
      <p className="text-xs text-zinc-500 mb-1">Powered by Aether</p>
      <p className="text-sm text-zinc-400 text-center max-w-xs mb-8 leading-relaxed">
        Ask me anything about FPS, lag, crashes, drivers, registry tweaks, and more. I know every single optimization in this tool.
      </p>
      <div className="w-full max-w-sm space-y-2">
        <p className="text-[10px] uppercase tracking-widest text-zinc-600 mb-3 text-center">Suggested questions</p>
        {STARTER_QUESTIONS.map(q => (
          <button
            key={q}
            data-testid={`button-starter-${q.slice(0, 20).replace(/\s/g, "-")}`}
            onClick={() => onSelect(q)}
            className="w-full text-left px-3.5 py-2.5 rounded-xl bg-zinc-900/60 border border-white/5 text-sm text-zinc-400 hover:text-zinc-200 hover:border-red-500/20 hover:bg-red-500/5 transition-all flex items-center gap-2.5 group"
          >
            <ChevronRight className="w-3.5 h-3.5 text-zinc-700 group-hover:text-red-500/70 shrink-0 transition-colors" />
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

const REPORT_CATEGORIES = [
  { value: "script_not_working", label: "Script Not Working", icon: AlertTriangle },
  { value: "tweak_problem", label: "Tweak Caused a Problem", icon: Flag },
  { value: "crash", label: "Crash / Error", icon: Cpu },
  { value: "other", label: "Other Issue", icon: Flag },
] as const;

function ReportIssueModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const hw = useHardwareInfo();
  const os = useOsDetection();
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!category || description.trim().length < 10) {
      toast({ title: "More detail needed", description: "Pick a category and describe the issue (at least 10 characters).", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const systemInfo: Record<string, unknown> = {};
      if (hw.scanned) {
        if (hw.gpuName) systemInfo.gpu = hw.gpuName;
        if (hw.cpuLabel) systemInfo.cpu = hw.cpuLabel;
        if (hw.ramGB) systemInfo.ram = `${hw.ramGB} GB`;
        if (hw.gpuVendor) systemInfo.gpuVendor = hw.gpuVendor;
      }
      if (os.displayName) systemInfo.os = os.displayName;

      const chatSessionId = localStorage.getItem("optigods_ai_session_id") || undefined;
      const res = await fetch(apiUrl("/api/reports"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getNativeAuthHeaders() },
        body: JSON.stringify({ category, description: description.trim(), systemInfo, sessionId: chatSessionId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Submit failed" }));
        throw new Error(err.error || "Submit failed");
      }
      setSubmitted(true);
      toast({ title: "Report submitted", description: "We'll look into it. Thank you!" });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Submit failed", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={onClose}>
        <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm text-center space-y-3" onClick={e => e.stopPropagation()}>
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
          <h3 className="text-sm font-bold text-white">Report Submitted</h3>
          <p className="text-xs text-zinc-400">We'll review your report and work on a fix. Thank you for helping improve Opti Gods!</p>
          <button
            data-testid="button-report-close"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 border border-white/10 text-xs font-bold text-zinc-300 hover:bg-zinc-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-white/10 rounded-2xl p-5 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-red-400" />
            <h3 className="text-sm font-bold text-white">Report an Issue</h3>
          </div>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 transition-colors" data-testid="button-report-cancel">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Category</p>
          <div className="grid grid-cols-2 gap-2">
            {REPORT_CATEGORIES.map(c => {
              const CIcon = c.icon;
              return (
                <button
                  key={c.value}
                  data-testid={`button-category-${c.value}`}
                  onClick={() => setCategory(c.value)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all border",
                    category === c.value
                      ? "bg-red-500/15 border-red-500/30 text-red-400"
                      : "bg-zinc-800/60 border-white/5 text-zinc-500 hover:text-zinc-300 hover:border-white/10"
                  )}
                >
                  <CIcon className="w-3 h-3 shrink-0" />
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">What happened?</p>
          <textarea
            data-testid="input-report-description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Describe the issue in detail — what were you doing, what went wrong, any error messages…"
            rows={4}
            maxLength={2000}
            className="w-full resize-none bg-zinc-800/80 border border-white/8 rounded-xl px-3 py-2.5 text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-red-500/30 leading-relaxed"
          />
          <p className="text-[9px] text-zinc-700 text-right">{description.length}/2000</p>
        </div>

        {hw.scanned && (
          <div className="bg-zinc-800/40 rounded-lg px-3 py-2 flex items-center gap-2">
            <Cpu className="w-3 h-3 text-zinc-600 shrink-0" />
            <p className="text-[10px] text-zinc-500">
              System info will be attached: {hw.gpuName || "GPU"} • {hw.cpuLabel || "CPU"} • {hw.ramGB || "?"}GB RAM • {os.displayName || "Windows"}
            </p>
          </div>
        )}

        <button
          data-testid="button-submit-report"
          onClick={handleSubmit}
          disabled={submitting || !category || description.trim().length < 10}
          className={cn(
            "w-full py-2.5 rounded-xl text-xs font-bold transition-all",
            submitting || !category || description.trim().length < 10
              ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
              : "bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/20"
          )}
        >
          {submitting ? "Submitting…" : "Submit Report"}
        </button>
      </div>
    </div>
  );
}

export default function OptiGodsAI() {
  const isPro = useProStatus();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sessionId = useRef(getOrCreateSessionId());

  // Load history from localStorage first (instant), then sync from DB
  useEffect(() => {
    const local = localStorage.getItem(HISTORY_KEY);
    if (local) {
      try {
        setMessages(JSON.parse(local));
      } catch {}
    }
    // Also sync from DB
    fetch(apiUrl(`/api/ai/session/${sessionId.current}`), { headers: getNativeAuthHeaders() })
      .then(r => r.json())
      .then(data => {
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages);
          localStorage.setItem(HISTORY_KEY, JSON.stringify(data.messages));
        }
      })
      .catch(() => {})
      .finally(() => setSessionLoaded(true));
  }, []);

  useEffect(() => {
    if (sessionLoaded) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading, sessionLoaded]);

  const handleImageUpload = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Images only", description: "Please upload a PNG, JPG, or WEBP image.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Max 5MB per image.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setImageBase64(result);
      setImagePreview(result);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleImageUpload(file);
  }, []);

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) { e.preventDefault(); handleImageUpload(file); break; }
      }
    }
  }, []);

  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  const sendMessage = async (text?: string) => {
    const msgText = (text ?? input).trim();
    if (!msgText && !imageBase64) return;
    if (isLoading) return;

    const userMsg: Message = {
      role: "user",
      content: msgText || "Here's a screenshot — analyze it for optimization advice.",
      imageUrl: imagePreview ?? undefined,
      timestamp: new Date().toISOString(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(newMessages));
    setInput("");
    setImageBase64(null);
    setImagePreview(null);
    setIsLoading(true);

    // Placeholder streaming message appended immediately so typing indicator is replaced
    const aiPlaceholder: Message = { role: "assistant", content: "", timestamp: new Date().toISOString() };
    const withPlaceholder = [...newMessages, aiPlaceholder];
    setMessages(withPlaceholder);

    try {
      const historyForApi = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));
      const res = await fetch(apiUrl("/api/ai/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getNativeAuthHeaders() },
        body: JSON.stringify({
          message: msgText || "Analyze this screenshot for PC optimization advice.",
          history: historyForApi,
          sessionId: sessionId.current,
          isPro,
          imageBase64: imageBase64 ?? undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(errData.error || "AI request failed");
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      let sseBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split("\n");
        sseBuffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const payload = trimmed.slice(6);
          try {
            const parsed = JSON.parse(payload) as { token?: string; done?: boolean; fullText?: string; error?: string };
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.token) {
              accumulated += parsed.token;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { ...updated[updated.length - 1], content: accumulated };
                return updated;
              });
            }
            if (parsed.done && parsed.fullText) {
              accumulated = parsed.fullText;
            }
          } catch {}
        }
      }

      const finalMsg: Message = { role: "assistant", content: accumulated, timestamp: new Date().toISOString() };
      const finalMessages = [...newMessages, finalMsg];
      setMessages(finalMessages);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(finalMessages));
    } catch (err: unknown) {
      setMessages(newMessages);
      const errMsg = err instanceof Error ? err.message : "Could not reach Opti Gods AI.";
      toast({ title: "AI error", description: errMsg, variant: "destructive" });
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const clearHistory = () => {
    setMessages([]);
    localStorage.removeItem(HISTORY_KEY);
    const newId = generateSessionId();
    localStorage.setItem(SESSION_KEY, newId);
    sessionId.current = newId;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-0px)] max-h-screen bg-[#060606]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5 bg-[#060606] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
              <Zap className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display font-bold text-white text-sm tracking-tight">
                  Opti Gods <span className="text-red-500">AI</span>
                </h1>
                {isPro && (
                  <span className="text-[8px] font-bold bg-red-600 text-white px-1.5 py-0.5 rounded-sm tracking-widest uppercase leading-none">PRO</span>
                )}
              </div>
              <p className="text-[9px] text-zinc-600 uppercase tracking-widest">Powered by Aether</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isPro && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider">Pro AI Active</span>
              </div>
            )}
            <button
              data-testid="button-report-issue"
              onClick={() => setShowReport(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800/60 border border-white/5 text-zinc-500 hover:text-red-400 hover:border-red-500/20 hover:bg-red-500/5 transition-all"
              title="Report an Issue"
            >
              <Flag className="w-3 h-3" />
              <span className="text-[9px] font-bold uppercase tracking-wider hidden sm:inline">Report</span>
            </button>
            {messages.length > 0 && (
              <button
                data-testid="button-clear-chat"
                onClick={clearHistory}
                className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/5 transition-colors"
                title="Clear chat"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div
          className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
        >
          {messages.length === 0 && !isLoading ? (
            <EmptyState onSelect={q => sendMessage(q)} />
          ) : (
            <>
              {messages.map((msg, i) => {
                if (!msg.content && !msg.imageUrl) return null;
                const hasPreset = msg.role === "assistant" && SAVE_PRESET_REGEX.test(msg.content);
                SAVE_PRESET_REGEX.lastIndex = 0;
                const displayContent = hasPreset ? msg.content.replace(SAVE_PRESET_REGEX, "").trim() : undefined;
                return (
                  <div key={i}>
                    <MessageBubble msg={msg} displayContent={displayContent} />
                    {hasPreset && <div className="ml-10"><SavePresetCard /></div>}
                  </div>
                );
              })}
              {isLoading && (
                messages[messages.length - 1]?.role !== "assistant" ||
                messages[messages.length - 1]?.content === ""
              ) && <TypingIndicator />}
              <div ref={bottomRef} />
            </>
          )}
        </div>

        {/* Image preview */}
        {imagePreview && (
          <div className="px-4 pb-2 shrink-0">
            <div className="relative inline-block">
              <img src={imagePreview} alt="preview" className="h-16 rounded-lg border border-white/10 object-contain" />
              <button
                onClick={() => { setImageBase64(null); setImagePreview(null); }}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center hover:bg-zinc-700 transition-colors"
                data-testid="button-remove-image"
              >
                <X className="w-3 h-3 text-zinc-300" />
              </button>
            </div>
          </div>
        )}

        {/* Input bar */}
        <div className="px-4 pb-4 pt-2 border-t border-white/5 shrink-0 bg-[#060606]">
          <div className="flex items-end gap-2 bg-zinc-900 border border-white/8 rounded-2xl px-3 py-2.5 focus-within:border-red-500/30 transition-colors">
            <button
              data-testid="button-upload-image"
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/5 transition-colors shrink-0 mb-0.5"
              title="Upload screenshot"
            >
              <ImagePlus className="w-4 h-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ""; }}
            />
            <textarea
              ref={inputRef}
              data-testid="input-ai-message"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about FPS, lag, crashes, drivers, tweaks…"
              rows={1}
              disabled={isLoading}
              className="flex-1 resize-none bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none leading-relaxed max-h-32 disabled:opacity-50"
              style={{ height: "auto", minHeight: "24px" }}
              onInput={e => {
                const t = e.currentTarget;
                t.style.height = "auto";
                t.style.height = Math.min(t.scrollHeight, 128) + "px";
              }}
            />
            <button
              data-testid="button-send-message"
              onClick={() => sendMessage()}
              disabled={isLoading || (!input.trim() && !imageBase64)}
              className={cn(
                "p-2 rounded-xl transition-all shrink-0 mb-0.5",
                (!input.trim() && !imageBase64) || isLoading
                  ? "text-zinc-700 bg-zinc-800/50 cursor-not-allowed"
                  : "text-white bg-red-600 hover:bg-red-500 shadow-lg shadow-red-600/20"
              )}
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[9px] text-zinc-700 text-center mt-2">
            Drag & drop or Ctrl+V to paste a screenshot • Shift+Enter for new line
          </p>
        </div>
      </div>
      {showReport && <ReportIssueModal onClose={() => setShowReport(false)} />}
    </AppLayout>
  );
}
