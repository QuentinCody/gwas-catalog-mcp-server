/// <reference types="node" />
import { afterEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { createGwasApiFetch } from "./api-adapter";
import { distributionRoute } from "./distributions";

afterEach(() => vi.unstubAllGlobals());
const accession = "GCST123456";
const yaml = "genome_assembly: GRCh37\nfile_type: Non-GWAS-SSF\ncoordinate_system: 0-based\nauthor_notes: fixture\n";
function provider() {
  const fetcher = vi.fn().mockImplementation(async (url: string) => {
    if (url.endsWith("/")) return new Response('<a href="data.tsv">data</a><a href="data.yaml">metadata</a>');
    return new Response(url.endsWith(".yaml") ? yaml : "hgnc_symbol\tbase_pair_start\tp_value\nTP53\t0\t1e-400\n", { headers: { etag: '"fixture"' } });
  });
  vi.stubGlobal("fetch", fetcher); return fetcher;
}

it("retains native YAML and checks its hash without treating it as an artifact checksum", async () => {
  provider();
  const params = { accession, filename: "data.yaml", expected_text_sha256: createHash("sha256").update(yaml).digest("hex") };
  expect(await distributionRoute("/sumstats/metadata", params)).toMatchObject({ native: { text: yaml, complete: true } });
  await expect(distributionRoute("/sumstats/metadata", { ...params, expected_text_sha256: "0".repeat(64) })).rejects.toThrow("changed");
});

it("returns exact preview strings and keeps unverified scientific context explicitly unknown", async () => {
  provider();
  const response = await createGwasApiFetch()({ method: "GET", path: "/sumstats/preview", params: { accession, filename: "data.tsv", format: "tsv", expected_etag: '"fixture"' } });
  expect(response.data).toMatchObject({ native: { rows: [["TP53", "0", "1e-400"]], complete_file: true }, assembly: null, coordinate_convention: null, schema_validated: false, artifact_checksum_verified: false });
  await expect(distributionRoute("/sumstats/preview", { accession, filename: "data.tsv", format: "tsv", expected_etag: '"different"' })).rejects.toThrow("ETag");
});

it.each([
  { path: "/sumstats/files", params: { accession: "bad" } },
  { path: "/sumstats/metadata", params: { accession, filename: "../secret.yaml" } },
  { path: "/sumstats/metadata", params: { accession, filename: "data.exe" } },
  { path: "/sumstats/preview", params: { accession, filename: "data.tsv", format: "tsv", limit: 1001 } },
  { path: "/sumstats/preview", params: { accession, filename: "index.tbi", format: "tsv" } },
  { path: "/sumstats/unknown", params: {} },
])("rejects unsupported distribution requests before fetching %#", async request => {
  const fetcher = provider();
  await expect(distributionRoute(request.path, request.params)).rejects.toThrow(); expect(fetcher).not.toHaveBeenCalled();
});

it.each(["/pgs/score/PGS000001", "/v2/studies/GCST123456"])("preserves existing raw routing for %s", async path => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ native: true })); vi.stubGlobal("fetch", fetcher);
  expect(await createGwasApiFetch()({ method: "GET", path })).toEqual({ status: 200, data: { native: true } });
  expect(fetcher.mock.calls[0][0]).toContain(path.startsWith("/pgs") ? "pgscatalog.org/rest/score" : "ebi.ac.uk/gwas/rest/api/v2");
});

it("rejects writes instead of silently treating them as reads", async () => {
  const fetcher = provider();
  await expect(createGwasApiFetch()({ method: "POST", path: "/v2/studies" })).rejects.toThrow("GET");
  expect(fetcher).not.toHaveBeenCalled();
});
