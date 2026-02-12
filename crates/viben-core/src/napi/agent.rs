//! NAPI bindings for Agent management

use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::agents::AgentManager;
use crate::{AgentUpdate as CoreAgentUpdate, CreateAgentOptions as CoreCreateAgentOptions};

/// Agent information returned to Node.js
#[napi(object)]
pub struct Agent {
    pub id: String,
    /// Absolute path to the agent directory (e.g., ~/.viben/agents/hello-agent)
    pub path: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub model: Option<String>,
    pub provider: Option<String>,
    pub system_prompt: Option<String>,
    pub append_prompt: Option<String>,
    pub temperature: Option<f64>,
    pub max_tokens: Option<i64>,
    pub executor_type: Option<String>,
    pub plan_mode: bool,
    pub approvals: bool,
}

impl From<crate::Agent> for Agent {
    fn from(a: crate::Agent) -> Self {
        Agent {
            id: a.id,
            path: a.path,
            name: a.name,
            description: a.description,
            model: a.model,
            provider: a.provider,
            system_prompt: a.system_prompt,
            append_prompt: a.append_prompt,
            temperature: a.temperature.map(|t| t as f64),
            max_tokens: a.max_tokens.map(|m| m as i64),
            executor_type: a.executor_type,
            plan_mode: a.plan_mode,
            approvals: a.approvals,
        }
    }
}

/// Options for creating an agent
#[napi(object)]
pub struct CreateAgentOptions {
    pub name: String,
    pub description: Option<String>,
    pub model: Option<String>,
    pub provider: Option<String>,
    pub system_prompt: Option<String>,
    pub temperature: Option<f64>,
    pub max_tokens: Option<i64>,
    pub from_template: Option<String>,
}

/// Options for updating an agent
#[napi(object)]
pub struct UpdateAgentOptions {
    pub name: Option<String>,
    pub description: Option<String>,
    pub model: Option<String>,
    pub provider: Option<String>,
    pub system_prompt: Option<String>,
    pub temperature: Option<f64>,
    pub max_tokens: Option<i64>,
}

/// List all agents
#[napi]
pub async fn agent_list() -> Result<Vec<Agent>> {
    let agents = AgentManager::list_agents()
        .await
        .map_err(|e| Error::from_reason(e.to_string()))?;
    Ok(agents.into_iter().map(Agent::from).collect())
}

/// Get an agent by ID
#[napi]
pub async fn agent_get(id: String) -> Result<Option<Agent>> {
    let agent = AgentManager::get_agent(&id)
        .await
        .map_err(|e| Error::from_reason(e.to_string()))?;
    Ok(agent.map(Agent::from))
}

/// Create a new agent
#[napi]
pub async fn agent_create(options: CreateAgentOptions) -> Result<Agent> {
    let core_options = CoreCreateAgentOptions {
        id: None,
        name: options.name,
        description: options.description,
        model: options.model,
        provider: options.provider,
        system_prompt: options.system_prompt,
        temperature: options.temperature.map(|t| t as f32),
        max_tokens: options.max_tokens.map(|m| m as u32),
        from_template: options.from_template,
        base_path: None,
    };

    let agent = AgentManager::create_agent(core_options)
        .await
        .map_err(|e| Error::from_reason(e.to_string()))?;
    Ok(Agent::from(agent))
}

/// Update an agent
#[napi]
pub async fn agent_update(id: String, options: UpdateAgentOptions) -> Result<Agent> {
    let update = CoreAgentUpdate {
        name: options.name,
        description: options.description,
        model: options.model,
        provider: options.provider,
        system_prompt: options.system_prompt,
        temperature: options.temperature.map(|t| t as f32),
        max_tokens: options.max_tokens.map(|m| m as u32),
        ..Default::default()
    };

    let agent = AgentManager::update_agent(&id, update)
        .await
        .map_err(|e| Error::from_reason(e.to_string()))?;
    Ok(Agent::from(agent))
}

/// Remove an agent
#[napi]
pub async fn agent_remove(id: String) -> Result<()> {
    AgentManager::remove_agent(&id)
        .await
        .map_err(|e| Error::from_reason(e.to_string()))
}

/// Set the default agent
#[napi]
pub async fn agent_set_default(id: String) -> Result<()> {
    AgentManager::set_default(&id)
        .await
        .map_err(|e| Error::from_reason(e.to_string()))
}

/// Get the default agent ID
#[napi]
pub async fn agent_get_default() -> Result<Option<String>> {
    AgentManager::get_default()
        .await
        .map_err(|e| Error::from_reason(e.to_string()))
}
