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
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

// ── Gate ─────────────────────────────────────────────────────────────────────
const GATE_KEY  = "fg_unlocked_v1";
const GATE_CODE = "4258";

function isUnlocked() {
  try { return sessionStorage.getItem(GATE_KEY) === "1"; } catch { return false; }
}
function storeUnlocked() {
  try { sessionStorage.setItem(GATE_KEY, "1"); } catch {} 
}

// ── Math helpers ──────────────────────────────────────────────────────────────
function lerp(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t);
}
function num(v: number, decimals = 6) {
  return v.toFixed(decimals);
}

// ── Sky colour from blueDepth slider (0-100) ──────────────────────────────────
function skyRgb(blueDepth: number) {
  const b = blueDepth / 100;
  return {
    r: lerp(8,  30,  b),
    g: lerp(15, 75,  b),
    B: lerp(45, 200, b),
  };
}
function skyLabel(blueDepth: number) {
  if (blueDepth < 25) return "Dark Navy";
  if (blueDepth < 50) return "Deep Blue";
  if (blueDepth < 75) return "Vivid Blue";
  return "Bright Cyan";
}

// ── XML builders ──────────────────────────────────────────────────────────────
const WEATHER_TYPES = [
  "EXTRASUNNY","CLEAR","NEUTRAL","SMOG","FOGGY",
  "OVERCAST","CLOUDS","CLEARING","RAIN","THUNDER",
  "BLIZZARD","SNOW","SNOWLIGHT","XMAS","HALLOWEEN",
];

const RAIN_WEATHER  = ["RAIN","THUNDER"];
const SNOW_WEATHER  = ["BLIZZARD","SNOW","SNOWLIGHT","XMAS"];
const CLEAR_WEATHER = ["EXTRASUNNY","CLEAR"];

