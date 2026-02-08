//! PTY (Pseudo Terminal) Service
//!
//! Manages PTY sessions for terminal emulation in the gateway.
//! Supports creating, writing to, resizing, and closing PTY sessions.

use std::{
    collections::HashMap,
    io::{Read, Write},
    path::PathBuf,
    sync::{Arc, Mutex},
    thread,
};

use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use thiserror::Error;
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::utils::shell::{get_interactive_shell, get_shell_name};

/// PTY service errors
#[derive(Debug, Error)]
pub enum PtyError {
    #[error("Failed to create PTY: {0}")]
    CreateFailed(String),

    #[error("Session not found: {0}")]
    SessionNotFound(Uuid),

    #[error("Failed to write to PTY: {0}")]
    WriteFailed(String),

    #[error("Failed to resize PTY: {0}")]
    ResizeFailed(String),

    #[error("Session already closed")]
    SessionClosed,
}

/// A PTY session
struct PtySession {
    writer: Box<dyn Write + Send>,
    master: Box<dyn portable_pty::MasterPty + Send>,
    _output_handle: thread::JoinHandle<()>,
    closed: bool,
}

/// Service for managing PTY sessions
#[derive(Clone)]
pub struct PtyService {
    sessions: Arc<Mutex<HashMap<Uuid, PtySession>>>,
}

impl PtyService {
    /// Create a new PTY service
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Create a new PTY session
    ///
    /// # Arguments
    /// * `working_dir` - The working directory for the shell
    /// * `cols` - Number of columns for the terminal
    /// * `rows` - Number of rows for the terminal
    ///
    /// # Returns
    /// A tuple of (session_id, output_receiver)
    pub async fn create_session(
        &self,
        working_dir: PathBuf,
        cols: u16,
        rows: u16,
    ) -> Result<(Uuid, mpsc::UnboundedReceiver<Vec<u8>>), PtyError> {
        let session_id = Uuid::new_v4();
        let (output_tx, output_rx) = mpsc::unbounded_channel();
        let shell = get_interactive_shell().await;
        let working_dir_display = working_dir.clone();

        let result = tokio::task::spawn_blocking(move || {
            let pty_system = NativePtySystem::default();

            let pty_pair = pty_system
                .openpty(PtySize {
                    rows,
                    cols,
                    pixel_width: 0,
                    pixel_height: 0,
                })
                .map_err(|e| PtyError::CreateFailed(e.to_string()))?;

            let mut cmd = CommandBuilder::new(&shell);
            cmd.cwd(&working_dir);

            // Configure shell-specific options
            let shell_name = get_shell_name(&shell);

            if shell_name == "powershell.exe" || shell_name == "pwsh.exe" {
                // PowerShell: use -NoLogo for cleaner startup
                cmd.arg("-NoLogo");
            } else if shell_name == "cmd.exe" {
                // cmd.exe: no special args needed
            } else {
                // Unix shells
                cmd.env("VIBEN_TERMINAL", "1");

                if shell_name == "bash" {
                    cmd.env("PROMPT_COMMAND", r#"PS1='$ '; unset PROMPT_COMMAND"#);
                } else {
                    cmd.env("PS1", "$ ");
                }
            }

            cmd.env("TERM", "xterm-256color");
            cmd.env("COLORTERM", "truecolor");

            let child = pty_pair
                .slave
                .spawn_command(cmd)
                .map_err(|e| PtyError::CreateFailed(e.to_string()))?;

            let mut writer = pty_pair
                .master
                .take_writer()
                .map_err(|e| PtyError::CreateFailed(e.to_string()))?;

            // Special handling for zsh prompt
            if shell_name == "zsh" {
                let _ = writer.write_all(b" PROMPT='$ '; RPROMPT=''\n");
                let _ = writer.flush();
                let _ = writer.write_all(b"\x0c"); // Clear screen
                let _ = writer.flush();
            }

            let mut reader = pty_pair
                .master
                .try_clone_reader()
                .map_err(|e| PtyError::CreateFailed(e.to_string()))?;

            // Spawn thread to read output from PTY
            let output_handle = thread::spawn(move || {
                let mut buf = [0u8; 4096];
                loop {
                    match reader.read(&mut buf) {
                        Ok(0) => break, // EOF
                        Ok(n) => {
                            if output_tx.send(buf[..n].to_vec()).is_err() {
                                break; // Receiver dropped
                            }
                        }
                        Err(_) => break,
                    }
                }
                drop(child);
            });

            Ok::<_, PtyError>((pty_pair.master, writer, output_handle))
        })
        .await
        .map_err(|e| PtyError::CreateFailed(e.to_string()))??;

        let (master, writer, output_handle) = result;

        let session = PtySession {
            writer,
            master,
            _output_handle: output_handle,
            closed: false,
        };

        self.sessions
            .lock()
            .map_err(|e| PtyError::CreateFailed(e.to_string()))?
            .insert(session_id, session);

        tracing::info!("Created PTY session {} in {:?}", session_id, working_dir_display);

        Ok((session_id, output_rx))
    }

    /// Write data to a PTY session
    pub async fn write(&self, session_id: Uuid, data: &[u8]) -> Result<(), PtyError> {
        let mut sessions = self
            .sessions
            .lock()
            .map_err(|e| PtyError::WriteFailed(e.to_string()))?;

        let session = sessions
            .get_mut(&session_id)
            .ok_or(PtyError::SessionNotFound(session_id))?;

        if session.closed {
            return Err(PtyError::SessionClosed);
        }

        session
            .writer
            .write_all(data)
            .map_err(|e| PtyError::WriteFailed(e.to_string()))?;

        session
            .writer
            .flush()
            .map_err(|e| PtyError::WriteFailed(e.to_string()))?;

        Ok(())
    }

    /// Resize a PTY session
    pub async fn resize(&self, session_id: Uuid, cols: u16, rows: u16) -> Result<(), PtyError> {
        let sessions = self
            .sessions
            .lock()
            .map_err(|e| PtyError::ResizeFailed(e.to_string()))?;

        let session = sessions
            .get(&session_id)
            .ok_or(PtyError::SessionNotFound(session_id))?;

        if session.closed {
            return Err(PtyError::SessionClosed);
        }

        session
            .master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| PtyError::ResizeFailed(e.to_string()))?;

        tracing::debug!("Resized PTY session {} to {}x{}", session_id, cols, rows);

        Ok(())
    }

