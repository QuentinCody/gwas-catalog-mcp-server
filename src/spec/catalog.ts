/**
 * EBI GWAS Catalog REST API v2 + PGS Catalog REST API catalog
 *
 * GWAS Catalog: built from the OpenAPI 3.0 spec at
 * https://www.ebi.ac.uk/gwas/rest/api/v2/rest-api-doc.yaml
 *
 * PGS Catalog: Polygenic Score Catalog REST API at
 * https://www.pgscatalog.org/rest/
 *
 * Covers REST/PGS and local distribution-file reads: studies, associations, SNPs,
 * genes, EFO traits, publications, ancestries, genomic contexts, loci,
 * body-of-works, unpublished studies, and PGS (polygenic scores).
 *
 * GWAS v2 key differences from v1:
 *   - All paths prefixed with /v2/
 *   - Search endpoints removed — use query params on collection endpoints
 *   - OpenAPI collections use `content` arrays and `links`; inspect native responses
 *     and retain compatibility with legacy `_embedded.{resourceType}` / `_links`.
 *   - Pagination via `page` object: `{ size, totalElements, totalPages, number }`
 *   - Sort uses separate `sort` (enum) + `direction` (asc|desc) params
 *   - Parameters use snake_case (pubmed_id, accession_id, rs_id, etc.)
 *   - Rate limit: 15 queries/second
 *
 * PGS Catalog endpoints use /pgs/* prefix in this catalog, which the adapter
 * routes to https://www.pgscatalog.org/rest/. PGS pagination uses limit/offset.
 */

import type { ApiCatalog } from "@bio-mcp/shared/codemode/catalog";
import { pgsEndpoints } from "./pgs";
import { distributionEndpoints, distributionWorkflows } from "./distributions";

import { catalogNotes } from "./catalog-notes";
import { studyEndpoints } from "./studies";
import { snapshotEndpoints, snapshotWorkflows } from "./snapshots";

export const gwasCatalog: ApiCatalog = {
    name: "EBI GWAS Catalog + PGS Catalog REST API",
    baseUrl: "https://www.ebi.ac.uk/gwas/rest/api",
    version: "2.0",
    auth: "none",
    endpointCount: 39,
    notes: catalogNotes,
    workflows: [...(distributionWorkflows ?? []), ...(snapshotWorkflows ?? [])],
    endpoints: [
        ...distributionEndpoints,
        ...snapshotEndpoints,
        ...studyEndpoints,
        // === Associations ===
        {
            method: "GET",
            path: "/v2/associations",
            summary:
                "Search/list variant-trait associations with rich filtering. Filter by study, SNP, trait, gene, PubMed ID. Each association links a SNP to a trait with p-value, odds ratio, and effect size. Returns a content array or HAL collection (_embedded.associations) with pagination.",
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
                "Get all loci for an association. Each locus contains the strongest risk alleles, haplotype SNP count, and author-reported genes. Returns a content array or HAL collection (_embedded.loci) (non-paginated).",
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
                "Search/list SNPs with filtering. Filter by rsID, genomic region (chromosome + bp_start/bp_end), PubMed ID, or mapped gene. Returns a content array or HAL collection (_embedded.snps) with pagination.",
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
                "Get all genomic contexts for a SNP. Shows nearby genes with distances, intergenic/upstream/downstream flags, closest gene annotation, and mapping source. Returns a content array or HAL collection (_embedded.genomic_contexts) (non-paginated).",
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
                "List all genes in the GWAS Catalog. Returns a content array or HAL collection (_embedded.genes) with pagination. Each gene has name, description, location, cytogenetic region, biotype, and Ensembl/Entrez IDs.",
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
                "Search/list EFO (Experimental Factor Ontology) traits with filtering. Filter by trait name, EFO ID, URI, PubMed ID, or mapped gene. Returns a content array or HAL collection (_embedded.efo_traits) with pagination.",
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
                "Search/list publications in the GWAS Catalog. Filter by PubMed ID, title, or first author. Returns a content array or HAL collection (_embedded.publications) with pagination. Each publication has authors, journal, title, and date.",
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
                "List body of works (preprints/submissions not yet published in a journal). Filter by title or first author. Returns a content array or HAL collection (_embedded.body_of_works) with pagination.",
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
                "Get unpublished studies associated with a body of work. Returns a content array or HAL collection (_embedded.unpublished_studies) with pagination.",
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
                "Search/list unpublished studies submitted to the GWAS Catalog. Filter by trait, accession, title, author, or cohort. Returns a content array or HAL collection (_embedded.unpublished_studies) with pagination.",
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
                "Get ancestries for an unpublished study. Returns sample sizes, cases, controls, ancestry categories, and country of recruitment. Returns a content array or HAL collection (_embedded.unpublished_ancestries) (non-paginated).",
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

        ...pgsEndpoints,
    ],
};
