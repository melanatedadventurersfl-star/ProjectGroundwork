# Anatomy V2 asset pipeline

This folder separates anatomy artwork from workout-data logic.

## Current workflow

1. Lock one front base image and one back base image on the shared 1000 × 1800 canvas.
2. Open `dev/mask-studio.html`.
3. Pick a view and body region.
4. Either paint the master mask manually, or load an aligned lit reference image and use Difference Extraction to isolate the illuminated pixels.
5. Paint or erase the extracted mask to clean its edges.
6. Save the master mask in the browser.
7. Export intensity levels 1 through 4. The studio creates every color variation from the single master mask.
8. Place the generated transparent PNG files under `generated/male/front` or `generated/male/back`.
9. Enable the runtime overlay renderer only after the generated assets are committed and reviewed.

## File naming

Master mask:

`male-front-quads-master-mask.png`

Generated lighting overlays:

`male-front-quads-1.png`
`male-front-quads-2.png`
`male-front-quads-3.png`
`male-front-quads-4.png`

Every mask and overlay keeps the full 1000 × 1800 canvas. Nothing is trimmed. This keeps all layers aligned at x=0, y=0.

## Intensity

1 = light green
2 = moderate green
3 = lime
4 = gold

The exported overlay keeps transparency so the base anatomy shading remains visible underneath.

## Female anatomy

The same region IDs, exporter, renderer, and intensity system will support a future `female` variant. Only the base artwork and region masks need to change.
