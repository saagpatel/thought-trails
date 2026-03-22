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

function resolveEdgeTarget(
	event: ReasoningEvent,
	existingNodes: GraphNode[],
): string | undefined {
	if (event.type === "claim") return undefined; // Claims start new branches

	// Backtracks prefer targetId over parentId
	const targetId =
		event.type === "backtrack" && event.targetId
			? event.targetId
			: event.parentId;

	if (!targetId) return undefined;

	// Only create edge if target node exists
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
