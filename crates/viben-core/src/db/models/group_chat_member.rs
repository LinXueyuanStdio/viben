//! Group chat member model

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};
use ts_rs::TS;

use crate::db::DbError;

/// Member type enum
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[serde(rename_all = "snake_case")]
pub enum MemberType {
    Human,
    Agent,
    Executor,
}

impl std::fmt::Display for MemberType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MemberType::Human => write!(f, "human"),
            MemberType::Agent => write!(f, "agent"),
            MemberType::Executor => write!(f, "executor"),
        }
    }
}

impl std::str::FromStr for MemberType {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "human" => Ok(MemberType::Human),
            "agent" => Ok(MemberType::Agent),
            "executor" => Ok(MemberType::Executor),
            _ => Err(format!("Invalid member type: {}", s)),
        }
    }
}

impl Default for MemberType {
    fn default() -> Self {
        MemberType::Human
    }
}

/// Member role enum
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[serde(rename_all = "snake_case")]
pub enum MemberRole {
    Owner,
    Admin,
    Member,
}

impl std::fmt::Display for MemberRole {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MemberRole::Owner => write!(f, "owner"),
            MemberRole::Admin => write!(f, "admin"),
            MemberRole::Member => write!(f, "member"),
        }
    }
}

impl std::str::FromStr for MemberRole {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "owner" => Ok(MemberRole::Owner),
            "admin" => Ok(MemberRole::Admin),
            "member" => Ok(MemberRole::Member),
            _ => Err(format!("Invalid member role: {}", s)),
        }
    }
}

impl Default for MemberRole {
    fn default() -> Self {
        MemberRole::Member
    }
}

/// Group chat member entity
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct GroupChatMember {
    pub id: String,
    pub group_chat_id: String,
    pub member_type: MemberType,
    pub member_id: String,
    pub display_name: String,
    pub role: MemberRole,
    pub joined_at: DateTime<Utc>,
    pub last_seen_at: Option<DateTime<Utc>>,
}

/// Row type for database queries
#[derive(Debug, Clone, FromRow)]
struct GroupChatMemberRow {
    id: String,
    group_chat_id: String,
    member_type: String,
    member_id: String,
    display_name: String,
    role: String,
    joined_at: String,
    last_seen_at: Option<String>,
}

impl TryFrom<GroupChatMemberRow> for GroupChatMember {
    type Error = DbError;

    fn try_from(row: GroupChatMemberRow) -> Result<Self, Self::Error> {
        Ok(GroupChatMember {
            id: row.id,
            group_chat_id: row.group_chat_id,
            member_type: row.member_type.parse().map_err(|e: String| DbError::Migration(e))?,
            member_id: row.member_id,
            display_name: row.display_name,
            role: row.role.parse().map_err(|e: String| DbError::Migration(e))?,
            joined_at: DateTime::parse_from_rfc3339(&row.joined_at)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now()),
            last_seen_at: row.last_seen_at.and_then(|s| {
                DateTime::parse_from_rfc3339(&s)
                    .map(|dt| dt.with_timezone(&Utc))
                    .ok()
            }),
        })
    }
}

/// Create group chat member request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateGroupChatMember {
    pub id: Option<String>,
    pub group_chat_id: String,
    pub member_type: MemberType,
    pub member_id: String,
    pub display_name: String,
    pub role: Option<MemberRole>,
}

impl GroupChatMember {
    /// Find all members of a group chat
    pub async fn find_by_group_chat_id(pool: &SqlitePool, group_chat_id: &str) -> Result<Vec<Self>, DbError> {
        let rows = sqlx::query_as::<_, GroupChatMemberRow>(
            r#"SELECT id, group_chat_id, member_type, member_id, display_name, role, joined_at, last_seen_at
               FROM group_chat_members
               WHERE group_chat_id = ?
               ORDER BY joined_at ASC"#,
        )
        .bind(group_chat_id)
        .fetch_all(pool)
        .await?;

        rows.into_iter().map(GroupChatMember::try_from).collect()
    }

