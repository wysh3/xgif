const ramp = ' .,:-+=*#%@';
const shades = Array.from({ length: ramp.length }, (_, index) => {
  const light = Math.round(106 + 149 * index / (ramp.length - 1));
  return `rgb(${light}, ${light}, ${light})`;
});

export function mountArtwork(picture) {
  const artwork = picture.parentElement;
  const image = picture.querySelector('img');
  const screen = artwork.querySelector('canvas');
  const display = screen.getContext('2d', { alpha: false });
  const base = document.createElement('canvas');
  const glyphs = base.getContext('2d', { alpha: false });
  const grid = document.createElement('canvas');
  const sampler = grid.getContext('2d', { willReadFrequently: true });
  if (!display || !glyphs || !sampler) return;

  const motion = matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
  let layout;
  let point;
  let previousX;
  let frame;
  let quiet;
  let damage;

  function render() {
    const width = artwork.clientWidth;
    const height = artwork.clientHeight;
    if (!width || !height || !image.naturalWidth) return;
    const ratio = Math.min(2, devicePixelRatio || 1);
    const source = image.currentSrc;
    if (layout?.width === width && layout.height === height && layout.ratio === ratio && layout.source === source) return;
    settle();

    const fontSize = Math.min(9, Math.max(6, Math.round(width / 150)));
    const rowHeight = fontSize + 1;
    glyphs.font = `600 ${fontSize}px monospace`;
    const cellWidth = glyphs.measureText('@').width;
    const columns = Math.ceil(width / cellWidth);
    const rows = Math.ceil(height / rowHeight);
    layout = { width, height, ratio, source, rowHeight };

    const style = getComputedStyle(artwork);
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const cropWidth = width / scale;
    const cropHeight = height / scale;
    const left = (image.naturalWidth - cropWidth) * Number(style.getPropertyValue('--crop-x'));
    const top = (image.naturalHeight - cropHeight) * Number(style.getPropertyValue('--crop-y'));

    grid.width = columns;
    grid.height = rows;
    sampler.imageSmoothingQuality = 'high';
    sampler.drawImage(image, left, top, cropWidth, cropHeight, 0, 0, columns, rows);
    const { data } = sampler.getImageData(0, 0, columns, rows);

    base.width = screen.width = Math.round(width * ratio);
    base.height = screen.height = Math.round(height * ratio);
    glyphs.scale(ratio, ratio);
    glyphs.font = `600 ${fontSize}px monospace`;
    glyphs.textBaseline = 'top';
    glyphs.fillStyle = '#000';
    glyphs.fillRect(0, 0, width, height);

    for (let row = 0; row < rows; row += 1) {
      let last = 0;
      for (let column = 0; column < columns; column += 1) {
        const pixel = (row * columns + column) * 4;
        const light = (data[pixel] * .2126 + data[pixel + 1] * .7152 + data[pixel + 2] * .0722) / 255;
        const index = Math.round(Math.pow(light, .72) * (ramp.length - 1));
        if (!index) continue;
        if (index !== last) glyphs.fillStyle = shades[index];
        last = index;
        glyphs.fillText(ramp[index], column * cellWidth, row * rowHeight);
      }
    }

    display.drawImage(base, 0, 0);
  }

  function displace(x, y, width, height, amount) {
    const usableHeight = Math.min(height, base.height - y);
    if (usableHeight <= 0) return;
    display.clearRect(x, y, width, usableHeight);
    display.drawImage(base, x, y, width, usableHeight, x + amount, y, width, usableHeight);
  }

  function paint() {
    frame = undefined;
    if (!point || !layout || !motion.matches) return;
    const bounds = artwork.getBoundingClientRect();
    const { ratio, rowHeight } = layout;
    const y = Math.max(0, Math.floor((point.clientY - bounds.top) / rowHeight));
    const relativeX = (point.clientX - bounds.left) / bounds.width - .5;
    const travel = point.clientX - (previousX ?? point.clientX);
    const shift = Math.round(Math.max(-52, Math.min(52, relativeX * 48 + travel)) * ratio);
    const step = Math.round(base.width * .56);
    previousX = point.clientX;

    if (damage?.row === y && damage.shift === shift) return;
    restoreRows();
    if (!shift) return;
    const rowPixel = offset => Math.round((y + offset) * rowHeight * ratio);
    const top = rowPixel(0);
    const end = rowPixel(5);
    damage = { row: y, shift, top, height: Math.min(end, base.height) - top };
    displace(0, top, step, rowPixel(1) - top, shift);
    displace(step, rowPixel(1), base.width - step, rowPixel(3) - rowPixel(1), shift);
    displace(0, rowPixel(4), base.width, end - rowPixel(4), Math.round(-shift * .55));
    artwork.setAttribute('data-tracking', '');
  }

  function restoreRows() {
    if (!damage) return;
    const { top, height } = damage;
    if (height > 0) display.drawImage(base, 0, top, base.width, height, 0, top, base.width, height);
    damage = undefined;
    artwork.removeAttribute('data-tracking');
  }

  function settle() {
    clearTimeout(quiet);
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
    point = undefined;
    previousX = undefined;
    restoreRows();
  }

  image.addEventListener('load', render);
  new ResizeObserver(render).observe(artwork);
  if (image.complete) render();

  artwork.addEventListener('pointermove', event => {
    if (!layout || !motion.matches || event.pointerType === 'touch') return;
    point = event;
    frame ??= requestAnimationFrame(paint);
    clearTimeout(quiet);
    quiet = setTimeout(settle, 150);
  }, { passive: true });
  artwork.addEventListener('pointerleave', settle);
  motion.addEventListener('change', settle);
}
