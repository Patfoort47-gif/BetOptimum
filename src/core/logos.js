import { escapeHtml } from './html.js';
export const safeLogo = (url) =>
  typeof url === 'string' &&
  /^https:\/\/a\.espncdn\.com\/[\w\-./]+(?:\?(?:h=96&w=96|w=96&h=96))?$/.test(url)
    ? url
    : null;
export function initials(name) {
  const words = String(name ?? '')
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .split(' ')
    .filter((word) => word.length > 1 && !/^(FC|AC|AS|SC|CF|SS|RC|OGC|AFC|de|la|le)$/i.test(word));
  return (
    words.length > 1
      ? words
          .slice(0, 3)
          .map((word) => word[0])
          .join('')
      : (words[0] || String(name ?? '')).slice(0, 3)
  ).toUpperCase();
}
export function logoMarkup(cls, url, name, fallback = null) {
  const src = safeLogo(url),
    backup = safeLogo(fallback);
  return `<span class="${cls}${src ? '' : ' no-logo'}" data-initials="${escapeHtml(initials(name))}" aria-hidden="true">${src ? `<img src="${escapeHtml(src)}" width="36" height="36" alt="" loading="lazy" decoding="async" data-image-fallback="logo"${backup && backup !== src ? ` data-logo-fallback="${escapeHtml(backup)}"` : ''}>` : ''}</span>`;
}
