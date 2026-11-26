// Five columns by seven rows. Each bit marks one printable character.
const font = {
  A: [14, 17, 17, 31, 17, 17, 17],
  B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14],
  D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31],
  F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15],
  H: [17, 17, 17, 31, 17, 17, 17],
  I: [31, 4, 4, 4, 4, 4, 31],
  J: [7, 2, 2, 2, 18, 18, 12],
  K: [17, 18, 20, 24, 20, 18, 17],
  L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17],
  N: [17, 25, 21, 19, 17, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13],
  R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30],
  T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 21, 21, 27, 17],
  X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4],
  Z: [31, 1, 2, 4, 8, 16, 31],
};

const height = 7;
function letterRows(text, banner) {
  const repeat = banner ? 2 : 1;
  const letters = [...text.toUpperCase()].map(character => font[character]);
  const rows = Array.from({ length: height }, (_, row) => letters.map(letter => {
    if (!letter) return ' '.repeat(2 * repeat);
    return Array.from({ length: 5 }, (_, column) => {
      const ink = letter[row] & (16 >> column) ? '#' : ' ';
      return ink.repeat(repeat);
    }).join('');
  }).join(' '.repeat(repeat)).trimEnd());

  return rows.flatMap(row => banner ? [row, row] : [row]).join('\n');
}

export function setAsciiText(element, text, displayText = text) {
  const accessible = document.createElement('span');
  accessible.className = 'visually-hidden';
  accessible.textContent = text;

  const drawing = document.createElement('span');
  drawing.className = 'ascii-drawing';
  drawing.setAttribute('aria-hidden', 'true');
  drawing.textContent = letterRows(displayText, element.parentElement?.id === 'title');
  element.replaceChildren(accessible, drawing);
}
