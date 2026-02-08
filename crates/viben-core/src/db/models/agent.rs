//! Agent model

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};
use ts_rs::TS;

use crate::db::DbError;

/// Agent type enum matching the CodingAgent enum
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AgentType {
    ClaudeCode,
    Amp,
    Gemini,
    Codex,
    Opencode,
    CursorAgent,
    QwenCode,
    Copilot,
    Droid,
}

impl std::fmt::Display for AgentType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AgentType::ClaudeCode => write!(f, "CLAUDE_CODE"),
            AgentType::Amp => write!(f, "AMP"),
            AgentType::Gemini => write!(f, "GEMINI"),
            AgentType::Codex => write!(f, "CODEX"),
            AgentType::Opencode => write!(f, "OPENCODE"),
            AgentType::CursorAgent => write!(f, "CURSOR_AGENT"),
            AgentType::QwenCode => write!(f, "QWEN_CODE"),
            AgentType::Copilot => write!(f, "COPILOT"),
            AgentType::Droid => write!(f, "DROID"),
        }
    }
}

impl std::str::FromStr for AgentType {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "CLAUDE_CODE" => Ok(AgentType::ClaudeCode),
            "AMP" => Ok(AgentType::Amp),
            "GEMINI" => Ok(AgentType::Gemini),
            "CODEX" => Ok(AgentType::Codex),
            "OPENCODE" => Ok(AgentType::Opencode),
            "CURSOR_AGENT" => Ok(AgentType::CursorAgent),
            "QWEN_CODE" => Ok(AgentType::QwenCode),
            "COPILOT" => Ok(AgentType::Copilot),
            "DROID" => Ok(AgentType::Droid),
            _ => Err(format!("Invalid agent type: {}", s)),
        }
    }
}

impl Default for AgentType {
    fn default() -> Self {
        AgentType::ClaudeCode
    }
}

/// Agent entity
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct Agent {
    pub id: String,
    pub name: String,
    pub agent_type: AgentType,
    pub config: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Row type for database queries
#[derive(Debug, Clone, FromRow)]
struct AgentRow {
    id: String,
    name: String,
    agent_type: String,
    config: String,
    created_at: String,
    updated_at: String,
}

impl TryFrom<AgentRow> for Agent {
    type Error = DbError;

    fn try_from(row: AgentRow) -> Result<Self, Self::Error> {
        Ok(Agent {
            id: row.id,
            name: row.name,
            agent_type: row.agent_type.parse().map_err(|e: String| DbError::Migration(e))?,
            config: serde_json::from_str(&row.config).unwrap_or(serde_json::json!({})),
            created_at: DateTime::parse_from_rfc3339(&row.created_at)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now()),
            updated_at: DateTime::parse_from_rfc3339(&row.updated_at)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now()),
        })
    }
}

/// Create agent request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateAgent {
    pub id: Option<String>,
    pub name: String,
    pub agent_type: AgentType,
    pub config: Option<serde_json::Value>,
}

/// Update agent request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateAgent {
    pub name: Option<String>,
    pub config: Option<serde_json::Value>,
}

impl Agent {
    /// Find all agents ordered by creation date (newest first)
    pub async fn find_all(pool: &SqlitePool) -> Result<Vec<Self>, DbError> {
        let rows = sqlx::query_as::<_, AgentRow>(
            r#"SELECT id, name, agent_type, config, created_at, updated_at
               FROM agents
               ORDER BY created_at DESC"#,
        )
        .fetch_all(pool)
        .await?;

        rows.into_iter().map(Agent::try_from).collect()
    }

