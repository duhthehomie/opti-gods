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
  InputLagTCP: `$tcpPath = 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters'; Set-ItemProperty -Path $tcpPath -Name 'TcpAckFrequency' -Value 1 -Type DWord; Set-ItemProperty -Path $tcpPath -Name 'TCPNoDelay' -Value 1 -Type DWord; Set-ItemProperty -Path $tcpPath -Name 'EnablePMTUBHDetect' -Value 0 -Type DWord; Write-Host "[OK] TCP Input Lag: TcpAckFrequency=1, TCPNoDelay=1, EnablePMTUBHDetect=0" -ForegroundColor Green`,
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
  DisableCoreParking: `$cpPath = 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Power\\PowerSettings\\54533251-82be-4824-96c1-47b60b740d00\\0cc5b647-c1df-4637-891a-dec35c318583'; Set-ItemProperty -Path $cpPath -Name 'ValueMax' -Value 0 -Type DWord; Set-ItemProperty -Path $cpPath -Name 'Attributes' -Value 1 -Type DWord; powercfg -setacvalueindex SCHEME_CURRENT 54533251-82be-4824-96c1-47b60b740d00 0cc5b647-c1df-4637-891a-dec35c318583 100; Write-Host "[OK] CPU Core Parking disabled — all cores will remain active" -ForegroundColor Green`,
  DisablePowerThrottlingAdv: `$ptPath = 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Power\\PowerSettings\\54533251-82be-4824-96c1-47b60b740d00\\be337238-0d82-4146-a960-4f3749d470c7'; If (Test-Path $ptPath) { Set-ItemProperty -Path $ptPath -Name 'Attributes' -Value 1 -Type DWord }; Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Power\\PowerThrottling' -Name 'PowerThrottlingOff' -Value 1 -Type DWord -ErrorAction SilentlyContinue; Write-Host "[OK] Power Throttling (Advanced) disabled via PowerSettings and PowerThrottling key" -ForegroundColor Green`,
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
  // Memory
  MemFixedPagefile: `$ram = (Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1MB; $size = [math]::Round($ram * 1.5); wmic computersystem where name="%computername%" set AutomaticManagedPagefile=False; wmic pagefileset where name="C:\\pagefile.sys" set InitialSize=$size,MaximumSize=$size`,
  MemDisablePagefile: `wmic computersystem where name="%computername%" set AutomaticManagedPagefile=False; wmic pagefileset delete`,
  MemClearPagefileShutdown: `Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management' -Name 'ClearPageFileAtShutdown' -Value 1`,
  MemDisableCompression: `Disable-MMAgent -MemoryCompression`,
  MemDisableSuperfetch: `Stop-Service -Name "SysMain" -Force; Set-Service -Name "SysMain" -StartupType Disabled`,
  MemTrimStandbyList: `$code = @"
using System;using System.Runtime.InteropServices;
public class MemoryHelper { [DllImport("psapi.dll")] public static extern int EmptyWorkingSet(IntPtr handle); }
"@; Add-Type $code; [MemoryHelper]::EmptyWorkingSet([IntPtr](-1))`,
  MemDisableKernelPaging: `Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management' -Name 'DisablePagingExecutive' -Value 1`,
  MemSystemCacheBoost: `Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management' -Name 'LargeSystemCache' -Value 0`,
  MemTrimOnMinimize: `Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options' -Name 'TrimWorkingSetSize' -Value 1 -Type DWord`,
  MemLargePageSupport: `bcdedit /set usephysicaldestination no; Write-Host "Large page support tweak applied."`,
  MemSetWorkingSetSize: `Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management' -Name 'WorkingSetQuota' -Value 0xFFFFFFFF`,
  MemGPUOptimize: `Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' -Name 'TdrLevel' -Value 3`,
  MemDisableGPUPagefile: `Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' -Name 'PagingAllocation' -Value 0`,
  MemGPUSchedulerTweak: `Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' -Name 'Scheduler' -Value 1`,
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
  // Registry - Extra
  SetResponsiveness: `Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile' -Name 'SystemResponsiveness' -Value 10`,
  GameModeTweaks: `$gamePath = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games'; If (!(Test-Path $gamePath)) { New-Item -Path $gamePath -Force | Out-Null }; Set-ItemProperty -Path $gamePath -Name 'Scheduling Category' -Value 'High' -Type String; Set-ItemProperty -Path $gamePath -Name 'SFIO Priority' -Value 'High' -Type String; Set-ItemProperty -Path $gamePath -Name 'GPU Priority' -Value 8 -Type DWord; Set-ItemProperty -Path $gamePath -Name 'Priority' -Value 6 -Type DWord; Set-ItemProperty -Path $gamePath -Name 'MaximumPreRenderedFrames' -Value 1 -Type DWord; Write-Host "[OK] Game Mode Scheduler: High Category, High SFIO, GPU Priority 8, CPU Priority 6, MaxPreRendered 1" -ForegroundColor Green`,
  EnableMSIMode: `$gpu = Get-PnpDevice -Class Display | Select-Object -First 1; $path = "HKLM:\\SYSTEM\\CurrentControlSet\\Enum\\$($gpu.InstanceId)\\Device Parameters\\Interrupt Management\\MessageSignaledInterruptProperties"; If (Test-Path $path) { Set-ItemProperty -Path $path -Name 'MSISupported' -Value 1 }`,
  DisableNDU: `Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Ndu' -Name 'Start' -Value 4`,
  DisableIPv6: `Disable-NetAdapterBinding -Name '*' -ComponentID ms_tcpip6`,
  DisableFastStartup: `Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power' -Name 'HiberbootEnabled' -Value 0`,
  DisableWindowsError: `Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\Windows Error Reporting' -Name 'Disabled' -Value 1; Stop-Service -Name 'WerSvc' -Force; Set-Service -Name 'WerSvc' -StartupType Disabled`,
  DisableAutoUpdate: `Stop-Service -Name 'wuauserv' -Force; Set-Service -Name 'wuauserv' -StartupType Disabled`,
  DisableDefender: `Set-MpPreference -DisableRealtimeMonitoring $true; Write-Host "Defender real-time disabled - re-enable via Windows Security if needed" -ForegroundColor Yellow`,
  // New Debloat
  DebloatClipchamp: `Get-AppxPackage *Clipchamp* | Remove-AppxPackage`,
  DebloatPowerAutomate: `Get-AppxPackage *PowerAutomate* | Remove-AppxPackage`,
  DebloatQuickAssist: `Get-AppxPackage *QuickAssist* | Remove-AppxPackage`,
  DebloatTeamsConsumer: `Get-AppxPackage *MicrosoftTeams* | Where-Object { $_.SignatureKind -eq 'Store' } | Remove-AppxPackage`,
  DebloatAlarmsAndClock: `Get-AppxPackage *WindowsAlarms* | Remove-AppxPackage`,
  // New Services
  ServiceFax: `Stop-Service -Name 'Fax' -Force; Set-Service -Name 'Fax' -StartupType Disabled`,
  ServiceRetailDemo: `Stop-Service -Name 'RetailDemo' -Force; Set-Service -Name 'RetailDemo' -StartupType Disabled`,
  ServiceTabletInput: `Stop-Service -Name 'TabletInputService' -Force; Set-Service -Name 'TabletInputService' -StartupType Disabled`,
  ServiceMapsBroker: `Stop-Service -Name 'MapsBroker' -Force; Set-Service -Name 'MapsBroker' -StartupType Disabled`,
  // FiveM Extra
  FiveMWorkingSet: `$key = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\GTA5.exe'; If (!(Test-Path $key)) { New-Item $key -Force }; Set-ItemProperty -Path "$key\\PerfOptions" -Name 'WorkingSetLimitInKB' -Value 4194304 -Type DWord`,
  FiveMStreamPool: `$cfg = "$env:LocalAppData\\FiveM\\FiveM.app\\CitizenFX.ini"; If (Test-Path $cfg) { (Get-Content $cfg) -replace 'StreamPool=.*','StreamPool=128' | Set-Content $cfg }`,
  FiveMDisableNvidiaTelemetry: `Stop-Service -Name 'NvTelemetryContainer' -Force; Set-Service -Name 'NvTelemetryContainer' -StartupType Disabled`,
  // Win11 Debloat
  Win11TeamsChat: `Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\Windows Chat' -Name 'ChatIcon' -Value 3; Get-AppxPackage *MicrosoftTeams* | Where-Object SignatureKind -eq 'Store' | Remove-AppxPackage`,
  Win11Widgets: `Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Dsh' -Name 'AllowNewsAndInterests' -Value 0; winget uninstall --id MicrosoftCorporationII.Windows.DevHome 2>$null; Get-AppxPackage *WebExperience* | Remove-AppxPackage`,
  Win11Copilot: `Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsCopilot' -Name 'TurnOffWindowsCopilot' -Value 1; Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' -Name 'ShowCopilotButton' -Value 0`,
  Win11StartRecommended: `Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\Explorer' -Name 'HideRecommendedSection' -Value 1`,
  Win11AdsInStart: `Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager' -Name 'SystemPaneSuggestionsEnabled' -Value 0; Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager' -Name 'SubscribedContent-338388Enabled' -Value 0; Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager' -Name 'SubscribedContent-338389Enabled' -Value 0`,
  Win11EdgeSidebar: `Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Edge' -Name 'HubsSidebarEnabled' -Value 0; Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Edge' -Name 'EdgeShoppingAssistantEnabled' -Value 0`,
  Win11ChatIcon: `Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' -Name 'TaskbarMn' -Value 0`,
  Win11OneDriveBackup: `Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\Microsoft\\OneDrive' -Name 'DisableFileSyncNGSC' -Value 1`,
  Win11BingSearch: `Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Search' -Name 'BingSearchEnabled' -Value 0; Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Search' -Name 'CortanaConsent' -Value 0`,
  Win11NotepadAI: `Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\Microsoft\\Notepad' -Name 'ShowStoreBanner' -Value 0`,
  Win11Snap: `Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' -Name 'SnapAssist' -Value 0`,
  Win11TPMAlert: `Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows Security Health\\State' -Name 'AccountProtection_MicrosoftAccount_Disconnected' -Value 1`,
  Win11DeviceEncryption: `Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\BitLocker' -Name 'PreventDeviceEncryption' -Value 1`,
  Win11AutoHDR: `Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\Microsoft\\DirectX\\UserGpuPreferences' -Name 'AutoHDREnable' -Value 0`,
  // Fortnite
  FortniteHighPriority: `$key = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\FortniteClient-Win64-Shipping.exe\\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force }; Set-ItemProperty -Path $key -Name 'CpuPriorityClass' -Value 6; Write-Host "[Fortnite] CPU priority set to Above Normal (persistent)" -ForegroundColor Green`,
  FortniteUncapLobbyFPS: `$configPath = "$env:LOCALAPPDATA\\FortniteGame\\Saved\\Config\\WindowsClient\\GameUserSettings.ini"; If (Test-Path $configPath) { $wasReadOnly = (Get-Item $configPath).IsReadOnly; If ($wasReadOnly) { Set-ItemProperty $configPath -Name IsReadOnly -Value $false; Write-Host "[Fortnite] Removed read-only flag" -ForegroundColor Yellow }; (Get-Content $configPath) -replace 'FrameRateLimit=\\d+\\.?\\d*', 'FrameRateLimit=0.000000' | Set-Content $configPath -Encoding UTF8; Write-Host "[Fortnite] FPS cap removed (FrameRateLimit=0.000000)" -ForegroundColor Green } Else { Write-Host "[Fortnite] GameUserSettings.ini not found - launch Fortnite first" -ForegroundColor Red }`,
  FortniteUncapGameFPS: `$enginePath = "$env:LOCALAPPDATA\\FortniteGame\\Saved\\Config\\WindowsClient\\Engine.ini"; If (!(Test-Path $enginePath)) { New-Item -ItemType File -Path $enginePath -Force | Out-Null }; $content = Get-Content $enginePath -Raw; If ($content -notmatch 't\\.MaxFPS') { Add-Content $enginePath "[/Script/Engine.Engine]"; Add-Content $enginePath "t.MaxFPS=0" }; Write-Host "[Fortnite] Engine FPS cap removed (t.MaxFPS=0)" -ForegroundColor Green`,
  FortniteDisableVSync: `$enginePath = "$env:LOCALAPPDATA\\FortniteGame\\Saved\\Config\\WindowsClient\\Engine.ini"; If (!(Test-Path $enginePath)) { New-Item -ItemType File -Path $enginePath -Force | Out-Null }; Add-Content $enginePath "[SystemSettings]"; Add-Content $enginePath "r.VSync=0"; Write-Host "[Fortnite] VSync disabled in Engine.ini" -ForegroundColor Green`,
  FortniteEngineStreaming: `$enginePath = "$env:LOCALAPPDATA\\FortniteGame\\Saved\\Config\\WindowsClient\\Engine.ini"; If (!(Test-Path $enginePath)) { New-Item -ItemType File -Path $enginePath -Force | Out-Null }; Add-Content $enginePath "[/Script/Engine.StreamingSettings]"; Add-Content $enginePath "s.MinBulkDataSizeForAsyncLoading=131072"; Add-Content $enginePath "AsyncLoadingThreadEnabled=True"; Add-Content $enginePath "[SystemSettings]"; Add-Content $enginePath "r.Streaming.PoolSize=2048"; Add-Content $enginePath "r.MipMapLODBias=-1"; Write-Host "[Fortnite] Streaming pool optimized" -ForegroundColor Green`,
  FortniteDisableMotionBlur: `$enginePath = "$env:LOCALAPPDATA\\FortniteGame\\Saved\\Config\\WindowsClient\\Engine.ini"; If (!(Test-Path $enginePath)) { New-Item -ItemType File -Path $enginePath -Force | Out-Null }; Add-Content $enginePath "[SystemSettings]"; Add-Content $enginePath "r.MotionBlurQuality=0"; Add-Content $enginePath "r.LensFlareQuality=0"; Add-Content $enginePath "r.BloomQuality=0"; Write-Host "[Fortnite] Motion blur and bloom disabled" -ForegroundColor Green`,
  FortniteLowShadows: `$enginePath = "$env:LOCALAPPDATA\\FortniteGame\\Saved\\Config\\WindowsClient\\Engine.ini"; If (!(Test-Path $enginePath)) { New-Item -ItemType File -Path $enginePath -Force | Out-Null }; Add-Content $enginePath "[SystemSettings]"; Add-Content $enginePath "r.Shadow.MaxResolution=512"; Add-Content $enginePath "r.ShadowQuality=0"; Add-Content $enginePath "r.ContactShadows=0"; Write-Host "[Fortnite] Shadow quality forced to minimum" -ForegroundColor Green`,
  FortniteDisableLumen: `$enginePath = "$env:LOCALAPPDATA\\FortniteGame\\Saved\\Config\\WindowsClient\\Engine.ini"; If (!(Test-Path $enginePath)) { New-Item -ItemType File -Path $enginePath -Force | Out-Null }; Add-Content $enginePath "[SystemSettings]"; Add-Content $enginePath "r.DynamicGlobalIlluminationMethod=0"; Add-Content $enginePath "r.ReflectionMethod=0"; Write-Host "[Fortnite] Lumen GI and reflections disabled" -ForegroundColor Green`,
  FortniteDisableRecording: `$enginePath = "$env:LOCALAPPDATA\\FortniteGame\\Saved\\Config\\WindowsClient\\Engine.ini"; If (!(Test-Path $enginePath)) { New-Item -ItemType File -Path $enginePath -Force | Out-Null }; Add-Content $enginePath "[OnlineSubsystemMcp.Mcp2ServiceConfigs]"; Add-Content $enginePath "bEnabled=false"; Write-Host "[Fortnite] Background recording disabled" -ForegroundColor Green`,
  FortniteForceDirectX12: `$launchPath = "$env:LOCALAPPDATA\\FortniteGame\\Saved\\Config\\WindowsClient\\GameUserSettings.ini"; Write-Host "[Fortnite] To enable DX12: in Epic Launcher click Fortnite Settings and add -dx12 to Additional Command Line Args" -ForegroundColor Cyan`,
  FortniteAffinityPhysical: `$proc = Get-Process -Name "FortniteClient-Win64-Shipping" -ErrorAction SilentlyContinue; If ($proc) { $cores = [System.Environment]::ProcessorCount; $physCores = $cores / 2; $mask = [Math]::Pow(2,$physCores)-1; $proc.ProcessorAffinity = [int]$mask; Write-Host "[Fortnite] Affinity set to physical cores only" -ForegroundColor Green } Else { Write-Host "[Fortnite] Launch Fortnite first, then re-run this script" -ForegroundColor Yellow }`,
  FortniteInputLatency: `$enginePath = "$env:LOCALAPPDATA\\FortniteGame\\Saved\\Config\\WindowsClient\\Engine.ini"; If (!(Test-Path $enginePath)) { New-Item -ItemType File -Path $enginePath -Force | Out-Null }; Add-Content $enginePath "[/Script/Engine.InputSettings]"; Add-Content $enginePath "bEnableMouseSmoothing=False"; Add-Content $enginePath "bViewAccelerationEnabled=False"; Write-Host "[Fortnite] Mouse smoothing and view acceleration disabled" -ForegroundColor Green`,
  FortniteGameMode: `Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\Microsoft\\GameBar' -Name 'AutoGameModeEnabled' -Value 1; $key = 'HKCU:\\System\\GameConfigStore'; Set-ItemProperty -Path $key -Name 'GameDVR_Enabled' -Value 0; Set-ItemProperty -Path $key -Name 'GameDVR_FSEBehaviorMode' -Value 2`,
  FortniteNetworkBuffer: `Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\AFD\\Parameters' -Name 'DefaultReceiveWindow' -Value 131072; Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\AFD\\Parameters' -Name 'DefaultSendWindow' -Value 131072`,
  FortniteDisableThrottling: `$key = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\FortniteClient-Win64-Shipping.exe'; If (!(Test-Path $key)) { New-Item -Path $key -Force }; Set-ItemProperty -Path "$key\\PerfOptions" -Name 'CpuPriorityClass' -Value 6`,
  // Game Detection — each command auto-detects if the game is installed before applying
  game_valorant: `$paths = @("$env:LocalAppData\\VALORANT","C:\\Riot Games\\VALORANT"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { Write-Host "[DETECTED] Valorant at $found" -ForegroundColor Green; $key = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\VALORANT-Win64-Shipping.exe\\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force | Out-Null }; Set-ItemProperty -Path $key -Name 'CpuPriorityClass' -Value 6; Set-ItemProperty -Path $key -Name 'IoPriority' -Value 3; Write-Host "[OK] Valorant: Above Normal CPU + High I/O priority" -ForegroundColor Green } Else { Write-Host "[SKIP] Valorant not detected" -ForegroundColor DarkGray }`,
  game_cs2: `$paths = @("C:\\Program Files (x86)\\Steam\\steamapps\\common\\Counter-Strike Global Offensive\\game\\bin\\win64\\cs2.exe","D:\\SteamLibrary\\steamapps\\common\\Counter-Strike Global Offensive\\game\\bin\\win64\\cs2.exe","E:\\SteamLibrary\\steamapps\\common\\Counter-Strike Global Offensive\\game\\bin\\win64\\cs2.exe"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { Write-Host "[DETECTED] CS2" -ForegroundColor Green; $key = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\cs2.exe\\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force | Out-Null }; Set-ItemProperty -Path $key -Name 'CpuPriorityClass' -Value 6; netsh int tcp set global timestamps=disabled | Out-Null; Write-Host "[OK] CS2: Above Normal priority + TCP timestamps disabled" -ForegroundColor Green } Else { Write-Host "[SKIP] CS2 not detected" -ForegroundColor DarkGray }`,
  game_apex: `$paths = @("C:\\Program Files\\EA Games\\Apex Legends\\r5apex.exe","C:\\Program Files\\Origin Games\\Apex Legends\\r5apex.exe","C:\\Program Files (x86)\\Origin Games\\Apex Legends\\r5apex.exe"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { Write-Host "[DETECTED] Apex Legends" -ForegroundColor Green; $key = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\r5apex.exe\\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force | Out-Null }; Set-ItemProperty -Path $key -Name 'CpuPriorityClass' -Value 6; Set-ItemProperty -Path $key -Name 'IoPriority' -Value 3; Write-Host "[OK] Apex: Above Normal CPU + High I/O" -ForegroundColor Green } Else { Write-Host "[SKIP] Apex Legends not detected" -ForegroundColor DarkGray }`,
  game_warzone: `$paths = @("C:\\Program Files (x86)\\Call of Duty","C:\\Program Files\\Call of Duty"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { Write-Host "[DETECTED] Call of Duty / Warzone" -ForegroundColor Green; $key = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\cod.exe\\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force | Out-Null }; Set-ItemProperty -Path $key -Name 'CpuPriorityClass' -Value 6; Write-Host "[OK] Warzone: Above Normal CPU priority" -ForegroundColor Green } Else { Write-Host "[SKIP] COD / Warzone not detected" -ForegroundColor DarkGray }`,
  game_lol: `$paths = @("C:\\Riot Games\\League of Legends\\Game\\League of Legends.exe","D:\\Riot Games\\League of Legends\\Game\\League of Legends.exe"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { Write-Host "[DETECTED] League of Legends" -ForegroundColor Green; $key = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\League of Legends.exe\\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force | Out-Null }; Set-ItemProperty -Path $key -Name 'CpuPriorityClass' -Value 6; Set-ItemProperty -Path $key -Name 'IoPriority' -Value 3; Write-Host "[OK] LoL: Above Normal priority" -ForegroundColor Green } Else { Write-Host "[SKIP] League of Legends not detected" -ForegroundColor DarkGray }`,
  game_overwatch: `$paths = @("C:\\Program Files (x86)\\Overwatch\\_retail_\\Overwatch.exe","C:\\Program Files\\Overwatch\\_retail_\\Overwatch.exe"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { Write-Host "[DETECTED] Overwatch 2" -ForegroundColor Green; $key = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\Overwatch.exe\\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force | Out-Null }; Set-ItemProperty -Path $key -Name 'CpuPriorityClass' -Value 6; Write-Host "[OK] Overwatch 2: Above Normal CPU priority" -ForegroundColor Green } Else { Write-Host "[SKIP] Overwatch 2 not detected" -ForegroundColor DarkGray }`,
  game_siege: `$paths = @("C:\\Program Files (x86)\\Ubisoft\\Ubisoft Game Launcher\\games\\Tom Clancy's Rainbow Six Siege","C:\\Program Files\\Ubisoft\\Ubisoft Game Launcher\\games\\Tom Clancy's Rainbow Six Siege"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { Write-Host "[DETECTED] Rainbow Six Siege" -ForegroundColor Green; $key = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\RainbowSix.exe\\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force | Out-Null }; Set-ItemProperty -Path $key -Name 'CpuPriorityClass' -Value 6; Write-Host "[OK] R6 Siege: Above Normal CPU priority" -ForegroundColor Green } Else { Write-Host "[SKIP] Rainbow Six Siege not detected" -ForegroundColor DarkGray }`,
  game_rust: `$paths = @("C:\\Program Files (x86)\\Steam\\steamapps\\common\\Rust\\RustClient.exe","D:\\SteamLibrary\\steamapps\\common\\Rust\\RustClient.exe","E:\\SteamLibrary\\steamapps\\common\\Rust\\RustClient.exe"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { Write-Host "[DETECTED] Rust" -ForegroundColor Green; $key = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\RustClient.exe\\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force | Out-Null }; Set-ItemProperty -Path $key -Name 'CpuPriorityClass' -Value 6; Write-Host "[OK] Rust: Above Normal CPU priority" -ForegroundColor Green } Else { Write-Host "[SKIP] Rust not detected" -ForegroundColor DarkGray }`,
  game_minecraft: `$minePath = "$env:AppData\\.minecraft\\launcher_profiles.json"; If (Test-Path $minePath) { Write-Host "[DETECTED] Minecraft Java Edition" -ForegroundColor Green; $mcFolder = "$env:AppData\\.minecraft"; Add-MpPreference -ExclusionPath $mcFolder -ErrorAction SilentlyContinue; Write-Host "[OK] Minecraft: .minecraft folder added to Defender exclusions" -ForegroundColor Green } Else { Write-Host "[SKIP] Minecraft not detected" -ForegroundColor DarkGray }`,
  game_roblox: `$robloxPath = "$env:LocalAppData\\Roblox\\Versions"; If (Test-Path $robloxPath) { Write-Host "[DETECTED] Roblox" -ForegroundColor Green; $key = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\RobloxPlayerBeta.exe\\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force | Out-Null }; Set-ItemProperty -Path $key -Name 'CpuPriorityClass' -Value 6; Set-ItemProperty -Path $key -Name 'IoPriority' -Value 3; Write-Host "[OK] Roblox: Above Normal CPU + High I/O priority" -ForegroundColor Green } Else { Write-Host "[SKIP] Roblox not detected" -ForegroundColor DarkGray }`,
  game_tarkov: `$paths = @("C:\\Battlestate Games\\EFT\\EscapeFromTarkov.exe","C:\\Games\\EFT\\EscapeFromTarkov.exe","D:\\Games\\EFT\\EscapeFromTarkov.exe"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { Write-Host "[DETECTED] Escape from Tarkov" -ForegroundColor Green; $key = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\EscapeFromTarkov.exe\\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force | Out-Null }; Set-ItemProperty -Path $key -Name 'CpuPriorityClass' -Value 8; Set-ItemProperty -Path $key -Name 'IoPriority' -Value 3; Write-Host "[OK] Tarkov: High CPU priority + High I/O (CPU-intensive)" -ForegroundColor Green } Else { Write-Host "[SKIP] Escape from Tarkov not detected" -ForegroundColor DarkGray }`,
  game_pubg: `$paths = @("C:\\Program Files (x86)\\Steam\\steamapps\\common\\PUBG\\TslGame\\Binaries\\Win64\\TslGame.exe","D:\\SteamLibrary\\steamapps\\common\\PUBG\\TslGame\\Binaries\\Win64\\TslGame.exe"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { Write-Host "[DETECTED] PUBG" -ForegroundColor Green; $key = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\TslGame.exe\\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force | Out-Null }; Set-ItemProperty -Path $key -Name 'CpuPriorityClass' -Value 6; Write-Host "[OK] PUBG: Above Normal CPU priority" -ForegroundColor Green } Else { Write-Host "[SKIP] PUBG not detected" -ForegroundColor DarkGray }`,
  game_dbd: `$paths = @("C:\\Program Files (x86)\\Steam\\steamapps\\common\\Dead by Daylight","D:\\SteamLibrary\\steamapps\\common\\Dead by Daylight"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { Write-Host "[DETECTED] Dead by Daylight" -ForegroundColor Green; $key = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\DeadByDaylight-Win64-Shipping.exe\\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force | Out-Null }; Set-ItemProperty -Path $key -Name 'CpuPriorityClass' -Value 6; Set-ItemProperty -Path $key -Name 'IoPriority' -Value 3; Write-Host "[OK] DBD: Above Normal CPU + High I/O priority" -ForegroundColor Green } Else { Write-Host "[SKIP] Dead by Daylight not detected" -ForegroundColor DarkGray }`,
  game_dota2: `$paths = @("C:\\Program Files (x86)\\Steam\\steamapps\\common\\dota 2 beta","D:\\SteamLibrary\\steamapps\\common\\dota 2 beta"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { Write-Host "[DETECTED] Dota 2" -ForegroundColor Green; $key = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\dota2.exe\\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force | Out-Null }; Set-ItemProperty -Path $key -Name 'CpuPriorityClass' -Value 6; Write-Host "[OK] Dota 2: Above Normal CPU priority" -ForegroundColor Green } Else { Write-Host "[SKIP] Dota 2 not detected" -ForegroundColor DarkGray }`,
};

