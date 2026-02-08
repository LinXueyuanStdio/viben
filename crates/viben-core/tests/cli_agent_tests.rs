//! Tests for viben agent CLI command
//!
//! Tests the agent command functionality:
//! - `viben agent list` - list all agents
//! - `viben agent create <name>` - create new agent
//! - `viben agent show <id>` - show agent details
//! - `viben agent remove <id>` - remove agent
//! - `viben agent update <id>` - update agent settings
//! - `viben agent set-default <id>` - set default

use serial_test::serial;
use std::env;
use tempfile::TempDir;
use viben_core::cli::commands::agent::{AgentAction, AgentCommand};
use viben_core::cli::CliContext;
use viben_core::{AgentManager, ConfigManager, CreateAgentOptions};

/// Helper to create a temp directory and set VIBEN_STATE_DIR
fn setup_temp_state_dir() -> TempDir {
    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    env::set_var("VIBEN_STATE_DIR", temp_dir.path());
    temp_dir
}

/// Helper to create a default CLI context
fn default_context() -> CliContext {
    CliContext {
        json: false,
        global: false,
        workspace: false,
        name: None,
        verbose: false,
        quiet: false,
    }
}

/// Helper to create a JSON CLI context
fn json_context() -> CliContext {
    CliContext {
        json: true,
        global: false,
        workspace: false,
        name: None,
        verbose: false,
        quiet: false,
    }
}

// =============================================================================
// List Command Tests
// =============================================================================

#[tokio::test]
#[serial]
async fn test_cli_agent_list_empty() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    let cmd = AgentCommand {
        action: AgentAction::List,
    };

    // Should succeed even with no agents
    let result = cmd.execute(default_context()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_cli_agent_list_empty_json() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    let cmd = AgentCommand {
        action: AgentAction::List,
    };

    // Should succeed with JSON output
    let result = cmd.execute(json_context()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_cli_agent_list_with_agents() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    // Create some agents
    AgentManager::create_agent(CreateAgentOptions {
        id: Some("agent-1".to_string()),
        name: "Agent One".to_string(),
        description: None,
        model: Some("gpt-4o".to_string()),
        provider: Some("openai".to_string()),
        system_prompt: None,
        temperature: None,
        max_tokens: None,
        from_template: None,
    })
    .await
    .unwrap();

    AgentManager::create_agent(CreateAgentOptions {
        id: Some("agent-2".to_string()),
        name: "Agent Two".to_string(),
        description: None,
        model: Some("claude-3".to_string()),
        provider: Some("anthropic".to_string()),
        system_prompt: None,
        temperature: None,
        max_tokens: None,
        from_template: None,
    })
    .await
    .unwrap();

    let cmd = AgentCommand {
        action: AgentAction::List,
    };

    let result = cmd.execute(default_context()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_cli_agent_list_with_agents_json() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    // Create an agent
    AgentManager::create_agent(CreateAgentOptions {
        id: Some("list-test".to_string()),
        name: "List Test Agent".to_string(),
        description: Some("A test agent".to_string()),
        model: Some("gpt-4o".to_string()),
        provider: Some("openai".to_string()),
        system_prompt: None,
        temperature: None,
        max_tokens: None,
        from_template: None,
    })
    .await
    .unwrap();

    let cmd = AgentCommand {
        action: AgentAction::List,
    };

    let result = cmd.execute(json_context()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_cli_agent_list_with_default_marked() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    // Create agents
    AgentManager::create_agent(CreateAgentOptions {
        id: Some("default-agent".to_string()),
        name: "Default Agent".to_string(),
        description: None,
        model: None,
        provider: None,
        system_prompt: None,
        temperature: None,
        max_tokens: None,
        from_template: None,
    })
    .await
    .unwrap();

    // Set as default
    AgentManager::set_default("default-agent").await.unwrap();

    let cmd = AgentCommand {
        action: AgentAction::List,
    };

    let result = cmd.execute(default_context()).await;
    assert!(result.is_ok());
}

// =============================================================================
// Create Command Tests
// =============================================================================

#[tokio::test]
#[serial]
async fn test_cli_agent_create_minimal() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    let cmd = AgentCommand {
        action: AgentAction::Create {
            name: "Minimal Agent".to_string(),
            model: None,
            provider: None,
            default: false,
        },
    };

    let result = cmd.execute(default_context()).await;
    assert!(result.is_ok());

    // Verify agent was created
    let agents = AgentManager::list_agents().await.unwrap();
    assert_eq!(agents.len(), 1);
    assert_eq!(agents[0].name, "Minimal Agent");
}

#[tokio::test]
#[serial]
async fn test_cli_agent_create_minimal_json() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    let cmd = AgentCommand {
        action: AgentAction::Create {
            name: "Minimal JSON Agent".to_string(),
            model: None,
            provider: None,
            default: false,
        },
    };

    let result = cmd.execute(json_context()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_cli_agent_create_with_model() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    let cmd = AgentCommand {
        action: AgentAction::Create {
            name: "Model Agent".to_string(),
            model: Some("gpt-4o".to_string()),
            provider: None,
            default: false,
        },
    };

    let result = cmd.execute(default_context()).await;
    assert!(result.is_ok());

    let agents = AgentManager::list_agents().await.unwrap();
    assert_eq!(agents[0].model, Some("gpt-4o".to_string()));
}

#[tokio::test]
#[serial]
async fn test_cli_agent_create_with_provider() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    let cmd = AgentCommand {
        action: AgentAction::Create {
            name: "Provider Agent".to_string(),
            model: None,
            provider: Some("anthropic".to_string()),
            default: false,
        },
    };

    let result = cmd.execute(default_context()).await;
    assert!(result.is_ok());

    let agents = AgentManager::list_agents().await.unwrap();
    assert_eq!(agents[0].provider, Some("anthropic".to_string()));
}

#[tokio::test]
#[serial]
async fn test_cli_agent_create_with_all_options() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    let cmd = AgentCommand {
        action: AgentAction::Create {
            name: "Full Agent".to_string(),
            model: Some("claude-3-opus".to_string()),
            provider: Some("anthropic".to_string()),
            default: false,
        },
    };

    let result = cmd.execute(default_context()).await;
    assert!(result.is_ok());

    let agents = AgentManager::list_agents().await.unwrap();
    assert_eq!(agents[0].name, "Full Agent");
    assert_eq!(agents[0].model, Some("claude-3-opus".to_string()));
    assert_eq!(agents[0].provider, Some("anthropic".to_string()));
}

