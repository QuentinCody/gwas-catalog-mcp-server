/**
 * EBI GWAS Catalog REST API v2 + PGS Catalog REST API catalog
 *
 * GWAS Catalog: built from the OpenAPI 3.0 spec at
 * https://www.ebi.ac.uk/gwas/rest/api/v2/rest-api-doc.yaml
 *
 * PGS Catalog: Polygenic Score Catalog REST API at
 * https://www.pgscatalog.org/rest/
 *
 * Covers 35 endpoints across 11 categories: studies, associations, SNPs,
 * genes, EFO traits, publications, ancestries, genomic contexts, loci,
 * body-of-works, unpublished studies, and PGS (polygenic scores).
 *
 * GWAS v2 key differences from v1:
 *   - All paths prefixed with /v2/
 *   - Search endpoints removed — use query params on collection endpoints
 *   - Collections still in `_embedded.{resourceType}` (HAL+JSON)
 *   - Embedded keys changed: `snps` (not singleNucleotidePolymorphisms),
 *     `efo_traits` (not efoTraits), `genomic_contexts`, `publications`, etc.
 *   - Pagination via `page` object: `{ size, totalElements, totalPages, number }`
 *   - Sort uses separate `sort` (enum) + `direction` (asc|desc) params
 *   - Parameters use snake_case (pubmed_id, accession_id, rs_id, etc.)
 *   - Rate limit: 15 queries/second
 *
 * PGS Catalog endpoints use /pgs/* prefix in this catalog, which the adapter
 * routes to https://www.pgscatalog.org/rest/. PGS pagination uses limit/offset.
 */

import type { ApiCatalog } from "@bio-mcp/shared/codemode/catalog";

