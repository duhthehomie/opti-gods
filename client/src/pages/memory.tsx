import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { TweakRow } from "@/components/tweak-row";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { MemoryStick, AlertTriangle, Info } from "lucide-react";

const INFO_CARDS = [
  { label: "What is RAM?", text: "Random Access Memory holds your running apps and game data. The more free RAM, the less Windows falls back to the pagefile on disk, which is much slower." },
  { label: "Pagefile Tips", text: "For gaming: set a fixed pagefile at 1x your RAM size (e.g. 16GB RAM → 16GB pagefile). This prevents Windows from resizing it mid-session, reducing disk stutters." },
  { label: "SSD vs HDD", text: "Most tweaks here are designed for SSDs/NVMe. If you still use a spinning HDD, leave Superfetch/SysMain enabled — it helps significantly on slow disks." },
];

export default function Memory() {
  const { tweaks, setTweak } = useOptimizationStore();

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl pb-10">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-8"
        >
          <div className="p-3 bg-zinc-900 rounded-lg border border-white/5">
            <MemoryStick className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">Memory Optimizer</h1>
            <p className="text-zinc-500 text-sm">Pagefile, RAM compression, working set, and virtual memory tweaks</p>
          </div>
        </motion.div>

        {/* Info banner */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-start gap-3 p-4 rounded-lg bg-zinc-900/80 border border-zinc-800 mb-6"
        >
          <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
          <p className="text-sm text-zinc-300">
            RAM tweaks are <strong className="text-white">hardware-dependent</strong>. Compression disable is only beneficial if you have <strong className="text-white">16GB+</strong>. Pagefile tweaks require a restart.
          </p>
        </motion.div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
          {INFO_CARDS.map((c, i) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="p-4 rounded-xl bg-black/40 border border-white/5"
            >
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-3.5 h-3.5 text-red-500 shrink-0" />
                <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wide">{c.label}</h3>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">{c.text}</p>
            </motion.div>
          ))}
        </div>

        <div className="space-y-8">

          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 mb-4 px-1">Pagefile & Virtual Memory</h2>
            <div className="space-y-3">
              {[
                {
                  id: "MemFixedPagefile",
                  title: "Set Fixed Pagefile Size (1.5x RAM)",
                  desc: "Sets a fixed min/max pagefile equal to 1.5x your installed RAM — prevents Windows from resizing it and causing disk stutter mid-game.",
                },
                {
                  id: "MemDisablePagefile",
                  title: "Disable Pagefile (32GB+ RAM Only)",
                  desc: "Completely disables the pagefile. Only safe if you have 32GB+ RAM. Eliminates pagefile I/O entirely.",
                },
                {
                  id: "MemClearPagefileShutdown",
                  title: "Clear Pagefile on Shutdown",
                  desc: "Wipes the pagefile when Windows shuts down — prevents stale data and marginal privacy benefit.",
                },
                {
                  id: "MemMovePagefileFast",
                  title: "Move Pagefile to Fastest Drive",
                  desc: "Points the pagefile to your NVMe/fastest drive so swap reads are as fast as possible if they do occur.",
                },
              ].map((item, i) => (
                <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                  checked={tweaks[item.id] || false} onCheckedChange={(v) => setTweak(item.id, v)} delay={i + 1} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 mb-4 px-1">RAM Compression & Caching</h2>
            <div className="space-y-3">
              {[
                {
                  id: "MemDisableCompression",
                  title: "Disable Memory Compression",
                  desc: "Stops Windows from compressing memory pages in RAM. Recommended for 16GB+ — removes CPU overhead from compression.",
                },
                {
                  id: "MemDisableSuperfetch",
                  title: "Disable Superfetch / SysMain",
                  desc: "Stops Windows pre-loading apps into RAM. Beneficial on SSD/NVMe where cold loads are already fast.",
                },
                {
                  id: "MemTrimStandbyList",
                  title: "Aggressive Standby List Trimming",
                  desc: "Forces Windows to release standby (cached) memory more aggressively to keep more RAM free for games.",
                },
                {
                  id: "MemDisableKernelPaging",
                  title: "Keep Kernel in RAM (Disable Paging)",
                  desc: "Forces the Windows kernel to always stay in RAM, never get paged to disk — reduces latency spikes.",
                },
                {
                  id: "MemSystemCacheBoost",
                  title: "Optimize System File Cache",
                  desc: "Adjusts the ratio between system file cache and application RAM usage in favor of running apps.",
                },
              ].map((item, i) => (
                <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                  checked={tweaks[item.id] || false} onCheckedChange={(v) => setTweak(item.id, v)} delay={i + 1} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 mb-4 px-1">Working Set & Process Memory</h2>
            <div className="space-y-3">
              {[
                {
                  id: "MemTrimOnMinimize",
                  title: "Trim Working Set on Window Minimize",
                  desc: "Reduces the private RAM footprint of any app the moment it is minimized — frees memory for the active game.",
                },
                {
                  id: "MemLargePageSupport",
                  title: "Enable Large Page Support",
                  desc: "Enables 2MB page granularity for apps that request it (DX12/Vulkan games) — reduces TLB misses on high-VRAM workloads.",
                },
                {
                  id: "MemSetWorkingSetSize",
                  title: "Increase Max Working Set Size",
                  desc: "Raises the per-process working set ceiling — prevents Windows from unnecessarily trimming game memory mid-session.",
                },
                {
                  id: "MemDisableHeapTermination",
                  title: "Disable Heap Termination on Corruption",
                  desc: "Prevents minor heap issues from instantly crashing a game process — allows more graceful recovery.",
                },
              ].map((item, i) => (
                <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                  checked={tweaks[item.id] || false} onCheckedChange={(v) => setTweak(item.id, v)} delay={i + 1} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 mb-4 px-1">VRAM & GPU Memory</h2>
            <div className="space-y-3">
              {[
                {
                  id: "MemGPUOptimize",
                  title: "Optimize GPU Virtual Address Space",
                  desc: "Increases GPU virtual address space allocation — reduces VRAM fragmentation in DX12/Vulkan titles.",
                },
                {
                  id: "MemDisableGPUPagefile",
                  title: "Disable GPU Paging to System RAM",
                  desc: "Prevents Windows from offloading VRAM overflow to system RAM via the GPU pagefile when possible.",
                },
                {
                  id: "MemGPUSchedulerTweak",
                  title: "GPU Memory Scheduler: Low Latency",
                  desc: "Sets the GPU memory scheduler to prefer lower latency over higher throughput — reduces frame time spikes.",
                },
              ].map((item, i) => (
                <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                  checked={tweaks[item.id] || false} onCheckedChange={(v) => setTweak(item.id, v)} delay={i + 1} />
              ))}
            </div>
          </section>

        </div>
      </div>
    </AppLayout>
  );
}
