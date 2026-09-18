// Boot-time integration of the React app with the Tauri native shell.
//
// Called once from App.tsx on mount. In the browser this is a no-op.
// In the desktop binary it:
//   1. Asks Rust for envInfo() so we can show the admin / non-admin banner.
//   2. Starts the ProBalance background loop.
//
// Window visibility is handled entirely in Rust (lib.rs on_page_load).
// JS does NOT call any show/hide window commands.
//
// Every Rust call is wrapped in withTimeout() — a hung IPC command can
// never freeze the UI. The app is fully usable without any of these calls.

import {
  envInfo,
  startProBalance,
  showMainWindow,
  scanHardware,
  isNative,
  startupRestoreCheckpoint,
  type NativeEnvInfo,
  type NativeStartupRestoreResult,
} from "@/lib/tauri-bridge";
import { getScannedInfo, saveScannedInfo } from "@/hooks/use-hardware-info";
import { toast } from "@/hooks/use-toast";
import { setNativeRestoreReadiness } from "@/lib/native-readiness";

export interface NativeBootResult {
  native: boolean;
  env: NativeEnvInfo | null;
  restore: NativeStartupRestoreResult | null;
}

/** Race a promise against a timeout. Resolves with null on timeout. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) =>
      setTimeout(() => {
        console.warn(`[native] ${label} timed out after ${ms}ms — continuing`);
        resolve(null);
      }, ms),
    ),
  ]);
}

let _bootPromise: Promise<NativeBootResult> | null = null;

export function bootstrapNative(): Promise<NativeBootResult> {
  if (_bootPromise) return _bootPromise;
  _bootPromise = (async () => {
    if (!isNative()) {
      return { native: false, env: null, restore: null };
    }
    setNativeRestoreReadiness({
      ok: false,
      status: "checking",
      repair_attempted: false,
      restore_point: null,
      message: "Checking System Protection and creating a verified launch restore point…",
      recovery: "Native tweak controls will unlock after this check completes.",
    });

    // Step 1 — Show the window FIRST, before any other work.
    // The window starts with visible:false so WebView2 initialises hidden
    // (avoiding the Win32 "Not Responding" freeze the user would otherwise
    // see). By the time JS executes, WebView2 is fully ready, so calling
    // showMainWindow() here makes the window appear instantly responsive.
    try {
      await withTimeout(showMainWindow(), 3_000, "showMainWindow");
    } catch (err) {
      console.warn("[native] showMainWindow failed", err);
    }

    // Step 2 — establish the verified rollback point before any other native
    // work.  The Rust apply command independently enforces this too.
    let restore: NativeStartupRestoreResult | null = null;
    try {
      restore = await withTimeout(startupRestoreCheckpoint(), 15_000, "startupRestoreCheckpoint");
      if (!restore) {
        restore = {
          ok: false,
          status: "verification_failed",
          repair_attempted: false,
          restore_point: null,
          message: "Windows did not report the launch restore point within 15 seconds.",
          recovery: "Native tweaks remain paused. Check System Protection for C:, then restart Opti Gods and retry.",
        };
      }
      if (restore?.ok) {
        setNativeRestoreReadiness(restore);
        const point = restore.restore_point;
        toast({
          title: "Restore point ready",
          description: point
            ? `${point.label} (#${point.sequence_number}) was verified${restore.repair_attempted ? " after checking System Protection" : ""}. Native tweaks are protected.`
            : restore.message,
          variant: "success",
        });
      } else if (restore) {
        setNativeRestoreReadiness(restore);
        toast({
          title: "Native tweaks are paused",
          description: `${restore.message} ${restore.recovery}`,
          variant: "destructive",
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      restore = {
        ok: false,
        status: "creation_failed",
        repair_attempted: false,
        restore_point: null,
        message: `The launch restore-point check failed: ${message}`,
        recovery: "Run as administrator, turn on System Protection for C:, then restart and retry.",
      };
      toast({
        title: "Native tweaks are paused",
        description: `${restore.message} ${restore.recovery}`,
        variant: "destructive",
      });
      setNativeRestoreReadiness(restore);
    }

    // Step 3 — gather env info and start ProBalance (non-blocking).
    let env: NativeEnvInfo | null = null;
    try {
      env = await withTimeout(envInfo(), 5_000, "envInfo");
    } catch (err) {
      console.warn("[native] envInfo failed", err);
    }

    if (restore?.ok) {
      try {
        await withTimeout(startProBalance(), 5_000, "startProBalance");
      } catch (err) {
        console.warn("[native] startProBalance failed", err);
      }
    } else {
      console.info("[native] ProBalance held until restore readiness is verified");
    }

    // Step 4 — silent auto-scan if no hardware data exists yet.
    // Replaces the web onboarding wizard entirely in the .exe.
    if (!getScannedInfo()) {
      try {
        const hw = await withTimeout(scanHardware(), 10_000, "autoScan");
        if (hw) {
          saveScannedInfo({ GPU: hw.gpu, CPU: hw.cpu, RAM_GB: hw.ram_gb ?? undefined });
          console.info("[native] Auto-scan complete — hardware stored silently");
        }
      } catch (err) {
        console.warn("[native] Auto-scan failed (non-fatal)", err);
      }
    }

    return { native: true, env, restore };
  })();
  return _bootPromise;
}

/** Clear the cached boot promise so the visible Retry action can re-check Windows. */
export function retryNativeBootstrap(): Promise<NativeBootResult> {
  _bootPromise = null;
  return bootstrapNative();
}
