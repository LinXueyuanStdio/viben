//! File-based Group Chat Module
//!
//! This module provides group chat functionality with file system storage.
//!
//! Directory structure:
//! ```
//! <workspace>/.viben/group-chats/<group-chat-id>/
//! ├── config.yaml              # Group chat configuration + members
//! ├── files/                   # Shared files
//! ├── pictures/                # Shared pictures
//! └── sessions/<session-id>/
//!     ├── config.yaml          # Session configuration
//!     ├── messages.ui.jsonl    # User-facing messages (append-only)
//!     ├── responses.jsonl      # Current round agent responses (cleared each round)
//!     └── agents/<agent-id>/
//!         ├── messages.rollout.jsonl  # Agent messages with tool calls
//!         └── subagents/
//!             └── agent-<subagent-id>.jsonl
//! ```

pub mod config;
pub mod messages;
pub mod service;
pub mod types;

pub use config::{read_config, write_config};
pub use messages::{append_jsonl, read_jsonl, clear_jsonl};
pub use service::GroupChatService;
pub use types::{
    // Group chat types
    GroupChatConfig, GroupChatMember, GroupChatSettings, BroadcastMode,
    // Session types
    SessionConfig, SessionStatus,
    // Message types
    UIMessage, UIMessageType, AgentResponse, AgentRolloutMessage,
    // Member types
    MemberType, MemberRole,
    // Errors
    GroupChatError,
    // Request types
    CreateGroupChatRequest, CreateMemberInput, UpdateGroupChatRequest,
    AddMemberRequest, SendMessageRequest, CreateSessionRequest, ListMessagesQuery,
};
