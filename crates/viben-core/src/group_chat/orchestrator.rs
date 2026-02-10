//! Agent orchestrator for group chat
//!
//! Handles parallel invocation of agents in group chat sessions.
//! Each agent receives the user message prepended with other agents' previous responses.

use std::path::PathBuf;
use tokio::sync::broadcast;

use crate::agents::AgentManager;
use crate::executors::{CodingAgent, ExecutionEnv, RepoContext, StandardCodingAgentExecutor};
use crate::executors::executors::{
    Amp, ClaudeCode, Codex, Copilot, CursorAgent, Droid, Gemini, Opencode, QwenCode,
};

use super::service::GroupChatService;
use super::types::{
    AgentResponse, AgentRolloutMessage, GroupChatError, GroupChatMember,
    MemberType, UIMessage,
};

/// Agent execution state
#[derive(Debug, Clone)]
pub enum AgentExecutionState {
    /// Agent is thinking/processing
    Thinking,
    /// Agent completed with response
    Completed { content: String },
    /// Agent failed with error
    Failed { error: String },
}

/// Events emitted during agent orchestration
#[derive(Debug, Clone)]
pub enum OrchestratorEvent {
    /// Agent started processing
    AgentThinking {
        group_chat_id: String,
        session_id: String,
        agent_id: String,
        agent_name: String,
    },
    /// Agent response (streaming progress)
    AgentProgress {
        group_chat_id: String,
        session_id: String,
        agent_id: String,
        delta: String,
    },
    /// Agent completed
    AgentResponse {
        group_chat_id: String,
        session_id: String,
        agent_id: String,
        agent_name: String,
        content: String,
    },
    /// Agent failed
    AgentError {
        group_chat_id: String,
        session_id: String,
        agent_id: String,
        error: String,
    },
}

/// Orchestrator configuration
#[derive(Debug, Clone)]
pub struct OrchestratorConfig {
    /// Timeout for agent execution in seconds
    pub timeout_secs: u64,
    /// Maximum concurrent agent executions
    pub max_concurrent: usize,
}

impl Default for OrchestratorConfig {
    fn default() -> Self {
        Self {
            timeout_secs: 300, // 5 minutes
            max_concurrent: 10,
        }
    }
}

/// Agent orchestrator for managing parallel agent execution in group chats
pub struct AgentOrchestrator {
    /// Group chat service for file operations
    service: GroupChatService,
    /// Broadcast channel for orchestrator events
    event_tx: broadcast::Sender<OrchestratorEvent>,
    /// Configuration
    config: OrchestratorConfig,
}

impl AgentOrchestrator {
    /// Create a new agent orchestrator
    pub fn new(service: GroupChatService) -> Self {
        let (event_tx, _) = broadcast::channel(1000);
        Self {
            service,
            event_tx,
            config: OrchestratorConfig::default(),
        }
    }

    /// Create with custom config
    pub fn with_config(service: GroupChatService, config: OrchestratorConfig) -> Self {
        let (event_tx, _) = broadcast::channel(1000);
        Self {
            service,
            event_tx,
            config,
        }
    }

    /// Subscribe to orchestrator events
    pub fn subscribe(&self) -> broadcast::Receiver<OrchestratorEvent> {
        self.event_tx.subscribe()
    }

    /// Get the event sender (for forwarding to WebSocket)
    pub fn event_sender(&self) -> broadcast::Sender<OrchestratorEvent> {
        self.event_tx.clone()
    }

