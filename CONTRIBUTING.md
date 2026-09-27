# Contributing

Contributions are most useful when they improve the evidence quality of the RealWorldAPIs catalog or the reliability of the MCP adapter.

## API metadata corrections

For a correction, please provide:

1. API/provider name
2. field that should change
3. current value
4. proposed value
5. current provider documentation URL supporting the change
6. short explanation

Do not submit unsupported assumptions based on marketing copy or third-party summaries when primary provider documentation is available.

## Evidence semantics

Please preserve these rules:

- `Unknown` is not `No`.
- `Unknown` is not `Yes`.
- AI output cannot override structured evidence.
- New comparison claims should come from explicit canonical fields.
- Provider documentation is preferred evidence.

## Code changes

For MCP changes, keep the server as an adapter over the canonical RealWorldAPIs dataset rather than creating a second independent catalog or ranking engine.

Before submitting a change:

- confirm all existing MCP tools still list correctly
- confirm `find_api_for_task` still returns structured results if AI fails
- confirm `search_apis` and `compare_apis` do not infer missing values
- update `CHANGELOG.md` for user-visible behavior changes
