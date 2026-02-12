//! Frontend development guidelines

pub const INDEX_MD: &str = include_str!("index.md");
pub const DIRECTORY_STRUCTURE_MD: &str = include_str!("directory-structure.md");
pub const TYPE_SAFETY_MD: &str = include_str!("type-safety.md");
pub const HOOK_GUIDELINES_MD: &str = include_str!("hook-guidelines.md");
pub const COMPONENT_GUIDELINES_MD: &str = include_str!("component-guidelines.md");
pub const QUALITY_GUIDELINES_MD: &str = include_str!("quality-guidelines.md");
pub const STATE_MANAGEMENT_MD: &str = include_str!("state-management.md");

pub fn get_all() -> Vec<(&'static str, &'static str)> {
    vec![
        ("index.md", INDEX_MD),
        ("directory-structure.md", DIRECTORY_STRUCTURE_MD),
        ("type-safety.md", TYPE_SAFETY_MD),
        ("hook-guidelines.md", HOOK_GUIDELINES_MD),
        ("component-guidelines.md", COMPONENT_GUIDELINES_MD),
        ("quality-guidelines.md", QUALITY_GUIDELINES_MD),
        ("state-management.md", STATE_MANAGEMENT_MD),
    ]
}
