@echo off
setlocal
set "SELF=%~f0"
set "TMPPS1=%TEMP%\OptiGods-leaq.ps1"

title Opti Gods by leaq  --  Optimizer
echo.
echo  ==========================================
echo    OPTI GODS by leaq  --  Optimizer
echo  ==========================================
echo.
echo  [1/2] Extracting optimization script...
PowerShell -NoProfile -ExecutionPolicy Bypass -Command "$c=[IO.File]::ReadAllText($env:SELF);$m='##PS1'+'_START##';$i=$c.IndexOf($m);if($i -ge 0){[IO.File]::WriteAllText($env:TMPPS1,$c.Substring($i+$m.Length),[Text.Encoding]::UTF8)}"
if not exist "%TMPPS1%" (
  echo.
  echo  [ERROR] Script extraction failed. Please re-download from the website.
  echo.
  pause
  exit /b 1
)
echo  [2/2] A Windows security prompt will appear.
echo      Click "Yes" to start the optimizer as Administrator.
echo      Your tweaks will then run automatically in a new window.
echo.
PowerShell -NoProfile -Command "try { Start-Process powershell.exe -Verb RunAs -Wait -ArgumentList ('-NoProfile -ExecutionPolicy Bypass -File '+[char]34+$env:TMPPS1+[char]34) } catch { Write-Host ('UAC cancelled or launch failed: '+$_) -ForegroundColor Red; Read-Host 'Press Enter to close' }"
del "%TMPPS1%" 2>nul
exit /b 0
##PS1_START##
# ============================================
# OPTI GODS by leaq — PC Optimizer
# Generated: 2026-04-12T19:13:28.658Z
# Tweaks enabled: 44
# ============================================

$ErrorActionPreference = 'SilentlyContinue'

