import { sha256Hex } from "@bio-mcp/shared";
import { nativeError } from "./native-error";

const DATASETS = ["studies", "associations", "samples"];
const SHA = /^[a-f0-9]{40}$/;
const LIMIT = 2 * 1024 * 1024;

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function readText(reader: ReadableStreamDefaultReader<Uint8Array>) {
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
  let bytes = 0; let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) return text + decoder.decode();
    bytes += value.byteLength;
    if (bytes > LIMIT) throw new Error("GWAS snapshot metadata exceeds 2 MiB");
    text += decoder.decode(value, { stream: true });
  }
}

async function readMetadata(url: string, format: "json" | "text" = "json") {
  const controller = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new Error("GWAS snapshot metadata exceeded 15 seconds")); }, 15000);
  });
  const receive = async () => {
    const response = await fetch(url, { signal: controller.signal, redirect: "manual", headers: { Accept: "application/json" } });
    if (!response.ok) throw await nativeError(response, url);
    if (controller.signal.aborted || !response.body || Number(response.headers.get("content-length")) > LIMIT) {
      void response.body?.cancel().catch(() => {});
      throw new Error(`GWAS snapshot metadata unavailable or too large (HTTP ${response.status})`);
    }
    reader = response.body.getReader();
    const text = await readText(reader);
    return { native: format === "json" ? JSON.parse(text) as unknown : text, source_url: url, observed_at: new Date().toISOString(), response_text_sha256: await sha256Hex(text) };
  };
  try { return await Promise.race([receive(), deadline]); }
  finally { if (timer !== undefined) clearTimeout(timer); controller.abort(); void reader?.cancel().catch(() => {}); }
}

function fileLink(file: unknown, root: string) {
  if (!object(file) || typeof file.rfilename !== "string") throw new Error("GWAS snapshot file metadata is malformed");
  const parts = file.rfilename.split("/");
  if (parts.some(part => !part || part === "." || part === "..") || [...file.rfilename].some(char => char === "\\" || char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) throw new Error("GWAS snapshot file path is unsafe");
  return { path: file.rfilename, url: root + parts.map(encodeURIComponent).join("/"), artifact_checksum_verified: false };
}

/** Repository commits are separate from scientific release dates. */
export async function snapshotManifest(params: Record<string, unknown> = {}) {
  const { dataset, revision = "main", include_card = false } = params;
  if (Object.keys(params).some(key => !["dataset", "revision", "include_card"].includes(key))) throw new Error("Unsupported GWAS snapshot parameter");
  if (typeof include_card !== "boolean") throw new Error("include_card must be boolean");
  if (typeof dataset !== "string" || !DATASETS.includes(dataset)) throw new Error("dataset must be studies, associations or samples");
  if (typeof revision !== "string" || (revision !== "main" && !SHA.test(revision))) throw new Error("revision must be main or a full lowercase 40-character commit SHA");
  const repository = `gwascatalog/${dataset}`;
  const evidence = await readMetadata(`https://huggingface.co/api/datasets/${repository}/revision/${revision}?blobs=true`);
  const native = evidence.native;
  if (!object(native) || native.id !== repository || typeof native.sha !== "string" || !SHA.test(native.sha) || !Array.isArray(native.siblings)) throw new Error("GWAS snapshot repository identity, commit or file listing is missing/invalid");
  if (revision !== "main" && revision !== native.sha) throw new Error("GWAS snapshot revision does not match requested commit");
  const root = `https://huggingface.co/datasets/${repository}/resolve/${native.sha}/`;
  const card = include_card && native.siblings.some(file => object(file) && file.rfilename === "README.md")
    ? await readMetadata(`https://huggingface.co/datasets/${repository}/raw/${native.sha}/README.md`, "text") : undefined;
  return {
    ...evidence, repository, requested_revision: revision, repository_commit: native.sha,
    requested_commit_verified: revision !== "main", files: native.siblings.map(file => fileLink(file, root)),
    ...(include_card ? { card: card ?? null } : {}),
    data_release: null, artifact_contents_verified: false, live_rest_equivalence_verified: false,
    limitation: "Pilot snapshot metadata only. include_card retains the listed README text at the observed commit; it does not resolve conflicting release claims. Inspect the dataset card and filenames for source dates and terms; repository lastModified is not a scientific release date. Parquet bytes, checksums, row completeness and equivalence to live REST have not been verified by this response.",
  };
}
