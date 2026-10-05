#!/usr/bin/env node
// Sketch Lab MCP server — stdio transport, newline-delimited JSON-RPC 2.0.
// Zero runtime dependencies: the app's own validation/encoding comes from
// mcp/dist/core.mjs (npm run build:mcp). Agents build a GeneratedGraph with
// their own research/writing abilities; this server validates it with the
// exact same parser the browser uses and returns a ready-to-open ?g= URL.
//
// Env:
//   SKETCHLAB_URL  base URL of the running app (default http://127.0.0.1:3102)

import { parseGeneratedGraph, ICONS_SORTED, searchIcons, encodeGeneratedGraph } from "./dist/core.mjs";

const PROTOCOL = "2025-06-18";
const BASE_URL = (process.env.SKETCHLAB_URL || "http://127.0.0.1:3102").replace(/\/+$/, "");

const TOOLS = [
  {
    name: "sketchlab_icons",
    description:
      "List Sketch Lab icon keys for diagram nodes (kind: \"icon\"). Optional query ranks matches by key/keyword. Use real keys from this list in graph nodes; unknown icons get fuzzy-matched or replaced.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", description: "optional search, e.g. \"deploy\", \"database\"" } },
    },
  },
  {
    name: "sketchlab_validate",
    description:
      "Validate a GeneratedGraph (name?, layers?[{name,color?}], nodes[{id,label,kind? rect|circle|icon|text,icon?,color? #RRGGBB,layer?}], edges[{from,to,label?,directed?}]). Returns the normalized graph (icons resolved, layout computed) or the exact error. Caps: 48 nodes, 96 edges, 48 layers.",
    inputSchema: {
      type: "object",
      properties: { graph: { type: "object", description: "the GeneratedGraph to validate" } },
      required: ["graph"],
    },
  },
  {
    name: "sketchlab_diagram",
    description:
      "Validate a GeneratedGraph and return a Sketch Lab URL (?g=...) that opens the diagram directly in the browser. Call sketchlab_icons first for node icons. Returns the URL plus node/edge counts.",
    inputSchema: {
      type: "object",
      properties: { graph: { type: "object", description: "the GeneratedGraph to publish" } },
      required: ["graph"],
    },
  },
];

function textResult(text) {
  return { content: [{ type: "text", text }] };
}

function errorResult(text) {
  return { content: [{ type: "text", text }], isError: true };
}

function callTool(name, args) {
  if (name === "sketchlab_icons") {
    const q = typeof args?.query === "string" ? args.query : "";
    const icons = (q ? searchIcons(q) : ICONS_SORTED).slice(0, 60);
    return textResult(
      JSON.stringify({ count: icons.length, icons: icons.map((i) => ({ key: i.key, keywords: (i.keywords || []).slice(0, 6) })) }),
    );
  }
  if (name === "sketchlab_validate" || name === "sketchlab_diagram") {
    let graph;
    try {
      graph = parseGeneratedGraph(args?.graph);
    } catch (err) {
      return errorResult(`invalid GeneratedGraph: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (name === "sketchlab_validate") return textResult(JSON.stringify(graph));
    const encoded = encodeGeneratedGraph(graph);
    const url = `${BASE_URL}/?g=${encodeURIComponent(encoded)}`;
    return textResult(
      JSON.stringify({ url, nodes: graph.nodes.length, edges: graph.edges.length, layers: graph.layers?.length ?? 0 }),
    );
  }
  return errorResult(`unknown tool: ${name}`);
}

// --- JSON-RPC over stdio (newline-delimited; one message per line) ---------

let buffer = "";

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

function handle(msg) {
  const { id, method, params } = msg;
  const isRequest = id !== undefined && id !== null;
  try {
    if (method === "initialize") {
      if (isRequest)
        send({
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: PROTOCOL,
            capabilities: { tools: {} },
            serverInfo: { name: "sketchlab", version: "0.6.1" },
          },
        });
    } else if (method === "notifications/initialized" || method === "initialized") {
      // no-op
    } else if (method === "ping") {
      if (isRequest) send({ jsonrpc: "2.0", id, result: {} });
    } else if (method === "tools/list") {
      if (isRequest) send({ jsonrpc: "2.0", id, result: { tools: TOOLS } });
    } else if (method === "tools/call") {
      if (isRequest) send({ jsonrpc: "2.0", id, result: callTool(params?.name, params?.arguments) });
    } else if (method === "resources/list") {
      if (isRequest) send({ jsonrpc: "2.0", id, result: { resources: [] } });
    } else if (method === "prompts/list") {
      if (isRequest) send({ jsonrpc: "2.0", id, result: { prompts: [] } });
    } else if (isRequest) {
      send({ jsonrpc: "2.0", id, error: { code: -32601, message: `method not found: ${method}` } });
    }
  } catch (err) {
    if (isRequest) send({ jsonrpc: "2.0", id, error: { code: -32603, message: String(err?.message ?? err) } });
  }
}

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let nl;
  while ((nl = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } });
      continue;
    }
    handle(msg);
  }
});
process.stdin.on("end", () => process.exit(0));
