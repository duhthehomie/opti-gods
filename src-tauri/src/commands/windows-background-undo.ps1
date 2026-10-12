$ErrorActionPreference = 'Stop'
$backupPath = Join-Path $env:ProgramData 'OptiGods\background-debloat-before.json'
if (-not (Test-Path -LiteralPath $backupPath)) { throw 'No saved background-debloat baseline exists on this PC.' }
$backup = Get-Content -LiteralPath $backupPath -Raw | ConvertFrom-Json -ErrorAction Stop
$names = @('DiagTrack','MapsBroker','RetailDemo','Fax','WMPNetworkSvc','PhoneSvc','RemoteRegistry','WerSvc','wercplsupport','AJRouter','dmwappushservice','diagnosticshub.standardcollector.service','MessagingService','WalletService','SharedRealitySvc','AssignedAccessManagerSvc','AppVClient','PushToInstall')
foreach ($name in $names) {
    $entries = @($backup.Services | Where-Object { $_.Name -eq $name })
    if (-not $entries.Count) { continue }
    $entry = $entries[0]
    if (-not (Get-Service -Name $name -ErrorAction Ignore)) { Write-Output "[INFO] $name is no longer installed; no service was recreated."; continue }
    $mode = switch ($entry.Mode) { 'Auto' { 'Automatic' }; 'Manual' { 'Manual' }; 'Disabled' { 'Disabled' }; default { throw "Invalid saved startup mode for $name." } }
    Set-Service -Name $name -StartupType $mode -ErrorAction Stop
    if ((Get-Service -Name $name -ErrorAction Stop).StartType.ToString() -ne $mode) { throw "Startup restore failed for $name." }
    if ($entry.Running -eq $true -and $mode -ne 'Disabled') { Start-Service -Name $name -ErrorAction Stop }
    Write-Output "[OK] $name restored to its saved startup configuration."
}
# Fixed targets only: untrusted backup contents cannot supply registry paths.
$targets = @(
    @{ Path='HKCU:\Software\Microsoft\Windows\CurrentVersion\BackgroundAccessApplications'; Name='GlobalUserDisabled' },
    @{ Path='HKLM:\SOFTWARE\Policies\Microsoft\Windows\CloudContent'; Name='DisableWindowsConsumerFeatures' }
)
foreach ($target in $targets) {
    $entries = @($backup.Settings | Where-Object { $_.Path -eq $target.Path -and $_.Name -eq $target.Name })
    if (-not $entries.Count) { throw "Saved policy baseline missing: $($target.Name)" }
    $entry = $entries[0]
    if ($entry.Exists -eq $true) {
        if ($entry.Value -notin @(0,1)) { throw 'Invalid saved background policy value.' }
        New-Item -Path $target.Path -Force -ErrorAction Stop | Out-Null
        New-ItemProperty -LiteralPath $target.Path -Name $target.Name -Value ([int]$entry.Value) -PropertyType DWord -Force -ErrorAction Stop | Out-Null
        if ((Get-ItemPropertyValue -LiteralPath $target.Path -Name $target.Name) -ne $entry.Value) { throw 'Policy restore readback failed.' }
    } else {
        if (Test-Path -LiteralPath $target.Path) {
            $properties = Get-ItemProperty -LiteralPath $target.Path -ErrorAction Stop
            if ($properties.PSObject.Properties.Name -contains $target.Name) { Remove-ItemProperty -LiteralPath $target.Path -Name $target.Name -ErrorAction Stop }
        }
    }
}
Remove-Item -LiteralPath $backupPath -ErrorAction Stop
Write-Output '[OK] Saved background settings restored. Optional applications were not deleted by this service pass. Restart Windows for the full startup effect.'
