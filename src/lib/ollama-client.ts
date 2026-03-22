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
	streamId?: string,
): Promise<void> {
	return invoke("start_reasoning_stream", {
		model,
		prompt,
		temperature,
		streamId,
	});
}

export async function cancelStream(streamId?: string): Promise<void> {
	return invoke("cancel_stream", { streamId });
}
