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

#[cfg(windows)]
fn guid_from_powercfg(text: &str) -> Option<String> {
    text.split(|c: char| c.is_whitespace() || matches!(c, '(' | ')' | ':'))
        .map(str::trim)
        .find(|part| {
            part.len() == 36
                && part.chars().enumerate().all(|(index, ch)| {
                    matches!(index, 8 | 13 | 18 | 23) && ch == '-'
                        || !matches!(index, 8 | 13 | 18 | 23) && ch.is_ascii_hexdigit()
                })
        })
        .map(str::to_ascii_lowercase)
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
        // Switching the active built-in plan is reversible and does not edit
        // tweak settings, so it must remain usable even when System Restore is
        // unavailable. Registry/tweak mutations retain the restore-point guard.
        let output = Command::new("powercfg")
            .args(["/setactive", &guid])
            .output()
            .map_err(|e| e.to_string())?;
        if !output.status.success() {
            let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
            return Err(if detail.is_empty() {
                format!(
                    "Windows rejected power plan change (powercfg exited with {}).",
                    output.status
                )
            } else {
                format!("Windows rejected power plan {guid}: {detail}")
            });
        }

        let active_output = Command::new("powercfg")
            .arg("/getactivescheme")
            .output()
            .map_err(|e| format!("Power plan changed, but Windows could not verify it: {e}"))?;
        if !active_output.status.success() {
            return Err("Power plan changed, but Windows could not verify the active plan.".into());
        }
        let active_text = format!(
            "{}\n{}",
            String::from_utf8_lossy(&active_output.stdout),
            String::from_utf8_lossy(&active_output.stderr),
        );
        match guid_from_powercfg(&active_text) {
            Some(active) if active.eq_ignore_ascii_case(&guid) => Ok(()),
            Some(active) => Err(format!(
                "Windows reported a different active power plan ({active}) after the change."
            )),
            None => Err(
                "Power plan changed, but Windows returned an unreadable active-plan identifier."
                    .into(),
            ),
        }
    }
    #[cfg(not(windows))]
    {
        Err("Power plans are only available on Windows.".into())
    }
}
