import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { TweakRow } from "@/components/tweak-row";
import { TabSmartBar } from "@/components/tab-smart-bar";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { useHardwareInfo } from "@/hooks/use-hardware-info";
import { Button } from "@/components/ui/button";
import { MessageCircle, CheckCircle2, Info, Zap, Monitor, Cpu, Trash2, Shield, Gamepad2 } from "lucide-react";
import { PageGuide } from "@/components/page-guide";
import { cn } from "@/lib/utils";
import { getOptimalSystemResponsiveness, getSystemResponsivenessExplanation } from "@/lib/hardware-optimization";

const ALL_DISCORD_IDS = [
  "DiscordLowPriority",
  "DiscordReduceGPUPriority",
  "DiscordDisableHWAccel",
  "DiscordOptimizeCodec",
  "DiscordClearCache",
  "DiscordDisableUpdateCheck",
  "DiscordDisableAnimations",
  "DiscordDisableCrashHandler",
  "DiscordDisableOverlay",
  "DiscordDisableClips",
  "DiscordDisableVAD",
  "DiscordLowerVoiceQuality",
  "DiscordDisableStreaming",
  // Gaming session tweaks
  "DiscordDisableRichPresence",
  "DiscordDisableGifAutoplay",
  "DiscordDisableSpellcheck",
  "DiscordSuppressNotifications",
  "DiscordMinimizeBgLoad",
];

const DISCORD_RECOMMENDED = [
  "DiscordLowPriority",
  "DiscordReduceGPUPriority",
  "DiscordDisableHWAccel",
  "DiscordClearCache",
  "DiscordDisableAnimations",
  "DiscordDisableOverlay",
  "DiscordDisableClips",
  "DiscordLowerVoiceQuality",
  // Gaming session
  "DiscordDisableRichPresence",
  "DiscordDisableGifAutoplay",
  "DiscordMinimizeBgLoad",
];

type Impact = "HIGH" | "MED" | "LOW";

interface Tweak {
  id: string;
  title: string;
  desc: string;
  badge?: string;
  impact?: Impact;
  recommended?: boolean;
  warning?: string;
}

const PRIORITY_TWEAKS: Tweak[] = [
  {
    id: "DiscordLowPriority",
    title: "De-prioritize Discord CPU + I/O",
    desc: "Sets Discord.exe to Below Normal CPU priority + Very Low I/O + Low Page priority via IFEO registry — Windows gives your game full CPU scheduling priority instead of splitting it with Discord.",
    badge: "RECOMMENDED",
    impact: "HIGH",
    recommended: true,
  },
  {
    id: "DiscordReduceGPUPriority",
    title: "Lower Discord GPU Priority",
    desc: "Sets Discord's GPU priority class to 1 (lowest) while keeping the Games task at GPU Priority 8 — your game gets maximum rendering bandwidth; Discord renders its UI last.",
    badge: "RECOMMENDED",
    impact: "HIGH",
    recommended: true,
  },
];

const SCREENSHARE_TWEAKS: Tweak[] = [
  {
    id: "DiscordDisableHWAccel",
    title: "Disable Discord Hardware Acceleration",
    desc: "Patches Discord's settings.json to set enableHardwareAcceleration: false — removes GPU rendering from Discord's UI. Reduces VRAM usage and GPU load during screenshares and video calls. Discord will use CPU rendering instead, which is far lighter on your GPU.",
    badge: "RECOMMENDED",
    impact: "HIGH",
    recommended: true,
  },
  {
    id: "DiscordOptimizeCodec",
    title: "Set Screenshare Codec to H264 (Disable Motion Smoothing)",
    desc: "Writes videoCodec: H264 and disableVideoMotionSmoothing: true to Discord's settings.json — forces the lower-overhead H264 codec for screenshares and removes Discord's motion smoothing post-processing. Reduces CPU encode overhead while watching or sending screenshares.",
    impact: "MED",
  },
];

