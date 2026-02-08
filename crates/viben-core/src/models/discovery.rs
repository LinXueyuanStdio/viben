//! Model discovery for various providers

use crate::error::{Error, Result};
use crate::providers::{get_default_base_url, Provider, ProviderType};
use serde::Deserialize;

use super::types::DiscoveredModel;
use super::known::get_known_models_for_provider;

/// Discover models available from a provider
pub async fn discover_models(provider: &Provider) -> Result<Vec<DiscoveredModel>> {
    match provider.provider_type {
        ProviderType::OpenAI => discover_openai_models(provider).await,
        ProviderType::Anthropic => discover_anthropic_models(provider).await,
        ProviderType::Ollama => discover_ollama_models(provider).await,
        ProviderType::OpenRouter => discover_openrouter_models(provider).await,
        ProviderType::Google => discover_google_models(provider).await,
        ProviderType::Azure | ProviderType::Custom => {
            // Azure and Custom providers don't have a standard discovery API
            Ok(vec![])
        }
    }
}

/// Discover OpenAI models via API
/// GET {base_url}/models with Bearer token auth
async fn discover_openai_models(provider: &Provider) -> Result<Vec<DiscoveredModel>> {
    let base_url = provider
        .base_url
        .as_deref()
        .or(get_default_base_url(ProviderType::OpenAI))
        .ok_or_else(|| Error::ModelDiscovery("No base URL for OpenAI provider".to_string()))?;

    let api_key = provider
        .api_key
        .as_ref()
        .ok_or_else(|| Error::ModelDiscovery("No API key for OpenAI provider".to_string()))?;

    let url = format!("{}/models", base_url.trim_end_matches('/'));

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(Error::ModelDiscovery(format!(
            "OpenAI API error ({}): {}",
            status, text
        )));
    }

    #[derive(Deserialize)]
    struct OpenAIModel {
        id: String,
        #[serde(default)]
        owned_by: Option<String>,
        #[serde(default)]
        created: Option<i64>,
    }

    #[derive(Deserialize)]
    struct OpenAIModelsResponse {
        data: Vec<OpenAIModel>,
    }

    let models_response: OpenAIModelsResponse = response.json().await?;

    // Filter to only include chat models (gpt-*, o1-*, o3-*, etc.)
    let models: Vec<DiscoveredModel> = models_response
        .data
        .into_iter()
        .filter(|m| {
            let id = m.id.to_lowercase();
            id.starts_with("gpt-")
                || id.starts_with("o1")
                || id.starts_with("o3")
                || id.starts_with("chatgpt")
        })
        .map(|m| DiscoveredModel {
            id: m.id.clone(),
            name: m.id.clone(),
            description: None,
            context_window: None,
            max_output_tokens: None,
            owned_by: m.owned_by,
            created: m.created,
        })
        .collect();

    Ok(models)
}

/// Discover Anthropic models
/// Anthropic doesn't have a models listing API, use known models
async fn discover_anthropic_models(_provider: &Provider) -> Result<Vec<DiscoveredModel>> {
    let known = get_known_models_for_provider(ProviderType::Anthropic);
    let models: Vec<DiscoveredModel> = known
        .into_iter()
        .map(|m| DiscoveredModel {
            id: m.id.to_string(),
            name: m.name.to_string(),
            description: m.description.map(|s| s.to_string()),
            context_window: m.context_window,
            max_output_tokens: m.max_output_tokens,
            owned_by: Some("anthropic".to_string()),
            created: None,
        })
        .collect();
    Ok(models)
}

/// Discover Ollama models via API
/// GET {base_url}/api/tags (no auth)
async fn discover_ollama_models(provider: &Provider) -> Result<Vec<DiscoveredModel>> {
    let base_url = provider
        .base_url
        .as_deref()
        .or(get_default_base_url(ProviderType::Ollama))
        .ok_or_else(|| Error::ModelDiscovery("No base URL for Ollama provider".to_string()))?;

    let url = format!("{}/api/tags", base_url.trim_end_matches('/'));

    let client = reqwest::Client::new();
    let response = client.get(&url).send().await;

    // Ollama might not be running, return empty list instead of error
    let response = match response {
        Ok(r) => r,
        Err(_) => return Ok(vec![]),
    };

    if !response.status().is_success() {
        return Ok(vec![]);
    }

    #[derive(Deserialize)]
    struct OllamaModel {
        name: String,
    }

    #[derive(Deserialize)]
    struct OllamaModelsResponse {
        models: Vec<OllamaModel>,
    }

    let models_response: OllamaModelsResponse = match response.json().await {
        Ok(r) => r,
        Err(_) => return Ok(vec![]),
    };

    let models: Vec<DiscoveredModel> = models_response
        .models
        .into_iter()
        .map(|m| DiscoveredModel {
            id: m.name.clone(),
            name: m.name,
            description: None,
            context_window: None,
            max_output_tokens: None,
            owned_by: Some("local".to_string()),
            created: None,
        })
        .collect();

    Ok(models)
}