    /// Find an agent by ID
    pub async fn find_by_id(pool: &SqlitePool, id: &str) -> Result<Option<Self>, DbError> {
        let row = sqlx::query_as::<_, AgentRow>(
            r#"SELECT id, name, agent_type, config, created_at, updated_at
               FROM agents
               WHERE id = ?"#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?;

        match row {
            Some(r) => Ok(Some(Agent::try_from(r)?)),
            None => Ok(None),
        }
    }

    /// Find agents by type
    pub async fn find_by_type(pool: &SqlitePool, agent_type: &AgentType) -> Result<Vec<Self>, DbError> {
        let rows = sqlx::query_as::<_, AgentRow>(
            r#"SELECT id, name, agent_type, config, created_at, updated_at
               FROM agents
               WHERE agent_type = ?
               ORDER BY created_at DESC"#,
        )
        .bind(agent_type.to_string())
        .fetch_all(pool)
        .await?;

        rows.into_iter().map(Agent::try_from).collect()
    }

    /// Create a new agent
    pub async fn create(pool: &SqlitePool, data: &CreateAgent) -> Result<Self, DbError> {
        let id = data.id.clone().unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
        let config = data.config.clone().unwrap_or(serde_json::json!({}));
        let now = Utc::now().to_rfc3339();

        sqlx::query(
            r#"INSERT INTO agents (id, name, agent_type, config, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?)"#,
        )
        .bind(&id)
        .bind(&data.name)
        .bind(data.agent_type.to_string())
        .bind(config.to_string())
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await?;

        Self::find_by_id(pool, &id)
            .await?
            .ok_or_else(|| DbError::NotFound("Agent not found after creation".to_string()))
    }

    /// Update an agent
    pub async fn update(pool: &SqlitePool, id: &str, data: &UpdateAgent) -> Result<Self, DbError> {
        // First fetch the existing agent
        let existing = Self::find_by_id(pool, id)
            .await?
            .ok_or_else(|| DbError::NotFound(format!("Agent {} not found", id)))?;

        // Apply updates
        let name = data.name.clone().unwrap_or(existing.name);
        let config = data.config.clone().unwrap_or(existing.config);
        let now = Utc::now().to_rfc3339();

        sqlx::query(
            r#"UPDATE agents
               SET name = ?, config = ?, updated_at = ?
               WHERE id = ?"#,
        )
        .bind(&name)
        .bind(config.to_string())
        .bind(&now)
        .bind(id)
        .execute(pool)
        .await?;

        Self::find_by_id(pool, id)
            .await?
            .ok_or_else(|| DbError::NotFound(format!("Agent {} not found after update", id)))
    }

    /// Delete an agent
    pub async fn delete(pool: &SqlitePool, id: &str) -> Result<u64, DbError> {
        let result = sqlx::query(r#"DELETE FROM agents WHERE id = ?"#)
            .bind(id)
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
    async fn test_agent_crud() {
        let db = DbService::in_memory().await.unwrap();

        // Create
        let create_data = CreateAgent {
            id: None,
            name: "Test Agent".to_string(),
            agent_type: AgentType::ClaudeCode,
            config: Some(serde_json::json!({"key": "value"})),
        };
        let agent = Agent::create(&db.pool, &create_data).await.unwrap();
        assert_eq!(agent.name, "Test Agent");
        assert_eq!(agent.agent_type, AgentType::ClaudeCode);
        assert_eq!(agent.config["key"], "value");

        // Find by ID
        let found = Agent::find_by_id(&db.pool, &agent.id).await.unwrap();
        assert!(found.is_some());
        assert_eq!(found.unwrap().name, "Test Agent");

        // Find all
        let all = Agent::find_all(&db.pool).await.unwrap();
        assert_eq!(all.len(), 1);

        // Find by type
        let by_type = Agent::find_by_type(&db.pool, &AgentType::ClaudeCode).await.unwrap();
        assert_eq!(by_type.len(), 1);

        // Update
        let update_data = UpdateAgent {
            name: Some("Updated Agent".to_string()),
            config: Some(serde_json::json!({"updated": true})),
        };
        let updated = Agent::update(&db.pool, &agent.id, &update_data).await.unwrap();
        assert_eq!(updated.name, "Updated Agent");
        assert_eq!(updated.config["updated"], true);

        // Delete
        let deleted = Agent::delete(&db.pool, &agent.id).await.unwrap();
        assert_eq!(deleted, 1);

        // Verify deleted
        let not_found = Agent::find_by_id(&db.pool, &agent.id).await.unwrap();
        assert!(not_found.is_none());
    }
}
