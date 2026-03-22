import { useEffect, useState } from "react";

type ConnectionState = "connecting" | "connected" | "error";

export function StatusBar() {
	const [state, setState] = useState<ConnectionState>("connecting");
	const [modelCount, setModelCount] = useState(0);
	const [errorMessage, setErrorMessage] = useState("");

	useEffect(() => {
		let cancelled = false;

		async function checkOllama() {
			try {
				const { listOllamaModels } = await import("../lib/ollama-client");
				const models = await listOllamaModels();
				if (!cancelled) {
					setModelCount(models.length);
					setState("connected");
				}
			} catch (err) {
				if (!cancelled) {
					setErrorMessage(
						err instanceof Error ? err.message : "Could not connect to Ollama",
					);
					setState("error");
				}
			}
		}

		checkOllama();
		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<div className="flex h-10 shrink-0 items-center justify-between border-t border-neutral-800 px-4 text-xs">
			<div className="flex items-center gap-2">
				<span
					className={`inline-block h-2 w-2 rounded-full ${
						state === "connected"
							? "bg-emerald-500"
							: state === "error"
								? "bg-red-500"
								: "bg-amber-500 animate-pulse"
					}`}
				/>
				{state === "connecting" && (
					<span className="text-neutral-500">Connecting to Ollama...</span>
				)}
				{state === "connected" && (
					<span className="text-neutral-400">
						Ollama connected ({modelCount}{" "}
						{modelCount === 1 ? "model" : "models"})
					</span>
				)}
				{state === "error" && (
					<span className="text-red-400">
						Ollama not detected — {errorMessage}
					</span>
				)}
			</div>
			<span className="text-neutral-600">thought-trails v0.1.0</span>
		</div>
	);
}
