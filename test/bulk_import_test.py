import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("gwas_import", Path(__file__).parents[1] / "scripts/import_distribution.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class BulkImportTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.source = self.root / "source.gz"
        self.output = self.root / "analysis.sqlite"

    def tearDown(self):
        self.temporary.cleanup()

    def options(self, raw, *extra):
        self.source.write_bytes(raw)
        return module.parser().parse_args([
            "--file", str(self.source), "--output", str(self.output), "--format", "tsv",
            "--source-url", "https://ftp.ebi.ac.uk/pub/databases/gwas/summary_statistics/GCST001001/study.tsv.gz",
            "--expected-md5", hashlib.md5(raw, usedforsecurity=False).hexdigest(), *extra,
        ])

    def test_all_cells_and_source_evidence_survive_concatenated_gzip_import(self):
        text = "\ufeff_rowid\tp_value\tcoordinate\tnote\r\n0001\t1e-400\t9007199254740993\t\"α\n😀\"\r\n0002\tNA\t0\t\r\n"
        raw = gzip.compress(text[:55].encode()) + gzip.compress(text[55:].encode())
        meta = self.root / "study.yaml"
        meta.write_text("genome_assembly: GRCh37\ncoordinate_system: 1-based\n")
        result = module.import_distribution(self.options(raw, "--metadata", str(meta), "--expected-sha256", hashlib.sha256(raw).hexdigest()))
        self.assertEqual(result["rows"], 2)
        self.assertEqual(result["decoded_sha256"], hashlib.sha256(text.encode()).hexdigest())
        self.assertEqual(result["source_bytes"], len(raw))
        self.assertTrue(result["artifact_checksum_verified"])
        self.assertIsNone(result["assembly"])
        with sqlite3.connect(self.output) as db:
            self.assertEqual(db.execute("SELECT name FROM columns ORDER BY column_index").fetchall(), [("_rowid",), ("p_value",), ("coordinate",), ("note",)])
            rows = [json.loads(row[0]) for row in db.execute("SELECT native_json FROM records ORDER BY row_index")]
            self.assertEqual(rows, [["0001", "1e-400", "9007199254740993", "α\n😀"], ["0002", "NA", "0", ""]])
            self.assertEqual(json.loads(db.execute("SELECT value_json FROM provenance").fetchone()[0]), result)
            self.assertEqual(db.execute("SELECT typeof(json_extract(native_json, '$[1]')) FROM records").fetchall(), [("text",), ("text",)])

    def test_plain_csv_keeps_quoted_delimiters_and_empty_cells(self):
        result = module.import_distribution(self.options(b'a,b,c\n"one,two",,001\n', "--format", "csv"))
        self.assertEqual(result["compression"], "none")
        with sqlite3.connect(self.output) as db:
            self.assertEqual(json.loads(db.execute("SELECT native_json FROM records").fetchone()[0]), ["one,two", "", "001"])

    def test_hash_mismatch_never_publishes_partial_database(self):
        options = self.options(gzip.compress(b"a\tb\n1\t2\n"), "--expected-sha256", "0" * 64)
        with self.assertRaisesRegex(ValueError, "checksum"):
            module.import_distribution(options)
        self.assertFalse(self.output.exists())
        self.assertEqual(list(self.root.glob(".gwas-import-*")), [])

    def test_corrupt_later_member_never_publishes_earlier_rows(self):
        bad = bytearray(gzip.compress(b"2\tb\n"))
        bad[-8] ^= 255
        raw = gzip.compress(b"x\ty\n1\ta\n") + bad
        with self.assertRaises(gzip.BadGzipFile):
            module.import_distribution(self.options(raw))
        self.assertFalse(self.output.exists())

    def test_truncated_gzip_is_not_complete_even_with_a_matching_prefix_hash(self):
        raw = gzip.compress(b"x\ty\n1\t2\n")[:-4]
        with self.assertRaises(EOFError):
            module.import_distribution(self.options(raw))
        self.assertFalse(self.output.exists())

    def test_limits_and_malformed_records_never_publish(self):
        cases = [
            (b"a\ta\n1\t2\n", ()),
            (b"a\tb\n1\t2\n3\n", ()),
            (b"a\tb\n1\t2\n", ("--max-rows", "0")),
            (b"a\tb\n1\t2\n3\t4\n", ("--max-rows", "1")),
            (b"a\tb\n1\t2\n", ("--max-source-bytes", "3")),
            (gzip.compress(b"a\tb\n1\t2\n"), ("--max-decoded-bytes", "3")),
            (b"a\tb\n1\t2\n", ("--deadline-seconds", "0.000000001")),
            (b"a\tb\n1\t2\n", ("--deadline-seconds", "nan")),
            (b"a\tb\n1\t2\n", ("--deadline-seconds", "inf")),
            (b"a\tb\n1\t\xff\n", ()),
            (b'a\tb\n1\t"unterminated', ()),
            (b'a\tb\n1\t"' + b"x\n" * 1100000 + b'"\n', ()),
        ]
        for raw, extra in cases:
            with self.subTest(extra=extra, bytes=len(raw)):
                with self.assertRaises((ValueError, module.csv.Error)):
                    module.import_distribution(self.options(raw, *extra))
                self.assertFalse(self.output.exists())

    def test_existing_file_and_symlink_are_not_overwritten(self):
        options = self.options(b"a\tb\n1\t2\n")
        self.output.write_bytes(b"unrelated")
        with self.assertRaises(FileExistsError):
            module.import_distribution(options)
        self.assertEqual(self.output.read_bytes(), b"unrelated")
        self.output.unlink()
        self.output.symlink_to(self.root / "missing")
        with self.assertRaises(FileExistsError):
            module.import_distribution(options)
        self.assertTrue(self.output.is_symlink())

    def test_checksum_and_source_identity_are_required(self):
        options = self.options(b"a\tb\n1\t2\n")
        for overrides in [{"expected_md5": None}, {"expected_md5": "wrong"}, {"source_url": "https://example.com/file"}, {"source_url": options.source_url + "?token=value"}]:
            with self.subTest(overrides=overrides):
                invalid = module.argparse.Namespace(**(vars(options) | overrides))
                with self.assertRaises(ValueError):
                    module.import_distribution(invalid)
                self.assertFalse(self.output.exists())


if __name__ == "__main__":
    unittest.main()
