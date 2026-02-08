//! NAPI initialization functions

use napi::bindgen_prelude::*;
use napi_derive::napi;

/// Initialize viben-core (creates state directories and default configs)
#[napi]
pub async fn initialize() -> Result<()> {
    crate::initialize()
        .await
        .map_err(|e| Error::from_reason(e.to_string()))
}

/// Get viben-core version
#[napi]
pub fn version() -> String {
    crate::version().to_string()
}

/// Get the state directory path
#[napi]
pub fn get_state_dir() -> Result<String> {
    crate::config::get_state_dir()
        .to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| Error::from_reason("Invalid state directory path"))
}
