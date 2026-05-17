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
