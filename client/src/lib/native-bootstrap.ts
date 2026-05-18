// Boot-time integration of the React app with the Tauri native shell.
//
// Called once from App.tsx on mount. In the browser this is a no-op.
// In the desktop binary it:
//   1. Asks Rust for envInfo() so we can show the admin / non-admin banner.
//   2. Starts the ProBalance background loop.
//
// IMPORTANT — the main window starts with visible:false in tauri.conf.json.
// WebView2 blocks the Win32 message pump for 2-5 s while it initialises;
// if the window were visible during that time Windows would mark it "Not
// Responding".  Instead we call showMainWindow() as the very first action
// here — by the time JS executes, WebView2 is fully initialised and the
// window pops up immediately responsive.
//
// The React BootSplash component then covers the window with the intro
// animation for 3.5 s before fading out — so the user sees a smooth branded
// entrance rather than a raw white flash.
//
// Every subsequent Rust call is wrapped in a withTimeout() guard (5 s cap)
// so a hung IPC command can never freeze the UI.

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

    // Show the window immediately — WebView2 is already initialised by the
    // time this JS runs, so the window appears fully responsive with no
    // "Not Responding" phase visible to the user.
    await showMainWindow();

    // Hard 5 s ceiling on every subsequent Rust IPC call.
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
