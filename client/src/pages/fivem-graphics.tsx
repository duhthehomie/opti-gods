import { useState, useCallback, useRef } from "react";
import { zipSync, strToU8 } from "fflate";
import { AppLayout } from "@/components/layout/app-layout";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  Cloud, CloudOff, Wind, Palette, Package, Lock, Download,
  CheckCircle2, Sparkles, ChevronRight, Info, Eye,
  FolderOpen, Layers, Clock, Sun, Snowflake, CloudRain,
  Zap, Shield, Monitor, Flame, Wand2, SendHorizonal, Loader2,
  AlertCircle, Moon, Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

// ── Gate ─────────────────────────────────────────────────────────────────────
const GATE_CODE = "4258";

// ── Math helpers ──────────────────────────────────────────────────────────────
function lerp(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t);
}
function num(v: number, decimals = 6) {
  return v.toFixed(decimals);
}

// ── Sky color system ───────────────────────────────────────────────────────────
const SKY_COLORS = {
  // Blues
  vivid_blue:  { label: "Vivid Blue",    r: 18,  g: 70,  b: 190, group: "blue",  swatch: "#1246BE" },
  sky_blue:    { label: "Sky Blue",      r: 28,  g: 120, b: 210, group: "blue",  swatch: "#1C78D2" },
  cyan:        { label: "Bright Cyan",   r: 20,  g: 155, b: 210, group: "blue",  swatch: "#149BD2" },
  deep_blue:   { label: "Deep Blue",     r: 10,  g: 28,  b: 105, group: "blue",  swatch: "#0A1C69" },
  navy:        { label: "Dark Navy",     r: 6,   g: 10,  b: 52,  group: "blue",  swatch: "#060A34" },
  // Pinks
  bubblegum:   { label: "Bubblegum",     r: 215, g: 110, b: 165, group: "pink",  swatch: "#D76EA5" },
  hot_pink:    { label: "Hot Pink",      r: 195, g: 42,  b: 110, group: "pink",  swatch: "#C32A6E" },
  rose:        { label: "Rose Pink",     r: 165, g: 30,  b: 80,  group: "pink",  swatch: "#A51E50" },
  magenta:     { label: "Deep Magenta",  r: 90,  g: 6,   b: 72,  group: "pink",  swatch: "#5A0648" },
  // Grey / Mono
  steel_grey:  { label: "Steel Grey",    r: 78,  g: 88,  b: 102, group: "grey",  swatch: "#4E5866" },
  dark_grey:   { label: "Dark Grey",     r: 28,  g: 30,  b: 38,  group: "grey",  swatch: "#1C1E26" },
  black_sky:   { label: "Black Sky",     r: 4,   g: 4,   b: 7,   group: "grey",  swatch: "#040407" },
} as const;
type SkyColorKey = keyof typeof SKY_COLORS;

function skyRgb(key: SkyColorKey, brightness: number) {
  const base = SKY_COLORS[key];
  const mul = 0.35 + (brightness / 100) * 0.9;
  return {
    r: Math.min(255, Math.round(base.r * mul)),
    g: Math.min(255, Math.round(base.g * mul)),
    B: Math.min(255, Math.round(base.b * mul)),
  };
}
function skyLabel(key: SkyColorKey) {
  return SKY_COLORS[key].label;
}

// ── XML builders ──────────────────────────────────────────────────────────────
const WEATHER_TYPES = [
  "EXTRASUNNY","CLEAR","NEUTRAL","SMOG","FOGGY",
  "OVERCAST","CLOUDS","CLEARING","RAIN","THUNDER",
  "BLIZZARD","SNOW","SNOWLIGHT","XMAS","HALLOWEEN",
];
const RAIN_WEATHER  = ["RAIN","THUNDER"];
const SNOW_WEATHER  = ["BLIZZARD","SNOW","SNOWLIGHT","XMAS"];

