import type { HardwareInfo } from "@/hooks/use-hardware-info";

/**
 * Map hardware profile to optimal SystemResponsiveness value.
 * Lower = more CPU priority to game, higher = more to background.
 * 0 = 99% game (breaks Discord), 10 = 90% game, 26 = 77% game, 38 = 65% game
 *
 * Uses cpuPhysicalCores (not logical threads) to avoid misclassifying
 * SMT/HT CPUs. E.g. Ryzen 7 3700X = 8 physical / 16 threads — should be
 * mid-range (26), not high-end (38).
 */
export function getOptimalSystemResponsiveness(hw: HardwareInfo): number {
  const phys = hw.cpuPhysicalCores || Math.ceil(hw.cpuCores / 2);

  // High-end systems (RTX + 12+ physical cores, e.g. Ryzen 9 5900X, i9-12900K)
  if ((hw.nvidiaIsRTX || hw.isAmdGpu) && phys >= 12) {
    return 38; // hex 26 — breathing room for powerful hardware
  }

  // Mid-range (RTX/AMD discrete + 8-10 physical cores, e.g. R7 3700X, i7-10700K)
  if ((hw.nvidiaIsRTX || hw.isAmdGpu || hw.nvidiaIsLowEnd) && phys >= 8) {
    return 26; // hex 1A — balanced sweet spot
  }

  // Low-end or laptop (iGPU, <6 physical cores, or GTX 10xx)
  return 10; // hex 0A — conservative, stable
}

/**
 * Get a human-readable recommendation explanation.
 */
export function getSystemResponsivenessExplanation(hw: HardwareInfo, value: number): string {
  const hex = value.toString(16).toUpperCase().padStart(2, "0");
  const phys = hw.cpuPhysicalCores || Math.ceil(hw.cpuCores / 2);
  const cpuDesc =
    phys >= 12
      ? `${phys} physical cores (high-end)`
      : phys >= 6
        ? `${phys} physical cores (mid-range)`
        : `${phys} physical cores (resource-constrained)`;
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
    // Only recommend disabling compression at 32GB+ — at 16GB heavy RAM users
    // (like gaming PCs at 80%+ utilisation) will see disk paging without it.
    return { applies: hw.ramGB >= 32, reason: hw.ramGB >= 32 ? undefined : `RAM-specific: Only recommended at 32GB+ (you have ${hw.ramGB}GB — keep compression ON to avoid disk paging)` };
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
