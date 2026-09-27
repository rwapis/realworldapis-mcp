const BASE_URL = "https://mcp.realworldapis.com";
const CANONICAL_SITE = "https://realworldapis.com";
const MCP_ENDPOINT = `${BASE_URL}/mcp`;
const MCP_REGISTRY_PACKAGE = "com.realworldapis/realworldapis";
const ENGINE_VERSION = "registry-tools-v3.0.1-tool-metadata";
const MCP_PROTOCOL_VERSION = "2026-07-28";
const MCP_LEGACY_PROTOCOL_VERSION = "2025-11-25";
const AI_TIMEOUT_MS = 6500;
const AI_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const BROWSER_AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const MCP_SERVER_INFO = {
  name: "realworldapis",
  title: "RealWorldAPIs",
  version: "3.0.1",
  description:
    "Evidence-first registry of real-world APIs for AI agents, with verified metadata for task-based discovery, structured search, record inspection and deterministic comparison.",
  websiteUrl: CANONICAL_SITE,
};

const GLAMA_CLAIM = "glama_claim_tXHE1VmfJv0KGn6cHlU6WPEkF7_NExC-";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Accept, MCP-Protocol-Version, Mcp-Method, Mcp-Name",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE",
  };
}

function json(body, status = 200, extra = {}) {
  return Response.json(body, {
    status,
    headers: {
      ...corsHeaders(),
      "Cache-Control": "no-store",
      ...extra,
    },
  });
}

function text(body, status = 200, contentType = "text/plain; charset=utf-8") {
  return new Response(body, {
    status,
    headers: {
      ...corsHeaders(),
      "Content-Type": contentType,
      "Cache-Control": "no-store",
    },
  });
}

function mcpServerMeta() {
  return { "io.modelcontextprotocol/serverInfo": MCP_SERVER_INFO };
}

function mcpSuccess(id, result) {
  return {
    jsonrpc: "2.0",
    id,
    result: {
      ...result,
      _meta: { ...(result?._meta || {}), ...mcpServerMeta() },
    },
  };
}

function mcpError(id, code, message, data) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: "2.0", id: id ?? null, error };
}

function isModernMcpRequest(request, body) {
  const headerVersion = request.headers.get("MCP-Protocol-Version");
  const metaVersion = body?.params?._meta?.["io.modelcontextprotocol/protocolVersion"];
  return (
    headerVersion === MCP_PROTOCOL_VERSION ||
    metaVersion === MCP_PROTOCOL_VERSION ||
    body?.method === "server/discover"
  );
}

function validateModernMcpHeaders(request, body) {
  const version = request.headers.get("MCP-Protocol-Version");
  const method = request.headers.get("Mcp-Method");
  const name = request.headers.get("Mcp-Name");

  if (version !== MCP_PROTOCOL_VERSION) {
    return {
      ok: false,
      response: mcpError(body?.id, -32022, "Unsupported protocol version", {
        supported: [MCP_PROTOCOL_VERSION, MCP_LEGACY_PROTOCOL_VERSION],
      }),
    };
  }

  if (method !== body?.method) {
    return {
      ok: false,
      response: mcpError(body?.id, -32020, "Mcp-Method header does not match JSON-RPC method"),
    };
  }

  if (body?.method === "tools/call") {
    const bodyName = body?.params?.name;
    if (!name || name !== bodyName) {
      return {
        ok: false,
        response: mcpError(body?.id, -32020, "Mcp-Name header does not match tool name"),
      };
    }
  }

  return { ok: true };
}

function compatibilityQuery(task, requirements = {}) {
  const hints = [];
  const req = requirements && typeof requirements === "object" && !Array.isArray(requirements)
    ? requirements
    : {};

  if (Array.isArray(req.categories) && req.categories.length) {
    hints.push(`Relevant categories: ${req.categories.join(", ")}.`);
  }
  if (Array.isArray(req.capabilities) && req.capabilities.length) {
    hints.push(`Needed agent capabilities: ${req.capabilities.join(", ")}.`);
  }
  if (req.mcp === "Yes") hints.push("Must support MCP.");
  if (req.openapi === "Yes") hints.push("Must support OpenAPI.");
  if (req.auth) {
    const auth = String(req.auth).replace(/_/g, " ");
    hints.push(`Authentication requirement: ${auth}.`);
  }

  return hints.length ? `${task}\n\n${hints.join(" ")}` : task;
}

function compatibilityWarnings(requirements = {}, requestedLimit) {
  const warnings = [];
  const req = requirements && typeof requirements === "object" && !Array.isArray(requirements)
    ? requirements
    : {};

  if (req.free_tier !== undefined) {
    warnings.push("free_tier is accepted for backward compatibility but is not a hard filter in the browser-parity engine.");
  }
  if (req.min_readiness !== undefined) {
    warnings.push("min_readiness is accepted for backward compatibility but is not a hard filter in the browser-parity engine.");
  }
  if (requestedLimit !== undefined && Number(requestedLimit) !== 5) {
    warnings.push("limit is accepted for backward compatibility; the canonical browser-parity flow always returns the top 5 structured candidates before AI comparison.");
  }
  return warnings;
}

function aiCandidateContext(results) {
  return results.map((r) => ({
    structured_rank: r.rank,
    structured_score: r.match_score,
    match_signals: r.match_signals,
    name: r.api?.name,
    provider: r.api?.provider,
    category: r.api?.category,
    description: r.api?.description,
    capabilities: r.api?.capabilities,
    auth_methods: r.api?.auth_methods,
    openapi: r.api?.openapi,
    mcp: r.api?.mcp,
    a2a: r.api?.a2a,
    x402: r.api?.x402,
    llms_txt: r.api?.llms_txt,
    agent_readiness_score: r.api?.agent_readiness_score,
    docs_url: r.api?.docs_url,
  }));
}

function extractAiContent(out) {
  if (out == null) return "";
  if (out.response !== undefined) return out.response;
  const directMessage = out.choices?.[0]?.message;
  if (directMessage?.parsed !== undefined) return directMessage.parsed;
  if (directMessage?.content !== undefined) {
    if (Array.isArray(directMessage.content)) {
      const joined = directMessage.content
        .map((part) => (typeof part === "string" ? part : (part?.text ?? part?.content ?? "")))
        .join("")
        .trim();
      if (joined) return joined;
    }
    return directMessage.content;
  }
  if (out.result?.response !== undefined) return out.result.response;
  const resultMessage = out.result?.choices?.[0]?.message;
  if (resultMessage?.parsed !== undefined) return resultMessage.parsed;
  if (resultMessage?.content !== undefined) {
    if (Array.isArray(resultMessage.content)) {
      const joined = resultMessage.content
        .map((part) => (typeof part === "string" ? part : (part?.text ?? part?.content ?? "")))
        .join("")
        .trim();
      if (joined) return joined;
    }
    return resultMessage.content;
  }
  return out;
}

