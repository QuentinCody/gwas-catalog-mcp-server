/**
 * The commercial license profile for the GWAS Catalog + PGS Catalog adapter.
 *
 * License audit 2026-11-10: "Honor each study's usage license and each PGS
 * score's license in the server." A reselling caller sends
 * `licenseProfile: "commercial"`. `commercialDecision` then gives the rule for
 * the request before the adapter requests content.
 *
 * Curated catalog (`/v2/*`): served. "Other data in the GWAS Catalog can be
 * used under the EBI Services Terms of Use" (https://www.ebi.ac.uk/gwas/docs/faq),
 * and "EMBL-EBI itself places no additional restrictions on the use or
 * redistribution of the data available via its Data Resources and Tools other
 * than those provided by the original data owners"
 * (https://www.ebi.ac.uk/about/terms-of-use).
 *
 * Summary statistics (`/sumstats/*`): "released under the Creative Commons CC0
 * 1.0 Public Domain Dedication, unless otherwise specified on the individual
 * study page and summary statistics download page" (FAQ). But "Data submitted
 * before March 2021 remains under the EBI Terms of Use, which already allow
 * open reuse but are less explicit", and "A small number of datasets may have
 * other license terms". The API states the license of a study:
 * `terms_of_license` of `/v2/studies/{id}` ("Terms of use or license
 * associated with the full genome-wide summary statistics") and, for a study
 * that is not published, `agreed_to_cc0` of `/v2/unpublished-studies/{id}`.
 * The metadata YAML of a study does not state it (GCST90270927, 2026-11-10).
 * The content of a study file is served only for a license in
 * `OPEN_USAGE_LICENSES`. The file listing has no file content and is served.
 *
 * Snapshots (`/snapshots/manifest`): served. The route gives repository
 * metadata, file links and the dataset card of the curated catalog tables. It
 * reads no table data.
 *
 * PGS Catalog (`/pgs/*`): the catalog uses the EMBL-EBI terms of use, and "Some
 * PGS have specific terms, licenses, or restrictions (e.g. non-commercial use)
 * that we highlight in this field, if known" (https://www.pgscatalog.org/docs/,
 * the `license` field of a score). The REST API is metadata only: "The
 * variants are not distributed within this API" (https://www.pgscatalog.org/rest/).
 * The documented metadata routes are served, and each score record keeps its
 * `license` text. No route of this adapter gives score weights. A path that is
 * not a documented route is refused.
 *
 * Each other path is refused: its route and its terms are not confirmed.
 */

import { type ApiFetchFn, commercialUseRefusal } from "@bio-mcp/shared/codemode/catalog";
import { studyInput } from "./distribution-files";
import { gwasFetch } from "./http";

type GwasRequest = Parameters<ApiFetchFn>[0];
type Refusal = ReturnType<typeof commercialUseRefusal>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const GWAS_API = "https://www.ebi.ac.uk/gwas/rest/api";
export const CC0_URL = "https://creativecommons.org/publicdomain/zero/1.0/";

/**
 * The usage licenses that permit commercial use, as `openUsageLicense` compares
 * them: lower case, no scheme, no `www.`, no final slash. The comparison is
 * exact, so each other value is not open: a non-commercial license, free text,
 * and the EMBL-EBI terms of use. Those terms are not a license of the data
 * owner. They keep the restrictions "provided by the original data owners",
 * and the API does not state those restrictions for a study.
 */
export const OPEN_USAGE_LICENSES: ReadonlyMap<string, string> = new Map([
  ["creativecommons.org/publicdomain/zero/1.0", "CC0 1.0"],
  ["creativecommons.org/publicdomain/zero/1.0/legalcode", "CC0 1.0"],
  ["cc0", "CC0 1.0"],
  ["cc0 1.0", "CC0 1.0"],
  ["cc0-1.0", "CC0 1.0"],
  ["creativecommons.org/licenses/by/4.0", "CC BY 4.0"],
  ["creativecommons.org/licenses/by/4.0/legalcode", "CC BY 4.0"],
  ["cc by 4.0", "CC BY 4.0"],
  ["cc-by-4.0", "CC BY 4.0"],
]);
const OPEN_NAMES = [...new Set(OPEN_USAGE_LICENSES.values())].join(", ");

