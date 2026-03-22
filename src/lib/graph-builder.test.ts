import { describe, expect, it } from "vitest";
import type { GraphState, ReasoningEvent } from "../types";
import {
	addEvent,
	filterCollapsed,
	getAncestors,
	getChildren,
	getSubtree,
} from "./graph-builder";

function makeEvent(
	overrides: Partial<ReasoningEvent> & { type: ReasoningEvent["type"] },
): ReasoningEvent {
	return {
		id: overrides.id ?? crypto.randomUUID(),
		type: overrides.type,
		text: overrides.text ?? `Test ${overrides.type} event`,
		parentId: overrides.parentId,
		targetId: overrides.targetId,
		timestamp: overrides.timestamp ?? 0,
		tokenIndex: overrides.tokenIndex ?? 0,
	};
}

const EMPTY_STATE: GraphState = { nodes: [], edges: [], eventLog: [] };

describe("graph-builder", () => {
	describe("addEvent", () => {
		it("creates a node with no edge for a claim", () => {
			const event = makeEvent({ type: "claim" });
			const state = addEvent(event, EMPTY_STATE);

			expect(state.nodes).toHaveLength(1);
			expect(state.edges).toHaveLength(0);
			expect(state.nodes[0]?.id).toBe(event.id);
			expect(state.nodes[0]?.type).toBe("claim");
		});

		it("creates a node and supports edge for evidence", () => {
			const claim = makeEvent({ type: "claim", id: "claim-1" });
			const evidence = makeEvent({
				type: "evidence",
				id: "ev-1",
				parentId: "claim-1",
			});

			let state = addEvent(claim, EMPTY_STATE);
			state = addEvent(evidence, state);

			expect(state.nodes).toHaveLength(2);
			expect(state.edges).toHaveLength(1);
			expect(state.edges[0]).toEqual({
				source: "ev-1",
				target: "claim-1",
				type: "supports",
			});
		});

		it("creates a contradicts edge for backtrack", () => {
			const claim = makeEvent({ type: "claim", id: "claim-1" });
			const backtrack = makeEvent({
				type: "backtrack",
				id: "bt-1",
				parentId: "claim-1",
				targetId: "claim-1",
			});

			let state = addEvent(claim, EMPTY_STATE);
			state = addEvent(backtrack, state);

			expect(state.nodes).toHaveLength(2);
			expect(state.edges).toHaveLength(1);
			expect(state.edges[0]).toEqual({
				source: "bt-1",
				target: "claim-1",
				type: "contradicts",
			});
		});

		it("creates a concludes edge for conclusion", () => {
			const claim = makeEvent({ type: "claim", id: "claim-1" });
			const conclusion = makeEvent({
				type: "conclusion",
				id: "conc-1",
				parentId: "claim-1",
			});

			let state = addEvent(claim, EMPTY_STATE);
			state = addEvent(conclusion, state);

			expect(state.nodes).toHaveLength(2);
			expect(state.edges).toHaveLength(1);
			expect(state.edges[0]).toEqual({
				source: "conc-1",
				target: "claim-1",
				type: "concludes",
			});
		});

		it("does not create nodes for think-start/think-end", () => {
			const thinkStart = makeEvent({ type: "think-start" });
			const thinkEnd = makeEvent({ type: "think-end" });

			let state = addEvent(thinkStart, EMPTY_STATE);
			state = addEvent(thinkEnd, state);

			expect(state.nodes).toHaveLength(0);
			expect(state.edges).toHaveLength(0);
			expect(state.eventLog).toHaveLength(2);
		});

		it("skips edge when parentId references missing node", () => {
			const evidence = makeEvent({
				type: "evidence",
				parentId: "nonexistent",
			});
			const state = addEvent(evidence, EMPTY_STATE);

			expect(state.nodes).toHaveLength(1);
			expect(state.edges).toHaveLength(0);
		});

		it("returns a new state object without mutating the original", () => {
			const event = makeEvent({ type: "claim" });
			const newState = addEvent(event, EMPTY_STATE);

			expect(newState).not.toBe(EMPTY_STATE);
			expect(EMPTY_STATE.nodes).toHaveLength(0);
			expect(EMPTY_STATE.edges).toHaveLength(0);
			expect(EMPTY_STATE.eventLog).toHaveLength(0);
		});

		it("handles a sequence of 20 events with correct counts", () => {
			const events: ReasoningEvent[] = [];
			events.push(makeEvent({ type: "think-start", id: "ts" }));

			// 5 claim → evidence pairs + 2 backtracks + 1 conclusion
			for (let i = 0; i < 5; i++) {
				const claimId = `claim-${i}`;
				events.push(makeEvent({ type: "claim", id: claimId }));
				events.push(
					makeEvent({
						type: "evidence",
						id: `ev-${i}`,
						parentId: claimId,
					}),
				);
			}
			events.push(
				makeEvent({
					type: "backtrack",
					id: "bt-0",
					parentId: "claim-2",
					targetId: "claim-2",
				}),
			);
			events.push(
				makeEvent({
					type: "backtrack",
					id: "bt-1",
					parentId: "claim-3",
					targetId: "claim-3",
				}),
			);
			events.push(
				makeEvent({
					type: "conclusion",
					id: "conc",
					parentId: "claim-4",
				}),
			);
			events.push(makeEvent({ type: "think-end", id: "te" }));

			// Pad to 20
			while (events.length < 20) {
				events.push(makeEvent({ type: "claim", id: `pad-${events.length}` }));
			}

			let state = EMPTY_STATE;
			for (const event of events) {
				state = addEvent(event, state);
			}

			// think-start + think-end don't create nodes
			// 5 claims + 5 evidence + 2 backtracks + 1 conclusion + pad claims = 18 nodes (20 - 2 think events)
			expect(state.nodes).toHaveLength(18);
			// 5 supports + 2 contradicts + 1 concludes = 8 edges
			expect(state.edges).toHaveLength(8);
			expect(state.eventLog).toHaveLength(20);
		});

		it("backtrack uses targetId over parentId for edge target", () => {
			const claim1 = makeEvent({ type: "claim", id: "claim-1" });
			const claim2 = makeEvent({ type: "claim", id: "claim-2" });
			const backtrack = makeEvent({
				type: "backtrack",
				id: "bt-1",
				parentId: "claim-2",
				targetId: "claim-1", // different from parentId
			});

			let state = addEvent(claim1, EMPTY_STATE);
			state = addEvent(claim2, state);
			state = addEvent(backtrack, state);

			expect(state.edges).toHaveLength(1);
			expect(state.edges[0]?.target).toBe("claim-1"); // uses targetId, not parentId
		});

		it("always appends to eventLog regardless of event type", () => {
			const events: ReasoningEvent[] = [
				makeEvent({ type: "think-start" }),
				makeEvent({ type: "claim" }),
				makeEvent({ type: "evidence", parentId: "missing" }),
				makeEvent({ type: "backtrack", parentId: "missing" }),
				makeEvent({ type: "conclusion", parentId: "missing" }),
				makeEvent({ type: "think-end" }),
			];

			let state = EMPTY_STATE;
			for (const event of events) {
				state = addEvent(event, state);
			}

			expect(state.eventLog).toHaveLength(6);
		});
	});

	describe("graph helpers", () => {
		function buildTestGraph(): GraphState {
			const events: ReasoningEvent[] = [
				makeEvent({ type: "claim", id: "c1" }),
				makeEvent({ type: "evidence", id: "e1", parentId: "c1" }),
				makeEvent({ type: "evidence", id: "e2", parentId: "c1" }),
				makeEvent({
					type: "backtrack",
					id: "b1",
					parentId: "c1",
					targetId: "c1",
				}),
				makeEvent({ type: "claim", id: "c2" }),
				makeEvent({ type: "conclusion", id: "conc1", parentId: "c2" }),
			];
			let state = EMPTY_STATE;
			for (const event of events) {
				state = addEvent(event, state);
			}
			return state;
		}

		it("getChildren returns direct children of a node", () => {
			const state = buildTestGraph();
			const children = getChildren("c1", state);

			expect(children).toHaveLength(3);
			expect(children).toContain("e1");
			expect(children).toContain("e2");
			expect(children).toContain("b1");
		});

		it("getChildren returns empty for leaf nodes", () => {
			const state = buildTestGraph();
			expect(getChildren("e1", state)).toHaveLength(0);
		});

		it("getAncestors walks the chain to root", () => {
			const state = buildTestGraph();
			const ancestors = getAncestors("e1", state);

			expect(ancestors).toHaveLength(1);
			expect(ancestors[0]?.id).toBe("c1");
		});

		it("getAncestors returns empty for root nodes", () => {
			const state = buildTestGraph();
			expect(getAncestors("c1", state)).toHaveLength(0);
		});

		it("getSubtree includes all descendants", () => {
			const state = buildTestGraph();
			const subtree = getSubtree("c1", state);

			expect(subtree.size).toBe(4); // c1 + e1 + e2 + b1
			expect(subtree.has("c1")).toBe(true);
			expect(subtree.has("e1")).toBe(true);
			expect(subtree.has("e2")).toBe(true);
			expect(subtree.has("b1")).toBe(true);
			expect(subtree.has("c2")).toBe(false);
		});

		it("filterCollapsed removes children of collapsed nodes", () => {
			const state = buildTestGraph();
			const collapsed = new Set(["c1"]);
			const filtered = filterCollapsed(state, collapsed);

			// c1 stays, its 3 children (e1, e2, b1) removed
			// c2 and conc1 stay
			expect(filtered.nodes).toHaveLength(3); // c1, c2, conc1
			expect(filtered.nodes.map((n) => n.id)).toContain("c1");
			expect(filtered.nodes.map((n) => n.id)).toContain("c2");
			expect(filtered.nodes.map((n) => n.id)).toContain("conc1");

			// Only edge: conc1 → c2 (the 3 edges to c1's children are removed)
			expect(filtered.edges).toHaveLength(1);

			// eventLog unchanged
			expect(filtered.eventLog).toBe(state.eventLog);
		});
	});
});
