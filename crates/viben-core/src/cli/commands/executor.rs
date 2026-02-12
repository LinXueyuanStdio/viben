//! viben executor command

use std::io::Read;
use std::path::PathBuf;
use std::process::Stdio;

use clap::{Args, Subcommand};
use serde::Serialize;
use serde_json::json;
use tokio::process::Command;

use crate::cli::{
    CliContext,
    error::{CliError, CliResult},
    output::{print_json, print_simple_table, SuccessResponse},
};
use crate::executors::{
    AvailabilityInfo, CodingAgent, StandardCodingAgentExecutor,
    executors::{
        Amp, ClaudeCode, Codex, Copilot, CursorAgent, Droid, Gemini, Opencode, QwenCode,
    },
};

#[derive(Args)]
pub struct ExecutorCommand {
    #[command(subcommand)]
    pub action: ExecutorAction,
}

#[derive(Subcommand)]
pub enum ExecutorAction {
    /// List available executors
    List,
    /// Show executor details
    Show {
        /// Executor name
        name: String,
    },
    /// List supported executor types
    Types,
    /// Run chat with an executor (non-interactive)
    Chat {
        /// Executor name (e.g., CLAUDE_CODE)
        #[arg(short, long)]
        name: String,

        /// Prompt (reads from stdin if not provided)
        #[arg(short, long)]
        prompt: Option<String>,

        /// Working directory
        #[arg(short = 'C', long)]
        cwd: Option<PathBuf>,

        /// Input format: text (default), stream-json
        #[arg(long, default_value = "text")]
        input_format: String,

        /// Output format: text (default), stream-json
        #[arg(long, default_value = "text")]
        output_format: String,

        /// Verbose output
        #[arg(long)]
        verbose: bool,

        /// Session ID
        #[arg(long)]
        session_id: Option<String>,

        /// Resume existing session
        #[arg(long)]
        resume: Option<String>,

        /// Model to use
        #[arg(long)]
        model: Option<String>,

        /// Skip permission checks
        #[arg(long)]
        dangerously_skip_permissions: bool,
    },
}

#[derive(Serialize)]
struct ExecutorInfo {
    name: String,
    available: bool,
    status: String,
    supports_mcp: bool,
}

impl ExecutorInfo {
    fn from_agent(agent: &CodingAgent) -> Self {
        let availability = agent.get_availability_info();
        let (available, status) = match &availability {
            AvailabilityInfo::LoginDetected { .. } => (true, "logged_in".to_string()),
            AvailabilityInfo::InstallationFound => (true, "installed".to_string()),
            AvailabilityInfo::NotFound => (false, "not_found".to_string()),
        };

        Self {
            name: agent.to_string(),
            available,
            status,
            supports_mcp: agent.supports_mcp(),
        }
    }
}

impl ExecutorCommand {
    pub async fn execute(self, ctx: CliContext) -> CliResult<()> {
        match self.action {
            ExecutorAction::List => {
                let executors = Self::get_all_executors();
                if ctx.json {
                    print_json(&SuccessResponse::new(json!({ "executors": executors })));
                } else {
                    let headers = &["NAME", "AVAILABLE", "STATUS", "MCP"];
                    let rows: Vec<Vec<String>> = executors
                        .iter()
                        .map(|e| {
                            vec![
                                e.name.clone(),
                                if e.available { "yes" } else { "no" }.to_string(),
                                e.status.clone(),
                                if e.supports_mcp { "yes" } else { "no" }.to_string(),
                            ]
                        })
                        .collect();
                    print_simple_table(headers, &rows);
                }
            }
            ExecutorAction::Types => {
                let types = vec![
                    ("CLAUDE_CODE", "Claude Code (Anthropic)"),
                    ("AMP", "Amp"),
                    ("GEMINI", "Gemini CLI (Google)"),
                    ("CODEX", "Codex CLI (OpenAI)"),
                    ("OPENCODE", "Opencode"),
                    ("CURSOR_AGENT", "Cursor Agent"),
                    ("QWEN_CODE", "Qwen Code (Alibaba)"),
                    ("COPILOT", "GitHub Copilot"),
                    ("DROID", "Droid"),
                ];

                if ctx.json {
                    let type_objects: Vec<serde_json::Value> = types
                        .iter()
                        .map(|(id, name)| json!({ "id": id, "name": name }))
                        .collect();
                    print_json(&SuccessResponse::new(json!({ "types": type_objects })));
                } else {
                    let headers = &["TYPE", "DESCRIPTION"];
                    let rows: Vec<Vec<String>> = types
                        .iter()
                        .map(|(id, name)| vec![id.to_string(), name.to_string()])
                        .collect();
                    print_simple_table(headers, &rows);
                }
            }
            ExecutorAction::Show { name } => {
                let executors = Self::get_all_executors();
                // Case-insensitive search
                let executor = executors
                    .iter()
                    .find(|e| e.name.eq_ignore_ascii_case(&name));
                if let Some(e) = executor {
                    if ctx.json {
                        print_json(&SuccessResponse::new(e));
                    } else {
                        println!("Executor: {}", e.name);
                        println!(
                            "  Available: {}",
                            if e.available { "yes" } else { "no" }
                        );
                        println!("  Status: {}", e.status);
                        println!(
                            "  MCP Support: {}",
                            if e.supports_mcp { "yes" } else { "no" }
                        );
                    }
                } else {
                    return Err(CliError::NotFound(format!("Executor not found: {}", name)));
                }
            }
            ExecutorAction::Chat {
                name,
                prompt,
                cwd,
                input_format,
                output_format,
                verbose,
                session_id,
                resume,
                model,
                dangerously_skip_permissions,
            } => {
                Self::execute_chat(
                    name,
                    prompt,
                    cwd,
                    input_format,
                    output_format,
                    verbose,
                    session_id,
                    resume,
                    model,
                    dangerously_skip_permissions,
                )
                .await?;
            }
        }
        Ok(())
    }

