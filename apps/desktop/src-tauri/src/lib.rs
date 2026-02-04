mod commands;

use commands::api_client::ApiClientState;
use commands::auth::AuthState;
use commands::logs::LogsState;
use commands::mcp::McpProcessState;
use commands::offline_cache::OfflineCacheState;
use commands::package_install::InstalledPackagesState;
use commands::usage::UsageState;
use commands::workspace_sync::WorkspaceSyncState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(ApiClientState::default())
        .manage(AuthState::default())
        .manage(McpProcessState::default())
        .manage(LogsState::default())
        .manage(UsageState::default())
        .manage(OfflineCacheState::default())
        .manage(InstalledPackagesState::default())
        .manage(WorkspaceSyncState::default())
        .invoke_handler(tauri::generate_handler![
            // API Client commands
            commands::api_client::api_request,
            commands::api_client::get_api_base_url,
            commands::api_client::set_api_base_url,
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
            // Cloud MCP commands
            commands::cloud_mcp::list_cloud_mcp_packages,
            commands::cloud_mcp::search_cloud_mcp_packages,
            commands::cloud_mcp::get_cloud_mcp_package,
            commands::cloud_mcp::get_cloud_mcp_categories,
            // Cloud Skills commands
            commands::cloud_skills::list_cloud_skill_packages,
            commands::cloud_skills::search_cloud_skill_packages,
            commands::cloud_skills::get_cloud_skill_package,
            commands::cloud_skills::get_cloud_skill_categories,
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
            // Auth commands
            commands::auth::login_with_credentials,
            commands::auth::login_with_github,
            commands::auth::handle_oauth_callback,
            commands::auth::logout,
            commands::auth::get_current_user,
            commands::auth::refresh_session,
            // Offline cache commands
            commands::offline_cache::get_cache_info,
            commands::offline_cache::refresh_cache,
            commands::offline_cache::clear_cache,
            commands::offline_cache::get_cached_mcp_packages,
            commands::offline_cache::get_cached_mcp_categories,
            commands::offline_cache::get_cached_skill_packages,
            commands::offline_cache::get_cached_skill_categories,
            commands::offline_cache::set_cache_settings,
            commands::offline_cache::get_cache_settings,
            commands::offline_cache::is_offline,
            commands::offline_cache::should_refresh_cache,
            // Package installation commands
            commands::package_install::install_cloud_mcp_package,
            commands::package_install::install_cloud_skill_package,
            commands::package_install::uninstall_package,
            commands::package_install::get_installed_packages,
            commands::package_install::update_package,
            commands::package_install::is_package_installed,
            commands::package_install::get_installed_package,
            // Workspace sync commands
            commands::workspace_sync::list_cloud_workspaces,
            commands::workspace_sync::get_cloud_workspace,
            commands::workspace_sync::sync_workspace,
            commands::workspace_sync::push_local_config,
            commands::workspace_sync::get_sync_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
