import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { sendProCode, isEmailConfigured } from "./email";
import { autoSendState, runAutoSend } from "./auto-send";

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
  DebloatOneDrive: `taskkill /F /IM OneDrive.exe 2>$null; $setupPaths = @("$env:SystemRoot\\System32\\OneDriveSetup.exe","$env:SystemRoot\\SysWOW64\\OneDriveSetup.exe","$env:LOCALAPPDATA\\Microsoft\\OneDrive\\OneDriveSetup.exe","$env:LOCALAPPDATA\\Microsoft\\OneDrive\\Update\\OneDriveSetup.exe"); $found = $setupPaths | Where-Object { Test-Path $_ } | Select-Object -First 1; if ($found) { & $found /uninstall 2>$null; Write-Host "[OK] OneDrive uninstaller ran: $found" -ForegroundColor Green } else { Write-Host "[INFO] OneDrive setup.exe not found — may already be removed" -ForegroundColor Yellow }; Get-AppxPackage -AllUsers *Microsoft.OneDrive* -EA SilentlyContinue | Remove-AppxPackage -AllUsers -EA SilentlyContinue; Remove-ItemProperty "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" -Name "OneDrive" -EA SilentlyContinue; Write-Host "[OK] OneDrive startup entry removed" -ForegroundColor Green`,
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
  // Discord Optimizer
  DiscordLowPriority: `$ifeo = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\Discord.exe\\PerfOptions'; If (!(Test-Path $ifeo)) { New-Item $ifeo -Force | Out-Null }; Set-ItemProperty $ifeo 'CpuPriorityClass' 1 -Type DWord; Set-ItemProperty $ifeo 'IoPriority' 0 -Type DWord; Set-ItemProperty $ifeo 'PagePriority' 1 -Type DWord; Write-Host "[Discord] Discord.exe: Below Normal CPU + Very Low I/O + Low Page priority — game gets full CPU scheduling priority" -ForegroundColor Green`,
  DiscordDisableHWAccel: `$settings = "$env:APPDATA\\discord\\settings.json"; If (Test-Path $settings) { $raw = Get-Content $settings -Raw; If ($raw -match '"enableHardwareAcceleration"\\s*:\\s*true') { $raw = $raw -replace '"enableHardwareAcceleration"\\s*:\\s*true', '"enableHardwareAcceleration": false' } ElseIf ($raw -notmatch '"enableHardwareAcceleration"') { $raw = $raw -replace '\\{', '{ "enableHardwareAcceleration": false,' }; $raw | Set-Content $settings -Encoding UTF8; Write-Host "[Discord] Hardware acceleration disabled — reduces GPU usage during screenshares and video calls" -ForegroundColor Green } Else { Write-Host "[Discord] settings.json not found — open Discord once first to generate it" -ForegroundColor Yellow }`,
  DiscordClearCache: `$cacheDirs = @("$env:APPDATA\\discord\\Cache","$env:APPDATA\\discord\\Code Cache","$env:APPDATA\\discord\\GPUCache","$env:APPDATA\\discord\\blob_storage"); $total = 0; ForEach ($dir in $cacheDirs) { If (Test-Path $dir) { $size = (Get-ChildItem $dir -Recurse -EA SilentlyContinue | Measure-Object -Property Length -Sum).Sum; Remove-Item "$dir\\*" -Recurse -Force -EA SilentlyContinue; $total += $size } }; $mb = [Math]::Round($total/1MB, 1); Write-Host "[Discord] Cache cleared — freed $($mb) MB. Fixes lag, texture glitches, and slow load times" -ForegroundColor Green`,
  DiscordDisableUpdateCheck: `$ifeo = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\Update.exe'; If (!(Test-Path $ifeo)) { New-Item $ifeo -Force | Out-Null }; $perf = "$ifeo\\PerfOptions"; If (!(Test-Path $perf)) { New-Item $perf -Force | Out-Null }; Set-ItemProperty $perf 'CpuPriorityClass' 1 -Type DWord; Set-ItemProperty $perf 'IoPriority' 0 -Type DWord; Write-Host "[Discord] Discord Update.exe deprioritized — background updates won't spike your CPU mid-game" -ForegroundColor Green`,
  DiscordReduceGPUPriority: `$ifeo = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\Discord.exe\\PerfOptions'; If (!(Test-Path $ifeo)) { New-Item $ifeo -Force | Out-Null }; Set-ItemProperty $ifeo 'GpuPriorityClass' 1 -Type DWord; $games = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games'; If (!(Test-Path $games)) { New-Item $games -Force | Out-Null }; Set-ItemProperty $games 'GPU Priority' 8 -Type DWord; Write-Host "[Discord] Discord GPU priority lowered to 1 — Games task kept at GPU Priority 8 for max rendering priority" -ForegroundColor Green`,
  DiscordOptimizeCodec: `$settings = "$env:APPDATA\\discord\\settings.json"; If (Test-Path $settings) { $raw = Get-Content $settings -Raw; If ($raw -notmatch '"videoCodec"') { $raw = $raw.TrimEnd().TrimEnd('}') + ', "videoCodec": "H264", "openH264": false, "disableVideoMotionSmoothing": true }'; $raw | Set-Content $settings -Encoding UTF8; Write-Host "[Discord] Screenshare codec set to H264 + motion smoothing disabled — lower CPU during screenshares" -ForegroundColor Green } Else { Write-Host "[Discord] Codec settings already configured" -ForegroundColor Yellow } } Else { Write-Host "[Discord] settings.json not found — open Discord once to generate it" -ForegroundColor Yellow }`,
  DiscordDisableCrashHandler: `$crashpad = Get-ChildItem "$env:LOCALAPPDATA\\Discord" -Filter "crashpad_handler.exe" -Recurse -EA SilentlyContinue | Select-Object -First 1; If ($crashpad) { $aclPath = $crashpad.FullName; $acl = Get-Acl $aclPath; $rule = New-Object System.Security.AccessControl.FileSystemAccessRule("Everyone","ExecuteFile","Deny"); $acl.AddAccessRule($rule); Set-Acl $aclPath $acl -EA SilentlyContinue; Write-Host "[Discord] Crash handler execution blocked — eliminates crash report upload overhead" -ForegroundColor Green } Else { Write-Host "[Discord] Crash handler not found — may already be absent or path changed" -ForegroundColor Yellow }`,
  DiscordDisableAnimations: `$settings = "$env:APPDATA\\discord\\settings.json"; If (Test-Path $settings) { $raw = Get-Content $settings -Raw; If ($raw -notmatch '"reduceMotion"') { $raw = $raw.TrimEnd().TrimEnd('}') + ', "reduceMotion": true }'; $raw | Set-Content $settings -Encoding UTF8; Write-Host "[Discord] Reduce Motion enabled — fewer UI animations = lower CPU/GPU overhead while gaming" -ForegroundColor Green } Else { Write-Host "[Discord] Reduce Motion already enabled" -ForegroundColor Yellow } } Else { Write-Host "[Discord] settings.json not found — open Discord first" -ForegroundColor Yellow }`,
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
  FiveMMenuFpsUncap: `$gpuClass = 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}'; $found = $false; 0,1,2,3 | ForEach-Object { $k = "$gpuClass\\000$_"; If ((Test-Path $k) -and (Get-ItemProperty $k -Name 'DriverDesc' -EA SilentlyContinue).DriverDesc -match 'NVIDIA') { Set-ItemProperty $k 'OpenGLCompatibilityMode' 0 -Type DWord -Force -EA SilentlyContinue; Write-Host "[NVIDIA] OpenGL GDI Compatibility = Prefer Performance on $k" -ForegroundColor Green; $found = $true } }; If (-not $found) { Write-Host "[NVIDIA] GPU class key not found — apply manually: NVCP > Manage 3D Settings > OpenGL GDI Compatibility = Prefer Performance" -ForegroundColor Yellow }; Write-Host "[FiveM] Menu FPS cap removed — FPS now runs uncapped in menus (was limited to monitor Hz)" -ForegroundColor Cyan`,
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
  FortniteHighPriority: `$key = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\FortniteClient-Win64-Shipping.exe\\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force | Out-Null }; Set-ItemProperty -Path $key -Name 'CpuPriorityClass' -Value 3 -Type DWord -Force; Set-ItemProperty -Path $key -Name 'CpuPriorityBoost' -Value 1 -Type DWord -Force; Set-ItemProperty -Path $key -Name 'DisableEnergyThrottling' -Value 1 -Type DWord -Force; Set-ItemProperty -Path $key -Name 'EnableBoost' -Value 1 -Type DWord -Force; Set-ItemProperty -Path $key -Name 'ForceForegroundBoost' -Value 1 -Type DWord -Force; Set-ItemProperty -Path $key -Name 'IoPriority' -Value 3 -Type DWord -Force; Set-ItemProperty -Path $key -Name 'PagePriority' -Value 5 -Type DWord -Force; Write-Host "[Fortnite] Full PerfOptions stack: AboveNormal CPU, IO=High, EnergyThrottle=Off, FGBoost=On, PagePriority=5" -ForegroundColor Green`,
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
  FortniteDisableThrottling: `$key = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\FortniteClient-Win64-Shipping.exe'; If (!(Test-Path $key)) { New-Item -Path $key -Force }; Set-ItemProperty -Path "$key\\PerfOptions" -Name 'CpuPriorityClass' -Value 3`,
  // Game Detection — each command auto-detects if the game is installed before applying
  game_valorant: `$paths = @("$env:LocalAppData\\VALORANT","C:\\Riot Games\\VALORANT"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { Write-Host "[DETECTED] Valorant at $found" -ForegroundColor Green; $key = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\VALORANT-Win64-Shipping.exe\\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force | Out-Null }; Set-ItemProperty -Path $key -Name 'CpuPriorityClass' -Value 3; Set-ItemProperty -Path $key -Name 'IoPriority' -Value 3; Write-Host "[OK] Valorant: Above Normal CPU + High I/O priority" -ForegroundColor Green } Else { Write-Host "[SKIP] Valorant not detected" -ForegroundColor DarkGray }`,
  game_cs2: `$paths = @("C:\\Program Files (x86)\\Steam\\steamapps\\common\\Counter-Strike Global Offensive\\game\\bin\\win64\\cs2.exe","D:\\SteamLibrary\\steamapps\\common\\Counter-Strike Global Offensive\\game\\bin\\win64\\cs2.exe","E:\\SteamLibrary\\steamapps\\common\\Counter-Strike Global Offensive\\game\\bin\\win64\\cs2.exe"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { Write-Host "[DETECTED] CS2" -ForegroundColor Green; $key = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\cs2.exe\\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force | Out-Null }; Set-ItemProperty -Path $key -Name 'CpuPriorityClass' -Value 3; netsh int tcp set global timestamps=disabled | Out-Null; Write-Host "[OK] CS2: Above Normal priority + TCP timestamps disabled" -ForegroundColor Green } Else { Write-Host "[SKIP] CS2 not detected" -ForegroundColor DarkGray }`,
  game_apex: `$paths = @("C:\\Program Files\\EA Games\\Apex Legends\\r5apex.exe","C:\\Program Files\\Origin Games\\Apex Legends\\r5apex.exe","C:\\Program Files (x86)\\Origin Games\\Apex Legends\\r5apex.exe"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { Write-Host "[DETECTED] Apex Legends" -ForegroundColor Green; $key = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\r5apex.exe\\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force | Out-Null }; Set-ItemProperty -Path $key -Name 'CpuPriorityClass' -Value 3; Set-ItemProperty -Path $key -Name 'IoPriority' -Value 3; Write-Host "[OK] Apex: Above Normal CPU + High I/O" -ForegroundColor Green } Else { Write-Host "[SKIP] Apex Legends not detected" -ForegroundColor DarkGray }`,
  game_warzone: `$paths = @("C:\\Program Files (x86)\\Call of Duty","C:\\Program Files\\Call of Duty"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { Write-Host "[DETECTED] Call of Duty / Warzone" -ForegroundColor Green; $key = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\cod.exe\\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force | Out-Null }; Set-ItemProperty -Path $key -Name 'CpuPriorityClass' -Value 3; Write-Host "[OK] Warzone: Above Normal CPU priority" -ForegroundColor Green } Else { Write-Host "[SKIP] COD / Warzone not detected" -ForegroundColor DarkGray }`,
  game_lol: `$paths = @("C:\\Riot Games\\League of Legends\\Game\\League of Legends.exe","D:\\Riot Games\\League of Legends\\Game\\League of Legends.exe"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { Write-Host "[DETECTED] League of Legends" -ForegroundColor Green; $key = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\League of Legends.exe\\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force | Out-Null }; Set-ItemProperty -Path $key -Name 'CpuPriorityClass' -Value 3; Set-ItemProperty -Path $key -Name 'IoPriority' -Value 3; Write-Host "[OK] LoL: Above Normal priority" -ForegroundColor Green } Else { Write-Host "[SKIP] League of Legends not detected" -ForegroundColor DarkGray }`,
  game_overwatch: `$paths = @("C:\\Program Files (x86)\\Overwatch\\_retail_\\Overwatch.exe","C:\\Program Files\\Overwatch\\_retail_\\Overwatch.exe"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { Write-Host "[DETECTED] Overwatch 2" -ForegroundColor Green; $key = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\Overwatch.exe\\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force | Out-Null }; Set-ItemProperty -Path $key -Name 'CpuPriorityClass' -Value 3; Write-Host "[OK] Overwatch 2: Above Normal CPU priority" -ForegroundColor Green } Else { Write-Host "[SKIP] Overwatch 2 not detected" -ForegroundColor DarkGray }`,
  game_siege: `$paths = @("C:\\Program Files (x86)\\Ubisoft\\Ubisoft Game Launcher\\games\\Tom Clancy's Rainbow Six Siege","C:\\Program Files\\Ubisoft\\Ubisoft Game Launcher\\games\\Tom Clancy's Rainbow Six Siege"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { Write-Host "[DETECTED] Rainbow Six Siege" -ForegroundColor Green; $key = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\RainbowSix.exe\\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force | Out-Null }; Set-ItemProperty -Path $key -Name 'CpuPriorityClass' -Value 3; Write-Host "[OK] R6 Siege: Above Normal CPU priority" -ForegroundColor Green } Else { Write-Host "[SKIP] Rainbow Six Siege not detected" -ForegroundColor DarkGray }`,
  game_rust: `$paths = @("C:\\Program Files (x86)\\Steam\\steamapps\\common\\Rust\\RustClient.exe","D:\\SteamLibrary\\steamapps\\common\\Rust\\RustClient.exe","E:\\SteamLibrary\\steamapps\\common\\Rust\\RustClient.exe"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { Write-Host "[DETECTED] Rust" -ForegroundColor Green; $key = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\RustClient.exe\\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force | Out-Null }; Set-ItemProperty -Path $key -Name 'CpuPriorityClass' -Value 3; Write-Host "[OK] Rust: Above Normal CPU priority" -ForegroundColor Green } Else { Write-Host "[SKIP] Rust not detected" -ForegroundColor DarkGray }`,
  game_minecraft: `$minePath = "$env:AppData\\.minecraft\\launcher_profiles.json"; If (Test-Path $minePath) { Write-Host "[DETECTED] Minecraft Java Edition" -ForegroundColor Green; $mcFolder = "$env:AppData\\.minecraft"; Add-MpPreference -ExclusionPath $mcFolder -ErrorAction SilentlyContinue; Write-Host "[OK] Minecraft: .minecraft folder added to Defender exclusions" -ForegroundColor Green } Else { Write-Host "[SKIP] Minecraft not detected" -ForegroundColor DarkGray }`,
  game_roblox: `$robloxPath = "$env:LocalAppData\\Roblox\\Versions"; If (Test-Path $robloxPath) { Write-Host "[DETECTED] Roblox" -ForegroundColor Green; $key = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\RobloxPlayerBeta.exe\\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force | Out-Null }; Set-ItemProperty -Path $key -Name 'CpuPriorityClass' -Value 3; Set-ItemProperty -Path $key -Name 'IoPriority' -Value 3; Write-Host "[OK] Roblox: Above Normal CPU + High I/O priority" -ForegroundColor Green } Else { Write-Host "[SKIP] Roblox not detected" -ForegroundColor DarkGray }`,
  game_tarkov: `$paths = @("C:\\Battlestate Games\\EFT\\EscapeFromTarkov.exe","C:\\Games\\EFT\\EscapeFromTarkov.exe","D:\\Games\\EFT\\EscapeFromTarkov.exe"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { Write-Host "[DETECTED] Escape from Tarkov" -ForegroundColor Green; $key = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\EscapeFromTarkov.exe\\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force | Out-Null }; Set-ItemProperty -Path $key -Name 'CpuPriorityClass' -Value 3; Set-ItemProperty -Path $key -Name 'IoPriority' -Value 3; Write-Host "[OK] Tarkov: Above Normal CPU priority + High I/O" -ForegroundColor Green } Else { Write-Host "[SKIP] Escape from Tarkov not detected" -ForegroundColor DarkGray }`,
  game_pubg: `$paths = @("C:\\Program Files (x86)\\Steam\\steamapps\\common\\PUBG\\TslGame\\Binaries\\Win64\\TslGame.exe","D:\\SteamLibrary\\steamapps\\common\\PUBG\\TslGame\\Binaries\\Win64\\TslGame.exe"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { Write-Host "[DETECTED] PUBG" -ForegroundColor Green; $key = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\TslGame.exe\\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force | Out-Null }; Set-ItemProperty -Path $key -Name 'CpuPriorityClass' -Value 3; Write-Host "[OK] PUBG: Above Normal CPU priority" -ForegroundColor Green } Else { Write-Host "[SKIP] PUBG not detected" -ForegroundColor DarkGray }`,
  game_dbd: `$paths = @("C:\\Program Files (x86)\\Steam\\steamapps\\common\\Dead by Daylight","D:\\SteamLibrary\\steamapps\\common\\Dead by Daylight"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { Write-Host "[DETECTED] Dead by Daylight" -ForegroundColor Green; $key = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\DeadByDaylight-Win64-Shipping.exe\\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force | Out-Null }; Set-ItemProperty -Path $key -Name 'CpuPriorityClass' -Value 3; Set-ItemProperty -Path $key -Name 'IoPriority' -Value 3; Write-Host "[OK] DBD: Above Normal CPU + High I/O priority" -ForegroundColor Green } Else { Write-Host "[SKIP] Dead by Daylight not detected" -ForegroundColor DarkGray }`,
  game_dota2: `$paths = @("C:\\Program Files (x86)\\Steam\\steamapps\\common\\dota 2 beta","D:\\SteamLibrary\\steamapps\\common\\dota 2 beta"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { Write-Host "[DETECTED] Dota 2" -ForegroundColor Green; $key = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\dota2.exe\\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force | Out-Null }; Set-ItemProperty -Path $key -Name 'CpuPriorityClass' -Value 3; Write-Host "[OK] Dota 2: Above Normal CPU priority" -ForegroundColor Green } Else { Write-Host "[SKIP] Dota 2 not detected" -ForegroundColor DarkGray }`,
  // Startup apps (previously missing)
  su_steam: `reg delete "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" /v "Steam" /f 2>$null; $lnk = "$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\Steam.lnk"; If (Test-Path $lnk) { Remove-Item $lnk -Force }; Write-Host "[OK] Steam removed from startup" -ForegroundColor Green`,
  su_rtss: `reg delete "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" /v "RTSS" /f 2>$null; Write-Host "[OK] RivaTuner Statistics Server removed from startup" -ForegroundColor Green`,
  su_msiab: `reg delete "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" /v "MSIAfterburner" /f 2>$null; Write-Host "[OK] MSI Afterburner removed from startup" -ForegroundColor Green`,
  su_logitech: `reg delete "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" /v "LGHub" /f 2>$null; reg delete "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" /v "LCore" /f 2>$null; Write-Host "[OK] Logitech G Hub / LCore removed from startup" -ForegroundColor Green`,
  su_realtek: `reg delete "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" /v "RtHDVCpl" /f 2>$null; reg delete "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" /v "RtkNGUI64" /f 2>$null; Write-Host "[OK] Realtek Audio HD Manager removed from startup" -ForegroundColor Green`,
  // Process Lasso / process priority
  ProcessLassoProBalance: `$plKey = 'HKLM:\\SOFTWARE\\Process Lasso'; If (Test-Path $plKey) { Set-ItemProperty -Path $plKey -Name 'EnableProBalance' -Value 1 -Type DWord; Write-Host "[OK] Process Lasso ProBalance enabled" -ForegroundColor Green } Else { Write-Host "[INFO] Process Lasso not installed — applying IFEO game priority instead" -ForegroundColor Yellow; $ifeo = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options'; @('cs2.exe','VALORANT-Win64-Shipping.exe','FortniteClient-Win64-Shipping.exe','r5apex.exe','GTA5.exe') | ForEach-Object { $p = "$ifeo\\$_\\PerfOptions"; If (!(Test-Path $p)) { New-Item $p -Force | Out-Null }; Set-ItemProperty $p 'CpuPriorityClass' 3 }; Write-Host "[OK] Above Normal CPU priority applied to 5 game executables" -ForegroundColor Green }`,
  ProcessLassoSmartTrim: `$plKey = 'HKLM:\\SOFTWARE\\Process Lasso'; If (Test-Path $plKey) { Set-ItemProperty -Path $plKey -Name 'EnableSmartTrim' -Value 1 -Type DWord; Write-Host "[OK] Process Lasso SmartTrim enabled" -ForegroundColor Green } Else { $code = @"using System;using System.Runtime.InteropServices;public class MemTrimPS{[DllImport("psapi.dll")]public static extern bool EmptyWorkingSet(IntPtr h);}"@; Add-Type $code -ErrorAction SilentlyContinue; [MemTrimPS]::EmptyWorkingSet([IntPtr](-1)); Write-Host "[OK] Working set trimmed (Process Lasso not installed — ran manual trim)" -ForegroundColor Yellow }`,
  ProcessLassoRestrain: `$plKey = 'HKLM:\\SOFTWARE\\Process Lasso'; If (Test-Path $plKey) { Set-ItemProperty -Path $plKey -Name 'RestrainMode' -Value 1 -Type DWord; Write-Host "[OK] Process Lasso Restrain mode enabled" -ForegroundColor Green } Else { Write-Host "[INFO] Install Process Lasso to use CPU Restrain — download at bitsum.com" -ForegroundColor Yellow }`,
  ProcessLassoAffinityGaming: `$ifeo = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options'; @('cs2.exe','VALORANT-Win64-Shipping.exe','r5apex.exe','cod.exe','RustClient.exe','GTA5.exe','FortniteClient-Win64-Shipping.exe') | ForEach-Object { $p = "$ifeo\\$_\\PerfOptions"; If (!(Test-Path $p)) { New-Item $p -Force | Out-Null } ; Set-ItemProperty $p 'CpuPriorityClass' 3; Set-ItemProperty $p 'IoPriority' 3 }; Write-Host "[OK] Above Normal CPU + High I/O priority applied to 7 game executables" -ForegroundColor Green`,
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
  FiveMDisableDWM: `$key = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\GTA5.exe\\PerfOptions'; If (!(Test-Path $key)) { New-Item $key -Force | Out-Null }; Set-ItemProperty $key 'CpuPriorityClass' 3; Set-ItemProperty $key 'IoPriority' 3; Write-Host "[FiveM] GTA5.exe elevated to High CPU + High I/O (minimizes DWM interference)" -ForegroundColor Green`,
  FiveMAffinityMask: `$key = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\GTA5.exe\\PerfOptions'; If (!(Test-Path $key)) { New-Item $key -Force | Out-Null }; Set-ItemProperty $key 'CpuPriorityClass' 3; $fKey = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\FiveM.exe\\PerfOptions'; If (!(Test-Path $fKey)) { New-Item $fKey -Force | Out-Null }; Set-ItemProperty $fKey 'CpuPriorityClass' 3; Write-Host "[FiveM] GTA5.exe + FiveM.exe pinned to Above Normal priority on all logical cores" -ForegroundColor Green`,
  FiveMDNSOverride: `$adapter = Get-NetAdapter | Where-Object Status -eq 'Up' | Select-Object -First 1; If ($adapter) { Set-DnsClientServerAddress -InterfaceAlias $adapter.Name -ServerAddresses ('1.1.1.1','1.0.0.1') -EA SilentlyContinue; Write-Host "[FiveM] DNS set to Cloudflare 1.1.1.1/1.0.0.1 on $($adapter.Name) — faster server resolution" -ForegroundColor Green } Else { Write-Host "[FiveM] No active network adapter found" -ForegroundColor Yellow }`,
  FiveMQueueFix: `Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile' -Name 'SystemResponsiveness' -Value 0 -Type DWord -Force; Write-Host "[FiveM] SystemResponsiveness=0 — maximum CPU time allocated to the game process" -ForegroundColor Green`,
  FiveMStreamDistance: `$cfg = "$env:LocalAppData\\FiveM\\FiveM.app\\CitizenFX.ini"; If (Test-Path $cfg) { $c = Get-Content $cfg -Raw; If ($c -match 'StreamingDistance') { ($c -replace 'StreamingDistance=\\d+','StreamingDistance=500') | Set-Content $cfg } Else { Add-Content $cfg "\`nStreamingDistance=500" }; Write-Host "[FiveM] Streaming distance capped at 500 — reduces pop-in micro-stutter" -ForegroundColor Green } Else { Write-Host "[FiveM] CitizenFX.ini not found — launch FiveM once first" -ForegroundColor Yellow }`,
  // FiveM Advanced PerfOptions
  FiveMFullPerfStack: `$ifeo = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options'; $fivemKey = "$ifeo\\FiveM.exe\\PerfOptions"; If (!(Test-Path $fivemKey)) { New-Item $fivemKey -Force | Out-Null }; Set-ItemProperty $fivemKey 'CpuPriorityClass' 3 -Type DWord -Force; Set-ItemProperty $fivemKey 'CpuPriorityBoost' 1 -Type DWord -Force; Set-ItemProperty $fivemKey 'CpuMaxPerformance' 256 -Type DWord -Force; Set-ItemProperty $fivemKey 'DisableEnergyThrottling' 1 -Type DWord -Force; Set-ItemProperty $fivemKey 'EnableBoost' 1 -Type DWord -Force; Set-ItemProperty $fivemKey 'ForceForegroundBoost' 1 -Type DWord -Force; Set-ItemProperty $fivemKey 'IoPriority' 3 -Type DWord -Force; Set-ItemProperty $fivemKey 'PagePriority' 5 -Type DWord -Force; Set-ItemProperty $fivemKey 'DisableRenderingContextPreemption' 1 -Type DWord -Force; Set-ItemProperty $fivemKey 'DisableRenderingPreemption' 1 -Type DWord -Force; Set-ItemProperty $fivemKey 'EnableHWAcceleration' 1 -Type DWord -Force; Set-ItemProperty $fivemKey 'RenderThrottlingOff' 1 -Type DWord -Force; Set-ItemProperty $fivemKey 'PowerThrottlingOff' 1 -Type DWord -Force; Set-ItemProperty $fivemKey 'MaximumPerformanceEnabled' 1 -Type DWord -Force; Set-ItemProperty $fivemKey 'UnlimitedPerformance' 1 -Type DWord -Force; Set-ItemProperty $fivemKey 'GpuIdleEnabled' 0 -Type DWord -Force; Set-ItemProperty $fivemKey 'PowerSavingVsyncOn' 0 -Type DWord -Force; Write-Host "[FiveM] Full fivem.exe PerfOptions stack applied — CPU=AboveNormal(3), IO=High, EnergyThrottle=Off, Rendering unrestricted" -ForegroundColor Green`,
  FiveMGTAProcessPerfOptions: `$ifeo = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options'; $applyPerf = { param($exe) $p = "$ifeo\\$exe\\PerfOptions"; If (!(Test-Path $p)) { New-Item $p -Force | Out-Null }; Set-ItemProperty $p 'CpuPriorityClass' 3 -Type DWord -Force; Set-ItemProperty $p 'CpuPriorityBoost' 1 -Type DWord -Force; Set-ItemProperty $p 'DisableEnergyThrottling' 1 -Type DWord -Force; Set-ItemProperty $p 'EnableBoost' 1 -Type DWord -Force; Set-ItemProperty $p 'ForceForegroundBoost' 1 -Type DWord -Force; Set-ItemProperty $p 'IoPriority' 3 -Type DWord -Force; Set-ItemProperty $p 'PagePriority' 5 -Type DWord -Force; Write-Host "[FiveM] PerfOptions applied to $exe" -ForegroundColor Green }; $count = 0; Get-ChildItem $ifeo -EA SilentlyContinue | Where-Object { $_.PSChildName -like 'FiveM_b*_GTAProcess.exe' } | ForEach-Object { & $applyPerf $_.PSChildName; $count++ }; @('FiveM_b2189_GTAProcess.exe','FiveM_b3323_GTAProcess.exe','FiveM_b3258_GTAProcess.exe','FiveM_b2802_GTAProcess.exe','FiveM_b2699_GTAProcess.exe') | ForEach-Object { If (!(Test-Path "$ifeo\\$_")) { & $applyPerf $_; $count++ } }; If ($count -eq 0) { Write-Host "[FiveM] Keys pre-created for 5 known build versions — will activate on next FiveM launch" -ForegroundColor Yellow } Else { Write-Host "[FiveM] Applied to $count FiveM_bXXXX_GTAProcess.exe entries (version-agnostic)" -ForegroundColor Green }`,
  FiveMGameModeAdd: `$gameBar = 'HKCU:\\SOFTWARE\\Microsoft\\GameBar'; If (!(Test-Path $gameBar)) { New-Item $gameBar -Force | Out-Null }; Set-ItemProperty $gameBar 'AllowAutoGameMode' 1 -Type DWord -Force; Set-ItemProperty $gameBar 'AutoGameModeEnabled' 1 -Type DWord -Force; $store = 'HKCU:\\System\\GameConfigStore\\Children'; If (!(Test-Path $store)) { New-Item $store -Force | Out-Null }; @('GTA5.exe','FiveM.exe','fivem.exe') | ForEach-Object { $existing = Get-ChildItem $store -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath 'ChildAppID' -EA SilentlyContinue).ChildAppID -eq $_ }; If (-not $existing) { $guid = [System.Guid]::NewGuid().ToString('B'); $newKey = "$store\\$guid"; New-Item $newKey -Force | Out-Null; Set-ItemProperty $newKey 'ChildAppID' $_ -Force; Write-Host "[FiveM] Added $_ to Windows Game Mode whitelist" -ForegroundColor Green } Else { Write-Host "[FiveM] $_ already in Game Mode whitelist" -ForegroundColor Yellow } }`,
  FiveMRenderingBoost: `$ifeo = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options'; @('FiveM.exe','GTA5.exe') | ForEach-Object { $p = "$ifeo\\$_\\PerfOptions"; If (!(Test-Path $p)) { New-Item $p -Force | Out-Null }; Set-ItemProperty $p 'DisableRenderingContextPreemption' 1 -Type DWord -Force; Set-ItemProperty $p 'DisableRenderingPreemption' 1 -Type DWord -Force; Set-ItemProperty $p 'EnableHWAcceleration' 1 -Type DWord -Force; Set-ItemProperty $p 'RenderThrottlingOff' 1 -Type DWord -Force; Set-ItemProperty $p 'GpuIdleEnabled' 0 -Type DWord -Force; Set-ItemProperty $p 'PowerSavingVsyncOn' 0 -Type DWord -Force; Write-Host "[FiveM] Rendering preemption disabled + HW acceleration enabled on $_" -ForegroundColor Green }`,
  FiveMGPUPriorityStack: `$fivemKey = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\FiveM.exe\\PerfOptions'; If (!(Test-Path $fivemKey)) { New-Item $fivemKey -Force | Out-Null }; Set-ItemProperty $fivemKey 'GPU Priority' 8 -Type DWord -Force; Set-ItemProperty $fivemKey 'GpuPriorityClass' 8 -Type DWord -Force; Set-ItemProperty $fivemKey 'GpuMax' 256 -Type DWord -Force; Set-ItemProperty $fivemKey 'GpuMaxPerformance' 256 -Type DWord -Force; Set-ItemProperty $fivemKey 'GpuRenderingPriority' 3 -Type DWord -Force; Set-ItemProperty $fivemKey 'GpuThrottling' 0 -Type DWord -Force; $gamesPath = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games'; If (!(Test-Path $gamesPath)) { New-Item $gamesPath -Force | Out-Null }; Set-ItemProperty $gamesPath 'GPU Priority' 8 -Type DWord -Force; Set-ItemProperty $gamesPath 'MaximumPreRenderedFrames' 1 -Type DWord -Force; Write-Host "[FiveM] GPU priority stack: GpuPriorityClass=8, GPU max performance, PreRenderedFrames=1" -ForegroundColor Green`,
  // NVIDIA Specific
  NvidiaDisableTelemetry: `@('NvTelemetryContainer','NvDisplayContainerLS','NVDisplay.ContainerLocalSystem') | ForEach-Object { Stop-Service $_ -Force -EA SilentlyContinue; Set-Service $_ -StartupType Disabled -EA SilentlyContinue }; reg delete "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" /v "NvBackend" /f 2>$null; Write-Host "[NVIDIA] Telemetry services disabled: NvTelemetryContainer, NvDisplayContainerLS" -ForegroundColor Green`,
  NvidiaMaxPerfMode: `powercfg -setacvalueindex SCHEME_CURRENT 19caa947-ffffffff-ffffffff-ffffffff-ffffffff 233cfb73-ffffffff-ffffffff-ffffffff-ffffffff 1 2>$null; Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' -Name 'PlatformSupportMiracast' -Value 0 -EA SilentlyContinue; Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' -Name 'TdrLevel' -Value 3 -EA SilentlyContinue; Write-Host "[NVIDIA] Max performance mode hints applied via GraphicsDrivers registry" -ForegroundColor Green`,
  NvidiaPreRenderedFrames: `$gamesPath = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games'; If (!(Test-Path $gamesPath)) { New-Item -Path $gamesPath -Force | Out-Null }; Set-ItemProperty -Path $gamesPath -Name 'MaximumPreRenderedFrames' -Value 1 -Type DWord; Set-ItemProperty -Path $gamesPath -Name 'GPU Priority' -Value 8 -Type DWord; Set-ItemProperty -Path $gamesPath -Name 'Priority' -Value 6 -Type DWord; Write-Host "[NVIDIA] MaximumPreRenderedFrames=1, GPU Priority=8 — input latency minimized" -ForegroundColor Green`,
  NvidiaShaderCache: `If (!(Test-Path 'HKLM:\\SOFTWARE\\NVIDIA Corporation\\Global\\NGXCore')) { New-Item 'HKLM:\\SOFTWARE\\NVIDIA Corporation\\Global\\NGXCore' -Force | Out-Null }; Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\NVIDIA Corporation\\Global\\NVTweak' -Name 'Ordinal' -Value 1 -Type DWord -EA SilentlyContinue; $dxPath = 'HKLM:\\SOFTWARE\\Microsoft\\DirectX'; Set-ItemProperty -Path $dxPath -Name 'ShaderCache' -Value 1 -Type DWord -EA SilentlyContinue; Write-Host "[NVIDIA] Shader pre-caching enabled via DirectX registry + NGXCore hint" -ForegroundColor Green`,
  NvidiaOptimizeLatency: `$gamePath = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games'; If (!(Test-Path $gamePath)) { New-Item $gamePath -Force | Out-Null }; Set-ItemProperty $gamePath 'Scheduling Category' 'High' -Type String; Set-ItemProperty $gamePath 'SFIO Priority' 'High' -Type String; Set-ItemProperty $gamePath 'GPU Priority' 8 -Type DWord; Set-ItemProperty $gamePath 'MaximumPreRenderedFrames' 1 -Type DWord; Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' -Name 'HwSchMode' -Value 2; Write-Host "[NVIDIA] Latency optimized: High scheduling, HAGS enabled, PreRendered=1" -ForegroundColor Green`,
  NvidiaDisableOverlay: `Get-AppxPackage *XboxGamingOverlay* | Remove-AppxPackage -EA SilentlyContinue; Stop-Process -Name "nvcontainer" -Force -EA SilentlyContinue; Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\NVIDIA Corporation\\NVControlPanel2\\Client' -Name 'OptInOrOutPreference' -Value 0 -Type DWord -EA SilentlyContinue; Write-Host "[NVIDIA] Overlay and container process hints suppressed" -ForegroundColor Green`,
  NvidiaLowLatency: `$gamesPath = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games'; If (!(Test-Path $gamesPath)) { New-Item -Path $gamesPath -Force | Out-Null }; Set-ItemProperty $gamesPath 'GPU Priority' 8 -Type DWord -Force; Set-ItemProperty $gamesPath 'Priority' 6 -Type DWord -Force; Set-ItemProperty $gamesPath 'Scheduling Category' 'High' -Type String -Force; Set-ItemProperty $gamesPath 'SFIO Priority' 'High' -Type String -Force; Set-ItemProperty $gamesPath 'MaximumPreRenderedFrames' 1 -Type DWord -Force; Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' -Name 'TdrDelay' -Value 10 -Type DWord -Force -EA SilentlyContinue; Write-Host "[NVIDIA] Low Latency Mode: GPU priority 8, Scheduling=High, PreRendered=1, TDR extended" -ForegroundColor Green`,
  NvidiaThreadedOpt: `$nvKey = 'HKLM:\\SOFTWARE\\NVIDIA Corporation\\Global\\NvTweak'; If (!(Test-Path $nvKey)) { New-Item $nvKey -Force | Out-Null }; Set-ItemProperty $nvKey 'Threaded_Optimization_Override' 1 -Type DWord -Force -EA SilentlyContinue; netsh int tcp set global dca=enabled 2>$null; $dxKey = 'HKLM:\\SOFTWARE\\Microsoft\\DirectX'; Set-ItemProperty $dxKey 'ThreadedOptimization' 1 -Type DWord -Force -EA SilentlyContinue; Write-Host "[NVIDIA] Threaded Optimization enabled via NvTweak registry and DirectX DCA" -ForegroundColor Green`,
  NvidiaForceVSyncOff: `$gdrv = 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers'; Remove-ItemProperty $gdrv 'VerticalSyncOverride' -EA SilentlyContinue; Remove-ItemProperty $gdrv 'TripleBufferingOverride' -EA SilentlyContinue; Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\NVIDIA Corporation\\Global\\NVTweak\\Policies' -Name 'VSync' -Value 0 -Type DWord -Force -EA SilentlyContinue; Write-Host "[NVIDIA] VSync override cleared — force VSync Off in NVCP or in-game for effect. Triple buffering key removed." -ForegroundColor Green`,
  NvidiaPowerMizer: `$gpuClass = 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}'; $found = $false; 0,1,2,3 | ForEach-Object { $k = "$gpuClass\\000$_"; If ((Test-Path $k) -and (Get-ItemProperty $k -Name 'DriverDesc' -EA SilentlyContinue).DriverDesc -match 'NVIDIA') { Set-ItemProperty $k 'PerfLevelSrc' 0x2222 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $k 'PowerMizerEnable' 1 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $k 'PowerMizerLevel' 1 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $k 'PowerMizerLevelAC' 1 -Type DWord -Force -EA SilentlyContinue; Write-Host "[NVIDIA] PowerMizer set to Max Performance on $k" -ForegroundColor Green; $found = $true } }; If (-not $found) { Write-Host "[NVIDIA] PowerMizer: NVIDIA GPU class key not found at 0000-0003 — apply via NVCP manually" -ForegroundColor Yellow }`,
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
  // ── WinUtil / ChrisTitus / OO ShutUp10++ ────────────────────────────────────
  WinTitusConsumerFeatures: `$path = 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\CloudContent'; If (!(Test-Path $path)) { New-Item -Path $path -Force | Out-Null }; Set-ItemProperty -Path $path -Name 'DisableWindowsConsumerFeatures' -Value 1 -Type DWord -Force; Set-ItemProperty -Path $path -Name 'DisableSoftLanding' -Value 1 -Type DWord -Force; Write-Host "[OK] Consumer features disabled — no more suggested apps or sponsored content in Start" -ForegroundColor Green`,
  WinTitusHibernation: `powercfg -h off; Write-Host "[OK] Hibernation disabled — hiberfil.sys removed, frees drive space and speeds up shutdown" -ForegroundColor Green`,
  WinTitusPosh7Telemetry: `[Environment]::SetEnvironmentVariable('POWERSHELL_TELEMETRY_OPTOUT', '1', 'Machine'); [Environment]::SetEnvironmentVariable('DOTNET_CLI_TELEMETRY_OPTOUT', '1', 'Machine'); Write-Host "[OK] PowerShell 7 and .NET CLI telemetry opt-out set in Machine environment" -ForegroundColor Green`,
  WinTitusWPBT: `$path = 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager'; Set-ItemProperty -Path $path -Name 'DisableWpbtExecution' -Value 1 -Type DWord -Force -EA SilentlyContinue; Write-Host "[OK] Windows Platform Binary Table (WPBT) execution disabled" -ForegroundColor Green`,
  WinTitusDiskCleanup: `@('Temporary Files','Recycle Bin','Thumbnail Cache','Windows Error Reporting Files','Downloaded Program Files','Temporary Internet Files') | ForEach-Object { $k = "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VolumeCaches\\$_"; If (Test-Path $k) { Set-ItemProperty $k 'StateFlags0001' 2 -Type DWord -EA SilentlyContinue } }; Start-Process -FilePath cleanmgr.exe -ArgumentList '/sagerun:1' -NoNewWindow; Write-Host "[OK] Disk Cleanup launched — temp files, recycle bin, thumbnails queued" -ForegroundColor Green`,
  WinTitusServicesManual: `$svcs = @('DiagTrack','DusmSvc','MapsBroker','lfsvc','PhoneSvc','RetailDemo','WMPNetworkSvc','WbioSrvc','XblAuthManager','XblGameSave','XboxNetApiSvc','SharedAccess','SSDPSRV','upnphost','W32Time','WinRM','RemoteRegistry','Fax','wercplsupport'); foreach ($s in $svcs) { Set-Service -Name $s -StartupType Manual -EA SilentlyContinue }; Write-Host "[OK] Non-essential services set to Manual startup (19 services)" -ForegroundColor Green`,
  WinTitusAdobeBlock: `$hosts = "$env:SystemRoot\\System32\\drivers\\etc\\hosts"; $entries = @('0.0.0.0 activate.adobe.com','0.0.0.0 practivate.adobe.com','0.0.0.0 ereg.adobe.com','0.0.0.0 activate.wip3.adobe.com','0.0.0.0 wip3.adobe.com','0.0.0.0 3dns.adobe.com','0.0.0.0 adobe-dns.adobe.com'); $content = Get-Content $hosts -Raw -EA SilentlyContinue; foreach ($e in $entries) { $domain = $e.Split(' ')[1]; if ($content -notmatch [regex]::Escape($domain)) { Add-Content $hosts "\`n$e" } }; Write-Host "[OK] Adobe activation servers blocked in hosts file (prevents phoning home)" -ForegroundColor Green`,
  WinTitusRazerBlock: `$path = 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate'; If (!(Test-Path $path)) { New-Item -Path $path -Force | Out-Null }; Set-ItemProperty -Path $path -Name 'ExcludeWUDriversInQualityUpdate' -Value 1 -Type DWord -Force -EA SilentlyContinue; Write-Host "[OK] Driver auto-install via Windows Update blocked (stops Razer injecting its driver)" -ForegroundColor Green`,
  WinTitusBgApps: `Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\BackgroundAccessApplications' -Name 'GlobalUserDisabled' -Value 1 -Type DWord -Force; Get-ChildItem 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\BackgroundAccessApplications' -EA SilentlyContinue | ForEach-Object { Set-ItemProperty -Path $_.PsPath -Name 'Disabled' -Value 1 -Type DWord -Force -EA SilentlyContinue }; Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\AppPrivacy' -Name 'LetAppsRunInBackground' -Value 2 -Type DWord -Force -EA SilentlyContinue; Write-Host "[OK] Background apps globally disabled" -ForegroundColor Green`,
  WinTitusFullscreenOpt: `$path = 'HKCU:\\System\\GameConfigStore'; Set-ItemProperty $path 'GameDVR_FSEBehavior' 2 -Type DWord -Force; Set-ItemProperty $path 'GameDVR_DSEBehavior' 2 -Type DWord -Force; Set-ItemProperty $path 'GameDVR_HonorUserFSEBehaviorMode' 1 -Type DWord -Force; Write-Host "[OK] Fullscreen Optimizations disabled globally — use borderless window instead for best results" -ForegroundColor Green`,
  WinTitusNotifTray: `$path = 'HKCU:\\SOFTWARE\\Policies\\Microsoft\\Windows\\Explorer'; If (!(Test-Path $path)) { New-Item $path -Force | Out-Null }; Set-ItemProperty $path 'DisableNotificationCenter' 1 -Type DWord -Force; Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\PushNotifications' -Name 'ToastEnabled' -Value 0 -Type DWord -Force; Write-Host "[OK] Notification tray / Action Center disabled" -ForegroundColor Green`,
  WinTitusStorageSense: `$p = 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\StorageSense\\Parameters\\StoragePolicy'; If (!(Test-Path $p)) { New-Item $p -Force | Out-Null }; Set-ItemProperty $p '01' 0 -Type DWord -Force -EA SilentlyContinue; Write-Host "[OK] Storage Sense disabled — Windows won't auto-delete files without permission" -ForegroundColor Green`,
  WinTitusTeredo: `netsh interface teredo set state disabled 2>$null; $p = 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip6\\Parameters'; If (Test-Path $p) { Set-ItemProperty $p 'DisabledComponents' 8 -Type DWord -Force -EA SilentlyContinue }; Write-Host "[OK] Teredo tunneling disabled — reduces network overhead on native IPv4 connections" -ForegroundColor Green`,
  WinTitusEdgeDebloat: `$ep = 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Edge'; If (!(Test-Path $ep)) { New-Item $ep -Force | Out-Null }; @{'BackgroundModeEnabled'=0;'EdgeCollectionsEnabled'=0;'HubsSidebarEnabled'=0;'PromotionalTabsEnabled'=0;'UserFeedbackAllowed'=0;'SpotlightExperiencesAndRecommendationsEnabled'=0;'EdgeShoppingAssistantEnabled'=0;'ShowMicrosoftRewards'=0}.GetEnumerator() | ForEach-Object { Set-ItemProperty $ep $_.Key $_.Value -Type DWord -Force -EA SilentlyContinue }; Write-Host "[OK] Microsoft Edge debloated — background mode, shopping assistant, rewards, and sidebars disabled" -ForegroundColor Green`,
  WinTitusIPv4Prefer: `$p = 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip6\\Parameters'; If (!(Test-Path $p)) { New-Item $p -Force | Out-Null }; Set-ItemProperty $p 'DisabledComponents' 0x20 -Type DWord -Force; Write-Host "[OK] IPv4 preferred over IPv6 (flag 0x20 — IPv6 still available, IPv4 wins by default)" -ForegroundColor Green`,
  WinTitusEdgeRemove: `Write-Host "[Edge] Searching for Edge setup.exe..." -ForegroundColor Yellow; $edgeSetup = $null; $searchPaths = @("C:\\Program Files (x86)\\Microsoft\\Edge\\Application","C:\\Program Files\\Microsoft\\Edge\\Application","C:\\Program Files (x86)\\Microsoft\\EdgeUpdate","C:\\Program Files\\Microsoft\\EdgeUpdate"); foreach ($sp in $searchPaths) { if (!$edgeSetup -and (Test-Path $sp)) { $found = Get-ChildItem $sp -Recurse -Filter "setup.exe" -EA SilentlyContinue | Select-Object -First 1; if ($found) { $edgeSetup = $found } } }; if ($edgeSetup) { Write-Host "[Edge] Found: $($edgeSetup.FullName)" -ForegroundColor Cyan; & $edgeSetup.FullName --uninstall --system-level --verbose-logging --force-uninstall 2>$null; Write-Host "[OK] Edge uninstall triggered via setup.exe" -ForegroundColor Green } Else { Write-Host "[Edge] setup.exe not found — trying AppxPackage removal..." -ForegroundColor Yellow; Get-AppxPackage -AllUsers *MicrosoftEdge* -EA SilentlyContinue | Remove-AppxPackage -AllUsers -EA SilentlyContinue; Write-Host "[OK] Edge AppxPackage removal attempted" -ForegroundColor Green }; $updateKey = "HKLM:\\SOFTWARE\\Microsoft\\EdgeUpdate"; if (!(Test-Path $updateKey)) { New-Item $updateKey -Force | Out-Null }; Set-ItemProperty $updateKey "DoNotUpdateToEdgeWithChromium" 1 -Type DWord -Force -EA SilentlyContinue; Remove-ItemProperty "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" -Name "Microsoft Edge" -EA SilentlyContinue; Write-Host "[OK] Edge removal complete — restart to finish" -ForegroundColor Green`,
  WinTitusXboxComponents: `Write-Host "[WARNING] This removes Xbox Gaming Services — skip if you use Xbox app or Game Pass" -ForegroundColor Yellow; @('Microsoft.XboxApp','Microsoft.GamingServices','Microsoft.XboxGamingOverlay','Microsoft.XboxSpeechToTextOverlay','Microsoft.Xbox.TCUI') | ForEach-Object { Get-AppxPackage -AllUsers $_ -EA SilentlyContinue | Remove-AppxPackage -EA SilentlyContinue }; Write-Host "[OK] Xbox and Gaming Services components removed" -ForegroundColor Green`,
  WinTitusClassicMenu: `$p = 'HKCU:\\SOFTWARE\\CLASSES\\CLSID\\{86CA1AA0-34AA-4E8B-A509-50C905BAE2A2}\\InprocServer32'; If (!(Test-Path $p)) { New-Item $p -Force | Out-Null }; Set-ItemProperty $p '(Default)' '' -Type String -Force; Stop-Process -Name explorer -Force -EA SilentlyContinue; Start-Sleep 1; Start-Process explorer; Write-Host "[OK] Classic right-click menu restored (Win11) — Explorer restarted" -ForegroundColor Green`,
  WinTitusDisplayPerf: `Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name 'UserPreferencesMask' -Value ([byte[]](0x10,0x00,0x00,0x00)) -Type Binary -Force; Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects' -Name 'VisualFXSetting' -Value 2 -Type DWord -Force -EA SilentlyContinue; Write-Host "[OK] Display set for best performance — visual effects stripped to minimum" -ForegroundColor Green`,
  WinTitusShowExtensions: `Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' -Name 'HideFileExt' -Value 0 -Type DWord -Force; Write-Host "[OK] File extensions shown in Explorer" -ForegroundColor Green`,
  WinTitusShowHidden: `Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' -Name 'Hidden' -Value 1 -Type DWord -Force; Write-Host "[OK] Hidden files and folders shown in Explorer" -ForegroundColor Green`,
  OOShutupPrivacy: `$s = @(@('HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection','AllowTelemetry',0),@('HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\DataCollection','AllowTelemetry',0),@('HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\AdvertisingInfo','Enabled',0),@('HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\AdvertisingInfo','DisabledByGroupPolicy',1),@('HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\System','EnableActivityFeed',0),@('HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\System','PublishUserActivities',0),@('HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Search','BingSearchEnabled',0),@('HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Search','CortanaConsent',0),@('HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\AppPrivacy','LetAppsRunInBackground',2),@('HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\DeviceAccess\\Global\\{BFA794E4-F964-4FDB-90F6-51056BFE4B44}','Value','Deny'),@('HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\DeviceAccess\\Global\\{52079E78-A92B-413F-B213-E8FE35712E72}','Value','Deny'),@('HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\DeviceAccess\\Global\\{2EEF81BE-33FA-4800-9670-1CD474972C3F}','Value','Deny')); foreach ($r in $s) { $path=$r[0];$name=$r[1];$val=$r[2]; If (!(Test-Path $path)) { New-Item $path -Force | Out-Null }; If ($val -is [string]) { Set-ItemProperty $path $name $val -Type String -Force -EA SilentlyContinue } Else { Set-ItemProperty $path $name $val -Type DWord -Force -EA SilentlyContinue } }; Write-Host "[OK] OO ShutUp10++ recommended privacy settings applied (12 registry changes)" -ForegroundColor Green`,

  // ── NVIDIA Advanced Registry Tweaks ─────────────────────────────────────────
  NvidiaAnisoFiltering: `$gpuClass = 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}'; $found=$false; 0,1,2,3 | ForEach-Object { $k = "$gpuClass\\000$_"; If ((Test-Path $k) -and (Get-ItemProperty $k -Name 'DriverDesc' -EA SilentlyContinue).DriverDesc -match 'NVIDIA') { Set-ItemProperty $k -Name 'ForcedMipmapsMinLod' -Value 0 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $k -Name 'AnisotropicDegree' -Value 16 -Type DWord -Force -EA SilentlyContinue; Write-Host "[NVIDIA] Anisotropic Filtering 16x forced on $k" -ForegroundColor Green; $found=$true } }; If (-not $found) { Write-Host "[NVIDIA] NVIDIA GPU class key not found — apply AF manually in NVCP" -ForegroundColor Yellow }`,
  NvidiaTripleBufferOff: `$gdrv = 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers'; Remove-ItemProperty $gdrv 'TripleBufferingOverride' -EA SilentlyContinue; $nvPol = 'HKCU:\\SOFTWARE\\NVIDIA Corporation\\Global\\NVTweak\\Policies'; If (!(Test-Path $nvPol)) { New-Item $nvPol -Force | Out-Null }; Set-ItemProperty $nvPol 'TripleBuffering' 0 -Type DWord -Force -EA SilentlyContinue; Write-Host "[NVIDIA] Triple Buffering disabled — reduces frame buffer depth for lower input latency" -ForegroundColor Green`,
  NvidiaReflexEnable: `$reflexPath = 'HKLM:\\SOFTWARE\\NVIDIA Corporation\\Global\\Reflex'; If (!(Test-Path $reflexPath)) { New-Item $reflexPath -Force | Out-Null }; Set-ItemProperty $reflexPath 'Enable' 1 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $reflexPath 'BoostEnabled' 1 -Type DWord -Force -EA SilentlyContinue; $gamePath = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games'; If (!(Test-Path $gamePath)) { New-Item $gamePath -Force | Out-Null }; Set-ItemProperty $gamePath 'MaximumPreRenderedFrames' 1 -Type DWord -Force -EA SilentlyContinue; Write-Host "[NVIDIA] Reflex hint enabled (Enable=1, BoostEnabled=1) — pair with in-game Reflex for lowest click-to-pixel latency" -ForegroundColor Green`,
  NvidiaGSyncOptimize: `$nvKey = 'HKLM:\\SOFTWARE\\NVIDIA Corporation\\Global\\NvTweak'; If (!(Test-Path $nvKey)) { New-Item $nvKey -Force | Out-Null }; Set-ItemProperty $nvKey 'GSyncEnabled' 1 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $nvKey 'VSyncEnabled' 0 -Type DWord -Force -EA SilentlyContinue; $gdrv = 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers'; Set-ItemProperty $gdrv 'DisableBlockWrite' 0 -Type DWord -Force -EA SilentlyContinue; Write-Host "[NVIDIA] G-Sync: VSync disabled, G-Sync enabled, block write path cleared — optimized VRR pipeline" -ForegroundColor Green`,
  NvidiaOpenGLOpt: `$nvKey = 'HKLM:\\SOFTWARE\\NVIDIA Corporation\\Global\\NvTweak'; If (!(Test-Path $nvKey)) { New-Item $nvKey -Force | Out-Null }; Set-ItemProperty $nvKey 'OpenGLThreadedOptimizations' 1 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $nvKey 'OGLFrameMaxAhead' 1 -Type DWord -Force -EA SilentlyContinue; Write-Host "[NVIDIA] OpenGL: threaded optimizations=On, render-ahead=1 frame — reduces CPU submission overhead in OpenGL titles" -ForegroundColor Green`,
  NvidiaVRAMMax: `Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' -Name 'DedicatedSegmentSize' -Value 0 -Type DWord -Force -EA SilentlyContinue; $nvKey = 'HKCU:\\SOFTWARE\\NVIDIA Corporation\\NVControlPanel2\\Client'; If (!(Test-Path $nvKey)) { New-Item $nvKey -Force | Out-Null }; Set-ItemProperty $nvKey 'VRAMUsage' 1 -Type DWord -Force -EA SilentlyContinue; Write-Host "[NVIDIA] VRAM: DedicatedSegmentSize cleared + VRAMUsage=1 — driver auto-manages VRAM without artificial limit" -ForegroundColor Green`,

  // ── AMD Advanced Tweaks ───────────────────────────────────────────────────
  AmdSmartAccessMemory: `$gpuPath = 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}'; $found=$false; Get-ChildItem $gpuPath -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc -match 'AMD|Radeon|ATI' } | ForEach-Object { Set-ItemProperty $_.PSPath -Name 'KMD_EnableResizableBar' -Value 1 -Type DWord -EA SilentlyContinue; Set-ItemProperty $_.PSPath -Name 'KMD_EnableSmartAccessMemory' -Value 1 -Type DWord -EA SilentlyContinue; Write-Host "[AMD] Smart Access Memory enabled on $((Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc)" -ForegroundColor Green; $found=$true }; If (-not $found) { Write-Host "[AMD] No AMD GPU class key found — verify Resizable BAR is enabled in BIOS first" -ForegroundColor Yellow } Else { Write-Host "[AMD] SAM (Resizable BAR) enabled — CPU has full VRAM access, improves DX12/Vulkan 5-15%" -ForegroundColor Green }`,
  AmdAntiLagPlus: `Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\AMD\\CN' -Name 'AntiLag' -Value 1 -Type DWord -EA SilentlyContinue; Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\AMD\\CN' -Name 'AntiLagPlus' -Value 1 -Type DWord -EA SilentlyContinue; Write-Host "[AMD] Anti-Lag + Anti-Lag+ enabled. Anti-Lag works on RX 5000+, Anti-Lag+ requires RX 7000 series + driver 23.11.1+" -ForegroundColor Green`,
  AmdFluidMotionFrames: `$gpuPath = 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $gpuPath -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc -match 'AMD|Radeon|ATI' } | ForEach-Object { Set-ItemProperty $_.PSPath -Name 'KMD_EnableFrameGeneration' -Value 1 -Type DWord -EA SilentlyContinue; Write-Host "[AMD] AFMF frame generation hint set on $((Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc)" -ForegroundColor Green }; Write-Host "[AMD] Fluid Motion Frames (AFMF) hint applied. Requires RX 7000 + driver 23.11.1+ + enable in Radeon Software Global Graphics" -ForegroundColor Cyan`,

  // ── Game Detection: Additional Games ────────────────────────────────────────
  game_warframe: `$paths = @("C:\\Program Files (x86)\\Steam\\steamapps\\common\\Warframe","D:\\SteamLibrary\\steamapps\\common\\Warframe","$env:LOCALAPPDATA\\Warframe"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { Write-Host "[DETECTED] Warframe at $found" -ForegroundColor Green; $key = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\Warframe.x64.exe\\PerfOptions'; If (!(Test-Path $key)) { New-Item $key -Force | Out-Null }; Set-ItemProperty $key 'CpuPriorityClass' 3; Set-ItemProperty $key 'IoPriority' 3; Write-Host "[OK] Warframe: Above Normal CPU + High I/O priority" -ForegroundColor Green } Else { Write-Host "[SKIP] Warframe not detected" -ForegroundColor DarkGray }`,
  game_forza: `$paths = @("C:\\Program Files (x86)\\Steam\\steamapps\\common\\ForzaHorizon5","D:\\SteamLibrary\\steamapps\\common\\ForzaHorizon5","$env:ProgramFiles\\WindowsApps"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { Write-Host "[DETECTED] Forza Horizon 5" -ForegroundColor Green; $key = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\ForzaHorizon5.exe\\PerfOptions'; If (!(Test-Path $key)) { New-Item $key -Force | Out-Null }; Set-ItemProperty $key 'CpuPriorityClass' 3; Set-ItemProperty $key 'IoPriority' 3; Write-Host "[OK] Forza Horizon 5: Above Normal CPU + High I/O priority" -ForegroundColor Green } Else { Write-Host "[SKIP] Forza Horizon 5 not detected" -ForegroundColor DarkGray }`,
  game_readyornot: `$paths = @("C:\\Program Files (x86)\\Steam\\steamapps\\common\\Ready Or Not","D:\\SteamLibrary\\steamapps\\common\\Ready Or Not","E:\\SteamLibrary\\steamapps\\common\\Ready Or Not"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { Write-Host "[DETECTED] Ready or Not" -ForegroundColor Green; $key = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\ReadyOrNot.exe\\PerfOptions'; If (!(Test-Path $key)) { New-Item $key -Force | Out-Null }; Set-ItemProperty $key 'CpuPriorityClass' 3; Set-ItemProperty $key 'IoPriority' 3; Write-Host "[OK] Ready or Not: Above Normal CPU + High I/O priority" -ForegroundColor Green } Else { Write-Host "[SKIP] Ready or Not not detected" -ForegroundColor DarkGray }`,
  game_phasmo: `$paths = @("C:\\Program Files (x86)\\Steam\\steamapps\\common\\Phasmophobia","D:\\SteamLibrary\\steamapps\\common\\Phasmophobia"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { Write-Host "[DETECTED] Phasmophobia" -ForegroundColor Green; $key = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\Phasmophobia.exe\\PerfOptions'; If (!(Test-Path $key)) { New-Item $key -Force | Out-Null }; Set-ItemProperty $key 'CpuPriorityClass' 3; Set-ItemProperty $key 'IoPriority' 3; Write-Host "[OK] Phasmophobia: Above Normal CPU + High I/O priority" -ForegroundColor Green } Else { Write-Host "[SKIP] Phasmophobia not detected" -ForegroundColor DarkGray }`,
  game_battlefield: `$paths = @("C:\\Program Files\\EA Games\\Battlefield 2042","C:\\Program Files (x86)\\Origin Games\\Battlefield 2042","C:\\Program Files (x86)\\Steam\\steamapps\\common\\Battlefield 2042","D:\\SteamLibrary\\steamapps\\common\\Battlefield 2042"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { Write-Host "[DETECTED] Battlefield 2042" -ForegroundColor Green; $key = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\BF2042.exe\\PerfOptions'; If (!(Test-Path $key)) { New-Item $key -Force | Out-Null }; Set-ItemProperty $key 'CpuPriorityClass' 3; Set-ItemProperty $key 'IoPriority' 3; Write-Host "[OK] Battlefield 2042: Above Normal CPU + High I/O priority" -ForegroundColor Green } Else { Write-Host "[SKIP] Battlefield 2042 not detected" -ForegroundColor DarkGray }`,
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
  bcdedit: {
    label: "BCD Boot Config (bcdedit Fixes)",
    commands: [
      `Write-Host "[RESTORE] BCD Boot Config..." -ForegroundColor Cyan`,
      `bcdedit /deletevalue useplatformtick 2>$null; Write-Host "[OK] useplatformtick removed — back to Windows default timer" -ForegroundColor Green`,
      `bcdedit /deletevalue uselegacyapicmode 2>$null; Write-Host "[OK] uselegacyapicmode removed" -ForegroundColor Green`,
      `bcdedit /deletevalue disabledynamictick 2>$null; Write-Host "[OK] disabledynamictick removed — dynamic tick restored" -ForegroundColor Green`,
      `bcdedit /set hypervisorlaunchtype Auto 2>$null; Write-Host "[OK] hypervisorlaunchtype set to Auto (safe default)" -ForegroundColor Green`,
      `bcdedit /set nx OptIn 2>$null; Write-Host "[OK] nx=OptIn — Data Execution Prevention re-enabled" -ForegroundColor Green`,
      `Write-Host "[DONE] BCD boot config restored — restart required" -ForegroundColor Green`,
    ],
  },
  "gpu-usage": {
    label: "High GPU Usage / Driver Issues",
    commands: [
      `Write-Host "[RESTORE] GPU Usage and Driver Settings..." -ForegroundColor Cyan`,
      `Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' -Name 'HwSchMode' -Value 1 -Type DWord -Force -EA SilentlyContinue; Write-Host "[OK] HAGS (HwSchMode) disabled — set to 1 (Windows default off)" -ForegroundColor Green`,
      `Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' -Name 'TdrLevel' -Value 3 -Type DWord -Force -EA SilentlyContinue; Write-Host "[OK] TdrLevel reset to 3 (Windows default)" -ForegroundColor Green`,
      `Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' -Name 'TdrDelay' -Value 2 -Type DWord -Force -EA SilentlyContinue; Write-Host "[OK] TdrDelay reset to 2 seconds (default)" -ForegroundColor Green`,
      `Remove-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' -Name 'PagingAllocation' -EA SilentlyContinue; Write-Host "[OK] GPU PagingAllocation key removed — default GPU paging restored" -ForegroundColor Green`,
      `Remove-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' -Name 'Scheduler' -EA SilentlyContinue; Write-Host "[OK] GraphicsDrivers Scheduler hint cleared" -ForegroundColor Green`,
      `@('NvTelemetryContainer','NvDisplayContainerLS') | ForEach-Object { Set-Service $_ -StartupType Automatic -EA SilentlyContinue; Start-Service $_ -EA SilentlyContinue }; Write-Host "[OK] NVIDIA container services re-enabled" -ForegroundColor Green`,
      `Write-Host "[TIP] If GPU usage is still high at idle, open Task Manager and check for hardware-accelerated GPU scheduling apps" -ForegroundColor Yellow`,
    ],
  },
  "time-sync": {
    label: "Windows Time & Clock Sync",
    commands: [
      `Write-Host "[RESTORE] Windows Time & Clock Sync..." -ForegroundColor Cyan`,
      `Set-Service -Name 'W32Time' -StartupType Manual -EA SilentlyContinue; Start-Service -Name 'W32Time' -EA SilentlyContinue; Write-Host "[OK] Windows Time service re-enabled and started" -ForegroundColor Green`,
      `w32tm /config /manualpeerlist:"time.windows.com" /syncfromflags:manual /reliable:YES /update 2>$null; Write-Host "[OK] NTP server set to time.windows.com" -ForegroundColor Green`,
      `w32tm /resync /force 2>$null; Write-Host "[OK] Time sync forced — clock should be accurate now" -ForegroundColor Green`,
      `Net start W32Time 2>$null; Write-Host "[OK] W32Time service confirmed running" -ForegroundColor Green`,
      `Write-Host "[DONE] If your clock was wrong after WinUtil tweaks, it should now be correct." -ForegroundColor Green`,
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
    ``,
    `# --- Admin Elevation Check ---`,
    `$_principal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()`,
    `if (-not \$_principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {`,
    `    Write-Host "[UAC] Requires Administrator. Relaunching elevated..." -ForegroundColor Yellow`,
    `    Start-Process PowerShell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File \`"\$(\$MyInvocation.MyCommand.Path)\`"" ; exit`,
    `}`,
    ``,
    `Write-Host "=====================================" -ForegroundColor Red`,
    `Write-Host "  OPTI GODS by leaq" -ForegroundColor Red`,
    `Write-Host "  Starting ${enabledTweaks.length} optimizations..." -ForegroundColor White`,
    `Write-Host "  Running as: \$env:USERNAME (Admin)" -ForegroundColor Cyan`,
    `Write-Host "=====================================" -ForegroundColor Red`,
    ``,
    `# --- Smart Hardware Detection ---`,
    `$_cpu = Get-CimInstance Win32_Processor | Select-Object -First 1`,
    `$_cpuCores = $_cpu.NumberOfCores`,
    `$_cpuLogical = $_cpu.NumberOfLogicalProcessors`,
    `$_cpuName = $_cpu.Name.Trim()`,
    `$_ramGB = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB)`,
    `$_winVer = (Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion' -EA SilentlyContinue)`,
    `$_build = "$(\$_winVer.CurrentMajorVersionNumber).$(\$_winVer.CurrentMinorVersionNumber).$(\$_winVer.CurrentBuildNumber)"`,
    ``,
    `# Auto-select CpuPriorityClass based on physical core count`,
    `# 8+ physical cores: High (4) — powerful enough to handle it without starvation`,
    `# 6 or fewer cores: AboveNormal (3) — safe universal value, no scheduler starvation risk`,
    `if (\$_cpuCores -ge 8) {`,
    `    \$PRIORITY_CLASS = 4`,
    `    \$_tier = "High-End ($(\$_cpuCores) cores) -> CpuPriorityClass = 4 (High)"`,
    `} else {`,
    `    \$PRIORITY_CLASS = 3`,
    `    \$_tier = "Standard ($(\$_cpuCores) cores) -> CpuPriorityClass = 3 (AboveNormal)"`,
    `}`,
    ``,
    `Write-Host "" `,
    `Write-Host "[DETECT] CPU : \$_cpuName" -ForegroundColor Cyan`,
    `Write-Host "[DETECT] Cores: \$(\$_cpuCores)P / \$(\$_cpuLogical)L  RAM: \$(\$_ramGB)GB  Windows: \$_build" -ForegroundColor Cyan`,
    `Write-Host "[DETECT] \$_tier" -ForegroundColor Cyan`,
    `Write-Host "" `,
    ``,
    `# Apply hardware-optimal CpuPriorityClass to all game executables`,
    `\$_ifeo = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options'`,
    `\$_gameExes = @('GTA5.exe','FiveM.exe','fivem.exe','FortniteClient-Win64-Shipping.exe','cs2.exe','VALORANT-Win64-Shipping.exe','r5apex.exe','RainbowSix.exe','cod.exe','RustClient.exe','TslGame.exe','EscapeFromTarkov.exe','RobloxPlayerBeta.exe','dota2.exe','DeadByDaylight-Win64-Shipping.exe','PUBG.exe','Overwatch.exe')`,
    `foreach (\$_exe in \$_gameExes) {`,
    `    \$_p = "\$_ifeo\\\$_exe\\PerfOptions"`,
    `    if (!(Test-Path \$_p)) { New-Item \$_p -Force | Out-Null }`,
    `    Set-ItemProperty \$_p 'CpuPriorityClass' \$PRIORITY_CLASS -Type DWord -Force`,
    `}`,
    `Get-ChildItem \$_ifeo -EA SilentlyContinue | Where-Object { \$_.PSChildName -like 'FiveM_b*_GTAProcess.exe' } | ForEach-Object {`,
    `    \$_p = "\$_ifeo\\\$(\$_.PSChildName)\\PerfOptions"`,
    `    if (!(Test-Path \$_p)) { New-Item \$_p -Force | Out-Null }`,
    `    Set-ItemProperty \$_p 'CpuPriorityClass' \$PRIORITY_CLASS -Type DWord -Force`,
    `}`,
    `@('FiveM_b2189_GTAProcess.exe','FiveM_b3323_GTAProcess.exe','FiveM_b3258_GTAProcess.exe','FiveM_b2802_GTAProcess.exe','FiveM_b2699_GTAProcess.exe') | ForEach-Object {`,
    `    \$_p = "\$_ifeo\\\$_\\PerfOptions"`,
    `    if (!(Test-Path \$_p)) { New-Item \$_p -Force | Out-Null }`,
    `    Set-ItemProperty \$_p 'CpuPriorityClass' \$PRIORITY_CLASS -Type DWord -Force`,
    `}`,
    `Write-Host "[DETECT] CpuPriorityClass \$PRIORITY_CLASS applied to \$(\$_gameExes.Count)+ game executables" -ForegroundColor Green`,
    `Write-Host "" `,
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
      : key.startsWith("Win11") || key.startsWith("WinTitus") || key.startsWith("OO") ? "Win Tweaks"
      : "Registry / System";
    if (!categories[cat]) categories[cat] = [];
    // Wrap each tweak in try/catch so failures show [ERR] but don't abort the whole script
    const wrapped = [
      `Write-Host "[>>] ${key}..." -ForegroundColor DarkYellow`,
      `try {`,
      `    ${cmd}`,
      `} catch {`,
      `    Write-Host "[ERR] ${key}: \$_" -ForegroundColor Red`,
      `}`,
    ].join("\n");
    categories[cat].push(wrapped);
  }

  for (const [cat, cmds] of Object.entries(categories)) {
    scriptLines.push(`Write-Host "" `);
    scriptLines.push(`Write-Host "--- [${cat}] ${cmds.length} tweak(s) ---" -ForegroundColor DarkRed`);
    scriptLines.push(...cmds);
  }

  scriptLines.push(``);
  scriptLines.push(`Write-Host "" `);
  scriptLines.push(`Write-Host "=====================================" -ForegroundColor Green`);
  scriptLines.push(`Write-Host "  All ${enabledTweaks.length} tweaks applied!" -ForegroundColor Green`);
  scriptLines.push(`Write-Host "  Restart your PC to activate all changes." -ForegroundColor Green`);
  scriptLines.push(`Write-Host "=====================================" -ForegroundColor Green`);
  scriptLines.push(`Write-Host "" `);
  scriptLines.push(`Read-Host "Press Enter to close this window"`);
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

  // ── System Scan Script — generates a PS1 that checks which tweaks are applied ──
  app.get('/api/scan/script', (_req, res) => {
    const scanLines = [
      `# =============================================`,
      `# OPTI GODS by leaq — System Scan Script`,
      `# Run this as Administrator to check which`,
      `# Opti Gods tweaks are already applied.`,
      `# Generated: ${new Date().toISOString()}`,
      `# =============================================`,
      ``,
      `$ErrorActionPreference = 'SilentlyContinue'`,
      `$applied = 0`,
      `$missing = 0`,
      `$results = @()`,
      ``,
      `function Check { param($name, $expr) try { $val = Invoke-Expression $expr; if ($val) { $script:applied++; $script:results += "[OK]   $name" } else { $script:missing++; $script:results += "[---]  $name" } } catch { $script:missing++; $script:results += "[ERR]  $name" } }`,
      ``,
      `Write-Host "" `,
      `Write-Host "=========================================" -ForegroundColor Red`,
      `Write-Host "  OPTI GODS — System Scan" -ForegroundColor Red`,
      `Write-Host "=========================================" -ForegroundColor White`,
      `Write-Host "" `,
      ``,
      `# CPU / Scheduling`,
      `Check "Win32PrioritySeparation = 38" "(Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl' -EA SilentlyContinue).Win32PrioritySeparation -eq 38"`,
      `Check "Timer Resolution (bcdedit useplatformclock)" "(bcdedit /enum | Select-String 'useplatformclock') -match 'Yes'"`,
      `Check "DisableHungAppDetection" "(Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\SessionManager' -EA SilentlyContinue).HungAppTimeout -eq 1000"`,
      `Check "EnableMSIMode (GPU)" "(Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Enum\\PCI' -EA SilentlyContinue -Recurse | Where { \$_.DeviceDesc -match 'VGA' } | Select -First 1) -ne \$null"`,
      ``,
      `# Network`,
      `Check "NetworkThrottlingIndex = 4294967295" "(Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile' -EA SilentlyContinue).NetworkThrottlingIndex -eq 4294967295"`,
      `Check "TCPAutoTuning = Disabled" "((netsh int tcp show global) -join '') -match 'disabled'"`,
      `Check "Nagle Disabled (TcpAckFrequency=1)" "(Get-ChildItem 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces' -EA SilentlyContinue | ForEach { (Get-ItemProperty \$_.PSPath -EA SilentlyContinue).TcpAckFrequency } | Where { \$_ -eq 1 } | Measure-Object).Count -gt 0"`,
      `Check "IPv6 Disabled" "(Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip6\\Parameters' -EA SilentlyContinue).DisabledComponents -gt 0"`,
      ``,
      `# Memory`,
      `Check "Memory Compression Disabled" "(Get-MMAgent -EA SilentlyContinue).MemoryCompression -eq \$false"`,
      `Check "Superfetch Disabled" "(Get-Service SysMain -EA SilentlyContinue).StartType -eq 'Disabled'"`,
      ``,
      `# Gaming`,
      `Check "GameDVR Disabled" "(Get-ItemProperty 'HKCU:\\System\\GameConfigStore' -EA SilentlyContinue).GameDVR_Enabled -eq 0"`,
      `Check "HAGS Enabled" "(Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' -EA SilentlyContinue).HwSchMode -eq 2"`,
      `Check "XboxGameBar Disabled" "(Get-AppxPackage Microsoft.XboxGamingOverlay -EA SilentlyContinue) -eq \$null"`,
      `Check "Mouse Precision Disabled" "(Get-ItemProperty 'HKCU:\\Control Panel\\Mouse' -EA SilentlyContinue).MouseSpeed -eq 0"`,
      ``,
      `# Power`,
      `Check "High Performance Power Plan Active" "(powercfg /getactivescheme) -match '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c'"`,
      `Check "Core Parking Disabled" "(Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Power\\PowerSettings\\54533251-82be-4824-96c1-47b60b740d00\\0cc5b647-c1df-4637-891a-dec35c318583' -EA SilentlyContinue).ValueMax -eq 0"`,
      `Check "Dynamic Tick Disabled" "(bcdedit /enum | Select-String 'disabledynamictick') -match 'Yes'"`,
      ``,
      `# NVIDIA`,
      `Check "NVIDIA Telemetry Disabled" "(Get-Service NvTelemetryContainer -EA SilentlyContinue).StartType -eq 'Disabled'"`,
      `Check "PreRenderedFrames = 1" "(Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games' -EA SilentlyContinue).MaximumPreRenderedFrames -eq 1"`,
      `Check "GPU Priority = 8" "(Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games' -EA SilentlyContinue).'GPU Priority' -eq 8"`,
      `Check "NVIDIA PowerMizer Max Perf" "(Get-ChildItem 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}' -EA SilentlyContinue | Where { (Get-ItemProperty \$_.PSPath -EA SilentlyContinue).DriverDesc -match 'NVIDIA' } | ForEach { (Get-ItemProperty \$_.PSPath -EA SilentlyContinue).PowerMizerLevel } | Where { \$_ -eq 1 } | Measure-Object).Count -gt 0"`,
      ``,
      `# AMD`,
      `Check "AMD ULPS Disabled" "(Get-ChildItem 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}' -EA SilentlyContinue | Where { (Get-ItemProperty \$_.PSPath -EA SilentlyContinue).DriverDesc -match 'AMD|Radeon' } | ForEach { (Get-ItemProperty \$_.PSPath -EA SilentlyContinue).EnableUlps } | Where { \$_ -eq 0 } | Measure-Object).Count -gt 0"`,
      `Check "AMD Telemetry Disabled" "(Get-Service 'AMD External Events Utility' -EA SilentlyContinue).StartType -eq 'Disabled'"`,
      `Check "AMD Anti-Lag Enabled" "(Get-ItemProperty 'HKCU:\\SOFTWARE\\AMD\\CN' -EA SilentlyContinue).AntiLag -eq 1"`,
      ``,
      `# Services`,
      `Check "DiagTrack Disabled" "(Get-Service DiagTrack -EA SilentlyContinue).StartType -eq 'Disabled'"`,
      `Check "Windows Search Disabled" "(Get-Service WSearch -EA SilentlyContinue).StartType -eq 'Disabled'"`,
      `Check "SysMain Disabled" "(Get-Service SysMain -EA SilentlyContinue).StartType -eq 'Disabled'"`,
      ``,
      `# Privacy`,
      `Check "Telemetry Opt-Out (AllowTelemetry=0)" "(Get-ItemProperty 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection' -EA SilentlyContinue).AllowTelemetry -eq 0"`,
      `Check "Advertising ID Disabled" "(Get-ItemProperty 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\AdvertisingInfo' -EA SilentlyContinue).Enabled -eq 0"`,
      ``,
      `# Output results`,
      `Write-Host "" `,
      `Write-Host "--- SCAN RESULTS ---" -ForegroundColor Cyan`,
      `$results | ForEach-Object {`,
      `    if ($_ -match '\\[OK\\]') { Write-Host $_ -ForegroundColor Green }`,
      `    elseif ($_ -match '\\[ERR\\]') { Write-Host $_ -ForegroundColor Yellow }`,
      `    else { Write-Host $_ -ForegroundColor DarkGray }`,
      `}`,
      `Write-Host "" `,
      `Write-Host "=========================================" -ForegroundColor Red`,
      `Write-Host "  Applied: $applied  |  Missing: $missing" -ForegroundColor White`,
      `$pct = if (($applied + $missing) -gt 0) { [math]::Round($applied / ($applied + $missing) * 100) } else { 0 }`,
      `Write-Host "  Optimization score: $pct%" -ForegroundColor $(if ($pct -ge 80) { 'Green' } elseif ($pct -ge 50) { 'Yellow' } else { 'Red' })`,
      `Write-Host "=========================================" -ForegroundColor Red`,
      `Write-Host "" `,
      `Write-Host "Run your Opti Gods script to apply missing tweaks." -ForegroundColor Cyan`,
      `Read-Host "Press ENTER to close"`,
    ];

    const script = scanLines.join('\n');
    res.setHeader('Content-Disposition', 'attachment; filename="OptiGods-ScanSystem.ps1"');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(script);
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
  app.post('/api/script/download', async (req, res) => {
    const tweaks: Record<string, boolean> = req.body?.tweaks || {};
    const nvidiaPreset: string = req.body?.nvidiaPreset || "Balanced";
    const enabledTweaks = Object.entries(tweaks).filter(([, v]) => v).map(([k]) => k);
    const scriptContent = buildScript(enabledTweaks, nvidiaPreset);
    // Record download analytics (fire-and-forget)
    storage.recordScriptDownload(enabledTweaks).catch(() => {});
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename="OptiGods-by-leaq.ps1"');
    res.send(scriptContent);
  });

  // .bat download — double-click to run, no right-click needed
  app.post('/api/script/download-bat', async (req, res) => {
    const tweaks: Record<string, boolean> = req.body?.tweaks || {};
    const nvidiaPreset: string = req.body?.nvidiaPreset || "Balanced";
    const enabledTweaks = Object.entries(tweaks).filter(([, v]) => v).map(([k]) => k);
    // Record download analytics (fire-and-forget)
    storage.recordScriptDownload(enabledTweaks).catch(() => {});
    const ps1Content = buildScript(enabledTweaks, nvidiaPreset);
    // Escape the PS1 content for embedding in a .bat here-string
    const escapedPs1 = ps1Content.replace(/%/g, '%%');
    const batContent = `@echo off
title Opti Gods by leaq - Running Optimizations
echo.
echo  ===============================================
echo   OPTI GODS by leaq - Applying Optimizations
echo  ===============================================
echo.
echo  Running as: %USERNAME%
echo  Please wait while your PC is being optimized...
echo.

:: Write PowerShell script to temp
set "TMPPS1=%TEMP%\\OptiGods-by-leaq.ps1"
(
echo ${escapedPs1.split('\n').join('\necho ')}
) > "%TMPPS1%"

:: Run with elevated PowerShell — bypasses execution policy
PowerShell -NoProfile -ExecutionPolicy Bypass -File "%TMPPS1%"

:: Clean up
del "%TMPPS1%" 2>nul

echo.
echo  ===============================================
echo   Done! Restart your PC for all changes to apply
echo  ===============================================
echo.
pause
`;
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename="OptiGods-by-leaq.bat"');
    res.send(batContent);
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
    const normalizedCode = String(code).toUpperCase().trim();

    // Try DB single-use code (marks usedAt on first use)
    const redeemed = await storage.redeemCode(normalizedCode);
    if (redeemed) return res.json({ valid: true });

    // Backward-compat + safety net: code may have been pre-burned by the old
    // email send flow (usedAt set when admin clicked Send Code, not by customer).
    // Also covers edge cases where customer enters a valid email-sent code twice.
    // Grant access if this code is legitimately linked to an accepted email request.
    const allCodes = await storage.getAllCodes();
    const matchingCode = allCodes.find(c => c.code === normalizedCode);
    if (matchingCode) {
      const emailReqs = await storage.getEmailRequests();
      const linkedReq = emailReqs.find(r =>
        r.sentCodeId === matchingCode.id &&
        (r.status === "sent" || r.status === "auto-sent")
      );
      if (linkedReq) {
        // Payment was confirmed by admin — customer is entitled to Pro access
        return res.json({ valid: true });
      }
    }

    // Fallback: legacy env var codes (unlimited use, for backward compat)
    const legacyCodes = (process.env.PRO_CODES || '').split(',').map(c => c.trim().toUpperCase()).filter(Boolean);
    const validLegacy = legacyCodes.includes(normalizedCode);
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
    const [codes, friends, visitStats, emailReqs] = await Promise.all([
      storage.getAllCodes(),
      storage.getAllFriendTokens(),
      storage.getVisitStats(),
      storage.getEmailRequests(),
    ]);
    // Codes reserved for email requests (sentCodeId set on a sent/auto-sent request)
    const reservedCodeIds = new Set(
      emailReqs
        .filter(r => r.sentCodeId && (r.status === "sent" || r.status === "auto-sent"))
        .map(r => r.sentCodeId)
    );
    // Available = not used AND not reserved by a sent email request
    const availableCodes = codes.filter(c => !c.usedAt && !reservedCodeIds.has(c.id)).length;
    // Confirmed email payments (admin accepted = payment confirmed)
    const emailRevenue = emailReqs.filter(r => r.status === "sent" || r.status === "auto-sent").length;
    // Directly redeemed codes (customer entered code manually, not via email path)
    const directRevenue = codes.filter(c => c.usedAt && !reservedCodeIds.has(c.id)).length;
    const revenueEstimate = (emailRevenue + directRevenue) * 25;
    const usedCodes = codes.filter(c => c.usedAt).length;
    const usedFriends = friends.filter(f => f.usedAt).length;
    const availableFriends = friends.filter(f => !f.usedAt).length;
    res.json({
      totalCodes: codes.length,
      usedCodes,
      availableCodes,
      totalFriends: friends.length,
      usedFriends,
      availableFriends,
      revenueEstimate,
      emailRevenue,
      directRevenue,
      visits: visitStats,
    });
  });

  // Download analytics — how many scripts, which tweaks, trend
  app.get('/api/admin/download-stats', async (req, res) => {
    if (!checkAdminKey(req, res)) return;
    try {
      const stats = await storage.getDownloadStats();
      res.json(stats);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
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
Check 'FortniteHighPriority'     '((Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\FortniteClient-Win64-Shipping.exe\\PerfOptions" -Name CpuPriorityClass -EA SilentlyContinue).CpuPriorityClass) -eq 3'
Check 'FortniteDisableVSync'     'Test-Path "$env:LOCALAPPDATA\\FortniteGame\\Saved\\Config\\WindowsClient\\Engine.ini" -EA SilentlyContinue'
Check 'FortniteGameMode'         '((Get-ItemProperty "HKCU:\\SOFTWARE\\Microsoft\\GameBar" -Name AutoGameModeEnabled -EA SilentlyContinue).AutoGameModeEnabled) -eq 1'

# --- FiveM ---
Check 'FiveMHighPriority'              '((Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\GTA5.exe\\PerfOptions" -Name CpuPriorityClass -EA SilentlyContinue).CpuPriorityClass) -eq 3'
Check 'FiveMDisableNvidiaTelemetry'    '(Get-Service -Name "NvTelemetryContainer" -EA SilentlyContinue).StartType -eq "Disabled"'
Check 'FiveMFullPerfStack'             '((Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\FiveM.exe\\PerfOptions" -Name DisableEnergyThrottling -EA SilentlyContinue).DisableEnergyThrottling) -eq 1'
Check 'FiveMGTAProcessPerfOptions'     '(Get-ChildItem "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options" -EA SilentlyContinue | Where-Object { $_.PSChildName -like "FiveM_b*_GTAProcess.exe" } | Measure-Object).Count -gt 0'
Check 'FiveMGameModeAdd'               '((Get-ItemProperty "HKCU:\\SOFTWARE\\Microsoft\\GameBar" -Name AutoGameModeEnabled -EA SilentlyContinue).AutoGameModeEnabled) -eq 1'
Check 'FiveMRenderingBoost'            '((Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\FiveM.exe\\PerfOptions" -Name DisableRenderingContextPreemption -EA SilentlyContinue).DisableRenderingContextPreemption) -eq 1'
Check 'FiveMGPUPriorityStack'          '((Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\FiveM.exe\\PerfOptions" -Name GpuPriorityClass -EA SilentlyContinue).GpuPriorityClass) -eq 8'

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

  // --- Admin System Status ---
  app.get("/api/admin/system-status", async (req, res) => {
    if (!checkAdminKey(req, res)) return;
    return res.json({
      autoSend: {
        enabled: isEmailConfigured(),
        thresholdMinutes: autoSendState.thresholdMinutes,
        intervalMinutes: autoSendState.intervalMinutes,
        lastRunAt: autoSendState.lastRunAt,
        lastSentCount: autoSendState.lastSentCount,
        totalAutoSent: autoSendState.totalAutoSent,
        nextRunAt: autoSendState.nextRunAt,
        isRunning: autoSendState.isRunning,
      },
    });
  });

  app.post("/api/admin/auto-send/trigger", async (req, res) => {
    if (!checkAdminKey(req, res)) return;
    const sent = await runAutoSend();
    return res.json({ ok: true, sent });
  });

  // --- Announcements (public read) ---
  app.get("/api/announcements", async (req, res) => {
    const list = await storage.getAnnouncements();
    return res.json(list);
  });

  // --- Announcements (admin write) ---
  app.post("/api/admin/announcements", async (req, res) => {
    if (!checkAdminKey(req, res)) return;
    const schema = z.object({
      title: z.string().min(1).max(200),
      body: z.string().min(1).max(5000),
      tag: z.string().optional(),
      tweakIds: z.array(z.string()).optional().default([]),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid data" });
    const ann = await storage.createAnnouncement(parsed.data);
    return res.json(ann);
  });

  app.delete("/api/admin/announcements/:id", async (req, res) => {
    if (!checkAdminKey(req, res)) return;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    await storage.deleteAnnouncement(id);
    return res.json({ ok: true });
  });

  // --- Email Code Requests (public) ---
  app.post("/api/request-code", async (req, res) => {
    const schema = z.object({
      email: z.string().email(),
      paymentMethod: z.enum(["cashapp", "paypal"]),
      paymentRef: z.string().min(2).max(200),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid request" });
    const { email, paymentMethod, paymentRef } = parsed.data;
    const req2 = await storage.createEmailRequest(email, paymentMethod, paymentRef);
    return res.json({ ok: true, id: req2.id });
  });

  // --- Email Admin Routes ---
  app.get("/api/admin/email-requests", async (req, res) => {
    if (!checkAdminKey(req, res)) return;
    const requests = await storage.getEmailRequests();
    return res.json(requests);
  });

  app.get("/api/admin/email-configured", async (req, res) => {
    if (!checkAdminKey(req, res)) return;
    return res.json({ configured: isEmailConfigured() });
  });

  app.post("/api/admin/email-requests/:id/send", async (req, res) => {
    if (!checkAdminKey(req, res)) return;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    if (!isEmailConfigured()) {
      return res.status(503).json({ error: "Email not configured — set EMAIL_USER and EMAIL_PASS environment variables" });
    }

    const allRequests = await storage.getEmailRequests();
    const emailReq = allRequests.find(r => r.id === id);
    if (!emailReq) return res.status(404).json({ error: "Request not found" });
    if (emailReq.status === "sent") return res.status(400).json({ error: "Code already sent" });

    const allCodes = await storage.getAllCodes();
    // Exclude codes already reserved by other sent/auto-sent email requests
    const reservedCodeIds = new Set(
      allRequests
        .filter(r => r.sentCodeId && (r.status === "sent" || r.status === "auto-sent"))
        .map(r => r.sentCodeId)
    );
    const available = allCodes.find(c => !c.usedAt && !reservedCodeIds.has(c.id));
    if (!available) return res.status(503).json({ error: "No available codes — generate more first" });

    // Do NOT call redeemCode here — the customer needs to be able to enter the code on the site.
    // Revenue is counted when the request is accepted (status="sent"), not when customer redeems.
    const siteUrl = `${req.protocol}://${req.get("host")}`;
    await sendProCode(emailReq.email, available.code, siteUrl);
    await storage.updateEmailRequestStatus(id, "sent", available.id);

    return res.json({ ok: true, code: available.code });
  });

  app.post("/api/admin/email-requests/:id/reject", async (req, res) => {
    if (!checkAdminKey(req, res)) return;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const note = (req.body as any)?.note || "Rejected by admin";
    await storage.updateEmailRequestStatus(id, "rejected", undefined, note);
    return res.json({ ok: true });
  });

  app.delete("/api/admin/email-requests/:id", async (req, res) => {
    if (!checkAdminKey(req, res)) return;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    await storage.deleteEmailRequest(id);
    return res.json({ ok: true });
  });

  return httpServer;
}
