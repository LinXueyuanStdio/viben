//! NAPI bindings for Node.js
//!
//! This module provides N-API bindings to expose viben-core functionality
//! to Node.js/TypeScript applications via the `@viben/core` npm package.
//!
//! # Feature Flag
//!
//! This module is only compiled when the `napi` feature is enabled:
//!
//! ```toml
//! [dependencies]
//! viben-core = { version = "0.1", features = ["napi"] }
//! ```
//!
//! # Usage from Node.js
//!
//! ```typescript
//! import { Provider, Model, Agent, Config } from '@viben/core';
//!
//! // Provider management
//! const providers = await Provider.list();
//! await Provider.create({ type: 'openai', name: 'My OpenAI', apiKey: 'sk-...' });
//!
//! // Model management
//! const models = await Model.list();
//! await Model.setDefault('gpt-4');
//!
//! // Agent management
//! const agents = await Agent.list();
//! await Agent.create({ name: 'coder', template: 'default' });
//!
//! // Configuration
//! const config = await Config.get('theme');
//! await Config.set('theme', 'dark');
//! ```

mod provider;
mod model;
mod agent;
mod config;
mod init;

pub use provider::*;
pub use model::*;
pub use agent::*;
pub use config::*;
pub use init::*;
