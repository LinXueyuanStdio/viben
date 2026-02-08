//! JSON Patch helpers for entity updates
//!
//! This module provides helper functions for creating JSON Patch (RFC 6902)
//! operations for task, session, and other entity updates.

use json_patch::{AddOperation, Patch, PatchOperation, RemoveOperation, ReplaceOperation};

use crate::db::models::{Session, Task};

/// Escape a JSON Pointer segment according to RFC 6901
fn escape_pointer_segment(s: &str) -> String {
    s.replace('~', "~0").replace('/', "~1")
}

/// Helper functions for creating task-specific patches
pub mod task_patch {
    use super::*;

    fn task_path(task_id: &str) -> String {
        format!("/tasks/{}", escape_pointer_segment(task_id))
    }

    /// Create patch for adding a new task
    pub fn add(task: &Task) -> Patch {
        Patch(vec![PatchOperation::Add(AddOperation {
            path: task_path(&task.id)
                .try_into()
                .expect("Task path should be valid"),
            value: serde_json::to_value(task).expect("Task serialization should not fail"),
        })])
    }

    /// Create patch for updating an existing task
    pub fn replace(task: &Task) -> Patch {
        Patch(vec![PatchOperation::Replace(ReplaceOperation {
            path: task_path(&task.id)
                .try_into()
                .expect("Task path should be valid"),
            value: serde_json::to_value(task).expect("Task serialization should not fail"),
        })])
    }

    /// Create patch for removing a task
    pub fn remove(task_id: &str) -> Patch {
        Patch(vec![PatchOperation::Remove(RemoveOperation {
            path: task_path(task_id)
                .try_into()
                .expect("Task path should be valid"),
        })])
    }
}

/// Helper functions for creating session-specific patches
pub mod session_patch {
    use super::*;

    fn session_path(session_id: &str) -> String {
        format!("/sessions/{}", escape_pointer_segment(session_id))
    }

    /// Create patch for adding a new session
    pub fn add(session: &Session) -> Patch {
        Patch(vec![PatchOperation::Add(AddOperation {
            path: session_path(&session.id)
                .try_into()
                .expect("Session path should be valid"),
            value: serde_json::to_value(session).expect("Session serialization should not fail"),
        })])
    }

    /// Create patch for updating an existing session
    pub fn replace(session: &Session) -> Patch {
        Patch(vec![PatchOperation::Replace(ReplaceOperation {
            path: session_path(&session.id)
                .try_into()
                .expect("Session path should be valid"),
            value: serde_json::to_value(session).expect("Session serialization should not fail"),
        })])
    }

    /// Create patch for removing a session
    pub fn remove(session_id: &str) -> Patch {
        Patch(vec![PatchOperation::Remove(RemoveOperation {
            path: session_path(session_id)
                .try_into()
                .expect("Session path should be valid"),
        })])
    }
}

/// Helper functions for creating agent-specific patches
pub mod agent_patch {
    use super::*;
    use crate::db::models::Agent;

    fn agent_path(agent_id: &str) -> String {
        format!("/agents/{}", escape_pointer_segment(agent_id))
    }

    /// Create patch for adding a new agent
    pub fn add(agent: &Agent) -> Patch {
        Patch(vec![PatchOperation::Add(AddOperation {
            path: agent_path(&agent.id)
                .try_into()
                .expect("Agent path should be valid"),
            value: serde_json::to_value(agent).expect("Agent serialization should not fail"),
        })])
    }

    /// Create patch for updating an existing agent
    pub fn replace(agent: &Agent) -> Patch {
        Patch(vec![PatchOperation::Replace(ReplaceOperation {
            path: agent_path(&agent.id)
                .try_into()
                .expect("Agent path should be valid"),
            value: serde_json::to_value(agent).expect("Agent serialization should not fail"),
        })])
    }

    /// Create patch for removing an agent
    pub fn remove(agent_id: &str) -> Patch {
        Patch(vec![PatchOperation::Remove(RemoveOperation {
            path: agent_path(agent_id)
                .try_into()
                .expect("Agent path should be valid"),
        })])
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::models::{TaskStatus, SessionStatus};
    use chrono::Utc;

    #[test]
    fn test_task_patch_add() {
        let task = Task {
            id: "test-task-123".to_string(),
            title: "Test Task".to_string(),
            description: None,
            status: TaskStatus::Todo,
            agent_id: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let patch = task_patch::add(&task);
        assert_eq!(patch.0.len(), 1);

        if let PatchOperation::Add(op) = &patch.0[0] {
            assert_eq!(op.path.as_str(), "/tasks/test-task-123");
            assert!(op.value.get("title").is_some());
        } else {
            panic!("Expected Add operation");
        }
    }

    #[test]
    fn test_task_patch_replace() {
        let task = Task {
            id: "test-task-456".to_string(),
            title: "Updated Task".to_string(),
            description: Some("Updated description".to_string()),
            status: TaskStatus::InProgress,
            agent_id: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let patch = task_patch::replace(&task);
        assert_eq!(patch.0.len(), 1);

        if let PatchOperation::Replace(op) = &patch.0[0] {
            assert_eq!(op.path.as_str(), "/tasks/test-task-456");
        } else {
            panic!("Expected Replace operation");
        }
    }

    #[test]
    fn test_task_patch_remove() {
        let patch = task_patch::remove("test-task-789");
        assert_eq!(patch.0.len(), 1);

        if let PatchOperation::Remove(op) = &patch.0[0] {
            assert_eq!(op.path.as_str(), "/tasks/test-task-789");
        } else {
            panic!("Expected Remove operation");
        }
    }

    #[test]
    fn test_session_patch_add() {
        let session = Session {
            id: "test-session-123".to_string(),
            agent_id: "agent-1".to_string(),
            task_id: Some("task-1".to_string()),
            status: SessionStatus::Active,
            prompt: Some("Test prompt".to_string()),
            session_data: serde_json::json!({}),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let patch = session_patch::add(&session);
        assert_eq!(patch.0.len(), 1);

        if let PatchOperation::Add(op) = &patch.0[0] {
            assert_eq!(op.path.as_str(), "/sessions/test-session-123");
        } else {
            panic!("Expected Add operation");
        }
    }

    #[test]
    fn test_escape_pointer_segment() {
        // Test escaping special characters
        assert_eq!(escape_pointer_segment("test"), "test");
        assert_eq!(escape_pointer_segment("a/b"), "a~1b");
        assert_eq!(escape_pointer_segment("a~b"), "a~0b");
        assert_eq!(escape_pointer_segment("a~b/c"), "a~0b~1c");
    }
}
