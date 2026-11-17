// Affichage de l'avatar sans 3D (BET-49) : image enregistrée dans Supabase Storage (buste ou en pied) ou, à défaut, l'ancien avatar en CSS.
// Les classements, le fil, les menus et la carte joueur passent par ici : aucun d'eux ne charge Three.js.
import { SUPABASE_URL } from '../account/supabase-config.js';
import { avatarImageUrl, legacyView } from './avatar-config.js';

const LEGACY = {
  avatar: ['lime', 'blue', 'purple', 'orange'],
  face: ['smile', 'cool', 'focused', 'wink'],
  accessory: ['none', 'glasses', 'cap', 'crown']
};
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]
  );
// Ancien avatar (couleur, expression, accessoire) d'un profil, qu'il vienne de l'avatar 3D (v2), de avatar_config (v1) ou des champs à plat.
export function legacyOf(source = {}) {
  const raw = source.avatar_config ?? source.avatar2 ?? null;
  if (raw && raw.v === 2) return legacyView(raw);
  const flat = raw && typeof raw === 'object' ? raw : source;
  return {
    avatar: LEGACY.avatar.includes(flat.avatar) ? flat.avatar : 'lime',
    face: LEGACY.face.includes(flat.face) ? flat.face : 'smile',
    accessory: LEGACY.accessory.includes(flat.accessory) ? flat.accessory : 'none'
  };
}
export const avatarRev = (source = {}) => {
  const raw = source.avatar_config ?? source.avatar2;
  return raw && raw.v === 2 && Number.isInteger(raw.rev) ? raw.rev : 0;
};
export const avatarUrl = (source, userId, kind = 'bust') =>
  avatarImageUrl(SUPABASE_URL, userId ?? source?.user_id, avatarRev(source), kind);
// Identité neutre : aucune image ni configuration personnalisée n’est affichée.
export function avatarMarkup(source, { cls = 'mini-avatar', label = '' } = {}) {
  const initials =
    String(source?.nickname ?? '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => [...part][0] ?? '')
      .join('')
      .toLocaleUpperCase('fr-FR') || '●';
  return `<span class="${escape(cls)} neutral-avatar" ${label ? `role="img" aria-label="${escape(label)}"` : 'aria-hidden="true"'}>${escape(initials)}</span>`;
}
