// Original cut-paper silhouettes. Each layer is sampled into a limited ink palette.
const viewWidth = 640;
const viewHeight = 690;
const shapes = [
  [35, 'M638 104 C580 75 575 25 529 10 C482 -5 432 19 424 68 C417 105 446 113 450 147 C454 171 437 181 416 196 C460 201 507 233 548 284 L638 335 Z'],
  [63, 'M638 152 C582 139 556 93 537 56 C511 14 457 38 443 68 L453 89 L445 116 L471 124 C494 133 485 161 493 190 C519 213 567 223 596 252 L638 269 Z'],
  [102, 'M638 291 C606 216 562 191 518 176 C486 164 453 167 428 190 C398 218 376 256 361 296 L495 352 L638 382 Z'],
  [140, 'M632 289 C609 235 578 211 531 192 C496 177 470 174 441 190 C411 208 391 247 375 280 C453 260 487 275 532 310 C582 338 605 338 639 350 Z'],
  [47, 'M628 358 C580 336 567 299 522 276 C486 258 453 258 424 279 C466 282 509 319 536 357 C581 383 613 385 642 402 Z'],
  [151, 'M648 665 C611 634 567 599 534 565 C499 528 471 497 432 477 C405 460 377 462 355 448 C326 430 313 405 300 383 C293 369 284 353 284 342 C286 322 304 312 320 321 C338 338 358 358 377 359 C400 361 420 350 451 364 C491 380 515 409 544 436 C574 465 610 477 653 509 Z'],
  [166, 'M434 394 C399 367 372 346 340 324 C320 307 293 294 268 278 C246 266 223 259 207 247 C193 235 185 218 198 214 C213 211 242 231 259 239 C288 251 313 255 343 271 C369 282 381 301 408 314 C437 327 460 346 466 373 Z'],
  [182, 'M400 381 C378 359 351 338 328 325 C309 315 292 310 270 305 C249 300 208 299 186 292 C167 287 169 274 183 269 C205 263 239 277 267 275 C298 274 319 278 348 291 C376 305 408 323 433 347 Z'],
  [205, 'M403 363 C376 352 357 336 338 329 C311 319 297 328 275 325 C255 322 230 333 204 337 C189 339 180 331 190 319 C205 303 236 300 256 294 C279 289 300 294 326 297 C355 298 384 310 418 332 Z'],
  [179, 'M359 440 C337 439 311 424 293 413 C274 398 272 375 267 356 C265 343 271 335 280 343 C291 354 298 371 305 381 C313 391 325 391 335 386 C346 384 353 375 366 374 C380 383 388 402 378 417 Z'],
  [199, 'M645 526 C607 497 572 490 542 463 C508 431 493 400 457 383 C432 370 413 375 392 357 C375 340 353 337 329 338 C345 363 365 384 383 398 C416 420 448 420 476 447 C518 481 533 515 568 544 C593 571 620 589 645 607 Z'],
  [112, 'M644 657 C604 614 576 608 548 575 C513 538 497 509 457 481 C437 464 403 457 390 449 C420 447 461 450 485 470 C510 491 536 528 566 551 C603 580 621 590 646 609 Z'],
];

const marks = '01=:+-./_[]{}<>%#*?';
const move = (v, a, b) => Math.max(a, Math.min(b, v));
function hash(x, y) {
  const value = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  return (Math.imul(value ^ (value >>> 13), 1274126177) >>> 0) / 4294967295;
}

