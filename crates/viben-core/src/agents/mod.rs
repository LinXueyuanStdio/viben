//! Agent management for Viben

pub mod types;

use crate::config::{
    ensure_dir, file_exists, get_agent_config_path, get_agent_dir, get_agent_memory_dir,
    get_agent_sessions_dir, get_agents_dir, get_template_dir, get_templates_dir, read_yaml,
    write_yaml, ConfigManager,
};
use crate::error::{Error, Result};
use chrono::Utc;
use tokio::fs;
use uuid::Uuid;

pub use types::*;

/// AgentManager handles agent CRUD operations
pub struct AgentManager;

impl AgentManager {
    /// Initialize the agents directory
    pub async fn initialize() -> Result<()> {
        ensure_dir(&get_agents_dir()).await?;
        ensure_dir(&get_templates_dir()).await?;
        Ok(())
    }

    /// List all agents
    pub async fn list_agents() -> Result<Vec<Agent>> {
        let agents_dir = get_agents_dir();
        if !file_exists(&agents_dir) {
            return Ok(Vec::new());
        }

        let mut agents = Vec::new();
        let mut entries = fs::read_dir(&agents_dir).await?;

        while let Some(entry) = entries.next_entry().await? {
            if entry.file_type().await?.is_dir() {
                let id = entry.file_name().to_string_lossy().to_string();
                if let Some(agent) = Self::get_agent(&id).await? {
                    agents.push(agent);
                }
            }
        }

        Ok(agents)
    }

    /// Get an agent by ID
    pub async fn get_agent(id: &str) -> Result<Option<Agent>> {
        let agent_dir = get_agent_dir(id);
        let config_path = get_agent_config_path(id);
        if !file_exists(&config_path) {
            return Ok(None);
        }

        let config: Option<AgentConfigFile> = read_yaml(&config_path).await?;
        Ok(config.map(|c| {
            let mut agent: Agent = c.into();
            agent.id = id.to_string();
            // Set the absolute path to the agent directory
            agent.path = Some(agent_dir.to_string_lossy().to_string());
            agent
        }))
    }

    /// Create a new agent
    pub async fn create_agent(options: CreateAgentOptions) -> Result<Agent> {
        let id = options
            .id
            .clone()
            .unwrap_or_else(|| Self::generate_agent_id(&options.name));
        let agent_dir = get_agent_dir(&id);

        // Check if agent already exists
        if file_exists(&agent_dir) {
            return Err(Error::AgentAlreadyExists(id));
        }

        // Create from template if specified
        let mut base_config = AgentTemplateConfig {
            name: options.name.clone(),
            description: None,
            model: None,
            provider: None,
            system_prompt: None,
            temperature: None,
            max_tokens: None,
        };

        if let Some(template_id) = &options.from_template {
            if let Some(template) = Self::get_template(template_id).await? {
                base_config = template.config;
            }
        }

        let now = Utc::now();
        let config = AgentConfigFile {
            name: options.name,
            description: options.description.or(base_config.description),
            model: options.model.or(base_config.model),
            provider: options.provider.or(base_config.provider),
            system_prompt: options.system_prompt.or(base_config.system_prompt),
            append_prompt: None,
            temperature: options.temperature.or(base_config.temperature),
            max_tokens: options.max_tokens.or(base_config.max_tokens),
            executor_type: Some("CLAUDE_CODE".to_string()),
            executor_config: None,
            mcp_servers: Vec::new(),
            skills: Vec::new(),
            plan_mode: false,
            approvals: false,
            created_at: now,
            updated_at: now,
        };

        // Create agent directory and config
        ensure_dir(&agent_dir).await?;
        write_yaml(&get_agent_config_path(&id), &config).await?;

        // Create subdirectories
        ensure_dir(&get_agent_sessions_dir(&id)).await?;
        ensure_dir(&get_agent_memory_dir(&id)).await?;

        let mut agent: Agent = config.into();
        agent.id = id;
        agent.path = Some(agent_dir.to_string_lossy().to_string());
        Ok(agent)
    }

    /// Remove an agent
    pub async fn remove_agent(id: &str) -> Result<()> {
        let agent_dir = get_agent_dir(id);
        if !file_exists(&agent_dir) {
            return Err(Error::AgentNotFound(id.to_string()));
        }

        // Check if this is the default agent
        let default_agent = ConfigManager::get_default_agent().await?;
        if default_agent.as_deref() == Some(id) {
            ConfigManager::set_default_agent(None).await?;
        }

        fs::remove_dir_all(&agent_dir).await?;
        Ok(())
    }

