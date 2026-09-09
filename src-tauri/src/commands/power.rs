use serde::Serialize;
use std::process::Command;

#[derive(Serialize)]
pub struct PowerPlan { pub guid: String, pub name: String, pub active: bool }

#[tauri::command]
pub fn list_power_plans() -> Result<Vec<PowerPlan>, String> {
    #[cfg(windows)]
    {
        let output = Command::new("powercfg").arg("/list").output().map_err(|e| e.to_string())?;
        let text = String::from_utf8_lossy(&output.stdout);
        let mut plans = Vec::new();
        for line in text.lines() {
            let start = match line.find("GUID: ") { Some(i) => i + 6, None => continue };
            let guid = line[start..].split_whitespace().next().unwrap_or("").to_string();
            if guid.is_empty() { continue; }
            let active = line.contains('*');
            let name = line.split('(').nth(1).and_then(|s| s.split(')').next()).unwrap_or("Windows Power Plan").trim().to_string();
            plans.push(PowerPlan { guid, name, active });
        }
        Ok(plans)
    }
    #[cfg(not(windows))]
    { Ok(Vec::new()) }
}

#[tauri::command]
pub fn set_power_plan(guid: String) -> Result<(), String> {
    if !guid.chars().all(|c| c.is_ascii_hexdigit() || c == '-') { return Err("Invalid power plan identifier.".into()); }
    #[cfg(windows)]
    {
        let status = Command::new("powercfg").args(["/setactive", &guid]).status().map_err(|e| e.to_string())?;
        if status.success() { Ok(()) } else { Err(format!("powercfg exited with {status}")) }
    }
    #[cfg(not(windows))]
    { Err("Power plans are only available on Windows.".into()) }
}