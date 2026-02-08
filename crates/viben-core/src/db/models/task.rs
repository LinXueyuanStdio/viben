//! Task model

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};
use ts_rs::TS;

use crate::db::DbError;

/// Task status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[serde(rename_all = "lowercase")]
pub enum TaskStatus {
    Todo,
    InProgress,
    Done,
    Cancelled,
    InReview,
}

impl std::fmt::Display for TaskStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TaskStatus::Todo => write!(f, "todo"),
            TaskStatus::InProgress => write!(f, "inprogress"),
            TaskStatus::Done => write!(f, "done"),
            TaskStatus::Cancelled => write!(f, "cancelled"),
            TaskStatus::InReview => write!(f, "inreview"),
        }
    }
}

impl std::str::FromStr for TaskStatus {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "todo" => Ok(TaskStatus::Todo),
            "inprogress" => Ok(TaskStatus::InProgress),
            "done" => Ok(TaskStatus::Done),
            "cancelled" => Ok(TaskStatus::Cancelled),
            "inreview" => Ok(TaskStatus::InReview),
            _ => Err(format!("Invalid task status: {}", s)),
        }
    }
}

impl Default for TaskStatus {
    fn default() -> Self {
        TaskStatus::Todo
    }
}

/// Task entity
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct Task {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub status: TaskStatus,
    pub agent_id: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Row type for database queries
#[derive(Debug, Clone, FromRow)]
struct TaskRow {
    id: String,
    title: String,
    description: Option<String>,
    status: String,
    agent_id: Option<String>,
    created_at: String,
    updated_at: String,
}

impl TryFrom<TaskRow> for Task {
    type Error = DbError;

    fn try_from(row: TaskRow) -> Result<Self, Self::Error> {
        Ok(Task {
            id: row.id,
            title: row.title,
            description: row.description,
            status: row.status.parse().map_err(|e: String| DbError::Migration(e))?,
            agent_id: row.agent_id,
            created_at: DateTime::parse_from_rfc3339(&row.created_at)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now()),
            updated_at: DateTime::parse_from_rfc3339(&row.updated_at)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now()),
        })
    }
}

/// Create task request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTask {
    pub id: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub agent_id: Option<String>,
}

/// Update task request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateTask {
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: Option<TaskStatus>,
    pub agent_id: Option<String>,
}

impl Task {
    /// Find all tasks ordered by creation date (newest first)
    pub async fn find_all(pool: &SqlitePool) -> Result<Vec<Self>, DbError> {
        let rows = sqlx::query_as::<_, TaskRow>(
            r#"SELECT id, title, description, status, agent_id, created_at, updated_at
               FROM tasks
               ORDER BY created_at DESC"#,
        )
        .fetch_all(pool)
        .await?;

        rows.into_iter().map(Task::try_from).collect()
    }

