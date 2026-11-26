function grainTile() {
  const tile = document.createElement('canvas');
  tile.width = tile.height = 128;
  const ctx = tile.getContext('2d');
  if (!ctx) return tile;
  const pixels = ctx.createImageData(128, 128);
  let seed = 7099;
  for (let i = 0; i < pixels.data.length; i += 4) {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    const value = seed >>> 24;
    pixels.data.fill(value > 122 ? 255 : 0, i, i + 3);
    pixels.data[i + 3] = Math.abs(value - 122) * .56;
  }
  ctx.putImageData(pixels, 0, 0);
  return tile;
}

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

function sizedCanvas(canvas, ctx, maxDpr = 2) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const dpr = Math.min(devicePixelRatio || 1, maxDpr);
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { width, height, dpr };
}

function hash(x, y) {
  const n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  return (Math.imul(n ^ (n >>> 13), 1274126177) >>> 0) / 4294967295;
}

function noise(x, y) {
  const i = Math.floor(x), j = Math.floor(y);
  const ax = x - i, ay = y - j;
  const fx = ax * ax * (3 - 2 * ax), fy = ay * ay * (3 - 2 * ay);
  const top = hash(i, j) * (1 - fx) + hash(i + 1, j) * fx;
  const bottom = hash(i, j + 1) * (1 - fx) + hash(i + 1, j + 1) * fx;
  return top * (1 - fy) + bottom * fy;
}

const sky = [[37, 64, 80], [62, 88, 106], [79, 110, 128], [104, 137, 151], [121, 151, 159]];
const mist = [[83, 105, 112], [128, 146, 147], [166, 176, 167], [206, 207, 181], [229, 222, 195]];
const ridge = [[28, 40, 34], [47, 59, 46], [66, 76, 54], [102, 103, 65], [150, 139, 89]];

function swatch(colors, value) {
  return colors[Math.max(0, Math.min(colors.length - 1, Math.floor(value * colors.length)))];
}

function heightField(ctx, pixels, width, height, turn) {
  for (let row = 0; row < height; row++) {
    const y = row / height;
    const strip = 2.2 + turn * .8;
    const displacement = [
      [.28, .31, -.09], [.48, .505, .10], [.563, .585, -.075], [.71, .72, .13],
    ].reduce((shift, [from, to, amount]) => y > from && y < to ? amount * strip : shift, 0);
    for (let col = 0; col < width; col++) {
      const x = col / width + (col > width * .23 ? displacement : 0);
      const px = x + turn * .11;
      const hills = .59 + Math.sin(px * 8.4 - .7) * .09
        + Math.cos(px * 15.7 + 1.2) * .035 + (noise(px * 7, 4.2) - .5) * .07;
      const cloud = noise(px * 6.1 + 2, y * 11.8 + 2.6) * .63
        + noise(px * 15.5, y * 22 - .6) * .24 + noise(px * 38, y * 43) * .13
        - Math.abs(y - .37) * .82;
      let color = swatch(sky, y * 1.23 + .13 * noise(px * 5, y * 4));
      if (cloud > .39 && y < hills + .065) color = swatch(mist, (cloud - .39) * 3.65);

      if (y >= hills) {
        const depth = y - hills;
        const texture = noise(px * 11, y * 65 + Math.cos(px * 10) * 1.4);
        const contour = Math.sin(depth * (118 + 17 * turn) + texture * 3.3) * .105;
        color = swatch(ridge, .63 - depth * .85 + (texture - .5) * .42 + contour);
      }

      const grit = (hash(col, row) - .5) * 13 + (row % 3 === 0 ? -3 : 0);
      const index = (row * width + col) * 4;
      pixels.data[index] = color[0] + grit;
      pixels.data[index + 1] = color[1] + grit;
      pixels.data[index + 2] = color[2] + grit;
      pixels.data[index + 3] = 255;
    }
  }
  ctx.putImageData(pixels, 0, 0);
}

