//! Skill NAPI bindings
//!
//! Exposes skill management functions to Node.js via NAPI.

use napi::Result;
use napi_derive::napi;

use crate::services::skill;

/// Installed skill for NAPI
#[napi(object)]
pub struct NapiSkill {
    pub id: String,
    pub version: String,
    pub installed_at: String,
    pub description: Option<String>,
}

impl From<skill::Skill> for NapiSkill {
    fn from(s: skill::Skill) -> Self {
        Self {
            id: s.id,
            version: s.version,
            installed_at: s.installed_at,
            description: s.description,
        }
    }
}

/// Available skill from marketplace for NAPI
#[napi(object)]
pub struct NapiAvailableSkill {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
}

impl From<skill::AvailableSkill> for NapiAvailableSkill {
    fn from(s: skill::AvailableSkill) -> Self {
        Self {
            id: s.id,
            name: s.name,
            version: s.version,
            description: s.description,
        }
    }
}

/// List all installed skills
#[napi]
pub fn skill_list() -> Vec<NapiSkill> {
    skill::list_skills()
        .into_iter()
        .map(NapiSkill::from)
        .collect()
}

/// Get a skill by ID
#[napi]
pub fn skill_get(id: String) -> Option<NapiSkill> {
    skill::get_skill(&id).map(NapiSkill::from)
}

/// Check if a skill is installed
#[napi]
pub fn skill_is_installed(id: String) -> bool {
    skill::is_skill_installed(&id)
}

/// Install a skill
#[napi]
pub fn skill_install(name: String, version: Option<String>) -> Result<NapiSkill> {
    skill::install_skill(&name, version.as_deref())
        .map(NapiSkill::from)
        .map_err(|e| napi::Error::from_reason(e.to_string()))
}

/// Uninstall a skill
#[napi]
pub fn skill_uninstall(name: String) -> Result<bool> {
    skill::uninstall_skill(&name)
        .map_err(|e| napi::Error::from_reason(e.to_string()))
}

/// Validate skill ID format
#[napi]
pub fn skill_validate_id(id: String) -> Result<()> {
    skill::validate_skill_id(&id)
        .map_err(|e| napi::Error::from_reason(e.to_string()))
}

/// Parse skill name with optional version
#[napi(object)]
pub struct ParsedSkillName {
    pub name: String,
    pub version: Option<String>,
}

#[napi]
pub fn skill_parse_name(name_with_version: String) -> ParsedSkillName {
    let (name, version) = skill::parse_skill_name(&name_with_version);
    ParsedSkillName { name, version }
}

/// Get available skills from marketplace
#[napi]
pub fn skill_get_available() -> Vec<NapiAvailableSkill> {
    skill::get_available_skills()
        .into_iter()
        .map(NapiAvailableSkill::from)
        .collect()
}

/// Get skills directory path
#[napi]
pub fn skill_get_dir() -> String {
    skill::get_skills_dir().to_string_lossy().to_string()
}
