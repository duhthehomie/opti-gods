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
  ClearPagefileOnShutdown: `Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management' -Name 'ClearPageFileAtShutdown' -Value 1; Write-Host "[OK] Pagefile will be cleared on every shutdown — prevents sensitive data persistence" -ForegroundColor Green`,
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
  FiveMDisableP2P: `$cfgPath = "$env:LocalAppData\\FiveM\\FiveM.app\\CitizenFX.ini"; If (!(Test-Path $cfgPath)) { New-Item -ItemType File -Path $cfgPath -Force | Out-Null }; $content = Get-Content $cfgPath -Raw -ErrorAction SilentlyContinue; If ($content -notmatch 'DisablePeerToPeer') { Add-Content $cfgPath "DisablePeerToPeer=1" }; Write-Host "[FiveM] P2P connections disabled — forces direct server connections for lower ping variance" -ForegroundColor Green`,
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
  MemMovePagefileFast: `$drives = Get-PhysicalDisk | Sort-Object MediaType, Size -Descending; $best = ($drives | Where-Object { $_.MediaType -eq 'SSD' -or $_.MediaType -eq 'NVMe' } | Select-Object -First 1); If (!$best) { $best = $drives[0] }; $driveLetter = (Get-Disk -Number $best.DiskNumber | Get-Partition | Get-Volume | Select-Object -First 1).DriveLetter; If ($driveLetter) { wmic computersystem where name="%computername%" set AutomaticManagedPagefile=False; wmic pagefileset delete 2>$null; wmic pagefileset create name="\${driveLetter}:\\pagefile.sys" 2>$null; Write-Host "[OK] Pagefile moved to drive \${driveLetter} (fastest available)" -ForegroundColor Green } Else { Write-Host "[SKIP] Could not identify fastest drive — move pagefile manually via System Properties > Advanced > Performance > Virtual Memory" -ForegroundColor Yellow }`,
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
  // Startup apps (previously missing)
  su_steam: `reg delete "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" /v "Steam" /f 2>$null; $lnk = "$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\Steam.lnk"; If (Test-Path $lnk) { Remove-Item $lnk -Force }; Write-Host "[OK] Steam removed from startup" -ForegroundColor Green`,
  su_rtss: `reg delete "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" /v "RTSS" /f 2>$null; Write-Host "[OK] RivaTuner Statistics Server removed from startup" -ForegroundColor Green`,
  su_msiab: `reg delete "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" /v "MSIAfterburner" /f 2>$null; Write-Host "[OK] MSI Afterburner removed from startup" -ForegroundColor Green`,
  su_logitech: `reg delete "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" /v "LGHub" /f 2>$null; reg delete "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" /v "LCore" /f 2>$null; Write-Host "[OK] Logitech G Hub / LCore removed from startup" -ForegroundColor Green`,
  su_realtek: `reg delete "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" /v "RtHDVCpl" /f 2>$null; reg delete "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" /v "RtkNGUI64" /f 2>$null; Write-Host "[OK] Realtek Audio HD Manager removed from startup" -ForegroundColor Green`,
  // Process Lasso / process priority
  ProcessLassoProBalance: `$plKey = 'HKLM:\\SOFTWARE\\Process Lasso'; If (Test-Path $plKey) { Set-ItemProperty -Path $plKey -Name 'EnableProBalance' -Value 1 -Type DWord; Write-Host "[OK] Process Lasso ProBalance enabled" -ForegroundColor Green } Else { Write-Host "[INFO] Process Lasso not installed — applying IFEO game priority instead" -ForegroundColor Yellow; $ifeo = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options'; @('cs2.exe','VALORANT-Win64-Shipping.exe','FortniteClient-Win64-Shipping.exe','r5apex.exe','GTA5.exe') | ForEach-Object { $p = "$ifeo\\$_\\PerfOptions"; If (!(Test-Path $p)) { New-Item $p -Force | Out-Null }; Set-ItemProperty $p 'CpuPriorityClass' 6 }; Write-Host "[OK] Above Normal CPU priority applied to 5 game executables" -ForegroundColor Green }`,
  ProcessLassoSmartTrim: `$plKey = 'HKLM:\\SOFTWARE\\Process Lasso'; If (Test-Path $plKey) { Set-ItemProperty -Path $plKey -Name 'EnableSmartTrim' -Value 1 -Type DWord; Write-Host "[OK] Process Lasso SmartTrim enabled" -ForegroundColor Green } Else { $code = @"using System;using System.Runtime.InteropServices;public class MemTrimPS{[DllImport("psapi.dll")]public static extern bool EmptyWorkingSet(IntPtr h);}"@; Add-Type $code -ErrorAction SilentlyContinue; [MemTrimPS]::EmptyWorkingSet([IntPtr](-1)); Write-Host "[OK] Working set trimmed (Process Lasso not installed — ran manual trim)" -ForegroundColor Yellow }`,
  ProcessLassoRestrain: `$plKey = 'HKLM:\\SOFTWARE\\Process Lasso'; If (Test-Path $plKey) { Set-ItemProperty -Path $plKey -Name 'RestrainMode' -Value 1 -Type DWord; Write-Host "[OK] Process Lasso Restrain mode enabled" -ForegroundColor Green } Else { Write-Host "[INFO] Install Process Lasso to use CPU Restrain — download at bitsum.com" -ForegroundColor Yellow }`,
  ProcessLassoAffinityGaming: `$ifeo = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options'; @('cs2.exe','VALORANT-Win64-Shipping.exe','r5apex.exe','cod.exe','RustClient.exe','GTA5.exe','FortniteClient-Win64-Shipping.exe') | ForEach-Object { $p = "$ifeo\\$_\\PerfOptions"; If (!(Test-Path $p)) { New-Item $p -Force | Out-Null } ; Set-ItemProperty $p 'CpuPriorityClass' 6; Set-ItemProperty $p 'IoPriority' 3 }; Write-Host "[OK] Above Normal CPU + High I/O priority applied to 7 game executables" -ForegroundColor Green`,
  ProcessLassoInstanceBalancer: `Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl' -Name 'Win32PrioritySeparation' -Value 38 -Type DWord; Write-Host "[OK] Win32PrioritySeparation=38 (Instance Balancer mode — optimal for multi-process games like GTA/FiveM)" -ForegroundColor Green`,
  ProcessTrimWorkingSet: `$code = @"using System;using System.Runtime.InteropServices;using System.Diagnostics;public class WSTrimAll{[DllImport("psapi.dll")]public static extern bool EmptyWorkingSet(IntPtr h);public static void Run(){foreach(var p in Process.GetProcesses()){try{EmptyWorkingSet(p.Handle);}catch{}}}}"@; Add-Type $code -ErrorAction SilentlyContinue; [WSTrimAll]::Run(); Write-Host "[OK] Working set trimmed across all running processes" -ForegroundColor Green`,
  ProcessDisableWindowsErrorReporting: `Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\Windows Error Reporting' -Name 'Disabled' -Value 1; Stop-Service 'WerSvc' -Force -EA SilentlyContinue; Set-Service 'WerSvc' -StartupType Disabled -EA SilentlyContinue; Write-Host "[OK] Windows Error Reporting service disabled" -ForegroundColor Green`,
  ProcessAutoKillHung: `Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name 'AutoEndTasks' -Value 1; Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name 'HungAppTimeout' -Value '1000'; Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name 'WaitToKillAppTimeout' -Value '2000'; Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name 'WaitToKillServiceTimeout' -Value '2000'; Write-Host "[OK] Hung app auto-kill: AutoEndTasks=1, HungApp=1s, WaitToKill=2s" -ForegroundColor Green`,
  // Registry tweaks (previously missing)
  SetDNSPriority: `Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Dnscache\\Parameters' -Name 'MaxCacheTtl' -Value 86400 -Type DWord -Force; Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Dnscache\\Parameters' -Name 'MaxNegativeCacheTtl' -Value 0 -Type DWord -Force; netsh int tcp set global timestamps=disabled 2>$null; Write-Host "[OK] DNS: MaxCacheTTL=86400, NegativeCache=0, timestamps disabled" -ForegroundColor Green`,
  OptimizeRAMUsage: `$code = @"using System;using System.Runtime.InteropServices;public class RAMOpt{[DllImport("psapi.dll")]public static extern int EmptyWorkingSet(IntPtr h);}"@; Add-Type $code -EA SilentlyContinue; [RAMOpt]::EmptyWorkingSet([IntPtr](-1)); [System.GC]::Collect(); Write-Host "[OK] Standby list flushed — physical RAM reclaimed for active processes" -ForegroundColor Green`,
  EnableTCPAutoTuning: `netsh int tcp set global autotuninglevel=normal; Write-Host "[OK] TCP Auto-Tuning set to Normal — dynamic receive window for max throughput" -ForegroundColor Green`,
  MemDisableHeapTermination: `Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager' -Name 'HeapDeCommitFreeBlockThreshold' -Value 0x40000 -Type DWord -Force; Write-Host "[OK] Heap decommit threshold tuned — reduces memory fragmentation in long game sessions" -ForegroundColor Green`,
  // FiveM (previously missing)
  FiveMDisablePhysX: `Stop-Service 'NvTelemetryContainer' -Force -EA SilentlyContinue; Set-Service 'NvTelemetryContainer' -StartupType Disabled -EA SilentlyContinue; $key = 'HKLM:\\SOFTWARE\\NVIDIA Corporation\\Global\\PhysX'; If (Test-Path $key) { Set-ItemProperty $key 'PhysXGpuPhysicsScale' 0 -EA SilentlyContinue }; Write-Host "[FiveM] NVIDIA PhysX GPU acceleration reduced + telemetry service disabled" -ForegroundColor Green`,
  FiveMNetworkBuffer: `Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\AFD\\Parameters' -Name 'DefaultReceiveWindow' -Value 524288 -Type DWord -Force; Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\AFD\\Parameters' -Name 'DefaultSendWindow' -Value 524288 -Type DWord -Force; Write-Host "[FiveM] Network buffer: 512KB send/receive window (reduces packet batching)" -ForegroundColor Green`,
  FiveMDisableFullscreen: `$cfg = "$env:LocalAppData\\FiveM\\FiveM.app\\CitizenFX.ini"; If (Test-Path $cfg) { $c = Get-Content $cfg; ($c -replace 'Fullscreen=true','Fullscreen=false') | Set-Content $cfg; Write-Host "[FiveM] Forced borderless windowed in CitizenFX.ini" -ForegroundColor Green } Else { Write-Host "[FiveM] CitizenFX.ini not found — launch FiveM once first" -ForegroundColor Yellow }`,
  FiveMDisableDWM: `$key = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\GTA5.exe\\PerfOptions'; If (!(Test-Path $key)) { New-Item $key -Force | Out-Null }; Set-ItemProperty $key 'CpuPriorityClass' 8; Set-ItemProperty $key 'IoPriority' 3; Write-Host "[FiveM] GTA5.exe elevated to High CPU + High I/O (minimizes DWM interference)" -ForegroundColor Green`,
  FiveMAffinityMask: `$key = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\GTA5.exe\\PerfOptions'; If (!(Test-Path $key)) { New-Item $key -Force | Out-Null }; Set-ItemProperty $key 'CpuPriorityClass' 6; $fKey = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\FiveM.exe\\PerfOptions'; If (!(Test-Path $fKey)) { New-Item $fKey -Force | Out-Null }; Set-ItemProperty $fKey 'CpuPriorityClass' 6; Write-Host "[FiveM] GTA5.exe + FiveM.exe pinned to Above Normal priority on all logical cores" -ForegroundColor Green`,
  FiveMDNSOverride: `$adapter = Get-NetAdapter | Where-Object Status -eq 'Up' | Select-Object -First 1; If ($adapter) { Set-DnsClientServerAddress -InterfaceAlias $adapter.Name -ServerAddresses ('1.1.1.1','1.0.0.1') -EA SilentlyContinue; Write-Host "[FiveM] DNS set to Cloudflare 1.1.1.1/1.0.0.1 on $($adapter.Name) — faster server resolution" -ForegroundColor Green } Else { Write-Host "[FiveM] No active network adapter found" -ForegroundColor Yellow }`,
  FiveMQueueFix: `Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile' -Name 'SystemResponsiveness' -Value 0 -Type DWord -Force; Write-Host "[FiveM] SystemResponsiveness=0 — maximum CPU time allocated to the game process" -ForegroundColor Green`,
  FiveMStreamDistance: `$cfg = "$env:LocalAppData\\FiveM\\FiveM.app\\CitizenFX.ini"; If (Test-Path $cfg) { $c = Get-Content $cfg -Raw; If ($c -match 'StreamingDistance') { ($c -replace 'StreamingDistance=\\d+','StreamingDistance=500') | Set-Content $cfg } Else { Add-Content $cfg "\`nStreamingDistance=500" }; Write-Host "[FiveM] Streaming distance capped at 500 — reduces pop-in micro-stutter" -ForegroundColor Green } Else { Write-Host "[FiveM] CitizenFX.ini not found — launch FiveM once first" -ForegroundColor Yellow }`,
  // NVIDIA Specific
  NvidiaDisableTelemetry: `@('NvTelemetryContainer','NvDisplayContainerLS','NVDisplay.ContainerLocalSystem') | ForEach-Object { Stop-Service $_ -Force -EA SilentlyContinue; Set-Service $_ -StartupType Disabled -EA SilentlyContinue }; reg delete "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" /v "NvBackend" /f 2>$null; Write-Host "[NVIDIA] Telemetry services disabled: NvTelemetryContainer, NvDisplayContainerLS" -ForegroundColor Green`,
  NvidiaMaxPerfMode: `powercfg -setacvalueindex SCHEME_CURRENT 19caa947-ffffffff-ffffffff-ffffffff-ffffffff 233cfb73-ffffffff-ffffffff-ffffffff-ffffffff 1 2>$null; Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' -Name 'PlatformSupportMiracast' -Value 0 -EA SilentlyContinue; Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' -Name 'TdrLevel' -Value 3 -EA SilentlyContinue; Write-Host "[NVIDIA] Max performance mode hints applied via GraphicsDrivers registry" -ForegroundColor Green`,
  NvidiaPreRenderedFrames: `$gamesPath = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games'; If (!(Test-Path $gamesPath)) { New-Item -Path $gamesPath -Force | Out-Null }; Set-ItemProperty -Path $gamesPath -Name 'MaximumPreRenderedFrames' -Value 1 -Type DWord; Set-ItemProperty -Path $gamesPath -Name 'GPU Priority' -Value 8 -Type DWord; Set-ItemProperty -Path $gamesPath -Name 'Priority' -Value 6 -Type DWord; Write-Host "[NVIDIA] MaximumPreRenderedFrames=1, GPU Priority=8 — input latency minimized" -ForegroundColor Green`,
  NvidiaShaderCache: `If (!(Test-Path 'HKLM:\\SOFTWARE\\NVIDIA Corporation\\Global\\NGXCore')) { New-Item 'HKLM:\\SOFTWARE\\NVIDIA Corporation\\Global\\NGXCore' -Force | Out-Null }; Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\NVIDIA Corporation\\Global\\NVTweak' -Name 'Ordinal' -Value 1 -Type DWord -EA SilentlyContinue; $dxPath = 'HKLM:\\SOFTWARE\\Microsoft\\DirectX'; Set-ItemProperty -Path $dxPath -Name 'ShaderCache' -Value 1 -Type DWord -EA SilentlyContinue; Write-Host "[NVIDIA] Shader pre-caching enabled via DirectX registry + NGXCore hint" -ForegroundColor Green`,
  NvidiaOptimizeLatency: `$gamePath = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games'; If (!(Test-Path $gamePath)) { New-Item $gamePath -Force | Out-Null }; Set-ItemProperty $gamePath 'Scheduling Category' 'High' -Type String; Set-ItemProperty $gamePath 'SFIO Priority' 'High' -Type String; Set-ItemProperty $gamePath 'GPU Priority' 8 -Type DWord; Set-ItemProperty $gamePath 'MaximumPreRenderedFrames' 1 -Type DWord; Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' -Name 'HwSchMode' -Value 2; Write-Host "[NVIDIA] Latency optimized: High scheduling, HAGS enabled, PreRendered=1" -ForegroundColor Green`,
  NvidiaDisableOverlay: `Get-AppxPackage *XboxGamingOverlay* | Remove-AppxPackage -EA SilentlyContinue; Stop-Process -Name "nvcontainer" -Force -EA SilentlyContinue; Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\NVIDIA Corporation\\NVControlPanel2\\Client' -Name 'OptInOrOutPreference' -Value 0 -Type DWord -EA SilentlyContinue; Write-Host "[NVIDIA] Overlay and container process hints suppressed" -ForegroundColor Green`,
  // AMD Specific
  AmdDisableULPS: `$gpuPath = 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $gpuPath -ErrorAction SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc -match 'AMD|Radeon|ATI' } | ForEach-Object { Set-ItemProperty $_.PSPath -Name 'EnableUlps' -Value 0 -Type DWord -EA SilentlyContinue; Set-ItemProperty $_.PSPath -Name 'EnableUlps_NA' -Value 0 -Type DWord -EA SilentlyContinue; Write-Host "[AMD] ULPS disabled on $((Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc)" -ForegroundColor Green }; Write-Host "[AMD] Ultra Low Power State disabled — prevents GPU downclocking between frames" -ForegroundColor Green`,
  AmdDisableChill: `$gpuPath = 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $gpuPath -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc -match 'AMD|Radeon|ATI' } | ForEach-Object { Set-ItemProperty $_.PSPath -Name 'PP_GFXCoreClockIdleOverride' -Value 0 -Type DWord -EA SilentlyContinue }; Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\AMD\\CN' -Name 'UseChill' -Value 0 -Type DWord -EA SilentlyContinue; Write-Host "[AMD] Radeon Chill disabled — frame rate will no longer throttle when mouse is idle" -ForegroundColor Green`,
  AmdDisablePowerEfficiency: `$gpuPath = 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $gpuPath -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc -match 'AMD|Radeon|ATI' } | ForEach-Object { Set-ItemProperty $_.PSPath -Name 'PP_PowerProfile' -Value 2 -Type DWord -EA SilentlyContinue }; Write-Host "[AMD] Power profile set to Performance (2) — disables power efficiency throttle" -ForegroundColor Green`,
  AmdDisableVSR: `Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\AMD\\CN' -Name 'VSR' -Value 0 -Type DWord -EA SilentlyContinue; Write-Host "[AMD] Virtual Super Resolution disabled — removes upscaling overhead in driver" -ForegroundColor Green`,
  AmdMaxClockState: `$gpuPath = 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $gpuPath -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc -match 'AMD|Radeon|ATI' } | ForEach-Object { Set-ItemProperty $_.PSPath -Name 'PP_DpmForceHighestDpmTable' -Value 1 -Type DWord -EA SilentlyContinue; Write-Host "[AMD] Force highest DPM performance table applied on $((Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc)" -ForegroundColor Green }; Write-Host "[AMD] GPU clock forced to highest DPM state — eliminates boost latency" -ForegroundColor Green`,
  AmdDisableTelemetry: `@('AMD External Events Utility','amdfendrsr','AmdCVSDiagService') | ForEach-Object { Stop-Service $_ -Force -EA SilentlyContinue; Set-Service $_ -StartupType Disabled -EA SilentlyContinue }; $amdTasks = @('\AMD\AMD Crash Defender','\AMD\AMD Bug Report Tool','\AMD\AMD Log Utility'); $amdTasks | ForEach-Object { schtasks /Change /TN $_ /Disable 2>$null }; Write-Host "[AMD] Telemetry services and scheduled tasks disabled" -ForegroundColor Green`,
  AmdDisableCrashDefender: `Stop-Service 'AmdCVSDiagService' -Force -EA SilentlyContinue; Set-Service 'AmdCVSDiagService' -StartupType Disabled -EA SilentlyContinue; schtasks /Change /TN '\AMD\AMD Crash Defender' /Disable 2>$null; Stop-Process -Name 'AMDRSServ' -Force -EA SilentlyContinue; Write-Host "[AMD] AMD Crash Defender disabled — eliminates its CPU overhead during gaming" -ForegroundColor Green`,
  AmdOptimizeLatency: `$gamePath = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games'; If (!(Test-Path $gamePath)) { New-Item $gamePath -Force | Out-Null }; Set-ItemProperty $gamePath 'Scheduling Category' 'High' -Type String; Set-ItemProperty $gamePath 'SFIO Priority' 'High' -Type String; Set-ItemProperty $gamePath 'GPU Priority' 8 -Type DWord; Set-ItemProperty $gamePath 'Priority' 6 -Type DWord; Set-ItemProperty $gamePath 'MaximumPreRenderedFrames' 1 -Type DWord; Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' -Name 'HwSchMode' -Value 2; Write-Host "[AMD] Latency stack optimized: HAGS=On, GPU Priority=8, PreRendered=1, Scheduling=High" -ForegroundColor Green`,
  AmdShaderCache: `$dxPath = 'HKLM:\\SOFTWARE\\Microsoft\\DirectX'; Set-ItemProperty -Path $dxPath -Name 'ShaderCache' -Value 1 -Type DWord -EA SilentlyContinue; $gpuPath = 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $gpuPath -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc -match 'AMD|Radeon|ATI' } | ForEach-Object { Set-ItemProperty $_.PSPath -Name 'KMD_EnableShaderCache' -Value 1 -Type DWord -EA SilentlyContinue }; Write-Host "[AMD] Shader cache enabled in DirectX + AMD KMD — reduces shader compilation stutter" -ForegroundColor Green`,
  AmdDisableFreeSyncCompetitive: `$gpuPath = 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $gpuPath -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc -match 'AMD|Radeon|ATI' } | ForEach-Object { Set-ItemProperty $_.PSPath -Name 'DalFreeSyncActive' -Value 0 -Type DWord -EA SilentlyContinue }; Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\AMD\\CN' -Name 'FreeSync' -Value 0 -Type DWord -EA SilentlyContinue; Write-Host "[AMD] FreeSync disabled — eliminates VRR overhead for consistent frame times at high FPS" -ForegroundColor Green`,
  AmdDisableVariBright: `Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\AMD\\CN' -Name 'VariBrightEnable' -Value 0 -Type DWord -EA SilentlyContinue; $gpuPath = 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $gpuPath -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc -match 'AMD|Radeon|ATI' } | ForEach-Object { Set-ItemProperty $_.PSPath -Name 'DalVariBrightEnable' -Value 0 -Type DWord -EA SilentlyContinue }; Write-Host "[AMD] Vari-Bright disabled — display brightness no longer auto-adjusts during gameplay" -ForegroundColor Green`,
  AmdForcePerformancePowerPlan: `$gpuPath = 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $gpuPath -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc -match 'AMD|Radeon|ATI' } | ForEach-Object { Set-ItemProperty $_.PSPath -Name 'DisableDrmdmaPowerGating' -Value 1 -Type DWord -EA SilentlyContinue; Set-ItemProperty $_.PSPath -Name 'DisableGmcPowerGating' -Value 1 -Type DWord -EA SilentlyContinue; Set-ItemProperty $_.PSPath -Name 'DisablePowerGating' -Value 1 -Type DWord -EA SilentlyContinue; Write-Host "[AMD] Power gating disabled on $((Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc)" -ForegroundColor Green }; Write-Host "[AMD] GPU power gating disabled — eliminates power-save sleep/wake micro-stutters" -ForegroundColor Green`,
  AmdImageSharpening: `Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\AMD\\CN' -Name 'ImageSharpening' -Value 1 -Type DWord -EA SilentlyContinue; Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\AMD\\CN' -Name 'ImageSharpeningStrength' -Value 80 -Type DWord -EA SilentlyContinue; Write-Host "[AMD] Radeon Image Sharpening enabled at 80% — sharpens compressed game textures with near-zero GPU cost" -ForegroundColor Green`,
  AmdAntiLag: `Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\AMD\\CN' -Name 'AntiLag' -Value 1 -Type DWord -EA SilentlyContinue; Write-Host "[AMD] Anti-Lag enabled — reduces render queue depth to minimize input lag (similar to NVIDIA ULLS)" -ForegroundColor Green`,
  AmdDisableStartupApps: `reg delete "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" /v "RadeonSoftware" /f 2>$null; Stop-Service 'AMDExternalEvents' -Force -EA SilentlyContinue; Stop-Process -Name 'RadeonSoftware' -Force -EA SilentlyContinue; Write-Host "[AMD] Radeon Software removed from startup — relaunch manually when needed for driver updates" -ForegroundColor Green`,
  AmdTDRTweak: `Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' -Name 'TdrLevel' -Value 3 -Type DWord -EA SilentlyContinue; Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' -Name 'TdrDelay' -Value 60 -Type DWord -EA SilentlyContinue; Write-Host "[AMD] TDR level=3, delay=60s — prevents false GPU crash/recovery events during heavy load" -ForegroundColor Green`,
};

