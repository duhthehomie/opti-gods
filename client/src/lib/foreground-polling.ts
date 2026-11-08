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
