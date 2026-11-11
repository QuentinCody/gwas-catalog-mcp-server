import { afterEach, describe, expect, it, vi } from "vitest";
import { createApiProxyTool } from "@bio-mcp/shared/tools/api-proxy";
import { gwasCatalog } from "../spec/catalog";
import { createGwasApiFetch } from "./api-adapter";
import {
  CC0_URL, SCORE_WITHHELD, commercialDecision, isCanonicalPath, isCuratedCatalogRoute, isPgsMetadataRoute,
  isStudyFileContentRequest, openUsageLicense, readStudyLicense, withScoreLicenseVisible,
} from "./commercial-profile";

// License audit 2026-11-10: "Honor each study's usage license and each PGS
// score's license in the server." A reselling caller gets the curated catalog
// and PGS Catalog metadata. It gets the content of a summary statistics file
// only when the GWAS Catalog API states an open usage license for that study:
// most studies are CC0, older ones are under the EMBL-EBI terms of use, and "A
// small number of datasets may have other license terms". Each PGS score
// record keeps its license text; no route gives score weights.

const accession = "GCST123456";
const API = "https://www.ebi.ac.uk/gwas/rest/api";
const FILES = "https://ftp.ebi.ac.uk/";
const PGS = "https://www.pgscatalog.org/rest";
const EBI_TERMS = "https://www.ebi.ac.uk/about/terms-of-use/";
const CC_BY = "https://creativecommons.org/licenses/by/4.0/";
const commercial = { method: "GET", licenseProfile: "commercial" as const };
const preview = { path: "/sumstats/preview", params: { accession, filename: "data.tsv", format: "tsv" } };
const metadata = { path: "/sumstats/metadata", params: { accession, filename: "data.yaml" } };

type Reply = () => Response;
interface Records { study?: Reply; unpublished?: Reply; pgs?: unknown }
const json = (data: unknown, status = 200): Reply => () => Response.json(data, { status });
const notFound = json({ errorCode: 404, error: "Not Found" }, 404);
const study = (terms?: unknown, accession_id = accession) =>
  json({ accession_id, full_summary_stats_available: true, ...(terms === undefined ? {} : { terms_of_license: terms }) });
const unpublished = (agreed_to_cc0: unknown, study_accession = accession) => json({ study_accession, agreed_to_cc0 });

/** The upstream hosts. `records` gives the replies of the GWAS Catalog API for the study, and of the PGS Catalog. */
function upstream(records: Records = {}) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (input: string) => {
    const url = String(input);
    calls.push(url);
    if (url === `${API}/v2/studies/${accession}`) return (records.study ?? notFound)();
    if (url === `${API}/v2/unpublished-studies/${accession}`) return (records.unpublished ?? notFound)();
    if (url.startsWith(FILES) && url.endsWith("/")) return new Response('<a href="data.tsv">data</a><a href="data.yaml">metadata</a>');
    if (url.startsWith(FILES)) return new Response(url.endsWith(".yaml") ? "genome_assembly: GRCh38\n" : "variant_id\tp_value\nrs1\t1e-400\n");
    if (url.startsWith("https://huggingface.co/")) return Response.json({ id: "gwascatalog/studies", sha: "a".repeat(40), siblings: [{ rfilename: "README.md" }] });
    return Response.json(url.startsWith(PGS) && records.pgs !== undefined ? records.pgs : { native: true });
  });
  return { calls, fileRequests: () => calls.filter(url => url.startsWith(FILES)) };
}

