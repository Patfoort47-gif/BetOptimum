// Inventaire des marchés de football réellement servis par PropLine (BET-154, lot 1).
// Diagnostic en lecture seule, lancé à la main dans Actions avec le secret PROPLINE_API_KEY :
// aucune écriture dans data/, aucun déploiement, aucun commit. Rapport JSON + Markdown en artefact.
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const API = 'https://api.prop-line.com/v1';
// Compétitions suivies par le collecteur (même table que scripts/check-propline.mjs).
export const SPORTS = { 'Premier League': 'soccer_epl', 'Ligue 1': 'soccer_france_ligue_one', 'La Liga': 'soccer_spain_la_liga', 'Serie A': 'soccer_italy_serie_a', 'Bundesliga': 'soccer_germany_bundesliga', 'Ligue des champions': 'soccer_uefa_champs_league', 'Europa League': 'soccer_uefa_europa_league', 'Conference League': 'soccer_uefa_europa_conference_league' };
export const PERIODS = ['full', 'h1', 'h2'];
// Marchés déjà demandés par le collecteur (scripts/propline-odds.mjs, étape 2).
export const SUPPORTED = ['h2h', 'totals', 'both_teams_to_score', 'double_chance', 'draw_no_bet', 'team_totals'];
export const DEFAULT_BUDGET = 56, MAX_BUDGET = 60, EVENTS_PER_SPORT = 2;

// Famille proposée d'après la clé fournisseur : indicative, la matrice (BET-170) tranche.
const FAMILY_RULES = [
  ['Combinés', /(^|_)(and|combo|result_total|result_btts|double_chance_(total|btts)|btts_total)/],
  ['Joueurs', /^player_|^[23]plus_goals$|scorer|assist|shots|tackles|saves|fouls_committed|passes/],
  ['Corners', /corner/],
  ['Cartons', /card|booking/],
  ['Équipes', /team_total|both_teams|btts|clean_sheet|to_score|first_team|last_team|win_to_nil/],
  ['Buts', /total|goal|over|under|correct_score|exact|odd_even/],
  ['Résultat', /h2h|moneyline|1x2|double_chance|draw_no_bet|spread|handicap|winner|winning_margin|result|ht_ft|half_time_full_time/]
];
export const familyOf = (key, period = 'full') => { const k = String(key).toLowerCase(), base = (FAMILY_RULES.find(([, re]) => re.test(k)) ?? ['Autre'])[0]; return period === 'full' ? base : `Périodes · ${base}`; };

// La réponse /markets n'a pas de format documenté précis : on accepte un tableau d'objets, un objet {clé: nombre} ou {markets: ...}.
export function parseMarkets(body) {
  const list = Array.isArray(body) ? body : Array.isArray(body?.markets) ? body.markets : body?.markets && typeof body.markets === 'object' ? body.markets : body && typeof body === 'object' ? body : null;
  if (!list) return null;
  const rows = Array.isArray(list)
    ? list.map(item => typeof item === 'string' ? { key: item, outcomes: null } : { key: item?.key ?? item?.market ?? item?.market_key ?? item?.name, outcomes: outcomeCount(item) })
    : Object.entries(list).filter(([, value]) => typeof value === 'number' || Array.isArray(value)).map(([key, value]) => ({ key, outcomes: Array.isArray(value) ? value.length : value }));
  return rows.filter(row => typeof row.key === 'string' && /^[a-z0-9_:.-]{1,80}$/i.test(row.key));
}

