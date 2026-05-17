// Single shared preset-selection function for AI generators (Aether admin chat,
// Opti Gods user chat, admin Preset Generator tab). Replaces ad-hoc preset
// construction so every path produces hardware-filtered, expert-gated output.
//
// Why centralised: V1 had three different preset code paths and they drifted —
// the user chat kept emitting `EnableMSIMode` / `SetTimerResolution` /
// `DisableIPv6` long after the V2.1 stability surgery removed them from the
// auto-CORE set (those three caused BSODs / FiveM crashes / boot hangs).
// `buildSafePreset` enforces V2.1 rules in one place.

export type PresetGpuVendor = "nvidia" | "amd" | "intel" | "unknown";
export type PresetOsVersion = "win11" | "win10" | "unknown";
export type PresetGoal = "balanced" | "fps" | "latency" | "stability";

export interface PresetHardware {
  gpuVendor: PresetGpuVendor;
  gpuName?: string;          // e.g. "RTX 3070", "RX 6700 XT"
  cpuBrand?: "intel" | "amd" | "unknown";
  cpuLabel?: string;         // e.g. "Ryzen 5 5600X"
  cpuCores?: number;         // logical thread count
  cpuGeneration?: number;    // Intel gen / Ryzen series digit
  ramGB?: number;
  osVersion?: PresetOsVersion;
  isLaptop?: boolean;
  hasDiscreteGpu?: boolean;  // when true, iGPU tweaks are excluded
}

export interface SafePreset {
  /** Human-readable profile, e.g. "RTX FPS Build". */
  profile: string;
  /** Goal used to seed the preset. */
  goal: PresetGoal;
  /** One-line summary of detected hardware for prompts/UI. */
  hardwareSummary: string;
  /** Tweak IDs auto-included for the user — safe + recommended only. */
  core: string[];
  /** Tweak IDs flagged expert/dangerous — REQUIRE explicit opt-in to apply. */
  expert: string[];
  /** Tweak IDs the AI/admin asked for but were blocked (forbidden or hardware-mismatched). */
  blocked: { id: string; reason: string }[];
  /** Hardware/goal reasoning strings for UI / model explanation. */
  reasons: string[];
}

/**
 * The three tweaks the V2.1 stability surgery removed from auto-CORE.
 * They are still legal tweaks, but the AI/admin generators must NEVER include
 * them in `core` — only in `expert` and only when explicitly opted in.
 *
 * - EnableMSIMode: V1 BSOD `SYSTEM_THREAD_EXCEPTION_NOT_HANDLED`
 *   (use the safer `EnableMSIMode_Safe` from the V2.2 driver-reapply set).
 * - DisableIPv6: V1 FiveM `productId != ProductID::INVALID` crash; also breaks
 *   Discord voice / Xbox party chat / Rockstar entitlement.
 * - SetTimerResolution: V1 boot hang on Ryzen APUs / Intel chipsets
 *   (use `DisableDynamicTick` instead — that's already in CORE).
 */
export const FORBIDDEN_AUTO_TWEAKS = [
  "EnableMSIMode",
  "DisableIPv6",
  "SetTimerResolution",
] as const;

/**
 * Tweaks that need user understanding before applying. The AI generators must
 * NEVER auto-include these; they belong in `expert` only.
 *
 * Sourced from `safety: "expert"` entries in `client/src/lib/tweak-registry.ts`
 * plus the three FORBIDDEN_AUTO_TWEAKS above (which carry the strongest "do
 * not auto-include" semantics post-V2.1).
 */
export const EXPERT_TWEAK_IDS: ReadonlySet<string> = new Set<string>([
  ...FORBIDDEN_AUTO_TWEAKS,
  "DisableMemoryCompression",
  "MemDisableCompression",
  "DisablePagefileEncryption",
  "DisableDefender",
  "SysHypervisorOff",
  "Win11DisableVBS",
  "Win11DisableHVCI",
  "Lap_Intel_DisableECores",
]);

