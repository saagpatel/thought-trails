# thought-trails — Implementation Roadmap

## Architecture

### System Overview
```
User (prompt input + model select)
  └── React frontend (Vite + TypeScript)
        ├── PromptPanel — input form, model selector, submit
        ├── GraphCanvas — D3.js force simulation, live node rendering
        ├── ReplayControls — playback speed, scrub, export
        └── StatusBar — Ollama connection state, token count, node count
              ↕ Tauri event bridge (IPC)
        Rust backend (Tauri)
          ├── ollama_stream.rs — reqwest streaming client → /api/generate
          ├── cot_parser.rs — heuristic parser, emits ReasoningEvent per segment
          └── event_emitter.rs — app.emit_all("reasoning-event", payload)
              ↕ HTTP streaming
        Ollama (localhost:11434)
          └── /api/generate { model, prompt, stream: true }
```

### File Structure
```
thought-trails/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs                 # Tauri builder, command registration
│   │   ├── lib.rs                  # Tauri plugin wiring
│   │   ├── commands/
│   │   │   └── ollama.rs           # #[tauri::command] start_reasoning_stream
│   │   ├── ollama_stream.rs        # reqwest streaming, NDJSON parsing
│   │   ├── cot_parser.rs           # CoT heuristic parser → ReasoningEvent
│   │   └── types.rs                # Shared Rust types (ReasoningEvent, etc.)
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/
│   ├── components/
│   │   ├── PromptPanel.tsx          # Prompt textarea + model selector + submit
│   │   ├── GraphCanvas.tsx          # D3.js mount point, useEffect wiring
│   │   ├── ReplayControls.tsx       # Play/pause/speed slider + export buttons
│   │   └── StatusBar.tsx            # Connection status, counters
│   ├── hooks/
│   │   ├── useOllamaStream.ts       # Tauri event listener → graph state updates
│   │   ├── useGraphSimulation.ts    # D3 force sim initialization + node/edge add
│   │   └── useReplay.ts             # Replay mode: event log → timed playback
│   ├── lib/
│   │   ├── graph-builder.ts         # Maps ReasoningEvent → GraphNode/GraphEdge
│   │   ├── exporter.ts              # SVG serialization + JSON export
│   │   └── ollama-client.ts         # Tauri invoke wrapper (typed)
│   ├── types/
│   │   └── index.ts                 # All shared TypeScript types
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── tests/
│   ├── cot_parser_test.rs           # Rust unit tests for parser
│   └── graph-builder.test.ts        # TS unit tests for graph-builder.ts
├── fixtures/
│   └── deepseek-samples/            # 10+ raw Ollama stream logs from spike
│       ├── sample-01-coding.txt
│       ├── sample-02-math.txt
│       └── ...
├── CLAUDE.md
├── IMPLEMENTATION-ROADMAP.md
├── package.json
└── tsconfig.json
```

### TypeScript Types

```typescript
// src/types/index.ts

// Raw event emitted by Rust cot_parser per reasoning segment
export type ReasoningEventType = 'claim' | 'evidence' | 'backtrack' | 'conclusion' | 'think-start' | 'think-end';

export interface ReasoningEvent {
  type: ReasoningEventType;
  id: string;           // nanoid() — unique per event
  text: string;         // The reasoning text for this segment
  parentId?: string;    // Links evidence/backtrack to parent claim
  targetId?: string;    // For backtrack: which prior node is being revised
  timestamp: number;    // ms since reasoning start (for replay)
  tokenIndex: number;   // Cumulative token position (for replay scrubbing)
}

// D3 graph nodes
export interface GraphNode {
  id: string;
  type: ReasoningEventType;
  text: string;
  timestamp: number;
  // D3 force simulation injects these at runtime:
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphEdge {
  source: string;   // GraphNode id
  target: string;   // GraphNode id
  type: 'supports' | 'contradicts' | 'concludes';
}

export interface GraphState {
  nodes: GraphNode[];
  edges: GraphEdge[];
  eventLog: ReasoningEvent[];   // Full ordered log for replay
}

// Ollama API
export interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream: true;
  options?: {
    temperature?: number;
    num_predict?: number;
  };
}

export interface OllamaStreamChunk {
  model: string;
  created_at: string;
  response: string;   // Single token or token fragment
  done: boolean;
  done_reason?: string;
}

// Node visual config
export const NODE_COLORS: Record<ReasoningEventType, string> = {
  'claim': '#3B82F6',        // blue-500
  'evidence': '#22C55E',     // green-500
  'backtrack': '#F97316',    // orange-500
  'conclusion': '#A855F7',   // purple-500
  'think-start': '#6B7280',  // gray-500
  'think-end': '#6B7280',
};

export const NODE_RADII: Record<ReasoningEventType, number> = {
  'claim': 12,
  'evidence': 9,
  'backtrack': 10,
  'conclusion': 14,
  'think-start': 6,
  'think-end': 6,
};
```

