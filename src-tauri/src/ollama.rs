use std::sync::OnceLock;

use futures_util::StreamExt;
use reqwest::Client;
use tokio::sync::mpsc;

use crate::types::{OllamaChunk, OllamaTagsResponse};

const OLLAMA_BASE_URL: &str = "http://localhost:11434";

fn client() -> &'static Client {
    static CLIENT: OnceLock<Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        Client::builder()
            .timeout(std::time::Duration::from_secs(5))
            .build()
            .expect("failed to create HTTP client")
    })
}

pub async fn health_check() -> Result<bool, String> {
    let url = format!("{OLLAMA_BASE_URL}/api/tags");
    match client().get(&url).send().await {
        Ok(resp) if resp.status().is_success() => Ok(true),
        Ok(resp) => Err(format!("Ollama returned status {}", resp.status())),
        Err(e) => Err(format!("Cannot reach Ollama at {OLLAMA_BASE_URL}: {e}")),
    }
}

pub async fn list_models() -> Result<Vec<String>, String> {
    let url = format!("{OLLAMA_BASE_URL}/api/tags");
    let resp = client()
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Cannot reach Ollama: {e}"))?;

    let tags: OllamaTagsResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Ollama response: {e}"))?;

    Ok(tags.models.into_iter().map(|m| m.name).collect())
}

pub async fn generate_stream(
    model: String,
    prompt: String,
) -> Result<mpsc::Receiver<Result<OllamaChunk, String>>, String> {
    let url = format!("{OLLAMA_BASE_URL}/api/generate");

    let body = serde_json::json!({
        "model": model,
        "prompt": prompt,
        "stream": true
    });

    let resp = Client::builder()
        .build()
        .map_err(|e| format!("Failed to create streaming client: {e}"))?
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Failed to connect to Ollama: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("Ollama returned status {}", resp.status()));
    }

    let (tx, rx) = mpsc::channel::<Result<OllamaChunk, String>>(256);

    tokio::spawn(async move {
        let mut stream = resp.bytes_stream();
        let mut buffer = String::new();

        while let Some(chunk_result) = stream.next().await {
            match chunk_result {
                Ok(bytes) => {
                    buffer.push_str(&String::from_utf8_lossy(&bytes));

                    // Split on newlines — each complete line is one NDJSON object
                    while let Some(newline_pos) = buffer.find('\n') {
                        let line: String = buffer.drain(..=newline_pos).collect();
                        let line = line.trim();
                        if line.is_empty() {
                            continue;
                        }

                        match serde_json::from_str::<OllamaChunk>(line) {
                            Ok(chunk) => {
                                let is_done = chunk.done;
                                if tx.send(Ok(chunk)).await.is_err() {
                                    return; // receiver dropped
                                }
                                if is_done {
                                    return;
                                }
                            }
                            Err(e) => {
                                let _ = tx
                                    .send(Err(format!("JSON parse error: {e}")))
                                    .await;
                                return;
                            }
                        }
                    }
                }
                Err(e) => {
                    let _ = tx.send(Err(format!("Stream error: {e}"))).await;
                    return;
                }
            }
        }
    });

    Ok(rx)
}
