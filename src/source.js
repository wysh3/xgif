const resolver = import.meta.env?.VITE_RESOLVER_URL || (import.meta.env?.DEV ? '/api/resolve' : '');
export const videoLimit = 40 * 1024 * 1024;

export async function resolveVideo(post, signal) {
  if (!resolver) throw new Error('X link lookup is unavailable. Open a local video in Options.');
  const endpoint = new URL(resolver, location.href);
  endpoint.searchParams.set('url', post);
  const response = await fetch(endpoint, { signal: AbortSignal.any([signal, AbortSignal.timeout(12_000)]) });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.videos?.length) {
    throw new Error(data?.error || 'Could not find a video in this post.');
  }
  return data.videos;
}

export async function readVideo(response, { limit = videoLimit, onProgress } = {}) {
  if (!response.ok || !response.body) throw new Error('Could not fetch the video from X.');
  const total = Number(response.headers.get('Content-Length')) || 0;
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    if (total > limit) throw new Error('Video is too large. Choose a clip under 40 MB.');
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new Error('Video is too large. Choose a clip under 40 MB.');
      chunks.push(value);
      onProgress?.(size, total);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return new Blob(chunks);
}

export async function fetchVideo(url, signal, onProgress) {
  const response = await fetch(url, {
    referrerPolicy: 'no-referrer',
    signal: AbortSignal.any([signal, AbortSignal.timeout(45_000)]),
  });
  return readVideo(response, { onProgress });
}
