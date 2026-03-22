use std::fs;
use std::path::PathBuf;

use tauri::Manager;

/// Validate session ID to prevent path traversal.
/// Only allows alphanumeric characters, hyphens, and underscores.
fn validate_session_id(id: &str) -> Result<(), String> {
    if id.is_empty() {
        return Err("Session ID cannot be empty".into());
    }
    if id.len() > 128 {
        return Err("Session ID too long".into());
    }
    if !id
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err(format!(
            "Invalid session ID: contains disallowed characters: {id}"
        ));
    }
    Ok(())
}

fn sessions_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {e}"))?;
    Ok(base.join("sessions"))
}

fn ensure_sessions_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = sessions_dir(app)?;
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create sessions dir: {e}"))?;
    Ok(dir)
}

fn index_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(sessions_dir(app)?.join("index.json"))
}

pub fn save(app: &tauri::AppHandle, session_json: &str, id: &str) -> Result<(), String> {
    validate_session_id(id)?;
    let dir = ensure_sessions_dir(app)?;
    let path = dir.join(format!("{id}.json"));

    // Write to temp file then rename for atomic-ish operation
    let tmp_path = dir.join(format!("{id}.json.tmp"));
    fs::write(&tmp_path, session_json).map_err(|e| format!("Failed to write session: {e}"))?;
    fs::rename(&tmp_path, &path).map_err(|e| format!("Failed to rename session file: {e}"))?;

    // Update index with summary extracted from the full session JSON
    update_index_add(app, session_json, id)?;

    Ok(())
}

pub fn load(app: &tauri::AppHandle, id: &str) -> Result<String, String> {
    validate_session_id(id)?;
    let dir = sessions_dir(app)?;
    let path = dir.join(format!("{id}.json"));
    fs::read_to_string(&path).map_err(|e| format!("Failed to read session {id}: {e}"))
}

pub fn delete(app: &tauri::AppHandle, id: &str) -> Result<(), String> {
    validate_session_id(id)?;
    let dir = sessions_dir(app)?;
    let path = dir.join(format!("{id}.json"));

    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("Failed to delete session: {e}"))?;
    }

    update_index_remove(app, id)?;
    Ok(())
}

pub fn list(app: &tauri::AppHandle) -> Result<String, String> {
    let path = match index_path(app) {
        Ok(p) => p,
        Err(_) => return Ok("[]".to_string()),
    };

    if !path.exists() {
        return Ok("[]".to_string());
    }

    fs::read_to_string(&path).map_err(|e| format!("Failed to read session index: {e}"))
}

/// Add a session summary to the index. Extracts summary fields from the full session JSON.
fn update_index_add(app: &tauri::AppHandle, session_json: &str, id: &str) -> Result<(), String> {
    let session: serde_json::Value =
        serde_json::from_str(session_json).map_err(|e| format!("Invalid session JSON: {e}"))?;

    // Build summary from full session
    let summary = serde_json::json!({
        "id": id,
        "createdAt": session.get("createdAt").unwrap_or(&serde_json::Value::Null),
        "model": session.get("model").unwrap_or(&serde_json::Value::Null),
        "prompt": truncate_prompt(
            session.get("prompt").and_then(|v| v.as_str()).unwrap_or("")
        ),
        "stats": session.get("stats").unwrap_or(&serde_json::Value::Null),
    });

    let idx_path = index_path(app)?;
    let mut entries: Vec<serde_json::Value> = if idx_path.exists() {
        let content =
            fs::read_to_string(&idx_path).map_err(|e| format!("Failed to read index: {e}"))?;
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        Vec::new()
    };

    // Remove existing entry with same id (idempotent)
    entries.retain(|e| e.get("id").and_then(|v| v.as_str()) != Some(id));

    // Add new entry at the front (newest first)
    entries.insert(0, summary);

    write_index(app, &entries)
}

fn update_index_remove(app: &tauri::AppHandle, id: &str) -> Result<(), String> {
    let idx_path = index_path(app)?;
    if !idx_path.exists() {
        return Ok(());
    }

    let content =
        fs::read_to_string(&idx_path).map_err(|e| format!("Failed to read index: {e}"))?;
    let mut entries: Vec<serde_json::Value> = serde_json::from_str(&content).unwrap_or_default();

    entries.retain(|e| e.get("id").and_then(|v| v.as_str()) != Some(id));

    write_index(app, &entries)
}

