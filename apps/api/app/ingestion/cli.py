import argparse
import json
from dataclasses import asdict
from pathlib import Path

from app.core.database import get_engine
from app.ingestion.oracle_elixir import ingest_file


def main() -> None:
    parser = argparse.ArgumentParser(description="Import Oracle's Elixir CSV files into PostgreSQL")
    parser.add_argument("sources", nargs="+", type=Path)
    parser.add_argument("--source-uri", help="Original download page or URL recorded as provenance")
    parser.add_argument("--batch-games", type=int, default=250)
    args = parser.parse_args()
    for source in args.sources:
        summary = ingest_file(get_engine(), source, args.source_uri, args.batch_games)
        print(json.dumps(asdict(summary), sort_keys=True))


if __name__ == "__main__":
    main()
