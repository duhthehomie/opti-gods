import { useState, useRef, useEffect } from "react";
import { Download, ScanLine, CheckCircle2, AlertCircle, Upload, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

function generateDetectBat(): Blob {
  const MARKER = "DETECT_PS1_EMBEDDED";
  const half = Math.ceil(MARKER.length / 2);
  const markerTag = `##${MARKER}##`;
  const markerSearch = `'##${MARKER.slice(0, half)}'+'${MARKER.slice(half)}##'`;

  const ps1 = `
# OptiGods by leaq — PC State Detection Script v2
# READ-ONLY: this script does NOT change anything on your PC.
# It saves a result file to your Desktop.

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
Check 'EnableLargeSystemCache'    '((Get-ItemProperty "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management" -Name LargeSystemCache -EA SilentlyContinue).LargeSystemCache) -eq 1'
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
  @{id='ServiceMapsBroker'; name='MapsBroker'},
  @{id='ServiceWerSvc';     name='WerSvc'},
  @{id='ServiceDPS';        name='DPS'},
  @{id='ServicePrintSpooler';name='Spooler'},
  @{id='ServiceDusmSvc';   name='DusmSvc'},
  @{id='ServiceTrkWks';    name='TrkWks'},
  @{id='ServiceLltdsvc';   name='lltdsvc'},
  @{id='ServiceFDHost';    name='FDResPub'},
  @{id='ServiceWbioSrvc';  name='WbioSrvc'},
  @{id='ServicePcaSvc';    name='PcaSvc'},
  @{id='ServiceAeLookupSvc';name='AeLookupSvc'}
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

# --- System / CPU ---
Check 'DisableHungAppDetection'    '((Get-ItemProperty "HKCU:\\Control Panel\\Desktop" -Name HungAppTimeout -EA SilentlyContinue).HungAppTimeout) -eq "1000"'
Check 'DisablePowerThrottlingAdv'  '((Get-ItemProperty "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Power\\PowerThrottling" -Name PowerThrottlingOff -EA SilentlyContinue).PowerThrottlingOff) -eq 1'
Check 'SysVisualBestPerf'          '((Get-ItemProperty "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects" -Name VisualFXSetting -EA SilentlyContinue).VisualFXSetting) -eq 2'
Check 'SysHibernateOff'            '((Get-ItemProperty "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power" -Name HiberbootEnabled -EA SilentlyContinue).HiberbootEnabled) -eq 0'
Check 'SysHypervisorOff'           '(bcdedit /enum 2>$null | Select-String "hypervisorlaunchtype\s+Off") -ne $null'
Check 'DisableAutoMaintenance'     '((Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Schedule\\Maintenance" -Name MaintenanceDisabled -EA SilentlyContinue).MaintenanceDisabled) -eq 1'
Check 'PrivacyDiagFeedback'        '((Get-ItemProperty "HKCU:\\SOFTWARE\\Microsoft\\Siuf\\Rules" -Name NumberOfSIUFInPeriod -EA SilentlyContinue).NumberOfSIUFInPeriod) -eq 0'

# --- Memory (extended) ---
Check 'MemFixedPagefile'       '((Get-ItemProperty "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management" -Name AutomaticManagedPagefile -EA SilentlyContinue).AutomaticManagedPagefile) -eq 0'
Check 'ClearPagefileOnShutdown' '((Get-ItemProperty "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management" -Name ClearPageFileAtShutdown -EA SilentlyContinue).ClearPageFileAtShutdown) -eq 1'
Check 'MemClearPagefileShutdown' '((Get-ItemProperty "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management" -Name ClearPageFileAtShutdown -EA SilentlyContinue).ClearPageFileAtShutdown) -eq 1'
Check 'MemSystemCacheBoost'    '((Get-ItemProperty "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management" -Name LargeSystemCache -EA SilentlyContinue).LargeSystemCache) -eq 0'
Check 'MemGPUSchedulerTweak'   '((Get-ItemProperty "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers" -Name Scheduler -EA SilentlyContinue).Scheduler) -eq 1'
Check 'MemTrimOnMinimize'      '((Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options" -Name TrimWorkingSetSize -EA SilentlyContinue).TrimWorkingSetSize) -eq 1'

# --- WinTitus / OO ShutUp tweaks ---
Check 'WinTitusConsumerFeatures' '((Get-ItemProperty "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\CloudContent" -Name DisableWindowsConsumerFeatures -EA SilentlyContinue).DisableWindowsConsumerFeatures) -eq 1'
Check 'WinTitusBgApps'           '((Get-ItemProperty "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\BackgroundAccessApplications" -Name GlobalUserDisabled -EA SilentlyContinue).GlobalUserDisabled) -eq 1'
Check 'WinTitusFullscreenOpt'    '((Get-ItemProperty "HKCU:\\System\\GameConfigStore" -Name GameDVR_FSEBehavior -EA SilentlyContinue).GameDVR_FSEBehavior) -eq 2'
Check 'WinTitusNotifTray'        '((Get-ItemProperty "HKCU:\\SOFTWARE\\Policies\\Microsoft\\Windows\\Explorer" -Name DisableNotificationCenter -EA SilentlyContinue).DisableNotificationCenter) -eq 1'
Check 'WinTitusStorageSense'     '((Get-ItemProperty "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\StorageSense\\Parameters\\StoragePolicy" -Name 01 -EA SilentlyContinue)."01") -eq 0'
Check 'WinTitusTeredo'           '(netsh interface teredo show state 2>$null | Select-String "disabled") -ne $null'
Check 'WinTitusIPv4Prefer'       '((Get-ItemProperty "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip6\\Parameters" -Name DisabledComponents -EA SilentlyContinue).DisabledComponents) -eq 32'
Check 'WinTitusRazerBlock'       '((Get-ItemProperty "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate" -Name ExcludeWUDriversInQualityUpdate -EA SilentlyContinue).ExcludeWUDriversInQualityUpdate) -eq 1'
Check 'WinTitusWPBT'             '((Get-ItemProperty "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager" -Name DisableWpbtExecution -EA SilentlyContinue).DisableWpbtExecution) -eq 1'
Check 'WinTitusEdgeDebloat'      '((Get-ItemProperty "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Edge" -Name BackgroundModeEnabled -EA SilentlyContinue).BackgroundModeEnabled) -eq 0'
Check 'WinTitusClassicMenu'      'Test-Path "HKCU:\\SOFTWARE\\CLASSES\\CLSID\\{86CA1AA0-34AA-4E8B-A509-50C905BAE2A2}\\InprocServer32"'
Check 'WinTitusShowExtensions'   '((Get-ItemProperty "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" -Name HideFileExt -EA SilentlyContinue).HideFileExt) -eq 0'
Check 'WinTitusShowHidden'       '((Get-ItemProperty "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" -Name Hidden -EA SilentlyContinue).Hidden) -eq 1'
Check 'WinTitusPosh7Telemetry'   '[System.Environment]::GetEnvironmentVariable("POWERSHELL_TELEMETRY_OPTOUT","Machine") -eq "1"'
Check 'WinTitusAdobeBlock'       '(Get-Content "$env:SystemRoot\\System32\\drivers\\etc\\hosts" -EA SilentlyContinue | Select-String "activate.adobe.com") -ne $null'
Check 'WinTitusDisplayPerf'      '((Get-ItemProperty "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects" -Name VisualFXSetting -EA SilentlyContinue).VisualFXSetting) -eq 2'
Check 'WinTitusHibernation'      '((Get-ItemProperty "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power" -Name HiberbootEnabled -EA SilentlyContinue).HiberbootEnabled) -eq 0'

# --- NVIDIA ---
Check 'NvidiaLowLatency'       '((Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games" -Name MaximumPreRenderedFrames -EA SilentlyContinue).MaximumPreRenderedFrames) -eq 1'
Check 'NvidiaPreRenderedFrames' '((Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games" -Name MaximumPreRenderedFrames -EA SilentlyContinue).MaximumPreRenderedFrames) -eq 1'
Check 'NvidiaOptimizeLatency'  '((Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games" -Name "GPU Priority" -EA SilentlyContinue)."GPU Priority") -eq 8'
Check 'NvidiaThreadedOpt'      '((Get-ItemProperty "HKLM:\\SOFTWARE\\NVIDIA Corporation\\Global\\NvTweak" -Name Threaded_Optimization_Override -EA SilentlyContinue).Threaded_Optimization_Override) -eq 1'
Check 'NvidiaDisableTelemetry' '(Get-Service -Name "NvTelemetryContainer" -EA SilentlyContinue).StartType -eq "Disabled"'
Check 'NvidiaDisableOverlay'   '((Get-ItemProperty "HKCU:\\SOFTWARE\\NVIDIA Corporation\\NVControlPanel2\\Client" -Name OptInOrOutPreference -EA SilentlyContinue).OptInOrOutPreference) -eq 0'
Check 'NvidiaMaxPerfMode'      '((Get-ItemProperty "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers" -Name PlatformSupportMiracast -EA SilentlyContinue).PlatformSupportMiracast) -eq 0'
Check 'NvidiaShaderCache'      '((Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\DirectX" -Name ShaderCache -EA SilentlyContinue).ShaderCache) -eq 1'
Check 'NvidiaPowerMizer'       '$nvFound=$false; 0..3 | ForEach-Object { $k="HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}\\000$_"; If ((Test-Path $k) -and (Get-ItemProperty $k -Name DriverDesc -EA SilentlyContinue).DriverDesc -match "NVIDIA") { If (((Get-ItemProperty $k -EA SilentlyContinue).PowerMizerLevel) -eq 1) { $nvFound=$true } } }; $nvFound'

# --- AMD ---
Check 'AmdDisableChill'     '((Get-ItemProperty "HKCU:\\SOFTWARE\\AMD\\CN" -Name UseChill -EA SilentlyContinue).UseChill) -eq 0'
Check 'AmdDisableVSR'       '((Get-ItemProperty "HKCU:\\SOFTWARE\\AMD\\CN" -Name VSR -EA SilentlyContinue).VSR) -eq 0'
Check 'AmdAntiLag'          '((Get-ItemProperty "HKCU:\\SOFTWARE\\AMD\\CN" -Name AntiLag -EA SilentlyContinue).AntiLag) -eq 1'
Check 'AmdDisableVariBright' '((Get-ItemProperty "HKCU:\\SOFTWARE\\AMD\\CN" -Name VariBrightEnable -EA SilentlyContinue).VariBrightEnable) -eq 0'
Check 'AmdDisableFreeSyncCompetitive' '((Get-ItemProperty "HKCU:\\SOFTWARE\\AMD\\CN" -Name FreeSync -EA SilentlyContinue).FreeSync) -eq 0'
Check 'AmdImageSharpening'  '((Get-ItemProperty "HKCU:\\SOFTWARE\\AMD\\CN" -Name ImageSharpening -EA SilentlyContinue).ImageSharpening) -eq 1'
Check 'AmdOptimizeLatency'  '((Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games" -Name MaximumPreRenderedFrames -EA SilentlyContinue).MaximumPreRenderedFrames) -eq 1'
Check 'AmdDisableTelemetry' '(Get-Service -Name "AMD External Events Utility" -EA SilentlyContinue).StartType -eq "Disabled"'
Check 'AmdTDRTweak'         '((Get-ItemProperty "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers" -Name TdrDelay -EA SilentlyContinue).TdrDelay) -eq 8'
Check 'AmdShaderCache'      '((Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\DirectX" -Name ShaderCache -EA SilentlyContinue).ShaderCache) -eq 1'
Check 'AmdDisableULPS'      '$amdFound=$false; $gpuPath="HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}"; Get-ChildItem $gpuPath -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc -match "AMD|Radeon|ATI" } | ForEach-Object { If (((Get-ItemProperty $_.PSPath -EA SilentlyContinue).EnableUlps) -eq 0) { $amdFound=$true } }; $amdFound'

# --- Discord ---
Check 'DiscordLowPriority'          '((Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\Discord.exe\\PerfOptions" -Name CpuPriorityClass -EA SilentlyContinue).CpuPriorityClass) -eq 1'
Check 'DiscordReduceGPUPriority'    '((Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\Discord.exe\\PerfOptions" -Name GpuPriorityClass -EA SilentlyContinue).GpuPriorityClass) -eq 1'
Check 'DiscordDisableUpdateCheck'   '((Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\Update.exe\\PerfOptions" -Name CpuPriorityClass -EA SilentlyContinue).CpuPriorityClass) -eq 1'
Check 'DiscordDisableVAD'           '(Get-Content "$env:APPDATA\\discord\\settings.json" -Raw -EA SilentlyContinue) -match "noVoiceActivityDetection.*true"'
Check 'DiscordDisableHWAccel'       '(Get-Content "$env:APPDATA\\discord\\settings.json" -Raw -EA SilentlyContinue) -match "enableHardwareAcceleration.*false"'
Check 'DiscordDisableAnimations'    '(Get-Content "$env:APPDATA\\discord\\settings.json" -Raw -EA SilentlyContinue) -match "reduceMotion.*true"'
Check 'DiscordDisableClips'         '(Get-Content "$env:APPDATA\\discord\\settings.json" -Raw -EA SilentlyContinue) -match "disableClips.*true"'

# --- Call of Duty ---
Check 'CodHighPriority'      '((Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\cod.exe\\PerfOptions" -Name CpuPriorityClass -EA SilentlyContinue).CpuPriorityClass) -ge 3'
Check 'CodMemPriority'       '((Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\cod.exe\\PerfOptions" -Name PagePriority -EA SilentlyContinue).PagePriority) -eq 5'
Check 'CodGPUPriority'       '((Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\cod.exe\\PerfOptions" -Name GPUPriority -EA SilentlyContinue).GPUPriority) -eq 8'
Check 'CodNetworkBuffer'     '((Get-ItemProperty "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\AFD\\Parameters" -Name DefaultReceiveWindow -EA SilentlyContinue).DefaultReceiveWindow) -eq 524288'
Check 'CodTdrDelay'          '((Get-ItemProperty "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers" -Name TdrDelay -EA SilentlyContinue).TdrDelay) -ge 8'
Check 'CodFramePacing'       '((Get-ItemProperty "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers" -Name TdrDdiDelay -EA SilentlyContinue).TdrDdiDelay) -eq 8'
Check 'CodMMCSS'             '((Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games" -Name "Scheduling Category" -EA SilentlyContinue)."Scheduling Category") -eq "High"'
Check 'CodQoSPolicy'         'Test-Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\QoS\\COD Gaming"'
Check 'CodDisableHAGS'       '((Get-ItemProperty "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers" -Name HwSchMode -EA SilentlyContinue).HwSchMode) -eq 1'
Check 'CodDirectXQueue'      '((Get-ItemProperty "HKCU:\\SOFTWARE\\Microsoft\\Direct3D" -Name MaxFrameLatency -EA SilentlyContinue).MaxFrameLatency) -eq 1'
Check 'CodGameMode'          '((Get-ItemProperty "HKCU:\\SOFTWARE\\Microsoft\\GameBar" -Name AutoGameModeEnabled -EA SilentlyContinue).AutoGameModeEnabled) -eq 1'
Check 'CodDisableXboxCapture' '((Get-ItemProperty "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\GameDVR" -Name AppCaptureEnabled -EA SilentlyContinue).AppCaptureEnabled) -eq 0'
Check 'CodTCPOptimize'       '((Get-ItemProperty "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters" -Name TcpTimestampOpt -EA SilentlyContinue).TcpTimestampOpt) -eq 0'
Check 'Cod1650LowLatency'    '((Get-ItemProperty "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\nvlddmkm" -Name NvCplLowLatencyMode -EA SilentlyContinue).NvCplLowLatencyMode) -eq 1'
Check 'Cod1650DisableAnsel'  '((Get-ItemProperty "HKLM:\\SOFTWARE\\NVIDIA Corporation\\Global\\Ansel" -Name AnselEnable -EA SilentlyContinue).AnselEnable) -eq 0'

# --- FiveM (extended) ---
Check 'FiveMDisableMPO'         '((Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows\\Dwm" -Name OverlayTestMode -EA SilentlyContinue).OverlayTestMode) -eq 5'
Check 'FiveMExtendedMemory'     '((Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\FiveM.exe\\PerfOptions" -Name CpuPriorityClass -EA SilentlyContinue).CpuPriorityClass) -ge 3'
Check 'FiveMIOPriority'         '((Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\FiveM.exe\\PerfOptions" -Name IoPriority -EA SilentlyContinue).IoPriority) -eq 2'
Check 'FiveMDisableP2P'         '(Get-Content "$env:LOCALAPPDATA\\FiveM\\FiveM.app\\CitizenFX.ini" -EA SilentlyContinue | Select-String "DisablePeerToPeer=1") -ne $null'
Check 'FiveM1060AnselDisable'   '((Get-ItemProperty "HKCU:\\SOFTWARE\\NVIDIA Corporation\\Ansel" -Name AnselEnable -EA SilentlyContinue).AnselEnable) -eq 0'
Check 'FiveM5600PowerPlan'      '(powercfg /getactivescheme 2>$null | Select-String "Ryzen|AMD") -ne $null'

# --- Fortnite (extended) ---
Check 'FortniteNetworkBuffer'   '((Get-ItemProperty "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\AFD\\Parameters" -Name DefaultReceiveWindow -EA SilentlyContinue).DefaultReceiveWindow) -ge 131072'
Check 'FortniteUncapLobbyFPS'   'Test-Path "$env:LOCALAPPDATA\\FortniteGame\\Saved\\Config\\WindowsClient\\GameUserSettings.ini" -EA SilentlyContinue'
Check 'FortniteUncapGameFPS'    '(Get-Content "$env:LOCALAPPDATA\\FortniteGame\\Saved\\Config\\WindowsClient\\Engine.ini" -Raw -EA SilentlyContinue) -match "t\.MaxFPS=0"'
Check 'FortniteDisableMotionBlur' '(Get-Content "$env:LOCALAPPDATA\\FortniteGame\\Saved\\Config\\WindowsClient\\Engine.ini" -Raw -EA SilentlyContinue) -match "r\.MotionBlurQuality=0"'
Check 'FortniteLowShadows'      '(Get-Content "$env:LOCALAPPDATA\\FortniteGame\\Saved\\Config\\WindowsClient\\Engine.ini" -Raw -EA SilentlyContinue) -match "r\.ShadowQuality=0"'
Check 'FortniteInputLatency'    '(Get-Content "$env:LOCALAPPDATA\\FortniteGame\\Saved\\Config\\WindowsClient\\Engine.ini" -Raw -EA SilentlyContinue) -match "bEnableMouseSmoothing=False"'
Check 'FortniteRawInput'        '(Get-Content "$env:LOCALAPPDATA\\FortniteGame\\Saved\\Config\\WindowsClient\\Engine.ini" -Raw -EA SilentlyContinue) -match "bEnableMouseSmoothing=False"'
Check 'FortniteDisableSSR'      '(Get-Content "$env:LOCALAPPDATA\\FortniteGame\\Saved\\Config\\WindowsClient\\Engine.ini" -Raw -EA SilentlyContinue) -match "r\.ssr\.quality=0"'
Check 'FortniteDisableLumen'    '(Get-Content "$env:LOCALAPPDATA\\FortniteGame\\Saved\\Config\\WindowsClient\\Engine.ini" -Raw -EA SilentlyContinue) -match "r\.DynamicGlobalIlluminationMethod=0"'

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
  @{id='su_skype';     key='Skype'},
  @{id='su_zoom';      key='Zoom'},
  @{id='su_amdradeon'; key='RadeonSoftware'},
  @{id='su_edge_startup'; key='Microsoft Edge'}
)) {
  $val = (Get-ItemProperty "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" -Name $app.key -EA SilentlyContinue)
  $state[$app.id] = $val -eq $null
}
$runKey = Get-ItemProperty "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" -EA SilentlyContinue
$state['su_teams']    = ($runKey.'com.squirrel.Teams.Teams' -eq $null)
$state['su_nvidia']   = ($runKey.NvBackend -eq $null) -and ($runKey.'NVIDIA GeForce Experience' -eq $null)
$state['su_ccleaner'] = ($runKey.CCleaner -eq $null) -and ($runKey.CCleaner64 -eq $null)
$state['su_battlenet'] = ($runKey.'Battle.net' -eq $null) -and ($runKey.'Battle.net Update Agent' -eq $null)
$state['su_epic']     = ($runKey.EpicGamesLauncher -eq $null) -and ($runKey.'Epic Games Launcher' -eq $null)
$state['su_chrome']   = ($runKey.'Google Chrome' -eq $null)
$state['su_razer']    = ($runKey.RzSynapse -eq $null) -and ($runKey.'Razer Synapse' -eq $null)

# --- Fortnite ---
Check 'FortniteHighPriority'     '((Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\FortniteClient-Win64-Shipping.exe\\PerfOptions" -Name CpuPriorityClass -EA SilentlyContinue).CpuPriorityClass) -ge 3'
Check 'FortniteDisableVSync'     'Test-Path "$env:LOCALAPPDATA\\FortniteGame\\Saved\\Config\\WindowsClient\\Engine.ini" -EA SilentlyContinue'
Check 'FortniteGameMode'         '((Get-ItemProperty "HKCU:\\SOFTWARE\\Microsoft\\GameBar" -Name AutoGameModeEnabled -EA SilentlyContinue).AutoGameModeEnabled) -eq 1'

# --- FiveM ---
Check 'FiveMHighPriority'              '((Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\GTA5.exe\\PerfOptions" -Name CpuPriorityClass -EA SilentlyContinue).CpuPriorityClass) -ge 3'
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
  @{id='DebloatGetHelp';       name='Microsoft.GetHelp'},
  @{id='DebloatMixedReality';  name='Microsoft.MixedReality.Portal'},
  @{id='DebloatZune';          name='Microsoft.ZuneMusic'},
  @{id='DebloatOfficeHub';     name='Microsoft.MicrosoftOfficeHub'},
  @{id='DebloatXboxIdentity';  name='Microsoft.XboxIdentityProvider'},
  @{id='DebloatGrooveMusic';   name='Microsoft.ZuneMusic'},
  @{id='DebloatMSPaint3D';     name='Microsoft.MSPaint'},
  @{id='DebloatWindowsCamera'; name='Microsoft.WindowsCamera'},
  @{id='DebloatYourPhone';     name='Microsoft.YourPhone'},
  @{id='DebloatPowerAutomate'; name='Microsoft.PowerAutomateDesktop'},
  @{id='DebloatTeamsConsumer'; name='MicrosoftTeams'},
  @{id='DebloatAlarmsAndClock';name='Microsoft.WindowsAlarms'}
)) {
  $state[$pkg.id] = -not ($packages -like "*$($pkg.name)*")
}

# ----- Output + file save (try/finally so window NEVER closes unexpectedly) -----
try {
  $json = ($state | ConvertTo-Json -Compress)
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  $b64  = [Convert]::ToBase64String($bytes)

  Write-Host ""
  Write-Host "  ==============================" -ForegroundColor Cyan
  Write-Host "  OPTIGODS_STATE:$b64" -ForegroundColor White
  Write-Host "  ==============================" -ForegroundColor Cyan
  Write-Host ""

  $userProfile = $env:USERPROFILE
  if (-not $userProfile -or -not (Test-Path $userProfile)) {
    $userProfile = "C:\\Users\\$env:USERNAME"
  }
  $desktop   = Join-Path $userProfile 'Desktop'
  $downloads = Join-Path $userProfile 'Downloads'
  if (-not (Test-Path $desktop)) {
    $desktop = [Environment]::GetFolderPath('Desktop')
  }

  $documents = Join-Path $userProfile 'Documents'
  $saved = @()
  foreach ($dir in @($desktop, $downloads, $documents)) {
    if ($dir -and (Test-Path $dir)) {
      $base = Join-Path $dir 'OptiGods-DetectedTweaks'
      $outPath = $base + '.json'
      $n = 2
      while (Test-Path $outPath) { $outPath = $base + '_' + $n + '.json'; $n++ }
      try {
        [IO.File]::WriteAllText($outPath, $json, [Text.Encoding]::UTF8)
        $saved += $outPath
        break
      } catch {}
    }
  }

  Write-Host ""
  if ($saved.Count -gt 0) {
    Write-Host "  ==========================================" -ForegroundColor Green
    Write-Host "  FILE SAVED:" -ForegroundColor Green
    Write-Host "  $($saved[0])" -ForegroundColor White
    Write-Host "  ==========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Drag OptiGods-DetectedTweaks.json onto the Opti Gods window to import it." -ForegroundColor Cyan
  } else {
    Write-Host "  Could not save file automatically. Paste the OPTIGODS_STATE line above into the app instead." -ForegroundColor Yellow
  }
  Write-Host ""
} catch {
  Write-Host ""
  Write-Host "  [ERROR] Scan failed: $_" -ForegroundColor Red
  Write-Host ""
} finally {
  Read-Host "  Press Enter to close this window"
}
`.trim();

  const bat = [
    `@echo off`,
    `setlocal`,
    `set "SELF=%~f0"`,
    `set "TMPPS1=%TEMP%\\OptiGods-Detect.ps1"`,
    ``,
    `title Opti Gods by leaq  --  PC State Scan (Read-Only)`,
    `echo.`,
    `echo  ==========================================`,
    `echo    OPTI GODS by leaq  --  PC State Scan`,
    `echo  ==========================================`,
    `echo.`,
    `echo  [1/2] Extracting script...`,
    `PowerShell -NoProfile -ExecutionPolicy Bypass -Command "$c=[IO.File]::ReadAllText($env:SELF,[Text.Encoding]::UTF8);$m=${markerSearch};$i=$c.IndexOf($m);if($i -ge 0){[IO.File]::WriteAllText($env:TMPPS1,$c.Substring($i+$m.Length),[Text.Encoding]::UTF8)}"`,
    `if not exist "%TMPPS1%" (`,
    `  echo.`,
    `  echo  [ERROR] Extraction failed. Re-download from the app.`,
    `  pause`,
    `  exit /b 1`,
    `)`,
    `echo  [2/2] Click Yes on the UAC prompt to run as Administrator.`,
    `echo.`,
    `PowerShell -NoProfile -Command "try { Start-Process powershell.exe -Verb RunAs -Wait -ArgumentList ('-NoProfile -ExecutionPolicy Bypass -File '+[char]34+$env:TMPPS1+[char]34) } catch { Write-Host ('UAC cancelled: '+$_) -ForegroundColor Red; Read-Host 'Press Enter to close' }"`,
    `del "%TMPPS1%" 2>nul`,
    `exit /b 0`,
    markerTag,
    ps1,
  ].join('\r\n');

  return new Blob([bat], { type: 'application/octet-stream' });
}

export function ScanImport() {
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [imported, setImported] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const { setAllTweaks, tweaks } = useOptimizationStore();
  const { toast } = useToast();

  useEffect(() => {
    const handler = (e: Event) => {
      const { count } = (e as CustomEvent<{ count: number }>).detail;
      setImported(count);
      setStatus("success");
    };
    window.addEventListener("optigods:tweaks-imported", handler);
    return () => window.removeEventListener("optigods:tweaks-imported", handler);
  }, []);

  const handleDownload = () => {
    const blob = generateDetectBat();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "OptiGods-Detect.bat";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const parseAndApply = (text: string) => {
    let detected: Record<string, boolean> | null = null;
    try {
      const parsed = JSON.parse(text.trim());
      if (parsed && typeof parsed === "object") detected = parsed as Record<string, boolean>;
    } catch {}
    if (!detected) {
      try {
        const match = text.match(/OPTIGODS_STATE:([A-Za-z0-9+/=]+)/);
        const b64 = match ? match[1] : text.trim();
        detected = JSON.parse(atob(b64));
      } catch {}
    }
    if (!detected) { setStatus("error"); return; }
    const next = { ...tweaks };
    let count = 0;
    for (const [key, val] of Object.entries(detected)) {
      if (key in next && typeof val === "boolean") {
        next[key] = val;
        if (val) count++;
      }
    }
    setAllTweaks(next);
    setImported(count);
    setStatus("success");
    setManualCode("");
    toast({
      title: "PC state loaded",
      description: `${count} optimizations detected as already applied on your system.`,
    });
  };

  const handleFile = (file: File) => {
    if (!file.name.endsWith(".json")) { setStatus("error"); return; }
    const reader = new FileReader();
    reader.onload = (e) => parseAndApply(e.target?.result as string);
    reader.readAsText(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div className="p-5 rounded-2xl bg-black/40 border border-white/5 space-y-4">
      <div className="flex items-center gap-2">
        <ScanLine className="w-4 h-4 text-red-500" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300">Detect Already-Applied Optimizations</h2>
      </div>

      <p className="text-xs text-zinc-500 leading-relaxed">
        Already had your PC optimized? Run the scan to auto-detect what's already done — so nothing gets applied twice. Read-only, changes nothing.
      </p>

      {/* Step 1 */}
      <div className="flex items-start gap-3 p-3 rounded-xl bg-zinc-900/60 border border-white/5">
        <span className="w-6 h-6 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center text-[11px] font-bold text-red-400 shrink-0 mt-0.5">1</span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-white mb-1">Download & Run the Scan</p>
          <p className="text-[11px] text-zinc-500 mb-2">
            Double-click the file → click <strong className="text-zinc-300">Yes</strong> on the UAC popup.
            It saves <span className="font-mono text-zinc-400">OptiGods-DetectedTweaks.json</span> to your Desktop.
          </p>
          <Button
            data-testid="button-download-detect"
            size="sm"
            onClick={handleDownload}
            className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-red-500/40 text-zinc-100 text-xs gap-1.5 h-7"
          >
            <Download className="w-3.5 h-3.5" />
            Download Scan (.bat)
          </Button>
        </div>
      </div>

      {/* Step 2 — drag-and-drop zone */}
      <div className="flex items-start gap-3 p-3 rounded-xl bg-zinc-900/60 border border-white/5">
        <span className="w-6 h-6 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center text-[11px] font-bold text-red-400 shrink-0 mt-0.5">2</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-white mb-2">Drop the Result File Here</p>

          {status === "success" ? (
            <div className="flex items-center gap-2 text-xs text-green-400 py-2">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {imported} tweaks imported successfully
            </div>
          ) : (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".json"
                className="hidden"
                data-testid="input-scan-file"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />

              {/* Drop zone */}
              <div
                data-testid="dropzone-scan-import"
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                className={cn(
                  "rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 py-6 cursor-pointer transition-all select-none",
                  dragging
                    ? "border-red-500/60 bg-red-500/5 scale-[1.01]"
                    : "border-zinc-700 hover:border-red-500/40 hover:bg-red-500/[0.02]"
                )}
              >
                <Upload className={cn("w-5 h-5 transition-colors", dragging ? "text-red-400" : "text-zinc-600")} />
                <div className="text-center">
                  <p className={cn("text-xs font-semibold transition-colors", dragging ? "text-red-300" : "text-zinc-400")}>
                    {dragging ? "Release to import" : "Drop OptiGods-DetectedTweaks.json here"}
                  </p>
                  <p className="text-[11px] text-zinc-600 mt-0.5">or click to browse</p>
                </div>
              </div>

              {status === "error" && (
                <div className="flex items-center gap-2 text-xs text-zinc-500 mt-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  Couldn't read the file. Make sure you're dropping <span className="font-mono ml-1">OptiGods-DetectedTweaks.json</span>.
                </div>
              )}

              {/* Manual paste fallback (collapsed by default) */}
              <button
                data-testid="button-show-manual-import"
                onClick={() => setShowManual(v => !v)}
                className="mt-3 flex items-center gap-1 text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                <ChevronDown className={cn("w-3 h-3 transition-transform", showManual && "rotate-180")} />
                Enter code manually
              </button>

              {showManual && (
                <div className="mt-2 flex gap-2">
                  <input
                    data-testid="input-scan-paste"
                    type="text"
                    value={manualCode}
                    onChange={e => { setManualCode(e.target.value); setStatus("idle"); }}
                    placeholder="OPTIGODS_STATE:..."
                    className="flex-1 min-w-0 bg-zinc-900 border border-zinc-700 focus:border-red-500/40 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none font-mono transition-colors"
                  />
                  <Button
                    data-testid="button-import-state"
                    size="sm"
                    onClick={() => parseAndApply(manualCode)}
                    disabled={!manualCode.trim()}
                    className="bg-red-600 hover:bg-red-700 text-white border border-red-500/30 h-7 text-xs shrink-0"
                  >
                    Import
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
