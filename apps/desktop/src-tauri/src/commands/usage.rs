use chrono::Datelike;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

/// Usage record for a single day
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DailyUsage {
    pub date: String, // YYYY-MM-DD
    pub total_requests: u64,
    pub by_source: HashMap<String, u64>,
    pub by_api_key: HashMap<String, u64>,
    pub by_server: HashMap<String, u64>,
}

/// Usage statistics for display
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageStats {
    pub total_requests: u64,
    pub today_requests: u64,
    pub this_week_requests: u64,
    pub this_month_requests: u64,
    pub by_source: HashMap<String, u64>,
    pub by_api_key: HashMap<String, u64>,
    pub by_server: HashMap<String, u64>,
    pub daily_usage: Vec<DailyUsage>,
    pub activity_heatmap: Vec<ActivityDay>, // Last 365 days
}

/// Single day for activity heatmap
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityDay {
    pub date: String,
    pub count: u64,
    pub level: u8, // 0-4 for GitHub-style intensity
}

/// API Key usage info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKeyUsage {
    pub key_id: String,
    pub usage_count: u64,
    pub last_used: Option<String>,
}

/// State for usage tracking
pub struct UsageState {
    pub usage_data: Mutex<HashMap<String, DailyUsage>>, // date -> usage
    pub data_file: Mutex<Option<PathBuf>>,
}

impl Default for UsageState {
    fn default() -> Self {
        Self {
            usage_data: Mutex::new(HashMap::new()),
            data_file: Mutex::new(None),
        }
    }
}

fn get_usage_file_path() -> PathBuf {
    let data_dir = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("browse-mcp");
    fs::create_dir_all(&data_dir).ok();
    data_dir.join("usage.json")
}

fn get_today() -> String {
    chrono::Local::now().format("%Y-%m-%d").to_string()
}

fn get_week_start() -> String {
    let today = chrono::Local::now();
    let days_from_monday = today.weekday().num_days_from_monday();
    let monday = today - chrono::Duration::days(days_from_monday as i64);
    monday.format("%Y-%m-%d").to_string()
}

fn get_month_start() -> String {
    chrono::Local::now().format("%Y-%m-01").to_string()
}

/// Initialize usage tracking
#[tauri::command]
pub async fn init_usage(state: State<'_, UsageState>) -> Result<(), String> {
    let file_path = get_usage_file_path();

    // Load existing data
    if file_path.exists() {
        if let Ok(content) = fs::read_to_string(&file_path) {
            if let Ok(data) = serde_json::from_str::<HashMap<String, DailyUsage>>(&content) {
                let mut usage_data = state.usage_data.lock().map_err(|e| e.to_string())?;
                *usage_data = data;
            }
        }
    }

    let mut data_file = state.data_file.lock().map_err(|e| e.to_string())?;
    *data_file = Some(file_path);

    Ok(())
}

/// Record a usage event
#[tauri::command]
pub async fn record_usage(
    server_id: String,
    source_id: String,
    api_key_id: Option<String>,
    state: State<'_, UsageState>,
) -> Result<(), String> {
    let today = get_today();

    {
        let mut usage_data = state.usage_data.lock().map_err(|e| e.to_string())?;

        let daily = usage_data.entry(today.clone()).or_insert_with(|| DailyUsage {
            date: today.clone(),
            ..Default::default()
        });

        daily.total_requests += 1;
        *daily.by_source.entry(source_id).or_insert(0) += 1;
        *daily.by_server.entry(server_id).or_insert(0) += 1;

        if let Some(ref key_id) = api_key_id {
            *daily.by_api_key.entry(key_id.clone()).or_insert(0) += 1;
        }
    }

    // Persist to file
    save_usage_data(&state).await?;

    Ok(())
}

async fn save_usage_data(state: &State<'_, UsageState>) -> Result<(), String> {
    let usage_data = state.usage_data.lock().map_err(|e| e.to_string())?;
    let data_file = state.data_file.lock().map_err(|e| e.to_string())?;

    if let Some(ref path) = *data_file {
        let content = serde_json::to_string_pretty(&*usage_data)
            .map_err(|e| format!("Failed to serialize usage data: {}", e))?;
        fs::write(path, content)
            .map_err(|e| format!("Failed to write usage data: {}", e))?;
    }

    Ok(())
}

