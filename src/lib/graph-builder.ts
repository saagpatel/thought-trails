import type {
	GraphEdge,
	GraphNode,
	GraphState,
	ReasoningEvent,
} from "../types";

/**
 * Pure function: maps a ReasoningEvent into an updated GraphState.
 * Does not mutate the input state.
 */
export function addEvent(event: ReasoningEvent, state: GraphState): GraphState {
	const eventLog = [...state.eventLog, event];

	// Boundary events don't create graph nodes
	if (event.type === "think-start" || event.type === "think-end") {
		return { ...state, eventLog };
	}

	// Node cap: stop adding at 200
	if (state.nodes.length >= 200) {
		return { ...state, eventLog };
	}

	const node: GraphNode = {
		id: event.id,
		type: event.type,
		text: event.text,
		timestamp: event.timestamp,
	};

	const nodes = [...state.nodes, node];
	const edges = [...state.edges];

	// Create edges based on event type
	const edgeTarget = resolveEdgeTarget(event, state.nodes);
	if (edgeTarget) {
		const edgeType = getEdgeType(event.type);
		if (edgeType) {
			edges.push({
				source: event.id,
				target: edgeTarget,
				type: edgeType,
			});
		}
	}

	return { nodes, edges, eventLog };
}

/** Get direct child node IDs (nodes whose edges point TO this node) */
export function getChildren(nodeId: string, state: GraphState): string[] {
	return state.edges
		.filter((e) => edgeTargetId(e) === nodeId)
		.map((e) => edgeSourceId(e));
}

/** Walk the edge chain from a node back to the root */
export function getAncestors(nodeId: string, state: GraphState): GraphNode[] {
	const ancestors: GraphNode[] = [];
	let currentId: string | undefined = nodeId;
	const visited = new Set<string>();

	while (currentId) {
		if (visited.has(currentId)) break;
		visited.add(currentId);

		const edge = state.edges.find((e) => edgeSourceId(e) === currentId);
		if (!edge) break;

		const parentId = edgeTargetId(edge);
		const parent = state.nodes.find((n) => n.id === parentId);
		if (!parent) break;

		ancestors.push(parent);
		currentId = parentId;
	}

	return ancestors;
}

/** Get the full subtree rooted at a node (BFS, includes the node itself) */
export function getSubtree(nodeId: string, state: GraphState): Set<string> {
	const subtree = new Set<string>([nodeId]);
	const queue = [nodeId];

	while (queue.length > 0) {
		const current = queue.shift()!;
		for (const childId of getChildren(current, state)) {
			if (!subtree.has(childId)) {
				subtree.add(childId);
				queue.push(childId);
			}
		}
	}

	return subtree;
}

/** Remove children of collapsed nodes from the visible graph */
export function filterCollapsed(
	state: GraphState,
	collapsedNodeIds: Set<string>,
): GraphState {
	if (collapsedNodeIds.size === 0) return state;

	const hiddenIds = new Set<string>();
	for (const collapsedId of collapsedNodeIds) {
		for (const childId of getChildren(collapsedId, state)) {
			const subtree = getSubtree(childId, state);
			for (const id of subtree) {
				hiddenIds.add(id);
			}
		}
	}

	const nodes = state.nodes.filter((n) => !hiddenIds.has(n.id));
	const edges = state.edges.filter(
		(e) => !hiddenIds.has(edgeSourceId(e)) && !hiddenIds.has(edgeTargetId(e)),
	);

	return { nodes, edges, eventLog: state.eventLog };
}

// --- Edge helpers (shared with use-graph-simulation.ts) ---

export function edgeSourceId(edge: GraphEdge): string {
	return typeof edge.source === "string"
		? edge.source
		: (edge.source as unknown as GraphNode).id;
}

export function edgeTargetId(edge: GraphEdge): string {
	return typeof edge.target === "string"
		? edge.target
		: (edge.target as unknown as GraphNode).id;
}

// --- Internal helpers ---

function resolveEdgeTarget(
	event: ReasoningEvent,
	existingNodes: GraphNode[],
): string | undefined {
	if (event.type === "claim") return undefined;

	const targetId =
		event.type === "backtrack" && event.targetId
			? event.targetId
			: event.parentId;

	if (!targetId) return undefined;

	const targetExists = existingNodes.some((n) => n.id === targetId);
	return targetExists ? targetId : undefined;
}

function getEdgeType(
	eventType: ReasoningEvent["type"],
): GraphEdge["type"] | undefined {
	switch (eventType) {
		case "evidence":
			return "supports";
		case "backtrack":
			return "contradicts";
		case "conclusion":
			return "concludes";
		default:
			return undefined;
	}
}