function buildTimecycleXml(opts: {
  cloudThickness: number;
  jetStreams: number;
  skyColorKey: SkyColorKey;
  skyBrightness: number;
  freezeTime: boolean;
  disableRain: boolean;
  disableSnow: boolean;
  aerialClouds: boolean;
  aerialDensity: number;
  lightRays: boolean;
  lightRayIntensity: number;
  sunIntensity: number;
  atmosphereHaze: boolean;
}): string {
  const c = opts.cloudThickness / 100;
  const j = opts.jetStreams / 100;
  const { r, g, B } = skyRgb(opts.skyColorKey, opts.skyBrightness);

  const skyR = num(r / 255);
  const skyG = num(g / 255);
  const skyB = num(B / 255);

  const aerialHat  = opts.aerialClouds ? num(opts.aerialDensity / 100) : num(0);
  const rayStrength = opts.lightRays ? num(opts.lightRayIntensity / 100) : num(0);
  // Sun intensity 0.5–3.0; grey/black skies get a dimmer sun for realism
  const isGrey = SKY_COLORS[opts.skyColorKey].group === "grey";
  const sunScale = isGrey ? 0.4 + (opts.sunIntensity / 100) * 1.2 : 0.5 + (opts.sunIntensity / 100) * 2.5;
  const sunMul  = num(sunScale);
  const hazeVal = opts.atmosphereHaze ? num(0.18) : num(0);

  const items = WEATHER_TYPES.map(w => {
    let cloudVal  = num(c);
    let jetVal    = num(j);
    let aerialVal = aerialHat;
    let rayVal    = rayStrength;

    // Freeze Time → clear all weather (no cloud draw calls = big FPS gain)
    if (opts.freezeTime) {
      cloudVal  = num(0);
      jetVal    = num(0);
      aerialVal = num(0);
    }
    if (opts.disableRain && RAIN_WEATHER.includes(w)) {
      cloudVal  = num(0);
      jetVal    = num(0);
      aerialVal = num(0);
      rayVal    = num(0);
    }
    if (opts.disableSnow && SNOW_WEATHER.includes(w)) {
      cloudVal  = num(0);
      aerialVal = num(0);
    }

    const mods = [
      ["cloudinessVal",    cloudVal,  cloudVal ],
      ["cloudHatLevel",    aerialVal, aerialVal],
      ["contrailDensity",  jetVal,    jetVal   ],
      ["lightRayStrength", rayVal,    rayVal   ],
      ["sunMult",          sunMul,    sunMul   ],
      ["fogHaze",          hazeVal,   hazeVal  ],
      ["skyColour r",      skyR,      skyR     ],
      ["skyColour g",      skyG,      skyG     ],
      ["skyColour b",      skyB,      skyB     ],
    ];

    const modEntries = mods.map(([kw, val, valEnd]) =>
      `        <Item>\n          <modKeyword>${kw}</modKeyword>\n          <modValue>${val}</modValue>\n          <modValueEnd>${valEnd}</modValueEnd>\n        </Item>`
    ).join("\n");

    return `    <Item>\n      <name>${w}</name>\n      <mods>\n${modEntries}\n      </mods>\n    </Item>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<timecycle_mods_file>\n  <mods>\n${items}\n  </mods>\n</timecycle_mods_file>\n`;
}

function buildWeatherXml(opts: {
  cloudThickness: number;
  freezeTime: boolean;
  disableRain: boolean;
  disableSnow: boolean;
}): string {
  const c = opts.cloudThickness / 100;

  const weatherDefs = [
    { name: "EXTRASUNNY", base: 0.0  },
    { name: "CLEAR",      base: 0.0  },
    { name: "NEUTRAL",    base: 0.1  },
    { name: "SMOG",       base: 0.3  },
    { name: "FOGGY",      base: 0.5  },
    { name: "OVERCAST",   base: 0.8  },
    { name: "CLOUDS",     base: 0.6  },
    { name: "CLEARING",   base: 0.2  },
    { name: "RAIN",       base: 0.9  },
    { name: "THUNDER",    base: 1.0  },
    { name: "BLIZZARD",   base: 0.8  },
    { name: "SNOW",       base: 0.7  },
    { name: "SNOWLIGHT",  base: 0.3  },
    { name: "XMAS",       base: 0.5  },
    { name: "HALLOWEEN",  base: 0.4  },
  ];

  const entries = weatherDefs.map(({ name, base }) => {
    let effective = Math.min(c, base + c * 0.2);
    let cloudHat  = c;

    if (opts.freezeTime ||
        (opts.disableRain && RAIN_WEATHER.includes(name)) ||
        (opts.disableSnow && SNOW_WEATHER.includes(name))) {
      effective = 0;
      cloudHat  = 0;
    }

    return `    <Item>\n      <Name>${name}</Name>\n      <cloudHatLevel value="${num(cloudHat, 4)}" />\n      <cloudiness value="${num(effective, 4)}" />\n    </Item>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<CWeatherTypeList>\n  <WeatherTypes>\n${entries}\n  </WeatherTypes>\n</CWeatherTypeList>\n`;
}

function buildTimeFreezeScript(hour: number, minute: number): string {
  return [
    `-- Opti Gods Time Freeze — generated by optigods.com`,
    `-- Place inside citizen/optigods-timecycle/ — drag citizen folder as normal`,
    `-- Then open FiveM, press F8, and type:  start optigods-timecycle`,
    ``,
    `Citizen.CreateThread(function()`,
    `    while true do`,
    `        -- Freeze clock at ${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")} — prevents sun-angle FPS dips`,
    `        NetworkOverrideClockTime(${hour}, ${minute}, 0)`,
    `        Citizen.Wait(1000)`,
    `    end`,
    `end)`,
  ].join("\n");
}

function buildTimeFreezeManifest(): string {
  return [
    `fx_version 'cerulean'`,
    `game 'gta5'`,
    ``,
    `description 'Opti Gods time freeze — locks in-game clock for stable FPS'`,
    `version '1.0.0'`,
    ``,
    `client_scripts {`,
    `    'client.lua'`,
    `}`,
  ].join("\n");
}

function buildBloodVisualSettings(): string {
  return [
    `# Opti Gods — Blood/Gore Renderer Override`,
    `# Generated by optigods.com`,
    `#`,
    `# INSTALL: Already at the correct path inside your pack ZIP.`,
    `#   citizen\\common\\data\\visualsettings.dat`,
    `#   Same citizen drag-and-replace — no extra steps.`,
    `#`,
    `# EFFECT: Zeros blood pool rendering scale, scatter pattern, and HDR brightness.`,
    ``,
    `blood.poolScale           0.000000`,
    `blood.scatterScale        0.000000`,
    `blood.poolHdrMult         0.000000`,
  ].join("\n");
}

type PackOpts = {
  packName: string;
  cloudThickness: number;
  jetStreams: number;
  skyColorKey: SkyColorKey;
  skyBrightness: number;
  keepProps: boolean;
  disableRain: boolean;
  disableSnow: boolean;
  disableBloodDecals: boolean;
  freezeTime: boolean;
  freezeHour: number;
  freezeMinute: number;
  aerialClouds: boolean;
  aerialDensity: number;
  lightRays: boolean;
  lightRayIntensity: number;
  sunIntensity: number;
  atmosphereHaze: boolean;
};

function buildReadme(opts: PackOpts): string {
  const label = skyLabel(opts.skyColorKey);
  const flags: string[] = [];
  if (opts.disableRain)        flags.push("Rain disabled (+25 FPS)");
  if (opts.disableSnow)        flags.push("Snow disabled (+25-30 FPS)");
  if (opts.disableBloodDecals) flags.push("Blood decals disabled (citizen override)");
  if (opts.freezeTime)         flags.push(`Time + weather frozen at ${String(opts.freezeHour).padStart(2,"0")}:${String(opts.freezeMinute).padStart(2,"0")} (+30-45 FPS)`);
  if (opts.aerialClouds)       flags.push(`Aerial clouds ON (${opts.aerialDensity}% density)`);
  if (opts.lightRays)          flags.push(`Light rays ON (${opts.lightRayIntensity}% intensity)`);
  if (opts.atmosphereHaze)     flags.push("Atmosphere haze ON");

  return [
    `OPTI GODS — FiveM Graphics Pack`,
    `Pack Name  : ${opts.packName}`,
    `Generated  : ${new Date().toISOString().split("T")[0]}`,
    `Sky Color  : ${label} (brightness ${opts.skyBrightness}%)`,
    ``,
    `SETTINGS`,
    `  Ground Clouds   : ${opts.cloudThickness}%  ${opts.cloudThickness === 0 ? "(+2-6 FPS)" : ""}`,
    `  Aerial Clouds   : ${opts.aerialClouds ? opts.aerialDensity + "% density" : "OFF (+3-8 FPS)"}`,
    `  Jet Streams     : ${opts.jetStreams}%  ${opts.jetStreams === 0 ? "(+1-2 FPS)" : ""}`,
    `  Light Rays      : ${opts.lightRays ? opts.lightRayIntensity + "% intensity (-5-15 FPS)" : "OFF (+5-15 FPS)"}`,
    `  Sun Intensity   : ${opts.sunIntensity}%`,
    `  Atmosphere Haze : ${opts.atmosphereHaze ? "ON" : "OFF (+1-3 FPS)"}`,
    `  Sky Colour      : ${label}`,
    `  Props           : ${opts.keepProps ? "Kept (full props)" : "Reduced"}`,
    flags.length ? `  Flags           : ${flags.join(", ")}` : "",
    ``,
    `INSTALL`,
    `  1. Extract this zip`,
    `  2. Open: %LOCALAPPDATA%\\FiveM\\FiveM Application Data\\`,
    `  3. DELETE the existing "citizen" folder inside`,
    `  4. Drag the new "citizen" folder from the zip in`,
    `  5. Restart FiveM completely`,
    ``,
    opts.freezeTime ? [
      `TIME FREEZE (client-side only — no server needed)`,
      `  citizen/optigods-timecycle/ is inside the citizen folder.`,
      `  After installing, open FiveM → press F8 → type:  start optigods-timecycle`,
      `  Locks sun at ${String(opts.freezeHour).padStart(2,"0")}:${String(opts.freezeMinute).padStart(2,"0")} — biggest single FPS gain (+30-45 FPS)`,
      ``,
    ].join("\n") : "",
    `UNINSTALL`,
    `  Delete the "citizen" folder from FiveM Application Data`,
    `  (or remove timecycle_mods_1.xml + weather.xml from citizen/)`,
    `  Restart FiveM — stock visuals restore instantly.`,
    ``,
    `FPS TIPS (Ryzen 5 3500 / GTX 1650 Super tested)`,
    `  Freeze Time ON    = biggest single gain (+30-45 FPS)`,
    `  No Rain           = +25 FPS`,
    `  No Snow           = +25-30 FPS`,
    `  Ground Clouds 0%  = +2-6 FPS`,
    `  Light Rays OFF    = +5-15 FPS`,
    `  Grey/Black sky    = +2-4 FPS (fewer color-buffer ops)`,
    `by leaq — optigods.com`,
  ].filter(l => l !== "").join("\r\n");
}

function generateZip(opts: PackOpts): Uint8Array {
  const tcXml      = buildTimecycleXml(opts);
  const weatherXml = buildWeatherXml(opts);
  const readme     = buildReadme(opts);

  const files: Record<string, Uint8Array> = {
    "citizen/platform/data/tune/timecycle_mods_1.xml": strToU8(tcXml),
    "citizen/common/data/weather.xml":                  strToU8(weatherXml),
    "READ ME - How to install.txt":                     strToU8(readme),
  };

  if (opts.freezeTime) {
    files["citizen/optigods-timecycle/client.lua"]     = strToU8(buildTimeFreezeScript(opts.freezeHour, opts.freezeMinute));
    files["citizen/optigods-timecycle/fxmanifest.lua"] = strToU8(buildTimeFreezeManifest());
  }

  if (opts.disableBloodDecals) {
    files["citizen/common/data/visualsettings.dat"] = strToU8(buildBloodVisualSettings());
  }

  return zipSync(files);
}

function downloadBlob(data: Uint8Array, filename: string) {
  try {
    const blob = new Blob([data], { type: "application/zip" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error("Download failed:", e);
    alert("Download failed — please try again or check browser permissions.");
  }
}

// ── Pack theme presets ─────────────────────────────────────────────────────────
const PACK_THEMES: Array<{
  key: string; label: string; desc: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  settings: Partial<PackOpts>;
}> = [
  {
    key: "fps_god", label: "FPS GOD", desc: "Black sky, no clouds, frozen noon — absolute max FPS",
    icon: Zap, color: "emerald",
    settings: { skyColorKey: "black_sky", skyBrightness: 60, cloudThickness: 0, jetStreams: 0, aerialClouds: false, lightRays: false, atmosphereHaze: false, freezeTime: true, freezeHour: 12, disableRain: true, disableSnow: true, keepProps: true },
  },
  {
    key: "blue_sky", label: "Clear Blue", desc: "leaq's daily — vivid blue, zero clouds, frozen noon",
    icon: Sun, color: "blue",
    settings: { skyColorKey: "vivid_blue", skyBrightness: 75, cloudThickness: 0, jetStreams: 0, aerialClouds: false, lightRays: false, atmosphereHaze: false, freezeTime: true, freezeHour: 12, disableRain: true, disableSnow: true, keepProps: true },
  },
  {
    key: "pink_heaven", label: "Pink Heaven", desc: "Rose pink sky frozen at noon — stunning visuals, FPS safe",
    icon: Sparkles, color: "pink",
    settings: { skyColorKey: "rose", skyBrightness: 80, cloudThickness: 0, jetStreams: 0, aerialClouds: false, lightRays: false, atmosphereHaze: false, freezeTime: true, freezeHour: 12, disableRain: true, disableSnow: true, keepProps: true },
  },
  {
    key: "golden_hour", label: "Golden Hour", desc: "Warm dusk frozen at 18:00 — cinematic look",
    icon: Flame, color: "amber",
    settings: { skyColorKey: "vivid_blue", skyBrightness: 65, cloudThickness: 15, jetStreams: 0, aerialClouds: false, lightRays: true, lightRayIntensity: 38, atmosphereHaze: false, freezeTime: true, freezeHour: 18, disableRain: true, disableSnow: true, keepProps: true },
  },
  {
    key: "night_drive", label: "Night Drive", desc: "Midnight frozen — perfect stars, moon, clean dark sky",
    icon: Moon, color: "indigo",
    settings: { skyColorKey: "navy", skyBrightness: 40, cloudThickness: 0, jetStreams: 0, aerialClouds: false, lightRays: false, atmosphereHaze: false, freezeTime: true, freezeHour: 0, disableRain: true, disableSnow: true, keepProps: true },
  },
  {
    key: "bubblegum_sky", label: "Bubblegum Sky", desc: "Pastel pink-purple dawn — unique and stunning",
    icon: Star, color: "fuchsia",
    settings: { skyColorKey: "bubblegum", skyBrightness: 70, cloudThickness: 10, jetStreams: 0, aerialClouds: false, lightRays: false, atmosphereHaze: false, freezeTime: true, freezeHour: 7, disableRain: true, disableSnow: true, keepProps: true },
  },
  {
    key: "snow_pack", label: "Snow Pack", desc: "Steel grey, snow ON, frozen noon — winter themed",
    icon: Snowflake, color: "cyan",
    settings: { skyColorKey: "steel_grey", skyBrightness: 65, cloudThickness: 25, jetStreams: 0, aerialClouds: true, aerialDensity: 40, lightRays: false, atmosphereHaze: true, freezeTime: true, freezeHour: 12, disableRain: true, disableSnow: false, keepProps: true },
  },
  {
    key: "rain_pack", label: "Storm Pack", desc: "Dark clouds, rain ON, frozen noon — moody storm look",
    icon: CloudRain, color: "slate",
    settings: { skyColorKey: "dark_grey", skyBrightness: 55, cloudThickness: 70, jetStreams: 0, aerialClouds: true, aerialDensity: 60, lightRays: false, atmosphereHaze: true, freezeTime: true, freezeHour: 12, disableRain: false, disableSnow: true, keepProps: true },
  },
];

// ── Components ────────────────────────────────────────────────────────────────
function Toggle({ on, onToggle, testId }: { on: boolean; onToggle: () => void; testId?: string }) {
  return (
    <button
      onClick={onToggle}
      data-testid={testId}
      className={cn(
        "w-11 h-6 rounded-full border transition-all relative shrink-0",
        on ? "bg-red-500/30 border-red-500/50" : "bg-zinc-800 border-white/10"
      )}
    >
      <span className={cn(
        "absolute top-0.5 w-5 h-5 rounded-full transition-all",
        on ? "left-5 bg-red-400" : "left-0.5 bg-zinc-600"
      )} />
    </button>
  );
}

function ToggleRow({
  icon: Icon, label, sub, on, onToggle, testId, color = "red", warn,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; sub: string; on: boolean; onToggle: () => void;
  testId?: string; color?: "red" | "amber" | "green" | "cyan"; warn?: string;
}) {
  const iconColors = { red: "text-red-400", amber: "text-amber-400", green: "text-emerald-400", cyan: "text-cyan-400" };
  return (
    <div>
      <div className="flex items-center justify-between py-2">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-white/3 border border-white/8 flex items-center justify-center">
            <Icon className={cn("w-3.5 h-3.5", iconColors[color])} />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">{label}</p>
            <p className="text-[10px] text-zinc-500">{sub}</p>
          </div>
        </div>
        <Toggle on={on} onToggle={onToggle} testId={testId} />
      </div>
      {on && warn && (
        <div className="ml-9 text-[10px] text-amber-400/80 bg-amber-500/5 border border-amber-500/15 rounded-lg px-3 py-1.5 mt-1">
          {warn}
        </div>
      )}
    </div>
  );
}

function ControlRow({
  icon: Icon, label, sublabel, fpsBadge, fpsColor = "emerald", color = "zinc", children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; sublabel?: string; fpsBadge?: string | null;
  fpsColor?: "emerald" | "zinc" | "amber" | "red";
  color?: string; children: React.ReactNode;
}) {
  const iconColors: Record<string, string> = {
    zinc: "text-zinc-400", red: "text-red-400", blue: "text-blue-400",
    cyan: "text-cyan-400", amber: "text-amber-400",
  };
  const badgeColors = {
    emerald: "bg-emerald-500/15 border-emerald-500/20 text-emerald-400",
    zinc:    "bg-zinc-800 border-white/10 text-zinc-500",
    amber:   "bg-amber-500/15 border-amber-500/20 text-amber-400",
    red:     "bg-red-500/15 border-red-500/20 text-red-400",
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="w-7 h-7 rounded-lg bg-white/3 border border-white/8 flex items-center justify-center shrink-0">
          <Icon className={cn("w-3.5 h-3.5", iconColors[color] ?? "text-zinc-400")} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-white leading-tight">{label}</p>
            {fpsBadge && (
              <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full border", badgeColors[fpsColor])}>
                {fpsBadge}
              </span>
            )}
          </div>
          {sublabel && <p className="text-[10px] text-zinc-500 mt-0.5">{sublabel}</p>}
        </div>
      </div>
      <div className="pl-9">{children}</div>
    </div>
  );
}

// ── Live Sky Preview ──────────────────────────────────────────────────────────
function SkyPreview({
  cloudThickness, jetStreams, skyColorKey, skyBrightness,
  freezeTime, freezeHour, disableRain, disableSnow,
  aerialClouds, aerialDensity, lightRays, lightRayIntensity,
  atmosphereHaze, sunIntensity,
}: {
  cloudThickness: number; jetStreams: number;
  skyColorKey: SkyColorKey; skyBrightness: number;
  freezeTime: boolean; freezeHour: number;
  disableRain: boolean; disableSnow: boolean;
  aerialClouds?: boolean; aerialDensity?: number;
  lightRays?: boolean; lightRayIntensity?: number;
  atmosphereHaze?: boolean; sunIntensity?: number;
}) {
  const { r, g, B } = skyRgb(skyColorKey, skyBrightness);
  const colorGroup = SKY_COLORS[skyColorKey].group;
  const effectiveClouds = (freezeTime) ? 0 : cloudThickness;
  const effectiveJets   = (freezeTime) ? 0 : jetStreams;
  const hour = freezeTime ? freezeHour : 12;

  const isDawn     = hour >= 5  && hour <= 7;
  const isGolden   = hour >= 17 && hour <= 20;
  const isNight    = hour < 5   || hour > 21;
  const isTwilight = (hour === 4 || hour === 21);
  const isMidnight = hour === 0 || hour === 23;

  // For grey/black skies, stars appear more during dark hours or at any hour for black
  const showStars = isNight || isTwilight || (colorGroup === "grey" && skyBrightness < 45);

  // Sky gradient — adapt based on color group
  let skyTop: string, skyMid: string, skyBot: string;

  if (colorGroup === "grey") {
    // Grey / black skies — no hue tint, just luminance
    if (isNight || isMidnight) {
      skyTop = `rgb(${Math.round(r*0.3)},${Math.round(g*0.3)},${Math.round(B*0.3)})`;
      skyMid = `rgb(${r},${g},${B})`;
      skyBot = `rgb(3,3,5)`;
    } else {
      skyTop = `rgb(${r},${g},${B})`;
      skyMid = `rgb(${Math.min(r+12,255)},${Math.min(g+12,255)},${Math.min(B+14,255)})`;
      skyBot = `rgb(${Math.max(r-15,0)},${Math.max(g-15,0)},${Math.max(B-12,0)})`;
    }
  } else if (colorGroup === "pink") {
    if (isNight) {
      skyTop = `rgb(${Math.round(r*0.12)},${Math.round(g*0.05)},${Math.round(B*0.12)})`;
      skyMid = `rgb(${Math.round(r*0.25)},${Math.round(g*0.12)},${Math.round(B*0.25)})`;
      skyBot = `rgb(8,4,10)`;
    } else if (isDawn || isGolden) {
      skyTop = `rgb(${Math.round(r*0.6)},${Math.round(g*0.3)},${Math.round(B*0.55)})`;
      skyMid = `rgb(${r},${g},${B})`;
      skyBot = `rgb(100,30,55)`;
    } else {
      skyTop = `rgb(${r},${g},${B})`;
      skyMid = `rgb(${Math.min(r+20,255)},${Math.min(g+18,255)},${Math.min(B+22,255)})`;
      skyBot = `rgb(${Math.max(r-20,0)},${Math.max(g-15,0)},${Math.max(B-18,0)})`;
    }
  } else {
    // Blues
    if (isNight) {
      skyTop = `rgb(2,4,12)`;
      skyMid = `rgb(${Math.round(r*0.07)},${Math.round(g*0.07)},${Math.round(B*0.18)})`;
      skyBot = `rgb(6,8,18)`;
    } else if (isDawn) {
      skyTop = `rgb(${Math.round(r*0.4)},${Math.round(g*0.35)},${Math.round(B*0.65)})`;
      skyMid = `rgb(${r},${g},${B})`;
      skyBot = `rgb(70,38,18)`;
    } else if (isGolden) {
      skyTop = `rgb(${Math.round(r*0.65)},${Math.round(g*0.55)},${Math.round(B*0.85)})`;
      skyMid = `rgb(${r},${Math.round(g*0.82)},${Math.round(B*0.68)})`;
      skyBot = `rgb(85,44,10)`;
    } else if (isTwilight) {
      skyTop = `rgb(${Math.round(r*0.25)},${Math.round(g*0.2)},${Math.round(B*0.5)})`;
      skyMid = `rgb(${Math.round(r*0.5)},${Math.round(g*0.4)},${Math.round(B*0.7)})`;
      skyBot = `rgb(40,20,8)`;
    } else {
      skyTop = `rgb(${r},${g},${B})`;
      skyMid = `rgb(${Math.min(r+15,255)},${Math.min(g+22,255)},${Math.min(B+8,255)})`;
      skyBot = `rgb(${Math.min(r+28,255)},${Math.min(g+38,255)},${Math.min(B+12,255)})`;
    }
  }

  // Sun arc
  const arcT    = Math.max(0, Math.min(1, (hour - 5) / 14));
  const sunXPct = 4 + arcT * 88;
  const sunYPct = isNight ? -20 : 72 - Math.sin(arcT * Math.PI) * 62;
  const sunVisible = !isNight && sunYPct >= 0 && sunYPct <= 85;
  const siMul  = (sunIntensity ?? 60) / 60;

  const hGlow = isDawn
    ? colorGroup === "pink" ? "rgba(255,80,140,0.5)" : "rgba(255,110,40,0.45)"
    : isGolden
    ? colorGroup === "pink" ? "rgba(255,100,160,0.55)" : "rgba(255,140,30,0.55)"
    : isTwilight
    ? "rgba(220,80,20,0.3)"
    : "transparent";
  const showHGlow = isDawn || isGolden || isTwilight;

  const cloudCount = Math.min(Math.ceil(effectiveClouds / 14), 7);
  const cloudColor = colorGroup === "pink"
    ? isNight ? "rgba(160,80,140,0.35)" : isGolden || isDawn ? "rgba(255,180,210,0.55)" : "rgba(240,180,220,0.55)"
    : colorGroup === "grey"
    ? isNight ? "rgba(60,62,70,0.45)" : "rgba(150,155,165,0.5)"
    : isNight ? "rgba(140,150,185,0.3)" : isGolden || isDawn ? "rgba(255,215,160,0.55)" : "rgba(255,255,255,0.58)";

  // Stars — more vivid for black/night, visible for dark pinks/greys
  const starCount = showStars ? (colorGroup === "grey" && skyBrightness < 20 ? 55 : isNight ? 45 : 25) : 0;

  return (
    <div
      className="rounded-2xl border border-white/8 overflow-hidden relative select-none"
      style={{ height: "240px", background: `linear-gradient(to bottom, ${skyTop} 0%, ${skyMid} 50%, ${skyBot} 78%, rgb(8,8,14) 100%)` }}
    >
      {/* Horizon glow */}
      {showHGlow && (
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse 90% 28% at 50% 76%, ${hGlow} 0%, transparent 70%)` }} />
      )}

      {/* Milky way band */}
      {showStars && starCount > 30 && (
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(105deg, transparent 0%, rgba(180,160,255,0.05) 38%, rgba(200,185,255,0.08) 55%, transparent 100%)" }} />
      )}

      {/* Stars */}
      {starCount > 0 && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(starCount)].map((_, i) => {
            const isBig   = i % 7 === 0;
            const isMed   = i % 4 === 0;
            const size    = isBig ? "3px" : isMed ? "2px" : "1.5px";
            const opacity = 0.3 + (i % 5) * 0.14;
            const color   = i % 9 === 0 ? "#bbddff" : i % 11 === 0 ? "#ffeebb" : "#ffffff";
            return (
              <div key={i} className="absolute rounded-full"
                style={{
                  width: size, height: size,
                  background: color,
                  opacity,
                  top: `${2 + (i * 29 % 68)}%`,
                  left: `${1 + (i * 43 % 97)}%`,
                  boxShadow: isBig ? `0 0 3px 1px ${color}88` : "none",
                }}
              />
            );
          })}
        </div>
      )}

      {/* Light rays */}
      {lightRays && sunVisible && !isNight && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden"
          style={{ opacity: (lightRayIntensity ?? 50) / 100 * 0.55 }}>
          {[...Array(7)].map((_, i) => (
            <div key={i} className="absolute"
              style={{
                left: `${sunXPct + (i - 3) * 7}%`,
                top: `${sunYPct}%`,
                width: "3px",
                height: "170%",
                background: colorGroup === "pink"
                  ? "linear-gradient(to bottom, rgba(255,180,230,0.7) 0%, transparent 60%)"
                  : "linear-gradient(to bottom, rgba(255,252,200,0.65) 0%, transparent 60%)",
                transform: `rotate(${(i - 3) * 9}deg)`,
                transformOrigin: "top center",
                filter: "blur(5px)",
              }}
            />
          ))}
        </div>
      )}

      {/* Sun / Moon */}
      {sunVisible && (
        <div className="absolute rounded-full pointer-events-none"
          style={{
            width: "24px", height: "24px",
            background: colorGroup === "pink"
              ? isDawn || isGolden ? "#ffaacc" : "#ffe8f5"
              : isDawn || isGolden ? "#ffcc44" : "#fffde6",
            boxShadow: colorGroup === "pink"
              ? `0 0 ${38*siMul}px ${16*siMul}px rgba(255,120,180,0.5)`
              : isDawn || isGolden
              ? `0 0 ${40*siMul}px ${18*siMul}px rgba(255,170,30,0.55)`
              : `0 0 ${36*siMul}px ${14*siMul}px rgba(255,252,190,0.4)`,
            top: `${sunYPct}%`,
            left: `${sunXPct}%`,
            transform: "translate(-50%,-50%)",
          }}
        />
      )}
      {isNight && (
        <div className="absolute pointer-events-none"
          style={{ top: "14%", left: "68%", transform: "translate(-50%,-50%)" }}>
          <div className="rounded-full"
            style={{ width: "18px", height: "18px", background: "#dde8ff", boxShadow: "0 0 18px 8px rgba(170,195,255,0.35)" }} />
        </div>
      )}

      {/* Aerial clouds */}
      {aerialClouds && !freezeTime && (
        <div className="absolute inset-0 pointer-events-none"
          style={{ opacity: (aerialDensity ?? 60) / 100 * 0.42 }}>
          <div className="absolute inset-0"
            style={{
              background: colorGroup === "pink"
                ? "radial-gradient(ellipse 55% 12% at 22% 18%, rgba(255,200,230,0.6) 0%, transparent 100%), radial-gradient(ellipse 45% 10% at 78% 26%, rgba(255,180,215,0.4) 0%, transparent 100%)"
                : "radial-gradient(ellipse 55% 12% at 22% 18%, rgba(255,255,255,0.55) 0%, transparent 100%), radial-gradient(ellipse 45% 10% at 78% 25%, rgba(255,255,255,0.38) 0%, transparent 100%)",
              filter: "blur(3px)",
            }} />
        </div>
      )}

      {/* Ground clouds */}
      {effectiveClouds > 2 && (
        <div className="absolute pointer-events-none" style={{ top: "8%", left: 0, right: 0, opacity: Math.min(effectiveClouds / 100, 0.95) }}>
          {[...Array(cloudCount)].map((_, i) => (
            <div key={i} className="absolute rounded-full"
              style={{
                background: cloudColor,
                filter: `blur(${10 + i * 2.5}px)`,
                width: `${70 + i * 26}px`,
                height: `${24 + i * 7}px`,
                left: `${(i * 17 % 70) + 2}%`,
                top: `${(i * 11 % 36)}px`,
              }}
            />
          ))}
        </div>
      )}

      {/* Jet streams */}
      {effectiveJets > 4 && (
        <div className="absolute pointer-events-none" style={{ top: "18%", left: "8%", right: "8%", opacity: effectiveJets / 100 * 0.72 }}>
          <div style={{ height: "1px", background: "linear-gradient(to right, transparent 0%, rgba(255,255,255,0.9) 30%, rgba(255,255,255,0.9) 70%, transparent 100%)", filter: "blur(0.5px)" }} />
          <div style={{ height: "1px", width: "58%", marginLeft: "20%", marginTop: "16px", background: "linear-gradient(to right, transparent, rgba(255,255,255,0.6), transparent)", filter: "blur(0.6px)" }} />
        </div>
      )}

      {/* Rain */}
      {!disableRain && !freezeTime && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ opacity: 0.28 }}>
          {[...Array(22)].map((_, i) => (
            <div key={i} className="absolute"
              style={{ width: "1px", height: "14px", background: "rgba(155,205,255,0.75)", left: `${(i * 39 % 94) + 2}%`, top: `${(i * 27 % 78)}%`, transform: "rotate(10deg)" }}
            />
          ))}
        </div>
      )}

      {/* Snow */}
      {!disableSnow && !freezeTime && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ opacity: 0.35 }}>
          {[...Array(18)].map((_, i) => (
            <div key={i} className="absolute rounded-full bg-white"
              style={{ width: i % 3 === 0 ? "3px" : "2px", height: i % 3 === 0 ? "3px" : "2px", opacity: 0.5 + (i % 3) * 0.15, left: `${(i * 53 % 92) + 3}%`, top: `${(i * 31 % 76)}%` }}
            />
          ))}
        </div>
      )}

      {/* Atmosphere haze */}
      {atmosphereHaze && (
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: `linear-gradient(to top, rgba(${r},${g},${B},0.18) 0%, transparent 38%)` }} />
      )}

      {/* Status badges */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
        <div className="bg-black/65 backdrop-blur-sm rounded-lg px-2.5 py-1 inline-flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[9px] font-bold text-white/90">LIVE</span>
        </div>
        <div className="flex gap-1 flex-wrap justify-end">
          {freezeTime && <span className="bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[8px] font-bold px-1.5 py-0.5 rounded-full">TIME+WEATHER LOCKED</span>}
          {disableRain && !freezeTime && <span className="bg-blue-500/20 border border-blue-500/30 text-blue-400 text-[8px] font-bold px-1.5 py-0.5 rounded-full">NO RAIN</span>}
          {disableSnow && !freezeTime && <span className="bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-[8px] font-bold px-1.5 py-0.5 rounded-full">NO SNOW</span>}
        </div>
      </div>

      {/* Sky label + time */}
      <div className="absolute top-2.5 right-2.5 flex gap-1.5 pointer-events-none">
        {freezeTime && (
          <div className="bg-black/55 backdrop-blur-sm rounded-md px-2 py-0.5">
            <span className="text-[9px] font-bold text-amber-300/90">{String(freezeHour).padStart(2,"0")}:00</span>
          </div>
        )}
        <div className="bg-black/55 backdrop-blur-sm rounded-md px-2 py-0.5">
          <span className="text-[9px] font-bold text-white/65">{skyLabel(skyColorKey)}</span>
        </div>
      </div>
    </div>
  );
}

// ── ReShade preset data ───────────────────────────────────────────────────────
const RESHADE_PRESETS = [
  {
    id: "mylik", file: "/reshade-presets/mylik.ini", name: "mylik",
    label: "leaq's Daily Driver",
    badge: "Personal", badgeCls: "bg-red-500/15 border-red-500/25 text-red-400",
    btnCls: "bg-red-600 hover:bg-red-500",
    desc: "Exact ReShade leaq runs for FiveM — DPX colour grading, Technicolor2, LumaSharpen, and a custom crosshair. Sharpest without looking over-processed.",
    techniques: "DPX · Technicolor2 · LumaSharpen · xhair",
    perf: "Low impact", perfCls: "bg-emerald-500/15 border-emerald-500/20 text-emerald-400",
  },
  {
    id: "15", file: "/reshade-presets/15.ini", name: "15",
    label: "15 — Sharp & Clean",
    badge: "Balanced", badgeCls: "bg-emerald-500/15 border-emerald-500/25 text-emerald-400",
    btnCls: "bg-emerald-600 hover:bg-emerald-500",
    desc: "LumaSharpen + CAS double-sharpen with Technicolor2 colour boost. Clean look with a green-circle crosshair. Good all-rounder for daytime RP.",
    techniques: "LumaSharpen · Technicolor2 · CAS · xhair",
    perf: "Very low impact", perfCls: "bg-emerald-500/15 border-emerald-500/20 text-emerald-400",
  },
  {
    id: "Aeirdv2", file: "/reshade-presets/Aeirdv2.ini", name: "Aeirdv2",
    label: "Aeird v2 — Full Cinematic",
    badge: "Cinematic", badgeCls: "bg-amber-500/15 border-amber-500/25 text-amber-400",
    btnCls: "bg-amber-600 hover:bg-amber-500",
    desc: "Full cinematic stack: DPX, FilmicSharpen, Vignette, Technicolor2. Best visuals of the four — slight FPS cost. Ideal for recording and screenshots.",
    techniques: "DPX · FilmicSharpen · Vignette · Technicolor2",
    perf: "Moderate impact", perfCls: "bg-amber-500/15 border-amber-500/20 text-amber-400",
  },
  {
    id: "bango_rs", file: "/reshade-presets/bango_rs.ini", name: "bango_rs",
    label: "Bango RS — Minimal",
    badge: "Lightweight", badgeCls: "bg-blue-500/15 border-blue-500/25 text-blue-400",
    btnCls: "bg-blue-600 hover:bg-blue-500",
    desc: "Curves + Technicolor2 + LumaSharpen only — the lightest of the four. Subtle colour correction, near-zero performance hit. Best for low-end GPUs.",
    techniques: "Curves · Technicolor2 · LumaSharpen · xhair",
    perf: "Minimal impact", perfCls: "bg-blue-500/15 border-blue-500/20 text-blue-400",
  },
];

// ── Gate ─────────────────────────────────────────────────────────────────────
function CodeGate({ onUnlock }: { onUnlock: () => void }) {
  const [code,  setCode]  = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const handleSubmit = () => {
    if (code.trim() === GATE_CODE) { onUnlock(); }
    else {
      setError(true); setShake(true);
      setTimeout(() => setShake(false), 500);
      setCode("");
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <motion.div
        animate={shake ? { x: [-8, 8, -6, 6, -4, 4, 0] } : { x: 0 }}
        transition={{ duration: 0.5 }}
        className="w-80 rounded-2xl border border-red-500/20 bg-[#0a0a0a] shadow-2xl shadow-red-900/20 p-8 text-center"
      >
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-5">
          <Lock className="w-6 h-6 text-red-500" />
        </div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-red-500 font-bold mb-1">Restricted Access</p>
        <h2 className="text-xl font-display font-black text-white mb-1">Graphics Studio</h2>
        <p className="text-xs text-zinc-500 mb-6">Enter your access code to continue</p>
        <input
          autoFocus type="password" value={code}
          onChange={e => { setCode(e.target.value); setError(false); }}
          onKeyDown={e => e.key === "Enter" && handleSubmit()}
          placeholder="• • • •"
          data-testid="input-graphics-code"
          className={cn(
            "w-full bg-zinc-900/80 border rounded-xl px-4 py-3 text-white text-center text-xl font-mono tracking-[0.5em] outline-none transition-all mb-3",
            error
              ? "border-red-500/70 focus:border-red-500 shadow-[0_0_20px_-4px_rgba(239,68,68,0.4)]"
              : "border-white/10 focus:border-red-500/40"
          )}
          maxLength={6}
        />
        {error && <p className="text-[11px] text-red-400 mb-3">Incorrect code</p>}
        <Button onClick={handleSubmit} data-testid="button-graphics-unlock"
          className="w-full bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl py-2.5">
          Unlock
        </Button>
      </motion.div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function FivemGraphics() {
  const [unlocked, setUnlockedState] = useState(false);
  const [cloudThickness, setCloudThickness] = useState(0);
  const [jetStreams,      setJetStreams]     = useState(0);
  const [skyColorKey,    setSkyColorKey]    = useState<SkyColorKey>("vivid_blue");
  const [skyBrightness,  setSkyBrightness]  = useState(70);
  const [keepProps,      setKeepProps]      = useState(true);
  const [packName,       setPackName]       = useState("My Blue Sky Pack");
  const [generated,      setGenerated]      = useState(false);

  const [disableRain,        setDisableRain]        = useState(false);
  const [disableSnow,        setDisableSnow]        = useState(false);
  const [disableBloodDecals, setDisableBloodDecals] = useState(false);

  const [freezeTime,   setFreezeTime]   = useState(false);
  const [freezeHour,   setFreezeHour]   = useState(12);
  const [freezeMinute, setFreezeMinute] = useState(0);

  const [aerialClouds,      setAerialClouds]      = useState(false);
  const [aerialDensity,     setAerialDensity]     = useState(60);
  const [lightRays,         setLightRays]         = useState(false);
  const [lightRayIntensity, setLightRayIntensity] = useState(50);
  const [sunIntensity,      setSunIntensity]      = useState(60);
  const [atmosphereHaze,    setAtmosphereHaze]    = useState(false);

  const [aiPrompt,  setAiPrompt]  = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError,   setAiError]   = useState("");
  const [aiSuccess, setAiSuccess] = useState("");
  const aiInputRef = useRef<HTMLTextAreaElement>(null);

  const [activeTab, setActiveTab] = useState<"packs" | "builder" | "reshade" | "info">("packs");

  const handleUnlock = useCallback(() => setUnlockedState(true), []);

  const applyTheme = (settings: Partial<PackOpts>) => {
    if (settings.skyColorKey    != null) setSkyColorKey(settings.skyColorKey);
    if (settings.skyBrightness  != null) setSkyBrightness(settings.skyBrightness);
    if (settings.cloudThickness != null) setCloudThickness(settings.cloudThickness);
    if (settings.jetStreams      != null) setJetStreams(settings.jetStreams);
    if (settings.aerialClouds   != null) setAerialClouds(settings.aerialClouds);
    if (settings.aerialDensity  != null) setAerialDensity(settings.aerialDensity);
    if (settings.lightRays      != null) setLightRays(settings.lightRays);
    if (settings.lightRayIntensity != null) setLightRayIntensity(settings.lightRayIntensity);
    if (settings.sunIntensity   != null) setSunIntensity(settings.sunIntensity);
    if (settings.atmosphereHaze != null) setAtmosphereHaze(settings.atmosphereHaze);
    if (settings.freezeTime     != null) setFreezeTime(settings.freezeTime);
    if (settings.freezeHour     != null) setFreezeHour(settings.freezeHour);
    if (settings.disableRain    != null) setDisableRain(settings.disableRain);
    if (settings.disableSnow    != null) setDisableSnow(settings.disableSnow);
    if (settings.keepProps      != null) setKeepProps(settings.keepProps);
    setActiveTab("builder");
  };

  const buildOpts = (): PackOpts => ({
    packName, cloudThickness, jetStreams, skyColorKey, skyBrightness, keepProps,
    disableRain, disableSnow, disableBloodDecals,
    freezeTime, freezeHour, freezeMinute,
    aerialClouds, aerialDensity, lightRays, lightRayIntensity, sunIntensity, atmosphereHaze,
  });

  const fpsWarningLevel = (() => {
    let cost = 0;
    if (!freezeTime) cost += cloudThickness / 10;
    if (!freezeTime) cost += jetStreams / 25;
    if (aerialClouds) cost += aerialDensity / 20;
    if (lightRays) cost += 5 + lightRayIntensity / 15;
    if (atmosphereHaze) cost += 2;
    if (cost < 4) return "ok";
    if (cost < 9) return "warn";
    return "heavy";
  })();

  const handleOpenAppData = () => {
    const bat = `@echo off\r\nstart "" "%LOCALAPPDATA%\\FiveM\\FiveM Application Data"\r\n`;
    const blob = new Blob([bat], { type: "application/octet-stream" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url; a.download = "Open-FiveM-AppData.bat";
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const handleGenerate = () => {
    try {
      const opts = buildOpts();
      const zip  = generateZip(opts);
      const safe = packName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
      downloadBlob(zip, `optigods-fivem-${safe}.zip`);
      setGenerated(true);
      setTimeout(() => setGenerated(false), 3000);
    } catch (e) {
      console.error("Pack generation failed:", e);
      alert("Pack generation failed — please try again.");
    }
  };

  const handleDownloadLeaqPack = () => {
    try {
      const opts: PackOpts = {
        packName: "Opti Gods Blue Sky Pack",
        cloudThickness: 0, jetStreams: 0,
        skyColorKey: "vivid_blue", skyBrightness: 75,
        keepProps: true,
        disableRain: true, disableSnow: true, disableBloodDecals: false,
        freezeTime: true, freezeHour: 12, freezeMinute: 0,
        aerialClouds: false, aerialDensity: 0,
        lightRays: false, lightRayIntensity: 0,
        sunIntensity: 65, atmosphereHaze: false,
      };
      downloadBlob(generateZip(opts), "optigods-blue-sky-pack.zip");
    } catch (e) {
      console.error("Download failed:", e);
      alert("Download failed — please try again.");
    }
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true); setAiError(""); setAiSuccess("");
    try {
      const res  = await fetch("/api/ai/graphics-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: aiPrompt }),
      });
      const text = await res.text();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any;
      try { data = JSON.parse(text); } catch { throw new Error("Server error — please try again"); }
      if (!res.ok) throw new Error(data?.error || "Request failed");
      if (data.skyColorKey    != null) setSkyColorKey(data.skyColorKey);
      if (data.skyBrightness  != null) setSkyBrightness(data.skyBrightness);
      if (data.cloudThickness != null) setCloudThickness(data.cloudThickness);
      if (data.jetStreams      != null) setJetStreams(data.jetStreams);
      if (data.aerialClouds   != null) setAerialClouds(data.aerialClouds);
      if (data.aerialDensity  != null) setAerialDensity(data.aerialDensity);
      if (data.lightRays      != null) setLightRays(data.lightRays);
      if (data.lightRayIntensity != null) setLightRayIntensity(data.lightRayIntensity);
      if (data.sunIntensity   != null) setSunIntensity(data.sunIntensity);
      if (data.atmosphereHaze != null) setAtmosphereHaze(data.atmosphereHaze);
      if (data.disableRain    != null) setDisableRain(data.disableRain);
      if (data.disableSnow    != null) setDisableSnow(data.disableSnow);
      setAiSuccess(data.mood || "Pack configured — review below, then download.");
      setActiveTab("builder");
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : "AI failed — try again");
    } finally {
      setAiLoading(false);
    }
  };

  if (!unlocked) {
    return <AppLayout><CodeGate onUnlock={handleUnlock} /></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="w-full px-4 py-6 space-y-6">

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-[0.2em] text-red-500 font-bold">Opti Gods</span>
            <span className="text-zinc-700">·</span>
            <span className="text-[10px] uppercase tracking-[0.15em] text-zinc-600 font-bold">Exclusive</span>
          </div>
          <h1 className="text-3xl font-display font-black text-white mb-1">
            FiveM <span className="text-red-500">Graphics Studio</span>
          </h1>
          <p className="text-sm text-zinc-400">
            Custom citizen packs, ReShade presets, and sky controls — built for FiveM performance.
          </p>
        </div>

        {/* Open App Data */}
        <div className="rounded-xl border border-white/8 bg-zinc-900/40 px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <p className="text-xs font-bold text-white">FiveM Application Data</p>
              <p className="text-[10px] text-zinc-500 font-mono mt-0.5">%LOCALAPPDATA%\FiveM\FiveM Application Data\</p>
            </div>
          </div>
          <button
            data-testid="button-open-appdata"
            onClick={handleOpenAppData}
            className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-bold hover:bg-amber-500/20 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Open Folder .bat
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 border-b border-white/5 overflow-x-auto">
          {([
            { id: "packs",   label: "Pre-Made Packs",  icon: Package  },
            { id: "builder", label: "Build Your Own",  icon: Palette  },
            { id: "reshade", label: "ReShade Presets", icon: Monitor  },
            { id: "info",    label: "How It Works",    icon: Info     },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button key={id} data-testid={`tab-fivem-${id}`}
              onClick={() => setActiveTab(id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px shrink-0",
                activeTab === id ? "text-red-400 border-red-500" : "text-zinc-500 border-transparent hover:text-zinc-300"
              )}
            >
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>

        {/* Install tip */}
        {(activeTab === "packs" || activeTab === "builder") && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 flex items-start gap-3">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-300/80 leading-relaxed">
              <span className="font-bold text-amber-300">Install: </span>
              Extract ZIP → open{" "}
              <span className="font-mono text-amber-400/90">FiveM Application Data\</span>
              {" "}→ <span className="font-bold text-amber-300">delete</span> existing <span className="font-mono font-bold text-amber-300">citizen</span> folder → drag new one in → restart FiveM.
              Use the <span className="font-bold text-amber-300">Open Folder .bat</span> above to jump straight there.
            </div>
          </div>
        )}

        {/* ── Pre-Made Packs ── */}
        {activeTab === "packs" && (
          <section className="space-y-5">
            {/* Hero */}
            <div className="relative rounded-2xl overflow-hidden h-72 md:h-96 border border-white/8 group">
              <img src="/reshade-presets/preview-gunsrz2.png" alt="FiveM aerial view" className="w-full h-full object-cover object-center" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
              <div className="absolute inset-0 flex items-end p-6">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-red-400 font-bold mb-1">Opti Gods · Graphics Studio</p>
                  <h2 className="text-2xl md:text-3xl font-display font-black text-white leading-tight mb-2">
                    FiveM looks like this.<br /><span className="text-red-400">Yours can too.</span>
                  </h2>
                  <p className="text-xs text-zinc-300/80">Real screenshots. Real FPS gains. No BS.</p>
                </div>
              </div>
            </div>

            {/* Gallery strip — all images equal size, larger */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { src: "/reshade-presets/preview-sunrise.png",  label: "Golden Sunrise" },
                { src: "/reshade-presets/preview-dusk.png",     label: "Moody Dusk"     },
                { src: "/reshade-presets/preview-dawn.png",     label: "Pre-Dawn"       },
                { src: "/reshade-presets/preview-gunsrz1.png",  label: "Sunset Clouds"  },
              ].map(({ src, label }) => (
                <div key={label} className="relative rounded-xl overflow-hidden h-36 md:h-44 border border-white/8 hover:border-white/25 transition-all cursor-default group">
                  <img src={src} alt={label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-3">
                    <span className="text-[10px] font-bold text-white/95 uppercase tracking-wider">{label}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* leaq's pack */}
            <div className="rounded-2xl border border-white/8 hover:border-red-500/30 transition-all bg-zinc-900/70">
              <div className="p-6 md:p-8">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.15em] text-red-400 font-bold mb-1">leaq's pack · v1 · Tested on 1650 Super</p>
                    <h3 className="text-xl font-display font-black text-white">Opti Gods Blue Sky Pack</h3>
                  </div>
                  <span className="text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded-full uppercase shrink-0">Tested</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {[
                    "No Clouds +6 FPS","Vivid Blue Sky","No Contrails +2 FPS","Props Intact",
                    "Freeze Time +30-45 FPS","No Rain +25 FPS","No Snow +25-30 FPS",
                  ].map(tag => (
                    <span key={tag} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/8 border border-white/10 text-zinc-200">
                      {tag}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed mb-5 max-w-md">
                  The exact pack leaq runs daily — all-clear blue sky, zero clouds, zero contrails, time + weather locked at noon. Max FPS on low-to-mid GPU builds. Download and drag the citizen folder in.
                </p>
                <button
                  onClick={handleDownloadLeaqPack}
                  data-testid="button-graphics-pack-download"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Pack ZIP
                  <ChevronRight className="w-3 h-3 opacity-60" />
                </button>
              </div>
            </div>

            {/* Themed pack cards — jump to builder */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-3">More Pack Themes → Opens in Builder</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {PACK_THEMES.slice(2).map(theme => {
                  const colorMap: Record<string, string> = {
                    pink: "border-pink-500/25 hover:border-pink-500/50 text-pink-300",
                    amber: "border-amber-500/25 hover:border-amber-500/50 text-amber-300",
                    indigo: "border-indigo-500/25 hover:border-indigo-500/50 text-indigo-300",
                    fuchsia: "border-fuchsia-500/25 hover:border-fuchsia-500/50 text-fuchsia-300",
                    cyan: "border-cyan-500/25 hover:border-cyan-500/50 text-cyan-300",
                    slate: "border-slate-500/25 hover:border-slate-500/50 text-slate-300",
                    blue: "border-blue-500/25 hover:border-blue-500/50 text-blue-300",
                    emerald: "border-emerald-500/25 hover:border-emerald-500/50 text-emerald-300",
                  };
                  const ThemeIcon = theme.icon;
                  return (
                    <button
                      key={theme.key}
                      onClick={() => { applyTheme(theme.settings); }}
                      data-testid={`button-theme-${theme.key}`}
                      className={cn(
                        "flex flex-col items-start gap-2 px-3 py-3.5 rounded-xl border bg-zinc-900/50 transition-all text-left",
                        colorMap[theme.color] ?? "border-white/10 hover:border-white/25 text-zinc-300"
                      )}
                    >
                      <ThemeIcon className="w-4 h-4" />
                      <span className="text-[11px] font-black text-white leading-tight">{theme.label}</span>
                      <span className="text-[9px] opacity-60 leading-snug">{theme.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ── Builder ── */}
        {activeTab === "builder" && (
          <section className="space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Palette className="w-4 h-4 text-red-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Custom Pack Maker</h2>
              <span className="text-[9px] font-bold bg-red-500/15 text-red-400 border border-red-500/25 px-2 py-0.5 rounded-full uppercase ml-1">Builder</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Left: Controls */}
              <div className="space-y-4">

                {/* AI Pack Generator */}
                <div className="rounded-2xl border border-red-500/20 bg-gradient-to-br from-red-950/20 to-black p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center shrink-0">
                      <Wand2 className="w-4 h-4 text-red-400" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-white">AI Pack Generator</p>
                      <p className="text-[10px] text-zinc-500">Describe the vibe — get sliders pre-filled instantly.</p>
                    </div>
                  </div>
                  <textarea
                    ref={aiInputRef} value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAiGenerate(); }}}
                    placeholder="e.g. &quot;golden sunrise with light rays&quot; or &quot;moody pink night sky&quot;"
                    data-testid="input-ai-pack-prompt"
                    rows={2}
                    className="w-full bg-black/40 border border-white/10 focus:border-red-500/40 rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors resize-none placeholder:text-zinc-600"
                  />
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleAiGenerate}
                      disabled={aiLoading || !aiPrompt.trim()}
                      data-testid="button-ai-generate-pack"
                      className={cn(
                        "flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all",
                        aiLoading || !aiPrompt.trim()
                          ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                          : "bg-red-600 hover:bg-red-500 text-white"
                      )}
                    >
                      {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendHorizonal className="w-4 h-4" />}
                      {aiLoading ? "Generating..." : "Generate Pack"}
                    </button>
                    <p className="text-[10px] text-zinc-600">Enter to submit</p>
                  </div>
                  <AnimatePresence>
                    {aiSuccess && (
                      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="flex items-start gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-emerald-300">{aiSuccess}</p>
                      </motion.div>
                    )}
                    {aiError && (
                      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-red-300">{aiError}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Quick Pack Options — moved here from Pre-Made Packs */}
                <div className="rounded-2xl border border-white/8 bg-zinc-900/60 p-4 space-y-3">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Quick Pack Options</p>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { label: "No Rain",    active: disableRain,        onToggle: () => setDisableRain(v => !v),        fps: "+25 FPS",    color: "blue",  testId: "quick-toggle-rain"  },
                      { label: "No Snow",    active: disableSnow,        onToggle: () => setDisableSnow(v => !v),        fps: "+25-30 FPS", color: "cyan",  testId: "quick-toggle-snow"  },
                      { label: "No Blood",   active: disableBloodDecals, onToggle: () => setDisableBloodDecals(v => !v), fps: "Citizen",    color: "red",   testId: "quick-toggle-blood" },
                      { label: "Keep Props", active: keepProps,          onToggle: () => setKeepProps(v => !v),          fps: "+50 FPS",    color: "zinc",  testId: "quick-toggle-props" },
                      { label: "Aerial Clouds", active: aerialClouds,   onToggle: () => setAerialClouds(v => !v),       fps: aerialClouds ? "ON" : "+3-8 FPS", color: "sky", testId: "quick-toggle-aerial" },
                      { label: "Light Haze", active: atmosphereHaze,    onToggle: () => setAtmosphereHaze(v => !v),     fps: atmosphereHaze ? "ON" : "+1-3 FPS", color: "zinc", testId: "quick-toggle-haze" },
                    ] as Array<{ label: string; active: boolean; onToggle: () => void; fps: string; color: string; testId: string }>).map(({ label, active, onToggle, fps, color, testId }) => {
                      const activeCls: Record<string, string> = {
                        blue: "border-blue-500/40 bg-blue-500/10 text-blue-300",
                        cyan: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300",
                        red:  "border-red-500/40 bg-red-500/10 text-red-300",
                        zinc: "border-zinc-500/40 bg-zinc-700/30 text-zinc-200",
                        sky:  "border-sky-500/40 bg-sky-500/10 text-sky-300",
                      };
                      return (
                        <button key={testId} onClick={onToggle} data-testid={testId}
                          className={cn(
                            "flex flex-col items-start gap-1 px-2.5 py-2.5 rounded-xl border transition-all text-left",
                            active ? activeCls[color] ?? activeCls.zinc : "border-white/8 bg-zinc-900/40 text-zinc-500 hover:text-zinc-300 hover:border-white/15"
                          )}>
                          <div className="flex items-center justify-between w-full">
                            <span className={cn("w-3 h-3 rounded-full border flex-shrink-0 flex items-center justify-center", active ? "border-current" : "border-zinc-600")}>
                              {active && <span className="w-1.5 h-1.5 rounded-full bg-current block" />}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold leading-tight">{label}</span>
                          <span className="text-[9px] opacity-60">{fps}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Pack name */}
                <div className="rounded-2xl border border-white/8 bg-zinc-900/60 px-5 py-4">
                  <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-2 block">Pack Name</label>
                  <input
                    type="text" value={packName} onChange={e => setPackName(e.target.value)}
                    placeholder="My Blue Sky Pack" data-testid="input-pack-name"
                    className="w-full bg-zinc-900 border border-white/10 focus:border-red-500/40 rounded-xl px-4 py-2.5 text-white text-sm font-semibold outline-none transition-colors"
                  />
                </div>

                {/* Themed Presets */}
                <div className="rounded-2xl border border-white/8 bg-zinc-900/60 p-4">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-3">Themed Presets</p>
                  <div className="grid grid-cols-2 gap-2">
                    {PACK_THEMES.map(theme => {
                      const Icon = theme.icon;
                      const colorMap: Record<string, string> = {
                        emerald: "hover:border-emerald-500/40 hover:bg-emerald-500/5 hover:text-emerald-300",
                        blue:    "hover:border-blue-500/40 hover:bg-blue-500/5 hover:text-blue-300",
                        pink:    "hover:border-pink-500/40 hover:bg-pink-500/5 hover:text-pink-300",
                        amber:   "hover:border-amber-500/40 hover:bg-amber-500/5 hover:text-amber-300",
                        indigo:  "hover:border-indigo-500/40 hover:bg-indigo-500/5 hover:text-indigo-300",
                        fuchsia: "hover:border-fuchsia-500/40 hover:bg-fuchsia-500/5 hover:text-fuchsia-300",
                        cyan:    "hover:border-cyan-500/40 hover:bg-cyan-500/5 hover:text-cyan-300",
                        slate:   "hover:border-slate-500/40 hover:bg-slate-500/5 hover:text-slate-300",
                      };
                      return (
                        <button
                          key={theme.key}
                          onClick={() => { applyTheme(theme.settings); setPackName(theme.label); }}
                          data-testid={`builder-theme-${theme.key}`}
                          className={cn(
                            "flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-white/8 bg-zinc-900/40 text-zinc-400 transition-all text-left",
                            colorMap[theme.color] ?? "hover:border-white/20"
                          )}
                        >
                          <Icon className="w-3.5 h-3.5 shrink-0" />
                          <div>
                            <p className="text-[11px] font-bold text-white leading-tight">{theme.label}</p>
                            <p className="text-[9px] opacity-60 leading-snug">{theme.desc.split("—")[0].trim()}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Sky Color Picker */}
                <div className="rounded-2xl border border-white/8 bg-zinc-900/60 p-5 space-y-4">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Sky Color</p>

                  {/* Group: Blues */}
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-blue-500/70 font-bold mb-2">Blues</p>
                    <div className="flex flex-wrap gap-2">
                      {(["vivid_blue","sky_blue","cyan","deep_blue","navy"] as SkyColorKey[]).map(k => (
                        <button
                          key={k}
                          onClick={() => setSkyColorKey(k)}
                          data-testid={`color-${k}`}
                          title={SKY_COLORS[k].label}
                          className={cn(
                            "w-8 h-8 rounded-full border-2 transition-all",
                            skyColorKey === k ? "border-white scale-110 shadow-lg" : "border-white/20 hover:border-white/50 hover:scale-105"
                          )}
                          style={{ background: SKY_COLORS[k].swatch }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Group: Pinks */}
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-pink-500/70 font-bold mb-2">Pinks</p>
                    <div className="flex flex-wrap gap-2">
                      {(["bubblegum","hot_pink","rose","magenta"] as SkyColorKey[]).map(k => (
                        <button
                          key={k}
                          onClick={() => setSkyColorKey(k)}
                          data-testid={`color-${k}`}
                          title={SKY_COLORS[k].label}
                          className={cn(
                            "w-8 h-8 rounded-full border-2 transition-all",
                            skyColorKey === k ? "border-white scale-110 shadow-lg" : "border-white/20 hover:border-white/50 hover:scale-105"
                          )}
                          style={{ background: SKY_COLORS[k].swatch }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Group: Grey/Black */}
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-zinc-500/70 font-bold mb-2">Grey / Black — Best FPS</p>
                    <div className="flex flex-wrap gap-2">
                      {(["steel_grey","dark_grey","black_sky"] as SkyColorKey[]).map(k => (
                        <button
                          key={k}
                          onClick={() => setSkyColorKey(k)}
                          data-testid={`color-${k}`}
                          title={SKY_COLORS[k].label}
                          className={cn(
                            "w-8 h-8 rounded-full border-2 transition-all",
                            skyColorKey === k
                              ? "border-white scale-110 shadow-lg"
                              : "border-white/30 hover:border-white/60 hover:scale-105"
                          )}
                          style={{ background: k === "black_sky" ? "#111" : SKY_COLORS[k].swatch }}
                        />
                      ))}
                    </div>
                    <p className="text-[9px] text-zinc-600 mt-1.5">Grey/black skies reduce GPU color-buffer ops (+2–4 FPS in crowded areas)</p>
                  </div>

                  {/* Selected color label */}
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full border border-white/30" style={{ background: SKY_COLORS[skyColorKey].swatch }} />
                    <span className="text-xs font-bold text-white">{skyLabel(skyColorKey)}</span>
                  </div>

                  {/* Sky Brightness */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Sky Brightness</span>
                      <span className="text-sm font-black text-white tabular-nums">{skyBrightness}%</span>
                    </div>
                    <Slider value={[skyBrightness]} onValueChange={([v]) => setSkyBrightness(v)}
                      min={10} max={100} step={5} className="w-full" data-testid="slider-sky-brightness" />
                    <div className="flex justify-between mt-1">
                      <span className="text-[9px] text-zinc-600">Dark / night feel</span>
                      <span className="text-[9px] text-zinc-600">Full vivid</span>
                    </div>
                  </div>
                </div>

                {/* Sky & Clouds */}
                <div className="rounded-2xl border border-white/8 bg-zinc-900/60 p-5 space-y-5">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1">Clouds & Contrails</p>

                  <ControlRow
                    icon={Cloud} label="Ground Clouds" color="zinc"
                    fpsBadge={cloudThickness === 0 ? "+2–6 FPS" : null}
                    fpsColor={cloudThickness === 0 ? "emerald" : "zinc"}
                    sublabel={cloudThickness === 0 ? "OFF — no cloud draw calls" : `${cloudThickness}% density`}
                  >
                    <Slider value={[cloudThickness]} onValueChange={([v]) => setCloudThickness(v)}
                      min={0} max={100} step={1} className="w-full" data-testid="slider-cloud-thickness" />
                    <div className="flex justify-between mt-1">
                      <span className="text-[9px] text-zinc-600">Clear sky</span>
                      <span className="text-[9px] text-zinc-600">Full overcast</span>
                    </div>
                  </ControlRow>

                  {/* Aerial clouds */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-white/3 border border-white/8 flex items-center justify-center">
                          <Cloud className="w-3.5 h-3.5 text-blue-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-white leading-tight">Aerial Clouds</p>
                            <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full border",
                              aerialClouds ? "bg-blue-500/15 border-blue-500/20 text-blue-400" : "bg-emerald-500/15 border-emerald-500/20 text-emerald-400"
                            )}>
                              {aerialClouds ? `ON · ${aerialDensity}%` : "+3–8 FPS"}
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-500">High-altitude puffs visible when flying</p>
                        </div>
                      </div>
                      <Toggle on={aerialClouds} onToggle={() => setAerialClouds(v => !v)} testId="toggle-aerial-clouds" />
                    </div>
                    <AnimatePresence>
                      {aerialClouds && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
                          <div className="pt-1 pl-9">
                            <Slider value={[aerialDensity]} onValueChange={([v]) => setAerialDensity(v)}
                              min={10} max={100} step={5} className="w-full" data-testid="slider-aerial-density" />
                            <div className="flex justify-between mt-1">
                              <span className="text-[9px] text-zinc-600">Light wisps</span>
                              <span className="text-[9px] text-zinc-600">Thick banks</span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <ControlRow
                    icon={Wind} label="Jet Streams / Contrails" color="cyan"
                    fpsBadge={jetStreams === 0 ? "+1–2 FPS" : null}
                    fpsColor={jetStreams === 0 ? "emerald" : "zinc"}
                    sublabel={jetStreams === 0 ? "OFF" : `${jetStreams}% visibility`}
                  >
                    <Slider value={[jetStreams]} onValueChange={([v]) => setJetStreams(v)}
                      min={0} max={100} step={1} className="w-full" data-testid="slider-jet-streams" />
                    <div className="flex justify-between mt-1">
                      <span className="text-[9px] text-zinc-600">None</span>
                      <span className="text-[9px] text-zinc-600">Full</span>
                    </div>
                  </ControlRow>
                </div>

                {/* Lighting */}
                <div className="rounded-2xl border border-white/8 bg-zinc-900/60 p-5 space-y-5">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1">Lighting & Atmosphere</p>

                  {/* Light rays */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-white/3 border border-white/8 flex items-center justify-center">
                          <Flame className="w-3.5 h-3.5 text-amber-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-white leading-tight">Light Rays / God Rays</p>
                            <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full border",
                              lightRays ? "bg-amber-500/15 border-amber-500/20 text-amber-400" : "bg-emerald-500/15 border-emerald-500/20 text-emerald-400"
                            )}>
                              {lightRays ? `ON · ${lightRayIntensity}%` : "+5–15 FPS"}
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-500">Volumetric sun shafts — most expensive visual</p>
                        </div>
                      </div>
                      <Toggle on={lightRays} onToggle={() => setLightRays(v => !v)} testId="toggle-light-rays" />
                    </div>
                    <AnimatePresence>
                      {lightRays && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
                          <div className="pt-1 pl-9">
                            <Slider value={[lightRayIntensity]} onValueChange={([v]) => setLightRayIntensity(v)}
                              min={10} max={100} step={5} className="w-full" data-testid="slider-light-ray-intensity" />
                            <div className="flex justify-between mt-1">
                              <span className="text-[9px] text-zinc-600">Subtle</span>
                              <span className="text-[9px] text-zinc-600">Intense</span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <ControlRow
                    icon={Sun} label="Sun Intensity" color="amber"
                    fpsBadge="No FPS impact" fpsColor="zinc"
                    sublabel={sunIntensity < 30 ? "Dim / overcast look" : sunIntensity > 75 ? "Blazing warm glow" : "Natural brightness"}
                  >
                    <Slider value={[sunIntensity]} onValueChange={([v]) => setSunIntensity(v)}
                      min={0} max={100} step={5} className="w-full" data-testid="slider-sun-intensity" />
                    <div className="flex justify-between mt-1">
                      <span className="text-[9px] text-zinc-600">Dim</span>
                      <span className="text-[9px] text-zinc-600">Blazing</span>
                    </div>
                  </ControlRow>

                  <div className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-white/3 border border-white/8 flex items-center justify-center">
                        <Wind className="w-3.5 h-3.5 text-zinc-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-white leading-tight">Atmosphere Haze</p>
                          <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full border",
                            atmosphereHaze ? "bg-zinc-500/15 border-zinc-500/20 text-zinc-400" : "bg-emerald-500/15 border-emerald-500/20 text-emerald-400"
                          )}>
                            {atmosphereHaze ? "ON" : "+1–3 FPS"}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-500">Horizon heat shimmer / depth fog</p>
                      </div>
                    </div>
                    <Toggle on={atmosphereHaze} onToggle={() => setAtmosphereHaze(v => !v)} testId="toggle-atmosphere-haze" />
                  </div>
                </div>

                {/* Weather & Time */}
                <div className="rounded-2xl border border-white/8 bg-zinc-900/60 p-5 space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-3">Weather & Time</p>

                  {/* Freeze Time — replaces Freeze Weather, does both */}
                  <div className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-white/3 border border-white/8 flex items-center justify-center">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-white leading-tight">Freeze Time & Weather</p>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-emerald-500/15 border-emerald-500/20 text-emerald-400">+30–45 FPS</span>
                        </div>
                        <p className="text-[10px] text-zinc-500">Locks the clock AND clears all weather — biggest single gain</p>
                      </div>
                    </div>
                    <Toggle on={freezeTime} onToggle={() => setFreezeTime(v => !v)} testId="toggle-freeze-time" />
                  </div>
                  <AnimatePresence>
                    {freezeTime && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
                        <div className="pt-1 space-y-3">
                          <div className="ml-9 bg-amber-500/5 border border-amber-500/15 rounded-xl px-3 py-2.5 space-y-1">
                            <p className="text-[10px] text-amber-300 font-semibold">Citizen folder only — no server needed</p>
                            <p className="text-[10px] text-zinc-500 leading-relaxed">
                              <span className="font-mono text-zinc-300">optigods-timecycle/</span> is inside the citizen/ folder in the ZIP.
                              Drag it in like the other files, open FiveM, press <span className="font-mono text-zinc-300">F8</span>, type{" "}
                              <span className="font-mono text-zinc-300">start optigods-timecycle</span>.
                            </p>
                          </div>
                          <div className="pl-9">
                            <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-2 block">
                              Lock at — {String(freezeHour).padStart(2, "0")}:00
                            </label>
                            <Slider value={[freezeHour]} onValueChange={([v]) => setFreezeHour(v)}
                              min={0} max={23} step={1} className="w-full" data-testid="slider-freeze-hour" />
                            <div className="flex justify-between mt-1">
                              <span className="text-[9px] text-zinc-600">Midnight</span>
                              <span className="text-[9px] text-amber-500/70">Noon ← max FPS</span>
                              <span className="text-[9px] text-zinc-600">Night</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-white/3 border border-white/8 flex items-center justify-center">
                        <CloudRain className="w-3.5 h-3.5 text-cyan-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-white leading-tight">Disable rain & thunder</p>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-emerald-500/15 border-emerald-500/20 text-emerald-400">+25 FPS</span>
                        </div>
                        <p className="text-[10px] text-zinc-500">Removes rain particles during RAIN / THUNDER states</p>
                      </div>
                    </div>
                    <Toggle on={disableRain} onToggle={() => setDisableRain(v => !v)} testId="toggle-disable-rain" />
                  </div>

                  <div className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-white/3 border border-white/8 flex items-center justify-center">
                        <Snowflake className="w-3.5 h-3.5 text-cyan-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-white leading-tight">Disable snow & blizzard</p>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-emerald-500/15 border-emerald-500/20 text-emerald-400">+25–30 FPS</span>
                        </div>
                        <p className="text-[10px] text-zinc-500">Removes snow particles — SNOW / BLIZZARD / XMAS</p>
                      </div>
                    </div>
                    <Toggle on={disableSnow} onToggle={() => setDisableSnow(v => !v)} testId="toggle-disable-snow" />
                  </div>

                  <div className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-white/3 border border-white/8 flex items-center justify-center">
                        <Shield className="w-3.5 h-3.5 text-red-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-white leading-tight">Disable blood decals</p>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-zinc-800 border-white/10 text-zinc-500">Citizen</span>
                        </div>
                        <p className="text-[10px] text-zinc-500">Zeros blood pool scale — visualsettings.dat override</p>
                      </div>
                    </div>
                    <Toggle on={disableBloodDecals} onToggle={() => setDisableBloodDecals(v => !v)} testId="toggle-disable-blood" />
                  </div>

                  <ToggleRow icon={Eye} label="Keep Props" on={keepProps} onToggle={() => setKeepProps(v => !v)}
                    sub="Full world props — recommended" testId="toggle-keep-props" />
                </div>
              </div>

              {/* Right: Preview + summary + download */}
              <div className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
                <SkyPreview
                  cloudThickness={cloudThickness} jetStreams={jetStreams}
                  skyColorKey={skyColorKey} skyBrightness={skyBrightness}
                  freezeTime={freezeTime} freezeHour={freezeHour}
                  disableRain={disableRain} disableSnow={disableSnow}
                  aerialClouds={aerialClouds} aerialDensity={aerialDensity}
                  lightRays={lightRays} lightRayIntensity={lightRayIntensity}
                  atmosphereHaze={atmosphereHaze} sunIntensity={sunIntensity}
                />

                {/* FPS Warning */}
                <AnimatePresence>
                  {fpsWarningLevel !== "ok" && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                      className={cn(
                        "rounded-xl border px-4 py-3 flex items-start gap-3",
                        fpsWarningLevel === "heavy" ? "border-red-500/30 bg-red-500/8" : "border-amber-500/25 bg-amber-500/6"
                      )}
                    >
                      <AlertCircle className={cn("w-4 h-4 shrink-0 mt-0.5", fpsWarningLevel === "heavy" ? "text-red-400" : "text-amber-400")} />
                      <div>
                        <p className={cn("text-xs font-bold mb-0.5", fpsWarningLevel === "heavy" ? "text-red-300" : "text-amber-300")}>
                          {fpsWarningLevel === "heavy" ? "⚠ Heavy visual load — FPS will drop in crowds" : "Moderate visual load"}
                        </p>
                        <p className="text-[10px] text-zinc-500 leading-relaxed">
                          {fpsWarningLevel === "heavy"
                            ? "Turn on Freeze Time, set Clouds to 0%, Light Rays OFF. This pack will lag on a 1650 Super in crowded servers."
                            : "This pack is moderate. Disable Light Rays or lower Clouds for more headroom in busy areas."}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Pack summary */}
                <div className="rounded-2xl border border-white/8 bg-zinc-900/60 p-4 space-y-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Pack Summary</p>
                  {[
                    { label: "Sky Color",     value: `${skyLabel(skyColorKey)} · ${skyBrightness}%`, ok: true },
                    { label: "Ground Clouds", value: freezeTime ? "Frozen clear" : cloudThickness === 0 ? "OFF (+2–6 FPS)" : `${cloudThickness}%`, ok: cloudThickness < 30 || freezeTime },
                    { label: "Aerial Clouds", value: aerialClouds ? `ON · ${aerialDensity}%` : "OFF (+3–8 FPS)", ok: !aerialClouds },
                    { label: "Jet Streams",   value: freezeTime ? "Disabled" : jetStreams === 0 ? "OFF (+1–2 FPS)" : `${jetStreams}%`, ok: jetStreams === 0 || freezeTime },
                    { label: "Light Rays",    value: lightRays ? `ON · ${lightRayIntensity}% (−5–15 FPS)` : "OFF (+5–15 FPS)", ok: !lightRays },
                    { label: "Sun Intensity", value: `${sunIntensity}%`, ok: true },
                    { label: "Haze",          value: atmosphereHaze ? "ON" : "OFF (+1–3 FPS)", ok: !atmosphereHaze },
                    { label: "Rain",          value: disableRain || freezeTime ? "OFF (+25 FPS)" : "Active", ok: disableRain || freezeTime },
                    { label: "Snow",          value: disableSnow || freezeTime ? "OFF (+25–30 FPS)" : "Active", ok: disableSnow || freezeTime },
                    { label: "Blood Decals",  value: disableBloodDecals ? "OFF (citizen)" : "Default", ok: disableBloodDecals },
                    { label: "Time",          value: freezeTime ? `Locked ${String(freezeHour).padStart(2,"0")}:00 (+30–45 FPS)` : "Dynamic", ok: freezeTime },
                    { label: "Props",         value: keepProps ? "Full" : "Reduced", ok: keepProps },
                  ].map(({ label, value, ok }) => (
                    <div key={label} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-zinc-500 shrink-0">{label}</span>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs font-semibold text-white truncate">{value}</span>
                        <CheckCircle2 className={cn("w-3 h-3 shrink-0", ok ? "text-emerald-400" : "text-zinc-600")} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* ZIP contents */}
                <div className="rounded-2xl border border-white/8 bg-zinc-900/40 p-4">
                  <div className="flex items-center gap-2 mb-2.5">
                    <FolderOpen className="w-3.5 h-3.5 text-zinc-400" />
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">ZIP Contents</p>
                  </div>
                  <div className="space-y-1 font-mono text-[10px]">
                    <div className="flex items-center gap-2 text-zinc-300">
                      <Layers className="w-3 h-3 text-amber-400 shrink-0" /><span>citizen/</span>
                    </div>
                    <div className="flex items-center gap-2 text-zinc-400 pl-4">
                      <Layers className="w-3 h-3 text-zinc-600 shrink-0" /><span>platform/data/tune/timecycle_mods_1.xml</span>
                    </div>
                    <div className="flex items-center gap-2 text-zinc-400 pl-4">
                      <Layers className="w-3 h-3 text-zinc-600 shrink-0" /><span>common/data/weather.xml</span>
                    </div>
                    {disableBloodDecals && (
                      <div className="flex items-center gap-2 text-red-400/70 pl-4">
                        <Shield className="w-3 h-3 shrink-0" /><span>common/data/visualsettings.dat</span>
                      </div>
                    )}
                    {freezeTime && (
                      <>
                        <div className="flex items-center gap-2 text-amber-400/80 pl-4">
                          <Clock className="w-3 h-3 shrink-0" /><span>optigods-timecycle/</span>
                        </div>
                        <div className="flex items-center gap-2 text-amber-300/50 pl-8">
                          <Layers className="w-3 h-3 text-zinc-700 shrink-0" /><span>client.lua + fxmanifest.lua</span>
                        </div>
                      </>
                    )}
                    <div className="flex items-center gap-2 text-zinc-500 mt-1">
                      <Layers className="w-3 h-3 text-zinc-700 shrink-0" /><span>READ ME - How to install.txt</span>
                    </div>
                  </div>
                </div>

                {/* Generate button */}
                <Button
                  onClick={handleGenerate} data-testid="button-generate-pack"
                  className={cn(
                    "w-full py-3 rounded-xl font-bold text-sm transition-all",
                    generated ? "bg-emerald-600 hover:bg-emerald-500" : "bg-red-600 hover:bg-red-500"
                  )}
                >
                  <AnimatePresence mode="wait">
                    {generated ? (
                      <motion.span key="done"
                        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                        className="flex items-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Saved to Downloads
                      </motion.span>
                    ) : (
                      <motion.span key="gen"
                        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                        className="flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Generate &amp; Download citizen ZIP
                        <ChevronRight className="w-4 h-4 opacity-60" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Button>
              </div>
            </div>
          </section>
        )}

        {/* ── ReShade Presets ── */}
        {activeTab === "reshade" && (
          <section className="space-y-5">
            {/* Header — no background image */}
            <div className="rounded-2xl border border-white/8 bg-zinc-900/70 px-6 py-5">
              <div className="flex items-center gap-2 mb-2">
                <Monitor className="w-4 h-4 text-red-400" />
                <span className="text-[10px] uppercase tracking-[0.2em] text-red-400 font-bold">leaq's ReShade Collection</span>
              </div>
              <h2 className="text-xl font-display font-black text-white leading-tight mb-1">
                Post-process presets. <span className="text-zinc-400">Real results.</span>
              </h2>
              <p className="text-xs text-zinc-500">Screenshots incoming — install and see for yourself.</p>
            </div>

            {/* Install steps */}
            <div className="rounded-xl border border-blue-500/15 bg-blue-500/[0.04] px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <p className="text-xs font-bold text-blue-300">Quick install</p>
              </div>
              <div className="flex items-start gap-3 flex-wrap text-[11px] text-zinc-400">
                {[
                  "Install ReShade from reshade.me → target FiveM.exe",
                  "Download a preset .ini below",
                  "Drop into %LOCALAPPDATA%\\FiveM\\FiveM Application Data\\plugins\\",
                  "In-game: Home key → preset dropdown → select file",
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-1.5 min-w-[45%]">
                    <span className="w-4 h-4 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-400 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">{i+1}</span>
                    <span className="leading-relaxed">{step}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Preset cards — flat, no images */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {RESHADE_PRESETS.map(preset => (
                <div key={preset.id} className="rounded-2xl border border-white/8 overflow-hidden hover:border-white/20 transition-all">
                  {/* Header band */}
                  <div className="bg-zinc-900 border-b border-white/6 px-4 py-4 flex items-center justify-between">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-500 mb-0.5">ReShade Preset</p>
                      <h3 className="text-base font-display font-black text-white leading-tight">{preset.label}</h3>
                    </div>
                    <span className={cn("text-[9px] font-bold px-2 py-1 rounded-full border uppercase shrink-0", preset.badgeCls)}>
                      {preset.badge}
                    </span>
                  </div>
                  {/* Body */}
                  <div className="bg-zinc-900/95 p-4 space-y-3">
                    <p className="text-[11px] text-zinc-400 leading-relaxed">{preset.desc}</p>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-white/5 border border-white/8 text-zinc-300">
                        {preset.techniques}
                      </span>
                      <span className={cn("text-[9px] font-semibold px-2 py-0.5 rounded-full border", preset.perfCls)}>
                        {preset.perf}
                      </span>
                    </div>
                    <a
                      href={preset.file}
                      download={`${preset.name}.ini`}
                      data-testid={`button-download-reshade-${preset.id}`}
                      className={cn("flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-xs font-bold transition-all w-full", preset.btnCls)}
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download {preset.name}.ini
                    </a>
                  </div>
                </div>
              ))}
            </div>

            {/* Performance note */}
            <div className="rounded-xl border border-white/5 bg-zinc-950/30 px-4 py-3 flex items-start gap-3">
              <Zap className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                ReShade runs post-process on top of the game. On a <span className="text-zinc-300">1650 Super</span> at 1080p, all four presets stay under 3 ms GPU overhead. If you're CPU-bottlenecked in FiveM, ReShade adds near-zero latency.
              </p>
            </div>
          </section>
        )}

        {/* ── Info ── */}
        {activeTab === "info" && (
          <section className="rounded-2xl border border-white/5 bg-zinc-900/30 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <CloudOff className="w-4 h-4 text-zinc-400" />
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">How FiveM Graphics Packs Work</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-zinc-500 leading-relaxed">
              <div>
                <p className="font-semibold text-zinc-300 mb-1">What they do</p>
                <p>Override FiveM's sky, cloud and weather visuals via files in the <span className="font-mono text-zinc-400">citizen</span> folder — no mods menu or server permission needed.</p>
              </div>
              <div>
                <p className="font-semibold text-zinc-300 mb-1">Files inside</p>
                <p><span className="font-mono text-zinc-400">timecycle_mods_1.xml</span> sets sky colour and cloud density. <span className="font-mono text-zinc-400">weather.xml</span> controls cloud hat per weather state. Both are XML — human-readable.</p>
              </div>
              <div>
                <p className="font-semibold text-zinc-300 mb-1">To uninstall</p>
                <p>Delete the <span className="font-mono text-zinc-400">citizen</span> folder from FiveM Application Data, or remove the two XML files. Restart FiveM — stock visuals restore instantly.</p>
              </div>
            </div>
          </section>
        )}

      </div>
    </AppLayout>
  );
}