function parseAiJson(raw) {
  if (raw && typeof raw === "object") return raw;
  if (typeof raw !== "string") {
    return { summary: "AI comparison completed.", recommendations: [], suggested_stack: [], important_unknowns: [] };
  }
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  if (!cleaned) {
    return { summary: "AI comparison completed.", recommendations: [], suggested_stack: [], important_unknowns: [] };
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(cleaned.slice(first, last + 1));
      } catch {}
    }
    return {
      summary: cleaned,
      recommendations: [],
      suggested_stack: [],
      important_unknowns: [
        "The model returned prose rather than structured JSON; the deterministic shortlist remains the source of truth.",
      ],
    };
  }
}

function isExplicitUnknown(value) {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase().replace(/[_-]+/g, " ");
  return [
    "unknown",
    "unverified",
    "not verified",
    "not yet verified",
    "unresolved",
  ].includes(normalized);
}

function queryMatches(query, patterns) {
  const text = String(query || "").toLowerCase();
  return patterns.some((pattern) => pattern.test(text));
}

function firstDefined(object, keys) {
  for (const key of keys) {
    if (object && object[key] !== undefined && object[key] !== null) return object[key];
  }
  return undefined;
}

function buildTaskRelevantUnknowns(query, structuredResults) {
  const results = Array.isArray(structuredResults) ? structuredResults : [];
  const unknowns = [];
  const seen = new Set();

  const add = (message) => {
    if (!message || seen.has(message)) return;
    seen.add(message);
    unknowns.push(message);
  };

  // Protocol / discovery unknowns are relevant only when the task explicitly asks for them.
  const protocolTopics = [
    {
      keys: ["mcp"],
      label: "MCP",
      relevant: queryMatches(query, [/\bmcp\b/i, /model context protocol/i]),
    },
    {
      keys: ["openapi"],
      label: "OpenAPI",
      relevant: queryMatches(query, [/\bopenapi\b/i, /\bswagger\b/i]),
    },
    {
      keys: ["a2a"],
      label: "A2A",
      relevant: queryMatches(query, [/\ba2a\b/i, /agent[ -]?to[ -]?agent/i]),
    },
    {
      keys: ["x402"],
      label: "x402",
      relevant: queryMatches(query, [/\bx402\b/i]),
    },
    {
      keys: ["llms_txt", "llmsTxt"],
      label: "llms.txt",
      relevant: queryMatches(query, [/llms\.?txt/i, /machine[ -]?readable/i, /agent discovery/i]),
    },
  ];

  for (const item of results) {
    const api = item?.api || {};
    const name = api.name || "Unknown API";

    for (const topic of protocolTopics) {
      if (!topic.relevant) continue;
      const value = firstDefined(api, topic.keys);
      if (isExplicitUnknown(value)) {
        add(`${topic.label} status for ${name} is Unknown`);
      }
    }
  }

  // Authentication verification is only relevant when the user explicitly asks about auth.
  const authRelevant = queryMatches(query, [
    /\bauth(?:entication)?\b/i,
    /\boauth(?:2| 2\.0)?\b/i,
    /\boidc\b/i,
    /\bapi key\b/i,
    /\bbearer\b/i,
    /\bjwt\b/i,
    /client credentials/i,
  ]);

  if (authRelevant) {
    for (const item of results) {
      const api = item?.api || {};
      const name = api.name || "Unknown API";
      const verified = firstDefined(api, ["authentication_verified", "authenticationVerified"]);
      if (verified === false || isExplicitUnknown(verified)) {
        add(`Authentication for ${name} is not verified`);
      }
    }
  }

  // Capability-status fields are included only when BOTH the task asks for that
  // capability and the dataset explicitly marks the status Unknown/unverified.
  const capabilityTopics = [
    { keys: ["observe"], label: "Observe", patterns: [/\bobserve\b/i, /\btelemetry\b/i] },
    { keys: ["locate"], label: "Locate", patterns: [/\blocate\b/i, /\blocation\b/i, /\bgeocod/i] },
    { keys: ["predict"], label: "Predict", patterns: [/\bpredict/i, /\bforecast/i] },
    { keys: ["plan"], label: "Plan", patterns: [/\bplan(?:ning)?\b/i, /\broute\b/i, /\brouting\b/i] },
    { keys: ["control"], label: "Control", patterns: [/\bcontrol\b/i, /remote start/i, /lock[ /-]?unlock/i] },
    { keys: ["act"], label: "Act", patterns: [/\bact\b/i, /\baction(?:able)?\b/i, /\bexecute\b/i, /\bcommand\b/i] },
  ];

  for (const topic of capabilityTopics) {
    if (!queryMatches(query, topic.patterns)) continue;
    for (const item of results) {
      const api = item?.api || {};
      const name = api.name || "Unknown API";
      const value = firstDefined(api, topic.keys);
      if (isExplicitUnknown(value)) {
        add(`${topic.label} capability for ${name} is Unknown`);
      }
    }
  }

  // Keep this concise. If nothing explicit and task-relevant is unknown, return [].
  return unknowns.slice(0, 8);
}


function stripUnsupportedUncertaintyNarrative(value) {
  const input = String(value || "").trim();
  if (!input) return "";

  // AI prose is allowed to describe supported fit/composition only.
  // Any uncertainty belongs exclusively in the deterministic important_unknowns field.
  const uncertaintyPatterns = [
    /\bunknowns?\b/i,
    /\buncertain(?:ty|ties)?\b/i,
    /\bunclear\b/i,
    /\bunverified\b/i,
    /\bnot verified\b/i,
    /\bnot specified\b/i,
    /\bnot explicitly\b/i,
    /\bnot provided\b/i,
    /\bnot available\b/i,
    /\bmissing\b/i,
    /\blacks?\b/i,
    /\bcannot confirm\b/i,
    /\bcan't confirm\b/i,
    /\bability to integrate\b/i,
    /\bhow to integrate\b/i,
    /\bintegration (?:is|remains|may be)\b/i,
    /\bspecific .* (?:data|capability|support).* (?:can|may) provide\b/i,
  ];

  const sentences = input
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((sentence) => !uncertaintyPatterns.some((pattern) => pattern.test(sentence)));

  return sentences.join(" ").trim();
}

function sanitizeAiAnalysis(query, rawAnalysis, structuredResults) {
  const analysis = rawAnalysis && typeof rawAnalysis === "object"
    ? { ...rawAnalysis }
    : {
        summary: "",
        recommendations: [],
        suggested_stack: [],
        important_unknowns: [],
      };

  const deterministicUnknowns = buildTaskRelevantUnknowns(query, structuredResults);

  analysis.summary = stripUnsupportedUncertaintyNarrative(analysis.summary);

  if (!analysis.summary) {
    const names = (structuredResults || [])
      .slice(0, 3)
      .map((r) => r?.api?.name)
      .filter(Boolean);
    analysis.summary = names.length
      ? `The evidence-based shortlist for this task includes ${names.join(", ")}.`
      : "The deterministic RealWorldAPIs shortlist remains the source of truth for this task.";
  }

  analysis.suggested_stack = (Array.isArray(analysis.suggested_stack) ? analysis.suggested_stack : [])
    .map(stripUnsupportedUncertaintyNarrative)
    .filter(Boolean);

  analysis.recommendations = (Array.isArray(analysis.recommendations) ? analysis.recommendations : [])
    .map((item) => ({
      ...item,
      tradeoff: deterministicUnknowns.length
        ? "See important_unknowns for task-relevant evidence gaps."
        : "",
    }));

  analysis.important_unknowns = deterministicUnknowns;
  return analysis;
}