#[tokio::test]
#[serial]
async fn test_cli_agent_create_with_default_flag() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    let cmd = AgentCommand {
        action: AgentAction::Create {
            name: "Default Flag Agent".to_string(),
            model: None,
            provider: None,
            default: true,
        },
    };

    let result = cmd.execute(default_context()).await;
    assert!(result.is_ok());

    // Verify it's set as default
    let default_agent = AgentManager::get_default().await.unwrap();
    assert!(default_agent.is_some());
}

#[tokio::test]
#[serial]
async fn test_cli_agent_create_with_default_flag_json() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    let cmd = AgentCommand {
        action: AgentAction::Create {
            name: "Default JSON Agent".to_string(),
            model: None,
            provider: None,
            default: true,
        },
    };

    let result = cmd.execute(json_context()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_cli_agent_create_duplicate_name() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    // Create first agent
    let cmd1 = AgentCommand {
        action: AgentAction::Create {
            name: "Duplicate".to_string(),
            model: None,
            provider: None,
            default: false,
        },
    };
    cmd1.execute(default_context()).await.unwrap();

    // Create second agent with same name - should fail (same ID generated)
    let cmd2 = AgentCommand {
        action: AgentAction::Create {
            name: "Duplicate".to_string(),
            model: None,
            provider: None,
            default: false,
        },
    };
    let result = cmd2.execute(default_context()).await;
    assert!(result.is_err());
}

#[tokio::test]
#[serial]
async fn test_cli_agent_create_special_characters_name() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    let cmd = AgentCommand {
        action: AgentAction::Create {
            name: "My Cool Agent! @#$".to_string(),
            model: None,
            provider: None,
            default: false,
        },
    };

    let result = cmd.execute(default_context()).await;
    assert!(result.is_ok());

    // ID should be sanitized
    let agents = AgentManager::list_agents().await.unwrap();
    assert_eq!(agents.len(), 1);
    // The ID will be derived from the name with special chars stripped
    assert!(agents[0].id.contains("my-cool-agent"));
}

// =============================================================================
// Show Command Tests
// =============================================================================

