import { AppLayout } from "@/components/layout/app-layout";
import { RestartToBiosButton } from "@/components/restart-to-bios-button";
import { getScannedInfo } from "@/hooks/use-hardware-info";
import { useIsOwner } from "@/lib/owner";
import { AlertTriangle, Camera, CheckCircle2, Cpu, HardDriveDownload, Lock, Save } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Owner-only BIOS guide for the MSI PRO H610M-G WIFI + i5-14400F + RTX 5060
 * build (MSI Click BIOS 5, Advanced mode). Facts checked against MSI's board
 * specification: H610 has no memory overclocking, PCI_E1 is PCIe 4.0 x16 from
 * the CPU, M.2_1 is PCIe 3.0 x4 from the chipset.
 */

type Setting = {
  name: string;
  value: string;
  path: string;
  why: string;
  note?: string;
  impact: "Big" | "Medium" | "Small" | "Required";
};

const SETTINGS: Setting[] = [
  {
    name: "BIOS UEFI/CSM Mode",
    value: "UEFI",
    path: "Settings → Advanced → Windows OS Configuration → BIOS UEFI/CSM Mode",
    why: "Resizable BAR and Secure Boot only work in UEFI mode.",
    note: "Set this before installing Windows 10. Make the install USB with Microsoft's Media Creation Tool so Windows installs in UEFI (GPT) mode, or it won't boot with CSM off.",
    impact: "Required",
  },
  {
    name: "Above 4G memory / Crypto Currency mining + Re-Size BAR Support",
    value: "Enabled + Enabled",
    path: "Settings → Advanced → PCI Subsystem Settings",
    why: "Resizable BAR lets the CPU reach all 8 GB of the RTX 5060's video memory at once. Usually a few percent more FPS, more in some games.",
    note: "After Windows is set up, check NVIDIA Control Panel → System Information: \"Resizable BAR\" should say Yes.",
    impact: "Medium",
  },
  {
    name: "PCI_E1 link speed",
    value: "Auto (PCIe 4.0)",
    path: "Settings → Advanced → PCI Subsystem Settings → PCI_E1 / PEG link speed",
    why: "The RTX 5060 only uses 8 lanes. On PCIe 4.0 that's plenty; forced to Gen3 it gets half the bandwidth, which hurts 1% lows when video memory fills up.",
    note: "Your board's GPU slot is PCIe 4.0, so the card runs at PCIe 4.0 x8. That's normal.",
    impact: "Big",
  },
  {
    name: "DRAM Frequency",
    value: "Auto (about 4800 MHz)",
    path: "OC → DRAM Frequency",
    why: "The H610 chipset doesn't support memory overclocking, so XMP isn't available. Your 6000 MHz RAM runs at the i5-14400F's official 4800 MHz. Don't try to force 6000; it won't be stable.",
    note: "You have ONE 16 GB stick at 4800 MHz, so memory runs in single channel. That is the biggest FPS limit on this PC, especially in FiveM and GTA V. Adding a second matching DDR5 stick (another 16 GB is best, or 8 GB) in the other slot turns on dual channel, which roughly doubles memory bandwidth. No BIOS setting can replace it.",
    impact: "Big",
  },
  {
    name: "CPU Cooler Tuning (power limits)",
    value: "Boxed Cooler on the stock Intel cooler · Tower Air Cooler on a bigger cooler",
    path: "OC → CPU Cooler Tuning (or OC → Advanced CPU Configuration → Long/Short Duration Power Limit)",
    why: "Intel's default for the i5-14400F is 65 W sustained / 148 W boost. A higher limit holds boost clocks longer in CPU-heavy games.",
    note: "Optional. Only raise it with a tower cooler, and keep the CPU under 85 °C in games (check in Opti Gods → System Scan). The H610's power delivery is basic.",
    impact: "Small",
  },
  {
    name: "Intel Turbo Boost, Hyper-Threading, E-cores",
    value: "Enabled (leave default)",
    path: "OC → Advanced CPU Configuration",
    why: "Opti Gods pins FiveM to the 6 P-cores and Gaming Mode moves background apps aside, so the 4 E-cores handle Discord and your browser. Turning E-cores off costs more than it gains.",
    impact: "Required",
  },
  {
    name: "Intel C-States",
    value: "Auto (leave default)",
    path: "OC → Advanced CPU Configuration → Intel C-State",
    why: "Turning these off raises idle heat and power with no measurable FPS gain.",
    impact: "Small",
  },
  {
    name: "Security Device Support (TPM / Intel PTT) + Secure Boot",
    value: "Enabled + Enabled",
    path: "Settings → Security → Trusted Computing · Settings → Advanced → Windows OS Configuration → Secure Boot",
    why: "Anti-cheats in games like Valorant, Call of Duty and Battlefield 6 require these. Turning them off can block those games. They don't cost FPS.",
    impact: "Required",
  },
  {
    name: "Fan curves",
    value: "Smart Fan Mode, about 70% speed at 70 °C",
    path: "Hardware Monitor → CPU_FAN1 and SYS_FAN1",
    why: "Cooler parts hold their boost clocks longer.",
    note: "The board has one CPU fan header and one system fan header, so your 4 case fans most likely share SYS_FAN1 through a hub.",
    impact: "Small",
  },
  {
    name: "MSI Fast Boot",
    value: "Disabled",
    path: "Settings → Advanced → Windows OS Configuration → MSI Fast Boot",
    why: "No FPS effect. Leaving it off keeps the Delete key working to enter BIOS.",
    impact: "Small",
  },
];

