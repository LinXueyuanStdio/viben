//! Group chat message model

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};
use ts_rs::TS;

use crate::db::DbError;
use super::group_chat_member::MemberType;

/// Message content type enum
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[serde(rename_all = "snake_case")]
pub enum MessageContentType {
    Text,
    Code,
    File,
    System,
    ToolCall,
}

impl std::fmt::Display for MessageContentType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MessageContentType::Text => write!(f, "text"),
            MessageContentType::Code => write!(f, "code"),
            MessageContentType::File => write!(f, "file"),
            MessageContentType::System => write!(f, "system"),
            MessageContentType::ToolCall => write!(f, "tool_call"),
        }
    }
}

impl std::str::FromStr for MessageContentType {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "text" => Ok(MessageContentType::Text),
            "code" => Ok(MessageContentType::Code),
            "file" => Ok(MessageContentType::File),
            "system" => Ok(MessageContentType::System),
            "tool_call" => Ok(MessageContentType::ToolCall),
            _ => Err(format!("Invalid message content type: {}", s)),
        }
    }
}

impl Default for MessageContentType {
    fn default() -> Self {
        MessageContentType::Text
    }
}

/// Group chat message entity
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct GroupChatMessage {
    pub id: String,
    pub group_chat_id: String,
    pub sender_id: String,
    pub sender_type: MemberType,
    pub sender_name: String,
    pub content_type: MessageContentType,
    pub content: String,
    pub mentions: Vec<String>,
    pub reply_to: Option<String>,
    pub metadata: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
}

/// Row type for database queries
#[derive(Debug, Clone, FromRow)]
struct GroupChatMessageRow {
    id: String,
    group_chat_id: String,
    sender_id: String,
    sender_type: String,
    sender_name: String,
    content_type: String,
    content: String,
    mentions: Option<String>,
    reply_to: Option<String>,
    metadata: Option<String>,
    created_at: String,
}

impl TryFrom<GroupChatMessageRow> for GroupChatMessage {
    type Error = DbError;

    fn try_from(row: GroupChatMessageRow) -> Result<Self, Self::Error> {
        Ok(GroupChatMessage {
            id: row.id,
            group_chat_id: row.group_chat_id,
            sender_id: row.sender_id,
            sender_type: row.sender_type.parse().map_err(|e: String| DbError::Migration(e))?,
            sender_name: row.sender_name,
            content_type: row.content_type.parse().map_err(|e: String| DbError::Migration(e))?,
            content: row.content,
            mentions: row
                .mentions
                .map(|s| serde_json::from_str(&s).unwrap_or_default())
                .unwrap_or_default(),
            reply_to: row.reply_to,
            metadata: row.metadata.and_then(|s| serde_json::from_str(&s).ok()),
            created_at: DateTime::parse_from_rfc3339(&row.created_at)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now()),
        })
    }
}

/// Create group chat message request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateGroupChatMessage {
    pub id: Option<String>,
    pub group_chat_id: String,
    pub sender_id: String,
    pub sender_type: MemberType,
    pub sender_name: String,
    pub content_type: Option<MessageContentType>,
    pub content: String,
    pub mentions: Option<Vec<String>>,
    pub reply_to: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

/// Query parameters for listing messages
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ListMessagesQuery {
    pub limit: Option<i64>,
    pub before: Option<String>,  // Message ID to fetch messages before
    pub after: Option<String>,   // Message ID to fetch messages after
}

impl GroupChatMessage {
    /// Find messages by group chat ID with optional pagination
    pub async fn find_by_group_chat_id(
        pool: &SqlitePool,
        group_chat_id: &str,
        query: Option<&ListMessagesQuery>,
    ) -> Result<Vec<Self>, DbError> {
        let limit = query
            .and_then(|q| q.limit)
            .unwrap_or(50)
            .min(100);

        let rows = if let Some(q) = query {
            if let Some(before) = &q.before {
                // Get messages before a specific message
                sqlx::query_as::<_, GroupChatMessageRow>(
                    r#"SELECT id, group_chat_id, sender_id, sender_type, sender_name, content_type, content, mentions, reply_to, metadata, created_at
                       FROM group_chat_messages
                       WHERE group_chat_id = ? AND created_at < (SELECT created_at FROM group_chat_messages WHERE id = ?)
                       ORDER BY created_at DESC
                       LIMIT ?"#,
                )
                .bind(group_chat_id)
                .bind(before)
                .bind(limit)
                .fetch_all(pool)
                .await?
            } else if let Some(after) = &q.after {
                // Get messages after a specific message
                sqlx::query_as::<_, GroupChatMessageRow>(
                    r#"SELECT id, group_chat_id, sender_id, sender_type, sender_name, content_type, content, mentions, reply_to, metadata, created_at
                       FROM group_chat_messages
                       WHERE group_chat_id = ? AND created_at > (SELECT created_at FROM group_chat_messages WHERE id = ?)
                       ORDER BY created_at ASC
                       LIMIT ?"#,
                )
                .bind(group_chat_id)
                .bind(after)
                .bind(limit)
                .fetch_all(pool)
                .await?
            } else {
                // Get latest messages
                sqlx::query_as::<_, GroupChatMessageRow>(
                    r#"SELECT id, group_chat_id, sender_id, sender_type, sender_name, content_type, content, mentions, reply_to, metadata, created_at
                       FROM group_chat_messages
                       WHERE group_chat_id = ?
                       ORDER BY created_at DESC
                       LIMIT ?"#,
                )
                .bind(group_chat_id)
                .bind(limit)
                .fetch_all(pool)
                .await?
            }
        } else {
            // Default: get latest messages
            sqlx::query_as::<_, GroupChatMessageRow>(
                r#"SELECT id, group_chat_id, sender_id, sender_type, sender_name, content_type, content, mentions, reply_to, metadata, created_at
                   FROM group_chat_messages
                   WHERE group_chat_id = ?
                   ORDER BY created_at DESC
                   LIMIT ?"#,
            )
            .bind(group_chat_id)
            .bind(limit)
            .fetch_all(pool)
            .await?
        };

        rows.into_iter().map(GroupChatMessage::try_from).collect()
    }