function aiPrompt(query, structuredResults) {
  const candidates = aiCandidateContext(structuredResults);
  const system = `You are the comparison analyst for RealWorldAPIs.com.
You may ONLY reason over the supplied five API candidates and their verified fields.
Never introduce another API or provider.
Treat Unknown as unknown, never as supported.
Do not infer a named operation, device, dataset, integration or protocol from a broad category label. A claim must be directly supported by the candidate description, capabilities, auth/protocol fields or match signals supplied to you.
Never transform a related capability into a stronger direct capability. For example, routing plus weather-related evidence does not mean an API itself provides route-based weather prediction. When multiple APIs are required, describe the composition explicitly and attribute each capability only to the candidate whose verified evidence supports it.
If the user asks for something more specific than the evidence proves, explicitly say that support is not verified rather than filling the gap.
Tradeoffs should describe evidence-backed capability gaps or unknowns; do not use structured rank or score itself as a product limitation.
The user's task may require multiple complementary APIs. You may explain a recommended stack across the supplied candidates.
NARRATIVE GROUNDING:
- summary and suggested_stack must contain only positively supported capabilities and composition statements grounded in the supplied candidate evidence.
- Do not mention unknowns, uncertainties, missing information, lack of integration instructions, unverified details, limitations, or caveats inside summary or suggested_stack.
- Do not use phrases such as "however, we don't know", "important unknowns", "it is unclear", "not verified", "not specified", "ability to integrate", or equivalent uncertainty language in summary or suggested_stack.
- All task-relevant evidence gaps belong exclusively in important_unknowns, which the server will rebuild deterministically after your response.
IMPORTANT UNKNOWNS:
- Important unknowns must only contain explicit Unknown, unverified, or unresolved fields/capabilities present in the supplied candidate evidence.
- Every item in important_unknowns must be both evidence-backed AND materially relevant to the user's stated task or an explicitly requested requirement.
- Do not list generic protocol or machine-readable metadata unknowns merely because their status is Unknown. MCP, OpenAPI, A2A, x402, and llms_txt should only appear when the user's task explicitly depends on that protocol, API-description format, or machine-readable agent discovery.
- If the user does not ask for MCP, OpenAPI, A2A, x402, llms.txt, agent discovery, or an equivalent requirement, omit those unknowns unless they directly prevent a verified task requirement from being satisfied.
- Prefer task-specific capability gaps over unrelated metadata gaps. For example, for a vehicle-routing-weather task, an unverified vehicle, routing, or weather capability can be relevant; an unrelated A2A or x402 status is not.
- Do not invent architectural, implementation, compatibility, integration, or API-composition unknowns merely because the evidence does not describe how multiple APIs should be combined.
- Do not turn the absence of implementation instructions into an unknown.
- Every item in important_unknowns must be traceable to a specific field or capability in the supplied candidate data.
- If there are no material evidence-backed unknowns relevant to the user's task, return an empty list.
- Unknown remains Unknown. Never infer support from related capabilities.
- The server applies a deterministic evidence-and-task-relevance filter after your response, so do not try to pad this list.
Return valid JSON only with this shape:
{
  "summary":"one concise paragraph",
  "recommendations":[{"rank":1,"name":"exact candidate name","role":"what this API contributes to the task","fit":"why it fits","tradeoff":"main limitation or uncertainty"}],
  "suggested_stack":["short sentence describing how selected candidates combine"],
  "important_unknowns":["only task-relevant explicit evidence-backed unknowns; otherwise empty"]
}
Return exactly 3 recommendations. Keep every string concise. Output only the JSON object, with no markdown or commentary.`;
  const user = `User task:\n${query}\n\nVerified structured shortlist:\n${JSON.stringify(candidates)}`;
  return { system, user };
}

async function directAiCompare(query, structuredResults, env, timeoutMs = AI_TIMEOUT_MS) {
  if (!env?.AI) {
    return {
      state: {
        status: "unavailable",
        available: false,
        model: AI_MODEL,
        browser_reference_model: BROWSER_AI_MODEL,
        error: "Workers AI binding is not configured on the MCP Worker.",
        timeout_ms: timeoutMs,
      },
      analysis: null,
    };
  }

  const { system, user } = aiPrompt(query, structuredResults);
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve({ __timedOut: true }), timeoutMs);
  });

  try {
    const aiCall = env.AI.run(AI_MODEL, {
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      // The active low-latency model is not documented as supporting Workers AI JSON Mode.
      // Ask for compact JSON in the prompt and parse defensively instead of paying JSON-schema overhead.
      max_tokens: 420,
      temperature: 0.1,
      top_p: 0.8,
    });

    const out = await Promise.race([aiCall, timeout]);
    if (out?.__timedOut) {
      return {
        state: {
          status: "timed_out",
          available: false,
          model: AI_MODEL,
          browser_reference_model: BROWSER_AI_MODEL,
          error: `Direct Workers AI comparison exceeded the ${timeoutMs} ms MCP time budget. The deterministic top 5 was returned successfully.`,
          timeout_ms: timeoutMs,
        },
        analysis: null,
      };
    }

    return {
      state: {
        status: "completed",
        available: true,
        model: AI_MODEL,
        browser_reference_model: BROWSER_AI_MODEL,
        error: null,
        timeout_ms: timeoutMs,
      },
      analysis: sanitizeAiAnalysis(
        query,
        parseAiJson(extractAiContent(out)),
        structuredResults
      ),
    };
  } catch (error) {
    return {
      state: {
        status: "unavailable",
        available: false,
        model: AI_MODEL,
        browser_reference_model: BROWSER_AI_MODEL,
        error: `Direct Workers AI comparison failed: ${String(error?.message || error)}. The deterministic top 5 remains valid.`,
        timeout_ms: timeoutMs,
      },
      analysis: null,
    };
  } finally {
    clearTimeout(timer);
  }
}

function trackDirectMcpAi(env, query, aiState) {
  const dataset = env?.ANALYTICS_PROD || env?.ANALYTICS;
  if (!dataset) return;
  try {
    dataset.writeDataPoint({
      indexes: ["realworldapis.com"],
      blobs: [
        "ai_recommend_fetch",
        "/api/ai-recommend",
        "programmatic-client",
        String(query || "").slice(0, 120),
        "unknown",
        "",
        "mcp",
      ],
      doubles: [1],
    });
  } catch (error) {
    console.error("MCP AI analytics write failed:", error);
  }
}


async function fetchCanonicalCatalog() {
  const response = await fetch(`${CANONICAL_SITE}/api/catalog.json`, {
    headers: {
      "User-Agent": "RealWorldAPIs-MCP/3.0",
      "Accept": "application/json",
      "X-RWAPIS-Source": "mcp",
    },
  });
  if(!response.ok) throw new Error(`Canonical catalog fetch failed (${response.status}).`);
  const body=await response.json();
  return Array.isArray(body?.records)?body.records:[];
}

function normalizeLookup(value){
  return String(value||"").trim().toLowerCase();
}

