//! Path utilities for Viben configuration files

use std::path::PathBuf;

/// Get the Viben state directory path
/// Default: ~/.viben
/// Can be overridden with VIBEN_STATE_DIR environment variable
pub fn get_state_dir() -> PathBuf {
    if let Ok(dir) = std::env::var("VIBEN_STATE_DIR") {
        PathBuf::from(dir)
    } else {
        dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".viben")
    }
}

/// Get the path to the global config file
pub fn get_config_path() -> PathBuf {
    get_state_dir().join("config.yaml")
}

/// Get the path to the providers config file
pub fn get_providers_path() -> PathBuf {
    get_state_dir().join("providers.yaml")
}

/// Get the path to the models config file
pub fn get_models_path() -> PathBuf {
    get_state_dir().join("models.yaml")
}

/// Get the agents directory path
pub fn get_agents_dir() -> PathBuf {
    get_state_dir().join("agents")
}

/// Get the path to a specific agent's directory
pub fn get_agent_dir(agent_id: &str) -> PathBuf {
    get_agents_dir().join(agent_id)
}

/// Get the path to an agent's config file
pub fn get_agent_config_path(agent_id: &str) -> PathBuf {
    get_agent_dir(agent_id).join("config.yaml")
}

/// Get the path to an agent's MCP servers config
pub fn get_agent_mcp_servers_path(agent_id: &str) -> PathBuf {
    get_agent_dir(agent_id).join("mcp_servers.json")
}

/// Get the path to an agent's skills directory
pub fn get_agent_skills_dir(agent_id: &str) -> PathBuf {
    get_agent_dir(agent_id).join("skills")
}

/// Get the path to an agent's memory directory
pub fn get_agent_memory_dir(agent_id: &str) -> PathBuf {
    get_agent_dir(agent_id).join("memory")
}

/// Get the path to an agent's sessions directory
pub fn get_agent_sessions_dir(agent_id: &str) -> PathBuf {
    get_agent_dir(agent_id).join(".agent_sessions")
}

/// Get the agent templates directory path
pub fn get_templates_dir() -> PathBuf {
    get_state_dir().join("agent-templates")
}

/// Get the path to a specific template's directory
pub fn get_template_dir(template_id: &str) -> PathBuf {
    get_templates_dir().join(template_id)
}

/// Get the shared MCP directory path
pub fn get_shared_mcp_dir() -> PathBuf {
    get_state_dir().join("mcp")
}

/// Get the shared skills directory path
pub fn get_shared_skills_dir() -> PathBuf {
    get_state_dir().join("skills")
}

/// Get the providers directory path
pub fn get_providers_dir() -> PathBuf {
    get_state_dir().join("providers")
}

/// Get the path to a specific provider's directory
pub fn get_provider_dir(provider_id: &str) -> PathBuf {
    get_providers_dir().join(provider_id)
}

/// Get the path to a provider's models config file
pub fn get_provider_models_path(provider_id: &str) -> PathBuf {
    get_provider_dir(provider_id).join("models.yaml")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_state_dir() {
        let dir = get_state_dir();
        assert!(dir.to_string_lossy().contains(".viben"));
    }

    #[test]
    fn test_get_agent_paths() {
        let agent_id = "test-agent";
        let config_path = get_agent_config_path(agent_id);
        assert!(config_path.to_string_lossy().contains("test-agent"));
        assert!(config_path.to_string_lossy().contains("config.yaml"));
    }
}
