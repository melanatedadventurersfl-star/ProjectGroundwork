#!/usr/bin/env python3
"""Build an image-generation prompt from a GoWorkout sheet manifest."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
MEDIA_DIR = SCRIPT_DIR.parent
SPECS_PATH = MEDIA_DIR / "exercise-specs.json"
AVATARS_PATH = MEDIA_DIR / "avatars.json"


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def main():
    parser = argparse.ArgumentParser(description="Create a strict contact-sheet generation prompt")
    parser.add_argument("manifest", help="Path to a sheet manifest JSON file")
    parser.add_argument("--output", help="Optional text file to save the prompt")
    args = parser.parse_args()

    manifest = load_json(Path(args.manifest).resolve())
    specs = load_json(SPECS_PATH)
    avatars = load_json(AVATARS_PATH)

    exercise_map = {item["id"]: item for item in specs["exercises"]}
    avatar_map = {item["id"]: item for item in avatars["avatars"]}
    visual = avatars["visualSystem"]
    grid = manifest["grid"]

    lines = [
        f"Create one strict {grid['rows']}x{grid['columns']} square instructional fitness contact sheet.",
        "This sheet will be cropped automatically into separate app assets.",
        "Every cell must be equal size, aligned to the grid, and visually isolated from neighboring cells.",
        "Use narrow, even warm-cream gutters between cells. Keep all people and equipment fully inside their own cells.",
        "Do not add text, labels, numbers, logos, watermarks, borders, captions, or decorative graphics.",
        f"Visual style: {visual['style']}.",
        f"Background in every occupied cell: {visual['background']}.",
        f"Palette: {', '.join(visual['palette'])}.",
        f"Branding rule: {visual['branding']}.",
        f"Framing rule: {visual['framing']}.",
        "Movement accuracy matters more than dramatic posing.",
        "",
        "Grid contents, read left to right and top to bottom:",
    ]

    occupied = {(cell["row"], cell["column"]): cell for cell in manifest["cells"]}
    for row in range(int(grid["rows"])):
        for column in range(int(grid["columns"])):
            cell = occupied.get((row, column))
            label = f"Row {row + 1}, column {column + 1}"
            if not cell:
                lines.append(f"{label}: leave empty with the same warm-cream background.")
                continue

            exercise = exercise_map[cell["exerciseId"]]
            avatar = avatar_map[cell["avatarId"]]
            position_text = (
                exercise["startPosition"] if cell["position"] == "start" else exercise["endPosition"]
            )
            rules = " ".join(exercise.get("formRules", []))
            lines.append(
                f"{label}: {avatar['name']}, {avatar['presentation'].lower()}, "
                f"{avatar['build'].lower()} build, {avatar['skinTone']} skin, "
                f"{avatar['hair']}, {avatar['face']}. Outfit: {avatar['outfit']}. "
                f"Exercise: {exercise['name']}, {cell['position']} position. "
                f"Pose: {position_text} Camera: {exercise['camera']}. Form: {rules}"
            )

    lines.extend(
        [
            "",
            "Identity consistency is required. The same named avatar must keep the same face, hair, build, skin tone, and outfit in every cell where that avatar appears.",
            "Start and end positions for the same avatar must look like consecutive frames from the same photo session.",
            "Do not merge poses, people, limbs, benches, weights, or machines across cell boundaries.",
        ]
    )

    prompt = "\n".join(lines) + "\n"
    if args.output:
        output_path = Path(args.output).resolve()
        output_path.write_text(prompt, encoding="utf-8")
        print(output_path)
    else:
        print(prompt)


if __name__ == "__main__":
    main()