### Rust Types

```rust
// src-tauri/src/types.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ReasoningEventType {
    Claim,
    Evidence,
    Backtrack,
    Conclusion,
    ThinkStart,
    ThinkEnd,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReasoningEvent {
    pub r#type: ReasoningEventType,
    pub id: String,
    pub text: String,
    pub parent_id: Option<String>,
    pub target_id: Option<String>,
    pub timestamp: u64,
    pub token_index: usize,
}

#[derive(Debug, Deserialize)]
pub struct OllamaChunk {
    pub response: String,
    pub done: bool,
    pub done_reason: Option<String>,
}
```

### API Contracts

**External: Ollama `/api/generate`**
| Field | Value |
|-------|-------|
| Base URL | `http://localhost:11434` |
| Endpoint | `POST /api/generate` |
| Auth | None (local only) |
| Rate limit | None (local) |
| Stream | NDJSON — one JSON object per line, `\n`-delimited |
| Done signal | `{"done": true, "done_reason": "stop"}` |

**Health check:** `GET http://localhost:11434/api/tags` — returns 200 if Ollama is running. Use this on app launch to detect Ollama availability.

**Tauri IPC Commands:**
```typescript
// Invoke from frontend
invoke('start_reasoning_stream', {
  model: 'deepseek-r1:14b',
  prompt: string
}): Promise<void>

invoke('cancel_stream'): Promise<void>

invoke('list_ollama_models'): Promise<string[]>
```

**Tauri Events (emitted by Rust → received by React):**
```typescript
listen<ReasoningEvent>('reasoning-event', (event) => { ... })
listen<{ reason: string }>('stream-complete', (event) => { ... })
listen<{ message: string }>('stream-error', (event) => { ... })
```

### Dependencies

```bash
# Frontend (run from project root)
npm install d3 @types/d3 nanoid

# Tauri plugins
npm install @tauri-apps/api @tauri-apps/plugin-notification

# Dev deps
npm install -D vitest @testing-library/react @testing-library/user-event jsdom
```

```toml
# Cargo.toml additions
[dependencies]
reqwest = { version = "0.12", features = ["stream", "json"] }
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
uuid = { version = "1", features = ["v4"] }
futures-util = "0.3"
tauri-plugin-notification = "2"
```

---

## Scope Boundaries

**In scope (v1):**
- Ollama connection detection + error state
- DeepSeek-R1 and Qwen3 model support
- Live streaming CoT graph visualization
- 4 node types: claim, evidence, backtrack, conclusion
- Zoom + pan on the graph
- Replay mode with adjustable speed
- SVG export + JSON export
- Model selector (from live Ollama model list)
- Node cap: 200 nodes max (graceful degradation warning at 150)

**Out of scope (v1 — do not build):**
- Multi-model side-by-side comparison
- Annotation / notes layer on nodes
- Graph keyword search
- Shareable graph URLs
- Session history across app restarts
- Streaming to remote Ollama instances
- Any cloud features

**Deferred to v2:**
- Collapsible subtrees (graph becomes unreadable at 200+ nodes without zoom)
- Multi-model comparison (Phase 4+)
- Annotation layer

---

## CoT Parser Design

This is the highest-risk component. Do not write this until Phase 0 spike is complete.

### Parser Strategy (heuristic, not XML parsing)

The `<think>` block text is NOT well-formed XML. It is free-form reasoning text with emergent structural signals:

**Signal patterns to detect (validate against real data during spike):**