const MAINTENANCE_TWEAKS: Tweak[] = [
  {
    id: "DiscordClearCache",
    title: "Clear Discord Cache (All Folders)",
    desc: "Deletes files in Discord's Cache, Code Cache, GPUCache, and blob_storage folders. Accumulated cache causes load lag, audio glitches, and UI freezes. Cleared automatically — Discord rebuilds cache on next launch.",
    badge: "RECOMMENDED",
    impact: "MED",
    recommended: true,
  },
  {
    id: "DiscordDisableAnimations",
    title: "Enable Reduce Motion in Discord",
    desc: "Sets reduceMotion: true in Discord's settings.json — disables sticker animations, emoji bounce effects, and transition animations. Measurably reduces Discord's CPU and GPU draw calls while gaming.",
    badge: "RECOMMENDED",
    impact: "MED",
    recommended: true,
  },
  {
    id: "DiscordDisableUpdateCheck",
    title: "Deprioritize Discord Auto-Updater",
    desc: "Sets Discord's Update.exe to Below Normal CPU + Very Low I/O priority via IFEO — the background update process no longer spikes CPU and disk I/O mid-game. Updates still download, just without the performance impact.",
    impact: "LOW",
  },
  {
    id: "DiscordDisableCrashHandler",
    title: "Block Discord Crash Reporter",
    desc: "Denies execute permission on crashpad_handler.exe — prevents Discord from spawning its crash upload process. Eliminates the hidden network + CPU activity caused by crash telemetry collection.",
    impact: "LOW",
    warning: "This prevents Discord from uploading crash reports to Discord's servers. If Discord crashes, the report won't be sent. This has no effect on your PC or Discord's functionality — it only blocks the background telemetry upload process.",
  },
  {
    id: "DiscordDisableOverlay",
    title: "Disable Discord In-Game Overlay",
    desc: "Sets OVERLAY_ENABLED: false in settings.json — completely disables the Discord in-game overlay (Alt+F9). Overlay rendering competes for GPU/CPU with your game. Disabling it frees this overhead entirely.",
    badge: "RECOMMENDED",
    impact: "HIGH",
    recommended: true,
  },
  {
    id: "DiscordDisableClips",
    title: "Disable Discord Clips Auto-Recording",
    desc: "Sets disableClips: true in settings.json — stops Discord from recording your gameplay in the background to fill its clip buffer. Clips feature eats memory, GPU VRAM, and CPU for post-processing of recorded footage.",
    badge: "RECOMMENDED",
    impact: "HIGH",
    recommended: true,
  },
  {
    id: "DiscordDisableVAD",
    title: "Disable Voice Activity Detection",
    desc: "Sets noVoiceActivityDetection: true — stops Discord from continuously analyzing your microphone input for speech. VAD causes CPU spikes and can introduce audio lag during intense gaming moments.",
    impact: "MED",
  },
  {
    id: "DiscordLowerVoiceQuality",
    title: "Lower Voice Quality to Basic (8kbps)",
    desc: "Sets audioQualityMode: basic — reduces voice codec from high-quality to basic 8kbps encoding. You save ~90% CPU overhead for voice encoding. Discord quality is still acceptable for gaming.",
    badge: "RECOMMENDED",
    impact: "HIGH",
    recommended: true,
  },
  {
    id: "DiscordDisableStreaming",
    title: "Disable Streaming Features & Buffers",
    desc: "Disables streamNotices, streamingConsent, and streamPauseNotification in settings.json. Removes background streaming metadata processing and screenshare buffer overhead. Screenshare still works, just without the extra overhead.",
    impact: "MED",
  },
];

