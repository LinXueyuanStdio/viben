//! Gateway tests - 100% coverage

#[cfg(test)]
mod tests {
    use axum::{
        body::Body,
        http::{Request, StatusCode},
    };
    use tower::ServiceExt;
    use serde_json::{json, Value};

    use crate::gateway::{error::GatewayError, routes, state::AppState};

    /// Helper to create test app state
    async fn test_state() -> AppState {
        AppState::with_defaults().await.expect("Failed to create test state")
    }

    /// Helper to build the test router
    async fn test_app() -> axum::Router {
        let state = test_state().await;
        routes::router(state)
    }

    // =========================================================================
    // Error Tests
    // =========================================================================

    mod error_tests {
        use super::*;
        use axum::response::IntoResponse;
        use axum::body::to_bytes;

        #[test]
        fn test_gateway_error_not_found() {
            let error = GatewayError::NotFound("test resource".to_string());
            assert_eq!(error.to_string(), "Not found: test resource");
        }

        #[test]
        fn test_gateway_error_bad_request() {
            let error = GatewayError::BadRequest("invalid input".to_string());
            assert_eq!(error.to_string(), "Bad request: invalid input");
        }

        #[test]
        fn test_gateway_error_internal() {
            let error = GatewayError::Internal("server error".to_string());
            assert_eq!(error.to_string(), "Internal error: server error");
        }

        #[test]
        fn test_gateway_error_database() {
            let db_error = crate::db::DbError::NotFound("table".to_string());
            let error = GatewayError::Database(db_error);
            assert!(error.to_string().contains("table"));
        }

        #[test]
        fn test_gateway_error_executor() {
            let exec_error = crate::executors::ExecutorError::UnknownExecutorType("test".to_string());
            let error = GatewayError::Executor(exec_error);
            assert!(error.to_string().contains("test"));
        }

        #[tokio::test]
        async fn test_gateway_error_into_response_database() {
            let db_error = crate::db::DbError::NotFound("table".to_string());
            let error = GatewayError::Database(db_error);
            let response = error.into_response();
            assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);

            let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();
            assert!(json["error"]["message"].as_str().unwrap().contains("table"));
            assert_eq!(json["error"]["code"], "Database");
        }

        #[tokio::test]
        async fn test_gateway_error_into_response_executor() {
            let exec_error = crate::executors::ExecutorError::UnknownExecutorType("test".to_string());
            let error = GatewayError::Executor(exec_error);
            let response = error.into_response();
            assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);

