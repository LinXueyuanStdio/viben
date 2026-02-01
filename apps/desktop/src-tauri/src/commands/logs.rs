use serde::{Deserialize, Serialize};
use std::fs::{self, File, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

/// A log entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub id: String,
    pub timestamp: String,
    pub level: String, // "info", "warning", "error", "debug"
    pub message: String,
    pub source: Option<String>,
}

/// A log session represents one MCP server run
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogSession {
    /// Unique run identifier (used for log filename)
    pub run_id: String,
    /// Session ID (for internal tracking, same as run_id)
    pub id: String,
    /// Server instance ID
    pub server_id: String,
    /// Human-readable server name
    pub server_name: String,
    /// Process ID of the MCP server
    #[serde(default)]
    pub pid: Option<u32>,
    /// Session creation time
    pub created_at: String,
    /// Last update time
    pub updated_at: String,
    /// Session end time (null if still running)
    pub ended_at: Option<String>,
    /// Path to the log file
    pub log_file: String,
    /// Number of log entries
    pub log_count: usize,
    /// Number of error entries
    pub error_count: usize,
    // Legacy field for compatibility
    #[serde(default, alias = "started_at")]
    pub started_at: Option<String>,
}

/// Summary of log sessions for display
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogSessionSummary {
    pub sessions: Vec<LogSession>,
    pub total_sessions: usize,
}

pub struct LogsState {
    pub sessions: Mutex<Vec<LogSession>>,
    pub active_sessions: Mutex<std::collections::HashMap<String, String>>, // server_id -> session_id
}

impl Default for LogsState {
    fn default() -> Self {
        Self {
            sessions: Mutex::new(Vec::new()),
            active_sessions: Mutex::new(std::collections::HashMap::new()),
        }
    }
}

/// Get the logs directory path
pub fn get_logs_dir() -> PathBuf {
    let log_dir = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("browse-mcp")
        .join("logs");

    fs::create_dir_all(&log_dir).ok();
    log_dir
}

/// Get the sessions index file path
fn get_sessions_index_path() -> PathBuf {
    get_logs_dir().join("sessions.json")
}

/// Load sessions from disk
fn load_sessions() -> Vec<LogSession> {
    let path = get_sessions_index_path();
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(sessions) = serde_json::from_str::<Vec<LogSession>>(&content) {
                return sessions;
            }
        }
    }
    Vec::new()
}

/// Save sessions to disk
fn save_sessions(sessions: &[LogSession]) -> Result<(), String> {
    let path = get_sessions_index_path();
    let content = serde_json::to_string_pretty(sessions)
        .map_err(|e| format!("Failed to serialize sessions: {}", e))?;
    fs::write(&path, content)
        .map_err(|e| format!("Failed to write sessions: {}", e))?;
    Ok(())
}

/// Save sessions helper (for use from mcp.rs)
pub fn save_sessions_helper(sessions: &[LogSession]) {
    save_sessions(sessions).ok();
}

/// Initialize logs state - load existing sessions
#[tauri::command]
pub async fn init_logs(state: State<'_, LogsState>) -> Result<(), String> {
    let sessions = load_sessions();
    let mut state_sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    *state_sessions = sessions;
    Ok(())
}

/// Start a new log session for a server
#[tauri::command]
pub async fn start_log_session(
    server_id: String,
    server_name: String,
    pid: Option<u32>,
    state: State<'_, LogsState>,
) -> Result<String, String> {
    // Generate a unique run_id
    let run_id = uuid::Uuid::new_v4().to_string().replace("-", "")[..12].to_string();
    let timestamp = chrono::Local::now();
    let timestamp_str = timestamp.format("%Y-%m-%d %H:%M:%S").to_string();

    // Log file is named by run_id
    let log_file = get_logs_dir()
        .join(format!("{}.log", run_id))
        .to_string_lossy()
        .to_string();

    let session = LogSession {
        run_id: run_id.clone(),
        id: run_id.clone(),
        server_id: server_id.clone(),
        server_name,
        pid,
        created_at: timestamp_str.clone(),
        updated_at: timestamp_str.clone(),
        ended_at: None,
        log_file: log_file.clone(),
        log_count: 0,
        error_count: 0,
        started_at: Some(timestamp_str.clone()),
    };

    // Create the log file with header
    if let Ok(mut file) = File::create(&log_file) {
        writeln!(
            file,
            "=== Log session started at {} ===",
            session.created_at
        )
        .ok();
    }

    // Add to sessions
    {
        let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
        sessions.push(session);
        save_sessions(&sessions)?;
    }

    // Track active session
    {
        let mut active = state.active_sessions.lock().map_err(|e| e.to_string())?;
        active.insert(server_id, run_id.clone());
    }

    Ok(run_id)
}

