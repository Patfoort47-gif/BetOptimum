// Célébration automatique d'un prono gagné (BET-163) : règles pures, sans DOM ni réseau, testées dans tests/celebration.test.js.
// Les événements viennent de xp_events (kind, xp, created_at) ; la marque « dernière célébration vue » est gardée par le navigateur.
import { KITS, sanitizeAvatar } from '../avatar/avatar-config.js';

export const CELEBRATION_SEEN_KEY = 'betmaster-celebration-seen',
  CELEBRATION_PENDING_KEY = 'betmaster-celebration-3d';
export const CELEBRATION_MS = 2600;
const time = (value) => {
  const parsed = Date.parse(value ?? '');
  return Number.isFinite(parsed) ? parsed : null;
};

// Faut-il célébrer ? Une seule fois par prono gagné : seuls les événements « won » plus récents que la marque comptent, puis la marque avance.
// Premier passage (aucune marque) : aucune rafale pour les anciens gains, la marque est posée sur le dernier gain connu (ou sur maintenant).
export function celebrationDue(events, seen, now = Date.now()) {
  const wins = (Array.isArray(events) ? events : []).filter(
    (event) => event?.kind === 'won' && time(event.created_at) != null
  );
  const latest = wins.reduce(
    (best, event) => (time(event.created_at) > time(best?.created_at) ? event : best),
    null
  );
  const mark = time(seen);
  if (mark == null)
    return {
      celebrate: false,
      count: 0,
      mark: latest ? latest.created_at : new Date(now).toISOString()
    };
  const fresh = wins.filter((event) => time(event.created_at) > mark);
  return {
    celebrate: fresh.length > 0,
    count: fresh.length,
    mark: fresh.length ? latest.created_at : seen
  };
}

// Son des célébrations : coupé par défaut, actif seulement si le joueur l'a choisi (état utilisateur, profile.celebrationSound).
export const soundEnabled = (profile) => profile?.celebrationSound === true;

// Objet équipé d'un emplacement (effect, sound) : identifiant de la boutique ou null.
export const equippedOf = (equipped, slot) =>
  typeof equipped?.[slot] === 'string' && /^[a-z0-9-]{1,40}$/.test(equipped[slot])
    ? equipped[slot]
    : null;

// Couleurs des effets : maillot de l'avatar du joueur (couleur principale puis secondaire), sinon null (repli sur --accent par l'appelant).
export function celebrationColors(config) {
  if (!config || config.v !== 2) return null;
  const kit = KITS[sanitizeAvatar(config).kit.item],
    valid = (value) => /^#[0-9a-f]{6}$/i.test(value ?? '');
  return kit && valid(kit.c1) ? [kit.c1, valid(kit.c2) ? kit.c2 : kit.c1] : null;
}
