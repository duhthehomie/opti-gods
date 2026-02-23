import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { ShieldAlert, Zap, Cpu, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  return (
    <AppLayout>
      <div className="space-y-8 pb-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative rounded-2xl overflow-hidden winui-panel p-8 md:p-12 border-l-4 border-l-red-500"
        >
          <div className="absolute right-0 top-0 w-1/2 h-full bg-gradient-to-l from-red-500/10 to-transparent pointer-events-none"></div>
          
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono mb-6">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
              SYSTEM DETECTED
            </div>
            <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-4 leading-tight">
              Ultimate PC Optimizer
            </h1>
            <p className="text-lg text-zinc-400 mb-8 leading-relaxed">
              Opti Gods goes deep into the registry to maximize framerates, minimize input latency, and debloat your operating system safely.
            </p>
            <div className="flex gap-4">
              <Button variant="outline" className="border-white/10 hover:bg-white/5 hover:text-white text-zinc-300 font-medium">
                <ShieldAlert className="w-4 h-4 mr-2" />
                Create Restore Point
              </Button>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard 
            title="System Active" 
            value="Windows 11 Pro" 
            subtitle="Build 22631.3296"
            icon={<HardDrive className="w-5 h-5 text-zinc-400" />}
            delay={0.1}
          />
          <StatCard 
            title="Active Processes" 
            value="142" 
            subtitle="32 High Impact"
            icon={<Cpu className="w-5 h-5 text-red-400" />}
            delay={0.2}
          />
          <StatCard 
            title="Optimization Level" 
            value="Low" 
            subtitle="Tweaks required"
            icon={<Zap className="w-5 h-5 text-yellow-500" />}
            delay={0.3}
          />
        </div>
      </div>
    </AppLayout>
  );
}

function StatCard({ title, value, subtitle, icon, delay }: { title: string, value: string, subtitle: string, icon: React.ReactNode, delay: number }) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay }}
      className="p-6 rounded-xl bg-black/40 border border-white/5 hover:border-white/10 transition-colors flex flex-col"
    >
      <div className="flex justify-between items-start mb-4">
        <p className="text-sm font-medium text-zinc-400">{title}</p>
        {icon}
      </div>
      <div className="mt-auto">
        <h3 className="text-2xl font-bold text-white mb-1">{value}</h3>
        <p className="text-xs text-zinc-500">{subtitle}</p>
      </div>
    </motion.div>
  );
}