// Format réel du 3 novembre : outcomes_count. Un compteur absent n'est pas zéro.
function outcomeCount(item) {
  if (Array.isArray(item?.outcomes)) return item.outcomes.length;
  const value = item?.outcomes ?? item?.outcomes_count ?? item?.outcome_count ?? item?.count;
  if (value == null || value === '' || typeof value === 'boolean') return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

// Des catalogues identiques ne prouvent pas que le fournisseur applique le filtre period.
export function periodWarnings(samples) {
  const byEvent = new Map(), warnings = [];
  for (const sample of samples) {
    const periods = byEvent.get(sample.eventId) ?? {};
    periods[sample.period] = JSON.stringify([...sample.markets].sort((a, b) => a.key.localeCompare(b.key)));
    byEvent.set(sample.eventId, periods);
  }
  for (const [eventId, periods] of byEvent) for (const period of ['h1', 'h2']) {
    if (periods.full && periods[period] === periods.full) warnings.push(`${eventId} : catalogue ${period} identique à full, période non confirmée`);
  }
  return warnings;
}

// Agrège les relevés {league, eventId, period, markets:[{key, outcomes}]} en une ligne par clé et période.
export function aggregate(samples) {
  const byKey = new Map();
  for (const sample of samples) for (const { key, outcomes } of sample.markets) {
    const id = `${key}|${sample.period}`, row = byKey.get(id) ?? { key, period: sample.period, family: familyOf(key, sample.period), supported: sample.period === 'full' && SUPPORTED.includes(key), leagues: new Set(), events: new Set(), maxOutcomes: null };
    row.leagues.add(sample.league); row.events.add(sample.eventId); if (outcomes != null) row.maxOutcomes = Math.max(row.maxOutcomes ?? 0, outcomes); byKey.set(id, row);
  }
  return [...byKey.values()].map(row => ({ ...row, leagues: [...row.leagues].sort(), events: row.events.size })).sort((a, b) => a.family.localeCompare(b.family, 'fr') || a.period.localeCompare(b.period) || a.key.localeCompare(b.key));
}

const cell = value => String(value).replace(/\|/g, '/').replace(/[\r\n]+/g, ' ');
export function renderMarkdown(report) {
  const lines = [`# Inventaire des marchés PropLine (BET-154)`, '', `Relevé du ${report.generatedAt} · ${report.requests} requêtes sur un budget de ${report.budget} · ${report.events} matchs dans ${report.leagues.length} compétitions.`, '', 'Une clé présente ici est servie par le fournisseur pour au moins un match : ce n’est ni une couverture garantie, ni une validation du règlement. La famille est une proposition à confirmer dans la matrice (BET-170).', ''];
  if (report.failures.length) lines.push('**Incidents** : ' + report.failures.map(cell).join(' ; '), '');
  if (report.warnings?.length) lines.push('**Périodes à confirmer** : ' + report.warnings.map(cell).join(' ; '), '');
  lines.push('La période est celle demandée à l’API, pas une période de sélection vérifiée. Les compteurs portent sur les issues du catalogue, pas sur le nombre de bookmakers ou de prix jouables. Les familles restent indicatives, notamment `2plus_goals` et `3plus_goals` (joueurs à confirmer sur les sélections).', '');
  lines.push('| Famille | Période | Clé fournisseur | Déjà collectée | Matchs | Issues max | Compétitions |', '|---|---|---|---|---|---|---|');
  for (const row of report.markets) lines.push(`| ${cell(row.family)} | ${row.period} | \`${cell(row.key)}\` | ${row.supported ? 'oui' : 'non'} | ${row.events} | ${row.maxOutcomes ?? '?'} | ${row.leagues.map(cell).join(', ')} |`);
  if (report.unparsed.length) lines.push('', `Réponses sans clé de marché reconnue (${report.unparsed.length}) : extraits dans \`propline-inventory.json\` (\`unparsed\`).`);
  lines.push('', 'Format brut de `/markets` (un extrait par période) : `raw` dans `propline-inventory.json`.');
  return lines.join('\n') + '\n';
}

// Collecte bornée : séquentielle, sans nouvelle tentative, arrêt sur 401/403/429. La clé ne sort jamais de l'en-tête.
export async function inventory({ key, fetchImpl = fetch, budget = DEFAULT_BUDGET, sports = SPORTS, now = new Date() } = {}) {
  if (!key) throw new Error('Secret PROPLINE_API_KEY absent');
  const limit = Math.min(Math.max(1, Math.floor(Number(budget) || DEFAULT_BUDGET)), MAX_BUDGET), samples = [], failures = [], unparsed = [], raw = {};
  let requests = 0, stopped = false;
  const get = async (path, label) => {
    if (stopped || requests >= limit) { if (!stopped) failures.push('Budget de requêtes atteint'); stopped = true; return null; }
    requests++;
    try {
      const response = await fetchImpl(`${API}${path}`, { headers: { 'X-API-Key': key, Accept: 'application/json' }, signal: AbortSignal.timeout(20000), redirect: 'error' });
      if (!response.ok) { failures.push(`${label} : HTTP ${response.status}`); if ([401, 403, 429].includes(response.status)) stopped = true; return null; }
      return await response.json();
    } catch { failures.push(`${label} : réponse indisponible`); return null; }
  };
  for (const [league, sport] of Object.entries(sports)) {
    const events = await get(`/sports/${encodeURIComponent(sport)}/events`, league);
    if (stopped && !events) break;
    const upcoming = (Array.isArray(events) ? events : events?.events ?? []).filter(event => event?.id && !(Date.parse(event.commence_time ?? event.start_time) < now.getTime())).slice(0, EVENTS_PER_SPORT);
    for (const event of upcoming) for (const period of PERIODS) {
      const body = await get(`/sports/${encodeURIComponent(sport)}/events/${encodeURIComponent(event.id)}/markets${period === 'full' ? '' : `?period=${period}`}`, `${league} ${period}`);
      if (body == null) { if (stopped) break; continue; }
      // Un extrait brut par période est toujours gardé : il montre le format réel de /markets, même quand il est reconnu.
      raw[period] ??= { league, sample: JSON.stringify(body).slice(0, 800) };
      const markets = parseMarkets(body);
      if (markets?.length) samples.push({ league, eventId: String(event.id), period, markets }); else if (unparsed.length < 5) unparsed.push({ league, period, sample: JSON.stringify(body).slice(0, 500) });
    }
    if (stopped) break;
  }
  const leagues = [...new Set(samples.map(sample => sample.league))];
  return { generatedAt: now.toISOString(), budget: limit, requests, events: new Set(samples.map(sample => sample.eventId)).size, leagues, failures, warnings: periodWarnings(samples), unparsed, raw, samples, markets: aggregate(samples) };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const report = await inventory({ key: process.env.PROPLINE_API_KEY, budget: process.env.PROPLINE_INVENTORY_BUDGET });
  await writeFile('propline-inventory.json', JSON.stringify(report, null, 2) + '\n');
  const markdown = renderMarkdown(report);
  await writeFile('propline-inventory.md', markdown);
  if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, markdown, { flag: 'a' });
  console.log(`::notice title=Inventaire PropLine::${report.markets.length} clés, ${report.events} matchs, ${report.requests} requêtes, ${report.failures.length} incidents`);
  if (!report.markets.length) throw new Error('Aucun marché relevé : consulter le rapport');
}