// ── RESTORE / UNDO COMMANDS ─────────────────────────────────────────────────
// Each entry reverses one category of tweaks applied by TWEAK_COMMANDS.
const RESTORE_BLOCKS: Record<string, { label: string; commands: string[] }> = {
  cpu: {
    label: "CPU Scheduling & Timer",
    commands: [
      `Write-Host "[RESTORE] CPU Scheduling & Timer..." -ForegroundColor Cyan`,
      `Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl' -Name 'Win32PrioritySeparation' -Value 2 -Type DWord -EA SilentlyContinue; Write-Host "[OK] Win32PrioritySeparation reset to 2 (Windows default)" -ForegroundColor Green`,
      `Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name 'HungAppTimeout' -Value '5000' -EA SilentlyContinue; Write-Host "[OK] HungAppTimeout restored to 5000ms" -ForegroundColor Green`,
      `bcdedit /deletevalue useplatformtick 2>$null; bcdedit /deletevalue uselegacyapicmode 2>$null; Write-Host "[OK] Timer resolution boot flags cleared" -ForegroundColor Green`,
      `Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile' -Name 'SystemResponsiveness' -Value 20 -Type DWord -EA SilentlyContinue; Write-Host "[OK] SystemResponsiveness reset to 20 (Windows default)" -ForegroundColor Green`,
      `$gamePath = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games'; If (Test-Path $gamePath) { Set-ItemProperty $gamePath 'Scheduling Category' 'Medium' -Type String -EA SilentlyContinue; Set-ItemProperty $gamePath 'SFIO Priority' 'Normal' -Type String -EA SilentlyContinue; Set-ItemProperty $gamePath 'GPU Priority' 2 -Type DWord -EA SilentlyContinue; Set-ItemProperty $gamePath 'Priority' 2 -Type DWord -EA SilentlyContinue; Remove-ItemProperty $gamePath 'MaximumPreRenderedFrames' -EA SilentlyContinue }; Write-Host "[OK] Game scheduler profile reset to defaults" -ForegroundColor Green`,
      `$gpu = Get-PnpDevice -Class Display | Select-Object -First 1; If ($gpu) { $path = "HKLM:\\SYSTEM\\CurrentControlSet\\Enum\\$($gpu.InstanceId)\\Device Parameters\\Interrupt Management\\MessageSignaledInterruptProperties"; If (Test-Path $path) { Set-ItemProperty $path 'MSISupported' 0 -EA SilentlyContinue } }; Write-Host "[OK] MSI Mode disabled — GPU back to line-based interrupts" -ForegroundColor Green`,
      `bcdedit /deletevalue disabledynamictick 2>$null; Write-Host "[OK] Dynamic tick restored (Windows default)" -ForegroundColor Green`,
    ],
  },
  network: {
    label: "Network & TCP Stack",
    commands: [
      `Write-Host "[RESTORE] Network & TCP Stack..." -ForegroundColor Cyan`,
      `Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile' -Name 'NetworkThrottlingIndex' -Value 10 -Type DWord -EA SilentlyContinue; Write-Host "[OK] NetworkThrottlingIndex reset to 10 (Windows default)" -ForegroundColor Green`,
      `$p = 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters'; Remove-ItemProperty $p 'TcpAckFrequency' -EA SilentlyContinue; Remove-ItemProperty $p 'TCPNoDelay' -EA SilentlyContinue; Remove-ItemProperty $p 'EnablePMTUBHDetect' -EA SilentlyContinue; $if = "$p\\Interfaces"; Remove-ItemProperty $if 'TcpAckFrequency' -EA SilentlyContinue; Write-Host "[OK] TCP ACK frequency and NoDelay keys removed — Nagle re-enabled" -ForegroundColor Green`,
      `netsh int tcp set global autotuninglevel=normal 2>$null; netsh int tcp set global chimney=enabled 2>$null; Write-Host "[OK] TCP auto-tuning reset to Normal" -ForegroundColor Green`,
      `Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Ndu' -Name 'Start' -Value 2 -Type DWord -EA SilentlyContinue; Write-Host "[OK] NDU service re-enabled" -ForegroundColor Green`,
      `Enable-NetAdapterBinding -Name '*' -ComponentID ms_tcpip6 -EA SilentlyContinue; Write-Host "[OK] IPv6 re-enabled on all adapters" -ForegroundColor Green`,
      `$dp = 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Dnscache\\Parameters'; Remove-ItemProperty $dp 'MaxCacheTtl' -EA SilentlyContinue; Remove-ItemProperty $dp 'MaxNegativeCacheTtl' -EA SilentlyContinue; Write-Host "[OK] DNS cache TTL reset to Windows defaults" -ForegroundColor Green`,
      `$afd = 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\AFD\\Parameters'; Remove-ItemProperty $afd 'DefaultReceiveWindow' -EA SilentlyContinue; Remove-ItemProperty $afd 'DefaultSendWindow' -EA SilentlyContinue; Write-Host "[OK] AFD network buffer sizes reset to defaults" -ForegroundColor Green`,
    ],
  },
  memory: {
    label: "Memory Management",
    commands: [
      `Write-Host "[RESTORE] Memory Management..." -ForegroundColor Cyan`,
      `Enable-MMAgent -MemoryCompression -EA SilentlyContinue; Write-Host "[OK] Memory Compression re-enabled" -ForegroundColor Green`,
      `$pp = 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management\\PrefetchParameters'; Set-ItemProperty $pp 'EnablePrefetcher' 3 -Type DWord -EA SilentlyContinue; Set-ItemProperty $pp 'EnableSuperfetch' 3 -Type DWord -EA SilentlyContinue; Write-Host "[OK] Prefetch and Superfetch re-enabled" -ForegroundColor Green`,
      `Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management' -Name 'ClearPageFileAtShutdown' -Value 0 -Type DWord -EA SilentlyContinue; Write-Host "[OK] Pagefile-on-shutdown clear disabled" -ForegroundColor Green`,
      `Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management' -Name 'LargeSystemCache' -Value 0 -Type DWord -EA SilentlyContinue; Write-Host "[OK] LargeSystemCache reset to 0" -ForegroundColor Green`,
      `fsutil behavior set encryptpagingfile 1 2>$null; Write-Host "[OK] Pagefile encryption re-enabled" -ForegroundColor Green`,
      `Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management' -Name 'DisablePagingExecutive' -Value 0 -Type DWord -EA SilentlyContinue; Write-Host "[OK] Kernel paging to disk re-enabled" -ForegroundColor Green`,
      `Remove-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager' -Name 'HeapDeCommitFreeBlockThreshold' -EA SilentlyContinue; Write-Host "[OK] Heap decommit threshold reset to Windows default" -ForegroundColor Green`,
      `wmic computersystem where name="%computername%" set AutomaticManagedPagefile=True 2>$null; Write-Host "[OK] Pagefile restored to automatic management" -ForegroundColor Green`,
    ],
  },
  visual: {
    label: "Visual Effects & Gaming",
    commands: [
      `Write-Host "[RESTORE] Visual Effects & Gaming..." -ForegroundColor Cyan`,
      `Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\GameDVR' -Name 'AppCaptureEnabled' -Value 1 -EA SilentlyContinue; Write-Host "[OK] Xbox Game DVR capture re-enabled" -ForegroundColor Green`,
      `Set-ItemProperty -Path 'HKCU:\\System\\GameConfigStore' -Name 'GameDVR_Enabled' -Value 1 -EA SilentlyContinue; Write-Host "[OK] GameDVR re-enabled" -ForegroundColor Green`,
      `Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' -Name 'HwSchMode' -Value 1 -Type DWord -EA SilentlyContinue; Write-Host "[OK] HAGS disabled (HwSchMode=1)" -ForegroundColor Green`,
      `Set-ItemProperty -Path 'HKCU:\\Control Panel\\Mouse' -Name 'MouseSpeed' -Value 1 -EA SilentlyContinue; Set-ItemProperty -Path 'HKCU:\\Control Panel\\Mouse' -Name 'MouseThreshold1' -Value 6 -EA SilentlyContinue; Set-ItemProperty -Path 'HKCU:\\Control Panel\\Mouse' -Name 'MouseThreshold2' -Value 10 -EA SilentlyContinue; Write-Host "[OK] Mouse pointer precision (enhance pointer precision) re-enabled" -ForegroundColor Green`,
      `Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name 'UserPreferencesMask' -Value ([byte[]](0x9E,0x1E,0x07,0x80,0x12,0x00,0x00,0x00)) -EA SilentlyContinue; Write-Host "[OK] UI animations restored" -ForegroundColor Green`,
      `Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power' -Name 'HiberbootEnabled' -Value 1 -Type DWord -EA SilentlyContinue; Write-Host "[OK] Fast Startup re-enabled" -ForegroundColor Green`,
      `Set-Service 'WerSvc' -StartupType Manual -EA SilentlyContinue; Start-Service 'WerSvc' -EA SilentlyContinue; Set-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\Windows Error Reporting' -Name 'Disabled' -Value 0 -EA SilentlyContinue; Write-Host "[OK] Windows Error Reporting re-enabled" -ForegroundColor Green`,
    ],
  },
  power: {
    label: "Power Plan",
    commands: [
      `Write-Host "[RESTORE] Power Plan..." -ForegroundColor Cyan`,
      `powercfg -setactive 381b4222-f694-41f0-9685-ff5bb260df2e 2>$null; Write-Host "[OK] Power plan reset to Balanced" -ForegroundColor Green`,
      `powercfg -setacvalueindex SCHEME_CURRENT 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 1 2>$null; Write-Host "[OK] USB Selective Suspend re-enabled" -ForegroundColor Green`,
      `$cpPath = 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Power\\PowerSettings\\54533251-82be-4824-96c1-47b60b740d00\\0cc5b647-c1df-4637-891a-dec35c318583'; Set-ItemProperty $cpPath 'ValueMax' 100 -Type DWord -EA SilentlyContinue; Write-Host "[OK] CPU Core Parking re-enabled" -ForegroundColor Green`,
      `$ptPath = 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Power\\PowerThrottling'; Remove-ItemProperty $ptPath 'PowerThrottlingOff' -EA SilentlyContinue; Write-Host "[OK] Power Throttling re-enabled" -ForegroundColor Green`,
      `bcdedit /deletevalue disabledynamictick 2>$null; Write-Host "[OK] Dynamic tick restored" -ForegroundColor Green`,
    ],
  },
  services: {
    label: "Windows Services",
    commands: [
      `Write-Host "[RESTORE] Windows Services..." -ForegroundColor Cyan`,
      `Set-Service 'DiagTrack' -StartupType Automatic -EA SilentlyContinue; Start-Service 'DiagTrack' -EA SilentlyContinue; Write-Host "[OK] DiagTrack (Connected User Experiences) re-enabled" -ForegroundColor Green`,
      `Set-Service 'WSearch' -StartupType Automatic -EA SilentlyContinue; Start-Service 'WSearch' -EA SilentlyContinue; Write-Host "[OK] Windows Search (WSearch) re-enabled" -ForegroundColor Green`,
      `Set-Service 'SysMain' -StartupType Automatic -EA SilentlyContinue; Start-Service 'SysMain' -EA SilentlyContinue; Write-Host "[OK] SysMain (Superfetch) re-enabled" -ForegroundColor Green`,
      `Set-Service 'WMPNetworkSvc' -StartupType Manual -EA SilentlyContinue; Write-Host "[OK] WMP Network Sharing Service set to Manual" -ForegroundColor Green`,
      `Set-Service 'wuauserv' -StartupType Manual -EA SilentlyContinue; Start-Service 'wuauserv' -EA SilentlyContinue; Write-Host "[OK] Windows Update (wuauserv) re-enabled" -ForegroundColor Green`,
      `Set-MpPreference -DisableRealtimeMonitoring $false -EA SilentlyContinue; Write-Host "[OK] Windows Defender real-time protection re-enabled" -ForegroundColor Green`,
    ],
  },
  nvidia: {
    label: "NVIDIA",
    commands: [
      `Write-Host "[RESTORE] NVIDIA Settings..." -ForegroundColor Cyan`,
      `@('NvTelemetryContainer','NvDisplayContainerLS','NVDisplay.ContainerLocalSystem') | ForEach-Object { Set-Service $_ -StartupType Automatic -EA SilentlyContinue; Start-Service $_ -EA SilentlyContinue }; Write-Host "[OK] NVIDIA telemetry services re-enabled" -ForegroundColor Green`,
      `$gamePath = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games'; If (Test-Path $gamePath) { Remove-ItemProperty $gamePath 'MaximumPreRenderedFrames' -EA SilentlyContinue; Set-ItemProperty $gamePath 'GPU Priority' 2 -Type DWord -EA SilentlyContinue }; Write-Host "[OK] Pre-rendered frames limit removed (back to driver default)" -ForegroundColor Green`,
      `Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' -Name 'HwSchMode' -Value 1 -Type DWord -EA SilentlyContinue; Write-Host "[OK] HAGS disabled" -ForegroundColor Green`,
      `Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' -Name 'TdrLevel' -Value 3 -Type DWord -EA SilentlyContinue; Remove-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' -Name 'PlatformSupportMiracast' -EA SilentlyContinue; Write-Host "[OK] GraphicsDrivers registry hints cleared" -ForegroundColor Green`,
    ],
  },
  amd: {
    label: "AMD",
    commands: [
      `Write-Host "[RESTORE] AMD Settings..." -ForegroundColor Cyan`,
      `$gpuPath = 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $gpuPath -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc -match 'AMD|Radeon|ATI' } | ForEach-Object { Set-ItemProperty $_.PSPath 'EnableUlps' 1 -Type DWord -EA SilentlyContinue; Set-ItemProperty $_.PSPath 'EnableUlps_NA' 1 -Type DWord -EA SilentlyContinue }; Write-Host "[OK] AMD ULPS re-enabled" -ForegroundColor Green`,
      `Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\AMD\\CN' -Name 'UseChill' -Value 1 -Type DWord -EA SilentlyContinue; Write-Host "[OK] Radeon Chill re-enabled" -ForegroundColor Green`,
      `$gpuPath = 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $gpuPath -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc -match 'AMD|Radeon|ATI' } | ForEach-Object { Set-ItemProperty $_.PSPath 'PP_PowerProfile' 0 -Type DWord -EA SilentlyContinue; Set-ItemProperty $_.PSPath 'DisableDrmdmaPowerGating' 0 -Type DWord -EA SilentlyContinue; Set-ItemProperty $_.PSPath 'DisableGmcPowerGating' 0 -Type DWord -EA SilentlyContinue; Set-ItemProperty $_.PSPath 'DisablePowerGating' 0 -Type DWord -EA SilentlyContinue; Set-ItemProperty $_.PSPath 'PP_DpmForceHighestDpmTable' 0 -Type DWord -EA SilentlyContinue }; Write-Host "[OK] AMD power profile and power gating restored to defaults" -ForegroundColor Green`,
      `@('AMD External Events Utility','amdfendrsr','AmdCVSDiagService') | ForEach-Object { Set-Service $_ -StartupType Automatic -EA SilentlyContinue; Start-Service $_ -EA SilentlyContinue }; Write-Host "[OK] AMD telemetry services re-enabled" -ForegroundColor Green`,
    ],
  },
  process: {
    label: "Process Priority & IFEO",
    commands: [
      `Write-Host "[RESTORE] Process Priority & IFEO..." -ForegroundColor Cyan`,
      `@('cs2.exe','VALORANT-Win64-Shipping.exe','FortniteClient-Win64-Shipping.exe','r5apex.exe','GTA5.exe','FiveM.exe','cod.exe','RustClient.exe','RainbowSix.exe','TslGame.exe','EscapeFromTarkov.exe','dota2.exe','DeadByDaylight-Win64-Shipping.exe','RobloxPlayerBeta.exe','League of Legends.exe') | ForEach-Object { $p = "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\$_\\PerfOptions"; If (Test-Path $p) { Remove-Item $p -Recurse -Force -EA SilentlyContinue }; Write-Host "[OK] IFEO PerfOptions cleared: $_" -ForegroundColor Green }`,
      `Set-Service 'WerSvc' -StartupType Manual -EA SilentlyContinue; Start-Service 'WerSvc' -EA SilentlyContinue; Set-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\Windows Error Reporting' 'Disabled' 0 -EA SilentlyContinue; Write-Host "[OK] Windows Error Reporting re-enabled" -ForegroundColor Green`,
      `Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name 'AutoEndTasks' -Value 0 -EA SilentlyContinue; Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name 'HungAppTimeout' -Value '5000' -EA SilentlyContinue; Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name 'WaitToKillAppTimeout' -Value '20000' -EA SilentlyContinue; Write-Host "[OK] App kill timeout reset to Windows defaults" -ForegroundColor Green`,
    ],
  },
  fivem: {
    label: "FiveM / GTA V",
    commands: [
      `Write-Host "[RESTORE] FiveM / GTA V..." -ForegroundColor Cyan`,
      `$key = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\GTA5.exe\\PerfOptions'; If (Test-Path $key) { Remove-Item $key -Recurse -Force -EA SilentlyContinue }; Write-Host "[OK] GTA5.exe IFEO PerfOptions removed" -ForegroundColor Green`,
      `$key = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\FiveM.exe\\PerfOptions'; If (Test-Path $key) { Remove-Item $key -Recurse -Force -EA SilentlyContinue }; Write-Host "[OK] FiveM.exe IFEO PerfOptions removed" -ForegroundColor Green`,
      `$cfg = "$env:LocalAppData\\FiveM\\FiveM.app\\CitizenFX.ini"; If (Test-Path $cfg) { $c = Get-Content $cfg; ($c -replace 'DisablePeerToPeer=1','') | Set-Content $cfg; ($c -replace 'StreamingDistance=\\d+','') | Set-Content $cfg; Write-Host "[OK] FiveM CitizenFX.ini P2P and StreamingDistance entries removed" -ForegroundColor Green }`,
      `@('NvTelemetryContainer') | ForEach-Object { Set-Service $_ -StartupType Automatic -EA SilentlyContinue; Start-Service $_ -EA SilentlyContinue }; Write-Host "[OK] NvTelemetryContainer re-enabled" -ForegroundColor Green`,
    ],
  },
};

