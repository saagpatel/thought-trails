import { useCallback, useState } from "react";
import type { ComparisonConfig } from "../types";

interface ComparisonPromptProps {
	models: string[];
	onCompare: (config: ComparisonConfig) => void;
	onBack: () => void;
}

export function ComparisonPrompt({
	models,
	onCompare,
	onBack,
}: ComparisonPromptProps) {
	const [modelA, setModelA] = useState(models[0] ?? "");
	const [modelB, setModelB] = useState(models[1] ?? models[0] ?? "");
	const [prompt, setPrompt] = useState("");
	const [temperature, setTemperature] = useState(0.7);

	const handleCompare = useCallback(() => {
		if (!prompt.trim() || !modelA || !modelB) return;
		onCompare({
			modelA,
			modelB,
			prompt: prompt.trim(),
			temperature,
		});
	}, [prompt, modelA, modelB, temperature, onCompare]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
				e.preventDefault();
				handleCompare();
			}
		},
		[handleCompare],
	);

	return (
		<div className="p-3">
			<div className="mx-auto max-w-4xl space-y-2">
				<div className="flex items-center gap-3">
					{/* Model A */}
					<div className="flex items-center gap-1.5">
						<span className="h-2 w-2 rounded-full bg-blue-500" />
						<select
							value={modelA}
							onChange={(e) => setModelA(e.target.value)}
							className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-200"
						>
							{models.map((m) => (
								<option key={m} value={m}>
									{m}
								</option>
							))}
						</select>
					</div>

					<span className="text-xs text-neutral-600">vs</span>

					{/* Model B */}
					<div className="flex items-center gap-1.5">
						<span className="h-2 w-2 rounded-full bg-emerald-500" />
						<select
							value={modelB}
							onChange={(e) => setModelB(e.target.value)}
							className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-200"
						>
							{models.map((m) => (
								<option key={m} value={m}>
									{m}
								</option>
							))}
						</select>
					</div>

					{/* Temperature */}
					<div className="flex items-center gap-2">
						<label htmlFor="comp-temp" className="text-xs text-neutral-500">
							Temp
						</label>
						<input
							id="comp-temp"
							type="range"
							min="0.1"
							max="1.0"
							step="0.1"
							value={temperature}
							onChange={(e) =>
								setTemperature(Number.parseFloat(e.target.value))
							}
							className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-neutral-700 accent-blue-500"
						/>
						<span className="w-6 text-xs tabular-nums text-neutral-400">
							{temperature.toFixed(1)}
						</span>
					</div>

					<div className="flex-1" />

					<button
						type="button"
						onClick={onBack}
						className="rounded border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-200"
					>
						Back
					</button>
					<button
						type="button"
						onClick={handleCompare}
						disabled={!prompt.trim() || !modelA || !modelB}
						className="rounded bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-40"
					>
						Compare
					</button>
				</div>

				<textarea
					value={prompt}
					onChange={(e) => setPrompt(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder="Enter a prompt to compare both models... (Cmd+Enter)"
					rows={2}
					className="w-full resize-none rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 focus:border-blue-500 focus:outline-none"
				/>
			</div>
		</div>
	);
}
