/// <reference types="node" />
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { afterEach, expect, it, vi } from "vitest";
import { readDistribution } from "./distribution-http";

const base = "https://ftp.ebi.ac.uk/pub/databases/gwas/summary_statistics/GCST123001-GCST124000/GCST123456/";
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it("retains full metadata text, BOM and response validators with an independently computed hash", async () => {
  const text = "\uFEFFgenome_assembly: GRCh37\nauthor_notes: fixture\n";
  const fetcher = vi.fn().mockResolvedValue(new Response(text, { headers: { etag: '"v1"', "last-modified": "Tue, 01 Sep 2026 00:00:00 GMT" } })); vi.stubGlobal("fetch", fetcher);
  expect(await readDistribution(base + "file.yaml")).toMatchObject({ text, complete: true, etag: '"v1"', text_sha256: createHash("sha256").update(text).digest("hex") });
  expect(fetcher.mock.calls[0][1]).toMatchObject({ redirect: "manual", signal: expect.any(AbortSignal) });
});

it("reads gzip artifact bytes without converting scientific values", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(gzipSync("p_value\tbeta\n1e-400\t0.123456789123456789\n"))));
  expect((await readDistribution(base + "file.tsv.gz", true)).text).toContain("1e-400\t0.123456789123456789");
});

it("reads concatenated gzip members including rows split across member boundaries", async () => {
  const raw = Buffer.concat([gzipSync("p_value\tnote\n1e-"), gzipSync("400\tα😀\n")]);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(raw)));
  expect(await readDistribution(base + "harmonised.tsv.gz", true)).toMatchObject({ text: "p_value\tnote\n1e-400\tα😀\n", complete: true });
});

it("rejects a corrupt later gzip member rather than declaring the first member complete", async () => {
  const damaged = gzipSync("400\tnative\n"); damaged[damaged.length - 8] ^= 255;
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(Buffer.concat([gzipSync("p_value\tnote\n1e-"), damaged]))));
  await expect(readDistribution(base + "harmonised.tsv.gz", true)).rejects.toThrow();
});

it("marks a bounded gzip prefix incomplete and rejects oversized metadata", async () => {
  const text = "α".repeat(1100000);
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response(gzipSync(text))));
  const preview = await readDistribution(base + "large.tsv.gz", true);
  expect(preview.complete).toBe(false); expect(new TextEncoder().encode(preview.text).length).toBe(2 * 1024 * 1024);
  await expect(readDistribution(base + "large.yaml.gz")).rejects.toThrow("2 MiB");
});

it.each(["https://attacker.example/file", "https://ftp.ebi.ac.uk/pub/other/file", base + "file?redirect=elsewhere"]) ("rejects untrusted paths before fetching %s", async url => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  await expect(readDistribution(url)).rejects.toThrow(); expect(fetcher).not.toHaveBeenCalled();
});

it("bounds stalled bodies by the same deadline as headers", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new ReadableStream({ start() {} }))));
  const pending = expect(readDistribution(base)).rejects.toThrow("15 seconds");
  await vi.advanceTimersByTimeAsync(15000); await pending;
});

it.each([new Response("missing", { status: 404 }), new Response("redirect", { status: 302 }), new Response(Uint8Array.from([255]))])("rejects provider errors and invalid UTF-8 %#", async response => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
  await expect(readDistribution(base)).rejects.toThrow();
});
