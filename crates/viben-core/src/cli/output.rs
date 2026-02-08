//! CLI output utilities

use serde::Serialize;

/// Standard success response for JSON output
#[derive(Serialize)]
pub struct SuccessResponse<T: Serialize> {
    pub success: bool,
    pub data: T,
}

impl<T: Serialize> SuccessResponse<T> {
    pub fn new(data: T) -> Self {
        Self {
            success: true,
            data,
        }
    }
}

/// Standard error response for JSON output
#[derive(Serialize)]
pub struct ErrorResponse {
    pub success: bool,
    pub error: ErrorDetail,
}

#[derive(Serialize)]
pub struct ErrorDetail {
    pub message: String,
    pub code: Option<String>,
}

impl ErrorResponse {
    pub fn new(message: impl Into<String>) -> Self {
        Self {
            success: false,
            error: ErrorDetail {
                message: message.into(),
                code: None,
            },
        }
    }

    pub fn with_code(message: impl Into<String>, code: impl Into<String>) -> Self {
        Self {
            success: false,
            error: ErrorDetail {
                message: message.into(),
                code: Some(code.into()),
            },
        }
    }
}

/// Print JSON output to stdout
pub fn print_json<T: Serialize>(value: &T) {
    if let Ok(json) = serde_json::to_string_pretty(value) {
        println!("{}", json);
    }
}

/// Print a success message
pub fn print_success(message: &str) {
    println!("{}", message);
}

/// Print an error message
pub fn print_error(message: &str) {
    eprintln!("Error: {}", message);
}

/// Print a warning message
pub fn print_warning(message: &str) {
    eprintln!("Warning: {}", message);
}

/// Print a table header
pub fn print_table_header(columns: &[(&str, usize)]) {
    let header: Vec<String> = columns
        .iter()
        .map(|(name, width)| format!("{:width$}", name, width = width))
        .collect();
    println!("{}", header.join("  "));
    let separator: Vec<String> = columns
        .iter()
        .map(|(_, width)| "-".repeat(*width))
        .collect();
    println!("{}", separator.join("  "));
}

/// Print a table row
pub fn print_table_row(values: &[(&str, usize)]) {
    let row: Vec<String> = values
        .iter()
        .map(|(value, width)| {
            if value.len() > *width {
                format!("{}...", &value[..(width - 3)])
            } else {
                format!("{:width$}", value, width = width)
            }
        })
        .collect();
    println!("{}", row.join("  "));
}

/// Print a simple table with auto-calculated column widths
pub fn print_simple_table(headers: &[&str], rows: &[Vec<String>]) {
    // Calculate column widths
    let mut widths: Vec<usize> = headers.iter().map(|h| h.len()).collect();
    for row in rows {
        for (i, cell) in row.iter().enumerate() {
            if i < widths.len() {
                widths[i] = widths[i].max(cell.len());
            }
        }
    }

    // Print header
    let header_line: Vec<String> = headers
        .iter()
        .enumerate()
        .map(|(i, h)| format!("{:width$}", h, width = widths[i]))
        .collect();
    println!("{}", header_line.join("  "));

    // Print separator
    let separator: Vec<String> = widths.iter().map(|w| "-".repeat(*w)).collect();
    println!("{}", separator.join("  "));

    // Print rows
    for row in rows {
        let row_line: Vec<String> = row
            .iter()
            .enumerate()
            .map(|(i, cell)| {
                let width = widths.get(i).copied().unwrap_or(cell.len());
                format!("{:width$}", cell, width = width)
            })
            .collect();
        println!("{}", row_line.join("  "));
    }
}

/// Trait for types that can be displayed in a table
pub trait TableDisplay {
    /// Get the headers for the table
    fn headers() -> Vec<&'static str>;
    /// Get the row values for this item
    fn row(&self) -> Vec<String>;
}
