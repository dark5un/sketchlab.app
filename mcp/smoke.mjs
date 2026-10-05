import { spawn } from "node:child_process";
import { parseGeneratedGraph, encodeGeneratedGraph } from "./dist/core.mjs";

const srv = spawn(process.execPath, ["mcp/server.mjs"], { env: { ...process.env, SKETCHLAB_URL: "http://127.0.0.1:3102" } });
const lines = [];
let buf = "";
srv.stdout.on("data", (c) => {
  buf += c;
  let i;
  while ((i = buf.indexOf("\n")) >= 0) { lines.push(JSON.parse(buf.slice(0, i))); buf = buf.slice(i + 1); }
});
srv.stderr.on("data", (c) => console.error("[stderr]", String(c)));

function send(msg) { srv.stdin.write(JSON.stringify(msg) + "\n"); }
const wait = (n) => new Promise((r) => setTimeout(r, n));

send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "smoke", version: "0" } } });
send({ jsonrpc: "2.0", method: "notifications/initialized" });
send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "sketchlab_icons", arguments: { query: "deploy" } } });

const graph = {
  name: "Air-gapped AI software delivery pipeline (AWS)",
  layers: [
    { name: "Disconnected zone (air-gapped)" },
    { name: "Transfer zone (one-way)" },
    { name: "Connected zone (internet)" },
  ],
  nodes: [
    { id: "dev", label: "Dev workstations", kind: "icon", icon: "laptop", layer: 2 },
    { id: "gh", label: "GitHub Enterprise", kind: "icon", icon: "github", layer: 2 },
    { id: "ecr", label: "ECR (public side)", kind: "icon", icon: "database", layer: 2 },
    { id: "transfer", label: "One-way data diode / secure transfer", kind: "rect", layer: 1 },
    { id: "review", label: "Manual review + signing (KMS)", kind: "icon", icon: "shield", layer: 1 },
    { id: "ecrin", label: "ECR (air-gapped mirror)", kind: "icon", icon: "database", layer: 0 },
    { id: "codebuild", label: "CodeBuild (disconnected)", kind: "icon", icon: "build", layer: 0 },
    { id: "bedrock", label: "Bedrock (private endpoint)", kind: "icon", icon: "brain", layer: 0 },
    { id: "sagemaker", label: "SageMaker model registry", kind: "icon", icon: "chip", layer: 0 },
    { id: "security", label: "GuardDuty + Inspector + SBOM scan", kind: "icon", icon: "shield", layer: 0 },
    { id: "eks", label: "EKS (Outposts / Dedicated)", kind: "icon", icon: "kubernetes", layer: 0 },
    { id: "argocd", label: "GitOps (ArgoCD)", kind: "icon", icon: "git", layer: 0 },
    { id: "prod", label: "Production workloads", kind: "icon", icon: "server", layer: 0 },
  ],
  edges: [
    { from: "dev", to: "gh", label: "push" },
    { from: "gh", to: "ecr", label: "CI build" },
    { from: "ecr", to: "transfer", label: "signed artifacts" },
    { from: "transfer", to: "review", label: "verify" },
    { from: "review", to: "ecrin", label: "import" },
    { from: "ecrin", to: "codebuild", label: "base images" },
    { from: "bedrock", to: "codebuild", label: "AI-assisted build/test" },
    { from: "sagemaker", to: "eks", label: "model deploy" },
    { from: "codebuild", to: "security", label: "scan" },
    { from: "security", to: "argocd", label: "approved" },
    { from: "argocd", to: "eks", label: "sync" },
    { from: "eks", to: "prod", label: "serve" },
  ],
};

send({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "sketchlab_diagram", arguments: { graph } } });
send({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "sketchlab_validate", arguments: { graph: { nodes: [{ id: "a" }] } } } });

await wait(1500);
srv.stdin.end();

for (const l of lines) {
  if (l.id === 1) console.log("initialize:", l.result.serverInfo, "proto", l.result.protocolVersion);
  if (l.id === 2) console.log("tools:", l.result.tools.map((t) => t.name).join(", "));
  if (l.id === 3) console.log("icons(deploy):", l.result.content[0].text.slice(0, 160));
  if (l.id === 4) {
    const r = JSON.parse(l.result.content[0].text);
    console.log("diagram:", r.nodes, "nodes,", r.edges, "edges,", r.layers, "layers");
    console.log("url len:", r.url.length, "| starts:", r.url.slice(0, 60));
    // round-trip: decode the ?g= payload with the same bundle the browser uses
    const g = decodeURIComponent(r.url.split("?g=")[1]);
    const decoded = JSON.parse((await import("lz-string")).default.decompressFromEncodedURIComponent(g));
    console.log("round-trip decode:", decoded.name, "| nodes:", decoded.nodes.length, "| edges:", decoded.edges.length);
  }
  if (l.id === 5) console.log("bad graph -> isError:", l.result.isError, "|", l.result.content[0].text.slice(0, 100));
}