/**
 * GPU vendor → tweak ID prefix allow/deny rules. Tweaks with these prefixes
 * are gated to matching GPUs to prevent the AI from including AMD tweaks on
 * an NVIDIA box (or vice versa).
 */
const NVIDIA_PREFIXES = ["Nvidia", "Nv", "NvShader", "NvTexture", "NvFXAA", "FiveM1060", "FiveM1650", "FiveMDisableNvidia", "FiveMDisablePhysX", "FiveMFixNvidiaOverlay", "FiveMGPUPriorityStack"];
const AMD_DGPU_PREFIXES = ["Amd"];
const AMD_IGPU_PREFIXES = ["IGpu_Amd", "IGpu_Vega"];
const INTEL_IGPU_PREFIXES = ["IGpu_Intel"];
const GENERIC_IGPU_PREFIXES = ["IGpu_"]; // matched after the vendor-specific iGPU prefixes

function startsWithAny(id: string, prefixes: readonly string[]): boolean {
  for (const p of prefixes) if (id.startsWith(p)) return true;
  return false;
}

/**
 * Whether `id` is compatible with the provided hardware. Universal tweaks
 * (Win32PrioritySeparation, NetDNSCloudflare, etc.) are not gated by GPU
 * vendor — only the vendor-prefixed families are.
 */
function isHardwareCompatible(id: string, hw: PresetHardware): { ok: boolean; reason?: string } {
  const isNvidiaTweak = startsWithAny(id, NVIDIA_PREFIXES);
  const isAmdDgpuTweak = startsWithAny(id, AMD_DGPU_PREFIXES) && !startsWithAny(id, AMD_IGPU_PREFIXES);
  const isAmdIgpuTweak = startsWithAny(id, AMD_IGPU_PREFIXES);
  const isIntelIgpuTweak = startsWithAny(id, INTEL_IGPU_PREFIXES);
  const isGenericIgpuTweak = startsWithAny(id, GENERIC_IGPU_PREFIXES) && !isAmdIgpuTweak && !isIntelIgpuTweak;

  if (isNvidiaTweak && hw.gpuVendor !== "nvidia") {
    return { ok: false, reason: `NVIDIA tweak skipped — detected GPU vendor is ${hw.gpuVendor}` };
  }
  if (isAmdDgpuTweak && hw.gpuVendor !== "amd") {
    return { ok: false, reason: `AMD GPU tweak skipped — detected GPU vendor is ${hw.gpuVendor}` };
  }
  // iGPU tweaks: skip when a discrete GPU is present, regardless of vendor match
  if ((isAmdIgpuTweak || isIntelIgpuTweak || isGenericIgpuTweak) && hw.hasDiscreteGpu) {
    return { ok: false, reason: "iGPU tweak skipped — discrete GPU is present" };
  }
  if (isAmdIgpuTweak && hw.gpuVendor !== "amd") {
    // AMD iGPU tweaks (Vega/APU) only on AMD systems
    return { ok: false, reason: `AMD iGPU tweak skipped — vendor is ${hw.gpuVendor}` };
  }
  if (isIntelIgpuTweak && hw.gpuVendor !== "intel") {
    return { ok: false, reason: `Intel iGPU tweak skipped — vendor is ${hw.gpuVendor}` };
  }
  // Laptop-gated tweaks (Lap_*) only on laptops
  if (id.startsWith("Lap_") && !hw.isLaptop) {
    return { ok: false, reason: "Laptop tweak skipped — desktop detected" };
  }
  // Win11-gated tweaks
  if (id.startsWith("Win11") && hw.osVersion === "win10") {
    return { ok: false, reason: "Win11-only tweak skipped — Windows 10 detected" };
  }
  return { ok: true };
}

/**
 * Universal core: every Windows gaming PC benefits. Mirrors the post-V2.1
 * CORE list from `client/src/lib/smart-recommendations.ts` but trimmed to the
 * highest-confidence, hardware-agnostic IDs the AI is allowed to auto-apply.
 */
