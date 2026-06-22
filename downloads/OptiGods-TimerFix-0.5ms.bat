@echo off
setlocal
set "SELF=%~f0"
set "TMPPS1=%TEMP%\OptiGods-TimerFix.ps1"

title Opti Gods by leaq  --  Timer Resolution Fix

echo.
echo  ==========================================
echo    OPTI GODS by leaq  --  Timer Fix
echo    Pushing system timer: 1ms - 0.5ms
echo  ==========================================
echo.
echo  [1/2] Extracting timer fix script...
PowerShell -NoProfile -ExecutionPolicy Bypass -Command "$c=[IO.File]::ReadAllText($env:SELF,[Text.Encoding]::UTF8);$m='##PS1'+'_START##';$i=$c.IndexOf($m);if($i -ge 0){[IO.File]::WriteAllText($env:TMPPS1,$c.Substring($i+$m.Length),[Text.Encoding]::UTF8)}"
if not exist "%TMPPS1%" (
  echo.
  echo  [ERROR] Script extraction failed. Please re-download from the website.
  echo.
  pause
  exit /b 1
)
echo  [2/2] A Windows security prompt will appear.
echo       Click "Yes" to apply the timer fix as Administrator.
echo.
PowerShell -NoProfile -Command "try { Start-Process powershell.exe -Verb RunAs -Wait -ArgumentList ('-NoProfile -ExecutionPolicy Bypass -File '+[char]34+$env:TMPPS1+[char]34) } catch { Write-Host ('UAC cancelled or launch failed: '+$_) -ForegroundColor Red; Read-Host 'Press Enter to close' }"
del "%TMPPS1%" 2>nul
exit /b 0
##PS1_START##
$ErrorActionPreference = 'SilentlyContinue'

if (!([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host ""
    Write-Host "  !! This script must run as Administrator !!" -ForegroundColor Red
    Write-Host "  Please re-download and run the .bat file from the website." -ForegroundColor Yellow
    Write-Host ""
    Read-Host "  Press Enter to close"
    exit 1
}

trap {
    Write-Host ""
    Write-Host "  [FATAL ERROR] $_" -ForegroundColor Red
    Write-Host ""
    Read-Host "  Press Enter to close"
    break
}

Clear-Host
Write-Host "=====================================" -ForegroundColor Red
Write-Host "  OPTI GODS by leaq" -ForegroundColor Red
Write-Host "  Timer Resolution Fix — 0.5ms" -ForegroundColor White
Write-Host "  Running as: $env:USERNAME (Admin)" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Red
Write-Host ""

# ── Step 1: Bootloader high-res timer ─────────────────────────────────────
Write-Host "  [1/3] Enabling high-resolution platform timer..." -ForegroundColor White
bcdedit /set disabledynamictick yes | Out-Null
Write-Host "        OK" -ForegroundColor Green

# ── Step 2: Apply 0.5ms immediately via NtSetTimerResolution ──────────────
Write-Host "  [2/3] Applying 0.5ms resolution now..." -ForegroundColor White
$timerSrc = @"
using System;
using System.Runtime.InteropServices;
public class OGTimer {
    [DllImport("ntdll.dll")] public static extern int NtSetTimerResolution(uint d, bool s, out uint c);
}
"@
Add-Type -TypeDefinition $timerSrc -EA SilentlyContinue
try {
    $cur = [uint32]0
    [OGTimer]::NtSetTimerResolution(5000, $true, [ref]$cur) | Out-Null
    $ms = [math]::Round($cur / 10000.0, 4)
    Write-Host "        Current resolution: ${ms}ms" -ForegroundColor Green
} catch {
    Write-Host "        Will apply after reboot." -ForegroundColor Yellow
}

# ── Step 3: Startup task so it re-applies after every reboot ──────────────
Write-Host "  [3/3] Registering startup task..." -ForegroundColor White
$taskName = "OptiGods-TimerResolution"
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -EA SilentlyContinue

$psCmd = 'Add-Type -TypeDefinition ''using System;using System.Runtime.InteropServices;public class OGT{[DllImport("ntdll.dll")]public static extern int NtSetTimerResolution(uint d,bool s,out uint c);}''; $c=0u; [OGT]::NtSetTimerResolution(5000,$true,[ref]$c); Start-Sleep -Seconds 2147483'
$action    = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-WindowStyle Hidden -NonInteractive -ExecutionPolicy Bypass -Command `"$psCmd`""
$trigger   = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings  = New-ScheduledTaskSettingsSet -ExecutionTimeLimit 0 -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Write-Host "        OK — persists across reboots" -ForegroundColor Green

# ── Done ──────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  =====================================" -ForegroundColor Red
Write-Host "   DONE — Timer resolution: 0.5ms" -ForegroundColor White
Write-Host "   Permanent. No action needed on reboot." -ForegroundColor DarkGray
Write-Host "  =====================================" -ForegroundColor Red
Write-Host ""
Write-Host "  Verify with: TimerResolution tool by lucafalcao" -ForegroundColor DarkGray
Write-Host "  Should read: Resolution 0.5000ms" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  To REVERT:" -ForegroundColor DarkGray
Write-Host "  bcdedit /deletevalue disabledynamictick" -ForegroundColor Yellow
Write-Host "  Unregister-ScheduledTask OptiGods-TimerResolution" -ForegroundColor Yellow
Write-Host ""
Read-Host "  Press Enter to close"
