use std::sync::{Arc, Mutex};

use tauri::Emitter;
use tokio_util::sync::CancellationToken;

use crate::cot_parser::CotParser;
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
    temperature: Option<f64>,
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

    let mut rx = ollama::generate_stream(model, prompt, temperature).await?;

    tokio::spawn(async move {
        let mut parser = CotParser::new();
        let mut thinking_finished = false;

        loop {
            tokio::select! {
                _ = cancel_token.cancelled() => {
                    // Flush any buffered parser state before cancelling
                    for event in parser.finish() {
                        let _ = app.emit("reasoning-event", &event);
                    }
                    let _ = app.emit("stream-complete", StreamStatus {
                        state: StreamState::Cancelled,
                        message: "Stream cancelled by user".into(),
                    });
                    break;
                }
                chunk = rx.recv() => {
                    match chunk {
                        Some(Ok(c)) => {
                            // Feed thinking tokens to parser
                            if let Some(ref thinking) = c.thinking {
                                if !thinking.is_empty() {
                                    for event in parser.feed_thinking(thinking) {
                                        let _ = app.emit("reasoning-event", &event);
                                    }
                                }
                            }

                            // Transition: first response token ends thinking phase
                            if !c.response.is_empty() {
                                if !thinking_finished {
                                    for event in parser.finish_thinking() {
                                        let _ = app.emit("reasoning-event", &event);
                                    }
                                    thinking_finished = true;
                                }
                                for event in parser.feed_response(&c.response) {
                                    let _ = app.emit("reasoning-event", &event);
                                }
                            }

                            if c.done {
                                for event in parser.finish() {
                                    let _ = app.emit("reasoning-event", &event);
                                }
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
                            for event in parser.finish() {
                                let _ = app.emit("reasoning-event", &event);
                            }
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
