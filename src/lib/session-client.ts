import { invoke } from "@tauri-apps/api/core";
import type { Session, SessionSummary } from "../types";

export async function saveSession(session: Session): Promise<void> {
	const sessionJson = JSON.stringify(session);
	return invoke("save_session", { sessionJson, id: session.id });
}

export async function loadSession(id: string): Promise<Session> {
	const json = await invoke<string>("load_session", { id });
	return JSON.parse(json) as Session;
}

export async function deleteSession(id: string): Promise<void> {
	return invoke("delete_session", { id });
}

export async function listSessions(): Promise<SessionSummary[]> {
	const json = await invoke<string>("list_sessions");
	return JSON.parse(json) as SessionSummary[];
}