    /// Update an agent
    pub async fn update_agent(id: &str, updates: AgentUpdate) -> Result<Agent> {
        let agent = Self::get_agent(id)
            .await?
            .ok_or_else(|| Error::AgentNotFound(id.to_string()))?;

        let now = Utc::now();
        let config = AgentConfigFile {
            name: updates.name.unwrap_or(agent.name),
            description: updates.description.or(agent.description),
            model: updates.model.or(agent.model),
            provider: updates.provider.or(agent.provider),
            system_prompt: updates.system_prompt.or(agent.system_prompt),
            append_prompt: updates.append_prompt.or(agent.append_prompt),
            temperature: updates.temperature.or(agent.temperature),
            max_tokens: updates.max_tokens.or(agent.max_tokens),
            executor_type: updates.executor_type.or(agent.executor_type),
            executor_config: updates.executor_config.or(agent.executor_config),
            mcp_servers: updates.mcp_servers.unwrap_or(agent.mcp_servers),
            skills: updates.skills.unwrap_or(agent.skills),
            plan_mode: updates.plan_mode.unwrap_or(agent.plan_mode),
            approvals: updates.approvals.unwrap_or(agent.approvals),
            created_at: agent.created_at,
            updated_at: now,
        };

        write_yaml(&get_agent_config_path(id), &config).await?;

        let mut updated: Agent = config.into();
        updated.id = id.to_string();
        updated.path = Some(get_agent_dir(id).to_string_lossy().to_string());
        Ok(updated)
    }

    /// Set the default agent
    pub async fn set_default(id: &str) -> Result<()> {
        let agent = Self::get_agent(id).await?;
        if agent.is_none() {
            return Err(Error::AgentNotFound(id.to_string()));
        }
        ConfigManager::set_default_agent(Some(id.to_string())).await
    }

    /// Get the default agent ID
    pub async fn get_default() -> Result<Option<String>> {
        ConfigManager::get_default_agent().await
    }

    // ========================================================================
    // Templates
    // ========================================================================

    /// List all templates
    pub async fn list_templates() -> Result<Vec<AgentTemplate>> {
        let templates_dir = get_templates_dir();
        if !file_exists(&templates_dir) {
            return Ok(Vec::new());
        }

        let mut templates = Vec::new();
        let mut entries = fs::read_dir(&templates_dir).await?;

        while let Some(entry) = entries.next_entry().await? {
            if entry.file_type().await?.is_dir() {
                let id = entry.file_name().to_string_lossy().to_string();
                if let Some(template) = Self::get_template(&id).await? {
                    templates.push(template);
                }
            }
        }

        Ok(templates)
    }

    /// Get a template by ID
    pub async fn get_template(id: &str) -> Result<Option<AgentTemplate>> {
        let template_dir = get_template_dir(id);
        let config_path = template_dir.join("config.yaml");

        if !file_exists(&config_path) {
            return Ok(None);
        }

        #[derive(serde::Deserialize)]
        struct TemplateFile {
            name: String,
            description: Option<String>,
            model: Option<String>,
            provider: Option<String>,
            system_prompt: Option<String>,
            temperature: Option<f32>,
            max_tokens: Option<u32>,
            created_at: chrono::DateTime<Utc>,
        }

        let file: Option<TemplateFile> = read_yaml(&config_path).await?;
        Ok(file.map(|f| AgentTemplate {
            id: id.to_string(),
            name: f.name.clone(),
            description: f.description.clone(),
            config: AgentTemplateConfig {
                name: f.name,
                description: f.description,
                model: f.model,
                provider: f.provider,
                system_prompt: f.system_prompt,
                temperature: f.temperature,
                max_tokens: f.max_tokens,
            },
            created_at: f.created_at,
        }))
    }

    /// Create a template from an agent
    pub async fn create_template(agent_id: &str, template_id: &str) -> Result<AgentTemplate> {
        let agent = Self::get_agent(agent_id)
            .await?
            .ok_or_else(|| Error::AgentNotFound(agent_id.to_string()))?;

        let template_dir = get_template_dir(template_id);
        if file_exists(&template_dir) {
            return Err(Error::TemplateAlreadyExists(template_id.to_string()));
        }

        let now = Utc::now();

        #[derive(serde::Serialize)]
        struct TemplateFile {
            name: String,
            description: Option<String>,
            model: Option<String>,
            provider: Option<String>,
            system_prompt: Option<String>,
            temperature: Option<f32>,
            max_tokens: Option<u32>,
            created_at: chrono::DateTime<Utc>,
        }

        let file = TemplateFile {
            name: agent.name.clone(),
            description: agent.description.clone(),
            model: agent.model.clone(),
            provider: agent.provider.clone(),
            system_prompt: agent.system_prompt.clone(),
            temperature: agent.temperature,
            max_tokens: agent.max_tokens,
            created_at: now,
        };

        ensure_dir(&template_dir).await?;
        write_yaml(&template_dir.join("config.yaml"), &file).await?;

        Ok(AgentTemplate {
            id: template_id.to_string(),
            name: file.name.clone(),
            description: file.description.clone(),
            config: AgentTemplateConfig {
                name: file.name,
                description: file.description,
                model: file.model,
                provider: file.provider,
                system_prompt: file.system_prompt,
                temperature: file.temperature,
                max_tokens: file.max_tokens,
            },
            created_at: now,
        })
    }