function recordCorpus(record){
  return [
    record?.slug,record?.name,record?.provider,record?.category,record?.description,
    ...(record?.capabilities||[]),...(record?.agent_capabilities||[]),...(record?.auth_methods||[])
  ].filter(Boolean).join(" ").toLowerCase();
}

function resolveRecord(records, identifier){
  const q=normalizeLookup(identifier);
  if(!q)return null;
  const exact=records.find(r=>normalizeLookup(r.slug)===q||normalizeLookup(r.name)===q);
  if(exact)return exact;
  const partial=records.filter(r=>normalizeLookup(r.slug).includes(q)||normalizeLookup(r.name).includes(q));
  return partial.length===1?partial[0]:null;
}

function protocolMatches(record,key,value){
  if(value===undefined||value===null||value==="")return true;
  return String(record?.[key]||"Unknown")===String(value);
}

async function searchCanonicalApis(args={}){
  const records=await fetchCanonicalCatalog();
  const query=normalizeLookup(args.query);
  const categories=Array.isArray(args.categories)?args.categories.map(normalizeLookup).filter(Boolean):[];
  const capabilities=Array.isArray(args.capabilities)?args.capabilities.map(normalizeLookup).filter(Boolean):[];
  const agentCapabilities=Array.isArray(args.agent_capabilities)?args.agent_capabilities.map(normalizeLookup).filter(Boolean):[];
  const minReadiness=Math.max(0,Math.min(100,Number(args.min_readiness||0)||0));
  const limit=Math.max(1,Math.min(20,Number(args.limit||10)||10));

  const filtered=records.filter(r=>{
    if(query&&!recordCorpus(r).includes(query))return false;
    if(categories.length&&!categories.includes(normalizeLookup(r.category)))return false;
    const caps=(r.capabilities||[]).map(normalizeLookup);
    if(capabilities.length&&!capabilities.every(c=>caps.some(x=>x.includes(c))))return false;
    const agentCaps=(r.agent_capabilities||[]).map(normalizeLookup);
    if(agentCapabilities.length&&!agentCapabilities.every(c=>agentCaps.includes(c)))return false;
    if(Number(r.agent_readiness_score||0)<minReadiness)return false;
    if(args.agent_actionable===true&&!r.agent_actionable)return false;
    if(!protocolMatches(r,"openapi",args.openapi))return false;
    if(!protocolMatches(r,"mcp",args.mcp))return false;
    if(!protocolMatches(r,"a2a",args.a2a))return false;
    if(!protocolMatches(r,"x402",args.x402))return false;
    if(!protocolMatches(r,"llms_txt",args.llms_txt))return false;
    return true;
  }).sort((a,b)=>
    Number(b.agent_readiness_score||0)-Number(a.agent_readiness_score||0)||
    String(a.name||"").localeCompare(String(b.name||""))
  );

  return {
    name:"RealWorldAPIs Search",
    method:"deterministic canonical catalog filtering",
    query:args.query||"",
    filters:{
      categories:args.categories||[],
      capabilities:args.capabilities||[],
      agent_capabilities:args.agent_capabilities||[],
      min_readiness:minReadiness,
      openapi:args.openapi??null,mcp:args.mcp??null,a2a:args.a2a??null,x402:args.x402??null,llms_txt:args.llms_txt??null,
      agent_actionable:args.agent_actionable??null
    },
    total_matches:filtered.length,
    returned:Math.min(filtered.length,limit),
    results:filtered.slice(0,limit),
    evidence_policy:"Only canonical RealWorldAPIs fields are used. Unknown remains Unknown and does not satisfy a Yes filter."
  };
}

async function getCanonicalApi(identifier){
  const records=await fetchCanonicalCatalog();
  const record=resolveRecord(records,identifier);
  if(!record)throw new Error(`No unique canonical API record found for "${String(identifier||"")}". Use search_apis to discover the exact slug or name.`);
  return {
    name:"RealWorldAPIs API Record",
    record,
    source:`${CANONICAL_SITE}/api/apis/${encodeURIComponent(record.slug)}.json`,
    evidence_policy:"This is the canonical RealWorldAPIs record. Unknown remains Unknown."
  };
}

async function compareCanonicalApis(identifiers,fields){
  const records=await fetchCanonicalCatalog();
  const ids=Array.isArray(identifiers)?identifiers:[];
  const resolved=[];
  const missing=[];
  for(const id of ids){
    const record=resolveRecord(records,id);
    if(record)resolved.push(record); else missing.push(String(id));
  }
  if(resolved.length<2)throw new Error("compare_apis requires at least two uniquely resolved canonical API records.");

  const allowed=[
    "provider","category","description","capabilities","agent_capabilities","auth_methods",
    "openapi","mcp","a2a","x402","llms_txt","agent_readiness_score",
    "public_documentation","authentication_verified","agent_actionable","website","docs_url"
  ];
  const selected=(Array.isArray(fields)&&fields.length?fields:allowed.filter(x=>!["description","website","docs_url"].includes(x)))
    .filter(x=>allowed.includes(x));

  return {
    name:"RealWorldAPIs Comparison",
    method:"deterministic side-by-side comparison of canonical verified fields",
    fields:selected,
    records:resolved.map(record=>({
      slug:record.slug,
      name:record.name,
      values:Object.fromEntries(selected.map(field=>[field,record[field]??null]))
    })),
    unresolved:missing,
    evidence_policy:"No comparison field is inferred. Unknown remains Unknown and is displayed as such."
  };
}

function compactRecordText(record){
  return [
    `${record.name} — ${record.provider} — ${record.category}`,
    record.description||"",
    `Readiness: ${record.agent_readiness_score}/100`,
    `Capabilities: ${(record.capabilities||[]).join(", ")||"None listed"}`,
    `Agent capabilities: ${(record.agent_capabilities||[]).join(", ")||"None verified"}`,
    `Auth: ${(record.auth_methods||[]).join(", ")||"Not specified"}`,
    `OpenAPI: ${record.openapi}; MCP: ${record.mcp}; A2A: ${record.a2a}; x402: ${record.x402}; llms.txt: ${record.llms_txt}`,
    `Docs: ${record.docs_url}`
  ].join("\n");
}

