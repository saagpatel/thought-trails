import type { GraphState } from "../types";

/**
 * Export the current SVG graph as a standalone .svg file.
 * Injects inline styles so it renders correctly in any browser.
 */
export function exportSvg(svgElement: SVGSVGElement, filename: string): void {
	const clone = svgElement.cloneNode(true) as SVGSVGElement;

	// Set XML namespace
	clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
	clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");

	// Ensure explicit dimensions
	const width = svgElement.getAttribute("width") ?? "1100";
	const height = svgElement.getAttribute("height") ?? "700";
	clone.setAttribute("width", width);
	clone.setAttribute("height", height);
	clone.setAttribute("viewBox", `0 0 ${width} ${height}`);

	// Inject inline styles for standalone rendering
	const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
	style.textContent = `
    svg { background: #0a0a0a; }
    circle { transition: none; }
    line { stroke-linecap: round; }
    text { font-family: system-ui, -apple-system, sans-serif; }
  `;
	clone.insertBefore(style, clone.firstChild);

	const serializer = new XMLSerializer();
	const svgString = serializer.serializeToString(clone);
	const blob = new Blob([svgString], { type: "image/svg+xml" });

	downloadBlob(blob, filename);
}

/**
 * Export the full graph state + metadata as a .json file.
 * Strips D3 runtime properties (x, y, vx, vy, fx, fy) from nodes.
 */
export function exportJson(
	graphState: GraphState,
	meta: { model: string; prompt: string; timestamp: number },
	filename: string,
): void {
	const cleanNodes = graphState.nodes.map(({ id, type, text, timestamp }) => ({
		id,
		type,
		text,
		timestamp,
	}));

	const exportObj = {
		nodes: cleanNodes,
		edges: graphState.edges,
		eventLog: graphState.eventLog,
		meta,
	};

	const jsonString = JSON.stringify(exportObj, null, 2);
	const blob = new Blob([jsonString], { type: "application/json" });

	downloadBlob(blob, filename);
}

function downloadBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}
