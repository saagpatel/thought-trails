import { useMemo, useState } from "react";
import type { GraphState } from "../types";

export function useGraphSearch(graphState: GraphState) {
	const [query, setQuery] = useState("");

	const matchingNodeIds = useMemo(() => {
		if (!query.trim()) return new Set<string>();
		const q = query.toLowerCase();
		return new Set(
			graphState.nodes
				.filter((n) => n.text.toLowerCase().includes(q))
				.map((n) => n.id),
		);
	}, [query, graphState.nodes]);

	return {
		query,
		setQuery,
		matchingNodeIds,
		matchCount: matchingNodeIds.size,
	};
}
