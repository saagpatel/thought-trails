use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "kebab-case")]
pub enum ReasoningEventType {
    Claim,
    Evidence,
    Backtrack,
    Conclusion,
    ThinkStart,
    ThinkEnd,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReasoningEvent {
    pub r#type: ReasoningEventType,
    pub id: String,
    pub text: String,
    pub parent_id: Option<String>,
    pub target_id: Option<String>,
    pub timestamp: u64,
    pub token_index: usize,
}

#[derive(Debug, Deserialize)]
pub struct OllamaChunk {
    pub response: String,
    /// DeepSeek-R1 and other thinking models send CoT in a separate `thinking` field
    pub thinking: Option<String>,
    pub done: bool,
    #[allow(dead_code)]
    pub done_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamStatus {
    pub state: StreamState,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum StreamState {
    Complete,
    Error,
    Cancelled,
}

#[derive(Debug, Deserialize)]
pub struct OllamaTagsResponse {
    pub models: Vec<OllamaModel>,
}

#[derive(Debug, Deserialize)]
pub struct OllamaModel {
    pub name: String,
}
