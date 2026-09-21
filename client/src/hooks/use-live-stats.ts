import { useState, useEffect, useRef } from "react";
import { isNative, readLivePerformance } from "@/lib/tauri-bridge";

export interface LiveStats {
  cpuUsage: number;
  gpuUsage: number;
  ramUsedGB: number;
  ramTotalGB: number;
  ramPct: number;
  cpuTemp: number | null;
  gpuTemp: number | null;
  cpuHistory: number[];
  gpuHistory: number[];
  isLive: boolean;
  isStale: boolean;
}

interface HwLiveResponse {
  live: boolean;
  ts?: number;
  cpu_load_pct?: number;
  gpu_load_pct?: number;
  ram_total_gb?: number;
  ram_free_gb?: number;
  ram_used_pct?: number;
  cpu_temp_c?: number | null;
  gpu_temp_c?: number | null;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function useLiveStats(ramGB: number): LiveStats {
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
    cpuHistory: cpuHistRef.current,
    gpuHistory: gpuHistRef.current,
    isLive:     false,
    isStale:    false,
  });

  useEffect(() => {
    const tick = async () => {
      if (document.hidden) return;

      let realData: HwLiveResponse | null = null;
      try {
        if (isNative()) {
          const native = await readLivePerformance();
          if (native?.live) {
            realData = {
              live: true,
              cpu_load_pct: native.cpu_load_pct ?? undefined,
              gpu_load_pct: native.gpu_load_pct ?? undefined,
              ram_total_gb: native.ram_total_gb ?? undefined,
              ram_free_gb: native.ram_free_gb ?? undefined,
              ram_used_pct: native.ram_used_pct ?? undefined,
              cpu_temp_c: native.cpu_temp_c ?? undefined,
              gpu_temp_c: native.gpu_temp_c ?? undefined,
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

        const snap: LiveStats = {
          cpuUsage:   Math.round(cpu),
          gpuUsage:   Math.round(gpu),
          ramUsedGB:  Math.round(ramUsed * 10) / 10,
          ramTotalGB: ramTotal,
          ramPct:     Math.round(ramPct),
          cpuTemp:    realData.cpu_temp_c ?? null,
          gpuTemp:    realData.gpu_temp_c ?? null,
          cpuHistory: [...cpuHistRef.current],
          gpuHistory: [...gpuHistRef.current],
          isLive:     true,
          isStale:    false,
        };
        lastRealRef.current = snap;
        setStats(snap);
        return;
      }

      // No fresh data — if we have a previous snapshot, show it frozen (isStale)
      if (lastRealRef.current) {
        setStats({ ...lastRealRef.current, isLive: true, isStale: true });
        return;
      }

      // Never invent system telemetry. Keep the last real reading frozen, or
      // show an explicit zero/unknown state until a monitor is available.
      setStats({
        cpuUsage: 0,
        gpuUsage: 0,
        ramUsedGB: 0,
        ramTotalGB: totalRAM,
        ramPct: 0,
        cpuTemp:    null,
        gpuTemp:    null,
        cpuHistory: Array(30).fill(0),
        gpuHistory: Array(30).fill(0),
        isLive:     false,
        isStale:    false,
      });
    };

    const id = setInterval(tick, 2000);
    tick();
    return () => clearInterval(id);
  }, [totalRAM]);

  return stats;
}
