import { invoke } from "@tauri-apps/api/core";

export async function listOllamaModels(): Promise<string[]> {
	return invoke<string[]>("list_ollama_models");
}

export async function checkOllamaHealth(): Promise<boolean> {
	return invoke<boolean>("check_ollama_health");
}

export async function startReasoningStream(
	model: string,
	prompt: string,
	temperature?: number,
): Promise<void> {
	return invoke("start_reasoning_stream", { model, prompt, temperature });
}

export async function cancelStream(): Promise<void> {
	return invoke("cancel_stream");
}
