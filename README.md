RealWorldAPIs MCP
RealWorldAPIs is an evidence-first API registry for AI agents connecting to the physical world.
A real-world API connects software or AI agents to data, devices, infrastructure or services representing the physical world — including weather, maps, mobility, logistics, IoT, energy and robotics.
This repository documents and provides a publicly inspectable MCP interface implementation for RealWorldAPIs.
The live hosted RealWorldAPIs service is the source of truth for current tools, schemas, recommendation behavior and evidence semantics. The hosted service may evolve independently from the code visible in this repository.
One core evidence rule applies throughout the service:
Unknown remains Unknown and is never treated as confirmed support.
Public interface, proprietary intelligence
RealWorldAPIs intentionally separates its public interoperability surface from its proprietary decision systems.
Public / interoperability surface
The following are intended to be publicly discoverable and usable for interoperability:
- the remote MCP endpoint and tool schemas
- public HTTP endpoints and OpenAPI descriptions
- public API catalog and capability/evidence outputs
- public documentation and usage examples
- factual provider metadata and evidence links
- structured recommendation and verification results returned by the hosted service
Proprietary hosted systems
The following are not published or licensed through this repository:
- the canonical RealWorldAPIs recommendation and ranking engine
- natural-language task parsing and task-frame logic
- capability retrieval, fusion and sibling-capability reranking logic
- internal scoring rules, weights and optimization logic
- verification and evidence-processing implementation
- assertion-generation and research pipelines
- benchmark tooling, active private evaluation sets and holdout sets
- internal administration, proposal and approval systems
The MCP layer calls hosted canonical RealWorldAPIs services for recommendation and evidence-backed decision support. Publishing an interface, schema or result does not publish the underlying hosted implementation.
See [PROPRIETARY_NOTICE.md](PROPRIETARY_NOTICE.md) for the repository rights notice.
Live service
- Website: https://realworldapis.com
- Remote MCP endpoint: https://mcp.realworldapis.com/mcp
- MCP health: https://mcp.realworldapis.com/health
- Catalog JSON: https://realworldapis.com/api/catalog.json
- Capabilities JSON: https://realworldapis.com/api/capabilities.json
- Requirement verification: https://realworldapis.com/api/verify-requirement
- Structured recommendation: https://realworldapis.com/api/recommend
- OpenAPI: https://realworldapis.com/openapi.json
- Full LLM catalog: https://realworldapis.com/llms-full.txt
- Research: https://realworldapis.com/research/state-of-agent-ready-apis-2026
No RealWorldAPIs API key is currently required to discover or call the public MCP tools.
MCP tools
The live RealWorldAPIs MCP service currently exposes six read-only tools:
Tool	Purpose
find_api_for_task	Natural-language API selection using the canonical hosted recommender, followed by constrained comparison over returned candidates.
search_apis	Deterministic search and filtering over canonical API fields.
search_capabilities	Search the verified capability graph directly.
verify_requirement	Evidence-backed YES / NO / PARTIAL / UNKNOWN verification of one API against a specific requirement.
get_api	Retrieve one canonical API decision profile by slug or name.
compare_apis	Deterministic side-by-side comparison of canonical fields.


The live tool set and schemas are authoritative. The source-visible implementation in this repository may lag the hosted service.
Which tool should I use?
If you need...	Use
Recommendations for an open-ended natural-language task or desired outcome	find_api_for_task
Exact filtering by category, capability, protocol status or readiness	search_apis
Direct discovery over verified task-level capabilities	search_capabilities
Evidence-backed adjudication of an exact API requirement	verify_requirement
The canonical record for one already-known API	get_api
A field-by-field comparison of already-known candidates	compare_apis


