import { z } from "zod";
import { distributionManifest, listedFile, studyInput, fileInput } from "./distribution-files";
import { readDistribution } from "./distribution-http";
import { distributionTable } from "./distribution-table";

const selection = z.object({ accession: studyInput, directory: z.enum(["submitted", "harmonised"]).default("submitted"), filename: fileInput });
const metadataInput = selection.extend({ expected_text_sha256: z.string().regex(/^[a-f0-9]{64}$/).optional() }).strict();
const previewInput = selection.extend({ format: z.enum(["tsv", "csv"]), limit: z.number().int().min(1).max(1000).default(100), expected_etag: z.string().min(1).max(200).optional() }).strict();

async function metadata(params: Record<string, unknown>): Promise<Record<string, unknown>> {
  const input = metadataInput.parse(params);
  if (!/\.(yaml|yml|txt|md5|md5sum|log)$/i.test(input.filename)) throw new Error("Select a listed plain-text metadata, README, checksum or log file");
  const file = await listedFile(input.accession, input.directory, input.filename);
  const read = await readDistribution(file.url);
  if (input.expected_text_sha256 && read.text_sha256 !== input.expected_text_sha256) throw new Error("GWAS metadata changed from expected_text_sha256");
  return { accession: input.accession, file, native: read,
    interpretation: "Unmodified source metadata text. Inspect assembly, harmonisation, file_type, license, author notes and named checksum targets. A metadata-text hash is not a data-file checksum; no YAML execution or schema inference is performed." };
}

async function preview(params: Record<string, unknown>): Promise<Record<string, unknown>> {
  const input = previewInput.parse(params);
  if (!/\.(tsv|csv|txt)(\.gz)?$/i.test(input.filename)) throw new Error("Select a listed tabular .tsv/.csv/.txt file, optionally gzip-compressed");
  const file = await listedFile(input.accession, input.directory, input.filename);
  const read = await readDistribution(file.url, true);
  if (input.expected_etag && read.etag !== input.expected_etag) throw new Error("GWAS file ETag is missing or differs from expected_etag");
  const native = distributionTable(read.text, input.format, read.complete, input.limit);
  const { text: _text, ...observation } = read;
  return { accession: input.accession, file, native, observation,
    text_hash_scope: read.complete ? "entire decoded UTF-8 artifact text" : "bounded decoded UTF-8 prefix; not a file checksum",
    assembly: null, coordinate_convention: null, schema_validated: false, artifact_checksum_verified: false,
    interpretation: "Preview only. Preserve source YAML and checksum evidence separately. All cells are strings; do not coerce extreme p-values or infer coordinate basis, allele alignment, effect-size type, or equivalence between submitted and harmonised files. CNV and gene-based schemas evolve; column observations are not schema validation." };
}

export async function distributionRoute(path: string, params: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  if (path === "/sumstats/files") {
    const input = z.object({ accession: studyInput, include_harmonised: z.boolean().default(true) }).strict().parse(params);
    return { ...await distributionManifest(input.accession, input.include_harmonised) };
  }
  if (path === "/sumstats/metadata") return metadata(params);
  if (path === "/sumstats/preview") return preview(params);
  throw new Error("Unknown summary-statistics distribution route");
}
