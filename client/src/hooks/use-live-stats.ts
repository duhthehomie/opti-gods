import { useState, useEffect, useRef } from "react";

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

  const cpuRef    = useRef(clamp(40 + Math.random() * 30, 20, 90));
  const gpuRef    = useRef(clamp(30 + Math.random() * 40, 10, 85));
  const baseRAMRef = useRef(clamp(totalRAM * 0.42 + Math.random() * 1.5, 1, totalRAM - 0.5));
  const cpuHistRef = useRef<number[]>(Array(30).fill(cpuRef.current));
  const gpuHistRef = useRef<number[]>(Array(30).fill(gpuRef.current));

  const [stats, setStats] = useState<LiveStats>({
    cpuUsage: cpuRef.current,
    gpuUsage: gpuRef.current,
    ramUsedGB: baseRAMRef.current,
    ramTotalGB: totalRAM,
    ramPct: (baseRAMRef.current / totalRAM) * 100,
    cpuTemp: null,
    gpuTemp: null,
    cpuHistory: cpuHistRef.current,
    gpuHistory: gpuHistRef.current,
    isLive: false,
  });

  useEffect(() => {
    let cpuTarget = cpuRef.current;
    let gpuTarget = gpuRef.current;
    let isReallyLive = false;

    const tick = async () => {
      if (document.hidden) return;

      // Try to fetch real data from the live monitor script
      let realData: HwLiveResponse | null = null;
      try {
        const resp = await fetch("/api/hw-live", { signal: AbortSignal.timeout(1500) });
        if (resp.ok) {
          const json: HwLiveResponse = await resp.json();
          if (json.live) realData = json;
        }
      } catch {
        // server unreachable or stale — fall through to simulation
      }

      if (realData) {
        isReallyLive = true;
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

        setStats({
          cpuUsage:   Math.round(cpu),
          gpuUsage:   Math.round(gpu),
          ramUsedGB:  Math.round(ramUsed * 10) / 10,
          ramTotalGB: ramTotal,
          ramPct:     Math.round(ramPct),
          cpuTemp:    realData.cpu_temp_c ?? null,
          gpuTemp:    realData.gpu_temp_c ?? null,
          cpuHistory: [...cpuHistRef.current],
          gpuHistory: [...gpuHistRef.current],
          isLive: true,
        });
        return;
      }

      // Simulation fallback
      if (isReallyLive) {
        isReallyLive = false;
      }
      const cpuDrift = (Math.random() - 0.5) * 18;
      const gpuDrift = (Math.random() - 0.5) * 22;
      cpuTarget = clamp(cpuTarget + cpuDrift, 12, 94);
      gpuTarget = clamp(gpuTarget + gpuDrift, 8, 96);
      cpuRef.current = clamp(lerp(cpuRef.current, cpuTarget, 0.25), 5, 98);
      gpuRef.current = clamp(lerp(gpuRef.current, gpuTarget, 0.25), 5, 98);
      cpuHistRef.current.shift(); cpuHistRef.current.push(cpuRef.current);
      gpuHistRef.current.shift(); gpuHistRef.current.push(gpuRef.current);

      const base = baseRAMRef.current;
      const ramUsed = clamp(base + (Math.random() - 0.5) * 0.4, 1, totalRAM - 0.2);

      setStats({
        cpuUsage:   Math.round(cpuRef.current),
        gpuUsage:   Math.round(gpuRef.current),
        ramUsedGB:  Math.round(ramUsed * 10) / 10,
        ramTotalGB: totalRAM,
        ramPct:     Math.round((ramUsed / totalRAM) * 100),
        cpuTemp:    null,
        gpuTemp:    null,
        cpuHistory: [...cpuHistRef.current],
        gpuHistory: [...gpuHistRef.current],
        isLive: false,
      });
    };

    const id = setInterval(tick, 2000);
    tick(); // immediate first read
    return () => clearInterval(id);
  }, [totalRAM]);

  return stats;
}
