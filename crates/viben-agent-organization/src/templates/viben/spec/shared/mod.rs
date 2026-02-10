//! Shared coding standards

pub const INDEX_MD: &str = include_str!("index.md");

pub fn get_all() -> Vec<(&'static str, &'static str)> {
    vec![("index.md", INDEX_MD)]
}
