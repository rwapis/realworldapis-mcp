# RealWorldAPIs MCP

**RealWorldAPIs is an evidence-first API registry for AI agents connecting to the physical world.**

A real-world API connects software or AI agents to data, devices, infrastructure or services representing the physical world — including weather, maps, mobility, logistics, IoT, energy and robotics.

This repository contains the remote Model Context Protocol (MCP) server for [RealWorldAPIs](https://realworldapis.com). The server exposes the same canonical 100-record catalog used by the public website and keeps one core evidence rule everywhere: **Unknown remains Unknown and is never treated as confirmed support.**

## Live service

- **Website:** https://realworldapis.com
- **Remote MCP endpoint:** https://mcp.realworldapis.com/mcp
- **MCP health:** https://mcp.realworldapis.com/health
- **Catalog JSON:** https://realworldapis.com/api/catalog.json
- **OpenAPI:** https://realworldapis.com/openapi.json
- **Full LLM catalog:** https://realworldapis.com/llms-full.txt
- **Research:** https://realworldapis.com/research/state-of-agent-ready-apis-2026

No RealWorldAPIs API key is currently required to discover or call the public MCP tools.

## Tools

RealWorldAPIs MCP v3 exposes four read-only tools.

| Tool | Purpose |
| --- | --- |
| `find_api_for_task` | Natural-language API selection using the canonical deterministic shortlist, followed by a constrained AI comparison over only those candidates. |
| `search_apis` | Deterministic search and filtering over verified catalog fields. Multiple filters use AND logic. |
| `get_api` | Retrieve one canonical verified API record by slug or name. |
| `compare_apis` | Deterministic side-by-side comparison of canonical fields for 2–8 APIs. No missing field is inferred. |

## Which tool should I use?

| If you need... | Use |
| --- | --- |
| Recommendations for an open-ended natural-language task or desired outcome | `find_api_for_task` |
| Exact filtering by category, capability, protocol status or readiness | `search_apis` |
| The canonical record for one already-known API | `get_api` |
| A field-by-field comparison of 2–8 already-known candidates | `compare_apis` |

`find_api_for_task` is intentionally different from `search_apis`: it runs the canonical task-ranking flow and always forms a five-candidate structured shortlist before the optional AI explanation. `search_apis` applies strict catalog filters directly and is the right choice when exact constraints matter.


### `find_api_for_task`

Use when the user describes a goal rather than a specific API.

Example task:

```json
{
  "task": "I need my agent to connect to a car and predict weather on the route"
}
```

The structured shortlist is the source of truth. The AI layer is best-effort and may only explain the verified candidates returned by the canonical recommendation engine.

### `search_apis`

Use when the task is explicit enough to filter the registry directly.

Example:

```json
{
  "categories": ["Geospatial"],
  "agent_capabilities": ["locate"],
  "mcp": "Yes",
  "min_readiness": 60,
  "limit": 10
}
```

Only explicit stored values are used. For example, `mcp: "Yes"` will never match an API whose MCP status is `Unknown`.

### `get_api`

Example:

```json
{
  "identifier": "geoapify"
}
```

The response is the canonical RealWorldAPIs record, including category, capabilities, agent capabilities, authentication, protocol status, agent-readiness score and provider documentation links.

### `compare_apis`

Example:

```json
{
  "apis": ["Geoapify", "Google Maps Platform", "Mapbox"],
  "fields": [
    "category",
    "capabilities",
    "agent_capabilities",
    "auth_methods",
    "openapi",
    "mcp",
    "agent_readiness_score"
  ]
}
```

The comparison is deterministic. RealWorldAPIs does not infer missing support or silently replace `Unknown` with a guess.

## Connect

Any MCP client that supports remote Streamable HTTP can connect to:

```text
https://mcp.realworldapis.com/mcp
```

Example MCP configuration:

```json
{
  "mcpServers": {
    "realworldapis": {
      "url": "https://mcp.realworldapis.com/mcp"
    }
  }
}
```

### Codex-style TOML

```toml
[mcp_servers.realworldapis]
url = "https://mcp.realworldapis.com/mcp"
```

## Evidence model

RealWorldAPIs is designed around a normalized evidence layer rather than free-form API recommendations.

The catalog currently tracks fields such as:

- provider and category
- verified capabilities
- Observe / Locate / Predict / Plan / Control / Act agent capabilities
- authentication methods
- OpenAPI
- MCP
- A2A
- x402
- `llms.txt`
- agent-readiness score
- public documentation status
- authentication verification
- agent-actionable status

### Grounding rules

1. The canonical structured dataset is the source of truth.
2. `Unknown` is distinct from `No`.
3. AI may not introduce APIs outside the deterministic shortlist in `find_api_for_task`.
4. Search and comparison tools use stored catalog fields only.
5. Provider documentation should be checked before production integration.

## Why RealWorldAPIs exists

General API directories are useful for broad discovery, but AI agents increasingly need a normalized way to answer questions such as:

- Which APIs can locate a vehicle and route a technician?
- Which weather APIs are both agent-actionable and machine-readable?
- Which robotics APIs expose MCP or OpenAPI?
- Which APIs can be combined for a physical-world workflow?
- What evidence gaps remain before an agent should rely on a provider?

RealWorldAPIs focuses specifically on APIs that connect software and agents to the physical world.

## Research and dataset

The public research page, **State of Agent-Ready Real-World APIs 2026**, summarizes the current catalog snapshot across agent-readiness, protocol support and category-level evidence:

https://realworldapis.com/research/state-of-agent-ready-apis-2026

Machine-readable research data:

https://realworldapis.com/research/state-of-agent-ready-apis-2026.json

The full public catalog remains available at:

https://realworldapis.com/api/catalog.json

## Architecture

The MCP server is intentionally thin.

```text
MCP client
   |
   +-- find_api_for_task
   |      |
   |      +--> canonical RealWorldAPIs recommendation endpoint
   |      +--> constrained Workers AI comparison
   |
   +-- search_apis ----+
   +-- get_api --------+--> canonical RealWorldAPIs catalog
   +-- compare_apis ---+
```

This avoids maintaining a second independent ranking or evidence system inside the MCP server.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for more detail.

## Repository layout

```text
src/
  worker.js               Cloudflare Worker implementing the remote MCP server

examples/
  requests.md             Example tool calls and expected semantics

docs/
  ARCHITECTURE.md         Data flow, grounding and failure behavior
  DATA_MODEL.md           Important catalog fields and evidence semantics

CHANGELOG.md               Release history
CONTRIBUTING.md            Contribution and correction workflow
LICENSE_RECOMMENDATION.md  Licensing note before choosing an open-source license
```

## Status

Current MCP server version: **3.0.1**

Current tool set:

- `find_api_for_task`
- `search_apis`
- `get_api`
- `compare_apis`

The live service can evolve independently from third-party directory caches, so external listings may temporarily show an older tool count, description or schema score after a deployment.

## Contributing

Corrections to API metadata are welcome when they are supported by current provider documentation. Please include the evidence URL and identify the exact field that should change.

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

No open-source license is included in this starter pack by default. If you want the repository code to be open source, add a license explicitly. MIT is a reasonable simple option for this kind of MCP server, but the choice should match how you want others to reuse the code.

See [LICENSE_RECOMMENDATION.md](LICENSE_RECOMMENDATION.md).
