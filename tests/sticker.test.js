import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasAnimatedWebPFrames } from '../src/sticker.js';

function chunk(type, bytes) {
  const header = Buffer.alloc(8);
  header.write(type);
  header.writeUInt32LE(bytes.length, 4);
  return Buffer.concat([header, bytes, Buffer.alloc(bytes.length % 2)]);
}

function webp(...chunks) {
  return chunk('RIFF', Buffer.concat([Buffer.from('WEBP'), ...chunks]));
}

const frame = Buffer.alloc(16);
frame[12] = 83;
const animation = chunk('ANIM', Buffer.alloc(6));

test('requires multiple timed WebP animation frames', () => {
  assert.equal(hasAnimatedWebPFrames(webp(chunk('VP8 ', Buffer.alloc(128)))), false);
  assert.equal(hasAnimatedWebPFrames(webp(animation, chunk('ANMF', frame))), false);
  assert.equal(hasAnimatedWebPFrames(webp(animation, chunk('ANMF', frame), chunk('ANMF', frame))), true);
});

test('rejects truncated WebP container data', () => {
  const bytes = webp(animation, chunk('ANMF', frame), chunk('ANMF', frame));
  assert.equal(hasAnimatedWebPFrames(bytes.subarray(0, -1)), false);
});
