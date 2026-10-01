#!/usr/bin/env python3
"""Crop generated GoWorkout contact sheets into production exercise assets.

Supports either the original manifest + image workflow or a ZIP archive containing
multiple named 3x3 exercise sheets.
"""

from __future__ import annotations

import argparse
import io
import json
import re
import sys
import zipfile
from pathlib import Path, PurePosixPath

try:
    from PIL import Image
except ImportError:
    print(
        "Pillow is required. Run: python3 -m pip install -r "
        "apps/member-app-prototype/workout/media-production/requirements.txt",
        file=sys.stderr,
    )
    raise

SCRIPT_DIR = Path(__file__).resolve().parent
MEDIA_DIR = SCRIPT_DIR.parent
WORKOUT_DIR = MEDIA_DIR.parent
ASSET_ROOT = WORKOUT_DIR / "assets" / "exercises"
STATUS_PATH = MEDIA_DIR / "media-status.json"
SPECS_PATH = MEDIA_DIR / "exercise-specs.json"
AVATARS_PATH = MEDIA_DIR / "avatars.json"

POSITION_FILE = {
    "start": "position-1.webp",
    "end": "position-2.webp",
}

SUPPORTED_IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp"}

DEFAULT_GRID = {
    "rows": 3,
    "columns": 3,
    "outerMarginPx": 0,
    "gutterPx": 0,
    "cellInsetPx": 4,
}

DEFAULT_OUTPUT = {
    "format": "webp",
    "quality": 88,
    "maxEdge": 768,
    "squareCrop": True,
}

DEFAULT_CELL_LAYOUT = (
    (0, 0, "masc-athletic", "start"),
    (0, 1, "masc-athletic", "end"),
    (0, 2, "masc-full", "start"),
    (1, 0, "masc-full", "end"),
    (1, 1, "fem-athletic", "start"),
    (1, 2, "fem-athletic", "end"),
    (2, 0, "fem-full", "start"),
    (2, 1, "fem-full", "end"),
)


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data):
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def resolve_source(manifest: dict, override: str | None) -> Path:
    raw = override or manifest.get("source")
    if not raw:
        raise ValueError("Manifest must define source or --source must be supplied")
    path = Path(raw)
    if not path.is_absolute():
        path = MEDIA_DIR / path
    return path.resolve()


def valid_ids():
    specs = load_json(SPECS_PATH)
    avatars = load_json(AVATARS_PATH)
    exercise_ids = {item["id"] for item in specs["exercises"]}
    avatar_ids = {item["id"] for item in avatars["avatars"]}
    return exercise_ids, avatar_ids


def cell_box(width: int, height: int, grid: dict, row: int, column: int):
    rows = int(grid["rows"])
    columns = int(grid["columns"])
    margin = int(grid.get("outerMarginPx", 0))
    gutter = int(grid.get("gutterPx", 0))
    inset = int(grid.get("cellInsetPx", 0))

    usable_w = width - (2 * margin) - ((columns - 1) * gutter)
    usable_h = height - (2 * margin) - ((rows - 1) * gutter)
    if usable_w <= 0 or usable_h <= 0:
        raise ValueError("Grid margins or gutters exceed source image dimensions")

    cell_w = usable_w / columns
    cell_h = usable_h / rows

    left = round(margin + column * (cell_w + gutter)) + inset
    top = round(margin + row * (cell_h + gutter)) + inset
    right = round(margin + column * (cell_w + gutter) + cell_w) - inset
    bottom = round(margin + row * (cell_h + gutter) + cell_h) - inset

    if right <= left or bottom <= top:
        raise ValueError(f"Invalid crop for row {row}, column {column}")

    return left, top, right, bottom


def square_crop(image: Image.Image) -> Image.Image:
    width, height = image.size
    edge = min(width, height)
    left = (width - edge) // 2
    top = (height - edge) // 2
    return image.crop((left, top, left + edge, top + edge))


def target_path(cell: dict) -> Path:
    return (
        ASSET_ROOT
        / cell["exerciseId"]
        / cell["avatarId"]
        / POSITION_FILE[cell["position"]]
    )


def relative_asset_path(path: Path) -> str:
    relative = path.relative_to(WORKOUT_DIR).as_posix()
    return f"./{relative}"


