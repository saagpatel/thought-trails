type ReplayState = "idle" | "playing" | "paused";
type ReplaySpeed = 0.5 | 1 | 2 | 4;

interface ReplayControlsProps {
	replayState: ReplayState;
	replaySpeed: ReplaySpeed;
	replayProgress: number;
	totalEvents: number;
	currentEvents: number;
	onPlay: () => void;
	onPause: () => void;
	onReset: () => void;
	onScrub: (progress: number) => void;
	onCycleSpeed: () => void;
}

export function ReplayControls({
	replayState,
	replaySpeed,
	replayProgress,
	totalEvents,
	currentEvents,
	onPlay,
	onPause,
	onReset,
	onScrub,
	onCycleSpeed,
}: ReplayControlsProps) {
	return (
		<div className="absolute bottom-16 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900/90 px-4 py-2 backdrop-blur">
			{/* Reset */}
			<button
				type="button"
				onClick={onReset}
				className="text-neutral-400 transition-colors hover:text-neutral-200"
				title="Reset"
			>
				<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
					<path d="M2 3v10l5-5zM9 3v10l5-5z" />
				</svg>
			</button>

			{/* Play/Pause */}
			<button
				type="button"
				onClick={replayState === "playing" ? onPause : onPlay}
				className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white transition-colors hover:bg-blue-500"
				title={replayState === "playing" ? "Pause" : "Play"}
			>
				{replayState === "playing" ? (
					<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
						<rect x="2" y="1" width="4" height="12" rx="1" />
						<rect x="8" y="1" width="4" height="12" rx="1" />
					</svg>
				) : (
					<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
						<path d="M3 1.5v11l9-5.5z" />
					</svg>
				)}
			</button>

			{/* Scrub slider */}
			<input
				type="range"
				min="0"
				max="1"
				step="0.001"
				value={replayProgress}
				onChange={(e) => onScrub(Number.parseFloat(e.target.value))}
				className="h-1 w-32 cursor-pointer appearance-none rounded-full bg-neutral-700 accent-blue-500"
			/>

			{/* Event counter */}
			<span className="min-w-[5rem] text-center text-xs tabular-nums text-neutral-400">
				{currentEvents} / {totalEvents}
			</span>

			{/* Speed */}
			<button
				type="button"
				onClick={onCycleSpeed}
				className="min-w-[3rem] rounded border border-neutral-700 px-2 py-0.5 text-center text-xs font-bold text-neutral-300 transition-colors hover:border-neutral-600 hover:text-neutral-100"
				title="Change speed"
			>
				{replaySpeed}x
			</button>
		</div>
	);
}