async function canonicalRecommendation(task, requirements = {}, requestedLimit, env) {
  const startedAt = Date.now();
  const effectiveQuery = compatibilityQuery(task, requirements);
  const encoded = encodeURIComponent(effectiveQuery);
  const structuredUrl = `${CANONICAL_SITE}/api/recommend?q=${encoded}`;

  const headers = {
    "User-Agent": "RealWorldAPIs-MCP/3.0",
    "Accept": "application/json",
    "X-RWAPIS-Source": "mcp",
  };

  // 1) The canonical structured shortlist is mandatory and always runs first.
  const structuredResponse = await fetch(structuredUrl, { headers });

  let structuredBody;
  try {
    structuredBody = await structuredResponse.json();
  } catch {
    throw new Error(`Structured recommendation returned non-JSON (${structuredResponse.status}).`);
  }

  if (!structuredResponse.ok) {
    throw new Error(structuredBody?.error || `Structured recommendation failed (${structuredResponse.status}).`);
  }

  const structuredResults = Array.isArray(structuredBody?.results) ? structuredBody.results : [];

  // 2) Run the same constrained AI prompt directly in this Worker.
  // This removes the second HTTP hop through /api/ai-recommend while preserving browser semantics.
  const directAi = await directAiCompare(effectiveQuery, structuredResults, env, AI_TIMEOUT_MS);
  trackDirectMcpAi(env, effectiveQuery, directAi.state);

  return {
    name: "RealWorldAPIs Recommendation",
    engine_version: ENGINE_VERSION,
    method: "canonical structured parity: deterministic diversified top 5 + low-latency constrained Workers AI comparison",
    task,
    effective_query: effectiveQuery,
    snapshot_date: structuredBody?.snapshot_date || null,
    coverage_status: structuredBody?.coverage_status || "unknown",
    coverage_warnings: structuredBody?.coverage_warnings || [],
    structured_results: structuredResults,
    ai_comparison: directAi.analysis,
    ai: directAi.state,
    compatibility_warnings: compatibilityWarnings(requirements, requestedLimit),
    source_endpoints: {
      structured: structuredUrl,
      browser_ai_reference: `${CANONICAL_SITE}/api/ai-recommend?q=${encoded}`,
      mcp_ai_execution: "direct Workers AI binding inside mcp.realworldapis.com",
    },
    grounding_policy: {
      structured_source_of_truth: true,
      ai_scope: "The AI layer may only compare the five deterministic candidates supplied by the canonical RealWorldAPIs engine.",
      ai_model_policy: `MCP uses ${AI_MODEL} for latency; browser reference model is ${BROWSER_AI_MODEL}.`,
      ai_prompt_parity: "The MCP uses the same grounding rules and candidate constraints as the browser, but a smaller low-latency Workers AI model so synchronous MCP calls can complete reliably.",
      unknown_semantics: "Unknown remains Unknown and must not be treated as confirmed support.",
      important_unknowns_policy: "Important unknowns are rebuilt deterministically from explicit Unknown/unverified dataset fields and are included only when the user's task explicitly makes that field relevant.",
      ai_narrative_policy: "AI summary and suggested-stack prose are stripped of unsupported uncertainty language; all task-relevant evidence gaps are centralized in deterministic important_unknowns.",
      ai_failure_policy: "AI is best-effort for MCP. Timeout or AI failure must not invalidate or suppress the deterministic top 5.",
    },
    timing_ms: {
      total: Date.now() - startedAt,
      ai_budget: AI_TIMEOUT_MS,
    },
  };
}

function recommendationText(result) {
  const lines = [
    "RealWorldAPIs browser-parity recommendation",
    `Task: ${result.task}`,
    "",
    "Deterministic verified top 5:",
  ];

  for (const item of result.structured_results || []) {
    const api = item.api || {};
    const signals = Array.isArray(item.match_signals) && item.match_signals.length
      ? ` — ${item.match_signals.join("; ")}`
      : "";
    lines.push(`${item.rank}. ${api.name || "Unknown"} — structured fit ${item.match_score ?? "Unknown"}/100${signals}`);
  }

  const analysis = result.ai_comparison;
  if (analysis?.summary) {
    lines.push("", `AI comparison: ${analysis.summary}`);
  }
  if (Array.isArray(analysis?.suggested_stack) && analysis.suggested_stack.length) {
    lines.push("", `Suggested stack: ${analysis.suggested_stack.join(" ")}`);
  }
  if (Array.isArray(analysis?.important_unknowns) && analysis.important_unknowns.length) {
    lines.push("", `Important unknowns: ${analysis.important_unknowns.join(" · ")}`);
  }

  if (result.ai?.status === "timed_out") {
    lines.push(
      "",
      `AI comparison status: timed_out after ${result.ai.timeout_ms} ms.`,
      "The deterministic top 5 is complete and remains the source of truth."
    );
  } else if (!result.ai?.available) {
    lines.push(
      "",
      `AI comparison unavailable: ${result.ai?.error || "Unknown error"}.`,
      "The deterministic top 5 is complete and remains the source of truth."
    );
  }

  if (result.compatibility_warnings?.length) {
    lines.push("", `Compatibility notes: ${result.compatibility_warnings.join(" ")}`);
  }

  return lines.join("\n");
}


function canonicalRecordOutputSchema() {
  return {
    type: "object",
    additionalProperties: true,
    properties: {
      slug: { type: "string" },
      name: { type: "string" },
      provider: { type: "string" },
      category: { type: "string" },
      description: { type: "string" },
      capabilities: { type: "array", items: { type: "string" } },
      agent_capabilities: { type: "array", items: { type: "string" } },
      auth_methods: { type: "array", items: { type: "string" } },
      openapi: { type: "string", enum: ["Yes", "No", "Unknown"] },
      mcp: { type: "string", enum: ["Yes", "No", "Unknown"] },
      a2a: { type: "string", enum: ["Yes", "No", "Unknown"] },
      x402: { type: "string", enum: ["Yes", "No", "Unknown"] },
      llms_txt: { type: "string", enum: ["Yes", "No", "Unknown"] },
      agent_readiness_score: { type: "number", minimum: 0, maximum: 100 },
      public_documentation: { type: "boolean" },
      authentication_verified: { type: "boolean" },
      agent_actionable: { type: "boolean" },
      website: { type: ["string", "null"] },
      docs_url: { type: ["string", "null"] }
    }
  };
}

function findApiForTaskOutputSchema() {
  return {
    type: "object",
    additionalProperties: true,
    required: ["name", "task", "structured_results", "ai", "grounding_policy"],
    properties: {
      name: { type: "string" },
      engine_version: { type: "string" },
      method: { type: "string" },
      task: { type: "string" },
      effective_query: { type: "string" },
      snapshot_date: { type: ["string", "null"] },
      coverage_status: { type: "string" },
      coverage_warnings: { type: "array", items: { type: "string" } },
      structured_results: {
        type: "array",
        description: "Canonical deterministic shortlist. This is the authoritative result set.",
        items: { type: "object", additionalProperties: true }
      },
      ai_comparison: {
        type: ["object", "null"],
        additionalProperties: true,
        description: "Best-effort grounded explanation of only the structured_results candidates."
      },
      ai: { type: "object", additionalProperties: true },
      compatibility_warnings: { type: "array", items: { type: "string" } },
      source_endpoints: { type: "object", additionalProperties: true },
      grounding_policy: { type: "object", additionalProperties: true },
      timing_ms: { type: "object", additionalProperties: true }
    }
  };
}

function searchApisOutputSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["name", "method", "filters", "total_matches", "returned", "results", "evidence_policy"],
    properties: {
      name: { type: "string" },
      method: { type: "string" },
      query: { type: "string" },
      filters: { type: "object", additionalProperties: true },
      total_matches: { type: "integer", minimum: 0 },
      returned: { type: "integer", minimum: 0 },
      results: { type: "array", items: canonicalRecordOutputSchema() },
      evidence_policy: { type: "string" }
    }
  };
}

function getApiOutputSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["name", "record", "source", "evidence_policy"],
    properties: {
      name: { type: "string" },
      record: canonicalRecordOutputSchema(),
      source: { type: "string" },
      evidence_policy: { type: "string" }
    }
  };
}

function compareApisOutputSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["name", "method", "fields", "records", "unresolved", "evidence_policy"],
    properties: {
      name: { type: "string" },
      method: { type: "string" },
      fields: { type: "array", items: { type: "string" } },
      records: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["slug", "name", "values"],
          properties: {
            slug: { type: "string" },
            name: { type: "string" },
            values: { type: "object", additionalProperties: true }
          }
        }
      },
      unresolved: { type: "array", items: { type: "string" } },
      evidence_policy: { type: "string" }
    }
  };
}

function findApiForTaskToolDefinition() {
  return {
    name: "find_api_for_task",
    title: "Find API for Task",
    description:
      "Find the best APIs for a natural-language physical-world task. Use this for open-ended task or outcome-based recommendations; use search_apis when you already know exact filters, get_api for one known API, or compare_apis for known candidates. Returns an authoritative canonical structured_results shortlist plus a best-effort AI comparison restricted to that shortlist. The canonical browser-parity flow always returns five structured candidates: limit is retained only for backward compatibility. requirements.categories, capabilities, mcp, openapi and auth are added as task hints; free_tier and min_readiness are accepted for compatibility but are not hard filters. Unknown remains Unknown.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["task"],
      properties: {
        task: {
          type: "string",
          maxLength: 1000,
          description:
            "Required natural-language goal or workflow, for example 'connect to a car and predict weather on the route'. Describe the desired outcome rather than naming a specific API."
        },
        requirements: {
          type: "object",
          additionalProperties: false,
          description:
            "Optional compatibility hints appended to the task before canonical ranking. categories, capabilities, mcp, openapi and auth influence the effective query. free_tier and min_readiness are accepted for backward compatibility but are not hard filters; use search_apis when you need strict field filtering.",
          properties: {
            categories: {
              type: "array",
              items: { type: "string" },
              description: "Preferred catalog categories, such as Geospatial, Weather or Mobility. These are ranking hints, not strict filters."
            },
            capabilities: {
              type: "array",
              items: { type: "string", enum: ["observe","locate","predict","plan","control","act"] },
              description: "Desired agent capability dimensions. These are appended as ranking hints, not strict filters."
            },
            mcp: {
              type: "string",
              enum: ["Yes","No","Unknown"],
              description: "Compatibility hint for MCP support. Only Yes becomes an explicit 'Must support MCP' task hint; use search_apis for exact Yes/No/Unknown filtering."
            },
            openapi: {
              type: "string",
              enum: ["Yes","No","Unknown"],
              description: "Compatibility hint for OpenAPI support. Only Yes becomes an explicit task hint; use search_apis for exact Yes/No/Unknown filtering."
            },
            free_tier: {
              type: "boolean",
              description: "Backward-compatible field only. The canonical recommendation engine does not currently hard-filter on free-tier availability."
            },
            auth: {
              type: "string",
              enum: ["none","api_key","oauth","client_credentials","bearer","jwt","basic"],
              description: "Preferred authentication method, appended to the effective task as a ranking hint."
            },
            min_readiness: {
              type: "integer",
              minimum: 0,
              maximum: 100,
              description: "Backward-compatible field only. It does not hard-filter the canonical top five; use search_apis for a strict minimum readiness threshold."
            }
          }
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 5,
          default: 5,
          description: "Backward-compatible parameter. The canonical browser-parity workflow always produces five structured candidates before the AI comparison, even when another value is supplied."
        }
      }
    },
    outputSchema: findApiForTaskOutputSchema(),
    annotations:{title:"Find API for Task",readOnlyHint:true,destructiveHint:false,idempotentHint:false,openWorldHint:false}
  };
}

function searchApisToolDefinition() {
  return {
    name:"search_apis",
    title:"Search APIs",
    description:
      "Search the canonical registry when you already know keywords or exact requirements. All supplied filter groups combine with AND logic; array capability filters require every supplied value, and protocol fields match the exact Yes/No/Unknown status, so Unknown never satisfies Yes. Results are sorted by agent_readiness_score descending and then API name, with 1–20 results returned (default 10); total_matches reports the complete match count and there is no pagination. Use find_api_for_task for open-ended task recommendations, get_api for one known API, and compare_apis for side-by-side inspection.",
    inputSchema:{
      type:"object",
      additionalProperties:false,
      properties:{
        query:{
          type:"string",
          maxLength:300,
          description:"Optional case-insensitive text search across API name, provider, category, description, capabilities, agent capabilities and authentication fields."
        },
        categories:{
          type:"array",
          items:{type:"string"},
          description:"Exact category names. Supplying multiple category values allows a record to match any listed category; this category condition still combines with every other supplied filter group using AND logic."
        },
        capabilities:{
          type:"array",
          items:{type:"string"},
          description:"Capability terms that must all be present in the record's verified capabilities. Matching is case-insensitive and allows a capability string to contain the supplied term."
        },
        agent_capabilities:{
          type:"array",
          items:{type:"string",enum:["observe","locate","predict","plan","control","act"]},
          description:"Agent capability dimensions that must all be explicitly present on a record."
        },
        openapi:{
          type:"string",enum:["Yes","No","Unknown"],
          description:"Exact OpenAPI evidence status required for a match."
        },
        mcp:{
          type:"string",enum:["Yes","No","Unknown"],
          description:"Exact MCP evidence status required for a match."
        },
        a2a:{
          type:"string",enum:["Yes","No","Unknown"],
          description:"Exact A2A evidence status required for a match."
        },
        x402:{
          type:"string",enum:["Yes","No","Unknown"],
          description:"Exact x402 evidence status required for a match."
        },
        llms_txt:{
          type:"string",enum:["Yes","No","Unknown"],
          description:"Exact llms.txt evidence status required for a match."
        },
        min_readiness:{
          type:"integer",minimum:0,maximum:100,
          description:"Strict minimum agent-readiness score. Records below this score are excluded."
        },
        agent_actionable:{
          type:"boolean",
          description:"When true, require agent_actionable = true. False does not exclude actionable records; omit this field unless you need the positive requirement."
        },
        limit:{
          type:"integer",minimum:1,maximum:20,default:10,
          description:"Maximum number of matching records returned. Results are sorted by readiness descending then API name. total_matches still reports the full count. No pagination is currently exposed."
        }
      }
    },
    outputSchema: searchApisOutputSchema(),
    annotations:{title:"Search APIs",readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}
  };
}

function getApiToolDefinition() {
  return {
    name:"get_api",
    title:"Get API",
    description:
      "Retrieve one canonical verified API record when you already know its name or slug. Exact slug or exact API name is preferred; a partial identifier is accepted only when it uniquely resolves to one record. Missing or ambiguous identifiers return an error directing the agent to search_apis. Use compare_apis instead when you want fields from multiple known APIs.",
    inputSchema:{
      type:"object",
      additionalProperties:false,
      required:["identifier"],
      properties:{
        identifier:{
          type:"string",
          maxLength:200,
          description:"Required API slug or API name. Exact matches are preferred; a unique case-insensitive partial slug/name match is accepted. If it is ambiguous or missing, use search_apis to find the exact identifier."
        }
      }
    },
    outputSchema: getApiOutputSchema(),
    annotations:{title:"Get API",readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}
  };
}

