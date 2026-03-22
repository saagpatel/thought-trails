import type { UnlistenFn } from "@tauri-apps/api/event";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";
import { cancelStream, startReasoningStream } from "../lib/ollama-client";
import type { ReasoningEvent, StreamStatus } from "../types";

type StreamingState = "idle" | "streaming" | "complete" | "error" | "cancelled";

export function useOllamaStream(streamId = "default") {
	const [state, setState] = useState<StreamingState>("idle");
	const [events, setEvents] = useState<ReasoningEvent[]>([]);
	const unlistenRefs = useRef<UnlistenFn[]>([]);

	useEffect(() => {
		let cancelled = false;

		async function setupListeners() {
			const unlistenEvent = await listen<ReasoningEvent>(
				`reasoning-event-${streamId}`,
				(event) => {
					if (cancelled) return;
					setEvents((prev) => [...prev, event.payload]);
				},
			);

			const unlistenComplete = await listen<StreamStatus>(
				`stream-complete-${streamId}`,
				(event) => {
					if (cancelled) return;
					setState(
						event.payload.state === "cancelled" ? "cancelled" : "complete",
					);
				},
			);

			const unlistenError = await listen<StreamStatus>(
				`stream-error-${streamId}`,
				(event) => {
					if (cancelled) return;
					console.error(`[stream-error-${streamId}]`, event.payload);
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
	}, [streamId]);

	const start = useCallback(
		async (model: string, prompt: string, temperature?: number) => {
			setEvents([]);
			setState("streaming");
			try {
				await startReasoningStream(model, prompt, temperature, streamId);
			} catch (err) {
				console.error(`[stream-start-error-${streamId}]`, err);
				setState("error");
			}
		},
		[streamId],
	);

	const cancel = useCallback(async () => {
		try {
			await cancelStream(streamId);
		} catch (err) {
			console.error(`[cancel-error-${streamId}]`, err);
		}
	}, [streamId]);

	return { state, events, start, cancel };
}
