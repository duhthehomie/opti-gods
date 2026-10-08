using System.Diagnostics;
using System.Text.Json;
using LibreHardwareMonitor.Hardware;
using Microsoft.Win32;

// No fan/voltage/clock controls, motherboard probes, service changes or downloads.
// PawnIO installation is a separate, explicitly confirmed interactive action.
if (args.Length != 2 || args[0] != "--parent-pid" || !int.TryParse(args[1], out var parentId))
    return;
Process parent;
try { parent = Process.GetProcessById(parentId); }
catch { return; }

bool DriverPresent()
{
    using var key = Registry.LocalMachine.OpenSubKey(@"SYSTEM\CurrentControlSet\Services\PawnIO");
    return key is not null;
}
var computer = new Computer { IsCpuEnabled = true, IsGpuEnabled = true };
try
{
    computer.Open();
    while (!parent.HasExited)
    {
        var candidates = new List<(HardwareType type, string name, float value)>();
        void Update(IHardware hardware)
        {
            try
            {
                hardware.Update();
                foreach (var sensor in hardware.Sensors)
                    if (sensor.SensorType == SensorType.Temperature && sensor.Value is float v &&
                        float.IsFinite(v) && v > 0 && v < 130)
                        candidates.Add((hardware.HardwareType, sensor.Name, v));
                foreach (var child in hardware.SubHardware) Update(child);
            }
            catch { /* Failed hardware is unavailable in this sample, never reused. */ }
        }
        foreach (var hardware in computer.Hardware) Update(hardware);
        int Rank(string name)
        {
            if (name.Equals("CPU Package", StringComparison.OrdinalIgnoreCase)) return 0;
            if (name.Contains("(Tdie)", StringComparison.OrdinalIgnoreCase)) return 1;
            if (name.Contains("(Tctl/Tdie)", StringComparison.OrdinalIgnoreCase)) return 2;
            if (name.Contains("CCD", StringComparison.OrdinalIgnoreCase)) return 3;
            if (name.Contains("CPU Core", StringComparison.OrdinalIgnoreCase)) return 4;
            return 100;
        }
        var cpus = candidates.Where(s => s.type == HardwareType.Cpu && Rank(s.name) < 100)
            .OrderBy(s => Rank(s.name)).ThenByDescending(s => s.value).ToArray();
        var gpus = candidates.Where(s =>
            (s.type == HardwareType.GpuNvidia || s.type == HardwareType.GpuAmd || s.type == HardwareType.GpuIntel) &&
            s.name.Equals("GPU Core", StringComparison.OrdinalIgnoreCase)).ToArray();
        var driverPresent = DriverPresent();
        Console.WriteLine(JsonSerializer.Serialize(new
        {
            cpu_temp_c = cpus.Length > 0 ? (float?)Math.Round(cpus[0].value, 1) : null,
            // Do not guess which of several adapters is the user's GPU.
            gpu_temp_c = gpus.Length == 1 ? (float?)Math.Round(gpus[0].value, 1) : null,
            cpu_sensor_name = cpus.Length > 0 ? cpus[0].name : null,
            status = cpus.Length > 0 ? "live" : driverPresent ? "sensor_unavailable" : "driver_required"
        }));
        Console.Out.Flush();
        Thread.Sleep(1000);
    }
}
catch
{
    Console.WriteLine(JsonSerializer.Serialize(new
    {
        status = DriverPresent() ? "sensor_unavailable" : "driver_required",
        cpu_temp_c = (float?)null,
        gpu_temp_c = (float?)null
    }));
}
finally { computer.Close(); parent.Dispose(); }
