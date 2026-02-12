//! Known models database
//!
//! Predefined models that users can enable via `include_provider_predefined=true`.
//! These are NOT returned by default - users must configure their own models in
//! ~/.viben/providers/<provider>/models.yaml

use crate::providers::ProviderType;

use super::types::KnownModel;

/// Get all known models (predefined, for reference only)
///
/// These models are only returned when `include_provider_predefined=true` is set.
/// Users should configure their own models in providers/<provider>/models.yaml.
pub fn get_known_models() -> Vec<KnownModel> {
    vec![
        // OpenAI Models
        KnownModel {
            id: "gpt-4o",
            name: "GPT-4o",
            provider: ProviderType::OpenAI,
            description: Some("Most capable GPT-4 model with vision"),
            context_window: Some(128000),
            max_output_tokens: Some(16384),
        },
        KnownModel {
            id: "gpt-4o-mini",
            name: "GPT-4o Mini",
            provider: ProviderType::OpenAI,
            description: Some("Fast and efficient GPT-4 model"),
            context_window: Some(128000),
            max_output_tokens: Some(16384),
        },
        KnownModel {
            id: "gpt-4-turbo",
            name: "GPT-4 Turbo",
            provider: ProviderType::OpenAI,
            description: Some("GPT-4 Turbo with 128K context"),
            context_window: Some(128000),
            max_output_tokens: Some(4096),
        },
        KnownModel {
            id: "gpt-4",
            name: "GPT-4",
            provider: ProviderType::OpenAI,
            description: Some("Original GPT-4 model"),
            context_window: Some(8192),
            max_output_tokens: Some(4096),
        },
        KnownModel {
            id: "gpt-3.5-turbo",
            name: "GPT-3.5 Turbo",
            provider: ProviderType::OpenAI,
            description: Some("Fast and cost-effective model"),
            context_window: Some(16385),
            max_output_tokens: Some(4096),
        },
        KnownModel {
            id: "o1",
            name: "o1",
            provider: ProviderType::OpenAI,
            description: Some("Advanced reasoning model"),
            context_window: Some(200000),
            max_output_tokens: Some(100000),
        },
        KnownModel {
            id: "o1-mini",
            name: "o1-mini",
            provider: ProviderType::OpenAI,
            description: Some("Efficient reasoning model"),
            context_window: Some(128000),
            max_output_tokens: Some(65536),
        },
        KnownModel {
            id: "o3-mini",
            name: "o3-mini",
            provider: ProviderType::OpenAI,
            description: Some("Latest efficient reasoning model"),
            context_window: Some(200000),
            max_output_tokens: Some(100000),
        },
        // Anthropic Models
        KnownModel {
            id: "claude-sonnet-4-5-20250514",
            name: "Claude 4.5 Sonnet",
            provider: ProviderType::Anthropic,
            description: Some("Most intelligent Claude model with extended thinking"),
            context_window: Some(200000),
            max_output_tokens: Some(16384),
        },
        KnownModel {
            id: "claude-opus-4-5-20250514",
            name: "Claude 4.5 Opus",
            provider: ProviderType::Anthropic,
            description: Some("Most capable Claude model for complex tasks"),
            context_window: Some(200000),
            max_output_tokens: Some(32000),
        },
        KnownModel {
            id: "claude-3-5-sonnet-20241022",
            name: "Claude 3.5 Sonnet",
            provider: ProviderType::Anthropic,
            description: Some("High-performance Claude 3.5 model"),
            context_window: Some(200000),
            max_output_tokens: Some(8192),
        },
        KnownModel {
            id: "claude-3-5-haiku-20241022",
            name: "Claude 3.5 Haiku",
            provider: ProviderType::Anthropic,
            description: Some("Fast and efficient Claude model"),
            context_window: Some(200000),
            max_output_tokens: Some(8192),
        },
        KnownModel {
            id: "claude-3-opus-20240229",
            name: "Claude 3 Opus",
            provider: ProviderType::Anthropic,
            description: Some("Most capable Claude 3 model"),
            context_window: Some(200000),
            max_output_tokens: Some(4096),
        },
        KnownModel {
            id: "claude-3-sonnet-20240229",
            name: "Claude 3 Sonnet",
            provider: ProviderType::Anthropic,
            description: Some("Balanced Claude 3 model"),
            context_window: Some(200000),
            max_output_tokens: Some(4096),
        },
        KnownModel {
            id: "claude-3-haiku-20240307",
            name: "Claude 3 Haiku",
            provider: ProviderType::Anthropic,
            description: Some("Fast Claude 3 model"),
            context_window: Some(200000),
            max_output_tokens: Some(4096),
        },
        // Ollama Models (common ones)
        KnownModel {
            id: "llama3.3",
            name: "Llama 3.3",
            provider: ProviderType::Ollama,
            description: Some("Meta's latest Llama model"),
            context_window: Some(128000),
            max_output_tokens: None,
        },
        KnownModel {
            id: "llama3.2",
            name: "Llama 3.2",
            provider: ProviderType::Ollama,
            description: Some("Meta's Llama 3.2"),
            context_window: Some(128000),
            max_output_tokens: None,
        },
        KnownModel {
            id: "llama3.1",
            name: "Llama 3.1",
            provider: ProviderType::Ollama,
            description: Some("Meta's Llama 3.1"),
            context_window: Some(128000),
            max_output_tokens: None,
        },
        KnownModel {
            id: "qwen2.5",
            name: "Qwen 2.5",
            provider: ProviderType::Ollama,
            description: Some("Alibaba's Qwen 2.5"),
            context_window: Some(128000),
            max_output_tokens: None,
        },
        KnownModel {
            id: "deepseek-r1",
            name: "DeepSeek R1",
            provider: ProviderType::Ollama,
            description: Some("DeepSeek reasoning model"),
            context_window: Some(64000),
            max_output_tokens: None,
        },
        KnownModel {
            id: "deepseek-coder-v2",
            name: "DeepSeek Coder V2",
            provider: ProviderType::Ollama,
            description: Some("DeepSeek coding model"),
            context_window: Some(128000),
            max_output_tokens: None,
        },
        KnownModel {
            id: "mistral",
            name: "Mistral",
            provider: ProviderType::Ollama,
            description: Some("Mistral AI's base model"),
            context_window: Some(32000),
            max_output_tokens: None,
        },
        KnownModel {
            id: "mixtral",
            name: "Mixtral",
            provider: ProviderType::Ollama,
            description: Some("Mistral AI's MoE model"),
            context_window: Some(32000),
            max_output_tokens: None,
        },
        KnownModel {
            id: "codellama",
            name: "Code Llama",
            provider: ProviderType::Ollama,
            description: Some("Meta's coding model"),
            context_window: Some(16384),
            max_output_tokens: None,
        },
        KnownModel {
            id: "gemma2",
            name: "Gemma 2",
            provider: ProviderType::Ollama,
            description: Some("Google's Gemma 2"),
            context_window: Some(8192),
            max_output_tokens: None,
        },
        KnownModel {
            id: "phi3",
            name: "Phi-3",
            provider: ProviderType::Ollama,
            description: Some("Microsoft's Phi-3"),
            context_window: Some(128000),
            max_output_tokens: None,
        },
        // OpenRouter popular models
        KnownModel {
            id: "openrouter/auto",
            name: "Auto (Best Available)",
            provider: ProviderType::OpenRouter,
            description: Some("Automatically select best model"),
            context_window: None,
            max_output_tokens: None,
        },
        KnownModel {
            id: "anthropic/claude-3.5-sonnet",
            name: "Claude 3.5 Sonnet (OpenRouter)",
            provider: ProviderType::OpenRouter,
            description: Some("Claude 3.5 Sonnet via OpenRouter"),
            context_window: Some(200000),
            max_output_tokens: Some(8192),
        },
        KnownModel {
            id: "openai/gpt-4o",
            name: "GPT-4o (OpenRouter)",
            provider: ProviderType::OpenRouter,
            description: Some("GPT-4o via OpenRouter"),
            context_window: Some(128000),
            max_output_tokens: Some(16384),
        },
        KnownModel {
            id: "google/gemini-2.0-flash-exp",
            name: "Gemini 2.0 Flash",
            provider: ProviderType::OpenRouter,
            description: Some("Google Gemini 2.0 Flash via OpenRouter"),
            context_window: Some(1000000),
            max_output_tokens: Some(8192),
        },
        KnownModel {
            id: "deepseek/deepseek-r1",
            name: "DeepSeek R1 (OpenRouter)",
            provider: ProviderType::OpenRouter,
            description: Some("DeepSeek R1 via OpenRouter"),
            context_window: Some(64000),
            max_output_tokens: None,
        },
    ]
}

/// Get known models for a specific provider
pub fn get_known_models_for_provider(provider: ProviderType) -> Vec<KnownModel> {
    get_known_models()
        .into_iter()
        .filter(|m| m.provider == provider)
        .collect()
}

/// Find a known model by ID
pub fn find_known_model(id: &str) -> Option<KnownModel> {
    get_known_models().into_iter().find(|m| m.id == id)
}
