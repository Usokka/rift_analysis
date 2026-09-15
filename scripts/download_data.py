import argparse
import hashlib
import json
import os
import urllib.request
from pathlib import Path

SOURCES = {
    2023: {
        "url": "https://raw.githubusercontent.com/dskong07/Pro-LoL-exploration/main/2023_LoL_esports_match_data_from_OraclesElixir.csv",
        "sha256": "14b832026c559a8d4a72b1f7a98d64ee46fe9b50b7d1aa834af098c8d3fe7831",
    },
    2025: {
        "url": "https://raw.githubusercontent.com/cbplexiglass/LoL-Esports-Regional-Analyses/main/2025_LoL_esports_match_data_from_OraclesElixir.csv",
        "sha256": "1adfa81d8ea54cd62b332d18f8a4089cb64331da448b11f0ff7084fac55ed406",
    },
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def download(year: int, output_dir: Path) -> dict:
    source = SOURCES[year]
    filename = f"{year}_LoL_esports_match_data_from_OraclesElixir.csv"
    destination = output_dir / filename
    if destination.exists() and sha256(destination) == source["sha256"]:
        return {"year": year, "path": str(destination), "status": "verified"}
    output_dir.mkdir(parents=True, exist_ok=True)
    partial = destination.with_suffix(".csv.part")
    request = urllib.request.Request(source["url"], headers={"User-Agent": "rift-analyst/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=60) as response, partial.open("wb") as target:
            while chunk := response.read(1024 * 1024):
                target.write(chunk)
        actual = sha256(partial)
        if actual != source["sha256"]:
            raise ValueError(
                f"checksum mismatch for {year}: expected {source['sha256']}, got {actual}"
            )
        os.replace(partial, destination)
    finally:
        partial.unlink(missing_ok=True)
    return {"year": year, "path": str(destination), "status": "downloaded"}


def main() -> None:
    parser = argparse.ArgumentParser(description="Download pinned Oracle's Elixir export mirrors")
    parser.add_argument(
        "--years", nargs="+", type=int, choices=sorted(SOURCES), default=sorted(SOURCES)
    )
    parser.add_argument("--output-dir", type=Path, default=Path("data/raw"))
    args = parser.parse_args()
    for year in args.years:
        print(json.dumps(download(year, args.output_dir), sort_keys=True))


if __name__ == "__main__":
    main()
