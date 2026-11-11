import { expect, it } from "vitest";
import { fileTables, fileSchemaHints } from "./file-staging";

it("keeps preview column order, reserved names, extreme p-values and exact strings", () => {
  const native = { columns: ["_rowid", "native_json", "p_value", "coordinate"], rows: [["0001", "α😀", "1e-400", "9007199254740993"], ["0002", "", "NA", "0"]] };
  const data = { native, accession: "GCST90270927", file: { directory: "submitted" }, observation: { complete: false } };
  const tables = fileTables({ content: [], structuredContent: { data } });
  expect(tables?.preview_columns.map(row => row.name)).toEqual(native.columns);
  expect(tables?.preview_rows.map(row => JSON.parse(String(row.native_json)))).toEqual(native.rows);
  expect(tables?.preview_rows.map(row => row.source_path)).toEqual(["/native/rows/0", "/native/rows/1"]);
  expect(JSON.parse(String(tables?.response_context[0].native_json))).toEqual(data);
  expect(fileSchemaHints.columnTypes?.native_json).toBe("TEXT");
});

it("preserves exact metadata text and leaves established REST/PGS projections alone", () => {
  const native = { text: "\uFEFFgenome_assembly: GRCh37\n", source_url: "https://ftp.ebi.ac.uk/example" };
  expect(fileTables({ native, file: { name: "meta.yaml" } })?.metadata_text[0]).toMatchObject({ text: native.text, native_json: JSON.stringify(native) });
  for (const data of [{ _embedded: { studies: [{ accession_id: "GCST001001" }] } }, { results: [{ id: "PGS000001" }] }, null]) expect(fileTables(data)).toBeUndefined();
});
