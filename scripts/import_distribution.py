"""Import a complete, checksum-verified GWAS text artifact into a local SQLite file.

No network requests, YAML execution, numeric coercion, or database service required.
The output is published only after EOF, gzip integrity and all supplied hashes pass.
"""

import argparse
import csv
import gzip
import hashlib
import io
import json
import math
import os
from pathlib import Path
import re
import sqlite3
import tempfile
import time
from urllib.parse import urlsplit


class BoundedReader(io.RawIOBase):
    def __init__(self, source, limit, deadline, algorithms):
        self.source = source
        self.limit = limit
        self.deadline = deadline
        self.bytes_read = 0
        self.hashes = {name: hashlib.new(name, usedforsecurity=False) for name in algorithms}

    def readable(self):
        return True

    def readinto(self, buffer):
        if time.monotonic() > self.deadline:
            raise ValueError("Import deadline exceeded")
        data = self.source.read(min(len(buffer), 1024 * 1024))
        self.bytes_read += len(data)
        if self.bytes_read > self.limit:
            raise ValueError("Import byte limit exceeded")
        for digest in self.hashes.values():
            digest.update(data)
        buffer[:len(data)] = data
        return len(data)

    def digests(self):
        return {name: digest.hexdigest() for name, digest in self.hashes.items()}


def metadata_evidence(paths):
    evidence = []
    for path in paths:
        with Path(path).open("rb") as stream:
            raw = stream.read(2 * 1024 * 1024 + 1)
        if len(raw) > 2 * 1024 * 1024:
            raise ValueError("Metadata file exceeds 2 MiB")
        evidence.append({"filename": Path(path).name, "text": raw.decode("utf-8"),
                         "sha256": hashlib.sha256(raw).hexdigest(), "bytes": len(raw)})
    return evidence


def validate_options(options):
    source = urlsplit(options.source_url)
    if (source.scheme != "https" or source.netloc != "ftp.ebi.ac.uk"
            or not source.path.startswith("/pub/databases/gwas/summary_statistics/")
            or source.query or source.fragment):
        raise ValueError("source-url must identify the public GWAS distribution file")
    if not options.expected_md5 and not options.expected_sha256:
        raise ValueError("At least one provider/source checksum is required")
    for value, size in [(options.expected_md5, 32), (options.expected_sha256, 64)]:
        if value and not re.fullmatch(f"[a-f0-9]{{{size}}}", value):
            raise ValueError("Expected hashes must be lowercase hexadecimal")
    if not math.isfinite(options.deadline_seconds) or any(value <= 0 for value in [options.max_source_bytes, options.max_decoded_bytes,
                                    options.max_rows, options.deadline_seconds]):
        raise ValueError("Import bounds must be positive")
    if len(options.metadata) > 10:
        raise ValueError("At most ten metadata files may accompany an import")
    output = Path(options.output)
    if output.exists() or output.is_symlink():
        raise FileExistsError("Output already exists; choose a new SQLite filename")
    return output


def delimited_rows(text, delimiter):
    """Bound the entire logical record, including quoted multiline cells."""
    remaining = 2 * 1024 * 1024

    def lines():
        nonlocal remaining
        while True:
            line = text.readline(remaining + 1)
            if not line:
                return
            remaining -= len(line)
            if remaining < 0:
                raise ValueError("Logical record exceeds 2 MiB characters")
            yield line

    reader = csv.reader(lines(), delimiter=delimiter, strict=True)
    while True:
        remaining = 2 * 1024 * 1024
        try:
            row = next(reader)
        except StopIteration:
            return
        yield row


def ingest_rows(connection, reader, options):
    columns = next(reader, None)
    if (not columns or len(columns) < 2 or len(columns) > 1000
            or any(not name.strip() for name in columns) or len(set(columns)) != len(columns)):
        raise ValueError("Table must have 2–1000 distinct, nonempty column names")
    connection.executemany("INSERT INTO columns VALUES (?, ?)", enumerate(columns))
    count = 0
    batch = []
    batch_characters = 0
    for row in reader:
        if not row:
            continue
        if len(row) != len(columns):
            raise ValueError(f"Row {count + 1} has {len(row)} cells; expected {len(columns)}")
        count += 1
        if count > options.max_rows:
            raise ValueError("Import row limit exceeded")
        serialized = json.dumps(row, ensure_ascii=False, separators=(",", ":"))
        batch.append((count - 1, serialized))
        batch_characters += len(serialized)
        if len(batch) == 1000 or batch_characters >= 2 * 1024 * 1024:
            connection.executemany("INSERT INTO records VALUES (?, ?)", batch)
            batch.clear()
            batch_characters = 0
    connection.executemany("INSERT INTO records VALUES (?, ?)", batch)
    return count, columns


