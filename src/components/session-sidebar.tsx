import { useMemo, useState } from "react";
import type { SessionSummary } from "../types";

interface SessionSidebarProps {
	sessions: SessionSummary[];
	activeSessionId: string | null;
	onSelectSession: (id: string) => void;
	onDeleteSession: (id: string) => void;
	onNewSession: () => void;
}

function relativeTime(timestamp: number): string {
	const diff = Date.now() - timestamp;
	const seconds = Math.floor(diff / 1000);
	if (seconds < 60) return "just now";
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}

export function SessionSidebar({
	sessions,
	activeSessionId,
	onSelectSession,
	onDeleteSession,
	onNewSession,
}: SessionSidebarProps) {
	const [searchQuery, setSearchQuery] = useState("");

	const filteredSessions = useMemo(() => {
		if (!searchQuery.trim()) return sessions;
		const q = searchQuery.toLowerCase();
		return sessions.filter(
			(s) =>
				s.prompt.toLowerCase().includes(q) || s.model.toLowerCase().includes(q),
		);
	}, [sessions, searchQuery]);

	return (
		<div className="flex h-full w-[280px] flex-col border-r border-neutral-800 bg-neutral-900">
			{/* Search */}
			<div className="border-b border-neutral-800 p-3">
				<input
					type="text"
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					placeholder="Search sessions..."
					className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-600 focus:border-blue-500 focus:outline-none"
				/>
			</div>

			{/* New session button */}
			<div className="border-b border-neutral-800 p-3">
				<button
					type="button"
					onClick={onNewSession}
					className="w-full rounded bg-blue-600/20 px-3 py-1.5 text-xs font-bold text-blue-400 transition-colors hover:bg-blue-600/30"
				>
					+ New Session
				</button>
			</div>

			{/* Session list */}
			<div className="flex-1 overflow-y-auto">
				{filteredSessions.length === 0 && (
					<p className="p-4 text-center text-xs text-neutral-600">
						{searchQuery ? "No matching sessions" : "No sessions yet"}
					</p>
				)}
				{filteredSessions.map((session) => (
					<button
						key={session.id}
						type="button"
						onClick={() => onSelectSession(session.id)}
						onContextMenu={(e) => {
							e.preventDefault();
							if (confirm("Delete this session?")) {
								onDeleteSession(session.id);
							}
						}}
						className={`w-full border-b border-neutral-800/50 p-3 text-left transition-colors hover:bg-neutral-800/50 ${
							activeSessionId === session.id
								? "border-l-2 border-l-blue-500 bg-neutral-800/30"
								: ""
						}`}
					>
						<div className="mb-1 text-xs font-bold text-neutral-400">
							{session.model}
						</div>
						<p className="mb-1.5 line-clamp-2 text-xs leading-relaxed text-neutral-300">
							{session.prompt}
						</p>
						<div className="flex items-center gap-2 text-[10px] text-neutral-600">
							<span>{session.stats.nodeCount} nodes</span>
							<span>·</span>
							<span>{relativeTime(session.createdAt)}</span>
						</div>
					</button>
				))}
			</div>
		</div>
	);
}