const UNIVERSAL_CORE: string[] = [
  "Win32PrioritySeparation",
  "SetResponsiveness",
  "GameModeTweaks",
  "DisableHungAppDetection",
  "NetworkThrottling",
  "DisableNagle",
  "InputLagTCP",
  "SetDNSPriority",
  "DisableNDU",
  "EnableTCPAutoTuning",
  "OptimizeTCP",
  "DisablePowerThrottling",
  "DisablePowerThrottlingAdv",
  "DisableXboxGameBar",
  "DisableGameDVR",
  "DisableAnimations",
  "SysVisualBestPerf",
  "SysHibernateOff",
  "DisableFastStartup",
  "DisableWindowsError",
  "SetHighPerformancePlan",
  "DisableUSBSuspend",
  "DisableCoreParking",
  "DisableDynamicTick",
  "OptimizeRAMUsage",
  "DisablePrefetch",
  "MemTrimStandbyList",
  "MemTrimOnMinimize",
  "NetDNSCloudflare",
  "NetDisableQoS",
  "NetInterruptModeration",
  "NetRSSQueues",
  "NetAdapterPowerSave",
  "ProcMMCSSGaming",
  "ProcGPUSchedulerHigh",
  "PrivacyTelemetry",
  "PrivacyAdvertisingID",
];

const NVIDIA_CORE: string[] = [
  "NvidiaDisableTelemetry", "NvidiaPreRenderedFrames", "NvidiaLowLatency",
  "NvidiaPowerMizer", "NvidiaReflexEnable", "NvidiaTripleBufferOff",
  "NvidiaDisableOverlay", "NvidiaForceVSyncOff", "NvidiaShaderCache",
  "NvidiaMaxPerfMode", "NvidiaAnisoFiltering", "NvidiaThreadedOpt",
];
const NVIDIA_RTX_EXTRA: string[] = ["EnableHAGS", "NvidiaRTXVideoOff"];
const NVIDIA_GTX_EXTRA: string[] = ["NvShaderDiskCache", "NvTextureFilterPerf", "NvFXAADriverOff"];

const AMD_DGPU_CORE: string[] = [
  "EnableHAGS", "AmdDisableULPS", "AmdDisableChill", "AmdDisablePowerEfficiency",
  "AmdMaxClockState", "AmdForcePerformancePowerPlan", "AmdOptimizeLatency",
  "AmdDisableTelemetry", "AmdShaderCache",
];

const AMD_IGPU_CORE: string[] = [
  "IGpu_DisableULPS", "IGpu_DisableDeepSleep", "IGpu_DisableVariBright",
  "IGpu_ForcePerformancePower", "IGpu_AmdAntiLag", "IGpu_SharedMemoryHint",
  "IGpu_DisableMPO", "IGpu_AmdTdrLevel", "IGpu_UltimatePerformancePlan",
  "IGpu_MaxProcessorState", "IGpu_DisableCoreParking", "IGpu_GameModeOn",
  "IGpu_NetworkThrottling", "IGpu_DisableHAGSForIGpu",
];

const INTEL_IGPU_CORE: string[] = [
  "IGpu_Intel_MaxFreq", "IGpu_Intel_DisableFreqScaling", "IGpu_Intel_TDR",
  "IGpu_Intel_PanelFitter", "IGpu_Intel_QSVOff",
  "IGpu_ForcePerformancePower", "IGpu_UltimatePerformancePlan",
  "IGpu_DisableHAGSForIGpu",
];

const LAPTOP_CORE: string[] = [
  "Lap_UltimatePerformance", "Lap_DisableCoreParking", "Lap_DisableThrottleStates",
  "Lap_MaxProcessorStateAC", "Lap_USBPowerSave", "Lap_WifiPerfMode",
  "Lap_DisablePowerThrottling", "Lap_MMCSS_Games", "Lap_DisableHibernate",
];

const WIN11_CORE: string[] = [
  "Win11TeamsChat", "Win11Widgets", "Win11Copilot", "Win11BingSearch",
  "Win11AdsInStart", "Win11OneDriveBackup", "Win11StartRecommended",
];

