import { useCallback, useEffect, useRef, useState } from "react";
import { StatusBar } from "./components/status-bar";
import { useOllamaStream } from "./hooks/use-ollama-stream";
import { listOllamaModels } from "./lib/ollama-client";

export function App() {
	const [prompt, setPrompt] = useState("");
	const [models, setModels] = useState<string[]>([]);
	const [selectedModel, setSelectedModel] = useState("");
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const { state, tokenCount, thinkingText, responseText, start, cancel } =
		useOllamaStream();

	useEffect(() => {
		listOllamaModels()
			.then((m) => {
				setModels(m);
				if (m.length > 0 && m[0]) setSelectedModel(m[0]);
			})
			.catch(() => {
				/* StatusBar handles error display */
			});
	}, []);

	const handleSubmit = useCallback(() => {
		if (!prompt.trim() || !selectedModel || state === "streaming") return;
		start(selectedModel, prompt.trim());
	}, [prompt, selectedModel, state, start]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
				e.preventDefault();
				handleSubmit();
			}
		},
		[handleSubmit],
	);

	return (
		<div className="flex h-screen flex-col bg-neutral-950 text-neutral-100">
			{/* Phase 0: Temporary prompt UI for testing */}
			<div className="shrink-0 border-b border-neutral-800 p-4">
				<div className="mx-auto flex max-w-2xl gap-3">
					<select
						value={selectedModel}
						onChange={(e) => setSelectedModel(e.target.value)}
						className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-200"
					>
						{models.map((m) => (
							<option key={m} value={m}>
								{m}
							</option>
						))}
					</select>
					<textarea
						ref={textareaRef}
						value={prompt}
						onChange={(e) => setPrompt(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Enter a prompt... (Cmd+Enter to submit)"
						rows={2}
						className="flex-1 resize-none rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 focus:border-blue-500 focus:outline-none"
					/>
					{state === "streaming" ? (
						<button
							onClick={cancel}
							type="button"
							className="rounded bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-500"
						>
							Cancel
						</button>
					) : (
						<button
							onClick={handleSubmit}
							type="button"
							disabled={!prompt.trim() || !selectedModel}
							className="rounded bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-40"
						>
							Send
						</button>
					)}
				</div>
			</div>

			{/* Phase 0: Raw output display for testing */}
			<main className="flex-1 overflow-auto p-4">
				<div className="mx-auto max-w-2xl">
					{state !== "idle" && (
						<div className="mb-3 flex items-center gap-3 text-xs text-neutral-500">
							<span>
								State: <strong className="text-neutral-300">{state}</strong>
							</span>
							<span>Tokens: {tokenCount}</span>
						</div>
					)}
					{thinkingText && (
						<div className="mb-4">
							<h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-orange-400/70">
								Thinking
							</h3>
							<pre className="whitespace-pre-wrap rounded border border-neutral-800 bg-neutral-900/50 p-3 text-sm italic leading-relaxed text-neutral-400">
								{thinkingText}
							</pre>
						</div>
					)}
					{responseText && (
						<div>
							<h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-blue-400/70">
								Response
							</h3>
							<pre className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-300">
								{responseText}
							</pre>
						</div>
					)}
					{state === "idle" && !thinkingText && !responseText && (
						<p className="text-center text-neutral-600">
							Enter a prompt above to start streaming
						</p>
					)}
				</div>
			</main>

			<StatusBar />
		</div>
	);
}