| Pattern | Node Type | Example Signals |
|---------|-----------|----------------|
| New assertion / hypothesis | `claim` | Sentence starts reasoning from scratch, introduces new idea |
| Supporting elaboration | `evidence` | "because", "since", "this means", "for example", "specifically" |
| Self-correction | `backtrack` | "wait", "actually", "no,", "hmm, let me reconsider", "that's wrong" |
| Synthesis / answer | `conclusion` | "therefore", "so the answer is", "in conclusion", "thus" |
| Block boundary | `think-start` / `think-end` | Literal `<think>` and `</think>` token detection |

**Segmentation strategy:**
- Split on sentence boundaries (`. `, `? `, `! `, newlines)
- Minimum segment length: 20 chars (discard fragments)
- Maximum segment length: 300 chars (split long paragraphs)
- Classify each segment with the signal pattern table above
- Parent linking: evidence/backtrack nodes link to the most recent claim node

**Parser state machine (Rust):**
```
IDLE → (detect <think>) → IN_THINK_BLOCK → (detect </think>) → IDLE
                              ↓
                     segment accumulator
                              ↓
                     classify_segment() → emit ReasoningEvent
```

### Spike Task (before writing parser)

1. Install and run: `ollama pull deepseek-r1:14b`
2. Write a minimal Rust binary (not the app) that calls `/api/generate` and logs the raw NDJSON stream to a file
3. Run 10 prompts across categories:
   - 3x math/logic: `"Solve: A bat and ball cost $1.10. The bat costs $1.00 more than the ball. How much does the ball cost?"`
   - 3x coding: `"Write a recursive fibonacci in Python. Explain each step of your reasoning."`
   - 2x multi-hop: `"If all Bloops are Razzles, and all Razzles are Lazzles, are all Bloops Lazzles?"`
   - 2x open-ended: `"What are 3 underrated risks of using LLMs in production?"`
4. Save raw outputs to `fixtures/deepseek-samples/`
5. Manually annotate 3 of the 10 files — mark which sentences are claims, evidence, backtracks, conclusions
6. Only then, implement the parser to match those annotations

---

## Phase 0: Spike + Data Pipeline (Week 1–2)

**Objective:** Working data pipeline from Ollama → Rust parser → Tauri event → React console log. No graph UI yet — just prove the pipeline works end to end.

**Tasks:**

1. **Scaffold Tauri 2.0 + React + TypeScript project**
   - `npm create tauri-app@latest thought-trails -- --template react-ts`
   - Configure `tauri.conf.json`: frameless window, min size 900×600, title "thought-trails"
   - Add all npm and Cargo dependencies from the Dependencies section above
   - **Acceptance:** `npm run tauri dev` launches an empty React app in a frameless window

2. **Implement Ollama health check command**
   - Rust command `list_ollama_models` — hits `GET /api/tags`, returns model name array
   - React `StatusBar.tsx` calls this on mount, shows "Ollama connected (N models)" or "Ollama not detected" error state
   - **Acceptance:** With Ollama running, StatusBar shows model list. With Ollama stopped, shows error message — no crash

3. **Implement raw Ollama streaming (spike logging mode)**
   - Rust `start_reasoning_stream` command — `reqwest` POST to `/api/generate` with `stream: true`
   - Parse NDJSON line by line via `futures_util::StreamExt`
   - Log full token stream to `fixtures/deepseek-samples/` (controlled by a `SPIKE_LOG=true` env flag)
   - **Acceptance:** Submit prompt → see raw tokens accumulating in a log file. Run 10 prompts, save all outputs.

4. **Implement CoT parser**
   - Write `cot_parser.rs` AFTER reviewing spike outputs
   - Unit tests in `cot_parser_test.rs` against 3+ annotated fixture files — all tests pass before wiring to app
   - **Acceptance:** `cargo test` passes. Parser correctly identifies node types for the 3 manually annotated fixtures with >70% accuracy on claim/backtrack detection

5. **Wire parser → Tauri emit → React event listener**
   - Parser emits `ReasoningEvent` structs → `app.emit_all("reasoning-event", event)`
   - React `useOllamaStream.ts` hook: `listen("reasoning-event", ...)` → `console.log(event)`
   - **Acceptance:** Submit prompt → browser devtools shows structured `ReasoningEvent` objects streaming in real time. Events have correct `type` classification. End-to-end latency < 200ms per token.