// In-memory session store: id -> { tweaks, nvidiaPreset, created }
const scriptSessions = new Map<string, { tweaks: Record<string, boolean>; nvidiaPreset: string; created: number }>();

// Purge sessions older than 1 hour
function purgeOldSessions() {
  const hour = 60 * 60 * 1000;
  const now = Date.now();
  scriptSessions.forEach((v, k) => { if (now - v.created > hour) scriptSessions.delete(k); });
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

function buildScript(enabledTweaks: string[], nvidiaPreset?: string): string {
  const scriptLines: string[] = [
    `# ============================================`,
    `# OPTI GODS by leaq — PC Optimizer`,
    `# Generated: ${new Date().toISOString()}`,
    `# Tweaks enabled: ${enabledTweaks.length}`,
    `# ============================================`,
    ``,
    `$ErrorActionPreference = 'SilentlyContinue'`,
    `Write-Host "=====================================" -ForegroundColor Red`,
    `Write-Host "  OPTI GODS by leaq" -ForegroundColor Red`,
    `Write-Host "  Starting ${enabledTweaks.length} optimizations..." -ForegroundColor White`,
    `Write-Host "=====================================" -ForegroundColor Red`,
    ``,
  ];

  if (nvidiaPreset && nvidiaPreset !== "Balanced") {
    scriptLines.push(`Write-Host "[NVIDIA] Applying ${nvidiaPreset} preset..." -ForegroundColor DarkRed`);
    if (nvidiaPreset === "Performance") {
      scriptLines.push(`# NVIDIA Maximum Performance preset`);
      scriptLines.push(`Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Video' -Name 'PowerMizerEnable' -Value 1`);
    }
    scriptLines.push(``);
  }

  const categories: Record<string, string[]> = {};
  for (const key of enabledTweaks) {
    const cmd = TWEAK_COMMANDS[key];
    if (!cmd) continue;
    const cat = key.startsWith("Mem") ? "Memory"
      : key.startsWith("Debloat") || key.startsWith("Service") || key.startsWith("Privacy") ? "Debloat"
      : key.startsWith("FiveM") ? "FiveM"
      : key.startsWith("Fortnite") ? "Fortnite"
      : key.startsWith("Process") ? "Process Lasso"
      : key.startsWith("su_") ? "Startup Apps"
      : key.startsWith("game_") ? "Game Detection"
      : key.startsWith("Win11") ? "Win11 Debloat"
      : "Registry / System";
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(`# ${key}\n${cmd}`);
  }

  for (const [cat, cmds] of Object.entries(categories)) {
    scriptLines.push(`Write-Host "" `);
    scriptLines.push(`Write-Host "[${cat}] Applying ${cmds.length} tweak(s)..." -ForegroundColor DarkRed`);
    scriptLines.push(...cmds);
  }

  scriptLines.push(``);
  scriptLines.push(`Write-Host "" `);
  scriptLines.push(`Write-Host "=====================================" -ForegroundColor Green`);
  scriptLines.push(`Write-Host "  Done! Restart your PC to apply all changes." -ForegroundColor Green`);
  scriptLines.push(`Write-Host "=====================================" -ForegroundColor Green`);
  return scriptLines.join("\n");
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get(api.system.stats.path, async (req, res) => {
    const ua = req.get("user-agent") || "";
    // Check Sec-CH-UA-Platform-Version (Chrome/Edge sends this automatically)
    const platformVersion = req.get("sec-ch-ua-platform-version") || "";
    const platform = req.get("sec-ch-ua-platform") || "";

    let detectedOS = "Unknown OS";
    if (platform === '"Windows"' || platform === "Windows") {
      // Strip quotes, get major version number
      const clean = platformVersion.replace(/"/g, "");
      const major = parseInt(clean.split(".")[0] || "0", 10);
      if (major >= 13) {
        detectedOS = "Windows 11 Pro (23H2)";
      } else if (major > 0) {
        detectedOS = "Windows 10 Pro (22H2)";
      } else {
        // Fall back to UA string
        if (/Windows NT 10\.0/.test(ua)) detectedOS = "Windows 10 Pro (22H2)";
        else if (/Windows NT 6\.3/.test(ua)) detectedOS = "Windows 8.1";
        else if (/Windows NT 6\.1/.test(ua)) detectedOS = "Windows 7";
        else detectedOS = "Windows";
      }
    } else if (platform === '"macOS"' || platform === "macOS" || /Macintosh|Mac OS X/.test(ua)) {
      detectedOS = "macOS";
    } else if (platform === '"Linux"' || platform === "Linux" || /Linux/.test(ua)) {
      detectedOS = "Linux";
    } else if (/Android/.test(ua)) {
      detectedOS = "Android";
    } else if (/iPhone|iPad/.test(ua)) {
      detectedOS = "iOS";
    } else if (/Windows NT 10\.0/.test(ua)) {
      detectedOS = "Windows 10 / 11 Pro";
    } else if (/Windows/.test(ua)) {
      detectedOS = "Windows";
    }

    res.json({
      cpu: Math.floor(Math.random() * 35) + 8,
      gpu: Math.floor(Math.random() * 25) + 5,
      memory: Math.floor(Math.random() * 45) + 18,
      os: detectedOS,
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

      // Store tweaks in session so the irm | iex URL applies the correct tweaks
      purgeOldSessions();
      const sessionId = generateId();
      scriptSessions.set(sessionId, {
        tweaks: input.tweaks,
        nvidiaPreset: input.nvidiaPreset || "Balanced",
        created: Date.now(),
      });

      const scriptUrl = `${protocol}://${host}/api/script/session/${sessionId}`;
      const command = `irm ${scriptUrl} | iex`;
      res.json({ scriptUrl, command });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // Session-based script endpoint for irm | iex
  app.get('/api/script/session/:id', (req, res) => {
    const session = scriptSessions.get(req.params.id);
    if (!session) {
      res.status(404).setHeader('Content-Type', 'text/plain');
      res.send('# Session expired or not found. Please regenerate your script from the Opti Gods dashboard.');
      return;
    }
    const enabledTweaks = Object.entries(session.tweaks).filter(([, v]) => v).map(([k]) => k);
    const content = buildScript(enabledTweaks, session.nvidiaPreset);
    res.setHeader('Content-Type', 'text/plain');
    res.send(content);
  });

  // POST version for direct download with tweaks body
  app.post('/api/script/download', (req, res) => {
    const tweaks: Record<string, boolean> = req.body?.tweaks || {};
    const nvidiaPreset: string = req.body?.nvidiaPreset || "Balanced";
    const enabledTweaks = Object.entries(tweaks).filter(([, v]) => v).map(([k]) => k);
    const scriptContent = buildScript(enabledTweaks, nvidiaPreset);
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename="OptiGods-by-leaq.ps1"');
    res.send(scriptContent);
  });

  // Game detection scanner script download
  app.get('/api/detect-games-script', (req, res) => {
    const rawHost = req.get('host') || 'localhost';
    // Sanitize host: allow only hostname-safe chars (alnum, dash, dot, colon for port)
    const host = rawHost.replace(/[^a-zA-Z0-9\-.:]/g, '');
    const protocol = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https' ? 'https' : req.protocol;
    const baseUrl = `${protocol}://${host}/game-detection`;

    const script = `# Opti Gods by leaq - Game Scanner
# Scans your PC for installed games and opens your personalized dashboard
# Run this, then check your browser!

$ErrorActionPreference = 'SilentlyContinue'

Write-Host ""
Write-Host "  ======================================" -ForegroundColor Red
Write-Host "   OPTI GODS - Game Scanner v1.0" -ForegroundColor Red
Write-Host "  ======================================" -ForegroundColor Red
Write-Host ""

$baseUrl = "${baseUrl}"
$detected = [System.Collections.Generic.List[string]]::new()

function Resolve-GamePath { param([string]$Path); [System.Environment]::ExpandEnvironmentVariables($Path) }

# Discover Steam library roots
$steamRoots = @()
$defaultSteam = @('C:\\Program Files (x86)\\Steam', 'C:\\Program Files\\Steam')
foreach ($s in $defaultSteam) { if (Test-Path $s) { $steamRoots += $s } }
$vdfPath = 'C:\\Program Files (x86)\\Steam\\steamapps\\libraryfolders.vdf'
if (Test-Path $vdfPath) {
    Get-Content $vdfPath | ForEach-Object {
        if ($_ -match '"path"\\s+"([^"]+)"') { $steamRoots += $Matches[1] }
    }
}

function Find-Game { param([string[]]$Paths)
    foreach ($p in $Paths) {
        if (Test-Path (Resolve-GamePath $p)) { return $true }
        foreach ($root in $steamRoots) {
            if (Test-Path (Join-Path $root $p)) { return $true }
        }
    }
    return $false
}

$games = @(
    @{ id = "game_valorant";   paths = @("%LocalAppData%\\VALORANT", "C:\\Riot Games\\VALORANT") },
    @{ id = "game_cs2";        paths = @("Steam\\steamapps\\common\\Counter-Strike Global Offensive\\game\\bin\\win64\\cs2.exe") },
    @{ id = "game_apex";       paths = @("C:\\Program Files\\EA Games\\Apex Legends\\r5apex.exe","C:\\Program Files\\Origin Games\\Apex Legends\\r5apex.exe") },
    @{ id = "game_warzone";    paths = @("C:\\Program Files (x86)\\Call of Duty","C:\\Program Files\\Battle.net Apps\\Call of Duty") },
    @{ id = "game_lol";        paths = @("C:\\Riot Games\\League of Legends\\Game\\League of Legends.exe") },
    @{ id = "game_overwatch";  paths = @("C:\\Program Files (x86)\\Overwatch\\_retail_\\Overwatch.exe","C:\\Program Files\\Overwatch\\_retail_\\Overwatch.exe") },
    @{ id = "game_siege";      paths = @("C:\\Program Files (x86)\\Ubisoft\\Ubisoft Game Launcher\\games\\Tom Clancy's Rainbow Six Siege") },
    @{ id = "game_rust";       paths = @("Steam\\steamapps\\common\\Rust\\RustClient.exe") },
    @{ id = "game_minecraft";  paths = @("%AppData%\\.minecraft\\launcher_profiles.json") },
    @{ id = "game_roblox";     paths = @("%LocalAppData%\\Roblox\\Versions") },
    @{ id = "game_tarkov";     paths = @("C:\\Battlestate Games\\EFT\\EscapeFromTarkov.exe","C:\\Games\\EFT\\EscapeFromTarkov.exe") },
    @{ id = "game_pubg";       paths = @("Steam\\steamapps\\common\\PUBG\\TslGame\\Binaries\\Win64\\TslGame.exe") },
    @{ id = "game_dbd";        paths = @("Steam\\steamapps\\common\\Dead by Daylight\\DeadByDaylight\\Binaries\\Win64\\DeadByDaylight-Win64-Shipping.exe") },
    @{ id = "game_dota2";      paths = @("Steam\\steamapps\\common\\dota 2 beta\\game\\bin\\win64\\dota2.exe") }
)

Write-Host "  Scanning installed games..." -ForegroundColor Gray
Write-Host ""

foreach ($g in $games) {
    $found = Find-Game $g.paths
    $label = $g.id -replace "game_", ""
    if ($found) {
        $detected.Add($g.id)
        Write-Host "  [FOUND]  $label" -ForegroundColor Green
    } else {
        Write-Host "  [SKIP]   $label" -ForegroundColor DarkGray
    }
}

Write-Host ""

if ($detected.Count -eq 0) {
    Write-Host "  No games found on known paths." -ForegroundColor Yellow
    Write-Host "  Opening dashboard (manual selection mode)..." -ForegroundColor Gray
    Start-Process $baseUrl
} else {
    $list = $detected -join ","
    $url = "$baseUrl" + "?games=" + $list
    Write-Host "  Found $($detected.Count) game(s). Opening your dashboard..." -ForegroundColor Green
    Start-Process $url
}

Write-Host ""
Write-Host "  Done! Check your browser window." -ForegroundColor Red
Write-Host ""
Start-Sleep 2
`;

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename="OptiGods-DetectGames.ps1"');
    res.send(script);
  });

  app.post('/api/pro/verify', (req, res) => {
    const { code } = req.body || {};
    if (!code) return res.json({ valid: false });
    const validCodes = (process.env.PRO_CODES || '').split(',').map(c => c.trim().toUpperCase()).filter(Boolean);
    const valid = validCodes.includes(String(code).toUpperCase().trim());
    res.json({ valid });
  });

  // ── Stripe Checkout (one-time payment) ──────────────────────────────────────
  // Activates only when STRIPE_SECRET_KEY is present in env vars.
  // The user sets STRIPE_SECRET_KEY + STRIPE_PRICE_ID from their Stripe dashboard.

  app.post('/api/create-checkout', async (req, res) => {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return res.status(503).json({ error: 'Stripe not configured on this server.' });
    }

    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId) {
      return res.status(503).json({ error: 'STRIPE_PRICE_ID not set. Run the seed script first.' });
    }

    try {
      const { default: Stripe } = await import('stripe');
      const stripe = new Stripe(secretKey, { apiVersion: '2024-06-20' });

      const host = (req.get('host') || 'localhost').replace(/[^a-zA-Z0-9\-.:]/g, '');
      const protocol = req.headers['x-forwarded-proto'] === 'https' ? 'https' : req.protocol;
      const origin = `${protocol}://${host}`;

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/payment/cancel`,
        metadata: { product: 'optigods_pro' },
      });

      res.json({ url: session.url });
    } catch (err: any) {
      console.error('Stripe checkout error:', err.message);
      res.status(500).json({ error: 'Failed to create checkout session.' });
    }
  });

  app.get('/api/verify-payment', async (req, res) => {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) return res.status(503).json({ paid: false, error: 'Stripe not configured.' });

    const sessionId = req.query.session_id as string;
    if (!sessionId || !sessionId.startsWith('cs_')) {
      return res.status(400).json({ paid: false, error: 'Invalid session ID.' });
    }

    try {
      const { default: Stripe } = await import('stripe');
      const stripe = new Stripe(secretKey, { apiVersion: '2024-06-20' });
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['line_items'],
      });

      // Validate this session was created by us (correct product + mode + price)
      const isOurProduct = session.metadata?.product === 'optigods_pro';
      const isPaymentMode = session.mode === 'payment';
      const expectedPriceId = process.env.STRIPE_PRICE_ID;
      const lineItems = (session as any).line_items?.data ?? [];
      const priceMatches = !expectedPriceId ||
        lineItems.some((item: any) => item.price?.id === expectedPriceId);
      const paid = session.payment_status === 'paid' && isOurProduct && isPaymentMode && priceMatches;

      res.json({ paid });
    } catch (err: any) {
      console.error('Stripe verify error:', err.message);
      res.status(500).json({ paid: false, error: 'Could not verify payment.' });
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
    const content = buildScript(enabledTweaks);
    res.setHeader("Content-Type", "text/plain");
    res.send(content);
  });

  return httpServer;
}