/** The name of the open license that `value` states. Undefined for each other value. */
export function openUsageLicense(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const key = value.trim().toLowerCase().replace(/^https?:\/\/(?:www\.)?/, "").replace(/\/+$/, "");
  return OPEN_USAGE_LICENSES.get(key);
}

export interface StudyLicense {
  /** The license that the API states for the study. Null: the API states none, or the read failed. */
  terms: string | null;
  /** The record that the adapter read last. */
  source: string;
  field: "terms_of_license" | "agreed_to_cc0";
}

/** The license of a served file, added to the response as `usage_license`. */
export interface UsageLicense extends StudyLicense {
  name: string;
  terms: string;
}

async function readRecord(path: string): Promise<{ status: number; record?: Record<string, unknown> }> {
  const response = await gwasFetch(path, undefined, { retries: 1, timeout: 10_000 });
  if (!response.ok) {
    void response.body?.cancel().catch(() => {}); /* fire and forget: the body of a failed read is not used */
    return { status: response.status };
  }
  const record: unknown = await response.json();
  return { status: response.status, record: isRecord(record) ? record : undefined };
}

/**
 * Read the usage license of a study from the GWAS Catalog API. The study
 * record is the source. Only when the API has no such study (HTTP 404) is the
 * unpublished-study record read. A record of another accession, a value that
 * is not text, and each failure give `terms: null`.
 */
export async function readStudyLicense(accession: string): Promise<StudyLicense> {
  const published: StudyLicense = { terms: null, source: `${GWAS_API}/v2/studies/${accession}`, field: "terms_of_license" };
  try {
    const study = await readRecord(`/v2/studies/${accession}`);
    if (study.status !== 404) {
      const terms = study.record?.accession_id === accession ? study.record.terms_of_license : undefined;
      return { ...published, terms: typeof terms === "string" && terms.trim() ? terms.trim() : null };
    }
    const submitted = await readRecord(`/v2/unpublished-studies/${accession}`);
    const agreed = submitted.record?.study_accession === accession && submitted.record.agreed_to_cc0 === true;
    return { terms: agreed ? CC0_URL : null, source: `${GWAS_API}/v2/unpublished-studies/${accession}`, field: "agreed_to_cc0" };
  } catch {
    return published;
  }
}

