// Les points de contrôle restent entre deux mesures, sans créer de pic intermédiaire.
export function smoothChartPath(points, tension = 0.4) {
  const coord = (value) => Math.round(value * 100) / 100;
  return points
    .map(([x, y], index) => {
      if (index === 0) return `M${coord(x)},${coord(y)}`;
      const [previousX, previousY] = points[index - 1];
      const bend = (x - previousX) * tension;
      return `C${coord(previousX + bend)},${coord(previousY)} ${coord(x - bend)},${coord(y)} ${coord(x)},${coord(y)}`;
    })
    .join(' ');
}
