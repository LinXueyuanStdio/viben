//! Shared utility functions
//! 共享工具函数

use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Command;
use std::sync::{Mutex, OnceLock};

// Windows constant to create process without a visible window
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Global cache for discovered executable paths.
/// Key: executable name, Value: resolved path (None = not found).
fn cache() -> &'static Mutex<HashMap<String, Option<PathBuf>>> {
    static CACHE: OnceLock<Mutex<HashMap<String, Option<PathBuf>>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Clear the executable path cache.
/// Call this when the user installs/uninstalls software and paths may have changed.
pub fn clear_cache() {
    if let Ok(mut map) = cache().lock() {
        map.clear();
    }
}

/// Find an executable by name using the system PATH.
///
/// Uses `which` on Unix and `where` on Windows.
/// On macOS GUI apps, PATH is limited (no .zshrc sourced), so this may not
/// find executables in nvm/fnm/volta directories — use `find_executable`
/// with extra search paths for those cases.
pub fn which_executable(name: &str) -> Option<PathBuf> {
    let mut cmd = if cfg!(target_os = "windows") {
        Command::new("where")
    } else {
        Command::new("which")
    };
    cmd.arg(name);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    cmd.output()
        .ok()
        .filter(|o| o.status.success())
        .and_then(|o| {
            let path = String::from_utf8_lossy(&o.stdout)
                .lines()
                .next()
                .unwrap_or("")
                .trim()
                .to_string();
            if path.is_empty() {
                None
            } else {
                Some(PathBuf::from(path))
            }
        })
}

/// Find an executable by name, with caching and validation.
///
/// Discovery order: PATH → known install paths → version managers (nvm/fnm/volta).
/// Each candidate is validated by running `<binary> --version` before being accepted.
/// Results are cached for the lifetime of the process.
pub fn find_executable(name: &str) -> Option<PathBuf> {
    // Check cache first
    if let Ok(map) = cache().lock() {
        if let Some(cached) = map.get(name) {
            return cached.clone();
        }
    }

    let result = find_executable_uncached(name);

    // Store in cache
    if let Ok(mut map) = cache().lock() {
        map.insert(name.to_string(), result.clone());
    }

    result
}

/// Internal: find executable without cache.
fn find_executable_uncached(name: &str) -> Option<PathBuf> {
    // 1. Try PATH via which/where
    if let Some(path) = which_executable(name) {
        if verify_executable(&path) {
            return Some(path);
        }
    }

    // 2. Scan version-manager directories (nvm, fnm, volta) FIRST
    //    These take priority because users explicitly choose to use version managers.
    //    macOS GUI apps don't inherit shell PATH, so we must check these manually.
    #[cfg(unix)]
    {
        if let Some(path) = scan_version_managers(name) {
            if verify_executable(&path) {
                return Some(path);
            }
        }
    }

    // 3. Check known installation paths (Homebrew, system paths, etc.)
    for candidate in known_install_paths(name).into_iter().flatten() {
        if candidate.exists() && verify_executable(&candidate) {
            return Some(candidate);
        }
    }

    None
}

/// Verify that a candidate path is a working executable by running `<binary> --version`.
fn verify_executable(path: &PathBuf) -> bool {
    let mut cmd = Command::new(path);
    cmd.arg("--version")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    cmd.status().map(|s| s.success()).unwrap_or(false)
}

