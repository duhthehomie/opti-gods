import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Gamepad2, Shield, Sparkles } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { tweaksByCategory, type TweakCategory } from "@/lib/tweak-registry";

type GameProfile = {
  slug: string;
  title: string;
  publisher: string;
  cover: string;
  description: string;
  categories?: TweakCategory[];
  count?: number;
};

const PROFILES: GameProfile[] = [
  { slug: "fivem", title: "FiveM / GTA V", publisher: "Cfx.re / Rockstar Games", cover: "/game-covers/fivem.png", description: "Priority, cache, streaming, network buffers, server tools, and GTA process tuning.", categories: ["fivem"] },
  { slug: "fortnite", title: "Fortnite", publisher: "Epic Games", cover: "/game-covers/fortnite-new.png", description: "DX12, shader precompile, input latency, frame pacing, and hardware-aware graphics tuning.", categories: ["fortnite"] },
  { slug: "call-of-duty", title: "Call of Duty / Warzone", publisher: "Activision", cover: "https://cdn.akamai.steamstatic.com/steam/apps/1938090/header.jpg", description: "VRAM, texture streaming, HAGS, networking, CPU scheduling, and shader-cache fixes.", categories: ["cod"] },
  { slug: "007-first-light", title: "007: First Light", publisher: "IO Interactive", cover: "/game-covers/007-first-light.jpg", description: "UE5 Engine.ini tuning, Lumen controls, process priority, and shader-cache preparation.", count: 13 },
  { slug: "rust", title: "Rust", publisher: "Facepunch Studios", cover: "/game-covers/rust.png", description: "Client configuration, CPU priority, frame cap, shadows, networking, and launch tuning.", categories: ["rust"] },
  { slug: "roblox", title: "Roblox", publisher: "Roblox Corporation", cover: "/game-covers/roblox.png", description: "FFlags, frame-rate controls, process priority, post-processing, and rendering settings.", categories: ["roblox"] },
  { slug: "discord", title: "Discord While Gaming", publisher: "Discord", cover: "https://cdn.simpleicons.org/discord/5865F2", description: "Reduce background GPU, media, notification, and process overhead during games.", categories: ["discord"] },
  { slug: "spotify", title: "Spotify While Gaming", publisher: "Spotify", cover: "https://cdn.simpleicons.org/spotify/1DB954", description: "Reduce GPU, CPU, startup, and bandwidth overhead while keeping music available.", categories: ["spotify"] },
];

function profileCount(profile: GameProfile): number {
  if (profile.count) return profile.count;
  return (profile.categories ?? []).reduce((sum, category) => sum + tweaksByCategory(category).length, 0);
}

export default function GameProfiles() {
  return (
    <AppLayout>
      <div className="w-full space-y-6 pb-10">
        <header className="flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-red-400">
              <Gamepad2 className="h-3.5 w-3.5" /> Game Profiles
            </div>
            <h1 className="mt-2 font-display text-3xl font-black text-white">Optimization built around the game.</h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-500">
              Game-specific controls live here now. Windows, network, GPU, and system-wide controls remain in Tweaks.
            </p>
          </div>
          <Link href="/game-detection" className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs font-bold text-zinc-300 hover:border-red-500/30 hover:text-white md:flex">
            Detect my games <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {PROFILES.map((profile, index) => {
            const count = profileCount(profile);
            return (
              <motion.div key={profile.slug} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.025 }}>
                <Link href={`/game-profiles/${profile.slug}`} className="group block overflow-hidden rounded-2xl border border-white/[0.07] bg-[#080d0f] transition-all hover:-translate-y-0.5 hover:border-red-500/35 hover:shadow-[0_18px_60px_-34px_rgba(239,68,68,0.8)]">
                  <div className="relative aspect-[16/8] overflow-hidden bg-zinc-950">
                    <img src={profile.cover} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" onError={(event) => { event.currentTarget.style.display = "none"; }} />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#080d0f] via-transparent to-transparent" />
                    <span className="absolute right-3 top-3 rounded-full border border-white/10 bg-black/70 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-zinc-300 backdrop-blur">
                      {count} tweaks
                    </span>
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-display text-base font-black text-white">{profile.title}</h2>
                        <p className="mt-0.5 text-[10px] text-zinc-600">{profile.publisher}</p>
                      </div>
                      <Shield className="h-4 w-4 shrink-0 text-red-400" />
                    </div>
                    <p className="mt-3 min-h-10 text-xs leading-relaxed text-zinc-500">{profile.description}</p>
                    <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-4">
                      <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-red-300"><Sparkles className="h-3 w-3" /> Open profile</span>
                      <ArrowRight className="h-3.5 w-3.5 text-zinc-700 transition-transform group-hover:translate-x-1 group-hover:text-red-300" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </section>
      </div>
    </AppLayout>
  );
}