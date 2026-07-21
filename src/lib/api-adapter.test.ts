import { describe, expect, it } from "vitest";
import { assertValidSort } from "./api-adapter";

// #4: EBI returns HTTP 500 (not 400) for an unsupported `sort`, and the shared
// fetch retries a 500 ~4x (~7s) before it surfaces. assertValidSort fails fast
// with a clean 400 before the upstream call.
describe("assertValidSort", () => {
    it("passes a valid sort for a known endpoint", () => {
        expect(() =>
            assertValidSort("/v2/studies", { sort: "snp_count" }),
        ).not.toThrow();
        expect(() =>
            assertValidSort("/v2/studies", { sort: "accession_Id" }),
        ).not.toThrow();
    });

    it("throws a 400 for an unsupported sort (e.g. association_count)", () => {
        let caught: (Error & { status?: number }) | undefined;
        try {
            assertValidSort("/v2/studies", { sort: "association_count" });
        } catch (e) {
            caught = e as Error & { status?: number };
        }
        expect(caught).toBeDefined();
        expect(caught?.status).toBe(400);
        expect(caught?.message).toMatch(/accession_Id, snp_count/);
    });

    it("is a no-op when sort is absent or the endpoint has no known sort set", () => {
        expect(() => assertValidSort("/v2/studies", {})).not.toThrow();
        expect(() => assertValidSort("/v2/studies", undefined)).not.toThrow();
        expect(() =>
            assertValidSort("/v2/genes", { sort: "anything" }),
        ).not.toThrow();
    });
});
