// Aperçus vectoriels des objets modélisés dans avatar-parts.js. Aucun téléchargement externe.
const shapes = {
  'trophy-crystal':
    '<path d="m48 14 9 19 21 3-15 15 4 21-19-10-19 10 4-21-15-15 21-3z" fill="#8cddf2" stroke="#ddfaff" stroke-width="2"/><path d="M43 63h10v13H43z" fill="#e6b422"/><path d="M28 76h40v8H28z" fill="#344763"/>',
  'trophy-laurel':
    '<path d="M48 67q-32-16-20-47m20 47q32-16 20-47" fill="none" stroke="#e6b422" stroke-width="7"/><path d="M27 39 15 27m12 28-14-9m56-7 12-12M69 55l14-9" stroke="#e6b422" stroke-width="7"/><path d="M45 65h6v12H45z" fill="#e6b422"/><path d="M28 77h40v8H28z" fill="#28634f"/>',
  'acc-captain':
    '<path fill="#f5d418" d="M22 22h52v50H22z"/><path fill="#111" d="M22 25h52v5H22zm0 39h52v5H22z"/><text x="48" y="57" text-anchor="middle" font-size="28" font-weight="900" fill="#111">C</text>',
  'acc-cap':
    '<path fill="#2f6bff" d="M19 51a29 29 0 0 1 58 0z"/><path fill="#173d99" d="m21 51 58-1 12 12H29z"/><path d="M48 23v27m-18-2q1-20 18-25m18 25q-1-20-18-25" stroke="#adc5ff" fill="none"/>',
  'acc-headband':
    '<path d="M15 43q33-13 66 0v18q-33-12-66 0z" fill="#f4f4f0"/><path d="M15 50q33-13 66 0" stroke="#2f6bff" fill="none" stroke-width="4"/>',
  'acc-glasses':
    '<g stroke="#adb5c3" stroke-width="5" fill="#82b7de" fill-opacity=".6"><circle cx="27" cy="48" r="17"/><circle cx="69" cy="48" r="17"/><path d="M44 47h8M10 43l-6-6m82 6 6-6" fill="none"/></g>',
  'acc-headphones':
    '<path d="M17 52V41a31 31 0 0 1 62 0v11" fill="none" stroke="#b5bdce" stroke-width="9"/><rect x="9" y="43" width="18" height="32" rx="8" fill="#2f6bff"/><rect x="69" y="43" width="18" height="32" rx="8" fill="#2f6bff"/><path d="M14 51v16m68-16v16" stroke="#111" stroke-width="4"/>',
  'acc-scarf':
    '<path d="M17 23h62v19H17zm15 19h17v37H32zm22 0h17v27H54z" fill="#2f6bff"/><path d="M17 28h62M17 36h62M32 51h17m-17 12h17m5-12h17m-17 12h17" stroke="#f4f4f0" stroke-width="4"/><path d="M33 79v6m6-6v6m6-6v6m10-16v6m6-6v6m6-6v6" stroke="#2f6bff" stroke-width="3"/>',
  // BET-163 : effets de victoire et ambiances sonores (aperçus, le rendu réel est dans victory-effects.js).
  'effect-confetti':
    '<g transform="rotate(-12 48 48)"><path fill="#C8F03C" d="M20 20h10v5H20z"/><path fill="#2f6bff" d="M60 16h10v5H60z"/><path fill="#ff5ec4" d="M40 34h10v5H40z"/><path fill="#ffd25e" d="M70 44h10v5H70z"/><path fill="#f4f4f0" d="M24 52h10v5H24z"/><path fill="#5ee7ff" d="M50 62h10v5H50z"/></g><path d="M34 82 48 40l14 42z" fill="#e6b422"/><path d="M40 82h16" stroke="#8a6a12" stroke-width="3"/>',
  'effect-smoke':
    '<circle cx="30" cy="54" r="16" fill="#e02424" opacity=".55"/><circle cx="40" cy="38" r="14" fill="#e02424" opacity=".4"/><circle cx="66" cy="54" r="16" fill="#2f6bff" opacity=".55"/><circle cx="58" cy="36" r="13" fill="#2f6bff" opacity=".4"/><path d="M26 82V64h8v18zm36 0V64h8v18z" fill="#adb5c3"/><path d="M27 64h6l-3-6zm36 0h6l-3-6z" fill="#ffd25e"/>',
  'effect-fireworks':
    '<g stroke-width="3" stroke-linecap="round"><g stroke="#ffd25e"><path d="M34 36v-12M34 36l9-8M34 36h12M34 36l9 8M34 36l-9 8M34 36H22M34 36l-9-8"/></g><g stroke="#ff5ec4"><path d="M64 50v-10M64 50l7-7M64 50h10M64 50l7 7M64 50l-7 7M64 50H54M64 50l-7-7"/></g></g><path d="M34 40v42m30-28v28" stroke="#5ee7ff" stroke-dasharray="3 4" stroke-width="2"/>',
  'sound-siren':
    '<path d="M30 70V50a18 18 0 0 1 36 0v20z" fill="#e02424"/><path d="M24 70h48v10H24z" fill="#344763"/><path d="M38 50a10 10 0 0 1 10-10" stroke="#ffd0d0" stroke-width="4" fill="none"/><path d="M18 34l-6-6m66 6 6-6M48 22V12" stroke="#ffd25e" stroke-width="4" stroke-linecap="round"/>',
  'sound-drums':
    '<ellipse cx="48" cy="40" rx="28" ry="9" fill="#f4f4f0"/><path d="M20 40v26c0 5 13 9 28 9s28-4 28-9V40c0 5-13 9-28 9s-28-4-28-9z" fill="#2f6bff"/><path d="M22 46l13 26m26-26-13 26m26-26-13 26M22 72l13-26" stroke="#e6b422" stroke-width="2"/><path d="m30 14 16 22m22-22L52 36" stroke="#d49a6a" stroke-width="5" stroke-linecap="round"/>',
  'sound-horn':
    '<path d="M16 44h12l38-20v48L28 52H16z" fill="#e6b422"/><path d="M66 24q10 24 0 48" stroke="#8a6a12" stroke-width="4" fill="none"/><path d="M74 36q6 12 0 24m8-32q10 20 0 40" stroke="#C8F03C" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M20 52v14h8V52z" fill="#344763"/>',
  'acc-crown':
    '<path d="m15 29 18 17 15-28 15 28 18-17-8 43H23z" fill="#e6b422" stroke="#fff0b0" stroke-width="2"/><circle cx="48" cy="56" r="5" fill="#e63946"/><circle cx="29" cy="56" r="4" fill="#3a86ff"/><circle cx="67" cy="56" r="4" fill="#2ec27e"/>'
};
export function itemArtwork(id) {
  const body = shapes[id];
  return body
    ? `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="16" fill="#151c2b"/><ellipse cx="48" cy="83" rx="31" ry="5" fill="#000" opacity=".3"/>${body}</svg>`)}`
    : null;
}
