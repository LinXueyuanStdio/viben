//! JSONL message read/write helpers
//!
//! Provides utilities for reading and writing JSONL (JSON Lines) message files.
//! These are append-only logs used for storing messages.

use std::path::Path;
use tokio::fs;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};

use super::types::GroupChatError;

/// Append a message to a JSONL file
pub async fn append_jsonl<T: serde::Serialize>(path: &Path, message: &T) -> Result<(), GroupChatError> {
    tracing::trace!(
        target: "viben::group_chat::messages",
        "Appending message to: {}",
        path.display()
    );

    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).await?;
    }

    // Open file in append mode
    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .await?;

    let json = serde_json::to_string(message)?;
    file.write_all(json.as_bytes()).await?;
    file.write_all(b"\n").await?;
    file.flush().await?;

    tracing::trace!(
        target: "viben::group_chat::messages",
        "Message appended: {} bytes",
        json.len()
    );

    Ok(())
}

/// Read all messages from a JSONL file
pub async fn read_jsonl<T: serde::de::DeserializeOwned>(path: &Path) -> Result<Vec<T>, GroupChatError> {
    tracing::trace!(
        target: "viben::group_chat::messages",
        "Reading messages from: {}",
        path.display()
    );

    if !path.exists() {
        tracing::trace!(
            target: "viben::group_chat::messages",
            "File does not exist, returning empty vec: {}",
            path.display()
        );
        return Ok(Vec::new());
    }

    let file = fs::File::open(path).await?;
    let reader = BufReader::new(file);
    let mut lines = reader.lines();
    let mut messages = Vec::new();

    while let Some(line) = lines.next_line().await? {
        if line.trim().is_empty() {
            continue;
        }
        match serde_json::from_str::<T>(&line) {
            Ok(msg) => messages.push(msg),
            Err(e) => {
                tracing::warn!(
                    target: "viben::group_chat::messages",
                    "Failed to parse message: {}",
                    e
                );
            }
        }
    }

    tracing::trace!(
        target: "viben::group_chat::messages",
        "Read {} messages from: {}",
        messages.len(),
        path.display()
    );

    Ok(messages)
}

/// Read the last N messages from a JSONL file
pub async fn read_jsonl_last<T: serde::de::DeserializeOwned>(
    path: &Path,
    limit: usize,
) -> Result<Vec<T>, GroupChatError> {
    let all_messages = read_jsonl::<T>(path).await?;
    let start = all_messages.len().saturating_sub(limit);
    Ok(all_messages.into_iter().skip(start).collect())
}

/// Clear a JSONL file (truncate to empty)
pub async fn clear_jsonl(path: &Path) -> Result<(), GroupChatError> {
    tracing::trace!(
        target: "viben::group_chat::messages",
        "Clearing JSONL file: {}",
        path.display()
    );

    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).await?;
    }

    // Truncate the file to empty
    fs::write(path, "").await?;

    tracing::trace!(
        target: "viben::group_chat::messages",
        "JSONL file cleared: {}",
        path.display()
    );

    Ok(())
}

/// Check if a JSONL file exists and has content
pub async fn jsonl_exists(path: &Path) -> bool {
    path.exists() && path.is_file()
}

/// Count messages in a JSONL file
pub async fn count_messages(path: &Path) -> Result<usize, GroupChatError> {
    if !path.exists() {
        return Ok(0);
    }

    let file = fs::File::open(path).await?;
    let reader = BufReader::new(file);
    let mut lines = reader.lines();
    let mut count = 0;

    while let Some(line) = lines.next_line().await? {
        if !line.trim().is_empty() {
            count += 1;
        }
    }

    Ok(count)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::group_chat::types::{UIMessage, AgentResponse};
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_append_read_jsonl() {
        let temp = tempdir().unwrap();
        let path = temp.path().join("messages.jsonl");

        // Append messages
        let msg1 = UIMessage::user("msg-1", "user-1", "User", "Hello");
        append_jsonl(&path, &msg1).await.unwrap();

        let msg2 = UIMessage::agent_response("msg-2", "claude", "Claude", "Hi!");
        append_jsonl(&path, &msg2).await.unwrap();

        // Read messages
        let messages: Vec<UIMessage> = read_jsonl(&path).await.unwrap();
        assert_eq!(messages.len(), 2);
        assert_eq!(messages[0].id, "msg-1");
        assert_eq!(messages[1].id, "msg-2");
    }

    #[tokio::test]
    async fn test_read_jsonl_last() {
        let temp = tempdir().unwrap();
        let path = temp.path().join("messages.jsonl");

        // Append 5 messages
        for i in 0..5 {
            let msg = AgentResponse::new(format!("agent-{}", i), "Agent", "Response");
            append_jsonl(&path, &msg).await.unwrap();
        }

        // Read last 3
        let messages: Vec<AgentResponse> = read_jsonl_last(&path, 3).await.unwrap();
        assert_eq!(messages.len(), 3);
        assert_eq!(messages[0].agent_id, "agent-2");
        assert_eq!(messages[1].agent_id, "agent-3");
        assert_eq!(messages[2].agent_id, "agent-4");
    }

    #[tokio::test]
    async fn test_clear_jsonl() {
        let temp = tempdir().unwrap();
        let path = temp.path().join("responses.jsonl");

        // Append messages
        let resp = AgentResponse::new("claude", "Claude", "Response");
        append_jsonl(&path, &resp).await.unwrap();

        // Verify content exists
        let count = count_messages(&path).await.unwrap();
        assert_eq!(count, 1);

        // Clear
        clear_jsonl(&path).await.unwrap();

        // Verify empty
        let count = count_messages(&path).await.unwrap();
        assert_eq!(count, 0);
    }

    #[tokio::test]
    async fn test_read_nonexistent() {
        let temp = tempdir().unwrap();
        let path = temp.path().join("nonexistent.jsonl");

        // Should return empty vec for nonexistent file
        let messages: Vec<UIMessage> = read_jsonl(&path).await.unwrap();
        assert!(messages.is_empty());
    }

    #[tokio::test]
    async fn test_count_messages() {
        let temp = tempdir().unwrap();
        let path = temp.path().join("messages.jsonl");

        // Empty file
        assert_eq!(count_messages(&path).await.unwrap(), 0);

        // Add messages
        for i in 0..10 {
            let msg = UIMessage::user(format!("msg-{}", i), "user", "User", "Hello");
            append_jsonl(&path, &msg).await.unwrap();
        }

        // Count
        assert_eq!(count_messages(&path).await.unwrap(), 10);
    }
}