    /// Close a PTY session
    pub async fn close_session(&self, session_id: Uuid) -> Result<(), PtyError> {
        if let Some(mut session) = self
            .sessions
            .lock()
            .map_err(|_| PtyError::SessionClosed)?
            .remove(&session_id)
        {
            session.closed = true;
            tracing::info!("Closed PTY session {}", session_id);
        }
        Ok(())
    }

    /// Check if a session exists
    pub fn session_exists(&self, session_id: &Uuid) -> bool {
        self.sessions
            .lock()
            .map(|s| s.contains_key(session_id))
            .unwrap_or(false)
    }

    /// Get the number of active sessions
    pub fn session_count(&self) -> usize {
        self.sessions.lock().map(|s| s.len()).unwrap_or(0)
    }
}

impl Default for PtyService {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[tokio::test]
    async fn test_pty_service_new() {
        let service = PtyService::new();
        assert_eq!(service.session_count(), 0);
    }

    #[tokio::test]
    #[ignore] // Requires actual PTY support
    async fn test_pty_session_lifecycle() {
        let service = PtyService::new();
        let working_dir = env::current_dir().unwrap();

        // Create session
        let (session_id, _rx) = service
            .create_session(working_dir, 80, 24)
            .await
            .unwrap();

        assert!(service.session_exists(&session_id));
        assert_eq!(service.session_count(), 1);

        // Resize
        service.resize(session_id, 120, 40).await.unwrap();

        // Close
        service.close_session(session_id).await.unwrap();
        assert!(!service.session_exists(&session_id));
    }
}
