//! Group chat model

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};
use ts_rs::TS;

use crate::db::DbError;

/// Group chat entity
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct GroupChat {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub task_id: Option<String>,
    pub created_by: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Row type for database queries
#[derive(Debug, Clone, FromRow)]
struct GroupChatRow {
    id: String,
    name: String,
    description: Option<String>,
    task_id: Option<String>,
    created_by: String,
    created_at: String,
    updated_at: String,
}

impl TryFrom<GroupChatRow> for GroupChat {
    type Error = DbError;

    fn try_from(row: GroupChatRow) -> Result<Self, Self::Error> {
        Ok(GroupChat {
            id: row.id,
            name: row.name,
            description: row.description,
            task_id: row.task_id,
            created_by: row.created_by,
            created_at: DateTime::parse_from_rfc3339(&row.created_at)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now()),
            updated_at: DateTime::parse_from_rfc3339(&row.updated_at)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now()),
        })
    }
}

/// Create group chat request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateGroupChat {
    pub id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub task_id: Option<String>,
    pub created_by: String,
}

/// Update group chat request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateGroupChat {
    pub name: Option<String>,
    pub description: Option<String>,
}

impl GroupChat {
    /// Find all group chats ordered by creation date (newest first)
    pub async fn find_all(pool: &SqlitePool) -> Result<Vec<Self>, DbError> {
        let rows = sqlx::query_as::<_, GroupChatRow>(
            r#"SELECT id, name, description, task_id, created_by, created_at, updated_at
               FROM group_chats
               ORDER BY created_at DESC"#,
        )
        .fetch_all(pool)
        .await?;

        rows.into_iter().map(GroupChat::try_from).collect()
    }

    /// Find a group chat by ID
    pub async fn find_by_id(pool: &SqlitePool, id: &str) -> Result<Option<Self>, DbError> {
        let row = sqlx::query_as::<_, GroupChatRow>(
            r#"SELECT id, name, description, task_id, created_by, created_at, updated_at
               FROM group_chats
               WHERE id = ?"#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?;

        match row {
            Some(r) => Ok(Some(GroupChat::try_from(r)?)),
            None => Ok(None),
        }
    }

    /// Find group chats by task ID
    pub async fn find_by_task_id(pool: &SqlitePool, task_id: &str) -> Result<Vec<Self>, DbError> {
        let rows = sqlx::query_as::<_, GroupChatRow>(
            r#"SELECT id, name, description, task_id, created_by, created_at, updated_at
               FROM group_chats
               WHERE task_id = ?
               ORDER BY created_at DESC"#,
        )
        .bind(task_id)
        .fetch_all(pool)
        .await?;

        rows.into_iter().map(GroupChat::try_from).collect()
    }

    /// Find group chats created by a specific user
    pub async fn find_by_creator(pool: &SqlitePool, created_by: &str) -> Result<Vec<Self>, DbError> {
        let rows = sqlx::query_as::<_, GroupChatRow>(
            r#"SELECT id, name, description, task_id, created_by, created_at, updated_at
               FROM group_chats
               WHERE created_by = ?
               ORDER BY created_at DESC"#,
        )
        .bind(created_by)
        .fetch_all(pool)
        .await?;

        rows.into_iter().map(GroupChat::try_from).collect()
    }

    /// Create a new group chat
    pub async fn create(pool: &SqlitePool, data: &CreateGroupChat) -> Result<Self, DbError> {
        let id = data.id.clone().unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
        let now = Utc::now().to_rfc3339();

        sqlx::query(
            r#"INSERT INTO group_chats (id, name, description, task_id, created_by, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)"#,
        )
        .bind(&id)
        .bind(&data.name)
        .bind(&data.description)
        .bind(&data.task_id)
        .bind(&data.created_by)
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await?;

        Self::find_by_id(pool, &id)
            .await?
            .ok_or_else(|| DbError::NotFound("Group chat not found after creation".to_string()))
    }

    /// Update a group chat
    pub async fn update(pool: &SqlitePool, id: &str, data: &UpdateGroupChat) -> Result<Self, DbError> {
        // First fetch the existing group chat
        let existing = Self::find_by_id(pool, id)
            .await?
            .ok_or_else(|| DbError::NotFound(format!("Group chat {} not found", id)))?;

        // Apply updates
        let name = data.name.clone().unwrap_or(existing.name);
        let description = data.description.clone().or(existing.description);
        let now = Utc::now().to_rfc3339();

        sqlx::query(
            r#"UPDATE group_chats
               SET name = ?, description = ?, updated_at = ?
               WHERE id = ?"#,
        )
        .bind(&name)
        .bind(&description)
        .bind(&now)
        .bind(id)
        .execute(pool)
        .await?;

        Self::find_by_id(pool, id)
            .await?
            .ok_or_else(|| DbError::NotFound(format!("Group chat {} not found after update", id)))
    }

    /// Delete a group chat
    pub async fn delete(pool: &SqlitePool, id: &str) -> Result<u64, DbError> {
        let result = sqlx::query(r#"DELETE FROM group_chats WHERE id = ?"#)
            .bind(id)
            .execute(pool)
            .await?;

        Ok(result.rows_affected())
    }

    /// Delete all group chats for a task
    pub async fn delete_by_task_id(pool: &SqlitePool, task_id: &str) -> Result<u64, DbError> {
        let result = sqlx::query(r#"DELETE FROM group_chats WHERE task_id = ?"#)
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

    #[tokio::test]
    async fn test_group_chat_crud() {
        let db = DbService::in_memory().await.unwrap();

        // Create
        let create_data = CreateGroupChat {
            id: None,
            name: "Test Group Chat".to_string(),
            description: Some("Test description".to_string()),
            task_id: None,
            created_by: "user-1".to_string(),
        };
        let group_chat = GroupChat::create(&db.pool, &create_data).await.unwrap();
        assert_eq!(group_chat.name, "Test Group Chat");
        assert_eq!(group_chat.description, Some("Test description".to_string()));
        assert_eq!(group_chat.created_by, "user-1");

        // Find by ID
        let found = GroupChat::find_by_id(&db.pool, &group_chat.id).await.unwrap();
        assert!(found.is_some());
        assert_eq!(found.unwrap().name, "Test Group Chat");

        // Find all
        let all = GroupChat::find_all(&db.pool).await.unwrap();
        assert_eq!(all.len(), 1);

        // Find by creator
        let by_creator = GroupChat::find_by_creator(&db.pool, "user-1").await.unwrap();
        assert_eq!(by_creator.len(), 1);

        // Update
        let update_data = UpdateGroupChat {
            name: Some("Updated Group Chat".to_string()),
            description: None,
        };
        let updated = GroupChat::update(&db.pool, &group_chat.id, &update_data).await.unwrap();
        assert_eq!(updated.name, "Updated Group Chat");
        assert_eq!(updated.description, Some("Test description".to_string()));

        // Delete
        let deleted = GroupChat::delete(&db.pool, &group_chat.id).await.unwrap();
        assert_eq!(deleted, 1);

        // Verify deleted
        let not_found = GroupChat::find_by_id(&db.pool, &group_chat.id).await.unwrap();
        assert!(not_found.is_none());
    }
}
