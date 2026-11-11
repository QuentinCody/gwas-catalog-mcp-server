/// <reference types="node" />
import { sha256Hex } from "@bio-mcp/shared";
import { nativeError } from "./native-error";
import { Duplex } from "node:stream";
import { createGunzip } from "node:zlib";

export interface DistributionRead {
  text: string;
  source_url: string;
  observed_at: string;
  etag: string | null;
  last_modified: string | null;
  complete: boolean;
  text_sha256: string;
}

const TEXT_LIMIT = 2 * 1024 * 1024;

async function readPrefix(reader: ReadableStreamDefaultReader<Uint8Array>, preview: boolean) {
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
  let bytes = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) return { text: text + decoder.decode(), complete: true };
    const available = TEXT_LIMIT - bytes;
    text += decoder.decode(value.subarray(0, available), { stream: true });
    bytes += value.byteLength;
    if (bytes <= TEXT_LIMIT) continue;
    if (!preview) throw new Error("GWAS distribution metadata/listing exceeds 2 MiB");
    return { text, complete: false };
  }
}

function contentStream(response: Response, url: string): ReadableStream<Uint8Array> {
  if (!response.body) throw new Error("Empty GWAS distribution response");
  let bytes = 0;
  const bounded = response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({ transform(chunk, controller) {
    bytes += chunk.byteLength;
    if (bytes > 8 * 1024 * 1024) throw new Error("GWAS distribution transfer exceeds 8 MiB");
    controller.enqueue(chunk);
  } }));
  // Fetch has already decoded HTTP Content-Encoding. Otherwise .gz is an artifact container.
  if (!url.endsWith(".gz") || response.headers.get("content-encoding")?.includes("gzip")) return bounded;
  // EBI harmonised files use concatenated BGZF members. Workers' web
  // DecompressionStream rejects them as trailing data; Node gunzip reads all members.
  // SAFETY: Node's web bridge carries byte chunks; Workers and Node declare web stream types separately.
  const gunzip = Duplex.toWeb(createGunzip()) as unknown as { readable: ReadableStream<Uint8Array>; writable: WritableStream<Uint8Array> };
  return bounded.pipeThrough(gunzip);
}

/** Fixed EBI distribution host; never fetch caller-supplied arbitrary URLs. */
export async function readDistribution(url: string, preview = false): Promise<DistributionRead> {
  const target = new URL(url);
  if (target.origin !== "https://ftp.ebi.ac.uk" || !target.pathname.startsWith("/pub/databases/gwas/summary_statistics/") || target.search || target.hash || target.username || target.password) throw new Error("Invalid GWAS distribution URL");
  const controller = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new Error("GWAS distribution read exceeded 15 seconds")); }, 15000);
  });
  const receive = async (): Promise<DistributionRead> => {
    const response = await fetch(url, { signal: controller.signal, redirect: "manual", headers: { Accept: "text/plain,text/html,application/gzip" } });
    if (!response.ok) throw await nativeError(response, url);
    reader = contentStream(response, url).getReader();
    const result = await readPrefix(reader, preview);
    return { ...result, source_url: url, observed_at: new Date().toISOString(), etag: response.headers.get("etag"), last_modified: response.headers.get("last-modified"), text_sha256: await sha256Hex(result.text) };
  };
  try { return await Promise.race([receive(), deadline]); }
  finally { if (timer !== undefined) clearTimeout(timer); controller.abort(); void reader?.cancel().catch(() => {}); }
}
