export function sparkline(values, label = 'Tendance du résultat net réglé') {
  const points = values.map(Number).filter(Number.isFinite),
    empty = points.length < 2,
    min = Math.min(...points),
    max = Math.max(...points),
    range = max - min || 1,
    trend = empty ? 0 : points.at(-1) - points[0],
    color = empty ? 'var(--muted)' : trend < 0 ? 'var(--danger)' : 'var(--accent-text)',
    line = empty
      ? '2,20 118,20'
      : points
          .map(
            (value, i) =>
              `${2 + (i / (points.length - 1)) * 116},${max === min ? 20 : 36 - ((value - min) / range) * 32}`
          )
          .join(' '),
    safe = label.replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  return `<svg class="kpi-sparkline" viewBox="0 0 120 40" role="img" aria-label="${safe}${empty ? ' : données insuffisantes' : trend < 0 ? ' : en baisse' : trend > 0 ? ' : en hausse' : ' : stable'}"><polyline points="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
}
