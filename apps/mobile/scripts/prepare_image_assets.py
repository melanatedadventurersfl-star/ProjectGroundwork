#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path
from tempfile import TemporaryDirectory

from PIL import Image, ImageFile

ROOT = Path(__file__).resolve().parents[1] / 'assets'
FORMAT_FOR_SUFFIX = {
    '.jpg': 'JPEG',
    '.jpeg': 'JPEG',
    '.png': 'PNG',
    '.webp': 'WEBP',
}


def strict_validate(path: Path) -> tuple[int, int, str]:
    suffix = path.suffix.lower()
    expected = FORMAT_FOR_SUFFIX[suffix]
    previous = ImageFile.LOAD_TRUNCATED_IMAGES
    ImageFile.LOAD_TRUNCATED_IMAGES = False
    try:
        with Image.open(path) as image:
            actual = image.format
            width, height = image.size
            image.verify()

        with Image.open(path) as image:
            image.load()

        if actual != expected:
            raise RuntimeError(
                f'extension {suffix} contains {actual or "unknown"} data, expected {expected}'
            )
        if width <= 0 or height <= 0:
            raise RuntimeError(f'invalid dimensions: {width}x{height}')
        return width, height, actual
    finally:
        ImageFile.LOAD_TRUNCATED_IMAGES = previous


def canonicalize(source: Path, target: Path) -> tuple[int, int, str]:
    suffix = source.suffix.lower()
    expected = FORMAT_FOR_SUFFIX[suffix]
    previous = ImageFile.LOAD_TRUNCATED_IMAGES
    ImageFile.LOAD_TRUNCATED_IMAGES = True
    try:
        with Image.open(source) as image:
            image.load()
            width, height = image.size
            source_format = image.format

            target.parent.mkdir(parents=True, exist_ok=True)
            if expected == 'JPEG':
                image.convert('RGB').save(
                    target,
                    format='JPEG',
                    quality=92,
                    optimize=False,
                )
            elif expected == 'PNG':
                image.convert('RGBA').save(
                    target,
                    format='PNG',
                    optimize=False,
                    compress_level=6,
                )
            elif expected == 'WEBP':
                image.convert('RGBA').save(
                    target,
                    format='WEBP',
                    quality=92,
                    method=4,
                )
            else:
                raise RuntimeError(f'unsupported target format: {expected}')
    finally:
        ImageFile.LOAD_TRUNCATED_IMAGES = previous

    strict_width, strict_height, strict_format = strict_validate(target)
    if (strict_width, strict_height) != (width, height):
        raise RuntimeError(
            f'canonicalization changed dimensions: {width}x{height} -> '
            f'{strict_width}x{strict_height}'
        )
    return width, height, source_format or strict_format


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            'Verify bundled raster assets can be decoded, or repair recoverable '
            'truncated/malformed encodings before Metro/EAS reads them.'
        )
    )
    parser.add_argument(
        '--check',
        action='store_true',
        help='Validate recovery in a temporary directory without modifying tracked files.',
    )
    args = parser.parse_args()

    if not ROOT.exists():
        raise RuntimeError(f'Image asset directory not found: {ROOT}')

    paths = sorted(
        path
        for path in ROOT.rglob('*')
        if path.is_file() and path.suffix.lower() in FORMAT_FOR_SUFFIX
    )
    if not paths:
        raise RuntimeError('No bundled raster image assets found.')

    repaired = 0
    failures: list[str] = []

    with TemporaryDirectory() as temp_dir:
        temp_root = Path(temp_dir)

        for index, path in enumerate(paths):
            relative = path.relative_to(ROOT.parent)
            try:
                width, height, actual = strict_validate(path)
                print(f'OK {relative} ({width}x{height} {actual})')
                continue
            except Exception as strict_error:
                target = temp_root / f'{index}{path.suffix.lower()}'
                try:
                    width, height, source_format = canonicalize(path, target)
                    if args.check:
                        print(
                            f'RECOVERABLE {relative} ({width}x{height} {source_format}) '
                            f'[{strict_error}]'
                        )
                    else:
                        target.replace(path)
                        print(
                            f'REPAIRED {relative} ({width}x{height} {source_format}) '
                            f'[{strict_error}]'
                        )
                    repaired += 1
                except Exception as recovery_error:
                    failures.append(
                        f'{relative}: strict={strict_error}; recovery={recovery_error}'
                    )

    if failures:
        print('\nBundled image recovery validation failed:')
        for failure in failures:
            print(f'  - {failure}')
        return 1

    action = 'recoverable' if args.check else 'repaired'
    print(
        f'Validated {len(paths)} bundled raster image asset(s); '
        f'{repaired} {action} asset(s).'
    )
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