    /// Find a member by ID
    pub async fn find_by_id(pool: &SqlitePool, id: &str) -> Result<Option<Self>, DbError> {
        let row = sqlx::query_as::<_, GroupChatMemberRow>(
            r#"SELECT id, group_chat_id, member_type, member_id, display_name, role, joined_at, last_seen_at
               FROM group_chat_members
               WHERE id = ?"#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?;

        match row {
            Some(r) => Ok(Some(GroupChatMember::try_from(r)?)),
            None => Ok(None),
        }
    }

    /// Find a specific member in a group chat
    pub async fn find_by_member(
        pool: &SqlitePool,
        group_chat_id: &str,
        member_type: &MemberType,
        member_id: &str,
    ) -> Result<Option<Self>, DbError> {
        let row = sqlx::query_as::<_, GroupChatMemberRow>(
            r#"SELECT id, group_chat_id, member_type, member_id, display_name, role, joined_at, last_seen_at
               FROM group_chat_members
               WHERE group_chat_id = ? AND member_type = ? AND member_id = ?"#,
        )
        .bind(group_chat_id)
        .bind(member_type.to_string())
        .bind(member_id)
        .fetch_optional(pool)
        .await?;

        match row {
            Some(r) => Ok(Some(GroupChatMember::try_from(r)?)),
            None => Ok(None),
        }
    }

    /// Find all group chats a member belongs to
    pub async fn find_groups_by_member(
        pool: &SqlitePool,
        member_type: &MemberType,
        member_id: &str,
    ) -> Result<Vec<Self>, DbError> {
        let rows = sqlx::query_as::<_, GroupChatMemberRow>(
            r#"SELECT id, group_chat_id, member_type, member_id, display_name, role, joined_at, last_seen_at
               FROM group_chat_members
               WHERE member_type = ? AND member_id = ?
               ORDER BY joined_at DESC"#,
        )
        .bind(member_type.to_string())
        .bind(member_id)
        .fetch_all(pool)
        .await?;

        rows.into_iter().map(GroupChatMember::try_from).collect()
    }

    /// Create a new group chat member
    pub async fn create(pool: &SqlitePool, data: &CreateGroupChatMember) -> Result<Self, DbError> {
        let id = data.id.clone().unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
        let role = data.role.clone().unwrap_or_default();
        let now = Utc::now().to_rfc3339();

        sqlx::query(
            r#"INSERT INTO group_chat_members (id, group_chat_id, member_type, member_id, display_name, role, joined_at, last_seen_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, NULL)"#,
        )
        .bind(&id)
        .bind(&data.group_chat_id)
        .bind(data.member_type.to_string())
        .bind(&data.member_id)
        .bind(&data.display_name)
        .bind(role.to_string())
        .bind(&now)
        .execute(pool)
        .await?;

        Self::find_by_id(pool, &id)
            .await?
            .ok_or_else(|| DbError::NotFound("Group chat member not found after creation".to_string()))
    }

    /// Update a member's role
    pub async fn update_role(pool: &SqlitePool, id: &str, role: &MemberRole) -> Result<(), DbError> {
        let result = sqlx::query(
            r#"UPDATE group_chat_members SET role = ? WHERE id = ?"#,
        )
        .bind(role.to_string())
        .bind(id)
        .execute(pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(DbError::NotFound(format!("Group chat member {} not found", id)));
        }

        Ok(())
    }

    /// Update last seen timestamp
    pub async fn update_last_seen(pool: &SqlitePool, id: &str) -> Result<(), DbError> {
        let now = Utc::now().to_rfc3339();

        let result = sqlx::query(
            r#"UPDATE group_chat_members SET last_seen_at = ? WHERE id = ?"#,
        )
        .bind(&now)
        .bind(id)
        .execute(pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(DbError::NotFound(format!("Group chat member {} not found", id)));
        }

        Ok(())
    }

    /// Delete a member
    pub async fn delete(pool: &SqlitePool, id: &str) -> Result<u64, DbError> {
        let result = sqlx::query(r#"DELETE FROM group_chat_members WHERE id = ?"#)
            .bind(id)
            .execute(pool)
            .await?;

        Ok(result.rows_affected())
    }

    /// Delete a specific member from a group chat
    pub async fn delete_by_member(
        pool: &SqlitePool,
        group_chat_id: &str,
        member_type: &MemberType,
        member_id: &str,
    ) -> Result<u64, DbError> {
        let result = sqlx::query(
            r#"DELETE FROM group_chat_members WHERE group_chat_id = ? AND member_type = ? AND member_id = ?"#,
        )
        .bind(group_chat_id)
        .bind(member_type.to_string())
        .bind(member_id)
        .execute(pool)
        .await?;

        Ok(result.rows_affected())
    }

    /// Delete all members of a group chat
    pub async fn delete_by_group_chat_id(pool: &SqlitePool, group_chat_id: &str) -> Result<u64, DbError> {
        let result = sqlx::query(r#"DELETE FROM group_chat_members WHERE group_chat_id = ?"#)
            .bind(group_chat_id)
            .execute(pool)
            .await?;

        Ok(result.rows_affected())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::DbService;
    use crate::db::models::{GroupChat, CreateGroupChat};

    #[tokio::test]
    async fn test_group_chat_member_crud() {
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

        // Create member
        let create_data = CreateGroupChatMember {
            id: None,
            group_chat_id: group_chat.id.clone(),
            member_type: MemberType::Human,
            member_id: "user-1".to_string(),
            display_name: "User One".to_string(),
            role: Some(MemberRole::Owner),
        };
        let member = GroupChatMember::create(&db.pool, &create_data).await.unwrap();
        assert_eq!(member.member_type, MemberType::Human);
        assert_eq!(member.member_id, "user-1");
        assert_eq!(member.display_name, "User One");
        assert_eq!(member.role, MemberRole::Owner);

        // Find by ID
        let found = GroupChatMember::find_by_id(&db.pool, &member.id).await.unwrap();
        assert!(found.is_some());
        assert_eq!(found.unwrap().display_name, "User One");

        // Find by group chat ID
        let members = GroupChatMember::find_by_group_chat_id(&db.pool, &group_chat.id).await.unwrap();
        assert_eq!(members.len(), 1);

        // Find by member
        let found = GroupChatMember::find_by_member(
            &db.pool,
            &group_chat.id,
            &MemberType::Human,
            "user-1",
        )
        .await
        .unwrap();
        assert!(found.is_some());

        // Create another member
        let create_data2 = CreateGroupChatMember {
            id: None,
            group_chat_id: group_chat.id.clone(),
            member_type: MemberType::Agent,
            member_id: "claude-code".to_string(),
            display_name: "Claude Code".to_string(),
            role: None,  // Should default to Member
        };
        let member2 = GroupChatMember::create(&db.pool, &create_data2).await.unwrap();
        assert_eq!(member2.role, MemberRole::Member);

        // Find groups by member
        let groups = GroupChatMember::find_groups_by_member(&db.pool, &MemberType::Agent, "claude-code").await.unwrap();
        assert_eq!(groups.len(), 1);

        // Update role
        GroupChatMember::update_role(&db.pool, &member2.id, &MemberRole::Admin).await.unwrap();
        let updated = GroupChatMember::find_by_id(&db.pool, &member2.id).await.unwrap().unwrap();
        assert_eq!(updated.role, MemberRole::Admin);

        // Update last seen
        assert!(member.last_seen_at.is_none());
        GroupChatMember::update_last_seen(&db.pool, &member.id).await.unwrap();
        let updated = GroupChatMember::find_by_id(&db.pool, &member.id).await.unwrap().unwrap();
        assert!(updated.last_seen_at.is_some());

        // Delete by member
        let deleted = GroupChatMember::delete_by_member(
            &db.pool,
            &group_chat.id,
            &MemberType::Agent,
            "claude-code",
        )
        .await
        .unwrap();
        assert_eq!(deleted, 1);

        // Delete
        let deleted = GroupChatMember::delete(&db.pool, &member.id).await.unwrap();
        assert_eq!(deleted, 1);

        // Verify deleted
        let not_found = GroupChatMember::find_by_id(&db.pool, &member.id).await.unwrap();
        assert!(not_found.is_none());
    }
}