    /// Trigger all agents in a group chat session
    ///
    /// This method:
    /// 1. Gets the group chat config to find all agent members
    /// 2. Reads previous responses from responses.jsonl
    /// 3. For each agent, builds a message with other agents' responses prepended
    /// 4. Spawns parallel tasks for each agent
    /// 5. Returns immediately, agents run in background
    ///
    /// Agent responses are broadcast via the event channel and written to:
    /// - messages.ui.jsonl (user-facing view)
    /// - responses.jsonl (for next round context)
    /// - agents/<id>/messages.rollout.jsonl (agent view with tool calls)
    pub async fn trigger_agents(
        &self,
        group_chat_id: &str,
        session_id: &str,
        user_message: &str,
        sender_name: &str,
    ) -> Result<Vec<String>, GroupChatError> {
        tracing::info!(
            target: "viben::group_chat::orchestrator",
            "Triggering agents for group_chat={}, session={}",
            group_chat_id, session_id
        );

        // Get group chat config
        let config = self.service.get_group_chat(group_chat_id).await?;

        // Get all agent members
        let agents: Vec<&GroupChatMember> = config
            .members
            .iter()
            .filter(|m| m.member_type == MemberType::Agent)
            .collect();

        if agents.is_empty() {
            tracing::debug!(
                target: "viben::group_chat::orchestrator",
                "No agent members in group chat"
            );
            return Ok(Vec::new());
        }

        tracing::info!(
            target: "viben::group_chat::orchestrator",
            "Found {} agent members to trigger",
            agents.len()
        );

        // Read previous responses for context building
        let previous_responses = self
            .service
            .read_responses(group_chat_id, session_id)
            .await
            .unwrap_or_default();

        let mut triggered_agents = Vec::new();

        // Spawn a task for each agent
        for agent_member in agents {
            let agent_id = agent_member.id.clone();
            let agent_name = agent_member.display_name.clone();
            let model = agent_member.model.clone();

            // Build message for this agent
            let message_for_agent = build_message_for_agent(
                &agent_id,
                user_message,
                sender_name,
                &previous_responses,
            );

            tracing::debug!(
                target: "viben::group_chat::orchestrator",
                "Built message for agent {}: {} chars",
                agent_id, message_for_agent.len()
            );

            // Clone what we need for the spawned task
            let group_chat_id = group_chat_id.to_string();
            let session_id = session_id.to_string();
            let service = self.service.clone();
            let event_tx = self.event_tx.clone();
            let workspace_path = self.service.workspace_path().to_path_buf();
            let timeout_secs = self.config.timeout_secs;

            triggered_agents.push(agent_id.clone());

            // Spawn agent execution task
            tokio::spawn(async move {
                execute_agent(
                    service,
                    event_tx,
                    workspace_path,
                    &group_chat_id,
                    &session_id,
                    &agent_id,
                    &agent_name,
                    model.as_deref(),
                    &message_for_agent,
                    timeout_secs,
                )
                .await
            });
        }

        Ok(triggered_agents)
    }

    /// Get the group chat service (for direct access if needed)
    pub fn service(&self) -> &GroupChatService {
        &self.service
    }
}

/// Build a message to send to a specific agent
///
/// Prepends other agents' responses to the user message:
/// ```text
/// [Agent A]: Previous response from Agent A...
///
/// [Agent B]: Previous response from Agent B...
///
/// [User]: Current user message
/// ```
pub fn build_message_for_agent(
    target_agent_id: &str,
    user_message: &str,
    sender_name: &str,
    responses: &[AgentResponse],
) -> String {
    // Filter out the target agent's own responses
    let other_responses: Vec<_> = responses
        .iter()
        .filter(|r| r.agent_id != target_agent_id)
        .collect();

    if other_responses.is_empty() {
        // First round or no other agent responses
        user_message.to_string()
    } else {
        // Prepend other agents' responses
        let mut parts = Vec::new();
        for resp in other_responses {
            parts.push(format!("[{}]: {}", resp.agent_name, resp.content));
        }
        parts.push(format!("[{}]: {}", sender_name, user_message));
        parts.join("\n\n")
    }
}