#[tokio::test]
#[serial]
async fn test_cli_agent_show_existing() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    // Create an agent first
    AgentManager::create_agent(CreateAgentOptions {
        id: Some("show-test".to_string()),
        name: "Show Test Agent".to_string(),
        description: Some("A test description".to_string()),
        model: Some("gpt-4o".to_string()),
        provider: Some("openai".to_string()),
        system_prompt: Some("You are helpful.".to_string()),
        temperature: Some(0.7),
        max_tokens: Some(4096),
        from_template: None,
    })
    .await
    .unwrap();

    let cmd = AgentCommand {
        action: AgentAction::Show {
            id: "show-test".to_string(),
        },
    };

    let result = cmd.execute(default_context()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_cli_agent_show_existing_json() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    AgentManager::create_agent(CreateAgentOptions {
        id: Some("show-json-test".to_string()),
        name: "Show JSON Test".to_string(),
        description: None,
        model: None,
        provider: None,
        system_prompt: None,
        temperature: None,
        max_tokens: None,
        from_template: None,
    })
    .await
    .unwrap();

    let cmd = AgentCommand {
        action: AgentAction::Show {
            id: "show-json-test".to_string(),
        },
    };

    let result = cmd.execute(json_context()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_cli_agent_show_nonexistent() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    let cmd = AgentCommand {
        action: AgentAction::Show {
            id: "nonexistent".to_string(),
        },
    };

    let result = cmd.execute(default_context()).await;
    assert!(result.is_err());
}

#[tokio::test]
#[serial]
async fn test_cli_agent_show_nonexistent_json() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    let cmd = AgentCommand {
        action: AgentAction::Show {
            id: "nonexistent-json".to_string(),
        },
    };

    let result = cmd.execute(json_context()).await;
    assert!(result.is_err());
}

#[tokio::test]
#[serial]
async fn test_cli_agent_show_default_agent() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    // Create and set as default
    AgentManager::create_agent(CreateAgentOptions {
        id: Some("default-show".to_string()),
        name: "Default Show Agent".to_string(),
        description: None,
        model: None,
        provider: None,
        system_prompt: None,
        temperature: None,
        max_tokens: None,
        from_template: None,
    })
    .await
    .unwrap();
    AgentManager::set_default("default-show").await.unwrap();

    let cmd = AgentCommand {
        action: AgentAction::Show {
            id: "default-show".to_string(),
        },
    };

    let result = cmd.execute(default_context()).await;
    assert!(result.is_ok());
}

// =============================================================================
// Remove Command Tests
// =============================================================================

#[tokio::test]
#[serial]
async fn test_cli_agent_remove_existing() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    // Create agent first
    AgentManager::create_agent(CreateAgentOptions {
        id: Some("to-remove".to_string()),
        name: "To Remove".to_string(),
        description: None,
        model: None,
        provider: None,
        system_prompt: None,
        temperature: None,
        max_tokens: None,
        from_template: None,
    })
    .await
    .unwrap();

    let cmd = AgentCommand {
        action: AgentAction::Remove {
            id: "to-remove".to_string(),
        },
    };

    let result = cmd.execute(default_context()).await;
    assert!(result.is_ok());

    // Verify it's gone
    let agent = AgentManager::get_agent("to-remove").await.unwrap();
    assert!(agent.is_none());
}

#[tokio::test]
#[serial]
async fn test_cli_agent_remove_existing_json() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    AgentManager::create_agent(CreateAgentOptions {
        id: Some("remove-json".to_string()),
        name: "Remove JSON".to_string(),
        description: None,
        model: None,
        provider: None,
        system_prompt: None,
        temperature: None,
        max_tokens: None,
        from_template: None,
    })
    .await
    .unwrap();

    let cmd = AgentCommand {
        action: AgentAction::Remove {
            id: "remove-json".to_string(),
        },
    };

    let result = cmd.execute(json_context()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_cli_agent_remove_nonexistent() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    let cmd = AgentCommand {
        action: AgentAction::Remove {
            id: "nonexistent".to_string(),
        },
    };

    let result = cmd.execute(default_context()).await;
    assert!(result.is_err());
}

