import { useState, useEffect, useRef } from "react";
import { isNative, readLivePerformance } from "@/lib/tauri-bridge";
import { startForegroundPolling } from "@/lib/foreground-polling";

let nativeTelemetryRequest: ReturnType<typeof readLivePerformance> | null = null;
let nativeTemperatureRequest: ReturnType<typeof readLivePerformance> | null = null;
function readSharedNativeTelemetry(temperaturesOnly: boolean) {
  if (temperaturesOnly) {
    if (!nativeTemperatureRequest) {
      nativeTemperatureRequest = readLivePerformance(true).finally(() => { nativeTemperatureRequest = null; });
    }
    return nativeTemperatureRequest;
  }
  if (!nativeTelemetryRequest) {
    nativeTelemetryRequest = readLivePerformance().finally(() => { nativeTelemetryRequest = null; });
  }
  return nativeTelemetryRequest;
}

export interface LiveStats {
  sampledAt?: number;
  cpuSensorStatus?: string;
  cpuSensorName?: string;
  cpuUsage: number;
  gpuUsage: number;
  ramUsedGB: number;
  ramTotalGB: number;
  ramPct: number;
  cpuTemp: number | null;
  gpuTemp: number | null;
  boardTemp?: number | null;
  cpuTempSource: "live" | "imported" | null;
  gpuTempSource: "live" | "imported" | null;
  cpuHistory: number[];
  gpuHistory: number[];
  isLive: boolean;
  isStale: boolean;
  /** False when Windows did not return that reading; render "—", never 0. */
  cpuKnown?: boolean;
  gpuKnown?: boolean;
  ramKnown?: boolean;
  /** Partial native telemetry failure, shown instead of hidden behind zeros. */
  telemetryError?: string;
}

interface HwLiveResponse {
  cpu_sensor_status?: string;
  cpu_sensor_name?: string;
  live: boolean;
  ts?: number;
  cpu_load_pct?: number;
  gpu_load_pct?: number;
  ram_total_gb?: number;
  ram_free_gb?: number;
  ram_used_pct?: number;
  cpu_temp_c?: number | null;
  gpu_temp_c?: number | null;
  board_temp_c?: number | null;
  sampled_at_ms?: number;
  telemetry_error?: string;
}