    /// Find a message by ID
    pub async fn find_by_id(pool: &SqlitePool, id: &str) -> Result<Option<Self>, DbError> {
        let row = sqlx::query_as::<_, GroupChatMessageRow>(
            r#"SELECT id, group_chat_id, sender_id, sender_type, sender_name, content_type, content, mentions, reply_to, metadata, created_at
               FROM group_chat_messages
               WHERE id = ?"#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?;

        match row {
            Some(r) => Ok(Some(GroupChatMessage::try_from(r)?)),
            None => Ok(None),
        }
    }

    /// Create a new message
    pub async fn create(pool: &SqlitePool, data: &CreateGroupChatMessage) -> Result<Self, DbError> {
        let id = data.id.clone().unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
        let content_type = data.content_type.clone().unwrap_or_default();
        let mentions = data.mentions.clone().unwrap_or_default();
        let mentions_json = serde_json::to_string(&mentions).unwrap_or_else(|_| "[]".to_string());
        let metadata_json = data.metadata.as_ref().map(|m| m.to_string());
        let now = Utc::now().to_rfc3339();

        sqlx::query(
            r#"INSERT INTO group_chat_messages (id, group_chat_id, sender_id, sender_type, sender_name, content_type, content, mentions, reply_to, metadata, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
        )
        .bind(&id)
        .bind(&data.group_chat_id)
        .bind(&data.sender_id)
        .bind(data.sender_type.to_string())
        .bind(&data.sender_name)
        .bind(content_type.to_string())
        .bind(&data.content)
        .bind(&mentions_json)
        .bind(&data.reply_to)
        .bind(&metadata_json)
        .bind(&now)
        .execute(pool)
        .await?;

        Self::find_by_id(pool, &id)
            .await?
            .ok_or_else(|| DbError::NotFound("Group chat message not found after creation".to_string()))
    }

    /// Delete a message
    pub async fn delete(pool: &SqlitePool, id: &str) -> Result<u64, DbError> {
        let result = sqlx::query(r#"DELETE FROM group_chat_messages WHERE id = ?"#)
            .bind(id)
            .execute(pool)
            .await?;

        Ok(result.rows_affected())
    }

    /// Delete all messages in a group chat
    pub async fn delete_by_group_chat_id(pool: &SqlitePool, group_chat_id: &str) -> Result<u64, DbError> {
        let result = sqlx::query(r#"DELETE FROM group_chat_messages WHERE group_chat_id = ?"#)
            .bind(group_chat_id)
            .execute(pool)
            .await?;

        Ok(result.rows_affected())
    }

    /// Count messages in a group chat
    pub async fn count_by_group_chat_id(pool: &SqlitePool, group_chat_id: &str) -> Result<i64, DbError> {
        let count: (i64,) = sqlx::query_as(
            r#"SELECT COUNT(*) FROM group_chat_messages WHERE group_chat_id = ?"#,
        )
        .bind(group_chat_id)
        .fetch_one(pool)
        .await?;

        Ok(count.0)
    }

    /// Find messages that mention a specific member
    pub async fn find_by_mention(
        pool: &SqlitePool,
        group_chat_id: &str,
        member_id: &str,
        limit: Option<i64>,
    ) -> Result<Vec<Self>, DbError> {
        let limit = limit.unwrap_or(50).min(100);

        // SQLite JSON functions to search in the mentions array
        let rows = sqlx::query_as::<_, GroupChatMessageRow>(
            r#"SELECT id, group_chat_id, sender_id, sender_type, sender_name, content_type, content, mentions, reply_to, metadata, created_at
               FROM group_chat_messages
               WHERE group_chat_id = ? AND mentions LIKE ?
               ORDER BY created_at DESC
               LIMIT ?"#,
        )
        .bind(group_chat_id)
        .bind(format!("%\"{}\"%" , member_id))
        .bind(limit)
        .fetch_all(pool)
        .await?;

        rows.into_iter().map(GroupChatMessage::try_from).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::DbService;
    use crate::db::models::{GroupChat, CreateGroupChat};

    #[tokio::test]
    async fn test_group_chat_message_crud() {
        let db = DbService::in_memory().await.unwrap();

        // Create a group chat first
        let group_chat = GroupChat::create(
            &db.pool,
            &CreateGroupChat {
                id: None,
                name: "Test Group".to_string(),
                description: None,
                task_id: None,
                created_by: "user-1".to_string(),
            },
        )
        .await
        .unwrap();

        // Create message
        let create_data = CreateGroupChatMessage {
            id: None,
            group_chat_id: group_chat.id.clone(),
            sender_id: "user-1".to_string(),
            sender_type: MemberType::Human,
            sender_name: "User One".to_string(),
            content_type: None,
            content: "Hello, everyone!".to_string(),
            mentions: None,
            reply_to: None,
            metadata: None,
        };
        let message = GroupChatMessage::create(&db.pool, &create_data).await.unwrap();
        assert_eq!(message.sender_id, "user-1");
        assert_eq!(message.sender_type, MemberType::Human);
        assert_eq!(message.content_type, MessageContentType::Text);
        assert_eq!(message.content, "Hello, everyone!");
        assert!(message.mentions.is_empty());

        // Find by ID
        let found = GroupChatMessage::find_by_id(&db.pool, &message.id).await.unwrap();
        assert!(found.is_some());
        assert_eq!(found.unwrap().content, "Hello, everyone!");

        // Find by group chat ID
        let messages = GroupChatMessage::find_by_group_chat_id(&db.pool, &group_chat.id, None).await.unwrap();
        assert_eq!(messages.len(), 1);

        // Count messages
        let count = GroupChatMessage::count_by_group_chat_id(&db.pool, &group_chat.id).await.unwrap();
        assert_eq!(count, 1);

        // Create message with mentions
        let create_data2 = CreateGroupChatMessage {
            id: None,
            group_chat_id: group_chat.id.clone(),
            sender_id: "user-1".to_string(),
            sender_type: MemberType::Human,
            sender_name: "User One".to_string(),
            content_type: Some(MessageContentType::Text),
            content: "@claude-code Please review this code".to_string(),
            mentions: Some(vec!["claude-code".to_string()]),
            reply_to: None,
            metadata: Some(serde_json::json!({"file": "main.rs"})),
        };
        let message2 = GroupChatMessage::create(&db.pool, &create_data2).await.unwrap();
        assert_eq!(message2.mentions, vec!["claude-code".to_string()]);
        assert!(message2.metadata.is_some());

        // Find by mention
        let mentioned = GroupChatMessage::find_by_mention(&db.pool, &group_chat.id, "claude-code", None).await.unwrap();
        assert_eq!(mentioned.len(), 1);
        assert_eq!(mentioned[0].id, message2.id);

        // Create reply
        let create_data3 = CreateGroupChatMessage {
            id: None,
            group_chat_id: group_chat.id.clone(),
            sender_id: "claude-code".to_string(),
            sender_type: MemberType::Agent,
            sender_name: "Claude Code".to_string(),
            content_type: Some(MessageContentType::Code),
            content: "```rust\nfn main() {}\n```".to_string(),
            mentions: None,
            reply_to: Some(message2.id.clone()),
            metadata: None,
        };
        let message3 = GroupChatMessage::create(&db.pool, &create_data3).await.unwrap();
        assert_eq!(message3.reply_to, Some(message2.id.clone()));
        assert_eq!(message3.content_type, MessageContentType::Code);

        // Pagination test - get with limit
        let query = ListMessagesQuery {
            limit: Some(2),
            before: None,
            after: None,
        };
        let messages = GroupChatMessage::find_by_group_chat_id(&db.pool, &group_chat.id, Some(&query)).await.unwrap();
        assert_eq!(messages.len(), 2);

        // Delete
        let deleted = GroupChatMessage::delete(&db.pool, &message.id).await.unwrap();
        assert_eq!(deleted, 1);

        // Verify deleted
        let not_found = GroupChatMessage::find_by_id(&db.pool, &message.id).await.unwrap();
        assert!(not_found.is_none());

        // Count after delete
        let count = GroupChatMessage::count_by_group_chat_id(&db.pool, &group_chat.id).await.unwrap();
        assert_eq!(count, 2);

        // Delete all messages in group chat
        let deleted = GroupChatMessage::delete_by_group_chat_id(&db.pool, &group_chat.id).await.unwrap();
        assert_eq!(deleted, 2);
    }
}
