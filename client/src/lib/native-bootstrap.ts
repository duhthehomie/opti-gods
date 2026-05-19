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
  isNative,
  type NativeEnvInfo,
} from "@/lib/tauri-bridge";

export interface NativeBootResult {
  native: boolean;
  env: NativeEnvInfo | null;
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
      return { native: false, env: null };
    }

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

    // Step 2 — gather env info and start ProBalance (non-blocking).
    let env: NativeEnvInfo | null = null;
    try {
      env = await withTimeout(envInfo(), 5_000, "envInfo");
    } catch (err) {
      console.warn("[native] envInfo failed", err);
    }

    try {
      await withTimeout(startProBalance(), 5_000, "startProBalance");
    } catch (err) {
      console.warn("[native] startProBalance failed", err);
    }

    return { native: true, env };
  })();
  return _bootPromise;
}