/** Hardware-summary string for prompts/UI. */
export function summarizeHardware(hw: PresetHardware): string {
  const gpu = hw.gpuName || (hw.gpuVendor === "unknown" ? "Unknown GPU" : `${hw.gpuVendor.toUpperCase()} GPU`);
  const cpu = hw.cpuLabel || (hw.cpuBrand && hw.cpuBrand !== "unknown" ? `${hw.cpuBrand.toUpperCase()} CPU` : "Unknown CPU");
  const cores = hw.cpuCores ? `${hw.cpuCores}T` : "?T";
  const ram = hw.ramGB ? `${hw.ramGB}GB RAM` : "? RAM";
  const os = hw.osVersion === "win11" ? "Win11" : hw.osVersion === "win10" ? "Win10" : "Win?";
  const form = hw.isLaptop ? "Laptop" : "Desktop";
  return `${gpu} • ${cpu} (${cores}) • ${ram} • ${os} • ${form}`;
}

function profileFor(hw: PresetHardware): string {
  if (hw.isLaptop && hw.gpuVendor === "nvidia") return "NVIDIA Gaming Laptop";
  if (hw.isLaptop && hw.gpuVendor === "amd") return "AMD Gaming Laptop";
  if (hw.isLaptop) return "Gaming Laptop";
  if (hw.gpuVendor === "nvidia") {
    const isRtx = !!hw.gpuName && /rtx|\b(20|30|40|50)\d{2}\b/i.test(hw.gpuName);
    return isRtx ? "NVIDIA RTX Build" : "NVIDIA GTX Build";
  }
  if (hw.gpuVendor === "amd") return "AMD Radeon Build";
  if (hw.gpuVendor === "intel") return "Intel iGPU Build";
  return "Generic Gaming PC";
}

/**
 * The single canonical preset-selection function. All AI/admin generators
 * MUST go through this — never construct preset arrays inline.
 *
 * @param hw       Detected hardware (use `unknown` vendors when uncertain;
 *                 the function will skip vendor-specific tweaks).
 * @param goal     Optimisation goal (currently advisory — drives `profile`
 *                 and reason strings; future versions may bias selection).
 * @param optInFlags Tweak IDs the user/admin has explicitly approved for
 *                   expert/forbidden treatment. IDs not in this list that
 *                   fall into `EXPERT_TWEAK_IDS` are moved to `expert` and
 *                   are NOT included in `core`. Forbidden tweaks
 *                   (`FORBIDDEN_AUTO_TWEAKS`) require the EXACT id in
 *                   `optInFlags` or they're recorded under `blocked`.
 */
