//! Tests for agents module

use std::env;
use tempfile::TempDir;
use viben_core::{AgentManager, AgentUpdate, ConfigManager, CreateAgentOptions};

/// Helper to create a temp directory and set VIBEN_STATE_DIR
fn setup_temp_state_dir() -> TempDir {
    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    env::set_var("VIBEN_STATE_DIR", temp_dir.path());
    temp_dir
}

// =============================================================================
// AgentManager Initialization Tests
// =============================================================================

#[tokio::test]
async fn test_agent_manager_initialize() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();

    let agents_dir = viben_core::config::get_agents_dir();
    assert!(agents_dir.exists());

    let templates_dir = viben_core::config::get_templates_dir();
    assert!(templates_dir.exists());
}

// =============================================================================
// Agent CRUD Tests
// =============================================================================

#[tokio::test]
async fn test_agent_manager_list_empty() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();

    let agents = AgentManager::list_agents().await.unwrap();
    assert!(agents.is_empty());
}

#[tokio::test]
async fn test_agent_manager_create_agent() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();

    let options = CreateAgentOptions {
        id: None,
        name: "Test Agent".to_string(),
        description: Some("A test agent".to_string()),
        model: Some("gpt-4o".to_string()),
        provider: Some("openai".to_string()),
        system_prompt: Some("You are a helpful assistant.".to_string()),
        temperature: Some(0.7),
        max_tokens: Some(4096),
        from_template: None,
    };

    let agent = AgentManager::create_agent(options).await.unwrap();

    assert!(!agent.id.is_empty());
    assert_eq!(agent.name, "Test Agent");
    assert_eq!(agent.description, Some("A test agent".to_string()));
    assert_eq!(agent.model, Some("gpt-4o".to_string()));
    assert_eq!(agent.temperature, Some(0.7));
}

#[tokio::test]
async fn test_agent_manager_create_agent_with_custom_id() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();

    let options = CreateAgentOptions {
        id: Some("my-custom-agent".to_string()),
        name: "Custom Agent".to_string(),
        description: None,
        model: None,
        provider: None,
        system_prompt: None,
        temperature: None,
        max_tokens: None,
        from_template: None,
    };

    let agent = AgentManager::create_agent(options).await.unwrap();

    assert_eq!(agent.id, "my-custom-agent");
}

#[tokio::test]
async fn test_agent_manager_create_agent_id_from_name() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();

    let options = CreateAgentOptions {
        id: None,
        name: "My Cool Agent!".to_string(),
        description: None,
        model: None,
        provider: None,
        system_prompt: None,
        temperature: None,
        max_tokens: None,
        from_template: None,
    };

    let agent = AgentManager::create_agent(options).await.unwrap();

    // ID should be generated from name (lowercase, hyphens, trimmed)
    // "My Cool Agent!" -> "my-cool-agent-" -> trimmed to "my-cool-agent"
    assert_eq!(agent.id, "my-cool-agent");
}

#[tokio::test]
async fn test_agent_manager_create_agent_duplicate() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();

    let options = CreateAgentOptions {
        id: Some("duplicate-agent".to_string()),
        name: "Duplicate".to_string(),
        description: None,
        model: None,
        provider: None,
        system_prompt: None,
        temperature: None,
        max_tokens: None,
        from_template: None,
    };

    AgentManager::create_agent(options.clone()).await.unwrap();

    // Try to create again with same ID
    let result = AgentManager::create_agent(options).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_agent_manager_get_agent() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();

    let options = CreateAgentOptions {
        id: Some("get-me".to_string()),
        name: "Get Me".to_string(),
        description: Some("Find me".to_string()),
        model: None,
        provider: None,
        system_prompt: None,
        temperature: None,
        max_tokens: None,
        from_template: None,
    };

    AgentManager::create_agent(options).await.unwrap();

    let agent = AgentManager::get_agent("get-me").await.unwrap().unwrap();

    assert_eq!(agent.id, "get-me");
    assert_eq!(agent.name, "Get Me");
}