/** The part of a request path before its query or fragment. */
const pathOnly = (path: string) => path.replace(/[?#][\s\S]*$/, "");

/**
 * False when the upstream host resolves the path to a different one: a dot
 * segment (also `.%2e`), a backslash, a tab, a character that is not encoded.
 * Such a path can leave its route family. For example
 * `/.%2e/.%2e/.%2e/europepmc/...` is a different service on www.ebi.ac.uk.
 */
export function isCanonicalPath(path: string): boolean {
  if (!path.startsWith("/")) return false;
  try {
    return new URL(`https://upstream.invalid${path}`).pathname === pathOnly(path);
  } catch {
    return false;
  }
}

/** True for a `/sumstats/*` route that gives the content of a study file. Only the file listing does not. */
export function isStudyFileContentRequest(path: string): boolean {
  return path.startsWith("/sumstats/") && path !== "/sumstats/files";
}

/** The routes of the PGS Catalog REST API 1.8.6. Each gives metadata; none gives a scoring file. */
const PGS_METADATA_ROUTE =
  /^\/pgs\/(?:(?:score|trait|performance|publication|sample_set|cohort|release)\/[^/]+|trait_category\/all|info|api_versions|ancestry_categories|gwas\/get_score_ids\/[^/]+)\/?$/;

export function isPgsMetadataRoute(path: string): boolean {
  return PGS_METADATA_ROUTE.test(pathOnly(path));
}

/** True for a route of the curated GWAS Catalog REST API. */
export function isCuratedCatalogRoute(path: string): boolean {
  const route = pathOnly(path);
  return route === "/v2" || route.startsWith("/v2/");
}

export type CommercialDecision = { refusal: Refusal } | { usageLicense?: UsageLicense };

const refuse = (what: string, terms: string): CommercialDecision => ({ refusal: commercialUseRefusal(what, terms) });
const shown = (path: string) => JSON.stringify(path.slice(0, 200));

/** The study accession of a request, if the file routes accept it. */
function studyAccession(value: unknown): string | undefined {
  // The pattern comes first: `studyInput` throws on text after "GCST" that is not a number.
  if (typeof value !== "string" || !/^GCST[0-9]{6,12}$/.test(value)) return undefined;
  return studyInput.safeParse(value).success ? value : undefined;
}

async function studyFileDecision(params: GwasRequest["params"]): Promise<CommercialDecision> {
  const accession = studyAccession(params?.accession);
  if (!accession) {
    return refuse(
      "Summary statistics file content without a valid study accession",
      "the adapter reads the usage license of a study by its accession (GCST and digits). Give the `accession` parameter.",
    );
  }
  const license = await readStudyLicense(accession);
  const name = openUsageLicense(license.terms);
  if (name && license.terms) return { usageLicense: { ...license, name, terms: license.terms } };
  const stated = license.terms === null
    ? `the GWAS Catalog API states no usage license for the study (${license.source})`
    : `the usage license of the study is ${shown(license.terms)} (${license.field} of ${license.source})`;
  return refuse(
    `The summary statistics file content of study ${accession}`,
    `${stated}. The content is served only under an open license that permits commercial use (${OPEN_NAMES}). The study record (/v2/studies) and the file listing (/sumstats/files) stay available.`,
  );
}

/**
 * The rule for a request of a reselling caller: a refusal, or the permission
 * to serve it. The route families and their sequence are those of
 * `createGwasApiFetch`. No request for content is made here. For the content
 * of a study file, the study record is read first; the license of a served
 * file comes back as `usageLicense`.
 */
export async function commercialDecision(request: GwasRequest): Promise<CommercialDecision> {
  const { path } = request;
  if (!isCanonicalPath(path)) {
    return refuse(
      `The path ${shown(path)}`,
      "it is not in its canonical form (a dot segment, a backslash or a character that is not encoded), so its route and the terms of that route are not confirmed.",
    );
  }
  if (path.startsWith("/snapshots/")) return {};
  if (path.startsWith("/sumstats/")) return isStudyFileContentRequest(path) ? studyFileDecision(request.params) : {};
  if (path === "/pgs" || path.startsWith("/pgs/")) {
    if (isPgsMetadataRoute(path)) return {};
    return refuse(
      `The PGS Catalog path ${shown(path)}`,
      "it is not a documented metadata route of the PGS Catalog REST API. The license of a score applies to its scoring file, and this server gives no scoring file content. Use the /pgs/score, /pgs/trait, /pgs/performance, /pgs/publication and /pgs/sample_set routes.",
    );
  }
  if (isCuratedCatalogRoute(path)) return {};
  return refuse(
    `The path ${shown(path)}`,
    "it is not a route of the curated GWAS Catalog API (/v2/*), so its terms are not confirmed.",
  );
}

/** The value of `withheld` for a score record that came without license text. */
export const SCORE_WITHHELD =
  "The PGS Catalog gave no license text for this score. A score record is served only together with its license text.";

/** A PGS score record: the response of `/score/{id}`, or an item of `results` of `/score/all` and `/score/search`. */
function isScoreRecord(value: unknown): value is Record<string, unknown> & { id: string } {
  return isRecord(value) && typeof value.id === "string" && /^PGS\d+$/.test(value.id);
}

function licensedScore(record: unknown): unknown {
  if (!isScoreRecord(record)) return record;
  if (typeof record.license === "string" && record.license.trim() !== "") return record;
  return { id: record.id, license: null, withheld: SCORE_WITHHELD };
}

/**
 * Keep the license text of each PGS score record visible. The upstream record
 * has a `license` field and is not changed. A score record that comes without
 * license text is replaced by its ID and the reason.
 */
export function withScoreLicenseVisible(data: unknown): unknown {
  if (!isRecord(data) || !Array.isArray(data.results)) return licensedScore(data);
  if (data.results.every((item) => licensedScore(item) === item)) return data;
  return { ...data, results: data.results.map(licensedScore) };
}
