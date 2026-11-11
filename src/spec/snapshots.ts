import type { ApiCatalog } from "@bio-mcp/shared/codemode/catalog";

export const snapshotEndpoints: ApiCatalog["endpoints"] = [{
  method: "GET", path: "/snapshots/manifest", category: "snapshots",
  summary: "Inspect an official GWAS Catalog Hugging Face pilot snapshot: native dataset/card metadata, file sizes/LFS hashes when supplied, and file URLs pinned to the observed repository commit. Does not download Parquet or equate snapshots with live REST.",
  queryParams: [
    { name: "dataset", type: "string", required: true, enum: ["studies", "associations", "samples"], description: "Official gwascatalog repository. Samples describe study populations, not individual participant records." },
    { name: "revision", type: "string", required: false, description: "main (default) to discover the current repository commit, or an exact lowercase 40-character commit SHA to verify that revision. Repository commit dates are not scientific release dates." },
    { name: "include_card", type: "boolean", required: false, description: "Also read the listed README.md as unmodified text at the observed commit (default false; 2 MiB/15 second bound). Preserve conflicting card/filename dates without choosing one." },
  ],
}];

export const snapshotWorkflows: ApiCatalog["workflows"] = [{
  title: "Select a reproducible GWAS pilot snapshot",
  keywords: ["Hugging Face", "Parquet", "snapshot", "release", "samples", "bulk"],
  description: "Discover a study repository commit, then explicitly request that revision. Inspect native.cardData and README.md for source release/terms before comparing datasets. File checksums remain provider claims until bytes are verified; each dataset has its own commit.",
  code: 'const manifest = await api.get("/snapshots/manifest", {dataset:"studies"});\nif (manifest.__staged || manifest.__api_error) return manifest;\nreturn await api.get("/snapshots/manifest", {dataset:"studies", revision:manifest.repository_commit, include_card:true});',
}];