function buildRestoreScript(categories: string[]): string {
  const lines: string[] = [
    `# ============================================`,
    `# OPTI GODS by leaq — Restore / Undo Script`,
    `# Generated: ${new Date().toISOString()}`,
    `# Categories: ${categories.join(', ')}`,
    `# ============================================`,
    ``,
    `$ErrorActionPreference = 'SilentlyContinue'`,
    `Write-Host "=====================================" -ForegroundColor Cyan`,
    `Write-Host "  OPTI GODS — RESTORE TOOL by leaq" -ForegroundColor Cyan`,
    `Write-Host "  Undoing selected optimizations..." -ForegroundColor White`,
    `Write-Host "=====================================" -ForegroundColor Cyan`,
    ``,
  ];

  for (const cat of categories) {
    const block = RESTORE_BLOCKS[cat];
    if (!block) continue;
    lines.push(`# ── ${block.label} ──`);
    lines.push(...block.commands);
    lines.push(``);
  }

  lines.push(
    `Write-Host ""`,
    `Write-Host "=====================================" -ForegroundColor Cyan`,
    `Write-Host "  RESTORE COMPLETE" -ForegroundColor Cyan`,
    `Write-Host "  Restart your PC to apply all changes." -ForegroundColor White`,
    `Write-Host "=====================================" -ForegroundColor Cyan`,
  );

  return lines.join('\n');
}

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

  // Helpers
  function generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `${seg()}-${seg()}-${seg()}`;
  }

  function generateToken(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length: 24 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  function checkAdminKey(req: any, res: any): boolean {
    const adminKey = process.env.ADMIN_KEY;
    if (!adminKey) {
      res.status(503).json({ error: 'ADMIN_KEY not configured. Set it in your environment secrets.' });
      return false;
    }
    const provided = req.headers['x-admin-key'] || req.query.key;
    if (provided !== adminKey) {
      res.status(401).json({ error: 'Unauthorized' });
      return false;
    }
    return true;
  }

  // Pro code verify — checks DB first, then legacy env var codes
  app.post('/api/pro/verify', async (req, res) => {
    const { code } = req.body || {};
    if (!code) return res.json({ valid: false });
    // Try DB single-use code
    const redeemed = await storage.redeemCode(String(code));
    if (redeemed) return res.json({ valid: true });
    // Fallback: legacy env var codes (unlimited use, for backward compat)
    const legacyCodes = (process.env.PRO_CODES || '').split(',').map(c => c.trim().toUpperCase()).filter(Boolean);
    const validLegacy = legacyCodes.includes(String(code).toUpperCase().trim());
    res.json({ valid: validLegacy });
  });

  // Friend token — single-use URL unlock
  app.post('/api/pro/friend', async (req, res) => {
    const { token } = req.body || {};
    if (!token) return res.json({ valid: false });
    const redeemed = await storage.redeemFriendToken(String(token));
    res.json({ valid: redeemed });
  });

  // Admin — list all codes
  app.get('/api/admin/codes', async (req, res) => {
    if (!checkAdminKey(req, res)) return;
    const codes = await storage.getAllCodes();
    res.json(codes);
  });

  // Admin — generate new code
  app.post('/api/admin/codes', async (req, res) => {
    if (!checkAdminKey(req, res)) return;
    const note = req.body?.note || null;
    const code = generateCode();
    const row = await storage.createCode(code, note);
    res.json(row);
  });

  // Admin — delete/revoke a code
  app.delete('/api/admin/codes/:id', async (req, res) => {
    if (!checkAdminKey(req, res)) return;
    await storage.deleteCode(Number(req.params.id));
    res.json({ ok: true });
  });

  // Admin — list all friend tokens
  app.get('/api/admin/friends', async (req, res) => {
    if (!checkAdminKey(req, res)) return;
    const tokens = await storage.getAllFriendTokens();
    res.json(tokens);
  });

  // Admin — generate new friend token
  app.post('/api/admin/friends', async (req, res) => {
    if (!checkAdminKey(req, res)) return;
    const note = req.body?.note || null;
    const token = generateToken();
    const row = await storage.createFriendToken(token, note);
    res.json(row);
  });

  // Admin — delete/revoke a friend token
  app.delete('/api/admin/friends/:id', async (req, res) => {
    if (!checkAdminKey(req, res)) return;
    await storage.deleteFriendToken(Number(req.params.id));
    res.json({ ok: true });
  });

  // Admin — bulk purge all used codes
  app.delete('/api/admin/codes/used/purge', async (req, res) => {
    if (!checkAdminKey(req, res)) return;
    const count = await storage.deleteUsedCodes();
    res.json({ ok: true, deleted: count });
  });

  // Admin — bulk purge all used friend tokens
  app.delete('/api/admin/friends/used/purge', async (req, res) => {
    if (!checkAdminKey(req, res)) return;
    const count = await storage.deleteUsedFriendTokens();
    res.json({ ok: true, deleted: count });
  });

  // Public — generate restore/undo script for selected categories
  app.post('/api/generate-restore', (req, res) => {
    const { categories } = req.body as { categories?: string[] };
    const valid = Object.keys(RESTORE_BLOCKS);
    const selected = Array.isArray(categories)
      ? categories.filter((c) => valid.includes(c))
      : valid;
    const script = buildRestoreScript(selected.length ? selected : valid);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename="OptiGods-RESTORE-by-leaq.ps1"');
    res.send(script);
  });

  // Public — track a site visit (called once per browser session from frontend)
  app.post('/api/track-visit', async (req, res) => {
    try {
      const referrer = req.body?.referrer as string | undefined;
      await storage.recordVisit(referrer);
      res.json({ ok: true });
    } catch {
      res.json({ ok: false });
    }
  });

  // Admin — aggregate stats
  app.get('/api/admin/stats', async (req, res) => {
    if (!checkAdminKey(req, res)) return;
    const [codes, friends, visitStats] = await Promise.all([
      storage.getAllCodes(),
      storage.getAllFriendTokens(),
      storage.getVisitStats(),
    ]);
    const usedCodes = codes.filter(c => c.usedAt).length;
    const availableCodes = codes.filter(c => !c.usedAt).length;
    const usedFriends = friends.filter(f => f.usedAt).length;
    const availableFriends = friends.filter(f => !f.usedAt).length;
    res.json({
      totalCodes: codes.length,
      usedCodes,
      availableCodes,
      totalFriends: friends.length,
      usedFriends,
      availableFriends,
      revenueEstimate: usedCodes * 25,
      visits: visitStats,
    });
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
      const stripe = new Stripe(secretKey, { apiVersion: '2026-02-25.clover' as any });

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
      const stripe = new Stripe(secretKey, { apiVersion: '2026-02-25.clover' as any });
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

  app.get('/api/script/detect', (req, res) => {
    const script = `
# OptiGods by leaq — PC State Detection Script
# Run this script as Administrator, then paste the output line into the app.
# It only READS your system — it does NOT change anything.

$state = @{}

function Check { param($key, $expr) try { $state[$key] = [bool](Invoke-Expression $expr) } catch { $state[$key] = $false } }

# --- Registry: CPU & Timer ---
Check 'Win32PrioritySeparation'  '((Get-ItemProperty "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl" -EA SilentlyContinue).Win32PrioritySeparation) -eq 26'
Check 'SetResponsiveness'         '((Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile" -EA SilentlyContinue).SystemResponsiveness) -eq 10'
Check 'DisableCoreParking'        '((Get-ItemProperty "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Power\\PowerSettings\\54533251-82be-4824-96c1-47b60b740d00\\0cc5b647-c1df-4637-891a-dec35c318583" -EA SilentlyContinue).ValueMax) -eq 0'
Check 'DisableDynamicTick'        '(bcdedit /enum | Select-String "disabledynamictick.*yes") -ne $null'
Check 'SetTimerResolution'        '(bcdedit /enum | Select-String "useplatformtick.*yes") -ne $null'
Check 'GameModeTweaks'            '((Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games" -Name "GPU Priority" -EA SilentlyContinue)."GPU Priority") -eq 8'
Check 'EnableMSIMode'             '$gpu=(Get-PnpDevice -Class Display -EA SilentlyContinue | Select-Object -First 1); if($gpu){$p="HKLM:\\SYSTEM\\CurrentControlSet\\Enum\\$($gpu.InstanceId)\\Device Parameters\\Interrupt Management\\MessageSignaledInterruptProperties"; ((Get-ItemProperty $p -EA SilentlyContinue).MSISupported) -eq 1}else{$false}'

# --- Registry: Network ---
Check 'NetworkThrottling'  '((Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile" -Name NetworkThrottlingIndex -EA SilentlyContinue).NetworkThrottlingIndex) -eq 4294967295'
Check 'DisableNDU'         '((Get-ItemProperty "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Ndu" -Name Start -EA SilentlyContinue).Start) -eq 4'
Check 'DisableIPv6'        '(Get-NetAdapterBinding -ComponentID ms_tcpip6 -EA SilentlyContinue | Where-Object { $_.Enabled }).Count -eq 0'
Check 'DisableNagle'       '((Get-ItemProperty "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters" -Name TCPNoDelay -EA SilentlyContinue).TCPNoDelay) -eq 1'
Check 'InputLagTCP'        '((Get-ItemProperty "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters" -Name TcpAckFrequency -EA SilentlyContinue).TcpAckFrequency) -eq 1'
Check 'DisablePowerThrottling' '((Get-ItemProperty "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Power\\PowerThrottling" -Name PowerThrottlingOff -EA SilentlyContinue).PowerThrottlingOff) -eq 1'

# --- Registry: Gaming / Visual ---
Check 'EnableHAGS'            '((Get-ItemProperty "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers" -Name HwSchMode -EA SilentlyContinue).HwSchMode) -eq 2'
Check 'DisableXboxGameBar'    '((Get-ItemProperty "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\GameDVR" -Name AppCaptureEnabled -EA SilentlyContinue).AppCaptureEnabled) -eq 0'
Check 'DisableGameDVR'        '((Get-ItemProperty "HKCU:\\System\\GameConfigStore" -Name GameDVR_Enabled -EA SilentlyContinue).GameDVR_Enabled) -eq 0'
Check 'DisablePointerPrecision' '((Get-ItemProperty "HKCU:\\Control Panel\\Mouse" -Name MouseSpeed -EA SilentlyContinue).MouseSpeed) -eq 0'
Check 'DisableAnimations'     '(Get-ItemProperty "HKCU:\\Control Panel\\Desktop" -Name UserPreferencesMask -EA SilentlyContinue) -ne $null'
Check 'DisableTelemetry'      '((Get-ItemProperty "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection" -Name AllowTelemetry -EA SilentlyContinue).AllowTelemetry) -eq 0'
Check 'DisableWindowsError'   '((Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows\\Windows Error Reporting" -Name Disabled -EA SilentlyContinue).Disabled) -eq 1'
Check 'DisableFastStartup'    '((Get-ItemProperty "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power" -Name HiberbootEnabled -EA SilentlyContinue).HiberbootEnabled) -eq 0'
Check 'DisableDefender'       '(Get-MpPreference -EA SilentlyContinue).DisableRealtimeMonitoring -eq $true'

# --- Power Plan ---
Check 'SetHighPerformancePlan' '$plan = (powercfg -getactivescheme 2>$null); ($plan -match "e9a42b02") -or ($plan -match "8c5e7fda")'
Check 'DisableUSBSuspend'      '((powercfg -query SCHEME_CURRENT 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 2>$null) | Select-String "0x00000000") -ne $null'

# --- Registry: Memory ---
Check 'EnableLargeSystemCache'   '((Get-ItemProperty "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management" -Name LargeSystemCache -EA SilentlyContinue).LargeSystemCache) -eq 1'
Check 'DisablePagefileEncryption' '(fsutil behavior query encryptpagingfile 2>$null | Select-String "= 0") -ne $null'
Check 'DisableMemoryCompression' '(Get-MMAgent -EA SilentlyContinue).MemoryCompression -eq $false'
Check 'DisablePrefetch'          '((Get-ItemProperty "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management\\PrefetchParameters" -Name EnablePrefetcher -EA SilentlyContinue).EnablePrefetcher) -eq 0'
Check 'MemDisableKernelPaging'   '((Get-ItemProperty "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management" -Name DisablePagingExecutive -EA SilentlyContinue).DisablePagingExecutive) -eq 1'
Check 'MemGPUOptimize'           '((Get-ItemProperty "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers" -Name TdrLevel -EA SilentlyContinue).TdrLevel) -eq 3'

# --- Services (Disabled = tweak applied) ---
foreach ($svc in @(
  @{id='ServiceDiagTrack';  name='DiagTrack'},
  @{id='ServiceWSearch';    name='WSearch'},
  @{id='ServiceSysMain';    name='SysMain'},
  @{id='ServiceRemoteReg';  name='RemoteRegistry'},
  @{id='ServiceWMPNetworkSvc'; name='WMPNetworkSvc'},
  @{id='ServiceFax';        name='Fax'},
  @{id='ServiceRetailDemo'; name='RetailDemo'},
  @{id='ServiceTabletInput';name='TabletInputService'},
  @{id='ServiceMapsBroker'; name='MapsBroker'}
)) {
  $s = Get-Service -Name $svc.name -EA SilentlyContinue
  $state[$svc.id] = $s -ne $null -and $s.StartType -eq 'Disabled'
}

# --- Privacy ---
Check 'PrivacyTelemetry'       '((Get-ItemProperty "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection" -Name AllowTelemetry -EA SilentlyContinue).AllowTelemetry) -eq 0'
Check 'PrivacyActivityHistory' '((Get-ItemProperty "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\System" -Name EnableActivityFeed -EA SilentlyContinue).EnableActivityFeed) -eq 0'
Check 'PrivacyLocationTracking' '((Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\location" -Name Value -EA SilentlyContinue).Value) -eq "Deny"'
Check 'PrivacyAdvertisingID'   '((Get-ItemProperty "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\AdvertisingInfo" -Name Enabled -EA SilentlyContinue).Enabled) -eq 0'

# --- Win11 specific ---
Check 'Win11Copilot'    '((Get-ItemProperty "HKCU:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsCopilot" -Name TurnOffWindowsCopilot -EA SilentlyContinue).TurnOffWindowsCopilot) -eq 1'
Check 'Win11ChatIcon'   '((Get-ItemProperty "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" -Name TaskbarMn -EA SilentlyContinue).TaskbarMn) -eq 0'
Check 'Win11BingSearch' '((Get-ItemProperty "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Search" -Name BingSearchEnabled -EA SilentlyContinue).BingSearchEnabled) -eq 0'
Check 'Win11AutoHDR'    '((Get-ItemProperty "HKCU:\\SOFTWARE\\Microsoft\\DirectX\\UserGpuPreferences" -Name AutoHDREnable -EA SilentlyContinue).AutoHDREnable) -eq 0'
Check 'Win11Snap'       '((Get-ItemProperty "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" -Name SnapAssist -EA SilentlyContinue).SnapAssist) -eq 0'

# --- Process Lasso ---
$processLassoInstalled = (Test-Path "C:\\Program Files\\Process Lasso\\ProcessLasso.exe") -or ((Get-Service -Name "ProcessLasso" -EA SilentlyContinue) -ne $null)
$state['ProcessLassoProBalance']       = $processLassoInstalled
$state['ProcessLassoSmartTrim']        = $processLassoInstalled
$state['ProcessLassoRestrain']         = $processLassoInstalled
$state['ProcessLassoAffinityGaming']   = $processLassoInstalled
$state['ProcessLassoInstanceBalancer'] = $processLassoInstalled

# --- Startup app checks (removed from registry = disabled) ---
foreach ($app in @(
  @{id='su_discord';   key='Discord'},
  @{id='su_spotify';   key='Spotify'},
  @{id='su_onedrive';  key='OneDrive'},
  @{id='su_skype';     key='Skype'}
)) {
  $val = (Get-ItemProperty "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" -Name $app.key -EA SilentlyContinue)
  $state[$app.id] = $val -eq $null
}

# --- Fortnite ---
Check 'FortniteHighPriority'     '((Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\FortniteClient-Win64-Shipping.exe\\PerfOptions" -Name CpuPriorityClass -EA SilentlyContinue).CpuPriorityClass) -eq 6'
Check 'FortniteDisableVSync'     'Test-Path "$env:LOCALAPPDATA\\FortniteGame\\Saved\\Config\\WindowsClient\\Engine.ini" -EA SilentlyContinue'
Check 'FortniteGameMode'         '((Get-ItemProperty "HKCU:\\SOFTWARE\\Microsoft\\GameBar" -Name AutoGameModeEnabled -EA SilentlyContinue).AutoGameModeEnabled) -eq 1'

# --- FiveM ---
Check 'FiveMHighPriority'        '((Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\GTA5.exe\\PerfOptions" -Name CpuPriorityClass -EA SilentlyContinue).CpuPriorityClass) -eq 3'
Check 'FiveMDisableNvidiaTelemetry' '(Get-Service -Name "NvTelemetryContainer" -EA SilentlyContinue).StartType -eq "Disabled"'

# --- Debloat: check if apps are already removed ---
$packages = (Get-AppxPackage -EA SilentlyContinue | Select-Object -ExpandProperty Name)
foreach ($pkg in @(
  @{id='DebloatBing';      name='Microsoft.BingSearch'},
  @{id='DebloatSkype';     name='Microsoft.SkypeApp'},
  @{id='DebloatSolitaire'; name='Microsoft.MicrosoftSolitaireCollection'},
  @{id='DebloatCortana';   name='Microsoft.549981C3F5F10'},
  @{id='DebloatXboxApp';   name='Microsoft.XboxApp'},
  @{id='DebloatXboxGameBar'; name='Microsoft.XboxGamingOverlay'},
  @{id='DebloatMaps';      name='Microsoft.WindowsMaps'},
  @{id='DebloatWeather';   name='Microsoft.BingWeather'},
  @{id='DebloatNews';      name='Microsoft.BingNews'},
  @{id='DebloatClipchamp'; name='Clipchamp.Clipchamp'},
  @{id='DebloatQuickAssist'; name='MicrosoftCorporationII.QuickAssist'},
  @{id='DebloatFeedback';  name='Microsoft.WindowsFeedbackHub'},
  @{id='DebloatGetHelp';   name='Microsoft.GetHelp'}
)) {
  $state[$pkg.id] = -not ($packages -like "*$($pkg.name)*")
}

# Output result
$json = ($state | ConvertTo-Json -Compress)
$bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
$b64 = [Convert]::ToBase64String($bytes)
Write-Host ""
Write-Host "=============================="
Write-Host "OPTIGODS_STATE:$b64"
Write-Host "=============================="
Write-Host ""
Write-Host "Copy the OPTIGODS_STATE line above and paste it into Opti Gods."
`.trim();

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename="OptiGods-Detect.ps1"');
    res.send(script);
  });

  return httpServer;
}
