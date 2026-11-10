import { STADIUM_PHOTOS } from './stadium-catalog.js';
// Catalogue éditorial : clés ESPN uniquement, jamais de rapprochement par nom.
// Chaque photo activée doit être locale et accompagnée de ses droits vérifiés.
export const STADIUMS = Object.freeze({
  ...Object.fromEntries(
    Object.entries(STADIUM_PHOTOS).map(([id, photo]) => ['venue-' + id, photo])
  ),
  160: STADIUM_PHOTOS['2271'],
  176: STADIUM_PHOTOS['3113'],
  166: STADIUM_PHOTOS['4947'],
  363: STADIUM_PHOTOS['249']
});
const escape = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
export function stadiumFor(match, catalog = STADIUMS) {
  const venueId = match.venue?.id == null ? null : String(match.venue.id),
    homeId = match.homeId == null ? null : String(match.homeId);
  // Un lieu explicite prime sur le stade habituel, y compris un stade temporaire.
  const entry = venueId ? Object.values(catalog).find((entry) => entry.venueId === venueId) : null;
  const photo = entry ?? (venueId || match.neutralSite === true ? null : catalog[homeId]);
  if (
    !photo ||
    !/^stadiums\/[a-z0-9-]+\.webp$/.test(photo.image) ||
    !photo.author ||
    !photo.license ||
    !/^https:\/\//.test(photo.source) ||
    !/^https:\/\//.test(photo.licenseUrl)
  )
    return null;
  return { ...photo, confirmed: Boolean(venueId) };
}
export function stadiumMarkup(match, catalog = STADIUMS) {
  const photo = stadiumFor(match, catalog),
    fallback = `<div class="stadium-placeholder"><img src="stadiums/default-stadium.svg" width="960" height="540" alt="" loading="lazy" decoding="async"></div><span class="stadium-placeholder-name">${escape(match.venue?.name || 'Ambiance de stade')}<small>Illustration · photo à venir</small></span>`;
  if (!photo) return fallback;
  const place = photo.confirmed ? photo.name : `${photo.name} · lieu du match non confirmé`,
    credit = `${place} · ${photo.author} · ${photo.license} · image redimensionnée et recadrée`;
  return `${fallback}<img class="match-stadium-photo" src="${escape(photo.image)}" width="960" height="540" alt="" loading="lazy" decoding="async"><a class="stadium-name" href="${escape(photo.source)}" target="_blank" rel="noopener noreferrer" title="${escape(credit)}" aria-label="Crédit photo : ${escape(credit)}">${escape(photo.name)}</a>`;
}
const watched = new WeakSet();
export function bindStadiumImages(root) {
  if (!root?.querySelectorAll) return;
  root.querySelectorAll('.match-stadium-photo').forEach((img) => {
    if (watched.has(img)) return;
    watched.add(img);
    const show = () => img.parentElement.classList.toggle('stadium-ready', img.naturalWidth > 0),
      fail = () => {
        img.parentElement.classList.remove('stadium-ready');
        img.hidden = true;
      };
    img.addEventListener('load', show);
    img.addEventListener('error', fail);
    if (img.complete) {
      if (img.naturalWidth) show();
      else fail();
    }
  });
}
export function venueFromCompetition(competition) {
  const venue = competition?.venue;
  return {
    neutralSite: competition?.neutralSite === true,
    venue: venue?.id != null ? { id: String(venue.id), name: String(venue.fullName ?? '') } : null
  };
}
