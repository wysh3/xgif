import './style.css';

const find = (id) => document.getElementById(id);
const form = find('converter');
const controls = find('controls');
const post = find('post');
const filePicker = find('file');
const clipPicker = find('clip-picker');
const clip = find('clip');
const status = find('status');
const result = find('result');
const preview = find('preview');
const share = find('share');
const copy = find('copy');
const save = find('save');

const resolver = import.meta.env.VITE_RESOLVER_URL
  || (import.meta.env.DEV ? '/api/resolve' : '');
const maxBytes = 40 * 1024 * 1024;
let selectedFile;
let resolvedPost;
let output;
let previewURL;

function report(message, error = false) {
  status.hidden = !message;
  status.textContent = message;
  status.toggleAttribute('data-error', error);
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
  resolvedPost = undefined;
  clip.replaceChildren();
  clipPicker.hidden = true;
  clearResult();
  report('');
}

function clearFile() {
  selectedFile = undefined;
  filePicker.value = '';
  find('file-name').hidden = true;
}

post.addEventListener('input', () => {
  clearFile();
  resetSource();
});
find('choose-video').addEventListener('click', () => filePicker.click());
filePicker.addEventListener('change', () => {
  if (!filePicker.files.length) return;
  resetSource();
  selectedFile = filePicker.files[0];
  post.value = '';
  find('file-name').textContent = selectedFile.name;
  find('file-name').hidden = false;
});
find('paste').addEventListener('click', async () => {
  try {
    const value = await navigator.clipboard.readText();
    if (!value.trim()) throw new Error('Empty clipboard');
    post.value = value.trim();
    post.dispatchEvent(new Event('input'));
  } catch {
    report('Use your device’s Paste command in the link field.');
  }
  post.focus();
});
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
  share.hidden = !navigator.canShare?.({ files: [file] });
  copy.hidden = !(navigator.clipboard?.write && window.ClipboardItem?.supports?.(file.type));
  const help = find('result-help');
  help.textContent = file.type === 'image/webp'
    ? 'Use a compatible sticker app to import this as a native WhatsApp sticker.'
    : '';
  help.hidden = !help.textContent;
  result.hidden = false;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (controls.disabled) return;
  clearResult();
  const value = post.value.trim();
  if (!selectedFile && !value) {
    report('Paste a public X post link or choose a video.', true);
    post.focus();
    return;
  }
  const format = new FormData(form).get('format');
  const start = find('start').valueAsNumber;
  const length = find('length').valueAsNumber;
  controls.disabled = true;
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
    report('Copied the animation.');
  } catch {
    report('Copy failed. Use Share when available, or save the file.', true);
  }
});
