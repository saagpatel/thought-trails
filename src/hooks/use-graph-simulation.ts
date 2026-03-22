import * as d3 from "d3";
import { useEffect, useRef } from "react";
import type { GraphEdge, GraphNode, GraphState } from "../types";
import { NODE_COLORS, NODE_RADII } from "../types";

const EDGE_COLORS: Record<GraphEdge["type"], string> = {
	supports: "#9CA3AF",
	contradicts: "#EF4444",
	concludes: "#A855F7",
};

export function useGraphSimulation(
	graphState: GraphState,
	containerRef: React.RefObject<HTMLDivElement | null>,
	highlightedNodeIds?: Set<string>,
): { svgRef: React.RefObject<SVGSVGElement | null> } {
	const svgRef = useRef<SVGSVGElement | null>(null);
	const simulationRef = useRef<d3.Simulation<
		GraphNode,
		d3.SimulationLinkDatum<GraphNode>
	> | null>(null);
	const zoomGroupRef = useRef<d3.Selection<
		SVGGElement,
		unknown,
		null,
		undefined
	> | null>(null);
	const zoomScaleRef = useRef(1);

	// Mount SVG and initialize simulation (once)
	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		d3.select(container).selectAll("svg").remove();

		const width = container.clientWidth;
		const height = container.clientHeight;

		const svg = d3
			.select(container)
			.append("svg")
			.attr("width", width)
			.attr("height", height)
			.style("background", "transparent");

		svgRef.current = svg.node();

		// Arrow marker definitions
		const defs = svg.append("defs");
		for (const [type, color] of Object.entries(EDGE_COLORS)) {
			defs
				.append("marker")
				.attr("id", `arrow-${type}`)
				.attr("viewBox", "0 0 10 10")
				.attr("refX", 20)
				.attr("refY", 5)
				.attr("markerWidth", 6)
				.attr("markerHeight", 6)
				.attr("orient", "auto")
				.append("path")
				.attr("d", "M 0 0 L 10 5 L 0 10 z")
				.attr("fill", color);
		}

		const zoomGroup = svg.append("g").attr("class", "zoom-group");
		zoomGroupRef.current = zoomGroup;

		zoomGroup.append("g").attr("class", "edges");
		zoomGroup.append("g").attr("class", "nodes");
		zoomGroup.append("g").attr("class", "labels");

		// Force simulation
		const simulation = d3
			.forceSimulation<GraphNode>()
			.force(
				"link",
				d3
					.forceLink<GraphNode, d3.SimulationLinkDatum<GraphNode>>()
					.id((d) => d.id)
					.distance(80),
			)
			.force("charge", d3.forceManyBody().strength(-200))
			.force("center", d3.forceCenter(width / 2, height / 2))
			.force(
				"collide",
				d3.forceCollide<GraphNode>((d) => NODE_RADII[d.type] + 4),
			)
			.alphaDecay(0.02)
			.velocityDecay(0.4);

		simulationRef.current = simulation;

		// Tick handler
		simulation.on("tick", () => {
			zoomGroup
				.select(".edges")
				.selectAll<SVGLineElement, GraphEdge>("line")
				.attr(
					"x1",
					(d) => (d as unknown as { source: GraphNode }).source.x ?? 0,
				)
				.attr(
					"y1",
					(d) => (d as unknown as { source: GraphNode }).source.y ?? 0,
				)
				.attr(
					"x2",
					(d) => (d as unknown as { target: GraphNode }).target.x ?? 0,
				)
				.attr(
					"y2",
					(d) => (d as unknown as { target: GraphNode }).target.y ?? 0,
				);

			zoomGroup
				.select(".nodes")
				.selectAll<SVGCircleElement, GraphNode>("circle")
				.attr("cx", (d) => d.x ?? 0)
				.attr("cy", (d) => d.y ?? 0);

			zoomGroup
				.select(".labels")
				.selectAll<SVGTextElement, GraphNode>("text")
				.attr("x", (d) => d.x ?? 0)
				.attr("y", (d) => (d.y ?? 0) + NODE_RADII[d.type] + 14);
		});

		// Zoom behavior
		const zoom = d3
			.zoom<SVGSVGElement, unknown>()
			.scaleExtent([0.2, 8])
			.on("zoom", (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
				zoomGroup.attr("transform", event.transform.toString());
				zoomScaleRef.current = event.transform.k;

				// Show labels only at higher zoom levels
				zoomGroup
					.select(".labels")
					.attr("opacity", event.transform.k > 1.5 ? 1 : 0);
			});

		svg.call(zoom);

		// Drag behavior factory
		const drag = d3
			.drag<SVGCircleElement, GraphNode>()
			.on(
				"start",
				(event: d3.D3DragEvent<SVGCircleElement, GraphNode, GraphNode>, d) => {
					if (!event.active) simulation.alphaTarget(0.3).restart();
					d.fx = d.x;
					d.fy = d.y;
				},
			)
			.on(
				"drag",
				(event: d3.D3DragEvent<SVGCircleElement, GraphNode, GraphNode>, d) => {
					d.fx = event.x;
					d.fy = event.y;
				},
			)
			.on(
				"end",
				(event: d3.D3DragEvent<SVGCircleElement, GraphNode, GraphNode>, d) => {
					if (!event.active) simulation.alphaTarget(0);
					d.fx = null;
					d.fy = null;
				},
			);

		// Store drag behavior on the SVG element for use in the update effect
		(svg.node() as SVGSVGElement & { __drag: typeof drag }).__drag = drag;

		// Resize handling
		const resizeObserver = new ResizeObserver(
			debounce(() => {
				const w = container.clientWidth;
				const h = container.clientHeight;
				svg.attr("width", w).attr("height", h);
				simulation.force("center", d3.forceCenter(w / 2, h / 2));
				simulation.alpha(0.1).restart();
			}, 100),
		);
		resizeObserver.observe(container);

		return () => {
			simulation.stop();
			resizeObserver.disconnect();
			svg.on(".zoom", null);
			svg.remove();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Update graph data when nodes/edges change
	useEffect(() => {
		const simulation = simulationRef.current;
		const zoomGroup = zoomGroupRef.current;
		const svgEl = svgRef.current;
		if (!simulation || !zoomGroup || !svgEl) return;

		const drag = (
			svgEl as SVGSVGElement & {
				__drag: d3.DragBehavior<SVGCircleElement, GraphNode, GraphNode>;
			}
		).__drag;

		// Update simulation data
		simulation.nodes(graphState.nodes);
		const linkForce = simulation.force("link") as
			| d3.ForceLink<GraphNode, d3.SimulationLinkDatum<GraphNode>>
			| undefined;
		if (linkForce) {
			linkForce.links(
				graphState.edges.map((e) => ({
					...e,
				})) as d3.SimulationLinkDatum<GraphNode>[],
			);
		}
		simulation.alpha(0.3).restart();

		// --- Edges ---
		const edgeSelection = zoomGroup
			.select(".edges")
			.selectAll<SVGLineElement, GraphEdge>("line")
			.data(graphState.edges, (d) => `${edgeSourceId(d)}-${edgeTargetId(d)}`);

		edgeSelection.exit().remove();

		edgeSelection
			.enter()
			.append("line")
			.attr("stroke", (d) => EDGE_COLORS[d.type])
			.attr("stroke-width", 1.5)
			.attr("stroke-opacity", 0.6)
			.attr("marker-end", (d) => `url(#arrow-${d.type})`);

		// --- Nodes ---
		const nodeSelection = zoomGroup
			.select(".nodes")
			.selectAll<SVGCircleElement, GraphNode>("circle")
			.data(graphState.nodes, (d) => d.id);

		nodeSelection.exit().remove();

		const entering = nodeSelection
			.enter()
			.append("circle")
			.attr("r", (d) => NODE_RADII[d.type])
			.attr("fill", (d) => NODE_COLORS[d.type])
			.attr("stroke", (d) => NODE_COLORS[d.type])
			.attr("stroke-width", 1.5)
			.attr("stroke-opacity", 0.3)
			.attr("opacity", 0)
			.attr("cursor", "grab")
			.attr("cx", (d) => d.x ?? 0)
			.attr("cy", (d) => d.y ?? 0);

		// Fade in
		entering.transition().duration(300).attr("opacity", 1);

		// Tooltip
		entering.append("title").text((d) => d.text);

		// Drag
		if (drag) entering.call(drag);

		// --- Labels ---
		const labelSelection = zoomGroup
			.select(".labels")
			.selectAll<SVGTextElement, GraphNode>("text")
			.data(graphState.nodes, (d) => d.id);

		labelSelection.exit().remove();

		labelSelection
			.enter()
			.append("text")
			.attr("font-size", "10px")
			.attr("fill", "#9CA3AF")
			.attr("text-anchor", "middle")
			.attr("pointer-events", "none")
			.attr("opacity", zoomScaleRef.current > 1.5 ? 1 : 0)
			.text((d) => truncate(d.text, 40));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [graphState.nodes.length, graphState.edges.length]);

	// Highlight matching nodes (for search)
	useEffect(() => {
		const zoomGroup = zoomGroupRef.current;
		if (!zoomGroup) return;

		const hasHighlight = highlightedNodeIds && highlightedNodeIds.size > 0;

		zoomGroup
			.select(".nodes")
			.selectAll<SVGCircleElement, GraphNode>("circle")
			.attr("opacity", (d) => {
				if (!hasHighlight) return 1;
				return highlightedNodeIds.has(d.id) ? 1 : 0.15;
			})
			.attr("stroke-width", (d) => {
				if (!hasHighlight) return 1.5;
				return highlightedNodeIds.has(d.id) ? 3 : 1.5;
			});

		zoomGroup
			.select(".edges")
			.selectAll<SVGLineElement, GraphEdge>("line")
			.attr("stroke-opacity", () => {
				if (!hasHighlight) return 0.6;
				return 0.05;
			});

		zoomGroup
			.select(".labels")
			.selectAll<SVGTextElement, GraphNode>("text")
			.attr("opacity", (d) => {
				if (!hasHighlight) return zoomScaleRef.current > 1.5 ? 1 : 0;
				return highlightedNodeIds.has(d.id) ? 1 : 0;
			});
	}, [highlightedNodeIds]);

	return { svgRef };
}

// --- Helpers ---

function truncate(text: string, maxLen: number): string {
	if (text.length <= maxLen) return text;
	return text.slice(0, maxLen - 1) + "\u2026";
}

function edgeSourceId(edge: GraphEdge): string {
	return typeof edge.source === "string"
		? edge.source
		: (edge.source as unknown as GraphNode).id;
}

function edgeTargetId(edge: GraphEdge): string {
	return typeof edge.target === "string"
		? edge.target
		: (edge.target as unknown as GraphNode).id;
}

function debounce<T extends (...args: unknown[]) => void>(
	fn: T,
	ms: number,
): T {
	let timer: ReturnType<typeof setTimeout>;
	return ((...args: unknown[]) => {
		clearTimeout(timer);
		timer = setTimeout(() => fn(...args), ms);
	}) as T;
}