/// Platform-specific known installation paths for a given executable.
fn known_install_paths(name: &str) -> Vec<Option<PathBuf>> {
    #[cfg(unix)]
    {
        vec![
            // npm global
            dirs::home_dir().map(|h| h.join(format!(".npm-global/bin/{name}"))),
            // Homebrew (macOS ARM + Intel)
            Some(PathBuf::from(format!("/opt/homebrew/bin/{name}"))),
            Some(PathBuf::from(format!("/usr/local/bin/{name}"))),
            // pnpm global
            dirs::home_dir().map(|h| h.join(format!(".local/share/pnpm/{name}"))),
            // Cargo
            dirs::home_dir().map(|h| h.join(format!(".cargo/bin/{name}"))),
            // Bun global
            dirs::home_dir().map(|h| h.join(format!(".bun/bin/{name}"))),
            // Deno
            dirs::home_dir().map(|h| h.join(format!(".deno/bin/{name}"))),
            // Linux system
            Some(PathBuf::from(format!("/usr/bin/{name}"))),
            // Snap (Linux)
            Some(PathBuf::from(format!("/snap/bin/{name}"))),
            // Conda / Miniconda / Mamba
            dirs::home_dir().map(|h| h.join(format!("miniconda3/bin/{name}"))),
            dirs::home_dir().map(|h| h.join(format!("anaconda3/bin/{name}"))),
            dirs::home_dir().map(|h| h.join(format!("miniforge3/bin/{name}"))),
            dirs::home_dir().map(|h| h.join(format!("mambaforge/bin/{name}"))),
        ]
    }
    #[cfg(windows)]
    {
        let cmd = format!("{name}.cmd");
        let exe = format!("{name}.exe");
        vec![
            // npm global
            dirs::home_dir().map(|h| h.join(format!("AppData/Roaming/npm/{cmd}"))),
            dirs::home_dir().map(|h| h.join(format!("AppData/Roaming/npm/{exe}"))),
            dirs::home_dir().map(|h| h.join(format!(".npm-global/{cmd}"))),
            // pnpm global
            dirs::home_dir().map(|h| h.join(format!("AppData/Local/pnpm/{cmd}"))),
            dirs::home_dir().map(|h| h.join(format!("AppData/Local/pnpm/{exe}"))),
            // Node.js system install
            Some(PathBuf::from(format!(r"C:\Program Files\nodejs\{cmd}"))),
            Some(PathBuf::from(format!(r"C:\Program Files\nodejs\{exe}"))),
            // Scoop
            dirs::home_dir().map(|h| h.join(format!("scoop/shims/{cmd}"))),
            dirs::home_dir().map(|h| h.join(format!("scoop/shims/{exe}"))),
            // Chocolatey
            Some(PathBuf::from(format!(r"C:\ProgramData\chocolatey\bin\{exe}"))),
            // Bun global
            dirs::home_dir().map(|h| h.join(format!(".bun/bin/{exe}"))),
            // Cargo
            dirs::home_dir().map(|h| h.join(format!(".cargo/bin/{exe}"))),
            // Conda
            dirs::home_dir().map(|h| h.join(format!(r"miniconda3\Scripts\{exe}"))),
            dirs::home_dir().map(|h| h.join(format!(r"anaconda3\Scripts\{exe}"))),
        ]
    }
}

/// Scan version-manager directories (nvm, fnm) for an executable.
/// macOS GUI apps don't source .zshrc so these paths aren't in PATH.
#[cfg(unix)]
fn scan_version_managers(name: &str) -> Option<PathBuf> {
    let home = dirs::home_dir()?;

    // nvm: ~/.nvm/versions/node/*/bin/<name>
    let nvm_dir = home.join(".nvm/versions/node");
    if let Ok(entries) = std::fs::read_dir(&nvm_dir) {
        for entry in entries.flatten() {
            let bin = entry.path().join("bin").join(name);
            if bin.exists() {
                return Some(bin);
            }
        }
    }

    // fnm: ~/.local/share/fnm/node-versions/*/installation/bin/<name>
    let fnm_dir = home.join(".local/share/fnm/node-versions");
    if let Ok(entries) = std::fs::read_dir(&fnm_dir) {
        for entry in entries.flatten() {
            let bin = entry.path().join("installation/bin").join(name);
            if bin.exists() {
                return Some(bin);
            }
        }
    }

    // volta: ~/.volta/bin/<name>
    let volta_bin = home.join(".volta/bin").join(name);
    if volta_bin.exists() {
        return Some(volta_bin);
    }

    None
}
