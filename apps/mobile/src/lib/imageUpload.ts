export const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;

export type SupportedImageContentType = 'image/jpeg' | 'image/png' | 'image/webp';
export type SupportedImageExtension = 'jpg' | 'png' | 'webp';

export type PreparedImageUpload = {
  bytes: ArrayBuffer;
  contentType: SupportedImageContentType;
  extension: SupportedImageExtension;
  byteLength: number;
};

function exactArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export function decodeImageBase64(base64: string): ArrayBuffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = base64.replace(/^data:[^,]+,/, '').replace(/\s/g, '').replace(/=+$/, '');
  const outputLength = Math.floor((clean.length * 6) / 8);
  const bytes = new Uint8Array(outputLength);
  let buffer = 0;
  let bits = 0;
  let offset = 0;

  for (const char of clean) {
    const value = alphabet.indexOf(char);
    if (value < 0) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[offset++] = (buffer >> bits) & 0xff;
    }
  }

  return exactArrayBuffer(bytes.subarray(0, offset));
}

function detectImageType(bytes: Uint8Array): Pick<PreparedImageUpload, 'contentType' | 'extension'> | null {
  if (bytes.byteLength >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { contentType: 'image/jpeg', extension: 'jpg' };
  }

  if (
    bytes.byteLength >= 8
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
    && bytes[4] === 0x0d
    && bytes[5] === 0x0a
    && bytes[6] === 0x1a
    && bytes[7] === 0x0a
  ) {
    return { contentType: 'image/png', extension: 'png' };
  }

  if (
    bytes.byteLength >= 12
    && bytes[0] === 0x52
    && bytes[1] === 0x49
    && bytes[2] === 0x46
    && bytes[3] === 0x46
    && bytes[8] === 0x57
    && bytes[9] === 0x45
    && bytes[10] === 0x42
    && bytes[11] === 0x50
  ) {
    return { contentType: 'image/webp', extension: 'webp' };
  }

  return null;
}

function validatePreparedImage(bytes: ArrayBuffer, declaredJpeg = false, maxBytes = MAX_IMAGE_UPLOAD_BYTES): PreparedImageUpload {
  if (!bytes.byteLength) throw new Error('Selected image is empty.');
  if (bytes.byteLength > maxBytes) throw new Error(`Photos must be ${Math.round(maxBytes / 1024 / 1024)} MB or smaller.`);

  const typed = new Uint8Array(bytes);
  const detected = detectImageType(typed);
  const format = detected ?? (declaredJpeg ? { contentType: 'image/jpeg' as const, extension: 'jpg' as const } : null);
  if (!format) {
    throw new Error('That image format could not be prepared safely. Choose a JPG, PNG, or WebP image and try again.');
  }

  return {
    bytes: exactArrayBuffer(typed),
    contentType: format.contentType,
    extension: format.extension,
    byteLength: bytes.byteLength,
  };
}

export function preparePickerBase64Image(base64: string, maxBytes = MAX_IMAGE_UPLOAD_BYTES): PreparedImageUpload {
  // Expo ImagePicker returns JPEG data when base64 is requested, so this path
  // gives uploads one predictable format even when the original library asset
  // was HEIC/HEIF or another phone-native format.
  return validatePreparedImage(decodeImageBase64(base64), true, maxBytes);
}

export async function prepareLocalImage(input: {
  uri: string;
  base64?: string | null;
  maxBytes?: number;
}): Promise<PreparedImageUpload> {
  if (input.base64) return preparePickerBase64Image(input.base64, input.maxBytes);

  const response = await fetch(input.uri);
  if (!response.ok && response.status !== 0) throw new Error(`Unable to read the selected image (${response.status}).`);
  return validatePreparedImage(await response.arrayBuffer(), false, input.maxBytes);
}
