# MCP examples

## Open-ended task
Use `find_api_for_task` when you have an outcome rather than exact filters.

```json
{"task":"I need my agent to connect to a car and predict weather on the route"}
```

## Strict search
Use `search_apis` when exact constraints matter.

```json
{"categories":["Geospatial"],"agent_capabilities":["locate"],"mcp":"Yes","min_readiness":60,"limit":10}
```

## One record

```json
{"identifier":"geoapify"}
```

## Compare known candidates

```json
{"apis":["Geoapify","Google Maps Platform","Mapbox"],"fields":["capabilities","mcp","openapi","agent_readiness_score"]}
```
