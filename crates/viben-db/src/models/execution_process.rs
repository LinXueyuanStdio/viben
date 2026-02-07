//! Execution process model

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Process status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[serde(rename_all = "lowercase")]
pub enum ProcessStatus {
    Running,
    Completed,
    Failed,
    Cancelled,
}

impl std::fmt::Display for ProcessStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ProcessStatus::Running => write!(f, "running"),
            ProcessStatus::Completed => write!(f, "completed"),
            ProcessStatus::Failed => write!(f, "failed"),
            ProcessStatus::Cancelled => write!(f, "cancelled"),
        }
    }
}

/// Execution process entity
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct ExecutionProcess {
    pub id: String,
    pub session_id: String,
    pub pid: Option<i32>,
    pub status: ProcessStatus,
    pub exit_code: Option<i32>,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
}

/// Create execution process request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateExecutionProcess {
    pub id: Option<String>,
    pub session_id: String,
    pub pid: Option<i32>,
}
