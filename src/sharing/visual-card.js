// PNG généré localement, aucun dépôt public ni requête vers une messagerie.
export function visualCardFile({ title, lines, filename = 'betoptimum.png' }) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 630;
  const c = canvas.getContext('2d');
  c.fillStyle = '#101827';
  c.fillRect(0, 0, 1200, 630);
  c.fillStyle = '#c8f03c';
  c.font = 'bold 36px sans-serif';
  c.fillText('BetOptimum', 60, 70);
  c.fillStyle = '#ffffff';
  c.font = 'bold 48px sans-serif';
  c.fillText(title, 60, 160, 1080);
  c.font = '32px sans-serif';
  lines.slice(0, 6).forEach((line, i) => c.fillText(line, 60, 230 + i * 53, 1080));
  c.fillStyle = '#cbd5e1';
  c.font = '24px sans-serif';
  c.fillText('paris virtuels · 18+ · aucune garantie', 60, 590);
  const encoded = canvas.toDataURL('image/png').split(',')[1],
    bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  return new File([bytes], filename, { type: 'image/png' });
}
export async function shareVisualCard(payload, url) {
  const file = visualCardFile(payload),
    text = [payload.title, ...payload.lines, 'paris virtuels · 18+ · aucune garantie'].join('\n');
  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({ title: payload.title, text, url, files: [file] });
      return 'shared';
    } catch (error) {
      if (error.name === 'AbortError') return 'cancelled';
      throw error;
    }
  }
  const href = URL.createObjectURL(file),
    a = document.createElement('a');
  a.href = href;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 30000);
  return 'downloaded';
}
