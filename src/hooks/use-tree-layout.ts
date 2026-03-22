import * as d3 from "d3";
import { useEffect, useRef } from "react";
import { edgeSourceId, edgeTargetId } from "../lib/graph-builder";
import type { GraphEdge, GraphNode, GraphState } from "../types";
import { NODE_COLORS, NODE_RADII } from "../types";

const EDGE_COLORS: Record<GraphEdge["type"], string> = {
	supports: "#9CA3AF",
	contradicts: "#EF4444",
	concludes: "#A855F7",
};

interface TreeNode {
	id: string;
	graphNode: GraphNode;
	children: TreeNode[];
}

export function useTreeLayout(
	graphState: GraphState,
	containerRef: React.RefObject<HTMLDivElement | null>,
	highlightedNodeIds?: Set<string>,
	onNodeClick?: (nodeId: string) => void,
): { svgRef: React.RefObject<SVGSVGElement | null> } {
	const svgRef = useRef<SVGSVGElement | null>(null);
	const zoomGroupRef = useRef<d3.Selection<
		SVGGElement,
		unknown,
		null,
		undefined
	> | null>(null);
	const onNodeClickRef = useRef(onNodeClick);
	onNodeClickRef.current = onNodeClick;

	// Mount SVG (once)
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

		// Arrow markers
		const defs = svg.append("defs");
		for (const [type, color] of Object.entries(EDGE_COLORS)) {
			defs
				.append("marker")
				.attr("id", `tree-arrow-${type}`)
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

		const zoomGroup = svg.append("g").attr("class", "tree-zoom-group");
		zoomGroupRef.current = zoomGroup;

		zoomGroup.append("g").attr("class", "edges");
		zoomGroup.append("g").attr("class", "nodes");
		zoomGroup.append("g").attr("class", "labels");

		// Zoom
		const zoom = d3
			.zoom<SVGSVGElement, unknown>()
			.scaleExtent([0.2, 8])
			.on("zoom", (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
				zoomGroup.attr("transform", event.transform.toString());
			});

		svg.call(zoom);

		// Resize
		const resizeObserver = new ResizeObserver(
			debounce(() => {
				const w = container.clientWidth;
				const h = container.clientHeight;
				svg.attr("width", w).attr("height", h);
			}, 100),
		);
		resizeObserver.observe(container);

		return () => {
			resizeObserver.disconnect();
			svg.on(".zoom", null);
			svg.remove();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Update tree when data changes
	useEffect(() => {
		const zoomGroup = zoomGroupRef.current;
		if (!zoomGroup || graphState.nodes.length === 0) {
			// Clear if empty
			zoomGroup?.select(".edges").selectAll("*").remove();
			zoomGroup?.select(".nodes").selectAll("*").remove();
			zoomGroup?.select(".labels").selectAll("*").remove();
			return;
		}

		const container = containerRef.current;
		const width = container?.clientWidth ?? 1100;

		// Build tree hierarchy
		const root = buildHierarchy(graphState);
		if (!root) return;

		const d3Root = d3.hierarchy(root, (d) => d.children);

		// Compute tree layout
		const treeLayout = d3.tree<TreeNode>().nodeSize([60, 120]);

		treeLayout(d3Root);

		// Center the tree
		const nodes = d3Root.descendants();
		const links = d3Root.links();

		// Offset to center
		const minX = Math.min(...nodes.map((n) => n.x ?? 0));
		const maxX = Math.max(...nodes.map((n) => n.x ?? 0));
		const offsetX = width / 2 - (minX + maxX) / 2;
		const offsetY = 60;

		// --- Edges ---
		const edgeData = links.map((link) => ({
			source: link.source.data,
			target: link.target.data,
			sourceX: (link.source.x ?? 0) + offsetX,
			sourceY: (link.source.y ?? 0) + offsetY,
			targetX: (link.target.x ?? 0) + offsetX,
			targetY: (link.target.y ?? 0) + offsetY,
			edgeType: findEdgeType(
				link.target.data.id,
				link.source.data.id,
				graphState.edges,
			),
		}));

		const edgeSel = zoomGroup
			.select(".edges")
			.selectAll<SVGPathElement, (typeof edgeData)[0]>("path")
			.data(edgeData, (d) => `${d.source.id}-${d.target.id}`);

		edgeSel.exit().remove();

		edgeSel
			.enter()
			.append("path")
			.attr("fill", "none")
			.attr("stroke", (d) => EDGE_COLORS[d.edgeType] ?? "#9CA3AF")
			.attr("stroke-width", 1.5)
			.attr("stroke-opacity", 0.6)
			.merge(edgeSel)
			.attr(
				"d",
				(d) =>
					`M${d.sourceX},${d.sourceY} C${d.sourceX},${(d.sourceY + d.targetY) / 2} ${d.targetX},${(d.sourceY + d.targetY) / 2} ${d.targetX},${d.targetY}`,
			);

		// --- Nodes ---
		const nodeData = nodes.map((n) => ({
			...n.data.graphNode,
			treeX: (n.x ?? 0) + offsetX,
			treeY: (n.y ?? 0) + offsetY,
		}));

		const nodeSel = zoomGroup
			.select(".nodes")
			.selectAll<SVGCircleElement, (typeof nodeData)[0]>("circle")
			.data(nodeData, (d) => d.id);

		nodeSel.exit().remove();

		const entering = nodeSel
			.enter()
			.append("circle")
			.attr("r", (d) => NODE_RADII[d.type])
			.attr("fill", (d) => NODE_COLORS[d.type])
			.attr("stroke", (d) => NODE_COLORS[d.type])
			.attr("stroke-width", 1.5)
			.attr("stroke-opacity", 0.3)
			.attr("cursor", "pointer")
			.attr("opacity", 0);

		entering.transition().duration(300).attr("opacity", 1);
		entering.append("title").text((d) => d.text);
		entering.on("click", (_event, d) => {
			onNodeClickRef.current?.(d.id);
		});

		entering
			.merge(nodeSel)
			.attr("cx", (d) => d.treeX)
			.attr("cy", (d) => d.treeY);

		// --- Labels (always visible in tree mode) ---
		const labelSel = zoomGroup
			.select(".labels")
			.selectAll<SVGTextElement, (typeof nodeData)[0]>("text")
			.data(nodeData, (d) => d.id);

		labelSel.exit().remove();

		labelSel
			.enter()
			.append("text")
			.attr("font-size", "10px")
			.attr("fill", "#9CA3AF")
			.attr("text-anchor", "middle")
			.attr("pointer-events", "none")
			.text((d) => truncate(d.text, 40))
			.merge(labelSel)
			.attr("x", (d) => d.treeX)
			.attr("y", (d) => d.treeY + NODE_RADII[d.type] + 14);

		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [graphState.nodes.length, graphState.edges.length]);

	// Highlight effect
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
			.selectAll("path")
			.attr("stroke-opacity", () => (hasHighlight ? 0.05 : 0.6));

		zoomGroup
			.select(".labels")
			.selectAll<SVGTextElement, GraphNode>("text")
			.attr("opacity", (d) => {
				if (!hasHighlight) return 1;
				return highlightedNodeIds.has(d.id) ? 1 : 0;
			});
	}, [highlightedNodeIds]);

	return { svgRef };
}

// --- Helpers ---

function buildHierarchy(state: GraphState): TreeNode | null {
	if (state.nodes.length === 0) return null;

	// Find root nodes (claims with no parent edge)
	const childIds = new Set(state.edges.map((e) => edgeSourceId(e)));
	const roots = state.nodes.filter((n) => !childIds.has(n.id));

	if (roots.length === 0) {
		// Fallback: use first node
		const first = state.nodes[0];
		if (!first) return null;
		roots.push(first);
	}

	// Build parent → children map
	const childrenMap = new Map<string, string[]>();
	for (const edge of state.edges) {
		const parentId = edgeTargetId(edge);
		const childId = edgeSourceId(edge);
		const existing = childrenMap.get(parentId) ?? [];
		existing.push(childId);
		childrenMap.set(parentId, existing);
	}

	const nodeMap = new Map(state.nodes.map((n) => [n.id, n]));

	function buildTreeNode(
		nodeId: string,
		visited: Set<string>,
	): TreeNode | null {
		if (visited.has(nodeId)) return null;
		visited.add(nodeId);

		const graphNode = nodeMap.get(nodeId);
		if (!graphNode) return null;

		const childIds = childrenMap.get(nodeId) ?? [];
		const children: TreeNode[] = [];
		for (const childId of childIds) {
			const child = buildTreeNode(childId, visited);
			if (child) children.push(child);
		}

		return { id: nodeId, graphNode, children };
	}

	// If single root, use it directly
	if (roots.length === 1 && roots[0]) {
		return buildTreeNode(roots[0].id, new Set());
	}

	// Multiple roots: create virtual root
	const virtualRoot: TreeNode = {
		id: "__virtual_root__",
		graphNode: {
			id: "__virtual_root__",
			type: "think-start",
			text: "",
			timestamp: 0,
		},
		children: [],
	};

	const visited = new Set<string>();
	for (const root of roots) {
		const child = buildTreeNode(root.id, visited);
		if (child) virtualRoot.children.push(child);
	}

	return virtualRoot;
}

function findEdgeType(
	childId: string,
	parentId: string,
	edges: GraphEdge[],
): GraphEdge["type"] {
	const edge = edges.find(
		(e) => edgeSourceId(e) === childId && edgeTargetId(e) === parentId,
	);
	return edge?.type ?? "supports";
}

function truncate(text: string, maxLen: number): string {
	if (text.length <= maxLen) return text;
	return text.slice(0, maxLen - 1) + "\u2026";
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
