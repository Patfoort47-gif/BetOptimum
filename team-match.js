// Rapprochement pur des noms d'équipes entre les différents fournisseurs.
const GENERIC = new Set(['fc', 'sc', 'ac', 'afc', 'cf', 'sk', 'ssc', 'stade', 'club', 'de', 'the']);
const ALIASES = new Map([
  ['rennais', 'rennes'],
  ['parissaintgermain', 'psg'],
  ['parissg', 'psg'],
  ['internazionale', 'inter'],
  ['intermilan', 'inter'],
  ['olympiquemarseille', 'marseille'],
  ['olympiquelyonnais', 'lyon'],
  ['manchesterutd', 'manchesterunited'],
  ['manutd', 'manchesterunited'],
  ['atleticomadrid', 'atleticomadrid'],
  ['atleticodemadrid', 'atleticomadrid'],
  ['bayernmunchen', 'bayernmunich'],
  ['borussiamonchengladbach', 'monchengladbach']
]);
export function teamTokens(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((word) => word && !GENERIC.has(word));
}
export function canonicalTeam(value) {
  const compact = teamTokens(value).join('');
  return ALIASES.get(compact) ?? compact;
}
export function sameTeam(a, b) {
  const x = canonicalTeam(a),
    y = canonicalTeam(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const left = teamTokens(a).filter((word) => word.length > 2),
    right = teamTokens(b).filter((word) => word.length > 2),
    common = left.filter((word) => right.includes(word));
  return (
    common.some((word) => word.length >= 4) &&
    (common.length === left.length || common.length === right.length)
  );
}
