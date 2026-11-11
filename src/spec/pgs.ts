import type { ApiCatalog } from "@bio-mcp/shared/codemode/catalog";

export const pgsEndpoints: ApiCatalog["endpoints"] = [
        // === PGS Catalog (Polygenic Scores) ===
        {
            method: "GET",
            path: "/pgs/score/all",
            summary:
                "List all polygenic scores (paginated). Returns PGS IDs, trait names, variant counts, and publication references. Use limit/offset for pagination.",
            category: "pgs",
            queryParams: [
                {
                    name: "limit",
                    type: "number",
                    required: false,
                    description: "Number of results per page (default 100)",
                },
                {
                    name: "offset",
                    type: "number",
                    required: false,
                    description: "Starting position for pagination (default 0)",
                },
            ],
        },
        {
            method: "GET",
            path: "/pgs/score/search",
            summary:
                "Search polygenic scores by EFO trait ID. Returns matching PGS scores with variant counts, trait mappings, methods, and genome builds. Use trait/search first to find EFO IDs.",
            category: "pgs",
            queryParams: [
                {
                    name: "trait_id",
                    type: "string",
                    required: true,
                    description:
                        "EFO trait ID (e.g. EFO_0001645 for coronary heart disease, EFO_0000305 for breast cancer)",
                },
                {
                    name: "limit",
                    type: "number",
                    required: false,
                    description: "Number of results per page (default 100)",
                },
                {
                    name: "offset",
                    type: "number",
                    required: false,
                    description: "Starting position for pagination (default 0)",
                },
            ],
        },
        {
            method: "GET",
            path: "/pgs/score/{pgs_id}",
            summary:
                "Get polygenic score detail by PGS ID (e.g. PGS000001). Returns variant count, trait mapping (EFO), scoring method, genome build, publication, and performance metrics.",
            category: "pgs",
            pathParams: [
                {
                    name: "pgs_id",
                    type: "string",
                    required: true,
                    description:
                        "PGS score ID (e.g. PGS000001, PGS000018)",
                },
            ],
        },
        {
            method: "GET",
            path: "/pgs/trait/all",
            summary:
                "List all traits in the PGS Catalog (paginated). Returns EFO trait IDs, names, descriptions, categories, and counts of associated scores.",
            category: "pgs",
            queryParams: [
                {
                    name: "limit",
                    type: "number",
                    required: false,
                    description: "Number of results per page (default 100)",
                },
                {
                    name: "offset",
                    type: "number",
                    required: false,
                    description: "Starting position for pagination (default 0)",
                },
            ],
        },
        {
            method: "GET",
            path: "/pgs/trait/search",
            summary:
                "Search PGS Catalog by trait/disease name. Returns matching EFO traits with associated polygenic scores, descriptions, and mapped categories.",
            category: "pgs",
            queryParams: [
                {
                    name: "term",
                    type: "string",
                    required: true,
                    description:
                        "Trait or disease name to search (e.g. 'breast cancer', 'type 2 diabetes', 'coronary artery disease')",
                },
                {
                    name: "limit",
                    type: "number",
                    required: false,
                    description: "Number of results per page (default 100)",
                },
                {
                    name: "offset",
                    type: "number",
                    required: false,
                    description: "Starting position for pagination (default 0)",
                },
            ],
        },
        {
            method: "GET",
            path: "/pgs/trait/{trait_id}",
            summary:
                "Get trait details by EFO ID. Returns trait name, description, mapped categories, and list of associated polygenic scores.",
            category: "pgs",
            pathParams: [
                {
                    name: "trait_id",
                    type: "string",
                    required: true,
                    description:
                        "EFO trait ID (e.g. EFO_0001645, MONDO_0005180)",
                },
            ],
        },
        {
            method: "GET",
            path: "/pgs/performance/search",
            summary:
                "Search performance evaluations for polygenic scores. Returns evaluation metrics (AUROC, C-index, OR per SD, HR, beta, R2), sample demographics, ancestry breakdowns, and cohort details.",
            category: "pgs",
            queryParams: [
                {
                    name: "pgs_id",
                    type: "string",
                    required: false,
                    description:
                        "PGS score ID to get evaluations for (e.g. PGS000001). Preferred search parameter.",
                },
                {
                    name: "pgp_id",
                    type: "string",
                    required: false,
                    description:
                        "PGS publication ID (e.g. PGP000001). Alternative to pgs_id.",
                },
                {
                    name: "limit",
                    type: "number",
                    required: false,
                    description: "Number of results per page (default 100)",
                },
                {
                    name: "offset",
                    type: "number",
                    required: false,
                    description: "Starting position for pagination (default 0)",
                },
            ],
        },
        {
            method: "GET",
            path: "/pgs/publication/search",
            summary:
                "Search PGS Catalog publications. Filter by PGS score ID to find publications that developed or evaluated a score. Returns title, authors, journal, DOI, and associated PGS IDs.",
            category: "pgs",
            queryParams: [
                {
                    name: "pgs_id",
                    type: "string",
                    required: false,
                    description:
                        "PGS score ID to find publications for (e.g. PGS000001)",
                },
                {
                    name: "limit",
                    type: "number",
                    required: false,
                    description: "Number of results per page (default 100)",
                },
                {
                    name: "offset",
                    type: "number",
                    required: false,
                    description: "Starting position for pagination (default 0)",
                },
            ],
        },
        {
            method: "GET",
            path: "/pgs/publication/{pgp_id}",
            summary:
                "Get publication details by PGP ID. Returns title, authors, journal, DOI, PubMed ID, and list of associated PGS scores developed or evaluated in the publication.",
            category: "pgs",
            pathParams: [
                {
                    name: "pgp_id",
                    type: "string",
                    required: true,
                    description:
                        "PGS publication ID (e.g. PGP000001, PGP000119)",
                },
            ],
        },
        {
            method: "GET",
            path: "/pgs/sample_set/{pss_id}",
            summary:
                "Get sample set details by PSS ID. Returns sample demographics, ancestry composition, cohort names, and sample sizes used in PGS development or evaluation.",
            category: "pgs",
            pathParams: [
                {
                    name: "pss_id",
                    type: "string",
                    required: true,
                    description:
                        "PGS sample set ID (e.g. PSS000001, PSS000042)",
                },
            ],
        },
];