function generateField() {
  const mask = document.createElement('canvas');
  mask.width = 400;
  mask.height = 431;
  const ctx = mask.getContext('2d', { willReadFrequently: true });
  ctx.scale(mask.width / viewWidth, mask.height / viewHeight);
  ctx.fillStyle = '#080808';
  ctx.fillRect(0, 0, viewWidth, viewHeight);
  for (const [tone, path] of shapes) {
    ctx.fillStyle = `rgb(${tone} ${tone} ${tone})`;
    ctx.fill(new Path2D(path));
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const image = ctx.getImageData(0, 0, mask.width, mask.height);
  const colors = [6, 16, 35, 66, 112, 169, 224, 246];
  for (let y = 0; y < mask.height; y++) {
    for (let x = 0; x < mask.width; x++) {
      const p = (y * mask.width + x) * 4;
      const value = image.data[p];
      const signal = Math.sin(x * .037 + y * .041) * 24 + Math.sin(y * .89 - x * .11) * 14;
      const noise = hash(x + 3, y + 67);
      const ink = value < 13 ? (noise > .976 ? 37 : 8)
        : colors[move(Math.floor((value + signal + (noise - .45) * 51) / 30), 0, colors.length - 1)];
      image.data[p] = image.data[p + 1] = image.data[p + 2] = ink;
    }
  }
  ctx.putImageData(image, 0, 0);
  ctx.font = '5px monospace';
  for (let row = 1; row < 74; row++) {
    const y = row * 5.8;
    const length = 15 + Math.floor(hash(row, 45) * 31);
    for (let col = 0; col < length; col++) {
      if (hash(row, col) < .16) continue;
      const opacity = .20 + hash(col, row + 3) * .48;
      ctx.fillStyle = `rgba(220,220,216,${opacity})`;
      ctx.fillText(marks[Math.floor(hash(col + 17, row + 1) * marks.length)] || '.', 8 + col * 3.05, y);
    }
  }
  return mask;
}

export function mountArtwork(stage) {
  const screen = stage.querySelector('canvas');
  const ctx = screen?.getContext('2d');
  if (!ctx) return;
  const field = generateField();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const result = stage.querySelector('#result');
  let width, height, dpr, destWidth, destHeight, left, top;
  let frame = 0;
  let pointer;

  function draw(now = performance.now()) {
    frame = 0;
    ctx.fillStyle = '#080808';
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(field, left, top, destWidth, destHeight);

    for (const [ratio, strip, shift] of [[.31, 3, -21], [.52, 5, 22], [.55, 2, -26], [.72, 5, 16]]) {
      const y = Math.floor(field.height * ratio);
      ctx.drawImage(field, 0, y, field.width, strip, left + shift, top + y / field.height * destHeight,
        destWidth, strip / field.height * destHeight);
    }
    if (!pointer || reduced.matches) return;
    const age = now - pointer.time;
    const strength = move(1 - age / 550, 0, 1);
    if (!strength) {
      pointer = undefined;
      return;
    }
    const rect = stage.getBoundingClientRect();
    const yCenter = (pointer.y - rect.y - top) / destHeight * field.height;
    for (let i = 0; i < 12; i++) {
      const y = Math.floor(move(yCenter + (i - 6) * 3, 0, field.height - 5));
      const shift = strength * (14 + hash(i, 16) * 66) * (i % 2 ? 1 : -1);
      const sampleX = Math.floor(move((pointer.x - rect.x - left) / destWidth * field.width - 80, 0, field.width - 166));
      ctx.drawImage(field, sampleX, y, 166, i % 3 + 1,
        left + sampleX / field.width * destWidth + shift, top + y / field.height * destHeight,
        166 / field.width * destWidth, (i % 3 + 1) / field.height * destHeight);
    }
    frame = requestAnimationFrame(draw);
  }

  new ResizeObserver(() => {
    width = screen.clientWidth;
    height = screen.clientHeight;
    dpr = Math.min(devicePixelRatio || 1, 2);
    screen.width = Math.round(width * dpr);
    screen.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const scale = Math.max(width / field.width, height / field.height);
    destWidth = field.width * scale;
    destHeight = field.height * scale;
    left = (width - destWidth) * .55;
    top = (height - destHeight) * .40;
    if (!frame) draw();
  }).observe(screen);

  stage.closest('.shell').addEventListener('pointermove', event => {
    if (reduced.matches || event.pointerType === 'touch' || !result.hidden) return;
    pointer = { x: event.clientX, y: event.clientY, time: performance.now() };
    if (!frame) frame = requestAnimationFrame(draw);
  }, { passive: true });

  reduced.addEventListener('change', () => {
    pointer = undefined;
    if (frame) cancelAnimationFrame(frame);
    draw();
  });
}
