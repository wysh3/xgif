import { FFmpeg } from '@ffmpeg/ffmpeg';
import { hasAnimatedWebPFrames } from './sticker.js';

const coreBase = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';
const stickerLimit = 500_000;
let worker;
let idleTimer;

function release(engine) {
  if (worker === engine) worker = undefined;
  engine.terminate();
}

export async function convertClip(file, format, start, length, report, signal) {
  signal.throwIfAborted();
  clearTimeout(idleTimer);
  const engine = worker ??= new FFmpeg();
  const abort = () => release(engine);
  signal.addEventListener('abort', abort, { once: true });
  try {
    if (!engine.loaded) {
      report('Loading the converter…');
      let expired = false;
      const timeout = setTimeout(() => {
        expired = true;
        release(engine);
      }, 65_000);
      try {
        await engine.load({
          coreURL: `${coreBase}/ffmpeg-core.js`,
          wasmURL: `${coreBase}/ffmpeg-core.wasm`,
        });
      } catch (error) {
        release(engine);
        if (expired) throw new Error('The converter took too long to load. Try again.');
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    }
    signal.throwIfAborted();
    return await encode(engine, file, format, start, length, report, signal);
  } finally {
    signal.removeEventListener('abort', abort);
    if (worker === engine && engine.loaded) {
      await Promise.allSettled(['input', 'output.gif', 'output.webp'].map(path => engine.deleteFile(path)));
      idleTimer = setTimeout(() => release(engine), 45_000);
    }
  }
}

async function encode(engine, file, format, start, length, report, signal) {
  const inputBytes = new Uint8Array(await file.arrayBuffer());
  signal.throwIfAborted();
  await engine.writeFile('input', inputBytes);
  const input = ['-ss', String(start), '-i', 'input', '-t', String(length), '-an', '-map', '0:v:0'];
  if (format === 'gif') {
    report('Making your GIF…');
    const filter = 'fps=12,scale=480:480:force_original_aspect_ratio=decrease:flags=lanczos,setsar=1,split[a][b];[a]palettegen[p];[b][p]paletteuse';
    const code = await engine.exec([...input, '-filter_complex', filter, '-loop', '0', 'output.gif'], 45_000);
    if (code !== 0) throw new Error('Could not make a GIF from this clip. Check the file and trim settings.');
    const bytes = await engine.readFile('output.gif');
    if (bytes.length < 100) throw new Error('No frames found. Try an earlier start time.');
    return new File([bytes], 'xgif.gif', { type: 'image/gif' });
  }
  report('Making your animated sticker…');
  for (const { fps, size, quality } of [
    { fps: 12, size: 512, quality: 65 },
    { fps: 10, size: 384, quality: 45 },
    { fps: 8, size: 288, quality: 32 },
    { fps: 6, size: 224, quality: 22 },
  ]) {
    const filter = `fps=${fps},scale=${size}:${size}:force_original_aspect_ratio=decrease,setsar=1,format=yuva420p,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black@0`;
    const code = await engine.exec([
      ...input, '-vf', filter, '-c:v', 'libwebp_anim', '-q:v', String(quality), '-loop', '0', 'output.webp',
    ], 45_000);
    if (code !== 0) throw new Error('Could not make a sticker from this clip. Check the file and trim settings.');
    const bytes = await engine.readFile('output.webp');
    if (bytes.length < 100) throw new Error('No frames found. Try an earlier start time.');
    if (!hasAnimatedWebPFrames(bytes)) {
      throw new Error('This selection did not produce an animated sticker. Try a longer or more active part of the video.');
    }
    if (bytes.length <= stickerLimit) return new File([bytes], 'xgif-sticker.webp', { type: 'image/webp' });
  }
  throw new Error('The sticker is over 500 KB. Try a shorter clip.');
}
