# Changelog

## 3.0.1 — 2026-09-27

### Tool metadata and schema quality

- Added explicit `outputSchema` declarations for all four MCP tools.
- Rewrote tool descriptions to front-load outcome and tool-selection guidance.
- Documented every non-obvious input parameter, including defaults, strict-vs-hint semantics and failure behavior.
- Clarified that `find_api_for_task.limit`, `free_tier` and `min_readiness` are backward-compatible inputs rather than strict canonical filters.
- Clarified `search_apis` sorting, limit behavior, AND semantics and lack of pagination.
- Clarified `compare_apis` default fields and unresolved-identifier behavior.
- No recommendation, ranking, catalog, AI, timeout or filtering logic changed.


## 3.0.0 — 2026-09-26

### Added

- `search_apis`
- `get_api`
- `compare_apis`

### Changed

- Repositioned the server as an evidence-first API registry for AI agents connecting to the physical world.
- Kept `find_api_for_task` on the canonical RealWorldAPIs deterministic shortlist.
- Search, retrieval and comparison now operate directly over the canonical catalog.
- MCP metadata and health output list all four tools.

### Evidence semantics

- `Unknown` remains `Unknown`.
- Deterministic structured records remain authoritative.
- `compare_apis` does not infer absent comparison fields.

## 2.3.x

- Improved task-relevant unknown handling.
- Added deterministic narrative grounding.
- Switched MCP AI comparison to a lower-latency Workers AI model with timeout-safe fallback.

## 2.2.x

- Moved constrained AI comparison into the MCP Worker to reduce synchronous MCP latency.
- Preserved browser recommendation parity for the deterministic top five.