function buildTimecycleXml(opts: {
  cloudThickness: number;
  jetStreams: number;
  blueDepth: number;
  freezeWeather: boolean;
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
  const { r, g, B } = skyRgb(opts.blueDepth);

  const skyR = num(r / 255);
  const skyG = num(g / 255);
  const skyB = num(B / 255);

  // Aerial cloud hat — high-altitude fluffy clouds visible from the sky
  const aerialHat = opts.aerialClouds ? num(opts.aerialDensity / 100) : num(0);

  // Light rays (god rays) — volumetric sun shafts
  const rayStrength = opts.lightRays ? num(opts.lightRayIntensity / 100) : num(0);

  // Sun intensity — controls sun brightness multiplier (0.5–3.0 range)
  const sunMul = num(0.5 + (opts.sunIntensity / 100) * 2.5);

  // Atmosphere haze — horizon fog/heat shimmer
  const hazeVal = opts.atmosphereHaze ? num(0.18) : num(0);

  const items = WEATHER_TYPES.map(w => {
    let cloudVal   = num(c);
    let jetVal     = num(j);
    let aerialVal  = aerialHat;
    let rayVal     = rayStrength;

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
    if (opts.freezeWeather) {
      cloudVal  = num(0);
      jetVal    = num(0);
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
  freezeWeather: boolean;
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

    if (opts.freezeWeather || (opts.disableRain && RAIN_WEATHER.includes(name)) || (opts.disableSnow && SNOW_WEATHER.includes(name))) {
      effective = 0;
      cloudHat  = 0;
    }

    return `    <Item>\n      <Name>${name}</Name>\n      <cloudHatLevel value="${num(cloudHat, 4)}" />\n      <cloudiness value="${num(effective, 4)}" />\n    </Item>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<CWeatherTypeList>\n  <WeatherTypes>\n${entries}\n  </WeatherTypes>\n</CWeatherTypeList>\n`;
}

// Time-freeze: a FiveM client script that locks the clock via NetworkOverrideClockTime
function buildTimeFreezeScript(hour: number, minute: number): string {
  return [
    `-- Opti Gods Time Freeze — generated by optigods.com`,
    `-- Drop this file into your FiveM resources folder as a new resource`,
    `-- Add "start optigods-timecycle" to your server.cfg, OR run as a client script`,
    ``,
    `Citizen.CreateThread(function()`,
    `    while true do`,
    `        -- Freeze clock at ${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")} — prevents the sun angle shifting mid-game`,
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

type PackOpts = {
  packName: string;
  cloudThickness: number;
  jetStreams: number;
  blueDepth: number;
  keepProps: boolean;
  freezeWeather: boolean;
  disableRain: boolean;
  disableSnow: boolean;
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
  const label = skyLabel(opts.blueDepth);
  const flags: string[] = [];
  if (opts.disableRain)      flags.push("Rain disabled");
  if (opts.disableSnow)      flags.push("Snow disabled");
  if (opts.freezeWeather)    flags.push("All weather frozen to clear");
  if (opts.freezeTime)       flags.push(`Time frozen at ${String(opts.freezeHour).padStart(2,"0")}:${String(opts.freezeMinute).padStart(2,"0")}`);
  if (opts.aerialClouds)     flags.push(`Aerial clouds ON (${opts.aerialDensity}% density)`);
  if (opts.lightRays)        flags.push(`Light rays ON (${opts.lightRayIntensity}% intensity)`);
  if (opts.atmosphereHaze)   flags.push("Atmosphere haze ON");

  return [
    `OPTI GODS — FiveM Graphics Pack`,
    `Pack Name  : ${opts.packName}`,
    `Generated  : ${new Date().toISOString().split("T")[0]}`,
    ``,
    `SETTINGS`,
    `  Ground Clouds   : ${opts.cloudThickness}%  ${opts.cloudThickness === 0 ? "(+2-6 FPS)" : ""}`,
    `  Aerial Clouds   : ${opts.aerialClouds ? opts.aerialDensity + "% density" : "OFF (+3-8 FPS)"}`,
    `  Jet Streams     : ${opts.jetStreams}%  ${opts.jetStreams === 0 ? "(+1-2 FPS)" : ""}`,
    `  Light Rays      : ${opts.lightRays ? opts.lightRayIntensity + "% intensity (-5-15 FPS)" : "OFF (+5-15 FPS)"}`,
    `  Sun Intensity   : ${opts.sunIntensity}%`,
    `  Atmosphere Haze : ${opts.atmosphereHaze ? "ON" : "OFF (+1-3 FPS)"}`,
    `  Sky Colour      : ${label} (${opts.blueDepth}%)`,
    `  Props           : ${opts.keepProps ? "Kept (full props)" : "Reduced"}`,
    flags.length ? `  Extra flags     : ${flags.join(", ")}` : "",
    ``,
    `INSTALL`,
    `  1. Extract this zip`,
    `  2. Open: %LOCALAPPDATA%\\FiveM\\FiveM Application Data\\`,
    `  3. DELETE the existing "citizen" folder inside that folder`,
    `  4. Drag the new "citizen" folder from the zip into that folder`,
    `  5. Restart FiveM completely`,
    ``,
    opts.freezeTime ? [
      `TIME FREEZE RESOURCE (if included)`,
      `  Copy the "optigods-timecycle" folder into your FiveM server resources folder`,
      `  Add  start optigods-timecycle  to server.cfg`,
      `  This locks the sun at ${String(opts.freezeHour).padStart(2,"0")}:${String(opts.freezeMinute).padStart(2,"0")} to prevent FPS dips from lighting changes`,
      ``,
    ].join("\n") : "",
    `UNINSTALL`,
    `  Open: %LOCALAPPDATA%\\FiveM\\FiveM Application Data\\`,
    `  Delete the entire "citizen" folder (or just remove:`,
    `    citizen\\platform\\data\\tune\\timecycle_mods_1.xml`,
    `    citizen\\common\\data\\weather.xml)`,
    `  Restart FiveM — stock visuals restore instantly.`,
    ``,
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
    files["optigods-timecycle/client.lua"]     = strToU8(buildTimeFreezeScript(opts.freezeHour, opts.freezeMinute));
    files["optigods-timecycle/fxmanifest.lua"] = strToU8(buildTimeFreezeManifest());
  }

  return zipSync(files);
}

function downloadBlob(data: Uint8Array, filename: string, mime = "application/zip") {
  const blob = new Blob([data], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadText(text: string, filename: string) {
  const blob = new Blob([text], { type: "text/plain" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Components ────────────────────────────────────────────────────────────────

function SliderRow({
  icon: Icon, label, sublabel, value, onChange, color = "red", leftLabel, rightLabel,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; sublabel: string; value: number;
  onChange: (v: number) => void;
  color?: "red" | "blue" | "cyan" | "amber";
  leftLabel?: string; rightLabel?: string;
}) {
  const colorMap = { red: "text-red-400", blue: "text-blue-400", cyan: "text-cyan-400", amber: "text-amber-400" };
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-white/3 border border-white/8 flex items-center justify-center">
            <Icon className={cn("w-3.5 h-3.5", colorMap[color])} />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">{label}</p>
            <p className="text-[10px] text-zinc-500">{sublabel}</p>
          </div>
        </div>
        <span className={cn("text-lg font-black tabular-nums", colorMap[color])}>{value}%</span>
      </div>
      <div className="px-1">
        <Slider
          value={[value]} onValueChange={([v]) => onChange(v)}
          min={0} max={100} step={1} className="w-full"
          data-testid={`slider-${label.toLowerCase().replace(/\s+/g, "-")}`}
        />
        {(leftLabel || rightLabel) && (
          <div className="flex justify-between mt-1">
            <span className="text-[9px] text-zinc-600 uppercase tracking-wider">{leftLabel}</span>
            <span className="text-[9px] text-zinc-600 uppercase tracking-wider">{rightLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
}

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

// ── ControlRow — slider with icon + FPS badge + sublabel ─────────────────────
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
  cloudThickness, jetStreams, blueDepth, freezeWeather, disableRain, disableSnow, freezeTime, freezeHour,
}: {
  cloudThickness: number; jetStreams: number; blueDepth: number;
  freezeWeather: boolean; disableRain: boolean; disableSnow: boolean;
  freezeTime: boolean; freezeHour: number;
}) {
  const { r, g, B } = skyRgb(blueDepth);

  // Effective clouds — if freeze weather, no clouds
  const effectiveClouds = freezeWeather ? 0 : cloudThickness;
  const effectiveJets   = freezeWeather ? 0 : jetStreams;

  // Time-of-day overlay tint
  const isDaytime = !freezeTime || (freezeHour >= 6 && freezeHour <= 19);
  const isGolden  = freezeTime && (freezeHour === 6 || freezeHour === 7 || freezeHour === 18 || freezeHour === 19);
  const isNight   = freezeTime && (freezeHour < 6 || freezeHour > 20);

  const skyTop    = isNight ? `rgb(${Math.round(r*0.1)}, ${Math.round(g*0.1)}, ${Math.round(B*0.3)})` : `rgb(${r}, ${g}, ${B})`;
  const skyBottom = isNight ? `rgb(8, 8, 18)` : isGolden ? `rgb(60, 35, 12)` : `rgb(${Math.max(r-10,0)}, ${Math.max(g-18,0)}, ${Math.max(B-30,0)})`;

  const goldenOverlay = isGolden ? "rgba(200, 100, 20, 0.18)" : "transparent";

  const cloudCount = Math.min(Math.ceil(effectiveClouds / 20), 5);

  return (
    <div
      className="rounded-2xl border border-white/8 overflow-hidden h-56 relative select-none"
      style={{ background: `linear-gradient(to bottom, ${skyTop} 0%, ${skyBottom} 70%, rgb(14,14,20) 100%)` }}
    >
      {/* Golden hour overlay */}
      {isGolden && (
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: `linear-gradient(to bottom, ${goldenOverlay} 0%, transparent 60%)` }} />
      )}

      {/* Sun / Moon */}
      {freezeTime && (
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: isNight ? "14px" : "22px",
            height: isNight ? "14px" : "22px",
            background: isNight ? "#e8e8ff" : isGolden ? "#ffcc66" : "#fffce8",
            boxShadow: isNight ? "0 0 12px 4px rgba(200,200,255,0.4)" : isGolden ? "0 0 32px 12px rgba(255,180,40,0.45)" : "0 0 40px 14px rgba(255,250,200,0.35)",
            top: isNight ? "22%" : isGolden ? "68%" : "18%",
            left: `${20 + (freezeHour / 24) * 60}%`,
          }}
        />
      )}

      {/* Stars (night only) */}
      {isNight && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(18)].map((_, i) => (
            <div key={i} className="absolute rounded-full bg-white"
              style={{
                width: i % 3 === 0 ? "2px" : "1.5px",
                height: i % 3 === 0 ? "2px" : "1.5px",
                opacity: 0.4 + (i % 4) * 0.15,
                top:  `${5 + (i * 31 % 52)}%`,
                left: `${3 + (i * 47 % 93)}%`,
              }}
            />
          ))}
        </div>
      )}

      {/* Clouds */}
      {effectiveClouds > 3 && (
        <div className="absolute inset-0 flex items-start justify-around pt-6 pointer-events-none"
          style={{ opacity: Math.min(effectiveClouds / 100, 0.92) }}
        >
          {[...Array(cloudCount)].map((_, i) => (
            <div key={i}
              className="rounded-full"
              style={{
                background: isNight ? "rgba(180,180,200,0.25)" : "rgba(255,255,255,0.55)",
                filter: "blur(8px)",
                width: `${55 + i * 18}px`,
                height: `${18 + i * 6}px`,
                marginTop: `${i * 8 + (i % 2) * 4}px`,
              }}
            />
          ))}
        </div>
      )}

      {/* Jet streams */}
      {effectiveJets > 3 && (
        <div className="absolute pointer-events-none"
          style={{ top: "22%", left: "10%", right: "10%", opacity: effectiveJets / 100 * 0.65 }}
        >
          <div className="w-full h-px bg-white/80" style={{ filter: "blur(0.6px)" }} />
          <div className="w-3/5 h-px bg-white/50 mt-3 ml-12" style={{ filter: "blur(0.8px)" }} />
        </div>
      )}

      {/* Ground / city horizon */}
      <div className="absolute bottom-0 left-0 right-0 h-14"
        style={{ background: "linear-gradient(to top, rgb(10,10,14) 0%, rgba(14,14,20,0.7) 60%, transparent 100%)" }}
      />

      {/* Status row */}
      <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between pointer-events-none">
        <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-1.5 inline-flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-bold text-white">Live preview</span>
        </div>
        <div className="flex gap-1.5">
          {freezeWeather && (
            <span className="bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[9px] font-bold px-2 py-0.5 rounded-full">
              CLEAR LOCKED
            </span>
          )}
          {disableRain && !freezeWeather && (
            <span className="bg-blue-500/20 border border-blue-500/30 text-blue-400 text-[9px] font-bold px-2 py-0.5 rounded-full">
              NO RAIN
            </span>
          )}
          {disableSnow && !freezeWeather && (
            <span className="bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-[9px] font-bold px-2 py-0.5 rounded-full">
              NO SNOW
            </span>
          )}
          {freezeTime && (
            <span className="bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[9px] font-bold px-2 py-0.5 rounded-full">
              {String(freezeHour).padStart(2,"0")}:00 LOCKED
            </span>
          )}
        </div>
      </div>

      {/* Sky colour label */}
      <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm rounded-lg px-2.5 py-1">
        <span className="text-[10px] font-bold text-white/70">{skyLabel(blueDepth)}</span>
      </div>
    </div>
  );
}

// ── ReShade preset descriptions ───────────────────────────────────────────────
const RESHADE_PRESETS = [
  {
    id: "mylik",
    file: "/reshade-presets/mylik.ini",
    name: "mylik",
    label: "leaq's Daily Driver",
    badge: "Personal",
    badgeCls: "bg-red-500/15 border-red-500/25 text-red-400",
    accentCls: "from-red-900/80 via-black/70 to-black",
    borderHover: "group-hover:border-red-500/50",
    btnCls: "bg-red-600 hover:bg-red-500",
    desc: "Exact ReShade leaq runs for FiveM — DPX colour grading, Technicolor2, LumaSharpen, and a custom crosshair. Sharpest without looking over-processed.",
    techniques: ["DPX", "Technicolor2", "LumaSharpen", "xhair"],
    perf: "Low impact",
    perfCls: "bg-emerald-500/15 border-emerald-500/20 text-emerald-400",
    screenshot: "/reshade-presets/preview-sunrise.png",
    mood: "Warm · Vivid · Cinematic",
  },
  {
    id: "15",
    file: "/reshade-presets/15.ini",
    name: "15",
    label: "15 — Sharp & Clean",
    badge: "Balanced",
    badgeCls: "bg-emerald-500/15 border-emerald-500/25 text-emerald-400",
    accentCls: "from-rose-950/80 via-black/70 to-black",
    borderHover: "group-hover:border-emerald-500/50",
    btnCls: "bg-emerald-600 hover:bg-emerald-500",
    desc: "LumaSharpen + CAS double-sharpen with Technicolor2 colour boost. Clean look with a green-circle crosshair. Good all-rounder for daytime RP.",
    techniques: ["LumaSharpen", "Technicolor2", "CAS", "xhair"],
    perf: "Very low impact",
    perfCls: "bg-emerald-500/15 border-emerald-500/20 text-emerald-400",
    screenshot: "/reshade-presets/preview-sunset.png",
    mood: "Clean · Sharp · Balanced",
  },
  {
    id: "Aeirdv2",
    file: "/reshade-presets/Aeirdv2.ini",
    name: "Aeirdv2",
    label: "Aeird v2 — Full Cinematic",
    badge: "Cinematic",
    badgeCls: "bg-amber-500/15 border-amber-500/25 text-amber-400",
    accentCls: "from-indigo-950/90 via-black/75 to-black",
    borderHover: "group-hover:border-amber-500/50",
    btnCls: "bg-amber-600 hover:bg-amber-500",
    desc: "Full cinematic stack: DPX, FilmicSharpen, Vignette, Technicolor2. Best visuals of the four — slight FPS cost. Ideal for recording and screenshots.",
    techniques: ["DPX", "FilmicSharpen", "Vignette", "Technicolor2", "LumaSharpen"],
    perf: "Moderate impact",
    perfCls: "bg-amber-500/15 border-amber-500/20 text-amber-400",
    screenshot: "/reshade-presets/preview-dusk.png",
    mood: "Dramatic · Moody · Film-grade",
  },
  {
    id: "bango_rs",
    file: "/reshade-presets/bango_rs.ini",
    name: "bango_rs",
    label: "Bango RS — Minimal",
    badge: "Lightweight",
    badgeCls: "bg-blue-500/15 border-blue-500/25 text-blue-400",
    accentCls: "from-blue-950/80 via-black/70 to-black",
    borderHover: "group-hover:border-blue-500/50",
    btnCls: "bg-blue-600 hover:bg-blue-500",
    desc: "Curves + Technicolor2 + LumaSharpen only — the lightest of the four. Subtle colour correction, near-zero performance hit. Best for low-end GPUs.",
    techniques: ["Curves", "Technicolor2", "LumaSharpen", "xhair"],
    perf: "Minimal impact",
    perfCls: "bg-blue-500/15 border-blue-500/20 text-blue-400",
    screenshot: "/reshade-presets/preview-dawn.png",
    mood: "Subtle · Natural · Lightweight",
  },
];

// ── Gate screen ───────────────────────────────────────────────────────────────
function CodeGate({ onUnlock }: { onUnlock: () => void }) {
  const [code,  setCode]  = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const handleSubmit = () => {
    if (code.trim() === GATE_CODE) { storeUnlocked(); onUnlock(); }
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
  const [unlocked,       setUnlockedState]  = useState(isUnlocked);
  const [cloudThickness, setCloudThickness] = useState(0);
  const [jetStreams,      setJetStreams]     = useState(0);
  const [blueDepth,      setBlueDepth]      = useState(70);
  const [keepProps,      setKeepProps]      = useState(true);
  const [packName,       setPackName]       = useState("My Blue Sky Pack");
  const [generated,      setGenerated]      = useState(false);

  // Weather toggles
  const [freezeWeather,  setFreezeWeather]  = useState(false);
  const [disableRain,    setDisableRain]    = useState(false);
  const [disableSnow,    setDisableSnow]    = useState(false);

  // Time freeze
  const [freezeTime,     setFreezeTime]     = useState(false);
  const [freezeHour,     setFreezeHour]     = useState(12);
  const [freezeMinute,   setFreezeMinute]   = useState(0);

  // Lighting & atmosphere
  const [aerialClouds,     setAerialClouds]     = useState(false);
  const [aerialDensity,    setAerialDensity]    = useState(60);
  const [lightRays,        setLightRays]        = useState(false);
  const [lightRayIntensity,setLightRayIntensity]= useState(50);
  const [sunIntensity,     setSunIntensity]     = useState(60);
  const [atmosphereHaze,   setAtmosphereHaze]   = useState(false);

  // AI pack generator
  const [aiPrompt,         setAiPrompt]         = useState("");
  const [aiLoading,        setAiLoading]        = useState(false);
  const [aiError,          setAiError]          = useState("");
  const [aiSuccess,        setAiSuccess]        = useState("");
  const aiInputRef = useRef<HTMLTextAreaElement>(null);

  const [activeTab, setActiveTab] = useState<"packs" | "builder" | "reshade" | "info">("packs");

  const handleUnlock = useCallback(() => setUnlockedState(true), []);

  const buildOpts = (): PackOpts => ({
    packName, cloudThickness, jetStreams, blueDepth, keepProps,
    freezeWeather, disableRain, disableSnow, freezeTime, freezeHour, freezeMinute,
    aerialClouds, aerialDensity, lightRays, lightRayIntensity, sunIntensity, atmosphereHaze,
  });

  // "Open FiveM App Data" — download a single-line bat that opens the folder
  const handleOpenAppData = () => {
    const bat = `@echo off\r\nstart "" "%LOCALAPPDATA%\\FiveM\\FiveM Application Data"\r\n`;
    const blob = new Blob([bat], { type: "application/octet-stream" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "Open-FiveM-AppData.bat";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGenerate = () => {
    const opts = buildOpts();
    const zip  = generateZip(opts);
    const safe = packName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
    downloadBlob(zip, `optigods-fivem-${safe}.zip`);
    setGenerated(true);
    setTimeout(() => setGenerated(false), 3000);
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiError("");
    setAiSuccess("");
    try {
      const res = await fetch("/api/ai/graphics-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: aiPrompt }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (data.packName)          setPackName(data.packName);
      if (data.cloudThickness != null) setCloudThickness(data.cloudThickness);
      if (data.jetStreams != null)      setJetStreams(data.jetStreams);
      if (data.blueDepth != null)      setBlueDepth(data.blueDepth);
      if (data.aerialClouds != null)   setAerialClouds(data.aerialClouds);
      if (data.aerialDensity != null)  setAerialDensity(data.aerialDensity);
      if (data.lightRays != null)      setLightRays(data.lightRays);
      if (data.lightRayIntensity != null) setLightRayIntensity(data.lightRayIntensity);
      if (data.sunIntensity != null)   setSunIntensity(data.sunIntensity);
      if (data.atmosphereHaze != null) setAtmosphereHaze(data.atmosphereHaze);
      if (data.freezeWeather != null)  setFreezeWeather(data.freezeWeather);
      if (data.disableRain != null)    setDisableRain(data.disableRain);
      if (data.disableSnow != null)    setDisableSnow(data.disableSnow);
      setAiSuccess(data.mood || "Pack configured! Review the sliders below, then download.");
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
            Custom graphics packs, ReShade presets, and weather controls — built for FiveM performance.
          </p>
        </div>

        {/* Open App Data quick-action */}
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

        {/* Install tip — packs + builder */}
        {activeTab !== "info" && activeTab !== "reshade" && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 flex items-start gap-3">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-300/80 leading-relaxed">
              <span className="font-bold text-amber-300">Install: </span>
              Extract ZIP → open{" "}
              <span className="font-mono text-amber-400/90">FiveM Application Data\</span>
              {" "}→ <span className="font-bold text-amber-300">delete</span> existing <span className="font-mono font-bold text-amber-300">citizen</span> folder → drag new one in → restart FiveM.
              Use the <span className="font-bold text-amber-300">Open Folder .bat</span> button above to jump straight there.
            </div>
          </div>
        )}

        {/* ── Pre-Made Packs ── */}
        {activeTab === "packs" && (
          <section className="space-y-5">
            {/* Hero gallery — real FiveM screenshots */}
            <div className="relative rounded-2xl overflow-hidden h-64 md:h-80 border border-white/8 group">
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

            {/* Screenshot gallery strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { src: "/reshade-presets/preview-sunrise.png",  label: "Golden Sunrise" },
                { src: "/reshade-presets/preview-dusk.png",     label: "Moody Dusk" },
                { src: "/reshade-presets/preview-dawn.png",     label: "Pre-Dawn" },
                { src: "/reshade-presets/preview-gunsrz1.png",  label: "Sunset Clouds" },
              ].map(({ src, label }) => (
                <div key={label} className="relative rounded-xl overflow-hidden h-20 border border-white/8 hover:border-white/20 transition-all cursor-default">
                  <img src={src} alt={label} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-2">
                    <span className="text-[9px] font-bold text-white/90 uppercase tracking-wider">{label}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* AI Pack Generator */}
            <div className="rounded-2xl border border-red-500/20 bg-gradient-to-br from-red-950/20 to-black p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center shrink-0">
                  <Wand2 className="w-4 h-4 text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-black text-white">AI Pack Generator</p>
                  <p className="text-[10px] text-zinc-500">Describe the vibe — get a ready-to-download pack. Powered by Opti Gods AI.</p>
                </div>
              </div>
              <div className="relative">
                <textarea
                  ref={aiInputRef}
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAiGenerate(); }}}
                  placeholder="e.g. &quot;golden sunrise with light rays and fluffy aerial clouds&quot; or &quot;moody blue night, no rain, high FPS&quot;"
                  data-testid="input-ai-pack-prompt"
                  rows={2}
                  className="w-full bg-black/40 border border-white/10 focus:border-red-500/40 rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors resize-none placeholder:text-zinc-600"
                />
              </div>
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
                <p className="text-[10px] text-zinc-600">Press Enter to submit · Opens Builder tab with your settings pre-filled</p>
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

            {/* leaq's pack card */}
            <div className="rounded-2xl overflow-hidden border border-white/8 group hover:border-red-500/30 transition-all relative">
              <div className="absolute inset-0">
                <img src="/reshade-presets/preview-sunrise.png" alt="pack preview" className="w-full h-full object-cover object-top" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/80 to-black/40" />
              </div>
              <div className="relative p-6 md:p-8">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.15em] text-red-400 font-bold mb-1">leaq's pack · v1 · Tested on 1650 Super</p>
                    <h3 className="text-xl font-display font-black text-white">Opti Gods Blue Sky Pack</h3>
                  </div>
                  <span className="text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded-full uppercase shrink-0">Tested</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {["No Clouds +6 FPS","Vivid Blue Sky","No Contrails +2 FPS","Props Intact","No Rain","Freeze Weather"].map(tag => (
                    <span key={tag} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/8 border border-white/10 text-zinc-200">
                      {tag}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed mb-5 max-w-md">
                  The exact pack leaq runs daily — all-clear blue sky, zero clouds, zero contrails. Big FPS gain on low-to-mid GPU builds. Simple, clean, high performance.
                </p>
                <a
                  href="https://github.com/duhthehomie/opti-gods/releases/latest"
                  target="_blank" rel="noopener noreferrer"
                  data-testid="link-graphics-pack-download"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download from GitHub Releases
                  <ChevronRight className="w-3 h-3 opacity-60" />
                </a>
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

                {/* Pack name */}
                <div className="rounded-2xl border border-white/8 bg-zinc-900/60 px-5 py-4">
                  <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-2 block">Pack Name</label>
                  <input
                    type="text" value={packName} onChange={e => setPackName(e.target.value)}
                    placeholder="My Blue Sky Pack" data-testid="input-pack-name"
                    className="w-full bg-zinc-900 border border-white/10 focus:border-red-500/40 rounded-xl px-4 py-2.5 text-white text-sm font-semibold outline-none transition-colors"
                  />
                </div>

                {/* Sky & Clouds */}
                <div className="rounded-2xl border border-white/8 bg-zinc-900/60 p-5 space-y-5">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Sky & Clouds</p>
                  </div>

                  {/* Ground clouds */}
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
                          <p className="text-[10px] text-zinc-500">Fluffy high-altitude clouds visible when flying</p>
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
                              <span className="text-[9px] text-zinc-600">Thick cloud banks</span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Jet streams */}
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

                  {/* Sky colour */}
                  <ControlRow
                    icon={Palette} label="Sky Colour" color="blue"
                    fpsBadge="No FPS impact" fpsColor="zinc"
                    sublabel={skyLabel(blueDepth)}
                  >
                    <Slider value={[blueDepth]} onValueChange={([v]) => setBlueDepth(v)}
                      min={0} max={100} step={1} className="w-full" data-testid="slider-blue-depth" />
                    <div className="flex justify-between mt-1">
                      <span className="text-[9px] text-zinc-600">Dark navy</span>
                      <span className="text-[9px] text-zinc-600">Vivid sky blue</span>
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
                          <p className="text-[10px] text-zinc-500">Volumetric sun shafts — most expensive visual effect</p>
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

                  {/* Sun intensity */}
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

                  {/* Haze */}
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
                        <p className="text-[10px] text-zinc-500">Horizon heat shimmer / atmospheric depth fog</p>
                      </div>
                    </div>
                    <Toggle on={atmosphereHaze} onToggle={() => setAtmosphereHaze(v => !v)} testId="toggle-atmosphere-haze" />
                  </div>
                </div>

                {/* Weather control */}
                <div className="rounded-2xl border border-white/8 bg-zinc-900/60 p-5 space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-3">Weather Control</p>
                  <div className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-white/3 border border-white/8 flex items-center justify-center">
                        <Sun className="w-3.5 h-3.5 text-amber-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-white leading-tight">Freeze all weather to clear</p>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-emerald-500/15 border-emerald-500/20 text-emerald-400">+5–15 FPS</span>
                        </div>
                        <p className="text-[10px] text-zinc-500">Forces EXTRASUNNY on all weather states</p>
                      </div>
                    </div>
                    <Toggle on={freezeWeather} onToggle={() => setFreezeWeather(v => !v)} testId="toggle-freeze-weather" />
                  </div>
                  {freezeWeather && (
                    <div className="ml-9 text-[10px] text-amber-400/80 bg-amber-500/5 border border-amber-500/15 rounded-lg px-3 py-1.5">
                      Overrides clouds + jet streams — all weather will look clear.
                    </div>
                  )}
                  <div className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-white/3 border border-white/8 flex items-center justify-center">
                        <CloudRain className="w-3.5 h-3.5 text-cyan-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-white leading-tight">Disable rain & thunder</p>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-emerald-500/15 border-emerald-500/20 text-emerald-400">+2–4 FPS</span>
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
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-emerald-500/15 border-emerald-500/20 text-emerald-400">+1–3 FPS</span>
                        </div>
                        <p className="text-[10px] text-zinc-500">Removes snow particles on SNOW / BLIZZARD / XMAS</p>
                      </div>
                    </div>
                    <Toggle on={disableSnow} onToggle={() => setDisableSnow(v => !v)} testId="toggle-disable-snow" />
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-white/3 border border-white/8 flex items-center justify-center">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-white leading-tight">Freeze Time</p>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-emerald-500/15 border-emerald-500/20 text-emerald-400">+1–4 FPS</span>
                        </div>
                        <p className="text-[10px] text-zinc-500">Lock in-game clock — stops sun-angle FPS dips</p>
                      </div>
                    </div>
                    <Toggle on={freezeTime} onToggle={() => setFreezeTime(v => !v)} testId="toggle-freeze-time" />
                  </div>
                  <AnimatePresence>
                    {freezeTime && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
                        <div className="pt-2 pl-9 space-y-3">
                          <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl px-4 py-2.5">
                            <p className="text-[10px] text-amber-300/80 leading-relaxed">
                              Lua resource <span className="font-mono">optigods-timecycle</span> included in ZIP — drop in server resources, add <span className="font-mono">start optigods-timecycle</span> to server.cfg.
                            </p>
                          </div>
                          <div>
                            <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-2 block">
                              Lock at — {String(freezeHour).padStart(2,"0")}:00
                            </label>
                            <Slider value={[freezeHour]} onValueChange={([v]) => setFreezeHour(v)}
                              min={0} max={23} step={1} className="w-full" data-testid="slider-freeze-hour" />
                            <div className="flex justify-between mt-1">
                              <span className="text-[9px] text-zinc-600">Midnight</span>
                              <span className="text-[9px] text-zinc-600">Noon (recommended)</span>
                              <span className="text-[9px] text-zinc-600">Night</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <ToggleRow icon={Eye} label="Keep Props" on={keepProps} onToggle={() => setKeepProps(v => !v)}
                    sub="Full world props — recommended for max FPS with visuals" testId="toggle-keep-props" />
                </div>
              </div>

              {/* Right: Preview + summary + download */}
              <div className="flex flex-col gap-4">
                <SkyPreview
                  cloudThickness={cloudThickness} jetStreams={jetStreams} blueDepth={blueDepth}
                  freezeWeather={freezeWeather} disableRain={disableRain} disableSnow={disableSnow}
                  freezeTime={freezeTime} freezeHour={freezeHour}
                />

                {/* Pack summary */}
                <div className="rounded-2xl border border-white/8 bg-zinc-900/60 p-4 space-y-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Pack Summary</p>
                  {[
                    { label: "Ground Clouds", value: freezeWeather ? "Frozen clear" : cloudThickness === 0 ? "OFF (+2–6 FPS)" : `${cloudThickness}%`, ok: cloudThickness < 30 || freezeWeather },
                    { label: "Aerial Clouds", value: aerialClouds ? `ON · ${aerialDensity}%` : "OFF (+3–8 FPS)", ok: !aerialClouds },
                    { label: "Jet Streams",   value: freezeWeather ? "Disabled" : jetStreams === 0 ? "OFF (+1–2 FPS)" : `${jetStreams}%`, ok: jetStreams === 0 || freezeWeather },
                    { label: "Light Rays",    value: lightRays ? `ON · ${lightRayIntensity}% (−5–15 FPS)` : "OFF (+5–15 FPS)", ok: !lightRays },
                    { label: "Sun Intensity", value: `${sunIntensity}%`, ok: true },
                    { label: "Haze",          value: atmosphereHaze ? "ON" : "OFF (+1–3 FPS)", ok: !atmosphereHaze },
                    { label: "Sky Colour",    value: skyLabel(blueDepth), ok: true },
                    { label: "Rain",          value: freezeWeather ? "Frozen out" : disableRain ? "OFF (+2–4 FPS)" : "Active", ok: disableRain || freezeWeather },
                    { label: "Snow",          value: freezeWeather ? "Frozen out" : disableSnow ? "OFF (+1–3 FPS)" : "Active", ok: disableSnow || freezeWeather },
                    { label: "Time",          value: freezeTime ? `Locked ${String(freezeHour).padStart(2,"0")}:00 (+1–4 FPS)` : "Dynamic", ok: freezeTime },
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
                    {freezeTime && (
                      <>
                        <div className="flex items-center gap-2 text-amber-400 mt-1">
                          <Clock className="w-3 h-3 shrink-0" /><span>optigods-timecycle/</span>
                        </div>
                        <div className="flex items-center gap-2 text-amber-300/70 pl-4">
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
            {/* Hero strip */}
            <div className="relative rounded-2xl overflow-hidden h-48 border border-white/8">
              <img src="/reshade-presets/preview-gunsrz1.png" alt="ReShade preview" className="w-full h-full object-cover object-center" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-transparent" />
              <div className="absolute inset-0 flex items-center p-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Monitor className="w-4 h-4 text-red-400" />
                    <span className="text-[10px] uppercase tracking-[0.2em] text-red-400 font-bold">leaq's ReShade Collection</span>
                  </div>
                  <h2 className="text-xl font-display font-black text-white leading-tight">
                    Post-process presets.<br /><span className="text-zinc-300">Real screenshots. Real results.</span>
                  </h2>
                </div>
              </div>
            </div>

            {/* Install steps — compact */}
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

            {/* Cinematic preset cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {RESHADE_PRESETS.map(preset => (
                <div key={preset.id} className="group rounded-2xl border border-white/8 overflow-hidden hover:border-white/20 transition-all relative">
                  {/* Screenshot background */}
                  <div className="relative h-44 overflow-hidden">
                    <img
                      src={preset.screenshot}
                      alt={preset.label}
                      className="w-full h-full object-cover object-center group-hover:scale-[1.03] transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/10" />
                    {/* Badge — top right */}
                    <div className="absolute top-3 right-3">
                      <span className={cn("text-[9px] font-bold px-2 py-1 rounded-full border uppercase backdrop-blur-sm", preset.badgeCls)}>
                        {preset.badge}
                      </span>
                    </div>
                    {/* Title over image */}
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-400 mb-0.5">ReShade Preset</p>
                      <h3 className="text-base font-display font-black text-white leading-tight">{preset.label}</h3>
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="bg-zinc-900/95 p-4 space-y-3">
                    <p className="text-[11px] text-zinc-400 leading-relaxed">{preset.desc}</p>

                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-white/5 border border-white/8 text-zinc-300">
                        {preset.techniques}
                      </span>
                      <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/15 text-emerald-400">
                        {preset.perf}
                      </span>
                    </div>

                    <a
                      href={preset.file}
                      download={`${preset.name}.ini`}
                      data-testid={`button-download-reshade-${preset.id}`}
                      className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all w-full"
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
                <p>Delete the <span className="font-mono text-zinc-400">citizen</span> folder from FiveM Application Data, or just remove the two XML files. Restart FiveM — stock visuals restore instantly.</p>
              </div>
            </div>
          </section>
        )}

      </div>
    </AppLayout>
  );
}
