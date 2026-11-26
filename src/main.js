import './style.css';
import { fetchVideo, resolveVideo, videoLimit } from './source.js';

const byId = id => document.getElementById(id);
const form = byId('converter');
const workspace = document.querySelector('.workspace');
const controls = byId('controls');
const post = byId('post');
const file = byId('file');
const clip = byId('clip');
const options = byId('options');
const optionsButton = byId('toggle-options');
const trim = byId('trim-options');
const trimButton = byId('toggle-trim');
const result = byId('result');
const preview = byId('preview');
const share = byId('share');
const copy = byId('copy');
const status = byId('status');
const progress = byId('progress');
const working = byId('working');
const convert = byId('convert');
const save = byId('save');

let localFile;
let resolved;
let cachedVideo;
let output;
let objectUrl;
let job;
let readingClipboard = false;

function report(message, value, error = false) {
  if (status.textContent !== message) status.textContent = message;
  status.toggleAttribute('data-error', error);
  if (Number.isFinite(value)) progress.value = Math.max(0, Math.min(1, value));
  else progress.removeAttribute('value');
}

function setOptions(open) {
  if (open === options.open) return;
  if (open) options.showModal();
  else options.close();
  optionsButton.setAttribute('aria-expanded', String(open));
}

function setTrim(open) {
  trim.hidden = !open;
  trimButton.setAttribute('aria-expanded', String(open));
}

function resetResult() {
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = undefined;
  output = undefined;
  result.hidden = true;
  preview.removeAttribute('src');
  save.removeAttribute('href');
  report('');
}

function resetSource() {
  resolved = undefined;
  cachedVideo = undefined;
  clip.replaceChildren();
  byId('clip-picker').hidden = true;
  post.removeAttribute('aria-invalid');
  resetResult();
}

function updateInput() {
  const hasSource = Boolean(localFile || post.value.trim());
  byId('convert-text').textContent = hasSource ? 'Convert' : 'Paste';
  convert.setAttribute('aria-label', hasSource ? 'Convert' : 'Paste & convert');
  const name = byId('file-name');
  name.textContent = localFile?.name || '';
  name.title = name.textContent;
  name.hidden = !localFile;
  post.hidden = Boolean(localFile);
  byId('remove-file').hidden = !localFile;
}

function selectFile(candidate) {
  if (!candidate.type.startsWith('video/') && !/\.(mp4|m4v|webm|mov|mkv|avi|mpg|mpeg|3gp|ogv)$/i.test(candidate.name)) {
    report('Choose a video file.', undefined, true);
    return;
  }
  resetSource();
  localFile = candidate;
  post.value = '';
  updateInput();
  setOptions(false);
  convert.focus();
}

async function readClipboard() {
  readingClipboard = true;
  convert.disabled = true;
  try {
    const value = (await navigator.clipboard.readText()).trim();
    if (!value) throw new Error('Empty clipboard');
    post.value = value;
    resetSource();
    updateInput();
  } catch {
    report('Paste an X link into the field to continue.');
    post.focus();
  } finally {
    readingClipboard = false;
    convert.disabled = false;
  }
  return post.value.trim();
}

async function acquireVideo(input, signal) {
  if (localFile) {
    if (localFile.size > videoLimit) throw new Error('Video is too large. Choose a clip under 40 MB.');
    return localFile;
  }
  if (resolved?.input !== input) {
    report('Finding the video on X…');
    const videos = await resolveVideo(input, signal);
    signal.throwIfAborted();
    resolved = { input, videos };
    clip.replaceChildren(...videos.map(({ index }) => new Option(`Video ${index}`)));
    byId('clip-picker').hidden = videos.length < 2;
  }
  const url = resolved.videos[clip.selectedIndex]?.url;
  if (!url) throw new Error('No video was selected.');
  if (cachedVideo?.url === url) return cachedVideo.blob;
  report('Fetching the video…');
  const blob = await fetchVideo(url, signal, (bytes, total) => {
    report('Fetching the video…', total ? bytes / total : undefined);
  });
  signal.throwIfAborted();
  cachedVideo = { url, blob };
  return blob;
}