find_api_for_task
Use when the user describes a goal rather than a specific API.
Example task:
{
  "task": "I need my agent to connect to a car and predict weather on the route"
}
The structured shortlist returned by the canonical hosted recommender is the source of truth. Any AI comparison is constrained to that shortlist and is not permitted to introduce outside APIs.
search_apis
Use when the task is explicit enough to filter the registry directly.
Example:
{
  "categories": ["Geospatial"],
  "agent_capabilities": ["locate"],
  "mcp": "Yes",
  "min_readiness": 60,
  "limit": 10
}
Only explicit stored values are used. For example, mcp: "Yes" must not be satisfied by an API whose MCP status is Unknown.
search_capabilities
Use when the task is better expressed as an exact capability or execution requirement than as a broad API category.
Capability results can include execution, access, approval, hardware, sandbox, physical-consequence and reversibility fields when available from the canonical evidence graph.
verify_requirement
Use when you need to adjudicate one API against one exact requirement.
Example:
{
  "api": "here-location-services",
  "requirement": "truck routing in Sweden"
}
The verifier returns an evidence-backed YES, NO, PARTIAL or UNKNOWN result. Unknown is never silently promoted into support.
get_api
Example:
{
  "identifier": "geoapify"
}
The response is the canonical RealWorldAPIs decision profile, including provider metadata, capabilities, authentication, protocol status and evidence links.
compare_apis
Example:
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
The comparison is deterministic. RealWorldAPIs does not infer missing support or silently replace Unknown with a guess.
Connect
Any MCP client that supports remote Streamable HTTP can connect to:
https://mcp.realworldapis.com/mcp
Example MCP configuration:
{
  "mcpServers": {
    "realworldapis": {
      "url": "https://mcp.realworldapis.com/mcp"
    }
  }
}
Codex-style TOML
[mcp_servers.realworldapis]
url = "https://mcp.realworldapis.com/mcp"
Evidence model
RealWorldAPIs is designed around a normalized evidence layer rather than free-form API recommendations.
The canonical dataset tracks fields such as:
- provider and category
- verified task-level capabilities
- agent action primitives
- authentication methods
- OpenAPI
- MCP
- A2A
- x402
- llms.txt
- public documentation status
- authentication verification
- access and setup requirements
- approval requirements
- hardware dependencies
- sandbox availability
- physical consequence
- irreversibility
- direct evidence links
Grounding rules
1. The canonical structured dataset is the source of truth.
2. Unknown is distinct from No.
3. AI comparison may not introduce APIs outside the structured shortlist.
4. Search and comparison tools use canonical stored evidence.
5. Hard provider facts require the appropriate evidence quality under the hosted RealWorldAPIs evidence policy.
6. Provider documentation should be checked before production integration.
Why RealWorldAPIs exists
General API directories are useful for broad discovery, but AI agents increasingly need a normalized way to answer questions such as:
- Which exact API capability can perform this task?
- Which APIs can locate a vehicle and route a technician?
- Which weather APIs are both agent-actionable and machine-readable?
- Which robotics APIs expose machine-usable interfaces?
- Which APIs can be combined for a physical-world workflow?
- What access, approval, hardware or safety constraints apply?
- What evidence gaps remain before an agent should rely on a provider?
RealWorldAPIs focuses specifically on APIs that connect software and agents to the physical world.
Research and dataset
The public research page, State of Agent-Ready Real-World APIs 2026, summarizes the catalog snapshot across agent-readiness, protocol support and category-level evidence:
https://realworldapis.com/research/state-of-agent-ready-apis-2026
Machine-readable research data:
https://realworldapis.com/research/state-of-agent-ready-apis-2026.json
The public catalog is available at:
https://realworldapis.com/api/catalog.json
The verified capability graph is available at:
https://realworldapis.com/api/capabilities.json
Architecture
The MCP server is intentionally an interface layer over canonical hosted RealWorldAPIs services.
MCP client
   |
   +-- find_api_for_task --------> hosted canonical recommender
   +-- verify_requirement --------> hosted evidence/verifier layer
   +-- search_capabilities -------> canonical capability graph
   +-- search_apis ---------------> canonical API catalog
   +-- get_api -------------------> canonical API decision profile
   +-- compare_apis --------------> canonical evidence fields
This avoids maintaining a second independent recommendation, ranking or evidence system inside the public MCP interface.
The implementation of the canonical hosted recommendation, ranking, verification and evidence-processing systems is proprietary and is not contained in this repository.
See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for additional public interface details.
Repository layout
src/
  worker.js               Publicly inspectable MCP interface implementation

examples/
  requests.md             Example tool calls and expected semantics

docs/
  ARCHITECTURE.md         Public data flow, grounding and failure behavior
  DATA_MODEL.md           Important catalog fields and evidence semantics

CHANGELOG.md               Release history
CONTRIBUTING.md            Contribution and correction workflow
PROPRIETARY_NOTICE.md      Repository rights and proprietary-service boundary
Status
The hosted RealWorldAPIs service evolves independently from this public repository.
For current production behavior, use the live MCP endpoint and canonical website endpoints. Third-party directories and this repository may temporarily show an older tool count, description, implementation detail or schema after a production deployment.
Contributing
Corrections to public API metadata are welcome when supported by current provider documentation. Please include the evidence URL and identify the exact field that should change.
Public contributions do not grant access to, or imply publication of, proprietary RealWorldAPIs ranking, verification, optimization, benchmark or research systems.
See [CONTRIBUTING.md](CONTRIBUTING.md).
Rights and licensing
This repository is publicly source-visible but is not released under an open-source license.
No MIT, Apache, BSD, GPL or other open-source license is granted by this repository.
Use of the hosted RealWorldAPIs service is separate from rights in repository source code. Public protocol descriptions, schemas and factual outputs may be used for interoperability as permitted by applicable terms and law, but the proprietary hosted RealWorldAPIs systems are not licensed through this repository.
See [PROPRIETARY_NOTICE.md](PROPRIETARY_NOTICE.md).
Copyright © 2026 RealWorldAPIs. All rights reserved.
