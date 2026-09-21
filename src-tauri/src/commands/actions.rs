//! In-app recovery actions.
//!
//! The renderer may request only a named action. It never supplies a URL,
//! PowerShell, or executable command. The native shell maps the name to one
//! of the existing server-side, allowlisted recovery scripts, fetches it over
//! the configured app origin, and executes it locally on Windows.

use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Deserialize)]
pub struct RunFixArgs {
    pub id: String,
}

#[derive(Deserialize)]
pub struct RunRestoreArgs {
    pub categories: Vec<String>,
}

#[derive(Serialize, Clone, Debug)]
pub struct NativeActionResult {
    pub ok: bool,
    pub id: String,
    pub message: String,
    pub requires_reboot: bool,
}

struct ScriptSpec {
    path: &'static str,
    marker: &'static str,
    label: &'static str,
    requires_reboot: bool,
}

fn fix_spec(id: &str) -> Option<ScriptSpec> {
    Some(match id {
        "fivem" => ScriptSpec {
            path: "/api/fivem-crash-fix-script",
            marker: "PS1_START",
            label: "FiveM crash fix",
            requires_reboot: true,
        },
        "fivem-ui-input" => ScriptSpec {
            path: "/api/fivem-ui-input-fix-script",
            marker: "PS1_UI_INPUT_START",
            label: "FiveM UI and input fix",
            requires_reboot: false,
        },
        "mushy-face" => ScriptSpec {
            path: "/api/mushy-face-fix-script",
            marker: "PS1_START",
            label: "FiveM texture fix",
            requires_reboot: true,
        },
        "valorant" => ScriptSpec {
            path: "/api/valorant-fix-script",
            marker: "VALORANT_FIX_PS1_START",
            label: "Valorant fix",
            requires_reboot: true,
        },
        "fortnite" => ScriptSpec {
            path: "/api/fortnite-fix-script",
            marker: "FORTNITE_FIX_PS1_START",
            label: "Fortnite fix",
            requires_reboot: true,
        },
        "xbox" => ScriptSpec {
            path: "/api/xbox-gamepass-fix-script",
            marker: "XBOX_FIX_PS1_START",
            label: "Xbox Game Pass fix",
            requires_reboot: true,
        },
        "discord" => ScriptSpec {
            path: "/api/discord-network-fix-script",
            marker: "DISCORD_FIX_PS1_START",
            label: "Discord and network fix",
            requires_reboot: true,
        },
        "boot" => ScriptSpec {
            path: "/api/boot-fix-script",
            marker: "BOOT_FIX_PS1_START",
            label: "boot and display fix",
            requires_reboot: true,
        },
        "audio" => ScriptSpec {
            path: "/api/audio-fix-script",
            marker: "AUDIO_FIX_PS1_START",
            label: "audio fix",
            requires_reboot: false,
        },
        "wmp" => ScriptSpec {
            path: "/api/wmp-fix-script",
            marker: "WMP_FIX_PS1_START",
            label: "Windows Media Player fix",
            requires_reboot: true,
        },
        "movies-tv" => ScriptSpec {
            path: "/api/movies-tv-fix-script",
            marker: "MOVIES_TV_FIX_PS1_START",
            label: "Movies and TV fix",
            requires_reboot: true,
        },
        "nvidia-overlay" => ScriptSpec {
            path: "/api/nvidia-overlay-fix-script",
            marker: "NVIDIA_OVERLAY_FIX_PS1_START",
            label: "NVIDIA in-game overlay recovery",
            requires_reboot: true,
        },
        _ => return None,
    })
}

fn restore_category_allowed(id: &str) -> bool {
    matches!(
        id,
        "cpu"
            | "network"
            | "memory"
            | "visual"
            | "power"
            | "services"
            | "nvidia"
            | "amd"
            | "process"
            | "fivem"
            | "bcdedit"
            | "gpu-usage"
            | "time-sync"
            | "processes-reduction"
    )
}

fn app_origin() -> &'static str {
    if cfg!(debug_assertions) {
        "http://127.0.0.1:5000"
    } else {
        "https://optigods.com"
    }
}

fn extract_script(body: &[u8], marker: &str) -> Result<String, String> {
    let text = String::from_utf8(body.to_vec())
        .map_err(|_| "The recovery script response was not valid UTF-8.".to_string())?;
    let marker_tag = format!("##{marker}##");
    let (_, script) = text
        .split_once(&marker_tag)
        .ok_or_else(|| format!("The server returned an invalid {marker} recovery response."))?;
    if script.trim().is_empty() {
        return Err("The recovery script was empty.".into());
    }
    Ok(script.to_string())
}