/// Get usage statistics
#[tauri::command]
pub async fn get_usage_stats(state: State<'_, UsageState>) -> Result<UsageStats, String> {
    let usage_data = state.usage_data.lock().map_err(|e| e.to_string())?;

    let today = get_today();
    let week_start = get_week_start();
    let month_start = get_month_start();

    let mut stats = UsageStats {
        total_requests: 0,
        today_requests: 0,
        this_week_requests: 0,
        this_month_requests: 0,
        by_source: HashMap::new(),
        by_api_key: HashMap::new(),
        by_server: HashMap::new(),
        daily_usage: Vec::new(),
        activity_heatmap: Vec::new(),
    };

    // Aggregate all data
    for (date, daily) in usage_data.iter() {
        stats.total_requests += daily.total_requests;

        if date == &today {
            stats.today_requests = daily.total_requests;
        }

        if date >= &week_start {
            stats.this_week_requests += daily.total_requests;
        }

        if date >= &month_start {
            stats.this_month_requests += daily.total_requests;
        }

        // Aggregate by source
        for (source, count) in &daily.by_source {
            *stats.by_source.entry(source.clone()).or_insert(0) += count;
        }

        // Aggregate by api key
        for (key, count) in &daily.by_api_key {
            *stats.by_api_key.entry(key.clone()).or_insert(0) += count;
        }

        // Aggregate by server
        for (server, count) in &daily.by_server {
            *stats.by_server.entry(server.clone()).or_insert(0) += count;
        }
    }

    // Get last 30 days for line chart
    let mut daily_list: Vec<_> = usage_data.values().cloned().collect();
    daily_list.sort_by(|a, b| a.date.cmp(&b.date));
    stats.daily_usage = daily_list.into_iter().rev().take(30).rev().collect();

    // Generate activity heatmap for last 365 days
    stats.activity_heatmap = generate_activity_heatmap(&usage_data);

    Ok(stats)
}

fn generate_activity_heatmap(usage_data: &HashMap<String, DailyUsage>) -> Vec<ActivityDay> {
    let mut heatmap = Vec::new();
    let today = chrono::Local::now().date_naive();

    // Find max for normalization
    let max_count = usage_data.values()
        .map(|d| d.total_requests)
        .max()
        .unwrap_or(1)
        .max(1);

    for i in 0..365 {
        let date = today - chrono::Duration::days(364 - i);
        let date_str = date.format("%Y-%m-%d").to_string();

        let count = usage_data.get(&date_str)
            .map(|d| d.total_requests)
            .unwrap_or(0);

        // Calculate level (0-4) based on count
        let level = if count == 0 {
            0
        } else {
            let ratio = count as f64 / max_count as f64;
            match ratio {
                r if r < 0.25 => 1,
                r if r < 0.50 => 2,
                r if r < 0.75 => 3,
                _ => 4,
            }
        };

        heatmap.push(ActivityDay {
            date: date_str,
            count,
            level,
        });
    }

    heatmap
}

/// Get usage for a specific API key
#[tauri::command]
pub async fn get_api_key_usage(
    key_id: String,
    state: State<'_, UsageState>,
) -> Result<ApiKeyUsage, String> {
    let usage_data = state.usage_data.lock().map_err(|e| e.to_string())?;

    let mut total_usage = 0u64;
    let mut last_used: Option<String> = None;

    // Sort dates to find last used
    let mut dates: Vec<_> = usage_data.keys().collect();
    dates.sort();
    dates.reverse();

    for date in dates {
        if let Some(daily) = usage_data.get(date) {
            if let Some(count) = daily.by_api_key.get(&key_id) {
                total_usage += count;
                if last_used.is_none() && *count > 0 {
                    last_used = Some(date.clone());
                }
            }
        }
    }

    Ok(ApiKeyUsage {
        key_id,
        usage_count: total_usage,
        last_used,
    })
}

/// Get usage for a specific server
#[tauri::command]
pub async fn get_server_usage(
    server_id: String,
    state: State<'_, UsageState>,
) -> Result<u64, String> {
    let usage_data = state.usage_data.lock().map_err(|e| e.to_string())?;

    let mut total = 0u64;
    for daily in usage_data.values() {
        if let Some(count) = daily.by_server.get(&server_id) {
            total += count;
        }
    }

    Ok(total)
}

/// Get usage for a specific data source
#[tauri::command]
pub async fn get_source_usage(
    source_id: String,
    state: State<'_, UsageState>,
) -> Result<u64, String> {
    let usage_data = state.usage_data.lock().map_err(|e| e.to_string())?;

    let mut total = 0u64;
    for daily in usage_data.values() {
        if let Some(count) = daily.by_source.get(&source_id) {
            total += count;
        }
    }

    Ok(total)
}
