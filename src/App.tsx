import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GraphCanvas } from "./components/graph-canvas";
import { GraphSearch } from "./components/graph-search";
import { PromptPanel } from "./components/prompt-panel";
import { ReplayControls } from "./components/replay-controls";
import { SessionSidebar } from "./components/session-sidebar";
import { StatusBar } from "./components/status-bar";
import { WindowControls } from "./components/window-controls";
import { useGraphSearch } from "./hooks/use-graph-search";
import { useOllamaStream } from "./hooks/use-ollama-stream";
import { useReplay } from "./hooks/use-replay";
import { useSessions } from "./hooks/use-sessions";
import { exportJson, exportSvg } from "./lib/exporter";
import { addEvent } from "./lib/graph-builder";
import { listOllamaModels } from "./lib/ollama-client";
import type { GraphState, ReasoningEventType, Session } from "./types";
import { computeStats, NODE_COLORS } from "./types";

const EMPTY_GRAPH: GraphState = { nodes: [], edges: [], eventLog: [] };

export function App() {
	const [models, setModels] = useState<string[]>([]);
	const [selectedModel, setSelectedModel] = useState("");
	const [lastPrompt, setLastPrompt] = useState("");
	const [lastTemperature, setLastTemperature] = useState(0.7);
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const svgElRef = useRef<SVGSVGElement | null>(null);
	const { state, events, start, cancel } = useOllamaStream();
	const sessions = useSessions();

	const refreshModels = useCallback(() => {
		listOllamaModels()
			.then((m) => {
				setModels(m);
				if (m.length > 0 && !m.includes(selectedModel) && m[0]) {
					setSelectedModel(m[0]);
				}
			})
			.catch(() => {});
	}, [selectedModel]);

	useEffect(() => {
		refreshModels();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const handleSubmit = useCallback(
		(prompt: string, temperature: number) => {
			if (!selectedModel || state === "streaming") return;
			sessions.clearActiveSession();
			setLastPrompt(prompt);
			setLastTemperature(temperature);
			start(selectedModel, prompt, temperature);
		},
		[selectedModel, state, start, sessions],
	);

	// Auto-save on stream completion
	const savedSessionRef = useRef(false);
	useEffect(() => {
		if (state === "complete" && events.length > 0 && !savedSessionRef.current) {
			savedSessionRef.current = true;
			const session: Session = {
				id: crypto.randomUUID(),
				createdAt: Date.now(),
				model: selectedModel,
				prompt: lastPrompt,
				temperature: lastTemperature,
				eventLog: events,
				stats: computeStats(events),
			};
			sessions.saveCurrentSession(session);
		}
		if (state === "streaming") {
			savedSessionRef.current = false;
		}
	}, [state, events, selectedModel, lastPrompt, lastTemperature, sessions]);

	// Build graph state from live events
	const liveGraphState = useMemo(() => {
		let gs = EMPTY_GRAPH;
		for (const event of events) {
			gs = addEvent(event, gs);
		}
		return gs;
	}, [events]);

	const activeGraphState = useMemo(() => {
		if (sessions.loadedSession) {
			let gs = EMPTY_GRAPH;
			for (const event of sessions.loadedSession.eventLog) {
				gs = addEvent(event, gs);
			}
			return gs;
		}
		return liveGraphState;
	}, [sessions.loadedSession, liveGraphState]);

	// Replay operates on the active graph's eventLog
	const replay = useReplay(activeGraphState.eventLog);
	const isReplaying = replay.replayState !== "idle";

	// Display graph: replay events when replaying, active otherwise
	const displayGraphState = useMemo(() => {
		if (!isReplaying) return activeGraphState;
		let gs = EMPTY_GRAPH;
		for (const event of replay.replayEvents) {
			gs = addEvent(event, gs);
		}
		return gs;
	}, [isReplaying, activeGraphState, replay.replayEvents]);

	// Graph search
	const graphSearch = useGraphSearch(displayGraphState);

	// Count nodes by type
	const typeCounts = useMemo(() => {
		const counts: Partial<Record<ReasoningEventType, number>> = {};
		for (const node of displayGraphState.nodes) {
			counts[node.type] = (counts[node.type] ?? 0) + 1;
		}
		return counts;
	}, [displayGraphState.nodes]);

	const nodeCount = displayGraphState.nodes.length;
	const showWarning = nodeCount >= 150;
	const atLimit = nodeCount >= 200;
	const canExport = nodeCount > 0 && state !== "streaming";
	const canReplay =
		(state === "complete" || sessions.loadedSession !== null) &&
		activeGraphState.eventLog.length > 0;

	const handleExportSvg = useCallback(() => {
		if (!svgElRef.current) return;
		const ts = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
		exportSvg(svgElRef.current, `thought-trails-${ts}.svg`);
	}, []);

	const handleExportJson = useCallback(() => {
		const ts = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
		const prompt = sessions.loadedSession?.prompt ?? lastPrompt;
		const model = sessions.loadedSession?.model ?? selectedModel;
		exportJson(
			displayGraphState,
			{ model, prompt, timestamp: Date.now() },
			`thought-trails-${ts}.json`,
		);
	}, [displayGraphState, selectedModel, lastPrompt, sessions.loadedSession]);

	// Cmd+F to focus graph search
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "f") {
				e.preventDefault();
				document.getElementById("graph-search-input")?.focus();
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, []);

	return (
		<div className="flex h-screen flex-col bg-neutral-950 text-neutral-100">
			{/* Window controls + Prompt panel */}
			<div className="flex shrink-0 items-start gap-3 border-b border-neutral-800">
				<div className="flex items-center gap-2 py-4 pl-3">
					<WindowControls />
					<button
						type="button"
						onClick={() => setSidebarOpen((o) => !o)}
						className="rounded px-1.5 py-1 text-neutral-500 transition-colors hover:bg-neutral-800 hover:text-neutral-300"
						title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
					>
						<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
							<rect x="1" y="3" width="14" height="1.5" rx="0.5" />
							<rect x="1" y="7" width="14" height="1.5" rx="0.5" />
							<rect x="1" y="11" width="14" height="1.5" rx="0.5" />
						</svg>
					</button>
				</div>
				<div className="flex-1">
					{sessions.loadedSession ? (
						<div className="p-3">
							<div className="mx-auto max-w-4xl">
								<div className="flex items-center gap-3 text-sm">
									<span className="rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
										{sessions.loadedSession.model}
									</span>
									<p className="flex-1 truncate text-neutral-300">
										{sessions.loadedSession.prompt}
									</p>
									<button
										type="button"
										onClick={sessions.clearActiveSession}
										className="rounded border border-neutral-700 px-3 py-1 text-xs text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-200"
									>
										New Session
									</button>
								</div>
							</div>
						</div>
					) : (
						<PromptPanel
							models={models}
							selectedModel={selectedModel}
							onModelChange={setSelectedModel}
							onRefreshModels={refreshModels}
							isStreaming={state === "streaming"}
							onSubmit={handleSubmit}
							onCancel={cancel}
						/>
					)}
				</div>
			</div>

			{/* Main content: sidebar + graph */}
			<div className="relative flex flex-1 overflow-hidden">
				{/* Sidebar */}
				{sidebarOpen && (
					<SessionSidebar
						sessions={sessions.sessions}
						activeSessionId={sessions.activeSessionId}
						onSelectSession={sessions.loadSessionById}
						onDeleteSession={sessions.deleteSessionById}
						onNewSession={() => {
							sessions.clearActiveSession();
							setSidebarOpen(false);
						}}
					/>
				)}

				{/* Graph area */}
				<main className="relative flex-1">
					<GraphCanvas
						graphState={displayGraphState}
						onSvgRef={(el) => {
							svgElRef.current = el;
						}}
						highlightedNodeIds={graphSearch.matchingNodeIds}
					/>

					{/* Graph search */}
					{nodeCount > 0 && (
						<GraphSearch
							query={graphSearch.query}
							onQueryChange={graphSearch.setQuery}
							matchCount={graphSearch.matchCount}
							totalNodes={nodeCount}
						/>
					)}

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

					{/* Export buttons */}
					{canExport && (
						<div className="absolute bottom-12 right-4 flex gap-2">
							<button
								type="button"
								onClick={handleExportSvg}
								className="rounded border border-neutral-700 bg-neutral-900/80 px-3 py-1.5 text-xs text-neutral-300 backdrop-blur transition-colors hover:border-neutral-600 hover:text-neutral-100"
							>
								Export SVG
							</button>
							<button
								type="button"
								onClick={handleExportJson}
								className="rounded border border-neutral-700 bg-neutral-900/80 px-3 py-1.5 text-xs text-neutral-300 backdrop-blur transition-colors hover:border-neutral-600 hover:text-neutral-100"
							>
								Export JSON
							</button>
						</div>
					)}

					{/* Idle state */}
					{state === "idle" && nodeCount === 0 && !sessions.loadedSession && (
						<div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2">
							<p className="text-lg font-light tracking-wide text-neutral-500">
								thought-trails
							</p>
							<p className="text-sm text-neutral-600">
								Submit a prompt to visualize LLM reasoning
							</p>
							<p className="text-xs text-neutral-700">Cmd+Enter to submit</p>
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

					{/* Replay controls */}
					{canReplay && (
						<ReplayControls
							replayState={replay.replayState}
							replaySpeed={replay.replaySpeed}
							replayProgress={replay.replayProgress}
							totalEvents={replay.totalEventCount}
							currentEvents={replay.currentEventCount}
							onPlay={replay.play}
							onPause={replay.pause}
							onReset={replay.reset}
							onScrub={replay.scrub}
							onCycleSpeed={replay.cycleSpeed}
						/>
					)}
				</main>
			</div>

			<StatusBar />
		</div>
	);
}