/// Execute a single agent
///
/// This function:
/// 1. Emits AgentThinking event
/// 2. Looks up the agent configuration
/// 3. Creates executor and runs the agent
/// 4. Records messages to rollout file
/// 5. Emits AgentResponse or AgentError event
/// 6. Writes final response to responses.jsonl and messages.ui.jsonl
async fn execute_agent(
    service: GroupChatService,
    event_tx: broadcast::Sender<OrchestratorEvent>,
    workspace_path: PathBuf,
    group_chat_id: &str,
    session_id: &str,
    agent_id: &str,
    agent_name: &str,
    _model: Option<&str>,
    message: &str,
    _timeout_secs: u64,
) {
    tracing::info!(
        target: "viben::group_chat::orchestrator",
        "Starting agent execution: agent={}, message_len={}",
        agent_id, message.len()
    );

    // Emit thinking event
    let _ = event_tx.send(OrchestratorEvent::AgentThinking {
        group_chat_id: group_chat_id.to_string(),
        session_id: session_id.to_string(),
        agent_id: agent_id.to_string(),
        agent_name: agent_name.to_string(),
    });

    // Write agent_thinking message to UI
    let thinking_msg = UIMessage::agent_thinking(
        uuid::Uuid::new_v4().to_string(),
        agent_id,
        agent_name,
    );
    if let Err(e) = service
        .append_ui_message(group_chat_id, session_id, &thinking_msg)
        .await
    {
        tracing::warn!(
            target: "viben::group_chat::orchestrator",
            "Failed to write agent_thinking to UI: {}",
            e
        );
    }

    // Ensure agent directory exists
    if let Err(e) = service
        .ensure_agent_dir(group_chat_id, session_id, agent_id)
        .await
    {
        tracing::error!(
            target: "viben::group_chat::orchestrator",
            "Failed to create agent directory: {}",
            e
        );
        let _ = event_tx.send(OrchestratorEvent::AgentError {
            group_chat_id: group_chat_id.to_string(),
            session_id: session_id.to_string(),
            agent_id: agent_id.to_string(),
            error: format!("Failed to create agent directory: {}", e),
        });
        return;
    }

    // Record user message to agent rollout
    let user_rollout = AgentRolloutMessage::user(message, Some("User".to_string()));
    if let Err(e) = service
        .append_agent_rollout_message(group_chat_id, session_id, agent_id, &user_rollout)
        .await
    {
        tracing::warn!(
            target: "viben::group_chat::orchestrator",
            "Failed to write user message to agent rollout: {}",
            e
        );
    }

    // Try to get the Viben agent configuration
    let agent_config = AgentManager::get_agent(agent_id).await;

    // Execute based on agent type
    let result = match agent_config {
        Ok(Some(agent)) => {
            // Found a configured Viben agent, use its executor
            execute_viben_agent(&agent, &workspace_path, message).await
        }
        Ok(None) => {
            // No configured agent found, use a mock/default response
            tracing::warn!(
                target: "viben::group_chat::orchestrator",
                "Agent {} not found in Viben config, using mock response",
                agent_id
            );
            Ok(format!(
                "I received your message: \"{}\". (Note: Agent {} is not fully configured)",
                truncate_message(message, 100),
                agent_id
            ))
        }
        Err(e) => {
            tracing::error!(
                target: "viben::group_chat::orchestrator",
                "Failed to get agent config: {}",
                e
            );
            Err(format!("Failed to get agent config: {}", e))
        }
    };

    match result {
        Ok(response) => {
            tracing::info!(
                target: "viben::group_chat::orchestrator",
                "Agent {} completed with {} chars response",
                agent_id, response.len()
            );

            // Record assistant response to agent rollout
            let assistant_rollout = AgentRolloutMessage::assistant(&response, None);
            if let Err(e) = service
                .append_agent_rollout_message(group_chat_id, session_id, agent_id, &assistant_rollout)
                .await
            {
                tracing::warn!(
                    target: "viben::group_chat::orchestrator",
                    "Failed to write assistant message to agent rollout: {}",
                    e
                );
            }

            // Write to responses.jsonl for next round context
            let agent_response = AgentResponse::new(agent_id, agent_name, &response);
            if let Err(e) = service
                .append_response(group_chat_id, session_id, &agent_response)
                .await
            {
                tracing::warn!(
                    target: "viben::group_chat::orchestrator",
                    "Failed to write agent response: {}",
                    e
                );
            }

            // Write agent_response to UI messages
            let ui_response = UIMessage::agent_response(
                uuid::Uuid::new_v4().to_string(),
                agent_id,
                agent_name,
                &response,
            );
            if let Err(e) = service
                .append_ui_message(group_chat_id, session_id, &ui_response)
                .await
            {
                tracing::warn!(
                    target: "viben::group_chat::orchestrator",
                    "Failed to write agent response to UI: {}",
                    e
                );
            }

            // Emit response event
            let _ = event_tx.send(OrchestratorEvent::AgentResponse {
                group_chat_id: group_chat_id.to_string(),
                session_id: session_id.to_string(),
                agent_id: agent_id.to_string(),
                agent_name: agent_name.to_string(),
                content: response,
            });
        }
        Err(error) => {
            tracing::error!(
                target: "viben::group_chat::orchestrator",
                "Agent {} failed: {}",
                agent_id, error
            );

            // Emit error event
            let _ = event_tx.send(OrchestratorEvent::AgentError {
                group_chat_id: group_chat_id.to_string(),
                session_id: session_id.to_string(),
                agent_id: agent_id.to_string(),
                error: error.clone(),
            });

            // Write error to UI messages
            let ui_error = UIMessage::system(
                uuid::Uuid::new_v4().to_string(),
                "agent_error",
                Some(serde_json::json!({
                    "agent_id": agent_id,
                    "error": error,
                })),
            );
            if let Err(e) = service
                .append_ui_message(group_chat_id, session_id, &ui_error)
                .await
            {
                tracing::warn!(
                    target: "viben::group_chat::orchestrator",
                    "Failed to write error to UI: {}",
                    e
                );
            }
        }
    }
}

