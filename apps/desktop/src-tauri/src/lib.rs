mod commands;

use commands::api_client::ApiClientState;
use commands::auth::AuthState;
use commands::logs::LogsState;
use commands::mcp::McpProcessState;
use commands::mcp_proxy::McpProxyState;
use commands::offline_cache::OfflineCacheState;
use commands::official_registry::OfficialRegistryState;
use commands::package_install::InstalledPackagesState;
use commands::usage::UsageState;
use commands::workspace_sync::WorkspaceSyncState;

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use tauri_plugin_deep_link::DeepLinkExt;

fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // Create menu items
    let show_item = MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;
    let start_all_item =
        MenuItem::with_id(app, "start_all", "Start All Servers", true, None::<&str>)?;
    let stop_all_item =
        MenuItem::with_id(app, "stop_all", "Stop All Servers", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    // Create menu
    let menu = Menu::with_items(
        app,
        &[&show_item, &start_all_item, &stop_all_item, &quit_item],
    )?;

    // Get the default icon
    let icon = app
        .default_window_icon()
        .cloned()
        .expect("Failed to get default icon");

    // Build tray icon
    let _tray = TrayIconBuilder::with_id("main-tray")
        .icon(icon)
        .menu(&menu)
        .show_menu_on_left_click(false) // Left click shows popup, not menu
        .tooltip("Browse MCP")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "start_all" => {
                // Emit event to frontend to start all servers
                let _ = app.emit("tray-start-all", ());
            }
            "stop_all" => {
                // Emit event to frontend to stop all servers
                let _ = app.emit("tray-stop-all", ());
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();

                // Toggle popup visibility
                if let Some(popup) = app.get_webview_window("tray-popup") {
                    if popup.is_visible().unwrap_or(false) {
                        let _ = popup.hide();
                    } else {
                        // Position popup near tray icon if possible
                        if let Ok(Some(rect)) = tray.rect() {
                            // On macOS, position below the menu bar
                            // Convert Position/Size enums to physical values
                            let (pos_x, pos_y) = match rect.position {
                                tauri::Position::Physical(p) => (p.x, p.y),
                                tauri::Position::Logical(l) => (l.x as i32, l.y as i32),
                            };
                            let height = match rect.size {
                                tauri::Size::Physical(s) => s.height as i32,
                                tauri::Size::Logical(s) => s.height as i32,
                            };
                            let x = pos_x.saturating_sub(150); // Center the 400px popup
                            let y = pos_y + height + 5;
                            let _ = popup.set_position(tauri::Position::Physical(
                                tauri::PhysicalPosition { x, y },
                            ));
                        }
                        let _ = popup.show();
                        let _ = popup.set_focus();
                    }
                }
            }
        })
        .build(app)?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            setup_tray(app)?;

            // Set up blur handler for popup window
            if let Some(popup) = app.get_webview_window("tray-popup") {
                let popup_clone = popup.clone();
                popup.on_window_event(move |event| {
                    if let tauri::WindowEvent::Focused(false) = event {
                        // Hide popup when it loses focus
                        let _ = popup_clone.hide();
                    }
                });
            }

            // Register deep link handler for OAuth callback
            // URL format: browsemcp://oauth?code=xxx
            let app_handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                let urls = event.urls();
                for url in urls {
                    if url.scheme() == "browsemcp" && url.host_str() == Some("oauth") {
                        // Extract code from query parameters
                        if let Some(code) = url.query_pairs().find(|(k, _)| k == "code").map(|(_, v)| v.to_string()) {
                            // Emit event to frontend with the OAuth code
                            let _ = app_handle.emit("oauth-callback", code);

                            // Focus main window
                            if let Some(window) = app_handle.get_webview_window("main") {
                                let _ = window.unminimize();
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                }
            });

            Ok(())
        })
        .manage(ApiClientState::default())
        .manage(AuthState::default())
        .manage(McpProcessState::default())
        .manage(McpProxyState::default())
        .manage(LogsState::default())
        .manage(UsageState::default())
        .manage(OfflineCacheState::default())
        .manage(InstalledPackagesState::default())
        .manage(WorkspaceSyncState::default())
        .manage(OfficialRegistryState::default())
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
            commands::mcp::check_mcp_server_on_port,
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
            // Tray commands
            commands::tray::update_tray_status,
            commands::tray::show_tray_popup,
            commands::tray::hide_tray_popup,
            commands::tray::show_main_window,
            commands::tray::get_tray_position,
            // MCP Proxy commands
            commands::mcp_proxy::start_mcp_proxy,
            commands::mcp_proxy::stop_mcp_proxy,
            commands::mcp_proxy::get_mcp_proxy_status,
            commands::mcp_proxy::check_mcp_proxy_installed,
            commands::mcp_proxy::install_mcp_proxy,
            commands::mcp_proxy::get_port_process,
            commands::mcp_proxy::kill_port_process,
            // Workspace management commands
            commands::workspace::list_workspaces,
            commands::workspace::add_workspace,
            commands::workspace::remove_workspace,
            commands::workspace::get_workspace,
            commands::workspace::set_active_workspace,
            commands::workspace::get_active_workspace_id,
            commands::workspace::update_workspace_accessed,
            commands::workspace::detect_workspace_agents,
            commands::workspace::get_workspace_mcp_servers,
            commands::workspace::add_workspace_mcp_server,
            commands::workspace::update_workspace_mcp_server,
            commands::workspace::delete_workspace_mcp_server,
            commands::workspace::get_workspace_skills,
            commands::workspace::add_workspace_skill,
            commands::workspace::delete_workspace_skill,
            commands::workspace::get_skill_readme,
            commands::workspace::list_skill_files,
            commands::workspace::read_skill_file,
commands::workspace::write_skill_file,
            commands::workspace::get_workspace_agent_configs,
            commands::workspace::read_agent_config_file,
            commands::workspace::get_workspace_commands,
            commands::workspace::read_command_file,
            // Store sync commands
            commands::store_sync::read_mcp_servers_file,
            commands::store_sync::write_mcp_servers_file,
            // Official registry commands
            commands::official_registry::list_official_servers,
            commands::official_registry::get_official_server,
            commands::official_registry::get_official_server_versions,
            commands::official_registry::clear_official_registry_cache,
            commands::official_registry::invalidate_official_server_cache,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
