import { useState, useEffect, useRef } from "react";

export interface LiveStats {
  cpuUsage: number;
  gpuUsage: number;
  ramUsedGB: number;
  ramTotalGB: number;
  ramPct: number;
  cpuTemp: number;
  gpuTemp: number;
  cpuHistory: number[];
  gpuHistory: number[];
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function useLiveStats(ramGB: number): LiveStats {
  const totalRAM = ramGB > 0 ? ramGB : 16;
  const baseUsedRAM = clamp(totalRAM * 0.42 + Math.random() * 1.5, 1, totalRAM - 0.5);

  const cpuRef = useRef(clamp(40 + Math.random() * 30, 20, 90));
  const gpuRef = useRef(clamp(30 + Math.random() * 40, 10, 85));
  const cpuHistRef = useRef<number[]>(Array(30).fill(cpuRef.current));
  const gpuHistRef = useRef<number[]>(Array(30).fill(gpuRef.current));

  const [stats, setStats] = useState<LiveStats>({
    cpuUsage: cpuRef.current,
    gpuUsage: gpuRef.current,
    ramUsedGB: baseUsedRAM,
    ramTotalGB: totalRAM,
    ramPct: (baseUsedRAM / totalRAM) * 100,
    cpuTemp: clamp(50 + cpuRef.current * 0.35, 35, 95),
    gpuTemp: clamp(45 + gpuRef.current * 0.55, 30, 90),
    cpuHistory: cpuHistRef.current,
    gpuHistory: gpuHistRef.current,
  });

  useEffect(() => {
    let cpuTarget = cpuRef.current;
    let gpuTarget = gpuRef.current;

    const tick = () => {
      // Shift target slowly, with occasional spikes
      const cpuDrift = (Math.random() - 0.5) * 18;
      const gpuDrift = (Math.random() - 0.5) * 22;
      cpuTarget = clamp(cpuTarget + cpuDrift, 12, 94);
      gpuTarget = clamp(gpuTarget + gpuDrift, 8, 96);

      // Smooth current toward target
      cpuRef.current = clamp(lerp(cpuRef.current, cpuTarget, 0.25), 5, 98);
      gpuRef.current = clamp(lerp(gpuRef.current, gpuTarget, 0.25), 5, 98);

      // Update history
      cpuHistRef.current = [...cpuHistRef.current.slice(1), cpuRef.current];
      gpuHistRef.current = [...gpuHistRef.current.slice(1), gpuRef.current];

      const ramUsed = clamp(baseUsedRAM + (Math.random() - 0.5) * 0.4, 1, totalRAM - 0.2);
      const cpuTemp = clamp(42 + cpuRef.current * 0.4 + Math.random() * 4, 35, 99);
      const gpuTemp = clamp(38 + gpuRef.current * 0.55 + Math.random() * 5, 28, 95);

      setStats({
        cpuUsage: Math.round(cpuRef.current),
        gpuUsage: Math.round(gpuRef.current),
        ramUsedGB: Math.round(ramUsed * 10) / 10,
        ramTotalGB: totalRAM,
        ramPct: Math.round((ramUsed / totalRAM) * 100),
        cpuTemp: Math.round(cpuTemp),
        gpuTemp: Math.round(gpuTemp),
        cpuHistory: [...cpuHistRef.current],
        gpuHistory: [...gpuHistRef.current],
      });
    };

    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [totalRAM, baseUsedRAM]);

  return stats;
}
