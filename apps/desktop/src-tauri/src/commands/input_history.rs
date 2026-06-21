//! Desktop input history persistence.
//!
//! Stores sent ACP chat prompts as append-only JSONL in ~/.viben/input_history.jsonl.

#[cfg(test)]
mod tests {
    use super::{append_input_history_to_path, read_input_history_from_path};

    #[test]
    fn reads_valid_history_lines_and_ignores_bad_or_empty_lines() {
        let temp = tempfile::tempdir().expect("create temp dir");
        let path = temp.path().join("input_history.jsonl");
        std::fs::write(
            &path,
            concat!(
                "{\"text\":\"first\",\"created_at\":\"2026-06-22T00:00:00Z\",\"source\":\"desktop_acp_chat\"}\n",
                "not json\n",
                "{\"text\":\"   \",\"created_at\":\"2026-06-22T00:00:01Z\",\"source\":\"desktop_acp_chat\"}\n",
                "{\"text\":\"second\",\"created_at\":\"2026-06-22T00:00:02Z\",\"source\":\"desktop_acp_chat\"}\n"
            ),
        )
        .expect("write fixture");

        let entries = read_input_history_from_path(&path).expect("read history");

        assert_eq!(entries, vec!["first".to_string(), "second".to_string()]);
    }

    #[test]
    fn appends_history_as_jsonl_without_overwriting_existing_entries() {
        let temp = tempfile::tempdir().expect("create temp dir");
        let path = temp.path().join(".viben").join("input_history.jsonl");

        append_input_history_to_path(&path, "first").expect("append first");
        append_input_history_to_path(&path, "second").expect("append second");

        let raw = std::fs::read_to_string(&path).expect("read history file");
        let lines: Vec<&str> = raw.lines().collect();

        assert_eq!(lines.len(), 2);
        assert!(lines[0].contains("\"text\":\"first\""));
        assert!(lines[1].contains("\"text\":\"second\""));
        assert_eq!(
            read_input_history_from_path(&path).expect("read parsed history"),
            vec!["first".to_string(), "second".to_string()]
        );
    }
}