    async fn execute_chat(
        name: String,
        prompt: Option<String>,
        cwd: Option<PathBuf>,
        input_format: String,
        output_format: String,
        verbose: bool,
        session_id: Option<String>,
        resume: Option<String>,
        model: Option<String>,
        dangerously_skip_permissions: bool,
    ) -> CliResult<()> {
        // 1. Determine working directory
        let work_dir = cwd.unwrap_or_else(|| std::env::current_dir().unwrap());

        // 2. Read prompt (-p takes priority, otherwise read from stdin)
        let prompt = match prompt {
            Some(p) => p,
            None => {
                let mut buffer = String::new();
                std::io::stdin().read_to_string(&mut buffer)?;
                if buffer.trim().is_empty() {
                    return Err(CliError::NoPromptProvided);
                }
                buffer
            }
        };

        // 3. Create executor based on name (currently only CLAUDE_CODE supported)
        let executor = match name.to_uppercase().as_str() {
            "CLAUDE_CODE" => CodingAgent::ClaudeCode(ClaudeCode::default()),
            _ => {
                return Err(CliError::ChatNotSupported(name));
            }
        };

        // Verify the executor supports chat
        if !executor.supports_chat() {
            return Err(CliError::ChatNotSupported(name));
        }

        // 4. Build chat options
        let opts = ChatOptions {
            prompt,
            input_format,
            output_format,
            verbose,
            session_id,
            resume,
            model,
            dangerously_skip_permissions,
        };

        // 5. Spawn and execute command
        let mut child = spawn_chat_process(&executor, &work_dir, &opts).await?;

        // 6. Wait for exit and return status code
        let status = child.wait().await?;
        std::process::exit(status.code().unwrap_or(1));
    }

    fn get_all_executors() -> Vec<ExecutorInfo> {
        // Create all agent instances
        let agents: Vec<CodingAgent> = vec![
            CodingAgent::ClaudeCode(ClaudeCode::default()),
            CodingAgent::Amp(Amp::default()),
            CodingAgent::Gemini(Gemini::default()),
            CodingAgent::Codex(Codex::default()),
            CodingAgent::Opencode(Opencode::default()),
            CodingAgent::CursorAgent(CursorAgent::default()),
            CodingAgent::QwenCode(QwenCode::default()),
            CodingAgent::Copilot(Copilot::default()),
            CodingAgent::Droid(Droid::default()),
        ];

        agents.iter().map(ExecutorInfo::from_agent).collect()
    }
}

/// Chat command options for building CLI arguments
#[derive(Debug, Clone, Default)]
pub struct ChatOptions {
    pub prompt: String,
    pub input_format: String,
    pub output_format: String,
    pub verbose: bool,
    pub session_id: Option<String>,
    pub resume: Option<String>,
    pub model: Option<String>,
    pub dangerously_skip_permissions: bool,
}

/// Build CLI arguments for chat command
///
/// Returns a vector of arguments to pass to the executor CLI.
/// This function is separated from spawn_chat_process for testability.
fn build_chat_args(opts: &ChatOptions) -> Vec<String> {
    let mut args = Vec::new();

    // Core parameter: -p for non-interactive mode
    args.push("-p".to_string());

    // input-format is text: pass prompt as argument
    // input-format is stream-json: prompt is sent via stdin
    if opts.input_format == "text" {
        args.push(opts.prompt.clone());
    }

    // Format parameters
    if opts.input_format != "text" {
        args.push("--input-format".to_string());
        args.push(opts.input_format.clone());
    }
    if opts.output_format != "text" {
        args.push("--output-format".to_string());
        args.push(opts.output_format.clone());
    }

    // Optional parameters
    if opts.verbose {
        args.push("--verbose".to_string());
    }
    if let Some(id) = &opts.session_id {
        args.push("--session-id".to_string());
        args.push(id.clone());
    }
    if let Some(id) = &opts.resume {
        args.push("--resume".to_string());
        args.push(id.clone());
    }
    if let Some(m) = &opts.model {
        args.push("--model".to_string());
        args.push(m.clone());
    }
    if opts.dangerously_skip_permissions {
        args.push("--dangerously-skip-permissions".to_string());
    }

    args
}