#[tokio::test]
async fn test_agent_manager_get_agent_not_found() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();

    let agent = AgentManager::get_agent("nonexistent").await.unwrap();
    assert!(agent.is_none());
}

#[tokio::test]
async fn test_agent_manager_list_agents() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();

    // Create multiple agents
    for i in 1..=3 {
        let options = CreateAgentOptions {
            id: Some(format!("agent-{}", i)),
            name: format!("Agent {}", i),
            description: None,
            model: None,
            provider: None,
            system_prompt: None,
            temperature: None,
            max_tokens: None,
            from_template: None,
        };
        AgentManager::create_agent(options).await.unwrap();
    }

    let agents = AgentManager::list_agents().await.unwrap();
    assert_eq!(agents.len(), 3);
}

#[tokio::test]
async fn test_agent_manager_remove_agent() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();

    let options = CreateAgentOptions {
        id: Some("to-remove".to_string()),
        name: "To Remove".to_string(),
        description: None,
        model: None,
        provider: None,
        system_prompt: None,
        temperature: None,
        max_tokens: None,
        from_template: None,
    };

    AgentManager::create_agent(options).await.unwrap();

    AgentManager::remove_agent("to-remove").await.unwrap();

    let agent = AgentManager::get_agent("to-remove").await.unwrap();
    assert!(agent.is_none());
}

#[tokio::test]
async fn test_agent_manager_remove_agent_not_found() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();

    let result = AgentManager::remove_agent("nonexistent").await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_agent_manager_remove_default_agent() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    let options = CreateAgentOptions {
        id: Some("default-to-remove".to_string()),
        name: "Default".to_string(),
        description: None,
        model: None,
        provider: None,
        system_prompt: None,
        temperature: None,
        max_tokens: None,
        from_template: None,
    };

    AgentManager::create_agent(options).await.unwrap();
    AgentManager::set_default("default-to-remove").await.unwrap();

    // Remove default agent
    AgentManager::remove_agent("default-to-remove").await.unwrap();

    // Default should be cleared
    let default = AgentManager::get_default().await.unwrap();
    assert!(default.is_none());
}

#[tokio::test]
async fn test_agent_manager_update_agent() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();

    let options = CreateAgentOptions {
        id: Some("to-update".to_string()),
        name: "Original".to_string(),
        description: None,
        model: None,
        provider: None,
        system_prompt: None,
        temperature: None,
        max_tokens: None,
        from_template: None,
    };

    AgentManager::create_agent(options).await.unwrap();

    let updated = AgentManager::update_agent(
        "to-update",
        AgentUpdate {
            name: Some("Updated Name".to_string()),
            description: Some("New description".to_string()),
            model: Some("claude-3".to_string()),
            temperature: Some(0.5),
            ..Default::default()
        },
    )
    .await
    .unwrap();

    assert_eq!(updated.name, "Updated Name");
    assert_eq!(updated.description, Some("New description".to_string()));
    assert_eq!(updated.model, Some("claude-3".to_string()));
    assert_eq!(updated.temperature, Some(0.5));
}

#[tokio::test]
async fn test_agent_manager_update_agent_not_found() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();

    let result = AgentManager::update_agent(
        "nonexistent",
        AgentUpdate {
            name: Some("Test".to_string()),
            ..Default::default()
        },
    )
    .await;

    assert!(result.is_err());
}

// =============================================================================
// Default Agent Tests
// =============================================================================

#[tokio::test]
async fn test_agent_manager_set_default() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    let options = CreateAgentOptions {
        id: Some("my-default".to_string()),
        name: "My Default".to_string(),
        description: None,
        model: None,
        provider: None,
        system_prompt: None,
        temperature: None,
        max_tokens: None,
        from_template: None,
    };

    AgentManager::create_agent(options).await.unwrap();
    AgentManager::set_default("my-default").await.unwrap();

    let default = AgentManager::get_default().await.unwrap();
    assert_eq!(default, Some("my-default".to_string()));
}

