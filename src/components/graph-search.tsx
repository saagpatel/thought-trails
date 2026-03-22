import { useRef } from "react";

interface GraphSearchProps {
	query: string;
	onQueryChange: (query: string) => void;
	matchCount: number;
	totalNodes: number;
}

export function GraphSearch({
	query,
	onQueryChange,
	matchCount,
	totalNodes,
}: GraphSearchProps) {
	const inputRef = useRef<HTMLInputElement>(null);

	return (
		<div className="absolute left-4 top-4 flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900/90 px-3 py-1.5 backdrop-blur">
			<svg
				width="14"
				height="14"
				viewBox="0 0 14 14"
				fill="none"
				className="text-neutral-500"
			>
				<circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" />
				<line
					x1="9.5"
					y1="9.5"
					x2="13"
					y2="13"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
				/>
			</svg>
			<input
				ref={inputRef}
				type="text"
				value={query}
				onChange={(e) => onQueryChange(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Escape") {
						onQueryChange("");
						inputRef.current?.blur();
					}
				}}
				placeholder="Search nodes..."
				className="w-28 bg-transparent text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none"
				id="graph-search-input"
			/>
			{query && (
				<span className="text-xs tabular-nums text-neutral-500">
					{matchCount}/{totalNodes}
				</span>
			)}
		</div>
	);
}
