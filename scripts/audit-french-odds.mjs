// One event, at most 4 usage credits; never publishes fixtures or changes secrets.
import { writeFile } from 'node:fs/promises';
const token = process.env.THE_ODDS_API_KEY;
if (!token) throw new Error('Secret THE_ODDS_API_KEY absent');
const sport = 'soccer_epl',
  books = ['betclic_fr', 'winamax_fr', 'winamax_de'],
  wanted = ['btts', 'totals', 'alternate_totals'];
let credits = 0;
async function get(path, params = {}) {
  const query = new URLSearchParams({ ...params, apiKey: token });
  let response;
  try {
    response = await fetch(`https://api.the-odds-api.com/v4/${path}?${query}`);
  } catch {
    throw new Error('Échec réseau du fournisseur');
  }
  if (!response.ok) throw new Error(`Fournisseur : HTTP ${response.status}`);
  const cost = Number(response.headers.get('x-requests-last') ?? 0);
  credits += cost;
  if (credits > 4) throw new Error('Coût inattendu : arrêt du diagnostic');
  return response.json();
}
const events = await get(`sports/${sport}/events`, { dateFormat: 'iso' }),
  now = Date.now();
const event = events
  .filter(
    (e) => Date.parse(e.commence_time) > now && Date.parse(e.commence_time) < now + 48 * 3600000
  )
  .sort((a, b) => Date.parse(a.commence_time) - Date.parse(b.commence_time))[0];
if (!event) throw new Error('Aucun match de Premier League dans les prochaines 48 h');
const availability = await get(`sports/${sport}/events/${event.id}/markets`, {
  bookmakers: books.join(',')
});
// Query the same named books directly, including alternate lines, regardless of
// discovery: the markets endpoint only lists recently seen keys, not all support.
const odds = await get(`sports/${sport}/events/${event.id}/odds`, {
  bookmakers: books.join(','),
  markets: wanted.join(','),
  oddsFormat: 'decimal',
  dateFormat: 'iso'
});
const report = {
  capturedAt: new Date().toISOString(),
  event: {
    id: event.id,
    sport,
    home: event.home_team,
    away: event.away_team,
    kickoff: event.commence_time
  },
  credits,
  books: books.map((key) => {
    const available = availability.bookmakers?.find((b) => b.key === key),
      book = odds.bookmakers?.find((b) => b.key === key);
    return {
      key,
      recentMarketKeys: available?.markets?.map((m) => m.key) ?? [],
      markets: (book?.markets ?? []).map((m) => ({
        key: m.key,
        updatedAt: m.last_update,
        outcomes: (m.outcomes ?? []).map((o) => ({ name: o.name, point: o.point, price: o.price }))
      }))
    };
  })
};
await writeFile('french-odds-audit.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
