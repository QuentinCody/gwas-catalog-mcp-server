import { afterEach, expect, it, vi } from "vitest";
import { distributionWorkflows } from "./distributions";
import { gwasCatalog } from "./catalog";
import { createGwasApiFetch } from "../lib/api-adapter";

afterEach(() => vi.unstubAllGlobals());

it.each(distributionWorkflows ?? [])("runs the public recipe through the adapter: $title", async workflow => {
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async (url: string) => new Response(url.endsWith("/") ? '<a href="study.tsv">data</a><a href="study.yaml">metadata</a>' : "chromosome\tbase_pair_start\tp_value\n1\t0\t1e-400\n")));
  const fetch = createGwasApiFetch();
  const result = await new Function("api", `return (async () => { ${workflow.code} })();`)({ get: async (path: string, params: Record<string, unknown>) => (await fetch({ method: "GET", path, params })).data });
  expect(result).toHaveProperty("accession", "GCST90270927");
  expect(result.native?.rows ?? result.files.map((file: { name: string }) => file.name)).toEqual(workflow.title.startsWith("Preview") ? [["1", "0", "1e-400"]] : ["study.tsv", "study.yaml"]);
});

it("returns staged discovery handles intact rather than reading unavailable file arrays", async () => {
  const staged = { __staged: true, data_access_id: "fixture" };
  const code = distributionWorkflows?.[1].code;
  expect(await new Function("api", `return (async () => { ${code} })();`)({ get: async () => staged })).toBe(staged);
});

it("keeps all existing PGS routes alongside the new local distribution routes", () => {
  expect(gwasCatalog.endpointCount).toBe(gwasCatalog.endpoints.length);
  expect(gwasCatalog.endpoints.filter(endpoint => endpoint.path.startsWith("/pgs/")).map(endpoint => endpoint.path)).toEqual([
    "/pgs/score/all", "/pgs/score/search", "/pgs/score/{pgs_id}", "/pgs/trait/all", "/pgs/trait/search", "/pgs/trait/{trait_id}", "/pgs/performance/search", "/pgs/publication/search", "/pgs/publication/{pgp_id}", "/pgs/sample_set/{pss_id}",
  ]);
});
