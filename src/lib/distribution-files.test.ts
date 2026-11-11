import { afterEach, expect, it, vi } from "vitest";
import { distributionManifest, listedFile, listingFiles, studyDirectory } from "./distribution-files";

afterEach(() => vi.unstubAllGlobals());

// GCST123456/bin example is published in the provider's summary-statistics access guide.
it.each([["GCST123456", "GCST123001-GCST124000"], ["GCST001000", "GCST000001-GCST001000"], ["GCST001001", "GCST001001-GCST002000"], ["GCST90270927", "GCST90270001-GCST90271000"]])("uses the documented 1000-study bins for %s", (id, bin) => {
  expect(studyDirectory(id)).toBe(`https://ftp.ebi.ac.uk/pub/databases/gwas/summary_statistics/${bin}/${id}/`);
});

it.each(["GCST000000", "123456", "GCST123456/../", "GCST123456?x=1"])("rejects invalid study accessions %s", id => {
  expect(() => studyDirectory(id)).toThrow();
});

it("keeps only direct study members and the supported harmonised subdirectory", () => {
  const base = studyDirectory("GCST123456");
  const listing = listingFiles('<a href="../">Parent</a><a href="a.tsv.gz">data</a><a href="a.tsv.gz">duplicate</a><a href="harmonised/">harmonised</a><a href="https://attacker.example/x.tsv">bad</a><a href="%2e%2e/secret">bad</a><a href="a%2fb.tsv">bad</a><a href="file.yaml?x=y">bad</a>', base, "submitted");
  expect(listing).toEqual({ files: [{ name: "a.tsv.gz", url: base + "a.tsv.gz", directory: "submitted" }], harmonised: true });
});

it("separates submitted and harmonised resources and hashes both listing observations", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response('<a href="submitted.tsv.gz">data</a><a href="harmonised/">harmonised</a>')).mockResolvedValueOnce(new Response('<a href="aligned.h.tsv.gz">data</a><a href="aligned.h.tsv.gz.tbi">index</a>')));
  const result = await distributionManifest("GCST123456");
  expect(result.files.map(file => [file.name, file.directory])).toEqual([["submitted.tsv.gz", "submitted"], ["aligned.h.tsv.gz", "harmonised"], ["aligned.h.tsv.gz.tbi", "harmonised"]]);
  expect(result.directories).toHaveLength(2); expect(result.includes_harmonised).toBe(true);
  expect(result.directories[0]).toHaveProperty("text_sha256"); expect(result.directories[0]).not.toHaveProperty("text");
});

it("retains safe Unicode and punctuation in native filenames without permitting encoded traversal", () => {
  const base = studyDirectory("GCST123456");
  expect(listingFiles('<a href="study%20%28%CE%B1%29.tsv">data</a><a href="%252e%252e%252fsecret">bad</a>', base, "submitted").files).toEqual([{ name: "study (α).tsv", url: base + "study%20%28%CE%B1%29.tsv", directory: "submitted" }]);
});

it("refuses a filename that the selected directory does not advertise", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('<a href="real.yaml">metadata</a>')); vi.stubGlobal("fetch", fetcher);
  await expect(listedFile("GCST123456", "submitted", "guessed.yaml")).rejects.toThrow("not advertised");
  expect(fetcher).toHaveBeenCalledTimes(1);
});
