export function mountArtwork(picture) {
  const motion = matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
  const artwork = picture.parentElement;
  const image = picture.querySelector('img');
  const echoes = [];

  let point;
  let previousX;
  let frame;
  let quiet;

  function paint() {
    frame = undefined;
    if (!motion.matches || !point) return;
    const bounds = artwork.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;

    if (!echoes.length) {
      for (let index = 0; index < 2; index += 1) {
        const echo = picture.cloneNode(true);
        echo.removeAttribute('id');
        echo.querySelector('img').removeAttribute('fetchpriority');
        echoes.push(echo);
        echo.className = 'art-echo';
        artwork.append(echo);
      }
    }

    const x = (point.clientX - bounds.left) / bounds.width;
    const y = (point.clientY - bounds.top) / bounds.height;
    const travel = point.clientX - (previousX ?? point.clientX);
    const shift = Math.min(55, Math.max(-55, (x - .5) * 42 + travel * 1.15));
    previousX = point.clientX;
    artwork.style.setProperty('--scan', `${Math.min(90, Math.max(5, y * 100))}%`);
    artwork.style.setProperty('--shift', `${Math.round(shift)}px`);
    artwork.setAttribute('data-tracking', '');
  }

  function settle() {
    clearTimeout(quiet);
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
    point = undefined;
    previousX = undefined;
    artwork.removeAttribute('data-tracking');
  }

  artwork.addEventListener('pointermove', event => {
    if (!motion.matches || event.pointerType === 'touch' || !image.complete || !image.naturalWidth) return;
    point = event;
    frame ??= requestAnimationFrame(paint);
    clearTimeout(quiet);
    quiet = setTimeout(settle, 150);
  }, { passive: true });
  artwork.addEventListener('pointerleave', settle);
  motion.addEventListener('change', settle);
}