const defaultTerms = "PGS obtained from the Catalog should be cited appropriately, and used in accordance with any licensing restrictions set by the authors. See EBI Terms of Use (https://www.ebi.ac.uk/about/terms-of-use/) for additional details.";
const scores = [
  { id: "PGS000001", name: "PRS77_BC", variants_number: 77, ftp_scoring_file: "https://ftp.ebi.ac.uk/pub/databases/spot/pgs/scores/PGS000001/ScoringFiles/PGS000001.txt.gz", license: defaultTerms },
  { id: "PGS000013", name: "GPS_CAD", variants_number: 6630150, license: "Freely available to the academic community for research use. Parties interested in using the scores for commercial purposes should contact the Broad Office of Strategic Alliances and Partnering (partnering@broadinstitute.org)." },
  { id: "PGS000999", name: "fixture", variants_number: 10, license: "Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International (CC BY-NC-ND 4.0)." },
];

describe("GWAS Catalog adapter under the commercial license profile", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  const notOpen: Array<[string, Records]> = [
    ["the EMBL-EBI terms of use", { study: study(EBI_TERMS) }],
    ["a non-commercial Creative Commons license", { study: study("https://creativecommons.org/licenses/by-nc/4.0/") }],
    ["license text that is not a known open license", { study: study("Academic research use only") }],
    ["a record without terms_of_license", { study: study() }],
    ["an empty terms_of_license", { study: study("  ") }],
    ["a null terms_of_license", { study: study(null) }],
    ["a record of a different study", { study: study(CC0_URL, "GCST000001") }],
    ["a reply that is not a record", { study: json([{ accession_id: accession, terms_of_license: CC0_URL }]) }],
    ["a reply that is not JSON", { study: () => new Response("<html>") }],
    ["no record in the GWAS Catalog API", {}],
    ["an unpublished record without the CC0 agreement", { unpublished: unpublished(false) }],
    ["an unpublished record with a value that is not a boolean", { unpublished: unpublished("true") }],
    ["an unpublished record of a different study", { unpublished: unpublished(true, "GCST000001") }],
  ];

  it.each(notOpen)("refuses the file content of a study with %s: HTTP 451 and no file request", async (_name, records) => {
    const { calls, fileRequests } = upstream(records);
    const api = createGwasApiFetch();
    for (const request of [preview, metadata]) {
      const result = await api({ ...commercial, ...request });
      expect(result.status).toBe(451);
      expect(result.data).toMatchObject({ error: "NOT_LICENSED_FOR_COMMERCIAL_USE" });
      expect(JSON.stringify(result.data)).toContain(accession);
    }
    expect(fileRequests()).toEqual([]);
    // Only the study records were read.
    expect(calls.every(url => url.startsWith(`${API}/v2/`))).toBe(true);
    expect(calls.length).toBeGreaterThan(0);
  });

  it("names the license that it refuses", async () => {
    upstream({ study: study(EBI_TERMS) });
    const result = await createGwasApiFetch()({ ...commercial, ...preview });
    expect(JSON.stringify(result.data)).toContain(EBI_TERMS);
    expect(JSON.stringify(result.data)).toContain("CC0 1.0, CC BY 4.0");
  });

  const failures: Array<[string, Reply]> = [
    ["HTTP 500", () => new Response("error", { status: 500 })],
    ["a network error", () => { throw new TypeError("fetch failed"); }],
  ];

  it.each(failures)("fails closed when the license read ends with %s", async (_name, reply) => {
    vi.useFakeTimers();
    const { calls, fileRequests } = upstream({ study: reply });
    const pending = createGwasApiFetch()({ ...commercial, ...preview });
    await vi.advanceTimersByTimeAsync(11_000);
    expect((await pending).status).toBe(451);
    expect(fileRequests()).toEqual([]);
    // One retry of the study record, and no fallback to a different record.
    expect(calls).toEqual([`${API}/v2/studies/${accession}`, `${API}/v2/studies/${accession}`]);
  });

  const open: Array<[string, Records, Record<string, string>]> = [
    ["CC0 1.0", { study: study(CC0_URL) }, { name: "CC0 1.0", terms: CC0_URL, source: `${API}/v2/studies/${accession}`, field: "terms_of_license" }],
    ["CC BY 4.0", { study: study(CC_BY) }, { name: "CC BY 4.0", terms: CC_BY, source: `${API}/v2/studies/${accession}`, field: "terms_of_license" }],
    ["the CC0 agreement of an unpublished study", { unpublished: unpublished(true) }, { name: "CC0 1.0", terms: CC0_URL, source: `${API}/v2/unpublished-studies/${accession}`, field: "agreed_to_cc0" }],
  ];

  it.each(open)("serves the file content of a study under %s and gives the license with it", async (_name, records, usage_license) => {
    const { calls, fileRequests } = upstream(records);
    const api = createGwasApiFetch();
    expect(await api({ ...commercial, ...preview })).toMatchObject({ status: 200, data: { accession, native: { columns: ["variant_id", "p_value"], rows: [["rs1", "1e-400"]] }, usage_license } });
    expect(await api({ ...commercial, ...metadata })).toMatchObject({ status: 200, data: { native: { text: "genome_assembly: GRCh38\n" }, usage_license } });
    // The license read comes before the first file request.
    expect(calls[0]).toBe(`${API}/v2/studies/${accession}`);
    expect(calls.indexOf(fileRequests()[0])).toBeGreaterThan(0);
  });

  it("serves the file listing of each study without a license read: it has no file content", async () => {
    const { calls, fileRequests } = upstream({ study: study(EBI_TERMS) });
    const result = await createGwasApiFetch()({ ...commercial, path: "/sumstats/files", params: { accession } });
    expect(result).toMatchObject({ status: 200, data: { accession, files: [{ name: "data.tsv" }, { name: "data.yaml" }] } });
    expect(result.data).not.toHaveProperty("usage_license");
    expect(calls).toEqual(fileRequests());
  });

  it("refuses a file content request without a valid study accession and makes no request", async () => {
    const { calls } = upstream({ study: study(CC0_URL) });
    const api = createGwasApiFetch();
    for (const params of [undefined, {}, { accession: "bad" }, { accession: `${accession}/../GCST000001` }, { accession: [accession] }]) {
      const result = await api({ ...commercial, path: "/sumstats/preview", params });
      expect(result.status, JSON.stringify(params)).toBe(451);
      expect(result.data).toMatchObject({ error: "NOT_LICENSED_FOR_COMMERCIAL_USE" });
    }
    // A route that the adapter does not know is content until it is known.
    expect((await api({ ...commercial, path: "/sumstats/all", params: {} })).status).toBe(451);
    expect(calls).toEqual([]);
  });

  it("serves the curated catalog routes without a change", async () => {
    const { calls } = upstream();
    const api = createGwasApiFetch();
    const requests = [
      { path: "/v2/studies", params: { efo_id: "EFO_0001060", size: 5 } },
      { path: "/v2/studies/GCST000854" },
      { path: "/v2/associations", params: { rs_id: "rs3093017", sort: "p_value" } },
      { path: "/v2/single-nucleotide-polymorphisms/rs3093017/genomic-contexts" },
      { path: "/v2/efo-traits/MONDO%3A0005180" },
      { path: "/v2/unpublished-studies/GCST91007236" },
    ];
    for (const request of requests) {
      expect(await api({ ...commercial, ...request }), request.path).toEqual({ status: 200, data: { native: true } });
      expect(await api({ method: "GET", ...request })).toEqual({ status: 200, data: { native: true } });
    }
    // Each request went to the same URL with and without the profile.
    expect(calls).toHaveLength(requests.length * 2);
    requests.forEach((request, index) => {
      expect(calls[index * 2]).toContain(`${API}${request.path}`);
      expect(calls[index * 2]).toBe(calls[index * 2 + 1]);
    });
  });

  it("serves the snapshot manifest: repository metadata and file links, no table data", async () => {
    const { calls } = upstream();
    const result = await createGwasApiFetch()({ ...commercial, path: "/snapshots/manifest", params: { dataset: "studies" } });
    expect(result).toMatchObject({ status: 200, data: { repository: "gwascatalog/studies", files: [{ path: "README.md" }], artifact_contents_verified: false } });
    expect(calls).toEqual(["https://huggingface.co/api/datasets/gwascatalog/studies/revision/main?blobs=true"]);
  });

  it("permits each route of the server catalog that is not study file content", async () => {
    const { calls } = upstream();
    const paths = gwasCatalog.endpoints.map(endpoint => endpoint.path.replace(/\{[^{}]+\}/g, "X1"));
    const content = paths.filter(isStudyFileContentRequest);
    expect(content).toEqual(["/sumstats/metadata", "/sumstats/preview"]);
    for (const path of paths.filter(path => !content.includes(path))) expect(await commercialDecision({ ...commercial, path }), path).toEqual({});
    expect(calls).toEqual([]);
  });

  it.each([
    "/studies", // the retired v1 API
    "/v3/studies",
    "/.%2e/.%2e/.%2e/europepmc/webservices/rest/search", // a different service on www.ebi.ac.uk
    "/v2/.%2e/.%2e/summary-statistics/api",
    "/v2/%2E./x",
    "/v2/../x",
    "/v2\\..\\..\\x",
    "/v2/.\t./x",
    "/v2/genes/A B",
    "v2/studies",
    "/pgs",
    "/pgs/",
    "/pgs/score/PGS000001/scoring_file",
    "/pgs/scoring_file/PGS000001",
    "/pgs/score/.%2e/.%2e/downloads",
    "/pgsx/score/all",
  ])("refuses the path %j: its route and its terms are not confirmed", async path => {
    const { calls } = upstream();
    const result = await createGwasApiFetch()({ ...commercial, path });
    expect(result.status).toBe(451);
    expect(result.data).toMatchObject({ error: "NOT_LICENSED_FOR_COMMERCIAL_USE" });
    expect(calls).toEqual([]);
  });

  it("serves PGS Catalog score metadata with the license text of each score, restricted or not", async () => {
    const page = { size: 3, count: 3, next: null, previous: null, results: scores };
    const { calls } = upstream({ pgs: page });
    const api = createGwasApiFetch();
    const request = { path: "/pgs/score/search", params: { trait_id: "EFO_0001645" } };
    const result = await api({ ...commercial, ...request });
    expect(result).toEqual({ status: 200, data: page });
    expect(result).toEqual(await api({ method: "GET", ...request }));
    expect(calls).toEqual([`${PGS}/score/search?trait_id=EFO_0001645`, `${PGS}/score/search?trait_id=EFO_0001645`]);
  });

  it("serves one score record with its license text", async () => {
    upstream({ pgs: scores[1] });
    expect(await createGwasApiFetch()({ ...commercial, path: "/pgs/score/PGS000013" })).toEqual({ status: 200, data: scores[1] });
  });

  it("serves each documented PGS Catalog metadata route", async () => {
    const { calls } = upstream();
    const api = createGwasApiFetch();
    const paths = [
      "/pgs/score/all", "/pgs/score/search", "/pgs/score/PGS000001", "/pgs/trait/all", "/pgs/trait/search", "/pgs/trait/EFO_0001645",
      "/pgs/trait_category/all", "/pgs/performance/all", "/pgs/performance/search", "/pgs/performance/PPM000001",
      "/pgs/publication/all", "/pgs/publication/search", "/pgs/publication/PGP000001", "/pgs/sample_set/all", "/pgs/sample_set/search",
      "/pgs/sample_set/PSS000001", "/pgs/cohort/all", "/pgs/cohort/UKB", "/pgs/release/all", "/pgs/release/current",
      "/pgs/release/2024-01-26", "/pgs/info", "/pgs/api_versions", "/pgs/ancestry_categories", "/pgs/gwas/get_score_ids/GCST001937",
      "/pgs/score/all/",
    ];
    for (const path of paths) expect((await api({ ...commercial, path })).status, path).toBe(200);
    expect(calls).toEqual(paths.map(path => `${PGS}${path.slice("/pgs".length)}`));
  });

  it("withholds a score record that comes without license text and keeps the other records", async () => {
    const bare = { id: "PGS000002", name: "no terms", variants_number: 5, ftp_scoring_file: "https://ftp.ebi.ac.uk/pub/databases/spot/pgs/scores/PGS000002/ScoringFiles/PGS000002.txt.gz" };
    const page = { count: 4, results: [scores[0], bare, { ...bare, id: "PGS000003", license: " " }, { ...bare, id: "PGS000004", license: null }] };
    upstream({ pgs: page });
    const api = createGwasApiFetch();
    const withheld = (id: string) => ({ id, license: null, withheld: SCORE_WITHHELD });
    expect((await api({ ...commercial, path: "/pgs/score/all" })).data).toEqual({ count: 4, results: [scores[0], withheld("PGS000002"), withheld("PGS000003"), withheld("PGS000004")] });
    // Without the profile the response is the upstream response.
    expect((await api({ method: "GET", path: "/pgs/score/all" })).data).toEqual(page);

    upstream({ pgs: bare });
    expect((await createGwasApiFetch()({ ...commercial, path: "/pgs/score/PGS000002" })).data).toEqual(withheld("PGS000002"));
  });

  it("does not change a caller without the commercial profile", async () => {
    const { calls, fileRequests } = upstream({ study: study(EBI_TERMS) });
    const api = createGwasApiFetch();
    const rows = await api({ method: "GET", ...preview });
    expect(rows).toMatchObject({ status: 200, data: { accession, native: { rows: [["rs1", "1e-400"]] } } });
    expect(rows.data).not.toHaveProperty("usage_license");
    expect(await api({ method: "GET", ...metadata })).toMatchObject({ status: 200, data: { native: { text: "genome_assembly: GRCh38\n" } } });
    // No license read: each request was a file request.
    expect(calls).toEqual(fileRequests());
    const paths = ["/studies", "/pgs/score/PGS000001/scoring_file", "/v2/.%2e/x"];
    for (const path of paths) expect(await api({ method: "GET", path })).toEqual({ status: 200, data: { native: true } });
    expect(calls.slice(-3)).toEqual([`${API}/studies`, `${PGS}/score/PGS000001/scoring_file`, `${API}/v2/.%2e/x`]);
  });

  it("reports the refusal through the Code Mode proxy as a failed call with its reason", async () => {
    const { fileRequests } = upstream({ study: study(EBI_TERMS) });
    const proxy = createApiProxyTool({ apiFetch: createGwasApiFetch(), catalog: gwasCatalog });
    const result = await proxy.handler({ method: "GET", ...preview }, { sql: () => [], requestContext: { licenseProfile: "commercial" } });
    expect(result).toMatchObject({ __api_error: true, status: 451, message: expect.stringMatching(/^NOT_LICENSED_FOR_COMMERCIAL_USE: .*GCST123456/) });
    expect(fileRequests()).toEqual([]);
    // The same call without the profile reads the file.
    expect(await proxy.handler({ method: "GET", ...preview }, { sql: () => [] })).toMatchObject({ native: { rows: [["rs1", "1e-400"]] } });
    expect(fileRequests().length).toBeGreaterThan(0);
  });
});