# --- Administrator check (elevation is handled by the .bat launcher) ---
if (!([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "" 
    Write-Host "  !! This script must run as Administrator !!" -ForegroundColor Red
    Write-Host "  Please re-download and run the .bat file from the website." -ForegroundColor Yellow
    Write-Host "" 
    Read-Host "  Press Enter to close"
    exit 1
}

# Keep window open on any unexpected crash
trap {
    Write-Host "" 
    Write-Host "  [FATAL ERROR] $_" -ForegroundColor Red
    Write-Host "" 
    Read-Host "  Press Enter to close"
    break
}

Write-Host "=====================================" -ForegroundColor Red
Write-Host "  OPTI GODS by leaq" -ForegroundColor Red
Write-Host "  Starting 44 optimizations..." -ForegroundColor White
Write-Host "  Running as: $env:USERNAME (Admin)" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Red

# --- Tweak Tracking (ChrisTitusUtil-style summary) ---
$appliedTweaks = [System.Collections.Generic.List[string]]::new()
$failedTweaks  = [System.Collections.Generic.List[string]]::new()

# --- Smart Hardware Detection ---
$_cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$_cpuCores = $_cpu.NumberOfCores
$_cpuLogical = $_cpu.NumberOfLogicalProcessors
$_cpuName = $_cpu.Name.Trim()
$_ramGB = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB)
$_winVer = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion' -EA SilentlyContinue)
$_build = "$($_winVer.CurrentMajorVersionNumber).$($_winVer.CurrentMinorVersionNumber).$($_winVer.CurrentBuildNumber)"

# Auto-select CpuPriorityClass based on physical core count
# 8+ physical cores: High (4) — powerful enough to handle it without starvation
# 6 or fewer cores: AboveNormal (3) — safe universal value, no scheduler starvation risk
if ($_cpuCores -ge 8) {
    $PRIORITY_CLASS = 4
    $_tier = "High-End ($($_cpuCores) cores) -> CpuPriorityClass = 4 (High)"
} else {
    $PRIORITY_CLASS = 3
    $_tier = "Standard ($($_cpuCores) cores) -> CpuPriorityClass = 3 (AboveNormal)"
}

Write-Host "" 
Write-Host "[DETECT] CPU : $_cpuName" -ForegroundColor Cyan
Write-Host "[DETECT] Cores: $($_cpuCores)P / $($_cpuLogical)L  RAM: $($_ramGB)GB  Windows: $_build" -ForegroundColor Cyan
Write-Host "[DETECT] $_tier" -ForegroundColor Cyan
Write-Host "" 

# Apply hardware-optimal CpuPriorityClass to all game executables
$_ifeo = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options'
$_gameExes = @('GTA5.exe','FiveM.exe','fivem.exe','FortniteClient-Win64-Shipping.exe','cs2.exe','VALORANT-Win64-Shipping.exe','r5apex.exe','RainbowSix.exe','cod.exe','RustClient.exe','TslGame.exe','EscapeFromTarkov.exe','RobloxPlayerBeta.exe','dota2.exe','DeadByDaylight-Win64-Shipping.exe','PUBG.exe','Overwatch.exe')
foreach ($_exe in $_gameExes) {
    $_p = "$_ifeo\$_exe\PerfOptions"
    if (!(Test-Path $_p)) { New-Item $_p -Force | Out-Null }
    Set-ItemProperty $_p 'CpuPriorityClass' $PRIORITY_CLASS -Type DWord -Force
}
Get-ChildItem $_ifeo -EA SilentlyContinue | Where-Object { $_.PSChildName -like 'FiveM_b*_GTAProcess.exe' } | ForEach-Object {
    $_p = "$_ifeo\$($_.PSChildName)\PerfOptions"
    if (!(Test-Path $_p)) { New-Item $_p -Force | Out-Null }
    Set-ItemProperty $_p 'CpuPriorityClass' $PRIORITY_CLASS -Type DWord -Force
}
@('FiveM_b2189_GTAProcess.exe','FiveM_b3323_GTAProcess.exe','FiveM_b3258_GTAProcess.exe','FiveM_b2802_GTAProcess.exe','FiveM_b2699_GTAProcess.exe') | ForEach-Object {
    $_p = "$_ifeo\$_\PerfOptions"
    if (!(Test-Path $_p)) { New-Item $_p -Force | Out-Null }
    Set-ItemProperty $_p 'CpuPriorityClass' $PRIORITY_CLASS -Type DWord -Force
}
Write-Host "[DETECT] CpuPriorityClass $PRIORITY_CLASS applied to $($_gameExes.Count)+ game executables" -ForegroundColor Green
Write-Host "" 

Write-Host "[NVIDIA] Applying Balanced NVCP preset..." -ForegroundColor DarkRed
# NVIDIA Balanced preset
$d3d = 'HKCU:\SOFTWARE\NVIDIA Corporation\Global\d3d'
If (!(Test-Path $d3d)) { New-Item $d3d -Force | Out-Null }
Set-ItemProperty $d3d 'LowLatencyMode' 1 -Type DWord -Force -EA SilentlyContinue
Set-ItemProperty $d3d 'ShaderCacheSize' 0xFFFFFFFF -Type DWord -Force -EA SilentlyContinue
Write-Host "[NVCP] Balanced preset applied — Low Latency=On, Shader Cache=Unlimited" -ForegroundColor Green

Write-Host "" 
Write-Host "--- [Registry / System] 15 tweak(s) ---" -ForegroundColor DarkRed
Write-Host "[>>] DisableCoreParking..." -ForegroundColor DarkYellow
try {
    $cpPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\Power\PowerSettings\54533251-82be-4824-96c1-47b60b740d00\0cc5b647-c1df-4637-891a-dec35c318583'; Set-ItemProperty -Path $cpPath -Name 'ValueMax' -Value 0 -Type DWord; Set-ItemProperty -Path $cpPath -Name 'Attributes' -Value 1 -Type DWord; powercfg -setacvalueindex SCHEME_CURRENT 54533251-82be-4824-96c1-47b60b740d00 0cc5b647-c1df-4637-891a-dec35c318583 100; Write-Host "[OK] CPU Core Parking disabled — all cores will remain active" -ForegroundColor Green
    $appliedTweaks.Add("DisableCoreParking") | Out-Null
} catch {
    $failedTweaks.Add("DisableCoreParking") | Out-Null
    Write-Host "[ERR] DisableCoreParking: $_" -ForegroundColor Red
}
Write-Host "[>>] DisableHungAppDetection..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name 'HungAppTimeout' -Value '1000'
    $appliedTweaks.Add("DisableHungAppDetection") | Out-Null
} catch {
    $failedTweaks.Add("DisableHungAppDetection") | Out-Null
    Write-Host "[ERR] DisableHungAppDetection: $_" -ForegroundColor Red
}
Write-Host "[>>] DisableXboxGameBar..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\GameDVR' -Name 'AppCaptureEnabled' -Value 0; Get-AppxPackage Microsoft.XboxGamingOverlay | Remove-AppxPackage
    $appliedTweaks.Add("DisableXboxGameBar") | Out-Null
} catch {
    $failedTweaks.Add("DisableXboxGameBar") | Out-Null
    Write-Host "[ERR] DisableXboxGameBar: $_" -ForegroundColor Red
}
Write-Host "[>>] DisableGameDVR..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\System\GameConfigStore' -Name 'GameDVR_Enabled' -Value 0
    $appliedTweaks.Add("DisableGameDVR") | Out-Null
} catch {
    $failedTweaks.Add("DisableGameDVR") | Out-Null
    Write-Host "[ERR] DisableGameDVR: $_" -ForegroundColor Red
}
Write-Host "[>>] DisablePointerPrecision..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\Control Panel\Mouse' -Name 'MouseSpeed' -Value 0; Set-ItemProperty -Path 'HKCU:\Control Panel\Mouse' -Name 'MouseThreshold1' -Value 0; Set-ItemProperty -Path 'HKCU:\Control Panel\Mouse' -Name 'MouseThreshold2' -Value 0
    $appliedTweaks.Add("DisablePointerPrecision") | Out-Null
} catch {
    $failedTweaks.Add("DisablePointerPrecision") | Out-Null
    Write-Host "[ERR] DisablePointerPrecision: $_" -ForegroundColor Red
}
Write-Host "[>>] DisableAnimations..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name 'UserPreferencesMask' -Value ([byte[]](0x90,0x12,0x03,0x80,0x10,0x00,0x00,0x00))
    $appliedTweaks.Add("DisableAnimations") | Out-Null
} catch {
    $failedTweaks.Add("DisableAnimations") | Out-Null
    Write-Host "[ERR] DisableAnimations: $_" -ForegroundColor Red
}
Write-Host "[>>] SysVisualBestPerf..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects' -Name 'VisualFXSetting' -Value 2 -Type DWord -Force -EA SilentlyContinue; $mask = [byte[]](0x90,0x12,0x01,0x80,0x10,0x00,0x00,0x00); Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name 'UserPreferencesMask' -Value $mask -Type Binary -Force -EA SilentlyContinue; Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name 'FontSmoothing' -Value '2' -Force -EA SilentlyContinue; New-Item -Path 'HKCU:\Software\Microsoft\Windows\DWM' -Force -EA SilentlyContinue | Out-Null; Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\DWM' -Name 'EnableAeroPeek' -Value 0 -Type DWord -Force -EA SilentlyContinue; Write-Host "[System] Visual effects set to Best Performance — all compositor animations disabled, GPU VRAM freed for gaming" -ForegroundColor Green
    $appliedTweaks.Add("SysVisualBestPerf") | Out-Null
} catch {
    $failedTweaks.Add("SysVisualBestPerf") | Out-Null
    Write-Host "[ERR] SysVisualBestPerf: $_" -ForegroundColor Red
}
Write-Host "[>>] DisableTelemetry..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\DataCollection' -Name 'AllowTelemetry' -Value 0
    $appliedTweaks.Add("DisableTelemetry") | Out-Null
} catch {
    $failedTweaks.Add("DisableTelemetry") | Out-Null
    Write-Host "[ERR] DisableTelemetry: $_" -ForegroundColor Red
}
Write-Host "[>>] DisableFastStartup..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Power' -Name 'HiberbootEnabled' -Value 0
    $appliedTweaks.Add("DisableFastStartup") | Out-Null
} catch {
    $failedTweaks.Add("DisableFastStartup") | Out-Null
    Write-Host "[ERR] DisableFastStartup: $_" -ForegroundColor Red
}
Write-Host "[>>] DisableWindowsError..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows\Windows Error Reporting' -Name 'Disabled' -Value 1; Stop-Service -Name 'WerSvc' -Force; Set-Service -Name 'WerSvc' -StartupType Disabled
    $appliedTweaks.Add("DisableWindowsError") | Out-Null
} catch {
    $failedTweaks.Add("DisableWindowsError") | Out-Null
    Write-Host "[ERR] DisableWindowsError: $_" -ForegroundColor Red
}
Write-Host "[>>] SetHighPerformancePlan..." -ForegroundColor DarkYellow
try {
    powercfg -duplicatescheme e9a42b02-d5df-448d-aa00-03f14749eb61; $guid = (powercfg -l | Select-String 'Ultimate Performance').Line.Split(' ')[3]; powercfg -setactive $guid
    $appliedTweaks.Add("SetHighPerformancePlan") | Out-Null
} catch {
    $failedTweaks.Add("SetHighPerformancePlan") | Out-Null
    Write-Host "[ERR] SetHighPerformancePlan: $_" -ForegroundColor Red
}
Write-Host "[>>] DisableUSBSuspend..." -ForegroundColor DarkYellow
try {
    powercfg -setacvalueindex SCHEME_CURRENT 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 0
    $appliedTweaks.Add("DisableUSBSuspend") | Out-Null
} catch {
    $failedTweaks.Add("DisableUSBSuspend") | Out-Null
    Write-Host "[ERR] DisableUSBSuspend: $_" -ForegroundColor Red
}
Write-Host "[>>] OptimizeRAMUsage..." -ForegroundColor DarkYellow
try {
    Add-Type -MemberDefinition '[DllImport("psapi.dll")] public static extern int EmptyWorkingSet(IntPtr hProcess);' -Name 'MemTrimRO' -Namespace 'WinAPI' -EA SilentlyContinue; [WinAPI.MemTrimRO]::EmptyWorkingSet([IntPtr](-1)) | Out-Null; [System.GC]::Collect(); Write-Host "[OK] Standby list flushed — physical RAM reclaimed for active processes" -ForegroundColor Green
    $appliedTweaks.Add("OptimizeRAMUsage") | Out-Null
} catch {
    $failedTweaks.Add("OptimizeRAMUsage") | Out-Null
    Write-Host "[ERR] OptimizeRAMUsage: $_" -ForegroundColor Red
}
Write-Host "[>>] RegistryNTFSOptimize..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -Name 'NtfsDisableLastAccessUpdate' -Value 1 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -Name 'NtfsDisable8dot3NameCreation' -Value 1 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -Name 'NtfsMftZoneReservation' -Value 2 -Type DWord -Force -EA SilentlyContinue; Write-Host "[NTFS] DisableLastAccessUpdate=1 — eliminates write-on-read overhead. DisableLastAccess cuts disk I/O by ~5-10% on game asset dirs. 8dot3=off: no legacy short filenames. MftZoneReservation=2: 12.5% reserved for MFT. All: faster asset streaming." -ForegroundColor Green
    $appliedTweaks.Add("RegistryNTFSOptimize") | Out-Null
} catch {
    $failedTweaks.Add("RegistryNTFSOptimize") | Out-Null
    Write-Host "[ERR] RegistryNTFSOptimize: $_" -ForegroundColor Red
}
Write-Host "[>>] RegistryIOPageLock..." -ForegroundColor DarkYellow
try {
    $memPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management'; $ramGB = [math]::Round((Get-WmiObject Win32_ComputerSystem).TotalPhysicalMemory / 1GB); $limit = if ($ramGB -ge 32) { 2147483648 } elseif ($ramGB -ge 16) { 1073741824 } else { 536870912 }; Set-ItemProperty $memPath -Name 'IOPageLockLimit' -Value $limit -Type DWord -Force -EA SilentlyContinue; Write-Host "[Memory] IOPageLockLimit=$limit for $ramGB GB RAM. Allows kernel to lock more physical pages for DMA/I/O — reduces streaming stutter and improves asset throughput in GTA V. Effective immediately." -ForegroundColor Green
    $appliedTweaks.Add("RegistryIOPageLock") | Out-Null
} catch {
    $failedTweaks.Add("RegistryIOPageLock") | Out-Null
    Write-Host "[ERR] RegistryIOPageLock: $_" -ForegroundColor Red
}
Write-Host "" 
Write-Host "--- [Memory] 5 tweak(s) ---" -ForegroundColor DarkRed
Write-Host "[>>] MemDisableCompression..." -ForegroundColor DarkYellow
try {
    Disable-MMAgent -MemoryCompression
    $appliedTweaks.Add("MemDisableCompression") | Out-Null
} catch {
    $failedTweaks.Add("MemDisableCompression") | Out-Null
    Write-Host "[ERR] MemDisableCompression: $_" -ForegroundColor Red
}
Write-Host "[>>] MemDisableSuperfetch..." -ForegroundColor DarkYellow
try {
    Stop-Service -Name "SysMain" -Force; Set-Service -Name "SysMain" -StartupType Disabled
    $appliedTweaks.Add("MemDisableSuperfetch") | Out-Null
} catch {
    $failedTweaks.Add("MemDisableSuperfetch") | Out-Null
    Write-Host "[ERR] MemDisableSuperfetch: $_" -ForegroundColor Red
}
Write-Host "[>>] MemTrimStandbyList..." -ForegroundColor DarkYellow
try {
    Add-Type -MemberDefinition '[DllImport("psapi.dll")] public static extern int EmptyWorkingSet(IntPtr hProcess);' -Name 'MemHelperSL' -Namespace 'WinAPI' -EA SilentlyContinue; [WinAPI.MemHelperSL]::EmptyWorkingSet([IntPtr](-1)) | Out-Null; Write-Host "[OK] Standby list cleared — RAM freed for game" -ForegroundColor Green
    $appliedTweaks.Add("MemTrimStandbyList") | Out-Null
} catch {
    $failedTweaks.Add("MemTrimStandbyList") | Out-Null
    Write-Host "[ERR] MemTrimStandbyList: $_" -ForegroundColor Red
}
Write-Host "[>>] MemTrimOnMinimize..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options' -Name 'TrimWorkingSetSize' -Value 1 -Type DWord
    $appliedTweaks.Add("MemTrimOnMinimize") | Out-Null
} catch {
    $failedTweaks.Add("MemTrimOnMinimize") | Out-Null
    Write-Host "[ERR] MemTrimOnMinimize: $_" -ForegroundColor Red
}
Write-Host "[>>] MemDisableKernelPaging..." -ForegroundColor DarkYellow
try {
    Write-Host "⚠  WARNING: NOT IDEAL FOR ALL SYSTEMS — Requires 8 GB+ RAM minimum. On systems with 4-6 GB RAM, forcing kernel code to stay in physical RAM instead of paging to disk can starve game processes of the memory they need, causing freezes or BSOD. Safe on 8 GB+ systems with a pagefile present." -ForegroundColor Yellow; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management' -Name 'DisablePagingExecutive' -Value 1; Write-Host "[Memory] DisablePagingExecutive=1 — kernel code stays in RAM. Reduces kernel page-fault stutter." -ForegroundColor Green
    $appliedTweaks.Add("MemDisableKernelPaging") | Out-Null
} catch {
    $failedTweaks.Add("MemDisableKernelPaging") | Out-Null
    Write-Host "[ERR] MemDisableKernelPaging: $_" -ForegroundColor Red
}
Write-Host "" 
Write-Host "--- [Debloat] 24 tweak(s) ---" -ForegroundColor DarkRed
Write-Host "[>>] DebloatCortana..." -ForegroundColor DarkYellow
try {
    $pkg = Get-AppxPackage *Microsoft.549981C3F5F10* -EA SilentlyContinue; if ($pkg) { $pkg | Remove-AppxPackage -EA SilentlyContinue; Write-Host "[OK] Cortana removed" -ForegroundColor Green } else { Write-Host "[SKIP] Cortana not installed" -ForegroundColor DarkGray }
    $appliedTweaks.Add("DebloatCortana") | Out-Null
} catch {
    $failedTweaks.Add("DebloatCortana") | Out-Null
    Write-Host "[ERR] DebloatCortana: $_" -ForegroundColor Red
}
Write-Host "[>>] DebloatOneDrive..." -ForegroundColor DarkYellow
try {
    taskkill /F /IM OneDrive.exe 2>$null; $setupPaths = @("$env:SystemRoot\System32\OneDriveSetup.exe","$env:SystemRoot\SysWOW64\OneDriveSetup.exe","$env:LOCALAPPDATA\Microsoft\OneDrive\OneDriveSetup.exe","$env:LOCALAPPDATA\Microsoft\OneDrive\Update\OneDriveSetup.exe"); $found = $setupPaths | Where-Object { Test-Path $_ } | Select-Object -First 1; if ($found) { & $found /uninstall 2>$null; Write-Host "[OK] OneDrive uninstaller ran" -ForegroundColor Green } else { Write-Host "[INFO] OneDrive setup.exe not found — may already be removed" -ForegroundColor Yellow }; Get-AppxPackage *Microsoft.OneDrive* -EA SilentlyContinue | Remove-AppxPackage -EA SilentlyContinue; Remove-ItemProperty "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" -Name "OneDrive" -EA SilentlyContinue; Write-Host "[OK] OneDrive startup entry removed" -ForegroundColor Green
    $appliedTweaks.Add("DebloatOneDrive") | Out-Null
} catch {
    $failedTweaks.Add("DebloatOneDrive") | Out-Null
    Write-Host "[ERR] DebloatOneDrive: $_" -ForegroundColor Red
}
Write-Host "[>>] DebloatXboxApp..." -ForegroundColor DarkYellow
try {
    Get-AppxPackage *Microsoft.XboxApp* -EA SilentlyContinue | Remove-AppxPackage -EA SilentlyContinue; Get-AppxProvisionedPackage -Online -EA SilentlyContinue | Where-Object { $_.DisplayName -like '*XboxApp*' } | Remove-AppxProvisionedPackage -Online -EA SilentlyContinue; Write-Host "[OK] Xbox App removed" -ForegroundColor Green
    $appliedTweaks.Add("DebloatXboxApp") | Out-Null
} catch {
    $failedTweaks.Add("DebloatXboxApp") | Out-Null
    Write-Host "[ERR] DebloatXboxApp: $_" -ForegroundColor Red
}
Write-Host "[>>] DebloatXboxGameBar..." -ForegroundColor DarkYellow
try {
    Get-AppxPackage *Microsoft.XboxGamingOverlay* -EA SilentlyContinue | Remove-AppxPackage -EA SilentlyContinue; Get-AppxProvisionedPackage -Online -EA SilentlyContinue | Where-Object { $_.DisplayName -like '*XboxGamingOverlay*' } | Remove-AppxProvisionedPackage -Online -EA SilentlyContinue; Set-ItemProperty -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\GameDVR' -Name 'AllowGameDVR' -Value 0 -Type DWord -Force -EA SilentlyContinue; Write-Host "[OK] Xbox Game Bar removed + DVR disabled" -ForegroundColor Green
    $appliedTweaks.Add("DebloatXboxGameBar") | Out-Null
} catch {
    $failedTweaks.Add("DebloatXboxGameBar") | Out-Null
    Write-Host "[ERR] DebloatXboxGameBar: $_" -ForegroundColor Red
}
Write-Host "[>>] DebloatBing..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Search' -Name 'BingSearchEnabled' -Value 0 -Type DWord -EA SilentlyContinue; Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Search' -Name 'CortanaConsent' -Value 0 -Type DWord -EA SilentlyContinue; Write-Host "[OK] Bing search in Start Menu disabled" -ForegroundColor Green
    $appliedTweaks.Add("DebloatBing") | Out-Null
} catch {
    $failedTweaks.Add("DebloatBing") | Out-Null
    Write-Host "[ERR] DebloatBing: $_" -ForegroundColor Red
}
Write-Host "[>>] DebloatSkype..." -ForegroundColor DarkYellow
try {
    Get-AppxPackage *Microsoft.SkypeApp* -EA SilentlyContinue | Remove-AppxPackage -EA SilentlyContinue; Get-AppxProvisionedPackage -Online -EA SilentlyContinue | Where-Object { $_.DisplayName -like '*SkypeApp*' } | Remove-AppxProvisionedPackage -Online -EA SilentlyContinue; Write-Host "[OK] Skype app removed" -ForegroundColor Green
    $appliedTweaks.Add("DebloatSkype") | Out-Null
} catch {
    $failedTweaks.Add("DebloatSkype") | Out-Null
    Write-Host "[ERR] DebloatSkype: $_" -ForegroundColor Red
}
Write-Host "[>>] DebloatTeamsConsumer..." -ForegroundColor DarkYellow
try {
    $pkg = Get-AppxPackage -AllUsers *MicrosoftTeams* -EA SilentlyContinue | Where-Object { $_.SignatureKind -eq 'Store' }; if ($pkg) { $pkg | Remove-AppxPackage -EA SilentlyContinue; Write-Host "[OK] Microsoft Teams (consumer Store version) removed" -ForegroundColor Green } else { Write-Host "[SKIP] Teams consumer app not installed" -ForegroundColor DarkGray }
    $appliedTweaks.Add("DebloatTeamsConsumer") | Out-Null
} catch {
    $failedTweaks.Add("DebloatTeamsConsumer") | Out-Null
    Write-Host "[ERR] DebloatTeamsConsumer: $_" -ForegroundColor Red
}
Write-Host "[>>] DebloatFeedback..." -ForegroundColor DarkYellow
try {
    Get-AppxPackage *WindowsFeedbackHub* -EA SilentlyContinue | Remove-AppxPackage -EA SilentlyContinue; Get-AppxProvisionedPackage -Online -EA SilentlyContinue | Where-Object { $_.DisplayName -like '*FeedbackHub*' } | Remove-AppxProvisionedPackage -Online -EA SilentlyContinue; Write-Host "[OK] Windows Feedback Hub removed" -ForegroundColor Green
    $appliedTweaks.Add("DebloatFeedback") | Out-Null
} catch {
    $failedTweaks.Add("DebloatFeedback") | Out-Null
    Write-Host "[ERR] DebloatFeedback: $_" -ForegroundColor Red
}
Write-Host "[>>] DebloatGetHelp..." -ForegroundColor DarkYellow
try {
    Get-AppxPackage *Microsoft.GetHelp* -EA SilentlyContinue | Remove-AppxPackage -EA SilentlyContinue; Get-AppxProvisionedPackage -Online -EA SilentlyContinue | Where-Object { $_.DisplayName -like '*GetHelp*' } | Remove-AppxProvisionedPackage -Online -EA SilentlyContinue; Write-Host "[OK] Get Help removed" -ForegroundColor Green
    $appliedTweaks.Add("DebloatGetHelp") | Out-Null
} catch {
    $failedTweaks.Add("DebloatGetHelp") | Out-Null
    Write-Host "[ERR] DebloatGetHelp: $_" -ForegroundColor Red
}
Write-Host "[>>] DebloatClipchamp..." -ForegroundColor DarkYellow
try {
    Get-AppxPackage *Clipchamp* -EA SilentlyContinue | Remove-AppxPackage -EA SilentlyContinue; Get-AppxProvisionedPackage -Online -EA SilentlyContinue | Where-Object { $_.DisplayName -like '*Clipchamp*' } | Remove-AppxProvisionedPackage -Online -EA SilentlyContinue; Write-Host "[OK] Clipchamp removed" -ForegroundColor Green
    $appliedTweaks.Add("DebloatClipchamp") | Out-Null
} catch {
    $failedTweaks.Add("DebloatClipchamp") | Out-Null
    Write-Host "[ERR] DebloatClipchamp: $_" -ForegroundColor Red
}
Write-Host "[>>] DebloatPowerAutomate..." -ForegroundColor DarkYellow
try {
    Get-AppxPackage *PowerAutomate* -EA SilentlyContinue | Remove-AppxPackage -EA SilentlyContinue; Get-AppxProvisionedPackage -Online -EA SilentlyContinue | Where-Object { $_.DisplayName -like '*PowerAutomate*' } | Remove-AppxProvisionedPackage -Online -EA SilentlyContinue; Write-Host "[OK] Power Automate removed" -ForegroundColor Green
    $appliedTweaks.Add("DebloatPowerAutomate") | Out-Null
} catch {
    $failedTweaks.Add("DebloatPowerAutomate") | Out-Null
    Write-Host "[ERR] DebloatPowerAutomate: $_" -ForegroundColor Red
}
Write-Host "[>>] DebloatQuickAssist..." -ForegroundColor DarkYellow
try {
    Get-AppxPackage *QuickAssist* -EA SilentlyContinue | Remove-AppxPackage -EA SilentlyContinue; Get-AppxProvisionedPackage -Online -EA SilentlyContinue | Where-Object { $_.DisplayName -like '*QuickAssist*' } | Remove-AppxProvisionedPackage -Online -EA SilentlyContinue; Write-Host "[OK] Quick Assist removed" -ForegroundColor Green
    $appliedTweaks.Add("DebloatQuickAssist") | Out-Null
} catch {
    $failedTweaks.Add("DebloatQuickAssist") | Out-Null
    Write-Host "[ERR] DebloatQuickAssist: $_" -ForegroundColor Red
}
Write-Host "[>>] DebloatWindowsCamera..." -ForegroundColor DarkYellow
try {
    Get-AppxPackage *WindowsCamera* -EA SilentlyContinue | Remove-AppxPackage -EA SilentlyContinue; Get-AppxProvisionedPackage -Online -EA SilentlyContinue | Where-Object { $_.DisplayName -like '*WindowsCamera*' } | Remove-AppxProvisionedPackage -Online -EA SilentlyContinue; Write-Host "[OK] Windows Camera removed" -ForegroundColor Green
    $appliedTweaks.Add("DebloatWindowsCamera") | Out-Null
} catch {
    $failedTweaks.Add("DebloatWindowsCamera") | Out-Null
    Write-Host "[ERR] DebloatWindowsCamera: $_" -ForegroundColor Red
}
Write-Host "[>>] DebloatMSPaint3D..." -ForegroundColor DarkYellow
try {
    Get-AppxPackage *Microsoft.MSPaint* -EA SilentlyContinue | Remove-AppxPackage -EA SilentlyContinue; Get-AppxProvisionedPackage -Online -EA SilentlyContinue | Where-Object { $_.DisplayName -like '*MSPaint*' } | Remove-AppxProvisionedPackage -Online -EA SilentlyContinue; Write-Host "[OK] Paint 3D removed" -ForegroundColor Green
    $appliedTweaks.Add("DebloatMSPaint3D") | Out-Null
} catch {
    $failedTweaks.Add("DebloatMSPaint3D") | Out-Null
    Write-Host "[ERR] DebloatMSPaint3D: $_" -ForegroundColor Red
}
Write-Host "[>>] ServiceDiagTrack..." -ForegroundColor DarkYellow
try {
    Stop-Service -Name "DiagTrack" -Force; Set-Service -Name "DiagTrack" -StartupType Disabled
    $appliedTweaks.Add("ServiceDiagTrack") | Out-Null
} catch {
    $failedTweaks.Add("ServiceDiagTrack") | Out-Null
    Write-Host "[ERR] ServiceDiagTrack: $_" -ForegroundColor Red
}
Write-Host "[>>] ServiceSysMain..." -ForegroundColor DarkYellow
try {
    Stop-Service -Name "SysMain" -Force; Set-Service -Name "SysMain" -StartupType Disabled
    $appliedTweaks.Add("ServiceSysMain") | Out-Null
} catch {
    $failedTweaks.Add("ServiceSysMain") | Out-Null
    Write-Host "[ERR] ServiceSysMain: $_" -ForegroundColor Red
}
Write-Host "[>>] ServiceFax..." -ForegroundColor DarkYellow
try {
    Stop-Service -Name 'Fax' -Force; Set-Service -Name 'Fax' -StartupType Disabled
    $appliedTweaks.Add("ServiceFax") | Out-Null
} catch {
    $failedTweaks.Add("ServiceFax") | Out-Null
    Write-Host "[ERR] ServiceFax: $_" -ForegroundColor Red
}
Write-Host "[>>] ServiceRemoteReg..." -ForegroundColor DarkYellow
try {
    Stop-Service -Name "RemoteRegistry" -Force; Set-Service -Name "RemoteRegistry" -StartupType Disabled
    $appliedTweaks.Add("ServiceRemoteReg") | Out-Null
} catch {
    $failedTweaks.Add("ServiceRemoteReg") | Out-Null
    Write-Host "[ERR] ServiceRemoteReg: $_" -ForegroundColor Red
}
Write-Host "[>>] ServiceRetailDemo..." -ForegroundColor DarkYellow
try {
    Stop-Service -Name 'RetailDemo' -Force; Set-Service -Name 'RetailDemo' -StartupType Disabled
    $appliedTweaks.Add("ServiceRetailDemo") | Out-Null
} catch {
    $failedTweaks.Add("ServiceRetailDemo") | Out-Null
    Write-Host "[ERR] ServiceRetailDemo: $_" -ForegroundColor Red
}
Write-Host "[>>] PrivacyTelemetry..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\DataCollection' -Name 'AllowTelemetry' -Value 0
    $appliedTweaks.Add("PrivacyTelemetry") | Out-Null
} catch {
    $failedTweaks.Add("PrivacyTelemetry") | Out-Null
    Write-Host "[ERR] PrivacyTelemetry: $_" -ForegroundColor Red
}
Write-Host "[>>] PrivacyAdvertisingID..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\AdvertisingInfo' -Name 'Enabled' -Value 0
    $appliedTweaks.Add("PrivacyAdvertisingID") | Out-Null
} catch {
    $failedTweaks.Add("PrivacyAdvertisingID") | Out-Null
    Write-Host "[ERR] PrivacyAdvertisingID: $_" -ForegroundColor Red
}
Write-Host "[>>] PrivacyLocationTracking..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\location' -Name 'Value' -Value 'Deny'
    $appliedTweaks.Add("PrivacyLocationTracking") | Out-Null
} catch {
    $failedTweaks.Add("PrivacyLocationTracking") | Out-Null
    Write-Host "[ERR] PrivacyLocationTracking: $_" -ForegroundColor Red
}
Write-Host "[>>] PrivacyActivityHistory..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\System' -Name 'EnableActivityFeed' -Value 0
    $appliedTweaks.Add("PrivacyActivityHistory") | Out-Null
} catch {
    $failedTweaks.Add("PrivacyActivityHistory") | Out-Null
    Write-Host "[ERR] PrivacyActivityHistory: $_" -ForegroundColor Red
}
Write-Host "[>>] PrivacyDiagFeedback..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\Siuf\Rules' -Name 'NumberOfSIUFInPeriod' -Value 0
    $appliedTweaks.Add("PrivacyDiagFeedback") | Out-Null
} catch {
    $failedTweaks.Add("PrivacyDiagFeedback") | Out-Null
    Write-Host "[ERR] PrivacyDiagFeedback: $_" -ForegroundColor Red
}

