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
Start-Transcript -Path $log -Force | Out-Null
function Write-SystemDiagnostics([string]$phase) {
    Write-Output "=== $phase diagnostics ==="
    $os = Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion' -ErrorAction Stop
    Write-Output "Windows: $($os.ProductName); edition=$($os.EditionID); version=$($os.DisplayVersion); build=$($os.CurrentBuildNumber).$($os.UBR)"
    Write-Output "Elevated: $($principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)); 64-bit process=$([Environment]::Is64BitProcess)"
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
    & "$env:SystemRoot\System32\dism.exe" /Online /Cleanup-Image /RestoreHealth
    $dismExit = $LASTEXITCODE
    Write-Output "DISM exit code: $dismExit"
    if ($dismExit -notin @(0,3010)) { $failed = $true }
    Write-Output 'SFC: checking and repairing protected Windows system files.'
    & "$env:SystemRoot\System32\sfc.exe" /scannow
    $sfcExit = $LASTEXITCODE
    Write-Output "SFC exit code: $sfcExit"
    if ($sfcExit -ne 0) { $failed = $true }
    try { Write-SystemDiagnostics 'After' } catch { Write-Output "After-diagnostics error: $($_.Exception.Message)" }
    foreach ($source in @("$env:SystemRoot\Logs\CBS\CBS.log", "$env:SystemRoot\Logs\DISM\dism.log")) {
        Write-Output "=== Last 100 lines: $source ==="
        try { Get-Content -LiteralPath $source -Tail 100 -ErrorAction Stop | Write-Output }
        catch { Write-Output "Could not read repair-log excerpt: $($_.Exception.Message)" }
    }
    Write-Output "Repair log: $log"
    Write-Output 'Review the DISM/SFC output above and CBS.log/DISM.log for unresolved corruption. A clean exit alone does not prove every Windows problem is fixed.'
    Write-Output 'Restart your PC, then retry the Opti Gods launch checkpoint.'
} finally {
    Stop-Transcript | Out-Null
}
if ($failed) { exit 1 }
exit 0