function compareApisToolDefinition() {
  return {
    name:"compare_apis",
    title:"Compare APIs",
    description:
      "Compare 2–8 already-known APIs side by side using only canonical RealWorldAPIs fields. Use this after find_api_for_task or search_apis has produced candidates; use get_api when only one record is needed. If fields is omitted, the tool returns the default core comparison fields: provider, category, capabilities, agent capabilities, authentication, protocol statuses, readiness and verification/actionability fields, excluding long description and URLs. Unresolved names/slugs are listed in unresolved; at least two identifiers must resolve. No missing value is inferred and Unknown remains Unknown.",
    inputSchema:{
      type:"object",
      additionalProperties:false,
      required:["apis"],
      properties:{
        apis:{
          type:"array",
          minItems:2,
          maxItems:8,
          items:{type:"string"},
          description:"Required list of 2–8 API slugs or names. Exact matches are preferred; unique partial matches are accepted. Unresolved identifiers are reported separately, and the call fails if fewer than two records resolve."
        },
        fields:{
          type:"array",
          uniqueItems:true,
          description:"Optional fields to compare. If omitted or empty, the tool uses the default core fields: provider, category, capabilities, agent_capabilities, auth_methods, openapi, mcp, a2a, x402, llms_txt, agent_readiness_score, public_documentation, authentication_verified and agent_actionable.",
          items:{type:"string",enum:[
            "provider","category","description","capabilities","agent_capabilities","auth_methods",
            "openapi","mcp","a2a","x402","llms_txt","agent_readiness_score",
            "public_documentation","authentication_verified","agent_actionable","website","docs_url"
          ]}
        }
      }
    },
    outputSchema: compareApisOutputSchema(),
    annotations:{title:"Compare APIs",readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}
  };
}

function toolDefinitions(){
  return [findApiForTaskToolDefinition(),searchApisToolDefinition(),getApiToolDefinition(),compareApisToolDefinition()];
}

async function handleMcp(request, env) {
  if (request.method === "GET" || request.method === "DELETE") {
    return json(
      {
        error: "Method not allowed",
        message: "This MCP endpoint is stateless. Send JSON-RPC requests with POST.",
        protocol_version: MCP_PROTOCOL_VERSION,
        tools: toolDefinitions().map(t=>t.name),
      },
      405,
      { Allow: "POST, OPTIONS" },
    );
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, { Allow: "POST, OPTIONS" });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json(mcpError(null, -32700, "Parse error"), 400);
  }

  if (!body || body.jsonrpc !== "2.0" || typeof body.method !== "string") {
    return json(mcpError(body?.id, -32600, "Invalid Request"), 400);
  }

  const modern = isModernMcpRequest(request, body);
  if (modern) {
    const validation = validateModernMcpHeaders(request, body);
    if (!validation.ok) return json(validation.response, 400);
  }

  if (body.method === "initialize") {
    const requested = String(body?.params?.protocolVersion || MCP_LEGACY_PROTOCOL_VERSION);
    const supported = [MCP_PROTOCOL_VERSION, MCP_LEGACY_PROTOCOL_VERSION, "2025-06-18", "2025-03-26"];
    if (!supported.includes(requested)) {
      return json(
        mcpError(body.id, -32022, "Unsupported protocol version", {
          supported,
        }),
        400,
      );
    }

    return json(
      mcpSuccess(body.id, {
        protocolVersion: requested,
        capabilities: { tools: { listChanged: false } },
        serverInfo: MCP_SERVER_INFO,
        instructions:
          "Choose tools by intent: find_api_for_task for an open-ended natural-language task; search_apis when exact filters or keywords are already known; get_api for one known API record; compare_apis for 2–8 known candidates. All tools are read-only. The canonical structured data is authoritative and Unknown remains Unknown.",
      }),
    );
  }

  if (body.method === "notifications/initialized") {
    return new Response(null, { status: 202, headers: { ...corsHeaders(), "Cache-Control": "no-store" } });
  }

  if (body.method === "server/discover") {
    return json(
      mcpSuccess(body.id, {
        resultType: "complete",
        supportedVersions: [MCP_PROTOCOL_VERSION, MCP_LEGACY_PROTOCOL_VERSION],
        capabilities: { tools: { listChanged: false } },
        instructions:
          "RealWorldAPIs exposes four read-only registry tools: find_api_for_task for open-ended task selection, search_apis for strict verified-field filtering, get_api for one canonical record, and compare_apis for deterministic side-by-side comparison. Canonical structured fields remain authoritative and Unknown remains Unknown.",
        ttlMs: 3600000,
        cacheScope: "public",
      }),
    );
  }

  if (body.method === "tools/list") {
    return json(
      mcpSuccess(body.id, {
        ...(modern ? { resultType: "complete" } : {}),
        tools: toolDefinitions(),
        ...(modern ? { ttlMs: 3600000, cacheScope: "public" } : {}),
      }),
    );
  }

  if (body.method === "tools/call") {
    const name=String(body?.params?.name||"");
    const args=body?.params?.arguments||{};
    const known=new Set(toolDefinitions().map(t=>t.name));

    if(!known.has(name)){
      return json(mcpError(body.id,-32601,`Unknown tool: ${name}`));
    }

    try{
      let result;
      let outputText="";

      if(name==="find_api_for_task"){
        const allowed=new Set(["task","requirements","limit"]);
        const unknown=Object.keys(args).filter(key=>!allowed.has(key));
        if(unknown.length)throw new Error(`Unknown arguments: ${unknown.join(", ")}.`);
        const task=String(args.task||"").trim();
        if(!task)throw new Error("The task argument is required.");
        if(task.length>1000)throw new Error("The task argument must be 1000 characters or fewer.");
        result=await canonicalRecommendation(task,args.requirements||{},args.limit,env);
        outputText=recommendationText(result);
      }

      if(name==="search_apis"){
        result=await searchCanonicalApis(args);
        outputText=[
          `RealWorldAPIs deterministic search — ${result.total_matches} match${result.total_matches===1?"":"es"}, returning ${result.returned}.`,
          ...result.results.map((r,i)=>`${i+1}. ${r.name} — ${r.provider} — ${r.category} — readiness ${r.agent_readiness_score}/100 — MCP ${r.mcp} — OpenAPI ${r.openapi}`)
        ].join("\n");
      }

      if(name==="get_api"){
        const identifier=String(args.identifier||"").trim();
        if(!identifier)throw new Error("identifier is required.");
        result=await getCanonicalApi(identifier);
        outputText=compactRecordText(result.record);
      }

      if(name==="compare_apis"){
        const ids=Array.isArray(args.apis)?args.apis:[];
        if(ids.length<2||ids.length>8)throw new Error("apis must contain between 2 and 8 names or slugs.");
        result=await compareCanonicalApis(ids,args.fields);
        outputText=[
          "RealWorldAPIs deterministic comparison",
          ...result.records.map(r=>`\n${r.name}\n${Object.entries(r.values).map(([k,v])=>`- ${k}: ${Array.isArray(v)?v.join(", "):String(v)}`).join("\n")}`),
          ...(result.unresolved.length?[`\nUnresolved: ${result.unresolved.join(", ")}`]:[])
        ].join("\n");
      }

      return json(mcpSuccess(body.id,{
        ...(modern?{resultType:"complete"}:{}),
        isError:false,
        content:[{type:"text",text:outputText}],
        structuredContent:result
      }));
    }catch(error){
      return json(mcpSuccess(body.id,{
        ...(modern?{resultType:"complete"}:{}),
        isError:true,
        content:[{type:"text",text:String(error?.message||error)}]
      }));
    }
  }

  return json(mcpError(body.id, -32601, `Method not found: ${body.method}`));
}

