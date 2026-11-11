import type { SchemaHints } from "@bio-mcp/shared/staging/schema-inference";

type Row = Record<string, unknown>;
const object = (value: unknown): value is Row => value !== null && typeof value === "object" && !Array.isArray(value);

/** Project only file workflows; existing REST/PGS tables keep their schema hints. */
export function fileTables(value: unknown): Record<string, Row[]> | undefined {
  const data = object(value) && Array.isArray(value.content) && object(value.structuredContent) ? value.structuredContent.data : value;
  if (!object(data)) return undefined;
  const native = object(data.native) ? data.native : undefined;
  const preview = native && Array.isArray(native.columns) && Array.isArray(native.rows);
  const metadata = native && typeof native.text === "string" && object(data.file);
  const manifest = Array.isArray(data.files) && (typeof data.accession === "string" || typeof data.repository_commit === "string");
  if (!preview && !metadata && !manifest) return undefined;
  const tables: Record<string, Row[]> = { response_context: [{ native_json: JSON.stringify(data) }] };
  if (preview) {
    // Positional JSON avoids reserved/duplicate SQL column names and numeric inference.
    tables.preview_rows = (native.rows as unknown[]).map((row, row_index) => ({ row_index, native_json: JSON.stringify(row), source_path: `/native/rows/${row_index}` }));
    tables.preview_columns = (native.columns as unknown[]).map((name, column_index) => ({ column_index, name }));
  }
  if (metadata) tables.metadata_text = [{ text: native.text, source_url: native.source_url, native_json: JSON.stringify(native) }];
  if (manifest) tables.files = (data.files as unknown[]).filter(object).map((file, file_index) => ({
    file_index, name: file.name ?? file.path, url: file.url, directory: file.directory ?? null, native_json: JSON.stringify(file), source_path: `/files/${file_index}`,
  }));
  return tables;
}

export const fileSchemaHints: SchemaHints = { columnTypes: { native_json: "TEXT", source_path: "TEXT", name: "TEXT", text: "TEXT", source_url: "TEXT", url: "TEXT", directory: "TEXT" } };
