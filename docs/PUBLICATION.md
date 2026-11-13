# Coordinated metadata publication — owner review required

These documentation/manifest changes are proposed, not live. The canonical website source changes are coordinated in [Issue #108](https://github.com/rwapis/rwapis_optimizer/issues/108).

## Versions and validation

- Hosted runtime: owner-confirmed **v3.5.2**, seven tools including `compose_workflow`, on 2026-11-13.
- Public `src/worker.js`: unchanged historical **v3.0.1**, four tools. It is not the serving Worker and is not replaced with proprietary source.
- Registry manifest: proposed **3.0.2**, a metadata-only publication independent of the runtime version. The last checked repository manifest is 3.0.1. Confirm 3.0.2 is unused before publication; if another publisher update has already used it, select a fresh version in a reviewed change.

The [official Registry rules](https://modelcontextprotocol.io/registry/versioning) make each publication/version immutable. An existing 3.0.1 description cannot be overwritten. A stable 3.0.2 sorts after 3.0.1; a 3.0.1 prerelease would sort before the existing stable record and would not refresh latest. No switch to runtime version 3.5.2 is implied.

`server.json` keeps `com.realworldapis/realworldapis`, the HTTPS Streamable HTTP URL and remote-only schema. Its short description is within the Registry's 100-character limit. Validation uses the official schema referenced by `$schema` (also available in the Registry repository) and the existing workflow's `mcp-publisher validate`. Validation requires no publish, login or owner secret. Remote-only publication does not require a package or a GitHub release.

## Owner sequence after reviewed PR merges

1. Review the coordinated website artifact and approve any deployment separately. A GitHub merge does not update the canonical website or hosted MCP. Preserve the stable rollback version.
2. Check the current Registry record/version, then, only after separate publication approval, run the existing manual `.github/workflows/publish-mcp.yml` from the reviewed main revision. It validates, uses the already configured owner DNS identity, and publishes. This task does not dispatch it, authenticate, tag, release or change DNS.
3. Inspect the existing Glama connector and its source-of-truth setting. [Glama documents](https://glama.ai/mcp/faq) that Registry-linked connectors normally inherit name/description/URL from the Registry; README edits alone may not update the listing. Owner-selected Glama listing details can override those fields. Check any reindex/refresh requirement and existing ownership; do not create a duplicate or claim again unnecessarily.
4. Independently initialize the direct hosted MCP endpoint and inspect `tools/list`. Confirm all seven names, descriptions and schemas, then verify the public listing's tool count and description freshness. A directory health check is not evidence that tool calls work. Any read-only acceptance calls require the normal test markers; no provider action is authorized.

Registry and Glama publication are separate owner actions; nothing in these draft PRs updates either service automatically. This plan requests no credentials and adds no publication infrastructure.