**Verification Checklist — Phase 0:**
- [ ] `npm run tauri dev` → frameless window at 900×600 minimum
- [ ] `cargo test` → all parser unit tests pass
- [ ] Submit DeepSeek-R1 prompt → see `ReasoningEvent` objects in devtools console
- [ ] Stop Ollama → StatusBar shows error, app does not crash
- [ ] 10+ fixture files saved in `fixtures/deepseek-samples/`

**Risks:**
- NDJSON streaming with reqwest has async cancellation complexity → use a `CancellationToken` (tokio_util) from the start, not as an afterthought
- Tauri 2.0 API differs from 1.x for `emit_all` → consult Tauri 2.0 docs specifically, not 1.x examples

---

## Phase 1: Graph Layer (Week 3–4)

**Objective:** Live D3.js force-directed graph that builds in real time as reasoning events arrive. Full visual differentiation of node types. Zoom + pan.

**Tasks:**

1. **Initialize D3 force simulation in `useGraphSimulation.ts`**
   - `d3.forceSimulation` with `forceLink` (distance 80), `forceManyBody` (strength -200), `forceCenter`
   - SVG viewport: full window minus `PromptPanel` height (~120px)
   - Zoom/pan via `d3.zoom` — attach to SVG container
   - **Acceptance:** Empty graph renders; zoom in/out and pan work with mouse/trackpad

2. **Implement `graph-builder.ts` — maps ReasoningEvent → GraphNode/GraphEdge**
   - `addEvent(event: ReasoningEvent, state: GraphState): GraphState` — pure function, no mutation
   - Evidence nodes link to most-recent claim node; backtrack nodes link to `targetId` or most-recent claim
   - Unit tests: `graph-builder.test.ts` — 8+ test cases covering all event type transitions
   - **Acceptance:** All unit tests pass. `addEvent` called with a sequence of 20 mock events produces correct node/edge counts

3. **Live node addition to D3 simulation**
   - `useOllamaStream.ts` dispatches each `ReasoningEvent` → `graph-builder.ts` → simulation node/edge arrays mutated via D3 restart
   - Node appearance: opacity 0 → 1 over 300ms CSS transition
   - Node radius from `NODE_RADII`, fill from `NODE_COLORS`
   - Node label: first 40 chars of `event.text` as SVG `<text>` beneath node
   - **Acceptance:** Submit prompt → nodes appear live on graph, colored by type, with fade-in animation

