import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import './style.css';
import { fetchVideo, resolveVideo, videoLimit } from './source.js';
import { stickerMaxSeconds } from './sticker.js';

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
const lengthInput = byId('length');
const formatInput = form.elements.namedItem('format');
const result = byId('result');
const preview = byId('preview');
const share = byId('share');
const copy = byId('copy');
const status = byId('status');
const progress = byId('progress');
const working = byId('working');
const convert = byId('convert');
const save = byId('save');
const paste = byId('paste');
const chooseVideo = byId('choose-video');
const clear = byId('remove-file');

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
  convert.hidden = !hasSource;
  clear.hidden = !hasSource;
  clear.setAttribute('aria-label', localFile ? 'Remove video' : 'Clear link');
  const name = byId('file-name');
  name.textContent = localFile?.name || '';
  name.title = name.textContent;
  name.hidden = !localFile;
  post.labels[0].textContent = localFile ? 'Video file' : 'X post link';
  post.hidden = Boolean(localFile);
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

async function pasteLink() {
  if (job || readingClipboard) return;
  readingClipboard = true;
  paste.disabled = true;
  chooseVideo.disabled = true;
  try {
    const contents = await navigator.clipboard.readText();
    const value = contents.match(/https?:\/\/[^\s<>]+/i)?.[0];
    if (!value) throw new Error('Clipboard has no link');
    const changed = Boolean(localFile || post.value.trim() !== value);
    localFile = undefined;
    post.value = value;
    if (changed) resetSource();
    updateInput();
  } catch {
    report('Paste an X link into the field to continue.');
    (localFile ? convert : post).focus();
    return;
  } finally {
    readingClipboard = false;
    paste.disabled = false;
    chooseVideo.disabled = false;
  }
  form.requestSubmit();
}

async function acquireVideo(input, signal) {
  if (localFile) {
    if (localFile.size > videoLimit) throw new Error('Video is too large. Choose a clip under 40 MB.');
    return localFile;
  }
  if (resolved?.input !== input) {
    report('Finding the video on X...');
    const videos = await resolveVideo(input, signal);
    signal.throwIfAborted();
    resolved = { input, videos };
    clip.replaceChildren(...videos.map(({ index }) => new Option(`Video ${index}`)));
    byId('clip-picker').hidden = videos.length < 2;
  }
  const url = resolved.videos[clip.selectedIndex]?.url;
  if (!url) throw new Error('No video was selected.');
  if (cachedVideo?.url === url) return cachedVideo.blob;
  report('Fetching the video...');
  const blob = await fetchVideo(url, signal, (bytes, total) => {
    report('Fetching the video...', total ? bytes / total : undefined);
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
  byId('result-name').textContent = sticker ? 'animated WebP sticker' : 'animated GIF';
  byId('result-size').textContent = value.size >= 1_000_000
    ? `${(value.size / 1_000_000).toFixed(1)} MB`
    : `${Math.max(1, Math.round(value.size / 1000))} KB`;
  share.hidden = !navigator.share || !navigator.canShare?.({ files: [value] });
  copy.hidden = !navigator.clipboard?.write || !globalThis.ClipboardItem ||
    (value.type !== 'image/gif' && !ClipboardItem.supports?.(value.type));
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
chooseVideo.addEventListener('click', () => file.click());
paste.addEventListener('click', pasteLink);
document.addEventListener('keydown', event => {
  if (event.defaultPrevented || options.open || job || readingClipboard) return;
  if (event.key === '/' && !event.altKey && !event.metaKey && !event.ctrlKey &&
      !localFile && !event.target.closest('input, textarea, select, [contenteditable]')) {
    event.preventDefault();
    post.focus();
  }
});
file.addEventListener('change', () => {
  const next = file.files[0];
  file.value = '';
  if (next) selectFile(next);
});
clear.addEventListener('click', () => {
  localFile = undefined;
  post.value = '';
  resetSource();
  updateInput();
  post.focus();
});
post.addEventListener('input', () => {
  const samePost = !localFile && resolved?.input === post.value.trim();
  localFile = undefined;
  if (!samePost) resetSource();
  post.removeAttribute('aria-invalid');
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
  if (event.target.name === 'format') updateTrimLimit();
  if (event.target === clip || event.target.name === 'format' || trim.contains(event.target)) resetResult();
});

function updateTrimLimit() {
  const sticker = formatInput.value === 'webp';
  lengthInput.max = sticker ? String(stickerMaxSeconds) : '';
  byId('trim-help').textContent = sticker
    ? `Leave length blank to use up to ${stickerMaxSeconds} seconds from the start time.`
    : 'Leave length blank to use the rest of the source.';
}
updateTrimLimit();

byId('cancel').addEventListener('click', () => job?.abort());
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (job || readingClipboard) return;
  const input = post.value.trim();
  if ((!localFile && !input) || !form.reportValidity()) return;
  resetResult();

  const current = new AbortController();
  job = current;
  const format = formatInput.value;
  const start = byId('start').valueAsNumber;
  const length = lengthInput.value === '' ? undefined : lengthInput.valueAsNumber;
  controls.disabled = true;
  optionsButton.disabled = true;
  chooseVideo.disabled = true;
  convert.firstElementChild.textContent = 'working';
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
    optionsButton.disabled = false;
    chooseVideo.disabled = false;
    convert.firstElementChild.textContent = 'convert';
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
function gifClipboardMarkup(gif) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Blob([
      `<img src="${reader.result}" alt="Animated GIF">`,
    ], { type: 'text/html' }));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(gif);
  });
}

copy.addEventListener('click', async () => {
  const value = output;
  if (!value) return;
  const useMarkup = value.type === 'image/gif' && !ClipboardItem.supports?.(value.type);
  try {
    const payload = useMarkup ? { 'text/html': gifClipboardMarkup(value) } : { [value.type]: value };
    await navigator.clipboard.write([new ClipboardItem(payload)]);
    if (output === value) report(useMarkup ? 'GIF copied for apps that accept rich paste.' : 'Animation copied.');
  } catch {
    if (output === value) report('Copy failed. Use Share or Save to keep the animation.', undefined, true);
  }
});
