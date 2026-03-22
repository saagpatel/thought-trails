type LayoutMode = "force" | "tree";

interface GraphToolbarProps {
	layoutMode: LayoutMode;
	onLayoutChange: (mode: LayoutMode) => void;
	onCollapseAll: () => void;
	onExpandAll: () => void;
	collapsedCount: number;
}

export function GraphToolbar({
	layoutMode,
	onLayoutChange,
	onCollapseAll,
	onExpandAll,
	collapsedCount,
}: GraphToolbarProps) {
	return (
		<div className="absolute right-4 top-14 flex items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-900/90 p-1 backdrop-blur">
			{/* Layout toggle */}
			<button
				type="button"
				onClick={() => onLayoutChange("force")}
				className={`rounded px-2 py-1 text-xs transition-colors ${
					layoutMode === "force"
						? "bg-blue-600/20 text-blue-400"
						: "text-neutral-500 hover:text-neutral-300"
				}`}
				title="Force-directed layout"
			>
				Force
			</button>
			<button
				type="button"
				onClick={() => onLayoutChange("tree")}
				className={`rounded px-2 py-1 text-xs transition-colors ${
					layoutMode === "tree"
						? "bg-blue-600/20 text-blue-400"
						: "text-neutral-500 hover:text-neutral-300"
				}`}
				title="Tree layout"
			>
				Tree
			</button>

			<div className="mx-1 h-4 w-px bg-neutral-700" />

			{/* Collapse controls */}
			<button
				type="button"
				onClick={onCollapseAll}
				className="rounded px-2 py-1 text-xs text-neutral-500 transition-colors hover:text-neutral-300"
				title="Collapse all claims"
			>
				Fold
			</button>
			<button
				type="button"
				onClick={onExpandAll}
				className="rounded px-2 py-1 text-xs text-neutral-500 transition-colors hover:text-neutral-300"
				title="Expand all"
			>
				Unfold
			</button>
			{collapsedCount > 0 && (
				<span className="px-1 text-[10px] tabular-nums text-neutral-600">
					{collapsedCount}
				</span>
			)}
		</div>
	);
}
