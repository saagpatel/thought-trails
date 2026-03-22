import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GraphCanvas } from "./components/graph-canvas";
import { GraphSearch } from "./components/graph-search";
import { NodeDetailPanel } from "./components/node-detail-panel";
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
import { addEvent, filterCollapsed, getSubtree } from "./lib/graph-builder";
import { listOllamaModels } from "./lib/ollama-client";
import type {
	GraphNode,
	GraphState,
	ReasoningEventType,
	Session,
} from "./types";
import { computeStats, NODE_COLORS } from "./types";

const EMPTY_GRAPH: GraphState = { nodes: [], edges: [], eventLog: [] };

export function App() {
	const [models, setModels] = useState<string[]>([]);
	const [selectedModel, setSelectedModel] = useState("");
	const [lastPrompt, setLastPrompt] = useState("");
	const [lastTemperature, setLastTemperature] = useState(0.7);
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
	const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(
		new Set(),
	);
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
			setSelectedNodeId(null);
			setCollapsedNodeIds(new Set());
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

	// Build full graph state
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

	// Replay
	const replay = useReplay(activeGraphState.eventLog);
	const isReplaying = replay.replayState !== "idle";

	const displayGraphState = useMemo(() => {
		if (!isReplaying) return activeGraphState;
		let gs = EMPTY_GRAPH;
		for (const event of replay.replayEvents) {
			gs = addEvent(event, gs);
		}
		return gs;
	}, [isReplaying, activeGraphState, replay.replayEvents]);

	// Apply collapse filtering for the visual graph
	const visibleGraphState = useMemo(
		() => filterCollapsed(displayGraphState, collapsedNodeIds),
		[displayGraphState, collapsedNodeIds],
	);

	// Graph search
	const graphSearch = useGraphSearch(displayGraphState);

	// Selected node
	const selectedNode: GraphNode | undefined = selectedNodeId
		? displayGraphState.nodes.find((n) => n.id === selectedNodeId)
		: undefined;

	// Highlight priority: search > node selection > none
	const highlightedNodeIds = useMemo(() => {
		if (graphSearch.matchingNodeIds.size > 0) {
			return graphSearch.matchingNodeIds;
		}
		if (selectedNodeId) {
			return getSubtree(selectedNodeId, displayGraphState);
		}
		return new Set<string>();
	}, [graphSearch.matchingNodeIds, selectedNodeId, displayGraphState]);

	// Auto-expand collapsed parents when search finds hidden nodes
	useEffect(() => {
		if (graphSearch.matchingNodeIds.size === 0) return;
		const toExpand = new Set<string>();
		for (const matchId of graphSearch.matchingNodeIds) {
			for (const collapsedId of collapsedNodeIds) {
				const subtree = getSubtree(collapsedId, displayGraphState);
				if (subtree.has(matchId) && matchId !== collapsedId) {
					toExpand.add(collapsedId);
				}
			}
		}
		if (toExpand.size > 0) {
			setCollapsedNodeIds((prev) => {
				const next = new Set(prev);
				for (const id of toExpand) next.delete(id);
				return next;
			});
		}
	}, [graphSearch.matchingNodeIds, collapsedNodeIds, displayGraphState]);

	// Node count from visible graph
	const typeCounts = useMemo(() => {
		const counts: Partial<Record<ReasoningEventType, number>> = {};
		for (const node of visibleGraphState.nodes) {
			counts[node.type] = (counts[node.type] ?? 0) + 1;
		}
		return counts;
	}, [visibleGraphState.nodes]);

	const nodeCount = visibleGraphState.nodes.length;
	const showWarning = displayGraphState.nodes.length >= 150;
	const atLimit = displayGraphState.nodes.length >= 200;
	const canExport = displayGraphState.nodes.length > 0 && state !== "streaming";
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

	// Cmd+F for search
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

	// toggleCollapse will be used in Session 10 for double-click collapse
	void collapsedNodeIds; // suppress unused warning until wired to UI

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
										onClick={() => {
											sessions.clearActiveSession();
											setSelectedNodeId(null);
											setCollapsedNodeIds(new Set());
										}}
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

			{/* Main content: sidebar + graph + detail panel */}
			<div className="relative flex flex-1 overflow-hidden">
				{sidebarOpen && (
					<SessionSidebar
						sessions={sessions.sessions}
						activeSessionId={sessions.activeSessionId}
						onSelectSession={(id) => {
							sessions.loadSessionById(id);
							setSelectedNodeId(null);
							setCollapsedNodeIds(new Set());
						}}
						onDeleteSession={sessions.deleteSessionById}
						onNewSession={() => {
							sessions.clearActiveSession();
							setSelectedNodeId(null);
							setCollapsedNodeIds(new Set());
							setSidebarOpen(false);
						}}
					/>
				)}

				<main className="relative flex-1">
					<GraphCanvas
						graphState={visibleGraphState}
						onSvgRef={(el) => {
							svgElRef.current = el;
						}}
						highlightedNodeIds={highlightedNodeIds}
						onNodeClick={setSelectedNodeId}
					/>

					{/* Graph search */}
					{displayGraphState.nodes.length > 0 && (
						<GraphSearch
							query={graphSearch.query}
							onQueryChange={graphSearch.setQuery}
							matchCount={graphSearch.matchCount}
							totalNodes={displayGraphState.nodes.length}
						/>
					)}

					{/* Node count badges */}
					{nodeCount > 0 && (
						<div className="absolute bottom-12 left-4 flex flex-wrap items-center gap-2 text-xs">
							<span className="rounded bg-neutral-900/80 px-2 py-1 text-neutral-400 backdrop-blur">
								{nodeCount} nodes
								{collapsedNodeIds.size > 0 && (
									<span className="text-neutral-600">
										{" "}
										({collapsedNodeIds.size} collapsed)
									</span>
								)}
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
					{state === "idle" &&
						displayGraphState.nodes.length === 0 &&
						!sessions.loadedSession && (
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
							Approaching display limit ({displayGraphState.nodes.length}/200
							nodes)
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

				{/* Node detail panel */}
				{selectedNode && (
					<NodeDetailPanel
						node={selectedNode}
						graphState={displayGraphState}
						onClose={() => setSelectedNodeId(null)}
						onSelectNode={setSelectedNodeId}
					/>
				)}
			</div>

			<StatusBar />
		</div>
	);
}
