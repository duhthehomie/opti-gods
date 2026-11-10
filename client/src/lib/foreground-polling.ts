/** No hidden/minimized/unfocused Windows scans, and never overlapping polls. */
export function startForegroundPolling(
  task: () => void | Promise<void>, milliseconds: number,
  options: { onPause?: () => void } = {},
): () => void {
  let stopped = false;
  let busy = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const active = () => !document.hidden && document.hasFocus();
  const cancelTimer = () => { clearTimeout(timer); timer = undefined; };
  const run = async () => {
    cancelTimer();
    if (stopped || busy || !active()) return;
    busy = true;
    try { await task(); }
    catch (error) { console.warn("Foreground refresh failed.", error); }
    finally {
      busy = false;
      if (!stopped && active()) timer = setTimeout(() => void run(), milliseconds);
    }
  };
  const changed = () => {
    cancelTimer();
    if (active()) void run();
    else options.onPause?.();
  };
  window.addEventListener("focus", changed);
  window.addEventListener("blur", changed);
  document.addEventListener("visibilitychange", changed);
  void run();
  return () => {
    stopped = true;
    cancelTimer();
    window.removeEventListener("focus", changed);
    window.removeEventListener("blur", changed);
    document.removeEventListener("visibilitychange", changed);
  };
}

/**
 * Like startForegroundPolling, but keeps running while the window is visible
 * and unfocused (e.g. on a second monitor while a game has focus). Only for
 * cheap reads of state that native code already collected.
 */
export function startVisiblePolling(task: () => void | Promise<void>, milliseconds: number): () => void {
  let stopped = false;
  let busy = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const run = async () => {
    clearTimeout(timer);
    timer = undefined;
    if (stopped || busy || document.hidden) return;
    busy = true;
    try { await task(); }
    catch (error) { console.warn("Live refresh failed.", error); }
    finally {
      busy = false;
      if (!stopped && !document.hidden) timer = setTimeout(() => void run(), milliseconds);
    }
  };
  const changed = () => { if (!document.hidden) void run(); };
  document.addEventListener("visibilitychange", changed);
  window.addEventListener("focus", changed);
  void run();
  return () => {
    stopped = true;
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", changed);
    window.removeEventListener("focus", changed);
  };
}

let backgroundStyleInstalled = false;
export function installNativeBackgroundState() {
  if (backgroundStyleInstalled) return;
  backgroundStyleInstalled = true;
  const changed = () => {
    document.documentElement.dataset.nativeBackground = String(document.hidden || !document.hasFocus());
  };
  window.addEventListener("focus", changed);
  window.addEventListener("blur", changed);
  document.addEventListener("visibilitychange", changed);
  changed();
}
