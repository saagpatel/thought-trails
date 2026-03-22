import type { GraphState } from "../types";
import { computeStats } from "../types";

type StreamingState = "idle" | "streaming" | "complete" | "error" | "cancelled";

interface ComparisonStatsProps {
	graphA: GraphState;
	graphB: GraphState;
	stateA: StreamingState;
	stateB: StreamingState;
}

function StatRow({ label, a, b }: { label: string; a: number; b: number }) {
	const max = Math.max(a, b, 1);
	return (
		<div className="space-y-0.5">
			<div className="text-[9px] uppercase tracking-wider text-neutral-600">
				{label}
			</div>
			<div className="flex items-center gap-1">
				<span className="w-6 text-right text-[10px] tabular-nums text-blue-400">
					{a}
				</span>
				<div className="flex flex-1 gap-0.5">
					<div
						className="h-1 rounded-full bg-blue-500/60"
						style={{ width: `${(a / max) * 100}%` }}
					/>
				</div>
			</div>
			<div className="flex items-center gap-1">
				<span className="w-6 text-right text-[10px] tabular-nums text-emerald-400">
					{b}
				</span>
				<div className="flex flex-1 gap-0.5">
					<div
						className="h-1 rounded-full bg-emerald-500/60"
						style={{ width: `${(b / max) * 100}%` }}
					/>
				</div>
			</div>
		</div>
	);
}

export function ComparisonStats({
	graphA,
	graphB,
	stateA,
	stateB,
}: ComparisonStatsProps) {
	const statsA = computeStats(graphA.eventLog);
	const statsB = computeStats(graphB.eventLog);

	return (
		<div className="flex w-[52px] flex-col gap-3 border-x border-neutral-800 bg-neutral-950 p-2">
			<div className="text-center text-[8px] font-bold uppercase tracking-widest text-neutral-600">
				VS
			</div>

			<StatRow label="Nodes" a={statsA.nodeCount} b={statsB.nodeCount} />
			<StatRow label="Claims" a={statsA.claimCount} b={statsB.claimCount} />
			<StatRow
				label="Backtracks"
				a={statsA.backtrackCount}
				b={statsB.backtrackCount}
			/>
			<StatRow
				label="Evidence"
				a={statsA.evidenceCount}
				b={statsB.evidenceCount}
			/>
			<StatRow
				label="Tokens"
				a={statsA.thinkingTokens}
				b={statsB.thinkingTokens}
			/>

			{/* Stream status indicators */}
			<div className="mt-auto space-y-1 text-center">
				<div
					className={`text-[9px] ${stateA === "streaming" ? "text-blue-400" : stateA === "complete" ? "text-neutral-500" : "text-neutral-700"}`}
				>
					A: {stateA === "streaming" ? "●" : stateA === "complete" ? "✓" : "○"}
				</div>
				<div
					className={`text-[9px] ${stateB === "streaming" ? "text-emerald-400" : stateB === "complete" ? "text-neutral-500" : "text-neutral-700"}`}
				>
					B: {stateB === "streaming" ? "●" : stateB === "complete" ? "✓" : "○"}
				</div>
			</div>
		</div>
	);
}