#[tokio::test]
#[serial]
async fn test_cli_agent_remove_default_clears_default() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    // Create and set as default
    AgentManager::create_agent(CreateAgentOptions {
        id: Some("default-to-remove".to_string()),
        name: "Default To Remove".to_string(),
        description: None,
        model: None,
        provider: None,
        system_prompt: None,
        temperature: None,
        max_tokens: None,
        from_template: None,
    })
    .await
    .unwrap();
    AgentManager::set_default("default-to-remove").await.unwrap();

    let cmd = AgentCommand {
        action: AgentAction::Remove {
            id: "default-to-remove".to_string(),
        },
    };

    let result = cmd.execute(default_context()).await;
    assert!(result.is_ok());

    // Default should be cleared
    let default = AgentManager::get_default().await.unwrap();
    assert!(default.is_none());
}

// =============================================================================
// Update Command Tests
// =============================================================================

#[tokio::test]
#[serial]
async fn test_cli_agent_update_name() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    // Create agent
    AgentManager::create_agent(CreateAgentOptions {
        id: Some("update-name".to_string()),
        name: "Original Name".to_string(),
        description: None,
        model: None,
        provider: None,
        system_prompt: None,
        temperature: None,
        max_tokens: None,
        from_template: None,
    })
    .await
    .unwrap();

    let cmd = AgentCommand {
        action: AgentAction::Update {
            id: "update-name".to_string(),
            name: Some("Updated Name".to_string()),
            model: None,
            provider: None,
            system_prompt: None,
        },
    };

    let result = cmd.execute(default_context()).await;
    assert!(result.is_ok());

    let agent = AgentManager::get_agent("update-name").await.unwrap().unwrap();
    assert_eq!(agent.name, "Updated Name");
}

#[tokio::test]
#[serial]
async fn test_cli_agent_update_name_json() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    AgentManager::create_agent(CreateAgentOptions {
        id: Some("update-json".to_string()),
        name: "Original".to_string(),
        description: None,
        model: None,
        provider: None,
        system_prompt: None,
        temperature: None,
        max_tokens: None,
        from_template: None,
    })
    .await
    .unwrap();

    let cmd = AgentCommand {
        action: AgentAction::Update {
            id: "update-json".to_string(),
            name: Some("Updated JSON".to_string()),
            model: None,
            provider: None,
            system_prompt: None,
        },
    };

    let result = cmd.execute(json_context()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_cli_agent_update_model() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    AgentManager::create_agent(CreateAgentOptions {
        id: Some("update-model".to_string()),
        name: "Update Model Agent".to_string(),
        description: None,
        model: Some("gpt-4".to_string()),
        provider: None,
        system_prompt: None,
        temperature: None,
        max_tokens: None,
        from_template: None,
    })
    .await
    .unwrap();

    let cmd = AgentCommand {
        action: AgentAction::Update {
            id: "update-model".to_string(),
            name: None,
            model: Some("gpt-4o".to_string()),
            provider: None,
            system_prompt: None,
        },
    };

    let result = cmd.execute(default_context()).await;
    assert!(result.is_ok());

    let agent = AgentManager::get_agent("update-model").await.unwrap().unwrap();
    assert_eq!(agent.model, Some("gpt-4o".to_string()));
}

#[tokio::test]
#[serial]
async fn test_cli_agent_update_provider() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    AgentManager::create_agent(CreateAgentOptions {
        id: Some("update-provider".to_string()),
        name: "Update Provider Agent".to_string(),
        description: None,
        model: None,
        provider: Some("openai".to_string()),
        system_prompt: None,
        temperature: None,
        max_tokens: None,
        from_template: None,
    })
    .await
    .unwrap();

    let cmd = AgentCommand {
        action: AgentAction::Update {
            id: "update-provider".to_string(),
            name: None,
            model: None,
            provider: Some("anthropic".to_string()),
            system_prompt: None,
        },
    };

    let result = cmd.execute(default_context()).await;
    assert!(result.is_ok());

    let agent = AgentManager::get_agent("update-provider")
        .await
        .unwrap()
        .unwrap();
    assert_eq!(agent.provider, Some("anthropic".to_string()));
}

