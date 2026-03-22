use crate::session;

#[tauri::command]
pub async fn save_session(
    app: tauri::AppHandle,
    session_json: String,
    id: String,
) -> Result<(), String> {
    session::save(&app, &session_json, &id)
}

#[tauri::command]
pub async fn load_session(app: tauri::AppHandle, id: String) -> Result<String, String> {
    session::load(&app, &id)
}

#[tauri::command]
pub async fn delete_session(app: tauri::AppHandle, id: String) -> Result<(), String> {
    session::delete(&app, &id)
}

#[tauri::command]
pub async fn list_sessions(app: tauri::AppHandle) -> Result<String, String> {
    session::list(&app)
}
