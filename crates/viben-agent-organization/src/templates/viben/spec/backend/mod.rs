//! Backend development guidelines

pub const INDEX_MD: &str = include_str!("index.md");
pub const DIRECTORY_STRUCTURE_MD: &str = include_str!("directory-structure.md");
pub const DATABASE_GUIDELINES_MD: &str = include_str!("database-guidelines.md");
pub const LOGGING_GUIDELINES_MD: &str = include_str!("logging-guidelines.md");
pub const QUALITY_GUIDELINES_MD: &str = include_str!("quality-guidelines.md");
pub const ERROR_HANDLING_MD: &str = include_str!("error-handling.md");

pub fn get_all() -> Vec<(&'static str, &'static str)> {
    vec![
        ("index.md", INDEX_MD),
        ("directory-structure.md", DIRECTORY_STRUCTURE_MD),
        ("database-guidelines.md", DATABASE_GUIDELINES_MD),
        ("logging-guidelines.md", LOGGING_GUIDELINES_MD),
        ("quality-guidelines.md", QUALITY_GUIDELINES_MD),
        ("error-handling.md", ERROR_HANDLING_MD),
    ]
}
