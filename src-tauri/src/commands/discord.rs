// In-app Discord OAuth via the loopback flow.
//
// Why loopback (and not the standard browser-redirect flow)?
//   - The desktop client has no public callback URL.
//   - Tauri's `shell.open` lets us launch the user's default browser.
//   - A short-lived 127.0.0.1 listener picks up the `?code=...` redirect.
//   - The code is exchanged server-side via /api/auth/discord/exchange so
//     our CLIENT_SECRET never ships in the binary.
//
// Tokens are persisted via the `keyring` crate, which on Windows lives in
// the user's Credential Manager. We cache the access token + Discord user
// ID for 30 days so subsequent launches start signed-in offline.

use crate::state::{AppState, DiscordSession};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::ShellExt;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

const KEYRING_SERVICE: &str = "optigods.desktop";
const KEYRING_ACCOUNT: &str = "discord_session";
const DISCORD_AUTHORIZE_URL: &str = "https://discord.com/oauth2/authorize";
// Hard-coded, compile-time-pinned exchange endpoint. Bound to our own
// origin so a compromised React renderer can't redirect the OAuth code
// to an attacker-controlled server. Allowing user/JS-supplied URLs here
// would let any XSS pivot into full account takeover.
const EXCHANGE_URL: &str = "https://optigods.replit.app/api/auth/discord/exchange";
// During local `cargo tauri dev` against a Vite server on :5000, also
// accept the loopback exchange endpoint — this is the only override
// permitted, and only when the binary is run in debug mode.
#[cfg(debug_assertions)]
const DEBUG_EXCHANGE_URL: &str = "http://127.0.0.1:5000/api/auth/discord/exchange";
const SESSION_TTL_DAYS: i64 = 30;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PublicDiscordSession {
    pub user_id: String,
    pub username: String,
    pub expires_at_unix: i64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct CachedSession {
    access_token: String,
    user_id: String,
    username: String,
    expires_at_unix: i64,
}

#[derive(Deserialize)]
struct ExchangeResponse {
    access_token: String,
    user: ExchangeUser,
}

#[derive(Deserialize)]
struct ExchangeUser {
    id: String,
    username: String,
}

#[tauri::command]
pub async fn discord_login(
    app: AppHandle,
    client_id: String,
) -> Result<PublicDiscordSession, String> {
    // Pinned at compile time — see EXCHANGE_URL comment above. Debug builds
    // also accept the loopback dev server for `cargo tauri dev`.
    #[cfg(debug_assertions)]
    let exchange_url = if std::env::var("OPTIGODS_USE_LOCAL_EXCHANGE").is_ok() {
        DEBUG_EXCHANGE_URL.to_string()
    } else {
        EXCHANGE_URL.to_string()
    };
    #[cfg(not(debug_assertions))]
    let exchange_url = EXCHANGE_URL.to_string();

    // 1. Spin up a loopback listener on an ephemeral port.
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| format!("loopback bind failed: {e}"))?;
    let port = listener
        .local_addr()
        .map_err(|e| e.to_string())?
        .port();
    let redirect_uri = format!("http://127.0.0.1:{port}/callback");

    // 2. Random CSRF state (URL-safe).
    let mut state_bytes = [0u8; 24];
    rand::thread_rng().fill_bytes(&mut state_bytes);
    let state = hex::encode(state_bytes);

    // 3. Open the Discord consent screen in the user's default browser.
    let url = format!(
        "{DISCORD_AUTHORIZE_URL}?client_id={cid}&response_type=code&redirect_uri={ru}&scope=identify%20email&state={st}",
        cid = urlencode(&client_id),
        ru = urlencode(&redirect_uri),
        st = state,
    );
    app.shell()
        .open(&url, None)
        .map_err(|e| format!("shell.open failed: {e}"))?;

    // 4. Wait up to 3 minutes for the redirect.
    let accept = tokio::time::timeout(Duration::from_secs(180), listener.accept())
        .await
        .map_err(|_| "Discord login timed out after 3 minutes.".to_string())?
        .map_err(|e| format!("loopback accept failed: {e}"))?;

    let (mut socket, _) = accept;
    let mut buf = vec![0u8; 8192];
    let n = socket
        .read(&mut buf)
        .await
        .map_err(|e| format!("loopback read failed: {e}"))?;
    let req = String::from_utf8_lossy(&buf[..n]);
    let (code, returned_state) = parse_oauth_callback(&req)?;
    if returned_state != state {
        let _ = socket.write_all(html_response("State mismatch. Please retry login.").as_bytes()).await;
        return Err("OAuth state mismatch (possible CSRF).".into());
    }
    // Friendly browser landing page.
    let _ = socket
        .write_all(
            html_response("✅ Logged in. You can close this tab and return to Opti Gods.").as_bytes(),
        )
        .await;

    // 5. Exchange the code server-side (CLIENT_SECRET stays on the backend).
    let client = reqwest::Client::builder()
        .user_agent("OptiGods/2.0 (desktop)")
        .build()
        .map_err(|e| e.to_string())?;
    let payload = serde_json::json!({ "code": code, "redirect_uri": redirect_uri });
    let resp = client
        .post(&exchange_url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("exchange request failed: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!(
            "exchange returned {}: {}",
            resp.status(),
            resp.text().await.unwrap_or_default()
        ));
    }
    let parsed: ExchangeResponse = resp
        .json()
        .await
        .map_err(|e| format!("exchange JSON parse failed: {e}"))?;

    // 6. Persist + return.
    let expires_at_unix = now_unix() + SESSION_TTL_DAYS * 86_400;
    let cached = CachedSession {
        access_token: parsed.access_token.clone(),
        user_id: parsed.user.id.clone(),
        username: parsed.user.username.clone(),
        expires_at_unix,
    };
    save_to_keyring(&cached).map_err(|e| format!("keyring save failed: {e}"))?;

    let state_handle = app.state::<AppState>();
    *state_handle.discord_token.lock() = Some(DiscordSession {
        access_token: cached.access_token,
        user_id: cached.user_id.clone(),
        username: cached.username.clone(),
        expires_at_unix,
    });

    Ok(PublicDiscordSession {
        user_id: cached.user_id,
        username: cached.username,
        expires_at_unix,
    })
}

