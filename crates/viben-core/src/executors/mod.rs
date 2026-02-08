//! Viben AI Agent Executors
//!
//! This crate provides executors for various AI coding agents:
//! - ClaudeCode (Anthropic)
//! - Gemini (Google)
//! - Codex (OpenAI)
//! - Cursor
//! - Amp
//! - Opencode
//! - QwenCode (Alibaba)
//! - Copilot (GitHub)
//! - Droid
//!
//! The core trait `StandardCodingAgentExecutor` defines the interface for all executors,
//! and `CodingAgent` enum uses enum_dispatch for efficient trait method dispatch.

pub mod command;
pub mod env;
pub mod executors;

pub use command::{CommandBuilder, CommandParts};
pub use env::{ExecutionEnv, RepoContext};
pub use executors::{
    AvailabilityInfo, BaseCodingAgent, CodingAgent, ExecutorError, SpawnedChild,
    StandardCodingAgentExecutor,
};