const IMPACT_STYLE: Record<Setting["impact"], string> = {
  Big: "border-red-500/40 bg-red-500/15 text-red-300",
  Medium: "border-orange-500/40 bg-orange-500/10 text-orange-300",
  Small: "border-white/15 bg-white/5 text-zinc-300",
  Required: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
};

function Step({ n, icon: Icon, title, children }: { n: number; icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-white/10 bg-zinc-950/60 p-4" data-testid={`bios-step-${n}`}>
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs font-black text-white">{n}</span>
        <Icon className="h-4 w-4 text-red-400" />
        <h2 className="text-sm font-bold text-white">{title}</h2>
      </div>
      <div className="space-y-1.5 text-sm text-zinc-300">{children}</div>
    </section>
  );
}

export default function BiosPage() {
  const isOwner = useIsOwner();
  const scan = getScannedInfo();

  if (!isOwner) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-center" data-testid="bios-owner-only">
          <Lock className="h-8 w-8 text-zinc-500" />
          <p className="text-sm text-zinc-400">This page is only available to the Opti Gods owner.</p>
        </div>
      </AppLayout>
    );
  }

  const board = scan?.Motherboard?.trim();
  const boardMatches = !board || /h610/i.test(board);

  return (
    <AppLayout>
      <div className="flex min-h-full flex-col gap-4">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-3">
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-2"><Cpu className="h-5 w-5 text-red-400" /></div>
              <h1 className="font-display text-2xl font-bold text-white">BIOS Setup</h1>
              <span className="rounded border border-red-500/40 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-red-300">Owner only</span>
            </div>
            <p className="text-sm text-zinc-500">MSI PRO H610M-G WIFI · Intel i5-14400F · RTX 5060 · 16 GB DDR5 · MSI Click BIOS 5 (press F7 for Advanced mode)</p>
          </div>
          <RestartToBiosButton />
        </header>

        {scan && (
          <div className="flex flex-wrap gap-2 text-xs" data-testid="bios-detected">
            {board && <span className="rounded border border-white/10 bg-white/5 px-2 py-1 text-zinc-300">Board: {board}</span>}
            {scan.CPU && <span className="rounded border border-white/10 bg-white/5 px-2 py-1 text-zinc-300">CPU: {scan.CPU}</span>}
            {scan.RAM_MHz ? <span className="rounded border border-white/10 bg-white/5 px-2 py-1 text-zinc-300">RAM running at {scan.RAM_MHz} MHz</span> : null}
          </div>
        )}
        {!boardMatches && (
          <div className="flex items-start gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 p-3 text-xs text-orange-200" data-testid="bios-board-mismatch">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            This PC reports "{board}". The guide below is for the MSI PRO H610M-G WIFI build, so menu names on this PC will differ.
          </div>
        )}

        <Step n={1} icon={Camera} title="Screenshot your current BIOS before changing or resetting anything">
          <p>Take a picture of every page you'll change, so you can put anything back.</p>
          <p className="text-zinc-400">On MSI: plug in a USB stick formatted FAT32 and press <b className="text-white">F12</b> on each page. The BIOS saves a screenshot to the stick. Phone photos work too.</p>
          <p className="text-zinc-400">Then press <b className="text-white">F6</b> → Yes to load optimized defaults, so you start from a clean base.</p>
        </Step>

        <Step n={2} icon={HardDriveDownload} title="Update the BIOS first">
          <p>Download the newest BIOS for <b className="text-white">PRO H610M-G WIFI</b> from MSI's support page, unzip it to the FAT32 USB stick, then in BIOS open <b className="text-white">M-FLASH</b> and pick the file.</p>
          <p className="text-zinc-400">New BIOS versions include Intel's latest stability fixes for 13th/14th gen CPUs. Updating resets your settings, so do it before step 3. Don't turn the PC off while it flashes.</p>
        </Step>

        <section className="rounded-xl border border-white/10 bg-zinc-950/60 p-4" data-testid="bios-step-3">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs font-black text-white">3</span>
            <CheckCircle2 className="h-4 w-4 text-red-400" />
            <h2 className="text-sm font-bold text-white">Set these for max FPS</h2>
          </div>
          <div className="space-y-2">
            {SETTINGS.map(setting => (
              <div key={setting.name} className="rounded-lg border border-white/5 bg-black/40 p-3" data-testid={`bios-setting-${setting.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-white">{setting.name}</span>
                  <span className="text-zinc-500">→</span>
                  <span className="text-sm font-bold text-red-300">{setting.value}</span>
                  <span className={cn("ml-auto rounded border px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider", IMPACT_STYLE[setting.impact])}>
                    {setting.impact === "Required" ? "Keep / required" : `${setting.impact} impact`}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[11px] text-zinc-400">{setting.path}</p>
                <p className="mt-1 text-xs text-zinc-300">{setting.why}</p>
                {setting.note && <p className="mt-1 text-xs text-zinc-500">{setting.note}</p>}
              </div>
            ))}
          </div>
        </section>

        <Step n={4} icon={AlertTriangle} title="Good to know on this board">
          <p>Plug your monitors into the <b className="text-white">RTX 5060</b>, never the motherboard's HDMI, DisplayPort or VGA. The i5-14400F has no built-in graphics, so those ports stay dark.</p>
          <p className="text-zinc-400">The board's only M.2 slot is PCIe 3.0, so your WD SN3000 runs at 3.0 speed. That's normal, no setting changes it, and it doesn't affect FPS.</p>
        </Step>

        <Step n={5} icon={Save} title="Save and exit">
          <p>Press <b className="text-white">F10</b> → Yes. After Windows 10 is installed: install the NVIDIA driver, run the System Scan in Opti Gods, then Full Optimize.</p>
        </Step>
      </div>
    </AppLayout>
  );
}
