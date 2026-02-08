//! viben model command

use clap::{Args, Subcommand};
use serde_json::json;

use crate::cli::{
    CliContext,
    error::{CliError, CliResult},
    output::{print_json, print_simple_table, print_success, SuccessResponse},
};
use crate::{ModelManager, ProviderType};

#[derive(Args)]
pub struct ModelCommand {
    #[command(subcommand)]
    pub action: ModelAction,
}

#[derive(Subcommand)]
pub enum ModelAction {
    /// List all models
    List {
        /// Filter by provider type (openai, anthropic, azure, ollama, openrouter, google, custom)
        #[arg(short, long)]
        provider: Option<String>,
    },
    /// Show model details
    Show {
        /// Model ID
        id: String,
    },
    /// Set default model
    SetDefault {
        /// Model ID
        id: String,
    },
    /// Enable a model
    Enable {
        /// Model ID
        id: String,
    },
    /// Disable a model
    Disable {
        /// Model ID
        id: String,
    },
    /// Discover models from a provider
    Discover {
        /// Provider ID
        provider_id: String,
    },
}

impl ModelCommand {
    pub async fn execute(self, ctx: CliContext) -> CliResult<()> {
        match self.action {
            ModelAction::List { provider } => {
                let models = if let Some(provider_str) = provider {
                    let provider_type: ProviderType = provider_str
                        .parse()
                        .map_err(|e: String| CliError::InvalidArgument(e))?;
                    ModelManager::list_models_for_provider(provider_type).await?
                } else {
                    ModelManager::list_models().await?
                };
                if ctx.json {
                    print_json(&SuccessResponse::new(json!({ "models": models })));
                } else if models.is_empty() {
                    println!("No models available");
                } else {
                    let headers = &["ID", "NAME", "PROVIDER", "DEFAULT", "ENABLED"];
                    let rows: Vec<Vec<String>> = models
                        .iter()
                        .map(|m| {
                            vec![
                                m.id.clone(),
                                m.name.clone(),
                                m.provider.to_string(),
                                if m.is_default { "*" } else { "" }.to_string(),
                                if m.enabled { "yes" } else { "no" }.to_string(),
                            ]
                        })
                        .collect();
                    print_simple_table(headers, &rows);
                }
            }
            ModelAction::Show { id } => {
                let model = ModelManager::get_model(&id)
                    .await?
                    .ok_or_else(|| CliError::NotFound(format!("Model not found: {}", id)))?;
                if ctx.json {
                    print_json(&SuccessResponse::new(&model));
                } else {
                    println!("Model: {}", model.id);
                    println!("  Name: {}", model.name);
                    println!("  Provider: {}", model.provider);
                    println!(
                        "  Default: {}",
                        if model.is_default { "yes" } else { "no" }
                    );
                    println!(
                        "  Enabled: {}",
                        if model.enabled { "yes" } else { "no" }
                    );
                    if let Some(ctx_len) = model.context_window {
                        println!("  Context window: {}", ctx_len);
                    }
                    if let Some(max_out) = model.max_output_tokens {
                        println!("  Max output tokens: {}", max_out);
                    }
                    if let Some(desc) = &model.description {
                        println!("  Description: {}", desc);
                    }
                }
            }
            ModelAction::SetDefault { id } => {
                ModelManager::set_default(&id).await?;
                if ctx.json {
                    print_json(&SuccessResponse::new(json!({ "default": id })));
                } else {
                    print_success(&format!("Set default model: {}", id));
                }
            }
            ModelAction::Enable { id } => {
                ModelManager::enable_model(&id).await?;
                if ctx.json {
                    print_json(&SuccessResponse::new(json!({ "enabled": id })));
                } else {
                    print_success(&format!("Enabled model: {}", id));
                }
            }
            ModelAction::Disable { id } => {
                ModelManager::disable_model(&id).await?;
                if ctx.json {
                    print_json(&SuccessResponse::new(json!({ "disabled": id })));
                } else {
                    print_success(&format!("Disabled model: {}", id));
                }
            }
            ModelAction::Discover { provider_id } => {
                let models = ModelManager::discover_provider_models(&provider_id).await?;
                if ctx.json {
                    print_json(&SuccessResponse::new(json!({ "models": models })));
                } else if models.is_empty() {
                    println!("No models discovered from provider: {}", provider_id);
                } else {
                    let headers = &["ID", "NAME", "CONTEXT WINDOW"];
                    let rows: Vec<Vec<String>> = models
                        .iter()
                        .map(|m| {
                            vec![
                                m.id.clone(),
                                m.name.clone(),
                                m.context_window
                                    .map(|c| c.to_string())
                                    .unwrap_or_default(),
                            ]
                        })
                        .collect();
                    print_simple_table(headers, &rows);
                }
            }
        }
        Ok(())
    }
}
