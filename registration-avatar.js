import { sanitizeAvatar, stripUnowned } from './avatar-config.js';
// L'inscription ne peut attribuer aucun objet de boutique ou de division.
export function registrationAvatar(raw) {
  return raw?.v === 2 ? { ...stripUnowned(sanitizeAvatar(raw), new Set()).config, rev: 0 } : null;
}
// Le profil persistant fait foi ; un état de navigation ancien ne doit pas masquer le choix d'inscription.
export function resolveAccountAvatar(own, saved, metadata) {
  const config = own?.v === 2 ? own : saved?.v === 2 ? saved : registrationAvatar(metadata);
  return config ? sanitizeAvatar(config) : null;
}
