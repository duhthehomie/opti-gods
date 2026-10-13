$ErrorActionPreference = 'Stop'
$env:PSModulePath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\Modules'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Windows repair requires an elevated Opti Gods process. No repair was run.'
}
$logDirectory = Join-Path $env:ProgramData 'OptiGods\RepairLogs'
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
$log = Join-Path $logDirectory ("WindowsRepair-{0}.txt" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
$failed = $false
$repairStarted = Get-Date
$dismExit = $null
$sfcExit = $null
Start-Transcript -Path $log -Force | Out-Null
function Write-SystemDiagnostics([string]$phase) {
    Write-Output "=== $phase diagnostics ==="
    $os = Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion' -ErrorAction Stop
    Write-Output "Windows: $($os.ProductName); edition=$($os.EditionID); version=$($os.DisplayVersion); build=$($os.CurrentBuildNumber).$($os.UBR)"
    Write-Output "Elevated: $($principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)); 64-bit process=$([Environment]::Is64BitProcess)"
    foreach ($name in @('wuauserv','BITS','TrustedInstaller')) {
        $serviceConfig = Get-ItemProperty -LiteralPath "HKLM:\SYSTEM\CurrentControlSet\Services\$name" -ErrorAction Ignore
        Write-Output "Repair service $name : registry Start=$($serviceConfig.Start) (4 means disabled)"
    }
    foreach ($path in @(
        'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending',
        'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired'
    )) { Write-Output "Pending reboot marker $path : $(Test-Path -LiteralPath $path)" }
    $drive = [System.IO.DriveInfo]::new($env:SystemRoot.Substring(0,3))
    Write-Output "Windows drive free space: $([Math]::Round($drive.AvailableFreeSpace / 1GB, 2)) GB"
    $servicingPolicy = Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\Servicing' -ErrorAction Ignore
    foreach ($name in @('UseWindowsUpdate','RepairContentServerSource')) {
        if ($servicingPolicy -and $servicingPolicy.PSObject.Properties.Name -contains $name) {
            Write-Output "Servicing policy $name : $($servicingPolicy.$name)"
        }
    }
    & "$env:SystemRoot\System32\whoami.exe" /priv
    foreach ($name in @('VSS','swprv','Winmgmt','WinDefend','wuauserv','BITS','TrustedInstaller')) {
        $service = Get-Service -Name $name -ErrorAction Ignore
        if ($service) { Write-Output "$name : $($service.Status), $($service.StartType)" }
        else { Write-Output "$name : not installed" }
    }
    foreach ($path in @(
        'HKLM:\SOFTWARE\Policies\Microsoft\Windows NT\SystemRestore',
        'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\SystemRestore'
    )) {
        $properties = Get-ItemProperty -LiteralPath $path -ErrorAction Ignore
        foreach ($name in @('DisableSR','DisableConfig','SystemRestorePointCreationFrequency','RPSessionInterval')) {
            if ($properties -and $properties.PSObject.Properties.Name -contains $name) {
                Write-Output "$path / $name = $($properties.$name)"
            }
        }
    }
    # Isolate potentially broken WMI/VSS providers in a bounded child process.
    # Redirect to files before waiting, so output cannot fill an unread pipe.
    $probeSource = @'
$ErrorActionPreference = 'Stop'
$env:PSModulePath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\Modules'
Write-Output 'Starting restore-provider read'
try {
    $points = @(Get-ComputerRestorePoint -ErrorAction Stop)
    Write-Output "Readable restore points: $($points.Count)"
    $points | Sort-Object SequenceNumber -Descending | Select-Object -First 10 SequenceNumber,CreationTime,RestorePointType | Format-Table -AutoSize | Out-String | Write-Output
} catch { Write-Output "Restore-provider error: $($_.Exception.ToString())" }
Write-Output 'Starting VSS writer diagnostics'
& "$env:SystemRoot\System32\vssadmin.exe" list writers
Write-Output "VSS diagnostic exit code: $LASTEXITCODE"
Write-Output 'Starting read-only WMI repository verification'
& "$env:SystemRoot\System32\wbem\winmgmt.exe" /verifyrepository
Write-Output "WMI verification exit code: $LASTEXITCODE"
'@
    $probeOut = Join-Path $logDirectory "$phase-provider.txt"
    $probeErr = Join-Path $logDirectory "$phase-provider-errors.txt"
    try {
        $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($probeSource))
        $probe = Start-Process -FilePath "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -ArgumentList @('-NoProfile','-NonInteractive','-EncodedCommand',$encoded) -WindowStyle Hidden -RedirectStandardOutput $probeOut -RedirectStandardError $probeErr -PassThru -ErrorAction Stop
        if (-not $probe.WaitForExit(20000)) {
            $probe.Kill()
            $probe.WaitForExit()
            Write-Output 'Provider diagnostics timed out after 20 seconds; no provider reset was attempted.'
        }
        if (Test-Path -LiteralPath $probeOut) { Get-Content -LiteralPath $probeOut -ErrorAction Stop | Write-Output }
        if (Test-Path -LiteralPath $probeErr) { Get-Content -LiteralPath $probeErr -ErrorAction Stop | Write-Output }
    } catch { Write-Output "Could not complete provider diagnostics: $($_.Exception.Message)" }
}
try {
    try { Write-SystemDiagnostics 'Before' } catch { Write-Output "Before-diagnostics error: $($_.Exception.Message)" }
    Write-Output 'DISM: repairing the Windows component store. Internet access may be required.'
    $stepStarted = Get-Date
    & "$env:SystemRoot\System32\dism.exe" /Online /Cleanup-Image /RestoreHealth
    $dismExit = $LASTEXITCODE
    Write-Output "DISM exit code: $dismExit"
    Write-Output "DISM exit hex: 0x$([Convert]::ToString([int]$dismExit,16)); duration: $([int]((Get-Date) - $stepStarted).TotalSeconds) seconds"
    if ($dismExit -notin @(0,3010)) { $failed = $true }
    Write-Output 'SFC: checking and repairing protected Windows system files.'
    $stepStarted = Get-Date
    & "$env:SystemRoot\System32\sfc.exe" /scannow
    $sfcExit = $LASTEXITCODE
    Write-Output "SFC exit code: $sfcExit"
    Write-Output "SFC duration: $([int]((Get-Date) - $stepStarted).TotalSeconds) seconds"
    if ($sfcExit -ne 0) { $failed = $true }
    try { Write-SystemDiagnostics 'After' } catch { Write-Output "After-diagnostics error: $($_.Exception.Message)" }
} catch {
    $failed = $true
    Write-Output "Repair exception: $($_.Exception.ToString())"
    Write-Output "Failure location: $($_.InvocationInfo.PositionMessage)"
    Write-Output "PowerShell stack: $($_.ScriptStackTrace)"
} finally {
    Write-Output "=== Repair summary ==="
    Write-Output "DISM exit code: $(if ($null -eq $dismExit) { 'not completed' } else { $dismExit })"
    Write-Output "SFC exit code: $(if ($null -eq $sfcExit) { 'not completed' } else { $sfcExit })"
    Write-Output "Repair failed: $failed"
    Write-Output "Started: $($repairStarted.ToString('o')); finished: $((Get-Date).ToString('o'))"
    Write-Output 'A successful command exit does not prove the PC is healthy. Read SFC findings and servicing errors below.'
    foreach ($source in @("$env:SystemRoot\Logs\CBS\CBS.log", "$env:SystemRoot\Logs\DISM\dism.log")) {
        Write-Output "=== Relevant servicing findings since this repair started: $source ==="
        Write-Output 'Bounded excerpt: examines last 20000 lines; shows up to 500 matching entries. Earlier findings may have been repaired later; compare timestamps and final SFC result.'
        try {
            $findings = @(Get-Content -LiteralPath $source -Tail 20000 -ErrorAction Stop | Where-Object {
                $line = $_
                $timestamp = [DateTime]::MinValue
                $recent = $line.Length -ge 19 -and [DateTime]::TryParse($line.Substring(0,19), [ref]$timestamp) -and $timestamp -ge $repairStarted.AddSeconds(-2)
                $recent -and $line -match '\[SR\]|cannot repair|cannot fix|corrupt|missing|failed|error|0x800|0xC00'
            } | Select-Object -Last 500)
            if ($findings.Count) { $findings | Write-Output }
            else { Write-Output 'No matching recent entries in the bounded excerpt. This is not proof that no corruption exists.' }
        } catch { Write-Output "Could not read servicing findings: $($_.Exception.Message)" }
        Write-Output "=== Last 300 lines: $source ==="
        try { Get-Content -LiteralPath $source -Tail 300 -ErrorAction Stop | Write-Output }
        catch { Write-Output "Could not read repair-log excerpt: $($_.Exception.Message)" }
    }
    Write-Output '=== Recent System errors and warnings (up to 50, last two hours) ==='
    try {
        Get-WinEvent -FilterHashtable @{LogName='System'; Level=@(1,2,3); StartTime=$repairStarted.AddHours(-2)} -MaxEvents 50 -ErrorAction Stop |
            Select-Object TimeCreated,Id,ProviderName,LevelDisplayName,Message | Format-List | Out-String -Width 240 | Write-Output
    } catch { Write-Output "System events unavailable or no matching events: $($_.Exception.Message)" }
    Write-Output "Repair log: $log"
    Write-Output 'Review the DISM/SFC output above and CBS.log/DISM.log for unresolved corruption. A clean exit alone does not prove every Windows problem is fixed.'
    Write-Output 'Restart your PC, then retry the Opti Gods launch checkpoint.'
    try { Stop-Transcript | Out-Null } catch { Write-Output "Could not close transcript: $($_.Exception.Message)" }
}
if ($failed) { exit 1 }
exit 0
