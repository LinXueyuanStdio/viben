//! Environment variable parsing for providers

use super::types::{get_env_var_name, ProviderType};
use std::collections::HashMap;
use std::env;

/// Environment configuration for providers
#[derive(Debug, Clone, Default)]
pub struct ProviderEnvConfig {
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub api_version: Option<String>,
    pub deployment: Option<String>,
}

/// Parse environment variables for a specific provider type
pub fn parse_provider_env(provider_type: ProviderType) -> ProviderEnvConfig {
    let mut config = ProviderEnvConfig::default();

    // Get API key from standard environment variable
    if let Some(env_var) = get_env_var_name(provider_type) {
        config.api_key = env::var(env_var).ok();
    }

    // Provider-specific environment variables
    match provider_type {
        ProviderType::OpenAI => {
            config.base_url = env::var("OPENAI_BASE_URL").ok();
        }
        ProviderType::Anthropic => {
            config.base_url = env::var("ANTHROPIC_BASE_URL").ok();
            config.api_version = env::var("ANTHROPIC_API_VERSION").ok();
        }
        ProviderType::Azure => {
            config.base_url = env::var("AZURE_OPENAI_ENDPOINT").ok();
            config.deployment = env::var("AZURE_OPENAI_DEPLOYMENT").ok();
            config.api_version = env::var("AZURE_OPENAI_API_VERSION").ok();
        }
        ProviderType::Ollama => {
            config.base_url = env::var("OLLAMA_HOST").ok();
        }
        ProviderType::OpenRouter => {
            config.base_url = env::var("OPENROUTER_BASE_URL").ok();
        }
        ProviderType::Google => {
            config.base_url = env::var("GOOGLE_API_BASE_URL").ok();
        }
        ProviderType::Custom => {
            // Custom provider requires explicit configuration
        }
    }

    config
}

/// Scan environment for all available provider configurations
pub fn scan_env_providers() -> HashMap<ProviderType, ProviderEnvConfig> {
    let provider_types = [
        ProviderType::OpenAI,
        ProviderType::Anthropic,
        ProviderType::Azure,
        ProviderType::Ollama,
        ProviderType::OpenRouter,
        ProviderType::Google,
    ];

    let mut configs = HashMap::new();
    for provider_type in provider_types {
        let config = parse_provider_env(provider_type);
        // Only include if we found something useful
        if config.api_key.is_some() || config.base_url.is_some() {
            configs.insert(provider_type, config);
        }
    }
    configs
}

