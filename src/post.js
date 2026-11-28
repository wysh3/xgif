const postHosts = new Set(['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com']);
const postPath = /^\/(?:[\w]{1,15}|i\/web)\/status\/([1-9]\d{0,19})(?:\/(photo|video)\/([1-9]\d?))?\/?$/;

export function parsePost(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !postHosts.has(url.hostname) || url.port || url.username || url.password) {
      return null;
    }
    const match = url.pathname.match(postPath);
    if (!match) return null;
    const [, id, attachment, position] = match;
    return { id, index: attachment === 'video' ? Number(position) : undefined };
  } catch {
    return null;
  }
}

export function pastedPost(text) {
  return text.match(/https:\/\/[^\s<>()\[\]"']+/ig)
    ?.map(link => link.replace(/[.,;!?]+$/, ''))
    .find(link => parsePost(link));
}
