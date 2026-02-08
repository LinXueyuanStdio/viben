//! Cross-platform shell command utilities

use std::path::{Path, PathBuf};

/// Get the path to an interactive shell for the current platform.
/// Used for spawning PTY sessions.
///
/// On Windows, prefers PowerShell if available, falling back to cmd.exe.
/// On Unix, returns the user's configured shell from $SHELL.
pub async fn get_interactive_shell() -> PathBuf {
    if cfg!(windows) {
        // Prefer PowerShell if available, fall back to cmd.exe
        if let Ok(powershell) = which::which("powershell.exe") {
            powershell
        } else {
            PathBuf::from("cmd.exe")
        }
    } else {
        get_unix_shell()
    }
}

/// Get the Unix shell from $SHELL environment variable
fn get_unix_shell() -> PathBuf {
    if let Ok(shell) = std::env::var("SHELL") {
        let shell_path = Path::new(&shell);
        if shell_path.is_absolute() && shell_path.exists() {
            return shell_path.to_path_buf();
        }
    }
    // Default to /bin/sh if $SHELL is not set or invalid
    PathBuf::from("/bin/sh")
}

/// Get shell name from path (e.g., "zsh", "bash", "sh")
pub fn get_shell_name(shell_path: &Path) -> &str {
    shell_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("sh")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_get_interactive_shell() {
        let shell = get_interactive_shell().await;
        // Should return a valid path
        assert!(!shell.as_os_str().is_empty());
    }

    #[test]
    fn test_get_shell_name() {
        assert_eq!(get_shell_name(Path::new("/bin/zsh")), "zsh");
        assert_eq!(get_shell_name(Path::new("/bin/bash")), "bash");
        assert_eq!(get_shell_name(Path::new("/bin/sh")), "sh");
        assert_eq!(get_shell_name(Path::new("cmd.exe")), "cmd.exe");
    }
}