function rootMetadata() {
  return {
    name: "RealWorldAPIs MCP",
    description:
      "Evidence-first API registry for AI agents connecting to the physical world, with task-based selection, deterministic search, canonical record retrieval and side-by-side comparison.",
    website: CANONICAL_SITE,
    registry_package: MCP_REGISTRY_PACKAGE,
    transport: "streamable-http",
    endpoint: MCP_ENDPOINT,
    tools: ["find_api_for_task","search_apis","get_api","compare_apis"],
    engine_version: ENGINE_VERSION,
    canonical_engine: `${CANONICAL_SITE}/api/recommend?q={natural-language-task}`,
    browser_ai_reference: `${CANONICAL_SITE}/api/ai-recommend?q={natural-language-task}`,
    ai_model: AI_MODEL,
    structured_endpoint: `${CANONICAL_SITE}/api/recommend?q={natural-language-task}`,
    semantics: {
      structured_source_of_truth: true,
      ai_constrained_to_shortlist: true,
      shortlist_size: 5,
      unknown_remains_unknown: true,
      ai_timeout_safe: true,
      direct_ai_execution: true,
      ai_timeout_ms: AI_TIMEOUT_MS,
    },
  };
}

function openApi() {
  return {
    openapi: "3.1.0",
    info: {
      title: "RealWorldAPIs MCP",
      version: "3.0.1",
      description:
        "Remote MCP service exposing find_api_for_task, search_apis, get_api and compare_apis over the canonical RealWorldAPIs registry. Search/get/compare are deterministic; find_api_for_task preserves the structured shortlist as source of truth.",
    },
    servers: [{ url: BASE_URL }],
    paths: {
      "/mcp": {
        post: {
          operationId: "mcp",
          summary: "Stateless MCP JSON-RPC transport",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: {
            "200": {
              description: "MCP JSON-RPC response",
              content: { "application/json": { schema: { type: "object" } } },
            },
          },
        },
      },
    },
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (url.pathname === "/.well-known/glama.json") {
      return json({
        $schema: "https://glama.ai/mcp/schemas/connector.json",
        claim: GLAMA_CLAIM,
      });
    }

    if (url.pathname === "/mcp") {
      return handleMcp(request, env);
    }

    if (url.pathname === "/health") {
      return json({
        ok: true,
        name: "RealWorldAPIs MCP",
        endpoint: MCP_ENDPOINT,
        tools: ["find_api_for_task","search_apis","get_api","compare_apis"],
        engine_version: ENGINE_VERSION,
        canonical_site: CANONICAL_SITE,
        flow: "deterministic diversified top 5 + low-latency timeout-safe constrained Workers AI comparison",
        ai_timeout_ms: AI_TIMEOUT_MS,
        ai_binding: Boolean(env?.AI),
        ai_model: AI_MODEL,
        analytics_binding: Boolean(env?.ANALYTICS_PROD || env?.ANALYTICS),
        time: new Date().toISOString(),
      });
    }

    if (url.pathname === "/openapi.json") {
      return json(openApi());
    }

    if (url.pathname === "/llms.txt") {
      return text(`# RealWorldAPIs MCP

> Evidence-first API registry for AI agents connecting to the physical world, exposed through four read-only MCP tools.

## Connection
- Transport: Streamable HTTP
- Endpoint: ${MCP_ENDPOINT}
- Tools: find_api_for_task, search_apis, get_api, compare_apis
- Registry package: ${MCP_REGISTRY_PACKAGE}

## Tools
- find_api_for_task: task-based deterministic shortlist plus constrained AI comparison.
- search_apis: deterministic search/filtering over canonical verified fields.
- get_api: retrieve one canonical verified API record.
- compare_apis: deterministic side-by-side comparison; no missing field is inferred.

## Recommendation flow
1. Deterministic evidence-based ranking over the verified RealWorldAPIs catalog.
2. Diversified top 5 for multi-domain tasks.
3. The same grounding rules and verified five-candidate constraint are executed directly through the MCP Worker's Workers AI binding.
4. MCP uses ${AI_MODEL} for lower latency; the browser reference model remains ${BROWSER_AI_MODEL}.
5. This avoids a second HTTP round trip through the browser AI endpoint.
6. The AI step has a ${AI_TIMEOUT_MS} ms MCP time budget.
7. If AI times out or fails, the deterministic top 5 is returned successfully.
8. structured_results remain the source of truth.
9. Unknown support remains Unknown.

## Canonical web endpoints
- Structured: ${CANONICAL_SITE}/api/recommend?q=YOUR_TASK
- AI comparison: ${CANONICAL_SITE}/api/ai-recommend?q=YOUR_TASK
- Catalog: ${CANONICAL_SITE}/api/catalog.json

## Example
Call find_api_for_task with:
{"task":"I need my agent to connect to a car and predict weather on the route"}

The MCP result always returns structured_results. ai_comparison is included when the direct Workers AI call completes within the MCP time budget.
`);
    }

    if (url.pathname === "/recommend") {
      const q = url.searchParams.get("q") || "";
      if (!q) return json({ error: "Missing required q parameter" }, 400);
      const upstream = await fetch(`${CANONICAL_SITE}/api/recommend?q=${encodeURIComponent(q)}`, {
        headers: { "User-Agent": "RealWorldAPIs-MCP/2.3.2", "Accept": "application/json", "X-RWAPIS-Source": "mcp-proxy" },
      });
      return new Response(upstream.body, {
        status: upstream.status,
        headers: { ...corsHeaders(), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
      });
    }

    if (url.pathname === "/ai-recommend") {
      const q = url.searchParams.get("q") || "";
      if (!q) return json({ error: "Missing required q parameter" }, 400);
      const upstream = await fetch(`${CANONICAL_SITE}/api/ai-recommend?q=${encodeURIComponent(q)}`, {
        headers: { "User-Agent": "RealWorldAPIs-MCP/2.3.2", "Accept": "application/json", "X-RWAPIS-Source": "mcp-proxy" },
      });
      return new Response(upstream.body, {
        status: upstream.status,
        headers: { ...corsHeaders(), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
      });
    }

    if (url.pathname === "/catalog.json") {
      const upstream = await fetch(`${CANONICAL_SITE}/api/catalog.json`, {
        headers: { "User-Agent": "RealWorldAPIs-MCP/2.3.2", "Accept": "application/json" },
      });
      return new Response(upstream.body, {
        status: upstream.status,
        headers: { ...corsHeaders(), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=300" },
      });
    }

    if (url.pathname === "/" || url.pathname === "") {
      return json(rootMetadata());
    }

    return json(
      {
        error: "Not found",
        available: ["/", "/mcp", "/health", "/openapi.json", "/llms.txt", "/catalog.json", "/recommend", "/ai-recommend"],
      },
      404,
    );
  },
};
