/**
 * GwasDataDO — Durable Object for staging large GWAS Catalog v2 + PGS Catalog responses.
 *
 * Extends RestStagingDO with schema hints for studies, associations,
 * SNPs, genes, traits, publications, ancestries, genomic contexts,
 * loci, body-of-works, unpublished studies from the EBI GWAS Catalog API v2,
 * and polygenic scores, performance metrics, publications, and traits from
 * the PGS Catalog API.
 *
 * GWAS v2 response format: HAL+JSON with `_embedded.{type}` collections.
 * PGS response format: `{ count, next, previous, results: [...] }`.
 */

import { RestStagingDO } from "@bio-mcp/shared/staging/rest-staging-do";
import type { SchemaHints } from "@bio-mcp/shared/staging/schema-inference";

export class GwasDataDO extends RestStagingDO {
    protected getSchemaHints(data: unknown): SchemaHints | undefined {
        if (!data || typeof data !== "object") return undefined;

        const obj = data as Record<string, unknown>;

        // HAL-style responses wrap collections in _embedded
        const embedded = obj._embedded as Record<string, unknown> | undefined;

        // Studies: { _embedded: { studies: [...] } }
        if (embedded && Array.isArray(embedded.studies)) {
            return {
                tableName: "studies",
                indexes: [
                    "accession_id",
                    "pubmed_id",
                    "disease_trait",
                    "snp_count",
                ],
            };
        }

        // Associations: { _embedded: { associations: [...] } }
        if (embedded && Array.isArray(embedded.associations)) {
            return {
                tableName: "associations",
                indexes: [
                    "association_id",
                    "pvalue_mantissa",
                    "pvalue_exponent",
                    "p_value",
                    "risk_frequency",
                    "or_per_copy_num",
                    "beta_num",
                    "accession_id",
                ],
            };
        }

        // SNPs: { _embedded: { snps: [...] } }
        if (embedded && Array.isArray(embedded.snps)) {
            return {
                tableName: "snps",
                indexes: [
                    "rs_id",
                    "functional_class",
                    "merged",
                    "maf",
                    "most_severe_consequence",
                ],
            };
        }

        // EFO Traits: { _embedded: { efo_traits: [...] } }
        if (embedded && Array.isArray(embedded.efo_traits)) {
            return {
                tableName: "efo_traits",
                indexes: [
                    "efo_id",
                    "efo_trait",
                    "uri",
                ],
            };
        }

        // Publications: { _embedded: { publications: [...] } }
        if (embedded && Array.isArray(embedded.publications)) {
            return {
                tableName: "publications",
                indexes: [
                    "pubmed_id",
                    "publication_date",
                    "journal",
                    "title",
                ],
            };
        }

        // Genes: { _embedded: { genes: [...] } }
        if (embedded && Array.isArray(embedded.genes)) {
            return {
                tableName: "genes",
                indexes: [
                    "gene_name",
                    "biotype",
                    "cytogenic_region",
                ],
            };
        }

        // Ancestries: { _embedded: { ancestries: [...] } }
        if (embedded && Array.isArray(embedded.ancestries)) {
            return {
                tableName: "ancestries",
                indexes: [
                    "type",
                    "number_of_individuals",
                ],
            };
        }

        // Genomic Contexts: { _embedded: { genomic_contexts: [...] } }
        if (embedded && Array.isArray(embedded.genomic_contexts)) {
            return {
                tableName: "genomic_contexts",
                indexes: [
                    "distance",
                    "is_intergenic",
                    "is_closest_gene",
                    "source",
                ],
            };
        }

        // Loci: { _embedded: { loci: [...] } }
        if (embedded && Array.isArray(embedded.loci)) {
            return {
                tableName: "loci",
                indexes: [
                    "haplotype_snp_count",
                ],
            };
        }

        // Body of Works: { _embedded: { body_of_works: [...] } }
        if (embedded && Array.isArray(embedded.body_of_works)) {
            return {
                tableName: "body_of_works",
                indexes: [
                    "gcp_id",
                    "title",
                    "first_author",
                ],
            };
        }

        // Unpublished Studies: { _embedded: { unpublished_studies: [...] } }
        if (embedded && Array.isArray(embedded.unpublished_studies)) {
            return {
                tableName: "unpublished_studies",
                indexes: [
                    "study_accession",
                    "disease_trait",
                    "genotyping_technology",
                ],
            };
        }

        // Unpublished Ancestries: { _embedded: { unpublished_ancestries: [...] } }
        if (embedded && Array.isArray(embedded.unpublished_ancestries)) {
            return {
                tableName: "unpublished_ancestries",
                indexes: [
                    "stage",
                    "ancestry_category",
                    "sample_size",
                ],
            };
        }

        // --- PGS Catalog responses (results array, not _embedded) ---

        // PGS paginated responses: { count, next, previous, results: [...] }
        if (Array.isArray(obj.results) && typeof obj.count === "number") {
            const first = (obj.results as unknown[])[0];
            if (first && typeof first === "object") {
                const f = first as Record<string, unknown>;

                // PGS Scores: results contain id starting with "PGS"
                if (typeof f.id === "string" && (f.id as string).startsWith("PGS")) {
                    return {
                        tableName: "pgs_scores",
                        indexes: [
                            "id",
                            "name",
                            "variants_number",
                            "trait_reported",
                        ],
                    };
                }

                // PGS Performance metrics: results contain id starting with "PPM"
                if (typeof f.id === "string" && (f.id as string).startsWith("PPM")) {
                    return {
                        tableName: "pgs_performance",
                        indexes: [
                            "id",
                            "associated_pgs_id",
                            "phenotyping_reported",
                            "publication",
                        ],
                    };
                }

                // PGS Publications: results contain id starting with "PGP"
                if (typeof f.id === "string" && (f.id as string).startsWith("PGP")) {
                    return {
                        tableName: "pgs_publications",
                        indexes: [
                            "id",
                            "title",
                            "doi",
                            "PMID",
                        ],
                    };
                }

                // PGS Traits: results have id as EFO ID (e.g. EFO_0001645)
                if (typeof f.id === "string" && (f.id as string).includes("_") && typeof f.label === "string") {
                    return {
                        tableName: "pgs_traits",
                        indexes: [
                            "id",
                            "label",
                            "description",
                            "categories",
                        ],
                    };
                }
            }
        }

        // Single PGS score (has id starting with PGS and variants_number)
        if (typeof obj.id === "string" && (obj.id as string).startsWith("PGS") && obj.variants_number !== undefined) {
            return {
                tableName: "pgs_score",
                indexes: ["id", "name", "variants_number"],
            };
        }

        // Single PGS publication (has id starting with PGP)
        if (typeof obj.id === "string" && (obj.id as string).startsWith("PGP") && typeof obj.title === "string") {
            return {
                tableName: "pgs_publication",
                indexes: ["id", "title", "doi"],
            };
        }

        // --- Single resource detection (no _embedded wrapper) ---

        // Single study (has accession_id and disease_trait)
        if (typeof obj.accession_id === "string" && typeof obj.disease_trait === "string") {
            return {
                tableName: "study",
                indexes: ["accession_id", "pubmed_id"],
            };
        }

        // Single association (has pvalue_mantissa and pvalue_exponent)
        if (
            obj.pvalue_mantissa !== undefined &&
            obj.pvalue_exponent !== undefined
        ) {
            return {
                tableName: "association",
                indexes: ["association_id", "p_value", "risk_frequency"],
            };
        }

        // Single SNP (has rs_id and functional_class)
        if (typeof obj.rs_id === "string" && obj.functional_class !== undefined) {
            return {
                tableName: "snp",
                indexes: ["rs_id", "functional_class"],
            };
        }

        // Single publication (has pubmed_id and journal)
        if (typeof obj.pubmed_id === "string" && typeof obj.journal === "string") {
            return {
                tableName: "publication",
                indexes: ["pubmed_id"],
            };
        }

        // Single gene (has gene_name and biotype)
        if (typeof obj.gene_name === "string" && typeof obj.biotype === "string") {
            return {
                tableName: "gene",
                indexes: ["gene_name"],
            };
        }

        return undefined;
    }
}
