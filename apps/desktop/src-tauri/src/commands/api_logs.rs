use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{BufRead, BufReader};
use std::path::PathBuf;

/// An API log entry (matches Python ApiLogEntry)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiLogEntry {
    pub timestamp: String,
    pub run_id: String,
    pub api_key_hash: Option<String>,
    pub provider: String,
    pub source: String,
    pub method: String,
    pub request: serde_json::Value,
    pub response: serde_json::Value,
    pub latency_ms: f64,
    pub status: String,
    pub error: Option<String>,
}

/// Summary of API logs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiLogSummary {
    pub run_id: String,
    pub total_requests: usize,
    pub successful_requests: usize,
    pub failed_requests: usize,
    pub by_source: HashMap<String, usize>,
    pub by_method: HashMap<String, usize>,
    pub avg_latency_ms: f64,
}

/// API log session info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiLogSession {
    pub run_id: String,
    pub log_file: String,
    pub entry_count: usize,
    pub created_at: Option<String>,
    pub last_entry_at: Option<String>,
}

/// Get the API logs directory
fn get_api_logs_dir() -> PathBuf {
    let logs_dir = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("browse-mcp")
        .join("logs")
        .join("api");

    fs::create_dir_all(&logs_dir).ok();
    logs_dir
}

/// List all API log sessions (JSONL files)
#[tauri::command]
pub async fn get_api_log_sessions() -> Result<Vec<ApiLogSession>, String> {
    let api_logs_dir = get_api_logs_dir();
    let mut sessions = Vec::new();

    if !api_logs_dir.exists() {
        return Ok(sessions);
    }

    let entries = fs::read_dir(&api_logs_dir).map_err(|e| format!("Failed to read logs dir: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) == Some("jsonl") {
            if let Some(run_id) = path.file_stem().and_then(|s| s.to_str()) {
                // Count entries and get timestamps
                let mut entry_count = 0;
                let mut first_timestamp: Option<String> = None;
                let mut last_timestamp: Option<String> = None;

                if let Ok(file) = File::open(&path) {
                    let reader = BufReader::new(file);
                    for line in reader.lines().flatten() {
                        if let Ok(entry) = serde_json::from_str::<ApiLogEntry>(&line) {
                            if first_timestamp.is_none() {
                                first_timestamp = Some(entry.timestamp.clone());
                            }
                            last_timestamp = Some(entry.timestamp.clone());
                            entry_count += 1;
                        }
                    }
                }

                sessions.push(ApiLogSession {
                    run_id: run_id.to_string(),
                    log_file: path.to_string_lossy().to_string(),
                    entry_count,
                    created_at: first_timestamp,
                    last_entry_at: last_timestamp,
                });
            }
        }
    }

    // Sort by created_at descending
    sessions.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    Ok(sessions)
}

/// Get API logs for a specific run
#[tauri::command]
pub async fn get_api_logs(
    run_id: String,
    limit: Option<usize>,
    offset: Option<usize>,
    provider_filter: Option<String>,
    source_filter: Option<String>,
    status_filter: Option<String>,
    method_filter: Option<String>,
) -> Result<Vec<ApiLogEntry>, String> {
    let log_file = get_api_logs_dir().join(format!("{}.jsonl", run_id));

    if !log_file.exists() {
        return Ok(Vec::new());
    }

    let file = File::open(&log_file).map_err(|e| format!("Failed to open log file: {}", e))?;
    let reader = BufReader::new(file);
    let mut entries = Vec::new();

    let skip = offset.unwrap_or(0);
    let max = limit.unwrap_or(1000);
    let mut skipped = 0;

    for line in reader.lines().flatten() {
        if let Ok(entry) = serde_json::from_str::<ApiLogEntry>(&line) {
            // Apply filters
            if let Some(ref filter) = provider_filter {
                if &entry.provider != filter {
                    continue;
                }
            }
            if let Some(ref filter) = source_filter {
                if &entry.source != filter {
                    continue;
                }
            }
            if let Some(ref filter) = status_filter {
                if &entry.status != filter {
                    continue;
                }
            }
            if let Some(ref filter) = method_filter {
                if &entry.method != filter {
                    continue;
                }
            }

            if skipped < skip {
                skipped += 1;
                continue;
            }

            entries.push(entry);
            if entries.len() >= max {
                break;
            }
        }
    }

    Ok(entries)
}

/// Get summary statistics for API logs
#[tauri::command]
pub async fn get_api_log_summary(run_id: String) -> Result<ApiLogSummary, String> {
    let log_file = get_api_logs_dir().join(format!("{}.jsonl", run_id));

    if !log_file.exists() {
        return Ok(ApiLogSummary {
            run_id,
            total_requests: 0,
            successful_requests: 0,
            failed_requests: 0,
            by_source: HashMap::new(),
            by_method: HashMap::new(),
            avg_latency_ms: 0.0,
        });
    }

    let file = File::open(&log_file).map_err(|e| format!("Failed to open log file: {}", e))?;
    let reader = BufReader::new(file);

    let mut total_requests = 0;
    let mut successful_requests = 0;
    let mut failed_requests = 0;
    let mut by_source: HashMap<String, usize> = HashMap::new();
    let mut by_method: HashMap<String, usize> = HashMap::new();
    let mut total_latency = 0.0;

    for line in reader.lines().flatten() {
        if let Ok(entry) = serde_json::from_str::<ApiLogEntry>(&line) {
            total_requests += 1;
            total_latency += entry.latency_ms;

            if entry.status == "success" {
                successful_requests += 1;
            } else {
                failed_requests += 1;
            }

            *by_source.entry(entry.source).or_default() += 1;
            *by_method.entry(entry.method).or_default() += 1;
        }
    }

    let avg_latency_ms = if total_requests > 0 {
        total_latency / total_requests as f64
    } else {
        0.0
    };

    Ok(ApiLogSummary {
        run_id,
        total_requests,
        successful_requests,
        failed_requests,
        by_source,
        by_method,
        avg_latency_ms,
    })
}

/// Clear API logs for a specific run
#[tauri::command]
pub async fn clear_api_logs(run_id: String) -> Result<(), String> {
    let log_file = get_api_logs_dir().join(format!("{}.jsonl", run_id));
    if log_file.exists() {
        fs::remove_file(&log_file).map_err(|e| format!("Failed to delete log file: {}", e))?;
    }
    Ok(())
}

/// Get the API logs directory path
#[tauri::command]
pub async fn get_api_logs_dir_path() -> Result<String, String> {
    Ok(get_api_logs_dir().to_string_lossy().to_string())
}