/// Update session PID
#[tauri::command]
pub async fn update_session_pid(
    session_id: String,
    pid: u32,
    state: State<'_, LogsState>,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    if let Some(session) = sessions.iter_mut().find(|s| s.id == session_id) {
        session.pid = Some(pid);
        session.updated_at = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
        save_sessions(&sessions)?;
    }
    Ok(())
}

/// End a log session
#[tauri::command]
pub async fn end_log_session(
    session_id: String,
    state: State<'_, LogsState>,
) -> Result<(), String> {
    let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    {
        let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
        if let Some(session) = sessions.iter_mut().find(|s| s.id == session_id) {
            session.ended_at = Some(timestamp.clone());
            session.updated_at = timestamp.clone();
            session.pid = None; // Clear PID when session ends

            // Add footer to log file
            if let Ok(mut file) = OpenOptions::new().append(true).open(&session.log_file) {
                writeln!(file, "=== Log session ended at {} ===", timestamp).ok();
            }
        }
        save_sessions(&sessions)?;
    }

    // Remove from active sessions
    {
        let mut active = state.active_sessions.lock().map_err(|e| e.to_string())?;
        active.retain(|_, v| v != &session_id);
    }

    Ok(())
}

/// Add a log entry to a session
#[tauri::command]
pub async fn add_log(
    level: String,
    message: String,
    source: Option<String>,
    session_id: Option<String>,
    state: State<'_, LogsState>,
) -> Result<(), String> {
    let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    // Find the session to log to
    let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;

    // If no session_id provided, try to find active session for source (server_id)
    let target_session_id = session_id.or_else(|| {
        if let Some(ref server_id) = source {
            let active = state.active_sessions.lock().ok()?;
            active.get(server_id).cloned()
        } else {
            None
        }
    });

    if let Some(ref sid) = target_session_id {
        if let Some(session) = sessions.iter_mut().find(|s| s.id == *sid) {
            // Write to log file
            if let Ok(mut file) = OpenOptions::new()
                .create(true)
                .append(true)
                .open(&session.log_file)
            {
                let source_str = source.as_ref().map(|s| format!(" [{}]", s)).unwrap_or_default();
                writeln!(
                    file,
                    "{} [{}]{} {}",
                    timestamp,
                    level.to_uppercase(),
                    source_str,
                    message
                )
                .ok();
            }

            // Update counts
            session.log_count += 1;
            if level.to_lowercase() == "error" {
                session.error_count += 1;
            }

            save_sessions(&sessions)?;
        }
    }

    Ok(())
}

/// Get all log sessions
#[tauri::command]
pub async fn get_log_sessions(
    server_id: Option<String>,
    state: State<'_, LogsState>,
) -> Result<LogSessionSummary, String> {
    // Reload sessions from disk to get fresh data
    let disk_sessions = load_sessions();

    // Update in-memory state
    {
        let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
        *sessions = disk_sessions.clone();
    }

    // Update log counts by re-reading files for active sessions
    let updated_sessions: Vec<LogSession> = disk_sessions
        .into_iter()
        .map(|mut session| {
            // Re-count logs from file for sessions without ended_at
            if session.ended_at.is_none() {
                if let Ok(file) = File::open(&session.log_file) {
                    let reader = BufReader::new(file);
                    let mut log_count = 0;
                    let mut error_count = 0;
                    for line in reader.lines().flatten() {
                        // Skip header/footer lines
                        if line.starts_with("===") {
                            continue;
                        }
                        log_count += 1;
                        if line.to_lowercase().contains("[error]") {
                            error_count += 1;
                        }
                    }
                    session.log_count = log_count;
                    session.error_count = error_count;
                }
            }
            session
        })
        .collect();

    let filtered: Vec<LogSession> = if let Some(ref sid) = server_id {
        updated_sessions.iter().filter(|s| &s.server_id == sid).cloned().collect()
    } else {
        updated_sessions.clone()
    };

    // Sort by started_at descending (most recent first)
    let mut sorted = filtered;
    sorted.sort_by(|a, b| b.started_at.cmp(&a.started_at));

    Ok(LogSessionSummary {
        total_sessions: sorted.len(),
        sessions: sorted,
    })
}

