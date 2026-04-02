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
 * Create an ApiFetchFn that routes /pgs/* to PGS Catalog and everything
 * else to the EBI GWAS Catalog REST API. No auth needed — both APIs are
 * publicly accessible.
 */
export function createGwasApiFetch(): ApiFetchFn {
    return async (request) => {
        const isPgs = request.path.startsWith("/pgs/") || request.path === "/pgs";
        const response = isPgs
            ? await pgsFetch(request.path, request.params)
            : await gwasFetch(request.path, request.params);

        return parseResponse(response);
    };
}
