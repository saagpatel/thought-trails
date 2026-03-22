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

// Session persistence
export interface Session {
	id: string;
	createdAt: number;
	model: string;
	prompt: string;
	temperature: number;
	eventLog: ReasoningEvent[];
	stats: SessionStats;
}

export interface SessionStats {
	nodeCount: number;
	claimCount: number;
	evidenceCount: number;
	backtrackCount: number;
	conclusionCount: number;
	thinkingTokens: number;
	durationMs: number;
}

export interface SessionSummary {
	id: string;
	createdAt: number;
	model: string;
	prompt: string;
	stats: SessionStats;
}

export function computeStats(eventLog: ReasoningEvent[]): SessionStats {
	let claimCount = 0;
	let evidenceCount = 0;
	let backtrackCount = 0;
	let conclusionCount = 0;
	let thinkingTokens = 0;

	for (const event of eventLog) {
		switch (event.type) {
			case "claim":
				claimCount++;
				break;
			case "evidence":
				evidenceCount++;
				break;
			case "backtrack":
				backtrackCount++;
				break;
			case "conclusion":
				conclusionCount++;
				break;
			default:
				break;
		}
		if (event.type !== "think-start" && event.type !== "think-end") {
			thinkingTokens++;
		}
	}

	const nodeCount =
		claimCount + evidenceCount + backtrackCount + conclusionCount;
	const timestamps = eventLog.map((e) => e.timestamp);
	const durationMs =
		timestamps.length > 1
			? Math.max(...timestamps) - Math.min(...timestamps)
			: 0;

	return {
		nodeCount,
		claimCount,
		evidenceCount,
		backtrackCount,
		conclusionCount,
		thinkingTokens,
		durationMs,
	};
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