async fn fetch_script(
    client: &reqwest::Client,
    path: &str,
    marker: &str,
) -> Result<String, String> {
    let response = client
        .get(format!("{}{path}", app_origin()))
        .send()
        .await
        .map_err(|error| format!("Could not reach the Opti Gods recovery service: {error}"))?;
    let status = response.status();
    let body = response
        .bytes()
        .await
        .map_err(|error| format!("Could not read the recovery response: {error}"))?;
    if !status.is_success() {
        return Err(format!("The recovery service returned HTTP {status}."));
    }
    extract_script(&body, marker)
}

async fn fetch_restore_script(
    client: &reqwest::Client,
    categories: &[String],
) -> Result<String, String> {
    let response = client
        .post(format!("{}/api/generate-restore", app_origin()))
        .json(&serde_json::json!({ "categories": categories }))
        .send()
        .await
        .map_err(|error| format!("Could not reach the Opti Gods restore service: {error}"))?;
    let status = response.status();
    let body = response
        .bytes()
        .await
        .map_err(|error| format!("Could not read the restore response: {error}"))?;
    if !status.is_success() {
        return Err(format!("The restore service returned HTTP {status}."));
    }
    extract_script(&body, "RESTORE_PS1_START")
}

fn run_powershell(
    id: &str,
    script: String,
    requires_reboot: bool,
) -> Result<NativeActionResult, String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        use std::process::Command;

        // Downloaded launchers pause for confirmation. The in-app path already
        // reports completion in the UI, so remove only those wait lines.
        let script = script
            .lines()
            .filter(|line| {
                let trimmed = line.trim_start();
                !trimmed.starts_with("Read-Host") && !trimmed.eq_ignore_ascii_case("pause")
            })
            .collect::<Vec<_>>()
            .join("\r\n");

        let output = Command::new("powershell.exe")
            .creation_flags(0x08000000)
            .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command"])
            .arg(&script)
            .output()
            .map_err(|error| format!("Could not start Windows PowerShell: {error}"))?;

        if output.status.success() {
            return Ok(NativeActionResult {
                ok: true,
                id: id.to_string(),
                message: format!("{} completed in the Windows app.", id.replace('-', " ")),
                requires_reboot,
            });
        }

        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let detail = if !stderr.is_empty() { stderr } else { stdout };
        let detail = if detail.is_empty() {
            "Windows PowerShell returned an error without details.".to_string()
        } else {
            detail.chars().take(600).collect()
        };
        Err(format!(
            "Windows could not complete this recovery action: {detail}"
        ))
    }

    #[cfg(not(windows))]
    {
        let _ = (id, script, requires_reboot);
        Err("These recovery actions are available in the Windows app.".into())
    }
}

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|error| format!("Could not initialize the recovery service: {error}"))
}

#[tauri::command]
pub async fn run_fix(args: RunFixArgs) -> Result<NativeActionResult, String> {
    let spec = fix_spec(&args.id)
        .ok_or_else(|| "That fix is not available in the Windows app yet.".to_string())?;
    let client = client()?;
    let script = fetch_script(&client, spec.path, spec.marker).await?;

    #[cfg(windows)]
    crate::win32::restore::ensure_session_checkpoint("Opti Gods — Before Recovery Fix")
        .map_err(|error| format!("No fix was run because Windows could not create a verified restore point: {error:#}"))?;

    run_powershell(spec.label, script, spec.requires_reboot)
}

#[tauri::command]
pub async fn run_restore_categories(args: RunRestoreArgs) -> Result<NativeActionResult, String> {
    let categories: Vec<String> = args
        .categories
        .into_iter()
        .filter(|category| restore_category_allowed(category))
        .collect();
    if categories.is_empty() {
        return Err("Select at least one restore category.".into());
    }

    let client = client()?;
    let script = fetch_restore_script(&client, &categories).await?;

    #[cfg(windows)]
    crate::win32::restore::ensure_session_checkpoint("Opti Gods — Before Restore")
        .map_err(|error| format!("No restore was run because Windows could not create a verified restore point: {error:#}"))?;

    run_powershell("restore", script, true)
}
