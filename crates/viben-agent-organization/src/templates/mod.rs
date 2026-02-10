//! Template files for Viben Agent Organization
//!
//! All templates are embedded at compile time using include_str!
//! The naming convention replaces "trellis" with "viben" and "Trellis" with "Viben"

// Re-export submodules
pub mod claude;
pub mod markdown;
pub mod viben;

/// Perform name replacement in template content
/// Replaces: .trellis -> .viben, trellis -> viben, Trellis -> Viben, TRELLIS -> VIBEN
#[allow(dead_code)]
pub fn replace_names(content: &str) -> String {
    content
        .replace(".trellis", ".viben")
        .replace("/trellis:", "/viben:")
        .replace("trellis:", "viben:")
        .replace("trellis-", "viben-")
        .replace("trellis/", "viben/")
        .replace("trellis", "viben")
        .replace("TRELLIS", "VIBEN")
        .replace("Trellis", "Viben")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_replace_names() {
        assert_eq!(replace_names(".trellis/"), ".viben/");
        assert_eq!(replace_names("/trellis:start"), "/viben:start");
        assert_eq!(replace_names("Trellis workflow"), "Viben workflow");
        assert_eq!(replace_names("TRELLIS:START"), "VIBEN:START");
        assert_eq!(
            replace_names(".trellis/scripts/get-context.sh"),
            ".viben/scripts/get-context.sh"
        );
    }
}
