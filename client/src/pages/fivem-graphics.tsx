import { useState, useCallback } from "react";
import { zipSync, strToU8 } from "fflate";
import { AppLayout } from "@/components/layout/app-layout";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  Cloud, CloudOff, Wind, Palette, Package, Lock, Download,
  CheckCircle2, Sparkles, ChevronRight, Info, Eye,
  FolderOpen, Layers, Clock, Sun, Snowflake, CloudRain,
  Zap, Shield, Monitor,
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
}): string {
  const c = opts.cloudThickness / 100;
  const j = opts.jetStreams / 100;
  const { r, g, B } = skyRgb(opts.blueDepth);

  const skyR = num(r / 255);
  const skyG = num(g / 255);
  const skyB = num(B / 255);

  const items = WEATHER_TYPES.map(w => {
    // Weather-specific cloud suppression
    let cloudVal = num(c);
    let jetVal   = num(j);

    if (opts.disableRain && RAIN_WEATHER.includes(w)) {
      cloudVal = num(0);
      jetVal   = num(0);
    }
    if (opts.disableSnow && SNOW_WEATHER.includes(w)) {
      cloudVal = num(0);
    }
    if (opts.freezeWeather) {
      // Force all weather to look like EXTRASUNNY
      cloudVal = num(0);
      jetVal   = num(0);
    }

    const mods = [
      ["cloudinessVal",   cloudVal, cloudVal],
      ["cloudHatLevel",   cloudVal, cloudVal],
      ["contrailDensity", jetVal,   jetVal  ],
      ["skyColour r",     skyR,     skyR    ],
      ["skyColour g",     skyG,     skyG    ],
      ["skyColour b",     skyB,     skyB    ],
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

function buildReadme(opts: {
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
}): string {
  const label = skyLabel(opts.blueDepth);
  const flags: string[] = [];
  if (opts.disableRain)    flags.push("Rain disabled");
  if (opts.disableSnow)    flags.push("Snow disabled");
  if (opts.freezeWeather)  flags.push("All weather frozen to clear");
  if (opts.freezeTime)     flags.push(`Time frozen at ${String(opts.freezeHour).padStart(2,"0")}:${String(opts.freezeMinute).padStart(2,"0")}`);

  return [
    `OPTI GODS — FiveM Graphics Pack`,
    `Pack Name  : ${opts.packName}`,
    `Generated  : ${new Date().toISOString().split("T")[0]}`,
    ``,
    `SETTINGS`,
    `  Cloud Thickness : ${opts.cloudThickness}%`,
    `  Jet Streams     : ${opts.jetStreams}%`,
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

function generateZip(opts: {
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
}): Uint8Array {
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

  const [activeTab, setActiveTab] = useState<"packs" | "builder" | "reshade" | "info">("packs");

  const handleUnlock = useCallback(() => setUnlockedState(true), []);

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
    const opts = { packName, cloudThickness, jetStreams, blueDepth, keepProps, freezeWeather, disableRain, disableSnow, freezeTime, freezeHour, freezeMinute };
    const zip  = generateZip(opts);
    const safe = packName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
    downloadBlob(zip, `optigods-fivem-${safe}.zip`);
    setGenerated(true);
    setTimeout(() => setGenerated(false), 3000);
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
          <section className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-red-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Pre-Made Packs</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* leaq's pack */}
              <div className="rounded-2xl border border-white/8 bg-gradient-to-br from-zinc-900/80 to-black p-5 relative overflow-hidden group hover:border-red-500/30 transition-all">
                <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none"
                  style={{ background: "radial-gradient(ellipse at top left, rgb(20,60,180) 0%, transparent 70%)" }} />
                <div className="relative">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.15em] text-red-400 font-bold mb-0.5">leaq's pack · v1</p>
                      <h3 className="text-lg font-display font-black text-white">Opti Gods Blue Sky Pack</h3>
                    </div>
                    <span className="text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded-full uppercase">Tested</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {["No Clouds","Vivid Blue Sky","No Jet Streams","Props Intact","1650 Super Tested"].map(tag => (
                      <span key={tag} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/5 border border-white/8 text-zinc-300">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed mb-4">
                    The exact pack leaq runs daily on his GTX 1650 Super + Ryzen 5 3500. All-clear blue sky, zero clouds, zero contrails — big FPS gain on low-to-mid GPU builds.
                  </p>
                  <a
                    href="https://github.com/duhthehomie/opti-gods/releases/latest"
                    target="_blank" rel="noopener noreferrer"
                    data-testid="link-graphics-pack-download"
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download from GitHub Releases
                    <ChevronRight className="w-3 h-3 opacity-60" />
                  </a>
                </div>
              </div>

              {/* Coming soon */}
              <div className="rounded-2xl border border-dashed border-white/10 bg-zinc-900/20 p-5 flex flex-col items-center justify-center text-center gap-3 group hover:border-white/20 transition-all">
                <div className="w-12 h-12 rounded-2xl bg-white/3 border border-white/8 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-zinc-500 group-hover:text-zinc-400 transition-colors" />
                </div>
                <div>
                  <p className="text-sm font-bold text-zinc-400">More packs coming soon</p>
                  <p className="text-xs text-zinc-600 mt-0.5">Warm sunset · Night city · Foggy RP · High-end cinematic</p>
                </div>
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
              <div className="space-y-5">

                {/* Visuals */}
                <div className="rounded-2xl border border-white/8 bg-zinc-900/60 p-6 space-y-6">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-2 block">Pack Name</label>
                    <input
                      type="text" value={packName} onChange={e => setPackName(e.target.value)}
                      placeholder="My Blue Sky Pack" data-testid="input-pack-name"
                      className="w-full bg-zinc-900 border border-white/10 focus:border-red-500/40 rounded-xl px-4 py-2.5 text-white text-sm font-semibold outline-none transition-colors"
                    />
                  </div>
                  <SliderRow icon={Cloud} label="Cloud Thickness"
                    sublabel="How thick/dense the cloud coverage is"
                    value={cloudThickness} onChange={setCloudThickness}
                    color="red" leftLabel="Clear sky (0 clouds)" rightLabel="Full overcast" />
                  <SliderRow icon={Wind} label="Jet Streams"
                    sublabel="Aircraft contrail / vapour trail visibility"
                    value={jetStreams} onChange={setJetStreams}
                    color="cyan" leftLabel="None" rightLabel="Full" />
                  <SliderRow icon={Palette} label="Blue Depth"
                    sublabel="Sky colour — dark navy to vivid sky blue"
                    value={blueDepth} onChange={setBlueDepth}
                    color="blue" leftLabel="Dark navy" rightLabel="Vivid sky" />
                  <ToggleRow icon={Eye} label="Keep Props" on={keepProps} onToggle={() => setKeepProps(v => !v)}
                    sub="Full world props — recommended for max FPS w/ visuals" testId="toggle-keep-props" />
                </div>

                {/* Weather control */}
                <div className="rounded-2xl border border-white/8 bg-zinc-900/60 p-6 space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-3">Weather Control</p>
                  <ToggleRow icon={Sun} label="Freeze all weather to clear"
                    sub="Forces EXTRASUNNY sky on every weather state — max FPS, no cloud draw calls"
                    on={freezeWeather} onToggle={() => setFreezeWeather(v => !v)}
                    testId="toggle-freeze-weather" color="amber"
                    warn="Overrides cloud thickness and jet streams — all weather will look clear." />
                  <ToggleRow icon={CloudRain} label="Disable rain & thunder"
                    sub="Removes rain particles and thunder effects — FPS boost during rain events"
                    on={disableRain} onToggle={() => setDisableRain(v => !v)}
                    testId="toggle-disable-rain" color="cyan" />
                  <ToggleRow icon={Snowflake} label="Disable snow & blizzard"
                    sub="Removes snow particle draw on SNOW / BLIZZARD / XMAS weather states"
                    on={disableSnow} onToggle={() => setDisableSnow(v => !v)}
                    testId="toggle-disable-snow" color="cyan" />
                </div>

                {/* Time freeze */}
                <div className="rounded-2xl border border-white/8 bg-zinc-900/60 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-white/3 border border-white/8 flex items-center justify-center">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white leading-tight">Freeze Time</p>
                        <p className="text-[10px] text-zinc-500">Lock the in-game clock — prevents FPS dips from sun angle changes</p>
                      </div>
                    </div>
                    <Toggle on={freezeTime} onToggle={() => setFreezeTime(v => !v)} testId="toggle-freeze-time" />
                  </div>

                  <AnimatePresence>
                    {freezeTime && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-2 space-y-3">
                          <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl px-4 py-3">
                            <p className="text-[10px] text-amber-300/80 leading-relaxed">
                              <span className="font-bold text-amber-300">How it works:</span> A FiveM Lua resource (<span className="font-mono">optigods-timecycle</span>) is included in the ZIP.
                              Drop it in your server's <span className="font-mono">resources</span> folder and add <span className="font-mono">start optigods-timecycle</span> to <span className="font-mono">server.cfg</span>.
                              The script calls <span className="font-mono">NetworkOverrideClockTime</span> every second — no mods needed.
                            </p>
                          </div>
                          <div>
                            <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-2 block">
                              Lock clock at hour — {String(freezeHour).padStart(2,"0")}:00
                            </label>
                            <Slider
                              value={[freezeHour]} onValueChange={([v]) => setFreezeHour(v)}
                              min={0} max={23} step={1} className="w-full"
                              data-testid="slider-freeze-hour"
                            />
                            <div className="flex justify-between mt-1">
                              <span className="text-[9px] text-zinc-600">Midnight (00:00)</span>
                              <span className="text-[9px] text-zinc-600">Noon (12:00)</span>
                              <span className="text-[9px] text-zinc-600">Night (23:00)</span>
                            </div>
                            <p className="text-[10px] text-zinc-500 mt-2">
                              Recommended: <span className="text-white font-semibold">12:00</span> (noon — stable bright lighting, no shadow movement cost)
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
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
                    { label: "Clouds",       value: freezeWeather ? "Frozen clear" : cloudThickness === 0 ? "Disabled (max FPS)" : `${cloudThickness}% density`, ok: cloudThickness < 30 || freezeWeather },
                    { label: "Jet Streams",  value: freezeWeather ? "Disabled" : jetStreams === 0 ? "Disabled" : `${jetStreams}% density`, ok: jetStreams === 0 || freezeWeather },
                    { label: "Sky Colour",   value: skyLabel(blueDepth), ok: true },
                    { label: "Rain",         value: freezeWeather ? "Frozen out" : disableRain ? "Disabled" : "Active",   ok: disableRain || freezeWeather },
                    { label: "Snow",         value: freezeWeather ? "Frozen out" : disableSnow ? "Disabled" : "Active",   ok: disableSnow || freezeWeather },
                    { label: "Time",         value: freezeTime ? `Locked at ${String(freezeHour).padStart(2,"0")}:00` : "Dynamic (changes)", ok: freezeTime },
                    { label: "Props",        value: keepProps ? "Full (recommended)" : "Reduced", ok: keepProps },
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
            <div className="flex items-center gap-2 mb-1">
              <Monitor className="w-4 h-4 text-red-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">ReShade Presets</h2>
              <span className="text-[9px] font-bold bg-red-500/15 text-red-400 border border-red-500/25 px-2 py-0.5 rounded-full uppercase ml-1">leaq's Collection</span>
            </div>

            {/* Install instructions */}
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.04] px-4 py-3 space-y-2">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-400 shrink-0" />
                <p className="text-xs font-bold text-blue-300">How to install ReShade presets</p>
              </div>
              <ol className="text-[11px] text-zinc-400 leading-relaxed space-y-1 ml-6 list-decimal">
                <li>Install <span className="text-white font-semibold">ReShade</span> from <span className="font-mono text-blue-300">reshade.me</span> — select FiveM's <span className="font-mono">FiveM.exe</span> as the target</li>
                <li>Download a preset <span className="font-mono">.ini</span> file below</li>
                <li>Open <span className="font-mono text-amber-300">%LOCALAPPDATA%\FiveM\FiveM Application Data\plugins\</span> (use the button above)</li>
                <li>Drop the <span className="font-mono">.ini</span> file into the <span className="font-mono">plugins</span> folder</li>
                <li>In-game: open ReShade overlay (<span className="font-mono">Home</span> key) → click the preset dropdown → select the file</li>
              </ol>
            </div>

            {/* Preset cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {RESHADE_PRESETS.map(preset => (
                <div key={preset.id}
                  className="rounded-2xl border border-white/8 bg-zinc-900/60 p-5 flex flex-col gap-3 hover:border-white/15 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-0.5">ReShade Preset</p>
                      <h3 className="text-sm font-display font-black text-white">{preset.label}</h3>
                    </div>
                    <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase shrink-0", preset.badgeCls)}>
                      {preset.badge}
                    </span>
                  </div>

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
                    className="flex items-center justify-center gap-2 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-white/8 hover:border-white/15 text-white text-xs font-bold transition-all mt-auto"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download {preset.name}.ini
                  </a>
                </div>
              ))}
            </div>

            {/* Performance note */}
            <div className="rounded-xl border border-white/5 bg-zinc-950/30 px-4 py-3 flex items-start gap-3">
              <Zap className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                ReShade runs post-process on top of the game — it has a small GPU cost. On a <span className="text-zinc-300">1650 Super</span>, all four presets stay under 3 ms GPU overhead at 1080p. If you're already CPU-bottlenecked in FiveM, ReShade adds near-zero latency.
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