/// Get logs for a specific session
#[tauri::command]
pub async fn get_session_logs(
    session_id: String,
    level_filter: Option<String>,
    limit: Option<usize>,
    state: State<'_, LogsState>,
) -> Result<Vec<LogEntry>, String> {
    let sessions = state.sessions.lock().map_err(|e| e.to_string())?;

    let session = sessions
        .iter()
        .find(|s| s.id == session_id)
        .ok_or_else(|| "Session not found".to_string())?;

    let mut logs = Vec::new();

    if let Ok(file) = File::open(&session.log_file) {
        let reader = BufReader::new(file);
        for (idx, line) in reader.lines().enumerate() {
            if let Ok(line) = line {
                if let Some(entry) = parse_log_line(&line, idx) {
                    logs.push(entry);
                }
            }
        }
    }

    // Apply level filter
    if let Some(ref filter) = level_filter {
        if filter != "all" {
            logs.retain(|log| log.level.to_lowercase() == filter.to_lowercase());
        }
    }

    // Apply limit (return most recent logs)
    let limit = limit.unwrap_or(1000);
    if logs.len() > limit {
        let skip_count = logs.len() - limit;
        logs = logs.into_iter().skip(skip_count).collect();
    }

    Ok(logs)
}

/// Parse a log line from file into a LogEntry
fn parse_log_line(line: &str, idx: usize) -> Option<LogEntry> {
    // Skip header/footer lines
    if line.starts_with("===") {
        return None;
    }

    // Expected format: "2024-01-20 14:32:15 [INFO] [source] message"
    // or: "2024-01-20 14:32:15 [INFO] message"

    if line.len() < 20 {
        return None;
    }

    let timestamp = &line[0..19];
    let rest = &line[20..];

    // Find level
    let level_start = rest.find('[')?;
    let level_end = rest.find(']')?;
    let level = rest[level_start + 1..level_end].to_lowercase();

    let after_level = &rest[level_end + 1..].trim_start();

    // Check for source
    let (source, message) = if after_level.starts_with('[') {
        if let Some(source_end) = after_level.find(']') {
            let source = after_level[1..source_end].to_string();
            let message = after_level[source_end + 1..].trim().to_string();
            (Some(source), message)
        } else {
            (None, after_level.to_string())
        }
    } else {
        (None, after_level.to_string())
    };

    Some(LogEntry {
        id: format!("log-{}", idx),
        timestamp: timestamp.to_string(),
        level,
        message,
        source,
    })
}

/// Clear logs for a session (delete the log file)
#[tauri::command]
pub async fn clear_session_logs(
    session_id: String,
    state: State<'_, LogsState>,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;

    if let Some(session) = sessions.iter().find(|s| s.id == session_id) {
        // Delete the log file
        if PathBuf::from(&session.log_file).exists() {
            fs::remove_file(&session.log_file)
                .map_err(|e| format!("Failed to delete log file: {}", e))?;
        }
    }

    // Remove the session
    sessions.retain(|s| s.id != session_id);
    save_sessions(&sessions)?;

    Ok(())
}