/// Execute a Viben agent using its configured executor
async fn execute_viben_agent(
    agent: &crate::agents::Agent,
    workspace_path: &PathBuf,
    prompt: &str,
) -> Result<String, String> {
    use std::str::FromStr;
    use crate::executors::BaseCodingAgent;

    // Get executor type
    let executor_type = agent
        .executor_type
        .as_deref()
        .unwrap_or("CLAUDE_CODE");

    tracing::debug!(
        target: "viben::group_chat::orchestrator",
        "Using executor type: {} for agent {}",
        executor_type, agent.id
    );

    // Parse executor type
    let base_agent = BaseCodingAgent::from_str(executor_type)
        .map_err(|e| format!("Invalid executor type: {}", e))?;

    // Create the coding agent
    let coding_agent: CodingAgent = match base_agent {
        BaseCodingAgent::ClaudeCode => ClaudeCode::default().into(),
        BaseCodingAgent::Amp => Amp::default().into(),
        BaseCodingAgent::Gemini => Gemini::default().into(),
        BaseCodingAgent::Codex => Codex::default().into(),
        BaseCodingAgent::Opencode => Opencode::default().into(),
        BaseCodingAgent::CursorAgent => CursorAgent::default().into(),
        BaseCodingAgent::QwenCode => QwenCode::default().into(),
        BaseCodingAgent::Copilot => Copilot::default().into(),
        BaseCodingAgent::Droid => Droid::default().into(),
    };

    // Create execution environment with default settings
    // Note: Agent-specific settings like model, temperature etc are typically
    // handled by the agent's config, not the execution env
    let repo_context = RepoContext {
        workspace_root: workspace_path.clone(),
        repo_names: vec![],
    };
    let env = ExecutionEnv::new(repo_context, false, String::new());

    // Spawn the agent process
    let mut child = coding_agent
        .spawn(workspace_path, prompt, &env)
        .await
        .map_err(|e| format!("Failed to spawn agent: {}", e))?;

    // Read stdout to get the response
    let mut response = String::new();
    let inner = child.child.inner();

    if let Some(stdout) = inner.stdout.take() {
        use tokio::io::{AsyncBufReadExt, BufReader};
        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();

        while let Ok(Some(line)) = lines.next_line().await {
            // Parse JSON output from executor
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&line) {
                // Extract text content from various message types
                if let Some(msg_type) = json.get("type").and_then(|v| v.as_str()) {
                    match msg_type {
                        "result" => {
                            if let Some(result) = json.get("result").and_then(|v| v.as_str()) {
                                response = result.to_string();
                            }
                        }
                        "text" => {
                            if let Some(content) = json.get("content").and_then(|v| v.as_str()) {
                                if !content.is_empty() {
                                    response.push_str(content);
                                }
                            }
                        }
                        "assistant" => {
                            if let Some(message) = json.get("message") {
                                if let Some(content) = message.get("content").and_then(|v| v.as_array()) {
                                    for item in content {
                                        if item.get("type").and_then(|v| v.as_str()) == Some("text") {
                                            if let Some(text) = item.get("text").and_then(|v| v.as_str()) {
                                                if !text.is_empty() {
                                                    response.push_str(text);
                                                    response.push('\n');
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        _ => {}
                    }
                }
            }
        }
    }

    // Wait for process to complete
    let _ = child.child.wait().await;

    if response.is_empty() {
        Ok("Agent completed but produced no output.".to_string())
    } else {
        Ok(response.trim().to_string())
    }
}

/// Truncate a message for display
fn truncate_message(msg: &str, max_len: usize) -> String {
    if msg.len() <= max_len {
        msg.to_string()
    } else {
        format!("{}...", &msg[..max_len])
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_message_for_agent_no_responses() {
        let message = build_message_for_agent("claude", "Hello", "User", &[]);
        assert_eq!(message, "Hello");
    }

    #[test]
    fn test_build_message_for_agent_with_responses() {
        let responses = vec![
            AgentResponse::new("cursor", "Cursor AI", "I suggest..."),
            AgentResponse::new("codex", "Codex", "I agree..."),
        ];

        let message = build_message_for_agent("claude", "What do you think?", "User", &responses);

        assert!(message.contains("[Cursor AI]: I suggest..."));
        assert!(message.contains("[Codex]: I agree..."));
        assert!(message.contains("[User]: What do you think?"));
    }

    #[test]
    fn test_build_message_for_agent_excludes_self() {
        let responses = vec![
            AgentResponse::new("claude", "Claude", "My previous response"),
            AgentResponse::new("cursor", "Cursor", "Other response"),
        ];

        let message = build_message_for_agent("claude", "Continue", "User", &responses);

        // Should not include Claude's own response
        assert!(!message.contains("[Claude]: My previous response"));
        // Should include Cursor's response
        assert!(message.contains("[Cursor]: Other response"));
        assert!(message.contains("[User]: Continue"));
    }

    #[test]
    fn test_truncate_message() {
        assert_eq!(truncate_message("short", 10), "short");
        assert_eq!(truncate_message("this is a longer message", 10), "this is a ...");
    }
}