export const gwasCatalog: ApiCatalog = {
    name: "EBI GWAS Catalog + PGS Catalog REST API",
    baseUrl: "https://www.ebi.ac.uk/gwas/rest/api",
    version: "2.0",
    auth: "none",
    endpointCount: 35,
    notes:
        "- HAL+JSON response format: collections are in `_embedded.{resourceType}` (e.g. `_embedded.studies`, `_embedded.snps`, `_embedded.associations`)\n" +
        "- Pagination: `page` (0-indexed), `size` (default 20). Sort uses separate `sort` and `direction` params.\n" +
        "- Page metadata in `page` object: `{ size, totalElements, totalPages, number }`\n" +
        "- Navigation links in `_links`: `self`, `next`, `prev`, `first`, `last`\n" +
        "- Study accession IDs follow pattern GCST + digits (e.g. GCST000854, GCST90000001)\n" +
        "- SNP rsIDs must include the 'rs' prefix (e.g. rs7329174, rs3093017)\n" +
        "- EFO trait IDs use underscores (e.g. EFO_0000305, MONDO_0005180)\n" +
        "- Association p-values: mantissa + exponent (e.g. mantissa=3, exponent=-18 means 3e-18). Also has computed `p_value` field.\n" +
        "- No authentication required — fully open access\n" +
        "- Rate limit: 15 queries/second. Add 200ms delay between requests in loops.\n" +
        "- Common query pattern: find studies by trait/pubmed_id -> get associations for study -> look up SNP details\n" +
        "- Single-resource endpoints return the resource object directly (not wrapped in _embedded)\n" +
        "- Non-paginated sub-resource collections (ancestries, genomic-contexts, loci) wrap in `_embedded` but have no `page` object\n" +
        "- v1 is deprecated and will be retired no later than May 2026\n" +
        "- Some endpoints (genes/{name}, metadata) may return 500 intermittently\n" +
        "- PGS Catalog endpoints (/pgs/*): polygenic risk scores, performance evaluations, traits — proxied to pgscatalog.org/rest/\n" +
        "- PGS pagination uses `limit` (default 100) and `offset` (default 0) — NOT page/size\n" +
        "- PGS IDs follow patterns: PGS000001 (scores), PGP000001 (publications), PPM000001 (performance metrics), PSS000001 (sample sets)\n" +
        "- PGS responses wrap results in `results` array with `count`, `next`, `previous` pagination fields\n" +
        "- PGS performance metrics include: AUC, OR, HR, beta, C-index — reported per ancestry group\n" +
        "- PGS trait IDs use EFO ontology (e.g. EFO_0001645 for coronary heart disease)\n" +
        "- 5,296+ published polygenic scores and growing\n" +
        "- Common PGS workflow: search traits → find scores for trait → get performance metrics → check publication details",
    endpoints: [
        // === Studies ===
        {
            method: "GET",
            path: "/v2/studies",
            summary:
                "Search/list GWAS studies with rich filtering. Filter by trait, gene, PubMed ID, EFO ID, ancestry, cohort, and more. Returns _embedded.studies array with pagination.",
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
                "Get all ancestries for a study. Each entry describes the ancestral background of participants (type, number_of_individuals, ancestral_groups, countries). Returns _embedded.ancestries array (non-paginated).",
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

        // === Associations ===
        {
            method: "GET",
            path: "/v2/associations",
            summary:
                "Search/list variant-trait associations with rich filtering. Filter by study, SNP, trait, gene, PubMed ID. Each association links a SNP to a trait with p-value, odds ratio, and effect size. Returns _embedded.associations array with pagination.",
            category: "associations",
            queryParams: [
                {
                    name: "accession_id",
                    type: "string",
                    required: false,
                    description:
                        "Filter by study accession ID (e.g. GCST000854)",
                },
                {
                    name: "rs_id",
                    type: "string",
                    required: false,
                    description:
                        "Filter by SNP rsID (e.g. rs3093017)",
                },
                {
                    name: "pubmed_id",
                    type: "string",
                    required: false,
                    description: "Filter by PubMed ID (e.g. 35241825)",
                },
                {
                    name: "efo_trait",
                    type: "string",
                    required: false,
                    description:
                        "Filter by EFO trait name/label (e.g. 'celiac disease')",
                },
                {
                    name: "efo_id",
                    type: "string",
                    required: false,
                    description:
                        "Filter by EFO trait URI shortform (e.g. EFO_0001060)",
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
                        "Show extended matching genes in addition to mapped genes",
                },
                {
                    name: "show_child_trait",
                    type: "boolean",
                    required: false,
                    description:
                        "Include associations for descendant EFO trait terms",
                },
                {
                    name: "full_pvalue_set",
                    type: "boolean",
                    required: false,
                    description:
                        "Whether full summary statistics are available",
                },
                {
                    name: "sort",
                    type: "string",
                    required: false,
                    description:
                        "Sort field: 'p_value', 'risk_frequency', 'or_value', or 'beta_num'",
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
            path: "/v2/associations/{association_id}",
            summary:
                "Get a specific association by ID. Returns association details including p-value (mantissa + exponent + computed), odds ratio, beta coefficient, risk frequency, CI, mapped genes, SNP alleles, EFO traits, and links.",
            category: "associations",
            pathParams: [
                {
                    name: "association_id",
                    type: "string",
                    required: true,
                    description: "Association ID (e.g. 169106883)",
                },
            ],
        },

        // === Loci (sub-resource of associations) ===
        {
            method: "GET",
            path: "/v2/associations/{association_id}/loci",
            summary:
                "Get all loci for an association. Each locus contains the strongest risk alleles, haplotype SNP count, and author-reported genes. Returns _embedded.loci array (non-paginated).",
            category: "loci",
            pathParams: [
                {
                    name: "association_id",
                    type: "string",
                    required: true,
                    description: "Association ID (e.g. 169106883)",
                },
            ],
        },
        {
            method: "GET",
            path: "/v2/associations/{association_id}/loci/{locus_id}",
            summary: "Get a single locus for an association.",
            category: "loci",
            pathParams: [
                {
                    name: "association_id",
                    type: "string",
                    required: true,
                    description: "Association ID",
                },
                {
                    name: "locus_id",
                    type: "string",
                    required: true,
                    description: "Locus ID (e.g. 169106882)",
                },
            ],
        },

        // === SNPs (Single Nucleotide Polymorphisms) ===
        {
            method: "GET",
            path: "/v2/single-nucleotide-polymorphisms",
            summary:
                "Search/list SNPs with filtering. Filter by rsID, genomic region (chromosome + bp_start/bp_end), PubMed ID, or mapped gene. Returns _embedded.snps array with pagination.",
            category: "snps",
            queryParams: [
                {
                    name: "rs_id",
                    type: "string",
                    required: false,
                    description:
                        "SNP rsID (e.g. rs3093017). If haplotype, may include multiple rs numbers.",
                },
                {
                    name: "chromosome",
                    type: "string",
                    required: false,
                    description:
                        "Chromosome number (e.g. 6, 13). Use with bp_start and bp_end for region search.",
                },
                {
                    name: "bp_start",
                    type: "number",
                    required: false,
                    description:
                        "Start base pair position for region search (use with chromosome and bp_end)",
                },
                {
                    name: "bp_end",
                    type: "number",
                    required: false,
                    description:
                        "End base pair position for region search (use with chromosome and bp_start)",
                },
                {
                    name: "bp_location",
                    type: "number",
                    required: false,
                    description:
                        "Exact base pair location to search",
                },
                {
                    name: "pubmed_id",
                    type: "string",
                    required: false,
                    description: "Filter by PubMed ID (e.g. 35241825)",
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
                        "Show extended matching genes in addition to mapped genes",
                },
                {
                    name: "sort",
                    type: "string",
                    required: false,
                    description: "Sort field: 'location' or 'rs_id'",
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
            path: "/v2/single-nucleotide-polymorphisms/{rs_id}",
            summary:
                "Get a specific SNP by rsID. Returns details including functional class, genomic locations, MAF, minor allele, alleles, most severe consequence, mapped genes, and merge status.",
            category: "snps",
            pathParams: [
                {
                    name: "rs_id",
                    type: "string",
                    required: true,
                    description:
                        "SNP rsID including 'rs' prefix (e.g. rs3093017, rs7329174)",
                },
            ],
        },

        // === Genomic Contexts (sub-resource of SNPs) ===
        {
            method: "GET",
            path: "/v2/single-nucleotide-polymorphisms/{rs_id}/genomic-contexts",
            summary:
                "Get all genomic contexts for a SNP. Shows nearby genes with distances, intergenic/upstream/downstream flags, closest gene annotation, and mapping source. Returns _embedded.genomic_contexts array (non-paginated).",
            category: "genomic-contexts",
            pathParams: [
                {
                    name: "rs_id",
                    type: "string",
                    required: true,
                    description: "SNP rsID (e.g. rs3093017)",
                },
            ],
            queryParams: [
                {
                    name: "sort",
                    type: "string",
                    required: false,
                    description: "Sort field: 'distance'",
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
            path: "/v2/single-nucleotide-polymorphisms/{rs_id}/genomic-contexts/{genomicContext_id}",
            summary: "Get a single genomic context for a SNP.",
            category: "genomic-contexts",
            pathParams: [
                {
                    name: "rs_id",
                    type: "string",
                    required: true,
                    description: "SNP rsID",
                },
                {
                    name: "genomicContext_id",
                    type: "string",
                    required: true,
                    description: "Genomic context ID (e.g. 182748715)",
                },
            ],
        },

        // === Genes ===
        {
            method: "GET",
            path: "/v2/genes",
            summary:
                "List all genes in the GWAS Catalog. Returns _embedded.genes array with pagination. Each gene has name, description, location, cytogenetic region, biotype, and Ensembl/Entrez IDs.",
            category: "genes",
            queryParams: [
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
                {
                    name: "sort",
                    type: "string",
                    required: false,
                    description:
                        "Sort criteria in format 'property,direction' (e.g. 'id,DESC')",
                },
            ],
        },
        {
            method: "GET",
            path: "/v2/genes/{gene_name}",
            summary:
                "Get a specific gene by name. Returns gene details including description, location, cytogenetic region, biotype, and Ensembl/Entrez gene IDs. NOTE: This endpoint may return 500 intermittently.",
            category: "genes",
            pathParams: [
                {
                    name: "gene_name",
                    type: "string",
                    required: true,
                    description:
                        "Gene name / official gene symbol (e.g. HBS1L, BRCA1, TP53)",
                },
            ],
        },

        // === EFO Traits ===
        {
            method: "GET",
            path: "/v2/efo-traits",
            summary:
                "Search/list EFO (Experimental Factor Ontology) traits with filtering. Filter by trait name, EFO ID, URI, PubMed ID, or mapped gene. Returns _embedded.efo_traits array with pagination.",
            category: "traits",
            queryParams: [
                {
                    name: "efo_trait",
                    type: "string",
                    required: false,
                    description:
                        "Trait name/label to search (e.g. 'celiac disease', 'diabetes')",
                },
                {
                    name: "efo_id",
                    type: "string",
                    required: false,
                    description:
                        "EFO trait URI shortform (e.g. EFO_0001060, MONDO_0005180)",
                },
                {
                    name: "uri",
                    type: "string",
                    required: false,
                    description:
                        "Full trait URI (e.g. http://www.ebi.ac.uk/efo/EFO_0001060)",
                },
                {
                    name: "pubmed_id",
                    type: "string",
                    required: false,
                    description: "Filter by PubMed ID",
                },
                {
                    name: "mapped_gene",
                    type: "string",
                    required: false,
                    description: "Gene(s) overlapping the variant",
                },
                {
                    name: "extended_geneset",
                    type: "boolean",
                    required: false,
                    description: "Show extended matching genes",
                },
                {
                    name: "sort",
                    type: "string",
                    required: false,
                    description: "Sort field: 'efo_id' or 'efo_trait'",
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
                    description: "Page size (default 20, max 500)",
                },
            ],
        },
        {
            method: "GET",
            path: "/v2/efo-traits/{efo_id}",
            summary:
                "Get a specific EFO trait by its shortform ID. Returns trait name, URI, EFO ID, and links to associated studies.",
            category: "traits",
            pathParams: [
                {
                    name: "efo_id",
                    type: "string",
                    required: true,
                    description:
                        "EFO trait shortform ID (e.g. EFO_0009713, MONDO_0005180)",
                },
            ],
        },

        // === Publications ===
        {
            method: "GET",
            path: "/v2/publications",
            summary:
                "Search/list publications in the GWAS Catalog. Filter by PubMed ID, title, or first author. Returns _embedded.publications array with pagination. Each publication has authors, journal, title, and date.",
            category: "publications",
            queryParams: [
                {
                    name: "pubmed_id",
                    type: "string",
                    required: false,
                    description: "PubMed ID (e.g. 35241825)",
                },
                {
                    name: "title",
                    type: "string",
                    required: false,
                    description:
                        "Title text to search (e.g. 'Genome-wide association study')",
                },
                {
                    name: "first_author",
                    type: "string",
                    required: false,
                    description:
                        "Last name and initials of first author (e.g. 'Doe John')",
                },
                {
                    name: "sort",
                    type: "string",
                    required: false,
                    description:
                        "Sort field: 'pubmed_id' or 'publication_date'",
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
            path: "/v2/publications/{pubmed_id}",
            summary:
                "Get a specific publication by PubMed ID. Returns publication details including title, journal, date, and full author list with affiliations and ORCIDs.",
            category: "publications",
            pathParams: [
                {
                    name: "pubmed_id",
                    type: "string",
                    required: true,
                    description: "PubMed ID (e.g. 35241825)",
                },
            ],
        },

        // === Body of Works (preprints / unpublished submissions) ===
        {
            method: "GET",
            path: "/v2/body-of-works",
            summary:
                "List body of works (preprints/submissions not yet published in a journal). Filter by title or first author. Returns _embedded.body_of_works array with pagination.",
            category: "body-of-works",
            queryParams: [
                {
                    name: "title",
                    type: "string",
                    required: false,
                    description: "Title text to search",
                },
                {
                    name: "first_author",
                    type: "string",
                    required: false,
                    description: "First author name",
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
                {
                    name: "sort",
                    type: "string",
                    required: false,
                    description: "Sort criteria (e.g. 'id,DESC')",
                },
            ],
        },
        {
            method: "GET",
            path: "/v2/body-of-works/{bow_id}",
            summary:
                "Get a specific body of work by ID. Returns GCP ID, title, first author, publication date, DOI, and links.",
            category: "body-of-works",
            pathParams: [
                {
                    name: "bow_id",
                    type: "number",
                    required: true,
                    description: "Body of work ID (integer, e.g. 169062064)",
                },
            ],
        },
        {
            method: "GET",
            path: "/v2/body-of-works/{bow_id}/unpublished-studies",
            summary:
                "Get unpublished studies associated with a body of work. Returns _embedded.unpublished_studies array with pagination.",
            category: "body-of-works",
            pathParams: [
                {
                    name: "bow_id",
                    type: "number",
                    required: true,
                    description: "Body of work ID",
                },
            ],
            queryParams: [
                {
                    name: "page",
                    type: "number",
                    required: false,
                    description: "Page number (0-indexed)",
                },
                {
                    name: "size",
                    type: "number",
                    required: false,
                    description: "Page size (default 20)",
                },
                {
                    name: "sort",
                    type: "string",
                    required: false,
                    description: "Sort criteria",
                },
            ],
        },

        // === Unpublished Studies ===
        {
            method: "GET",
            path: "/v2/unpublished-studies",
            summary:
                "Search/list unpublished studies submitted to the GWAS Catalog. Filter by trait, accession, title, author, or cohort. Returns _embedded.unpublished_studies array with pagination.",
            category: "unpublished-studies",
            queryParams: [
                {
                    name: "disease_trait",
                    type: "string",
                    required: false,
                    description: "Trait description",
                },
                {
                    name: "accession_id",
                    type: "string",
                    required: false,
                    description: "Study accession ID (e.g. GCST90623790)",
                },
                {
                    name: "title",
                    type: "string",
                    required: false,
                    description: "Manuscript title text",
                },
                {
                    name: "first_author",
                    type: "string",
                    required: false,
                    description: "First author name",
                },
                {
                    name: "cohort",
                    type: "string",
                    required: false,
                    description: "Discovery stage cohort",
                },
                {
                    name: "sort",
                    type: "string",
                    required: false,
                    description:
                        "Sort field: 'study_accession' or 'variant_count'",
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
            path: "/v2/unpublished-studies/{accession_id}",
            summary:
                "Get a specific unpublished study by accession ID.",
            category: "unpublished-studies",
            pathParams: [
                {
                    name: "accession_id",
                    type: "string",
                    required: true,
                    description: "Study accession ID (e.g. GCST90623790)",
                },
            ],
        },
        {
            method: "GET",
            path: "/v2/unpublished-studies/{accession_id}/unpublished-ancestries",
            summary:
                "Get ancestries for an unpublished study. Returns sample sizes, cases, controls, ancestry categories, and country of recruitment. Returns _embedded.unpublished_ancestries array (non-paginated).",
            category: "unpublished-studies",
            pathParams: [
                {
                    name: "accession_id",
                    type: "string",
                    required: true,
                    description: "Study accession ID",
                },
            ],
            queryParams: [
                {
                    name: "sort",
                    type: "string",
                    required: false,
                    description:
                        "Sort field: 'sample_size', 'cases', or 'controls'",
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
            path: "/v2/unpublished-studies/{accession_id}/unpublished-ancestries/{ancestry_id}",
            summary:
                "Get a single unpublished ancestry record.",
            category: "unpublished-studies",
            pathParams: [
                {
                    name: "accession_id",
                    type: "string",
                    required: true,
                    description: "Study accession ID",
                },
                {
                    name: "ancestry_id",
                    type: "string",
                    required: true,
                    description: "Ancestry record ID",
                },
            ],
        },

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
    ],
};