#[tokio::test]
#[serial]
async fn test_cli_agent_update_system_prompt() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    AgentManager::create_agent(CreateAgentOptions {
        id: Some("update-prompt".to_string()),
        name: "Update Prompt Agent".to_string(),
        description: None,
        model: None,
        provider: None,
        system_prompt: Some("Old prompt".to_string()),
        temperature: None,
        max_tokens: None,
        from_template: None,
    })
    .await
    .unwrap();

    let cmd = AgentCommand {
        action: AgentAction::Update {
            id: "update-prompt".to_string(),
            name: None,
            model: None,
            provider: None,
            system_prompt: Some("New system prompt".to_string()),
        },
    };

    let result = cmd.execute(default_context()).await;
    assert!(result.is_ok());

    let agent = AgentManager::get_agent("update-prompt")
        .await
        .unwrap()
        .unwrap();
    assert_eq!(agent.system_prompt, Some("New system prompt".to_string()));
}

#[tokio::test]
#[serial]
async fn test_cli_agent_update_multiple_fields() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    AgentManager::create_agent(CreateAgentOptions {
        id: Some("update-multi".to_string()),
        name: "Original".to_string(),
        description: None,
        model: Some("gpt-4".to_string()),
        provider: Some("openai".to_string()),
        system_prompt: None,
        temperature: None,
        max_tokens: None,
        from_template: None,
    })
    .await
    .unwrap();

    let cmd = AgentCommand {
        action: AgentAction::Update {
            id: "update-multi".to_string(),
            name: Some("Updated Multi".to_string()),
            model: Some("claude-3".to_string()),
            provider: Some("anthropic".to_string()),
            system_prompt: Some("Be helpful".to_string()),
        },
    };

    let result = cmd.execute(default_context()).await;
    assert!(result.is_ok());

    let agent = AgentManager::get_agent("update-multi").await.unwrap().unwrap();
    assert_eq!(agent.name, "Updated Multi");
    assert_eq!(agent.model, Some("claude-3".to_string()));
    assert_eq!(agent.provider, Some("anthropic".to_string()));
    assert_eq!(agent.system_prompt, Some("Be helpful".to_string()));
}

#[tokio::test]
#[serial]
async fn test_cli_agent_update_nonexistent() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    let cmd = AgentCommand {
        action: AgentAction::Update {
            id: "nonexistent".to_string(),
            name: Some("New Name".to_string()),
            model: None,
            provider: None,
            system_prompt: None,
        },
    };

    let result = cmd.execute(default_context()).await;
    assert!(result.is_err());
}

#[tokio::test]
#[serial]
async fn test_cli_agent_update_no_changes() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    AgentManager::create_agent(CreateAgentOptions {
        id: Some("no-changes".to_string()),
        name: "No Changes Agent".to_string(),
        description: None,
        model: None,
        provider: None,
        system_prompt: None,
        temperature: None,
        max_tokens: None,
        from_template: None,
    })
    .await
    .unwrap();

    let cmd = AgentCommand {
        action: AgentAction::Update {
            id: "no-changes".to_string(),
            name: None,
            model: None,
            provider: None,
            system_prompt: None,
        },
    };

    // Should succeed even with no changes
    let result = cmd.execute(default_context()).await;
    assert!(result.is_ok());
}

// =============================================================================
// SetDefault Command Tests
// =============================================================================

#[tokio::test]
#[serial]
async fn test_cli_agent_set_default() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    // Create agent
    AgentManager::create_agent(CreateAgentOptions {
        id: Some("set-default".to_string()),
        name: "Set Default Agent".to_string(),
        description: None,
        model: None,
        provider: None,
        system_prompt: None,
        temperature: None,
        max_tokens: None,
        from_template: None,
    })
    .await
    .unwrap();

    let cmd = AgentCommand {
        action: AgentAction::SetDefault {
            id: "set-default".to_string(),
        },
    };

    let result = cmd.execute(default_context()).await;
    assert!(result.is_ok());

    let default = AgentManager::get_default().await.unwrap();
    assert_eq!(default, Some("set-default".to_string()));
}

#[tokio::test]
#[serial]
async fn test_cli_agent_set_default_json() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    AgentManager::create_agent(CreateAgentOptions {
        id: Some("set-default-json".to_string()),
        name: "Set Default JSON".to_string(),
        description: None,
        model: None,
        provider: None,
        system_prompt: None,
        temperature: None,
        max_tokens: None,
        from_template: None,
    })
    .await
    .unwrap();

    let cmd = AgentCommand {
        action: AgentAction::SetDefault {
            id: "set-default-json".to_string(),
        },
    };

    let result = cmd.execute(json_context()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_cli_agent_set_default_nonexistent() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    let cmd = AgentCommand {
        action: AgentAction::SetDefault {
            id: "nonexistent".to_string(),
        },
    };

    let result = cmd.execute(default_context()).await;
    assert!(result.is_err());
}

