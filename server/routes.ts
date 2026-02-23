import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get(api.presets.list.path, async (req, res) => {
    const allPresets = await storage.getPresets();
    res.json(allPresets);
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
