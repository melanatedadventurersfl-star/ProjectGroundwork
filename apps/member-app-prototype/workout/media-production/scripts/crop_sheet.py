#!/usr/bin/env python3
"""Crop a generated contact sheet into GoWorkout exercise assets."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

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


def update_status(cells: list[dict], written: list[Path]):
    status = load_json(STATUS_PATH)
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

    write_json(STATUS_PATH, status)


def main():
    parser = argparse.ArgumentParser(
        description="Split one image-generation contact sheet into production WebP assets."
    )
    parser.add_argument("manifest", help="Path to a sheet manifest JSON file")
    parser.add_argument("--source", help="Override the source image path from the manifest")
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

    manifest_path = Path(args.manifest).resolve()
    manifest = load_json(manifest_path)
    validate_manifest(manifest)

    source_path = resolve_source(manifest, args.source)
    if not source_path.exists():
        raise FileNotFoundError(f"Source sheet not found: {source_path}")

    status = load_json(STATUS_PATH)
    output_config = manifest.get("output", {})
    max_edge = int(output_config.get("maxEdge", 768))
    quality = int(output_config.get("quality", 88))
    make_square = bool(output_config.get("squareCrop", True))

    image = Image.open(source_path).convert("RGB")
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

    if args.update_status and not args.dry_run and written:
        update_status(manifest["cells"], written)
        print(f"Updated {STATUS_PATH}")

    print(f"Completed: {len(written)} asset(s) written")


if __name__ == "__main__":
    main()
