/**
 * GWAS Catalog API adapter — wraps gwasFetch into the ApiFetchFn interface
 * for use by the Code Mode __api_proxy tool.
 *
 * All catalog paths are relative to https://www.ebi.ac.uk/gwas/rest/api
 * e.g. /studies, /studies/{studyId}, /singleNucleotidePolymorphisms/{rsId}
 *
 * The GWAS Catalog API is read-only (GET only), open access, no auth required.
 */

import type { ApiFetchFn } from "@bio-mcp/shared/codemode/catalog";
import { gwasFetch } from "./http";

/**
 * Create an ApiFetchFn that routes through the EBI GWAS Catalog REST API.
 * No auth needed — the API is publicly accessible.
 */
export function createGwasApiFetch(): ApiFetchFn {
    return async (request) => {
        const response = await gwasFetch(request.path, request.params);

        if (!response.ok) {
            let errorBody: string;
            try {
                errorBody = await response.text();
            } catch {
                errorBody = response.statusText;
            }
            const error = new Error(
                `HTTP ${response.status}: ${errorBody.slice(0, 200)}`,
            ) as Error & {
                status: number;
                data: unknown;
            };
            error.status = response.status;
            error.data = errorBody;
            throw error;
        }

        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("json")) {
            const text = await response.text();
            return { status: response.status, data: text };
        }

        const data = await response.json();
        return { status: response.status, data };
    };
}
