//! Session model

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};
use ts_rs::TS;

use crate::db::DbError;

/// Session status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[serde(rename_all = "lowercase")]
pub enum SessionStatus {
    Active,
    Completed,
    Cancelled,
}

impl std::fmt::Display for SessionStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SessionStatus::Active => write!(f, "active"),
            SessionStatus::Completed => write!(f, "completed"),
            SessionStatus::Cancelled => write!(f, "cancelled"),
        }
    }
}

impl std::str::FromStr for SessionStatus {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "active" => Ok(SessionStatus::Active),
            "completed" => Ok(SessionStatus::Completed),
            "cancelled" => Ok(SessionStatus::Cancelled),
            _ => Err(format!("Invalid session status: {}", s)),
        }
    }
}

impl Default for SessionStatus {
    fn default() -> Self {
        SessionStatus::Active
    }
}

/// Session entity
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct Session {
    pub id: String,
    pub agent_id: String,
    pub task_id: Option<String>,
    pub status: SessionStatus,
    pub prompt: Option<String>,
    pub session_data: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Row type for database queries
#[derive(Debug, Clone, FromRow)]
struct SessionRow {
    id: String,
    agent_id: String,
    task_id: Option<String>,
    status: String,
    prompt: Option<String>,
    session_data: String,
    created_at: String,
    updated_at: String,
}

impl TryFrom<SessionRow> for Session {
    type Error = DbError;

    fn try_from(row: SessionRow) -> Result<Self, Self::Error> {
        Ok(Session {
            id: row.id,
            agent_id: row.agent_id,
            task_id: row.task_id,
            status: row.status.parse().map_err(|e: String| DbError::Migration(e))?,
            prompt: row.prompt,
            session_data: serde_json::from_str(&row.session_data)
                .unwrap_or(serde_json::json!({})),
            created_at: DateTime::parse_from_rfc3339(&row.created_at)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now()),
            updated_at: DateTime::parse_from_rfc3339(&row.updated_at)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now()),
        })
    }
}

/// Create session request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSession {
    pub id: Option<String>,
    pub agent_id: String,
    pub task_id: Option<String>,
    pub prompt: Option<String>,
}

/// Update session request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateSession {
    pub status: Option<SessionStatus>,
    pub session_data: Option<serde_json::Value>,
    pub prompt: Option<String>,
}

impl Session {
    /// Find all sessions ordered by creation date (newest first)
    pub async fn find_all(pool: &SqlitePool) -> Result<Vec<Self>, DbError> {
        let rows = sqlx::query_as::<_, SessionRow>(
            r#"SELECT id, agent_id, task_id, status, prompt, session_data, created_at, updated_at
               FROM sessions
               ORDER BY created_at DESC"#,
        )
        .fetch_all(pool)
        .await?;

        rows.into_iter().map(Session::try_from).collect()
    }