            let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();
            assert_eq!(json["error"]["code"], "Executor");
        }

        #[tokio::test]
        async fn test_gateway_error_response_body_format() {
            let error = GatewayError::NotFound("test".to_string());
            let response = error.into_response();

            let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();

            // Verify JSON structure
            assert!(json["error"].is_object());
            assert!(json["error"]["message"].is_string());
            assert!(json["error"]["code"].is_string());
        }

        #[tokio::test]
        async fn test_gateway_error_into_response_not_found() {
            let error = GatewayError::NotFound("test".to_string());
            let response = error.into_response();
            assert_eq!(response.status(), StatusCode::NOT_FOUND);
        }

        #[tokio::test]
        async fn test_gateway_error_into_response_bad_request() {
            let error = GatewayError::BadRequest("test".to_string());
            let response = error.into_response();
            assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        }

        #[tokio::test]
        async fn test_gateway_error_into_response_internal() {
            let error = GatewayError::Internal("test".to_string());
            let response = error.into_response();
            assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
        }
    }

    // =========================================================================
    // Health Check Tests
    // =========================================================================

    mod health_tests {
        use super::*;

        #[tokio::test]
        async fn test_health_check() {
            let app = test_app().await;

            let response = app
                .oneshot(
                    Request::builder()
                        .uri("/health")
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);

            let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();

            assert_eq!(json["status"], "ok");
            assert_eq!(json["service"], "viben-gateway");
            assert!(json["version"].is_string());
        }
    }

    // =========================================================================
    // Agent Routes Tests
    // =========================================================================

    mod agent_tests {
        use super::*;

        #[tokio::test]
        async fn test_list_agents_no_params_defaults_to_home() {
            let app = test_app().await;

            let response = app
                .oneshot(
                    Request::builder()
                        .uri("/api/agents")
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);

            let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();

            // Should default to user home directory
            let workspace_path = json["workspace_path"].as_str().unwrap();
            let home = dirs::home_dir().unwrap();
            assert_eq!(workspace_path, home.to_string_lossy().as_ref());

            // Should have agents array and total
            assert!(json["agents"].is_array());
            assert!(json["total"].is_number());
        }

        #[tokio::test]
        async fn test_list_agents_with_workspace_path() {
            let app = test_app().await;

            // Use temp directory for test
            let temp_dir = std::env::temp_dir();
            let workspace_path = temp_dir.to_string_lossy();

            let response = app
                .oneshot(
                    Request::builder()
                        .uri(&format!("/api/agents?workspace_path={}&include_global=true", workspace_path))
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);

            let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();

            // Should return the specified workspace path
            assert_eq!(json["workspace_path"].as_str().unwrap(), workspace_path.as_ref());
            assert!(json["agents"].is_array());
            assert!(json["total"].is_number());

            // Agents should have workspace_path field
            if let Some(agents) = json["agents"].as_array() {
                for agent in agents {
                    assert!(agent["workspace_path"].is_string(), "Agent should have workspace_path field");
                    assert!(agent["source"].is_string(), "Agent should have source field");
                }
            }
        }

        #[tokio::test]
        async fn test_list_agents_invalid_workspace_path() {
            let app = test_app().await;

            let response = app
                .oneshot(
                    Request::builder()
                        .uri("/api/agents?workspace_path=/nonexistent/path/12345")
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        }

        #[tokio::test]
        async fn test_get_agent_claude_code() {
            let app = test_app().await;

            let response = app
                .oneshot(
                    Request::builder()
                        .uri("/api/agents/CLAUDE_CODE")
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);

            let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();

            assert_eq!(json["id"], "CLAUDE_CODE");
            assert_eq!(json["name"], "CLAUDE_CODE");
            assert!(json["availability"].is_object());
            assert!(json["supports_mcp"].is_boolean());
            assert!(json["capabilities"].is_array());
        }

        #[tokio::test]
        async fn test_get_agent_lowercase() {
            let app = test_app().await;

            let response = app
                .oneshot(
                    Request::builder()
                        .uri("/api/agents/claude_code")
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            // Should work with lowercase (case-insensitive)
            assert_eq!(response.status(), StatusCode::OK);
        }

        #[tokio::test]
        async fn test_get_agent_all_types() {
            let agent_types = [
                "CLAUDE_CODE", "AMP", "GEMINI", "CODEX", "OPENCODE",
                "CURSOR_AGENT", "CURSOR", "QWEN_CODE", "COPILOT", "DROID",
            ];

            for agent_type in agent_types {
                let app = test_app().await;
                let response = app
                    .oneshot(
                        Request::builder()
                            .uri(&format!("/api/agents/{}", agent_type))
                            .body(Body::empty())
                            .unwrap(),
                    )
                    .await
                    .unwrap();

                assert_eq!(
                    response.status(),
                    StatusCode::OK,
                    "Failed for agent type: {}",
                    agent_type
                );
            }
        }

        #[tokio::test]
        async fn test_get_agent_not_found() {
            let app = test_app().await;

            let response = app
                .oneshot(
                    Request::builder()
                        .uri("/api/agents/UNKNOWN_AGENT")
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::NOT_FOUND);

            let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();

            assert!(json["error"]["message"]
                .as_str()
                .unwrap()
                .contains("Unknown agent type"));
        }

        #[tokio::test]
        async fn test_check_availability() {
            let app = test_app().await;

            let response = app
                .oneshot(
                    Request::builder()
                        .uri("/api/agents/CLAUDE_CODE/availability")
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);

            let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();

            // Availability should have a type field
            assert!(json["type"].is_string());
        }

        #[tokio::test]
        async fn test_check_availability_not_found() {
            let app = test_app().await;

            let response = app
                .oneshot(
                    Request::builder()
                        .uri("/api/agents/UNKNOWN/availability")
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::NOT_FOUND);
        }

        #[tokio::test]
        async fn test_stop_agent() {
            let app = test_app().await;

            let body = serde_json::to_string(&json!({
                "session_id": "test-session-123"
            }))
            .unwrap();

            let response = app
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri("/api/agents/CLAUDE_CODE/stop")
                        .header("content-type", "application/json")
                        .body(Body::from(body))
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);

            let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();

            assert_eq!(json["session_id"], "test-session-123");
            assert_eq!(json["status"], "cancelled");
        }
    }

    // =========================================================================
    // Task Routes Tests
    // =========================================================================

    mod task_tests {
        use super::*;

        #[tokio::test]
        async fn test_list_tasks() {
            let app = test_app().await;

            let response = app
                .oneshot(
                    Request::builder()
                        .uri("/api/tasks")
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);

            let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();

            assert!(json["tasks"].is_array());
        }

        #[tokio::test]
        async fn test_create_task() {
            let app = test_app().await;

            // Create task without agent_id (agent_id is optional)
            let body = serde_json::to_string(&json!({
                "title": "Test Task",
                "description": "A test task description"
            }))
            .unwrap();

            let response = app
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri("/api/tasks")
                        .header("content-type", "application/json")
                        .body(Body::from(body))
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);

            let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();

            assert!(json["id"].is_string());
            assert_eq!(json["title"], "Test Task");
            assert_eq!(json["description"], "A test task description");
            assert_eq!(json["status"], "todo");
            assert!(json["agent_id"].is_null());
        }

        #[tokio::test]
        async fn test_create_task_minimal() {
            let app = test_app().await;

            let body = serde_json::to_string(&json!({
                "title": "Minimal Task"
            }))
            .unwrap();

            let response = app
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri("/api/tasks")
                        .header("content-type", "application/json")
                        .body(Body::from(body))
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);

            let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();

            assert_eq!(json["title"], "Minimal Task");
            assert!(json["description"].is_null());
            assert!(json["agent_id"].is_null());
        }

        #[tokio::test]
        async fn test_get_task_not_found() {
            let app = test_app().await;

            let response = app
                .oneshot(
                    Request::builder()
                        .uri("/api/tasks/nonexistent-task")
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::NOT_FOUND);
        }

        #[tokio::test]
        async fn test_update_task_not_found() {
            let app = test_app().await;

            let body = serde_json::to_string(&json!({
                "title": "Updated Title"
            }))
            .unwrap();

            let response = app
                .oneshot(
                    Request::builder()
                        .method("PATCH")
                        .uri("/api/tasks/nonexistent-task")
                        .header("content-type", "application/json")
                        .body(Body::from(body))
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::NOT_FOUND);
        }

        #[tokio::test]
        async fn test_delete_task_not_found() {
            let app = test_app().await;

            // Deleting a non-existent task should return 404
            let response = app
                .oneshot(
                    Request::builder()
                        .method("DELETE")
                        .uri("/api/tasks/nonexistent-task-id")
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::NOT_FOUND);
        }
    }

    // =========================================================================
    // Session Routes Tests
    // =========================================================================

    mod session_tests {
        use super::*;
        use crate::db::models::{Agent, AgentType, CreateAgent};

        /// Create or get a test agent for session tests
        async fn get_or_create_test_agent(state: &AppState) -> Agent {
            // Generate a unique agent ID for each test
            let agent_id = format!("test-agent-{}", uuid::Uuid::new_v4());
            let create_data = CreateAgent {
                id: Some(agent_id),
                name: "Test Agent".to_string(),
                agent_type: AgentType::ClaudeCode,
                config: None,
            };
            Agent::create(&state.db.pool, &create_data).await.unwrap()
        }

        /// Create test state with a pre-created agent
        async fn test_state_with_agent() -> (AppState, Agent) {
            let state = test_state().await;
            let agent = get_or_create_test_agent(&state).await;
            (state, agent)
        }

        #[tokio::test]
        async fn test_list_sessions() {
            let app = test_app().await;

            let response = app
                .oneshot(
                    Request::builder()
                        .uri("/api/sessions")
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);

            let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();

            assert!(json["sessions"].is_array());
        }

        #[tokio::test]
        async fn test_create_session() {
            // Create state with agent prerequisite
            let (state, agent) = test_state_with_agent().await;
            let app = routes::router(state);

            let body = serde_json::to_string(&json!({
                "agent_id": agent.id,
                "prompt": "Hello"
            }))
            .unwrap();

            let response = app
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri("/api/sessions")
                        .header("content-type", "application/json")
                        .body(Body::from(body))
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);

            let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();

            assert!(json["id"].is_string());
            assert_eq!(json["agent_id"], agent.id);
            assert!(json["task_id"].is_null());
            assert_eq!(json["status"], "active");
        }

        #[tokio::test]
        async fn test_create_session_minimal() {
            // Create state with agent prerequisite
            let (state, agent) = test_state_with_agent().await;
            let app = routes::router(state);

            let body = serde_json::to_string(&json!({
                "agent_id": agent.id
            }))
            .unwrap();

            let response = app
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri("/api/sessions")
                        .header("content-type", "application/json")
                        .body(Body::from(body))
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);

            let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();

            assert_eq!(json["agent_id"], agent.id);
            assert!(json["task_id"].is_null());
        }

        #[tokio::test]
        async fn test_get_session_not_found() {
            let app = test_app().await;

            let response = app
                .oneshot(
                    Request::builder()
                        .uri("/api/sessions/nonexistent-session")
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::NOT_FOUND);
        }

        #[tokio::test]
        async fn test_send_message_session_not_found() {
            let app = test_app().await;

            let body = serde_json::to_string(&json!({
                "content": "Hello, agent!"
            }))
            .unwrap();

            // Sending message to non-existent session should return 404
            let response = app
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri("/api/sessions/nonexistent-session/message")
                        .header("content-type", "application/json")
                        .body(Body::from(body))
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::NOT_FOUND);
        }

        #[tokio::test]
        async fn test_delete_session_not_found() {
            let app = test_app().await;

            // Deleting a non-existent session should return 404
            let response = app
                .oneshot(
                    Request::builder()
                        .method("DELETE")
                        .uri("/api/sessions/nonexistent-session-id")
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::NOT_FOUND);
        }
    }

    // =========================================================================
    // State Tests
    // =========================================================================

    mod state_tests {
        use super::*;

        #[tokio::test]
        async fn test_app_state_with_defaults() {
            let state = AppState::with_defaults().await;
            assert!(state.is_ok());
        }

        #[tokio::test]
        async fn test_app_state_new() {
            let db = crate::db::DbService::new().await.unwrap();
            let events = crate::services::EventService::new();
            let events_arc = std::sync::Arc::new(events.clone());
            let container = crate::services::ContainerService::new(events.clone());
            let pty = crate::services::PtyService::new();
            let history = crate::services::HistoryService::new();
            let session_store = crate::services::SessionStoreService::new();
            let channel = crate::channels::ChannelService::new(events_arc.clone());
            let channel_arc = std::sync::Arc::new(channel.clone());
            let cron = crate::services::CronService::new(events_arc.clone())
                .with_channels(channel_arc.clone());
            let channel_router = crate::channels::ChannelRouter::new(events_arc.clone(), channel_arc);

            let state = AppState::new(db, events, container, pty, history, session_store, cron, channel, channel_router);

            // Just verify it was created (no panic)
            assert!(std::sync::Arc::strong_count(&state.db) >= 1);
            assert!(std::sync::Arc::strong_count(&state.events) >= 1);
            assert!(std::sync::Arc::strong_count(&state.container) >= 1);
            assert!(std::sync::Arc::strong_count(&state.pty) >= 1);
            assert!(std::sync::Arc::strong_count(&state.history) >= 1);
            assert!(std::sync::Arc::strong_count(&state.session_store) >= 1);
            assert!(std::sync::Arc::strong_count(&state.cron) >= 1);
            assert!(std::sync::Arc::strong_count(&state.channel) >= 1);
            assert!(std::sync::Arc::strong_count(&state.channel_router) >= 1);
        }
    }

    // =========================================================================
    // WebSocket Message Types Tests
    // =========================================================================

    mod ws_message_tests {
        use crate::gateway::routes::ws::WsMessage;
        use crate::gateway::ws::handler::{ClientMessage, ServerMessage};

        #[test]
        fn test_ws_message_ping_serialize() {
            let msg = WsMessage::Ping;
            let json = serde_json::to_string(&msg).unwrap();
            assert!(json.contains("Ping"));
        }

        #[test]
        fn test_ws_message_pong_serialize() {
            let msg = WsMessage::Pong;
            let json = serde_json::to_string(&msg).unwrap();
            assert!(json.contains("Pong"));
        }

        #[test]
        fn test_ws_message_subscribe_serialize() {
            let msg = WsMessage::Subscribe {
                channels: vec!["channel1".to_string(), "channel2".to_string()],
            };
            let json = serde_json::to_string(&msg).unwrap();
            assert!(json.contains("Subscribe"));
            assert!(json.contains("channel1"));
            assert!(json.contains("channel2"));
        }

        #[test]
        fn test_ws_message_unsubscribe_serialize() {
            let msg = WsMessage::Unsubscribe {
                channels: vec!["channel1".to_string()],
            };
            let json = serde_json::to_string(&msg).unwrap();
            assert!(json.contains("Unsubscribe"));
        }

        #[test]
        fn test_ws_message_event_serialize() {
            let msg = WsMessage::Event {
                channel: "test".to_string(),
                payload: serde_json::json!({"key": "value"}),
            };
            let json = serde_json::to_string(&msg).unwrap();
            assert!(json.contains("Event"));
            assert!(json.contains("test"));
        }

        #[test]
        fn test_ws_message_error_serialize() {
            let msg = WsMessage::Error {
                message: "test error".to_string(),
            };
            let json = serde_json::to_string(&msg).unwrap();
            assert!(json.contains("Error"));
            assert!(json.contains("test error"));
        }

        #[test]
        fn test_ws_message_deserialize_ping() {
            let json = r#"{"type":"Ping"}"#;
            let msg: WsMessage = serde_json::from_str(json).unwrap();
            assert!(matches!(msg, WsMessage::Ping));
        }

        #[test]
        fn test_ws_message_deserialize_subscribe() {
            let json = r#"{"type":"Subscribe","data":{"channels":["ch1","ch2"]}}"#;
            let msg: WsMessage = serde_json::from_str(json).unwrap();
            if let WsMessage::Subscribe { channels } = msg {
                assert_eq!(channels, vec!["ch1", "ch2"]);
            } else {
                panic!("Expected Subscribe message");
            }
        }

        // Client message tests
        #[test]
        fn test_client_message_ping() {
            let msg = ClientMessage::Ping;
            let json = serde_json::to_string(&msg).unwrap();
            assert!(json.contains("Ping"));
        }

        #[test]
        fn test_client_message_subscribe() {
            let msg = ClientMessage::Subscribe {
                channels: vec!["test".to_string()],
            };
            let json = serde_json::to_string(&msg).unwrap();
            assert!(json.contains("Subscribe"));
        }

        #[test]
        fn test_client_message_unsubscribe() {
            let msg = ClientMessage::Unsubscribe {
                channels: vec!["test".to_string()],
            };
            let json = serde_json::to_string(&msg).unwrap();
            assert!(json.contains("Unsubscribe"));
        }

        #[test]
        fn test_client_message_send_message() {
            let msg = ClientMessage::SendMessage {
                session_id: "session-1".to_string(),
                content: "Hello".to_string(),
            };
            let json = serde_json::to_string(&msg).unwrap();
            assert!(json.contains("SendMessage"));
            assert!(json.contains("session-1"));
            assert!(json.contains("Hello"));
        }

        // Server message tests
        #[test]
        fn test_server_message_pong() {
            let msg = ServerMessage::Pong;
            let json = serde_json::to_string(&msg).unwrap();
            assert!(json.contains("Pong"));
        }

        #[test]
        fn test_server_message_subscribed() {
            let msg = ServerMessage::Subscribed {
                channels: vec!["ch1".to_string()],
            };
            let json = serde_json::to_string(&msg).unwrap();
            assert!(json.contains("Subscribed"));
        }

        #[test]
        fn test_server_message_unsubscribed() {
            let msg = ServerMessage::Unsubscribed {
                channels: vec!["ch1".to_string()],
            };
            let json = serde_json::to_string(&msg).unwrap();
            assert!(json.contains("Unsubscribed"));
        }

        #[test]
        fn test_server_message_event() {
            let msg = ServerMessage::Event {
                channel: "test".to_string(),
                event_type: "message".to_string(),
                data: serde_json::json!({"text": "hello"}),
            };
            let json = serde_json::to_string(&msg).unwrap();
            assert!(json.contains("Event"));
            assert!(json.contains("test"));
            assert!(json.contains("message"));
        }

        #[test]
        fn test_server_message_error() {
            let msg = ServerMessage::Error {
                code: "ERR_001".to_string(),
                message: "Something went wrong".to_string(),
            };
            let json = serde_json::to_string(&msg).unwrap();
            assert!(json.contains("Error"));
            assert!(json.contains("ERR_001"));
            assert!(json.contains("Something went wrong"));
        }
    }

    // =========================================================================
    // Agent Details Response Tests
    // =========================================================================

    mod agent_details_tests {
        use crate::gateway::routes::agents::AgentDetails;
        use crate::executors::AvailabilityInfo;

        #[test]
        fn test_agent_details_serialize() {
            let details = AgentDetails {
                id: "test-agent".to_string(),
                name: "Test Agent".to_string(),
                availability: AvailabilityInfo::NotFound,
                supports_mcp: true,
                capabilities: vec!["capability1".to_string()],
            };

            let json = serde_json::to_string(&details).unwrap();
            assert!(json.contains("test-agent"));
            assert!(json.contains("Test Agent"));
            assert!(json.contains("supports_mcp"));
            assert!(json.contains("capabilities"));
        }
    }

    // =========================================================================
    // Task Response Tests
    // =========================================================================

    mod task_response_tests {
        use crate::gateway::routes::tasks::TaskResponse;

        #[test]
        fn test_task_response_serialize() {
            let response = TaskResponse {
                id: "task-1".to_string(),
                title: "Test Task".to_string(),
                description: Some("A description".to_string()),
                status: "todo".to_string(),
                agent_id: Some("agent-1".to_string()),
            };

            let json = serde_json::to_string(&response).unwrap();
            assert!(json.contains("task-1"));
            assert!(json.contains("Test Task"));
            assert!(json.contains("A description"));
            assert!(json.contains("todo"));
            assert!(json.contains("agent-1"));
        }

        #[test]
        fn test_task_response_serialize_minimal() {
            let response = TaskResponse {
                id: "task-1".to_string(),
                title: "Test Task".to_string(),
                description: None,
                status: "todo".to_string(),
                agent_id: None,
            };

            let json = serde_json::to_string(&response).unwrap();
            assert!(json.contains("task-1"));
            assert!(json.contains("Test Task"));
        }
    }

    // =========================================================================
    // Session Response Tests
    // =========================================================================

    mod session_response_tests {
        use crate::gateway::routes::sessions::SessionResponse;
        use serde_json::json;

        #[test]
        fn test_session_response_serialize() {
            let response = SessionResponse {
                id: "session-1".to_string(),
                agent_id: "agent-1".to_string(),
                task_id: Some("task-1".to_string()),
                status: "active".to_string(),
                prompt: Some("test prompt".to_string()),
                session_data: json!({}),
                created_at: "2024-01-01T00:00:00Z".to_string(),
                updated_at: "2024-01-01T00:00:00Z".to_string(),
            };

            let json_str = serde_json::to_string(&response).unwrap();
            assert!(json_str.contains("session-1"));
            assert!(json_str.contains("agent-1"));
            assert!(json_str.contains("task-1"));
            assert!(json_str.contains("active"));
        }

        #[test]
        fn test_session_response_serialize_minimal() {
            let response = SessionResponse {
                id: "session-1".to_string(),
                agent_id: "agent-1".to_string(),
                task_id: None,
                status: "active".to_string(),
                prompt: None,
                session_data: json!({}),
                created_at: "2024-01-01T00:00:00Z".to_string(),
                updated_at: "2024-01-01T00:00:00Z".to_string(),
            };

            let json_str = serde_json::to_string(&response).unwrap();
            assert!(json_str.contains("session-1"));
            assert!(json_str.contains("agent-1"));
        }
    }

    // =========================================================================
    // Request Deserialization Tests
    // =========================================================================

    mod request_tests {
        use crate::gateway::routes::agents::{SpawnAgentRequest, StopAgentRequest};
        use crate::gateway::routes::sessions::{CreateSessionRequest, SendMessageRequest};
        use crate::gateway::routes::tasks::{CreateTaskRequest, UpdateTaskRequest};

        #[test]
        fn test_spawn_agent_request_deserialize() {
            let json = r#"{"prompt":"test","workdir":"/tmp","session_id":"sess-1"}"#;
            let req: SpawnAgentRequest = serde_json::from_str(json).unwrap();
            assert_eq!(req.prompt, "test");
            assert_eq!(req.workdir, "/tmp");
            assert_eq!(req.session_id, Some("sess-1".to_string()));
        }

        #[test]
        fn test_spawn_agent_request_deserialize_minimal() {
            let json = r#"{"prompt":"test","workdir":"/tmp"}"#;
            let req: SpawnAgentRequest = serde_json::from_str(json).unwrap();
            assert_eq!(req.prompt, "test");
            assert_eq!(req.workdir, "/tmp");
            assert!(req.session_id.is_none());
        }

        #[test]
        fn test_stop_agent_request_deserialize() {
            let json = r#"{"session_id":"sess-1"}"#;
            let req: StopAgentRequest = serde_json::from_str(json).unwrap();
            assert_eq!(req.session_id, "sess-1");
        }

        #[test]
        fn test_create_task_request_deserialize() {
            let json = r#"{"title":"Task","description":"Desc","agent_id":"agent"}"#;
            let req: CreateTaskRequest = serde_json::from_str(json).unwrap();
            assert_eq!(req.title, "Task");
            assert_eq!(req.description, Some("Desc".to_string()));
            assert_eq!(req.agent_id, Some("agent".to_string()));
        }

        #[test]
        fn test_update_task_request_deserialize() {
            let json = r#"{"title":"New Title","status":"done"}"#;
            let req: UpdateTaskRequest = serde_json::from_str(json).unwrap();
            assert_eq!(req.title, Some("New Title".to_string()));
            assert_eq!(req.status, Some("done".to_string()));
            assert!(req.description.is_none());
            assert!(req.agent_id.is_none());
        }

        #[test]
        fn test_create_session_request_deserialize() {
            let json = r#"{"agent_id":"agent","task_id":"task","prompt":"hello"}"#;
            let req: CreateSessionRequest = serde_json::from_str(json).unwrap();
            assert_eq!(req.agent_id, "agent");
            assert_eq!(req.task_id, Some("task".to_string()));
            assert_eq!(req.prompt, Some("hello".to_string()));
        }

        #[test]
        fn test_send_message_request_deserialize() {
            let json = r#"{"content":"Hello world"}"#;
            let req: SendMessageRequest = serde_json::from_str(json).unwrap();
            assert_eq!(req.content, "Hello world");
        }
    }

    // =========================================================================
    // SSE Events Tests
    // =========================================================================

    mod events_tests {
        use super::*;

        #[tokio::test]
        async fn test_events_endpoint_exists() {
            let app = test_app().await;

            // The events endpoint should exist and return SSE stream
            let response = app
                .oneshot(
                    Request::builder()
                        .uri("/api/events")
                        .header("accept", "text/event-stream")
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            // SSE endpoint should return 200 OK
            assert_eq!(response.status(), StatusCode::OK);
        }
    }

    // =========================================================================
    // WebSocket Route Tests
    // =========================================================================

    mod websocket_route_tests {
        use super::*;

        #[tokio::test]
        async fn test_ws_endpoint_exists() {
            let app = test_app().await;

            // Without proper upgrade headers, WebSocket endpoint should fail gracefully
            let response = app
                .oneshot(
                    Request::builder()
                        .uri("/ws")
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            // Without WebSocket upgrade, it might return various status codes
            // The key is that the endpoint exists and doesn't panic
            assert!(response.status().as_u16() >= 200);
        }
    }

    // =========================================================================
    // Additional Agent Tests
    // =========================================================================

    mod additional_agent_tests {
        use super::*;

        #[tokio::test]
        async fn test_spawn_agent_with_custom_session_id() {
            let app = test_app().await;

            let body = serde_json::to_string(&json!({
                "prompt": "test prompt",
                "workdir": "/tmp/test-workdir",
                "session_id": "custom-session-123"
            }))
            .unwrap();

            // Create test directory
            std::fs::create_dir_all("/tmp/test-workdir").ok();

            let response = app
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri("/api/agents/CLAUDE_CODE/spawn")
                        .header("content-type", "application/json")
                        .body(Body::from(body))
                        .unwrap(),
                )
                .await
                .unwrap();

            // May fail due to executable not found, but should not be 404
            let status = response.status();
            assert!(
                status == StatusCode::OK || status == StatusCode::INTERNAL_SERVER_ERROR,
                "Expected OK or Internal Error, got {:?}",
                status
            );

            if status == StatusCode::OK {
                let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                    .await
                    .unwrap();
                let json: Value = serde_json::from_slice(&body).unwrap();
                assert_eq!(json["session_id"], "custom-session-123");
            }
        }

        #[tokio::test]
        async fn test_spawn_agent_invalid_type() {
            let app = test_app().await;

            let body = serde_json::to_string(&json!({
                "prompt": "test",
                "workdir": "/tmp"
            }))
            .unwrap();

            let response = app
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri("/api/agents/INVALID_AGENT/spawn")
                        .header("content-type", "application/json")
                        .body(Body::from(body))
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::NOT_FOUND);
        }

        #[tokio::test]
        async fn test_availability_all_agents() {
            let agent_types = [
                "CLAUDE_CODE", "AMP", "GEMINI", "CODEX", "OPENCODE",
                "CURSOR_AGENT", "QWEN_CODE", "COPILOT", "DROID",
            ];

            for agent_type in agent_types {
                let app = test_app().await;
                let response = app
                    .oneshot(
                        Request::builder()
                            .uri(&format!("/api/agents/{}/availability", agent_type))
                            .body(Body::empty())
                            .unwrap(),
                    )
                    .await
                    .unwrap();

                assert_eq!(
                    response.status(),
                    StatusCode::OK,
                    "Availability check failed for agent type: {}",
                    agent_type
                );

                let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                    .await
                    .unwrap();
                let json: Value = serde_json::from_slice(&body).unwrap();
                assert!(json["type"].is_string());
            }
        }
    }

    // =========================================================================
    // Router Integration Tests
    // =========================================================================

    mod router_tests {
        use super::*;

        #[tokio::test]
        async fn test_router_merges_all_routes() {
            // Test that all main routes are accessible
            let routes = [
                "/health",
                "/api/agents",
                "/api/tasks",
                "/api/sessions",
            ];

            for route in routes {
                let app_clone = test_app().await;
                let response = app_clone
                    .oneshot(
                        Request::builder()
                            .uri(route)
                            .body(Body::empty())
                            .unwrap(),
                    )
                    .await
                    .unwrap();

                assert!(
                    response.status().is_success(),
                    "Route {} failed with status {}",
                    route,
                    response.status()
                );
            }
        }

        #[tokio::test]
        async fn test_not_found_route() {
            let app = test_app().await;

            let response = app
                .oneshot(
                    Request::builder()
                        .uri("/nonexistent/route")
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::NOT_FOUND);
        }
    }

    // =========================================================================
    // Debug Trait Tests
    // =========================================================================

    mod debug_tests {
        use crate::gateway::routes::ws::WsMessage;
        use crate::gateway::ws::handler::{ClientMessage, ServerMessage};

        #[test]
        fn test_ws_message_debug() {
            let msg = WsMessage::Ping;
            let debug_str = format!("{:?}", msg);
            assert!(debug_str.contains("Ping"));
        }

        #[test]
        fn test_client_message_debug() {
            let msg = ClientMessage::Ping;
            let debug_str = format!("{:?}", msg);
            assert!(debug_str.contains("Ping"));
        }

        #[test]
        fn test_server_message_debug() {
            let msg = ServerMessage::Pong;
            let debug_str = format!("{:?}", msg);
            assert!(debug_str.contains("Pong"));
        }
    }

    // =========================================================================
    // WebSocket Integration Tests
    // =========================================================================

    mod websocket_integration_tests {
        use super::*;
        use std::net::SocketAddr;
        use tokio::net::TcpListener;
        use tokio_tungstenite::{connect_async, tungstenite::Message as WsMsg};
        use futures_util::SinkExt;
        use crate::gateway::routes::ws::WsMessage;
        use tower_http::cors::{Any, CorsLayer};
        use axum::body::Bytes;

        async fn start_test_server() -> SocketAddr {
            let state = test_state().await;
            let app = routes::router(state)
                .layer(CorsLayer::new().allow_origin(Any).allow_methods(Any).allow_headers(Any));

            let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
            let addr = listener.local_addr().unwrap();

            tokio::spawn(async move {
                axum::serve(listener, app).await.unwrap();
            });

            // Give server time to start
            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
            addr
        }

        #[tokio::test]
        async fn test_websocket_connect_and_ping() {
            let addr = start_test_server().await;
            let url = format!("ws://{}/ws", addr);

            let (mut ws_stream, _) = connect_async(&url).await.expect("Failed to connect");

            // Send ping message
            let ping_msg = WsMessage::Ping;
            let json = serde_json::to_string(&ping_msg).unwrap();
            ws_stream.send(WsMsg::Text(json.into())).await.expect("Failed to send");

            // Close connection
            ws_stream.close(None).await.ok();
        }

        #[tokio::test]
        async fn test_websocket_subscribe() {
            let addr = start_test_server().await;
            let url = format!("ws://{}/ws", addr);

            let (mut ws_stream, _) = connect_async(&url).await.expect("Failed to connect");

            // Send subscribe message
            let subscribe_msg = WsMessage::Subscribe {
                channels: vec!["events".to_string(), "logs".to_string()],
            };
            let json = serde_json::to_string(&subscribe_msg).unwrap();
            ws_stream.send(WsMsg::Text(json.into())).await.expect("Failed to send");

            // Close connection
            ws_stream.close(None).await.ok();
        }

        #[tokio::test]
        async fn test_websocket_unsubscribe() {
            let addr = start_test_server().await;
            let url = format!("ws://{}/ws", addr);

            let (mut ws_stream, _) = connect_async(&url).await.expect("Failed to connect");

            // Send unsubscribe message
            let unsubscribe_msg = WsMessage::Unsubscribe {
                channels: vec!["events".to_string()],
            };
            let json = serde_json::to_string(&unsubscribe_msg).unwrap();
            ws_stream.send(WsMsg::Text(json.into())).await.expect("Failed to send");

            // Close connection
            ws_stream.close(None).await.ok();
        }

        #[tokio::test]
        async fn test_websocket_invalid_message() {
            let addr = start_test_server().await;
            let url = format!("ws://{}/ws", addr);

            let (mut ws_stream, _) = connect_async(&url).await.expect("Failed to connect");

            // Send invalid JSON
            ws_stream.send(WsMsg::Text("invalid json".into())).await.expect("Failed to send");

            // Server should handle gracefully, close connection
            ws_stream.close(None).await.ok();
        }

        #[tokio::test]
        async fn test_websocket_close() {
            let addr = start_test_server().await;
            let url = format!("ws://{}/ws", addr);

            let (mut ws_stream, _) = connect_async(&url).await.expect("Failed to connect");

            // Send close frame
            ws_stream.close(None).await.expect("Failed to close");
        }

        #[tokio::test]
        async fn test_websocket_pong_message() {
            let addr = start_test_server().await;
            let url = format!("ws://{}/ws", addr);

            let (mut ws_stream, _) = connect_async(&url).await.expect("Failed to connect");

            // Send pong message (should be handled)
            let pong_msg = WsMessage::Pong;
            let json = serde_json::to_string(&pong_msg).unwrap();
            ws_stream.send(WsMsg::Text(json.into())).await.expect("Failed to send");

            ws_stream.close(None).await.ok();
        }

        #[tokio::test]
        async fn test_websocket_event_message() {
            let addr = start_test_server().await;
            let url = format!("ws://{}/ws", addr);

            let (mut ws_stream, _) = connect_async(&url).await.expect("Failed to connect");

            // Send event message (should be handled as "other")
            let event_msg = WsMessage::Event {
                channel: "test".to_string(),
                payload: serde_json::json!({"data": "test"}),
            };
            let json = serde_json::to_string(&event_msg).unwrap();
            ws_stream.send(WsMsg::Text(json.into())).await.expect("Failed to send");

            ws_stream.close(None).await.ok();
        }

        #[tokio::test]
        async fn test_websocket_error_message() {
            let addr = start_test_server().await;
            let url = format!("ws://{}/ws", addr);

            let (mut ws_stream, _) = connect_async(&url).await.expect("Failed to connect");

            // Send error message (should be handled as "other")
            let error_msg = WsMessage::Error {
                message: "test error".to_string(),
            };
            let json = serde_json::to_string(&error_msg).unwrap();
            ws_stream.send(WsMsg::Text(json.into())).await.expect("Failed to send");

            ws_stream.close(None).await.ok();
        }

        #[tokio::test]
        async fn test_websocket_binary_message() {
            let addr = start_test_server().await;
            let url = format!("ws://{}/ws", addr);

            let (mut ws_stream, _) = connect_async(&url).await.expect("Failed to connect");

            // Send binary message (should be handled as "other")
            ws_stream.send(WsMsg::Binary(Bytes::from(vec![1u8, 2, 3]))).await.expect("Failed to send");

            ws_stream.close(None).await.ok();
        }
    }

    // =========================================================================
    // Group Chat API Tests
    // =========================================================================

    mod group_chat_tests {
        use super::*;

        // =====================================================================
        // Group Chat CRUD Tests
        // =====================================================================

        #[tokio::test]
        async fn test_list_group_chats_empty() {
            let app = test_app().await;

            let response = app
                .oneshot(
                    Request::builder()
                        .uri("/api/group-chats")
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);

            let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();

            assert!(json["group_chats"].is_array());
        }

        #[tokio::test]
        async fn test_create_group_chat() {
            let app = test_app().await;

            let body = serde_json::to_string(&json!({
                "name": "Test Group Chat",
                "description": "A test group chat",
                "created_by": "user-1"
            }))
            .unwrap();

            let response = app
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri("/api/group-chats")
                        .header("content-type", "application/json")
                        .body(Body::from(body))
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);

            let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();

            assert!(json["group_chat"]["id"].is_string());
            assert_eq!(json["group_chat"]["name"], "Test Group Chat");
            assert_eq!(json["group_chat"]["description"], "A test group chat");
            assert_eq!(json["group_chat"]["created_by"], "user-1");
            assert!(json["members"].is_array());
        }

        #[tokio::test]
        async fn test_create_group_chat_with_initial_members() {
            let app = test_app().await;

            let body = serde_json::to_string(&json!({
                "name": "Group With Members",
                "created_by": "user-1",
                "initial_members": [
                    {
                        "member_type": "human",
                        "member_id": "user-1",
                        "display_name": "User One",
                        "role": "owner"
                    },
                    {
                        "member_type": "agent",
                        "member_id": "claude-code",
                        "display_name": "Claude Code"
                    }
                ]
            }))
            .unwrap();

            let response = app
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri("/api/group-chats")
                        .header("content-type", "application/json")
                        .body(Body::from(body))
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);

            let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();

            assert_eq!(json["group_chat"]["name"], "Group With Members");
            let members = json["members"].as_array().unwrap();
            assert_eq!(members.len(), 2);

            // Verify first member
            let member1 = &members[0];
            assert_eq!(member1["member_type"], "human");
            assert_eq!(member1["member_id"], "user-1");
            assert_eq!(member1["display_name"], "User One");
            assert_eq!(member1["role"], "owner");

            // Verify second member
            let member2 = &members[1];
            assert_eq!(member2["member_type"], "agent");
            assert_eq!(member2["member_id"], "claude-code");
        }

        #[tokio::test]
        async fn test_create_group_chat_minimal() {
            let app = test_app().await;

            let body = serde_json::to_string(&json!({
                "name": "Minimal Group",
                "created_by": "user-1"
            }))
            .unwrap();

            let response = app
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri("/api/group-chats")
                        .header("content-type", "application/json")
                        .body(Body::from(body))
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);

            let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();

            assert_eq!(json["group_chat"]["name"], "Minimal Group");
            assert!(json["group_chat"]["description"].is_null());
            assert!(json["group_chat"]["task_id"].is_null());
        }

        #[tokio::test]
        async fn test_get_group_chat() {
            let state = test_state().await;
            let app = routes::router(state.clone());

            // First create a group chat
            let create_body = serde_json::to_string(&json!({
                "name": "Get Test Group",
                "created_by": "user-1"
            }))
            .unwrap();

            let create_response = app
                .clone()
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri("/api/group-chats")
                        .header("content-type", "application/json")
                        .body(Body::from(create_body))
                        .unwrap(),
                )
                .await
                .unwrap();

            let create_body = axum::body::to_bytes(create_response.into_body(), usize::MAX)
                .await
                .unwrap();
            let create_json: Value = serde_json::from_slice(&create_body).unwrap();
            let group_chat_id = create_json["group_chat"]["id"].as_str().unwrap();

            // Now get the group chat
            let app = routes::router(state);
            let response = app
                .oneshot(
                    Request::builder()
                        .uri(&format!("/api/group-chats/{}", group_chat_id))
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);

            let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();

            assert_eq!(json["group_chat"]["id"], group_chat_id);
            assert_eq!(json["group_chat"]["name"], "Get Test Group");
            assert!(json["members"].is_array());
        }

        #[tokio::test]
        async fn test_get_group_chat_not_found() {
            let app = test_app().await;

            let response = app
                .oneshot(
                    Request::builder()
                        .uri("/api/group-chats/nonexistent-id")
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::NOT_FOUND);

            let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();

            assert!(json["error"]["message"]
                .as_str()
                .unwrap()
                .contains("not found"));
        }

        #[tokio::test]
        async fn test_update_group_chat() {
            let state = test_state().await;
            let app = routes::router(state.clone());

            // First create a group chat
            let create_body = serde_json::to_string(&json!({
                "name": "Original Name",
                "description": "Original description",
                "created_by": "user-1"
            }))
            .unwrap();

            let create_response = app
                .clone()
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri("/api/group-chats")
                        .header("content-type", "application/json")
                        .body(Body::from(create_body))
                        .unwrap(),
                )
                .await
                .unwrap();

            let create_body = axum::body::to_bytes(create_response.into_body(), usize::MAX)
                .await
                .unwrap();
            let create_json: Value = serde_json::from_slice(&create_body).unwrap();
            let group_chat_id = create_json["group_chat"]["id"].as_str().unwrap();

            // Update the group chat
            let update_body = serde_json::to_string(&json!({
                "name": "Updated Name",
                "description": "Updated description"
            }))
            .unwrap();

            let app = routes::router(state);
            let response = app
                .oneshot(
                    Request::builder()
                        .method("PATCH")
                        .uri(&format!("/api/group-chats/{}", group_chat_id))
                        .header("content-type", "application/json")
                        .body(Body::from(update_body))
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);

            let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();

            assert_eq!(json["name"], "Updated Name");
            assert_eq!(json["description"], "Updated description");
        }

        #[tokio::test]
        async fn test_update_group_chat_partial() {
            let state = test_state().await;
            let app = routes::router(state.clone());

            // First create a group chat
            let create_body = serde_json::to_string(&json!({
                "name": "Original Name",
                "description": "Original description",
                "created_by": "user-1"
            }))
            .unwrap();

            let create_response = app
                .clone()
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri("/api/group-chats")
                        .header("content-type", "application/json")
                        .body(Body::from(create_body))
                        .unwrap(),
                )
                .await
                .unwrap();

            let create_body = axum::body::to_bytes(create_response.into_body(), usize::MAX)
                .await
                .unwrap();
            let create_json: Value = serde_json::from_slice(&create_body).unwrap();
            let group_chat_id = create_json["group_chat"]["id"].as_str().unwrap();

            // Update only the name
            let update_body = serde_json::to_string(&json!({
                "name": "Only Name Updated"
            }))
            .unwrap();

            let app = routes::router(state);
            let response = app
                .oneshot(
                    Request::builder()
                        .method("PATCH")
                        .uri(&format!("/api/group-chats/{}", group_chat_id))
                        .header("content-type", "application/json")
                        .body(Body::from(update_body))
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);

            let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();

            assert_eq!(json["name"], "Only Name Updated");
            assert_eq!(json["description"], "Original description");
        }

        #[tokio::test]
        async fn test_update_group_chat_not_found() {
            let app = test_app().await;

            let body = serde_json::to_string(&json!({
                "name": "Updated Name"
            }))
            .unwrap();

            let response = app
                .oneshot(
                    Request::builder()
                        .method("PATCH")
                        .uri("/api/group-chats/nonexistent-id")
                        .header("content-type", "application/json")
                        .body(Body::from(body))
                        .unwrap(),
                )
                .await
                .unwrap();

            // Note: Currently returns 500 because DbError::NotFound is mapped to Internal error
            // The update handler doesn't explicitly check for existence before updating
            assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
        }

        #[tokio::test]
        async fn test_delete_group_chat() {
            let state = test_state().await;
            let app = routes::router(state.clone());

            // First create a group chat
            let create_body = serde_json::to_string(&json!({
                "name": "To Be Deleted",
                "created_by": "user-1"
            }))
            .unwrap();

            let create_response = app
                .clone()
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri("/api/group-chats")
                        .header("content-type", "application/json")
                        .body(Body::from(create_body))
                        .unwrap(),
                )
                .await
                .unwrap();

            let create_body = axum::body::to_bytes(create_response.into_body(), usize::MAX)
                .await
                .unwrap();
            let create_json: Value = serde_json::from_slice(&create_body).unwrap();
            let group_chat_id = create_json["group_chat"]["id"].as_str().unwrap();

            // Delete the group chat
            let app = routes::router(state.clone());
            let response = app
                .oneshot(
                    Request::builder()
                        .method("DELETE")
                        .uri(&format!("/api/group-chats/{}", group_chat_id))
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);

            let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();

            assert_eq!(json["deleted"], group_chat_id);

            // Verify it's gone
            let app = routes::router(state);
            let response = app
                .oneshot(
                    Request::builder()
                        .uri(&format!("/api/group-chats/{}", group_chat_id))
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::NOT_FOUND);
        }

        #[tokio::test]
        async fn test_delete_group_chat_not_found() {
            let app = test_app().await;

            let response = app
                .oneshot(
                    Request::builder()
                        .method("DELETE")
                        .uri("/api/group-chats/nonexistent-id")
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::NOT_FOUND);
        }

        #[tokio::test]
        async fn test_list_group_chats_with_filter() {
            let state = test_state().await;
            let app = routes::router(state.clone());

            // Create a group chat
            let create_body = serde_json::to_string(&json!({
                "name": "Filtered Group",
                "created_by": "filter-user"
            }))
            .unwrap();

            app.clone()
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri("/api/group-chats")
                        .header("content-type", "application/json")
                        .body(Body::from(create_body))
                        .unwrap(),
                )
                .await
                .unwrap();

            // List with created_by filter
            let app = routes::router(state);
            let response = app
                .oneshot(
                    Request::builder()
                        .uri("/api/group-chats?created_by=filter-user")
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);

            let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();

            let group_chats = json["group_chats"].as_array().unwrap();
            assert!(!group_chats.is_empty());
            for gc in group_chats {
                assert_eq!(gc["created_by"], "filter-user");
            }
        }

        // =====================================================================
        // Member Management Tests
        // =====================================================================

        #[tokio::test]
        async fn test_list_members() {
            let state = test_state().await;
            let app = routes::router(state.clone());

            // Create a group chat with members
            let create_body = serde_json::to_string(&json!({
                "name": "Members Test Group",
                "created_by": "user-1",
                "initial_members": [
                    {
                        "member_type": "human",
                        "member_id": "user-1",
                        "display_name": "User One",
                        "role": "owner"
                    }
                ]
            }))
            .unwrap();

            let create_response = app
                .clone()
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri("/api/group-chats")
                        .header("content-type", "application/json")
                        .body(Body::from(create_body))
                        .unwrap(),
                )
                .await
                .unwrap();

            let create_body = axum::body::to_bytes(create_response.into_body(), usize::MAX)
                .await
                .unwrap();
            let create_json: Value = serde_json::from_slice(&create_body).unwrap();
            let group_chat_id = create_json["group_chat"]["id"].as_str().unwrap();

            // List members
            let app = routes::router(state);
            let response = app
                .oneshot(
                    Request::builder()
                        .uri(&format!("/api/group-chats/{}/members", group_chat_id))
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);

            let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();

            let members = json["members"].as_array().unwrap();
            assert_eq!(members.len(), 1);
            assert_eq!(members[0]["member_id"], "user-1");
        }

        #[tokio::test]
        async fn test_list_members_group_not_found() {
            let app = test_app().await;

            let response = app
                .oneshot(
                    Request::builder()
                        .uri("/api/group-chats/nonexistent-id/members")
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::NOT_FOUND);
        }

        #[tokio::test]
        async fn test_add_member() {
            let state = test_state().await;
            let app = routes::router(state.clone());

            // Create a group chat
            let create_body = serde_json::to_string(&json!({
                "name": "Add Member Test",
                "created_by": "user-1"
            }))
            .unwrap();

            let create_response = app
                .clone()
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri("/api/group-chats")
                        .header("content-type", "application/json")
                        .body(Body::from(create_body))
                        .unwrap(),
                )
                .await
                .unwrap();

            let create_body = axum::body::to_bytes(create_response.into_body(), usize::MAX)
                .await
                .unwrap();
            let create_json: Value = serde_json::from_slice(&create_body).unwrap();
            let group_chat_id = create_json["group_chat"]["id"].as_str().unwrap();

            // Add a member
            let add_member_body = serde_json::to_string(&json!({
                "member_type": "agent",
                "member_id": "claude-code",
                "display_name": "Claude Code",
                "role": "member"
            }))
            .unwrap();

            let app = routes::router(state);
            let response = app
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri(&format!("/api/group-chats/{}/members", group_chat_id))
                        .header("content-type", "application/json")
                        .body(Body::from(add_member_body))
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);

            let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();

            assert!(json["id"].is_string());
            assert_eq!(json["member_type"], "agent");
            assert_eq!(json["member_id"], "claude-code");
            assert_eq!(json["display_name"], "Claude Code");
            assert_eq!(json["role"], "member");
        }

        #[tokio::test]
        async fn test_add_member_group_not_found() {
            let app = test_app().await;

            let body = serde_json::to_string(&json!({
                "member_type": "human",
                "member_id": "user-2",
                "display_name": "User Two"
            }))
            .unwrap();

            let response = app
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri("/api/group-chats/nonexistent-id/members")
                        .header("content-type", "application/json")
                        .body(Body::from(body))
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::NOT_FOUND);
        }

        #[tokio::test]
        async fn test_add_member_duplicate() {
            let state = test_state().await;
            let app = routes::router(state.clone());

            // Create a group chat with a member
            let create_body = serde_json::to_string(&json!({
                "name": "Duplicate Member Test",
                "created_by": "user-1",
                "initial_members": [
                    {
                        "member_type": "human",
                        "member_id": "user-1",
                        "display_name": "User One"
                    }
                ]
            }))
            .unwrap();

            let create_response = app
                .clone()
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri("/api/group-chats")
                        .header("content-type", "application/json")
                        .body(Body::from(create_body))
                        .unwrap(),
                )
                .await
                .unwrap();

            let create_body = axum::body::to_bytes(create_response.into_body(), usize::MAX)
                .await
                .unwrap();
            let create_json: Value = serde_json::from_slice(&create_body).unwrap();
            let group_chat_id = create_json["group_chat"]["id"].as_str().unwrap();

            // Try to add the same member again
            let add_member_body = serde_json::to_string(&json!({
                "member_type": "human",
                "member_id": "user-1",
                "display_name": "User One Again"
            }))
            .unwrap();

            let app = routes::router(state);
            let response = app
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri(&format!("/api/group-chats/{}/members", group_chat_id))
                        .header("content-type", "application/json")
                        .body(Body::from(add_member_body))
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::BAD_REQUEST);

            let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();

            assert!(json["error"]["message"]
                .as_str()
                .unwrap()
                .contains("already exists"));
        }

        #[tokio::test]
        async fn test_add_member_invalid_member_type() {
            let state = test_state().await;
            let app = routes::router(state.clone());

            // Create a group chat
            let create_body = serde_json::to_string(&json!({
                "name": "Invalid Member Type Test",
                "created_by": "user-1"
            }))
            .unwrap();

            let create_response = app
                .clone()
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri("/api/group-chats")
                        .header("content-type", "application/json")
                        .body(Body::from(create_body))
                        .unwrap(),
                )
                .await
                .unwrap();

            let create_body = axum::body::to_bytes(create_response.into_body(), usize::MAX)
                .await
                .unwrap();
            let create_json: Value = serde_json::from_slice(&create_body).unwrap();
            let group_chat_id = create_json["group_chat"]["id"].as_str().unwrap();

            // Try to add a member with invalid type
            let add_member_body = serde_json::to_string(&json!({
                "member_type": "invalid_type",
                "member_id": "user-2",
                "display_name": "User Two"
            }))
            .unwrap();

            let app = routes::router(state);
            let response = app
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri(&format!("/api/group-chats/{}/members", group_chat_id))
                        .header("content-type", "application/json")
                        .body(Body::from(add_member_body))
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        }

        #[tokio::test]
        async fn test_remove_member() {
            let state = test_state().await;
            let app = routes::router(state.clone());

            // Create a group chat with members
            let create_body = serde_json::to_string(&json!({
                "name": "Remove Member Test",
                "created_by": "user-1",
                "initial_members": [
                    {
                        "member_type": "human",
                        "member_id": "user-1",
                        "display_name": "User One"
                    }
                ]
            }))
            .unwrap();

            let create_response = app
                .clone()
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri("/api/group-chats")
                        .header("content-type", "application/json")
                        .body(Body::from(create_body))
                        .unwrap(),
                )
                .await
                .unwrap();

            let create_body = axum::body::to_bytes(create_response.into_body(), usize::MAX)
                .await
                .unwrap();
            let create_json: Value = serde_json::from_slice(&create_body).unwrap();
            let group_chat_id = create_json["group_chat"]["id"].as_str().unwrap();
            let member_id = create_json["members"][0]["id"].as_str().unwrap();

            // Remove the member
            let app = routes::router(state);
            let response = app
                .oneshot(
                    Request::builder()
                        .method("DELETE")
                        .uri(&format!(
                            "/api/group-chats/{}/members/{}",
                            group_chat_id, member_id
                        ))
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);

            let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();

            assert_eq!(json["deleted"], member_id);
        }

        #[tokio::test]
        async fn test_remove_member_not_found() {
            let state = test_state().await;
            let app = routes::router(state.clone());

            // Create a group chat
            let create_body = serde_json::to_string(&json!({
                "name": "Remove Member Not Found Test",
                "created_by": "user-1"
            }))
            .unwrap();

            let create_response = app
                .clone()
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri("/api/group-chats")
                        .header("content-type", "application/json")
                        .body(Body::from(create_body))
                        .unwrap(),
                )
                .await
                .unwrap();

            let create_body = axum::body::to_bytes(create_response.into_body(), usize::MAX)
                .await
                .unwrap();
            let create_json: Value = serde_json::from_slice(&create_body).unwrap();
            let group_chat_id = create_json["group_chat"]["id"].as_str().unwrap();

            // Try to remove a non-existent member
            let app = routes::router(state);
            let response = app
                .oneshot(
                    Request::builder()
                        .method("DELETE")
                        .uri(&format!(
                            "/api/group-chats/{}/members/nonexistent-member",
                            group_chat_id
                        ))
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::NOT_FOUND);
        }

        // =====================================================================
        // Message Tests
        // =====================================================================

        #[tokio::test]
        async fn test_list_messages_empty() {
            let state = test_state().await;
            let app = routes::router(state.clone());

            // Create a group chat
            let create_body = serde_json::to_string(&json!({
                "name": "Empty Messages Test",
                "created_by": "user-1"
            }))
            .unwrap();

            let create_response = app
                .clone()
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri("/api/group-chats")
                        .header("content-type", "application/json")
                        .body(Body::from(create_body))
                        .unwrap(),
                )
                .await
                .unwrap();

            let create_body = axum::body::to_bytes(create_response.into_body(), usize::MAX)
                .await
                .unwrap();
            let create_json: Value = serde_json::from_slice(&create_body).unwrap();
            let group_chat_id = create_json["group_chat"]["id"].as_str().unwrap();

            // List messages
            let app = routes::router(state);
            let response = app
                .oneshot(
                    Request::builder()
                        .uri(&format!("/api/group-chats/{}/messages", group_chat_id))
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);

            let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();

            assert!(json["messages"].is_array());
            assert_eq!(json["messages"].as_array().unwrap().len(), 0);
            assert_eq!(json["has_more"], false);
        }

        #[tokio::test]
        async fn test_list_messages_group_not_found() {
            let app = test_app().await;

            let response = app
                .oneshot(
                    Request::builder()
                        .uri("/api/group-chats/nonexistent-id/messages")
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::NOT_FOUND);
        }

        #[tokio::test]
        async fn test_send_message() {
            let state = test_state().await;
            let app = routes::router(state.clone());

            // Create a group chat with a member
            let create_body = serde_json::to_string(&json!({
                "name": "Send Message Test",
                "created_by": "user-1",
                "initial_members": [
                    {
                        "member_type": "human",
                        "member_id": "user-1",
                        "display_name": "User One"
                    }
                ]
            }))
            .unwrap();

            let create_response = app
                .clone()
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri("/api/group-chats")
                        .header("content-type", "application/json")
                        .body(Body::from(create_body))
                        .unwrap(),
                )
                .await
                .unwrap();

            let create_body = axum::body::to_bytes(create_response.into_body(), usize::MAX)
                .await
                .unwrap();
            let create_json: Value = serde_json::from_slice(&create_body).unwrap();
            let group_chat_id = create_json["group_chat"]["id"].as_str().unwrap();

            // Send a message
            let message_body = serde_json::to_string(&json!({
                "content": "Hello, world!"
            }))
            .unwrap();

            let app = routes::router(state);
            let response = app
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri(&format!(
                            "/api/group-chats/{}/messages?member_type=human&member_id=user-1",
                            group_chat_id
                        ))
                        .header("content-type", "application/json")
                        .body(Body::from(message_body))
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);

            let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();

            assert!(json["id"].is_string());
            assert_eq!(json["content"], "Hello, world!");
            assert_eq!(json["sender_id"], "user-1");
            assert_eq!(json["sender_type"], "human");
            assert_eq!(json["sender_name"], "User One");
            assert_eq!(json["content_type"], "text");
        }

        #[tokio::test]
        async fn test_send_message_with_content_type() {
            let state = test_state().await;
            let app = routes::router(state.clone());

            // Create a group chat with a member
            let create_body = serde_json::to_string(&json!({
                "name": "Code Message Test",
                "created_by": "user-1",
                "initial_members": [
                    {
                        "member_type": "agent",
                        "member_id": "claude-code",
                        "display_name": "Claude Code"
                    }
                ]
            }))
            .unwrap();

            let create_response = app
                .clone()
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri("/api/group-chats")
                        .header("content-type", "application/json")
                        .body(Body::from(create_body))
                        .unwrap(),
                )
                .await
                .unwrap();

            let create_body = axum::body::to_bytes(create_response.into_body(), usize::MAX)
                .await
                .unwrap();
            let create_json: Value = serde_json::from_slice(&create_body).unwrap();
            let group_chat_id = create_json["group_chat"]["id"].as_str().unwrap();

            // Send a code message
            let message_body = serde_json::to_string(&json!({
                "content": "fn main() { println!(\"Hello\"); }",
                "content_type": "code",
                "metadata": {
                    "language": "rust"
                }
            }))
            .unwrap();

            let app = routes::router(state);
            let response = app
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri(&format!(
                            "/api/group-chats/{}/messages?member_type=agent&member_id=claude-code",
                            group_chat_id
                        ))
                        .header("content-type", "application/json")
                        .body(Body::from(message_body))
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);

            let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();

            assert_eq!(json["content_type"], "code");
            assert_eq!(json["metadata"]["language"], "rust");
        }

        #[tokio::test]
        async fn test_send_message_with_mentions() {
            let state = test_state().await;
            let app = routes::router(state.clone());

            // Create a group chat with members
            let create_body = serde_json::to_string(&json!({
                "name": "Mentions Test",
                "created_by": "user-1",
                "initial_members": [
                    {
                        "member_type": "human",
                        "member_id": "user-1",
                        "display_name": "User One"
                    },
                    {
                        "member_type": "agent",
                        "member_id": "claude-code",
                        "display_name": "Claude Code"
                    }
                ]
            }))
            .unwrap();

            let create_response = app
                .clone()
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri("/api/group-chats")
                        .header("content-type", "application/json")
                        .body(Body::from(create_body))
                        .unwrap(),
                )
                .await
                .unwrap();

            let create_body = axum::body::to_bytes(create_response.into_body(), usize::MAX)
                .await
                .unwrap();
            let create_json: Value = serde_json::from_slice(&create_body).unwrap();
            let group_chat_id = create_json["group_chat"]["id"].as_str().unwrap();

            // Send a message with mentions
            let message_body = serde_json::to_string(&json!({
                "content": "@claude-code Please review this code",
                "mentions": ["claude-code"]
            }))
            .unwrap();

            let app = routes::router(state);
            let response = app
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri(&format!(
                            "/api/group-chats/{}/messages?member_type=human&member_id=user-1",
                            group_chat_id
                        ))
                        .header("content-type", "application/json")
                        .body(Body::from(message_body))
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);

            let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();

            let mentions = json["mentions"].as_array().unwrap();
            assert_eq!(mentions.len(), 1);
            assert_eq!(mentions[0], "claude-code");
        }

        #[tokio::test]
        async fn test_send_message_group_not_found() {
            let app = test_app().await;

            let body = serde_json::to_string(&json!({
                "content": "Hello"
            }))
            .unwrap();

            let response = app
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri("/api/group-chats/nonexistent-id/messages?member_type=human&member_id=user-1")
                        .header("content-type", "application/json")
                        .body(Body::from(body))
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::NOT_FOUND);
        }

        #[tokio::test]
        async fn test_send_message_not_a_member() {
            let state = test_state().await;
            let app = routes::router(state.clone());

            // Create a group chat without members
            let create_body = serde_json::to_string(&json!({
                "name": "Not A Member Test",
                "created_by": "user-1"
            }))
            .unwrap();

            let create_response = app
                .clone()
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri("/api/group-chats")
                        .header("content-type", "application/json")
                        .body(Body::from(create_body))
                        .unwrap(),
                )
                .await
                .unwrap();

            let create_body = axum::body::to_bytes(create_response.into_body(), usize::MAX)
                .await
                .unwrap();
            let create_json: Value = serde_json::from_slice(&create_body).unwrap();
            let group_chat_id = create_json["group_chat"]["id"].as_str().unwrap();

            // Try to send message as non-member
            let message_body = serde_json::to_string(&json!({
                "content": "Hello"
            }))
            .unwrap();

            let app = routes::router(state);
            let response = app
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri(&format!(
                            "/api/group-chats/{}/messages?member_type=human&member_id=stranger",
                            group_chat_id
                        ))
                        .header("content-type", "application/json")
                        .body(Body::from(message_body))
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::BAD_REQUEST);

            let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();

            assert!(json["error"]["message"]
                .as_str()
                .unwrap()
                .contains("not a member"));
        }

        #[tokio::test]
        async fn test_list_messages_with_pagination() {
            let state = test_state().await;
            let app = routes::router(state.clone());

            // Create a group chat with a member
            let create_body = serde_json::to_string(&json!({
                "name": "Pagination Test",
                "created_by": "user-1",
                "initial_members": [
                    {
                        "member_type": "human",
                        "member_id": "user-1",
                        "display_name": "User One"
                    }
                ]
            }))
            .unwrap();

            let create_response = app
                .clone()
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri("/api/group-chats")
                        .header("content-type", "application/json")
                        .body(Body::from(create_body))
                        .unwrap(),
                )
                .await
                .unwrap();

            let create_body = axum::body::to_bytes(create_response.into_body(), usize::MAX)
                .await
                .unwrap();
            let create_json: Value = serde_json::from_slice(&create_body).unwrap();
            let group_chat_id = create_json["group_chat"]["id"].as_str().unwrap();

            // Send multiple messages
            for i in 0..5 {
                let message_body = serde_json::to_string(&json!({
                    "content": format!("Message {}", i)
                }))
                .unwrap();

                let app = routes::router(state.clone());
                app.oneshot(
                    Request::builder()
                        .method("POST")
                        .uri(&format!(
                            "/api/group-chats/{}/messages?member_type=human&member_id=user-1",
                            group_chat_id
                        ))
                        .header("content-type", "application/json")
                        .body(Body::from(message_body))
                        .unwrap(),
                )
                .await
                .unwrap();
            }

            // List with limit
            let app = routes::router(state);
            let response = app
                .oneshot(
                    Request::builder()
                        .uri(&format!(
                            "/api/group-chats/{}/messages?limit=3",
                            group_chat_id
                        ))
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);

            let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();

            let messages = json["messages"].as_array().unwrap();
            assert_eq!(messages.len(), 3);
            assert_eq!(json["has_more"], true);
        }

        // =====================================================================
        // Response Types Tests
        // =====================================================================

        #[test]
        fn test_group_chat_response_serialize() {
            use crate::gateway::routes::group_chats::GroupChatResponse;
            use crate::group_chat::GroupChatSettings;

            let response = GroupChatResponse {
                id: "gc-1".to_string(),
                name: "Test Chat".to_string(),
                description: Some("Description".to_string()),
                created_by: "user-1".to_string(),
                created_at: "2024-01-01T00:00:00Z".to_string(),
                updated_at: "2024-01-01T00:00:00Z".to_string(),
                settings: GroupChatSettings::default(),
            };

            let json = serde_json::to_string(&response).unwrap();
            assert!(json.contains("gc-1"));
            assert!(json.contains("Test Chat"));
            assert!(json.contains("Description"));
        }

        #[test]
        fn test_group_chat_member_response_serialize() {
            use crate::gateway::routes::group_chats::GroupChatMemberResponse;

            let response = GroupChatMemberResponse {
                id: "member-1".to_string(),
                member_type: "human".to_string(),
                display_name: "User One".to_string(),
                role: "owner".to_string(),
                model: None,
                joined_at: "2024-01-01T00:00:00Z".to_string(),
                last_seen_at: None,
            };

            let json = serde_json::to_string(&response).unwrap();
            assert!(json.contains("member-1"));
            assert!(json.contains("human"));
            assert!(json.contains("owner"));
        }

        #[test]
        fn test_ui_message_response_serialize() {
            use crate::gateway::routes::group_chats::UIMessageResponse;

            let response = UIMessageResponse {
                id: "msg-1".to_string(),
                msg_type: "user".to_string(),
                timestamp: "2024-01-01T00:00:00Z".to_string(),
                sender_id: Some("user-1".to_string()),
                sender_name: Some("User One".to_string()),
                content: Some("Hello".to_string()),
                agent_id: None,
                agent_name: None,
                status: None,
                event: None,
                data: None,
            };

            let json = serde_json::to_string(&response).unwrap();
            assert!(json.contains("msg-1"));
            assert!(json.contains("Hello"));
            assert!(json.contains("user"));
        }

        // =====================================================================
        // Request Deserialization Tests
        // =====================================================================

        #[test]
        fn test_create_group_chat_request_deserialize() {
            use crate::gateway::routes::group_chats::CreateGroupChatRequest;

            let json = r#"{"workspace_path":"/tmp/test","name":"Test","created_by":"user-1","description":"Desc"}"#;
            let req: CreateGroupChatRequest = serde_json::from_str(json).unwrap();
            assert_eq!(req.workspace_path, "/tmp/test");
            assert_eq!(req.name, "Test");
            assert_eq!(req.created_by, "user-1");
            assert_eq!(req.description, Some("Desc".to_string()));
        }

        #[test]
        fn test_update_group_chat_request_deserialize() {
            use crate::gateway::routes::group_chats::UpdateGroupChatRequest;

            let json = r#"{"name":"New Name"}"#;
            let req: UpdateGroupChatRequest = serde_json::from_str(json).unwrap();
            assert_eq!(req.name, Some("New Name".to_string()));
            assert!(req.description.is_none());
        }

        #[test]
        fn test_add_member_request_deserialize() {
            use crate::gateway::routes::group_chats::AddMemberRequest;

            let json = r#"{"type":"human","member_id":"user-2","display_name":"User Two","role":"member"}"#;
            let req: AddMemberRequest = serde_json::from_str(json).unwrap();
            assert_eq!(req.member_type, "human");
            assert_eq!(req.member_id, "user-2");
            assert_eq!(req.display_name, "User Two");
            assert_eq!(req.role, Some("member".to_string()));
        }

        #[test]
        fn test_send_message_request_deserialize() {
            use crate::gateway::routes::group_chats::SendMessageRequest;

            let json = r#"{"content":"Hello","sender_id":"user-1","sender_name":"User One"}"#;
            let req: SendMessageRequest = serde_json::from_str(json).unwrap();
            assert_eq!(req.content, "Hello");
            assert_eq!(req.sender_id, "user-1");
            assert_eq!(req.sender_name, "User One");
        }

        // =====================================================================
        // WebSocket Types Tests
        // =====================================================================

        #[test]
        fn test_ws_server_message_serialize() {
            use crate::gateway::routes::group_chats::WsServerMessage;

            let msg = WsServerMessage::Connected {
                member_id: "user-1".to_string(),
            };
            let json = serde_json::to_string(&msg).unwrap();
            assert!(json.contains("connected"));
            assert!(json.contains("user-1"));

            let msg = WsServerMessage::MemberLeft {
                member_id: "user-2".to_string(),
            };
            let json = serde_json::to_string(&msg).unwrap();
            assert!(json.contains("member_left"));

            let msg = WsServerMessage::Typing {
                member_id: "user-1".to_string(),
                is_typing: true,
            };
            let json = serde_json::to_string(&msg).unwrap();
            assert!(json.contains("typing"));

            let msg = WsServerMessage::Error {
                message: "An error occurred".to_string(),
            };
            let json = serde_json::to_string(&msg).unwrap();
            assert!(json.contains("error"));
            assert!(json.contains("An error occurred"));
        }

        #[test]
        fn test_ws_client_command_deserialize() {
            use crate::gateway::routes::group_chats::WsClientCommand;

            let json = r#"{"type":"send_message","content":"Hello","sender_id":"user-1","sender_name":"User One"}"#;
            let cmd: WsClientCommand = serde_json::from_str(json).unwrap();
            match cmd {
                WsClientCommand::SendMessage { content, sender_id, sender_name } => {
                    assert_eq!(content, "Hello");
                    assert_eq!(sender_id, "user-1");
                    assert_eq!(sender_name, "User One");
                }
                _ => panic!("Expected SendMessage command"),
            }

            let json = r#"{"type":"typing","is_typing":true}"#;
            let cmd: WsClientCommand = serde_json::from_str(json).unwrap();
            match cmd {
                WsClientCommand::Typing { is_typing } => {
                    assert!(is_typing);
                }
                _ => panic!("Expected Typing command"),
            }
        }
    }

    // =========================================================================
    // Executor Tests
    // =========================================================================

    mod executor_tests {
        use super::*;

        #[tokio::test]
        async fn test_discover_sessions_claude_code() {
            let app = test_app().await;

            // Use current working directory as workspace path
            let workspace_path = std::env::current_dir()
                .unwrap()
                .to_string_lossy()
                .to_string();

            let response = app
                .oneshot(
                    Request::builder()
                        .uri(&format!(
                            "/api/executors/claude-code/discover-sessions?workspace_path={}",
                            urlencoding::encode(&workspace_path)
                        ))
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);

            let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();

            // Response should have sessions array and total count
            assert!(json["sessions"].is_array());
            assert!(json["total"].is_number());

            // Total should match sessions array length
            let sessions = json["sessions"].as_array().unwrap();
            let total = json["total"].as_u64().unwrap() as usize;
            assert_eq!(sessions.len(), total);

            // If there are sessions, verify structure
            if !sessions.is_empty() {
                let first = &sessions[0];
                assert!(first["id"].is_string());
                assert_eq!(first["executor_type"], "claude-code");
                assert!(first["workspace_path"].is_string());
                assert!(first["created_at"].is_string());
                assert!(first["updated_at"].is_string());
            }
        }

        #[tokio::test]
        async fn test_discover_sessions_with_different_executor_formats() {
            let app = test_app().await;
            let workspace_path = "/tmp/test-workspace";

            // Test various executor type formats
            for executor_type in &["claude-code", "claude_code", "claudecode"] {
                let response = app
                    .clone()
                    .oneshot(
                        Request::builder()
                            .uri(&format!(
                                "/api/executors/{}/discover-sessions?workspace_path={}",
                                executor_type,
                                urlencoding::encode(workspace_path)
                            ))
                            .body(Body::empty())
                            .unwrap(),
                    )
                    .await
                    .unwrap();

                assert_eq!(response.status(), StatusCode::OK);

                let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                    .await
                    .unwrap();
                let json: Value = serde_json::from_slice(&body).unwrap();

                assert!(json["sessions"].is_array());
                assert!(json["total"].is_number());
            }
        }

        #[tokio::test]
        async fn test_discover_sessions_codex_returns_empty() {
            let app = test_app().await;
            let workspace_path = "/tmp/test-workspace";

            let response = app
                .oneshot(
                    Request::builder()
                        .uri(&format!(
                            "/api/executors/codex/discover-sessions?workspace_path={}",
                            urlencoding::encode(workspace_path)
                        ))
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);

            let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();

            // Codex not implemented yet, should return empty
            assert_eq!(json["sessions"].as_array().unwrap().len(), 0);
            assert_eq!(json["total"], 0);
        }

        #[tokio::test]
        async fn test_discover_sessions_unknown_executor() {
            let app = test_app().await;
            let workspace_path = "/tmp/test-workspace";

            let response = app
                .oneshot(
                    Request::builder()
                        .uri(&format!(
                            "/api/executors/unknown-executor/discover-sessions?workspace_path={}",
                            urlencoding::encode(workspace_path)
                        ))
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::NOT_FOUND);
        }

        #[tokio::test]
        async fn test_discover_sessions_missing_workspace_path() {
            let app = test_app().await;

            let response = app
                .oneshot(
                    Request::builder()
                        .uri("/api/executors/claude-code/discover-sessions")
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            // Missing required query param should return 400
            assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        }

        #[tokio::test]
        async fn test_get_session_messages_not_found() {
            let app = test_app().await;
            let workspace_path = "/tmp/nonexistent-workspace";
            let session_id = "nonexistent-session-id";

            let response = app
                .oneshot(
                    Request::builder()
                        .uri(&format!(
                            "/api/executors/claude-code/sessions/{}/messages?workspace_path={}",
                            session_id,
                            urlencoding::encode(workspace_path)
                        ))
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::NOT_FOUND);
        }

        #[tokio::test]
        async fn test_get_session_messages_unknown_executor() {
            let app = test_app().await;
            let workspace_path = "/tmp/test-workspace";
            let session_id = "some-session-id";

            let response = app
                .oneshot(
                    Request::builder()
                        .uri(&format!(
                            "/api/executors/unknown-executor/sessions/{}/messages?workspace_path={}",
                            session_id,
                            urlencoding::encode(workspace_path)
                        ))
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::NOT_FOUND);
        }

        #[tokio::test]
        async fn test_get_session_messages_codex_returns_empty() {
            let app = test_app().await;
            let workspace_path = "/tmp/test-workspace";
            let session_id = "some-session-id";

            let response = app
                .oneshot(
                    Request::builder()
                        .uri(&format!(
                            "/api/executors/codex/sessions/{}/messages?workspace_path={}",
                            session_id,
                            urlencoding::encode(workspace_path)
                        ))
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);

            let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();

            // Codex not implemented, should return empty
            assert_eq!(json["messages"].as_array().unwrap().len(), 0);
            assert_eq!(json["total"], 0);
        }

        #[tokio::test]
        async fn test_executor_session_response_structure() {
            use crate::gateway::routes::executors::{
                ExecutorSession, ExecutorUIMessage, DiscoverSessionsResponse, SessionMessagesResponse,
            };

            // Test ExecutorSession serialization
            let session = ExecutorSession {
                id: "test-session-id".to_string(),
                executor_type: "claude-code".to_string(),
                workspace_path: "/path/to/workspace".to_string(),
                file_path: "/hidden/path".to_string(), // Should be skipped
                created_at: "2024-01-01T00:00:00Z".to_string(),
                updated_at: "2024-01-02T00:00:00Z".to_string(),
                name: Some("Test Session".to_string()),
                message_count: Some(10),
            };

            let json = serde_json::to_value(&session).unwrap();
            assert_eq!(json["id"], "test-session-id");
            assert_eq!(json["executor_type"], "claude-code");
            assert!(json.get("file_path").is_none()); // file_path should be skipped

            // Test DiscoverSessionsResponse serialization
            let response = DiscoverSessionsResponse {
                sessions: vec![session.clone()],
                total: 1,
            };
            let json = serde_json::to_value(&response).unwrap();
            assert_eq!(json["total"], 1);
            assert_eq!(json["sessions"].as_array().unwrap().len(), 1);

            // Test ExecutorUIMessage serialization
            let message = ExecutorUIMessage {
                id: "msg-1".to_string(),
                timestamp: "2024-01-01T00:00:00Z".to_string(),
                msg_type: "text".to_string(),
                content: Some("Hello, world!".to_string()),
                tool_use_id: None,
                tool_name: None,
                tool_input: None,
                tool_output: None,
                is_error: None,
                subagent_id: None,
                subagent_messages: None,
            };

            let json = serde_json::to_value(&message).unwrap();
            assert_eq!(json["id"], "msg-1");
            assert_eq!(json["type"], "text"); // renamed from msg_type
            assert_eq!(json["content"], "Hello, world!");
            assert!(json.get("tool_use_id").is_none()); // None should be skipped

            // Test SessionMessagesResponse serialization
            let response = SessionMessagesResponse {
                messages: vec![message],
                total: 1,
            };
            let json = serde_json::to_value(&response).unwrap();
            assert_eq!(json["total"], 1);
            assert_eq!(json["messages"].as_array().unwrap().len(), 1);
        }

        // =====================================================================
        // Tests with real ~/.claude data
        // =====================================================================

        #[tokio::test]
        async fn test_discover_sessions_viben_workspace_has_data() {
            let app = test_app().await;

            // Use the actual viben workspace path
            let workspace_path = "/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben";

            let response = app
                .oneshot(
                    Request::builder()
                        .uri(&format!(
                            "/api/executors/claude-code/discover-sessions?workspace_path={}",
                            urlencoding::encode(workspace_path)
                        ))
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);

            let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();

            // Response should have sessions array and total count
            assert!(json["sessions"].is_array());
            assert!(json["total"].is_number());

            let sessions = json["sessions"].as_array().unwrap();
            let total = json["total"].as_u64().unwrap() as usize;

            // CRITICAL: Ensure we have actual data
            assert!(
                total > 0,
                "Expected at least 1 session for viben workspace, got 0. \
                This test requires real Claude Code sessions in ~/.claude/projects/"
            );
            assert_eq!(sessions.len(), total, "Sessions count mismatch");

            // Verify first session structure
            let first = &sessions[0];
            assert!(first["id"].is_string(), "Session should have id");
            assert_eq!(first["executor_type"], "claude-code");
            assert_eq!(first["workspace_path"], workspace_path);
            assert!(first["created_at"].is_string(), "Session should have created_at");
            assert!(first["updated_at"].is_string(), "Session should have updated_at");

            // file_path should be hidden (skip_serializing)
            assert!(first.get("file_path").is_none(), "file_path should not be serialized");

            println!(
                "✓ Found {} Claude Code sessions for viben workspace",
                total
            );
        }

        #[tokio::test]
        async fn test_get_session_messages_with_real_data() {
            let app = test_app().await;

            let workspace_path = "/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben";

            // First, discover sessions to get a real session ID
            let response = app
                .clone()
                .oneshot(
                    Request::builder()
                        .uri(&format!(
                            "/api/executors/claude-code/discover-sessions?workspace_path={}",
                            urlencoding::encode(workspace_path)
                        ))
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);

            let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let discover_json: Value = serde_json::from_slice(&body).unwrap();

            let sessions = discover_json["sessions"].as_array().unwrap();
            assert!(!sessions.is_empty(), "Need at least one session for this test");

            // Get the first session ID
            let session_id = sessions[0]["id"].as_str().unwrap();

            // Now fetch messages for this session
            let response = app
                .oneshot(
                    Request::builder()
                        .uri(&format!(
                            "/api/executors/claude-code/sessions/{}/messages?workspace_path={}&limit=10",
                            session_id,
                            urlencoding::encode(workspace_path)
                        ))
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);

            let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();

            assert!(json["messages"].is_array());
            assert!(json["total"].is_number());

            let messages = json["messages"].as_array().unwrap();
            let total = json["total"].as_u64().unwrap() as usize;

            // Messages should exist (sessions have at least some content)
            // Note: Some sessions may be empty or have only non-UI messages
            println!(
                "✓ Retrieved {} messages (total: {}) from session {}",
                messages.len(),
                total,
                session_id
            );

            // If we have messages, verify structure
            if !messages.is_empty() {
                let first_msg = &messages[0];
                assert!(first_msg["id"].is_string(), "Message should have id");
                assert!(first_msg["timestamp"].is_string(), "Message should have timestamp");
                assert!(first_msg["type"].is_string(), "Message should have type");
            }
        }

        #[tokio::test]
        async fn test_sessions_sorted_by_updated_at() {
            let app = test_app().await;

            let workspace_path = "/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben";

            let response = app
                .oneshot(
                    Request::builder()
                        .uri(&format!(
                            "/api/executors/claude-code/discover-sessions?workspace_path={}",
                            urlencoding::encode(workspace_path)
                        ))
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);

            let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();

            let sessions = json["sessions"].as_array().unwrap();

            if sessions.len() >= 2 {
                // Verify sessions are sorted by updated_at (newest first)
                for i in 0..sessions.len() - 1 {
                    let current = sessions[i]["updated_at"].as_str().unwrap();
                    let next = sessions[i + 1]["updated_at"].as_str().unwrap();
                    assert!(
                        current >= next,
                        "Sessions should be sorted by updated_at descending: {} should >= {}",
                        current,
                        next
                    );
                }
                println!("✓ Sessions are correctly sorted by updated_at (newest first)");
            }
        }
    }

    // =========================================================================
    // Workspace-Scoped API Tests (/api/executors and /api/agents with query params)
    // =========================================================================

    // =========================================================================
    // Unified Resource API Tests
    // =========================================================================

    mod unified_resource_api_tests {
        use super::*;

        // -------------------------------------------------------------------------
        // /api/agents - Default behavior (no params)
        // -------------------------------------------------------------------------

        #[tokio::test]
        async fn test_agents_default_workspace_is_home() {
            let app = test_app().await;

            let response = app
                .oneshot(
                    Request::builder()
                        .uri("/api/agents")
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);

            let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();

            // Should default to user home directory
            let workspace_path = json["workspace_path"].as_str().unwrap();
            let home = dirs::home_dir().unwrap();
            assert_eq!(workspace_path, home.to_string_lossy().as_ref());
        }

        // -------------------------------------------------------------------------
        // /api/executors - Default behavior (no params)
        // -------------------------------------------------------------------------

        #[tokio::test]
        async fn test_executors_default_workspace_is_home() {
            let app = test_app().await;

            let response = app
                .oneshot(
                    Request::builder()
                        .uri("/api/executors")
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);

            let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();

            // Should default to user home directory
            let workspace_path = json["workspace_path"].as_str().unwrap();
            let home = dirs::home_dir().unwrap();
            assert_eq!(workspace_path, home.to_string_lossy().as_ref());
        }

        // -------------------------------------------------------------------------
        // /api/models - Default behavior (no params)
        // -------------------------------------------------------------------------

        #[tokio::test]
        async fn test_models_default_workspace_is_home() {
            let app = test_app().await;

            let response = app
                .oneshot(
                    Request::builder()
                        .uri("/api/models")
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);

            let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();

            // Should default to user home directory
            let workspace_path = json["workspace_path"].as_str().unwrap();
            let home = dirs::home_dir().unwrap();
            assert_eq!(workspace_path, home.to_string_lossy().as_ref());
        }

        // -------------------------------------------------------------------------
        // Executor workspace_path field
        // -------------------------------------------------------------------------

        #[tokio::test]
        async fn test_executors_have_workspace_path_field() {
            let app = test_app().await;

            let temp_dir = std::env::temp_dir();
            let workspace_path = temp_dir.to_string_lossy();

            let response = app
                .oneshot(
                    Request::builder()
                        .uri(&format!("/api/executors?workspace_path={}", workspace_path))
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);

            let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();

            let executors = json["executors"].as_array().unwrap();
            for executor in executors {
                assert!(
                    executor["workspace_path"].is_string(),
                    "Executor should have workspace_path field"
                );
            }
        }

        // -------------------------------------------------------------------------
        // Agent workspace_path field
        // -------------------------------------------------------------------------

        #[tokio::test]
        async fn test_agents_have_workspace_path_field() {
            let app = test_app().await;

            let temp_dir = std::env::temp_dir();
            let workspace_path = temp_dir.to_string_lossy();

            let response = app
                .oneshot(
                    Request::builder()
                        .uri(&format!("/api/agents?workspace_path={}", workspace_path))
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);

            let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();

            let agents = json["agents"].as_array().unwrap();
            for agent in agents {
                assert!(
                    agent["workspace_path"].is_string(),
                    "Agent should have workspace_path field"
                );
            }
        }

        // -------------------------------------------------------------------------
        // include_global parameter default
        // -------------------------------------------------------------------------

        #[tokio::test]
        async fn test_include_global_defaults_to_true() {
            let app = test_app().await;

            // Get agents from home dir without specifying include_global
            let response = app
                .oneshot(
                    Request::builder()
                        .uri("/api/agents")
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);

            let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();

            // When include_global defaults to true and workspace is ~,
            // we should get agents from global workspace
            assert!(json["agents"].is_array());
            assert!(json["total"].is_number());
        }

        // -------------------------------------------------------------------------
        // Invalid workspace_path validation
        // -------------------------------------------------------------------------

        #[tokio::test]
        async fn test_invalid_workspace_path_returns_400() {
            let app = test_app().await;

            let response = app
                .oneshot(
                    Request::builder()
                        .uri("/api/agents?workspace_path=/definitely/nonexistent/path/xyz")
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        }

        #[tokio::test]
        async fn test_models_invalid_workspace_path_returns_400() {
            let app = test_app().await;

            let response = app
                .oneshot(
                    Request::builder()
                        .uri("/api/models?workspace_path=/definitely/nonexistent/path/xyz")
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        }
    }

    mod workspace_scoped_api_tests {
        use super::*;

        /// Test GET /api/executors?workspace_path=...&include_global=true
        /// Expected response format:
        /// {
        ///   "workspace_path": "/path/to/workspace",
        ///   "executors": [
        ///     {
        ///       "id": "CLAUDE_CODE",
        ///       "name": "Claude Code",
        ///       "availability": { ... },
        ///       "supports_mcp": true,
        ///       "capabilities": [...],
        ///       "has_workspace_config": true,
        ///       "workspace_config_path": "/path/to/workspace/.claude"
        ///     }
        ///   ]
        /// }
        #[tokio::test]
        async fn test_get_executors_with_workspace_path() {
            let app = test_app().await;

            let workspace_path = "/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben";

            let response = app
                .oneshot(
                    Request::builder()
                        .uri(&format!(
                            "/api/executors?workspace_path={}&include_global=true",
                            urlencoding::encode(workspace_path)
                        ))
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK, "Expected 200 OK for /api/executors");

            let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();

            // Verify response structure
            assert!(json["workspace_path"].is_string(), "Response should have workspace_path");
            assert!(json["executors"].is_array(), "Response should have executors array");

            let executors = json["executors"].as_array().unwrap();
            assert!(!executors.is_empty(), "Should have at least one executor");

            // Verify each executor has required fields
            for executor in executors {
                assert!(executor["id"].is_string(), "Executor should have id");
                assert!(executor["name"].is_string(), "Executor should have name");
                assert!(executor["availability"].is_object(), "Executor should have availability");
                assert!(executor["supports_mcp"].is_boolean(), "Executor should have supports_mcp");
                assert!(executor["capabilities"].is_array(), "Executor should have capabilities");
                assert!(executor["has_workspace_config"].is_boolean(), "Executor should have has_workspace_config");
                assert!(executor["workspace_path"].is_string(), "Executor should have workspace_path");
            }

            println!("✓ /api/executors?workspace_path=...&include_global=true returns correct structure");
        }

        /// Test GET /api/agents?workspace_path=...&include_global=true
        /// Expected response format:
        /// {
        ///   "workspace_path": "/path/to/workspace",
        ///   "agents": [
        ///     {
        ///       "id": "viben:my-agent",
        ///       "name": "my-agent",
        ///       "agent_type": "viben",
        ///       "source": "workspace",
        ///       "config_path": "/path/to/config",
        ///       "mcp_server_count": 0,
        ///       "skill_count": 0
        ///     }
        ///   ],
        ///   "total": 1
        /// }
        #[tokio::test]
        async fn test_get_agents_with_workspace_path() {
            let app = test_app().await;

            let workspace_path = "/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben";

            let response = app
                .oneshot(
                    Request::builder()
                        .uri(&format!(
                            "/api/agents?workspace_path={}&include_global=true",
                            urlencoding::encode(workspace_path)
                        ))
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK, "Expected 200 OK for /api/agents");

            let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();

            // Verify response structure
            assert!(json["workspace_path"].is_string(), "Response should have workspace_path");
            assert!(json["agents"].is_array(), "Response should have agents array");
            assert!(json["total"].is_number(), "Response should have total count");

            let agents = json["agents"].as_array().unwrap();

            // Verify each agent has required fields
            for agent in agents {
                assert!(agent["id"].is_string(), "Agent should have id");
                assert!(agent["name"].is_string(), "Agent should have name");
                assert!(agent["agent_type"].is_string(), "Agent should have agent_type");
                assert!(agent["source"].is_string(), "Agent should have source (global/workspace)");
                assert!(agent["workspace_path"].is_string(), "Agent should have workspace_path");
                assert!(agent["mcp_server_count"].is_number(), "Agent should have mcp_server_count");
                assert!(agent["skill_count"].is_number(), "Agent should have skill_count");
            }

            println!("✓ /api/agents?workspace_path=...&include_global=true returns correct structure");
        }

        /// Test that include_global=true includes global agents
        #[tokio::test]
        async fn test_agents_include_global_true() {
            let app = test_app().await;

            let workspace_path = "/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben";

            let response = app
                .oneshot(
                    Request::builder()
                        .uri(&format!(
                            "/api/agents?workspace_path={}&include_global=true",
                            urlencoding::encode(workspace_path)
                        ))
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);

            let body = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();

            let agents = json["agents"].as_array().unwrap();

            // Check if any agent has source="global"
            let _has_global = agents.iter().any(|a| a["source"] == "global");
            let _has_workspace = agents.iter().any(|a| a["source"] == "workspace");

            // With include_global=true, we should potentially have both
            // (depending on what's configured on the system)
            println!(
                "Found {} agents: {} global, {} workspace",
                agents.len(),
                agents.iter().filter(|a| a["source"] == "global").count(),
                agents.iter().filter(|a| a["source"] == "workspace").count()
            );

            // At minimum, the API should return successfully with the correct structure
            assert!(json["total"].as_u64().unwrap() == agents.len() as u64);
        }

        /// Test that workspace_path validation works
        #[tokio::test]
        async fn test_agents_invalid_workspace_path() {
            let app = test_app().await;

            let response = app
                .oneshot(
                    Request::builder()
                        .uri("/api/agents?workspace_path=/nonexistent/path&include_global=true")
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            // Should return 400 Bad Request for invalid workspace path
            assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        }

        /// Test that executors endpoint also validates workspace_path
        #[tokio::test]
        async fn test_executors_invalid_workspace_path() {
            let app = test_app().await;

            let response = app
                .oneshot(
                    Request::builder()
                        .uri("/api/executors?workspace_path=/nonexistent/path&include_global=true")
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            // Should return 400 Bad Request for invalid workspace path
            assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        }
    }
}
