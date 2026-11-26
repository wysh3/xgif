import './style.css';
import { mountArtwork } from './artwork.js';

const find = (id) => document.getElementById(id);
const form = find('converter');
const dropZone = form.closest('.studio');
const controls = find('controls');
const post = find('post');
const filePicker = find('file');
const clipPicker = find('clip-picker');
const clip = find('clip');
const status = find('status');
const spinner = document.querySelector('.spinner');
const convert = find('convert');
const options = find('toggle-options');
const optionsPanel = find('options');
const trim = find('toggle-trim');
const trimOptions = find('trim-options');
const fileName = find('file-name');
const removeFile = find('remove-file');
const sourceIcon = find('source-icon');
const result = find('result');
const preview = find('preview');
const share = find('share');
const copy = find('copy');
const save = find('save');

const resolver = import.meta.env.VITE_RESOLVER_URL
  || (import.meta.env.DEV ? '/api/resolve' : '');
const maxBytes = 40 * 1024 * 1024;
mountArtwork(form);
let selectedFile;
let resolvedPost;
let output;
let previewURL;
let readingClipboard = false;

const activity = spinner.parentElement;
new IntersectionObserver(([entry]) => {
  activity.toggleAttribute('data-visible', entry.isIntersecting);
}).observe(activity);

function setOptions(open) {
  if (optionsPanel.open === open) return;
  if (open) {
    const anchor = options.getBoundingClientRect();
    optionsPanel.style.setProperty('--options-top', `${Math.round(anchor.bottom + 8)}px`);
    optionsPanel.style.setProperty('--options-right', `${Math.round(window.innerWidth - anchor.right)}px`);
    optionsPanel.showModal();
  } else {
    optionsPanel.close();
  }
  options.setAttribute('aria-expanded', String(open));
}
options.addEventListener('click', () => setOptions(true));
find('close-options').addEventListener('click', () => setOptions(false));
optionsPanel.addEventListener('close', () => {
  options.setAttribute('aria-expanded', 'false');
});

function setTrim(open) {
  trim.setAttribute('aria-expanded', String(open));
  trimOptions.hidden = !open;
}

trim.addEventListener('click', () => setTrim(trimOptions.hidden));
form.addEventListener('invalid', (event) => {
  if (trimOptions.contains(event.target)) {
    setOptions(true);
    setTrim(true);
  }
  if (event.target === post) reportPostError('Paste a complete link to a public X post.');
}, true);

function report(message, error = false) {
  spinner.hidden = !message || !controls.disabled || error;
  status.textContent = message;
  status.toggleAttribute('data-error', error);
}

function reportPostError(message) {
  post.setAttribute('aria-invalid', 'true');
  report(message, true);
}

function clearResult() {
  if (previewURL) URL.revokeObjectURL(previewURL);
  previewURL = undefined;
  output = undefined;
  preview.removeAttribute('src');
  save.removeAttribute('href');
  result.hidden = true;
}

function resetSource() {
  post.removeAttribute('aria-invalid');
  resolvedPost = undefined;
  clip.replaceChildren();
  clipPicker.hidden = true;
  clearResult();
  report('');
}

function updateSourceField() {
  const hasSource = Boolean(selectedFile || post.value.trim());
  find('convert-text').textContent = hasSource ? 'Convert' : 'Paste';
  find('convert-icon').setAttribute('href', hasSource ? '#icon-arrow' : '#icon-paste');
  convert.setAttribute('aria-label', hasSource ? 'Convert' : 'Paste & convert');
  fileName.textContent = selectedFile?.name ?? '';
  fileName.title = fileName.textContent;
  fileName.hidden = !selectedFile;
  removeFile.hidden = !selectedFile;
  post.hidden = Boolean(selectedFile);
  sourceIcon.setAttribute('href', selectedFile ? '#icon-folder' : '#icon-link');
}

function selectFile(file) {
  if (!file.type.startsWith('video/') && !/\.(mp4|m4v|webm|mov|mkv|avi|mpeg|mpg|3gp|ogv)$/i.test(file.name)) {
    report('Choose a video file to convert.', true);
    return;
  }
  resetSource();
  selectedFile = file;
  post.value = '';
  updateSourceField();
  setOptions(false);
  convert.focus();
}

function clearFile() {
  selectedFile = undefined;
  filePicker.value = '';
  updateSourceField();
}

post.addEventListener('input', () => {
  clearFile();
  resetSource();
});
removeFile.addEventListener('click', () => {
  clearFile();
  resetSource();
  post.focus();
});
find('choose-video').addEventListener('click', () => filePicker.click());
filePicker.addEventListener('change', () => {
  const file = filePicker.files[0];
  filePicker.value = '';
  if (file) selectFile(file);
});
dropZone.addEventListener('dragover', (event) => {
  if (!Array.from(event.dataTransfer.types).includes('Files')) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = controls.disabled ? 'none' : 'copy';
  dropZone.toggleAttribute('data-drop', !controls.disabled);
});
dropZone.addEventListener('dragleave', (event) => {
  if (!dropZone.contains(event.relatedTarget)) dropZone.removeAttribute('data-drop');
});
dropZone.addEventListener('drop', (event) => {
  if (!Array.from(event.dataTransfer.types).includes('Files')) return;
  event.preventDefault();
  dropZone.removeAttribute('data-drop');
  if (!controls.disabled && event.dataTransfer.files[0]) selectFile(event.dataTransfer.files[0]);
});

