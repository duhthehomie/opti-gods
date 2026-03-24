import { db } from "./db";
import { announcements } from "@shared/schema";
import { count } from "drizzle-orm";
import { log } from "./index";

const SEED_ANNOUNCEMENTS = [
  {
    title: "Welcome to Opti Gods — Your PC Optimizer is Live",
    body: `Opti Gods is officially live. Built for Windows 10 and 11, every tweak is a real registry edit, PowerShell command, or system setting change — not a fake slider.\n\nHow it works:\n1. Toggle the tweaks you want across any tab\n2. Hit GET MY SCRIPT to generate your personal .ps1 file\n3. Run it as Administrator and restart\n\nPro members get full script access, preset saves, and every update we push — for life, one payment.`,
    tag: "announcement",
    tweakIds: [] as string[],
  },
  {
    title: "Registry Optimizer — 40+ Tweaks Across 8 Sections",
    body: `The core Registry page is packed with 40+ real Windows registry and system tweaks organized into sections:\n\n• Power & CPU — Ultimate Performance plan, boost mode, core parking disabled\n• Network & Latency — Nagle disabled, DNS cache tuned, TCP stack hardened\n• RAM & Memory — prefetch tuned, standby list clear, heap termination disabled\n• Visual & UI — animations off, transparency off, blur off\n• Privacy — telemetry disabled, activity history off, feedback off\n• Services — SysMain disabled, DiagTrack stopped, search indexing reduced\n• Startup Apps — Discord, Spotify, OneDrive, Teams, Skype, GeForce removed from boot\n• Safety — all risky tweaks show a warning before enabling`,
    tag: "update",
    tweakIds: ["PowerUltimatePlan","PowerBoostMode","DisableCoreParking","DisableNagle","SetDNSPriority","TCPOptimize","OptimizeRAMUsage","MemDisableHeapTermination","DisableAnimations","DisableTransparency","DisableBlur","DisableTelemetry","DisableActivityHistory","DisableFeedback","DisableSysMain","DisableDiagTrack","DisableSearchIndexing","su_discord","su_spotify","su_onedrive","su_teams","su_skype"],
  },
  {
    title: "FiveM Optimizer Page — 8 FiveM-Specific Tweaks",
    body: `New dedicated FiveM Optimizer page with tweaks tuned specifically for FiveM/GTA V performance:\n\n• Disable PhysX CPU processing — offload to GPU where possible\n• Expand network buffer — reduces packet loss and stutter on busy servers\n• Disable fullscreen optimizations — removes DWM overhead on FiveM window\n• Disable DWM composition — more direct GPU access during gameplay\n• CPU affinity mask — pin FiveM to performance cores only\n• DNS server override — faster server list resolution\n• Queue connection fix — bypass queue wait on popular servers\n• Stream distance registry tweak — reduce distant asset loading\n\nAll tweaks are included in your script when enabled.`,
    tag: "new",
    tweakIds: ["FiveMDisablePhysX","FiveMNetworkBuffer","FiveMDisableFullscreen","FiveMDisableDWM","FiveMAffinityMask","FiveMDNSOverride","FiveMQueueFix","FiveMStreamDistance"],
  },
  {
    title: "NVIDIA Optimizer — Real Registry Tweaks + 3 Driver Presets",
    body: `The NVIDIA page now writes directly to the NVIDIA registry profile — not just control panel suggestions.\n\nNew toggles:\n• Low Latency Mode (Ultra) — pre-rendered frames set to 1\n• Threaded Optimization — force On for multi-core GPU feeding\n• Shader Cache — force enable to skip recompile stutters\n• Texture Filtering Quality — force High Performance\n• Maximum Pre-Rendered Frames — set to 1 for lowest input lag\n• Power Management Mode — force Maximum Performance\n• FXAA & Ambient Occlusion — disable for raw FPS gain\n\n3 driver presets: Balanced, Max Performance, Ultra Low Latency — each configures a curated set of the above.`,
    tag: "update",
    tweakIds: ["NvidiaLowLatency","NvidiaThreadedOpt","NvidiaShaderCache","NvidiaTexFiltering","NvidiaMaxFrames","NvidiaPowerMode","NvidiaFXAA","NvidiaAmbientOcclusion"],
  },
  {
    title: "Fortnite Optimizer Page Live",
    body: `Dedicated Fortnite tab with tweaks aimed at reducing build delay, improving input response, and stabilizing frame times in Fortnite specifically:\n\n• Process priority — set Fortnite to High CPU priority\n• GPU scheduling — hardware-accelerated GPU scheduling on\n• GameDVR disabled — removes background recording overhead\n• Fullscreen optimizations off — pure exclusive fullscreen mode\n• Network throttling index tuned — smoother netcode frame delivery\n• Timer resolution — set to 0.5ms for tighter frame timing\n• Texture streaming budget — increase dedicated VRAM usage\n\nApply these alongside your core registry tweaks for best results.`,
    tag: "new",
    tweakIds: ["FortniteHighPriority","FortniteHWGPUScheduling","FortniteDisableGameDVR","FortniteDisableFullscreenOpt","FortniteNetworkThrottle","FortniteTimerRes","FortniteTextureStream"],
  },
  {
    title: "Quick Boost Presets Added to Dashboard",
    body: `The dashboard now has 4 one-click Quick Boost preset cards — each enables a curated set of tweaks instantly:\n\n• Safe Boost (24 tweaks) — stable daily driver improvements, nothing risky. Animations off, Nagle off, power plan set, SysMain disabled\n• Max FPS Gaming (52 tweaks) — everything Safe Boost does plus GPU priority, timer resolution, core parking off, network stack hardened\n• Competitive Shooter (48 tweaks) — tuned for lowest possible input lag. GameDVR off, fullscreen opts off, NVIDIA low latency, mouse fix applied\n• Streamer Mode (31 tweaks) — balanced for streaming performance. Keeps GPU encoder headroom, disables background uploads, network buffer expanded\n\nClick any card on the dashboard to apply instantly, then hit GET MY SCRIPT.`,
    tag: "update",
    tweakIds: [] as string[],
  },
  {
    title: "Safety Warnings on High-Risk Tweaks",
    body: `High-risk tweaks now show a confirmation dialog before enabling. This covers:\n\n• Disabling Windows Update service\n• Disabling Windows Defender / security features\n• DWM composition changes\n• HPET and timer resolution changes\n\nThe warning explains exactly what the tweak does and what to expect. You can still enable them — just with full knowledge of what runs. Low and Medium risk tweaks toggle immediately as before.`,
    tag: "hotfix",
    tweakIds: [] as string[],
  },
  {
    title: "Opti Gods OS — Custom Windows AME Wizard Playbook",
    body: `The Opti Gods OS page is now live under Custom OS in the sidebar.\n\nOpti Gods OS is a custom Windows configuration built with AME Wizard. It strips telemetry, bloat, and unnecessary services at the OS level — before you even run your optimizer script.\n\nWhat it removes at install time:\n• All Microsoft telemetry and data collection\n• Cortana, Edge, OneDrive, Xbox services\n• Windows Update automatic installs (manual control only)\n• Defender real-time monitoring\n• 20+ background services disabled by default\n\nThe page includes the playbook download and full setup instructions. Recommended for dedicated gaming rigs only.`,
    tag: "announcement",
    tweakIds: [] as string[],
  },
  {
    title: "Discord Optimizer — 8 New Tweaks Added",
    body: `New Discord Optimizer page is live with 8 targeted performance tweaks:\n\n• De-prioritize Discord CPU & I/O — prevents Discord from competing with your game for CPU time\n• Lower Discord GPU Priority — game renders first, Discord UI renders after\n• Disable Hardware Acceleration — frees your GPU encoder for game capture and streaming\n• Force H264 Screenshare Codec — lower CPU overhead when screensharing\n• Clear Discord Cache — fixes audio glitches, black screenshares, slow overlay loading\n• Enable Reduce Motion — disables Discord animations during gameplay\n• Deprioritize Discord Auto-Updater — no more CPU spikes mid-game from update checks\n• Block Crash Reporter — stops telemetry uploads in the background\n\nFind all 8 tweaks under Discord Optimizer in the sidebar.`,
    tag: "new",
    tweakIds: ["DiscordLowPriority","DiscordReduceGPUPriority","DiscordDisableHWAccel","DiscordOptimizeCodec","DiscordClearCache","DiscordDisableAnimations","DiscordDisableUpdateCheck","DiscordDisableCrashHandler"],
  },
];

export async function seedAnnouncements() {
  try {
    const [{ total }] = await db.select({ total: count() }).from(announcements);
    if (total > 0) return;

    await db.insert(announcements).values(SEED_ANNOUNCEMENTS);
    log(`Seeded ${SEED_ANNOUNCEMENTS.length} announcements`, "seed");
  } catch (err) {
    log(`Seed error: ${err}`, "seed");
  }
}
