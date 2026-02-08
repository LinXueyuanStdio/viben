//! Execution process model

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};
use ts_rs::TS;

use crate::db::DbError;

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

impl std::str::FromStr for ProcessStatus {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "running" => Ok(ProcessStatus::Running),
            "completed" => Ok(ProcessStatus::Completed),
            "failed" => Ok(ProcessStatus::Failed),
            "cancelled" => Ok(ProcessStatus::Cancelled),
            _ => Err(format!("Invalid process status: {}", s)),
        }
    }
}

impl Default for ProcessStatus {
    fn default() -> Self {
        ProcessStatus::Running
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

/// Row type for database queries
#[derive(Debug, Clone, FromRow)]
struct ExecutionProcessRow {
    id: String,
    session_id: String,
    pid: Option<i32>,
    status: String,
    exit_code: Option<i32>,
    started_at: String,
    ended_at: Option<String>,
}

impl TryFrom<ExecutionProcessRow> for ExecutionProcess {
    type Error = DbError;

    fn try_from(row: ExecutionProcessRow) -> Result<Self, Self::Error> {
        Ok(ExecutionProcess {
            id: row.id,
            session_id: row.session_id,
            pid: row.pid,
            status: row.status.parse().map_err(|e: String| DbError::Migration(e))?,
            exit_code: row.exit_code,
            started_at: DateTime::parse_from_rfc3339(&row.started_at)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now()),
            ended_at: row.ended_at.and_then(|s| {
                DateTime::parse_from_rfc3339(&s)
                    .map(|dt| dt.with_timezone(&Utc))
                    .ok()
            }),
        })
    }
}

/// Create execution process request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateExecutionProcess {
    pub id: Option<String>,
    pub session_id: String,
    pub pid: Option<i32>,
}

/// Update execution process request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateExecutionProcess {
    pub status: Option<ProcessStatus>,
    pub exit_code: Option<i32>,
    pub pid: Option<i32>,
}

impl ExecutionProcess {
    /// Find all execution processes ordered by start time (newest first)
    pub async fn find_all(pool: &SqlitePool) -> Result<Vec<Self>, DbError> {
        let rows = sqlx::query_as::<_, ExecutionProcessRow>(
            r#"SELECT id, session_id, pid, status, exit_code, started_at, ended_at
               FROM execution_processes
               ORDER BY started_at DESC"#,
        )
        .fetch_all(pool)
        .await?;

        rows.into_iter().map(ExecutionProcess::try_from).collect()
    }

