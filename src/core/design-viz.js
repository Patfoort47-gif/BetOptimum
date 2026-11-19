import { escapeHtml } from './html.js';
import { smoothChartPath } from './chart-path.js';

export function gaugeArc(value = 0, extraClass = '') {
  const arc = 'M17.28 114.59A84 84 0 1 1 182.72 114.59';
  return `<svg class="gauge viz-gauge ${extraClass}" viewBox="0 0 200 126" aria-hidden="true"><path class="gauge-track" d="${arc}" stroke-linecap="round"/><path class="gauge-fill" d="${arc}" pathLength="100" stroke-linecap="round" stroke-dasharray="100" stroke-dashoffset="${100 - value}"/></svg>`;
}

export function kpiCard(label, value, { caption = '', tone = '', help = '', detail = '' } = {}) {
  return `<div class="viz-kpi${tone ? ' viz-kpi-' + tone : ''}"><dt class="viz-kpi-label"><span>${escapeHtml(label)}</span>${help}<span class="viz-kpi-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 4v16h16M8 15l4-4 3 2 4-6"/></svg></span></dt><dd class="viz-kpi-value"><strong>${escapeHtml(value)}</strong>${detail}${caption ? `<span class="viz-kpi-caption">${escapeHtml(caption)}</span>` : ''}</dd></div>`;
}

export function financialTone(amount) {
  const value =
    typeof amount === 'string'
      ? parseFloat(amount.replace(',', '.').replace(/[\s\u00a0\u202f]/g, ''))
      : amount;
  return value > 0 ? 'positive' : value < 0 ? 'negative' : '';
}

export function vizCurve(points, { baseline, id, lineId, color = 'var(--accent)', tension = 0.4 }) {
  if (!points.length) return '';
  const path = smoothChartPath(points, tension),
    [firstX] = points[0],
    [lastX, lastY] = points.at(-1);
  const stroke = lineId ? `url(#${lineId})` : color;
  return `<defs>${lineId ? `<linearGradient id="${lineId}"><stop stop-color="${color}"/><stop offset="1" stop-color="${color}"/></linearGradient>` : ''}<linearGradient id="${id}" x2="0" y2="1"><stop stop-color="${color}" stop-opacity=".3"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs><path d="${path} L${lastX},${baseline} L${firstX},${baseline} Z" fill="url(#${id})" stroke="none"/><path d="${path}" class="viz-line" fill="none" stroke="${stroke}" vector-effect="non-scaling-stroke"/><circle class="viz-end" cx="${lastX}" cy="${lastY}" r="4" style="fill:${color}" aria-hidden="true"/>`;
}

export function vizBarGradient(prefix) {
  return `<defs>${[
    ['gain', 'var(--accent)'],
    ['loss', 'var(--danger)'],
    ['data', 'var(--info)']
  ]
    .map(
      ([tone, color]) =>
        `<linearGradient id="${prefix}-${tone}" x2="0" y2="1"><stop stop-color="${color}" stop-opacity=".85"/><stop offset="1" stop-color="${color}" stop-opacity=".15"/></linearGradient>`
    )
    .join('')}</defs>`;
}

export function vizBar({ x, y, width, height, tone, prefix, attrs = '' }) {
  const cap = Math.min(56, width),
    left = x - cap / 2,
    radius = Math.min(cap / 2, height / 2, 6);
  return `<g class="viz-bar viz-bar-${tone}" ${attrs}><rect x="${left}" y="${y}" width="${cap}" height="${height}" rx="6" style="fill:url(#${prefix}-${tone})"/><path class="viz-bar-cap" d="M${left},${y + radius} Q${left},${y} ${left + radius},${y} H${left + cap - radius} Q${left + cap},${y} ${left + cap},${y + radius}"/></g>`;
}
