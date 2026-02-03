mod commands;

use commands::logs::LogsState;
use commands::mcp::McpProcessState;
use commands::usage::UsageState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(McpProcessState::default())
        .manage(LogsState::default())
        .manage(UsageState::default())
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
            commands::mcp::is_process_alive,
            commands::mcp::check_port_status,
            commands::mcp::kill_process,
            // Agent commands
            commands::agents::detect_agents,
            commands::agents::read_agent_config,
            commands::agents::write_agent_config,
            commands::agents::configure_browse_mcp,
            commands::agents::is_browse_mcp_configured,
            // Logs commands
            commands::logs::init_logs,
            commands::logs::add_log,
            commands::logs::get_logs,
            commands::logs::clear_logs,
            commands::logs::export_logs,
            commands::logs::get_log_file_path_cmd,
            commands::logs::start_log_session,
            commands::logs::update_session_pid,
            commands::logs::end_log_session,
            commands::logs::get_log_sessions,
            commands::logs::get_session_logs,
            commands::logs::clear_session_logs,
            commands::logs::cleanup_old_sessions,
            commands::logs::export_session_logs,
            commands::logs::get_logs_dir_path,
            // API Keys commands (provider keys)
            commands::api_keys::get_api_key_providers,
            commands::api_keys::set_api_key,
            commands::api_keys::get_api_key,
            commands::api_keys::delete_api_key,
            commands::api_keys::get_all_api_keys,
            commands::api_keys::validate_api_key,
            // Service API Keys commands
            commands::service_keys::get_service_keys,
            commands::service_keys::create_service_key,
            commands::service_keys::delete_service_key,
            commands::service_keys::validate_service_key,
            commands::service_keys::update_service_key_usage,
            commands::service_keys::get_service_key_by_id,
            // Usage tracking commands
            commands::usage::init_usage,
            commands::usage::record_usage,
            commands::usage::get_usage_stats,
            commands::usage::get_api_key_usage,
            commands::usage::get_server_usage,
            commands::usage::get_source_usage,
            // Marketplace commands
            commands::marketplace::get_provider_index,
            commands::marketplace::get_flat_sources,
            commands::marketplace::clear_provider_cache,
            // Installed sources commands (via browse-mcp-cli)
            commands::marketplace::get_installed_sources,
            commands::marketplace::show_installed_provider,
            commands::marketplace::install_provider,
            // API Logs commands
            commands::api_logs::get_api_log_sessions,
            commands::api_logs::get_api_logs,
            commands::api_logs::get_api_log_summary,
            commands::api_logs::clear_api_logs,
            commands::api_logs::get_api_logs_dir_path,
            commands::api_logs::open_api_logs_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
