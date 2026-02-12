//! Skill Management Service
//!
//! Manages skills installation, configuration, and discovery.
//! - Read/write skills configuration
//! - Install/uninstall skills
//! - List available skills from marketplace

use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

use chrono::Utc;
use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::config::get_state_dir;

/// Skills directory name
const SKILLS_DIR: &str = "skills";

/// Skills config file name
const SKILLS_CONFIG_FILE: &str = "installed.yaml";

/// Skill service errors
#[derive(Debug, Error)]
pub enum SkillError {
    #[error("Skill not found: {0}")]
    NotFound(String),

    #[error("Skill already installed: {0}")]
    AlreadyInstalled(String),

    #[error("Invalid skill name: {0}")]
    InvalidName(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("YAML error: {0}")]
    Yaml(#[from] serde_yaml::Error),
}

/// Installed skill entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledSkill {
    /// Skill version
    pub version: String,
    /// Installation timestamp (ISO 8601 format)
    pub installed_at: String,
    /// Optional description
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

/// Skill with id populated (for display/operations)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Skill {
    /// Skill identifier/name
    pub id: String,
    /// Skill version
    pub version: String,
    /// Installation timestamp
    pub installed_at: String,
    /// Optional description
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

/// Skills configuration file structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillsConfig {
    pub version: u32,
    pub skills: HashMap<String, InstalledSkill>,
}

impl Default for SkillsConfig {
    fn default() -> Self {
        Self {
            version: 1,
            skills: HashMap::new(),
        }
    }
}

/// Available skill from marketplace
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AvailableSkill {
    /// Skill identifier/name
    pub id: String,
    /// Display name
    pub name: String,
    /// Latest version
    pub version: String,
    /// Short description
    pub description: String,
}

/// Get the skills directory path
pub fn get_skills_dir() -> PathBuf {
    get_state_dir().join(SKILLS_DIR)
}

/// Get the skills config file path
pub fn get_skills_config_path() -> PathBuf {
    get_skills_dir().join(SKILLS_CONFIG_FILE)
}

/// Read skills configuration from file
pub fn read_skills_config() -> SkillsConfig {
    let config_path = get_skills_config_path();

    if !config_path.exists() {
        return SkillsConfig::default();
    }

    match fs::read_to_string(&config_path) {
        Ok(content) => serde_yaml::from_str(&content).unwrap_or_default(),
        Err(_) => SkillsConfig::default(),
    }
}

/// Write skills configuration to file
pub fn write_skills_config(config: &SkillsConfig) -> Result<(), SkillError> {
    let config_path = get_skills_config_path();
    let skills_dir = get_skills_dir();

    if !skills_dir.exists() {
        fs::create_dir_all(&skills_dir)?;
    }

    let content = serde_yaml::to_string(config)?;
    fs::write(config_path, content)?;
    Ok(())
}

/// Validate skill ID format
pub fn validate_skill_id(id: &str) -> Result<(), SkillError> {
    if id.is_empty() || id.trim().is_empty() {
        return Err(SkillError::InvalidName("Skill name cannot be empty".to_string()));
    }

    // Must start with lowercase letter or number
    let first_char = id.chars().next().unwrap();
    if !first_char.is_ascii_lowercase() && !first_char.is_ascii_digit() {
        return Err(SkillError::InvalidName(
            "Skill name must start with a lowercase letter or number".to_string(),
        ));
    }

    // Only lowercase letters, numbers, underscores, and hyphens
    for c in id.chars() {
        if !c.is_ascii_lowercase() && !c.is_ascii_digit() && c != '_' && c != '-' {
            return Err(SkillError::InvalidName(
                "Skill name can only contain lowercase letters, numbers, underscores, and hyphens".to_string(),
            ));
        }
    }

    if id.len() > 64 {
        return Err(SkillError::InvalidName(
            "Skill name must be 64 characters or less".to_string(),
        ));
    }

    Ok(())
}

/// Parse skill name with optional version
/// Supports formats: "skill-name" or "skill-name@version"
pub fn parse_skill_name(name_with_version: &str) -> (String, Option<String>) {
    if let Some(at_index) = name_with_version.rfind('@') {
        if at_index > 0 {
            let name = &name_with_version[..at_index];
            let version = &name_with_version[at_index + 1..];

            // Basic version format validation (e.g., 1.0.0, 1.0.0-beta.1)
            let is_valid_version = !version.is_empty()
                && version.chars().all(|c| c.is_ascii_digit() || c == '.' || c == '-' || c.is_ascii_alphanumeric());

            if is_valid_version {
                return (name.to_string(), Some(version.to_string()));
            }
        }
    }

    (name_with_version.to_string(), None)
}

/// Get a skill by ID
pub fn get_skill(id: &str) -> Option<Skill> {
    let config = read_skills_config();
    config.skills.get(id).map(|s| Skill {
        id: id.to_string(),
        version: s.version.clone(),
        installed_at: s.installed_at.clone(),
        description: s.description.clone(),
    })
}

