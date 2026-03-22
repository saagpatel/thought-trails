import { getAncestors, getChildren } from "../lib/graph-builder";
import type { GraphNode, GraphState } from "../types";
import { NODE_COLORS } from "../types";

const TYPE_LABELS: Record<GraphNode["type"], string> = {
	claim: "Claim",
	evidence: "Evidence",
	backtrack: "Backtrack",
	conclusion: "Conclusion",
	"think-start": "Think Start",
	"think-end": "Think End",
};

interface NodeDetailPanelProps {
	node: GraphNode;
	graphState: GraphState;
	onClose: () => void;
	onSelectNode: (id: string) => void;
}

export function NodeDetailPanel({
	node,
	graphState,
	onClose,
	onSelectNode,
}: NodeDetailPanelProps) {
	const ancestors = getAncestors(node.id, graphState);
	const childIds = getChildren(node.id, graphState);
	const children = childIds
		.map((id) => graphState.nodes.find((n) => n.id === id))
		.filter((n): n is GraphNode => n !== undefined);

	return (
		<div className="flex h-full w-[320px] flex-col border-l border-neutral-800 bg-neutral-900">
			{/* Header */}
			<div className="flex items-center justify-between border-b border-neutral-800 p-3">
				<div className="flex items-center gap-2">
					<span
						className="inline-block h-3 w-3 rounded-full"
						style={{ backgroundColor: NODE_COLORS[node.type] }}
					/>
					<span
						className="text-xs font-bold uppercase tracking-wider"
						style={{ color: NODE_COLORS[node.type] }}
					>
						{TYPE_LABELS[node.type]}
					</span>
				</div>
				<button
					type="button"
					onClick={onClose}
					className="text-neutral-500 transition-colors hover:text-neutral-300"
				>
					<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
						<path
							d="M2.5 2.5l9 9M11.5 2.5l-9 9"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeLinecap="round"
							fill="none"
						/>
					</svg>
				</button>
			</div>

			{/* Full text */}
			<div className="border-b border-neutral-800 p-3">
				<p className="text-sm leading-relaxed text-neutral-300">{node.text}</p>
			</div>

			{/* Scrollable content */}
			<div className="flex-1 overflow-y-auto">
				{/* Ancestry */}
				{ancestors.length > 0 && (
					<div className="border-b border-neutral-800 p-3">
						<h4 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-neutral-600">
							Ancestry
						</h4>
						<div className="space-y-1">
							{ancestors.map((ancestor, i) => (
								<button
									key={ancestor.id}
									type="button"
									onClick={() => onSelectNode(ancestor.id)}
									className="flex w-full items-center gap-2 rounded px-2 py-1 text-left transition-colors hover:bg-neutral-800"
								>
									<span className="text-neutral-600">{"─".repeat(i + 1)}</span>
									<span
										className="inline-block h-2 w-2 shrink-0 rounded-full"
										style={{
											backgroundColor: NODE_COLORS[ancestor.type],
										}}
									/>
									<span className="truncate text-xs text-neutral-400">
										{ancestor.text}
									</span>
								</button>
							))}
						</div>
					</div>
				)}

				{/* Children */}
				{children.length > 0 && (
					<div className="border-b border-neutral-800 p-3">
						<h4 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-neutral-600">
							Children ({children.length})
						</h4>
						<div className="space-y-1">
							{children.map((child) => (
								<button
									key={child.id}
									type="button"
									onClick={() => onSelectNode(child.id)}
									className="flex w-full items-center gap-2 rounded px-2 py-1 text-left transition-colors hover:bg-neutral-800"
								>
									<span
										className="inline-block h-2 w-2 shrink-0 rounded-full"
										style={{
											backgroundColor: NODE_COLORS[child.type],
										}}
									/>
									<span
										className="text-[10px] font-bold uppercase"
										style={{ color: NODE_COLORS[child.type] }}
									>
										{TYPE_LABELS[child.type]}
									</span>
									<span className="truncate text-xs text-neutral-400">
										{child.text}
									</span>
								</button>
							))}
						</div>
					</div>
				)}

				{/* Metadata */}
				<div className="p-3">
					<h4 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-neutral-600">
						Metadata
					</h4>
					<dl className="space-y-1 text-xs">
						<div className="flex justify-between">
							<dt className="text-neutral-600">Timestamp</dt>
							<dd className="tabular-nums text-neutral-400">
								{node.timestamp.toLocaleString()}ms
							</dd>
						</div>
						<div className="flex justify-between">
							<dt className="text-neutral-600">Node ID</dt>
							<dd className="font-mono text-neutral-500">
								{node.id.slice(0, 8)}
							</dd>
						</div>
					</dl>
				</div>
			</div>
		</div>
	);
}
