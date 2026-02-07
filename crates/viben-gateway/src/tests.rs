//! Gateway tests - 100% coverage

#[cfg(test)]
mod tests {
    use axum::{
        body::Body,
        http::{Request, StatusCode},
    };
    use tower::ServiceExt;
    use serde_json::{json, Value};

    use crate::{error::GatewayError, routes, state::AppState};

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
        async fn test_list_agents() {
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

            let agents = json["agents"].as_array().unwrap();
            assert!(agents.contains(&json!("CLAUDE_CODE")));
            assert!(agents.contains(&json!("AMP")));
            assert!(agents.contains(&json!("GEMINI")));
            assert!(agents.contains(&json!("CODEX")));
            assert!(agents.contains(&json!("OPENCODE")));
            assert!(agents.contains(&json!("CURSOR_AGENT")));
            assert!(agents.contains(&json!("QWEN_CODE")));
            assert!(agents.contains(&json!("COPILOT")));
            assert!(agents.contains(&json!("DROID")));
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

            let body = serde_json::to_string(&json!({
                "title": "Test Task",
                "description": "A test task description",
                "agent_id": "test-agent"
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
            assert_eq!(json["agent_id"], "test-agent");
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
        async fn test_delete_task() {
            let app = test_app().await;

            let response = app
                .oneshot(
                    Request::builder()
                        .method("DELETE")
                        .uri("/api/tasks/test-task-id")
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

            assert_eq!(json["deleted"], "test-task-id");
        }
    }

    // =========================================================================
    // Session Routes Tests
    // =========================================================================

    mod session_tests {
        use super::*;

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
            let app = test_app().await;

            let body = serde_json::to_string(&json!({
                "agent_id": "test-agent",
                "task_id": "test-task",
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
            assert_eq!(json["agent_id"], "test-agent");
            assert_eq!(json["task_id"], "test-task");
            assert_eq!(json["status"], "active");
        }

        #[tokio::test]
        async fn test_create_session_minimal() {
            let app = test_app().await;

            let body = serde_json::to_string(&json!({
                "agent_id": "test-agent"
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

            assert_eq!(json["agent_id"], "test-agent");
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
        async fn test_send_message() {
            let app = test_app().await;

            let body = serde_json::to_string(&json!({
                "content": "Hello, agent!"
            }))
            .unwrap();

            let response = app
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri("/api/sessions/test-session/message")
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

            assert_eq!(json["session_id"], "test-session");
            assert_eq!(json["status"], "message_sent");
        }

        #[tokio::test]
        async fn test_delete_session() {
            let app = test_app().await;

            let response = app
                .oneshot(
                    Request::builder()
                        .method("DELETE")
                        .uri("/api/sessions/test-session-id")
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

            assert_eq!(json["deleted"], "test-session-id");
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
            let db = viben_db::DbService::new().await.unwrap();
            let events = viben_services::EventService::new();
            let container = viben_services::ContainerService::new(events.clone());

            let state = AppState::new(db, events, container);

            // Just verify it was created (no panic)
            assert!(std::sync::Arc::strong_count(&state.db) >= 1);
            assert!(std::sync::Arc::strong_count(&state.events) >= 1);
            assert!(std::sync::Arc::strong_count(&state.container) >= 1);
        }
    }

    // =========================================================================
    // WebSocket Message Types Tests
    // =========================================================================

    mod ws_message_tests {
        use crate::routes::ws::WsMessage;
        use crate::ws::handler::{ClientMessage, ServerMessage};

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
        use crate::routes::agents::AgentDetails;
        use viben_executors::AvailabilityInfo;

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
        use crate::routes::tasks::TaskResponse;

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
        use crate::routes::sessions::SessionResponse;

        #[test]
        fn test_session_response_serialize() {
            let response = SessionResponse {
                id: "session-1".to_string(),
                agent_id: "agent-1".to_string(),
                task_id: Some("task-1".to_string()),
                status: "active".to_string(),
            };

            let json = serde_json::to_string(&response).unwrap();
            assert!(json.contains("session-1"));
            assert!(json.contains("agent-1"));
            assert!(json.contains("task-1"));
            assert!(json.contains("active"));
        }

        #[test]
        fn test_session_response_serialize_minimal() {
            let response = SessionResponse {
                id: "session-1".to_string(),
                agent_id: "agent-1".to_string(),
                task_id: None,
                status: "active".to_string(),
            };

            let json = serde_json::to_string(&response).unwrap();
            assert!(json.contains("session-1"));
            assert!(json.contains("agent-1"));
        }
    }

    // =========================================================================
    // Request Deserialization Tests
    // =========================================================================

    mod request_tests {
        use crate::routes::agents::{SpawnAgentRequest, StopAgentRequest};
        use crate::routes::sessions::{CreateSessionRequest, SendMessageRequest};
        use crate::routes::tasks::{CreateTaskRequest, UpdateTaskRequest};

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
}
