use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use uuid::Uuid;

/// Comment author information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommentAuthor {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub avatar: Option<String>,
}

/// Comment reaction (emoji reactions)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommentReaction {
    pub emoji: String,
    pub users: Vec<CommentReactionUser>,
    pub count: i32,
}

/// User who reacted
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommentReactionUser {
    pub id: String,
    pub name: String,
}

/// A comment on a kanban task
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KanbanComment {
    pub id: String,
    pub task_id: String,
    pub content: String,
    pub author: CommentAuthor,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: Option<String>,
    pub reactions: Vec<CommentReaction>,
}

/// Activity event type
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ActivityType {
    Created,
    StatusChanged,
    PriorityChanged,
    AssigneeChanged,
    TitleChanged,
    DescriptionChanged,
    TagAdded,
    TagRemoved,
    DueDateChanged,
    CommentAdded,
}

/// Activity actor information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityActor {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub avatar: Option<String>,
}

/// Activity data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityData {
    #[serde(rename = "oldValue", skip_serializing_if = "Option::is_none")]
    pub old_value: Option<String>,
    #[serde(rename = "newValue", skip_serializing_if = "Option::is_none")]
    pub new_value: Option<String>,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

/// An activity event for a kanban task
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KanbanActivity {
    pub id: String,
    pub task_id: String,
    #[serde(rename = "type")]
    pub activity_type: ActivityType,
    pub actor: ActivityActor,
    pub timestamp: String,
    pub data: ActivityData,
}

/// Storage structure for comments (per-task)
#[derive(Debug, Clone, Serialize, Deserialize)]
struct CommentsStore {
    version: String,
    comments: Vec<KanbanComment>,
}

impl Default for CommentsStore {
    fn default() -> Self {
        Self {
            version: "1.0".to_string(),
            comments: Vec::new(),
        }
    }
}

/// Storage structure for activities (per-task)
#[derive(Debug, Clone, Serialize, Deserialize)]
struct ActivitiesStore {
    version: String,
    activities: Vec<KanbanActivity>,
}

impl Default for ActivitiesStore {
    fn default() -> Self {
        Self {
            version: "1.0".to_string(),
            activities: Vec::new(),
        }
    }
}

/// Get the kanban data storage directory (~/.viben/kanban)
fn get_kanban_data_dir() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    let dir = home.join(".viben").join("kanban");
    fs::create_dir_all(&dir).ok();
    dir
}

/// Get the comments file path for a task
fn get_comments_file_path(task_id: &str) -> PathBuf {
    let comments_dir = get_kanban_data_dir().join("comments");
    fs::create_dir_all(&comments_dir).ok();
    comments_dir.join(format!("{}.json", task_id))
}

/// Get the activities file path for a task
fn get_activities_file_path(task_id: &str) -> PathBuf {
    let activities_dir = get_kanban_data_dir().join("activities");
    fs::create_dir_all(&activities_dir).ok();
    activities_dir.join(format!("{}.json", task_id))
}

/// Load comments for a task
fn load_comments(task_id: &str) -> CommentsStore {
    let path = get_comments_file_path(task_id);
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(store) = serde_json::from_str::<CommentsStore>(&content) {
                return store;
            }
        }
    }
    CommentsStore::default()
}

/// Save comments for a task
fn save_comments(task_id: &str, store: &CommentsStore) -> Result<(), String> {
    let path = get_comments_file_path(task_id);
    let content = serde_json::to_string_pretty(store)
        .map_err(|e| format!("Failed to serialize comments: {}", e))?;
    fs::write(&path, content)
        .map_err(|e| format!("Failed to save comments: {}", e))?;
    Ok(())
}

/// Load activities for a task
fn load_activities(task_id: &str) -> ActivitiesStore {
    let path = get_activities_file_path(task_id);
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(store) = serde_json::from_str::<ActivitiesStore>(&content) {
                return store;
            }
        }
    }
    ActivitiesStore::default()
}

/// Save activities for a task
fn save_activities(task_id: &str, store: &ActivitiesStore) -> Result<(), String> {
    let path = get_activities_file_path(task_id);
    let content = serde_json::to_string_pretty(store)
        .map_err(|e| format!("Failed to serialize activities: {}", e))?;
    fs::write(&path, content)
        .map_err(|e| format!("Failed to save activities: {}", e))?;
    Ok(())
}

/// Get current timestamp as ISO string
fn get_current_timestamp() -> String {
    chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string()
}

// ============================================================================
// Comment Commands
// ============================================================================

