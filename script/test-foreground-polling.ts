import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { startForegroundPolling } from "../client/src/lib/foreground-polling";

async function main() {
  const saved = { window: globalThis.window, document: globalThis.document,
    setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
  const events = new EventTarget();
  const doc = new EventTarget();
  let focused = true, hidden = false, id = 0;
  const timers = new Map<number, () => void>();
  Object.assign(doc, { hasFocus: () => focused });
  Object.defineProperty(doc, "hidden", { get: () => hidden });
  globalThis.window = events as unknown as Window & typeof globalThis;
  globalThis.document = doc as unknown as Document;
  globalThis.setTimeout = ((fn: () => void) => {
    timers.set(++id, fn); return id;
  }) as unknown as typeof setTimeout;
  globalThis.clearTimeout = ((value: number) => { timers.delete(value); }) as unknown as typeof clearTimeout;
  let stop = () => {};
  try {
    let calls = 0, pauses = 0, release: (() => void) | undefined;
    stop = startForegroundPolling(() => {
      calls++;
      return new Promise<void>(resolve => { release = resolve; });
    }, 1000, { onPause: () => { pauses++; } });
    assert.equal(calls, 1);
    events.dispatchEvent(new Event("focus"));
    assert.equal(calls, 1, "Focus must not overlap an existing native scan");
    focused = false;
    events.dispatchEvent(new Event("blur"));
    assert.equal(pauses, 1);
    release!();
    await Promise.resolve(); await Promise.resolve();
    assert.equal(timers.size, 0, "A pending scan must not restart background polling");
    focused = true;
    events.dispatchEvent(new Event("focus"));
    assert.equal(calls, 2, "Refocusing resumes a fresh reading");
    release!();
    await Promise.resolve(); await Promise.resolve();
    assert.equal(timers.size, 1);
    hidden = true;
    doc.dispatchEvent(new Event("visibilitychange"));
    assert.equal(timers.size, 0, "Minimizing cancels the next scheduled scan");
    stop();
    hidden = false;
    events.dispatchEvent(new Event("focus"));
    assert.equal(calls, 2, "Unmounting removes focus listeners");
    assert(!readFileSync("client/src/lib/native-bootstrap.ts", "utf8").includes("startProBalance("),
      "Simply launching Opti Gods must never start reprioritizing processes");
    const sensorFile = "src-tauri/src/commands/cpu_sensors.rs";
    if (existsSync(sensorFile)) {
      const sensors = readFileSync(sensorFile, "utf8");
      assert(sensors.includes("MONITORING_FOREGROUND"));
      assert(sensors.includes("paused_while_unfocused"));
      assert(sensors.includes("child.kill()") && sensors.includes("child.wait()"));
      assert(sensors.includes("reader.attempted = None"));
      assert(readFileSync("src-tauri/src/lib.rs", "utf8").includes("WindowEvent::Focused(focused)"));
      assert(!readFileSync("client/src/App.tsx", "utf8").includes("NATIVE_NAV_PRELOADERS[index++]()"));
    }
    console.log("PASS: focused-only polling, no overlap, pause/minimize, resumption, cleanup, no automatic ProBalance.");
  } finally {
    stop();
    Object.assign(globalThis, saved);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
