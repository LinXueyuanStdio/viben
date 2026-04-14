mod commands;

use commands::gateway::GatewayState;

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use tauri_plugin_deep_link::DeepLinkExt;

/// Auto-start gateway on app startup
async fn auto_start_gateway(state: &GatewayState) {
    // Check config for auto_start
    let config = state.config.read().await.clone();
    if !config.auto_start {
        eprintln!("[Gateway] Auto-start disabled");
        return;
    }

    eprintln!("[Gateway] Auto-starting on port {}...", config.port);

    // Try to ping existing gateway first
    let url = format!("http://{}:{}/health", config.host, config.port);
    if let Ok(resp) = reqwest::Client::new()
        .get(&url)
        .timeout(std::time::Duration::from_secs(2))
        .send()
        .await
    {
        if resp.status().is_success() {
            eprintln!("[Gateway] Already running on port {}", config.port);
            return;
        }
    }

    // Find gateway binary or CLI command
    // First try viben CLI
    let viben_paths = [
        dirs::home_dir().map(|h| h.join(".npm-global/bin/viben")),
        Some(std::path::PathBuf::from("/opt/homebrew/bin/viben")),
        Some(std::path::PathBuf::from("/usr/local/bin/viben")),
    ];

    let viben_path = viben_paths.into_iter().flatten().find(|p| p.exists());

    // Build the command using viben CLI
    let cmd_result = if let Some(viben) = viben_path {
        eprintln!("[Gateway] Using viben CLI: {:?}", viben);
        let mut cmd = tokio::process::Command::new(&viben);
        cmd.arg("gateway")
            .arg("--port")
            .arg(config.port.to_string())
            .arg("--host")
            .arg(&config.host)
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .kill_on_drop(true);
        cmd.spawn()
    } else {
        eprintln!("[Gateway] viben CLI not found, skipping auto-start");
        return;
    };

    // Start the gateway
    match cmd_result {
        Ok(child) => {
            let pid = child.id().unwrap_or(0);
            eprintln!("[Gateway] Started with PID {}", pid);

            // Store in state
            *state.process.write().await = Some(commands::gateway::GatewayProcess {
                child,
                pid,
                port: config.port,
            });
        }
        Err(e) => {
            eprintln!("[Gateway] Failed to start: {}", e);
        }
    }
}

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
        .tooltip("Viben")
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
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default();

    // Single instance plugin MUST be registered first (before deep-link)
    // This ensures OAuth callbacks go to the existing instance instead of spawning a new one
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            // Log for debugging - deep link URLs arrive here on subsequent launches
            eprintln!("[SingleInstance] New instance opened with args: {:?}", argv);
            // Focus the main window when a new instance is attempted
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }));
    }

    builder = builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_window_state::Builder::new().build());

    // MCP plugin for AI debugging - only in development builds
    #[cfg(debug_assertions)]
    {
        eprintln!("[MCP] Enabling MCP plugin for AI debugging");
        builder = builder.plugin(
            tauri_plugin_mcp::init_with_config(
                tauri_plugin_mcp::PluginConfig::new("viben-desktop".to_string())
                    .start_socket_server(true)
                    .socket_path(std::path::PathBuf::from("/tmp/viben-mcp.sock")),
            ),
        );
    }

    builder.setup(|app| {
            setup_tray(app)?;

            // Auto-start gateway in background
            let gateway_state = app.state::<GatewayState>();
            let gateway_state_clone = GatewayState {
                process: gateway_state.process.clone(),
                config: gateway_state.config.clone(),
            };
            tauri::async_runtime::spawn(async move {
                auto_start_gateway(&gateway_state_clone).await;
            });

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
            // URL format: viben://oauth?session=<base64url-encoded-json>
            let app_handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                let urls = event.urls();
                for url in urls {
                    if url.scheme() == "viben" && url.host_str() == Some("oauth") {
                        // Check for error first
                        if let Some(error) = url.query_pairs().find(|(k, _)| k == "error").map(|(_, v)| v.to_string()) {
                            // Emit error event to frontend
                            let _ = app_handle.emit("oauth-error", error);

                            // Focus main window
                            if let Some(window) = app_handle.get_webview_window("main") {
                                let _ = window.unminimize();
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                            continue;
                        }

                        // Extract session from query parameters (base64url encoded JSON)
                        if let Some(session_b64) = url.query_pairs().find(|(k, _)| k == "session").map(|(_, v)| v.to_string()) {
                            // Emit event to frontend with the session data
                            let _ = app_handle.emit("oauth-callback", session_b64);

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
        .manage(GatewayState::default())
        .invoke_handler(tauri::generate_handler![
            // Tray commands (native system tray)
            commands::tray::update_tray_status,
            commands::tray::show_tray_popup,
            commands::tray::hide_tray_popup,
            commands::tray::show_main_window,
            commands::tray::get_tray_position,
            // Gateway commands (process management)
            commands::gateway::start_gateway,
            commands::gateway::stop_gateway,
            commands::gateway::get_gateway_status,
            commands::gateway::restart_gateway,
            commands::gateway::get_gateway_config,
            commands::gateway::set_gateway_config,
            commands::gateway::check_gateway_binary,
            commands::gateway::discover_gateway,
            commands::gateway::get_bundled_viben_path,
            commands::gateway::start_gateway_with_path,
            // CLI installer commands (CLI installation and version management)
            commands::cli_installer::check_viben_cli,
            commands::cli_installer::install_viben_cli,
            commands::cli_installer::check_node,
            commands::cli_installer::check_node_installation,
            commands::cli_installer::install_node,
            commands::cli_installer::trigger_xcode_clt_install,
            commands::cli_installer::check_xcode_clt,
            // Node.js auto-install commands (参考 Qclaw)
            commands::cli_installer::prepare_mac_git_tools,
            commands::cli_installer::get_node_install_plan,
            commands::cli_installer::check_node_enhanced,
            commands::cli_installer::download_node_installer,
            commands::cli_installer::inspect_node_installer,
            commands::cli_installer::install_env,
            commands::cli_installer::refresh_environment,
            // Screenshot commands (native screen capture)
            commands::screenshot::take_screenshot,
            commands::screenshot::take_screenshot_region,
            // Window commands (multi-window support)
            commands::window::open_workspace_in_new_window,
            commands::window::get_workspace_windows,
            commands::window::close_workspace_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