/// Get all comments for a task
#[tauri::command]
pub async fn get_kanban_comments(task_id: String) -> Result<Vec<KanbanComment>, String> {
    let store = load_comments(&task_id);
    Ok(store.comments)
}

/// Add a new comment to a task
#[tauri::command]
pub async fn add_kanban_comment(
    task_id: String,
    content: String,
    author_id: String,
    author_name: String,
    author_avatar: Option<String>,
) -> Result<KanbanComment, String> {
    let mut store = load_comments(&task_id);

    let now = get_current_timestamp();
    let comment = KanbanComment {
        id: Uuid::new_v4().to_string(),
        task_id: task_id.clone(),
        content,
        author: CommentAuthor {
            id: author_id.clone(),
            name: author_name.clone(),
            avatar: author_avatar.clone(),
        },
        created_at: now.clone(),
        updated_at: None,
        reactions: Vec::new(),
    };

    store.comments.push(comment.clone());
    save_comments(&task_id, &store)?;

    // Also add an activity for this comment
    add_kanban_activity_internal(
        &task_id,
        ActivityType::CommentAdded,
        &author_id,
        &author_name,
        author_avatar.as_deref(),
        None,
        Some(&comment.content),
        HashMap::new(),
    )?;

    Ok(comment)
}

/// Update an existing comment
#[tauri::command]
pub async fn update_kanban_comment(
    task_id: String,
    comment_id: String,
    content: String,
) -> Result<KanbanComment, String> {
    let mut store = load_comments(&task_id);

    let comment = store.comments
        .iter_mut()
        .find(|c| c.id == comment_id)
        .ok_or_else(|| format!("Comment not found: {}", comment_id))?;

    comment.content = content;
    comment.updated_at = Some(get_current_timestamp());

    let updated = comment.clone();
    save_comments(&task_id, &store)?;

    Ok(updated)
}

/// Delete a comment
#[tauri::command]
pub async fn delete_kanban_comment(
    task_id: String,
    comment_id: String,
) -> Result<(), String> {
    let mut store = load_comments(&task_id);
    store.comments.retain(|c| c.id != comment_id);
    save_comments(&task_id, &store)?;
    Ok(())
}

/// Toggle a reaction on a comment
#[tauri::command]
pub async fn toggle_comment_reaction(
    task_id: String,
    comment_id: String,
    emoji: String,
    user_id: String,
    user_name: String,
) -> Result<KanbanComment, String> {
    let mut store = load_comments(&task_id);

    let comment = store.comments
        .iter_mut()
        .find(|c| c.id == comment_id)
        .ok_or_else(|| format!("Comment not found: {}", comment_id))?;

    // Find existing reaction with this emoji
    if let Some(reaction) = comment.reactions.iter_mut().find(|r| r.emoji == emoji) {
        // Check if user already reacted
        if let Some(pos) = reaction.users.iter().position(|u| u.id == user_id) {
            // Remove user's reaction
            reaction.users.remove(pos);
            reaction.count -= 1;

            // Remove the reaction entirely if no users left
            if reaction.count <= 0 {
                comment.reactions.retain(|r| r.emoji != emoji);
            }
        } else {
            // Add user's reaction
            reaction.users.push(CommentReactionUser {
                id: user_id,
                name: user_name,
            });
            reaction.count += 1;
        }
    } else {
        // Create new reaction
        comment.reactions.push(CommentReaction {
            emoji,
            users: vec![CommentReactionUser {
                id: user_id,
                name: user_name,
            }],
            count: 1,
        });
    }

    let updated = comment.clone();
    save_comments(&task_id, &store)?;

    Ok(updated)
}

// ============================================================================
// Activity Commands
// ============================================================================

/// Get all activities for a task
#[tauri::command]
pub async fn get_kanban_activities(task_id: String) -> Result<Vec<KanbanActivity>, String> {
    let store = load_activities(&task_id);
    // Return in reverse chronological order (most recent first)
    let mut activities = store.activities;
    activities.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    Ok(activities)
}

/// Internal function to add an activity
fn add_kanban_activity_internal(
    task_id: &str,
    activity_type: ActivityType,
    actor_id: &str,
    actor_name: &str,
    actor_avatar: Option<&str>,
    old_value: Option<&str>,
    new_value: Option<&str>,
    extra: HashMap<String, serde_json::Value>,
) -> Result<KanbanActivity, String> {
    let mut store = load_activities(task_id);

    let activity = KanbanActivity {
        id: Uuid::new_v4().to_string(),
        task_id: task_id.to_string(),
        activity_type,
        actor: ActivityActor {
            id: actor_id.to_string(),
            name: actor_name.to_string(),
            avatar: actor_avatar.map(String::from),
        },
        timestamp: get_current_timestamp(),
        data: ActivityData {
            old_value: old_value.map(String::from),
            new_value: new_value.map(String::from),
            extra,
        },
    };

    store.activities.push(activity.clone());
    save_activities(task_id, &store)?;

    Ok(activity)
}