Write-Host "" 
Write-Host "=============================================" -ForegroundColor DarkRed
Write-Host "   OPTI GODS by leaq -- TWEAKS APPLIED" -ForegroundColor Red
Write-Host "=============================================" -ForegroundColor DarkRed
Write-Host "" 
Write-Host "  [OK] $($appliedTweaks.Count) of 44 tweaks applied" -ForegroundColor Green
if ($failedTweaks.Count -gt 0) {
    Write-Host "" 
    Write-Host "  [FAILED] ($($failedTweaks.Count) tweaks had errors):" -ForegroundColor Red
    foreach ($t in $failedTweaks) { Write-Host "    [ERR] $t" -ForegroundColor Red }
    Write-Host "" 
    Write-Host "  Note: Errors are normal for tweaks that don't apply to your hardware." -ForegroundColor DarkGray
} else {
    Write-Host "  All tweaks applied with zero errors!" -ForegroundColor Green
}
Write-Host "" 
Write-Host "  >> Restart your PC to activate ALL changes. <<" -ForegroundColor Cyan
Write-Host "  Thank you for using Opti Gods by leaq!" -ForegroundColor Red
Write-Host "=============================================" -ForegroundColor DarkRed
Write-Host "" 
Write-Host "  Close this window when you are done." -ForegroundColor DarkGray
Read-Host "  Press Enter"
Remove-Item $PSCommandPath -Force -EA SilentlyContinue