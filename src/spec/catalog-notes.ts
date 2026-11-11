import { distributionNotes } from "./distributions";

export const catalogNotes =
        "- GWAS v2 OpenAPI schemas describe `content` arrays, while live v2 association responses also use HAL. Inspect the native response; HAL collections use `_embedded.{resourceType}` (e.g. `_embedded.studies`, `_embedded.snps`, `_embedded.associations`). Do not treat an unrecognized shape as an empty result.\n" +
        "- Pagination: `page` (0-indexed), `size` (default 20). Sort uses separate `sort` and `direction` params.\n" +
        "- Page metadata in `page` object: `{ size, totalElements, totalPages, number }`\n" +
        "- GWAS v2 OpenAPI schemas describe a `links` array; live HAL responses use `_links`. Inspect returned next links and `page` metadata; one page is not the full result set.\n" +
        "- Child-trait filtering uses singular `show_child_trait` on the wire. Live association checks on 2026-10-01 expanded asthma to childhood-onset asthma with true; plural `show_child_traits` did not change the sampled results.\n" +
        "- Study accession IDs follow pattern GCST + digits (e.g. GCST000854, GCST90000001)\n" +
        "- SNP rsIDs must include the 'rs' prefix (e.g. rs7329174, rs3093017)\n" +
        "- EFO trait IDs use underscores (e.g. EFO_0000305, MONDO_0005180)\n" +
        "- Association p-values: mantissa + exponent (e.g. mantissa=3, exponent=-18 means 3e-18). Also has computed `p_value` field.\n" +
        "- No authentication required — fully open access\n" +
        "- GWAS REST limits: 100 requests/minute and 15 requests/second per IP. Pace loops for both limits; shared IP traffic also counts.\n" +
        "- Common query pattern: find studies by trait/pubmed_id -> get associations for study -> look up SNP details\n" +
        "- Single-resource endpoints return the resource object directly, without a collection wrapper\n" +
        "- Non-paginated sub-resource collections (ancestries, genomic-contexts, loci) use `content` arrays in the v2 OpenAPI schema (HAL responses: `_embedded`) without a `page` object\n" +
        "- REST v1 retired in August 2026; v2 is the supported REST version.\n" +
        "- Some endpoints (genes/{name}, metadata) may return 500 intermittently\n" +
        "- PGS Catalog endpoints (/pgs/*): polygenic risk scores, performance evaluations, traits — proxied to pgscatalog.org/rest/\n" +
        "- PGS pagination uses `limit` (default 100) and `offset` (default 0) — NOT page/size\n" +
        "- PGS IDs follow patterns: PGS000001 (scores), PGP000001 (publications), PPM000001 (performance metrics), PSS000001 (sample sets)\n" +
        "- PGS responses wrap results in `results` array with `count`, `next`, `previous` pagination fields\n" +
        "- PGS performance metrics include: AUC, OR, HR, beta, C-index — reported per ancestry group\n" +
        "- PGS trait IDs use EFO ontology (e.g. EFO_0001645 for coronary heart disease)\n" +
        "- Common PGS workflow: search traits → find scores for trait → get performance metrics → check publication details" + distributionNotes;
