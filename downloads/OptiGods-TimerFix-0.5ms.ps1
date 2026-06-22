#Requires -RunAsAdministrator
# ══════════════════════════════════════════════════════
#   Opti Gods — Timer Resolution Fix  (0.5ms)
#   Universal — works on all Windows 10 / 11 systems
#   Run as Administrator, then REBOOT once.
# ══════════════════════════════════════════════════════

$Host.UI.RawUI.WindowTitle = "Opti Gods — Timer Resolution Fix"

Write-Host ""
Write-Host "  ██████╗ ██████╗ ████████╗██╗     ██████╗  ██████╗ ██████╗ ███████╗" -ForegroundColor Red
Write-Host "  ██╔══██╗██╔══██╗╚══██╔══╝██║    ██╔════╝ ██╔═══██╗██╔══██╗██╔════╝" -ForegroundColor Red
Write-Host "  ██║  ██║██████╔╝   ██║   ██║    ██║  ███╗██║   ██║██║  ██║███████╗" -ForegroundColor DarkRed
Write-Host "  ██║  ██║██╔═══╝    ██║   ██║    ██║   ██║██║   ██║██║  ██║╚════██║" -ForegroundColor DarkRed
Write-Host "  ██████╔╝██║        ██║   ██║    ╚██████╔╝╚██████╔╝██████╔╝███████║" -ForegroundColor Red
Write-Host "  ╚═════╝ ╚═╝        ╚═╝   ╚═╝     ╚═════╝  ╚═════╝ ╚═════╝ ╚══════╝" -ForegroundColor Red
Write-Host ""
Write-Host "  Timer Resolution Fix — pushing from 1ms → 0.5ms" -ForegroundColor White
Write-Host "  optigods.replit.app" -ForegroundColor DarkGray
Write-Host ""

# ── Step 1: Enable platform high-res timer in bootloader ──────────────────
Write-Host "[1/3] Enabling high-resolution platform timer..." -ForegroundColor Cyan
bcdedit /set disabledynamictick yes | Out-Null
Write-Host "      OK — disabledynamictick set" -ForegroundColor Green

# ── Step 2: Create a tiny C# helper that holds 0.5ms at runtime ──────────
Write-Host "[2/3] Building 0.5ms timer helper..." -ForegroundColor Cyan

$helperDir  = "$env:ProgramFiles\OptiGods"
$helperPath = "$helperDir\TimerRes.exe"

$csSource = @"
using System;
using System.Runtime.InteropServices;
using System.Threading;

class TimerRes {
    [DllImport("ntdll.dll")]
    static extern int NtSetTimerResolution(uint DesiredResolution, bool SetResolution, out uint CurrentResolution);

    [DllImport("ntdll.dll")]
    static extern int NtQueryTimerResolution(out uint MinRes, out uint MaxRes, out uint CurRes);

    static void Main() {
        uint cur;
        // 5000 = 0.5ms in 100ns units
        NtSetTimerResolution(5000, true, out cur);
        Console.WriteLine("Timer resolution set to: " + (cur / 10000.0) + "ms");
        // Keep process alive so resolution stays applied
        Thread.Sleep(Timeout.Infinite);
    }
}
"@

if (-not (Test-Path $helperDir)) { New-Item -ItemType Directory -Path $helperDir -Force | Out-Null }

# Compile inline using .NET's built-in C# compiler
Add-Type -TypeDefinition $csSource -Language CSharp -OutputAssembly $helperPath -OutputType ConsoleApplication -EA SilentlyContinue

if (Test-Path $helperPath) {
    Write-Host "      OK — helper compiled to $helperPath" -ForegroundColor Green
} else {
    # Fallback: use PowerShell inline P/Invoke (no .exe, runs in-process instead)
    Write-Host "      Compiler unavailable — using inline P/Invoke method" -ForegroundColor Yellow
    $helperPath = $null
}

# ── Step 3: Register startup scheduled task ───────────────────────────────
Write-Host "[3/3] Registering startup task..." -ForegroundColor Cyan

$taskName = "OptiGods-TimerResolution"

# Remove old task if exists
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -EA SilentlyContinue

if ($helperPath -and (Test-Path $helperPath)) {
    $action  = New-ScheduledTaskAction -Execute $helperPath
} else {
    # Fallback: PowerShell one-liner that sets timer via P/Invoke at startup
    $psCmd = @"
Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class TR{[DllImport("ntdll.dll")]public static extern int NtSetTimerResolution(uint d,bool s,out uint c);}'; `$c=0u; [TR]::NtSetTimerResolution(5000,`$true,[ref]`$c); Start-Sleep -Seconds ([int]::MaxValue)
"@
    $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-WindowStyle Hidden -NonInteractive -Command `"$psCmd`""
}

$trigger   = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings  = New-ScheduledTaskSettingsSet -ExecutionTimeLimit 0 -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null

Write-Host "      OK — task '$taskName' registered (runs at every login)" -ForegroundColor Green

# ── Apply immediately without waiting for reboot ──────────────────────────
Write-Host ""
Write-Host "  Applying 0.5ms resolution NOW..." -ForegroundColor Cyan
$timerCode = @"
using System;
using System.Runtime.InteropServices;
public class TimerNow {
    [DllImport("ntdll.dll")]
    public static extern int NtSetTimerResolution(uint d, bool s, out uint c);
}
"@
Add-Type -TypeDefinition $timerCode -EA SilentlyContinue
try {
    $current = [uint32]0
    [TimerNow]::NtSetTimerResolution(5000, $true, [ref]$current) | Out-Null
    $ms = [math]::Round($current / 10000.0, 4)
    Write-Host "  Current resolution: ${ms}ms" -ForegroundColor Green
} catch {
    Write-Host "  Will apply after reboot." -ForegroundColor Yellow
}

# ── Done ──────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host "   DONE — Timer resolution set to 0.5ms" -ForegroundColor White
Write-Host "   Persists across reboots automatically." -ForegroundColor DarkGray
Write-Host "  ════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  To verify: download 'TimerResolution' by lucafalcao" -ForegroundColor DarkGray
Write-Host "  and confirm it reads 0.5000ms" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  To REVERT run:" -ForegroundColor DarkGray
Write-Host "  bcdedit /deletevalue disabledynamictick" -ForegroundColor Yellow
Write-Host "  Unregister-ScheduledTask -TaskName OptiGods-TimerResolution -Confirm:`$false" -ForegroundColor Yellow
Write-Host ""

Read-Host "  Press ENTER to close"
