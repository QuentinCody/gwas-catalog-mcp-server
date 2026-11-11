# GWAS Catalog MCP Server

This is a [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server. It lets MCP clients (Claude Desktop, Claude Code, Continue, etc.) query the upstream GWAS Catalog API in natural language. It is one of 100+ servers in the [Bio MCP](../../README.md) monorepo.

## Connect

Production endpoint (local changes require deployment):

```
https://gwas-catalog-mcp-server.quentincody.workers.dev/mcp
```

Add it to your MCP client (Claude Desktop → Settings → Developer → Edit Config):

```json
{
  "mcpServers": {
    "gwas-catalog": {
      "command": "npx",
      "args": ["mcp-remote", "https://gwas-catalog-mcp-server.quentincody.workers.dev/mcp"]
    }
  }
}
```

For local development the server runs at `http://localhost:8833/mcp` (start it with `./scripts/dev-servers.sh gwas-catalog`):

```json
{
  "mcpServers": {
    "gwas-catalog-local": {
      "command": "npx",
      "args": ["mcp-remote", "http://localhost:8833/mcp"]
    }
  }
}
```

## Tools

- `gwas_search` — discover REST, PGS and distribution-file operations and workflows
- `gwas_execute` — write JavaScript in a V8 isolate using `api.get()` and `searchSpec()`; this adapter supports read-only GET operations
- `gwas_query_data` — run SQL over large responses auto-staged into a per-session SQLite database
- `gwas_get_schema` — inspect the inferred schema of a staged dataset

Large responses (>30KB) are auto-staged into a queryable SQLite database; the tools return a `data_access_id` you can query with SQL.

Every tool returns both a human-readable `content` summary and a structured `structuredContent` payload.

All four tools register bare and `mcp_` aliases, such as `mcp_gwas_execute`.

## GWAS v2 response handling

The provider's [v2 OpenAPI schemas](https://github.com/EBISPOT/gwas-mcp/blob/main/src/gwascatalog/mcp/data/rest-api-doc.yaml) describe collections as `content` arrays with `links` and, for paginated endpoints, `page` metadata. Live v2 association responses on October 1, 2026 use HAL `_embedded.associations` and `_links`. Code Mode preserves the native response. Inspect its shape before extracting records; HAL is not confined to v1. An unexpected shape is not an empty result, and a single page is not the complete dataset. For staged responses, use `gwas_get_schema` to discover table names before querying.

Use singular `show_child_trait` for descendant filtering. The live association
query for `MONDO_0004979` returned 3,234 total direct annotations with `false`
and 4,154 with `true`, including childhood-onset asthma in the sampled rows.
The plural `show_child_traits` spelling in the
[migration guide](https://www.ebi.ac.uk/gwas/docs/news/rest-api-v2-migration-guide/)
returned the same direct-only sample for both values. Code Mode flags that
undeclared parameter with `__unfiltered_warning`; an HTTP 200 alone does not
establish filter support. These observations qualify this association query,
not every endpoint, trait or future release.

## Summary-statistics distributions

[GWAS REST guidance](https://www.ebi.ac.uk/gwas/docs/programmatic-access/rest-api/) confirms that v1 retired in August 2026 and that no summary-statistics API is currently supported. The following local adapter routes read the [documented file distributions](https://www.ebi.ac.uk/gwas/docs/methods/summary-statistics/):

```javascript
return await api.get("/sumstats/files", {
  accession: "GCST90270927",
  include_harmonised: true
});
```

The manifest separates submitted files from the advertised `harmonised/` directory and retains listing hashes and observation times. It does not invent filenames or claim an immutable release. Use exact filenames from this result:

- `/sumstats/metadata`: pass `accession`, `filename`, and optionally `directory` (`submitted` or `harmonised`). Reads native YAML, README, checksum or log text. An optional `expected_text_sha256` rejects changed metadata. A metadata-text hash does not verify the statistics file.
- `/sumstats/preview`: pass the same selection plus `format` (`tsv` or `csv`) and optional `limit` (1–1000, default 100). Reads plain, gzip-compressed or BGZF tabular data, including concatenated gzip members. An optional `expected_etag` rejects a changed or missing HTTP validator.

Previews retain every selected column/cell as a string, including very small p-values, negative-log p-values, coordinate strings, missing-value markers and custom fields. `native.complete_file` is false when either the row limit or byte limit prevents returning all rows. `observation.complete` describes whether the source text was fully read. A truncated text hash covers only the decoded prefix, not the complete artifact or compressed bytes. Complete checksum verification and local ingestion are available in the companion importer below; the preview itself performs neither.

[CNV](https://www.ebi.ac.uk/gwas/apps/beyond-snps/how-to-reuse-cnv/) and [gene-based](https://www.ebi.ac.uk/gwas/apps/beyond-snps/how-to-reuse-gene/) schemas are evolving. Preserve original gene identifiers, interval boundaries, statistical models and uncertainty fields. Inspect the matching source YAML for assembly, coordinate conventions, harmonisation, file type, license and author notes before analysis. The preview does not infer these, validate the scientific schema, change alleles, or equate submitted/harmonised data with curated SNP associations.

Each file/listing read has a 15-second body-inclusive deadline, an 8 MiB transfer cap and a 2 MiB decoded-text cap. Metadata/listings fail when oversized; previews explicitly return a partial prefix. Only listed files on the fixed EBI distribution host are read; redirects are rejected. Complete MCP envelopes over 30 KiB stage with their source context, including query results and errors. Every alias returns both response fields and a verifiable citation. Staged previews expose `preview_columns` and `preview_rows`: `native_json` retains each ordered string array without SQL numeric conversion. Read bounded pages such as `SELECT row_index, native_json FROM preview_rows ORDER BY row_index LIMIT 100 OFFSET 0`; `payloads` retains the complete original response.

## Provider alternatives and validation

GWAS Catalog documents an [official MCP server](https://www.ebi.ac.uk/gwas/docs/programmatic-access/mcp-server/) and [pilot Hugging Face Parquet datasets](https://www.ebi.ac.uk/gwas/docs/programmatic-access/hugging-face/) for associations, studies and samples. Use `/snapshots/manifest` with `dataset: "studies"`, `"associations"` or `"samples"` to inspect native Hub metadata and commit-pinned file links. Pass the observed `repository_commit` back as `revision` for an exact revision check. Set `include_card: true` to retain the listed README text and its hash at that same commit. Each metadata/card read is bounded to 2 MiB and 15 seconds.

Repository modification dates are not scientific release dates. October 5 native files carry September 13 filenames while their cards still cite March 17; `data_release` remains null. Discovery does not verify Parquet checksums or contents. Independent October 5 qualification downloaded all three pinned files, verified their advertised LFS SHA-256 values, and read all 1,721,113 rows with PyArrow. Parquet p-values are native doubles: 6,275 association values are stored as zero, and the original decimal spelling cannot be recovered. These snapshots are distinct from the string-preserving summary-statistics previews.

October 5 local Worker acceptance recovers 2,000 submitted/harmonised preview rows and all 25,000 cells against independent gzip reads, with exact metadata text and citation/hash checks. The official MCP's three read-only tools respond; sampled results match REST pagination but transform/select fields (for example, an empty association description becomes null). Our REST path preserves the native envelope. These observations do not establish dataset-wide equivalence. Full compressed checksum verification and ingestion of the large summary-statistics files remain outside the bounded preview path. See the [dated review](../../docs/audits/2026-10-05-gwas-review.md) for commits, schemas, comparisons and verification. Changes remain undeployed.

## Development

### Complete local summary-statistics imports

The standard-library Python 3.9+ companion importer creates a local SQLite artifact from a complete downloaded TSV/CSV (plain, gzip or BGZF). Select the exact URL and matching YAML/checksum files through `/sumstats/files` and `/sumstats/metadata`, then download them using your normal file client. A preview or truncated download cannot be substituted for the complete artifact.

The [October 5 bulk review](../../docs/audits/2026-10-05-gwas-bulk-review.md) verifies complete submitted/harmonised files and all 26,976,312 imported rows against an independent reader, covering 336,201,456 cells. The example's two assemblies and source representations remain separate.

```bash
python3 servers/gwas-catalog-mcp-server/scripts/import_distribution.py \
  --file GCST90270927.h.tsv.gz \
  --source-url https://ftp.ebi.ac.uk/pub/databases/gwas/summary_statistics/GCST90270001-GCST90271000/GCST90270927/harmonised/GCST90270927.h.tsv.gz \
  --format tsv \
  --expected-md5 626236ce860855cc8d3998fe4357a750 \
  --metadata GCST90270927.h.tsv.gz-meta.yaml \
  --metadata md5sum.txt \
  --output gwas-harmonised.sqlite
```

That checksum identifies the October 5 observed example; obtain the matching current source checksum when selecting another file/version. `--expected-sha256` is also supported; all supplied hashes must match. The importer performs no network requests or YAML execution. It preserves the caller-supplied URL as provenance, without asserting a fresh remote observation.

Every source cell is a string inside `records.native_json`; `columns` maps its zero-based array positions to the exact header names. `provenance` retains complete-file hashes, decoded-text hash, counts, and accompanying metadata text/hashes. For example, inspect `SELECT * FROM columns ORDER BY column_index`, then use `SELECT row_index, native_json FROM records ORDER BY row_index LIMIT 100`. SQLite `json_extract` returns the original string values; applying numeric casts is an explicit analysis decision.

Publication is atomic and never overwrites an existing output. EOF, gzip integrity, row shape, supplied checksums and SQLite integrity must all pass before the destination file appears. Defaults bound compressed input to 1 GiB, decoded input to 16 GiB, rows to 50 million and elapsed time to 1,200 seconds; named CLI options adjust those bounds. Each logical CSV record is limited to 2 MiB characters, and insertion batches are bounded. This is structural ingestion: it does not validate scientific models, infer assembly/coordinate conventions, combine submitted and harmonised records, or certify evolving CNV/gene-based schemas.

Run its tests with `pnpm --filter gwas-catalog-mcp-server run test:bulk`; the package's standard test command includes them.

### Worker development

```bash
./scripts/dev-servers.sh gwas-catalog            # run locally (port 8833)
pnpm --filter gwas-catalog-mcp-server run deploy   # deploy to Cloudflare Workers
```

See [`docs/adding-mcp-servers.md`](../../docs/adding-mcp-servers.md) and the root [README](../../README.md) for the full architecture (Code Mode, staging, portals).

<!-- license-and-data-terms:start -->
## License and data terms

The code in this repository is licensed under the Apache License 2.0 (see `LICENSE`).
If you use it in your work, please cite it (see `CITATION.cff`). Citation is requested, not required.

The license covers the code only. Data that this server returns comes from GWAS Catalog + PGS Catalog and stays under the terms of that source: EMBL-EBI terms; summary stats CC0 unless stated.
You are responsible for your use of the data under those terms.
<!-- license-and-data-terms:end -->
