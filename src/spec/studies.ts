import type { ApiCatalog } from "@bio-mcp/shared/codemode/catalog";

export const studyEndpoints: ApiCatalog["endpoints"] = [
        // === Studies ===
        {
            method: "GET",
            path: "/v2/studies",
            summary:
                "Search/list GWAS studies with rich filtering. Filter by trait, gene, PubMed ID, EFO ID, ancestry, cohort, and more. Returns a content array or HAL collection (_embedded.studies) with pagination.",
            category: "studies",
            queryParams: [
                {
                    name: "pubmed_id",
                    type: "string",
                    required: false,
                    description: "PubMed ID of the publication (e.g. 35241825)",
                },
                {
                    name: "disease_trait",
                    type: "string",
                    required: false,
                    description:
                        "Free text description of the trait (e.g. 'Early-onset Parkinson's disease')",
                },
                {
                    name: "efo_id",
                    type: "string",
                    required: false,
                    description:
                        "EFO trait URI shortform (e.g. EFO_0001060)",
                },
                {
                    name: "efo_trait",
                    type: "string",
                    required: false,
                    description:
                        "EFO trait name/label (e.g. 'celiac disease')",
                },
                {
                    name: "accession_id",
                    type: "string",
                    required: false,
                    description:
                        "GWAS study accession ID (e.g. GCST000854)",
                },
                {
                    name: "mapped_gene",
                    type: "string",
                    required: false,
                    description:
                        "Gene(s) overlapping the variant (e.g. CCR6, HBS1L)",
                },
                {
                    name: "extended_geneset",
                    type: "boolean",
                    required: false,
                    description:
                        "Show extended matching genes in addition to mapped genes (default false)",
                },
                {
                    name: "cohort",
                    type: "string",
                    required: false,
                    description:
                        "Discovery stage cohort (e.g. BioImage, UKBB)",
                },
                {
                    name: "ancestral_group",
                    type: "string",
                    required: false,
                    description:
                        "Ancestry category group label (e.g. European, East Asian)",
                },
                {
                    name: "gxe",
                    type: "boolean",
                    required: false,
                    description:
                        "Filter for gene-environment interaction studies",
                },
                {
                    name: "full_pvalue_set",
                    type: "boolean",
                    required: false,
                    description:
                        "Whether full summary statistics are available",
                },
                {
                    name: "show_child_trait",
                    type: "boolean",
                    required: false,
                    description:
                        "Include studies for descendant EFO trait terms",
                },
                {
                    name: "no_of_individuals",
                    type: "number",
                    required: false,
                    description:
                        "Filter by number of individuals (e.g. 4390)",
                },
                {
                    name: "sort",
                    type: "string",
                    required: false,
                    description:
                        "Sort field: 'accession_Id' or 'snp_count'",
                },
                {
                    name: "direction",
                    type: "string",
                    required: false,
                    description: "Sort direction: 'asc' or 'desc'",
                },
                {
                    name: "page",
                    type: "number",
                    required: false,
                    description: "Page number (0-indexed, default 0)",
                },
                {
                    name: "size",
                    type: "number",
                    required: false,
                    description: "Page size (default 20)",
                },
            ],
        },
        {
            method: "GET",
            path: "/v2/studies/{accession_id}",
            summary:
                "Get a specific GWAS study by its accession ID. Returns study details including disease trait, sample sizes, publication info, EFO traits, genotyping technologies, and ancestry.",
            category: "studies",
            pathParams: [
                {
                    name: "accession_id",
                    type: "string",
                    required: true,
                    description:
                        "GWAS study accession ID (e.g. GCST000854, GCST90000001)",
                },
            ],
        },

        // === Ancestries (sub-resource of studies) ===
        {
            method: "GET",
            path: "/v2/studies/{accession_id}/ancestries",
            summary:
                "Get all ancestries for a study. Each entry describes the ancestral background of participants (type, number_of_individuals, ancestral_groups, countries). Returns a content array or HAL collection (_embedded.ancestries) (non-paginated).",
            category: "ancestries",
            pathParams: [
                {
                    name: "accession_id",
                    type: "string",
                    required: true,
                    description: "GWAS study accession ID (e.g. GCST000854)",
                },
            ],
            queryParams: [
                {
                    name: "sort",
                    type: "string",
                    required: false,
                    description: "Sort field: 'number_of_individuals'",
                },
                {
                    name: "direction",
                    type: "string",
                    required: false,
                    description: "Sort direction: 'asc' or 'desc'",
                },
            ],
        },
        {
            method: "GET",
            path: "/v2/studies/{accession_id}/ancestries/{ancestry_id}",
            summary:
                "Get a single ancestry record for a study.",
            category: "ancestries",
            pathParams: [
                {
                    name: "accession_id",
                    type: "string",
                    required: true,
                    description: "GWAS study accession ID",
                },
                {
                    name: "ancestry_id",
                    type: "string",
                    required: true,
                    description: "Primary identifier of ancestry (e.g. 7529)",
                },
            ],
        },

];