    /// Find a task by ID
    pub async fn find_by_id(pool: &SqlitePool, id: &str) -> Result<Option<Self>, DbError> {
        let row = sqlx::query_as::<_, TaskRow>(
            r#"SELECT id, title, description, status, agent_id, created_at, updated_at
               FROM tasks
               WHERE id = ?"#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?;

        match row {
            Some(r) => Ok(Some(Task::try_from(r)?)),
            None => Ok(None),
        }
    }

    /// Find tasks by agent ID
    pub async fn find_by_agent_id(pool: &SqlitePool, agent_id: &str) -> Result<Vec<Self>, DbError> {
        let rows = sqlx::query_as::<_, TaskRow>(
            r#"SELECT id, title, description, status, agent_id, created_at, updated_at
               FROM tasks
               WHERE agent_id = ?
               ORDER BY created_at DESC"#,
        )
        .bind(agent_id)
        .fetch_all(pool)
        .await?;

        rows.into_iter().map(Task::try_from).collect()
    }

    /// Find tasks by status
    pub async fn find_by_status(pool: &SqlitePool, status: &TaskStatus) -> Result<Vec<Self>, DbError> {
        let rows = sqlx::query_as::<_, TaskRow>(
            r#"SELECT id, title, description, status, agent_id, created_at, updated_at
               FROM tasks
               WHERE status = ?
               ORDER BY created_at DESC"#,
        )
        .bind(status.to_string())
        .fetch_all(pool)
        .await?;

        rows.into_iter().map(Task::try_from).collect()
    }

    /// Create a new task
    pub async fn create(pool: &SqlitePool, data: &CreateTask) -> Result<Self, DbError> {
        let id = data.id.clone().unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
        let status = TaskStatus::default();
        let now = Utc::now().to_rfc3339();

        sqlx::query(
            r#"INSERT INTO tasks (id, title, description, status, agent_id, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)"#,
        )
        .bind(&id)
        .bind(&data.title)
        .bind(&data.description)
        .bind(status.to_string())
        .bind(&data.agent_id)
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await?;

        Self::find_by_id(pool, &id)
            .await?
            .ok_or_else(|| DbError::NotFound("Task not found after creation".to_string()))
    }

    /// Update a task
    pub async fn update(pool: &SqlitePool, id: &str, data: &UpdateTask) -> Result<Self, DbError> {
        // First fetch the existing task
        let existing = Self::find_by_id(pool, id)
            .await?
            .ok_or_else(|| DbError::NotFound(format!("Task {} not found", id)))?;

        // Apply updates
        let title = data.title.clone().unwrap_or(existing.title);
        let description = data.description.clone().or(existing.description);
        let status = data.status.clone().unwrap_or(existing.status);
        let agent_id = data.agent_id.clone().or(existing.agent_id);
        let now = Utc::now().to_rfc3339();

        sqlx::query(
            r#"UPDATE tasks
               SET title = ?, description = ?, status = ?, agent_id = ?, updated_at = ?
               WHERE id = ?"#,
        )
        .bind(&title)
        .bind(&description)
        .bind(status.to_string())
        .bind(&agent_id)
        .bind(&now)
        .bind(id)
        .execute(pool)
        .await?;

        Self::find_by_id(pool, id)
            .await?
            .ok_or_else(|| DbError::NotFound(format!("Task {} not found after update", id)))
    }

    /// Update task status only
    pub async fn update_status(
        pool: &SqlitePool,
        id: &str,
        status: &TaskStatus,
    ) -> Result<(), DbError> {
        let now = Utc::now().to_rfc3339();

        let result = sqlx::query(
            r#"UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?"#,
        )
        .bind(status.to_string())
        .bind(&now)
        .bind(id)
        .execute(pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(DbError::NotFound(format!("Task {} not found", id)));
        }

        Ok(())
    }

    /// Delete a task
    pub async fn delete(pool: &SqlitePool, id: &str) -> Result<u64, DbError> {
        let result = sqlx::query(r#"DELETE FROM tasks WHERE id = ?"#)
            .bind(id)
            .execute(pool)
            .await?;

        Ok(result.rows_affected())
    }

    /// Generate a prompt string from the task
    pub fn to_prompt(&self) -> String {
        if let Some(description) = self.description.as_ref().filter(|d| !d.trim().is_empty()) {
            format!("{}\n\n{}", &self.title, description)
        } else {
            self.title.clone()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::DbService;

    #[tokio::test]
    async fn test_task_crud() {
        let db = DbService::in_memory().await.unwrap();

        // Create
        let create_data = CreateTask {
            id: None,
            title: "Test Task".to_string(),
            description: Some("Test description".to_string()),
            agent_id: None,
        };
        let task = Task::create(&db.pool, &create_data).await.unwrap();
        assert_eq!(task.title, "Test Task");
        assert_eq!(task.status, TaskStatus::Todo);

        // Find by ID
        let found = Task::find_by_id(&db.pool, &task.id).await.unwrap();
        assert!(found.is_some());
        assert_eq!(found.unwrap().title, "Test Task");

        // Find all
        let all = Task::find_all(&db.pool).await.unwrap();
        assert_eq!(all.len(), 1);

        // Update
        let update_data = UpdateTask {
            title: Some("Updated Task".to_string()),
            description: None,
            status: Some(TaskStatus::InProgress),
            agent_id: None,
        };
        let updated = Task::update(&db.pool, &task.id, &update_data).await.unwrap();
        assert_eq!(updated.title, "Updated Task");
        assert_eq!(updated.status, TaskStatus::InProgress);

        // Update status
        Task::update_status(&db.pool, &task.id, &TaskStatus::Done).await.unwrap();
        let found = Task::find_by_id(&db.pool, &task.id).await.unwrap().unwrap();
        assert_eq!(found.status, TaskStatus::Done);

        // Find by status
        let by_status = Task::find_by_status(&db.pool, &TaskStatus::Done).await.unwrap();
        assert_eq!(by_status.len(), 1);

        // Delete
        let deleted = Task::delete(&db.pool, &task.id).await.unwrap();
        assert_eq!(deleted, 1);

        // Verify deleted
        let not_found = Task::find_by_id(&db.pool, &task.id).await.unwrap();
        assert!(not_found.is_none());
    }
}
