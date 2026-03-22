import { useRef } from "react";
import { useGraphSimulation } from "../hooks/use-graph-simulation";
import type { GraphState } from "../types";

export function GraphCanvas({ graphState }: { graphState: GraphState }) {
	const containerRef = useRef<HTMLDivElement>(null);
	useGraphSimulation(graphState, containerRef);
	return <div ref={containerRef} className="h-full w-full" />;
}
