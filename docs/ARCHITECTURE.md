# Public interface architecture

RealWorldAPIs is an evidence-first discovery, verification and workflow-planning layer for AI agents interacting with the physical world.

Discover → Verify → Plan → Review evidence / integrate independently.

## Hosted service and historical source

Owner-confirmed hosted MCP v3.5.2 exposes seven tools as of 2026-11-13 ([acceptance](https://github.com/rwapis/rwapis_optimizer/issues/108)). The live endpoint's `tools/list` is authoritative for schemas. The unchanged `src/worker.js` is the older v3.0.1 four-tool snapshot; it does not implement the hosted seven-tool service. This repository is public source-visible, not open source.

The public interface delegates to canonical hosted services:

- `find_api_for_task`: Find an API shortlist for a task; optional AI comparison stays within the canonical shortlist.
- `search_apis`: Search and filter the canonical API catalog.
- `search_capabilities`: Discover published Verified/High capabilities, constraints and evidence.
- `verify_requirement`: Check one API against one requirement with evidence-backed YES, NO, PARTIAL or UNKNOWN results.
- `get_api`: Read an API decision profile, capabilities, access requirements and evidence.
- `compare_apis`: Compare known APIs using canonical catalog fields and capability evidence.
- `compose_workflow`: Plan 1–8 agent-supplied structured steps with API candidates, explicit Unknowns, handoffs and bounded alternatives; no AI step drafting or provider execution.

Canonical structured results and published Verified/High capability evidence take precedence over optional AI comparison. Direct provider facts remain distinct from inferred assertions; Unknown is distinct from both Yes and No.

## Workflow-planning contract

`compose_workflow` accepts an object with one `workflow` containing a complete `goal` and 1–8 agent-supplied `steps`. The optional workflow schema version is `rwapis-composer-workflow-v1`. Each step has an `id` and `query`; optional `title`, explicit `match`, `inputs` and `outputs` describe requirements and dependencies. Input `from` and `output` references name an upstream step/output. Use the live schema for exact bounds and fields; [examples](../examples/requests.md) document tool arguments without executable stubs.

The returned `rwapis-composer-dynamic-v1` plan contains workflow/step diagnostics, candidate APIs, alternatives, evidence and uncertainties, handoffs and bounded workflow options. `planning_only` is true and `execution_authorized` is false. A dependency can remain `needs_io_evidence`; selection/relevance does not establish provider interoperability, geographic coverage, licensing or production readiness. Missing evidence, access/hardware requirements, approval and physical consequences remain visible.

Website Composer may propose a decomposition from a natural-language goal. MCP planning receives structured steps from the agent and does not draft them with AI, implement internal processing or call provider APIs. Unavailable evidence or canonical services must not be replaced by invented matches. Inspect returned errors/uncertainties and `tools/list` rather than relying on the historical source as a current implementation.

Plans do not call provider APIs, guarantee interoperability or authorize physical-world execution. Unknown remains Unknown.

## Proprietary boundary

The public tool descriptions, example arguments, endpoints and returned evidence are interoperability documentation. No proprietary optimizer, ranker, verifier, Composer implementation, assertion pipeline or private benchmark is included here. See [the rights notice](../PROPRIETARY_NOTICE.md).

Catalog/evidence snapshots, hosted runtime and Registry publication versions are separate. Proposed manifest 3.0.2 changes metadata only; the [owner publication plan](PUBLICATION.md) does not deploy a Worker or replace historical source.
