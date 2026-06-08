import { useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  Cloud, CloudOff, Wind, Palette, Package, Lock, Download,
  ExternalLink, CheckCircle2, Sparkles, ChevronRight, Info, Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const GATE_KEY = "fg_unlocked_v1";
const GATE_CODE = "4258";
const GFX_MARKER = "##OPTIGODS_GFX_PS1_START##";

function isUnlocked(): boolean {
  try { return sessionStorage.getItem(GATE_KEY) === "1"; } catch { return false; }
}
function storeUnlocked() {
  try { sessionStorage.setItem(GATE_KEY, "1"); } catch {}
}

function lerp(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t);
}

function buildPs1(opts: {
  cloudThickness: number;
  jetStreams: number;
  blueDepth: number;
  keepProps: boolean;
  packName: string;
}): string {
  const cloud = (opts.cloudThickness / 100).toFixed(6);
  const jet   = (opts.jetStreams   / 100).toFixed(6);
  const blue  = opts.blueDepth / 100;

  const skyR = (lerp(8,  30,  blue) / 255).toFixed(6);
  const skyG = (lerp(15, 75,  blue) / 255).toFixed(6);
  const skyB = (lerp(45, 200, blue) / 255).toFixed(6);

  const weatherTypes = [
    "EXTRASUNNY","CLEAR","NEUTRAL","SMOG","FOGGY","OVERCAST",
    "CLOUDS","CLEARING","RAIN","THUNDER","BLIZZARD","SNOW",
    "SNOWLIGHT","XMAS","HALLOWEEN",
  ];

  const tcItems = weatherTypes.map(w => [
    "    <Item>",
    `      <name>${w}</name>`,
    "      <mods>",
    "        <Item>",
    "          <modKeyword>cloudinessVal</modKeyword>",
    `          <modValue>${cloud}</modValue>`,
    `          <modValueEnd>${cloud}</modValueEnd>`,
    "        </Item>",
    "        <Item>",
    "          <modKeyword>cloudHatLevel</modKeyword>",
    `          <modValue>${cloud}</modValue>`,
    `          <modValueEnd>${cloud}</modValueEnd>`,
    "        </Item>",
    "        <Item>",
    "          <modKeyword>contrailDensity</modKeyword>",
    `          <modValue>${jet}</modValue>`,
    `          <modValueEnd>${jet}</modValueEnd>`,
    "        </Item>",
    "        <Item>",
    "          <modKeyword>skyColour r</modKeyword>",
    `          <modValue>${skyR}</modValue>`,
    `          <modValueEnd>${skyR}</modValueEnd>`,
    "        </Item>",
    "        <Item>",
    "          <modKeyword>skyColour g</modKeyword>",
    `          <modValue>${skyG}</modValue>`,
    `          <modValueEnd>${skyG}</modValueEnd>`,
    "        </Item>",
    "        <Item>",
    "          <modKeyword>skyColour b</modKeyword>",
    `          <modValue>${skyB}</modValue>`,
    `          <modValueEnd>${skyB}</modValueEnd>`,
    "        </Item>",
    "      </mods>",
    "    </Item>",
  ].join("\r\n")).join("\r\n");

  const tcXml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<timecycle_mods_file>",
    "  <mods>",
    tcItems,
    "  </mods>",
    "</timecycle_mods_file>",
  ].join("\r\n");

  const escapedName = opts.packName.replace(/'/g, "''");
  const escapedXml  = tcXml.replace(/'/g, "''");

  return [
    "$ErrorActionPreference = 'Stop'",
    "Write-Host ''",
    "Write-Host '  [Opti Gods] FiveM Graphics Pack Installer' -ForegroundColor Red",
    `Write-Host '  Pack: ${escapedName}' -ForegroundColor White`,
    "Write-Host ''",
    `$fivemBase = Join-Path $env:LOCALAPPDATA 'FiveM\\FiveM Application Data'`,
    "if (-not (Test-Path $fivemBase)) {",
    "  Write-Host '  [!] FiveM Application Data not found.' -ForegroundColor Yellow",
    "  Write-Host \"      Expected: $fivemBase\" -ForegroundColor Gray",
    "  Write-Host '  [!] Run FiveM at least once before installing a pack.' -ForegroundColor Yellow",
    "  Read-Host '  Press Enter to exit'",
    "  exit 1",
    "}",
    `$tunePath = Join-Path $fivemBase 'citizen\\platform\\data\\tune'`,
    `$tcFile   = Join-Path $tunePath 'timecycle_mods_1.xml'`,
    "Write-Host '  [+] Creating folder structure...' -ForegroundColor Gray",
    "New-Item -ItemType Directory -Force -Path $tunePath | Out-Null",
    "Write-Host '  [+] Writing timecycle_mods_1.xml...' -ForegroundColor Gray",
    `$xml = '${escapedXml}'`,
    "[System.IO.File]::WriteAllText($tcFile, $xml, [System.Text.Encoding]::UTF8)",
    "Write-Host ''",
    "Write-Host '  [OK] Pack installed successfully!' -ForegroundColor Green",
    "Write-Host ''",
    "Write-Host '  Settings applied:' -ForegroundColor White",
    `Write-Host '    Clouds      : ${opts.cloudThickness}%' -ForegroundColor Cyan`,
    `Write-Host '    Jet Streams : ${opts.jetStreams}%' -ForegroundColor Cyan`,
    `Write-Host '    Blue Depth  : ${opts.blueDepth}%' -ForegroundColor Cyan`,
    `Write-Host '    Props       : ${opts.keepProps ? "Kept" : "Reduced"}' -ForegroundColor Cyan`,
    "Write-Host ''",
    "Write-Host '  Installed to:' -ForegroundColor Gray",
    "Write-Host \"    $tcFile\" -ForegroundColor Gray",
    "Write-Host ''",
    "Write-Host '  Restart FiveM completely for changes to take effect.' -ForegroundColor Yellow",
    "Write-Host ''",
    "Read-Host '  Press Enter to close'",
  ].join("\r\n");
}

function buildPs1Prepack(): string {
  return [
    "Write-Host ''",
    "Write-Host '  [Opti Gods] Blue Sky No-Clouds Pack v1' -ForegroundColor Red",
    "Write-Host '  by leaq - optimised for GTX 1650 Super' -ForegroundColor Gray",
    "Write-Host ''",
    "$url = 'https://www.mediafire.com/folder/mpqxu65z0h3zz/citizen'",
    "Write-Host '  [>] Opening MediaFire download page...' -ForegroundColor Yellow",
    "Start-Process $url",
    "Write-Host ''",
    "Write-Host '  After downloading:' -ForegroundColor White",
    "Write-Host '  1. Extract the zip' -ForegroundColor Gray",
    "Write-Host '  2. Copy the citizen folder to:' -ForegroundColor Gray",
    "Write-Host '     %LOCALAPPDATA%\\FiveM\\FiveM Application Data\\' -ForegroundColor Cyan",
    "Write-Host '  3. Merge / overwrite if prompted' -ForegroundColor Gray",
    "Write-Host '  4. Restart FiveM completely' -ForegroundColor Gray",
    "Write-Host ''",
    "Read-Host '  Press Enter to close'",
  ].join("\r\n");
}

function wrapInBat(ps1: string, title: string, tmpName: string): string {
  const marker = GFX_MARKER;
  const batHeader = [
    "@echo off",
    `title ${title}`,
    "color 0C",
    "setlocal",
    "set SELF=%~f0",
    `set TMPPS1=%TEMP%\\${tmpName}.ps1`,
    `PowerShell -NoProfile -ExecutionPolicy Bypass -Command "$c=[IO.File]::ReadAllText($env:SELF,[Text.Encoding]::UTF8);$m='${marker}';$i=$c.IndexOf($m);if($i -ge 0){[IO.File]::WriteAllText($env:TMPPS1,$c.Substring($i+$m.Length),[Text.Encoding]::UTF8)}"`,
    `PowerShell -NoProfile -Command "try { Start-Process powershell.exe -Verb RunAs -Wait -ArgumentList ('-NoProfile -ExecutionPolicy Bypass -File '+[char]34+$env:TMPPS1+[char]34) } catch { Write-Host ('UAC cancelled: '+$_) -ForegroundColor Red; Read-Host 'Press Enter to close' }"`,
    `del "%TMPPS1%" 2>nul`,
    "endlocal",
    "exit /b",
    marker,
  ].join("\r\n");
  return batHeader + "\r\n" + ps1;
}

function downloadBat(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain" });
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

  const handleUnlock = useCallback(() => setUnlockedState(true), []);

  const handleGenerate = () => {
    const ps1 = buildPs1({ cloudThickness, jetStreams, blueDepth, keepProps, packName });
    const safe = packName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
    const bat  = wrapInBat(ps1, `Opti Gods - ${packName}`, `OptiGods-GFX-${safe}`);
    downloadBat(bat, `optigods-fivem-${safe}.bat`);
    setGenerated(true);
    setTimeout(() => setGenerated(false), 3000);
  };

  const handlePrepackDownload = () => {
    const ps1 = buildPs1Prepack();
    const bat  = wrapInBat(ps1, "Opti Gods - Blue Sky Pack", "OptiGods-BluePack");
    downloadBat(bat, "optigods-fivem-blue-pack.bat");
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
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">

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
            Download pre-made optimised sky packs or build your own custom configuration and install it with one click.
          </p>
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 flex items-start gap-3">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300/80 leading-relaxed">
            <span className="font-bold text-amber-300">Install location: </span>
            <span className="font-mono text-amber-400/90">%LOCALAPPDATA%\FiveM\FiveM Application Data\</span>
            {" "}— copy the <span className="font-mono font-bold">citizen</span> folder here and merge when prompted.
            Always restart FiveM completely after installing.
          </p>
        </div>

        <section>
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-4 h-4 text-red-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Pre-Made Packs</h2>
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
                  The exact pack leaq runs daily on his GTX 1650 Super + Ryzen 5 3500 rig.
                  All-clear blue sky, zero clouds, zero contrails — big FPS gain on low-to-mid GPU builds.
                </p>
                <div className="flex gap-2">
                  <a
                    href="https://www.mediafire.com/folder/mpqxu65z0h3zz/citizen"
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="link-mediafire-download"
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download from MediaFire
                    <ExternalLink className="w-3 h-3 opacity-60" />
                  </a>
                  <button
                    onClick={handlePrepackDownload}
                    data-testid="button-prepack-bat"
                    title="Download .bat installer (opens MediaFire + shows install steps)"
                    className="px-3 py-2.5 rounded-xl border border-white/10 bg-white/3 hover:bg-white/8 text-zinc-400 hover:text-white transition-all"
                  >
                    <Package className="w-3.5 h-3.5" />
                  </button>
                </div>
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
        </section>

        <section>
          <div className="flex items-center gap-2 mb-4">
            <Palette className="w-4 h-4 text-red-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Custom Pack Maker</h2>
            <span className="text-[9px] font-bold bg-red-500/15 text-red-400 border border-red-500/25 px-2 py-0.5 rounded-full uppercase ml-1">Builder</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
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
                sublabel="Opacity and density of cloud coverage"
                value={cloudThickness} onChange={setCloudThickness}
                color="red" leftLabel="Clear sky" rightLabel="Full overcast"
              />
              <SliderRow
                icon={Wind} label="Jet Streams"
                sublabel="Aircraft contrail / vapour trail density"
                value={jetStreams} onChange={setJetStreams}
                color="cyan" leftLabel="None" rightLabel="Full"
              />
              <SliderRow
                icon={Palette} label="Blue Depth"
                sublabel="Sky colour — dark navy to vivid sky blue"
                value={blueDepth} onChange={setBlueDepth}
                color="blue" leftLabel="Dark navy" rightLabel="Vivid sky"
              />

              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-white/3 border border-white/8 flex items-center justify-center">
                    <Eye className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white leading-tight">Keep Props</p>
                    <p className="text-[10px] text-zinc-500">Preserve street props & objects</p>
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

            <div className="flex flex-col gap-4">
              <div
                className="rounded-2xl border border-white/8 overflow-hidden h-44 relative flex items-end"
                style={{
                  background: `linear-gradient(to bottom, ${previewRgb} 0%, rgba(${previewR - 8},${previewG - 12},${previewB - 20},0.8) 55%, rgb(18,18,22) 100%)`,
                }}
              >
                {cloudThickness > 5 && (
                  <div className="absolute inset-0 flex items-start justify-center pt-4 gap-6 pointer-events-none"
                    style={{ opacity: Math.min(cloudThickness / 100, 0.9) }}
                  >
                    {[...Array(Math.min(Math.ceil(cloudThickness / 28), 4))].map((_, i) => (
                      <div key={i} className="bg-white/35 rounded-full blur-md"
                        style={{ width: `${55 + i * 18}px`, height: `${18 + i * 7}px`, marginTop: `${i * 5}px` }}
                      />
                    ))}
                  </div>
                )}
                {jetStreams > 5 && (
                  <div className="absolute top-8 left-0 right-0 flex justify-center pointer-events-none"
                    style={{ opacity: jetStreams / 100 * 0.55 }}
                  >
                    <div className="w-2/3 h-px bg-white/70 blur-[1px]" />
                  </div>
                )}
                <div className="relative px-4 pb-3 w-full">
                  <div className="bg-black/45 backdrop-blur-sm rounded-lg px-3 py-1.5 inline-flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] font-bold text-white">Live preview · FiveM sky</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/8 bg-zinc-900/60 p-4 space-y-2.5">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Pack Summary</p>
                {[
                  { label: "Clouds",      value: cloudThickness === 0 ? "Disabled" : `${cloudThickness}% coverage`, ok: cloudThickness < 30 },
                  { label: "Jet Streams", value: jetStreams === 0 ? "Disabled" : `${jetStreams}% density`, ok: jetStreams === 0 },
                  { label: "Sky Colour",  value: skyLabel, ok: true },
                  { label: "Props",       value: keepProps ? "Kept (recommended)" : "Reduced", ok: keepProps },
                  { label: "File",        value: "citizen/platform/data/tune/timecycle_mods_1.xml", ok: true },
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
                      <CheckCircle2 className="w-4 h-4" /> Downloading…
                    </motion.span>
                  ) : (
                    <motion.span key="gen"
                      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                      className="flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Generate &amp; Download Pack
                      <ChevronRight className="w-4 h-4 opacity-60" />
                    </motion.span>
                  )}
                </AnimatePresence>
              </Button>

              <div className="rounded-xl border border-white/5 bg-zinc-900/40 px-4 py-3">
                <p className="text-[10px] text-zinc-500 leading-relaxed">
                  <span className="text-zinc-400 font-semibold">To install:</span>{" "}
                  Run the <span className="font-mono text-zinc-300">.bat</span> as Administrator — it auto-detects
                  your FiveM path and writes the pack directly into the correct folder.
                  No manual copying needed.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/5 bg-zinc-900/30 p-5">
          <div className="flex items-center gap-2 mb-3">
            <CloudOff className="w-4 h-4 text-zinc-400" />
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">About FiveM Graphics Packs</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-zinc-500 leading-relaxed">
            <div>
              <p className="font-semibold text-zinc-300 mb-1">What they do</p>
              <p>Override FiveM's sky, cloud and weather visuals via files in the <span className="font-mono text-zinc-400">citizen</span> folder — no mods menu or server permission needed.</p>
            </div>
            <div>
              <p className="font-semibold text-zinc-300 mb-1">File modified</p>
              <p><span className="font-mono text-zinc-400">citizen/platform/data/tune/timecycle_mods_1.xml</span> — controls cloud density, sky colour, and contrail visibility per weather state.</p>
            </div>
            <div>
              <p className="font-semibold text-zinc-300 mb-1">To uninstall</p>
              <p>Delete <span className="font-mono text-zinc-400">timecycle_mods_1.xml</span> from the tune folder and restart FiveM. Stock visuals restore instantly — nothing is permanently changed.</p>
            </div>
          </div>
        </section>

      </div>
    </AppLayout>
  );
}
