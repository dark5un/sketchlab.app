// Entry point for the MCP server (mcp/server.mjs). It re-exports the app's
// own validation and share-encoding so the MCP tools can never drift from
// what the browser actually accepts: same caps, same icon matching, same
// LZ-string payload as the ?g= import path.
//
// Bundled by `npm run build:mcp` (esbuild -> mcp/dist/core.mjs). The app's
// browser-only imports are safe under node: pixi.js is a type-only import
// (erased), and every localStorage access is guarded by try/catch.

export { parseGeneratedGraph } from "../src/state/generatedGraph";
export { ICONS_SORTED, searchIcons } from "../src/render/icons";
export { encodeGeneratedGraph } from "../src/persistence/share";