    /// Create an agent from a template
    pub async fn create_from_template(template_id: &str, agent_id: &str) -> Result<Agent> {
        Self::create_agent(CreateAgentOptions {
            id: Some(agent_id.to_string()),
            name: agent_id.to_string(),
            description: None,
            model: None,
            provider: None,
            system_prompt: None,
            temperature: None,
            max_tokens: None,
            from_template: Some(template_id.to_string()),
        })
        .await
    }

    // ========================================================================
    // Sessions
    // ========================================================================

    /// List sessions for an agent
    pub async fn list_sessions(agent_id: &str) -> Result<Vec<AgentSession>> {
        let sessions_dir = get_agent_sessions_dir(agent_id);
        if !file_exists(&sessions_dir) {
            return Ok(Vec::new());
        }

        let mut sessions = Vec::new();
        let mut entries = fs::read_dir(&sessions_dir).await?;

        while let Some(entry) = entries.next_entry().await? {
            if entry.file_type().await?.is_dir() {
                let session_id = entry.file_name().to_string_lossy().to_string();
                let session_path = entry.path().join("session.yaml");

                if let Some(file) = read_yaml::<SessionFile>(&session_path).await? {
                    sessions.push(AgentSession {
                        id: session_id,
                        agent_id: agent_id.to_string(),
                        name: file.name,
                        created_at: file.created_at,
                        last_accessed_at: file.last_accessed_at,
                    });
                }
            }
        }

        // Sort by last accessed (most recent first)
        sessions.sort_by(|a, b| b.last_accessed_at.cmp(&a.last_accessed_at));
        Ok(sessions)
    }

    /// Create a new session
    pub async fn create_session(agent_id: &str, name: Option<&str>) -> Result<AgentSession> {
        let agent = Self::get_agent(agent_id).await?;
        if agent.is_none() {
            return Err(Error::AgentNotFound(agent_id.to_string()));
        }

        let session_id = Uuid::new_v4().to_string();
        let session_dir = get_agent_sessions_dir(agent_id).join(&session_id);
        let now = Utc::now();

        let session = SessionFile {
            id: session_id.clone(),
            name: name.map(|s| s.to_string()),
            created_at: now,
            last_accessed_at: now,
        };

        ensure_dir(&session_dir).await?;
        write_yaml(&session_dir.join("session.yaml"), &session).await?;

        Ok(AgentSession {
            id: session_id,
            agent_id: agent_id.to_string(),
            name: session.name,
            created_at: now,
            last_accessed_at: now,
        })
    }

    /// Remove a session
    pub async fn remove_session(agent_id: &str, session_id: &str) -> Result<()> {
        let session_dir = get_agent_sessions_dir(agent_id).join(session_id);
        if !file_exists(&session_dir) {
            return Err(Error::SessionNotFound(session_id.to_string()));
        }
        fs::remove_dir_all(&session_dir).await?;
        Ok(())
    }

    // ========================================================================
    // Memory
    // ========================================================================

    /// Get agent memory
    pub async fn get_memory(agent_id: &str) -> Result<AgentMemory> {
        let memory_path = get_agent_memory_dir(agent_id).join("CLAUDE.md");

        let content = if file_exists(&memory_path) {
            fs::read_to_string(&memory_path).await?
        } else {
            String::new()
        };

        Ok(AgentMemory {
            agent_id: agent_id.to_string(),
            content,
            updated_at: Utc::now(),
        })
    }

    /// Append content to agent memory
    pub async fn append_memory(agent_id: &str, content: &str) -> Result<()> {
        let memory_dir = get_agent_memory_dir(agent_id);
        let memory_path = memory_dir.join("CLAUDE.md");

        ensure_dir(&memory_dir).await?;

        let new_content = if file_exists(&memory_path) {
            let existing = fs::read_to_string(&memory_path).await?;
            format!("{}\n{}", existing, content)
        } else {
            content.to_string()
        };

        fs::write(&memory_path, new_content).await?;
        Ok(())
    }

    // ========================================================================
    // Helpers
    // ========================================================================

    /// Generate a valid agent ID from a name
    fn generate_agent_id(name: &str) -> String {
        let id: String = name
            .to_lowercase()
            .chars()
            .map(|c| if c.is_alphanumeric() { c } else { '-' })
            .collect();

        let id = id.trim_matches('-').to_string();

        if id.is_empty() {
            format!("agent-{}", chrono::Utc::now().timestamp())
        } else if id.len() > 50 {
            id[..50].to_string()
        } else {
            id
        }
    }
}
