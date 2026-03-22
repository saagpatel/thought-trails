import { useEffect, useMemo, useRef, useState } from "react";
import { useGraphSearch } from "../hooks/use-graph-search";
import { useOllamaStream } from "../hooks/use-ollama-stream";
import { useReplay } from "../hooks/use-replay";
import { addEvent, filterCollapsed, getSubtree } from "../lib/graph-builder";
import type {
	ComparisonConfig,
	GraphNode,
	GraphState,
	ReasoningEventType,
} from "../types";
import { NODE_COLORS } from "../types";
import { ComparisonStats } from "./comparison-stats";
import { GraphCanvas } from "./graph-canvas";
import { GraphSearch } from "./graph-search";
import { GraphToolbar } from "./graph-toolbar";
import { NodeDetailPanel } from "./node-detail-panel";
import { ReplayControls } from "./replay-controls";

const EMPTY_GRAPH: GraphState = { nodes: [], edges: [], eventLog: [] };

interface ComparisonViewProps {
	config: ComparisonConfig;
	onBack: () => void;
}

function useGraphPanel(streamId: string) {
	const stream = useOllamaStream(streamId);
	const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
	const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(
		new Set(),
	);
	const svgRef = useRef<SVGSVGElement | null>(null);

	const graphState = useMemo(() => {
		let gs = EMPTY_GRAPH;
		for (const e of stream.events) {
			gs = addEvent(e, gs);
		}
		return gs;
	}, [stream.events]);

	const replay = useReplay(graphState.eventLog);
	const isReplaying = replay.replayState !== "idle";

	const displayGraphState = useMemo(() => {
		if (!isReplaying) return graphState;
		let gs = EMPTY_GRAPH;
		for (const e of replay.replayEvents) {
			gs = addEvent(e, gs);
		}
		return gs;
	}, [isReplaying, graphState, replay.replayEvents]);

	const visibleGraphState = useMemo(
		() => filterCollapsed(displayGraphState, collapsedNodeIds),
		[displayGraphState, collapsedNodeIds],
	);

	const search = useGraphSearch(displayGraphState);

	const selectedNode: GraphNode | undefined = selectedNodeId
		? displayGraphState.nodes.find((n) => n.id === selectedNodeId)
		: undefined;

	const highlightedNodeIds = useMemo(() => {
		if (search.matchingNodeIds.size > 0) return search.matchingNodeIds;
		if (selectedNodeId) return getSubtree(selectedNodeId, displayGraphState);
		return new Set<string>();
	}, [search.matchingNodeIds, selectedNodeId, displayGraphState]);

	const collapseAll = () => {
		const claimIds = displayGraphState.nodes
			.filter((n) => n.type === "claim")
			.map((n) => n.id);
		setCollapsedNodeIds(new Set(claimIds));
	};

	const expandAll = () => setCollapsedNodeIds(new Set());

	return {
		stream,
		graphState,
		displayGraphState,
		visibleGraphState,
		replay,
		search,
		selectedNodeId,
		setSelectedNodeId,
		selectedNode,
		highlightedNodeIds,
		collapsedNodeIds,
		collapseAll,
		expandAll,
		svgRef,
	};
}

