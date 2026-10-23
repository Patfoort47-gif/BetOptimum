// Aperçus vectoriels des objets modélisés dans avatar-parts.js. Aucun téléchargement externe.
const shapes = {
  'acc-captain': '<path fill="#f5d418" d="M22 22h52v50H22z"/><path fill="#111" d="M22 25h52v5H22zm0 39h52v5H22z"/><text x="48" y="57" text-anchor="middle" font-size="28" font-weight="900" fill="#111">C</text>',
  'acc-cap': '<path fill="#2f6bff" d="M19 51a29 29 0 0 1 58 0z"/><path fill="#173d99" d="m21 51 58-1 12 12H29z"/><path d="M48 23v27m-18-2q1-20 18-25m18 25q-1-20-18-25" stroke="#adc5ff" fill="none"/>',
  'acc-headband': '<path d="M15 43q33-13 66 0v18q-33-12-66 0z" fill="#f4f4f0"/><path d="M15 50q33-13 66 0" stroke="#2f6bff" fill="none" stroke-width="4"/>',
  'acc-glasses': '<g stroke="#adb5c3" stroke-width="5" fill="#82b7de" fill-opacity=".6"><circle cx="27" cy="48" r="17"/><circle cx="69" cy="48" r="17"/><path d="M44 47h8M10 43l-6-6m82 6 6-6" fill="none"/></g>',
  'acc-headphones': '<path d="M17 52V41a31 31 0 0 1 62 0v11" fill="none" stroke="#b5bdce" stroke-width="9"/><rect x="9" y="43" width="18" height="32" rx="8" fill="#2f6bff"/><rect x="69" y="43" width="18" height="32" rx="8" fill="#2f6bff"/><path d="M14 51v16m68-16v16" stroke="#111" stroke-width="4"/>',
  'acc-scarf': '<path d="M17 23h62v19H17zm15 19h17v37H32zm22 0h17v27H54z" fill="#2f6bff"/><path d="M17 28h62M17 36h62M32 51h17m-17 12h17m5-12h17m-17 12h17" stroke="#f4f4f0" stroke-width="4"/><path d="M33 79v6m6-6v6m6-6v6m10-16v6m6-6v6m6-6v6" stroke="#2f6bff" stroke-width="3"/>',
  'acc-crown': '<path d="m15 29 18 17 15-28 15 28 18-17-8 43H23z" fill="#e6b422" stroke="#fff0b0" stroke-width="2"/><circle cx="48" cy="56" r="5" fill="#e63946"/><circle cx="29" cy="56" r="4" fill="#3a86ff"/><circle cx="67" cy="56" r="4" fill="#2ec27e"/>'
};
export function itemArtwork(id) {
  const body = shapes[id];
  return body ? `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="16" fill="#151c2b"/><ellipse cx="48" cy="83" rx="31" ry="5" fill="#000" opacity=".3"/>${body}</svg>`)}` : null;
}
