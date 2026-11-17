// BET-98 : aperçus locaux uniquement, aucun envoi ni donnée personnelle.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildBriefing } from '../src/notifications/notification-briefing.js';
import { briefingEmail } from '../src/notifications/notification-email.js';
const output = resolve(process.argv[2] ?? 'work/email-previews');
await mkdir(output, { recursive: true });
const now = Date.parse('2027-04-10T06:00:00Z');
const prefs = {
  teams: ['Lille', 'Lens'],
  leagues: [],
  timezone: 'Europe/Paris',
  min_value: 0.01,
  min_confidence: 0.4
};
const fixtures = [
  ['lille-paris', 'Lille', 'Paris', 'Ligue 1', '19:00'],
  ['lens-rennes', 'Lens', 'Rennes', 'Ligue 1', '17:00'],
  ['madrid-barcelona', 'Madrid', 'Barcelone', 'Liga', '20:00']
].map(([id, home, away, league, time], i) => ({
  id,
  date: '2027-04-10',
  analysisStatus: 'ready',
  home,
  away,
  league,
  kickoff: `2027-04-10T${time}:00Z`,
  homeGoals: 2 + i * 0.1,
  awayGoals: 1.1,
  odds: { home: 2.4, draw: 3.4, away: 3.2, over: 2, btts: 1.9 },
  realOddsMarkets: ['home', 'draw', 'away', 'over', 'btts'],
  bookmakerOffers: Array.from({ length: 10 }, (_, i) => ({
    key: `demo-${i}`,
    name: 'Bookmaker fictif',
    home: 2.4,
    draw: 3.4,
    away: 3.2,
    over: 2,
    btts: 1.9,
    updatedAt: '2027-04-10T05:55:00Z'
  }))
}));
const bets = [
  {
    id: 'demo-simple',
    status: 'pending',
    bet_type: 'single',
    stake: 10,
    odds: 2.4,
    selections: [{ matchId: 'lille-paris', key: 'home', label: 'Lille gagne' }]
  },
  {
    id: 'demo-combine',
    status: 'pending',
    bet_type: 'combined',
    stake: 15,
    odds: 4.8,
    selections: [
      { matchId: 'lens-rennes', key: 'home', label: 'Lens gagne' },
      { matchId: 'lille-paris', key: 'over', label: 'Plus de 2,5 buts' }
    ]
  }
];
for (const [name, selection, chosen] of [
  ['quotidien', fixtures, prefs],
  ['favoris', fixtures.slice(0, 2), prefs],
  ['sans-favoris', fixtures.slice(2), { ...prefs, teams: [], leagues: [] }],
  ['sans-conseil', fixtures, { ...prefs, min_confidence: 1 }]
]) {
  const kinds = ['daily'];
  const data = buildBriefing(
    selection,
    chosen,
    { date: '2027-04-10', kinds },
    { bankroll: 1245.5 },
    bets,
    now,
    '2027-04-10T05:55:00Z',
    {
      history: [
        { id: 'demo-public-won', date: '2027-04-09', status: 'won', odd: 2.4 },
        { id: 'demo-public-lost', date: '2027-04-09', status: 'lost', odd: 1.8 }
      ],
      settledBets: [
        { id: 'demo-private-won', status: 'won', stake: 10, payout: 24 },
        { id: 'demo-private-lost', status: 'lost', stake: 15, payout: 0 }
      ]
    }
  );
  const email = briefingEmail(
    { ...data, demo: true },
    'https://patfoort47-gif.github.io/BetOptimum/'
  );
  await writeFile(resolve(output, `${name}.html`), email.html);
  await writeFile(resolve(output, `${name}.txt`), email.text);
}
console.log(`Quatre maquettes fictives HTML et texte : ${output}`);