def validate_manifest(manifest: dict):
    exercise_ids, avatar_ids = valid_ids()
    grid = manifest.get("grid", {})
    rows = int(grid.get("rows", 0))
    columns = int(grid.get("columns", 0))
    if rows < 1 or columns < 1:
        raise ValueError("grid.rows and grid.columns must be positive integers")

    occupied = set()
    for index, cell in enumerate(manifest.get("cells", []), start=1):
        row = int(cell["row"])
        column = int(cell["column"])
        key = (row, column)
        if key in occupied:
            raise ValueError(f"Duplicate grid cell at row {row}, column {column}")
        occupied.add(key)

        if not (0 <= row < rows and 0 <= column < columns):
            raise ValueError(f"Cell {index} is outside the configured grid")
        if cell["exerciseId"] not in exercise_ids:
            raise ValueError(f"Unknown exerciseId: {cell['exerciseId']}")
        if cell["avatarId"] not in avatar_ids:
            raise ValueError(f"Unknown avatarId: {cell['avatarId']}")
        if cell["position"] not in POSITION_FILE:
            raise ValueError(f"Unknown position: {cell['position']}")


def mark_status_generated(status: dict, cells: list[dict], written: list[Path]):
    written_set = {path.resolve() for path in written}

    for cell in cells:
        path = target_path(cell)
        if path.resolve() not in written_set:
            continue
        slot = status["exercises"][cell["exerciseId"]]["avatars"][cell["avatarId"]][cell["position"]]
        if slot["status"] == "approved":
            continue
        slot["status"] = "generated"
        slot["assetPath"] = relative_asset_path(path)


def crop_image(image: Image.Image, manifest: dict, status: dict, args) -> list[Path]:
    output_config = manifest.get("output", {})
    max_edge = int(output_config.get("maxEdge", 768))
    quality = int(output_config.get("quality", 88))
    make_square = bool(output_config.get("squareCrop", True))
    image = image.convert("RGB")
    written = []

    for cell in manifest["cells"]:
        slot = status["exercises"][cell["exerciseId"]]["avatars"][cell["avatarId"]][cell["position"]]
        path = target_path(cell)

        if slot["status"] == "approved" and not args.replace_approved:
            print(f"SKIP approved: {path}")
            continue
        if path.exists() and not args.overwrite and not args.replace_approved:
            print(f"SKIP exists: {path}")
            continue

        box = cell_box(image.width, image.height, manifest["grid"], cell["row"], cell["column"])
        crop = image.crop(box)
        if make_square:
            crop = square_crop(crop)

        if max(crop.size) > max_edge:
            crop.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)

        print(
            f"{'WOULD WRITE' if args.dry_run else 'WRITE'} "
            f"{cell['exerciseId']} / {cell['avatarId']} / {cell['position']} -> {path}"
        )

        if args.dry_run:
            continue

        path.parent.mkdir(parents=True, exist_ok=True)
        crop.save(path, "WEBP", quality=quality, method=6)
        written.append(path)

    return written


def normalize_exercise_name(value: str) -> str:
    value = value.lower().replace("°", " degree ")
    value = re.sub(r"\b(?:avatar|contact|production|training)?[-_ ]*sheet(?:[-_ ]*\d+)?\b", " ", value)
    value = re.sub(r"\b(?:batch)[-_ ]*\d+\b", " ", value)
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return " ".join(value.split())


def exercise_name_lookup() -> dict[str, str]:
    specs = load_json(SPECS_PATH)
    lookup: dict[str, str] = {}
    collisions: set[str] = set()

    for item in specs["exercises"]:
        exercise_id = item["id"]
        keys = {
            normalize_exercise_name(exercise_id),
            normalize_exercise_name(item["name"]),
        }
        for key in keys:
            if not key:
                continue
            existing = lookup.get(key)
            if existing and existing != exercise_id:
                collisions.add(key)
            else:
                lookup[key] = exercise_id

    for key in collisions:
        lookup.pop(key, None)
    return lookup


def exercise_id_from_archive_name(member_name: str, lookup: dict[str, str]) -> str | None:
    path = PurePosixPath(member_name)
    stem = normalize_exercise_name(path.stem)
    if stem in lookup:
        return lookup[stem]

    matches = {
        exercise_id
        for key, exercise_id in lookup.items()
        if key and (stem.startswith(f"{key} ") or stem.endswith(f" {key}"))
    }
    if len(matches) == 1:
        return next(iter(matches))
    return None


def default_manifest_for_exercise(exercise_id: str, source_name: str) -> dict:
    return {
        "version": 1,
        "name": f"{exercise_id}-zip-sheet",
        "source": source_name,
        "grid": dict(DEFAULT_GRID),
        "output": dict(DEFAULT_OUTPUT),
        "cells": [
            {
                "row": row,
                "column": column,
                "exerciseId": exercise_id,
                "avatarId": avatar_id,
                "position": position,
            }
            for row, column, avatar_id, position in DEFAULT_CELL_LAYOUT
        ],
    }


