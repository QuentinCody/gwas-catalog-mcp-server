/// <reference types="node" />
import { afterEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { createGwasApiFetch } from "./api-adapter";
import { snapshotManifest } from "./snapshots";
import { snapshotWorkflows } from "../spec/snapshots";

const sha = "a".repeat(40);
const native = { id: "gwascatalog/studies", sha, lastModified: "2026-09-01", cardData: { license: "other" }, siblings: [{ rfilename: "data/train 1.parquet", size: 123, lfs: { sha256: "b".repeat(64) } }], future: { preserve: true } };
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
function provider(data: unknown = native) {
  const fetcher = vi.fn().mockImplementation(async () => Response.json(data));
  vi.stubGlobal("fetch", fetcher); return fetcher;
}

it("reads a listed card at the observed commit without interpreting conflicting release claims", async () => {
  const card = "\uFEFFSource: 2026-03-17\nFilename: r2026-09-13.parquet\n";
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ ...native, siblings: [{ rfilename: "README.md" }] })).mockResolvedValueOnce(new Response(card));
  vi.stubGlobal("fetch", fetcher);
  expect(await snapshotManifest({ dataset: "studies", include_card: true })).toMatchObject({ data_release: null, artifact_contents_verified: false, card: { native: card, source_url: `https://huggingface.co/datasets/gwascatalog/studies/raw/${sha}/README.md`, response_text_sha256: createHash("sha256").update(card).digest("hex") } });
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("does not invent an unlisted card or accept a truthy non-boolean option", async () => {
  const fetcher = provider();
  expect(await snapshotManifest({ dataset: "studies", include_card: true })).toMatchObject({ card: null });
  await expect(snapshotManifest({ dataset: "studies", include_card: "yes" })).rejects.toThrow("boolean");
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it.each(["studies", "associations", "samples"])("discovers %s with native fields, hash and commit-pinned links", async dataset => {
  const source = { ...native, id: `gwascatalog/${dataset}` };
  const fetcher = provider(source);
  const response = await createGwasApiFetch()({ method: "GET", path: "/snapshots/manifest", params: { dataset } });
  expect(response).toMatchObject({ status: 200, data: { native: source, repository_commit: sha, requested_commit_verified: false, data_release: null, artifact_contents_verified: false, live_rest_equivalence_verified: false, response_text_sha256: createHash("sha256").update(JSON.stringify(source)).digest("hex"), files: [{ path: "data/train 1.parquet", url: `https://huggingface.co/datasets/gwascatalog/${dataset}/resolve/${sha}/data/train%201.parquet`, artifact_checksum_verified: false }] } });
  expect(fetcher.mock.calls[0][0]).toBe(`https://huggingface.co/api/datasets/gwascatalog/${dataset}/revision/main?blobs=true`);
  expect(fetcher.mock.calls[0][1]).toMatchObject({ redirect: "manual", headers: { Accept: "application/json" } });
});

it("verifies exact revisions and rejects a different returned commit", async () => {
  provider();
  expect(await snapshotManifest({ dataset: "studies", revision: sha })).toMatchObject({ requested_commit_verified: true });
  await expect(snapshotManifest({ dataset: "studies", revision: "b".repeat(40) })).rejects.toThrow("does not match");
});

it.each([{}, { dataset: "../other" }, { dataset: "studies", revision: "v1" }, { dataset: "studies", revision: null }, { dataset: "studies", revision: "A".repeat(40) }, { dataset: "studies", token: "fixture" }])("rejects unsupported selections before fetching %#", async params => {
  const fetcher = provider(); await expect(snapshotManifest(params)).rejects.toThrow(); expect(fetcher).not.toHaveBeenCalled();
});

it.each([null, [], { ...native, id: "other/studies" }, { ...native, sha: "bad" }, { ...native, siblings: undefined }, { ...native, siblings: [{}] }, { ...native, siblings: [{ rfilename: "../data.parquet" }] }, { ...native, siblings: [{ rfilename: "a\\b" }] }])("rejects missing or incompatible provider identity/files %#", async data => {
  provider(data); await expect(snapshotManifest({ dataset: "studies" })).rejects.toThrow();
});

it.each([302, 401, 404, 429, 500])("preserves HTTP failure %s", async status => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("fixture", { status })));
  await expect(snapshotManifest({ dataset: "studies" })).rejects.toThrow(`HTTP ${status}`);
});

it("bounds actual and declared bytes and rejects malformed data", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response("x".repeat(2 * 1024 * 1024 + 1))).mockResolvedValueOnce(new Response("{}", { headers: { "content-length": "3000000" } })).mockResolvedValueOnce(new Response(new Uint8Array([255]))).mockResolvedValueOnce(new Response("not JSON"));
  vi.stubGlobal("fetch", fetcher);
  for (let i = 0; i < 4; i++) await expect(snapshotManifest({ dataset: "studies" })).rejects.toThrow();
});

it("times out stalled body reads without waiting for cancellation", async () => {
  vi.useFakeTimers(); const cancel = vi.fn(() => new Promise<void>(() => {}));
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new ReadableStream({ cancel }))));
  const check = expect(snapshotManifest({ dataset: "studies" })).rejects.toThrow("15 seconds");
  await vi.advanceTimersByTimeAsync(15001); await check; expect(cancel).toHaveBeenCalled();
});

it("runs the discovery/pinning recipe and preserves a staged manifest handle", async () => {
  const fetcher = provider(); const adapter = createGwasApiFetch();
  const run = new Function("api", `return (async () => { ${snapshotWorkflows![0].code} })();`);
  expect(await run({ get: async (path: string, params: Record<string, unknown>) => (await adapter({ method: "GET", path, params })).data })).toMatchObject({ requested_commit_verified: true });
  expect(fetcher.mock.calls[1][0]).toContain(`/revision/${sha}?blobs=true`);
  const staged = { __staged: true, data_access_id: "fixture" };
  expect(await run({ get: async () => staged })).toBe(staged);
});

it("rejects unknown snapshot paths and writes before network access", async () => {
  const fetcher = provider(); const adapter = createGwasApiFetch();
  await expect(adapter({ method: "GET", path: "/snapshots/unknown" })).rejects.toThrow("Unsupported");
  await expect(adapter({ method: "POST", path: "/snapshots/manifest" })).rejects.toThrow("GET");
  expect(fetcher).not.toHaveBeenCalled();
});
