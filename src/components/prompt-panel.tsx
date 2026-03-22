import { useCallback, useRef, useState } from "react";

interface PromptPanelProps {
	models: string[];
	selectedModel: string;
	onModelChange: (model: string) => void;
	onRefreshModels: () => void;
	isStreaming: boolean;
	onSubmit: (prompt: string, temperature: number) => void;
	onCancel: () => void;
}

export function PromptPanel({
	models,
	selectedModel,
	onModelChange,
	onRefreshModels,
	isStreaming,
	onSubmit,
	onCancel,
}: PromptPanelProps) {
	const [prompt, setPrompt] = useState("");
	const [temperature, setTemperature] = useState(0.7);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const handleSubmit = useCallback(() => {
		if (!prompt.trim() || !selectedModel || isStreaming) return;
		onSubmit(prompt.trim(), temperature);
	}, [prompt, selectedModel, isStreaming, onSubmit, temperature]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
				e.preventDefault();
				handleSubmit();
			}
		},
		[handleSubmit],
	);

	// Auto-expand textarea rows based on content
	const lineCount = Math.min(20, Math.max(3, prompt.split("\n").length));

	return (
		<div
			className="shrink-0 border-b border-neutral-800 p-3"
			data-tauri-drag-region=""
		>
			<div className="mx-auto max-w-4xl space-y-2">
				{/* Top row: model selector + temperature + actions */}
				<div className="flex items-center gap-3">
					<div className="flex items-center gap-1">
						<select
							value={selectedModel}
							onChange={(e) => onModelChange(e.target.value)}
							className="rounded border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200"
						>
							{models.map((m) => (
								<option key={m} value={m}>
									{m}
								</option>
							))}
						</select>
						<button
							type="button"
							onClick={onRefreshModels}
							className="rounded border border-neutral-700 px-2 py-1.5 text-sm text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-200"
							title="Refresh model list"
						>
							↻
						</button>
					</div>

					{/* Temperature */}
					<div className="flex items-center gap-2">
						<label htmlFor="temperature" className="text-xs text-neutral-500">
							Temp
						</label>
						<input
							id="temperature"
							type="range"
							min="0.1"
							max="1.0"
							step="0.1"
							value={temperature}
							onChange={(e) =>
								setTemperature(Number.parseFloat(e.target.value))
							}
							className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-neutral-700 accent-blue-500"
						/>
						<span className="w-6 text-xs tabular-nums text-neutral-400">
							{temperature.toFixed(1)}
						</span>
					</div>

					<div className="flex-1" />

					{/* Submit / Cancel */}
					{isStreaming ? (
						<button
							onClick={onCancel}
							type="button"
							className="rounded bg-red-600 px-4 py-1.5 text-sm font-bold text-white hover:bg-red-500"
						>
							Cancel
						</button>
					) : (
						<button
							onClick={handleSubmit}
							type="button"
							disabled={!prompt.trim() || !selectedModel}
							className="rounded bg-blue-600 px-4 py-1.5 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-40"
						>
							Send
						</button>
					)}
				</div>

				{/* Textarea */}
				<textarea
					ref={textareaRef}
					value={prompt}
					onChange={(e) => setPrompt(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder="Enter a prompt... (Cmd+Enter to submit)"
					rows={lineCount}
					className="w-full resize-none rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 focus:border-blue-500 focus:outline-none"
				/>
			</div>
		</div>
	);
}
