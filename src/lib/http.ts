/**
 * GWAS Catalog REST API HTTP client.
 *
 * Uses restFetch from @bio-mcp/shared with retry on 429/500/502/503.
 * The EBI GWAS Catalog API returns HAL+JSON but also accepts application/json.
 */

import { restFetch, type RestFetchOptions } from "@bio-mcp/shared/http/rest-fetch";

const GWAS_BASE_URL = "https://www.ebi.ac.uk/gwas/rest/api";

export interface GwasFetchOptions extends Omit<RestFetchOptions, "retryOn"> {
    /** Override base URL */
    baseUrl?: string;
}

/**
 * Fetch from the EBI GWAS Catalog REST API.
 *
 * Handles rate limiting (429) and transient server errors with retries.
 * Requests application/json to get standard JSON (API also supports HAL+JSON).
 */
export async function gwasFetch(
    path: string,
    params?: Record<string, unknown>,
    opts?: GwasFetchOptions,
): Promise<Response> {
    const baseUrl = opts?.baseUrl ?? GWAS_BASE_URL;
    const headers: Record<string, string> = {
        Accept: "application/json",
        ...(opts?.headers ?? {}),
    };

    return restFetch(baseUrl, path, params, {
        ...opts,
        headers,
        retryOn: [429, 500, 502, 503],
        retries: opts?.retries ?? 3,
        timeout: opts?.timeout ?? 30_000,
        userAgent:
            "gwas-catalog-mcp-server/1.0 (bio-mcp; https://github.com/QuentinCody/gwas-catalog-mcp-server)",
    });
}
