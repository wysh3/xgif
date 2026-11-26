const postHosts = new Set(['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com']);

function parsePost(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !postHosts.has(url.hostname) || url.port || url.username || url.password) {
      return null;
    }
    const match = url.pathname.match(/^\/(?:[\w]{1,15}|i\/web)\/status\/([1-9]\d{0,19})(?:\/video\/([1-9]\d?))?\/?$/);
    return match && { id: match[1], index: match[2] && Number(match[2]) };
  } catch {
    return null;
  }
}

function mp4Variant(media) {
  if (!['video', 'animated_gif'].includes(media?.type)) return null;
  const variants = media.video_info?.variants;
  if (!Array.isArray(variants)) return null;
  return variants.filter((variant) => {
    if (variant?.content_type !== 'video/mp4') return false;
    try {
      const url = new URL(variant.url);
      return url.origin === 'https://video.twimg.com' && !url.username && !url.password;
    } catch {
      return false;
    }
  }).sort((first, second) => (first.bitrate ?? 0) - (second.bitrate ?? 0)).at(-1)?.url;
}

export async function handleRequest(request, env, fetchUpstream = fetch) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  const headers = { Vary: 'Origin', 'X-Content-Type-Options': 'nosniff' };
  if (origin && origin === env.ALLOWED_ORIGIN) headers['Access-Control-Allow-Origin'] = origin;
  const respond = (body, status) => Response.json(body, { status, headers });

  if (url.pathname !== '/api/resolve') return respond({ error: 'Endpoint not found.' }, 404);
  if (request.method !== 'GET') return respond({ error: 'Use GET for this endpoint.' }, 405);
  if (origin && origin !== env.ALLOWED_ORIGIN) return respond({ error: 'Origin not allowed.' }, 403);
  const post = parsePost(url.searchParams.get('url'));
  if (!post) return respond({ error: 'Paste a link to an individual public X post.' }, 400);

  const upstream = new URL('https://cdn.syndication.twimg.com/tweet-result');
  upstream.searchParams.set('id', post.id);
  // X's public embed service derives its token from the decimal post ID.
  const token = ((Number(post.id) / 1e15) * Math.PI).toString(36).replace(/[0.]/g, '');
  upstream.searchParams.set('token', token);

  try {
    const response = await fetchUpstream(upstream, {
      redirect: 'manual',
      signal: AbortSignal.timeout(8000),
      headers: { Accept: 'application/json', 'User-Agent': 'xgif/0.1' },
    });
    if (response.status === 404 || response.status === 410) {
      return respond({ error: 'X could not find this public post. Try a local video.' }, 404);
    }
    if (!response.ok) {
      console.warn('X embed request returned an upstream error:', response.status);
      return respond({ error: 'X is unavailable right now. Try again or use a local video.' }, 503);
    }

    const data = await response.json();
    const media = Array.isArray(data?.mediaDetails) ? data.mediaDetails : [];
    const videos = media.flatMap((item, offset) => {
      const url = mp4Variant(item);
      const index = offset + 1;
      return url && (!post.index || index === post.index) ? [{ index, url }] : [];
    });
    if (!videos.length) return respond({ error: 'X did not provide a video for this link. Try a local video.' }, 404);
    headers['Cache-Control'] = 'public, max-age=300';
    return respond({ id: post.id, videos }, 200);
  } catch (error) {
    console.error('X embed request failed:', error.name, error.message);
    return respond({ error: 'Could not reach X. Try again or use a local video.' }, 503);
  }
}