    /// Find a session by ID
    pub async fn find_by_id(pool: &SqlitePool, id: &str) -> Result<Option<Self>, DbError> {
        let row = sqlx::query_as::<_, SessionRow>(
            r#"SELECT id, agent_id, task_id, status, prompt, session_data, created_at, updated_at
               FROM sessions
               WHERE id = ?"#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?;

        match row {
            Some(r) => Ok(Some(Session::try_from(r)?)),
            None => Ok(None),
        }
    }

    /// Find sessions by task ID
    pub async fn find_by_task_id(pool: &SqlitePool, task_id: &str) -> Result<Vec<Self>, DbError> {
        let rows = sqlx::query_as::<_, SessionRow>(
            r#"SELECT id, agent_id, task_id, status, prompt, session_data, created_at, updated_at
               FROM sessions
               WHERE task_id = ?
               ORDER BY created_at DESC"#,
        )
        .bind(task_id)
        .fetch_all(pool)
        .await?;

        rows.into_iter().map(Session::try_from).collect()
    }

    /// Find sessions by agent ID
    pub async fn find_by_agent_id(pool: &SqlitePool, agent_id: &str) -> Result<Vec<Self>, DbError> {
        let rows = sqlx::query_as::<_, SessionRow>(
            r#"SELECT id, agent_id, task_id, status, prompt, session_data, created_at, updated_at
               FROM sessions
               WHERE agent_id = ?
               ORDER BY created_at DESC"#,
        )
        .bind(agent_id)
        .fetch_all(pool)
        .await?;

        rows.into_iter().map(Session::try_from).collect()
    }

    /// Find sessions by status
    pub async fn find_by_status(pool: &SqlitePool, status: &SessionStatus) -> Result<Vec<Self>, DbError> {
        let rows = sqlx::query_as::<_, SessionRow>(
            r#"SELECT id, agent_id, task_id, status, prompt, session_data, created_at, updated_at
               FROM sessions
               WHERE status = ?
               ORDER BY created_at DESC"#,
        )
        .bind(status.to_string())
        .fetch_all(pool)
        .await?;

        rows.into_iter().map(Session::try_from).collect()
    }

    /// Find the latest session for a task
    pub async fn find_latest_by_task_id(
        pool: &SqlitePool,
        task_id: &str,
    ) -> Result<Option<Self>, DbError> {
        let row = sqlx::query_as::<_, SessionRow>(
            r#"SELECT id, agent_id, task_id, status, prompt, session_data, created_at, updated_at
               FROM sessions
               WHERE task_id = ?
               ORDER BY created_at DESC
               LIMIT 1"#,
        )
        .bind(task_id)
        .fetch_optional(pool)
        .await?;

        match row {
            Some(r) => Ok(Some(Session::try_from(r)?)),
            None => Ok(None),
        }
    }

    /// Create a new session
    pub async fn create(pool: &SqlitePool, data: &CreateSession) -> Result<Self, DbError> {
        let id = data.id.clone().unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
        let status = SessionStatus::default();
        let session_data = serde_json::json!({});
        let now = Utc::now().to_rfc3339();

        sqlx::query(
            r#"INSERT INTO sessions (id, agent_id, task_id, status, prompt, session_data, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)"#,
        )
        .bind(&id)
        .bind(&data.agent_id)
        .bind(&data.task_id)
        .bind(status.to_string())
        .bind(&data.prompt)
        .bind(session_data.to_string())
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await?;

        Self::find_by_id(pool, &id)
            .await?
            .ok_or_else(|| DbError::NotFound("Session not found after creation".to_string()))
    }

    /// Update a session
    pub async fn update(pool: &SqlitePool, id: &str, data: &UpdateSession) -> Result<Self, DbError> {
        // First fetch the existing session
        let existing = Self::find_by_id(pool, id)
            .await?
            .ok_or_else(|| DbError::NotFound(format!("Session {} not found", id)))?;

        // Apply updates
        let status = data.status.clone().unwrap_or(existing.status);
        let session_data = data.session_data.clone().unwrap_or(existing.session_data);
        let prompt = data.prompt.clone().or(existing.prompt);
        let now = Utc::now().to_rfc3339();

        sqlx::query(
            r#"UPDATE sessions
               SET status = ?, session_data = ?, prompt = ?, updated_at = ?
               WHERE id = ?"#,
        )
        .bind(status.to_string())
        .bind(session_data.to_string())
        .bind(&prompt)
        .bind(&now)
        .bind(id)
        .execute(pool)
        .await?;

        Self::find_by_id(pool, id)
            .await?
            .ok_or_else(|| DbError::NotFound(format!("Session {} not found after update", id)))
    }

    /// Update session status only
    pub async fn update_status(
        pool: &SqlitePool,
        id: &str,
        status: &SessionStatus,
    ) -> Result<(), DbError> {
        let now = Utc::now().to_rfc3339();

        let result = sqlx::query(
            r#"UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?"#,
        )
        .bind(status.to_string())
        .bind(&now)
        .bind(id)
        .execute(pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(DbError::NotFound(format!("Session {} not found", id)));
        }

        Ok(())
    }

    /// Update session data
    pub async fn update_session_data(
        pool: &SqlitePool,
        id: &str,
        session_data: &serde_json::Value,
    ) -> Result<(), DbError> {
        let now = Utc::now().to_rfc3339();

        let result = sqlx::query(
            r#"UPDATE sessions SET session_data = ?, updated_at = ? WHERE id = ?"#,
        )
        .bind(session_data.to_string())
        .bind(&now)
        .bind(id)
        .execute(pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(DbError::NotFound(format!("Session {} not found", id)));
        }

        Ok(())
    }

    /// Delete a session
    pub async fn delete(pool: &SqlitePool, id: &str) -> Result<u64, DbError> {
        let result = sqlx::query(r#"DELETE FROM sessions WHERE id = ?"#)
            .bind(id)
            .execute(pool)
            .await?;

        Ok(result.rows_affected())
    }

    /// Delete all sessions for a task
    pub async fn delete_by_task_id(pool: &SqlitePool, task_id: &str) -> Result<u64, DbError> {
        let result = sqlx::query(r#"DELETE FROM sessions WHERE task_id = ?"#)
            .bind(task_id)
            .execute(pool)
            .await?;

        Ok(result.rows_affected())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::DbService;
    use crate::db::models::{Agent, CreateAgent, AgentType, Task, CreateTask};

    #[tokio::test]
    async fn test_session_crud() {
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

        // Create a task
        let task = Task::create(
            &db.pool,
            &CreateTask {
                id: None,
                title: "Test Task".to_string(),
                description: None,
                agent_id: Some(agent.id.clone()),
            },
        )
        .await
        .unwrap();

        // Create session
        let create_data = CreateSession {
            id: None,
            agent_id: agent.id.clone(),
            task_id: Some(task.id.clone()),
            prompt: Some("Test prompt".to_string()),
        };
        let session = Session::create(&db.pool, &create_data).await.unwrap();
        assert_eq!(session.agent_id, agent.id);
        assert_eq!(session.status, SessionStatus::Active);
        assert_eq!(session.prompt, Some("Test prompt".to_string()));

        // Find by ID
        let found = Session::find_by_id(&db.pool, &session.id).await.unwrap();
        assert!(found.is_some());
        assert_eq!(found.unwrap().agent_id, agent.id);

        // Find all
        let all = Session::find_all(&db.pool).await.unwrap();
        assert_eq!(all.len(), 1);

        // Find by task ID
        let by_task = Session::find_by_task_id(&db.pool, &task.id).await.unwrap();
        assert_eq!(by_task.len(), 1);

        // Find by agent ID
        let by_agent = Session::find_by_agent_id(&db.pool, &agent.id).await.unwrap();
        assert_eq!(by_agent.len(), 1);

        // Find latest by task ID
        let latest = Session::find_latest_by_task_id(&db.pool, &task.id).await.unwrap();
        assert!(latest.is_some());

        // Update
        let update_data = UpdateSession {
            status: Some(SessionStatus::Completed),
            session_data: Some(serde_json::json!({"key": "value"})),
            prompt: None,
        };
        let updated = Session::update(&db.pool, &session.id, &update_data).await.unwrap();
        assert_eq!(updated.status, SessionStatus::Completed);
        assert_eq!(updated.session_data["key"], "value");

        // Update status
        Session::update_status(&db.pool, &session.id, &SessionStatus::Cancelled).await.unwrap();
        let found = Session::find_by_id(&db.pool, &session.id).await.unwrap().unwrap();
        assert_eq!(found.status, SessionStatus::Cancelled);

        // Find by status
        let by_status = Session::find_by_status(&db.pool, &SessionStatus::Cancelled).await.unwrap();
        assert_eq!(by_status.len(), 1);

        // Update session data
        let new_data = serde_json::json!({"updated": true});
        Session::update_session_data(&db.pool, &session.id, &new_data).await.unwrap();
        let found = Session::find_by_id(&db.pool, &session.id).await.unwrap().unwrap();
        assert_eq!(found.session_data["updated"], true);

        // Delete
        let deleted = Session::delete(&db.pool, &session.id).await.unwrap();
        assert_eq!(deleted, 1);

        // Verify deleted
        let not_found = Session::find_by_id(&db.pool, &session.id).await.unwrap();
        assert!(not_found.is_none());
    }
}
