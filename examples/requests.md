# Hosted MCP examples

These are tool arguments for the hosted service, not provider actions or executable implementations. Live `tools/list` is authoritative; the repository's historical v3.0.1 Worker does not implement all seven tools. Hosted v3.5.2 was owner-confirmed on 2026-11-13.

## Discover an API shortlist — `find_api_for_task`

Optional AI comparison stays within the canonical shortlist.

```json
{"task":"Find APIs to read vehicle data and check weather along a planned route; do not execute provider APIs"}
```

## Strict catalog search — `search_apis`

```json
{"categories":["Geospatial"],"agent_capabilities":["locate"],"mcp":"Yes","min_readiness":60,"limit":10}
```

Unknown does not satisfy an explicit Yes filter.

## Capability evidence — `search_capabilities`

```json
{"query":"driving route","limit":3}
```

## Verify a requirement — `verify_requirement`

```json
{"api":"here-location-services","requirement":"truck routing in Sweden"}
```

YES / NO / PARTIAL / UNKNOWN reports evidence, not execution permission or a guaranteed geographic result.

## Inspect a record — `get_api`

```json
{"identifier":"geoapify"}
```

## Compare known candidates — `compare_apis`

```json
{"apis":["Geoapify","Google Maps Platform","Mapbox"],"fields":["capabilities","mcp","openapi","agent_readiness_score"]}
```

## Plan agent-supplied steps — `compose_workflow`

compose_workflow accepts 1–8 agent-supplied structured steps and returns planning-only API candidates, evidence, explicit Unknowns, handoffs and bounded alternatives. It does not draft steps with AI, implement processing or execute provider operations.

```json
{
  "workflow": {
    "schema_version": "rwapis-composer-workflow-v1",
    "goal": "Geocode a street address in Stockholm, then use the coordinates to calculate a driving route to Gothenburg. Do not execute any APIs.",
    "steps": [
      {
        "id": "geocode",
        "query": "Geocode a street address in Stockholm",
        "inputs": [
          {
            "name": "street_address",
            "type": "Unknown"
          }
        ],
        "outputs": [
          {
            "name": "coordinates",
            "type": "Unknown"
          }
        ]
      },
      {
        "id": "route",
        "query": "Calculate a driving route from the returned coordinates to Gothenburg. Do not execute any APIs.",
        "inputs": [
          {
            "name": "origin",
            "type": "Unknown",
            "from": "geocode",
            "output": "coordinates"
          },
          {
            "name": "destination",
            "type": "Unknown"
          }
        ],
        "outputs": [
          {
            "name": "driving_route",
            "type": "Unknown"
          }
        ]
      }
    ]
  }
}
```

The street address and destination inputs remain to be supplied. This example does not claim that a candidate has been selected or that Sweden coverage and provider interoperability are verified.

Guaranteed planning flags (response excerpt, not a complete or fabricated recommendation):

```json
{"schema_version":"rwapis-composer-dynamic-v1","planning_only":true,"execution_authorized":false}
```

The full response includes `workflow`, `steps`, `handoffs` and `workflow_options`. A geocoding → routing handoff can remain `needs_io_evidence`. Review candidate evidence, partial/unsupported requirements, alternatives, Unknown dependencies, access, hardware, safety and approval constraints before independent integration.

Website Composer can propose steps from a natural-language goal; this MCP tool does not. Preserve the complete original goal and prohibitions in the structured workflow.

Plans do not call provider APIs, guarantee interoperability or authorize physical-world execution. Unknown remains Unknown.
