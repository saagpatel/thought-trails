// Raw event emitted by Rust cot_parser per reasoning segment
export type ReasoningEventType =
	| "claim"
	| "evidence"
	| "backtrack"
	| "conclusion"
	| "think-start"
	| "think-end";

export interface ReasoningEvent {
	type: ReasoningEventType;
	id: string;
	text: string;
	parentId?: string;
	targetId?: string;
	timestamp: number;
	tokenIndex: number;
}

// D3 graph nodes
export interface GraphNode {
	id: string;
	type: ReasoningEventType;
	text: string;
	timestamp: number;
	x?: number;
	y?: number;
	vx?: number;
	vy?: number;
	fx?: number | null;
	fy?: number | null;
}

export interface GraphEdge {
	source: string;
	target: string;
	type: "supports" | "contradicts" | "concludes";
}

export interface GraphState {
	nodes: GraphNode[];
	edges: GraphEdge[];
	eventLog: ReasoningEvent[];
}

// Stream status from Rust
export type StreamState = "streaming" | "complete" | "error" | "cancelled";

export interface StreamStatus {
	state: StreamState;
	message: string;
}

// Node visual config
export const NODE_COLORS: Record<ReasoningEventType, string> = {
	claim: "#3B82F6",
	evidence: "#22C55E",
	backtrack: "#F97316",
	conclusion: "#A855F7",
	"think-start": "#6B7280",
	"think-end": "#6B7280",
};

export const NODE_RADII: Record<ReasoningEventType, number> = {
	claim: 12,
	evidence: 9,
	backtrack: 10,
	conclusion: 14,
	"think-start": 6,
	"think-end": 6,
};