const GAMING_SESSION_TWEAKS: Tweak[] = [
  {
    id: "DiscordDisableRichPresence",
    title: "Disable Game Activity Scanner (Rich Presence)",
    desc: "Sets detectPlatformGames: false and showCurrentGame: false in settings.json — stops Discord from polling every running process every few seconds to detect what game you're playing. Eliminates the recurring CPU overhead of Discord's process scanner mid-game.",
    badge: "RECOMMENDED",
    impact: "MED",
    recommended: true,
  },
  {
    id: "DiscordDisableGifAutoplay",
    title: "Disable GIF & Animated Emoji Autoplay",
    desc: "Sets gifAutoPlay: false, animatedEmojiAutoplay: false, and showEmojiSuggestions: false in settings.json — stops Discord from rendering looping GIFs and bouncing animated emoji in chat. Each animated frame is a GPU draw call; disabling autoplay cuts this entirely while gaming.",
    badge: "RECOMMENDED",
    impact: "MED",
    recommended: true,
  },
  {
    id: "DiscordMinimizeBgLoad",
    title: "Minimize Background Media & Rendering Load",
    desc: "Sets inlineAttachmentMedia: false, renderSpoilers: ON_CLICK, and showMemberListAvatars: false in settings.json — stops Discord from preloading image/video attachments inline, loading spoiler content eagerly, and rendering avatars in the member list. Reduces background network fetches and GPU compositing while your game is running.",
    badge: "RECOMMENDED",
    impact: "MED",
    recommended: true,
  },
  {
    id: "DiscordSuppressNotifications",
    title: "Suppress Notification Toasts During Gaming",
    desc: "Sets notifyFriendsOnline: false and notifyTyping: false in settings.json — eliminates the popup toasts for friend-online and typing indicators. Also applies the Windows NOC_GLOBAL_SETTING_ALLOW_TOASTS_ABOVE_LOCK registry flag to suppress system-level toasts when you're in a fullscreen game.",
    impact: "MED",
  },
  {
    id: "DiscordDisableSpellcheck",
    title: "Disable Spellcheck Worker",
    desc: "Sets enableSpellCheck: false in settings.json — kills Discord's background spellcheck process that runs on every keystroke in a text box. Small but constant CPU overhead, especially during intense typing moments (calling shots in-game).",
    impact: "LOW",
  },
];

function SectionHeader({
  icon: Icon,
  title,
  recommended,
  tweakState,
  onSet,
}: {
  icon: React.ElementType;
  title: string;
  recommended: string[];
  tweakState: Record<string, boolean>;
  onSet: (id: string, v: boolean) => void;
}) {
  const allOn = recommended.length > 0 && recommended.every(id => tweakState[id]);
  return (
    <div className="flex items-center justify-between mb-4 px-1">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-red-500" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-red-500">{title}</h2>
      </div>
      {recommended.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => recommended.forEach(id => onSet(id, true))}
          disabled={allOn}
          data-testid={`button-enable-recommended-discord-${title.replace(/\s+/g, "-").toLowerCase()}`}
          className="text-[10px] font-bold uppercase tracking-wider text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40 px-2.5 py-1 h-auto rounded-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <CheckCircle2 className="w-3 h-3 mr-1" />
          {allOn ? "Recommended ON" : `Enable Recommended (${recommended.filter(id => !tweakState[id]).length})`}
        </Button>
      )}
    </div>
  );
}