export function buildSafePreset(
  hw: PresetHardware,
  goal: PresetGoal = "balanced",
  optInFlags: readonly string[] = [],
): SafePreset {
  const optIn = new Set(optInFlags);
  const blocked: { id: string; reason: string }[] = [];
  const reasons: string[] = [];

  // 1. Collect candidates by hardware
  const candidates = new Set<string>(UNIVERSAL_CORE);
  reasons.push(`${UNIVERSAL_CORE.length} universal core tweaks (safe for every Windows gaming PC)`);

  if (hw.gpuVendor === "nvidia") {
    NVIDIA_CORE.forEach(id => candidates.add(id));
    const isRtx = !!hw.gpuName && /rtx|\b(20|30|40|50)\d{2}\b/i.test(hw.gpuName);
    if (isRtx) {
      NVIDIA_RTX_EXTRA.forEach(id => candidates.add(id));
      reasons.push(`NVIDIA RTX detected (${hw.gpuName ?? "RTX"}) — HAGS enabled, full RTX stack`);
    } else {
      NVIDIA_GTX_EXTRA.forEach(id => candidates.add(id));
      reasons.push(`NVIDIA GTX-class detected (${hw.gpuName ?? "GTX"}) — HAGS skipped (causes stutters on Pascal/Turing)`);
    }
  } else if (hw.gpuVendor === "amd" && hw.hasDiscreteGpu !== false && !hw.isLaptop) {
    AMD_DGPU_CORE.forEach(id => candidates.add(id));
    reasons.push(`AMD discrete GPU detected (${hw.gpuName ?? "Radeon"}) — full Radeon optimisation suite`);
  } else if (hw.gpuVendor === "amd") {
    AMD_IGPU_CORE.forEach(id => candidates.add(id));
    reasons.push(`AMD APU/iGPU detected (${hw.gpuName ?? "Vega"}) — Vega/APU tweaks, HAGS disabled`);
  } else if (hw.gpuVendor === "intel") {
    INTEL_IGPU_CORE.forEach(id => candidates.add(id));
    reasons.push(`Intel iGPU detected (${hw.gpuName ?? "Intel"}) — Intel driver TDR fix, Panel Fitter off`);
  } else {
    reasons.push("GPU vendor unknown — vendor-specific tweaks skipped, safe defaults only");
  }

  if (hw.isLaptop) {
    LAPTOP_CORE.forEach(id => candidates.add(id));
    reasons.push("Laptop detected — power/Wi-Fi/USB laptop suite included");
  }
  if (hw.osVersion === "win11") {
    WIN11_CORE.forEach(id => candidates.add(id));
    reasons.push("Windows 11 detected — Win11 debloat included");
  }

  // 2. Goal-driven nudges (advisory: tighten or relax)
  if (goal === "stability") {
    // Stability mode: drop the more aggressive scheduler tweaks
    candidates.delete("DisableDynamicTick");
    candidates.delete("DisablePowerThrottlingAdv");
    reasons.push("Goal=stability — aggressive scheduler tweaks dropped");
  }
  if (goal === "latency") {
    reasons.push("Goal=latency — network + scheduler core retained, no extra additions");
  }

  // 3. Apply opt-in expert tweaks (verify hardware compat first)
  //    SAFETY: optInFlags can ONLY contain known EXPERT or FORBIDDEN IDs.
  //    Arbitrary IDs (typos, model hallucinations, malicious payloads) are
  //    rejected — they must never reach `core`.
  const FORBIDDEN_LIST = FORBIDDEN_AUTO_TWEAKS as readonly string[];
  for (const optedId of Array.from(optIn)) {
    const isExpert = EXPERT_TWEAK_IDS.has(optedId);
    const isForbidden = FORBIDDEN_LIST.includes(optedId);
    if (!isExpert && !isForbidden) {
      blocked.push({
        id: optedId,
        reason: "unknown opt-in flag — only expert or forbidden tweak IDs may be opted in",
      });
      continue;
    }
    const compat = isHardwareCompatible(optedId, hw);
    if (!compat.ok) {
      blocked.push({ id: optedId, reason: compat.reason ?? "hardware-incompatible" });
      continue;
    }
    candidates.add(optedId);
  }

  // 3b. Seed expert[] with hardware-compatible EXPERT tweaks that the user
  //     has NOT opted in yet — these render as red toggle suggestions in the
  //     "Advanced — Opt-in Required" UI section so the user can flip them.
  //     Forbidden trio is intentionally NOT seeded here (they only ever
  //     appear via explicit opt-in; non-opted ones live in `blocked`).
  for (const eid of Array.from(EXPERT_TWEAK_IDS)) {
    if (candidates.has(eid)) continue; // already going through partition
    if (FORBIDDEN_LIST.includes(eid)) continue; // forbidden surfaced via blocked
    const compat = isHardwareCompatible(eid, hw);
    if (!compat.ok) continue; // silently skip hw-incompatible expert suggestions
    candidates.add(eid); // partition step will route them to expert[]
  }

  // 4. Always surface forbidden trio in `blocked` when not opted in, so the
  // UI/admin can SEE that they were deliberately withheld (not silently absent).
  // Spec contract: "refuse to include EnableMSIMode/DisableIPv6/SetTimerResolution
  // without explicit opt-in" — visibility of the refusal matters.
  for (const fid of FORBIDDEN_AUTO_TWEAKS) {
    if (!optIn.has(fid) && !candidates.has(fid)) {
      blocked.push({
        id: fid,
        reason: `forbidden auto-include (V2.1 stability rule: caused ${
          fid === "EnableMSIMode" ? "SYSTEM_THREAD_EXCEPTION_NOT_HANDLED BSOD"
          : fid === "DisableIPv6" ? "FiveM/Discord/Xbox party crashes"
          : "boot hang on Ryzen APUs / Intel chipsets"
        }) — pass "${fid}" in optInFlags to apply`,
      });
    }
  }

  // 5. Partition into core vs expert, filter hardware-incompatible, record blocked
  const core: string[] = [];
  const expert: string[] = [];
  for (const id of Array.from(candidates)) {
    // Hardware filter
    const compat = isHardwareCompatible(id, hw);
    if (!compat.ok) {
      blocked.push({ id, reason: compat.reason ?? "hardware-incompatible" });
      continue;
    }
    // Forbidden tweaks — require EXACT id in optIn to escape blocked
    if ((FORBIDDEN_AUTO_TWEAKS as readonly string[]).includes(id)) {
      if (optIn.has(id)) {
        expert.push(id); // even on opt-in, surface as expert (red section)
      } else {
        blocked.push({
          id,
          reason: `forbidden auto-include (V2.1 stability rule) — pass "${id}" in optInFlags to apply`,
        });
      }
      continue;
    }
    // Expert tweaks — require opt-in to escape expert section
    if (EXPERT_TWEAK_IDS.has(id)) {
      if (optIn.has(id)) {
        expert.push(id); // opted in but still rendered in expert section
      } else {
        expert.push(id); // surfaced as opt-in suggestion (NOT in core)
      }
      continue;
    }
    core.push(id);
  }

  // Deduplicate expert (in case a tweak appears twice via opt-in + candidates)
  const uniqExpert = Array.from(new Set(expert));

  return {
    profile: profileFor(hw),
    goal,
    hardwareSummary: summarizeHardware(hw),
    core: core.sort(),
    expert: uniqExpert.sort(),
    blocked,
    reasons,
  };
}

