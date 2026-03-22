import type { UnlistenFn } from "@tauri-apps/api/event";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";
import { cancelStream, startReasoningStream } from "../lib/ollama-client";
import type { StreamStatus } from "../types";

type StreamingState = "idle" | "streaming" | "complete" | "error" | "cancelled";

export function useOllamaStream() {
	const [state, setState] = useState<StreamingState>("idle");
	const [tokenCount, setTokenCount] = useState(0);
	const [thinkingText, setThinkingText] = useState("");
	const [responseText, setResponseText] = useState("");
	const unlistenRefs = useRef<UnlistenFn[]>([]);

	useEffect(() => {
		let cancelled = false;

		async function setupListeners() {
			const unlistenThinking = await listen<string>("raw-thinking", (event) => {
				if (cancelled) return;
				console.log("[raw-thinking]", event.payload);
				setTokenCount((c) => c + 1);
				setThinkingText((t) => t + event.payload);
			});

			const unlistenToken = await listen<string>("raw-token", (event) => {
				if (cancelled) return;
				console.log("[raw-token]", event.payload);
				setTokenCount((c) => c + 1);
				setResponseText((t) => t + event.payload);
			});

			const unlistenComplete = await listen<StreamStatus>(
				"stream-complete",
				(event) => {
					if (cancelled) return;
					console.log("[stream-complete]", event.payload);
					setState(
						event.payload.state === "cancelled" ? "cancelled" : "complete",
					);
				},
			);

			const unlistenError = await listen<StreamStatus>(
				"stream-error",
				(event) => {
					if (cancelled) return;
					console.error("[stream-error]", event.payload);
					setState("error");
				},
			);

			if (!cancelled) {
				unlistenRefs.current = [
					unlistenThinking,
					unlistenToken,
					unlistenComplete,
					unlistenError,
				];
			} else {
				unlistenThinking();
				unlistenToken();
				unlistenComplete();
				unlistenError();
			}
		}

		setupListeners();

		return () => {
			cancelled = true;
			for (const unlisten of unlistenRefs.current) {
				unlisten();
			}
			unlistenRefs.current = [];
		};
	}, []);

	const start = useCallback(async (model: string, prompt: string) => {
		setTokenCount(0);
		setThinkingText("");
		setResponseText("");
		setState("streaming");
		try {
			await startReasoningStream(model, prompt);
		} catch (err) {
			console.error("[stream-start-error]", err);
			setState("error");
		}
	}, []);

	const cancel = useCallback(async () => {
		try {
			await cancelStream();
		} catch (err) {
			console.error("[cancel-error]", err);
		}
	}, []);

	return { state, tokenCount, thinkingText, responseText, start, cancel };
}