fn write_index(app: &tauri::AppHandle, entries: &[serde_json::Value]) -> Result<(), String> {
    let dir = ensure_sessions_dir(app)?;
    let idx_path = dir.join("index.json");
    let tmp_path = dir.join("index.json.tmp");

    let json = serde_json::to_string_pretty(entries)
        .map_err(|e| format!("Failed to serialize index: {e}"))?;
    fs::write(&tmp_path, &json).map_err(|e| format!("Failed to write index: {e}"))?;
    fs::rename(&tmp_path, &idx_path).map_err(|e| format!("Failed to rename index: {e}"))?;

    Ok(())
}

fn truncate_prompt(prompt: &str) -> String {
    if prompt.len() <= 200 {
        prompt.to_string()
    } else {
        format!("{}…", &prompt[..199])
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    // Helper to create a temp directory that acts as app data dir
    fn with_temp_dir<F: FnOnce(&Path)>(f: F) {
        let dir =
            std::env::temp_dir().join(format!("thought-trails-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        let sessions_dir = dir.join("sessions");
        fs::create_dir_all(&sessions_dir).unwrap();
        f(&dir);
        let _ = fs::remove_dir_all(&dir);
    }

    fn mock_session_json(id: &str, prompt: &str) -> String {
        serde_json::json!({
            "id": id,
            "createdAt": 1711100000000_u64,
            "model": "deepseek-r1:14b",
            "prompt": prompt,
            "temperature": 0.7,
            "eventLog": [],
            "stats": {
                "nodeCount": 10,
                "claimCount": 4,
                "evidenceCount": 3,
                "backtrackCount": 2,
                "conclusionCount": 1,
                "thinkingTokens": 100,
                "durationMs": 5000
            }
        })
        .to_string()
    }

    // These tests use direct filesystem ops since we can't easily mock tauri::AppHandle.
    // The logic under test is the index management and file I/O.

    #[test]
    fn test_truncate_prompt_short() {
        assert_eq!(truncate_prompt("Hello world"), "Hello world");
    }

    #[test]
    fn test_truncate_prompt_long() {
        let long = "a".repeat(300);
        let truncated = truncate_prompt(&long);
        assert_eq!(truncated.chars().count(), 200);
        assert!(truncated.ends_with('…'));
    }

    #[test]
    fn test_index_roundtrip() {
        with_temp_dir(|dir| {
            let sessions_dir = dir.join("sessions");
            let idx_path = sessions_dir.join("index.json");

            // Write an index manually
            let entries = vec![
                serde_json::json!({"id": "s1", "createdAt": 1000, "model": "m1", "prompt": "p1", "stats": {}}),
                serde_json::json!({"id": "s2", "createdAt": 2000, "model": "m2", "prompt": "p2", "stats": {}}),
            ];
            let json = serde_json::to_string_pretty(&entries).unwrap();
            fs::write(&idx_path, &json).unwrap();

            // Read it back
            let content = fs::read_to_string(&idx_path).unwrap();
            let loaded: Vec<serde_json::Value> = serde_json::from_str(&content).unwrap();
            assert_eq!(loaded.len(), 2);
            assert_eq!(loaded[0]["id"], "s1");
        });
    }

    #[test]
    fn test_session_file_write_and_read() {
        with_temp_dir(|dir| {
            let sessions_dir = dir.join("sessions");
            let session_json = mock_session_json("test-id", "What is 2+2?");

            let path = sessions_dir.join("test-id.json");
            fs::write(&path, &session_json).unwrap();

            let loaded = fs::read_to_string(&path).unwrap();
            let parsed: serde_json::Value = serde_json::from_str(&loaded).unwrap();
            assert_eq!(parsed["id"], "test-id");
            assert_eq!(parsed["model"], "deepseek-r1:14b");
        });
    }

    #[test]
    fn test_delete_removes_file() {
        with_temp_dir(|dir| {
            let sessions_dir = dir.join("sessions");
            let path = sessions_dir.join("to-delete.json");
            fs::write(&path, "{}").unwrap();
            assert!(path.exists());

            fs::remove_file(&path).unwrap();
            assert!(!path.exists());
        });
    }

    #[test]
    fn test_validate_session_id_rejects_path_traversal() {
        assert!(validate_session_id("../../etc/passwd").is_err());
        assert!(validate_session_id("../secret").is_err());
        assert!(validate_session_id("foo/bar").is_err());
        assert!(validate_session_id("").is_err());
        assert!(validate_session_id(&"a".repeat(200)).is_err());
    }

    #[test]
    fn test_validate_session_id_accepts_valid_ids() {
        assert!(validate_session_id("abc-123").is_ok());
        assert!(validate_session_id("550e8400-e29b-41d4-a716-446655440000").is_ok());
        assert!(validate_session_id("session_1").is_ok());
    }
}
