use std::{
    io::{Read, Write},
    net::{TcpListener, TcpStream},
    thread,
    time::{Duration, Instant},
};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Runtime};

const CALLBACK_PATH: &str = "/oauth";
const CALLBACK_TIMEOUT: Duration = Duration::from_secs(10 * 60);

#[derive(Debug, PartialEq, Eq)]
enum LocalOAuthCallbackEvent {
    Callback(String),
    Error(String),
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthCallbackServerInfo {
    redirect_uri: String,
    port: u16,
    expires_in_ms: u128,
}

fn query_keys(url: &tauri::Url) -> Vec<String> {
    url.query_pairs().map(|(key, _)| key.to_string()).collect()
}

fn local_oauth_callback_event_from_url(
    url: &tauri::Url,
    expected_state: &str,
) -> Result<LocalOAuthCallbackEvent, String> {
    eprintln!(
        "[OAuthLocalCallback] request path={} query_keys={:?}",
        url.path(),
        query_keys(url)
    );

    if url.path() != CALLBACK_PATH {
        return Err(format!("unexpected path: {}", url.path()));
    }

    let desktop_state = url
        .query_pairs()
        .find(|(key, _)| key == "desktop_state")
        .map(|(_, value)| value.to_string())
        .ok_or_else(|| "missing desktop_state".to_string())?;
    if desktop_state != expected_state {
        return Err("desktop_state mismatch".to_string());
    }

    if let Some(error) = url
        .query_pairs()
        .find(|(key, _)| key == "error")
        .map(|(_, value)| value.to_string())
    {
        eprintln!(
            "[OAuthLocalCallback] parsed oauth-error error_len={}",
            error.len()
        );
        return Ok(LocalOAuthCallbackEvent::Error(error));
    }

    let session = url
        .query_pairs()
        .find(|(key, _)| key == "session")
        .map(|(_, value)| value.to_string())
        .ok_or_else(|| "missing session/error".to_string())?;
    eprintln!(
        "[OAuthLocalCallback] parsed oauth-callback session_len={}",
        session.len()
    );
    Ok(LocalOAuthCallbackEvent::Callback(session))
}

fn parse_request_url(request: &str, port: u16) -> Result<tauri::Url, String> {
    let request_line = request
        .lines()
        .next()
        .ok_or_else(|| "missing request line".to_string())?;
    let mut parts = request_line.split_whitespace();
    let method = parts.next().ok_or_else(|| "missing method".to_string())?;
    let target = parts.next().ok_or_else(|| "missing target".to_string())?;

    if method != "GET" {
        return Err(format!("unsupported method: {}", method));
    }

    if target.starts_with("http://") || target.starts_with("https://") {
        tauri::Url::parse(target).map_err(|error| format!("invalid absolute URL: {}", error))
    } else {
        tauri::Url::parse(&format!("http://127.0.0.1:{}{}", port, target))
            .map_err(|error| format!("invalid request target: {}", error))
    }
}

fn write_http_response(stream: &mut TcpStream, status: &str, body: &str) -> std::io::Result<()> {
    let response = format!(
        "HTTP/1.1 {}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        status,
        body.as_bytes().len(),
        body
    );
    stream.write_all(response.as_bytes())
}

fn focus_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        eprintln!("[OAuthLocalCallback] focusing main window");
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    } else {
        eprintln!("[OAuthLocalCallback] main window not found while focusing");
    }
}

fn emit_local_oauth_event<R: Runtime>(app: &AppHandle<R>, event: LocalOAuthCallbackEvent) {
    match event {
        LocalOAuthCallbackEvent::Callback(session_b64) => {
            match app.emit("oauth-callback", session_b64) {
                Ok(()) => eprintln!("[OAuthLocalCallback] emitted oauth-callback"),
                Err(error) => eprintln!(
                    "[OAuthLocalCallback] failed to emit oauth-callback: {}",
                    error
                ),
            }
        }
        LocalOAuthCallbackEvent::Error(error) => match app.emit("oauth-error", error) {
            Ok(()) => eprintln!("[OAuthLocalCallback] emitted oauth-error"),
            Err(error) => eprintln!("[OAuthLocalCallback] failed to emit oauth-error: {}", error),
        },
    }

    focus_main_window(app);
}

