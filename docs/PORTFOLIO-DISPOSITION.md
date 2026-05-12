# thought-trails — Portfolio Disposition

**Status:** Release Frozen — Tauri 2 + Rust + React + D3 + **local
Ollama** chain-of-thought visualizer at **v1.0.0** on `origin/main`,
streaming reasoning tokens from Ollama and rendering them as a
typed D3 force-directed graph in real time. .dmg distribution build
deps + CSP. **29th signing cluster member.** Introduces a new
sub-pattern inside the signing cluster: **local-LLM-dependent
desktop app** (depends on user-run Ollama at `localhost:11434`).

> Disposition uses strict `origin/main` verification.
> **Introduces local-LLM-dependent sub-pattern inside signing
> cluster.**

---

## Verification posture

Only `origin` (`saagpatel/thought-trails`). Clean.

`origin/main`:

- Tip: `c14887f` chore: update build dependencies for .dmg
  distribution
- v1.0 release closeout cadence:
  - `c14887f` .dmg distribution build deps
  - `c610e30` **chore: bump version to 1.0.0 and add Content
    Security Policy** (combined commit — slight variant of standard
    cadence)
  - `cdded32` docs: update CLAUDE.md to reflect current project
    state
- Full OSS scaffolding wave
- Default branch: `main`

---

## Current state in one paragraph

thought-trails is a Tauri 2 + Rust + React + D3 desktop app that
connects to a **local Ollama instance** (`localhost:11434`),
streams reasoning tokens (typically from `<think>`-tagged
chain-of-thought blocks emitted by reasoning-capable models),
parses claims / evidence / backtracks / conclusions via a heuristic
**Rust streaming parser**, and renders them as a **D3 force-directed
graph** with typed nodes appearing in real time as tokens stream
in. Comparison mode runs the same prompt against two models side
by side. Replay supports 0.5× to 4× scrub speed. Cmd+F search
highlights nodes; export as SVG or JSON. Session history persists
locally. Per memory: Tauri 2 React D3 Ollama local LLM
chain-of-thought visualizer, multi-model comparison. v1.0.0 on
canonical main.

---

## Why "Release Frozen" — 29th signing cluster member, new sub-pattern

Standard Tauri 2 v1.0 signature. Introduces a **local-LLM-dependent
sub-pattern**:

| Aspect | Standard signing cluster | **thought-trails (local-LLM sub-pattern)** |
|---|---|---|
| Network dependency | Optional (per app) | **Required: local Ollama at `localhost:11434`** |
| User prerequisite | App + DMG | App + DMG + Ollama install + model pull |
| Privacy posture | Per-app | **Strong: all reasoning happens locally; nothing leaves user's machine** |
| Update risk | Per-app | **Ollama API changes risk breaking the app independently of operator releases** |

Other repos that use AI integrate via cloud APIs (Anthropic SDK in
APIReverse / ReturnRadar / ScreenshottoDataSelect / mcpforge).
thought-trails is the first to require a **local LLM runtime** as a
prerequisite. Future local-LLM-dependent desktop apps (sibling
candidates: anything Ollama / LM Studio / llama.cpp powered) batch
in this sub-pattern.

---

## Cluster taxonomy update

| Cluster | Count | Sub-patterns hint |
|---|---|---|
| **Signing (Apple desktop)** | **29** | nspanel overlay (IRS, GlassLayer) / menu-bar tray (Pulse Orbit) / **local-LLM-dependent (thought-trails)** / hybrid extension (APIReverse) |

The signing cluster's informal sub-pattern lattice is now
recognizable. None are formalized as sub-shapes because all share
the same distribution channel (DMG via Apple Developer ID), but
they have meaningfully different operator concerns.

---

## Unblock trigger (operator)

1. **Apple Developer ID + notarization credentials.**
2. **Ollama install UX** — primary onboarding friction. First-run
   experience should:
   - Detect if Ollama is running on `localhost:11434`
   - If not, link to Ollama install + guide user through `ollama
     pull <model>` for a recommended starter model
   - Detect available models and prompt selection
3. **Model recommendations** — which models work well with this
   app? `<think>`-emitting reasoning models (e.g., `qwq`, certain
   Qwen variants, DeepSeek R1 distillations) are the target.
   Document explicitly.
4. **Heuristic parser robustness** — the Rust streaming parser
   for claims / evidence / backtracks / conclusions is heuristic;
   verify across multiple model output styles.
5. **`<think>` block schema** — different models emit
   chain-of-thought differently; parser should degrade gracefully
   if model doesn't emit `<think>` blocks (or has different
   structure).
6. **Privacy positioning** — "all reasoning is local" is a strong
   marketing hook; lead with it in distribution copy.
7. **Verify signed/notarized DMG** opens cleanly + detects
   Ollama on first launch.

Estimated operator time: ~3-4 hours.

---

## Portfolio operating system instructions

| Aspect | Posture |
|---|---|
| Portfolio status | `Release Frozen` |
| Distribution channel | **DMG via Apple Developer ID** |
| Version | **v1.0.0** |
| Review cadence | Suspend overdue counting |
| Resurface conditions | (a) Apple signing credentials, (b) Ollama API breaking change, (c) `<think>`-block parser robustness work, (d) v1.1 (more model styles, more node types) |
| Co-batch with | Signing cluster — **now 29 repos** |
| Sub-pattern | **Local-LLM-dependent** (Ollama prerequisite) |
| Special concern | **Ollama install UX as primary onboarding friction.** Non-technical users won't have Ollama installed. |
| Special concern | **Heuristic parser robustness across model output styles.** |
| Special concern | **Privacy positioning is a strong marketing hook** — emphasize. |

---

## Reactivation procedure

1. Verify branch tracking.
2. Review stash `r15-thoughttrails-stash` (CLAUDE.md +
   package-lock.json + .codex/ + AGENTS.md + pnpm-lock.yaml).
3. Test with multiple reasoning models (`qwq:32b`, `deepseek-r1`,
   etc.) — heuristic parser robustness.
4. Test Ollama-not-running first-run UX flow.
5. Run `cargo test` + `npm test`.

---

## Last known reference

| Field | Value |
|---|---|
| `origin/main` tip | `c14887f` chore: update build dependencies for .dmg distribution |
| Default branch | `main` |
| Build system | Tauri 2 + Rust (streaming parser) + React + TypeScript + D3 |
| Version | **v1.0.0** |
| Required runtime | **Local Ollama at `localhost:11434`** |
| Distinguishing tech | Live D3 force-directed graph + Rust streaming parser for claims/evidence/backtracks/conclusions + multi-model comparison + scrub replay + SVG/JSON export |
| Migration state | No `legacy-origin` remote |
| Distinguishing feature | **29th signing cluster member. Introduces local-LLM-dependent sub-pattern.** First app in the portfolio that requires a local LLM runtime as a prerequisite. |
