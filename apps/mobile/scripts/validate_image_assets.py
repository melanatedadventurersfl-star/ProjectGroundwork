#!/usr/bin/env python3
from pathlib import Path
import sys

from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'assets'
FORMAT_FOR_SUFFIX = {
    '.jpg': 'JPEG',
    '.jpeg': 'JPEG',
    '.png': 'PNG',
    '.webp': 'WEBP',
}


def validate(path: Path) -> str:
    suffix = path.suffix.lower()
    expected = FORMAT_FOR_SUFFIX[suffix]

    with Image.open(path) as image:
        actual = image.format
        width, height = image.size
        image.verify()

    with Image.open(path) as image:
        image.load()

    if actual != expected:
        raise RuntimeError(f'extension {suffix} contains {actual or "unknown"} data, expected {expected}')
    if width <= 0 or height <= 0:
        raise RuntimeError(f'invalid dimensions: {width}x{height}')

    return f'{width}x{height} {actual}'


def main() -> int:
    if not ROOT.exists():
        print(f'Image asset directory not found: {ROOT}', file=sys.stderr)
        return 1

    paths = sorted(
        path
        for path in ROOT.rglob('*')
        if path.is_file() and path.suffix.lower() in FORMAT_FOR_SUFFIX
    )
    if not paths:
        print('No bundled raster image assets found.', file=sys.stderr)
        return 1

    failures: list[str] = []
    for path in paths:
        relative = path.relative_to(ROOT.parent)
        try:
            detail = validate(path)
            print(f'OK {relative} ({detail})')
        except Exception as exc:
            failures.append(f'{relative}: {exc}')

    if failures:
        print('\nBundled image asset validation failed:', file=sys.stderr)
        for failure in failures:
            print(f'  - {failure}', file=sys.stderr)
        return 1

    print(f'Validated {len(paths)} bundled raster image asset(s).')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
