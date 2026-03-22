use std::sync::{Arc, Mutex};

use tauri::Emitter;
use tokio_util::sync::CancellationToken;

use crate::ollama;
use crate::types::{StreamState, StreamStatus};

pub struct ActiveStream(pub Arc<Mutex<Option<CancellationToken>>>);

#[tauri::command]
pub async fn list_ollama_models() -> Result<Vec<String>, String> {
    ollama::list_models().await
}

#[tauri::command]
pub async fn check_ollama_health() -> Result<bool, String> {
    ollama::health_check().await
}

#[tauri::command]
pub async fn start_reasoning_stream(
    app: tauri::AppHandle,
    state: tauri::State<'_, ActiveStream>,
    model: String,
    prompt: String,
) -> Result<(), String> {
    // Cancel any existing stream
    if let Ok(mut guard) = state.0.lock() {
        if let Some(token) = guard.take() {
            token.cancel();
        }
    }

    let cancel_token = CancellationToken::new();
    {
        let mut guard = state.0.lock().map_err(|e| format!("Lock error: {e}"))?;
        *guard = Some(cancel_token.clone());
    }

    let mut rx = ollama::generate_stream(model, prompt).await?;

    tokio::spawn(async move {
        loop {
            tokio::select! {
                _ = cancel_token.cancelled() => {
                    let _ = app.emit("stream-complete", StreamStatus {
                        state: StreamState::Cancelled,
                        message: "Stream cancelled by user".into(),
                    });
                    break;
                }
                chunk = rx.recv() => {
                    match chunk {
                        Some(Ok(c)) => {
                            // Phase 0: emit raw tokens — parser wiring comes in Session 2
                            // DeepSeek-R1 sends thinking in a separate field
                            if let Some(ref thinking) = c.thinking {
                                if !thinking.is_empty() {
                                    let _ = app.emit("raw-thinking", thinking);
                                }
                            }
                            if !c.response.is_empty() {
                                let _ = app.emit("raw-token", &c.response);
                            }
                            if c.done {
                                let _ = app.emit("stream-complete", StreamStatus {
                                    state: StreamState::Complete,
                                    message: "done".into(),
                                });
                                break;
                            }
                        }
                        Some(Err(e)) => {
                            let _ = app.emit("stream-error", StreamStatus {
                                state: StreamState::Error,
                                message: e,
                            });
                            break;
                        }
                        None => {
                            let _ = app.emit("stream-complete", StreamStatus {
                                state: StreamState::Complete,
                                message: "Stream ended".into(),
                            });
                            break;
                        }
                    }
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn cancel_stream(
    state: tauri::State<'_, ActiveStream>,
) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|e| format!("Lock error: {e}"))?;
    if let Some(token) = guard.take() {
        token.cancel();
    }
    Ok(())
}
