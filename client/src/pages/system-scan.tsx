      `    } catch {}`,
      `}`,
      `$result.cpu_temp_c = $cpuTemp`,
      `$result.cpu_temp_note = if ($cpuTemp) { "OK" } else { "AMD Ryzen desktop — use HWiNFO64 for accurate readings." }`,
      ``,
      `# CPU Info & Load`,
      `try {`,
      `    $cpu = Get-CimInstance Win32_Processor -EA SilentlyContinue | Select-Object -First 1`,
      `    if ($cpu) { $result.cpu_name=$cpu.Name.Trim(); $result.cpu_cores=$cpu.NumberOfCores; $result.cpu_threads=$cpu.NumberOfLogicalProcessors; $result.cpu_mhz=$cpu.MaxClockSpeed }`,
      `} catch {}`,
      `try {`,
      `    $ld = (Get-Counter '\\Processor(_Total)\\% Processor Time' -SampleInterval 1 -MaxSamples 1 -EA SilentlyContinue).CounterSamples[0].CookedValue`,
      `    if ($null -ne $ld) { $result.cpu_load_pct = [math]::Round($ld,1) }`,
      `} catch {}`,
      ``,
      `# RAM`,
      `try {`,
      `    $os2 = Get-CimInstance Win32_OperatingSystem -EA SilentlyContinue`,
      `    if ($os2) {`,
      `        $result.ram_total_gb = [math]::Round($os2.TotalVisibleMemorySize/1MB,1)`,
      `        $result.ram_free_gb  = [math]::Round($os2.FreePhysicalMemory/1MB,1)`,
      `        $result.ram_used_pct = [math]::Round(100*(1-$os2.FreePhysicalMemory/$os2.TotalVisibleMemorySize),1)`,
      `    }`,
      `} catch {}`,
      `try {`,
      `    $ramSpd = (((Get-WmiObject Win32_PhysicalMemory -EA SilentlyContinue) | ForEach-Object { [Math]::Max([int]$_.ConfiguredClockSpeed,[int]$_.Speed) }) | Measure-Object -Maximum).Maximum`,
      `    if ($ramSpd -gt 0) { $result.ram_mhz = [int]$ramSpd }`,
      `} catch {}`,
      ``,
      `# System model`,
      `try {`,
      `    $cs2 = Get-CimInstance Win32_ComputerSystem -EA SilentlyContinue`,
      `    if ($cs2) { $mfr2=$cs2.Manufacturer.Trim(); $mdl2=$cs2.Model.Trim(); $result.system_model = if($mdl2 -like "$mfr2 *" -or $mdl2 -eq $mfr2){$mdl2}else{"$mfr2 $mdl2".Trim()} }`,
      `} catch {}`,
      ``,
      `# Disks`,
      `try {`,
      `    $result.disks = @(Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" -EA SilentlyContinue | Select-Object -First 4 | ForEach-Object {`,
      `        [ordered]@{ drive=$_.DeviceID; free_gb=[math]::Round($_.FreeSpace/1GB,1); size_gb=[math]::Round($_.Size/1GB,1); used_pct=[math]::Round(100*(1-$_.FreeSpace/$_.Size),1) }`,
      `    })`,
      `} catch {}`,
      ``,
      `# Fans`,
      `$fanList = [System.Collections.Generic.List[object]]::new()`,
      `if ($null -ne $result.gpu_fan_pct) { $fanList.Add([ordered]@{ name="GPU Fan"; speed_pct=$result.gpu_fan_pct; speed_rpm=$null }) }`,
      `$ohmDone = $false`,
      `try {`,
      `    $ohmF = Get-WmiObject -Namespace "root\\OpenHardwareMonitor" -Class Sensor -EA SilentlyContinue | Where-Object { $_.SensorType -eq "Fan" }`,
      `    if ($ohmF) { foreach($s in @($ohmF)){$fanList.Add([ordered]@{name=$s.Name;speed_pct=$null;speed_rpm=[math]::Round($s.Value)})}; $ohmDone=$true }`,
      `} catch {}`,
      `if (-not $ohmDone) {`,
      `    try {`,
      `        $wf=@(Get-WmiObject Win32_Fan -EA SilentlyContinue); $pf=@(Get-WmiObject Win32_PnPEntity -Filter "PNPClass='Fan'" -EA SilentlyContinue)`,
      `        $seen=[System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)`,
      `        foreach($f in ($wf+$pf)){$n=if($f.Name){$f.Name}else{"Fan"}; if($seen.Add($n)){$rpm=if($f.PSObject.Properties['DesiredSpeed']-and $f.DesiredSpeed-gt 0){[int]$f.DesiredSpeed}else{$null}; $fanList.Add([ordered]@{name=$n;speed_pct=$null;speed_rpm=$rpm})}}`,
      `    } catch {}`,
      `}`,
      `# Fan fallback 2 — LibreHardwareMonitor WMI namespace (broader driver support than OHM)`,
      `if (-not $ohmDone) {`,
      `    try {`,
      `        $lhm = Get-WmiObject -Namespace "root\\LibreHardwareMonitor" -Class Sensor -EA SilentlyContinue | Where-Object { $_.SensorType -eq "Fan" }`,
      `        if ($lhm) {`,
      `            $lhmSeen=[System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)`,
      `            foreach($s in @($lhm)){ if($lhmSeen.Add($s.Name)){ $fanList.Add([ordered]@{name=$s.Name;speed_pct=$null;speed_rpm=[math]::Round($s.Value)}) } }`,
      `            $ohmDone=$true`,
      `        }`,
      `    } catch {}`,
      `}`,
      `# Fan fallback 3 — ACPI FAN* registry nodes (correct count even without RPM, works on most BIOS)`,
      `# ALWAYS run: GPU fan (nvidia-smi) and board fans (CPU_FAN/CHA_FAN headers) are separate devices.`,
      `# Only skip ACPI fans that are already covered by OHM/Win32_Fan (compare non-GPU fan count).`,
      `$gpuFanInList = @($fanList | Where-Object { $_.name -eq 'GPU Fan' }).Count`,
      `$nonGpuInList = $fanList.Count - $gpuFanInList`,
      `try {`,
      `    $acpiFans = @(Get-ChildItem 'HKLM:\\SYSTEM\\CurrentControlSet\\Enum\\ACPI' -EA SilentlyContinue | Where-Object { $_.PSChildName -match '^FAN' })`,
      `    if ($acpiFans.Count -gt $nonGpuInList) {`,
      `        $fi = $nonGpuInList + 1`,
      `        $toAdd = $acpiFans.Count - $nonGpuInList`,
      `        for ($ai = 0; $ai -lt $toAdd; $ai++) { $fanList.Add([ordered]@{name=("Fan "+[string]$fi);speed_pct=$null;speed_rpm=$null}); $fi++ }`,
      `    }`,
      `} catch {}`,
      `if ($fanList.Count -gt 0) { $result.fans = $fanList.ToArray() }`,
      `$result.fan_count = $fanList.Count`,
      `$result.timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"`,
      ``,
      `# Desktop path — robust chain (works with OneDrive redirect, works non-elevated)`,
      `$desktop = $null`,
      `try {`,
      `    $rv = (Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders' -EA SilentlyContinue).Desktop`,
      `    if ($rv) { $desktop = [Environment]::ExpandEnvironmentVariables($rv) }`,
      `} catch {}`,
      `if (-not $desktop -or -not (Test-Path $desktop -PathType Container)) {`,
      `    try { $desktop = [Environment]::GetFolderPath('Desktop') } catch {}`,
      `}`,
      `if (-not $desktop -or -not (Test-Path $desktop -PathType Container)) {`,
      `    $desktop = Join-Path $env:USERPROFILE 'Desktop'`,
      `}`,
      ``,
      `# Collision-safe filename`,
      `$baseName = 'OptiGods-HW-Monitor'`,
      `$outPath  = Join-Path $desktop ($baseName + '.json')`,
      `$n = 2`,
      `while (Test-Path $outPath) { $outPath = Join-Path $desktop ($baseName + '_' + $n + '.json'); $n++ }`,
      ``,
      `# Write JSON`,
      `$json = $result | ConvertTo-Json -Depth 5`,
      `[IO.File]::WriteAllText($outPath, $json, [Text.Encoding]::UTF8)`,
      `$fname = Split-Path $outPath -Leaf`,
      ``,
      `# Results`,
      `Write-Host "  GPU       : $(if ($result.gpu_name) { $result.gpu_name } else { 'N/A' })" -ForegroundColor White`,
      `Write-Host "  GPU Temp  : $(if ($null -ne $result.gpu_temp_c) { [string]$result.gpu_temp_c + ' C' } else { 'N/A' })" -ForegroundColor Cyan`,
      `Write-Host "  GPU Fan   : $(if ($null -ne $result.gpu_fan_pct) { [string]$result.gpu_fan_pct + '%' } else { 'N/A' })" -ForegroundColor Cyan`,
      `Write-Host "  CPU Temp  : $(if ($cpuTemp) { [string]$cpuTemp + ' C' } else { 'N/A  (AMD Ryzen desktop)' })" -ForegroundColor Cyan`,
      `Write-Host "  CPU Load  : $(if ($null -ne $result.cpu_load_pct) { [string]$result.cpu_load_pct + '%' } else { 'N/A' })" -ForegroundColor Cyan`,
      `Write-Host "  RAM Used  : $(if ($null -ne $result.ram_used_pct) { [string]$result.ram_used_pct + '%' } else { 'N/A' })" -ForegroundColor Cyan`,
      `Write-Host "  Fans      : $(if ($result.fan_count -gt 0) { [string]$result.fan_count + ' detected' } else { 'N/A' })" -ForegroundColor Cyan`,
      `Write-Host ""`,
      `Write-Host "  ================================================" -ForegroundColor DarkGray`,
      `Write-Host "  $fname has been placed on your Desktop." -ForegroundColor Green`,
      `Write-Host "  Drag it onto the Opti Gods System Scan tab to import." -ForegroundColor Yellow`,
      `Write-Host "  ================================================" -ForegroundColor DarkGray`,
      `Write-Host ""`,
    ];

    const ps1 = ps1Lines.join('\r\n');
    const marker = '##HW_MONITOR_PS1_START##';
    // Marker is split in the PS command so the BAT doesn't match itself during extraction
    const markerSearchPs = `'##HW_MONITOR_P'+'S1_START##'`;

    const batLines = [
      `@echo off`,
      `setlocal`,
      `set "SELF=%~f0"`,
      `set "TMPPS1=%TEMP%\\OptiGods-HW-Monitor.ps1"`,
      ``,
      `title Opti Gods by leaq  --  Hardware Monitor`,
      ``,
      `:: Self-copy to Desktop on first run so user can re-run anytime`,
      `PowerShell -NoProfile -ExecutionPolicy Bypass -Command ^`,
      `  "$d=$null;try{$r=(Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders' -EA SilentlyContinue).Desktop;if($r){$d=[Environment]::ExpandEnvironmentVariables($r)}}catch{};if(-not $d -or -not(Test-Path $d)){try{$d=[Environment]::GetFolderPath('Desktop')}catch{}};if(-not $d -or -not(Test-Path $d)){$d=Join-Path $env:USERPROFILE 'Desktop'};$dst=Join-Path $d 'OptiGods-HW-Monitor.bat';if(-not(Test-Path $dst)){Copy-Item $env:SELF $dst -Force -EA SilentlyContinue}"`,
      ``,
      `:: Opti Gods website shortcut (.url) on Desktop`,
      `PowerShell -NoProfile -ExecutionPolicy Bypass -Command ^`,
      `  "$d=$null;try{$r=(Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders' -EA SilentlyContinue).Desktop;if($r){$d=[Environment]::ExpandEnvironmentVariables($r)}}catch{};if(-not $d -or -not(Test-Path $d)){try{$d=[Environment]::GetFolderPath('Desktop')}catch{}};if(-not $d -or -not(Test-Path $d)){$d=Join-Path $env:USERPROFILE 'Desktop'};$dst=Join-Path $d 'Opti Gods.url';if(-not(Test-Path $dst)){[IO.File]::WriteAllText($dst,[char]91+'InternetShortcut'+[char]93+[char]13+[char]10+'URL=https://optigods.com'+[char]13+[char]10,[Text.Encoding]::ASCII)}"`,
      ``,
      `:: Extract embedded PS1`,
      `PowerShell -NoProfile -ExecutionPolicy Bypass -Command "$c=[IO.File]::ReadAllText($env:SELF,[Text.Encoding]::UTF8);$m=${markerSearchPs};$i=$c.IndexOf($m);if($i -ge 0){[IO.File]::WriteAllText($env:TMPPS1,$c.Substring($i+$m.Length),[Text.Encoding]::UTF8)}"`,
      ``,
      `if not exist "%TMPPS1%" (`,
      `  echo  [ERROR] Extraction failed. Re-download the BAT from the app.`,
      `  pause`,
      `  exit /b 1`,
      `)`,
      ``,
      `PowerShell -NoProfile -ExecutionPolicy Bypass -File "%TMPPS1%"`,
      `del "%TMPPS1%" 2>nul`,
      `echo.`,
      `pause`,
      `exit /b 0`,
      marker,
      ps1,
    ];

    const content = batLines.join('\r\n');
    const blob = new Blob([content], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "OptiGods-HW-Monitor.bat";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast({
      title: "Hardware scan script downloaded",
      description: "Run OptiGods-HW-Monitor.bat, then drag the JSON it drops on your Desktop back here.",
    });
  };

  const tempColor = (c: number) => c < 60 ? "text-emerald-400" : c < 80 ? "text-amber-400" : "text-red-400";
  const usedColor = (pct: number) => pct < 60 ? "text-emerald-400" : pct < 80 ? "text-amber-400" : "text-red-400";

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
      className="rounded-xl border border-white/5 bg-zinc-900/60 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Thermometer className="w-4 h-4 text-red-400" />
          <span className="text-sm font-bold text-white">Live Hardware Monitor</span>
          {hw
            ? <span className="text-[10px] text-emerald-500/80">Data saved — drag again to refresh</span>
            : <span className="text-[10px] text-zinc-500">Download BAT → run it → drag the JSON here</span>
          }
        </div>
        <div className="flex items-center gap-2">
          {hw && (
            <button onClick={() => { try { localStorage.removeItem(HW_MONITOR_KEY); } catch {} setHw(null); onData?.(null as unknown as HwMonitorData); }} className="p-1 rounded text-zinc-600 hover:text-zinc-400 transition-colors" title="Clear saved data">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            data-testid="button-download-hw-monitor"
            onClick={downloadBat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 border border-red-500/60 text-white text-xs font-bold uppercase tracking-wider transition-colors">
            <Download className="w-3.5 h-3.5" /> Download BAT
          </button>
        </div>
      </div>

      {!hw ? (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={cn(
            "m-3 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-2 py-8 cursor-pointer transition-all",
            dragging ? "border-red-500/60 bg-red-500/5" : "border-white/10 hover:border-white/20 hover:bg-white/[0.02]"
          )}>
          <input ref={fileRef} type="file" accept=".json" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) parseFile(f); }} />
          <Upload className="w-5 h-5 text-zinc-600" />
          <p className="text-[11px] text-zinc-500 text-center px-6">
            Drag <span className="font-mono text-zinc-400">OptiGods-HW-Monitor.json</span> here — saved to localStorage permanently
          </p>
          <p className="text-[10px] text-zinc-600 text-center px-6">Download the BAT above, run it once, drag the JSON — done forever</p>
          {parseError && <p className="text-[10px] text-red-400">{parseError}</p>}
        </div>
      ) : (
        <div className="p-3 space-y-3">
          {hw.timestamp && (
            <p className="text-[10px] text-zinc-600">Snapshot: {hw.timestamp}</p>
          )}
          {hw.system_model && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/5 bg-zinc-900/60">
              <MonitorCheck className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 shrink-0">My PC</span>
              <span className="text-white text-xs font-semibold truncate">{hw.system_model}</span>
            </div>
          )}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {hw.gpu_name && (
              <div className="p-3 rounded-lg border border-white/5 bg-zinc-950/40">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1 flex items-center gap-1"><MonitorPlay className="w-3 h-3" /> GPU</p>
                <p className="text-white font-mono text-xs font-semibold truncate">{hw.gpu_name}</p>
                {hw.gpu_vram_total_mb && <p className="text-zinc-500 text-[10px]">{Math.round(hw.gpu_vram_total_mb / 1024)} GB VRAM</p>}
              </div>
            )}
            {hw.gpu_temp_c != null && (
              <div className="p-3 rounded-lg border border-white/5 bg-zinc-950/40">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1 flex items-center gap-1"><Thermometer className="w-3 h-3" /> GPU Temp</p>
                <p className={cn("font-mono text-lg font-black", tempColor(hw.gpu_temp_c))}>
                  <AnimatedNum value={hw.gpu_temp_c} suffix="°C" />
                </p>
                {hw.gpu_load_pct != null && (
                  <p className="text-zinc-500 text-[10px]"><AnimatedNum value={hw.gpu_load_pct} suffix="%" /> load</p>
                )}
              </div>
            )}
            {hw.gpu_fan_pct != null && (
              <div className="p-3 rounded-lg border border-white/5 bg-zinc-950/40">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1 flex items-center gap-1"><Wind className="w-3 h-3" /> GPU Fan</p>
                <p className="font-mono text-lg font-black text-white">
                  <AnimatedNum value={hw.gpu_fan_pct} suffix="%" />
                </p>
              </div>
            )}
            {hw.cpu_temp_c != null ? (
              <div className="p-3 rounded-lg border border-white/5 bg-zinc-950/40">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1 flex items-center gap-1"><Cpu className="w-3 h-3" /> CPU Temp</p>
                <p className={cn("font-mono text-lg font-black", tempColor(hw.cpu_temp_c))}>
                  <AnimatedNum value={hw.cpu_temp_c} suffix="°C" />
                </p>
                {hw.cpu_load_pct != null && (
                  <p className="text-zinc-500 text-[10px]"><AnimatedNum value={hw.cpu_load_pct} suffix="%" /> load</p>
                )}
              </div>
            ) : (
              <div className="p-3 rounded-lg border border-amber-500/10 bg-amber-500/[0.03]">
                <p className="text-[10px] uppercase tracking-wider text-amber-500/70 mb-1 flex items-center gap-1"><Cpu className="w-3 h-3" /> CPU Temp</p>
                <p className="text-amber-400 font-mono text-xs font-bold">N/A</p>
                <p className="text-[9px] text-zinc-600 mt-0.5">AMD Ryzen desktop — ACPI not exposed. Use HWiNFO64.</p>
              </div>
            )}
            {hw.ram_used_pct != null && (
              <div className="p-3 rounded-lg border border-white/5 bg-zinc-950/40">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1 flex items-center gap-1"><MemoryStick className="w-3 h-3" /> RAM</p>
                <p className={cn("font-mono text-lg font-black", usedColor(hw.ram_used_pct))}>
                  <AnimatedNum value={hw.ram_used_pct} suffix="%" />
                </p>
                {hw.ram_total_gb && hw.ram_free_gb != null && (
                  <p className="text-zinc-500 text-[10px]">{hw.ram_free_gb} GB free / {hw.ram_total_gb} GB
                    {hw.ram_mhz && hw.ram_mhz > 0 ? ` · ${hw.ram_mhz} MHz` : ""}
                  </p>
                )}
              </div>
            )}
          </div>
          {hw.fans && hw.fans.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
                Fans detected: {hw.fan_count ?? hw.fans.length}
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {hw.fans.map((f, i) => (
                  <div key={i} className="p-3 rounded-lg border border-white/5 bg-zinc-950/40">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1 flex items-center gap-1">
                      <Wind className="w-3 h-3" /> Fan {i + 1}
                    </p>
                    <p className="text-white font-mono text-xs font-semibold truncate">{f.name}</p>
                    {f.speed_rpm != null && f.speed_rpm > 0 ? (
                      <p className="text-zinc-500 text-[10px]">
                        <AnimatedNum value={f.speed_rpm} /> RPM
                      </p>
                    ) : f.speed_pct != null ? (
                      <p className="text-zinc-500 text-[10px]">
                        <AnimatedNum value={f.speed_pct} suffix="%" />
                      </p>
                    ) : (
                      <p className="text-zinc-600 text-[10px]">Speed not exposed via WMI</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {hw.disks && hw.disks.length > 0 && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {hw.disks.map(d => (
                <div key={d.drive} className="p-3 rounded-lg border border-white/5 bg-zinc-950/40">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1 flex items-center gap-1"><HardDrive className="w-3 h-3" /> {d.drive}</p>
                  <p className={cn("font-mono text-base font-black", usedColor(d.used_pct))}>{d.used_pct}%</p>
                  <p className="text-zinc-500 text-[10px]">{d.free_gb} GB free / {d.size_gb} GB</p>
                </div>
              ))}
            </div>
          )}
          {hw.cpu_temp_note && hw.cpu_temp_c == null && (
            <p className="text-[10px] text-zinc-600 flex items-start gap-1.5">
              <AlertTriangle className="w-3 h-3 text-amber-500/60 shrink-0 mt-0.5" />
              {hw.cpu_temp_note}
            </p>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ── Live Monitor Panel ────────────────────────────────────────────────────────
export function LiveMonitorPanel() {
  const hw = useHardwareInfo();
  const stats = useLiveStats(hw.ramGB);
  const { toast } = useToast();

  const downloadLiveBat = () => {
    const postUrl = apiUrl('/api/hw-live');
    const markerKey = '##LIVE_MONITOR_PS1##';
    const markerSearchPs = `'##LIVE_MON'+'ITOR_PS1##'`;

    const ps1Lines = [
      `$ErrorActionPreference = 'SilentlyContinue'`,
      `$postUrl = '${postUrl}'`,
      `$startedAt = Get-Date`,
      `$samples = New-Object 'System.Collections.Generic.List[object]'`,
      `$stopRequested = $false`,
      ``,
      `Write-Host ""`,
      `Write-Host "  Opti Gods -- Live Hardware Monitor" -ForegroundColor Red`,
      `Write-Host "  Posts real-time CPU/GPU/RAM stats to: $postUrl" -ForegroundColor DarkGray`,
      `Write-Host "  Press Q or Esc to stop and save a JSON log to your Desktop." -ForegroundColor Yellow`,
      `Write-Host "  Ctrl+C also runs the save cleanup." -ForegroundColor DarkGray`,
      `Write-Host ""`,
      ``,
      `# Locate nvidia-smi`,
      `$smiExe = $null`,
      `$smiCmd = Get-Command "nvidia-smi.exe" -EA SilentlyContinue`,
      `if ($smiCmd) { $smiExe = $smiCmd.Source }`,
      `else { @("$env:SystemRoot\\System32\\nvidia-smi.exe","C:\\Windows\\System32\\nvidia-smi.exe","$env:ProgramFiles\\NVIDIA Corporation\\NVSMI\\nvidia-smi.exe") | ForEach-Object { if (!$smiExe -and (Test-Path $_)) { $smiExe = $_ } } }`,
      `if ($smiExe) { Write-Host "  [NVIDIA] nvidia-smi found: $smiExe" -ForegroundColor Green }`,
      `else { Write-Host "  [INFO] nvidia-smi not found — GPU load/temp will be omitted (NVIDIA driver not installed or GTX card)" -ForegroundColor DarkGray }`,
      `Write-Host ""`,
      ``,
      `try {`,
      `while (-not $stopRequested) {`,
      `  $d = @{}`,
      `  # GPU`,
      `  if ($smiExe) {`,
      `    $raw = (& $smiExe --query-gpu=temperature.gpu --format=csv,noheader 2>$null).Trim()`,
      `    if ($raw -match '^\\d+$') { $d.gpu_temp_c = [int]$raw }`,
      `    $raw = (& $smiExe --query-gpu=utilization.gpu --format=csv,noheader,nounits 2>$null).Trim()`,
      `    if ($raw -match '^\\d+$') { $d.gpu_load_pct = [int]$raw }`,
      `  }`,
      `  # CPU load`,
      `  try {`,
      `    $ld = (Get-Counter '\\Processor(_Total)\\% Processor Time' -SampleInterval 1 -MaxSamples 1 -EA SilentlyContinue).CounterSamples[0].CookedValue`,
      `    if ($null -ne $ld) { $d.cpu_load_pct = [math]::Round($ld,1) }`,
      `  } catch {}`,
      `  # CPU temp (ACPI / OHM / LHM)`,
      `  $cpuT = $null`,
      `  try { $z = Get-WmiObject -Namespace "root\\wmi" -Class MSAcpi_ThermalZoneTemperature -EA SilentlyContinue; if ($z) { $temps = $z | ForEach-Object { [math]::Round($_.CurrentTemperature/10-273.15,1) } | Where-Object { $_ -gt 5 -and $_ -lt 120 }; if ($temps) { $cpuT = ($temps | Measure-Object -Maximum).Maximum } } } catch {}`,
      `  if (-not $cpuT) { try { $ohm = Get-WmiObject -Namespace "root\\OpenHardwareMonitor" -Class Sensor -EA SilentlyContinue | Where-Object { $_.SensorType -eq "Temperature" -and $_.Name -match "CPU Package|CPU Core|Tdie|CPU CCD" }; if ($ohm) { $v=($ohm|Measure-Object -Property Value -Maximum).Maximum; if($v-gt 5 -and $v-lt 120){$cpuT=[math]::Round($v,1)} } } catch {} }`,
      `  if (-not $cpuT) { try { $lhm = Get-WmiObject -Namespace "root\\LibreHardwareMonitor" -Class Sensor -EA SilentlyContinue | Where-Object { $_.SensorType -eq "Temperature" -and $_.Name -match "CPU Package|Core|Tdie" }; if ($lhm) { $v=($lhm|Measure-Object -Property Value -Maximum).Maximum; if($v-gt 5 -and $v-lt 120){$cpuT=[math]::Round($v,1)} } } catch {} }`,
      `  if ($null -ne $cpuT) { $d.cpu_temp_c = $cpuT }`,
      `  # RAM`,
      `  try { $os2 = Get-CimInstance Win32_OperatingSystem -EA SilentlyContinue; if ($os2) { $d.ram_total_gb=[math]::Round($os2.TotalVisibleMemorySize/1MB,1); $d.ram_free_gb=[math]::Round($os2.FreePhysicalMemory/1MB,1); $d.ram_used_pct=[math]::Round(100*(1-$os2.FreePhysicalMemory/$os2.TotalVisibleMemorySize),1) } } catch {}`,
      `  $d.timestamp = (Get-Date).ToString('o')`,
      `  $samples.Add($d)`,
      `  # POST to Opti Gods`,
      `  $json = $d | ConvertTo-Json -Compress`,
      `  try { Invoke-WebRequest -Uri $postUrl -Method POST -Body $json -ContentType 'application/json' -UseBasicParsing -TimeoutSec 3 | Out-Null } catch {}`,
      `  for ($wait = 0; $wait -lt 20; $wait++) {`,
      `    try {`,
      `      if ([Console]::KeyAvailable) {`,
      `        $key = [Console]::ReadKey($true)`,
      `        if ($key.KeyChar -eq 'q' -or $key.Key -eq 'Escape') { $stopRequested = $true; break }`,
      `      }`,
      `    } catch {}`,
      `    Start-Sleep -Milliseconds 100`,
      `  }`,
      `}`,
      `} finally {`,
      `  try {`,
      `    $desktop = [Environment]::GetFolderPath('Desktop')`,
      `    $stamp = (Get-Date).ToString('yyyyMMdd-HHmmss')`,
      `    $outPath = Join-Path $desktop ("OptiGods-Live-Monitor-" + $stamp + ".json")`,
      `    $log = [ordered]@{`,
      `      schema_version = 1`,
      `      recorder = "Opti Gods Live Hardware Monitor"`,
      `      started_at = $startedAt.ToString('o')`,
      `      stopped_at = (Get-Date).ToString('o')`,
      `      interval_seconds = 2`,
      `      sample_count = $samples.Count`,
      `      samples = @($samples.ToArray())`,
      `    }`,
      `    [IO.File]::WriteAllText($outPath, ($log | ConvertTo-Json -Depth 6))`,
      `    Write-Host ""`,
      `    Write-Host "  [OK] JSON recording saved: $outPath" -ForegroundColor Green`,
      `    Write-Host "  Samples: $($samples.Count)" -ForegroundColor DarkGray`,
      `  } catch { Write-Host "  [ERROR] Could not save the JSON log: $_" -ForegroundColor Red }`,
      `}`,
    ].join('\r\n');

    const batLines = [
      `@echo off`,
      `setlocal`,
      `set "SELF=%~f0"`,
      `set "TMPPS1=%TEMP%\\OptiGods-Live-Monitor.ps1"`,
      `set "DESKTOP=%USERPROFILE%\\Desktop"`,
      `title Opti Gods -- Live Hardware Monitor`,
      `:: Copy to Desktop for easy re-use (only if not already there)`,
      `if not exist "%DESKTOP%\\OptiGods-Live-Monitor.bat" (`,
      `  copy "%SELF%" "%DESKTOP%\\OptiGods-Live-Monitor.bat" >nul 2>&1`,
      `  if not errorlevel 1 echo [OK] Saved to Desktop for quick re-use.`,
      `)`,
      `PowerShell -NoProfile -ExecutionPolicy Bypass -Command "$c=[IO.File]::ReadAllText($env:SELF,[Text.Encoding]::UTF8);$m=${markerSearchPs};$i=$c.IndexOf($m);if($i -ge 0){[IO.File]::WriteAllText($env:TMPPS1,$c.Substring($i+$m.Length),[Text.Encoding]::UTF8)}"`,
      `if not exist "%TMPPS1%" (echo [ERROR] Extraction failed & pause & exit /b 1)`,
      `PowerShell -NoProfile -ExecutionPolicy Bypass -File "%TMPPS1%"`,
      `del "%TMPPS1%" 2>nul`,
      `exit /b 0`,
      markerKey,
      ps1Lines,
    ].join('\r\n');

    const blob = new Blob([batLines], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "OptiGods-Live-Monitor.bat";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast({ title: "Live Monitor downloaded", description: "Press Q or Esc to stop; a time-series JSON log will be saved to your Desktop." });
  };

  const tempColor = (c: number) => c < 60 ? "text-emerald-400" : c < 80 ? "text-amber-400" : "text-red-400";

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
      className="rounded-xl border border-white/5 bg-zinc-900/60 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Radio className={cn("w-4 h-4", stats.isLive && !stats.isStale ? "text-emerald-400" : stats.isStale ? "text-amber-400" : "text-zinc-600")} />
          <span className="text-sm font-bold text-white">Live Monitor</span>
          {stats.isLive && !stats.isStale ? (
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          ) : stats.isStale ? (
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Paused
            </span>
          ) : (
            <span className="text-[10px] text-zinc-600">BAT not running</span>
          )}
        </div>
        <button
          data-testid="button-download-live-monitor"
          onClick={downloadLiveBat}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 border border-white/8 hover:border-white/15 text-zinc-300 text-[10px] font-bold uppercase tracking-wider transition-colors">
          <Download className="w-3 h-3" /> Download BAT
        </button>
      </div>

      {stats.isLive ? (
        <div className="p-3 grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <div className="p-3 rounded-lg border border-white/5 bg-zinc-950/40">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1 flex items-center gap-1"><Cpu className="w-3 h-3" /> CPU</p>
            <p className="font-mono text-lg font-black text-white">{stats.cpuUsage}%</p>
            {stats.cpuTemp != null && (
              <p className={cn("text-[10px]", tempColor(stats.cpuTemp))}>{stats.cpuTemp}°C</p>
            )}
          </div>
          <div className="p-3 rounded-lg border border-white/5 bg-zinc-950/40">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1 flex items-center gap-1"><MonitorPlay className="w-3 h-3" /> GPU</p>
            <p className="font-mono text-lg font-black text-white">{stats.gpuUsage}%</p>
            {stats.gpuTemp != null && (
              <p className={cn("text-[10px]", tempColor(stats.gpuTemp))}>{stats.gpuTemp}°C</p>
            )}
          </div>
          <div className="p-3 rounded-lg border border-white/5 bg-zinc-950/40">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1 flex items-center gap-1"><MemoryStick className="w-3 h-3" /> RAM</p>
            <p className="font-mono text-lg font-black text-white">{stats.ramPct}%</p>
            <p className="text-zinc-500 text-[10px]">{stats.ramUsedGB} / {stats.ramTotalGB} GB</p>
          </div>
          <div className={cn("p-3 rounded-lg border", stats.isStale ? "border-amber-500/10 bg-amber-500/[0.03]" : "border-emerald-500/10 bg-emerald-500/[0.03]")}>
            <p className={cn("text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1", stats.isStale ? "text-amber-500/70" : "text-emerald-500/70")}><Activity className="w-3 h-3" /> Status</p>
            {stats.isStale ? (
              <>
                <p className="text-amber-400 font-mono text-xs font-bold">Paused</p>
                <p className="text-zinc-600 text-[10px]">Last values shown</p>
              </>
            ) : (
              <>
                <p className="text-emerald-400 font-mono text-xs font-bold">Streaming</p>
                <p className="text-zinc-600 text-[10px]">Updates every 2s</p>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="p-4 flex items-start gap-3">
          <div className="p-2 rounded-lg bg-zinc-800/60 border border-white/5 shrink-0">
            <Download className="w-4 h-4 text-zinc-500" />
          </div>
          <div>
            <p className="text-sm text-zinc-300 font-medium mb-0.5">Real-time CPU / GPU / RAM stats</p>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Download the BAT above and run it while gaming. Press Q or Esc to stop and save the captured samples as a JSON log on your Desktop.
            </p>
            <p className="text-[10px] text-zinc-600 mt-1.5">
              Uses <span className="font-mono text-zinc-500">nvidia-smi</span> for GPU · WMI for CPU/RAM · ACPI/OHM for CPU temp
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function SystemScanPage() {
  const hw = useHardwareInfo();
  const os = useOsDetection();
  const { toast } = useToast();
  const [nativeScan, setNativeScan] = useState<NativeHardwareScan | null>(() => loadNativeScan());
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  // HW Monitor JSON data — seeded from localStorage so temps/fans persist across sessions
  const [hwMonitorData, setHwMonitorData] = useState<HwMonitorData | null>(() => loadHwMonitor());
  const native = isNative();

  const runScan = useCallback(() => {
    setScanning(true);
    setScanError(null);
    scanHardware()
      .then(async data => {
        setNativeScan(data);
        setScanError(null);
        if (data) {
          await uploadValidatedHardwareScan(data);
          saveNativeScan(data);
          // Bridge native scan into optigods-sysinfo so smart-recs on every page use WMI data
           saveScannedInfo({
            GPU:         data.gpu  || undefined,
            CPU:         data.cpu  || undefined,
            Cores:       data.cpu_cores ?? undefined,
            Threads:     data.cpu_threads ?? undefined,
            RAM_GB:      data.ram_gb    ?? undefined,
            RAM_MHz:     data.ram_mhz   ?? undefined,
            VRAM_MB:     data.vram_mb ?? undefined,
            Motherboard: data.motherboard ?? undefined,
            Chassis:     data.chassis ?? undefined,
            CoolingType: data.cooling_type ?? undefined,
            RefreshHz:   data.refresh_hz ?? undefined,
            NicVendor:   data.nic_vendor ?? undefined,
            Anticheats:  data.anticheats,
            OsName:      data.os_name ?? undefined,
            OsBuild:     data.os_build ?? undefined,
            SystemModel: data.system_model ?? undefined,
            IsLaptop:    data.is_laptop ?? undefined,
          });
           // A native scan is a completed user action. Mark it as an audible
           // success so the desktop app gives feedback even when the results
           // panel is below the fold.
           toast({ title: "Instant Scan complete", description: "Hardware validated and ready for your PC-specific recommendations.", variant: "success" });
        }
      })
      .catch(err => {
        const message = err instanceof Error ? err.message : String(err);
        setScanError(message);
        toast({
          title: "Instant Scan failed",
          description: message || "The hardware scan could not be validated.",
          variant: "destructive",
        });
        playFeedbackSound(true);
      })
      .finally(() => setScanning(false));
  }, []);

  useEffect(() => {
    if (native) runScan();
  }, [native, runScan]);

  const loading = native ? (scanning && !nativeScan) : hw.loading;

  // Is the system "not detected"? True when web mode with no scanned localStorage data
  const notDetected = !native && !hw.scanned && !hw.gpuName.includes(" ");

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <header>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <Activity className="w-5 h-5 text-red-400" />
            </div>
            <h1 className="text-2xl font-display font-bold text-white">System Scan</h1>
            {native && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400">
                Native — Deep Scan
              </span>
            )}
            {native && (
              <button
                data-testid="button-instant-scan-header"
                onClick={runScan}
                disabled={scanning}
                className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider transition-colors"
              >
                {scanning
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Scanning…</>
                  : <><Zap className="w-3.5 h-3.5" /> Instant Scan</>}
              </button>
            )}
          </div>
          <p className="text-sm text-zinc-500">
            {native
              ? "Direct WMI hardware scan — exact specs, fan count, live CPU temperature, and anti-cheat detection."
              : "Browser-level hardware detection. Run a native scan for full accuracy including temps and fan count."}
          </p>
        </header>

        {/* My PC — system model banner (shown when scan data includes model) */}
        {(() => {
          const model = (nativeScan?.system_model || hw.systemModel || "").trim();
          if (!model) return null;
          return (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              data-testid="banner-my-pc"
              className="flex items-center gap-4 px-5 py-3.5 rounded-2xl border border-white/8 bg-zinc-900/70"
            >
              <div className="p-2.5 rounded-xl bg-zinc-800/80 border border-white/8 shrink-0">
                <MonitorCheck className="w-5 h-5 text-red-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-0.5">My PC</p>
                <p className="text-white font-semibold text-sm truncate" data-testid="text-system-model">{model}</p>
              </div>
            </motion.div>
          );
        })()}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16 text-zinc-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            {native ? "Running deep hardware scan…" : "Scanning hardware…"}
          </div>
        )}

        {/* Native success */}
        {!loading && native && nativeScan && (
          <NativeScanResults
            scan={nativeScan}
            onRescan={runScan}
            rescanning={scanning}
            hwMonitor={hwMonitorData}
          />
        )}

        {/* Smart Recs Breakdown — shown for both native and web after hardware is known */}
        {!loading && <SmartRecsBreakdown />}

        {/* Native error */}
        {!loading && native && scanError && (
          <div className="space-y-4">
            <div className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-4 text-sm text-red-400 flex items-center justify-between gap-4">
              <span>Scan failed: {scanError}</span>
              <button
                onClick={runScan}
                disabled={scanning}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold hover:bg-red-500/20 transition-colors"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", scanning && "animate-spin")} />
                Retry
              </button>
            </div>
            {/* Fallback browser stats */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
              <Stat icon={MonitorPlay} label="GPU" value={hw.gpuName || "Unknown"} />
              <Stat icon={Cpu} label="CPU" value={hw.cpuLabel || "Unknown"} />
              <Stat icon={MemoryStick} label="RAM" value={hw.ramGB ? `${hw.ramGB} GB` : "Browser-limited"} />
              <Stat icon={HardDrive} label="OS" value={os.os || "Detecting…"} sub={os.build ? `Build ${os.build}` : undefined} />
              <Stat icon={Sparkles} label="Form Factor" value={hw.isLaptop ? "Laptop" : "Desktop"} />
            </div>
          </div>
        )}

        {/* Web — not detected, show CTA */}
        {!loading && !native && notDetected && (
          <NotDetectedPanel onScan={runScan} scanning={scanning} />
        )}

        {/* Web — partial/full browser detection */}
        {!loading && !native && !notDetected && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
              <Stat icon={MonitorPlay} label="GPU" value={hw.gpuName || "Unknown"}
                sub={[hw.isNvidia && "NVIDIA", hw.isAmd && "AMD", hw.isIntel && "Intel"].filter(Boolean).join(" · ") || undefined} />
              <Stat icon={Cpu} label="CPU" value={hw.cpuLabel || "Unknown"}
                sub={hw.cpuCores ? `${hw.cpuCores} threads` : undefined} />
              <Stat icon={MemoryStick} label="RAM"
                value={hw.ramGB ? `${hw.ramGB} GB` : "Browser-limited"}
                sub={hwMonitorData?.ram_mhz ? `${hwMonitorData.ram_mhz} MHz` : undefined} />
              <Stat icon={HardDrive} label="OS" value={os.os || "Detecting…"}
                sub={os.build ? `Build ${os.build}` : undefined} />
              <Stat icon={Sparkles} label="Form Factor" value={hw.isLaptop ? "Laptop" : "Desktop"} />
              {/* Cooling — populated from HW Monitor BAT JSON once the user imports it */}
              {hwMonitorData && (hwMonitorData.fan_count ?? 0) > 0 && (
                <Stat icon={Wind} label="Cooling"
                  value={`${hwMonitorData.fan_count} Fan${hwMonitorData.fan_count === 1 ? "" : "s"}`}
                  sub="From HW Monitor scan" />
              )}
            </div>

            {/* Unlock deeper scan hint — hide once HW Monitor data is loaded */}
            {!hwMonitorData && (
              <div className="rounded-xl border border-white/5 bg-zinc-950/30 px-4 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Wind className="w-4 h-4 text-zinc-600 shrink-0" />
                  <p className="text-[11px] text-zinc-500">
                    Fan count and CPU temperature require the native app — or run the HW Monitor BAT below.
                  </p>
                </div>
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 flex items-center gap-1 text-[10px] font-bold text-red-400 hover:text-red-300 transition-colors"
                >
                  Get the app <ChevronRight className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>
        )}

      </div>
    </AppLayout>
  );
}