def import_distribution(options):
    output = validate_options(options)
    metadata = metadata_evidence(options.metadata)
    started = time.monotonic()
    deadline = started + options.deadline_seconds
    csv.field_size_limit(16 * 1024 * 1024)
    with tempfile.TemporaryDirectory(prefix=".gwas-import-", dir=output.parent) as directory:
        temporary = Path(directory) / "data.sqlite"
        connection = sqlite3.connect(temporary)
        try:
            connection.execute("PRAGMA cache_size=-32768")
            connection.execute("CREATE TABLE records (row_index INTEGER PRIMARY KEY, native_json TEXT NOT NULL)")
            connection.execute("CREATE TABLE columns (column_index INTEGER PRIMARY KEY, name TEXT NOT NULL)")
            connection.execute("CREATE TABLE provenance (key TEXT PRIMARY KEY, value_json TEXT NOT NULL)")
            with Path(options.file).open("rb") as raw:
                source = BoundedReader(raw, options.max_source_bytes, deadline, ["md5", "sha256"])
                with io.BufferedReader(source) as buffered:
                    compressed = buffered.peek(2)[:2] == b"\x1f\x8b"
                    payload = gzip.GzipFile(fileobj=buffered) if compressed else buffered
                    try:
                        decoded = BoundedReader(payload, options.max_decoded_bytes, deadline, ["sha256"])
                        with io.TextIOWrapper(io.BufferedReader(decoded), encoding="utf-8-sig", newline="") as text:
                            reader = delimited_rows(text, "\t" if options.format == "tsv" else ",")
                            count, columns = ingest_rows(connection, reader, options)
                    finally:
                        if compressed:
                            payload.close()
                hashes = source.digests()
                for kind in ["md5", "sha256"]:
                    expected = getattr(options, "expected_" + kind)
                    if expected and hashes[kind] != expected:
                        raise ValueError(f"Complete artifact {kind} differs from expected checksum")
            evidence = {"source_url": options.source_url,
                        "source_url_basis": "Caller-supplied distribution URL; importer performs no network request",
                        "source_bytes": source.bytes_read,
                        "source_hashes": hashes, "expected_md5": options.expected_md5,
                        "expected_sha256": options.expected_sha256, "artifact_checksum_verified": True,
                        "decoded_bytes": decoded.bytes_read, "decoded_sha256": decoded.digests()["sha256"],
                        "rows": count, "columns": columns, "format": options.format,
                        "compression": "gzip" if compressed else "none", "complete_file": True,
                        "cell_encoding": "ordered JSON arrays of strings; no numeric coercion",
                        "metadata": metadata, "assembly": None, "coordinate_convention": None,
                        "scientific_schema_validated": False,
                        "imported_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
            connection.execute("INSERT INTO provenance VALUES ('import', ?)", (json.dumps(evidence, ensure_ascii=False),))
            connection.commit()
            if connection.execute("PRAGMA quick_check").fetchone()[0] != "ok":
                raise ValueError("SQLite integrity check failed")
        finally:
            connection.close()
        # Hard-link publication is atomic and fails if another file acquired the name.
        if time.monotonic() > deadline:
            raise ValueError("Import deadline exceeded before publication")
        os.link(temporary, output)
    return evidence


def parser():
    command = argparse.ArgumentParser(description=__doc__)
    command.add_argument("--file", required=True, help="Previously downloaded, complete source artifact")
    command.add_argument("--source-url", required=True, help="Original HTTPS URL from /sumstats/files")
    command.add_argument("--output", required=True, help="New local SQLite filename; never overwritten")
    command.add_argument("--format", required=True, choices=["tsv", "csv"])
    command.add_argument("--expected-md5")
    command.add_argument("--expected-sha256")
    command.add_argument("--metadata", action="append", default=[], help="Native YAML/checksum/README/log; repeat up to ten times")
    command.add_argument("--max-source-bytes", type=int, default=1024**3)
    command.add_argument("--max-decoded-bytes", type=int, default=16 * 1024**3)
    command.add_argument("--max-rows", type=int, default=50_000_000)
    command.add_argument("--deadline-seconds", type=float, default=1200)
    return command


if __name__ == "__main__":
    print(json.dumps(import_distribution(parser().parse_args()), ensure_ascii=False))
