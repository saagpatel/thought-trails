# thought-trails

## Overview
A local-first Tauri 2.0 desktop app that visualizes a local LLM's chain-of-thought reasoning as a live, interactive D3.js force-directed graph. Connects to Ollama, streams `<think>` token blocks in real time, and renders reasoning as explorable nodes — claims, evidence, backtracks, conclusions. No cloud, no API keys, no storage required for v1.

## Tech Stack
- **Rust**: 1.77+ (Tauri backend, streaming HTTP via reqwest)
- **Tauri**: 2.0 (desktop shell, event bridge, window config)
- **React**: 18.x (frontend framework)
- **TypeScript**: 5.x (strict mode)
- **D3.js**: 7.x (force-directed graph rendering)
- **Vite**: 5.x (frontend bundler)
- **Ollama**: localhost:11434 (local LLM inference — not bundled, must be pre-installed)

## Development Conventions
- TypeScript strict mode — no `any` types, no `as unknown as X` casts
- Kebab-case for files, PascalCase for components, camelCase for variables
- Conventional commits: `feat:`, `fix:`, `chore:`, `spike:`
- All data transform functions (parser, graph builder) get unit tests before UI wiring
- Rust: `cargo clippy` must pass clean before each session commit
- No inline styles in React — Tailwind utility classes only (included via CDN for v1)

## Current Phase
**Phase 0: Spike + Data Pipeline**
See IMPLEMENTATION-ROADMAP.md for full phase details, acceptance criteria, and file structure.

## Key Decisions
| Decision | Choice | Why |
|----------|--------|-----|
| Desktop shell | Tauri 2.0 | Local-first, same-machine Ollama call, no CORS, matches existing stack |
| Graph library | D3.js v7 force simulation | Best live-updating node graph; D3-force handles incremental node add natively |
| CoT parsing strategy | Heuristic regex + pattern matching on real data | LLM output is not structured XML — spike first, parse from real examples |
| Storage | None in v1 | Session-only; export to SVG/JSON covers persistence use case |
| Streaming | Rust reqwest streaming → Tauri emit_all | Keeps heavy I/O off the JS main thread |
| Window chrome | Frameless preferred | Cleaner aesthetic for a visualization tool |

## Do NOT
- Do not skip the spike — do not write the CoT parser until you have 10+ real DeepSeek-R1 output examples logged
- Do not add v2 features (multi-model comparison, annotation layer, graph search, shareable URLs) — they are explicitly out of scope
- Do not store any data to disk in v1 — session-only until the user triggers export
- Do not use class components — hooks only
- Do not add features not in the current phase of IMPLEMENTATION-ROADMAP.md
- Do not attempt to parse `<think>` blocks as well-formed XML — they are not; use heuristic text analysis