#[tokio::test]
#[serial]
async fn test_cli_agent_set_default_changes_default() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    // Create two agents
    AgentManager::create_agent(CreateAgentOptions {
        id: Some("agent-a".to_string()),
        name: "Agent A".to_string(),
        description: None,
        model: None,
        provider: None,
        system_prompt: None,
        temperature: None,
        max_tokens: None,
        from_template: None,
    })
    .await
    .unwrap();

    AgentManager::create_agent(CreateAgentOptions {
        id: Some("agent-b".to_string()),
        name: "Agent B".to_string(),
        description: None,
        model: None,
        provider: None,
        system_prompt: None,
        temperature: None,
        max_tokens: None,
        from_template: None,
    })
    .await
    .unwrap();

    // Set A as default
    AgentManager::set_default("agent-a").await.unwrap();
    assert_eq!(
        AgentManager::get_default().await.unwrap(),
        Some("agent-a".to_string())
    );

    // Now set B as default via CLI
    let cmd = AgentCommand {
        action: AgentAction::SetDefault {
            id: "agent-b".to_string(),
        },
    };

    let result = cmd.execute(default_context()).await;
    assert!(result.is_ok());

    // Verify default changed
    assert_eq!(
        AgentManager::get_default().await.unwrap(),
        Some("agent-b".to_string())
    );
}

// =============================================================================
// Edge Case Tests
// =============================================================================