/// Delete old sessions (keep last N sessions per server)
#[tauri::command]
pub async fn cleanup_old_sessions(
    keep_count: usize,
    state: State<'_, LogsState>,
) -> Result<usize, String> {
    let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;

    // Group by server_id
    let mut by_server: std::collections::HashMap<String, Vec<&LogSession>> =
        std::collections::HashMap::new();
    for session in sessions.iter() {
        by_server
            .entry(session.server_id.clone())
            .or_default()
            .push(session);
    }

    let mut to_delete = Vec::new();

    for (_, mut server_sessions) in by_server {
        // Sort by started_at descending
        server_sessions.sort_by(|a, b| b.started_at.cmp(&a.started_at));

        // Mark old sessions for deletion
        for session in server_sessions.into_iter().skip(keep_count) {
            to_delete.push(session.id.clone());
        }
    }

    let deleted_count = to_delete.len();

    // Delete log files and remove sessions
    for session_id in &to_delete {
        if let Some(session) = sessions.iter().find(|s| &s.id == session_id) {
            if PathBuf::from(&session.log_file).exists() {
                fs::remove_file(&session.log_file).ok();
            }
        }
    }

    sessions.retain(|s| !to_delete.contains(&s.id));
    save_sessions(&sessions)?;

    Ok(deleted_count)
}

/// Export logs for a session
#[tauri::command]
pub async fn export_session_logs(
    session_id: String,
    export_path: String,
    state: State<'_, LogsState>,
) -> Result<String, String> {
    let sessions = state.sessions.lock().map_err(|e| e.to_string())?;

    let session = sessions
        .iter()
        .find(|s| s.id == session_id)
        .ok_or_else(|| "Session not found".to_string())?;

    // Copy the log file
    fs::copy(&session.log_file, &export_path)
        .map_err(|e| format!("Failed to export logs: {}", e))?;

    Ok(export_path)
}

/// Get logs directory path
#[tauri::command]
pub async fn get_logs_dir_path() -> Result<String, String> {
    Ok(get_logs_dir().to_string_lossy().to_string())
}

// Legacy compatibility - these will be deprecated

/// Get all logs (legacy - returns logs from most recent session)
#[tauri::command]
pub async fn get_logs(
    level_filter: Option<String>,
    limit: Option<usize>,
    state: State<'_, LogsState>,
) -> Result<Vec<LogEntry>, String> {
    let session_id = {
        let sessions = state.sessions.lock().map_err(|e| e.to_string())?;
        let mut sorted: Vec<_> = sessions.iter().collect();
        sorted.sort_by(|a, b| b.started_at.cmp(&a.started_at));
        sorted.first().map(|s| s.id.clone())
    };

    if let Some(sid) = session_id {
        return get_session_logs(sid, level_filter, limit, state).await;
    }

    Ok(Vec::new())
}

/// Clear all logs (legacy)
#[tauri::command]
pub async fn clear_logs(state: State<'_, LogsState>) -> Result<(), String> {
    let sessions = state.sessions.lock().map_err(|e| e.to_string())?;

    // Delete all log files
    for session in sessions.iter() {
        if PathBuf::from(&session.log_file).exists() {
            fs::remove_file(&session.log_file).ok();
        }
    }

    drop(sessions);

    // Clear sessions
    let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    sessions.clear();
    save_sessions(&sessions)?;

    Ok(())
}

/// Export logs (legacy)
#[tauri::command]
pub async fn export_logs(
    export_path: String,
    state: State<'_, LogsState>,
) -> Result<String, String> {
    let session_id = {
        let sessions = state.sessions.lock().map_err(|e| e.to_string())?;
        let mut sorted: Vec<_> = sessions.iter().collect();
        sorted.sort_by(|a, b| b.started_at.cmp(&a.started_at));
        sorted.first().map(|s| s.id.clone())
    };

    if let Some(sid) = session_id {
        return export_session_logs(sid, export_path, state).await;
    }

    Err("No logs to export".to_string())
}

/// Get log file path (legacy)
#[tauri::command]
pub async fn get_log_file_path_cmd(state: State<'_, LogsState>) -> Result<String, String> {
    let sessions = state.sessions.lock().map_err(|e| e.to_string())?;

    // Get most recent session
    let mut sorted: Vec<_> = sessions.iter().collect();
    sorted.sort_by(|a, b| b.started_at.cmp(&a.started_at));

    if let Some(session) = sorted.first() {
        return Ok(session.log_file.clone());
    }

    Ok(get_logs_dir().join("no-session.log").to_string_lossy().to_string())
}
