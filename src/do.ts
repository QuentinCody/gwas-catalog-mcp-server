/**
 * GwasDataDO — Durable Object for staging large GWAS Catalog v2 responses.
 *
 * Extends RestStagingDO with schema hints for studies, associations,
 * SNPs, genes, traits, publications, ancestries, genomic contexts,
 * loci, body-of-works, and unpublished studies from the EBI GWAS Catalog API v2.
 *
 * v2 response format: HAL+JSON with `_embedded.{type}` collections.
 * Embedded keys use snake_case: `snps`, `efo_traits`, `genomic_contexts`, etc.
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
