// Tiny registry helper that wraps the `winreg` crate with a typed
// "backup-before-write" pattern. The token returned from write_dword is an
// opaque, base64-encoded JSON blob that restore_from_token() can replay
// verbatim — that's how the React Undo button reverses tweaks across the
// entire native engine without each impl needing custom undo code.

use anyhow::{Context, Result};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use serde::{Deserialize, Serialize};
use winreg::enums::*;
use winreg::types::FromRegValue;
use winreg::RegKey;

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
pub enum Hive {
    LocalMachine,
    CurrentUser,
    ClassesRoot,
    Users,
}

impl Hive {
    fn hkey(self) -> RegKey {
        let isize_val = match self {
            Hive::LocalMachine => HKEY_LOCAL_MACHINE,
            Hive::CurrentUser => HKEY_CURRENT_USER,
            Hive::ClassesRoot => HKEY_CLASSES_ROOT,
            Hive::Users => HKEY_USERS,
        };
        RegKey::predef(isize_val)
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub enum RegValue {
    Dword(u32),
    Qword(u64),
    Sz(String),
    Bin(Vec<u8>),
    None,
}

#[derive(Debug, Serialize, Deserialize)]
struct UndoToken {
    hive: Hive,
    path: String,
    name: String,
    prior: RegValue,
}

pub fn write_dword(hive: Hive, path: &str, name: &str, value: u32) -> Result<()> {
    let (key, _) = hive
        .hkey()
        .create_subkey(path)
        .with_context(|| format!("create_subkey {path}"))?;
    key.set_value(name, &value)
        .with_context(|| format!("set_value {name} = {value:#x}"))?;
    match read_value(hive, path, name)? {
        RegValue::Dword(actual) if actual == value => {}
        RegValue::Dword(actual) => anyhow::bail!(
            "registry verification failed for {name}: expected {value:#x}, found {actual:#x}"
        ),
        _ => anyhow::bail!("registry verification failed for {name}: value is not a DWORD"),
    }
    Ok(())
}

pub fn write_sz(hive: Hive, path: &str, name: &str, value: &str) -> Result<()> {
    let (key, _) = hive
        .hkey()
        .create_subkey(path)
        .with_context(|| format!("create_subkey {path}"))?;
    key.set_value(name, &value)
        .with_context(|| format!("set_value {name} = {value}"))?;
    match read_value(hive, path, name)? {
        RegValue::Sz(actual) if actual == value => {}
        RegValue::Sz(actual) => anyhow::bail!(
            "registry verification failed for {name}: expected {value}, found {actual}"
        ),
        _ => anyhow::bail!("registry verification failed for {name}: value is not a string"),
    }
    Ok(())
}

pub fn read_value(hive: Hive, path: &str, name: &str) -> Result<RegValue> {
    let key = hive
        .hkey()
        .open_subkey_with_flags(path, KEY_READ)
        .with_context(|| format!("open_subkey {path}"))?;
    let raw = key
        .get_raw_value(name)
        .with_context(|| format!("get_raw_value {name}"))?;
    Ok(match raw.vtype {
        REG_DWORD => RegValue::Dword(u32::from_reg_value(&raw).unwrap_or(0)),
        REG_QWORD => RegValue::Qword(u64::from_reg_value(&raw).unwrap_or(0)),
        REG_SZ | REG_EXPAND_SZ => {
            RegValue::Sz(String::from_reg_value(&raw).unwrap_or_default())
        }
        REG_BINARY => RegValue::Bin(raw.bytes.clone()),
        _ => RegValue::None,
    })
}

pub fn encode_token(hive: Hive, path: &str, name: &str, prior: &RegValue) -> String {
    let token = UndoToken {
        hive,
        path: path.to_string(),
        name: name.to_string(),
        prior: prior.clone_via_serde(),
    };
    let json = serde_json::to_vec(&token).unwrap_or_default();
    URL_SAFE_NO_PAD.encode(json)
}

pub fn restore_from_token(token: &str) -> Result<()> {
    let raw = URL_SAFE_NO_PAD
        .decode(token)
        .context("base64 decode undo token")?;
    let parsed: UndoToken = serde_json::from_slice(&raw).context("parse undo token JSON")?;
    let (key, _) = parsed
        .hive
        .hkey()
        .create_subkey(&parsed.path)
        .with_context(|| format!("create_subkey {}", parsed.path))?;
    match parsed.prior {
        RegValue::Dword(v) => key.set_value(&parsed.name, &v)?,
        RegValue::Qword(v) => key.set_value(&parsed.name, &v)?,
        RegValue::Sz(v) => key.set_value(&parsed.name, &v)?,
        RegValue::Bin(_) | RegValue::None => {
            // Best-effort: delete the value if we don't have a typed prior.
            let _ = key.delete_value(&parsed.name);
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn decode_token(token: &str) -> UndoToken {
        let raw = URL_SAFE_NO_PAD.decode(token).expect("token should decode");
        serde_json::from_slice(&raw).expect("token should contain JSON")
    }

    #[test]
    fn undo_token_preserves_existing_value() {
        let token = encode_token(
            Hive::CurrentUser,
            r"Software\OptiGods\Tests",
            "KeyboardSpeed",
            &RegValue::Sz("12".into()),
        );
        let decoded = decode_token(&token);

        assert!(matches!(decoded.hive, Hive::CurrentUser));
        assert_eq!(decoded.path, r"Software\OptiGods\Tests");
        assert_eq!(decoded.name, "KeyboardSpeed");
        assert!(matches!(decoded.prior, RegValue::Sz(ref value) if value == "12"));
    }

    #[test]
    fn undo_token_preserves_missing_value_marker() {
        let token = encode_token(
            Hive::LocalMachine,
            r"Software\OptiGods\Tests",
            "NewValue",
            &RegValue::None,
        );
        let decoded = decode_token(&token);

        assert!(matches!(decoded.prior, RegValue::None));
    }

    #[test]
    fn apply_and_undo_restore_existing_string_value() {
        let path = format!(r"Software\OptiGods\Tests\{}", std::process::id());
        let root = RegKey::predef(HKEY_CURRENT_USER);
        let (key, _) = root.create_subkey(&path).expect("test key should be created");
        key.set_value("KeyboardSpeed", &"12")
            .expect("initial value should be written");

        let prior = read_value(Hive::CurrentUser, &path, "KeyboardSpeed")
            .expect("initial value should be captured");
        let token = encode_token(Hive::CurrentUser, &path, "KeyboardSpeed", &prior);
        write_sz(Hive::CurrentUser, &path, "KeyboardSpeed", "31")
            .expect("native apply should succeed");
        assert!(matches!(
            read_value(Hive::CurrentUser, &path, "KeyboardSpeed"),
            Ok(RegValue::Sz(value)) if value == "31"
        ));

        restore_from_token(&token).expect("native undo should succeed");
        assert!(matches!(
            read_value(Hive::CurrentUser, &path, "KeyboardSpeed"),
            Ok(RegValue::Sz(value)) if value == "12"
        ));
        drop(key);
        let _ = root.delete_subkey_all(&path);
    }

    #[test]
    fn apply_and_undo_remove_new_dword_value() {
        let path = format!(r"Software\OptiGods\Tests\{}", std::process::id());
        let root = RegKey::predef(HKEY_CURRENT_USER);
        let (key, _) = root.create_subkey(&path).expect("test key should be created");

        let token = encode_token(
            Hive::CurrentUser,
            &path,
            "MouseDataQueueSize",
            &RegValue::None,
        );
        write_dword(Hive::CurrentUser, &path, "MouseDataQueueSize", 20)
            .expect("native apply should succeed");
        assert!(matches!(
            read_value(Hive::CurrentUser, &path, "MouseDataQueueSize"),
            Ok(RegValue::Dword(20))
        ));

        restore_from_token(&token).expect("native undo should succeed");
        assert!(read_value(Hive::CurrentUser, &path, "MouseDataQueueSize").is_err());
        drop(key);
        let _ = root.delete_subkey_all(&path);
    }
}

impl RegValue {
    fn clone_via_serde(&self) -> RegValue {
        match self {
            RegValue::Dword(v) => RegValue::Dword(*v),
            RegValue::Qword(v) => RegValue::Qword(*v),
            RegValue::Sz(s) => RegValue::Sz(s.clone()),
            RegValue::Bin(b) => RegValue::Bin(b.clone()),
            RegValue::None => RegValue::None,
        }
    }
}
