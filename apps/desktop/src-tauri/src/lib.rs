mod commands;
pub mod utils;

#[cfg(desktop)]
use commands::gateway::GatewayState;

#[cfg(desktop)]
use commands::screenshot::ScreenshotStore;

#[cfg(desktop)]
use commands::wakeword::WakeWordState;

#[cfg(desktop)]
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};

#[cfg(desktop)]
use tauri_plugin_deep_link::DeepLinkExt;

#[cfg(desktop)]
#[derive(Debug, PartialEq, Eq)]
enum DesktopLinkEvent {
    OAuthCallback(String),
    OAuthError(String),
    DesktopDeepLink(String),
}

#[cfg(desktop)]
fn describe_desktop_link_event(event: &DesktopLinkEvent) -> String {
    match event {
        DesktopLinkEvent::OAuthCallback(session_b64) => {
            format!("oauth-callback session_len={}", session_b64.len())
        }
        DesktopLinkEvent::OAuthError(error) => {
            format!("oauth-error error_len={} error={}", error.len(), error)
        }
        DesktopLinkEvent::DesktopDeepLink(url) => {
            format!("desktop-deep-link url={}", url)
        }
    }
}

#[cfg(desktop)]
fn query_keys(url: &tauri::Url) -> Vec<String> {
    url.query_pairs().map(|(key, _)| key.to_string()).collect()
}

#[cfg(desktop)]
fn desktop_link_event_from_url(source: &str, url: &tauri::Url) -> Option<DesktopLinkEvent> {
    eprintln!(
        "[DesktopLink] source={} url={} scheme={} host={:?} query_keys={:?}",
        source,
        url,
        url.scheme(),
        url.host_str(),
        query_keys(url)
    );

    if url.scheme() != "viben" {
        eprintln!(
            "[DesktopLink] source={} ignored non-viben scheme: {}",
            source,
            url.scheme()
        );
        return None;
    }

    let is_oauth = url.host_str() == Some("oauth") || url.path() == "/oauth";
    if is_oauth {
        if let Some(error) = url
            .query_pairs()
            .find(|(key, _)| key == "error")
            .map(|(_, value)| value.to_string())
        {
            let event = DesktopLinkEvent::OAuthError(error);
            eprintln!(
                "[DesktopLink] source={} parsed {}",
                source,
                describe_desktop_link_event(&event)
            );
            return Some(event);
        }

        let event = url
            .query_pairs()
            .find(|(key, _)| key == "session")
            .map(|(_, value)| DesktopLinkEvent::OAuthCallback(value.to_string()));
        match &event {
            Some(event) => eprintln!(
                "[DesktopLink] source={} parsed {}",
                source,
                describe_desktop_link_event(event)
            ),
            None => eprintln!(
                "[DesktopLink] source={} oauth URL missing session/error",
                source
            ),
        }
        return event;
    }

    let event = DesktopLinkEvent::DesktopDeepLink(url.to_string());
    eprintln!(
        "[DesktopLink] source={} parsed {}",
        source,
        describe_desktop_link_event(&event)
    );
    Some(event)
}

#[cfg(desktop)]
fn desktop_link_events_from_args(argv: &[String]) -> Vec<DesktopLinkEvent> {
    eprintln!("[DesktopLink] single-instance argv_count={}", argv.len());
    argv.iter()
        .enumerate()
        .filter_map(|(index, arg)| match tauri::Url::parse(arg) {
            Ok(url) => Some((index, url)),
            Err(error) => {
                if arg.contains("viben://") {
                    eprintln!(
                        "[DesktopLink] single-instance arg_index={} failed to parse possible deep link: {}",
                        index,
                        error
                    );
                }
                None
            }
        })
        .filter_map(|(index, url)| {
            let source = format!("single-instance argv[{}]", index);
            desktop_link_event_from_url(&source, &url)
        })
        .collect()
}

#[cfg(target_os = "macos")]
#[allow(deprecated)]
use cocoa::appkit::{NSWindow, NSWindowCollectionBehavior};
#[cfg(target_os = "macos")]
#[allow(deprecated)]
use cocoa::base::id;
#[cfg(target_os = "macos")]
use objc::{msg_send, sel, sel_impl};

/// Auto-start gateway on app startup
#[cfg(desktop)]
async fn auto_start_gateway(state: &GatewayState, exe_dir: Option<std::path::PathBuf>) {
    // Check config for auto_start
    let config = state.config.read().await.clone();
    if !config.auto_start {
        eprintln!("[Gateway] Auto-start disabled");
        return;
    }

    let msg = format!("[Gateway] Auto-starting on port {}...", config.port);
    eprintln!("{}", msg);
    commands::gateway::write_gateway_log(&msg);

    // Use ensure_gateway_running. stderr is always captured to log file
    // regardless of verbose flag (see start_gateway_process).
    match commands::gateway::ensure_gateway_running(
        state,
        commands::gateway::StartGatewayOptions {
            exe_dir,
            verbose: false, // Console output stays quiet; stderr → log file always
            ..Default::default()
        },
    )
    .await
    {
        Ok(status) => {
            if status.pid.is_some() {
                let msg = format!("[Gateway] Started with PID {:?}", status.pid);
                eprintln!("{}", msg);
                commands::gateway::write_gateway_log(&msg);
            } else {
                let msg = format!("[Gateway] Already running on port {}", status.port);
                eprintln!("{}", msg);
                commands::gateway::write_gateway_log(&msg);
            }
        }
        Err(e) => {
            let msg = format!("[Gateway] Failed to start: {}", e);
            eprintln!("{}", msg);
            commands::gateway::write_gateway_log(&msg);
        }
    }
}

