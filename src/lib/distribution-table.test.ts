import { expect, it } from "vitest";
import { distributionTable } from "./distribution-table";

it("retains CNV coordinates, extreme significance, uncertainty and extra columns as strings", () => {
  const text = "chromosome\tbase_pair_start\tbase_pair_end\tp_value\tbeta\tstandard_error\tstatistical_model_type\textra\n01\t0\t9007199254740993\t1e-400\t0.123456789123456789\t#NA\tadditive\tcustom\n";
  const result = distributionTable(text, "tsv", true, 100);
  expect(result.rows).toEqual([["01", "0", "9007199254740993", "1e-400", "0.123456789123456789", "#NA", "additive", "custom"]]);
  expect(result.complete_file).toBe(true);
});

it("retains gene-based negative-log significance and quoted CSV content without inference", () => {
  const result = distributionTable('hgnc_symbol,neg_log10_p_value,ci_lower,note\nTP53,400,0.9,"multi\n""quote"", comma"\n', "csv", true, 10);
  expect(result.rows).toEqual([["TP53", "400", "0.9", 'multi\n"quote", comma']]);
  expect(result.column_observations).toEqual(["hgnc_symbol", "neg_log10_p_value"]);
});

it("discards a cut final record and distinguishes a preview from a complete file", () => {
  const result = distributionTable('gene,p_value\nTP53,1e-400\nABC,"cut', "csv", false, 100);
  expect(result.rows).toEqual([["TP53", "1e-400"]]); expect(result.complete_file).toBe(false);
  expect(distributionTable("a\tb\n1\t2\n3\t4\n", "tsv", true, 1).complete_file).toBe(false);
});

it.each(["a\ta\n1\t2", "a\t\n1\t2", "a\tb\n1\t2\t3", 'a\tb\n1\t"cut', "<html>challenge</html>"])("rejects unusable or ambiguous table headers/rows %#", text => {
  expect(() => distributionTable(text, "tsv", true, 10)).toThrow();
});
