//! CLI error types

use thiserror::Error;

/// Result type for CLI operations
pub type CliResult<T> = std::result::Result<T, CliError>;

/// CLI error types
#[derive(Debug, Error)]
pub enum CliError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Invalid argument: {0}")]
    InvalidArgument(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Gateway error: {0}")]
    Gateway(String),

    #[error("Database error: {0}")]
    Database(String),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("YAML error: {0}")]
    Yaml(#[from] serde_yaml::Error),

    #[error("Core error: {0}")]
    Core(#[from] crate::Error),

    #[error("Chat not supported for executor: {0}")]
    ChatNotSupported(String),

    #[error("No prompt provided and stdin is empty")]
    NoPromptProvided,

    #[error("{0}")]
    Other(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    // ==================== Error display tests ====================

    #[test]
    fn test_cli_error_io() {
        let io_err = std::io::Error::new(std::io::ErrorKind::NotFound, "file not found");
        let err = CliError::Io(io_err);
        assert!(err.to_string().contains("IO error"));
        assert!(err.to_string().contains("file not found"));
    }

    #[test]
    fn test_cli_error_config() {
        let err = CliError::Config("invalid config file".to_string());
        assert_eq!(err.to_string(), "Configuration error: invalid config file");
    }

    #[test]
    fn test_cli_error_invalid_argument() {
        let err = CliError::InvalidArgument("--name is required".to_string());
        assert_eq!(err.to_string(), "Invalid argument: --name is required");
    }

    #[test]
    fn test_cli_error_not_found() {
        let err = CliError::NotFound("Executor UNKNOWN not found".to_string());
        assert_eq!(err.to_string(), "Not found: Executor UNKNOWN not found");
    }

    #[test]
    fn test_cli_error_gateway() {
        let err = CliError::Gateway("connection refused".to_string());
        assert_eq!(err.to_string(), "Gateway error: connection refused");
    }

    #[test]
    fn test_cli_error_database() {
        let err = CliError::Database("table not found".to_string());
        assert_eq!(err.to_string(), "Database error: table not found");
    }

    #[test]
    fn test_cli_error_serialization() {
        let json_err = serde_json::from_str::<serde_json::Value>("invalid").unwrap_err();
        let err = CliError::Serialization(json_err);
        assert!(err.to_string().contains("Serialization error"));
    }

    #[test]
    fn test_cli_error_yaml() {
        let yaml_err = serde_yaml::from_str::<serde_yaml::Value>(":\ninvalid").unwrap_err();
        let err = CliError::Yaml(yaml_err);
        assert!(err.to_string().contains("YAML error"));
    }

    #[test]
    fn test_cli_error_chat_not_supported() {
        let err = CliError::ChatNotSupported("GEMINI".to_string());
        assert_eq!(err.to_string(), "Chat not supported for executor: GEMINI");
    }

    #[test]
    fn test_cli_error_chat_not_supported_with_special_chars() {
        let err = CliError::ChatNotSupported("TEST_AGENT_123".to_string());
        assert_eq!(
            err.to_string(),
            "Chat not supported for executor: TEST_AGENT_123"
        );
    }

    #[test]
    fn test_cli_error_no_prompt_provided() {
        let err = CliError::NoPromptProvided;
        assert_eq!(err.to_string(), "No prompt provided and stdin is empty");
    }

    #[test]
    fn test_cli_error_other() {
        let err = CliError::Other("unexpected error".to_string());
        assert_eq!(err.to_string(), "unexpected error");
    }

    // ==================== Error From trait tests ====================

    #[test]
    fn test_cli_error_from_io_error() {
        let io_err = std::io::Error::new(std::io::ErrorKind::PermissionDenied, "access denied");
        let cli_err: CliError = io_err.into();
        assert!(matches!(cli_err, CliError::Io(_)));
    }

    #[test]
    fn test_cli_error_from_json_error() {
        let json_err = serde_json::from_str::<String>("not a string").unwrap_err();
        let cli_err: CliError = json_err.into();
        assert!(matches!(cli_err, CliError::Serialization(_)));
    }

    #[test]
    fn test_cli_error_from_yaml_error() {
        let yaml_err = serde_yaml::from_str::<String>(":\n:").unwrap_err();
        let cli_err: CliError = yaml_err.into();
        assert!(matches!(cli_err, CliError::Yaml(_)));
    }

    // ==================== CliResult tests ====================

    #[test]
    fn test_cli_result_ok() {
        let result: CliResult<i32> = Ok(42);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 42);
    }

    #[test]
    fn test_cli_result_err() {
        let result: CliResult<i32> = Err(CliError::NoPromptProvided);
        assert!(result.is_err());
    }

    #[test]
    fn test_cli_result_map() {
        let result: CliResult<i32> = Ok(10);
        let mapped = result.map(|x| x * 2);
        assert_eq!(mapped.unwrap(), 20);
    }

    #[test]
    fn test_cli_result_and_then() {
        let result: CliResult<i32> = Ok(10);
        let chained = result.and_then(|x| {
            if x > 5 {
                Ok(x * 2)
            } else {
                Err(CliError::InvalidArgument("too small".to_string()))
            }
        });
        assert_eq!(chained.unwrap(), 20);
    }

    // ==================== Error Debug trait tests ====================

    #[test]
    fn test_cli_error_debug() {
        let err = CliError::ChatNotSupported("TEST".to_string());
        let debug_str = format!("{:?}", err);
        assert!(debug_str.contains("ChatNotSupported"));
        assert!(debug_str.contains("TEST"));
    }

    #[test]
    fn test_cli_error_no_prompt_debug() {
        let err = CliError::NoPromptProvided;
        let debug_str = format!("{:?}", err);
        assert!(debug_str.contains("NoPromptProvided"));
    }
}