function readImportedSensorTemps(): { cpuTemp: number | null; gpuTemp: number | null } {
  try {
    const raw = localStorage.getItem("optigods-hwmonitor-data");
    if (!raw) return { cpuTemp: null, gpuTemp: null };
    const data = JSON.parse(raw) as Record<string, unknown>;
    const read = (value: unknown): number | null => {
      const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
      return Number.isFinite(number) && number > 5 && number < 130 ? number : null;
    };
    return { cpuTemp: read(data.cpu_temp_c), gpuTemp: read(data.gpu_temp_c) };
  } catch {
    return { cpuTemp: null, gpuTemp: null };
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function useLiveStats(ramGB: number, temperaturesOnly = false): LiveStats {
  const totalRAM = ramGB > 0 ? ramGB : 16;

  const cpuRef = useRef(0);
  const gpuRef = useRef(0);
  const cpuHistRef = useRef<number[]>(Array(30).fill(0));
  const gpuHistRef = useRef<number[]>(Array(30).fill(0));

  // Last snapshot received from the BAT — kept forever so data never blanks out
  const lastRealRef = useRef<LiveStats | null>(null);

  const [stats, setStats] = useState<LiveStats>({
    cpuUsage:   0,
    gpuUsage:   0,
    ramUsedGB:  0,
    ramTotalGB: totalRAM,
    ramPct:     0,
    cpuTemp:    null,
    gpuTemp:    null,
    cpuTempSource: null,
    gpuTempSource: null,
    cpuHistory: cpuHistRef.current,
    gpuHistory: gpuHistRef.current,
    isLive:     false,
    isStale:    false,
  });

  useEffect(() => {
    let inFlight = false;
    let cancelled = false;
    const tick = async () => {
      if (document.hidden || inFlight || cancelled) return;
      inFlight = true;

      let realData: HwLiveResponse | null = null;
      try {
        if (isNative()) {
          const native = await readSharedNativeTelemetry(temperaturesOnly);
          if (native && (native.live || native.cpu_sensor_status)) {
            realData = {
              live: native.live,
              cpu_load_pct: native.cpu_load_pct ?? undefined,
              gpu_load_pct: native.gpu_load_pct ?? undefined,
              ram_total_gb: native.ram_total_gb ?? undefined,
              ram_free_gb: native.ram_free_gb ?? undefined,
              ram_used_pct: native.ram_used_pct ?? undefined,
              cpu_temp_c: native.cpu_temp_c ?? undefined,
              gpu_temp_c: native.gpu_temp_c ?? undefined,
              board_temp_c: native.board_temp_c ?? undefined,
              cpu_sensor_status: native.cpu_sensor_status ?? undefined,
              cpu_sensor_name: native.cpu_sensor_name ?? undefined,
              sampled_at_ms: native.sampled_at_ms ?? undefined,
              telemetry_error: native.telemetry_error ?? undefined,
            };
          }
        } else {
          const resp = await fetch("/api/hw-live", { signal: AbortSignal.timeout(1500) });
          if (resp.ok) {
            const json: HwLiveResponse = await resp.json();
            if (json.live) realData = json;
          }
        }
      } catch {
        // server unreachable or stale — fall through
      }
      inFlight = false;
      if (cancelled) return;

      if (realData) {
        // A missing reading stays unknown. Defaulting free RAM to 0 used to show 100%.
        const ramKnown = realData.ram_total_gb != null && realData.ram_free_gb != null;
        const ramTotal = realData.ram_total_gb ?? totalRAM;
        const ramUsed  = ramKnown ? ramTotal - (realData.ram_free_gb as number) : 0;
        const ramPct   = ramKnown ? realData.ram_used_pct ?? Math.round((ramUsed / ramTotal) * 100) : 0;
        const cpuKnown = realData.cpu_load_pct != null;
        const gpuKnown = realData.gpu_load_pct != null;
        const cpu      = realData.cpu_load_pct ?? 0;
        const gpu      = realData.gpu_load_pct ?? 0;

        if (cpuKnown) { cpuRef.current = cpu; cpuHistRef.current.shift(); cpuHistRef.current.push(cpu); }
        if (gpuKnown) { gpuRef.current = gpu; gpuHistRef.current.shift(); gpuHistRef.current.push(gpu); }

        const importedTemps = isNative() ? { cpuTemp: null, gpuTemp: null } : readImportedSensorTemps();
        const cpuTemp = realData.cpu_temp_c ?? importedTemps.cpuTemp;
        const gpuTemp = realData.gpu_temp_c ?? importedTemps.gpuTemp;
        const snap: LiveStats = {
          sampledAt: realData.sampled_at_ms ?? Date.now(),
          cpuKnown,
          gpuKnown,
          ramKnown,
          telemetryError: realData.telemetry_error,
          cpuSensorStatus: realData.cpu_sensor_status,
          cpuSensorName: realData.cpu_sensor_name,
          cpuUsage:   Math.round(cpu),
          gpuUsage:   Math.round(gpu),
          ramUsedGB:  Math.round(ramUsed * 10) / 10,
          ramTotalGB: ramTotal,
          ramPct:     Math.round(ramPct),
          cpuTemp,
          gpuTemp,
          boardTemp: realData.board_temp_c ?? null,
          cpuTempSource: realData.cpu_temp_c != null ? "live" : importedTemps.cpuTemp != null ? "imported" : null,
          gpuTempSource: realData.gpu_temp_c != null ? "live" : importedTemps.gpuTemp != null ? "imported" : null,
          cpuHistory: [...cpuHistRef.current],
          gpuHistory: [...gpuHistRef.current],
          isLive:     realData.live,
          isStale:    false,
        };
        lastRealRef.current = snap;
        setStats(snap);
        return;
      }

      const importedTemps = isNative() ? { cpuTemp: null, gpuTemp: null } : readImportedSensorTemps();
      if (lastRealRef.current) {
        const previous = lastRealRef.current;
        setStats({
          ...previous,
          cpuTemp: isNative() ? null : importedTemps.cpuTemp ?? previous.cpuTemp,
          gpuTemp: isNative() ? null : importedTemps.gpuTemp ?? previous.gpuTemp,
          cpuTempSource: importedTemps.cpuTemp != null ? "imported" : previous.cpuTempSource,
          gpuTempSource: importedTemps.gpuTemp != null ? "imported" : previous.gpuTempSource,
          isLive: false,
          isStale: true,
        });
        return;
      }

      // Never invent system telemetry. Imported temperatures are snapshots, not live readings.
      setStats({
        cpuUsage: 0,
        gpuUsage: 0,
        ramUsedGB: 0,
        ramTotalGB: totalRAM,
        ramPct: 0,
        cpuTemp: importedTemps.cpuTemp,
        gpuTemp: importedTemps.gpuTemp,
        cpuTempSource: importedTemps.cpuTemp != null ? "imported" : null,
        gpuTempSource: importedTemps.gpuTemp != null ? "imported" : null,
        cpuHistory: Array(30).fill(0),
        gpuHistory: Array(30).fill(0),
        isLive:     false,
        isStale:    false,
      });
    };

    // Polls are non-overlapping: the next request starts 2 s after the last one returns.
    const stop = startForegroundPolling(tick, 2000, {
      onPause: () => setStats(previous => ({ ...previous, isLive: false, isStale: true })),
    });
    return () => { cancelled = true; stop(); };
  }, [totalRAM, temperaturesOnly]);

  return stats;
}
