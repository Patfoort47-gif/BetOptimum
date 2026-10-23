// Affichage de l'avatar sans 3D (BET-49) : image enregistrée dans Supabase Storage (buste ou en pied) ou, à défaut, l'ancien avatar en CSS.
// Les classements, le fil, les menus et la carte joueur passent par ici : aucun d'eux ne charge Three.js.
import { SUPABASE_URL } from './supabase-config.js';
import { avatarImageUrl, legacyView } from './avatar-config.js';

const LEGACY = { avatar: ['lime', 'blue', 'purple', 'orange'], face: ['smile', 'cool', 'focused', 'wink'], accessory: ['none', 'glasses', 'cap', 'crown'] };
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[char]));
// Ancien avatar (couleur, expression, accessoire) d'un profil, qu'il vienne de l'avatar 3D (v2), de avatar_config (v1) ou des champs à plat.
export function legacyOf(source = {}) {
  const raw = source.avatar_config ?? source.avatar2 ?? null;
  if (raw && raw.v === 2) return legacyView(raw);
  const flat = raw && typeof raw === 'object' ? raw : source;
  return { avatar: LEGACY.avatar.includes(flat.avatar) ? flat.avatar : 'lime', face: LEGACY.face.includes(flat.face) ? flat.face : 'smile', accessory: LEGACY.accessory.includes(flat.accessory) ? flat.accessory : 'none' };
}
export const avatarRev = (source = {}) => { const raw = source.avatar_config ?? source.avatar2; return raw && raw.v === 2 && Number.isInteger(raw.rev) ? raw.rev : 0; };
export const avatarUrl = (source, userId, kind = 'bust') => avatarImageUrl(SUPABASE_URL, userId ?? source?.user_id, avatarRev(source), kind);
let listening = false;
// Une image absente (jamais enregistrée, supprimée) rend la main à l'avatar CSS sans rien casser.
function listen() {
  if (listening || typeof document?.addEventListener !== 'function') return;
  listening = true;
  document.addEventListener('error', event => { const image = event.target; if (image?.tagName === 'IMG' && image.dataset?.fb && image.parentNode) { image.parentNode.className = image.dataset.fb; image.remove(); } }, true);
}
// Marque HTML de l'avatar : image différée si elle existe, sinon pastille CSS. `cls` : mini-avatar (listes), avatar-3d (grande), profile-photo (en-tête).
export function avatarMarkup(source, { userId, cls = 'mini-avatar', kind = 'bust', label = '' } = {}) {
  const legacy = legacyOf(source), fallback = `${cls} ${legacy.avatar} face-${legacy.face} accessory-${legacy.accessory}`, url = avatarUrl(source, userId, kind);
  const inner = cls === 'avatar-3d' ? '<i></i><span></span><b></b><em></em>' : '';
  if (!url) return `<span class="${fallback}" ${label ? `role="img" aria-label="${escape(label)}"` : 'aria-hidden="true"'}>${inner}</span>`;
  listen();
  return `<span class="${cls} avatar-photo" ${label ? `role="img" aria-label="${escape(label)}"` : 'aria-hidden="true"'}><img src="${escape(url)}" alt="" width="${kind === 'full' ? 192 : 96}" height="${kind === 'full' ? 256 : 96}" loading="lazy" decoding="async" data-fb="${escape(fallback)}">${inner}</span>`;
}
