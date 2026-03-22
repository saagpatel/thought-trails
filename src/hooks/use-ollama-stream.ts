import type { UnlistenFn } from "@tauri-apps/api/event";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";
import { cancelStream, startReasoningStream } from "../lib/ollama-client";
import type { ReasoningEvent, StreamStatus } from "../types";

type StreamingState = "idle" | "streaming" | "complete" | "error" | "cancelled";

export function useOllamaStream() {
	const [state, setState] = useState<StreamingState>("idle");
	const [events, setEvents] = useState<ReasoningEvent[]>([]);
	const unlistenRefs = useRef<UnlistenFn[]>([]);

	useEffect(() => {
		let cancelled = false;

		async function setupListeners() {
			const unlistenEvent = await listen<ReasoningEvent>(
				"reasoning-event",
				(event) => {
					if (cancelled) return;
					console.log("[reasoning-event]", event.payload);
					setEvents((prev) => [...prev, event.payload]);
				},
			);

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
				unlistenRefs.current = [unlistenEvent, unlistenComplete, unlistenError];
			} else {
				unlistenEvent();
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

	const start = useCallback(
		async (model: string, prompt: string, temperature?: number) => {
			setEvents([]);
			setState("streaming");
			try {
				await startReasoningStream(model, prompt, temperature);
			} catch (err) {
				console.error("[stream-start-error]", err);
				setState("error");
			}
		},
		[],
	);

	const cancel = useCallback(async () => {
		try {
			await cancelStream();
		} catch (err) {
			console.error("[cancel-error]", err);
		}
	}, []);

	return { state, events, start, cancel };
}
