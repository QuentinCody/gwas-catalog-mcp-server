interface CellState { quoted: boolean; field: string; row: string[]; rows: string[][] }

function unquoted(char: string, delimiter: string, state: CellState): void {
  if (char === '"') { state.quoted = true; return; }
  if (char === delimiter) { state.row.push(state.field); state.field = ""; return; }
  if (char === "\n") {
    state.row.push(state.field); state.rows.push(state.row); state.row = []; state.field = ""; return;
  }
  if (char !== "\r") state.field += char;
}

function tokenize(text: string, delimiter: string, complete: boolean): string[][] {
  const state: CellState = { quoted: false, field: "", row: [], rows: [] };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (!state.quoted) { unquoted(char, delimiter, state); continue; }
    if (char !== '"') { state.field += char; continue; }
    if (text[i + 1] === '"') { state.field += '"'; i++; continue; }
    state.quoted = false;
  }
  if (complete && state.quoted) throw new Error("Unterminated summary-statistics field");
  if (complete && (state.field || state.row.length)) state.rows.push([...state.row, state.field]);
  return state.rows.filter(row => row.some(value => value !== ""));
}

export interface DistributionTable {
  columns: string[];
  rows: string[][];
  returned: number;
  complete_file: boolean;
  column_observations: string[];
}

/** Strings retain underflow-scale p-values, coordinates, missing values and extra fields. */
export function distributionTable(text: string, format: "tsv" | "csv", complete: boolean, limit: number): DistributionTable {
  const rows = tokenize(text.replace(/^\uFEFF/, ""), format === "tsv" ? "\t" : ",", complete);
  const columns = rows.shift();
  if (!columns || columns.length < 2 || columns.some(name => !name.trim()) || new Set(columns).size !== columns.length) throw new Error("Summary-statistics file has missing or duplicate columns");
  const selected = rows.slice(0, limit);
  if (selected.some(row => row.length !== columns.length)) throw new Error("Summary-statistics row does not match its header");
  return { columns, rows: selected, returned: selected.length, complete_file: complete && rows.length <= limit,
    column_observations: columns.filter(name => ["hgnc_symbol", "ensembl_gene_id", "chromosome", "base_pair_start", "base_pair_end", "p_value", "neg_log10_p_value", "statistical_model_type"].includes(name)) };
}
