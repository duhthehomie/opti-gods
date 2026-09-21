use serde::Serialize;
use std::process::Command;

#[derive(Serialize)]
pub struct PowerPlan {
    pub guid: String,
    pub name: String,
    pub active: bool,
}

fn plan_name_key(name: &str) -> String {
    name.split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_ascii_lowercase()
}

#[tauri::command]
pub fn list_power_plans() -> Result<Vec<PowerPlan>, String> {
    #[cfg(windows)]
    {
        let output = Command::new("powercfg")
            .arg("/list")
            .output()
            .map_err(|e| e.to_string())?;
        let text = String::from_utf8_lossy(&output.stdout);
        let mut plans = Vec::new();
        for line in text.lines() {
            let start = match line.find("GUID: ") {
                Some(i) => i + 6,
                None => continue,
            };
            let guid = line[start..]
                .split_whitespace()
                .next()
                .unwrap_or("")
                .to_string();
            if guid.is_empty() {
                continue;
            }
            let active = line.contains('*');
            let name = line
                .split('(')
                .nth(1)
                .and_then(|s| s.split(')').next())
                .unwrap_or("Windows Power Plan")
                .trim()
                .to_string();
            plans.push(PowerPlan { guid, name, active });
        }
        // Windows may keep multiple GUIDs with the same display name after a
        // hidden/custom plan has been duplicated. The app must not present
        // duplicate cards; retain the active copy because it is the one that
        // reflects the current Windows state.
        let mut unique: Vec<PowerPlan> = Vec::with_capacity(plans.len());
        for plan in plans {
            let key = plan_name_key(&plan.name);
            if let Some(index) = unique
                .iter()
                .position(|existing| plan_name_key(&existing.name) == key)
            {
                if plan.active && !unique[index].active {
                    unique[index] = plan;
                }
            } else {
                unique.push(plan);
            }
        }
        Ok(unique)
    }
    #[cfg(not(windows))]
    {
        Ok(Vec::new())
    }
}

#[tauri::command]
pub fn set_power_plan(guid: String) -> Result<(), String> {
    if !guid.chars().all(|c| c.is_ascii_hexdigit() || c == '-') {
        return Err("Invalid power plan identifier.".into());
    }
    #[cfg(windows)]
    {
        crate::commands::restore::require_verified_checkpoint()?;
        let status = Command::new("powercfg")
            .args(["/setactive", &guid])
            .status()
            .map_err(|e| e.to_string())?;
        if status.success() {
            Ok(())
        } else {
            Err(format!("powercfg exited with {status}"))
        }
    }
    #[cfg(not(windows))]
    {
        Err("Power plans are only available on Windows.".into())
    }
}