function tear(ctx, buffer, width, height, cursor, strength) {
  const focusX = clamp(cursor.x, width * .08, width * .92);
  const focusY = clamp(cursor.y, height * .09, height * .91);
  const reach = Math.max(60, width * (.28 + strength * .40));
  for (let row = 0; row < 11; row++) {
    const offset = row - 5;
    const y = Math.round(clamp(focusY + offset * 5, 0, height - 2));
    const length = Math.min(Math.max(2, row % 4 + 1), height - y);
    const left = clamp(focusX - reach * (.35 + hash(row, 9) * .55), 0, width - 2);
    const right = clamp(focusX + reach * (.25 + hash(3, row) * .48), left + 1, width);
    const displacement = strength * (15 + hash(row, 3) * 66) * (row % 3 === 0 ? -1 : 1);
    ctx.globalAlpha = strength * (.56 + hash(row, 19) * .42);
    ctx.drawImage(buffer, left * buffer.width / width, y * buffer.height / height,
      (right - left) * buffer.width / width, length * buffer.height / height,
      left + displacement, y, right - left, length);
    ctx.fillStyle = row % 2 ? '#ccd1b6' : '#8ea99f';
    ctx.fillRect(left + displacement * 1.6, y, 5 + hash(row, 40) * 18, 1);
  }
  ctx.globalAlpha = 1;
}

function ghost(ctx, buffer, echo, age, field) {
  const strength = Math.max(0, 1 - age / 860);
  const x = echo.x + echo.dx * (age / 270);
  const y = echo.y + echo.dy * (age / 400);
  const size = 48 + hash(echo.seed, 5) * 123;
  const sampleX = clamp(echo.x / field.width, 0, .74) * buffer.width;
  const sampleY = clamp(echo.y / field.height, 0, .85) * buffer.height;
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = strength * .53;
  ctx.drawImage(buffer, sampleX, sampleY, buffer.width * .22, 5, x + 15, y - 12, size, 12);
  ctx.drawImage(buffer, sampleX, sampleY + 5, buffer.width * .25, 9, x - size * .48, y + 7, size, 20);
  ctx.drawImage(buffer, sampleX + 8, sampleY, buffer.width * .12, 2, x + 31, y + 30, size * .54, 3);
  ctx.globalAlpha = strength * .34;
  ctx.strokeStyle = '#d0d5bc';
  ctx.strokeRect(Math.round(x - size * .30) + .5, Math.round(y - 28) + .5, size * .77, 54);
  ctx.fillStyle = '#c3be99';
  ctx.fillRect(x + size * .55, y - 28, 4, 4);
  ctx.fillRect(x - size * .39, y + 38, 21, 1);
  ctx.globalAlpha = 1;
}

