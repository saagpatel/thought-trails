import { useCallback, useRef, useState } from "react";
import type { ReasoningEvent } from "../types";

type ReplayState = "idle" | "playing" | "paused";
type ReplaySpeed = 0.5 | 1 | 2 | 4;

const SPEEDS: ReplaySpeed[] = [0.5, 1, 2, 4];
const MIN_DELAY_MS = 16; // One frame minimum

export function useReplay(fullEventLog: ReasoningEvent[]) {
	const [replayState, setReplayState] = useState<ReplayState>("idle");
	const [replayEvents, setReplayEvents] = useState<ReasoningEvent[]>([]);
	const [replaySpeed, setReplaySpeedState] = useState<ReplaySpeed>(1);

	const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
	const currentIndexRef = useRef(0);
	const speedRef = useRef<ReplaySpeed>(1);

	const scheduleNext = useCallback(() => {
		const idx = currentIndexRef.current;
		if (idx >= fullEventLog.length) {
			setReplayState("paused");
			return;
		}

		const event = fullEventLog[idx];
		if (!event) return;

		const prevTimestamp = idx > 0 ? (fullEventLog[idx - 1]?.timestamp ?? 0) : 0;
		const delta = event.timestamp - prevTimestamp;
		const delay = Math.max(MIN_DELAY_MS, delta / speedRef.current);

		timeoutRef.current = setTimeout(() => {
			currentIndexRef.current = idx + 1;
			setReplayEvents(fullEventLog.slice(0, idx + 1));

			// Schedule next
			scheduleNext();
		}, delay);
	}, [fullEventLog]);

	const play = useCallback(() => {
		if (fullEventLog.length === 0) return;

		// If at the end, restart from beginning
		if (currentIndexRef.current >= fullEventLog.length) {
			currentIndexRef.current = 0;
			setReplayEvents([]);
		}

		setReplayState("playing");
		scheduleNext();
	}, [fullEventLog, scheduleNext]);

	const pause = useCallback(() => {
		clearTimeout(timeoutRef.current);
		setReplayState("paused");
	}, []);

	const setSpeed = useCallback(
		(speed: ReplaySpeed) => {
			speedRef.current = speed;
			setReplaySpeedState(speed);

			// If playing, restart the chain with new speed
			if (replayState === "playing") {
				clearTimeout(timeoutRef.current);
				scheduleNext();
			}
		},
		[replayState, scheduleNext],
	);

	const cycleSpeed = useCallback(() => {
		const currentIdx = SPEEDS.indexOf(speedRef.current);
		const nextSpeed = SPEEDS[(currentIdx + 1) % SPEEDS.length] ?? 1;
		setSpeed(nextSpeed);
	}, [setSpeed]);

	const scrub = useCallback(
		(progress: number) => {
			clearTimeout(timeoutRef.current);
			const targetIndex = Math.round(
				Math.max(0, Math.min(1, progress)) * fullEventLog.length,
			);
			currentIndexRef.current = targetIndex;
			setReplayEvents(fullEventLog.slice(0, targetIndex));
			setReplayState("paused");
		},
		[fullEventLog],
	);

	const reset = useCallback(() => {
		clearTimeout(timeoutRef.current);
		currentIndexRef.current = 0;
		setReplayEvents([]);
		setReplayState("idle");
	}, []);

	const replayProgress =
		fullEventLog.length > 0 ? replayEvents.length / fullEventLog.length : 0;

	return {
		replayState,
		replaySpeed,
		replayProgress,
		replayEvents,
		currentEventCount: replayEvents.length,
		totalEventCount: fullEventLog.length,
		play,
		pause,
		setSpeed,
		cycleSpeed,
		scrub,
		reset,
	};
}