async function pasteLink() {
  readingClipboard = true;
  convert.disabled = true;
  try {
    const value = (await navigator.clipboard.readText()).trim();
    if (!value) throw new Error('Empty clipboard');
    post.value = value;
    post.dispatchEvent(new Event('input'));
  } catch {
    report('Paste your X link into the field to continue.');
    post.focus();
    return;
  } finally {
    readingClipboard = false;
    convert.disabled = false;
  }
  if (!post.validity.valid) {
    reportPostError('Copy a link to a public X post, then try again.');
    post.focus();
    return;
  }
  return post.value;
}

form.addEventListener('change', (event) => {
  if (event.target === clip || ['format', 'start', 'length'].includes(event.target.name || event.target.id)) {
    clearResult();
    report('');
  }
});

async function resolvePost(value) {
  if (resolvedPost?.input === value) return resolvedPost.videos[clip.selectedIndex];
  if (!resolver) throw new Error('X link lookup is offline. Choose a video to convert it here.');
  report('Finding the X video…');
  const url = new URL(resolver, window.location.href);
  url.searchParams.set('url', value);
  const response = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.videos?.length) {
    if (response.status === 400) post.setAttribute('aria-invalid', 'true');
    throw new Error(data?.error || 'Could not look up this X link. Try again or choose a video.');
  }
  resolvedPost = { input: value, videos: data.videos };
  clip.replaceChildren(...data.videos.map(({ index }) => new Option(`Video ${index}`)));
  clipPicker.hidden = data.videos.length < 2;
  return data.videos[0];
}

async function readClip(url) {
  report('Getting the video from X…');
  const response = await fetch(url, {
    referrerPolicy: 'no-referrer',
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok || !response.body) throw new Error('Could not get the video from X. Try a local video.');
  const tooLarge = 'This video exceeds 40 MB. Try a shorter source video.';
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    if (Number(response.headers.get('Content-Length')) > maxBytes) throw new Error(tooLarge);
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error(tooLarge);
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return new Blob(chunks);
}

function showOutput(file) {
  output = file;
  previewURL = URL.createObjectURL(file);
  preview.src = previewURL;
  save.href = previewURL;
  save.download = file.name;
  find('result-name').textContent = file.type === 'image/gif' ? 'Animated GIF' : 'Animated WebP sticker';
  find('result-size').textContent = file.size >= 1_000_000
    ? `${(file.size / 1_000_000).toFixed(1)} MB`
    : `${Math.max(1, Math.round(file.size / 1000))} KB`;
  share.hidden = !(navigator.share && navigator.canShare?.({ files: [file] }));
  copy.hidden = !(navigator.clipboard?.write && window.ClipboardItem?.supports?.(file.type));
  const help = find('result-help');
  help.textContent = file.type === 'image/webp'
    ? `${share.hidden ? 'Save' : 'Share or save'} the WebP file to keep it animated. Pasting the preview can produce a still. Use a compatible sticker app to import it into WhatsApp.`
    : copy.hidden && share.hidden
      ? 'Save the GIF to keep it animated. Copying the preview can paste a still image.'
      : '';
  help.hidden = !help.textContent;
  result.hidden = false;
  result.focus({ preventScroll: true });
  result.scrollIntoView({ block: 'nearest' });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (controls.disabled || readingClipboard) return;
  clearResult();
  let value = post.value.trim();
  if (!selectedFile && !value) {
    value = await pasteLink();
    if (!value || !form.reportValidity()) return;
  }
  const format = new FormData(form).get('format');
  const start = find('start').valueAsNumber;
  const length = find('length').valueAsNumber;
  controls.disabled = true;
  form.setAttribute('aria-busy', 'true');
  try {
    if (selectedFile?.size > maxBytes) throw new Error('This video exceeds 40 MB. Try a shorter source video.');
    const input = selectedFile || await readClip((await resolvePost(value)).url);
    const { convertClip } = await import('./convert.js');
    showOutput(await convertClip(input, format, start, length, report));
    report('');
  } catch (error) {
    const message = error instanceof Error && !['TypeError', 'TimeoutError'].includes(error.name)
      ? error.message
      : 'Something interrupted the conversion. Try again or choose a shorter local video.';
    report(message, true);
  } finally {
    controls.disabled = false;
    form.removeAttribute('aria-busy');
  }
});

share.addEventListener('click', async () => {
  if (!output) return;
  try {
    await navigator.share({ files: [output] });
  } catch (error) {
    if (error?.name !== 'AbortError') report('Sharing failed. Try saving the file.', true);
  }
});
copy.addEventListener('click', async () => {
  if (!output) return;
  try {
    await navigator.clipboard.write([new ClipboardItem({ [output.type]: output })]);
    report('Copied the animation file. The app you paste into decides how to display it.');
  } catch {
    report('Copy failed. Use Share when available, or save the file.', true);
  }
});