#[tokio::test]
#[serial]
async fn test_cli_agent_create_empty_name() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    let cmd = AgentCommand {
        action: AgentAction::Create {
            name: "".to_string(),
            model: None,
            provider: None,
            default: false,
        },
    };

    // Empty name should still work - ID will be generated
    let result = cmd.execute(default_context()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_cli_agent_create_whitespace_name() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    let cmd = AgentCommand {
        action: AgentAction::Create {
            name: "   ".to_string(),
            model: None,
            provider: None,
            default: false,
        },
    };

    // Whitespace-only name should still work - ID will be generated
    let result = cmd.execute(default_context()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_cli_agent_create_very_long_name() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    let long_name = "a".repeat(200);

    let cmd = AgentCommand {
        action: AgentAction::Create {
            name: long_name,
            model: None,
            provider: None,
            default: false,
        },
    };

    // Very long name should work - ID will be truncated
    let result = cmd.execute(default_context()).await;
    assert!(result.is_ok());

    let agents = AgentManager::list_agents().await.unwrap();
    assert_eq!(agents.len(), 1);
    // ID should be truncated to max length
    assert!(agents[0].id.len() <= 50);
}

#[tokio::test]
#[serial]
async fn test_cli_agent_context_verbose() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    let ctx = CliContext {
        json: false,
        global: false,
        workspace: false,
        name: None,
        verbose: true,
        quiet: false,
    };

    let cmd = AgentCommand {
        action: AgentAction::List,
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_cli_agent_context_quiet() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    let ctx = CliContext {
        json: false,
        global: false,
        workspace: false,
        name: None,
        verbose: false,
        quiet: true,
    };

    let cmd = AgentCommand {
        action: AgentAction::List,
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

// =============================================================================
// Integration Tests - Full Workflow
// =============================================================================

#[tokio::test]
#[serial]
async fn test_cli_agent_full_lifecycle() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    // 1. List - should be empty
    let cmd = AgentCommand {
        action: AgentAction::List,
    };
    cmd.execute(default_context()).await.unwrap();

    // 2. Create agent
    let cmd = AgentCommand {
        action: AgentAction::Create {
            name: "Lifecycle Agent".to_string(),
            model: Some("gpt-4o".to_string()),
            provider: Some("openai".to_string()),
            default: false,
        },
    };
    cmd.execute(default_context()).await.unwrap();

    // Verify created
    let agents = AgentManager::list_agents().await.unwrap();
    assert_eq!(agents.len(), 1);
    let agent_id = agents[0].id.clone();

    // 3. Show agent
    let cmd = AgentCommand {
        action: AgentAction::Show { id: agent_id.clone() },
    };
    cmd.execute(default_context()).await.unwrap();

    // 4. Update agent
    let cmd = AgentCommand {
        action: AgentAction::Update {
            id: agent_id.clone(),
            name: Some("Updated Lifecycle Agent".to_string()),
            model: Some("claude-3".to_string()),
            provider: Some("anthropic".to_string()),
            system_prompt: Some("Be very helpful.".to_string()),
        },
    };
    cmd.execute(default_context()).await.unwrap();

    // Verify update
    let agent = AgentManager::get_agent(&agent_id).await.unwrap().unwrap();
    assert_eq!(agent.name, "Updated Lifecycle Agent");
    assert_eq!(agent.model, Some("claude-3".to_string()));

    // 5. Set as default
    let cmd = AgentCommand {
        action: AgentAction::SetDefault { id: agent_id.clone() },
    };
    cmd.execute(default_context()).await.unwrap();

    // Verify default
    assert_eq!(
        AgentManager::get_default().await.unwrap(),
        Some(agent_id.clone())
    );

    // 6. Remove agent
    let cmd = AgentCommand {
        action: AgentAction::Remove { id: agent_id.clone() },
    };
    cmd.execute(default_context()).await.unwrap();

    // Verify removed
    let agents = AgentManager::list_agents().await.unwrap();
    assert!(agents.is_empty());

    // Verify default cleared
    assert!(AgentManager::get_default().await.unwrap().is_none());
}

#[tokio::test]
#[serial]
async fn test_cli_agent_multiple_agents_workflow() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    // Create multiple agents
    for i in 1..=5 {
        let cmd = AgentCommand {
            action: AgentAction::Create {
                name: format!("Agent {}", i),
                model: Some(format!("model-{}", i)),
                provider: None,
                default: i == 3, // Make agent 3 the default
            },
        };
        cmd.execute(default_context()).await.unwrap();
    }

    // List should show 5 agents
    let agents = AgentManager::list_agents().await.unwrap();
    assert_eq!(agents.len(), 5);

    // Agent 3 should be default
    let default = AgentManager::get_default().await.unwrap();
    assert!(default.is_some());

    // Remove agent 2
    let cmd = AgentCommand {
        action: AgentAction::Remove {
            id: "agent-2".to_string(),
        },
    };
    cmd.execute(default_context()).await.unwrap();

    // Should have 4 agents now
    let agents = AgentManager::list_agents().await.unwrap();
    assert_eq!(agents.len(), 4);

    // Default should still be agent 3
    let default = AgentManager::get_default().await.unwrap();
    assert_eq!(default, Some("agent-3".to_string()));
}

#[tokio::test]
#[serial]
async fn test_cli_agent_json_output_format() {
    let _temp_dir = setup_temp_state_dir();

    AgentManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    // Create an agent
    AgentManager::create_agent(CreateAgentOptions {
        id: Some("json-format-test".to_string()),
        name: "JSON Format Test".to_string(),
        description: Some("Testing JSON output".to_string()),
        model: Some("gpt-4o".to_string()),
        provider: Some("openai".to_string()),
        system_prompt: Some("Be helpful".to_string()),
        temperature: Some(0.7),
        max_tokens: Some(4096),
        from_template: None,
    })
    .await
    .unwrap();

    // Test list JSON
    let cmd = AgentCommand {
        action: AgentAction::List,
    };
    let result = cmd.execute(json_context()).await;
    assert!(result.is_ok());

    // Test show JSON
    let cmd = AgentCommand {
        action: AgentAction::Show {
            id: "json-format-test".to_string(),
        },
    };
    let result = cmd.execute(json_context()).await;
    assert!(result.is_ok());

    // Test set-default JSON
    let cmd = AgentCommand {
        action: AgentAction::SetDefault {
            id: "json-format-test".to_string(),
        },
    };
    let result = cmd.execute(json_context()).await;
    assert!(result.is_ok());

    // Test update JSON
    let cmd = AgentCommand {
        action: AgentAction::Update {
            id: "json-format-test".to_string(),
            name: Some("Updated JSON".to_string()),
            model: None,
            provider: None,
            system_prompt: None,
        },
    };
    let result = cmd.execute(json_context()).await;
    assert!(result.is_ok());

    // Test remove JSON
    let cmd = AgentCommand {
        action: AgentAction::Remove {
            id: "json-format-test".to_string(),
        },
    };
    let result = cmd.execute(json_context()).await;
    assert!(result.is_ok());
}
