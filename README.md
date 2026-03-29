![Platform](https://img.shields.io/badge/platform-macOS-lightgrey?style=flat-square) ![Tauri](https://img.shields.io/badge/Tauri-2.0-24C8D8?style=flat-square&logo=tauri) ![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react) ![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript) ![Rust](https://img.shields.io/badge/Rust-2021-CE422B?style=flat-square&logo=rust) ![D3](https://img.shields.io/badge/D3.js-7-F9A03C?style=flat-square)

# thought-trails

Visualize LLM chain-of-thought as a live force-directed graph.

thought-trails connects to a local [Ollama](https://ollama.com) instance, streams a model's reasoning tokens in real time, and parses the `<think>` block into a graph of typed reasoning nodes — claims, evidence, backtracks, and conclusions. Each node appears on the canvas as it is generated, so you can watch a model's reasoning structure emerge as it thinks.

Sessions are saved automatically and can be replayed at variable speed, searched by keyword, and exported as SVG or JSON.

<!-- TODO: Add screenshot -->

## What it does

- **Live graph** — submits a prompt to any locally-running Ollama model and renders the chain-of-thought as a D3 force-directed graph, one node at a time
- **Node types** — claims (blue), evidence (green), backtracks (orange), and conclusions (purple) are parsed from the raw reasoning stream by a heuristic Rust parser
- **Comparison mode** — run the same prompt against two models side by side and compare their reasoning graphs
- **Replay** — replay any completed session at 0.5×, 1×, 2×, or 4× speed with a scrub slider
- **Search** — Cmd+F to search node text; matching nodes highlight and collapsed parents auto-expand
- **Export** — download the current graph as a standalone SVG or a full JSON snapshot (nodes, edges, event log, metadata)
- **Session history** — sessions are persisted locally and accessible from the sidebar across app restarts

## Tech stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Tauri 2 |
| Frontend | React 18 + TypeScript 5.7 |
| Styling | Tailwind CSS 4 |
| Graph rendering | D3.js 7 |
| Build tool | Vite 6 |
| Backend | Rust (reqwest streaming, heuristic CoT parser) |
| LLM runtime | Ollama (local, any model) |
| Testing | Vitest + Testing Library |

## Prerequisites

- [Rust](https://rustup.rs) (stable toolchain)
- [Node.js](https://nodejs.org) 20+
- [Ollama](https://ollama.com) running locally on port 11434
- At least one model pulled, e.g. `ollama pull deepseek-r1:14b`
- macOS (the app is built as a native macOS desktop app)

## Getting started

```bash
# Install frontend dependencies
npm install

# Start the app in development mode
npm run tauri dev

# Build a release DMG
npm run tauri build
```

The app auto-detects Ollama on startup. If Ollama is not running, the status bar shows an error — the app does not crash.

## Running tests

```bash
# TypeScript unit tests (graph-builder, etc.)
npm test

# Watch mode
npm run test:watch
```

Rust unit tests live in `src-tauri/src/` alongside the source files and run via `cargo test` from the `src-tauri/` directory.

## Project structure

```
thought-trails/
├── src/                        # React frontend
│   ├── components/             # UI components (GraphCanvas, PromptPanel, ReplayControls, …)
│   ├── hooks/                  # React hooks (useOllamaStream, useReplay, useSessions, …)
│   ├── lib/                    # Pure logic (graph-builder, exporter, ollama-client)
│   ├── types/                  # Shared TypeScript types
│   ├── App.tsx                 # Root component and state orchestration
│   └── main.tsx
├── src-tauri/                  # Rust backend
│   ├── src/                    # Tauri commands, Ollama streaming client, CoT parser
│   ├── Cargo.toml
│   └── tauri.conf.json
├── fixtures/
│   └── deepseek-samples/       # Raw Ollama stream samples used during parser development
├── package.json
└── vite.config.ts
```

## License

MIT
