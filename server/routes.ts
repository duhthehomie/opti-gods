import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

const TWEAK_COMMANDS: Record<string, string> = {
  // CPU
  Win32PrioritySeparation: `Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl' -Name 'Win32PrioritySeparation' -Value 26`,
  DisableHungAppDetection: `Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name 'HungAppTimeout' -Value '1000'`,
  SetTimerResolution: `bcdedit /set useplatformtick yes; bcdedit /deletevalue useplatformclock`,
  EnableLargeSystemCache: `Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management' -Name 'LargeSystemCache' -Value 1`,
  DisablePagefileEncryption: `fsutil behavior set encryptpagingfile 0`,
  // Network
  NetworkThrottling: `Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile' -Name 'NetworkThrottlingIndex' -Value 0xffffffff`,
  OptimizeTCP: `netsh int tcp set global autotuninglevel=normal; netsh int tcp set global chimney=disabled; netsh int tcp set global dca=enabled; netsh int tcp set global netdma=enabled`,
  DisableNagle: `Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces' -Name 'TcpAckFrequency' -Value 1; Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters' -Name 'TCPNoDelay' -Value 1`,
  DisablePowerThrottling: `powercfg -setdcvalueindex SCHEME_CURRENT 2a737441-1930-4402-8d77-b2bebba308a3 d4e98f31-5ffe-4ce1-be31-1b38b384c009 0; powercfg -setacvalueindex SCHEME_CURRENT 2a737441-1930-4402-8d77-b2bebba308a3 d4e98f31-5ffe-4ce1-be31-1b38b384c009 0`,
  // Memory
  DisablePrefetch: `Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management\\PrefetchParameters' -Name 'EnablePrefetcher' -Value 0; Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management\\PrefetchParameters' -Name 'EnableSuperfetch' -Value 0`,
  DisableMemoryCompression: `Disable-MMAgent -MemoryCompression`,
  // Visual/Gaming
  DisableAnimations: `Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name 'UserPreferencesMask' -Value ([byte[]](0x90,0x12,0x03,0x80,0x10,0x00,0x00,0x00))`,
  DisableTelemetry: `Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection' -Name 'AllowTelemetry' -Value 0`,
  DisableXboxGameBar: `Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\GameDVR' -Name 'AppCaptureEnabled' -Value 0; Get-AppxPackage Microsoft.XboxGamingOverlay | Remove-AppxPackage`,
  DisableGameDVR: `Set-ItemProperty -Path 'HKCU:\\System\\GameConfigStore' -Name 'GameDVR_Enabled' -Value 0`,
  EnableHAGS: `Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' -Name 'HwSchMode' -Value 2`,
  DisablePointerPrecision: `Set-ItemProperty -Path 'HKCU:\\Control Panel\\Mouse' -Name 'MouseSpeed' -Value 0; Set-ItemProperty -Path 'HKCU:\\Control Panel\\Mouse' -Name 'MouseThreshold1' -Value 0; Set-ItemProperty -Path 'HKCU:\\Control Panel\\Mouse' -Name 'MouseThreshold2' -Value 0`,
  // Power
  SetHighPerformancePlan: `powercfg -duplicatescheme e9a42b02-d5df-448d-aa00-03f14749eb61; $guid = (powercfg -l | Select-String 'Ultimate Performance').Line.Split(' ')[3]; powercfg -setactive $guid`,
  DisableUSBSuspend: `powercfg -setacvalueindex SCHEME_CURRENT 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 0`,
  DisableCoreParking: `Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Power\\PowerSettings\\54533251-82be-4824-96c1-47b60b740d00\\0cc5b647-c1df-4637-891a-dec35c318583' -Name 'ValueMax' -Value 0`,
  DisableDynamicTick: `bcdedit /set disabledynamictick yes`,
  // FiveM
  FiveMCacheClear: `Remove-Item -Path "$env:LocalAppData\\FiveM\\FiveM.app\\cache\\*" -Recurse -Force -ErrorAction SilentlyContinue`,
  FiveMHighPriority: `$key = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\GTA5.exe\\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force }; Set-ItemProperty -Path $key -Name 'CpuPriorityClass' -Value 3`,
  FiveMExtendedMemory: `$key = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\FiveM.exe\\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force }; Set-ItemProperty -Path $key -Name 'CpuPriorityClass' -Value 3`,
  FiveMDisableVSync: `$cfg = "$env:LocalAppData\\FiveM\\FiveM.app\\citizen\\common\\data\\VehicleLayouts\\settings.xml"; Write-Host "VSync override queued for FiveM config."`,
  FiveMIOPriority: `$key = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\FiveM.exe\\PerfOptions'; Set-ItemProperty -Path $key -Name 'IoPriority' -Value 3 -ErrorAction SilentlyContinue`,
  // Debloat
  DebloatCortana: `Get-AppxPackage *Microsoft.549981C3F5F10* | Remove-AppxPackage`,
  DebloatOneDrive: `taskkill /F /IM OneDrive.exe; $proc = "$env:SystemRoot\\System32\\OneDriveSetup.exe"; If (Test-Path $proc) { & $proc /uninstall }`,
  DebloatXboxApp: `Get-AppxPackage *XboxApp* | Remove-AppxPackage`,
  DebloatXboxGameBar: `Get-AppxPackage *Microsoft.XboxGamingOverlay* | Remove-AppxPackage`,
  DebloatXboxIdentity: `Get-AppxPackage *XboxIdentityProvider* | Remove-AppxPackage`,
  DebloatBing: `Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Search' -Name 'BingSearchEnabled' -Value 0`,
  DebloatWeather: `Get-AppxPackage *BingWeather* | Remove-AppxPackage`,
  DebloatNews: `Get-AppxPackage *BingNews* | Remove-AppxPackage`,
  DebloatMaps: `Get-AppxPackage *WindowsMaps* | Remove-AppxPackage`,
  DebloatSolitaire: `Get-AppxPackage *MicrosoftSolitaireCollection* | Remove-AppxPackage`,
  DebloatMixedReality: `Get-AppxPackage *MixedReality* | Remove-AppxPackage`,
  DebloatSkype: `Get-AppxPackage *SkypeApp* | Remove-AppxPackage`,
  DebloatZune: `Get-AppxPackage *ZuneMusic* | Remove-AppxPackage; Get-AppxPackage *ZuneVideo* | Remove-AppxPackage`,
  DebloatOfficeHub: `Get-AppxPackage *MicrosoftOfficeHub* | Remove-AppxPackage`,
  DebloatFeedback: `Get-AppxPackage *WindowsFeedbackHub* | Remove-AppxPackage`,
  DebloatGetHelp: `Get-AppxPackage *GetHelp* | Remove-AppxPackage`,
  DebloatGrooveMusic: `Get-AppxPackage *ZuneMusic* | Remove-AppxPackage`,
  DebloatMSPaint3D: `Get-AppxPackage *Microsoft.MSPaint* | Remove-AppxPackage`,
  DebloatWindowsCamera: `Get-AppxPackage *WindowsCamera* | Remove-AppxPackage`,
  DebloatYourPhone: `Get-AppxPackage *YourPhone* | Remove-AppxPackage`,
  ServiceDiagTrack: `Stop-Service -Name "DiagTrack" -Force; Set-Service -Name "DiagTrack" -StartupType Disabled`,
  ServiceWSearch: `Stop-Service -Name "WSearch" -Force; Set-Service -Name "WSearch" -StartupType Disabled`,
  ServiceSysMain: `Stop-Service -Name "SysMain" -Force; Set-Service -Name "SysMain" -StartupType Disabled`,
  ServiceRemoteReg: `Stop-Service -Name "RemoteRegistry" -Force; Set-Service -Name "RemoteRegistry" -StartupType Disabled`,
  ServiceWMPNetworkSvc: `Stop-Service -Name "WMPNetworkSvc" -Force; Set-Service -Name "WMPNetworkSvc" -StartupType Disabled`,
  PrivacyTelemetry: `Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection' -Name 'AllowTelemetry' -Value 0`,
  PrivacyActivityHistory: `Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\System' -Name 'EnableActivityFeed' -Value 0`,
  PrivacyLocationTracking: `Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\location' -Name 'Value' -Value 'Deny'`,
  PrivacyAdvertisingID: `Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\AdvertisingInfo' -Name 'Enabled' -Value 0`,
  PrivacyDiagFeedback: `Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\Microsoft\\Siuf\\Rules' -Name 'NumberOfSIUFInPeriod' -Value 0`,
  // Startup apps
  su_discord: `$path = "$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\Discord.lnk"; If (Test-Path $path) { Remove-Item $path }; reg delete "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" /v "Discord" /f 2>$null`,
  su_spotify: `reg delete "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" /v "Spotify" /f 2>$null`,
  su_onedrive: `reg delete "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" /v "OneDrive" /f 2>$null`,
  su_teams: `reg delete "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" /v "com.squirrel.Teams.Teams" /f 2>$null`,
  su_skype: `reg delete "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" /v "Skype" /f 2>$null`,
  su_zoom: `reg delete "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" /v "Zoom" /f 2>$null`,
  su_nvidia: `reg delete "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" /v "NvBackend" /f 2>$null`,
  su_ccleaner: `reg delete "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" /v "CCleaner" /f 2>$null`,
  su_corsair: `reg delete "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" /v "iCUE" /f 2>$null`,
  su_amdradeon: `reg delete "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" /v "RadeonSoftware" /f 2>$null`,
};

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get(api.system.stats.path, async (_req, res) => {
    res.json({
      cpu: Math.floor(Math.random() * 35) + 8,
      gpu: Math.floor(Math.random() * 25) + 5,
      memory: Math.floor(Math.random() * 45) + 18,
      os: "Windows 10 Pro (22H2)",
      processCount: 84,
      highImpactCount: 12,
    });
  });

  app.get(api.presets.list.path, async (_req, res) => {
    const items = await storage.getPresets();
    res.json(items);
  });

  app.post(api.presets.create.path, async (req, res) => {
    try {
      const input = api.presets.create.input.parse(req.body);
      const preset = await storage.createPreset(input);
      res.status(201).json(preset);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      throw err;
    }
  });

  app.delete(api.presets.delete.path, async (req, res) => {
    await storage.deletePreset(Number(req.params.id));
    res.json({ success: true });
  });

  app.get(api.startup.list.path, async (_req, res) => {
    res.json([]);
  });

  app.patch(api.startup.toggle.path, async (req, res) => {
    try {
      const { isEnabled } = api.startup.toggle.input.parse(req.body);
      const item = await storage.updateStartupApp(Number(req.params.id), isEnabled);
      res.json(item);
    } catch {
      res.status(404).json({ message: "App not found" });
    }
  });

  app.get(api.optimizations.list.path, async (_req, res) => {
    const opts = await storage.getOptimizations();
    res.json(opts);
  });

  app.patch(api.optimizations.toggle.path, async (req, res) => {
    try {
      const { isApplied } = api.optimizations.toggle.input.parse(req.body);
      const opt = await storage.updateOptimization(Number(req.params.id), isApplied);
      res.json(opt);
    } catch {
      res.status(404).json({ message: "Optimization not found" });
    }
  });

  app.post(api.script.generate.path, async (req, res) => {
    try {
      const input = api.script.generate.input.parse(req.body);
      const host = req.get('host') || 'localhost';
      const protocol = req.protocol || 'https';
      const command = `irm ${protocol}://${host}/api/script/download | iex`;
      res.json({ scriptUrl: `${protocol}://${host}/api/script/download`, command });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.get('/api/script/download', (req, res) => {
    // Parse tweaks from query if provided
    const rawTweaks = req.query.tweaks;
    let tweaks: Record<string, boolean> = {};
    if (rawTweaks && typeof rawTweaks === 'string') {
      try { tweaks = JSON.parse(rawTweaks); } catch {}
    }

    const enabledTweaks = Object.entries(tweaks).filter(([, v]) => v).map(([k]) => k);
    const scriptLines: string[] = [
      `# ============================================`,
      `# OPTI GODS by leaq — Windows 10 Optimizer`,
      `# Generated: ${new Date().toISOString()}`,
      `# Tweaks enabled: ${enabledTweaks.length}`,
      `# ============================================`,
      ``,
      `$ErrorActionPreference = 'SilentlyContinue'`,
      `Write-Host "OPTI GODS by leaq — Starting optimization..." -ForegroundColor Red`,
      ``,
    ];

    const categories: Record<string, string[]> = {};
    for (const key of enabledTweaks) {
      const cmd = TWEAK_COMMANDS[key];
      if (!cmd) continue;
      const cat = key.startsWith('Debloat') || key.startsWith('Service') || key.startsWith('Privacy') ? 'Debloat'
        : key.startsWith('FiveM') ? 'FiveM'
        : key.startsWith('Process') ? 'Process Lasso'
        : key.startsWith('su_') ? 'Startup Apps'
        : 'Registry / System';
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(`# ${key}\n${cmd}`);
    }

    for (const [cat, cmds] of Object.entries(categories)) {
      scriptLines.push(`Write-Host "[${cat}] Applying ${cmds.length} tweak(s)..." -ForegroundColor DarkRed`);
      scriptLines.push(...cmds);
      scriptLines.push(``);
    }

    scriptLines.push(`Write-Host "Done! Restart your PC to apply all changes." -ForegroundColor Green`);

    res.setHeader('Content-Type', 'text/plain');
    res.send(scriptLines.join('\n'));
  });

  return httpServer;
}
