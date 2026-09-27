# Architecture

RealWorldAPIs MCP is a thin read-only adapter over the canonical RealWorldAPIs evidence layer.

- `find_api_for_task` uses the canonical deterministic task-ranking endpoint, then attempts a constrained AI comparison over only those candidates.
- `search_apis` applies deterministic strict filters to the canonical catalog.
- `get_api` resolves and returns one canonical record.
- `compare_apis` compares only stored canonical fields.

The structured dataset is authoritative. `Unknown` is distinct from both `Yes` and `No`.

## Tool-selection guidance

Use `find_api_for_task` for open-ended goals, `search_apis` for exact filters, `get_api` for one known API, and `compare_apis` after candidates are already known.

## v3.0.1 metadata pass

v3.0.1 adds richer input descriptions and explicit output schemas without changing ranking, filtering, AI, timeout or catalog behavior.