4. **Edge rendering**
   - SVG `<line>` elements for each `GraphEdge`
   - Arrow markers (`<defs><marker>`) for directed edges
   - Edge color: grey (#9CA3AF) for supports, red (#EF4444) for contradicts
   - **Acceptance:** Evidence nodes visibly connect to their parent claim nodes with directed lines

5. **200-node cap + warning**
   - When `nodes.length === 150`: show toast "Reasoning graph approaching display limit (150/200 nodes)"
   - When `nodes.length === 200`: stop adding nodes, show "Display limit reached — graph capped at 200 nodes. Full reasoning available in JSON export."
   - **Acceptance:** Mock 201 events → graph stops at 200 nodes, warning shown, no crash

**Verification Checklist — Phase 1:**
- [ ] All graph-builder unit tests pass (`npm test`)
- [ ] Submit prompt → live graph builds node by node
- [ ] Node colors match type: blue=claim, green=evidence, orange=backtrack, purple=conclusion
- [ ] Zoom in to 400%, pan around graph — no performance degradation
- [ ] Submit prompt that produces 50+ nodes → graph remains readable with zoom/pan
- [ ] Node cap warning appears at 150, graph stops at 200

**Risks:**
- D3 simulation `restart()` on every new node causes jitter if forces are too strong → tune `alphaDecay` (try 0.02) and `velocityDecay` (try 0.4) during Phase 1 testing
- Long reasoning text labels overlap — clamp label to 40 chars and add `title` tooltip with full text

---

## Phase 2: Polish + Export (Week 5–6)

**Objective:** Replay mode, SVG/JSON export, prompt UI polish, model selector, session sidebar. Shippable v1.

**Tasks:**

1. **Implement `useReplay.ts` — replay mode**
   - Store full `eventLog: ReasoningEvent[]` in graph state during live streaming
   - Replay: clear graph, replay events at configurable speed (0.5x, 1x, 2x, 4x) using `setTimeout` with timestamp deltas
   - Controls: Play, Pause, speed selector, scrub slider (0–100% of event log)
   - **Acceptance:** After any completed session, click Replay → graph rebuilds from scratch at selected speed. Pause mid-replay → graph frozen at that point.

2. **SVG Export (`exporter.ts`)**
   - Serialize current SVG element to string
   - Inject `<style>` block with node colors into SVG (so it renders correctly standalone)
   - Trigger browser download via `URL.createObjectURL` + `<a>` click
   - **Acceptance:** Click "Export SVG" → file downloads → open in browser → graph renders correctly without the app

3. **JSON Export (`exporter.ts`)**
   - Export `{ nodes: GraphNode[], edges: GraphEdge[], eventLog: ReasoningEvent[], meta: { model, prompt, timestamp } }`
   - **Acceptance:** Click "Export JSON" → file downloads → valid JSON parseable with `JSON.parse`

4. **`PromptPanel.tsx` — full prompt UI**
   - Textarea: multi-line, min 3 rows, max 20 rows, keyboard submit (Cmd+Enter)
   - Model selector: dropdown populated from `list_ollama_models` — refresh button
   - Temperature slider: 0.1–1.0, default 0.7
   - Submit / Cancel button (Cancel triggers `cancel_stream` invoke)
   - **Acceptance:** Submit with Cmd+Enter works. Cancel stops the stream mid-reasoning. Model list populates from live Ollama.

5. **macOS packaging + testing**
   - `npm run tauri build` → produces `.dmg`
   - Test: install from DMG on M-series Mac, launch, run 3 full reasoning sessions
   - Test: launch with Ollama not running → error state shown, not crash
   - Test: run 200-node session → no crash
   - **Acceptance:** DMG installs and runs. All three test scenarios pass.

**Verification Checklist — Phase 2:**
- [ ] Replay mode: full replay at 1x speed produces identical graph to live session
- [ ] SVG export: downloaded file opens correctly in Safari and Chrome
- [ ] JSON export: valid, complete JSON with all nodes/edges/eventLog
- [ ] Cmd+Enter submits prompt
- [ ] Cancel stops stream — graph frozen at cancel point
- [ ] `npm run tauri build` produces working `.dmg`
- [ ] Definition of Done checklist from Notion brief: all items checked

---

## Definition of Done (v1)

- [ ] App launches and detects local Ollama instance
- [ ] User enters a prompt, selects a model, submits
- [ ] Reasoning graph builds live as the model thinks
- [ ] Node types are visually distinct (blue/green/orange/purple)
- [ ] Graph is zoomable and pannable
- [ ] Replay mode works at all speeds
- [ ] SVG export works — standalone file renders correctly
- [ ] JSON export works — valid, complete output
- [ ] App does not crash on 200-node reasoning chains
- [ ] Ollama-not-running shows error state, not crash
- [ ] `cargo clippy` clean, all unit tests pass

---

## Session Planning

| Session | Phase | Focus | Expected Output |
|---------|-------|-------|----------------|
| 1 | Phase 0, Tasks 1–3 | Scaffold + raw streaming + spike logging | 10 fixture files, raw stream confirmed |
| 2 | Phase 0, Tasks 4–5 | Parser implementation + pipeline wiring | ReasoningEvents streaming to console |
| 3 | Phase 1, Tasks 1–2 | D3 init + graph-builder | Empty animated graph, unit tests pass |
| 4 | Phase 1, Tasks 3–5 | Live node addition + edges + cap | Full live graph building |
| 5 | Phase 2, Tasks 1–3 | Replay + exports | Replay + SVG/JSON download working |
| 6 | Phase 2, Tasks 4–5 | UI polish + packaging | Shippable DMG |

Estimate: 6 sessions × ~2 hours = 12 hours total (within original 6–8 week estimate at 2 sessions/week)