#[cfg(desktop)]
fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // Create menu items
    let show_item = MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    // Create menu
    let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

    // Get the default icon
    let icon = app
        .default_window_icon()
        .cloned()
        .expect("Failed to get default icon");

    // Build tray icon
    let _tray = TrayIconBuilder::with_id("main-tray")
        .icon(icon)
        .menu(&menu)
        .show_menu_on_left_click(false) // Left click shows main window, right click shows menu
        .tooltip("Viben")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
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

                // Show and focus main window on left click
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
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
            for event in desktop_link_events_from_args(&argv) {
                emit_desktop_link_event(app, event);
            }
            // Focus the main window when a new instance is attempted
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }));
    }

    builder = builder
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_store::Builder::new().build());

    #[cfg(desktop)]
    {
        builder = builder
            .plugin(
                tauri_plugin_window_state::Builder::new()
                    .with_denylist(&["screenshot-overlay", "pet-window", "chat-window"])
                    .build(),
            )
            .plugin(tauri_plugin_global_shortcut::Builder::new().build())
            .plugin(tauri_plugin_opener::init())
            .plugin(tauri_plugin_shell::init())
            .plugin(tauri_plugin_dialog::init())
            .plugin(tauri_plugin_fs::init())
            .plugin(tauri_plugin_deep_link::init())
            .plugin(tauri_plugin_screenshots::init());
    }

    #[cfg(mobile)]
    {
        builder = builder
            .plugin(tauri_plugin_barcode_scanner::init())
            .plugin(tauri_plugin_safe_area_insets_css::init());
    }

    // MCP Bridge plugin for AI debugging - only in desktop development builds
    #[cfg(all(desktop, debug_assertions))]
    {
        eprintln!("[MCP Bridge] Enabling MCP Bridge plugin for AI debugging");
        builder = builder.plugin(tauri_plugin_mcp_bridge::init());
    }

    #[cfg(desktop)]
    {
        builder = builder
            .manage(GatewayState::default())
            .manage(ScreenshotStore::default())
            .manage(WakeWordState::default())
            .invoke_handler(tauri::generate_handler![
                // Tray commands (native system tray)
                commands::tray::show_main_window,
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
                commands::gateway::restart_gateway_with_path,
                // OAuth commands (local callback bridge for desktop login)
                commands::oauth::start_oauth_callback_server,
                // CLI installer commands (CLI installation and version management)
                commands::cli_installer::check_bundled_cli,
                commands::cli_installer::check_viben_cli,
                commands::cli_installer::install_viben_cli,
                commands::cli_installer::resolve_npm_path,
                commands::cli_installer::install_node,
                commands::cli_installer::trigger_xcode_clt_install,
                commands::cli_installer::check_xcode_clt,
                // Node.js auto-install commands (参考 Qclaw)
                commands::cli_installer::prepare_mac_git_tools,
                commands::cli_installer::get_node_install_plan,
                commands::cli_installer::check_node_cli,
                commands::cli_installer::scan_node_installations,
                commands::cli_installer::check_node_at_path,
                commands::cli_installer::download_node_installer,
                commands::cli_installer::inspect_node_installer,
                commands::cli_installer::install_env,
                commands::cli_installer::refresh_environment,
                // Screenshot commands (native screen capture via tauri-plugin-screenshots)
                commands::screenshot::take_screenshot,
                commands::screenshot::take_screenshot_region,
                commands::screenshot::list_monitors,
                commands::screenshot::list_screenshot_windows,
                commands::screenshot::take_window_screenshot,
                commands::screenshot::start_region_screenshot,
                commands::screenshot::log_screenshot_trace,
                commands::screenshot::confirm_region_screenshot,
                commands::screenshot::close_screenshot_overlay,
                // Window commands (multi-window support)
                commands::window::open_workspace_in_new_window,
                commands::window::open_workspace_page_preview_window,
                commands::window::get_workspace_windows,
                commands::window::close_workspace_window,
                // Wake word commands (voice activation)
                commands::wakeword::start_wakeword,
                commands::wakeword::stop_wakeword,
                commands::wakeword::get_wakeword_status,
            ]);
    }

    builder
        .setup(|app| {
            #[cfg(desktop)]
            {
                setup_tray(app)?;

                // Auto-start gateway in background
                let gateway_state = app.state::<GatewayState>();
                let gateway_state_clone = GatewayState {
                    process: gateway_state.process.clone(),
                    config: gateway_state.config.clone(),
                };
                let exe_dir = std::env::current_exe().ok().and_then(|p| p.parent().map(|d| d.to_path_buf()));
                tauri::async_runtime::spawn(async move {
                    auto_start_gateway(&gateway_state_clone, exe_dir).await;
                });

                // On Windows, remove the native title bar so the custom tab bar
                // sits at the very top of the window.
                #[cfg(target_os = "windows")]
                if let Some(main_win) = app.get_webview_window("main") {
                    let _ = main_win.set_decorations(false);
                }

                // Configure pet-window on macOS
                // Note: focusable: false in tauri.conf.json should prevent focus stealing
                // We only set collection behavior here for proper workspace handling
                #[cfg(target_os = "macos")]
                #[allow(deprecated, unexpected_cfgs)]
                if let Some(pet_window) = app.get_webview_window("pet-window") {
                    if let Ok(ns_win_ptr) = pet_window.ns_window() {
                        let ns_window: id = ns_win_ptr as id;
                        unsafe {
                            // Set collection behavior for proper workspace handling
                            ns_window.setCollectionBehavior_(
                                NSWindowCollectionBehavior::NSWindowCollectionBehaviorCanJoinAllSpaces
                                    | NSWindowCollectionBehavior::NSWindowCollectionBehaviorStationary
                                    | NSWindowCollectionBehavior::NSWindowCollectionBehaviorIgnoresCycle
                                    | NSWindowCollectionBehavior::NSWindowCollectionBehaviorFullScreenAuxiliary,
                            );

                            // Make the window not hide when app deactivates
                            let _: () = msg_send![ns_window, setHidesOnDeactivate: false];
                        }
                    }
                }

                // Register deep link handler.
                // OAuth callback format: viben://oauth?session=<base64url-encoded-json>
                // Desktop navigation format: viben://workspace/... or viben://settings/...
                let app_handle = app.handle().clone();
                app.deep_link().on_open_url(move |event| {
                    let urls = event.urls();
                    eprintln!("[DesktopLink] deep-link on_open_url count={}", urls.len());
                    for (index, url) in urls.into_iter().enumerate() {
                        let source = format!("deep-link[{}]", index);
                        if let Some(link_event) = desktop_link_event_from_url(&source, &url) {
                            emit_desktop_link_event(&app_handle, link_event);
                        }
                    }
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(desktop)]
fn emit_desktop_link_event<R: tauri::Runtime>(app: &tauri::AppHandle<R>, event: DesktopLinkEvent) {
    eprintln!(
        "[DesktopLink] emitting {}",
        describe_desktop_link_event(&event)
    );
    match event {
        DesktopLinkEvent::OAuthCallback(session_b64) => {
            match app.emit("oauth-callback", session_b64) {
                Ok(()) => eprintln!("[DesktopLink] emitted oauth-callback"),
                Err(error) => eprintln!("[DesktopLink] failed to emit oauth-callback: {}", error),
            }
        }
        DesktopLinkEvent::OAuthError(error) => match app.emit("oauth-error", error) {
            Ok(()) => eprintln!("[DesktopLink] emitted oauth-error"),
            Err(error) => eprintln!("[DesktopLink] failed to emit oauth-error: {}", error),
        },
        DesktopLinkEvent::DesktopDeepLink(url) => match app.emit("desktop-deep-link", url) {
            Ok(()) => eprintln!("[DesktopLink] emitted desktop-deep-link"),
            Err(error) => eprintln!("[DesktopLink] failed to emit desktop-deep-link: {}", error),
        },
    }

    if let Some(window) = app.get_webview_window("main") {
        eprintln!("[DesktopLink] focusing main window");
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    } else {
        eprintln!("[DesktopLink] main window not found while focusing");
    }
}

#[cfg(all(test, desktop))]
mod tests {
    use super::{desktop_link_event_from_url, desktop_link_events_from_args, DesktopLinkEvent};

    #[test]
    fn parses_oauth_callback_url() {
        let url = tauri::Url::parse("viben://oauth?session=session-payload").unwrap();

        assert_eq!(
            desktop_link_event_from_url("test", &url),
            Some(DesktopLinkEvent::OAuthCallback(
                "session-payload".to_string()
            ))
        );
    }

    #[test]
    fn parses_oauth_error_before_session() {
        let url = tauri::Url::parse("viben://oauth?session=session-payload&error=denied").unwrap();

        assert_eq!(
            desktop_link_event_from_url("test", &url),
            Some(DesktopLinkEvent::OAuthError("denied".to_string()))
        );
    }

    #[test]
    fn extracts_oauth_callback_from_single_instance_args() {
        let argv = vec![
            "/Applications/Viben.app/Contents/MacOS/Viben".to_string(),
            "viben://oauth?session=session-payload".to_string(),
        ];

        assert_eq!(
            desktop_link_events_from_args(&argv),
            vec![DesktopLinkEvent::OAuthCallback(
                "session-payload".to_string()
            )]
        );
    }
}
