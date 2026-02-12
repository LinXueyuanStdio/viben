//! NAPI bindings for Executor management

use napi::bindgen_prelude::*;
use napi_derive::napi;
use std::str::FromStr;

use crate::executors::{
    AvailabilityInfo as CoreAvailabilityInfo, BaseCodingAgent, CodingAgent,
    StandardCodingAgentExecutor,
};

/// Executor type enum for NAPI
#[napi(string_enum)]
pub enum ExecutorType {
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

impl From<BaseCodingAgent> for ExecutorType {
    fn from(agent: BaseCodingAgent) -> Self {
        match agent {
            BaseCodingAgent::ClaudeCode => ExecutorType::ClaudeCode,
            BaseCodingAgent::Amp => ExecutorType::Amp,
            BaseCodingAgent::Gemini => ExecutorType::Gemini,
            BaseCodingAgent::Codex => ExecutorType::Codex,
            BaseCodingAgent::Opencode => ExecutorType::Opencode,
            BaseCodingAgent::CursorAgent => ExecutorType::CursorAgent,
            BaseCodingAgent::QwenCode => ExecutorType::QwenCode,
            BaseCodingAgent::Copilot => ExecutorType::Copilot,
            BaseCodingAgent::Droid => ExecutorType::Droid,
        }
    }
}

impl From<ExecutorType> for BaseCodingAgent {
    fn from(et: ExecutorType) -> Self {
        match et {
            ExecutorType::ClaudeCode => BaseCodingAgent::ClaudeCode,
            ExecutorType::Amp => BaseCodingAgent::Amp,
            ExecutorType::Gemini => BaseCodingAgent::Gemini,
            ExecutorType::Codex => BaseCodingAgent::Codex,
            ExecutorType::Opencode => BaseCodingAgent::Opencode,
            ExecutorType::CursorAgent => BaseCodingAgent::CursorAgent,
            ExecutorType::QwenCode => BaseCodingAgent::QwenCode,
            ExecutorType::Copilot => BaseCodingAgent::Copilot,
            ExecutorType::Droid => BaseCodingAgent::Droid,
        }
    }
}

/// Availability status for NAPI
#[napi(string_enum)]
pub enum AvailabilityStatus {
    LoginDetected,
    InstallationFound,
    NotFound,
}

/// Executor availability info for NAPI
#[napi(object)]
pub struct ExecutorAvailability {
    pub status: AvailabilityStatus,
    pub last_auth_timestamp: Option<i64>,
}

impl From<CoreAvailabilityInfo> for ExecutorAvailability {
    fn from(info: CoreAvailabilityInfo) -> Self {
        match info {
            CoreAvailabilityInfo::LoginDetected { last_auth_timestamp } => ExecutorAvailability {
                status: AvailabilityStatus::LoginDetected,
                last_auth_timestamp: Some(last_auth_timestamp),
            },
            CoreAvailabilityInfo::InstallationFound => ExecutorAvailability {
                status: AvailabilityStatus::InstallationFound,
                last_auth_timestamp: None,
            },
            CoreAvailabilityInfo::NotFound => ExecutorAvailability {
                status: AvailabilityStatus::NotFound,
                last_auth_timestamp: None,
            },
        }
    }
}

/// Executor capability for NAPI
#[napi(string_enum)]
pub enum ExecutorCapability {
    SessionFork,
    SetupHelper,
    ContextUsage,
}

/// Executor information returned to Node.js
#[napi(object)]
pub struct Executor {
    pub id: String,
    pub name: String,
    pub description: String,
    pub availability: ExecutorAvailability,
    pub capabilities: Vec<ExecutorCapability>,
    pub supports_mcp: bool,
    pub mcp_config_path: Option<String>,
}

/// Get executor name from type
fn get_executor_name(agent: &BaseCodingAgent) -> String {
    match agent {
        BaseCodingAgent::ClaudeCode => "Claude Code".to_string(),
        BaseCodingAgent::Amp => "Amp".to_string(),
        BaseCodingAgent::Gemini => "Gemini CLI".to_string(),
        BaseCodingAgent::Codex => "OpenAI Codex".to_string(),
        BaseCodingAgent::Opencode => "OpenCode".to_string(),
        BaseCodingAgent::CursorAgent => "Cursor".to_string(),
        BaseCodingAgent::QwenCode => "Qwen Code".to_string(),
        BaseCodingAgent::Copilot => "GitHub Copilot".to_string(),
        BaseCodingAgent::Droid => "Droid".to_string(),
    }
}

/// Get executor description from type
fn get_executor_description(agent: &BaseCodingAgent) -> String {
    match agent {
        BaseCodingAgent::ClaudeCode => "Anthropic's official CLI for Claude".to_string(),
        BaseCodingAgent::Amp => "Sourcegraph Amp".to_string(),
        BaseCodingAgent::Gemini => "Google Gemini CLI".to_string(),
        BaseCodingAgent::Codex => "OpenAI Codex CLI".to_string(),
        BaseCodingAgent::Opencode => "Open source coding agent".to_string(),
        BaseCodingAgent::CursorAgent => "AI-first code editor".to_string(),
        BaseCodingAgent::QwenCode => "Alibaba Qwen coding agent".to_string(),
        BaseCodingAgent::Copilot => "GitHub Copilot coding assistant".to_string(),
        BaseCodingAgent::Droid => "Droid coding agent".to_string(),
    }
}

/// Convert BaseCodingAgent to CodingAgent for calling trait methods
fn to_coding_agent(agent: &BaseCodingAgent) -> CodingAgent {
    match agent {
        BaseCodingAgent::ClaudeCode => CodingAgent::ClaudeCode(Default::default()),
        BaseCodingAgent::Amp => CodingAgent::Amp(Default::default()),
        BaseCodingAgent::Gemini => CodingAgent::Gemini(Default::default()),
        BaseCodingAgent::Codex => CodingAgent::Codex(Default::default()),
        BaseCodingAgent::Opencode => CodingAgent::Opencode(Default::default()),
        BaseCodingAgent::CursorAgent => CodingAgent::CursorAgent(Default::default()),
        BaseCodingAgent::QwenCode => CodingAgent::QwenCode(Default::default()),
        BaseCodingAgent::Copilot => CodingAgent::Copilot(Default::default()),
        BaseCodingAgent::Droid => CodingAgent::Droid(Default::default()),
    }
}

/// All known executor IDs
const EXECUTOR_IDS: &[&str] = &[
    "CLAUDE_CODE",
    "AMP",
    "GEMINI",
    "CODEX",
    "OPENCODE",
    "CURSOR_AGENT",
    "QWEN_CODE",
    "COPILOT",
    "DROID",
];

/// List all available executor types
#[napi]
pub fn executor_list() -> Vec<Executor> {
    use crate::executors::executors::BaseAgentCapability;

    EXECUTOR_IDS
        .iter()
        .filter_map(|id| BaseCodingAgent::from_str(id).ok())
        .map(|agent| {
            let coding_agent = to_coding_agent(&agent);
            let availability = coding_agent.get_availability_info();
            let capabilities = coding_agent.capabilities();
            let mcp_path = coding_agent.default_mcp_config_path();

            Executor {
                id: agent.to_string(),
                name: get_executor_name(&agent),
                description: get_executor_description(&agent),
                availability: availability.into(),
                capabilities: capabilities
                    .into_iter()
                    .map(|cap| match cap {
                        BaseAgentCapability::SessionFork => ExecutorCapability::SessionFork,
                        BaseAgentCapability::SetupHelper => ExecutorCapability::SetupHelper,
                        BaseAgentCapability::ContextUsage => ExecutorCapability::ContextUsage,
                    })
                    .collect(),
                supports_mcp: coding_agent.supports_mcp(),
                mcp_config_path: mcp_path.map(|p| p.to_string_lossy().to_string()),
            }
        })
        .collect()
}

/// Get a specific executor by ID
#[napi]
pub fn executor_get(id: String) -> Option<Executor> {
    use crate::executors::executors::BaseAgentCapability;

    id.parse::<BaseCodingAgent>().ok().map(|agent| {
        let coding_agent = to_coding_agent(&agent);
        let availability = coding_agent.get_availability_info();
        let capabilities = coding_agent.capabilities();
        let mcp_path = coding_agent.default_mcp_config_path();

        Executor {
            id: agent.to_string(),
            name: get_executor_name(&agent),
            description: get_executor_description(&agent),
            availability: availability.into(),
            capabilities: capabilities
                .into_iter()
                .map(|cap| match cap {
                    BaseAgentCapability::SessionFork => ExecutorCapability::SessionFork,
                    BaseAgentCapability::SetupHelper => ExecutorCapability::SetupHelper,
                    BaseAgentCapability::ContextUsage => ExecutorCapability::ContextUsage,
                })
                .collect(),
            supports_mcp: coding_agent.supports_mcp(),
            mcp_config_path: mcp_path.map(|p| p.to_string_lossy().to_string()),
        }
    })
}

/// Check availability for a specific executor
#[napi]
pub fn executor_check_availability(id: String) -> Result<ExecutorAvailability> {
    let agent: BaseCodingAgent = id
        .parse()
        .map_err(|_| Error::from_reason(format!("Unknown executor: {}", id)))?;
    let coding_agent = to_coding_agent(&agent);
    let availability = coding_agent.get_availability_info();
    Ok(availability.into())
}

/// Get all executor IDs
#[napi]
pub fn executor_get_all_ids() -> Vec<String> {
    EXECUTOR_IDS.iter().map(|s| s.to_string()).collect()
}
