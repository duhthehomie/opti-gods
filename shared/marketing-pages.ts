export const GAME_PROFILE_PAGES = {
  "rocket-league": {
    name: "Rocket League",
    title: "Rocket League PC Optimization for Windows | Opti Gods",
    description: "Review Rocket League performance settings alongside hardware-aware Windows recommendations for your gaming PC.",
    intro: "Use the Rocket League game pack in Opti Gods Full Optimize with the Windows recommendations that match your PC. Review changes in the Windows app before applying them.",
    features: ["Optional Rocket League game pack", "Hardware-aware Windows performance recommendations", "Review selected tweaks in the desktop app"],
  },
  "marvel-rivals": {
    name: "Marvel Rivals",
    title: "Marvel Rivals PC Optimization for Windows | Opti Gods",
    description: "Explore the Marvel Rivals game pack and review Windows gaming performance recommendations with Opti Gods.",
    intro: "Select Marvel Rivals in Full Optimize to include its game pack alongside compatible Windows settings. Results depend on your hardware, drivers, and in-game settings.",
    features: ["Optional Marvel Rivals game pack", "Compatible Windows and hardware recommendations", "Review settings before applying changes"],
  },
  "arc-raiders": {
    name: "ARC Raiders",
    title: "ARC Raiders PC Optimization for Windows | Opti Gods",
    description: "Explore ARC Raiders optimization options and hardware-aware Windows gaming recommendations in the Opti Gods desktop app.",
    intro: "Opti Gods includes ARC Raiders as an optional game pack in Full Optimize. Choose the games you play and review the compatible recommendations for your Windows PC.",
    features: ["ARC Raiders selection in Full Optimize", "Hardware-aware Windows recommendations", "Local Windows app required to apply tweaks"],
  },
  "silent-hill-townfall": {
    name: "Silent Hill Townfall",
    title: "Silent Hill Townfall PC Optimization Pack | Opti Gods",
    description: "Review the Silent Hill Townfall local-install detection and UE5 performance settings in the Opti Gods Windows game pack.",
    intro: "The Silent Hill Townfall pack checks supported local install locations before applying its settings. Review the game pack and hardware-compatible Windows recommendations in the desktop app.",
    features: ["Local-install detection before game changes", "UE5 rendering and streaming configuration", "Hardware-aware Windows optimization"],
  },
  phasmophobia: {
    name: "Phasmophobia",
    title: "Phasmophobia PC Optimization for Windows | Opti Gods",
    description: "Explore the Phasmophobia game pack and review compatible Windows performance settings for your gaming PC.",
    intro: "Include Phasmophobia in Full Optimize when selecting your games. Opti Gods combines your selected game packs with Windows recommendations based on your detected hardware.",
    features: ["Optional Phasmophobia game pack", "Compatible system recommendations", "Review changes in the Windows desktop app"],
  },
  pubg: {
    name: "PUBG",
    title: "PUBG PC Optimization for Windows | Opti Gods",
    description: "Explore PUBG game optimization and review hardware-aware Windows gaming settings in the Opti Gods desktop app.",
    intro: "Select the PUBG pack in Full Optimize to review its game-specific options alongside compatible Windows settings. Compare performance on your own PC; no fixed FPS gain is guaranteed.",
    features: ["PUBG game pack selection", "Hardware-aware Windows recommendations", "Reviewable local desktop tweaks"],
  },
  fivem: {
    name: "FiveM",
    title: "FiveM Optimization for Windows PC & FPS | Opti Gods",
    description: "Explore FiveM and GTA V Windows optimization for process priority, cache, streaming, network settings, and compatible PC tweaks.",
    intro: "Opti Gods organizes FiveM and GTA V settings alongside Windows recommendations so you can review options that fit your PC before applying changes.",
    features: [
      "FiveM and GTA V process and priority settings",
      "Cache, streaming, and selected client configuration",
      "Network, GPU, memory, and Windows recommendations",
    ],
  },
  fortnite: {
    name: "Fortnite",
    title: "Fortnite PC Optimization for Windows | Opti Gods",
    description: "Review Windows and Fortnite performance settings for frame pacing, input latency, shaders, graphics, and your PC hardware.",
    intro: "Use Opti Gods to review Windows and Fortnite settings for your gaming PC. Recommendations cover graphics and system options without promising a fixed FPS gain.",
    features: [
      "Graphics and hardware-aware settings",
      "Shader preparation and frame-pacing options",
      "Input, memory, and Windows performance recommendations",
    ],
  },
  "call-of-duty": {
    name: "Call of Duty",
    title: "Call of Duty & Warzone PC Optimization | Opti Gods",
    description: "Explore Call of Duty and Warzone Windows settings for VRAM, texture streaming, graphics, networking, and PC performance.",
    intro: "Opti Gods brings together Call of Duty and Warzone settings for review, including graphics, streaming, network, and Windows options that depend on your hardware.",
    features: [
      "VRAM and texture-streaming settings",
      "GPU, shader-cache, and Windows options",
      "Network and process-scheduling recommendations",
    ],
  },
  rust: {
    name: "Rust",
    title: "Rust PC Optimization for Windows Gaming | Opti Gods",
    description: "Review Rust client and Windows settings for frame caps, shadows, networking, CPU priority, and gaming performance.",
    intro: "The Rust profile groups client configuration with compatible Windows recommendations. Review each available setting for your setup before making changes.",
    features: [
      "Client configuration and launch options",
      "Frame caps, shadows, and CPU priority",
      "Network and Windows performance settings",
    ],
  },
  roblox: {
    name: "Roblox",
    title: "Roblox PC Performance Settings for Windows | Opti Gods",
    description: "Explore Roblox Windows settings for frame-rate controls, rendering, process priority, and graphics options.",
    intro: "Opti Gods provides Roblox-related settings alongside Windows recommendations. Which options are useful depends on the game experience and your PC.",
    features: [
      "Frame-rate and rendering settings",
      "Process priority and selected client options",
      "Windows recommendations you can review before applying",
    ],
  },
  valorant: {
    name: "VALORANT",
    title: "VALORANT PC Optimization for Windows | Opti Gods",
    description: "Review Windows settings for VALORANT, including frame pacing, input, process priority, and network configuration.",
    intro: "Opti Gods helps organize Windows and game-related settings for VALORANT. Review available options for your system; performance results vary by hardware and game settings.",
    features: [
      "Frame-pacing and input settings",
      "Process priority and network options",
      "Hardware-aware Windows recommendations",
    ],
  },
} as const;

export type GameProfileSlug = keyof typeof GAME_PROFILE_PAGES;