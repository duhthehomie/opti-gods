import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get(api.system.stats.path, async (req, res) => {
    // Simulated system stats
    res.json({
      cpu: Math.floor(Math.random() * 30) + 10,
      gpu: Math.floor(Math.random() * 20) + 5,
      memory: Math.floor(Math.random() * 40) + 20,
      os: "Windows 10 Pro (22H2)",
      processCount: 84,
      highImpactCount: 12
    });
  });

  app.get(api.startup.list.path, async (req, res) => {
    const apps = await storage.getStartupApps();
    if (apps.length === 0) {
      // Seed initial startup apps if empty
      const initialApps = [
        { name: "Discord", path: "C:\\Users\\leaq\\AppData\\Local\\Discord\\Update.exe", isEnabled: true },
        { name: "Steam", path: "C:\\Program Files (x86)\\Steam\\steam.exe", isEnabled: true },
        { name: "Spotify", path: "C:\\Users\\leaq\\AppData\\Roaming\\Spotify\\Spotify.exe", isEnabled: false },
        { name: "OneDrive", path: "C:\\Windows\\System32\\OneDrive.exe", isEnabled: false },
        { name: "Opti Gods", path: "C:\\Users\\leaq\\Desktop\\OptiGods.exe", isEnabled: true },
      ];
      for (const app of initialApps) {
        await db.insert(startupApps).values(app);
      }
      return res.json(await storage.getStartupApps());
    }
    res.json(apps);
  });

  app.patch(api.startup.toggle.path, async (req, res) => {
    try {
      const { isEnabled } = api.startup.toggle.input.parse(req.body);
      const app = await storage.updateStartupApp(Number(req.params.id), isEnabled);
      res.json(app);
    } catch (err) {
      res.status(404).json({ message: "App not found" });
    }
  });

  app.delete(api.presets.delete.path, async (req, res) => {
    await storage.deletePreset(Number(req.params.id));
    res.json({ success: true });
  });

  app.post(api.presets.create.path, async (req, res) => {
    try {
      const input = api.presets.create.input.parse(req.body);
      const preset = await storage.createPreset(input);
      res.status(201).json(preset);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.get(api.optimizations.list.path, async (req, res) => {
    const opts = await storage.getOptimizations();
    if (opts.length === 0) {
      const initialOpts = [
        { category: "Registry", name: "Win32PrioritySeparation", description: "Optimize CPU priority for gaming", command: "Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl' -Name 'Win32PrioritySeparation' -Value 38" },
        { category: "Registry", name: "NetworkThrottling", description: "Disable network throttling for lower ping", command: "Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile' -Name 'NetworkThrottlingIndex' -Value 0xffffffff" },
        { category: "FiveM", name: "Cache Cleaner", description: "Clear FiveM cache files", command: "Remove-Item -Path '$env:LocalAppData\\FiveM\\FiveM.app\\cache\\*' -Recurse -Force" },
        { category: "NVIDIA", name: "Power Management", description: "Set NVIDIA Power Management to Prefer Maximum Performance", command: "nvidia-smi -lgc 1000,2000" }, // Mock command
        { category: "Debloat", name: "Disable Cortana", description: "Remove Cortana background process", command: "Get-AppxPackage *Microsoft.549981C3F5F10* | Remove-AppxPackage" },
      ];
      for (const opt of initialOpts) {
        await db.insert(optimizations).values(opt);
      }
      return res.json(await storage.getOptimizations());
    }
    res.json(opts);
  });

  app.patch(api.optimizations.toggle.path, async (req, res) => {
    try {
      const { isApplied } = api.optimizations.toggle.input.parse(req.body);
      const opt = await storage.updateOptimization(Number(req.params.id), isApplied);
      res.json(opt);
    } catch (err) {
      res.status(404).json({ message: "Optimization not found" });
    }
  });

  app.post(api.script.generate.path, async (req, res) => {
    try {
      const input = api.script.generate.input.parse(req.body);
      
      // In a real app, we would generate a specific script based on `input.tweaks`
      // For now, we return a mock script URL and PowerShell command
      const host = req.get('host') || 'localhost';
      const protocol = req.protocol || 'https';
      
      // This is the powershell command they would run
      const command = `irm ${protocol}://${host}/api/script/download | iex`;
      
      res.json({
        scriptUrl: `${protocol}://${host}/api/script/download`,
        command
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  // Serve a mock script for the download
  app.get('/api/script/download', (req, res) => {
    const scriptContent = `
Write-Host "Starting Opti Gods by leaq..." -ForegroundColor Red
Write-Host "Applying Registry Tweaks..."
# Example: Set-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl" -Name "Win32PrioritySeparation" -Value 38
Write-Host "Applying FiveM Optimizations..."
Write-Host "Applying Process Lasso tweaks..."
Write-Host "Applying NVIDIA Presets..."
Write-Host "Done! Your PC is now optimized." -ForegroundColor Green
`;
    res.setHeader('Content-Type', 'text/plain');
    res.send(scriptContent);
  });

  return httpServer;
}