/// Check if a provider has credentials available in environment
pub fn has_env_credentials(provider_type: ProviderType) -> bool {
    let config = parse_provider_env(provider_type);
    config.api_key.is_some()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serial_test::serial;

    #[test]
    #[serial]
    fn test_parse_provider_env_openai() {
        // Save and clear
        let saved = env::var("OPENAI_API_KEY").ok();
        env::remove_var("OPENAI_API_KEY");

        // Set test environment variable
        env::set_var("OPENAI_API_KEY", "test-key");
        let config = parse_provider_env(ProviderType::OpenAI);
        assert_eq!(config.api_key, Some("test-key".to_string()));

        // Restore
        env::remove_var("OPENAI_API_KEY");
        if let Some(v) = saved {
            env::set_var("OPENAI_API_KEY", v);
        }
    }

    #[test]
    #[serial]
    fn test_parse_provider_env_anthropic() {
        // Save and clear
        let saved_key = env::var("ANTHROPIC_API_KEY").ok();
        let saved_version = env::var("ANTHROPIC_API_VERSION").ok();
        env::remove_var("ANTHROPIC_API_KEY");
        env::remove_var("ANTHROPIC_API_VERSION");

        env::set_var("ANTHROPIC_API_KEY", "test-anthropic-key");
        env::set_var("ANTHROPIC_API_VERSION", "2024-01-01");
        let config = parse_provider_env(ProviderType::Anthropic);
        assert_eq!(config.api_key, Some("test-anthropic-key".to_string()));
        assert_eq!(config.api_version, Some("2024-01-01".to_string()));

        // Restore
        env::remove_var("ANTHROPIC_API_KEY");
        env::remove_var("ANTHROPIC_API_VERSION");
        if let Some(v) = saved_key {
            env::set_var("ANTHROPIC_API_KEY", v);
        }
        if let Some(v) = saved_version {
            env::set_var("ANTHROPIC_API_VERSION", v);
        }
    }

    #[test]
    #[serial]
    fn test_scan_env_providers_after_clearing() {
        // Save original values (both keys and base URLs)
        let saved_openai = env::var("OPENAI_API_KEY").ok();
        let saved_openai_base = env::var("OPENAI_BASE_URL").ok();
        let saved_anthropic = env::var("ANTHROPIC_API_KEY").ok();
        let saved_anthropic_base = env::var("ANTHROPIC_BASE_URL").ok();
        let saved_azure = env::var("AZURE_OPENAI_API_KEY").ok();
        let saved_azure_base = env::var("AZURE_OPENAI_ENDPOINT").ok();
        let saved_openrouter = env::var("OPENROUTER_API_KEY").ok();
        let saved_openrouter_base = env::var("OPENROUTER_BASE_URL").ok();
        let saved_google = env::var("GOOGLE_API_KEY").ok();
        let saved_google_base = env::var("GOOGLE_API_BASE_URL").ok();
        let saved_ollama_host = env::var("OLLAMA_HOST").ok();

        // Clear all provider env vars (keys and base URLs)
        env::remove_var("OPENAI_API_KEY");
        env::remove_var("OPENAI_BASE_URL");
        env::remove_var("ANTHROPIC_API_KEY");
        env::remove_var("ANTHROPIC_BASE_URL");
        env::remove_var("AZURE_OPENAI_API_KEY");
        env::remove_var("AZURE_OPENAI_ENDPOINT");
        env::remove_var("OPENROUTER_API_KEY");
        env::remove_var("OPENROUTER_BASE_URL");
        env::remove_var("GOOGLE_API_KEY");
        env::remove_var("GOOGLE_API_BASE_URL");
        env::remove_var("OLLAMA_HOST");

        let configs = scan_env_providers();
        // With all vars cleared, should be empty
        assert!(
            configs.is_empty(),
            "Expected empty configs after clearing env vars, got {:?}",
            configs
        );

        // Restore original values
        if let Some(v) = saved_openai {
            env::set_var("OPENAI_API_KEY", v);
        }
        if let Some(v) = saved_openai_base {
            env::set_var("OPENAI_BASE_URL", v);
        }
        if let Some(v) = saved_anthropic {
            env::set_var("ANTHROPIC_API_KEY", v);
        }
        if let Some(v) = saved_anthropic_base {
            env::set_var("ANTHROPIC_BASE_URL", v);
        }
        if let Some(v) = saved_azure {
            env::set_var("AZURE_OPENAI_API_KEY", v);
        }
        if let Some(v) = saved_azure_base {
            env::set_var("AZURE_OPENAI_ENDPOINT", v);
        }
        if let Some(v) = saved_openrouter {
            env::set_var("OPENROUTER_API_KEY", v);
        }
        if let Some(v) = saved_openrouter_base {
            env::set_var("OPENROUTER_BASE_URL", v);
        }
        if let Some(v) = saved_google {
            env::set_var("GOOGLE_API_KEY", v);
        }
        if let Some(v) = saved_google_base {
            env::set_var("GOOGLE_API_BASE_URL", v);
        }
        if let Some(v) = saved_ollama_host {
            env::set_var("OLLAMA_HOST", v);
        }
    }

    #[test]
    #[serial]
    fn test_has_env_credentials() {
        // Save and clear
        let saved = env::var("OPENAI_API_KEY").ok();
        env::remove_var("OPENAI_API_KEY");

        env::set_var("OPENAI_API_KEY", "test-key");
        assert!(has_env_credentials(ProviderType::OpenAI));
        env::remove_var("OPENAI_API_KEY");
        assert!(!has_env_credentials(ProviderType::OpenAI));

        // Restore
        if let Some(v) = saved {
            env::set_var("OPENAI_API_KEY", v);
        }
    }
}
