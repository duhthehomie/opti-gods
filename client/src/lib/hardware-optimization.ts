import type { HardwareInfo } from "@/hooks/use-hardware-info";

/**
 * Map hardware profile to optimal SystemResponsiveness value.
 * Lower = more CPU priority to game, higher = more to background.
 * 0 = 99% game (breaks Discord), 10 = 90% game, 26 = 77% game, 38 = 65% game
 */
export function getOptimalSystemResponsiveness(hw: HardwareInfo): number {
  // High-end systems (RTX 30/40 + Ryzen 7/i7+ or 12+ cores) → can handle hex 26 (38 decimal)
  if ((hw.nvidiaIsRTX || hw.isAmdGpu) && hw.cpuCores >= 12) {
    return 38; // hex 26 — give background more breathing room on powerful hardware
  }

  // Mid-range (RTX 20 or GTX 16xx + Ryzen 5/i5+ or 8-10 cores) → stick with hex 1A (26 decimal)
  if ((hw.nvidiaIsRTX || hw.isAmdGpu || hw.nvidiaIsLowEnd) && hw.cpuCores >= 8) {
    return 26; // hex 1A — balanced, proven to work well
  }

  // Low-end or laptop (GTX 10xx, iGPU, or <8 cores) → conservative hex 0A (10 decimal)
  return 10; // Conservative setting for stability on resource-constrained hardware
}

/**
 * Get a human-readable recommendation explanation.
 */
export function getSystemResponsivenessExplanation(hw: HardwareInfo, value: number): string {
  const hex = value.toString(16).toUpperCase().padStart(2, "0");
  const cpuDesc =
    hw.cpuCores >= 12
      ? "12+ cores (powerful)"
      : hw.cpuCores >= 8
        ? "8-10 cores (mid-range)"
        : "<8 cores (resource-constrained)";
  const gpuDesc = hw.nvidiaIsRTX
    ? "RTX (high-end)"
    : hw.isAmdGpu
      ? "AMD discrete (high-end)"
      : hw.nvidiaIsLowEnd
        ? "GTX 10xx/16xx (low-end)"
        : hw.isAmdApu
          ? "APU/iGPU (low-end)"
          : "Unknown";

  return `System: ${gpuDesc} GPU, ${cpuDesc} CPU • Recommended: 0x${hex} (${value}d) — ${value === 10 ? "conservative, stable" : value === 26 ? "balanced sweet spot" : "high-power friendly"}`;
}

/**
 * Determine if a tweak applies to this hardware.
 * Returns null if the tweak doesn't apply, or a reason string if it does.
 */
export function getTweakRelevance(
  tweakId: string,
  hw: HardwareInfo
): { applies: boolean; reason?: string } {
  // GPU-specific tweaks
  if (tweakId.includes("NVIDIA") || tweakId.includes("Nvidia")) {
    return { applies: hw.isNvidia, reason: hw.isNvidia ? undefined : "GPU-specific: NVIDIA GPU not detected" };
  }
  if (tweakId.includes("AMD") || tweakId.includes("Amd")) {
    return { applies: hw.isAMD, reason: hw.isAMD ? undefined : "GPU-specific: AMD GPU not detected" };
  }
  if (tweakId.includes("1060")) {
    return { applies: hw.nvidiaIsLowEnd && hw.gpuName.includes("1060"), reason: hw.gpuName.includes("1060") ? undefined : "Hardware-specific: GTX 1060 not detected" };
  }
  if (tweakId.includes("5600")) {
    return { applies: hw.isRyzen && hw.cpuGeneration === 5, reason: hw.isRyzen && hw.cpuGeneration === 5 ? undefined : "CPU-specific: Ryzen 5 5600 not detected" };
  }

  // Memory-specific tweaks
  if (tweakId.includes("DisableMemoryCompression")) {
    return { applies: hw.ramGB >= 16, reason: hw.ramGB >= 16 ? undefined : `RAM-specific: Requires 16GB+, you have ${hw.ramGB}GB` };
  }
  if (tweakId.includes("DisablePrefetch")) {
    return { applies: true, reason: "Best on SSD/NVMe (you can still apply on HDD, but may slow load times)" };
  }

  // Laptop-specific
  if (tweakId.startsWith("Lap_")) {
    return { applies: hw.isLaptop, reason: hw.isLaptop ? undefined : "Laptop-specific: Desktop detected" };
  }

  // Everything else applies
  return { applies: true };
}
