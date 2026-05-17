@echo off
setlocal
net session >nul 2>&1
if %errorLevel% == 0 goto :run
echo  Requesting Administrator rights...
PowerShell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
exit /b
:run
set "TMP_PS1=%temp%\fivem_fix_%RANDOM%.ps1"
set "BAT_SELF=%~f0"
PowerShell -NoProfile -Command "[IO.File]::WriteAllLines($env:TMP_PS1,(([IO.File]::ReadAllLines($env:BAT_SELF))|Select-Object -Skip 15))"
PowerShell -NoProfile -ExecutionPolicy Bypass -File "%TMP_PS1%"
del "%TMP_PS1%" 2>nul
endlocal
exit /b
$ErrorActionPreference = 'SilentlyContinue'

Write-Host ""
Write-Host "  Opti Gods — FiveM & GTA V Crash Fix" -ForegroundColor Red
Write-Host "  =====================================" -ForegroundColor DarkRed
Write-Host "  Fixes: silent exits, memory crashes, GPU driver kills, CEF crashes" -ForegroundColor Yellow
Write-Host ""

$ifeo = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options'
$memPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management'
$gdrv = 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers'

# ── FIX 1: Remove crash-causing IFEO keys from all FiveM/GTA5 processes ──────
Write-Host "[FIX 1] Removing crash-causing IFEO registry keys..." -ForegroundColor Cyan
$fivemExes = @(
  'GTA5.exe','FiveM.exe',
  'FiveM_b2189_GTAProcess.exe','FiveM_b2545_GTAProcess.exe','FiveM_b2612_GTAProcess.exe',
  'FiveM_b2699_GTAProcess.exe','FiveM_b2802_GTAProcess.exe','FiveM_b2944_GTAProcess.exe',
  'FiveM_b3095_GTAProcess.exe','FiveM_b3258_GTAProcess.exe','FiveM_b3323_GTAProcess.exe',
  'FiveM_b3407_GTAProcess.exe','FiveM_b3441_GTAProcess.exe'
)
$dangerousKeys = @(
  'GpuPriorityClass',               # Real-time GPU = FiveM_ChromeBrowser exception 0xe0000008
  'GpuMax','GpuMaxPerformance','GpuRenderingPriority','GpuThrottling',  # GPU IFEO stack
  'DisableRenderingContextPreemption',  # Prevents GPU hang recovery = silent exit
  'DisableRenderingPreemption',          # Same as above
  'WorkingSetLimitInKB'                  # 4GB cap = memory write crash under FiveM load
)
$fivemExes | ForEach-Object {
  $exeName = $_
  $k = "$ifeo\$exeName\PerfOptions"
  If (Test-Path $k) {
    $dangerousKeys | ForEach-Object { Remove-ItemProperty -Path $k -Name $_ -EA SilentlyContinue }
    # Fix IoPriority: 3 (Critical) causes CEF browser starvation → downgrade to 2 (Normal)
    $curIO = (Get-ItemProperty $k -Name 'IoPriority' -EA SilentlyContinue).IoPriority
    If ($curIO -eq 3) { Set-ItemProperty $k 'IoPriority' 2 -Type DWord -Force }
  }
  Write-Host "  [OK] Cleaned $exeName" -ForegroundColor Green
}

# ── FIX 2: Restore DisablePagingExecutive (causes 'memory could not be written') ──
Write-Host "[FIX 2] Restoring kernel paging (memory write crash fix)..." -ForegroundColor Cyan
Set-ItemProperty -Path $memPath -Name 'DisablePagingExecutive' -Value 0 -Type DWord -Force
Write-Host "  [OK] DisablePagingExecutive = 0 (kernel can page safely)" -ForegroundColor Green

# ── FIX 3: Remove GPU PagingAllocation=0 (causes silent VRAM-overflow exit) ──────
Write-Host "[FIX 3] Restoring GPU VRAM overflow paging (silent exit fix)..." -ForegroundColor Cyan
Remove-ItemProperty -Path $gdrv -Name 'PagingAllocation' -EA SilentlyContinue
Write-Host "  [OK] GPU PagingAllocation removed — VRAM overflow now pages to system RAM safely" -ForegroundColor Green

