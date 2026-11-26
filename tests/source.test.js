import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readVideo } from '../src/source.js';

test('bounds streamed input when X omits its content length', async () => {
  const response = new Response(new Uint8Array(9));
  await assert.rejects(readVideo(response, { limit: 8 }), /too large/i);
});

test('reports actual byte progress only when total length is known', async () => {
  const updates = [];
  const bytes = new Uint8Array([1, 2, 3, 4]);
  const response = new Response(bytes, { headers: { 'Content-Length': '4' } });
  const result = await readVideo(response, { onProgress: (...update) => updates.push(update) });
  assert.deepEqual(new Uint8Array(await result.arrayBuffer()), bytes);
  assert.deepEqual(updates.at(-1), [4, 4]);
});
