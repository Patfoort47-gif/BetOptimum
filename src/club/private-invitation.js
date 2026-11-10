import { normalizeCode, parsePrivateHash } from './community.js';
export const INVITATION_KEY = 'betoptimum-private-invitation-v1';
const validPreview = (p) =>
  p &&
  typeof p.name === 'string' &&
  p.name.trim().length >= 3 &&
  p.name.length <= 30 &&
  Number.isInteger(p.members) &&
  p.members >= 0 &&
  p.members <= 50 &&
  Array.isArray(p.ranking) &&
  p.ranking.length <= 3 &&
  p.ranking.every((n) => Number.isFinite(n) && Math.abs(n) < 1e9);
export function invitationPreview(league, rows = []) {
  const p = {
    name: String(league.name).trim(),
    members: Number(league.members),
    ranking: rows.slice(0, 3).map((r) => Number(r.points))
  };
  return validPreview(p) ? p : null;
}
export function invitationLink(code, preview, base) {
  const normalized = normalizeCode(code);
  if (!normalized) throw Error('Code invalide');
  const hash = `#ligue-privee-${normalized}`;
  return (
    base +
    hash +
    (validPreview(preview) ? '?apercu=' + encodeURIComponent(JSON.stringify(preview)) : '')
  );
}
export function parseInvitation(url) {
  try {
    const u = new URL(url),
      [hash, query] = u.hash.split('?');
    const code = parsePrivateHash(hash) ?? normalizeCode(u.searchParams.get('invitation'));
    if (!code) return null;
    let preview = null;
    const value = new URLSearchParams(query).get('apercu');
    if (value && value.length <= 1500) {
      const p = JSON.parse(value);
      if (validPreview(p)) preview = { name: p.name, members: p.members, ranking: p.ranking };
    }
    return { code, preview };
  } catch {
    return null;
  }
}
export function saveInvitation(storage, invitation, autoJoin = false, now = Date.now()) {
  const row = {
    code: normalizeCode(invitation?.code),
    preview: validPreview(invitation?.preview) ? invitation.preview : null,
    autoJoin: autoJoin === true,
    createdAt: now
  };
  if (!row.code) return false;
  try {
    storage.setItem(INVITATION_KEY, JSON.stringify(row));
    return true;
  } catch {
    return false;
  }
}
export function readInvitation(storage, now = Date.now()) {
  try {
    const r = JSON.parse(storage.getItem(INVITATION_KEY));
    if (
      !normalizeCode(r?.code) ||
      !Number.isFinite(r.createdAt) ||
      now - r.createdAt < 0 ||
      now - r.createdAt > 86400000
    ) {
      storage.removeItem(INVITATION_KEY);
      return null;
    }
    return {
      code: normalizeCode(r.code),
      preview: validPreview(r.preview) ? r.preview : null,
      autoJoin: r.autoJoin === true,
      createdAt: r.createdAt
    };
  } catch {
    return null;
  }
}
export function invitationCard(preview) {
  return {
    title: 'Rejoins ma ligue privée',
    filename: 'betoptimum-invitation.png',
    lines: preview
      ? [
          preview.name,
          `${preview.members}/50 membres`,
          `Podium anonyme : ${preview.ranking.map((n, i) => `${i + 1}. ${n.toFixed(1).replace('.', ',')} pts`).join(' · ') || 'À venir'}`,
          'Aperçu fourni par l’invitation, à vérifier après adhésion',
          'Connexion par lien email · 18+'
        ]
      : ['Invitation privée sur BetOptimum', 'Connexion par lien email · 18+']
  };
}