/**
 * Translate a `HardwareRig` row (from the hardware_rigs table) into the
 * `PresetHardware` shape buildSafePreset expects. Used by Aether's
 * "generate preset for rig N" command.
 */
export function hardwareFromRig(rig: {
  cpu: string;
  gpu: string;
  ramGb: number | null;
  chassis: string | null;
  refreshHz: number | null;
}): PresetHardware {
  const gpuLower = rig.gpu.toLowerCase();
  let gpuVendor: PresetGpuVendor = "unknown";
  if (/nvidia|geforce|rtx|gtx/.test(gpuLower)) gpuVendor = "nvidia";
  else if (/radeon|\brx\b|vega|amd/.test(gpuLower)) gpuVendor = "amd";
  else if (/intel|uhd|iris|arc/.test(gpuLower)) gpuVendor = "intel";

  const cpuLower = rig.cpu.toLowerCase();
  let cpuBrand: "intel" | "amd" | "unknown" = "unknown";
  if (cpuLower.includes("intel") || /\bi[3579]-/.test(cpuLower) || cpuLower.includes("core ultra")) cpuBrand = "intel";
  else if (cpuLower.includes("ryzen") || cpuLower.includes("amd") || cpuLower.includes("threadripper")) cpuBrand = "amd";

  const isLaptop = !!rig.chassis && /laptop|notebook|portable/i.test(rig.chassis);
  // Heuristic: if GPU mentions RTX/RX-discrete it's a dGPU even on a laptop.
  const hasDiscreteGpu = gpuVendor === "nvidia"
    || (gpuVendor === "amd" && /\brx\s*\d{3,4}/i.test(rig.gpu));

  return {
    gpuVendor,
    gpuName: rig.gpu,
    cpuBrand,
    cpuLabel: rig.cpu,
    ramGB: rig.ramGb ?? undefined,
    osVersion: "unknown", // hardware_rigs doesn't track OS — caller may override
    isLaptop,
    hasDiscreteGpu,
  };
}
