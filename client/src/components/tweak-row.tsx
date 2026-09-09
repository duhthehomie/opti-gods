import { useState } from "react";
import { apiUrl } from "@/lib/api-base";
import { Label } from "./ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { AlertTriangle, ShieldAlert, X, Info, Lock, Undo2, Loader2, Zap } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getTweakMeta, SAFETY_LABEL, SAFETY_DESCRIPTION, type TweakSafety } from "@/lib/tweak-registry";
import { useDetectedAntiCheats, type AntiCheatId } from "@/hooks/use-detected-anti-cheats";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { getStoredToken } from "@/lib/pro-status";
import { useToast } from "@/hooks/use-toast";
import { applyTweak, createRestorePoint, isNative, undoTweak } from "@/lib/tauri-bridge";
import { getNativeAuthHeaders } from "@/lib/queryClient";

const NATIVE_UNDO_KEY = "optigods-native-undo-tokens";
const RESTORE_CREATED_KEY = "optigods-native-restore-created";

function readNativeUndoToken(id: string): string | null {
  try {
    const tokens = JSON.parse(localStorage.getItem(NATIVE_UNDO_KEY) || "{}") as Record<string, string>;
    return tokens[id] || null;
  } catch {
    return null;
  }
}

function writeNativeUndoToken(id: string, token: string | null) {
  try {
    const tokens = JSON.parse(localStorage.getItem(NATIVE_UNDO_KEY) || "{}") as Record<string, string>;
    if (token) tokens[id] = token;
    else delete tokens[id];
    localStorage.setItem(NATIVE_UNDO_KEY, JSON.stringify(tokens));
  } catch { /* storage is best-effort */ }
}

interface TweakRowProps {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  delay?: number;
  badge?: string;
  impact?: "HIGH" | "MED" | "LOW";
  warning?: string;
  relevanceWarning?: string;
  /** Safety classification. If not passed, looked up in TWEAK_REGISTRY by id. */
  safety?: TweakSafety;
  /** Short ≤140-char plain-English explanation. If not passed, looked up by id. */
  plainEnglish?: string;
}