fn handle_callback_stream<R: Runtime>(
    mut stream: TcpStream,
    app: &AppHandle<R>,
    expected_state: &str,
    port: u16,
) {
    let mut buffer = [0_u8; 65536];
    let bytes_read = match stream.read(&mut buffer) {
        Ok(bytes_read) => bytes_read,
        Err(error) => {
            eprintln!("[OAuthLocalCallback] failed to read request: {}", error);
            return;
        }
    };

    let request = String::from_utf8_lossy(&buffer[..bytes_read]);
    match parse_request_url(&request, port)
        .and_then(|url| local_oauth_callback_event_from_url(&url, expected_state))
    {
        Ok(event) => {
            emit_local_oauth_event(app, event);
            let _ = write_http_response(
                &mut stream,
                "200 OK",
                "<!doctype html><html><body><script>window.close()</script><p>Viben login complete. You can close this tab.</p></body></html>",
            );
        }
        Err(error) => {
            eprintln!("[OAuthLocalCallback] rejected callback: {}", error);
            let _ = write_http_response(
                &mut stream,
                "400 Bad Request",
                "<!doctype html><html><body><p>Viben login callback was rejected.</p></body></html>",
            );
        }
    }
}

#[tauri::command]
pub async fn start_oauth_callback_server<R: Runtime>(
    app: AppHandle<R>,
) -> Result<OAuthCallbackServerInfo, String> {
    let listener = TcpListener::bind("127.0.0.1:0")
        .map_err(|error| format!("Failed to bind local OAuth callback server: {}", error))?;
    listener
        .set_nonblocking(true)
        .map_err(|error| format!("Failed to configure local OAuth callback server: {}", error))?;

    let port = listener
        .local_addr()
        .map_err(|error| format!("Failed to read local OAuth callback address: {}", error))?
        .port();
    let desktop_state = uuid::Uuid::new_v4().to_string();
    let redirect_uri =
        format!("http://127.0.0.1:{port}{CALLBACK_PATH}?desktop_state={desktop_state}");
    let expires_at = Instant::now() + CALLBACK_TIMEOUT;
    let expires_at_ms = CALLBACK_TIMEOUT.as_millis();
    let app_handle = app.clone();
    let thread_state = desktop_state.clone();

    eprintln!(
        "[OAuthLocalCallback] listening port={} timeout_ms={}",
        port,
        CALLBACK_TIMEOUT.as_millis()
    );

    thread::spawn(move || loop {
        match listener.accept() {
            Ok((stream, address)) => {
                eprintln!("[OAuthLocalCallback] accepted request from {}", address);
                handle_callback_stream(stream, &app_handle, &thread_state, port);
                break;
            }
            Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                if Instant::now() >= expires_at {
                    eprintln!("[OAuthLocalCallback] listener timed out port={}", port);
                    break;
                }
                thread::sleep(Duration::from_millis(100));
            }
            Err(error) => {
                eprintln!("[OAuthLocalCallback] listener failed: {}", error);
                break;
            }
        }
    });

    Ok(OAuthCallbackServerInfo {
        redirect_uri,
        port,
        expires_in_ms: expires_at_ms,
    })
}

#[cfg(test)]
mod tests {
    use super::{local_oauth_callback_event_from_url, parse_request_url, LocalOAuthCallbackEvent};

    #[test]
    fn parses_local_oauth_callback() {
        let url = tauri::Url::parse(
            "http://127.0.0.1:49152/oauth?desktop_state=state-1&session=session-payload",
        )
        .unwrap();

        assert_eq!(
            local_oauth_callback_event_from_url(&url, "state-1"),
            Ok(LocalOAuthCallbackEvent::Callback(
                "session-payload".to_string()
            ))
        );
    }

    #[test]
    fn rejects_mismatched_state() {
        let url = tauri::Url::parse(
            "http://127.0.0.1:49152/oauth?desktop_state=wrong&session=session-payload",
        )
        .unwrap();

        assert_eq!(
            local_oauth_callback_event_from_url(&url, "state-1"),
            Err("desktop_state mismatch".to_string())
        );
    }

    #[test]
    fn parses_local_oauth_error() {
        let url =
            tauri::Url::parse("http://127.0.0.1:49152/oauth?desktop_state=state-1&error=denied")
                .unwrap();

        assert_eq!(
            local_oauth_callback_event_from_url(&url, "state-1"),
            Ok(LocalOAuthCallbackEvent::Error("denied".to_string()))
        );
    }

    #[test]
    fn parses_http_request_target() {
        let request = "GET /oauth?desktop_state=state-1&session=session-payload HTTP/1.1\r\n\r\n";
        let url = parse_request_url(request, 49152).unwrap();

        assert_eq!(
            url.as_str(),
            "http://127.0.0.1:49152/oauth?desktop_state=state-1&session=session-payload"
        );
    }
}
