import type { ApiCatalog, ParamDef } from "@bio-mcp/shared/codemode/catalog";

const accession: ParamDef = { name: "accession", type: "string", required: true, description: "Exact GCST accession, e.g. GCST90270927. Uses provider-documented 1000-study distribution bins." };
const selection: ParamDef[] = [accession,
  { name: "directory", type: "string", required: false, enum: ["submitted", "harmonised"], description: "Default submitted. Representations are separate; this label does not prove the assembly or harmonisation status." },
  { name: "filename", type: "string", required: true, description: "Exact filename from /sumstats/files, without a path or URL. Membership is checked before reading." },
];

export const distributionEndpoints: ApiCatalog["endpoints"] = [
  { method: "GET", path: "/sumstats/files", summary: "Discover files and native metadata/checksum/readme/index links in a study's current distribution directories. Replaces use of the retired summary-statistics API; no file content is inferred from names.", category: "summary_statistics", queryParams: [accession, { name: "include_harmonised", type: "boolean", required: false, description: "Inspect the advertised harmonised directory too (default true)." }] },
  { method: "GET", path: "/sumstats/metadata", summary: "Read a listed YAML, README, checksum or log as original text, retaining assembly/harmonisation/license/author annotations without parsing or executing YAML.", category: "summary_statistics", queryParams: [...selection, { name: "expected_text_sha256", type: "string", required: false, description: "Optional exact metadata-text SHA-256. This is not the statistics artifact checksum." }] },
  { method: "GET", path: "/sumstats/preview", summary: "Preview a listed TSV/CSV/plain-text statistics file, optionally gzip-compressed. Keeps all cells as strings, including CNV/gene-based fields. Explicitly reports partial content; no assembly/coordinate conversion or schema validation.", category: "summary_statistics", queryParams: [...selection,
    { name: "format", type: "string", required: true, enum: ["tsv", "csv"], description: "Delimiter format confirmed from source documentation." },
    { name: "limit", type: "number", required: false, description: "1–1000 rows, default 100; at most 2 MiB decoded UTF-8 input. No pagination or complete-file guarantee." },
    { name: "expected_etag", type: "string", required: false, description: "Optional exact HTTP ETag from a previous observation; fails on mismatch or absent ETag." } ] },
];

export const distributionWorkflows: ApiCatalog["workflows"] = [{
  title: "Discover source files before reusing CNV or gene-based statistics",
  keywords: ["CNV", "gene-based", "summary statistics", "assembly", "harmonised", "files"],
  description: "Inspect source metadata, file_type, assembly, coordinates, license and checksum targets before choosing a file. Beyond-SNP schemas are evolving. File presence or column observations do not establish scientific validity or identity with curated SNP associations.",
  code: 'return await api.get("/sumstats/files", {accession: "GCST90270927", include_harmonised: true});',
}, {
  title: "Preview native submitted statistics without converting p-values",
  keywords: ["preview", "p_value", "neg_log10_p_value", "precision", "distribution"],
  description: "Choose a submitted TSV candidate from the actual listing. Read its corresponding YAML/checksum separately before analysis; the preview leaves assembly/coordinate convention unverified. Return staging handles unchanged.",
  code: 'const manifest = await api.get("/sumstats/files", {accession: "GCST90270927", include_harmonised: false});\nif (manifest.__staged || manifest.__api_error) return manifest;\nconst file = manifest.files.find(f => /\\.tsv(\\.gz)?$/i.test(f.name));\nif (!file) throw new Error("No submitted TSV advertised; inspect the manifest formats");\nreturn await api.get("/sumstats/preview", {accession: manifest.accession, directory: file.directory, filename: file.name, format: "tsv", limit: 100});',
}];

export const distributionNotes = "\n- Summary-statistics API is retired. Use /sumstats/files, /sumstats/metadata and /sumstats/preview for bounded distribution-file reads. Preview hashes may cover only a prefix, never claim an artifact checksum without full verification. For complete local imports, scripts/import_distribution.py in the server repository requires an expected checksum, preserves all cells as strings and publishes a SQLite file only after EOF and integrity checks.\n- CNV and gene-based files have evolving Beyond-SNP standards; retain gene IDs, interval boundaries, model/uncertainty fields and original p-value representation. Coordinate basis and assembly must come from source metadata. Structural ingestion is not scientific schema validation.\n- Official alternative MCP: https://www.ebi.ac.uk/gwas/mcp. Pilot Parquet datasets: https://huggingface.co/gwascatalog (studies, associations, samples). Use /snapshots/manifest for metadata, optional pinned README text and commit-pinned file links; scientific release dates remain separate from repository modification dates. Discovery does not verify artifact bytes/checksums or establish dataset-wide equivalence to live REST.";
