export const stickerMaxSeconds = 10;

export function hasAnimatedWebPFrames(bytes) {
  if (bytes.length < 12) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0) !== 0x52494646 || view.getUint32(8) !== 0x57454250) return false;
  if (view.getUint32(4, true) + 8 !== bytes.length) return false;

  let hasAnimation = false;
  let timedFrames = 0;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const kind = view.getUint32(offset);
    const size = view.getUint32(offset + 4, true);
    const data = offset + 8;
    offset = data + size + (size % 2);
    if (offset > bytes.length) return false;
    if (kind === 0x414e494d && size >= 6) hasAnimation = true; // ANIM
    if (kind === 0x414e4d46 && size >= 16) { // ANMF
      const duration = view.getUint16(data + 12, true) + (view.getUint8(data + 14) << 16);
      if (duration >= 8) timedFrames++;
    }
  }
  return offset === bytes.length && hasAnimation && timedFrames >= 2;
}
