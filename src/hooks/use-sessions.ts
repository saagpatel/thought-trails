import { useCallback, useEffect, useState } from "react";
import * as client from "../lib/session-client";
import type { Session, SessionSummary } from "../types";

export function useSessions() {
	const [sessions, setSessions] = useState<SessionSummary[]>([]);
	const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
	const [loadedSession, setLoadedSession] = useState<Session | null>(null);

	const refreshSessions = useCallback(() => {
		client
			.listSessions()
			.then(setSessions)
			.catch((err) => console.error("[sessions] Failed to list:", err));
	}, []);

	// Load session list on mount
	useEffect(() => {
		refreshSessions();
	}, [refreshSessions]);

	const saveCurrentSession = useCallback(
		async (session: Session) => {
			try {
				await client.saveSession(session);
				refreshSessions();
			} catch (err) {
				console.error("[sessions] Failed to save:", err);
			}
		},
		[refreshSessions],
	);

	const loadSessionById = useCallback(async (id: string) => {
		try {
			const session = await client.loadSession(id);
			setLoadedSession(session);
			setActiveSessionId(id);
		} catch (err) {
			console.error("[sessions] Failed to load:", err);
		}
	}, []);

	const deleteSessionById = useCallback(
		async (id: string) => {
			try {
				await client.deleteSession(id);
				if (activeSessionId === id) {
					setLoadedSession(null);
					setActiveSessionId(null);
				}
				refreshSessions();
			} catch (err) {
				console.error("[sessions] Failed to delete:", err);
			}
		},
		[activeSessionId, refreshSessions],
	);

	const clearActiveSession = useCallback(() => {
		setLoadedSession(null);
		setActiveSessionId(null);
	}, []);

	return {
		sessions,
		activeSessionId,
		loadedSession,
		saveCurrentSession,
		loadSessionById,
		deleteSessionById,
		clearActiveSession,
		refreshSessions,
	};
}
