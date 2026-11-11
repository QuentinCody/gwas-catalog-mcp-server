import { afterEach, expect, it, vi } from "vitest";
import { McpServer } from "@bio-mcp/shared/mcp";
import { createApiProxyTool } from "@bio-mcp/shared/tools/api-proxy";
import { registerCodeMode } from "./code-mode";
import { registerQueryData } from "./query-data";
import { registerGetSchema } from "./get-schema";
import { gwasCatalog } from "../spec/catalog";
import { createGwasApiFetch } from "../lib/api-adapter";

afterEach(() => vi.unstubAllGlobals());

it("registers both aliases for all tools with both response fields on success/error paths", async () => {
  const server = new McpServer({ name: "fixture", version: "1" });
  // SAFETY: the fixture loader/DO are not used by discovery or empty-code errors.
  registerCodeMode(server, { CODE_MODE_LOADER: { get: () => ({}) } } as unknown as Parameters<typeof registerCodeMode>[1]);
  registerQueryData(server, {}); registerGetSchema(server, {});
  // SAFETY: SDK registry is inspected solely to invoke real registered callbacks in tests.
  const tools = (server as unknown as { _registeredTools: Record<string, { handler: (args: unknown, extra: unknown) => Promise<unknown> }> })._registeredTools;
  expect(Object.keys(tools)).toHaveLength(8);
  for (const prefix of ["", "mcp_"]) {
    expect(await tools[prefix + "gwas_search"].handler({ query: "CNV", max_results: 5 }, {})).toMatchObject({ content: expect.any(Array), structuredContent: { success: true } });
    for (const [tool, args] of [["gwas_execute", { code: "" }], ["gwas_query_data", { data_access_id: "fixture", sql: "SELECT 1" }], ["gwas_get_schema", { data_access_id: "fixture" }]] as const) {
      expect(await tools[prefix + tool].handler(args, {})).toMatchObject({ content: expect.any(Array), structuredContent: expect.any(Object), isError: true });
    }
  }
});

it("stages the native preview and source context without losing string precision or extra columns", async () => {
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async (url: string) => new Response(url.endsWith("/") ? '<a href="study.tsv">data</a>' : `hgnc_symbol\tp_value\tnote\nTP53\t1e-400\t${"α".repeat(20000)}\n`)));
  const stored: unknown[] = [];
  // SAFETY: fixture supplies the DO operations exercised by the shared staging helper.
  const namespace = { idFromName: (name: string) => name, get: () => ({ fetch: async (request: Request) => {
    if (new URL(request.url).pathname === "/process") {
      // SAFETY: payload is created by the shared staging implementation under test.
      const payload = await request.json() as { data: unknown };
      stored.push(payload.data); return Response.json({ success: true, tables_created: ["payloads"], total_rows: 1 });
    }
    return Response.json({ success: true, schema: { tables: { payloads: { columns: [{ name: "root_json" }] } } } });
  } }) } as unknown as DurableObjectNamespace;
  const proxy = createApiProxyTool({ apiFetch: createGwasApiFetch(), catalog: gwasCatalog, doNamespace: namespace, stagingPrefix: "gwas", maxInlineBytes: 30 * 1024 });
  const result = await proxy.handler({ method: "GET", path: "/sumstats/preview", params: { accession: "GCST123456", filename: "study.tsv", format: "tsv" } }, { sql: () => [] });
  expect(result).toMatchObject({ __staged: true, data_access_id: expect.any(String) });
  const payloads = stored.map(value => typeof value === "string" ? JSON.parse(value) : value);
  expect(payloads).toEqual(expect.arrayContaining([expect.objectContaining({ native: expect.objectContaining({ columns: ["hgnc_symbol", "p_value", "note"], rows: [["TP53", "1e-400", "α".repeat(20000)]] }), observation: expect.objectContaining({ text_sha256: expect.stringMatching(/^[a-f0-9]{64}$/) }), assembly: null, coordinate_convention: null, artifact_checksum_verified: false })]));
  expect(new TextEncoder().encode(JSON.stringify(result)).byteLength).toBeLessThan(100000);
});

it("stages complete snapshot metadata including provider fields and pinned links", async () => {
  const native = { id: "gwascatalog/studies", sha: "a".repeat(40), siblings: [{ rfilename: "README.md" }], description: "α".repeat(20000) };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(native)));
  const stored: unknown[] = [];
  // SAFETY: only the staging operations exercised by the shared proxy are supplied.
  const namespace = { idFromName: (name: string) => name, get: () => ({ fetch: async (request: Request) => {
    if (new URL(request.url).pathname === "/process") {
      const payload = await request.json() as { data: unknown };
      stored.push(payload.data); return Response.json({ success: true, tables_created: ["payloads"], total_rows: 1 });
    }
    return Response.json({ success: true, schema: { tables: { payloads: { columns: [{ name: "root_json" }] } } } });
  } }) } as unknown as DurableObjectNamespace;
  const proxy = createApiProxyTool({ apiFetch: createGwasApiFetch(), catalog: gwasCatalog, doNamespace: namespace, stagingPrefix: "gwas", maxInlineBytes: 30 * 1024 });
  const result = await proxy.handler({ method: "GET", path: "/snapshots/manifest", params: { dataset: "studies" } }, { sql: () => [] });
  expect(result).toMatchObject({ __staged: true, data_access_id: expect.any(String) });
  expect(stored.map(value => typeof value === "string" ? JSON.parse(value) : value)).toEqual(expect.arrayContaining([expect.objectContaining({ native, repository_commit: native.sha, data_release: null, artifact_contents_verified: false, files: [{ path: "README.md", url: `https://huggingface.co/datasets/gwascatalog/studies/resolve/${native.sha}/README.md`, artifact_checksum_verified: false }] })]));
  expect(new TextEncoder().encode(JSON.stringify(result)).byteLength).toBeLessThan(100000);
});