/// Discover OpenRouter models via API
/// GET https://openrouter.ai/api/v1/models with Bearer token
async fn discover_openrouter_models(provider: &Provider) -> Result<Vec<DiscoveredModel>> {
    let base_url = provider
        .base_url
        .as_deref()
        .or(get_default_base_url(ProviderType::OpenRouter))
        .ok_or_else(|| Error::ModelDiscovery("No base URL for OpenRouter provider".to_string()))?;

    let url = format!("{}/models", base_url.trim_end_matches('/'));

    let client = reqwest::Client::new();
    let mut request = client.get(&url);

    // OpenRouter allows unauthenticated requests to /models
    if let Some(api_key) = &provider.api_key {
        request = request.header("Authorization", format!("Bearer {}", api_key));
    }

    let response = request.send().await?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(Error::ModelDiscovery(format!(
            "OpenRouter API error ({}): {}",
            status, text
        )));
    }

    #[derive(Deserialize)]
    struct OpenRouterModel {
        id: String,
        name: String,
        #[serde(default)]
        description: Option<String>,
        #[serde(default)]
        context_length: Option<u32>,
    }

    #[derive(Deserialize)]
    struct OpenRouterModelsResponse {
        data: Vec<OpenRouterModel>,
    }

    let models_response: OpenRouterModelsResponse = response.json().await?;

    let models: Vec<DiscoveredModel> = models_response
        .data
        .into_iter()
        .map(|m| {
            // Extract owner from model ID (e.g., "openai/gpt-4" -> "openai")
            let owned_by = m.id.split('/').next().map(|s| s.to_string());
            DiscoveredModel {
                id: m.id,
                name: m.name,
                description: m.description,
                context_window: m.context_length,
                max_output_tokens: None,
                owned_by,
                created: None,
            }
        })
        .collect();

    Ok(models)
}

/// Discover Google AI (Gemini) models via API
/// GET {base_url}/models?key={api_key}
async fn discover_google_models(provider: &Provider) -> Result<Vec<DiscoveredModel>> {
    let base_url = provider
        .base_url
        .as_deref()
        .or(get_default_base_url(ProviderType::Google))
        .ok_or_else(|| Error::ModelDiscovery("No base URL for Google provider".to_string()))?;

    let api_key = provider
        .api_key
        .as_ref()
        .ok_or_else(|| Error::ModelDiscovery("No API key for Google provider".to_string()))?;

    let url = format!("{}/models?key={}", base_url.trim_end_matches('/'), api_key);

    let client = reqwest::Client::new();
    let response = client.get(&url).send().await?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(Error::ModelDiscovery(format!(
            "Google AI API error ({}): {}",
            status, text
        )));
    }

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct GoogleModel {
        name: String,
        #[serde(default)]
        display_name: Option<String>,
        #[serde(default)]
        description: Option<String>,
        #[serde(default)]
        input_token_limit: Option<u32>,
        #[serde(default)]
        output_token_limit: Option<u32>,
    }

    #[derive(Deserialize)]
    struct GoogleModelsResponse {
        models: Vec<GoogleModel>,
    }

    let models_response: GoogleModelsResponse = response.json().await?;

    let models: Vec<DiscoveredModel> = models_response
        .models
        .into_iter()
        .filter(|m| {
            // Filter to generative models (Gemini)
            m.name.contains("gemini")
        })
        .map(|m| {
            // Extract model ID from full name (e.g., "models/gemini-pro" -> "gemini-pro")
            let id = m.name.strip_prefix("models/").unwrap_or(&m.name).to_string();
            DiscoveredModel {
                id: id.clone(),
                name: m.display_name.unwrap_or(id),
                description: m.description,
                context_window: m.input_token_limit,
                max_output_tokens: m.output_token_limit,
                owned_by: Some("google".to_string()),
                created: None,
            }
        })
        .collect();

    Ok(models)
}
