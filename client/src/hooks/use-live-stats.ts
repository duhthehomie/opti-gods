import { useState, useEffect, useRef } from "react";
import { isNative, readLivePerformance } from "@/lib/tauri-bridge";

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
        const ramTotal = realData.ram_total_gb ?? totalRAM;
        const ramFree  = realData.ram_free_gb ?? 0;
        const ramUsed  = ramTotal - ramFree;
        const ramPct   = realData.ram_used_pct ?? Math.round((ramUsed / ramTotal) * 100);
        const cpu      = realData.cpu_load_pct ?? cpuRef.current;
        const gpu      = realData.gpu_load_pct ?? gpuRef.current;

        cpuRef.current = cpu;
        gpuRef.current = gpu;
        cpuHistRef.current.shift(); cpuHistRef.current.push(cpu);
        gpuHistRef.current.shift(); gpuHistRef.current.push(gpu);

        const importedTemps = isNative() ? { cpuTemp: null, gpuTemp: null } : readImportedSensorTemps();
        const cpuTemp = realData.cpu_temp_c ?? importedTemps.cpuTemp;
        const gpuTemp = realData.gpu_temp_c ?? importedTemps.gpuTemp;
        const snap: LiveStats = {
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

    const id = setInterval(tick, temperaturesOnly ? 1000 : 2000);
    tick();
    return () => { cancelled = true; clearInterval(id); };
  }, [totalRAM, temperaturesOnly]);

  return stats;
}
