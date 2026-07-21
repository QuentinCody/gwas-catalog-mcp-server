/**
 * GWAS Catalog + PGS Catalog API adapter — multi-API routing for Code Mode.
 *
 * Routes:
 *   /pgs/* → https://www.pgscatalog.org/rest/ (PGS Catalog)
 *   everything else → gwasFetch (EBI GWAS Catalog REST API v2)
 *
 * Both APIs are read-only (GET only), open access, no auth required.
 */

import type { ApiFetchFn } from "@bio-mcp/shared/codemode/catalog";
import { gwasFetch } from "./http";

const PGS_BASE_URL = "https://www.pgscatalog.org/rest";

/**
 * Fetch from the PGS Catalog REST API.
 * Strips the /pgs prefix and forwards to pgscatalog.org/rest/.
 */
async function pgsFetch(
    path: string,
    params?: Record<string, unknown>,
): Promise<Response> {
    // Strip leading /pgs prefix → e.g. "/pgs/score/all" becomes "/score/all"
    const pgsPath = path.replace(/^\/pgs/, "");
    const url = new URL(`${PGS_BASE_URL}${pgsPath}`);

    if (params) {
        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== null && value !== "") {
                url.searchParams.set(key, String(value));
            }
        }
    }

    return fetch(url.toString(), {
        headers: { Accept: "application/json" },
    });
}

/**
 * Parse a Response into { status, data }, with error handling.
 */
async function parseResponse(response: Response): Promise<{ status: number; data: unknown }> {
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
}

/**
 * Valid `sort` fields per GWAS endpoint. EBI returns HTTP 500 (not 400) for an
 * unsupported sort, and the shared fetch retries a 500 ~4x (~7s) before it
 * surfaces. Kept here (not the catalog) because catalog.ts is over the line cap.
 * Extend as needed.
 */
const VALID_SORTS: Record<string, string[]> = {
    "/v2/studies": ["accession_Id", "snp_count"],
    "/v2/associations": ["p_value", "risk_frequency", "or_value", "beta_num"],
    "/v2/snps": ["location", "rs_id"],
};

/**
 * Throw a deterministic 400 when `params.sort` is a value the endpoint rejects
 * with a 500 (#4). Only endpoints listed in VALID_SORTS are enforced; anything
 * else passes through untouched.
 */
export function assertValidSort(
    path: string,
    params?: Record<string, unknown>,
): void {
    const sort = params?.sort;
    if (sort === undefined || sort === null || sort === "") return;
    const allowed = VALID_SORTS[path];
    if (allowed && !allowed.includes(String(sort))) {
        // SAFETY: augment a fresh Error with `status`, as parseResponse does above.
        const err = new Error(
            `sort '${sort}' is not supported on ${path}; valid sort fields: ${allowed.join(", ")}`,
        ) as Error & { status: number };
        err.status = 400;
        throw err;
    }
}

/**
 * Create an ApiFetchFn that routes /pgs/* to PGS Catalog and everything
 * else to the EBI GWAS Catalog REST API. No auth needed — both APIs are
 * publicly accessible.
 */
export function createGwasApiFetch(): ApiFetchFn {
    return async (request) => {
        const isPgs = request.path.startsWith("/pgs/") || request.path === "/pgs";
        if (!isPgs) assertValidSort(request.path, request.params);
        const response = isPgs
            ? await pgsFetch(request.path, request.params)
            : await gwasFetch(request.path, request.params);

        return parseResponse(response);
    };
}
