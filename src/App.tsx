import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StatusBar } from "./components/status-bar";
import { useOllamaStream } from "./hooks/use-ollama-stream";
import { listOllamaModels } from "./lib/ollama-client";
import type { ReasoningEventType } from "./types";
import { NODE_COLORS } from "./types";

const TYPE_LABELS: Record<ReasoningEventType, string> = {
	claim: "Claim",
	evidence: "Evidence",
	backtrack: "Backtrack",
	conclusion: "Conclusion",
	"think-start": "Think Start",
	"think-end": "Think End",
};

export function App() {
	const [prompt, setPrompt] = useState("");
	const [models, setModels] = useState<string[]>([]);
	const [selectedModel, setSelectedModel] = useState("");
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const eventsEndRef = useRef<HTMLDivElement>(null);
	const { state, events, start, cancel } = useOllamaStream();

	useEffect(() => {
		listOllamaModels()
			.then((m) => {
				setModels(m);
				if (m.length > 0 && m[0]) setSelectedModel(m[0]);
			})
			.catch(() => {
				/* StatusBar handles error display */
			});
	}, []);

	// Auto-scroll to latest event
	useEffect(() => {
		eventsEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [events.length]);

	const handleSubmit = useCallback(() => {
		if (!prompt.trim() || !selectedModel || state === "streaming") return;
		start(selectedModel, prompt.trim());
	}, [prompt, selectedModel, state, start]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
				e.preventDefault();
				handleSubmit();
			}
		},
		[handleSubmit],
	);

	// Count events by type (exclude think-start/think-end)
	const typeCounts = useMemo(() => {
		const counts: Partial<Record<ReasoningEventType, number>> = {};
		for (const event of events) {
			if (event.type === "think-start" || event.type === "think-end") continue;
			counts[event.type] = (counts[event.type] ?? 0) + 1;
		}
		return counts;
	}, [events]);

	const contentEvents = useMemo(
		() =>
			events.filter((e) => e.type !== "think-start" && e.type !== "think-end"),
		[events],
	);

	return (
		<div className="flex h-screen flex-col bg-neutral-950 text-neutral-100">
			{/* Prompt input */}
			<div className="shrink-0 border-b border-neutral-800 p-4">
				<div className="mx-auto flex max-w-3xl gap-3">
					<select
						value={selectedModel}
						onChange={(e) => setSelectedModel(e.target.value)}
						className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-200"
					>
						{models.map((m) => (
							<option key={m} value={m}>
								{m}
							</option>
						))}
					</select>
					<textarea
						ref={textareaRef}
						value={prompt}
						onChange={(e) => setPrompt(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Enter a prompt... (Cmd+Enter to submit)"
						rows={2}
						className="flex-1 resize-none rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 focus:border-blue-500 focus:outline-none"
					/>
					{state === "streaming" ? (
						<button
							onClick={cancel}
							type="button"
							className="rounded bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-500"
						>
							Cancel
						</button>
					) : (
						<button
							onClick={handleSubmit}
							type="button"
							disabled={!prompt.trim() || !selectedModel}
							className="rounded bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-40"
						>
							Send
						</button>
					)}
				</div>
			</div>

			{/* Event display */}
			<main className="flex-1 overflow-auto p-4">
				<div className="mx-auto max-w-3xl">
					{/* Status bar */}
					{state !== "idle" && (
						<div className="mb-4 flex flex-wrap items-center gap-3 text-xs">
							<span className="text-neutral-500">
								State: <strong className="text-neutral-300">{state}</strong>
							</span>
							<span className="text-neutral-500">
								Events: {contentEvents.length}
							</span>
							{Object.entries(typeCounts).map(([type_, count]) => (
								<span
									key={type_}
									className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
									style={{
										backgroundColor: `${NODE_COLORS[type_ as ReasoningEventType]}20`,
										color: NODE_COLORS[type_ as ReasoningEventType],
									}}
								>
									<span
										className="inline-block h-1.5 w-1.5 rounded-full"
										style={{
											backgroundColor: NODE_COLORS[type_ as ReasoningEventType],
										}}
									/>
									{count} {TYPE_LABELS[type_ as ReasoningEventType]}
								</span>
							))}
						</div>
					)}

					{/* Event list */}
					{contentEvents.map((event) => (
						<div
							key={event.id}
							className="mb-2 flex gap-3 rounded border border-neutral-800/50 p-3"
						>
							<span
								className="mt-0.5 inline-block h-3 w-3 shrink-0 rounded-full"
								style={{ backgroundColor: NODE_COLORS[event.type] }}
								title={TYPE_LABELS[event.type]}
							/>
							<div className="min-w-0 flex-1">
								<div className="mb-1 flex items-center gap-2 text-xs text-neutral-500">
									<span
										className="font-bold uppercase tracking-wider"
										style={{ color: NODE_COLORS[event.type] }}
									>
										{TYPE_LABELS[event.type]}
									</span>
									{event.parentId && (
										<span className="text-neutral-600">
											parent: {event.parentId.slice(0, 8)}
										</span>
									)}
								</div>
								<p className="text-sm leading-relaxed text-neutral-300">
									{event.text}
								</p>
							</div>
						</div>
					))}

					{state === "idle" && contentEvents.length === 0 && (
						<p className="text-center text-neutral-600">
							Enter a prompt above to start streaming
						</p>
					)}

					<div ref={eventsEndRef} />
				</div>
			</main>

			<StatusBar />
		</div>
	);
}
