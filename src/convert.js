import { FFmpeg } from '@ffmpeg/ffmpeg';

const coreBase = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';
const stickerLimit = 500_000;

export async function convertClip(file, format, start, length, report) {
  const engine = new FFmpeg();
  try {
    report('Loading the video converter…');
    await engine.load({
      coreURL: `${coreBase}/ffmpeg-core.js`,
      wasmURL: `${coreBase}/ffmpeg-core.wasm`,
    });
    await engine.writeFile('input', new Uint8Array(await file.arrayBuffer()));
    const input = ['-ss', String(start), '-i', 'input', '-t', String(length), '-an', '-map', '0:v:0'];
    if (format === 'gif') {
      report('Making your GIF…');
      const filter = 'fps=12,scale=480:480:force_original_aspect_ratio=decrease:flags=lanczos,setsar=1,split[a][b];[a]palettegen[p];[b][p]paletteuse';
      const code = await engine.exec([...input, '-filter_complex', filter, '-loop', '0', 'output.gif']);
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
      ]);
      if (code !== 0) throw new Error('Could not make a sticker from this clip. Check the file and trim settings.');
      const bytes = await engine.readFile('output.webp');
      if (bytes.length < 100) throw new Error('No frames found. Try an earlier start time.');
      if (bytes.length <= stickerLimit) return new File([bytes], 'xgif-sticker.webp', { type: 'image/webp' });
    }
    throw new Error('The sticker is over 500 KB. Try a shorter clip.');
  } finally {
    engine.terminate();
  }
}