    /// Find an execution process by ID
    pub async fn find_by_id(pool: &SqlitePool, id: &str) -> Result<Option<Self>, DbError> {
        let row = sqlx::query_as::<_, ExecutionProcessRow>(
            r#"SELECT id, session_id, pid, status, exit_code, started_at, ended_at
               FROM execution_processes
               WHERE id = ?"#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?;

        match row {
            Some(r) => Ok(Some(ExecutionProcess::try_from(r)?)),
            None => Ok(None),
        }
    }

    /// Find execution processes by session ID
    pub async fn find_by_session_id(pool: &SqlitePool, session_id: &str) -> Result<Vec<Self>, DbError> {
        let rows = sqlx::query_as::<_, ExecutionProcessRow>(
            r#"SELECT id, session_id, pid, status, exit_code, started_at, ended_at
               FROM execution_processes
               WHERE session_id = ?
               ORDER BY started_at DESC"#,
        )
        .bind(session_id)
        .fetch_all(pool)
        .await?;

        rows.into_iter().map(ExecutionProcess::try_from).collect()
    }

    /// Find all running execution processes
    pub async fn find_running(pool: &SqlitePool) -> Result<Vec<Self>, DbError> {
        let rows = sqlx::query_as::<_, ExecutionProcessRow>(
            r#"SELECT id, session_id, pid, status, exit_code, started_at, ended_at
               FROM execution_processes
               WHERE status = 'running'
               ORDER BY started_at DESC"#,
        )
        .fetch_all(pool)
        .await?;

        rows.into_iter().map(ExecutionProcess::try_from).collect()
    }

    /// Find running processes for a specific session
    pub async fn find_running_by_session_id(
        pool: &SqlitePool,
        session_id: &str,
    ) -> Result<Vec<Self>, DbError> {
        let rows = sqlx::query_as::<_, ExecutionProcessRow>(
            r#"SELECT id, session_id, pid, status, exit_code, started_at, ended_at
               FROM execution_processes
               WHERE session_id = ? AND status = 'running'
               ORDER BY started_at DESC"#,
        )
        .bind(session_id)
        .fetch_all(pool)
        .await?;

        rows.into_iter().map(ExecutionProcess::try_from).collect()
    }

    /// Find the latest execution process for a session
    pub async fn find_latest_by_session_id(
        pool: &SqlitePool,
        session_id: &str,
    ) -> Result<Option<Self>, DbError> {
        let row = sqlx::query_as::<_, ExecutionProcessRow>(
            r#"SELECT id, session_id, pid, status, exit_code, started_at, ended_at
               FROM execution_processes
               WHERE session_id = ?
               ORDER BY started_at DESC
               LIMIT 1"#,
        )
        .bind(session_id)
        .fetch_optional(pool)
        .await?;

        match row {
            Some(r) => Ok(Some(ExecutionProcess::try_from(r)?)),
            None => Ok(None),
        }
    }

    /// Create a new execution process
    pub async fn create(pool: &SqlitePool, data: &CreateExecutionProcess) -> Result<Self, DbError> {
        let id = data.id.clone().unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
        let status = ProcessStatus::default();
        let now = Utc::now().to_rfc3339();

        sqlx::query(
            r#"INSERT INTO execution_processes (id, session_id, pid, status, exit_code, started_at, ended_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)"#,
        )
        .bind(&id)
        .bind(&data.session_id)
        .bind(data.pid)
        .bind(status.to_string())
        .bind(None::<i32>)
        .bind(&now)
        .bind(None::<String>)
        .execute(pool)
        .await?;

        Self::find_by_id(pool, &id)
            .await?
            .ok_or_else(|| DbError::NotFound("ExecutionProcess not found after creation".to_string()))
    }

    /// Update an execution process
    pub async fn update(
        pool: &SqlitePool,
        id: &str,
        data: &UpdateExecutionProcess,
    ) -> Result<Self, DbError> {
        // First fetch the existing process
        let existing = Self::find_by_id(pool, id)
            .await?
            .ok_or_else(|| DbError::NotFound(format!("ExecutionProcess {} not found", id)))?;

        // Apply updates
        let status = data.status.clone().unwrap_or(existing.status);
        let exit_code = data.exit_code.or(existing.exit_code);
        let pid = data.pid.or(existing.pid);

        // Set ended_at if status is terminal
        let ended_at = if matches!(status, ProcessStatus::Completed | ProcessStatus::Failed | ProcessStatus::Cancelled) {
            Some(Utc::now().to_rfc3339())
        } else {
            existing.ended_at.map(|dt| dt.to_rfc3339())
        };

        sqlx::query(
            r#"UPDATE execution_processes
               SET status = ?, exit_code = ?, pid = ?, ended_at = ?
               WHERE id = ?"#,
        )
        .bind(status.to_string())
        .bind(exit_code)
        .bind(pid)
        .bind(&ended_at)
        .bind(id)
        .execute(pool)
        .await?;

        Self::find_by_id(pool, id)
            .await?
            .ok_or_else(|| DbError::NotFound(format!("ExecutionProcess {} not found after update", id)))
    }

    /// Update execution process completion status
    pub async fn update_completion(
        pool: &SqlitePool,
        id: &str,
        status: &ProcessStatus,
        exit_code: Option<i32>,
    ) -> Result<(), DbError> {
        let ended_at = if matches!(status, ProcessStatus::Running) {
            None
        } else {
            Some(Utc::now().to_rfc3339())
        };

        let result = sqlx::query(
            r#"UPDATE execution_processes
               SET status = ?, exit_code = ?, ended_at = ?
               WHERE id = ?"#,
        )
        .bind(status.to_string())
        .bind(exit_code)
        .bind(&ended_at)
        .bind(id)
        .execute(pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(DbError::NotFound(format!("ExecutionProcess {} not found", id)));
        }

        Ok(())
    }

    /// Mark a process as completed
    pub async fn mark_completed(
        pool: &SqlitePool,
        id: &str,
        exit_code: Option<i32>,
    ) -> Result<(), DbError> {
        Self::update_completion(pool, id, &ProcessStatus::Completed, exit_code).await
    }

    /// Mark a process as failed
    pub async fn mark_failed(
        pool: &SqlitePool,
        id: &str,
        exit_code: Option<i32>,
    ) -> Result<(), DbError> {
        Self::update_completion(pool, id, &ProcessStatus::Failed, exit_code).await
    }

    /// Mark a process as cancelled
    pub async fn mark_cancelled(pool: &SqlitePool, id: &str) -> Result<(), DbError> {
        Self::update_completion(pool, id, &ProcessStatus::Cancelled, None).await
    }

    /// Update process PID
    pub async fn update_pid(pool: &SqlitePool, id: &str, pid: i32) -> Result<(), DbError> {
        let result = sqlx::query(
            r#"UPDATE execution_processes SET pid = ? WHERE id = ?"#,
        )
        .bind(pid)
        .bind(id)
        .execute(pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(DbError::NotFound(format!("ExecutionProcess {} not found", id)));
        }

        Ok(())
    }

    /// Delete an execution process
    pub async fn delete(pool: &SqlitePool, id: &str) -> Result<u64, DbError> {
        let result = sqlx::query(r#"DELETE FROM execution_processes WHERE id = ?"#)
            .bind(id)
            .execute(pool)
            .await?;

        Ok(result.rows_affected())
    }

    /// Delete all execution processes for a session
    pub async fn delete_by_session_id(pool: &SqlitePool, session_id: &str) -> Result<u64, DbError> {
        let result = sqlx::query(r#"DELETE FROM execution_processes WHERE session_id = ?"#)
            .bind(session_id)
            .execute(pool)
            .await?;

        Ok(result.rows_affected())
    }

    /// Check if process is in a terminal state
    pub fn is_terminal(&self) -> bool {
        matches!(
            self.status,
            ProcessStatus::Completed | ProcessStatus::Failed | ProcessStatus::Cancelled
        )
    }

    /// Check if process is running
    pub fn is_running(&self) -> bool {
        matches!(self.status, ProcessStatus::Running)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::DbService;
    use crate::db::models::{Agent, CreateAgent, AgentType, Session, CreateSession};

    #[tokio::test]
    async fn test_execution_process_crud() {
        let db = DbService::in_memory().await.unwrap();

        // Create an agent first (required by foreign key)
        let agent = Agent::create(
            &db.pool,
            &CreateAgent {
                id: None,
                name: "Test Agent".to_string(),
                agent_type: AgentType::ClaudeCode,
                config: None,
            },
        )
        .await
        .unwrap();

        // Create a session
        let session = Session::create(
            &db.pool,
            &CreateSession {
                id: None,
                agent_id: agent.id.clone(),
                task_id: None,
                prompt: None,
            },
        )
        .await
        .unwrap();

        // Create execution process
        let create_data = CreateExecutionProcess {
            id: None,
            session_id: session.id.clone(),
            pid: Some(12345),
        };
        let process = ExecutionProcess::create(&db.pool, &create_data).await.unwrap();
        assert_eq!(process.session_id, session.id);
        assert_eq!(process.status, ProcessStatus::Running);
        assert_eq!(process.pid, Some(12345));
        assert!(process.is_running());
        assert!(!process.is_terminal());

        // Find by ID
        let found = ExecutionProcess::find_by_id(&db.pool, &process.id).await.unwrap();
        assert!(found.is_some());
        assert_eq!(found.unwrap().session_id, session.id);

        // Find all
        let all = ExecutionProcess::find_all(&db.pool).await.unwrap();
        assert_eq!(all.len(), 1);

        // Find by session ID
        let by_session = ExecutionProcess::find_by_session_id(&db.pool, &session.id).await.unwrap();
        assert_eq!(by_session.len(), 1);

        // Find running
        let running = ExecutionProcess::find_running(&db.pool).await.unwrap();
        assert_eq!(running.len(), 1);

        // Find running by session ID
        let running_by_session = ExecutionProcess::find_running_by_session_id(&db.pool, &session.id).await.unwrap();
        assert_eq!(running_by_session.len(), 1);

        // Find latest by session ID
        let latest = ExecutionProcess::find_latest_by_session_id(&db.pool, &session.id).await.unwrap();
        assert!(latest.is_some());

        // Update
        let update_data = UpdateExecutionProcess {
            status: Some(ProcessStatus::Completed),
            exit_code: Some(0),
            pid: None,
        };
        let updated = ExecutionProcess::update(&db.pool, &process.id, &update_data).await.unwrap();
        assert_eq!(updated.status, ProcessStatus::Completed);
        assert_eq!(updated.exit_code, Some(0));
        assert!(updated.ended_at.is_some());
        assert!(updated.is_terminal());
        assert!(!updated.is_running());

        // Update completion (test mark_failed)
        // First, create another process
        let process2 = ExecutionProcess::create(
            &db.pool,
            &CreateExecutionProcess {
                id: None,
                session_id: session.id.clone(),
                pid: Some(12346),
            },
        )
        .await
        .unwrap();

        ExecutionProcess::mark_failed(&db.pool, &process2.id, Some(1)).await.unwrap();
        let failed = ExecutionProcess::find_by_id(&db.pool, &process2.id).await.unwrap().unwrap();
        assert_eq!(failed.status, ProcessStatus::Failed);
        assert_eq!(failed.exit_code, Some(1));

        // Test mark_cancelled
        let process3 = ExecutionProcess::create(
            &db.pool,
            &CreateExecutionProcess {
                id: None,
                session_id: session.id.clone(),
                pid: Some(12347),
            },
        )
        .await
        .unwrap();

        ExecutionProcess::mark_cancelled(&db.pool, &process3.id).await.unwrap();
        let cancelled = ExecutionProcess::find_by_id(&db.pool, &process3.id).await.unwrap().unwrap();
        assert_eq!(cancelled.status, ProcessStatus::Cancelled);

        // Find running (should be empty now)
        let running = ExecutionProcess::find_running(&db.pool).await.unwrap();
        assert_eq!(running.len(), 0);

        // Delete
        let deleted = ExecutionProcess::delete(&db.pool, &process.id).await.unwrap();
        assert_eq!(deleted, 1);

        // Verify deleted
        let not_found = ExecutionProcess::find_by_id(&db.pool, &process.id).await.unwrap();
        assert!(not_found.is_none());

        // Delete by session ID (should delete remaining processes)
        let deleted_by_session = ExecutionProcess::delete_by_session_id(&db.pool, &session.id).await.unwrap();
        assert_eq!(deleted_by_session, 2); // process2 and process3
    }
}