export default function Discord() {
  const { tweaks, setTweak } = useOptimizationStore();
  const hw = useHardwareInfo();
  const recIds = DISCORD_RECOMMENDED;

  const enableAll = () => {
    recIds.forEach(id => setTweak(id, true));
  };

  const enabledCount = ALL_DISCORD_IDS.filter(id => tweaks[id]).length;

  return (
    <AppLayout>
      <div className="space-y-8 w-full pb-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-3 mb-8"
        >
          <div className="flex items-center gap-3">
            <div className="p-3 bg-zinc-900 rounded-lg border border-white/5">
              <MessageCircle className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold">Discord While Gaming</h1>
              <p className="text-zinc-500 text-sm">Kill every way Discord steals FPS — process scanner, GIFs, overlays, notifications, CPU and GPU priority</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={enableAll}
            disabled={hw.gpuName === "Detecting..." || hw.loading}
            title={hw.gpuName === "Detecting..." ? "Run Instant Scan first" : undefined}
            data-testid="button-enable-all-discord"
            className="text-red-400 border-red-500/20 hover:bg-red-500/10 hover:border-red-500/40 text-xs font-bold uppercase tracking-wide shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Zap className="w-3.5 h-3.5 mr-1.5" />
            Enable All Recommended
          </Button>
        </motion.div>

        <PageGuide pageName="Discord Optimizer" />

        {/* Why Discord lags banner */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4"
        >
          <div className="flex items-center gap-2 mb-1">
            <Info className="w-4 h-4 text-zinc-400 shrink-0" />
            <span className="text-sm font-bold text-white">Why Discord causes lag while gaming</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
            {[
              {
                icon: Monitor,
                title: "Hardware Acceleration",
                desc: "Discord uses your GPU to render its UI. During screenshares, it competes with your game for VRAM and encoder bandwidth — causing frame drops.",
                color: "text-red-400",
                bg: "bg-red-500/5 border-red-500/15",
              },
              {
                icon: Cpu,
                title: "CPU Priority Competition",
                desc: "By default, Discord.exe runs at Normal CPU priority — same as your game. Windows doesn't know which one is more important, so it splits time equally.",
                color: "text-orange-400",
                bg: "bg-orange-500/5 border-orange-500/15",
              },
              {
                icon: Trash2,
                title: "Bloated Cache",
                desc: "Discord's cache grows over time and causes random disk I/O spikes during gameplay — audio glitches, mini-freezes, and slow overlay renders.",
                color: "text-amber-400",
                bg: "bg-amber-500/5 border-amber-500/15",
              },
            ].map(item => (
              <div key={item.title} className={cn("rounded-lg border p-4", item.bg)}>
                <div className="flex items-center gap-2 mb-2">
                  <item.icon className={cn("w-4 h-4 shrink-0", item.color)} />
                  <span className={cn("text-xs font-bold", item.color)}>{item.title}</span>
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <TabSmartBar
          tweakIds={ALL_DISCORD_IDS}
          recommendedIds={recIds}
          label="Discord"
          context="These tweaks modify Windows priority registry entries and Discord's local settings.json file. Discord settings (HW accel, codec, animations) take effect on the next Discord launch. Priority tweaks take effect immediately on next Discord start."
          tips={[
            "Disable Hardware Acceleration first — it's the single biggest cause of GPU lag during screenshares.",
            "De-prioritize Discord CPU + GPU so Windows always hands scheduling priority to your game.",
            "Clear the Discord cache if you're experiencing audio glitches, black screens in screenshares, or slow loading.",
          ]}
        />

        <div className="space-y-8">
          {/* CPU + GPU Priority */}
          <section>
            <SectionHeader
              icon={Cpu}
              title="CPU & GPU Priority"
              recommended={["DiscordLowPriority", "DiscordReduceGPUPriority"]}
              tweakState={tweaks}
              onSet={setTweak}
            />
            <div className="space-y-4">
              {PRIORITY_TWEAKS.map((item, i) => (
                <TweakRow
                  key={item.id}
                  id={item.id}
                  title={item.title}
                  description={item.desc}
                  badge={item.badge}
                  impact={item.impact}
                  warning={item.warning}
                  checked={tweaks[item.id] || false}
                  onCheckedChange={v => setTweak(item.id, v)}
                  delay={i + 1}
                />
              ))}
            </div>
          </section>

          {/* Screenshare & Video */}
          <section>
            <SectionHeader
              icon={Monitor}
              title="Screenshare & Video Quality"
              recommended={["DiscordDisableHWAccel"]}
              tweakState={tweaks}
              onSet={setTweak}
            />
            <div className="space-y-4">
              {SCREENSHARE_TWEAKS.map((item, i) => (
                <TweakRow
                  key={item.id}
                  id={item.id}
                  title={item.title}
                  description={item.desc}
                  badge={item.badge}
                  impact={item.impact}
                  warning={item.warning}
                  checked={tweaks[item.id] || false}
                  onCheckedChange={v => setTweak(item.id, v)}
                  delay={i + 1}
                />
              ))}
            </div>

            {/* HW Accel note */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mt-3 flex items-start gap-3 px-4 py-3 rounded-lg border border-blue-500/15 bg-blue-500/5"
            >
              <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-xs text-zinc-400 leading-relaxed">
                <span className="text-blue-400 font-semibold">Note on Hardware Acceleration:</span>{" "}
                After running the script, fully close and reopen Discord for the setting to take effect.
                You can also verify it manually: Discord Settings → Appearance → scroll down → Hardware Acceleration (should be OFF).
              </p>
            </motion.div>
          </section>

          {/* Cache + Background */}
          <section>
            <SectionHeader
              icon={Shield}
              title="Cache & Background Processes"
              recommended={["DiscordClearCache", "DiscordDisableAnimations"]}
              tweakState={tweaks}
              onSet={setTweak}
            />
            <div className="space-y-4">
              {MAINTENANCE_TWEAKS.map((item, i) => (
                <TweakRow
                  key={item.id}
                  id={item.id}
                  title={item.title}
                  description={item.desc}
                  badge={item.badge}
                  impact={item.impact}
                  warning={item.warning}
                  checked={tweaks[item.id] || false}
                  onCheckedChange={v => setTweak(item.id, v)}
                  delay={i + 1}
                />
              ))}
            </div>
          </section>

          {/* Discord Open While Gaming */}
          <section>
            <SectionHeader
              icon={Gamepad2}
              title="Discord Open While Gaming"
              recommended={["DiscordDisableRichPresence", "DiscordDisableGifAutoplay", "DiscordMinimizeBgLoad"]}
              tweakState={tweaks}
              onSet={setTweak}
            />
            <div className="space-y-4">
              {GAMING_SESSION_TWEAKS.map((item, i) => (
                <TweakRow
                  key={item.id}
                  id={item.id}
                  title={item.title}
                  description={item.desc}
                  badge={item.badge}
                  impact={item.impact}
                  warning={item.warning}
                  checked={tweaks[item.id] || false}
                  onCheckedChange={v => setTweak(item.id, v)}
                  delay={i + 1}
                />
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mt-3 flex items-start gap-3 px-4 py-3 rounded-lg border border-red-500/15 bg-red-500/5"
            >
              <Gamepad2 className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-zinc-400 leading-relaxed">
                <span className="text-red-400 font-semibold">Gaming session tip:</span>{" "}
                These tweaks target Discord's background overhead specifically while a game is running.
                Apply them alongside the CPU/GPU Priority tweaks above for maximum effect — together they
                stop Discord from scanning processes, rendering animations, preloading media, and
                popping up notifications mid-game.
              </p>
            </motion.div>
          </section>

          {/* What to expect */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              What to expect after applying
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                "Your game gets CPU scheduling priority — Discord won't compete",
                "GPU encoder is freed from Discord UI rendering",
                "Screenshares use H264 codec with less CPU overhead",
                "Background update checks don't spike CPU mid-game",
                "Cached junk cleaned — fixes audio glitches and black screenshares",
                "Discord's own UI animations are disabled to reduce render calls",
              ].map((point, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-zinc-500">
                  <span className="w-1 h-1 rounded-full bg-red-500/60 mt-1.5 shrink-0" />
                  {point}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-zinc-600 mt-4 leading-relaxed">
              <span className="text-zinc-500 font-medium">Screenshare tip:</span> For the smoothest screenshare while gaming, keep Discord in your taskbar (not minimized to tray) and make sure Hardware Acceleration is confirmed OFF in Discord's appearance settings. Enable "Reduce Motion" inside Discord's Accessibility settings for extra overhead reduction.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