export function mountArtwork(form) {
  const art = document.getElementById('loop-art');
  const surface = document.getElementById('surface-texture');
  const scene = art.getContext('2d');
  const chrome = surface.getContext('2d');
  const echoCanvas = document.getElementById('signal-echo');
  const backdrop = echoCanvas.getContext('2d');
  const buffer = document.createElement('canvas');
  const copy = buffer.getContext('2d');
  let fieldPixels;
  if (!scene || !chrome || !copy || !backdrop) return;

  const tile = grainTile();
  const sceneGrain = scene.createPattern(tile, 'repeat');
  const chromeGrain = chrome.createPattern(tile, 'repeat');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const format = form.elements.namedItem('format');
  let turn = format.value === 'webp' ? .84 : -.12;
  let animation = 0;
  let sceneSize = sizedCanvas(art, scene);
  let echoSize = sizedCanvas(echoCanvas, backdrop, 1);
  let pointer;
  let drift;
  let modeChange;
  let drawnTurn;
  const echoes = [];

  function paintChrome() {
    const { width, height } = sizedCanvas(surface, chrome);
    chrome.clearRect(0, 0, width, height);
    chrome.fillStyle = chromeGrain;
    chrome.fillRect(0, 0, width, height);
  }

  function paintScene(now = performance.now()) {
    const { width, height } = sceneSize;
    if (!width || !height) return;
    const fieldWidth = Math.min(280, Math.ceil(width * .54));
    const fieldHeight = Math.max(1, Math.round(fieldWidth * height / width));
    if (!fieldPixels || buffer.width !== fieldWidth || buffer.height !== fieldHeight) {
      buffer.width = fieldWidth;
      buffer.height = fieldHeight;
      fieldPixels = copy.createImageData(fieldWidth, fieldHeight);
      drawnTurn = undefined;
    }
    if (drawnTurn !== turn) {
      heightField(copy, fieldPixels, fieldWidth, fieldHeight, turn);
      drawnTurn = turn;
    }
    scene.imageSmoothingEnabled = false;
    scene.drawImage(buffer, 0, 0, width, height);
    if (pointer && drift) {
      const strength = clamp(1 - (now - pointer.time) / 710, 0, 1);
      if (strength > 0) {
        const rect = art.getBoundingClientRect();
        tear(scene, buffer, width, height, { x: drift.x - rect.x, y: drift.y - rect.y }, strength);
      }
    }

    scene.strokeStyle = '#e1ddc550';
    scene.beginPath();
    const inset = Math.round(Math.min(width, height) * .073);
    for (const [x, y, dx, dy] of [
      [inset, inset, 1, 1], [width - inset, inset, -1, 1],
      [inset, height - inset, 1, -1], [width - inset, height - inset, -1, -1],
    ]) {
      scene.moveTo(x + 9 * dx, y);
      scene.lineTo(x, y);
      scene.lineTo(x, y + 9 * dy);
    }
    scene.stroke();
    scene.globalAlpha = .39;
    scene.fillStyle = sceneGrain;
    scene.fillRect(0, 0, width, height);
    scene.globalAlpha = 1;
  }

  function requestPaint() {
    if (!animation) animation = requestAnimationFrame(update);
  }

  function update(now) {
    animation = 0;
    if (modeChange) {
      const elapsed = clamp((now - modeChange.start) / 190, 0, 1);
      turn = modeChange.from + (modeChange.to - modeChange.from) * (1 - (1 - elapsed) ** 3);
      if (elapsed === 1) modeChange = undefined;
    }
    if (pointer && drift) {
      drift.x += (pointer.x - drift.x) * .25;
      drift.y += (pointer.y - drift.y) * .25;
      if (now - pointer.time > 710) pointer = undefined;
    }
    while (echoes.length && now - echoes[0].time >= 860) echoes.shift();
    paintScene(now);
    backdrop.clearRect(0, 0, echoSize.width, echoSize.height);
    if (fieldPixels && echoSize.width && echoSize.height) {
      for (const echo of echoes) ghost(backdrop, buffer, echo, Math.max(0, now - echo.time), echoSize);
    }
    if (modeChange || pointer || echoes.length) requestPaint();
  }

  new ResizeObserver(paintChrome).observe(surface);
  new ResizeObserver(() => {
    sceneSize = sizedCanvas(art, scene);
    paintScene();
  }).observe(art);
  new ResizeObserver(() => {
    echoSize = sizedCanvas(echoCanvas, backdrop, 1);
    if (echoes.length) requestPaint();
  }).observe(echoCanvas);

  window.addEventListener('pointermove', (event) => {
    if (reduceMotion.matches || event.pointerType === 'touch') return;
    const x = event.clientX, y = event.clientY, time = performance.now();
    const previous = echoes.at(-1);
    if (!pointer) drift = { x, y };
    pointer = { x, y, time };
    if (!previous || Math.hypot(x - previous.x, y - previous.y) > 62) {
      echoes.push({
        x, y, time, seed: Math.round(x + y),
        dx: previous ? clamp((x - previous.x) * .09, -17, 17) : -11,
        dy: previous ? clamp((y - previous.y) * .11, -14, 14) : 7,
      });
      if (echoes.length > 7) echoes.shift();
    }
    requestPaint();
  }, { passive: true });

  reduceMotion.addEventListener('change', () => {
    if (!reduceMotion.matches) return;
    echoes.length = 0;
    pointer = undefined;
    if (modeChange) {
      turn = modeChange.to;
      modeChange = undefined;
    }
    requestPaint();
  });

  form.addEventListener('change', (event) => {
    if (event.target.name !== 'format') return;
    const target = format.value === 'webp' ? .84 : -.12;
    if (reduceMotion.matches || !sceneSize.width) {
      turn = target;
      modeChange = undefined;
    } else {
      modeChange = { start: performance.now(), from: turn, to: target };
    }
    requestPaint();
  });
}
