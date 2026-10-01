# GoWorkout media production

This directory is the source of truth for avatar exercise image production.

The current workout catalog contains **49 exercises** and four V1 avatars. A standard exercise needs two instructional positions for each avatar, for **392 production assets** across the full catalog.

## Files

- `avatars.json` locks the four V1 avatar identities and the shared visual system.
- `exercise-specs.json` defines the instructional start and end pose, camera view, equipment context, and form rule for every catalog exercise.
- `media-status.json` tracks every required image by exercise, avatar, and position.
- `sheet-manifests/` defines the exact cells inside generation contact sheets.
- `scripts/build_sheet_prompt.py` turns a manifest into a strict image-generation prompt.
- `scripts/crop_sheet.py` splits a generated contact sheet into individual WebP app assets.
- `source-sheets/` is local working space for generated sheets and is ignored by Git.

## Production model

The app still receives one avatar, one position, one image per asset.

Contact sheets are allowed only as a production shortcut. A contact sheet must never be referenced directly by the app.

The default V1 sheet is a 3x3 grid. Eight cells hold one complete exercise:

1. Malik start
2. Malik end
3. Drew start
4. Drew end
5. Nia start
6. Nia end
7. Maya start
8. Maya end
9. Empty spare cell

This turns one generated image into up to eight production assets while preserving the existing exercise and avatar architecture.

## Status workflow

`missing → generated → needs-review → approved`

Use `needs-redo` whenever the person, equipment, position, anatomy, form, crop, or branding is wrong.

The cropper may mark successfully written assets as `generated`. It never marks an asset `approved`.

Only approved assets should be referenced by `avatar-media.js`.

## Repository asset convention

```
apps/member-app-prototype/workout/assets/exercises/<exercise-id>/<avatar-id>/position-1.webp
apps/member-app-prototype/workout/assets/exercises/<exercise-id>/<avatar-id>/position-2.webp
```

Avatar IDs:

- `masc-athletic` = Malik
- `masc-full` = Drew
- `fem-athletic` = Nia
- `fem-full` = Maya

## One-time setup

From the repository root:

```bash
python3 -m pip install -r apps/member-app-prototype/workout/media-production/requirements.txt
```

## Create a sheet

Start from a manifest in `sheet-manifests/`.

Generate the prompt:

```bash
python3 apps/member-app-prototype/workout/media-production/scripts/build_sheet_prompt.py \
  apps/member-app-prototype/workout/media-production/sheet-manifests/goblet-squat-avatar-sheet-01.json
```

Generate the contact sheet from that prompt and save it to the manifest's `source` path.

For the example:

```
apps/member-app-prototype/workout/media-production/source-sheets/goblet-squat-avatar-sheet-01.png
```

The generator should produce equal square cells with clear gutters, no labels, no logos, no overlapping subjects, and all body parts and equipment contained inside each cell.

## Validate before cropping

```bash
python3 apps/member-app-prototype/workout/media-production/scripts/crop_sheet.py \
  apps/member-app-prototype/workout/media-production/sheet-manifests/goblet-squat-avatar-sheet-01.json \
  --dry-run
```

This validates exercise IDs, avatar IDs, grid coordinates, source location, and output paths without writing assets.

## Crop and save the assets

```bash
python3 apps/member-app-prototype/workout/media-production/scripts/crop_sheet.py \
  apps/member-app-prototype/workout/media-production/sheet-manifests/goblet-squat-avatar-sheet-01.json \
  --update-status
```

The cropper:

- calculates every cell from the manifest
- trims the configured inset
- center-crops each cell to a square by default
- downscales only when an image exceeds the configured maximum edge
- saves WebP files into the existing asset convention
- refuses to overwrite existing assets unless `--overwrite` is supplied
- refuses to replace approved assets unless `--replace-approved` is explicitly supplied
- marks newly written assets `generated` when `--update-status` is supplied

## Review rule

Review every crop before approval. Movement accuracy comes first.

Check:

- correct avatar identity
- correct start or end position
- correct equipment
- safe and recognizable form
- hands, feet, weights, benches, and machines are fully visible
- no anatomy errors
- no neighboring-cell content leaked into the crop
- no text, brand marks, or watermarks

Only after review should the corresponding `media-status.json` entry move to `approved`.

## Grid tuning

Image generators do not always place gutters at exact pixel widths. The manifest supports:

- `outerMarginPx`
- `gutterPx`
- `cellInsetPx`

Start at zero for margin and gutter when the generated grid divides cleanly. Increase `cellInsetPx` by a few pixels if neighboring cells bleed into crops.

The cropper derives cell size from the actual source image dimensions, so the sheet does not need a fixed pixel size.

## Batch strategy

Use one 3x3 sheet per exercise for the first production pass. That gives the four avatars and both positions in one generation.

For difficult machine exercises or poses that need more visual room, use a 2x2 manifest and split the exercise across two sheets.

Keep source sheets out of production assets. Commit only the cropped assets, manifests, status changes, and any approved mapping updates.
