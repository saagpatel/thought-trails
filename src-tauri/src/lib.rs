use std::sync::{Arc, Mutex};

mod commands;
mod cot_parser;
mod ollama;
mod types;

pub fn run() {
    tauri::Builder::default()
        .manage(commands::ollama::ActiveStream(Arc::new(Mutex::new(None))))
        .invoke_handler(tauri::generate_handler![
            commands::ollama::list_ollama_models,
            commands::ollama::check_ollama_health,
            commands::ollama::start_reasoning_stream,
            commands::ollama::cancel_stream,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
