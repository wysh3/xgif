import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pastedPost } from '../src/post.js';
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

test('photo links resolve the post video while video links keep their attachment index', async () => {
  const base = 'https://x.com/d0llxzp/status/2126393623139004686';
  const video = url => ({ type: 'animated_gif', video_info: { variants: [{ content_type: 'video/mp4', url }] } });
  const second = 'https://video.twimg.com/second.mp4';
  const fetchEmbed = async upstream => {
    assert.equal(upstream.searchParams.get('id'), '2126393623139004686');
    return Response.json({ mediaDetails: [video(cdn), video(second)] });
  };

  for (const suffix of ['/', '/photo/1', '/photo/2/?s=20']) {
    const result = await handleRequest(request(base + suffix), env, fetchEmbed);
    assert.equal(result.status, 200);
    assert.deepEqual((await result.json()).videos, [{ index: 1, url: cdn }, { index: 2, url: second }]);
  }
  const selected = await handleRequest(request(base + '/video/2'), env, fetchEmbed);
  assert.deepEqual((await selected.json()).videos, [{ index: 2, url: second }]);
});

test('extracts supported X links from plain text and Markdown paste', () => {
  const photo = 'https://x.com/d0llxzp/status/2126393623139004686/photo/1';
  const legacy = 'https://mobile.twitter.com/i/web/status/2122936075857666221?s=20';
  assert.equal(pastedPost(photo), photo);
  assert.equal(pastedPost(`Try [this link](${photo}).`), photo);
  assert.equal(pastedPost(`Watch ${legacy}`), legacy);
  assert.equal(pastedPost('https://x.com@evil.example/i/status/123'), undefined);
});

test('explains when an X post is unavailable through public embeds', async () => {
  const result = await handleRequest(request('https://x.com/i/status/1755741549785493537'), env,
    async () => Response.json({ __typename: 'TweetTombstone', tombstone: {} }));
  assert.equal(result.status, 404);
  assert.match((await result.json()).error, /public embeds/);
});