/// Add an activity event for a task
#[tauri::command]
pub async fn add_kanban_activity(
    task_id: String,
    activity_type: String,
    actor_id: String,
    actor_name: String,
    actor_avatar: Option<String>,
    old_value: Option<String>,
    new_value: Option<String>,
) -> Result<KanbanActivity, String> {
    // Parse activity type from string
    let activity_type = match activity_type.as_str() {
        "created" => ActivityType::Created,
        "status_changed" => ActivityType::StatusChanged,
        "priority_changed" => ActivityType::PriorityChanged,
        "assignee_changed" => ActivityType::AssigneeChanged,
        "title_changed" => ActivityType::TitleChanged,
        "description_changed" => ActivityType::DescriptionChanged,
        "tag_added" => ActivityType::TagAdded,
        "tag_removed" => ActivityType::TagRemoved,
        "due_date_changed" => ActivityType::DueDateChanged,
        "comment_added" => ActivityType::CommentAdded,
        _ => return Err(format!("Unknown activity type: {}", activity_type)),
    };

    add_kanban_activity_internal(
        &task_id,
        activity_type,
        &actor_id,
        &actor_name,
        actor_avatar.as_deref(),
        old_value.as_deref(),
        new_value.as_deref(),
        HashMap::new(),
    )
}

/// Clear all comments and activities for a task (when task is deleted)
#[tauri::command]
pub async fn clear_kanban_task_data(task_id: String) -> Result<(), String> {
    // Delete comments file
    let comments_path = get_comments_file_path(&task_id);
    if comments_path.exists() {
        fs::remove_file(&comments_path).ok();
    }

    // Delete activities file
    let activities_path = get_activities_file_path(&task_id);
    if activities_path.exists() {
        fs::remove_file(&activities_path).ok();
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_add_and_get_comments() {
        let task_id = format!("test-task-{}", uuid::Uuid::new_v4());

        // Add a comment
        let comment = add_kanban_comment(
            task_id.clone(),
            "Test comment".to_string(),
            "user-1".to_string(),
            "Test User".to_string(),
            None,
        ).await.unwrap();

        assert_eq!(comment.content, "Test comment");
        assert_eq!(comment.author.name, "Test User");

        // Get comments
        let comments = get_kanban_comments(task_id.clone()).await.unwrap();
        assert_eq!(comments.len(), 1);
        assert_eq!(comments[0].id, comment.id);

        // Clean up
        clear_kanban_task_data(task_id).await.unwrap();
    }

    #[tokio::test]
    async fn test_toggle_reaction() {
        let task_id = format!("test-task-{}", uuid::Uuid::new_v4());

        // Add a comment
        let comment = add_kanban_comment(
            task_id.clone(),
            "Test comment".to_string(),
            "user-1".to_string(),
            "Test User".to_string(),
            None,
        ).await.unwrap();

        // Add reaction
        let updated = toggle_comment_reaction(
            task_id.clone(),
            comment.id.clone(),
            "👍".to_string(),
            "user-1".to_string(),
            "Test User".to_string(),
        ).await.unwrap();

        assert_eq!(updated.reactions.len(), 1);
        assert_eq!(updated.reactions[0].emoji, "👍");
        assert_eq!(updated.reactions[0].count, 1);

        // Toggle off
        let updated = toggle_comment_reaction(
            task_id.clone(),
            comment.id.clone(),
            "👍".to_string(),
            "user-1".to_string(),
            "Test User".to_string(),
        ).await.unwrap();

        assert_eq!(updated.reactions.len(), 0);

        // Clean up
        clear_kanban_task_data(task_id).await.unwrap();
    }

    #[tokio::test]
    async fn test_add_and_get_activities() {
        let task_id = format!("test-task-{}", uuid::Uuid::new_v4());

        // Add an activity
        let activity = add_kanban_activity(
            task_id.clone(),
            "created".to_string(),
            "user-1".to_string(),
            "Test User".to_string(),
            None,
            None,
            None,
        ).await.unwrap();

        assert_eq!(activity.actor.name, "Test User");

        // Get activities
        let activities = get_kanban_activities(task_id.clone()).await.unwrap();
        assert!(activities.len() >= 1);

        // Clean up
        clear_kanban_task_data(task_id).await.unwrap();
    }
}