def safe_archive_images(archive: zipfile.ZipFile):
    for info in archive.infolist():
        if info.is_dir():
            continue
        path = PurePosixPath(info.filename)
        if any(part in {"", ".", ".."} for part in path.parts):
            raise ValueError(f"Unsafe ZIP member path: {info.filename}")
        if path.name.startswith(".") or "__MACOSX" in path.parts:
            continue
        if path.suffix.lower() not in SUPPORTED_IMAGE_SUFFIXES:
            continue
        yield info


def process_zip(zip_path: Path, status: dict, args) -> tuple[list[Path], list[dict]]:
    lookup = exercise_name_lookup()
    written: list[Path] = []
    processed_cells: list[dict] = []
    seen_exercises: dict[str, str] = {}

    with zipfile.ZipFile(zip_path, "r") as archive:
        image_infos = list(safe_archive_images(archive))
        if not image_infos:
            raise ValueError("ZIP contains no supported image files (.png, .jpg, .jpeg, .webp)")

        mappings = []
        unmatched = []
        for info in image_infos:
            exercise_id = exercise_id_from_archive_name(info.filename, lookup)
            if not exercise_id:
                unmatched.append(info.filename)
                continue
            if exercise_id in seen_exercises:
                raise ValueError(
                    f"ZIP contains more than one sheet for {exercise_id}: "
                    f"{seen_exercises[exercise_id]} and {info.filename}"
                )
            seen_exercises[exercise_id] = info.filename
            mappings.append((info, exercise_id))

        if unmatched:
            names = "\n  - ".join(unmatched)
            raise ValueError(
                "Could not map these ZIP images to exercise names. Rename each image to the "
                "exercise name or exercise ID before retrying:\n  - " + names
            )

        for info, exercise_id in mappings:
            manifest = default_manifest_for_exercise(exercise_id, info.filename)
            validate_manifest(manifest)
            print(f"\nZIP SHEET: {info.filename} -> {exercise_id}")
            try:
                with Image.open(io.BytesIO(archive.read(info))) as image:
                    just_written = crop_image(image, manifest, status, args)
            except Exception as exc:
                raise ValueError(f"Failed to process ZIP image {info.filename}: {exc}") from exc
            written.extend(just_written)
            processed_cells.extend(manifest["cells"])

    return written, processed_cells


def main():
    parser = argparse.ArgumentParser(
        description=(
            "Split a GoWorkout contact sheet into production WebP assets. Input may be "
            "a sheet manifest JSON file or a ZIP of named 3x3 exercise sheets."
        )
    )
    parser.add_argument(
        "input",
        help=(
            "Path to a sheet manifest JSON file, or a ZIP archive whose image filenames "
            "match exercise names/IDs"
        ),
    )
    parser.add_argument(
        "--source",
        help="Override the source image path from a JSON manifest (manifest mode only)",
    )
    parser.add_argument("--overwrite", action="store_true", help="Replace non-approved assets")
    parser.add_argument(
        "--replace-approved",
        action="store_true",
        help="Allow replacement of an asset whose media status is approved",
    )
    parser.add_argument(
        "--update-status",
        action="store_true",
        help="Mark successfully written outputs as generated in media-status.json",
    )
    parser.add_argument("--dry-run", action="store_true", help="Validate and print outputs only")
    args = parser.parse_args()

    input_path = Path(args.input).resolve()
    if not input_path.exists():
        raise FileNotFoundError(f"Input not found: {input_path}")

    status = load_json(STATUS_PATH)
    written: list[Path] = []
    processed_cells: list[dict] = []

    if input_path.suffix.lower() == ".zip":
        if args.source:
            raise ValueError("--source cannot be used when the input is a ZIP archive")
        written, processed_cells = process_zip(input_path, status, args)
    else:
        manifest = load_json(input_path)
        validate_manifest(manifest)

        source_path = resolve_source(manifest, args.source)
        if not source_path.exists():
            raise FileNotFoundError(f"Source sheet not found: {source_path}")

        with Image.open(source_path) as image:
            written = crop_image(image, manifest, status, args)
        processed_cells = manifest["cells"]

    if args.update_status and not args.dry_run and written:
        mark_status_generated(status, processed_cells, written)
        write_json(STATUS_PATH, status)
        print(f"Updated {STATUS_PATH}")

    print(f"Completed: {len(written)} asset(s) written")


if __name__ == "__main__":
    main()
