//! Viben Database Layer
//!
//! This crate provides database access using SQLite with SQLx.
//! Schema follows vibe-kanban's patterns for tasks, sessions, and agents.

pub mod models;

use std::path::PathBuf;

use sqlx::sqlite::{SqliteConnectOptions, SqlitePool, SqlitePoolOptions};
use thiserror::Error;

/// Database error types
#[derive(Debug, Error)]
pub enum DbError {
    #[error("Database error: {0}")]
    Sqlx(#[from] sqlx::Error),
    #[error("Migration error: {0}")]
    Migration(String),
    #[error("Not found: {0}")]
    NotFound(String),
}

/// Database service
#[derive(Clone)]
pub struct DbService {
    pub pool: SqlitePool,
}

impl DbService {
    /// Create a new database service with default path
    pub async fn new() -> Result<Self, DbError> {
        let db_path = Self::default_db_path();
        Self::with_path(&db_path).await
    }

    /// Create a new database service with custom path
    pub async fn with_path(path: &PathBuf) -> Result<Self, DbError> {
        // Ensure parent directory exists
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| DbError::Migration(e.to_string()))?;
        }

        let options = SqliteConnectOptions::new()
            .filename(path)
            .create_if_missing(true);

        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect_with(options)
            .await?;

        let service = Self { pool };
        service.run_migrations().await?;

        Ok(service)
    }

    /// Create an in-memory database for testing
    pub async fn in_memory() -> Result<Self, DbError> {
        let options = SqliteConnectOptions::new()
            .filename(":memory:")
            .create_if_missing(true);

        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(options)
            .await?;

        let service = Self { pool };
        service.run_migrations().await?;

        Ok(service)
    }

    /// Default database path
    pub fn default_db_path() -> PathBuf {
        dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("viben")
            .join("viben.db")
    }

    /// Run database migrations
    async fn run_migrations(&self) -> Result<(), DbError> {
        // Create tables
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS agents (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                agent_type TEXT NOT NULL,
                config TEXT NOT NULL DEFAULT '{}',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
            "#,
        )
        .execute(&self.pool)
        .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                status TEXT NOT NULL DEFAULT 'todo'
                    CHECK (status IN ('todo', 'inprogress', 'done', 'cancelled', 'inreview')),
                agent_id TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL
            )
            "#,
        )
        .execute(&self.pool)
        .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                agent_id TEXT NOT NULL,
                task_id TEXT,
                status TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'completed', 'cancelled')),
                prompt TEXT,
                session_data TEXT DEFAULT '{}',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
            )
            "#,
        )
        .execute(&self.pool)
        .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS execution_processes (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                pid INTEGER,
                status TEXT NOT NULL DEFAULT 'running'
                    CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
                exit_code INTEGER,
                started_at TEXT NOT NULL DEFAULT (datetime('now')),
                ended_at TEXT,
                FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
            )
            "#,
        )
        .execute(&self.pool)
        .await?;

        // Group chat tables
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS group_chats (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
                created_by TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
            "#,
        )
        .execute(&self.pool)
        .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS group_chat_members (
                id TEXT PRIMARY KEY,
                group_chat_id TEXT NOT NULL REFERENCES group_chats(id) ON DELETE CASCADE,
                member_type TEXT NOT NULL CHECK (member_type IN ('human', 'agent', 'executor')),
                member_id TEXT NOT NULL,
                display_name TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
                joined_at TEXT NOT NULL DEFAULT (datetime('now')),
                last_seen_at TEXT,
                UNIQUE(group_chat_id, member_type, member_id)
            )
            "#,
        )
        .execute(&self.pool)
        .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS group_chat_messages (
                id TEXT PRIMARY KEY,
                group_chat_id TEXT NOT NULL REFERENCES group_chats(id) ON DELETE CASCADE,
                sender_id TEXT NOT NULL,
                sender_type TEXT NOT NULL CHECK (sender_type IN ('human', 'agent', 'executor')),
                sender_name TEXT NOT NULL,
                content_type TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('text', 'code', 'file', 'system', 'tool_call')),
                content TEXT NOT NULL,
                mentions TEXT,
                reply_to TEXT REFERENCES group_chat_messages(id) ON DELETE SET NULL,
                metadata TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
            "#,
        )
        .execute(&self.pool)
        .await?;

        // Create indexes for group chat tables
        sqlx::query(
            r#"CREATE INDEX IF NOT EXISTS idx_group_chat_members_group_id ON group_chat_members(group_chat_id)"#,
        )
        .execute(&self.pool)
        .await?;

        sqlx::query(
            r#"CREATE INDEX IF NOT EXISTS idx_group_chat_messages_group_id ON group_chat_messages(group_chat_id)"#,
        )
        .execute(&self.pool)
        .await?;

        sqlx::query(
            r#"CREATE INDEX IF NOT EXISTS idx_group_chat_messages_created_at ON group_chat_messages(created_at)"#,
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}
