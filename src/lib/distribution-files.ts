import { z } from "zod";
import { readDistribution, type DistributionRead } from "./distribution-http";

export const studyInput = z.string().regex(/^GCST[0-9]{6,12}$/).refine(value => BigInt(value.slice(4)) > 0n);
export const fileInput = z.string().min(1).max(255)
  .refine(value => !/[\/\\%]/.test(value) && value !== "." && value !== "..", "Use one literal filename, not an encoded path")
  .refine(value => [...value].every(char => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127), "Filename must not contain control characters");
export type DistributionDirectory = "submitted" | "harmonised";
export interface DistributionFile { name: string; url: string; directory: DistributionDirectory }

/** Provider-documented bins contain accessions 1000n+1 through 1000n+1000. */
export function studyDirectory(accession: string): string {
  const id = studyInput.parse(accession);
  const number = BigInt(id.slice(4));
  const lower = ((number - 1n) / 1000n) * 1000n + 1n;
  const format = (value: bigint) => "GCST" + value.toString().padStart(6, "0");
  return `https://ftp.ebi.ac.uk/pub/databases/gwas/summary_statistics/${format(lower)}-${format(lower + 999n)}/${id}/`;
}

export function listingFiles(text: string, base: string, directory: DistributionDirectory): { files: DistributionFile[]; harmonised: boolean } {
  const found = new Map<string, DistributionFile>();
  let harmonised = false;
  for (const match of text.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    let url: URL;
    try { url = new URL(match[1].replace(/&amp;/g, "&"), base); } catch { continue; }
    if (!url.href.startsWith(base) || url.search || url.hash || url.username || url.password) continue;
    const relative = url.href.slice(base.length);
    if (relative === "harmonised/") { harmonised = true; continue; }
    let name: string;
    try { name = decodeURIComponent(relative); } catch { continue; }
    if (!fileInput.safeParse(name).success) continue;
    found.set(name, { name, url: url.href, directory });
  }
  if (!found.size && !harmonised) throw new Error("GWAS distribution listing contains no recognized study files");
  return { files: [...found.values()], harmonised };
}

export interface DistributionManifest {
  accession: string;
  files: DistributionFile[];
  directories: Omit<DistributionRead, "text">[];
  includes_harmonised: boolean;
  scope: string;
}

export async function distributionManifest(accession: string, includeHarmonised = true): Promise<DistributionManifest> {
  const base = studyDirectory(accession);
  const root = await readDistribution(base);
  const listing = listingFiles(root.text, base, "submitted");
  const { text: _rootText, ...rootEvidence } = root;
  const result: DistributionManifest = { accession, files: listing.files, directories: [rootEvidence], includes_harmonised: false,
    scope: "Files advertised by current study directory listings; not an immutable release, not file checksums. Submitted and harmonised files are separate representations." };
  if (includeHarmonised && listing.harmonised) {
    const read = await readDistribution(base + "harmonised/");
    result.files.push(...listingFiles(read.text, base + "harmonised/", "harmonised").files);
    const { text: _text, ...evidence } = read;
    result.directories.push(evidence); result.includes_harmonised = true;
  }
  return result;
}

export async function listedFile(accession: string, directory: DistributionDirectory, name: string): Promise<DistributionFile> {
  fileInput.parse(name);
  const manifest = await distributionManifest(accession, directory === "harmonised");
  const file = manifest.files.find(item => item.directory === directory && item.name === name);
  if (!file) throw new Error("Requested file is not advertised in the selected study directory");
  return file;
}
