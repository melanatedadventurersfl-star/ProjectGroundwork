import fs from 'node:fs';
import path from 'node:path';

const files = [
  'apps/mobile/assets/golden_mountain_sunrise_go_melanated.png',
  'apps/mobile/assets/ma-splash-icon.png',
  'apps/mobile/assets/ma-pathfinder-mark.png',
];

const PNG_SIGNATURE = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);

function validatePng(file) {
  const data = fs.readFileSync(file);
  if (data.length < 20 || !data.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error(`${file}: invalid PNG signature or file is too short`);
  }

  let offset = 8;
  let sawIHDR = false;
  let sawIEND = false;
  let width = 0;
  let height = 0;

  while (offset < data.length) {
    if (offset + 12 > data.length) {
      throw new Error(`${file}: truncated PNG chunk header at byte ${offset}`);
    }

    const length = data.readUInt32BE(offset);
    const type = data.toString('ascii', offset + 4, offset + 8);
    const chunkEnd = offset + 12 + length;
    if (chunkEnd > data.length) {
      throw new Error(`${file}: truncated ${type} chunk (needs ${chunkEnd} bytes, has ${data.length})`);
    }

    if (type === 'IHDR') {
      if (length !== 13) throw new Error(`${file}: invalid IHDR length ${length}`);
      width = data.readUInt32BE(offset + 8);
      height = data.readUInt32BE(offset + 12);
      if (!width || !height) throw new Error(`${file}: invalid dimensions ${width}x${height}`);
      sawIHDR = true;
    }

    offset = chunkEnd;
    if (type === 'IEND') {
      sawIEND = true;
      break;
    }
  }

  if (!sawIHDR) throw new Error(`${file}: missing IHDR chunk`);
  if (!sawIEND) throw new Error(`${file}: missing IEND chunk (truncated PNG)`);
  if (offset !== data.length) {
    throw new Error(`${file}: unexpected trailing bytes after IEND`);
  }

  console.log(`Validated PNG: ${path.normalize(file)} (${width}x${height}, ${data.length} bytes)`);
}

for (const file of files) validatePng(file);
