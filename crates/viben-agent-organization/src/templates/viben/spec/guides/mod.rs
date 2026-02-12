//! Thinking guides

pub const INDEX_MD: &str = include_str!("index.md");
pub const CROSS_LAYER_THINKING_GUIDE_MD: &str = include_str!("cross-layer-thinking-guide.md");
pub const CODE_REUSE_THINKING_GUIDE_MD: &str = include_str!("code-reuse-thinking-guide.md");

pub fn get_all() -> Vec<(&'static str, &'static str)> {
    vec![
        ("index.md", INDEX_MD),
        ("cross-layer-thinking-guide.md", CROSS_LAYER_THINKING_GUIDE_MD),
        ("code-reuse-thinking-guide.md", CODE_REUSE_THINKING_GUIDE_MD),
    ]
}
