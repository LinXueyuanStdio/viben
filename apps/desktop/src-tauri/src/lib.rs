mod commands;

use commands::mcp::McpProcessState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(McpProcessState::default())
        .invoke_handler(tauri::generate_handler![
            // Python commands
            commands::python::detect_python,
            commands::python::check_python_path,
            commands::python::check_browse_mcp_installed,
            commands::python::get_install_command,
            commands::python::get_uv_install_command,
            // MCP commands
            commands::mcp::start_mcp_server,
            commands::mcp::stop_mcp_server,
            commands::mcp::get_mcp_status,
            commands::mcp::test_mcp_connection,
            // Agent commands
            commands::agents::detect_agents,
            commands::agents::read_agent_config,
            commands::agents::write_agent_config,
            commands::agents::configure_browse_mcp,
            commands::agents::is_browse_mcp_configured,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
