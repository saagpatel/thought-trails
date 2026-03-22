import { useEffect, useRef } from "react";
import { useGraphSimulation } from "../hooks/use-graph-simulation";
import type { GraphState } from "../types";

export function GraphCanvas({
	graphState,
	onSvgRef,
	highlightedNodeIds,
	onNodeClick,
}: {
	graphState: GraphState;
	onSvgRef?: (el: SVGSVGElement | null) => void;
	highlightedNodeIds?: Set<string>;
	onNodeClick?: (nodeId: string) => void;
}) {
	const containerRef = useRef<HTMLDivElement>(null);
	const { svgRef } = useGraphSimulation(
		graphState,
		containerRef,
		highlightedNodeIds,
		onNodeClick,
	);

	useEffect(() => {
		onSvgRef?.(svgRef.current);
	});

	return <div ref={containerRef} className="h-full w-full" />;
}