#[tauri::command]
pub fn discord_logout(app: AppHandle) -> Result<(), String> {
    let state = app.state::<AppState>();
    *state.discord_token.lock() = None;
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT)
        .map_err(|e| format!("keyring entry: {e}"))?;
    // Ignore "not found" on logout.
    let _ = entry.delete_credential();
    Ok(())
}

#[tauri::command]
pub fn discord_cached_token(app: AppHandle) -> Option<PublicDiscordSession> {
    // Try the in-memory cache first.
    let state = app.state::<AppState>();
    if let Some(s) = state.discord_token.lock().clone() {
        if s.expires_at_unix > now_unix() {
            return Some(PublicDiscordSession {
                user_id: s.user_id,
                username: s.username,
                expires_at_unix: s.expires_at_unix,
            });
        }
    }
    // Fall back to the OS credential store (cold start).
    if let Some(cached) = load_from_keyring() {
        if cached.expires_at_unix > now_unix() {
            *state.discord_token.lock() = Some(DiscordSession {
                access_token: cached.access_token,
                user_id: cached.user_id.clone(),
                username: cached.username.clone(),
                expires_at_unix: cached.expires_at_unix,
            });
            return Some(PublicDiscordSession {
                user_id: cached.user_id,
                username: cached.username,
                expires_at_unix: cached.expires_at_unix,
            });
        }
    }
    None
}

// ─── helpers ────────────────────────────────────────────────────────────────

fn save_to_keyring(s: &CachedSession) -> Result<(), keyring::Error> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT)?;
    let json = serde_json::to_string(s).map_err(|e| keyring::Error::Invalid("serde".into(), e.to_string()))?;
    entry.set_password(&json)
}

fn load_from_keyring() -> Option<CachedSession> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT).ok()?;
    let raw = entry.get_password().ok()?;
    serde_json::from_str(&raw).ok()
}

fn parse_oauth_callback(http_request: &str) -> Result<(String, String), String> {
    // First line: "GET /callback?code=XXX&state=YYY HTTP/1.1"
    let first = http_request
        .lines()
        .next()
        .ok_or_else(|| "empty HTTP request".to_string())?;
    let path = first
        .split_whitespace()
        .nth(1)
        .ok_or_else(|| "malformed HTTP request line".to_string())?;
    let query = path.split_once('?').map(|x| x.1).unwrap_or("");
    let mut code = None;
    let mut state = None;
    for pair in query.split('&') {
        if let Some((k, v)) = pair.split_once('=') {
            match k {
                "code" => code = Some(urldecode(v)),
                "state" => state = Some(urldecode(v)),
                _ => {}
            }
        }
    }
    Ok((
        code.ok_or_else(|| "missing ?code".to_string())?,
        state.ok_or_else(|| "missing ?state".to_string())?,
    ))
}

fn html_response(body: &str) -> String {
    let html = format!(
        "<!doctype html><meta charset=utf-8><title>Opti Gods</title>\
         <body style='background:#0a0a0a;color:#fff;font-family:Segoe UI,system-ui;\
         display:flex;align-items:center;justify-content:center;height:100vh;margin:0'>\
         <div style='text-align:center'><h1 style='color:#ff1e1e'>Opti Gods</h1>\
         <p>{body}</p></div></body>"
    );
    format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        html.len(),
        html
    )
}

fn urlencode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            _ => out.push_str(&format!("%{:02X}", b)),
        }
    }
    out
}

fn urldecode(s: &str) -> String {
    let mut out = Vec::with_capacity(s.len());
    let bytes = s.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(byte) = u8::from_str_radix(
                std::str::from_utf8(&bytes[i + 1..i + 3]).unwrap_or("00"),
                16,
            ) {
                out.push(byte);
                i += 3;
                continue;
            }
        }
        if bytes[i] == b'+' {
            out.push(b' ');
        } else {
            out.push(bytes[i]);
        }
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn now_unix() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}