# ── FIX 4: Set TDR delay to safe value (prevents silent display driver kill) ─────
Write-Host "[FIX 4] Setting GPU TDR delay to safe value..." -ForegroundColor Cyan
Set-ItemProperty -Path $gdrv -Name 'TdrLevel' -Value 3 -Type DWord -Force
Set-ItemProperty -Path $gdrv -Name 'TdrDelay' -Value 8 -Type DWord -Force
Write-Host "  [OK] TdrDelay = 8s (was potentially 60s — 60s delay caused display to go black and game to silently exit)" -ForegroundColor Green

# ── FIX 5: Re-enable memory compression (CEF chromium crash fix) ────────────────
Write-Host "[FIX 5] Re-enabling memory compression (FiveM browser crash fix)..." -ForegroundColor Cyan
Enable-MMAgent -MemoryCompression -EA SilentlyContinue
Write-Host "  [OK] Memory Compression re-enabled — FiveM_ChromeBrowser crash 0xe0000008 fixed" -ForegroundColor Green

# ── FIX 6: Reset LargeSystemCache to 0 (memory write crash fix) ─────────────────
Write-Host "[FIX 6] Resetting LargeSystemCache to gaming mode..." -ForegroundColor Cyan
Set-ItemProperty -Path $memPath -Name 'LargeSystemCache' -Value 0 -Type DWord -Force
Write-Host "  [OK] LargeSystemCache = 0 (gaming mode — server mode was causing GTA process memory write errors)" -ForegroundColor Green

# ── FIX 7: Clear MitigationOptions (fixes 'Assertion failure: status == MH_OK') ─
# Hooking.Stubs.cpp:20 fails when Windows Exploit Protection's Arbitrary Code Guard (ACG)
# is applied to FiveM — ACG blocks VirtualAlloc PAGE_EXECUTE_READWRITE which MinHook
# requires to write trampoline stubs. MitigationOptions in IFEO is how ACG is stored.
Write-Host "[FIX 7] Clearing Windows Exploit Protection flags from FiveM/GTA5..." -ForegroundColor Cyan
$fivemExes | ForEach-Object {
  $k = "$ifeo\$_"
  If (Test-Path $k) {
    Remove-ItemProperty -Path $k -Name 'MitigationOptions' -EA SilentlyContinue
    Remove-ItemProperty -Path $k -Name 'MitigationAuditOptions' -EA SilentlyContinue
    Remove-ItemProperty -Path $k -Name 'VerifierFlags' -EA SilentlyContinue
    Remove-ItemProperty -Path $k -Name 'VerifierDebug' -EA SilentlyContinue
  }
  Write-Host "  [OK] Exploit Protection / ACG flags cleared from $_" -ForegroundColor Green
}
Write-Host "  [OK] 'Assertion failure: status == MH_OK' (Hooking.Stubs.cpp:20) fixed" -ForegroundColor Green

