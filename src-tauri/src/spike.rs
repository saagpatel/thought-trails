#[cfg(debug_assertions)]
pub mod spike_logger {
    use std::fs;
    use std::io::Write;
    use std::path::PathBuf;

    fn fixtures_dir() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .expect("src-tauri must have a parent directory")
            .join("fixtures/deepseek-samples")
    }

    pub fn log_chunk(sample_name: &str, chunk_json: &str) -> Result<(), String> {
        let dir = fixtures_dir();
        fs::create_dir_all(&dir).map_err(|e| format!("Failed to create fixtures dir: {e}"))?;

        let path = dir.join(format!("{sample_name}.ndjson"));
        let mut file = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(path)
            .map_err(|e| format!("Failed to open fixture file: {e}"))?;

        writeln!(file, "{chunk_json}").map_err(|e| format!("Failed to write chunk: {e}"))?;
        Ok(())
    }
}