const IMPACT_STYLES = {
  HIGH: { dot: "bg-red-500", label: "HIGH", text: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
  MED:  { dot: "bg-amber-400", label: "MED",  text: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/20" },
  LOW:  { dot: "bg-zinc-500",  label: "LOW",  text: "text-zinc-500",  bg: "bg-zinc-800 border-zinc-700" },
};

const SAFETY_STYLES: Record<TweakSafety, { dot: string; text: string; bg: string }> = {
  safe:       { dot: "bg-emerald-500", text: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/25" },
  aggressive: { dot: "bg-amber-400",   text: "text-amber-400",   bg: "bg-amber-400/10 border-amber-400/25" },
  expert:     { dot: "bg-red-500",     text: "text-red-400",     bg: "bg-red-500/10 border-red-500/30" },
};

export function TweakRow({ id, title, description, checked, onCheckedChange, delay = 0, badge, impact, warning, relevanceWarning, safety, plainEnglish }: TweakRowProps) {
  const imp = impact ? IMPACT_STYLES[impact] : null;
  const meta = getTweakMeta(id);
  const safetyVal: TweakSafety | null = safety ?? meta?.safety ?? null;
  const plainText = plainEnglish ?? meta?.plainEnglish ?? null;
  const safetyStyle = safetyVal ? SAFETY_STYLES[safetyVal] : null;
  const [pendingEnable, setPendingEnable] = useState(false);
  const [applying, setApplying] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const { toast } = useToast();

  // Task #39 — per-tweak undo. Applied state is set after the user downloads
  // the install script (see script-dialog `markApplied`). Click "Undo" to
  // download a single-tweak reversal PS1 (Pro-gated, server-generated).
  const appliedAt = useOptimizationStore((s) => s.appliedAt[id]);
  const clearApplied = useOptimizationStore((s) => s.clearApplied);
  const markApplied = useOptimizationStore((s) => s.markApplied);
  const setTweakStore = useOptimizationStore((s) => s.setTweak);

  // Anti-cheat awareness: grey out tweaks that an installed AC bans.
  const tweaks = useOptimizationStore((s) => s.tweaks);
  const detectedACs = useDetectedAntiCheats({
    vanguard: tweaks.ACDetectVanguard,
    eac: tweaks.ACDetectEAC,
    battleye: tweaks.ACDetectBattlEyeFACEIT,
  });
  const blockingAC = meta?.incompatibleWith?.find((ac) => detectedACs.has(ac));
  const acBlocked = Boolean(blockingAC) && !checked;

  const runEnable = async () => {
    if (applying) return;
    if (!isNative()) {
      onCheckedChange(true);
      toast({ title: "Tweak selected", description: "It will be included when you run your selected tweaks." });
      return;
    }

    setApplying(true);
    let nativeTicket: string | null = null;
    let osApplied = false;
    try {
      // The server decides eligibility, entitlement, and remaining allowance.
      // No client-side counter or Pro flag is used for authorization.
      const auth = await fetch(apiUrl("/api/performance-allowance/native-ticket"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getNativeAuthHeaders() },
        body: JSON.stringify({
          tweakId: id,
          idempotencyKey: (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`).replace(/[^A-Za-z0-9_-]/g, ""),
        }),
      });
      const authBody = await auth.json().catch(() => ({}));
      if (!auth.ok) throw new Error(authBody?.error || "This tweak is not available on the free allowance.");
      nativeTicket = authBody.ticket || null;
      if (!sessionStorage.getItem(RESTORE_CREATED_KEY)) {
        await createRestorePoint("Before Opti Gods tweak changes").catch(() => null);
        sessionStorage.setItem(RESTORE_CREATED_KEY, "1");
      }
      const nativeAuth = getNativeAuthHeaders()["X-Native-Auth"] || null;
      const result = await applyTweak(id, authBody.ticket, nativeAuth);
      if (!result.ok) throw new Error(result.message || "This tweak needs the script runner.");
      // Persist the OS truth before any fallible ledger network request.
      osApplied = true;
      onCheckedChange(true);
      markApplied([id]);
      writeNativeUndoToken(id, result.undo_token);
      if (result.message.includes("ALLOWANCE_SYNC_PENDING")) {
        toast({ title: "Tweak applied; allowance sync pending", description: "Your Windows change succeeded, but the server did not confirm the allowance. Undo remains available.", variant: "destructive" });
      }
      toast({
        title: "Tweak enabled",
        description: `${result.message}${result.requires_reboot ? " Restart Windows to finish applying it." : ""}`,
      });
    } catch (error) {
      if (nativeTicket && !osApplied) {
        await fetch(apiUrl("/api/performance-allowance/native-ticket/cancel"), {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getNativeAuthHeaders() },
          body: JSON.stringify({ ticket: nativeTicket }),
        }).catch(() => {});
      }
      if (!osApplied) onCheckedChange(false);
      toast({
        title: "Tweak could not be enabled",
        description: error instanceof Error ? error.message : "Nothing was changed.",
        variant: "destructive",
      });
    } finally {
      setApplying(false);
    }
  };

  const handleChange = (val: boolean) => {
    if (acBlocked && val) return;
    if (val && warning && !checked) {
      setPendingEnable(true);
    } else if (val) {
      void runEnable();
    } else {
      onCheckedChange(val);
    }
  };

  const confirmEnable = () => {
    setPendingEnable(false);
    void runEnable();
  };

  const cancelEnable = () => {
    setPendingEnable(false);
  };

  const handleUndo = async () => {
    if (undoing) return;
    setUndoing(true);
    try {
      const nativeToken = readNativeUndoToken(id);
      if (isNative() && nativeToken) {
        const result = await undoTweak(id, nativeToken);
        if (!result.ok) throw new Error(result.message || "Native undo failed");
        setTweakStore(id, false);
        clearApplied(id);
        writeNativeUndoToken(id, null);
        toast({ title: "Tweak undone", description: result.message });
        return;
      }
      const sessionToken = getStoredToken();
      const res = await fetch(apiUrl("/api/script/undo"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, sessionToken }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || `Undo failed (${res.status})`);
      }
      // Server signals (via X-Undo-Available) whether this PS1 truly reverses
      // the tweak. When false, the script only points the user to "Restore
      // Last Working State" — we must NOT mark the tweak as reverted.
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
      if (granular) {
        // Real per-tweak reversal: optimistically untoggle + clear applied marker.
        setTweakStore(id, false);
        clearApplied(id);
        toast({
          title: "Undo script downloaded",
          description: "Run as Administrator to reverse this tweak. A restart may be required.",
        });
      } else {
        // Fallback PS1 only — leave applied state intact so the Undo button stays visible.
        toast({
          title: "No automated undo for this tweak",
          description:
            "The downloaded script will guide you to use Restore Last Working State (Tools & Fixes). This tweak is still marked as applied.",
        });
      }
    } catch (e) {
      toast({ title: "Undo failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setUndoing(false);
    }
  };

  // Full-row click / keyboard toggle. Children that have their own
  // interactive behaviour (info tooltip button, undo button, the visible
  // switch, the safety/badge tooltips) carry `data-no-row-toggle` so the
  // row click handler ignores them.
  const onRowActivate = () => {
    if (acBlocked) return;
    handleChange(!checked);
  };
  const onRowClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (acBlocked) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest?.("[data-no-row-toggle]")) return;
    if (target?.closest?.("button,a,input,textarea,select,[role='button']")) return;
    onRowActivate();
  };
  const onRowKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (acBlocked) return;
    if (e.key === " " || e.key === "Enter") {
      const target = e.target as HTMLElement | null;
      // Don't intercept Space/Enter on inner buttons.
      if (target?.closest?.("button,a,input,textarea,select,[role='button']") && target !== e.currentTarget) return;
      e.preventDefault();
      onRowActivate();
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: delay * 0.04 }}
        role="switch"
        aria-checked={checked}
        aria-disabled={acBlocked || undefined}
        aria-label={title}
        tabIndex={acBlocked ? -1 : 0}
        onClick={onRowClick}
        onKeyDown={onRowKeyDown}
        data-testid={`row-tweak-${id}`}
        className={cn(
          "flex flex-row items-center justify-between rounded-xl border px-6 py-7 sm:px-7 sm:py-8 transition-all duration-200 group",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
          acBlocked ? "cursor-not-allowed" : "cursor-pointer",
          checked
            ? "bg-emerald-500/8 border-emerald-500/40 shadow-[inset_0_0_14px_-6px_rgba(52,211,153,0.22)] hover:border-emerald-500/55 hover:bg-emerald-500/10"
            : "bg-black/40 border-white/5 hover:border-white/15 hover:bg-black/60"
        )}
      >
        <div className="space-y-2 w-[80%]">
          <div className="flex items-center flex-wrap gap-1.5">
            <Label
              htmlFor={id}
              className={cn(
                "text-sm font-medium cursor-pointer transition-colors",
                checked ? "text-white" : "text-zinc-300 group-hover:text-zinc-200"
              )}
            >
              {title}
            </Label>

            {safetyStyle && safetyVal && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    data-testid={`safety-${safetyVal}-${id}`}
                    data-no-row-toggle
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wide cursor-help",
                      safetyStyle.bg, safetyStyle.text
                    )}
                  >
                    <span className={cn("w-1.5 h-1.5 rounded-full", safetyStyle.dot)} />
                    {SAFETY_LABEL[safetyVal]}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs leading-snug">
                  <span className="font-bold">{SAFETY_LABEL[safetyVal]}: </span>
                  {SAFETY_DESCRIPTION[safetyVal]}
                </TooltipContent>
              </Tooltip>
            )}

            {plainText && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    data-testid={`info-${id}`}
                    data-no-row-toggle
                    className="inline-flex items-center justify-center w-4 h-4 rounded-full text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-colors"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    aria-label="Plain-English explanation"
                  >
                    <Info className="w-3 h-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs leading-snug">
                  {plainText}
                </TooltipContent>
              </Tooltip>
            )}

            {warning && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/25 uppercase tracking-wide">
                <AlertTriangle className="w-2.5 h-2.5" />
                CAUTION
              </span>
            )}

            {badge && badge === "DANGER" ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black bg-red-600/20 text-red-400 border border-red-500/40 uppercase tracking-wide shadow-[0_0_6px_-2px_rgba(239,68,68,0.4)]">
                <ShieldAlert className="w-2.5 h-2.5" />
                DANGER
              </span>
            ) : badge ? (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 uppercase tracking-wide">
                {badge}
              </span>
            ) : null}

            {imp && (
              <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wide", imp.bg, imp.text)}>
                <span className={cn("w-1.5 h-1.5 rounded-full", imp.dot)} />
                {imp.label}
              </span>
            )}

            {checked && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-wide">
                ON
              </span>
            )}
          </div>
          <p className="text-[13px] text-zinc-500 leading-loose mt-3">{description}</p>
          {relevanceWarning && (
            <p className="text-[11px] text-zinc-600 mt-1 italic">Note: {relevanceWarning}</p>
          )}
        </div>
        {acBlocked ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                data-testid={`ac-blocked-${id}`}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold bg-zinc-900 text-zinc-500 border border-zinc-800 cursor-not-allowed"
              >
                <Lock className="w-3 h-3" />
                BLOCKED BY {blockingAC?.toUpperCase()}
              </span>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xs text-xs leading-snug">
              {blockingAC} is installed. Enabling this would get you kicked or banned, so the toggle is disabled. Uninstall {blockingAC} (or turn off the matching <code>ACDetect…</code> diagnostic toggle) to re-enable.
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex items-center gap-2 shrink-0" data-no-row-toggle onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              data-testid={`button-tweak-${id}`}
              onClick={(event) => {
                event.stopPropagation();
                if (appliedAt) void handleUndo();
                else handleChange(!checked);
              }}
              disabled={applying || undoing}
              className={cn(
                "inline-flex min-w-[72px] items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-wider transition-colors disabled:opacity-50",
                appliedAt
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                  : checked
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                    : "border-white/10 bg-white/[0.03] text-zinc-300 hover:border-red-500/30 hover:text-white",
              )}
            >
              {applying || undoing ? <Loader2 className="h-3 w-3 animate-spin" /> : appliedAt ? <Undo2 className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
              {applying ? "Applying" : undoing ? "Undoing" : appliedAt ? "Undo" : checked ? "Selected" : "Enable"}
            </button>
          </div>
        )}
      </motion.div>

      {/* Warning confirmation dialog */}
      <AnimatePresence>
        {pendingEnable && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
            onClick={(e) => { if (e.target === e.currentTarget) cancelEnable(); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 8 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-zinc-950 shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-red-500" />

              <div className="p-6 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="shrink-0 w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center">
                    <ShieldAlert className="w-6 h-6 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Caution Required</span>
                    </div>
                    <h3 className="text-base font-bold text-white leading-snug">{title}</h3>
                  </div>
                  <button
                    onClick={cancelEnable}
                    className="shrink-0 p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/5 transition-colors"
                    data-testid={`button-cancel-warning-${id}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="ml-16 px-4 py-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
                  <p className="text-sm text-zinc-300 leading-relaxed">{warning}</p>
                </div>

                <p className="ml-16 text-xs text-zinc-600 leading-relaxed">
                  Opti Gods will apply this directly when a trusted native action is available. Otherwise it will add the tweak to the one-click Run Tweaks queue.
                </p>

                <div className="ml-16 flex items-center gap-3 pt-1">
                  <button
                    data-testid={`button-enable-anyway-${id}`}
                    onClick={confirmEnable}
                    className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold transition-colors"
                  >
                    Run Tweak
                  </button>
                  <button
                    data-testid={`button-cancel-${id}`}
                    onClick={cancelEnable}
                    className="flex-1 py-2.5 rounded-xl border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white text-sm font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