describe("the predicates of the commercial license profile", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("accepts only CC0 1.0 and CC BY 4.0, by exact comparison", () => {
    for (const value of [CC0_URL, "http://creativecommons.org/publicdomain/zero/1.0", " https://creativecommons.org/publicdomain/zero/1.0/legalcode ", "CC0", "cc0-1.0", "CC0 1.0"]) expect(openUsageLicense(value), value).toBe("CC0 1.0");
    for (const value of [CC_BY, "https://www.creativecommons.org/licenses/by/4.0", "CC BY 4.0", "CC-BY-4.0"]) expect(openUsageLicense(value), value).toBe("CC BY 4.0");
    const closed = [
      EBI_TERMS, "https://creativecommons.org/licenses/by-nc/4.0/", "https://creativecommons.org/licenses/by-nc-nd/4.0/",
      "https://creativecommons.org/licenses/by-sa/4.0/", "https://creativecommons.org/licenses/by/3.0/",
      "https://example.org/creativecommons.org/publicdomain/zero/1.0/", "CC0 for academic use only", "CC BY-NC 4.0",
      defaultTerms, scores[1].license, scores[2].license, "", null, undefined, true, { license: "CC0" },
    ];
    for (const value of closed) expect(openUsageLicense(value), String(value)).toBeUndefined();
  });

  it("reads the license of a study from its record, and from the unpublished record only after HTTP 404", async () => {
    const first = upstream({ study: study(` ${CC0_URL} `), unpublished: unpublished(false) });
    expect(await readStudyLicense(accession)).toEqual({ terms: CC0_URL, source: `${API}/v2/studies/${accession}`, field: "terms_of_license" });
    expect(first.calls).toEqual([`${API}/v2/studies/${accession}`]);

    const second = upstream({ unpublished: unpublished(true) });
    expect(await readStudyLicense(accession)).toEqual({ terms: CC0_URL, source: `${API}/v2/unpublished-studies/${accession}`, field: "agreed_to_cc0" });
    expect(second.calls).toEqual([`${API}/v2/studies/${accession}`, `${API}/v2/unpublished-studies/${accession}`]);

    upstream();
    expect(await readStudyLicense(accession)).toEqual({ terms: null, source: `${API}/v2/unpublished-studies/${accession}`, field: "agreed_to_cc0" });
  });

  it("classifies the routes", () => {
    expect(["/sumstats/preview", "/sumstats/metadata", "/sumstats/files/", "/sumstats/files?x=1", "/sumstats/all"].every(isStudyFileContentRequest)).toBe(true);
    expect(["/sumstats/files", "/sumstats", "/v2/studies", "/pgs/score/all", "/snapshots/manifest"].some(isStudyFileContentRequest)).toBe(false);
    expect(["/pgs/score/all", "/pgs/score/PGS000001/", "/pgs/score/search?trait_id=EFO_0001645", "/pgs/info"].every(isPgsMetadataRoute)).toBe(true);
    expect(["/pgs", "/pgs/score", "/pgs/score/PGS000001/weights", "/pgs/info/x", "/pgs/files/PGS000001", "/v2/studies"].some(isPgsMetadataRoute)).toBe(false);
    expect(["/v2", "/v2/studies", "/v2/studies?size=1"].every(isCuratedCatalogRoute)).toBe(true);
    expect(["/v1/studies", "/v22/studies", "/studies", "/pgs/score/all"].some(isCuratedCatalogRoute)).toBe(false);
    expect(["/v2/studies", "/v2/studies?size=1", "/v2/efo-traits/MONDO%3A0005180", "/pgs/cohort/A%20B"].every(isCanonicalPath)).toBe(true);
    expect(["/v2/.%2e/x", "/v2/%2e%2E/x", "/v2/./x", "/v2\\x", "/v2/a b", "/v2/x ", "v2/x", "//host/x/../y"].some(isCanonicalPath)).toBe(false);
  });

  it("keeps a response that is not a score record", () => {
    const trait = { id: "EFO_0001645", label: "coronary artery disease", associated_pgs_ids: ["PGS000013"] };
    const performance = { count: 1, results: [{ id: "PPM000001", associated_pgs_id: "PGS000001" }] };
    for (const data of [trait, performance, ["PGS000001"], "text", null, undefined]) expect(withScoreLicenseVisible(data)).toBe(data);
    const page = { count: 1, results: [scores[0]] };
    expect(withScoreLicenseVisible(page)).toBe(page);
  });
});
