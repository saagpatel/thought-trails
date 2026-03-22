import { useEffect, useRef } from "react";
import { useGraphSimulation } from "../hooks/use-graph-simulation";
import type { GraphState } from "../types";

export function GraphCanvas({
	graphState,
	onSvgRef,
}: {
	graphState: GraphState;
	onSvgRef?: (el: SVGSVGElement | null) => void;
}) {
	const containerRef = useRef<HTMLDivElement>(null);
	const { svgRef } = useGraphSimulation(graphState, containerRef);

	useEffect(() => {
		onSvgRef?.(svgRef.current);
	});

	return <div ref={containerRef} className="h-full w-full" />;
}