function showResult(value) {
  output = value;
  objectUrl = URL.createObjectURL(value);
  preview.src = objectUrl;
  save.href = objectUrl;
  save.download = value.name;
  const sticker = value.type === 'image/webp';
  byId('result-name').textContent = sticker ? 'Animated WebP sticker' : 'Animated GIF';
  byId('result-size').textContent = value.size >= 1_000_000
    ? `${(value.size / 1_000_000).toFixed(1)} MB`
    : `${Math.max(1, Math.round(value.size / 1000))} KB`;
  share.hidden = !navigator.share || !navigator.canShare?.({ files: [value] });
  copy.hidden = !navigator.clipboard?.write || !globalThis.ClipboardItem?.supports?.(value.type);
  const help = byId('result-help');
  help.textContent = sticker
    ? 'For a native WhatsApp sticker, import the animated WebP in a compatible sticker app.'
    : '';
  help.hidden = !help.textContent;
  result.hidden = false;
  result.focus({ preventScroll: true });
  result.scrollIntoView({ block: 'nearest', behavior: 'instant' });
}

optionsButton.addEventListener('click', () => setOptions(true));
byId('close-options').addEventListener('click', () => setOptions(false));
options.addEventListener('close', () => optionsButton.setAttribute('aria-expanded', 'false'));
trimButton.addEventListener('click', () => setTrim(trim.hidden));
byId('choose-video').addEventListener('click', () => file.click());
file.addEventListener('change', () => {
  const next = file.files[0];
  file.value = '';
  if (next) selectFile(next);
});
byId('remove-file').addEventListener('click', () => {
  localFile = undefined;
  resetSource();
  updateInput();
  post.focus();
});
post.addEventListener('input', () => {
  const samePost = !localFile && resolved?.input === post.value.trim();
  localFile = undefined;
  if (!samePost) resetSource();
  updateInput();
});

const hasFile = event => Array.from(event.dataTransfer.types).includes('Files');
workspace.addEventListener('dragover', event => {
  if (!hasFile(event)) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = job ? 'none' : 'copy';
  workspace.toggleAttribute('data-drop', !job);
});
workspace.addEventListener('dragleave', event => {
  if (!workspace.contains(event.relatedTarget)) workspace.removeAttribute('data-drop');
});
workspace.addEventListener('drop', event => {
  if (!hasFile(event)) return;
  event.preventDefault();
  workspace.removeAttribute('data-drop');
  const next = event.dataTransfer.files[0];
  if (next && !job && !readingClipboard) selectFile(next);
});
form.addEventListener('invalid', event => {
  if (trim.contains(event.target)) {
    setOptions(true);
    setTrim(true);
  } else if (event.target === post) {
    post.setAttribute('aria-invalid', 'true');
    report('Enter a complete link to a public X post.', undefined, true);
  }
}, true);
form.addEventListener('change', event => {
  if (event.target === clip || event.target.name === 'format' || trim.contains(event.target)) resetResult();
});

byId('cancel').addEventListener('click', () => job?.abort());
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (job || readingClipboard) return;
  const input = post.value.trim() || (localFile ? '' : await readClipboard());
  if ((!localFile && !input) || !form.reportValidity()) return;
  resetResult();

  const current = new AbortController();
  job = current;
  const format = form.elements.namedItem('format').value;
  const start = byId('start').valueAsNumber;
  const length = byId('length').valueAsNumber;
  controls.disabled = true;
  working.hidden = false;
  try {
    const [video, encoder] = await Promise.all([acquireVideo(input, current.signal), import('./convert.js')]);
    current.signal.throwIfAborted();
    const animated = await encoder.convertClip(video, format, start, length, report, current.signal);
    current.signal.throwIfAborted();
    report('');
    showResult(animated);
  } catch (error) {
    if (current.signal.aborted) {
      report('Conversion canceled.');
    } else {
      const detail = ['TimeoutError', 'TypeError'].includes(error?.name)
        ? 'The connection timed out or was interrupted. Try again.'
        : error?.message || 'Could not convert this video.';
      report(detail, undefined, true);
    }
  } finally {
    const canceled = current.signal.aborted;
    working.hidden = true;
    controls.disabled = false;
    job = undefined;
    if (canceled) convert.focus();
  }
});

share.addEventListener('click', async () => {
  if (!output) return;
  try {
    await navigator.share({ files: [output] });
  } catch (error) {
    if (error?.name !== 'AbortError') report('Sharing failed. You can save the animated file.', undefined, true);
  }
});
copy.addEventListener('click', async () => {
  if (!output) return;
  try {
    await navigator.clipboard.write([new ClipboardItem({ [output.type]: output })]);
    report('Animation copied.');
  } catch {
    report('Copy failed. Use Share or Save to keep the animation.', undefined, true);
  }
});

const loadArtwork = () => {
  import('./artwork.js').then(({ mountArtwork }) => mountArtwork(byId('art'))).catch(() => {});
};
if ('requestIdleCallback' in window) window.requestIdleCallback(loadArtwork, { timeout: 600 });
else window.requestAnimationFrame(() => window.setTimeout(loadArtwork, 0));
