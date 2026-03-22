import { getCurrentWindow } from "@tauri-apps/api/window";

export function WindowControls() {
	const win = getCurrentWindow();

	return (
		<div className="flex items-center gap-2 pl-2">
			<button
				type="button"
				onClick={() => win.close()}
				className="h-3 w-3 rounded-full bg-red-500 transition-opacity hover:opacity-80"
				title="Close"
			/>
			<button
				type="button"
				onClick={() => win.minimize()}
				className="h-3 w-3 rounded-full bg-yellow-500 transition-opacity hover:opacity-80"
				title="Minimize"
			/>
			<button
				type="button"
				onClick={() => win.toggleMaximize()}
				className="h-3 w-3 rounded-full bg-green-500 transition-opacity hover:opacity-80"
				title="Maximize"
			/>
		</div>
	);
}