/// List all installed skills
pub fn list_skills() -> Vec<Skill> {
    let config = read_skills_config();
    config
        .skills
        .into_iter()
        .map(|(id, s)| Skill {
            id,
            version: s.version,
            installed_at: s.installed_at,
            description: s.description,
        })
        .collect()
}

/// Check if a skill is installed
pub fn is_skill_installed(id: &str) -> bool {
    let config = read_skills_config();
    config.skills.contains_key(id)
}

/// Install a skill
pub fn install_skill(name: &str, version: Option<&str>) -> Result<Skill, SkillError> {
    validate_skill_id(name)?;

    let mut config = read_skills_config();

    if config.skills.contains_key(name) {
        return Err(SkillError::AlreadyInstalled(name.to_string()));
    }

    let skill_version = version.unwrap_or("1.0.0").to_string();
    let installed_at = Utc::now().to_rfc3339();

    // Create skill directory
    let skill_dir = get_skills_dir().join(name);
    if !skill_dir.exists() {
        fs::create_dir_all(&skill_dir)?;
    }

    // Create placeholder config in skill directory
    let skill_config_path = skill_dir.join("config.yaml");
    let skill_config = serde_yaml::to_string(&serde_yaml::mapping::Mapping::from_iter([
        (
            serde_yaml::Value::String("version".to_string()),
            serde_yaml::Value::Number(1.into()),
        ),
        (
            serde_yaml::Value::String("name".to_string()),
            serde_yaml::Value::String(name.to_string()),
        ),
        (
            serde_yaml::Value::String("description".to_string()),
            serde_yaml::Value::String(format!("Skill {}", name)),
        ),
        (
            serde_yaml::Value::String("installed_version".to_string()),
            serde_yaml::Value::String(skill_version.clone()),
        ),
    ]))?;
    fs::write(skill_config_path, skill_config)?;

    // Add to installed.yaml
    let installed_skill = InstalledSkill {
        version: skill_version.clone(),
        installed_at: installed_at.clone(),
        description: None,
    };

    config.skills.insert(name.to_string(), installed_skill);
    write_skills_config(&config)?;

    Ok(Skill {
        id: name.to_string(),
        version: skill_version,
        installed_at,
        description: None,
    })
}

/// Uninstall a skill
pub fn uninstall_skill(name: &str) -> Result<bool, SkillError> {
    let mut config = read_skills_config();

    if !config.skills.contains_key(name) {
        return Ok(false);
    }

    // Remove skill directory
    let skill_dir = get_skills_dir().join(name);
    if skill_dir.exists() {
        fs::remove_dir_all(&skill_dir)?;
    }

    // Remove from installed.yaml
    config.skills.remove(name);
    write_skills_config(&config)?;

    Ok(true)
}

/// Get available skills from marketplace (mock data)
pub fn get_available_skills() -> Vec<AvailableSkill> {
    vec![
        AvailableSkill {
            id: "code-review".to_string(),
            name: "Code Review".to_string(),
            version: "1.0.0".to_string(),
            description: "Code review assistance".to_string(),
        },
        AvailableSkill {
            id: "commit".to_string(),
            name: "Smart Commit".to_string(),
            version: "1.2.0".to_string(),
            description: "Smart commit messages".to_string(),
        },
        AvailableSkill {
            id: "test-runner".to_string(),
            name: "Test Runner".to_string(),
            version: "0.9.0".to_string(),
            description: "Test execution helper".to_string(),
        },
        AvailableSkill {
            id: "doc-gen".to_string(),
            name: "Documentation Generator".to_string(),
            version: "1.1.0".to_string(),
            description: "Generate documentation from code".to_string(),
        },
        AvailableSkill {
            id: "refactor".to_string(),
            name: "Code Refactor".to_string(),
            version: "0.8.0".to_string(),
            description: "Refactoring suggestions and assistance".to_string(),
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_skill_id() {
        assert!(validate_skill_id("my-skill").is_ok());
        assert!(validate_skill_id("skill_name").is_ok());
        assert!(validate_skill_id("skill123").is_ok());
        assert!(validate_skill_id("1skill").is_ok());

        assert!(validate_skill_id("").is_err());
        assert!(validate_skill_id("My-Skill").is_err());
        assert!(validate_skill_id("skill.name").is_err());
        assert!(validate_skill_id("-skill").is_err());
    }

    #[test]
    fn test_parse_skill_name() {
        let (name, version) = parse_skill_name("my-skill");
        assert_eq!(name, "my-skill");
        assert!(version.is_none());

        let (name, version) = parse_skill_name("my-skill@1.0.0");
        assert_eq!(name, "my-skill");
        assert_eq!(version, Some("1.0.0".to_string()));

        let (name, version) = parse_skill_name("my-skill@1.0.0-beta.1");
        assert_eq!(name, "my-skill");
        assert_eq!(version, Some("1.0.0-beta.1".to_string()));
    }
}