/// Spawn a chat process for the given executor
async fn spawn_chat_process(
    executor: &CodingAgent,
    work_dir: &std::path::Path,
    opts: &ChatOptions,
) -> CliResult<tokio::process::Child> {
    // Get the CLI command for this executor
    let program = executor
        .chat_command()
        .ok_or_else(|| CliError::ChatNotSupported(executor.to_string()))?;

    let args = build_chat_args(opts);

    let mut cmd = Command::new(program);
    cmd.current_dir(work_dir);
    cmd.args(&args);

    // IO setup - inherit from parent process for transparent passthrough
    cmd.stdin(Stdio::inherit());
    cmd.stdout(Stdio::inherit());
    cmd.stderr(Stdio::inherit());

    let child = cmd.spawn()?;
    Ok(child)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn default_ctx() -> CliContext {
        CliContext {
            json: false,
            verbose: false,
            quiet: false,
            global: false,
            workspace: false,
            name: None,
        }
    }

    // ==================== Existing executor tests ====================

    #[tokio::test]
    async fn test_executor_types_command() {
        let cmd = ExecutorCommand {
            action: ExecutorAction::Types,
        };
        let result = cmd.execute(default_ctx()).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_executor_types_command_json() {
        let cmd = ExecutorCommand {
            action: ExecutorAction::Types,
        };
        let mut ctx = default_ctx();
        ctx.json = true;
        let result = cmd.execute(ctx).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_executor_list_command() {
        let cmd = ExecutorCommand {
            action: ExecutorAction::List,
        };
        let result = cmd.execute(default_ctx()).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_executor_show_command() {
        let cmd = ExecutorCommand {
            action: ExecutorAction::Show {
                name: "CLAUDE_CODE".to_string(),
            },
        };
        let result = cmd.execute(default_ctx()).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_executor_show_not_found() {
        let cmd = ExecutorCommand {
            action: ExecutorAction::Show {
                name: "INVALID_EXECUTOR".to_string(),
            },
        };
        let result = cmd.execute(default_ctx()).await;
        assert!(result.is_err());
    }

    // ==================== CodingAgent chat support tests ====================

    #[test]
    fn test_coding_agent_supports_chat_all_agents() {
        // CLAUDE_CODE should support chat
        let claude = CodingAgent::ClaudeCode(ClaudeCode::default());
        assert!(claude.supports_chat());

        // All other agents should NOT support chat currently
        let gemini = CodingAgent::Gemini(Gemini::default());
        assert!(!gemini.supports_chat());

        let codex = CodingAgent::Codex(Codex::default());
        assert!(!codex.supports_chat());

        let amp = CodingAgent::Amp(Amp::default());
        assert!(!amp.supports_chat());

        let opencode = CodingAgent::Opencode(Opencode::default());
        assert!(!opencode.supports_chat());

        let cursor = CodingAgent::CursorAgent(CursorAgent::default());
        assert!(!cursor.supports_chat());

        let qwen = CodingAgent::QwenCode(QwenCode::default());
        assert!(!qwen.supports_chat());

        let copilot = CodingAgent::Copilot(Copilot::default());
        assert!(!copilot.supports_chat());

        let droid = CodingAgent::Droid(Droid::default());
        assert!(!droid.supports_chat());
    }

    #[test]
    fn test_coding_agent_chat_command_all_agents() {
        // CLAUDE_CODE returns "claude"
        let claude = CodingAgent::ClaudeCode(ClaudeCode::default());
        assert_eq!(claude.chat_command(), Some("claude"));

        // All other agents return None
        let gemini = CodingAgent::Gemini(Gemini::default());
        assert_eq!(gemini.chat_command(), None);

        let amp = CodingAgent::Amp(Amp::default());
        assert_eq!(amp.chat_command(), None);

        let codex = CodingAgent::Codex(Codex::default());
        assert_eq!(codex.chat_command(), None);

        let opencode = CodingAgent::Opencode(Opencode::default());
        assert_eq!(opencode.chat_command(), None);

        let cursor = CodingAgent::CursorAgent(CursorAgent::default());
        assert_eq!(cursor.chat_command(), None);

        let qwen = CodingAgent::QwenCode(QwenCode::default());
        assert_eq!(qwen.chat_command(), None);

        let copilot = CodingAgent::Copilot(Copilot::default());
        assert_eq!(copilot.chat_command(), None);

        let droid = CodingAgent::Droid(Droid::default());
        assert_eq!(droid.chat_command(), None);
    }

    // ==================== Error type tests ====================

    #[test]
    fn test_chat_not_supported_error() {
        let err = CliError::ChatNotSupported("GEMINI".to_string());
        assert_eq!(err.to_string(), "Chat not supported for executor: GEMINI");
    }

    #[test]
    fn test_no_prompt_provided_error() {
        let err = CliError::NoPromptProvided;
        assert_eq!(err.to_string(), "No prompt provided and stdin is empty");
    }

    // ==================== ChatOptions tests ====================

    #[test]
    fn test_chat_options_default() {
        let opts = ChatOptions::default();
        assert_eq!(opts.prompt, "");
        assert_eq!(opts.input_format, "");
        assert_eq!(opts.output_format, "");
        assert!(!opts.verbose);
        assert!(opts.session_id.is_none());
        assert!(opts.resume.is_none());
        assert!(opts.model.is_none());
        assert!(!opts.dangerously_skip_permissions);
    }

    // ==================== build_chat_args tests ====================

    #[test]
    fn test_build_chat_args_basic_text_format() {
        let opts = ChatOptions {
            prompt: "hello world".to_string(),
            input_format: "text".to_string(),
            output_format: "text".to_string(),
            ..Default::default()
        };

        let args = build_chat_args(&opts);

        // Should only have -p and the prompt
        assert_eq!(args, vec!["-p", "hello world"]);
    }

    #[test]
    fn test_build_chat_args_stream_json_input() {
        let opts = ChatOptions {
            prompt: "hello".to_string(),
            input_format: "stream-json".to_string(),
            output_format: "text".to_string(),
            ..Default::default()
        };

        let args = build_chat_args(&opts);

        // Prompt should NOT be included when input_format is stream-json
        // (prompt is sent via stdin)
        assert_eq!(args, vec!["-p", "--input-format", "stream-json"]);
    }

    #[test]
    fn test_build_chat_args_stream_json_output() {
        let opts = ChatOptions {
            prompt: "hello".to_string(),
            input_format: "text".to_string(),
            output_format: "stream-json".to_string(),
            ..Default::default()
        };

        let args = build_chat_args(&opts);

        assert_eq!(args, vec!["-p", "hello", "--output-format", "stream-json"]);
    }

    #[test]
    fn test_build_chat_args_both_stream_json() {
        let opts = ChatOptions {
            prompt: "hello".to_string(),
            input_format: "stream-json".to_string(),
            output_format: "stream-json".to_string(),
            ..Default::default()
        };

        let args = build_chat_args(&opts);

        assert_eq!(
            args,
            vec![
                "-p",
                "--input-format",
                "stream-json",
                "--output-format",
                "stream-json"
            ]
        );
    }

    #[test]
    fn test_build_chat_args_with_verbose() {
        let opts = ChatOptions {
            prompt: "hello".to_string(),
            input_format: "text".to_string(),
            output_format: "text".to_string(),
            verbose: true,
            ..Default::default()
        };

        let args = build_chat_args(&opts);

        assert_eq!(args, vec!["-p", "hello", "--verbose"]);
    }

    #[test]
    fn test_build_chat_args_with_session_id() {
        let opts = ChatOptions {
            prompt: "hello".to_string(),
            input_format: "text".to_string(),
            output_format: "text".to_string(),
            session_id: Some("sess-123".to_string()),
            ..Default::default()
        };

        let args = build_chat_args(&opts);

        assert_eq!(args, vec!["-p", "hello", "--session-id", "sess-123"]);
    }

    #[test]
    fn test_build_chat_args_with_resume() {
        let opts = ChatOptions {
            prompt: "continue".to_string(),
            input_format: "text".to_string(),
            output_format: "text".to_string(),
            resume: Some("abc-456".to_string()),
            ..Default::default()
        };

        let args = build_chat_args(&opts);

        assert_eq!(args, vec!["-p", "continue", "--resume", "abc-456"]);
    }

    #[test]
    fn test_build_chat_args_with_model() {
        let opts = ChatOptions {
            prompt: "hello".to_string(),
            input_format: "text".to_string(),
            output_format: "text".to_string(),
            model: Some("claude-3-opus".to_string()),
            ..Default::default()
        };

        let args = build_chat_args(&opts);

        assert_eq!(args, vec!["-p", "hello", "--model", "claude-3-opus"]);
    }

    #[test]
    fn test_build_chat_args_with_dangerously_skip_permissions() {
        let opts = ChatOptions {
            prompt: "hello".to_string(),
            input_format: "text".to_string(),
            output_format: "text".to_string(),
            dangerously_skip_permissions: true,
            ..Default::default()
        };

        let args = build_chat_args(&opts);

        assert_eq!(args, vec!["-p", "hello", "--dangerously-skip-permissions"]);
    }

    #[test]
    fn test_build_chat_args_with_all_options() {
        let opts = ChatOptions {
            prompt: "analyze this".to_string(),
            input_format: "stream-json".to_string(),
            output_format: "stream-json".to_string(),
            verbose: true,
            session_id: Some("sess-999".to_string()),
            resume: Some("prev-session".to_string()),
            model: Some("claude-3-sonnet".to_string()),
            dangerously_skip_permissions: true,
        };

        let args = build_chat_args(&opts);

        // Note: prompt is NOT included because input_format is stream-json
        assert_eq!(
            args,
            vec![
                "-p",
                "--input-format",
                "stream-json",
                "--output-format",
                "stream-json",
                "--verbose",
                "--session-id",
                "sess-999",
                "--resume",
                "prev-session",
                "--model",
                "claude-3-sonnet",
                "--dangerously-skip-permissions",
            ]
        );
    }

    #[test]
    fn test_build_chat_args_empty_prompt_text_format() {
        let opts = ChatOptions {
            prompt: "".to_string(),
            input_format: "text".to_string(),
            output_format: "text".to_string(),
            ..Default::default()
        };

        let args = build_chat_args(&opts);

        // Empty prompt is still passed as argument
        assert_eq!(args, vec!["-p", ""]);
    }

    #[test]
    fn test_build_chat_args_prompt_with_special_characters() {
        let opts = ChatOptions {
            prompt: "echo \"hello world\" && ls -la".to_string(),
            input_format: "text".to_string(),
            output_format: "text".to_string(),
            ..Default::default()
        };

        let args = build_chat_args(&opts);

        // Special characters should be preserved
        assert_eq!(args, vec!["-p", "echo \"hello world\" && ls -la"]);
    }

    #[test]
    fn test_build_chat_args_prompt_with_newlines() {
        let opts = ChatOptions {
            prompt: "line1\nline2\nline3".to_string(),
            input_format: "text".to_string(),
            output_format: "text".to_string(),
            ..Default::default()
        };

        let args = build_chat_args(&opts);

        // Newlines should be preserved
        assert_eq!(args, vec!["-p", "line1\nline2\nline3"]);
    }

    #[test]
    fn test_build_chat_args_order_consistency() {
        // Test that arguments are always in the same order
        let opts = ChatOptions {
            prompt: "test".to_string(),
            input_format: "stream-json".to_string(),
            output_format: "stream-json".to_string(),
            verbose: true,
            session_id: Some("sid".to_string()),
            resume: Some("rid".to_string()),
            model: Some("model".to_string()),
            dangerously_skip_permissions: true,
        };

        // Run multiple times to ensure consistent ordering
        for _ in 0..10 {
            let args = build_chat_args(&opts);
            assert_eq!(args[0], "-p");
            assert_eq!(args[1], "--input-format");
            assert_eq!(args[2], "stream-json");
            assert_eq!(args[3], "--output-format");
            assert_eq!(args[4], "stream-json");
            assert_eq!(args[5], "--verbose");
            assert_eq!(args[6], "--session-id");
            assert_eq!(args[7], "sid");
            assert_eq!(args[8], "--resume");
            assert_eq!(args[9], "rid");
            assert_eq!(args[10], "--model");
            assert_eq!(args[11], "model");
            assert_eq!(args[12], "--dangerously-skip-permissions");
        }
    }

    // ==================== CLI argument parsing tests ====================

    #[test]
    fn test_executor_action_chat_parsing_basic() {
        use clap::Parser;

        #[derive(Parser)]
        struct TestCli {
            #[command(subcommand)]
            action: ExecutorAction,
        }

        let args = TestCli::parse_from(["test", "chat", "-n", "CLAUDE_CODE", "-p", "hello"]);
        match args.action {
            ExecutorAction::Chat {
                name,
                prompt,
                cwd,
                input_format,
                output_format,
                verbose,
                session_id,
                resume,
                model,
                dangerously_skip_permissions,
            } => {
                assert_eq!(name, "CLAUDE_CODE");
                assert_eq!(prompt, Some("hello".to_string()));
                assert!(cwd.is_none());
                assert_eq!(input_format, "text");
                assert_eq!(output_format, "text");
                assert!(!verbose);
                assert!(session_id.is_none());
                assert!(resume.is_none());
                assert!(model.is_none());
                assert!(!dangerously_skip_permissions);
            }
            _ => panic!("Expected Chat action"),
        }
    }

    #[test]
    fn test_executor_action_chat_parsing_all_options() {
        use clap::Parser;

        #[derive(Parser)]
        struct TestCli {
            #[command(subcommand)]
            action: ExecutorAction,
        }

        let args = TestCli::parse_from([
            "test",
            "chat",
            "-n",
            "CLAUDE_CODE",
            "-p",
            "analyze code",
            "-C",
            "/tmp/work",
            "--input-format",
            "stream-json",
            "--output-format",
            "stream-json",
            "--verbose",
            "--session-id",
            "sess123",
            "--resume",
            "abc456",
            "--model",
            "claude-3-opus",
            "--dangerously-skip-permissions",
        ]);
        match args.action {
            ExecutorAction::Chat {
                name,
                prompt,
                cwd,
                input_format,
                output_format,
                verbose,
                session_id,
                resume,
                model,
                dangerously_skip_permissions,
            } => {
                assert_eq!(name, "CLAUDE_CODE");
                assert_eq!(prompt, Some("analyze code".to_string()));
                assert_eq!(cwd, Some(PathBuf::from("/tmp/work")));
                assert_eq!(input_format, "stream-json");
                assert_eq!(output_format, "stream-json");
                assert!(verbose);
                assert_eq!(session_id, Some("sess123".to_string()));
                assert_eq!(resume, Some("abc456".to_string()));
                assert_eq!(model, Some("claude-3-opus".to_string()));
                assert!(dangerously_skip_permissions);
            }
            _ => panic!("Expected Chat action"),
        }
    }

    #[test]
    fn test_executor_action_chat_parsing_long_options() {
        use clap::Parser;

        #[derive(Parser)]
        struct TestCli {
            #[command(subcommand)]
            action: ExecutorAction,
        }

        // Test using long option names
        let args = TestCli::parse_from([
            "test",
            "chat",
            "--name",
            "CLAUDE_CODE",
            "--prompt",
            "test prompt",
            "--cwd",
            "/home/user",
        ]);
        match args.action {
            ExecutorAction::Chat { name, prompt, cwd, .. } => {
                assert_eq!(name, "CLAUDE_CODE");
                assert_eq!(prompt, Some("test prompt".to_string()));
                assert_eq!(cwd, Some(PathBuf::from("/home/user")));
            }
            _ => panic!("Expected Chat action"),
        }
    }

    #[test]
    fn test_executor_action_chat_parsing_without_prompt() {
        use clap::Parser;

        #[derive(Parser)]
        struct TestCli {
            #[command(subcommand)]
            action: ExecutorAction,
        }

        // -p is optional, should default to None
        let args = TestCli::parse_from(["test", "chat", "-n", "CLAUDE_CODE"]);
        match args.action {
            ExecutorAction::Chat { name, prompt, .. } => {
                assert_eq!(name, "CLAUDE_CODE");
                assert!(prompt.is_none());
            }
            _ => panic!("Expected Chat action"),
        }
    }

    #[test]
    fn test_executor_action_chat_parsing_case_sensitivity() {
        use clap::Parser;

        #[derive(Parser)]
        struct TestCli {
            #[command(subcommand)]
            action: ExecutorAction,
        }

        // Executor name is case-sensitive at parse time
        // (case conversion happens in execute_chat)
        let args = TestCli::parse_from(["test", "chat", "-n", "claude_code", "-p", "test"]);
        match args.action {
            ExecutorAction::Chat { name, .. } => {
                assert_eq!(name, "claude_code"); // lowercase preserved
            }
            _ => panic!("Expected Chat action"),
        }
    }

    // ==================== Integration-like tests ====================

    #[test]
    fn test_chat_args_match_claude_cli_interface() {
        // Verify that our args match what claude CLI expects
        let opts = ChatOptions {
            prompt: "hello".to_string(),
            input_format: "text".to_string(),
            output_format: "text".to_string(),
            verbose: true,
            model: Some("opus".to_string()),
            dangerously_skip_permissions: true,
            ..Default::default()
        };

        let args = build_chat_args(&opts);

        // claude -p "hello" --verbose --model opus --dangerously-skip-permissions
        assert!(args.contains(&"-p".to_string()));
        assert!(args.contains(&"hello".to_string()));
        assert!(args.contains(&"--verbose".to_string()));
        assert!(args.contains(&"--model".to_string()));
        assert!(args.contains(&"opus".to_string()));
        assert!(args.contains(&"--dangerously-skip-permissions".to_string()));
    }

    #[test]
    fn test_stream_json_format_for_programmatic_use() {
        // For programmatic use, both input and output should be stream-json
        let opts = ChatOptions {
            prompt: r#"{"type":"user","message":{"role":"user","content":"test"}}"#.to_string(),
            input_format: "stream-json".to_string(),
            output_format: "stream-json".to_string(),
            ..Default::default()
        };

        let args = build_chat_args(&opts);

        // Prompt should NOT be in args (sent via stdin for stream-json)
        assert!(!args.contains(&opts.prompt));
        assert!(args.contains(&"--input-format".to_string()));
        assert!(args.contains(&"--output-format".to_string()));
    }

    #[tokio::test]
    async fn test_spawn_chat_process_unsupported_executor() {
        let executor = CodingAgent::Gemini(Gemini::default());
        let opts = ChatOptions {
            prompt: "test".to_string(),
            input_format: "text".to_string(),
            output_format: "text".to_string(),
            ..Default::default()
        };

        let result = spawn_chat_process(&executor, std::path::Path::new("/tmp"), &opts).await;

        assert!(result.is_err());
        match result {
            Err(CliError::ChatNotSupported(name)) => {
                assert_eq!(name, "GEMINI");
            }
            _ => panic!("Expected ChatNotSupported error"),
        }
    }

    // ==================== Additional spawn_chat_process tests ====================

    #[tokio::test]
    async fn test_spawn_chat_process_unsupported_all_non_claude_agents() {
        let unsupported_agents: Vec<CodingAgent> = vec![
            CodingAgent::Amp(Amp::default()),
            CodingAgent::Gemini(Gemini::default()),
            CodingAgent::Codex(Codex::default()),
            CodingAgent::Opencode(Opencode::default()),
            CodingAgent::CursorAgent(CursorAgent::default()),
            CodingAgent::QwenCode(QwenCode::default()),
            CodingAgent::Copilot(Copilot::default()),
            CodingAgent::Droid(Droid::default()),
        ];

        let opts = ChatOptions {
            prompt: "test".to_string(),
            input_format: "text".to_string(),
            output_format: "text".to_string(),
            ..Default::default()
        };

        for executor in unsupported_agents {
            let result =
                spawn_chat_process(&executor, std::path::Path::new("/tmp"), &opts).await;
            assert!(
                result.is_err(),
                "Expected error for executor {}",
                executor
            );
            assert!(
                matches!(result, Err(CliError::ChatNotSupported(_))),
                "Expected ChatNotSupported error for executor {}",
                executor
            );
        }
    }

    // ==================== build_chat_args edge case tests ====================

    #[test]
    fn test_build_chat_args_unicode_prompt() {
        let opts = ChatOptions {
            prompt: "你好世界 🌍 مرحبا".to_string(),
            input_format: "text".to_string(),
            output_format: "text".to_string(),
            ..Default::default()
        };

        let args = build_chat_args(&opts);
        assert_eq!(args, vec!["-p", "你好世界 🌍 مرحبا"]);
    }

    #[test]
    fn test_build_chat_args_very_long_prompt() {
        let long_prompt = "a".repeat(10000);
        let opts = ChatOptions {
            prompt: long_prompt.clone(),
            input_format: "text".to_string(),
            output_format: "text".to_string(),
            ..Default::default()
        };

        let args = build_chat_args(&opts);
        assert_eq!(args.len(), 2);
        assert_eq!(args[0], "-p");
        assert_eq!(args[1].len(), 10000);
    }

    #[test]
    fn test_build_chat_args_prompt_with_quotes() {
        let opts = ChatOptions {
            prompt: r#"say "hello" and 'world'"#.to_string(),
            input_format: "text".to_string(),
            output_format: "text".to_string(),
            ..Default::default()
        };

        let args = build_chat_args(&opts);
        assert_eq!(args, vec!["-p", r#"say "hello" and 'world'"#]);
    }

    #[test]
    fn test_build_chat_args_prompt_with_backslashes() {
        let opts = ChatOptions {
            prompt: r"path\to\file".to_string(),
            input_format: "text".to_string(),
            output_format: "text".to_string(),
            ..Default::default()
        };

        let args = build_chat_args(&opts);
        assert_eq!(args, vec!["-p", r"path\to\file"]);
    }

    #[test]
    fn test_build_chat_args_prompt_with_tabs() {
        let opts = ChatOptions {
            prompt: "col1\tcol2\tcol3".to_string(),
            input_format: "text".to_string(),
            output_format: "text".to_string(),
            ..Default::default()
        };

        let args = build_chat_args(&opts);
        assert_eq!(args, vec!["-p", "col1\tcol2\tcol3"]);
    }

    #[test]
    fn test_build_chat_args_model_names() {
        let model_names = vec![
            "claude-3-opus",
            "claude-3-sonnet",
            "claude-3-haiku",
            "claude-3.5-sonnet",
            "claude-4-opus",
            "gpt-4",
            "custom-model-v1.2.3",
        ];

        for model_name in model_names {
            let opts = ChatOptions {
                prompt: "test".to_string(),
                input_format: "text".to_string(),
                output_format: "text".to_string(),
                model: Some(model_name.to_string()),
                ..Default::default()
            };

            let args = build_chat_args(&opts);
            assert!(args.contains(&"--model".to_string()));
            assert!(args.contains(&model_name.to_string()));
        }
    }

    #[test]
    fn test_build_chat_args_session_id_formats() {
        let session_ids = vec![
            "abc123",
            "550e8400-e29b-41d4-a716-446655440000", // UUID format
            "session_2024-01-01_12:00:00",
            "user@host:session",
        ];

        for session_id in session_ids {
            let opts = ChatOptions {
                prompt: "test".to_string(),
                input_format: "text".to_string(),
                output_format: "text".to_string(),
                session_id: Some(session_id.to_string()),
                ..Default::default()
            };

            let args = build_chat_args(&opts);
            assert!(args.contains(&"--session-id".to_string()));
            assert!(args.contains(&session_id.to_string()));
        }
    }

    #[test]
    fn test_build_chat_args_only_verbose_no_other_options() {
        let opts = ChatOptions {
            prompt: "hello".to_string(),
            input_format: "text".to_string(),
            output_format: "text".to_string(),
            verbose: true,
            session_id: None,
            resume: None,
            model: None,
            dangerously_skip_permissions: false,
        };

        let args = build_chat_args(&opts);
        assert_eq!(args, vec!["-p", "hello", "--verbose"]);
    }

    #[test]
    fn test_build_chat_args_session_id_and_resume_together() {
        // Both can be specified together (edge case)
        let opts = ChatOptions {
            prompt: "test".to_string(),
            input_format: "text".to_string(),
            output_format: "text".to_string(),
            session_id: Some("new-session".to_string()),
            resume: Some("old-session".to_string()),
            ..Default::default()
        };

        let args = build_chat_args(&opts);
        assert!(args.contains(&"--session-id".to_string()));
        assert!(args.contains(&"new-session".to_string()));
        assert!(args.contains(&"--resume".to_string()));
        assert!(args.contains(&"old-session".to_string()));
    }

    // ==================== ChatOptions Clone and Debug tests ====================

    #[test]
    fn test_chat_options_clone() {
        let opts = ChatOptions {
            prompt: "hello".to_string(),
            input_format: "text".to_string(),
            output_format: "stream-json".to_string(),
            verbose: true,
            session_id: Some("sess".to_string()),
            resume: Some("resume".to_string()),
            model: Some("opus".to_string()),
            dangerously_skip_permissions: true,
        };

        let cloned = opts.clone();
        assert_eq!(opts.prompt, cloned.prompt);
        assert_eq!(opts.input_format, cloned.input_format);
        assert_eq!(opts.output_format, cloned.output_format);
        assert_eq!(opts.verbose, cloned.verbose);
        assert_eq!(opts.session_id, cloned.session_id);
        assert_eq!(opts.resume, cloned.resume);
        assert_eq!(opts.model, cloned.model);
        assert_eq!(opts.dangerously_skip_permissions, cloned.dangerously_skip_permissions);
    }

    #[test]
    fn test_chat_options_debug() {
        let opts = ChatOptions {
            prompt: "test".to_string(),
            input_format: "text".to_string(),
            output_format: "text".to_string(),
            verbose: true,
            ..Default::default()
        };

        let debug_str = format!("{:?}", opts);
        assert!(debug_str.contains("ChatOptions"));
        assert!(debug_str.contains("prompt"));
        assert!(debug_str.contains("verbose"));
    }

    // ==================== CLI parsing edge cases ====================

    #[test]
    fn test_executor_action_chat_parsing_prompt_with_spaces() {
        use clap::Parser;

        #[derive(Parser)]
        struct TestCli {
            #[command(subcommand)]
            action: ExecutorAction,
        }

        let args = TestCli::parse_from([
            "test",
            "chat",
            "-n",
            "CLAUDE_CODE",
            "-p",
            "hello world with spaces",
        ]);
        match args.action {
            ExecutorAction::Chat { prompt, .. } => {
                assert_eq!(prompt, Some("hello world with spaces".to_string()));
            }
            _ => panic!("Expected Chat action"),
        }
    }

    #[test]
    fn test_executor_action_chat_parsing_cwd_relative_path() {
        use clap::Parser;

        #[derive(Parser)]
        struct TestCli {
            #[command(subcommand)]
            action: ExecutorAction,
        }

        let args = TestCli::parse_from([
            "test",
            "chat",
            "-n",
            "CLAUDE_CODE",
            "-C",
            "./relative/path",
            "-p",
            "test",
        ]);
        match args.action {
            ExecutorAction::Chat { cwd, .. } => {
                assert_eq!(cwd, Some(PathBuf::from("./relative/path")));
            }
            _ => panic!("Expected Chat action"),
        }
    }

    #[test]
    fn test_executor_action_chat_parsing_empty_string_args() {
        use clap::Parser;

        #[derive(Parser)]
        struct TestCli {
            #[command(subcommand)]
            action: ExecutorAction,
        }

        // Empty prompt string is valid
        let args = TestCli::parse_from(["test", "chat", "-n", "CLAUDE_CODE", "-p", ""]);
        match args.action {
            ExecutorAction::Chat { prompt, .. } => {
                assert_eq!(prompt, Some("".to_string()));
            }
            _ => panic!("Expected Chat action"),
        }
    }

    #[test]
    fn test_executor_action_chat_parsing_mixed_case_executor() {
        use clap::Parser;

        #[derive(Parser)]
        struct TestCli {
            #[command(subcommand)]
            action: ExecutorAction,
        }

        // Test various case combinations
        let cases = vec!["CLAUDE_CODE", "claude_code", "Claude_Code", "ClAuDe_CoDe"];

        for case in cases {
            let args = TestCli::parse_from(["test", "chat", "-n", case, "-p", "test"]);
            match args.action {
                ExecutorAction::Chat { name, .. } => {
                    assert_eq!(name, case);
                }
                _ => panic!("Expected Chat action"),
            }
        }
    }

    // ==================== ExecutorInfo tests ====================

    #[test]
    fn test_executor_info_from_agent_claude() {
        let agent = CodingAgent::ClaudeCode(ClaudeCode::default());
        let info = ExecutorInfo::from_agent(&agent);

        assert_eq!(info.name, "CLAUDE_CODE");
        assert!(info.supports_mcp);
    }

    #[test]
    fn test_executor_info_serialization() {
        let info = ExecutorInfo {
            name: "TEST".to_string(),
            available: true,
            status: "installed".to_string(),
            supports_mcp: true,
        };

        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("\"name\":\"TEST\""));
        assert!(json.contains("\"available\":true"));
        assert!(json.contains("\"status\":\"installed\""));
        assert!(json.contains("\"supports_mcp\":true"));
    }

    // ==================== get_all_executors tests ====================

    #[test]
    fn test_get_all_executors_returns_all_agents() {
        let executors = ExecutorCommand::get_all_executors();

        // Should return all 9 agent types
        assert_eq!(executors.len(), 9);

        let names: Vec<&str> = executors.iter().map(|e| e.name.as_str()).collect();
        assert!(names.contains(&"CLAUDE_CODE"));
        assert!(names.contains(&"AMP"));
        assert!(names.contains(&"GEMINI"));
        assert!(names.contains(&"CODEX"));
        assert!(names.contains(&"OPENCODE"));
        assert!(names.contains(&"CURSOR_AGENT"));
        assert!(names.contains(&"QWEN_CODE"));
        assert!(names.contains(&"COPILOT"));
        assert!(names.contains(&"DROID"));
    }

    #[test]
    fn test_get_all_executors_no_duplicates() {
        let executors = ExecutorCommand::get_all_executors();
        let names: Vec<&str> = executors.iter().map(|e| e.name.as_str()).collect();

        let mut unique_names = names.clone();
        unique_names.sort();
        unique_names.dedup();

        assert_eq!(names.len(), unique_names.len(), "Duplicate executor names found");
    }

    // ==================== Executor show case insensitive tests ====================

    #[tokio::test]
    async fn test_executor_show_case_insensitive() {
        let cases = vec!["claude_code", "CLAUDE_CODE", "Claude_Code"];

        for name in cases {
            let cmd = ExecutorCommand {
                action: ExecutorAction::Show {
                    name: name.to_string(),
                },
            };
            let result = cmd.execute(default_ctx()).await;
            assert!(result.is_ok(), "Show should work for name: {}", name);
        }
    }

    #[tokio::test]
    async fn test_executor_show_json_output() {
        let cmd = ExecutorCommand {
            action: ExecutorAction::Show {
                name: "CLAUDE_CODE".to_string(),
            },
        };
        let mut ctx = default_ctx();
        ctx.json = true;
        let result = cmd.execute(ctx).await;
        assert!(result.is_ok());
    }

    // ==================== Executor list JSON tests ====================

    #[tokio::test]
    async fn test_executor_list_json_output() {
        let cmd = ExecutorCommand {
            action: ExecutorAction::List,
        };
        let mut ctx = default_ctx();
        ctx.json = true;
        let result = cmd.execute(ctx).await;
        assert!(result.is_ok());
    }
}
