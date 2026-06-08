import { useState, useCallback } from "react";
import { zipSync, strToU8 } from "fflate";
import { AppLayout } from "@/components/layout/app-layout";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  Cloud, CloudOff, Wind, Palette, Package, Lock, Download,
  ExternalLink, CheckCircle2, Sparkles, ChevronRight, Info, Eye,
  FolderOpen, Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const GATE_KEY = "fg_unlocked_v1";
const GATE_CODE = "4258";

function isUnlocked(): boolean {
  try { return sessionStorage.getItem(GATE_KEY) === "1"; } catch { return false; }
}
function storeUnlocked() {
  try { sessionStorage.setItem(GATE_KEY, "1"); } catch {}
}

function lerp(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t);
}

function num(v: number, decimals = 6) {
  return v.toFixed(decimals);
}

function buildTimecycleXml(opts: {
  cloudThickness: number;
  jetStreams: number;
  blueDepth: number;
}): string {
  const c  = opts.cloudThickness / 100;
  const j  = opts.jetStreams      / 100;
  const b  = opts.blueDepth       / 100;

  const skyR = num(lerp(8,  30,  b) / 255);
  const skyG = num(lerp(15, 75,  b) / 255);
  const skyB = num(lerp(45, 200, b) / 255);

  const cloudVal = num(c);
  const jetVal   = num(j);

  const weatherTypes = [
    "EXTRASUNNY","CLEAR","NEUTRAL","SMOG","FOGGY",
    "OVERCAST","CLOUDS","CLEARING","RAIN","THUNDER",
    "BLIZZARD","SNOW","SNOWLIGHT","XMAS","HALLOWEEN",
  ];

  const mods = [
    ["cloudinessVal",   cloudVal, cloudVal],
    ["cloudHatLevel",   cloudVal, cloudVal],
    ["contrailDensity", jetVal,   jetVal],
    ["skyColour r",     skyR,     skyR],
    ["skyColour g",     skyG,     skyG],
    ["skyColour b",     skyB,     skyB],
  ];

  const items = weatherTypes.map(w => {
    const modEntries = mods.map(([kw, val, valEnd]) => [
      "        <Item>",
      `          <modKeyword>${kw}</modKeyword>`,
      `          <modValue>${val}</modValue>`,
      `          <modValueEnd>${valEnd}</modValueEnd>`,
      "        </Item>",
    ].join("\n")).join("\n");

    return [
      "    <Item>",
      `      <name>${w}</name>`,
      "      <mods>",
      modEntries,
      "      </mods>",
      "    </Item>",
    ].join("\n");
  }).join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<timecycle_mods_file>",
    "  <mods>",
    items,
    "  </mods>",
    "</timecycle_mods_file>",
    "",
  ].join("\n");
}

function buildWeatherXml(cloudThickness: number): string {
  const c = cloudThickness / 100;
  const cv = num(c, 4);

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
    const effective = Math.min(c, base + c * 0.2);
    const ev = num(effective, 4);
    return [
      `    <Item>`,
      `      <Name>${name}</Name>`,
      `      <cloudHatLevel value="${cv}" />`,
      `      <cloudiness value="${ev}" />`,
      `    </Item>`,
    ].join("\n");
  }).join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<CWeatherTypeList>",
    "  <WeatherTypes>",
    entries,
    "  </WeatherTypes>",
    "</CWeatherTypeList>",
    "",
  ].join("\n");
}

function buildReadme(opts: {
  packName: string;
  cloudThickness: number;
  jetStreams: number;
  blueDepth: number;
  keepProps: boolean;
}): string {
  const skyLabel =
    opts.blueDepth < 25 ? "Dark Navy" :
    opts.blueDepth < 50 ? "Deep Blue" :
    opts.blueDepth < 75 ? "Vivid Blue" : "Bright Cyan";

  return [
    `OPTI GODS — FiveM Graphics Pack`,
    `Pack Name  : ${opts.packName}`,
    `Generated  : ${new Date().toISOString().split("T")[0]}`,
    ``,
    `SETTINGS`,
    `  Cloud Thickness : ${opts.cloudThickness}%`,
    `  Jet Streams     : ${opts.jetStreams}%`,
    `  Sky Colour      : ${skyLabel} (${opts.blueDepth}%)`,
    `  Props           : ${opts.keepProps ? "Kept (full props)" : "Reduced"}`,
    ``,
    `INSTALL`,
    `  1. Extract this zip`,
    `  2. Open: %LOCALAPPDATA%\\FiveM\\FiveM Application Data\\`,
    `  3. DELETE the existing "citizen" folder inside that folder`,
    `  4. Drag the new "citizen" folder from the zip into that folder`,
    `  5. Restart FiveM completely`,
    ``,
    `UNINSTALL`,
    `  Open: %LOCALAPPDATA%\\FiveM\\FiveM Application Data\\`,
    `  Delete the entire "citizen" folder (or just remove:`,
    `    citizen\\platform\\data\\tune\\timecycle_mods_1.xml`,
    `    citizen\\common\\data\\weather.xml)`,
    `  Restart FiveM - stock visuals restore instantly.`,
    ``,
    `by leaq — optigods.com`,
  ].join("\r\n");
}

