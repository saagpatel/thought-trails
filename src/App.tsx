import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GraphCanvas } from "./components/graph-canvas";
import { StatusBar } from "./components/status-bar";
import { useOllamaStream } from "./hooks/use-ollama-stream";
import { addEvent } from "./lib/graph-builder";
import { listOllamaModels } from "./lib/ollama-client";
import type { GraphState, ReasoningEventType } from "./types";
import { NODE_COLORS } from "./types";

const EMPTY_GRAPH: GraphState = { nodes: [], edges: [], eventLog: [] };

export function App() {
	const [prompt, setPrompt] = useState("");
	const [models, setModels] = useState<string[]>([]);
	const [selectedModel, setSelectedModel] = useState("");
	const textareaRef = useRef<HTMLTextAreaElement>(null);
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

	// Build graph state from events
	const graphState = useMemo(() => {
		let gs = EMPTY_GRAPH;
		for (const event of events) {
			gs = addEvent(event, gs);
		}
		return gs;
	}, [events]);

	// Count events by type (exclude think-start/think-end)
	const typeCounts = useMemo(() => {
		const counts: Partial<Record<ReasoningEventType, number>> = {};
		for (const node of graphState.nodes) {
			counts[node.type] = (counts[node.type] ?? 0) + 1;
		}
		return counts;
	}, [graphState.nodes]);

	const nodeCount = graphState.nodes.length;
	const showWarning = nodeCount >= 150;
	const atLimit = nodeCount >= 200;

	return (
		<div className="flex h-screen flex-col bg-neutral-950 text-neutral-100">
			{/* Prompt input */}
			<div className="shrink-0 border-b border-neutral-800 p-3">
				<div className="mx-auto flex max-w-4xl gap-3">
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
						rows={1}
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

			{/* Graph area */}
			<main className="relative flex-1">
				<GraphCanvas graphState={graphState} />

				{/* Floating overlay: node count badges */}
				{nodeCount > 0 && (
					<div className="absolute bottom-12 left-4 flex flex-wrap items-center gap-2 text-xs">
						<span className="rounded bg-neutral-900/80 px-2 py-1 text-neutral-400 backdrop-blur">
							{nodeCount} nodes
						</span>
						{Object.entries(typeCounts).map(([type_, count]) => (
							<span
								key={type_}
								className="inline-flex items-center gap-1 rounded-full bg-neutral-900/80 px-2 py-0.5 backdrop-blur"
								style={{
									color: NODE_COLORS[type_ as ReasoningEventType],
								}}
							>
								<span
									className="inline-block h-1.5 w-1.5 rounded-full"
									style={{
										backgroundColor: NODE_COLORS[type_ as ReasoningEventType],
									}}
								/>
								{count}
							</span>
						))}
					</div>
				)}

				{/* Idle state hint */}
				{state === "idle" && nodeCount === 0 && (
					<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
						<p className="text-neutral-600">
							Enter a prompt above to visualize reasoning
						</p>
					</div>
				)}

				{/* Warning toasts */}
				{showWarning && !atLimit && (
					<div className="absolute right-4 top-4 rounded border border-amber-500/30 bg-amber-900/80 px-4 py-2 text-sm text-amber-200 backdrop-blur">
						Approaching display limit ({nodeCount}/200 nodes)
					</div>
				)}
				{atLimit && (
					<div className="absolute right-4 top-4 rounded border border-red-500/30 bg-red-900/80 px-4 py-2 text-sm text-red-200 backdrop-blur">
						Display limit reached — graph capped at 200 nodes
					</div>
				)}
			</main>

			<StatusBar />
		</div>
	);
}