#[tokio::test]
async fn test_agent_manager_set_default_not_found() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();

    let result = AgentManager::set_default("nonexistent").await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_agent_manager_get_default_none() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    let default = AgentManager::get_default().await.unwrap();
    assert!(default.is_none());
}

// =============================================================================
// Template Tests
// =============================================================================

#[tokio::test]
async fn test_agent_manager_list_templates_empty() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();

    let templates = AgentManager::list_templates().await.unwrap();
    assert!(templates.is_empty());
}

#[tokio::test]
async fn test_agent_manager_create_template() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();

    // First create an agent
    let options = CreateAgentOptions {
        id: Some("template-source".to_string()),
        name: "Template Source".to_string(),
        description: Some("Source agent".to_string()),
        model: Some("gpt-4".to_string()),
        provider: Some("openai".to_string()),
        system_prompt: Some("You are helpful.".to_string()),
        temperature: Some(0.7),
        max_tokens: Some(2048),
        from_template: None,
    };

    AgentManager::create_agent(options).await.unwrap();

    // Create template from agent
    let template = AgentManager::create_template("template-source", "my-template")
        .await
        .unwrap();

    assert_eq!(template.id, "my-template");
    assert_eq!(template.name, "Template Source");
    assert_eq!(template.config.model, Some("gpt-4".to_string()));
}

#[tokio::test]
async fn test_agent_manager_create_template_agent_not_found() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();

    let result = AgentManager::create_template("nonexistent", "template").await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_agent_manager_create_template_duplicate() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();

    // Create agent
    let options = CreateAgentOptions {
        id: Some("agent-for-template".to_string()),
        name: "Agent".to_string(),
        description: None,
        model: None,
        provider: None,
        system_prompt: None,
        temperature: None,
        max_tokens: None,
        from_template: None,
    };

    AgentManager::create_agent(options).await.unwrap();

    // Create template
    AgentManager::create_template("agent-for-template", "dup-template")
        .await
        .unwrap();

    // Try to create again
    let result = AgentManager::create_template("agent-for-template", "dup-template").await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_agent_manager_get_template() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();

    // Create agent and template
    let options = CreateAgentOptions {
        id: Some("agent-x".to_string()),
        name: "Agent X".to_string(),
        description: None,
        model: Some("claude-3".to_string()),
        provider: None,
        system_prompt: None,
        temperature: None,
        max_tokens: None,
        from_template: None,
    };

    AgentManager::create_agent(options).await.unwrap();
    AgentManager::create_template("agent-x", "template-x")
        .await
        .unwrap();

    let template = AgentManager::get_template("template-x")
        .await
        .unwrap()
        .unwrap();

    assert_eq!(template.id, "template-x");
    assert_eq!(template.config.model, Some("claude-3".to_string()));
}

#[tokio::test]
async fn test_agent_manager_get_template_not_found() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();

    let template = AgentManager::get_template("nonexistent").await.unwrap();
    assert!(template.is_none());
}

#[tokio::test]
async fn test_agent_manager_create_from_template() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();

    // Create source agent
    let options = CreateAgentOptions {
        id: Some("source".to_string()),
        name: "Source".to_string(),
        description: Some("Source description".to_string()),
        model: Some("gpt-4o".to_string()),
        provider: Some("openai".to_string()),
        system_prompt: Some("Be helpful".to_string()),
        temperature: Some(0.8),
        max_tokens: Some(4096),
        from_template: None,
    };

    AgentManager::create_agent(options).await.unwrap();
    AgentManager::create_template("source", "reusable-template")
        .await
        .unwrap();

    // Create new agent from template
    let new_agent = AgentManager::create_from_template("reusable-template", "new-from-template")
        .await
        .unwrap();

    assert_eq!(new_agent.id, "new-from-template");
    // Inherits from template
    assert_eq!(new_agent.description, Some("Source description".to_string()));
    assert_eq!(new_agent.model, Some("gpt-4o".to_string()));
    assert_eq!(new_agent.temperature, Some(0.8));
}

