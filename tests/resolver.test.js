import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleRequest } from '../worker/index.js';

const origin = 'https://wysh3.github.io';
const env = { ALLOWED_ORIGIN: origin };
const cdn = 'https://video.twimg.com/example.mp4';
const post = 'https://x.com/DadSFW/status/2125410973532266600/video/1';
const request = (url, headers = {}) => new Request(
  'https://xgif.example/api/resolve?' + new URLSearchParams({ url }),
  { headers },
);

test('resolves a public video through X embeds and returns only trusted MP4s', async () => {
  const result = await handleRequest(request(post, { Origin: origin }), env, async (upstream) => {
    assert.equal(upstream.hostname, 'cdn.syndication.twimg.com');
    assert.equal(upstream.searchParams.get('id'), '2125410973532266600');
    assert.ok(upstream.searchParams.get('token'));
    return Response.json({ mediaDetails: [{
      type: 'video',
      video_info: { variants: [
        { content_type: 'video/mp4', bitrate: 40000, url: cdn },
        { content_type: 'video/mp4', bitrate: 30000, url: 'https://example.com/a.mp4' },
      ] },
    }] });
  });
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('Access-Control-Allow-Origin'), origin);
  assert.deepEqual(await result.json(), { id: '2125410973532266600', videos: [{ index: 1, url: cdn }] });
});

test('rejects URLs outside the supported post path before making a request', async () => {
  for (const url of ['https://example.com/i/status/123', 'https://x.com/DadSFW', 'http://x.com/i/status/123']) {
    const result = await handleRequest(request(url), env, () => assert.fail('unexpected upstream request'));
    assert.equal(result.status, 400);
  }
});

test('normalizes an /i/status link and reports unavailable media', async () => {
  const result = await handleRequest(request('https://x.com/i/status/2122936075857666221'), env,
    async () => Response.json({ mediaDetails: [{ type: 'photo' }] }));
  assert.equal(result.status, 404);
});

test('reports upstream throttling as a retryable failure', async () => {
  const result = await handleRequest(request(post), env, async () => new Response(null, { status: 429 }));
  assert.equal(result.status, 503);
});
