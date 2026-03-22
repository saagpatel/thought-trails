import { useEffect, useRef } from "react";
import { useGraphSimulation } from "../hooks/use-graph-simulation";
import { useTreeLayout } from "../hooks/use-tree-layout";
import type { GraphState } from "../types";

const EMPTY_GRAPH: GraphState = { nodes: [], edges: [], eventLog: [] };

export function GraphCanvas({
	graphState,
	layoutMode = "force",
	onSvgRef,
	highlightedNodeIds,
	onNodeClick,
}: {
	graphState: GraphState;
	layoutMode?: "force" | "tree";
	onSvgRef?: (el: SVGSVGElement | null) => void;
	highlightedNodeIds?: Set<string>;
	onNodeClick?: (nodeId: string) => void;
}) {
	const containerRef = useRef<HTMLDivElement>(null);

	const forceResult = useGraphSimulation(
		layoutMode === "force" ? graphState : EMPTY_GRAPH,
		containerRef,
		layoutMode === "force" ? highlightedNodeIds : undefined,
		layoutMode === "force" ? onNodeClick : undefined,
	);

	const treeResult = useTreeLayout(
		layoutMode === "tree" ? graphState : EMPTY_GRAPH,
		containerRef,
		layoutMode === "tree" ? highlightedNodeIds : undefined,
		layoutMode === "tree" ? onNodeClick : undefined,
	);

	const svgRef =
		layoutMode === "force" ? forceResult.svgRef : treeResult.svgRef;

	useEffect(() => {
		onSvgRef?.(svgRef.current);
	});

	return <div ref={containerRef} className="h-full w-full" />;
}