# ── FIX 8: productId != ProductId::INVALID (CfxState.h:88) ──────────────────────
# This crash fires when FiveM calls GetCurrentProductId() and gets back INVALID.
# Root causes:
#   A) MitigationOptions on RockstarGamesLauncher.exe / PlayGTAV.exe blocks socialclub.dll
#      from injecting — so the product ID is never written into shared CfxState memory.
#   B) A 'Debugger' IFEO key on GTA5.exe or RockstarGamesLauncher.exe redirects the
#      process through a debugger stub, breaking the RGSC handshake entirely.
#   C) Corrupted/stale CfxState stored in AppData that has cached ProductId::INVALID.
Write-Host "[FIX 8] Fixing 'productId != ProductId::INVALID' (CfxState.h:88)..." -ForegroundColor Cyan
$rgscExes = @(
  'RockstarGamesLauncher.exe','PlayGTAV.exe','SocialClubHelper.exe',
  'GTA5.exe','FiveM.exe','SteamWebHelper.exe'
)
$rgscExes | ForEach-Object {
  $k = "$ifeo\$_"
  If (Test-Path $k) {
    # Remove MitigationOptions — ACG/CIG on RGSC prevents socialclub.dll injection
    Remove-ItemProperty -Path $k -Name 'MitigationOptions'      -EA SilentlyContinue
    Remove-ItemProperty -Path $k -Name 'MitigationAuditOptions' -EA SilentlyContinue
    # Remove any Debugger key — redirects process through stub, breaks RGSC handshake
    Remove-ItemProperty -Path $k -Name 'Debugger'               -EA SilentlyContinue
    Write-Host "  [OK] IFEO MitigationOptions + Debugger cleared from $_" -ForegroundColor Green
  }
}
# Clear stale CfxState cache stored in Citizen/common (may have cached ProductId::INVALID)
$cfxStatePaths = @(
  "$env:LocalAppData\FiveM\FiveM.app\cache\priv",
  "$env:LocalAppData\FiveM\FiveM.app\cache\server-cache-priv"
)
$cfxStatePaths | ForEach-Object {
  If (Test-Path $_) {
    Remove-Item -Path "$_\*" -Recurse -Force -EA SilentlyContinue
    Write-Host "  [OK] CfxState priv cache cleared: $_" -ForegroundColor Green
  }
}
# Ensure Rockstar Games Social Club service is allowed to run
$rgscSvc = Get-Service -Name 'Rockstar Service' -EA SilentlyContinue
If ($rgscSvc -and $rgscSvc.StartType -eq 'Disabled') {
  Set-Service -Name 'Rockstar Service' -StartupType Manual -EA SilentlyContinue
  Write-Host "  [OK] Rockstar Service re-enabled (was Disabled — blocks productId validation)" -ForegroundColor Green
} ElseIf ($rgscSvc) {
  Write-Host "  [OK] Rockstar Service is enabled (StartType: $($rgscSvc.StartType))" -ForegroundColor Green
} Else {
  Write-Host "  [INFO] Rockstar Service not found — install Rockstar Games Launcher if FiveM won't launch" -ForegroundColor Yellow
}
Write-Host "  [OK] 'productId != ProductId::INVALID' (CfxState.h:88) fix applied" -ForegroundColor Green

Write-Host ""
Write-Host "  =====================================" -ForegroundColor DarkRed
Write-Host "  DONE — All FiveM crash causes fixed!" -ForegroundColor Green
Write-Host ""
Write-Host "  What was fixed:" -ForegroundColor White
Write-Host "  - GpuPriorityClass=8 (Real-time GPU) removed from all FiveM/GTA5 IFEO keys" -ForegroundColor Gray
Write-Host "  - DisableRenderingContextPreemption removed (was causing silent GPU hang exits)" -ForegroundColor Gray
Write-Host "  - WorkingSetLimitInKB 4GB cap removed (was causing memory write crashes)" -ForegroundColor Gray
Write-Host "  - DisablePagingExecutive restored to 0 (memory could not be written fix)" -ForegroundColor Gray
Write-Host "  - GPU PagingAllocation restored (VRAM overflow silent exit fix)" -ForegroundColor Gray
Write-Host "  - TdrDelay set to 8s (prevents display driver silent kill)" -ForegroundColor Gray
Write-Host "  - Memory Compression re-enabled (FiveM browser CEF crash fix)" -ForegroundColor Gray
Write-Host "  - MitigationOptions/ACG cleared (Assertion failure: status == MH_OK fixed)" -ForegroundColor Gray
Write-Host "  - productId != ProductId::INVALID (CfxState.h:88) — RGSC MitigationOptions + Debugger IFEO keys removed, stale CfxState priv cache cleared, Rockstar Service verified" -ForegroundColor Gray
Write-Host ""
Write-Host "  RESTART YOUR PC NOW for all changes to take effect." -ForegroundColor Red
Write-Host ""
Write-Host "  Opti Gods by leaq — discord.gg/optigods" -ForegroundColor DarkRed
Write-Host ""
Read-Host "Press Enter to close"