#[tokio::test]
async fn test_agent_manager_create_agent_from_template_option() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();

    // Create source and template
    let options = CreateAgentOptions {
        id: Some("src".to_string()),
        name: "Src".to_string(),
        description: None,
        model: Some("claude-3".to_string()),
        provider: None,
        system_prompt: Some("Template prompt".to_string()),
        temperature: Some(0.5),
        max_tokens: None,
        from_template: None,
    };

    AgentManager::create_agent(options).await.unwrap();
    AgentManager::create_template("src", "tmpl").await.unwrap();

    // Create agent using from_template option
    let options = CreateAgentOptions {
        id: Some("from-tmpl".to_string()),
        name: "From Template".to_string(),
        description: None, // Will inherit from template
        model: None,       // Will inherit from template
        provider: None,
        system_prompt: None,
        temperature: None,
        max_tokens: None,
        from_template: Some("tmpl".to_string()),
    };

    let agent = AgentManager::create_agent(options).await.unwrap();

    assert_eq!(agent.id, "from-tmpl");
    assert_eq!(agent.model, Some("claude-3".to_string()));
    assert_eq!(agent.system_prompt, Some("Template prompt".to_string()));
    assert_eq!(agent.temperature, Some(0.5));
}

// =============================================================================
// Session Tests
// =============================================================================

#[tokio::test]
async fn test_agent_manager_list_sessions_empty() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();

    let options = CreateAgentOptions {
        id: Some("agent-sessions".to_string()),
        name: "Agent Sessions".to_string(),
        description: None,
        model: None,
        provider: None,
        system_prompt: None,
        temperature: None,
        max_tokens: None,
        from_template: None,
    };

    AgentManager::create_agent(options).await.unwrap();

    let sessions = AgentManager::list_sessions("agent-sessions").await.unwrap();
    assert!(sessions.is_empty());
}

#[tokio::test]
async fn test_agent_manager_create_session() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();

    let options = CreateAgentOptions {
        id: Some("agent-s".to_string()),
        name: "Agent S".to_string(),
        description: None,
        model: None,
        provider: None,
        system_prompt: None,
        temperature: None,
        max_tokens: None,
        from_template: None,
    };

    AgentManager::create_agent(options).await.unwrap();

    let session = AgentManager::create_session("agent-s", Some("My Session"))
        .await
        .unwrap();

    assert!(!session.id.is_empty());
    assert_eq!(session.agent_id, "agent-s");
    assert_eq!(session.name, Some("My Session".to_string()));
}

#[tokio::test]
async fn test_agent_manager_create_session_no_name() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();

    let options = CreateAgentOptions {
        id: Some("agent-nn".to_string()),
        name: "Agent NN".to_string(),
        description: None,
        model: None,
        provider: None,
        system_prompt: None,
        temperature: None,
        max_tokens: None,
        from_template: None,
    };

    AgentManager::create_agent(options).await.unwrap();

    let session = AgentManager::create_session("agent-nn", None).await.unwrap();

    assert!(session.name.is_none());
}

#[tokio::test]
async fn test_agent_manager_create_session_agent_not_found() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();

    let result = AgentManager::create_session("nonexistent", None).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_agent_manager_list_sessions() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();

    let options = CreateAgentOptions {
        id: Some("agent-ls".to_string()),
        name: "Agent LS".to_string(),
        description: None,
        model: None,
        provider: None,
        system_prompt: None,
        temperature: None,
        max_tokens: None,
        from_template: None,
    };

    AgentManager::create_agent(options).await.unwrap();

    // Create multiple sessions
    AgentManager::create_session("agent-ls", Some("Session 1"))
        .await
        .unwrap();
    AgentManager::create_session("agent-ls", Some("Session 2"))
        .await
        .unwrap();
    AgentManager::create_session("agent-ls", Some("Session 3"))
        .await
        .unwrap();

    let sessions = AgentManager::list_sessions("agent-ls").await.unwrap();
    assert_eq!(sessions.len(), 3);
}