export function ComparisonView({ config, onBack }: ComparisonViewProps) {
	const panelA = useGraphPanel("compare-a");
	const panelB = useGraphPanel("compare-b");
	const [layoutMode, setLayoutMode] = useState<"force" | "tree">("force");
	const startedRef = useRef(false);

	// Start both streams once
	useEffect(() => {
		if (startedRef.current) return;
		startedRef.current = true;
		panelA.stream.start(config.modelA, config.prompt, config.temperature);
		panelB.stream.start(config.modelB, config.prompt, config.temperature);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const canReplayA =
		panelA.stream.state === "complete" && panelA.graphState.eventLog.length > 0;
	const canReplayB =
		panelB.stream.state === "complete" && panelB.graphState.eventLog.length > 0;

	// Active detail panel — show whichever was most recently clicked
	const [activeDetail, setActiveDetail] = useState<"a" | "b" | null>(null);
	const detailNode =
		activeDetail === "a" ? panelA.selectedNode : panelB.selectedNode;
	const detailGraph =
		activeDetail === "a" ? panelA.displayGraphState : panelB.displayGraphState;

	return (
		<div className="flex h-full flex-col">
			{/* Shared toolbar */}
			<div className="flex items-center gap-3 border-b border-neutral-800 px-4 py-2">
				<button
					type="button"
					onClick={onBack}
					className="rounded border border-neutral-700 px-3 py-1 text-xs text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-200"
				>
					Back
				</button>
				<span className="flex items-center gap-1.5 text-xs">
					<span className="h-2 w-2 rounded-full bg-blue-500" />
					<span className="text-neutral-300">{config.modelA}</span>
				</span>
				<span className="text-xs text-neutral-600">vs</span>
				<span className="flex items-center gap-1.5 text-xs">
					<span className="h-2 w-2 rounded-full bg-emerald-500" />
					<span className="text-neutral-300">{config.modelB}</span>
				</span>
				<span className="flex-1 truncate text-xs text-neutral-500">
					{config.prompt}
				</span>
			</div>

			{/* Split pane */}
			<div className="relative flex flex-1 overflow-hidden">
				{/* Panel A */}
				<div className="relative flex-1">
					<GraphCanvas
						graphState={panelA.visibleGraphState}
						layoutMode={layoutMode}
						highlightedNodeIds={panelA.highlightedNodeIds}
						onSvgRef={(el) => {
							panelA.svgRef.current = el;
						}}
						onNodeClick={(id) => {
							panelA.setSelectedNodeId(id);
							setActiveDetail("a");
						}}
					/>
					{panelA.displayGraphState.nodes.length > 0 && (
						<GraphSearch
							query={panelA.search.query}
							onQueryChange={panelA.search.setQuery}
							matchCount={panelA.search.matchCount}
							totalNodes={panelA.displayGraphState.nodes.length}
						/>
					)}
					<NodeBadges
						graphState={panelA.visibleGraphState}
						label={config.modelA}
						color="blue"
					/>
					{canReplayA && (
						<ReplayControls
							replayState={panelA.replay.replayState}
							replaySpeed={panelA.replay.replaySpeed}
							replayProgress={panelA.replay.replayProgress}
							totalEvents={panelA.replay.totalEventCount}
							currentEvents={panelA.replay.currentEventCount}
							onPlay={panelA.replay.play}
							onPause={panelA.replay.pause}
							onReset={panelA.replay.reset}
							onScrub={panelA.replay.scrub}
							onCycleSpeed={panelA.replay.cycleSpeed}
						/>
					)}
					<GraphToolbar
						layoutMode={layoutMode}
						onLayoutChange={setLayoutMode}
						onCollapseAll={panelA.collapseAll}
						onExpandAll={panelA.expandAll}
						collapsedCount={panelA.collapsedNodeIds.size}
					/>
				</div>

				{/* Stats divider */}
				<ComparisonStats
					graphA={panelA.graphState}
					graphB={panelB.graphState}
					stateA={panelA.stream.state}
					stateB={panelB.stream.state}
				/>

				{/* Panel B */}
				<div className="relative flex-1">
					<GraphCanvas
						graphState={panelB.visibleGraphState}
						layoutMode={layoutMode}
						highlightedNodeIds={panelB.highlightedNodeIds}
						onSvgRef={(el) => {
							panelB.svgRef.current = el;
						}}
						onNodeClick={(id) => {
							panelB.setSelectedNodeId(id);
							setActiveDetail("b");
						}}
					/>
					{panelB.displayGraphState.nodes.length > 0 && (
						<GraphSearch
							query={panelB.search.query}
							onQueryChange={panelB.search.setQuery}
							matchCount={panelB.search.matchCount}
							totalNodes={panelB.displayGraphState.nodes.length}
						/>
					)}
					<NodeBadges
						graphState={panelB.visibleGraphState}
						label={config.modelB}
						color="emerald"
					/>
					{canReplayB && (
						<ReplayControls
							replayState={panelB.replay.replayState}
							replaySpeed={panelB.replay.replaySpeed}
							replayProgress={panelB.replay.replayProgress}
							totalEvents={panelB.replay.totalEventCount}
							currentEvents={panelB.replay.currentEventCount}
							onPlay={panelB.replay.play}
							onPause={panelB.replay.pause}
							onReset={panelB.replay.reset}
							onScrub={panelB.replay.scrub}
							onCycleSpeed={panelB.replay.cycleSpeed}
						/>
					)}
				</div>

				{/* Detail panel (shows for whichever side was clicked) */}
				{detailNode && detailGraph && (
					<NodeDetailPanel
						node={detailNode}
						graphState={detailGraph}
						onClose={() => {
							if (activeDetail === "a") panelA.setSelectedNodeId(null);
							if (activeDetail === "b") panelB.setSelectedNodeId(null);
							setActiveDetail(null);
						}}
						onSelectNode={(id) => {
							if (activeDetail === "a") panelA.setSelectedNodeId(id);
							if (activeDetail === "b") panelB.setSelectedNodeId(id);
						}}
					/>
				)}
			</div>
		</div>
	);
}

// Small helper for per-panel node count badges
function NodeBadges({
	graphState,
	label,
	color,
}: {
	graphState: GraphState;
	label: string;
	color: "blue" | "emerald";
}) {
	const typeCounts = useMemo(() => {
		const counts: Partial<Record<ReasoningEventType, number>> = {};
		for (const node of graphState.nodes) {
			counts[node.type] = (counts[node.type] ?? 0) + 1;
		}
		return counts;
	}, [graphState.nodes]);

	if (graphState.nodes.length === 0) return null;

	return (
		<div className="absolute bottom-12 left-4 flex flex-wrap items-center gap-1.5 text-[10px]">
			<span
				className={`rounded bg-neutral-900/80 px-1.5 py-0.5 backdrop-blur ${
					color === "blue" ? "text-blue-400" : "text-emerald-400"
				}`}
			>
				{label}: {graphState.nodes.length}
			</span>
			{Object.entries(typeCounts).map(([type_, count]) => (
				<span
					key={type_}
					className="inline-flex items-center gap-0.5 rounded-full bg-neutral-900/80 px-1.5 py-0.5 backdrop-blur"
					style={{ color: NODE_COLORS[type_ as ReasoningEventType] }}
				>
					{count}
				</span>
			))}
		</div>
	);
}
