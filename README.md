# thought-trails

[![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?style=flat-square&logo=typescript&logoColor=white)](#) [![Rust](https://img.shields.io/badge/Rust-dea584?style=flat-square&logo=rust&logoColor=white)](#) [![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](#)

> A model's chain-of-thought isn't a wall of text — it's a graph. thought-trails makes you see it that way

thought-trails connects to a local Ollama instance, streams reasoning tokens in real time, and parses the `<think>` block into a live D3 force-directed graph. Claims, evidence, backtracks, and conclusions appear as typed nodes the moment they're generated. Watch a model's reasoning structure emerge as it thinks.

## Features

- **Live graph** — submits a prompt to any local Ollama model and renders the chain-of-thought as a D3 force-directed graph, one node at a time as tokens stream in
- **Typed nodes** — claims (blue), evidence (green), backtracks (orange), and conclusions (purple) parsed by a heuristic Rust streaming parser
- **Comparison mode** — run the same prompt against two models side by side and compare their reasoning graphs
- **Replay** — replay any completed session at 0.5×, 1×, 2×, or 4× speed with a scrub slider
- **Search** — Cmd+F to search node text; matching nodes highlight and collapsed parents auto-expand
- **Export** — download the current graph as a standalone SVG or a full JSON snapshot (nodes, edges, event log, metadata)
- **Session history** — sessions persist locally across app restarts and are accessible from the sidebar

## Quick Start

### Prerequisites

- Rust stable toolchain (via [rustup](https://rustup.rs))
- Node.js 22 (22.13 or newer) and npm (`package-lock.json` is the frontend lockfile)
- For interactive model runs only: [Ollama](https://ollama.com) running locally on port 11434 and a reasoning model already pulled (for example `deepseek-r1:14b`)
- macOS (built as a native macOS desktop app)

### Installation

```bash
git clone https://github.com/saagpatel/thought-trails.git
cd thought-trails
npm ci --ignore-scripts
```

### Usage

```bash
# Start Ollama (if not already running)
ollama serve

# Development mode
npm run tauri dev

# Run tests
npm test

# Production build
npm run tauri build
```

## Verification

From the repository root after the locked install:

```bash
# Focused, deterministic graph fixture tests (no Ollama or desktop needed)
npm test -- src/lib/graph-builder.test.ts
# All frontend tests
npm test
# TypeScript check and production frontend build
npm run build
# Rust parser/session tests; requires Rust and Tauri platform build prerequisites
cargo test --locked --manifest-path src-tauri/Cargo.toml
# Narrow Rust parser lane
cargo test --locked --manifest-path src-tauri/Cargo.toml cot_parser::tests
```

The Rust tests exercise parser fixtures in memory and session persistence against throwaway directories under the system temp dir (removed after each test), not a live Ollama call. Dependency installation/builds may download packages and write local caches, `dist/`, Rust `target/`, or generated Tauri schemas; use an isolated checkout. There is no repository lint/format script or browser E2E suite, so do not report those as passed. `npm run tauri build` packages the desktop app; `npm run build` builds only its frontend.

For changed UI, inspect the affected view, keyboard interactions, graph layout, and export behavior at desktop and narrow sizes. `npm run dev -- --host 127.0.0.1` serves the browser frontend, but real IPC/model streaming needs `npm run tauri dev` and Ollama. Use a disposable test session and synthetic prompts: desktop runs persist session history and model requests contact the local service. Capture the changed surface; a frontend fixture or browser shell alone does not prove real model streaming or desktop persistence. Pure documentation edits do not require this interactive lane.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop shell | Tauri 2 |
| Frontend | React 19.3, TypeScript 7.0 |
| Graph rendering | D3.js 7 (force-directed) |
| Styling | Tailwind CSS 4 |
| Build | Vite 8.3 |
| Backend | Rust (reqwest streaming, heuristic CoT parser) |
| LLM runtime | Ollama (local, any model) |
| Tests | Vitest + Testing Library |

## Architecture

The Rust backend streams tokens from Ollama's HTTP API using `reqwest` with chunked transfer encoding and forwards parsed node events to the frontend via Tauri's event system. The heuristic CoT parser runs on the Rust side — it buffers incoming tokens, detects sentence boundaries, and classifies each span into a node type using pattern matching against a small rule set. The D3 simulation runs entirely in the browser; nodes are added incrementally without restarting the layout, so the graph evolves smoothly as reasoning progresses.

## License

MIT