#[tokio::test]
async fn test_agent_manager_remove_session() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();

    let options = CreateAgentOptions {
        id: Some("agent-rs".to_string()),
        name: "Agent RS".to_string(),
        description: None,
        model: None,
        provider: None,
        system_prompt: None,
        temperature: None,
        max_tokens: None,
        from_template: None,
    };

    AgentManager::create_agent(options).await.unwrap();

    let session = AgentManager::create_session("agent-rs", Some("To Remove"))
        .await
        .unwrap();

    AgentManager::remove_session("agent-rs", &session.id)
        .await
        .unwrap();

    let sessions = AgentManager::list_sessions("agent-rs").await.unwrap();
    assert!(sessions.is_empty());
}

#[tokio::test]
async fn test_agent_manager_remove_session_not_found() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();

    let options = CreateAgentOptions {
        id: Some("agent-rnf".to_string()),
        name: "Agent RNF".to_string(),
        description: None,
        model: None,
        provider: None,
        system_prompt: None,
        temperature: None,
        max_tokens: None,
        from_template: None,
    };

    AgentManager::create_agent(options).await.unwrap();

    let result = AgentManager::remove_session("agent-rnf", "nonexistent").await;
    assert!(result.is_err());
}

// =============================================================================
// Memory Tests
// =============================================================================

#[tokio::test]
async fn test_agent_manager_get_memory_empty() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();

    let options = CreateAgentOptions {
        id: Some("agent-mem".to_string()),
        name: "Agent Mem".to_string(),
        description: None,
        model: None,
        provider: None,
        system_prompt: None,
        temperature: None,
        max_tokens: None,
        from_template: None,
    };

    AgentManager::create_agent(options).await.unwrap();

    let memory = AgentManager::get_memory("agent-mem").await.unwrap();

    assert_eq!(memory.agent_id, "agent-mem");
    assert!(memory.content.is_empty());
}

#[tokio::test]
async fn test_agent_manager_append_memory() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();

    let options = CreateAgentOptions {
        id: Some("agent-am".to_string()),
        name: "Agent AM".to_string(),
        description: None,
        model: None,
        provider: None,
        system_prompt: None,
        temperature: None,
        max_tokens: None,
        from_template: None,
    };

    AgentManager::create_agent(options).await.unwrap();

    AgentManager::append_memory("agent-am", "First memory entry")
        .await
        .unwrap();

    let memory = AgentManager::get_memory("agent-am").await.unwrap();
    assert!(memory.content.contains("First memory entry"));
}

#[tokio::test]
async fn test_agent_manager_append_memory_multiple() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();

    let options = CreateAgentOptions {
        id: Some("agent-mm".to_string()),
        name: "Agent MM".to_string(),
        description: None,
        model: None,
        provider: None,
        system_prompt: None,
        temperature: None,
        max_tokens: None,
        from_template: None,
    };

    AgentManager::create_agent(options).await.unwrap();

    AgentManager::append_memory("agent-mm", "Entry 1")
        .await
        .unwrap();
    AgentManager::append_memory("agent-mm", "Entry 2")
        .await
        .unwrap();
    AgentManager::append_memory("agent-mm", "Entry 3")
        .await
        .unwrap();

    let memory = AgentManager::get_memory("agent-mm").await.unwrap();

    assert!(memory.content.contains("Entry 1"));
    assert!(memory.content.contains("Entry 2"));
    assert!(memory.content.contains("Entry 3"));
}
