import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { TweakRow } from "@/components/tweak-row";
import { TabSmartBar } from "@/components/tab-smart-bar";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { Button } from "@/components/ui/button";
import { MessageCircle, CheckCircle2, Info, Zap, Monitor, Cpu, Trash2, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const ALL_DISCORD_IDS = [
  "DiscordLowPriority",
  "DiscordReduceGPUPriority",
  "DiscordDisableHWAccel",
  "DiscordOptimizeCodec",
  "DiscordClearCache",
  "DiscordDisableUpdateCheck",
  "DiscordDisableAnimations",
  "DiscordDisableCrashHandler",
];

const DISCORD_RECOMMENDED = [
  "DiscordLowPriority",
  "DiscordReduceGPUPriority",
  "DiscordDisableHWAccel",
  "DiscordClearCache",
  "DiscordDisableAnimations",
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

  const enableAll = () => {
    DISCORD_RECOMMENDED.forEach(id => setTweak(id, true));
  };

  const enabledCount = ALL_DISCORD_IDS.filter(id => tweaks[id]).length;

  return (
    <AppLayout>
      <div className="space-y-8 max-w-4xl pb-10">
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
              <h1 className="text-2xl font-display font-bold">Discord Optimizer</h1>
              <p className="text-zinc-500 text-sm">Stop Discord from eating your FPS during gaming sessions and screenshares</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={enableAll}
            data-testid="button-enable-all-discord"
            className="text-red-400 border-red-500/20 hover:bg-red-500/10 hover:border-red-500/40 text-xs font-bold uppercase tracking-wide shrink-0"
          >
            <Zap className="w-3.5 h-3.5 mr-1.5" />
            Enable All Recommended
          </Button>
        </motion.div>

        {/* Why Discord lags banner */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-3"
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
          recommendedIds={DISCORD_RECOMMENDED}
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
            <div className="space-y-3">
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
            <div className="space-y-3">
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
            <div className="space-y-3">
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