function generateZip(opts: {
  packName: string;
  cloudThickness: number;
  jetStreams: number;
  blueDepth: number;
  keepProps: boolean;
}): Uint8Array {
  const tcXml      = buildTimecycleXml(opts);
  const weatherXml = buildWeatherXml(opts.cloudThickness);
  const readme     = buildReadme(opts);

  return zipSync({
    "citizen/platform/data/tune/timecycle_mods_1.xml": strToU8(tcXml),
    "citizen/common/data/weather.xml":                  strToU8(weatherXml),
    "READ ME - How to install.txt":                     strToU8(readme),
  });
}

function downloadZip(data: Uint8Array, filename: string) {
  const blob = new Blob([data], { type: "application/zip" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function SliderRow({
  icon: Icon, label, sublabel, value, onChange, color = "red", leftLabel, rightLabel,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sublabel: string;
  value: number;
  onChange: (v: number) => void;
  color?: "red" | "blue" | "cyan" | "amber";
  leftLabel?: string;
  rightLabel?: string;
}) {
  const colorMap: Record<string, string> = {
    red: "text-red-400", blue: "text-blue-400", cyan: "text-cyan-400", amber: "text-amber-400",
  };
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
          value={[value]}
          onValueChange={([v]) => onChange(v)}
          min={0} max={100} step={1}
          className="w-full"
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

function CodeGate({ onUnlock }: { onUnlock: () => void }) {
  const [code, setCode]   = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const handleSubmit = () => {
    if (code.trim() === GATE_CODE) {
      storeUnlocked();
      onUnlock();
    } else {
      setError(true);
      setShake(true);
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
          autoFocus
          type="password"
          value={code}
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
        <Button
          onClick={handleSubmit}
          data-testid="button-graphics-unlock"
          className="w-full bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl py-2.5"
        >
          Unlock
        </Button>
      </motion.div>
    </div>
  );
}

export default function FivemGraphics() {
  const [unlocked, setUnlockedState] = useState(isUnlocked);
  const [cloudThickness, setCloudThickness] = useState(0);
  const [jetStreams,      setJetStreams]      = useState(0);
  const [blueDepth,       setBlueDepth]       = useState(70);
  const [keepProps,       setKeepProps]       = useState(true);
  const [packName,        setPackName]        = useState("My Blue Sky Pack");
  const [generated,       setGenerated]       = useState(false);
  const [activeTab,       setActiveTab]       = useState<"packs" | "builder" | "info">("packs");

  const handleUnlock = useCallback(() => setUnlockedState(true), []);

  const handleGenerate = () => {
    const zip  = generateZip({ cloudThickness, jetStreams, blueDepth, keepProps, packName });
    const safe = packName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
    downloadZip(zip, `optigods-fivem-${safe}.zip`);
    setGenerated(true);
    setTimeout(() => setGenerated(false), 3000);
  };

  const blue = blueDepth / 100;
  const previewR = lerp(8,  30,  blue);
  const previewG = lerp(15, 75,  blue);
  const previewB = lerp(45, 200, blue);
  const previewRgb = `rgb(${previewR}, ${previewG}, ${previewB})`;

  const skyLabel =
    blueDepth < 25 ? "Dark Navy" :
    blueDepth < 50 ? "Deep Blue" :
    blueDepth < 75 ? "Vivid Blue" : "Bright Cyan";

  if (!unlocked) {
    return (
      <AppLayout>
        <CodeGate onUnlock={handleUnlock} />
      </AppLayout>
    );
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
            Build a custom graphics pack and download it as a citizen ZIP — same format as any FiveM graphics mod. Delete your old citizen folder, drag the new one in, done.
          </p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 border-b border-white/5 overflow-x-auto">
          {([
            { id: "packs",   label: "Pre-Made Packs",  icon: Package },
            { id: "builder", label: "Build Your Own",  icon: Palette },
            { id: "info",    label: "How It Works",    icon: Info    },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              data-testid={`tab-fivem-${id}`}
              onClick={() => setActiveTab(id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px shrink-0",
                activeTab === id ? "text-red-400 border-red-500" : "text-zinc-500 border-transparent hover:text-zinc-300"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Install instructions — shown on packs + builder tabs */}
        {activeTab !== "info" && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 flex items-start gap-3">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-300/80 leading-relaxed">
            <span className="font-bold text-amber-300">How to install: </span>
            Extract the ZIP → open{" "}
            <span className="font-mono text-amber-400/90">%LOCALAPPDATA%\FiveM\FiveM Application Data\</span>
            {" "}→ <span className="font-bold text-amber-300">delete</span> the existing <span className="font-mono font-bold text-amber-300">citizen</span> folder →{" "}
            drag the new <span className="font-mono font-bold text-amber-300">citizen</span> folder in → restart FiveM.
          </div>
        </div>
        )}

        {/* Pre-made pack */}
        {activeTab === "packs" && (<section>
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-4 h-4 text-red-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Pre-Made Pack</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-white/8 bg-gradient-to-br from-zinc-900/80 to-black p-5 relative overflow-hidden group hover:border-red-500/30 transition-all">
              <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity"
                style={{ background: "radial-gradient(ellipse at top left, rgb(20,60,180) 0%, transparent 70%)" }}
              />
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
                  The exact pack leaq runs daily on his GTX 1650 Super + Ryzen 5 3500.
                  All-clear blue sky, zero clouds, zero contrails — big FPS gain on low-to-mid GPU builds.
                </p>
                <a
                  href="https://www.mediafire.com/folder/mpqxu65z0h3zz/citizen"
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="link-mediafire-download"
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download from MediaFire
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </a>
              </div>
            </div>

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
        </section>)}

        {/* Custom Pack Maker */}
        {activeTab === "builder" && (<section>
          <div className="flex items-center gap-2 mb-4">
            <Palette className="w-4 h-4 text-red-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Custom Pack Maker</h2>
            <span className="text-[9px] font-bold bg-red-500/15 text-red-400 border border-red-500/25 px-2 py-0.5 rounded-full uppercase ml-1">Builder</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Controls */}
            <div className="rounded-2xl border border-white/8 bg-zinc-900/60 p-6 space-y-6">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-2 block">Pack Name</label>
                <input
                  type="text"
                  value={packName}
                  onChange={e => setPackName(e.target.value)}
                  placeholder="My Blue Sky Pack"
                  data-testid="input-pack-name"
                  className="w-full bg-zinc-900 border border-white/10 focus:border-red-500/40 rounded-xl px-4 py-2.5 text-white text-sm font-semibold outline-none transition-colors"
                />
              </div>

              <SliderRow
                icon={Cloud} label="Cloud Thickness"
                sublabel="How thick/dense the cloud coverage is"
                value={cloudThickness} onChange={setCloudThickness}
                color="red" leftLabel="Clear sky (0 clouds)" rightLabel="Full overcast"
              />
              <SliderRow
                icon={Wind} label="Jet Streams"
                sublabel="Aircraft contrail / vapour trail visibility"
                value={jetStreams} onChange={setJetStreams}
                color="cyan" leftLabel="None" rightLabel="Full"
              />
              <SliderRow
                icon={Palette} label="Blue Depth"
                sublabel="Sky colour — dark navy to vivid sky blue"
                value={blueDepth} onChange={setBlueDepth}
                color="blue" leftLabel="Dark navy" rightLabel="Vivid sky"
              />

              {/* Props toggle */}
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-white/3 border border-white/8 flex items-center justify-center">
                    <Eye className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white leading-tight">Keep Props</p>
                    <p className="text-[10px] text-zinc-500">Full world props — recommended for max FPS w/ visuals</p>
                  </div>
                </div>
                <button
                  onClick={() => setKeepProps(v => !v)}
                  data-testid="toggle-keep-props"
                  className={cn(
                    "w-11 h-6 rounded-full border transition-all relative shrink-0",
                    keepProps ? "bg-red-500/30 border-red-500/50" : "bg-zinc-800 border-white/10"
                  )}
                >
                  <span className={cn(
                    "absolute top-0.5 w-5 h-5 rounded-full transition-all",
                    keepProps ? "left-5 bg-red-400" : "left-0.5 bg-zinc-600"
                  )} />
                </button>
              </div>
            </div>

            {/* Preview + download */}
            <div className="flex flex-col gap-4">

              {/* Sky preview */}
              <div
                className="rounded-2xl border border-white/8 overflow-hidden h-48 relative flex items-end"
                style={{
                  background: `linear-gradient(to bottom, ${previewRgb} 0%, rgba(${previewR - 6},${previewG - 10},${previewB - 15},0.85) 55%, rgb(18,18,22) 100%)`,
                }}
              >
                {cloudThickness > 5 && (
                  <div className="absolute inset-0 flex items-start justify-center pt-5 gap-5 pointer-events-none"
                    style={{ opacity: Math.min(cloudThickness / 100, 0.92) }}
                  >
                    {[...Array(Math.min(Math.ceil(cloudThickness / 26), 4))].map((_, i) => (
                      <div key={i} className="bg-white/40 rounded-full blur-md"
                        style={{ width: `${60 + i * 20}px`, height: `${20 + i * 8}px`, marginTop: `${i * 6}px` }}
                      />
                    ))}
                  </div>
                )}
                {jetStreams > 5 && (
                  <div className="absolute top-8 left-0 right-0 flex justify-center pointer-events-none"
                    style={{ opacity: jetStreams / 100 * 0.6 }}
                  >
                    <div className="w-3/5 h-px bg-white/80 blur-[1px]" />
                  </div>
                )}
                <div className="relative px-4 pb-3 w-full">
                  <div className="bg-black/50 backdrop-blur-sm rounded-lg px-3 py-1.5 inline-flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] font-bold text-white">Live preview · FiveM sky</span>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="rounded-2xl border border-white/8 bg-zinc-900/60 p-4 space-y-2.5">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Pack Summary</p>
                {[
                  { label: "Clouds",       value: cloudThickness === 0 ? "Disabled (max FPS)" : `${cloudThickness}% density`, ok: cloudThickness < 30 },
                  { label: "Jet Streams",  value: jetStreams      === 0 ? "Disabled" : `${jetStreams}% density`,             ok: jetStreams === 0 },
                  { label: "Sky Colour",   value: skyLabel,                                                                   ok: true },
                  { label: "Props",        value: keepProps ? "Full (recommended)" : "Reduced",                               ok: keepProps },
                  { label: "Output",       value: "citizen ZIP → delete old → drag in new",                               ok: true },
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

              {/* ZIP contents preview */}
              <div className="rounded-2xl border border-white/8 bg-zinc-900/40 p-4">
                <div className="flex items-center gap-2 mb-2.5">
                  <FolderOpen className="w-3.5 h-3.5 text-zinc-400" />
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">ZIP Contents</p>
                </div>
                <div className="space-y-1 font-mono text-[10px]">
                  <div className="flex items-center gap-2 text-zinc-300">
                    <Layers className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>citizen/</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-400 pl-4">
                    <Layers className="w-3 h-3 text-zinc-600 shrink-0" />
                    <span>platform/data/tune/timecycle_mods_1.xml</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-400 pl-4">
                    <Layers className="w-3 h-3 text-zinc-600 shrink-0" />
                    <span>common/data/weather.xml</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-500 mt-1">
                    <Layers className="w-3 h-3 text-zinc-700 shrink-0" />
                    <span>READ ME - How to install.txt</span>
                  </div>
                </div>
              </div>

              {/* Generate button */}
              <Button
                onClick={handleGenerate}
                data-testid="button-generate-pack"
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
        </section>)}

        {/* Info footer */}
        {activeTab === "info" && (<section className="rounded-2xl border border-white/5 bg-zinc-900/30 p-5">
          <div className="flex items-center gap-2 mb-3">
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
              <p><span className="font-mono text-zinc-400">timecycle_mods_1.xml</span> overrides sky colour and cloud density. <span className="font-mono text-zinc-400">weather.xml</span> controls cloud hat levels per weather state.</p>
            </div>
            <div>
              <p className="font-semibold text-zinc-300 mb-1">To uninstall</p>
              <p>Open <span className="font-mono text-zinc-400">FiveM Application Data\</span> and delete the <span className="font-mono text-zinc-400">citizen</span> folder entirely, or remove just the two XML files. Restart FiveM — stock visuals restore instantly.</p>
            </div>
          </div>
        </section>)}

      </div>
    </AppLayout>
  );
}
