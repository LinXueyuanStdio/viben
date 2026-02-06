//! Tests for error module

use viben_core::Error;

#[test]
fn test_error_display_agent_not_found() {
    let error = Error::AgentNotFound("test-agent".to_string());
    assert_eq!(format!("{}", error), "Agent not found: test-agent");
}

#[test]
fn test_error_display_agent_already_exists() {
    let error = Error::AgentAlreadyExists("my-agent".to_string());
    assert_eq!(format!("{}", error), "Agent already exists: my-agent");
}

#[test]
fn test_error_display_provider_not_found() {
    let error = Error::ProviderNotFound("openai".to_string());
    assert_eq!(format!("{}", error), "Provider not found: openai");
}

#[test]
fn test_error_display_provider_already_exists() {
    let error = Error::ProviderAlreadyExists("openai".to_string());
    assert_eq!(format!("{}", error), "Provider already exists: openai");
}

#[test]
fn test_error_display_model_not_found() {
    let error = Error::ModelNotFound("gpt-4".to_string());
    assert_eq!(format!("{}", error), "Model not found: gpt-4");
}

#[test]
fn test_error_display_model_already_exists() {
    let error = Error::ModelAlreadyExists("custom-model".to_string());
    assert_eq!(format!("{}", error), "Model already exists: custom-model");
}

#[test]
fn test_error_display_template_not_found() {
    let error = Error::TemplateNotFound("my-template".to_string());
    assert_eq!(format!("{}", error), "Template not found: my-template");
}

#[test]
fn test_error_display_template_already_exists() {
    let error = Error::TemplateAlreadyExists("template".to_string());
    assert_eq!(format!("{}", error), "Template already exists: template");
}

#[test]
fn test_error_display_session_not_found() {
    let error = Error::SessionNotFound("session-123".to_string());
    assert_eq!(format!("{}", error), "Session not found: session-123");
}

#[test]
fn test_error_display_config() {
    let error = Error::Config("Invalid configuration".to_string());
    assert_eq!(
        format!("{}", error),
        "Configuration error: Invalid configuration"
    );
}

#[test]
fn test_error_display_invalid_operation() {
    let error = Error::InvalidOperation("Cannot do this".to_string());
    assert_eq!(format!("{}", error), "Invalid operation: Cannot do this");
}

#[test]
fn test_error_from_io() {
    let io_error = std::io::Error::new(std::io::ErrorKind::NotFound, "file not found");
    let error: Error = io_error.into();
    assert!(format!("{}", error).contains("IO error"));
}

#[test]
fn test_error_debug_format() {
    let error = Error::AgentNotFound("test".to_string());
    let debug_str = format!("{:?}", error);
    assert!(debug_str.contains("AgentNotFound"));
    assert!(debug_str.contains("test"));
}
