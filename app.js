import { syncStudy } from './src/core/sync-study.js';
import { financialTone, gaugeArc, kpiCard, vizCurve } from './src/core/design-viz.js';
import { oddsHealthLabel } from './src/core/odds-health.js';
import { safeLogo, logoMarkup as logoTag } from './src/core/logos.js';
import { teamLogoMarkup } from './src/matches/team-logos.js';
import {
  INVITATION_KEY,
  invitationPreview,
  invitationLink,
  invitationCard,
  parseInvitation,
  saveInvitation,
  readInvitation
} from './src/club/private-invitation.js';
import { shareVisualCard } from './src/sharing/visual-card.js';
import { closingMarkup } from './src/history/closing-odds.js';
import { matchPreviewMarkup } from './src/matches/match-preview.js';
import { decimal } from './src/core/number-format.js';
import { escapeHtml as html } from './src/core/html.js';
import { installImageFallbacks } from './src/core/image-fallback.js';
import { renderCalibration } from './src/history/prediction-calibration.js';
import { predictionProvenance } from './src/history/prediction-provenance.js';
import { fairOddsMarkup } from './src/matches/fair-odds.js';
import { opportunityMarkup, valueBetMarkup, dataBasisMarkup } from './src/matches/opportunity.js';
import { prepareAnalyses } from './src/model/analysis-loader.js';
import { initInbox } from './src/club/in-app-notifications.js';
import { dailyPicks } from './src/club/daily-picks.js';
import {
  ticketUrl,
  ticketToken,
  saveTicketDraft,
  readTicketDraft
} from './src/ticket/ticket-url.js';
import { restoreTicket } from './src/ticket/ticket-restore.js';
import { emptyState } from './src/core/empty-state.js';
import { createAttention } from './src/club/attention.js';
import { initPwa } from './src/core/pwa.js';
initPwa();
import { teamFormMarkup } from './src/matches/team-form.js';
import { copyBetSelections } from './src/ticket/copy-bet.js';
import { UI_COPY, applyUiCopy } from './src/core/ui-copy.js';
import { initMetricHelp } from './src/matches/metric-help.js?v=bet194';
import { initHeaderOffset } from './src/core/layout-offset.js';
import {
  adjustStake,
  stakeCents,
  stakeIssue,
  percentageStake
} from './src/ticket/stake-controls.js';
import {
  quoteAvailable,
  dailyQuoteAvailable,
  selectionBookmakerCount
} from './src/model/quote-policy.js';
import { stadiumMarkup, bindStadiumImages } from './src/matches/stadiums.js';
import { LEGACY_MARKETS, selectionCondition } from './src/model/markets.js';
import { marketCard } from './src/matches/market-card.js?v=bet191';
import { initPersonalDashboard } from './src/history/personal-dashboard.js?v=bet194';
import { historyReport, historyCard } from './src/history/bet-history.js';
import { createJsonLoader } from './src/core/data-loader.js';
import { createMobileDiagnostics } from './src/core/mobile-diagnostics.js';
import {
  readFixtureCache,
  writeFixtureCache,
  clearLegacyFixtureCache
} from './src/core/fixture-cache.js';
import { matchesWithBookmakers, orderCalendar, byConfidence } from './src/model/calendar-model.js';
const motionBehavior = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 'auto'
    : 'smooth';
import {
  readGuestWallet,
  saveGuestWallet,
  guestWalletFrom,
  placeGuestTicket,
  settleGuestWallet
} from './src/ticket/guest-wallet.js';
import { createSubmission } from './src/ticket/bet-submission.js';
import { renderPredictionShowcase } from './src/history/prediction-showcase.js?v=bet194';
import { predictionReport, publicPredictionHistory } from './src/history/prediction-report.js';
import { freshness, sourceFreshness } from './src/core/data-freshness.js';
import { initAnalytics } from './src/history/analytics.js';
import {
  analyseMatch,
  recommendedMarket,
  confidenceKpi,
  optimizeCombo,
  selectionResult,
  settleBet,
  systemLines,
  settleSystemBet,
  settleTicket,
  quotaUsed,
  quotaRemaining,
  leagueEligibility,
  WEEKLY_QUOTA,
  LEAGUE_ODDS_CAP,
  parisDate,
  weekKey,
  levelFromXp,
  titleForLevel,
  selectSpotlight,
  selectDailySelection
} from './src/model/model.js';
import { BADGES, challengeScore } from './src/club/rewards.js';
import { nextOddsRefresh, ODDS_REFRESH_HOURS } from './src/model/odds-cache.js';
import { roundEnd, roundLabel } from './src/club/league-round.js';
import { renderClubTable } from './src/club/club-table.js';
import {
  echelonName,
  chevrons,
  divisionOf,
  divisionIndex,
  seasonKey,
  seasonDates,
  seasonLabel,
  monthKey,
  outcomeLabel
} from './src/club/league.js';
import { ticketFit, MAX_SPECIAL_LEAGUES } from './src/club/special.js';
import {
  PRIVATE_EMBLEMS,
  emblemOf,
  normalizeCode,
  validLeagueName,
  canCreateOrJoin,
  PRIVATE_LIMITS,
  activityText,
  suggestPlayers
} from './src/club/community.js';
import { avatarMarkup, legacyOf } from './src/avatar/avatar-view.js';
import {
  liveEntryFromPayload,
  previousDate,
  inLiveWindow,
  applyLiveSnapshot
} from './src/matches/live.js';
import {
  CELEBRATION_SEEN_KEY,
  CELEBRATION_PENDING_KEY,
  celebrationDue,
  celebrationColors,
  equippedOf,
  soundEnabled
} from './src/club/celebration-model.js';
const STORAGE_KEY = 'betmaster-state-v1';
const isoDate = (offset) => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};
const DEFAULT_MATCHES = [
  {
    id: 'psg-om',
    date: isoDate(0),
    priority: 100,
    featured: true,
    league: 'Ligue 1',
    time: '21:00',
    home: 'Paris SG',
    away: 'Marseille',
    homeGoals: 2.4,
    awayGoals: 1.1,
    odds: { home: 1.62, draw: 4.2, away: 5.1, over: 1.72, btts: 1.86 }
  },
  {
    id: 'ars-che',
    date: isoDate(0),
    priority: 94,
    featured: true,
    league: 'Premier League',
    time: '18:30',
    home: 'Arsenal',
    away: 'Chelsea',
    homeGoals: 2.0,
    awayGoals: 1.3,
    odds: { home: 1.88, draw: 3.75, away: 4.1, over: 1.78, btts: 1.7 }
  },
  {
    id: 'lyo-lil',
    date: isoDate(0),
    priority: 72,
    league: 'Ligue 1',
    time: '19:00',
    home: 'Lyon',
    away: 'Lille',
    homeGoals: 1.6,
    awayGoals: 1.4,
    odds: { home: 2.35, draw: 3.3, away: 2.9, over: 1.92, btts: 1.72 }
  },
  {
    id: 'rea-sev',
    date: isoDate(1),
    priority: 86,
    featured: true,
    league: 'La Liga',
    time: '20:45',
    home: 'Real Madrid',
    away: 'Séville',
    homeGoals: 2.3,
    awayGoals: 0.9,
    odds: { home: 1.42, draw: 4.9, away: 7.2, over: 1.65, btts: 1.95 }
  },
  {
    id: 'juv-nap',
    date: isoDate(1),
    priority: 91,
    featured: true,
    league: 'Serie A',
    time: '20:45',
    home: 'Juventus',
    away: 'Naples',
    homeGoals: 1.6,
    awayGoals: 1.5,
    odds: { home: 2.25, draw: 3.25, away: 3.2, over: 2.05, btts: 1.74 }
  },
  {
    id: 'mon-nic',
    date: isoDate(1),
    priority: 64,
    league: 'Ligue 1',
    time: '19:00',
    home: 'Monaco',
    away: 'Nice',
    homeGoals: 1.8,
    awayGoals: 1.2,
    odds: { home: 1.95, draw: 3.55, away: 3.7, over: 1.75, btts: 1.68 }
  },
  {
    id: 'bay-lei',
    date: isoDate(2),
    priority: 90,
    featured: true,
    league: 'Bundesliga',
    time: '20:30',
    home: 'Bayern Munich',
    away: 'RB Leipzig',
    homeGoals: 2.5,
    awayGoals: 1.6,
    odds: { home: 1.58, draw: 4.5, away: 5.2, over: 1.48, btts: 1.57 }
  },
  {
    id: 'liv-new',
    date: isoDate(2),
    priority: 84,
    league: 'Premier League',
    time: '21:00',
    home: 'Liverpool',
    away: 'Newcastle',
    homeGoals: 2.2,
    awayGoals: 1.2,
    odds: { home: 1.65, draw: 4.1, away: 4.8, over: 1.55, btts: 1.69 }
  },
  {
    id: 'bar-ath',
    date: isoDate(3),
    priority: 88,
    featured: true,
    league: 'La Liga',
    time: '21:00',
    home: 'FC Barcelone',
    away: 'Atlético Madrid',
    homeGoals: 2.1,
    awayGoals: 1.2,
    odds: { home: 1.78, draw: 3.8, away: 4.4, over: 1.73, btts: 1.67 }
  },
  {
    id: 'int-ata',
    date: isoDate(3),
    priority: 76,
    league: 'Serie A',
    time: '20:45',
    home: 'Inter Milan',
    away: 'Atalanta',
    homeGoals: 1.9,
    awayGoals: 1.5,
    odds: { home: 1.92, draw: 3.65, away: 3.95, over: 1.68, btts: 1.62 }
  },
  {
    id: 'dor-lev',
    date: isoDate(4),
    priority: 80,
    league: 'Bundesliga',
    time: '20:30',
    home: 'Dortmund',
    away: 'Leverkusen',
    homeGoals: 1.9,
    awayGoals: 1.8,
    odds: { home: 2.4, draw: 3.7, away: 2.65, over: 1.48, btts: 1.46 }
  },
  {
    id: 'mil-rom',
    date: isoDate(4),
    priority: 73,
    league: 'Serie A',
    time: '20:45',
    home: 'AC Milan',
    away: 'AS Roma',
    homeGoals: 1.7,
    awayGoals: 1.3,
    odds: { home: 2.05, draw: 3.35, away: 3.6, over: 1.9, btts: 1.7 }
  },
  {
    id: 'mci-mun',
    date: isoDate(5),
    priority: 99,
    featured: true,
    league: 'Premier League',
    time: '17:30',
    home: 'Manchester City',
    away: 'Manchester United',
    homeGoals: 2.4,
    awayGoals: 1.2,
    odds: { home: 1.55, draw: 4.5, away: 5.4, over: 1.52, btts: 1.65 }
  },
  {
    id: 'mar-mon',
    date: isoDate(5),
    priority: 75,
    league: 'Ligue 1',
    time: '21:00',
    home: 'Marseille',
    away: 'Monaco',
    homeGoals: 1.7,
    awayGoals: 1.6,
    odds: { home: 2.2, draw: 3.55, away: 3.0, over: 1.66, btts: 1.58 }
  },
  {
    id: 'rea-bar',
    date: isoDate(6),
    priority: 100,
    featured: true,
    league: 'La Liga',
    time: '21:00',
    home: 'Real Madrid',
    away: 'FC Barcelone',
    homeGoals: 2.0,
    awayGoals: 1.9,
    odds: { home: 2.05, draw: 3.65, away: 3.3, over: 1.52, btts: 1.48 }
  },
  {
    id: 'psg-lyo',
    date: isoDate(6),
    priority: 78,
    league: 'Ligue 1',
    time: '20:45',
    home: 'Paris SG',
    away: 'Lyon',
    homeGoals: 2.3,
    awayGoals: 1.1,
    odds: { home: 1.52, draw: 4.4, away: 5.8, over: 1.57, btts: 1.78 }
  }
];
let saved = null;
try {
  saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
} catch {}
let guestStorage = null;
try {
  guestStorage = globalThis.localStorage;
} catch {}
let guestWallet = readGuestWallet(guestStorage),
  guestStorageReady = saveGuestWallet(guestWallet, guestStorage);
const syncOfferKey = 'betoptimum-sync-offer';
let syncPromptChoice = null,
  syncPromptDate = null,
  syncReturnActive = false,
  syncTrial = null;
try {
  const savedOffer = JSON.parse(localStorage.getItem(syncOfferKey));
  syncPromptChoice = savedOffer?.choice;
  syncPromptDate = savedOffer?.date;
  if (syncPromptChoice === 'intent' && syncPromptDate < isoDate(-7)) {
    syncPromptChoice = null;
    localStorage.removeItem(syncOfferKey);
  }
  syncTrial = syncStudy(localStorage, new URLSearchParams(location.search).get('etude-sync'), () =>
    isoDate(0)
  );
} catch {}
function saveSyncPromptChoice(choice) {
  syncPromptChoice = choice;
  syncPromptDate = isoDate(0);
  try {
    localStorage.setItem(syncOfferKey, JSON.stringify({ choice, date: syncPromptDate }));
  } catch {}
}
const calendarContextKey = 'betoptimum-calendar-context';
let calendarContext;
try {
  calendarContext = JSON.parse(localStorage.getItem(calendarContextKey));
} catch {}
const requestedCalendarDate = new URLSearchParams(location.search).get('date');
const explicitCalendarDate =
  requestedCalendarDate === 'week' ||
  (requestedCalendarDate >= isoDate(-3) &&
    requestedCalendarDate <= isoDate(6) &&
    /^\d{4}-\d{2}-\d{2}$/.test(requestedCalendarDate))
    ? requestedCalendarDate
    : null;
const linkedCalendarMatch = /^#match-(espn-[0-9]+)$/.test(location.hash);
const rememberedDate = calendarContext?.date;
let chosenCalendarDate =
  rememberedDate === 'week' ||
  (/^\d{4}-\d{2}-\d{2}$/.test(rememberedDate) &&
    rememberedDate >= isoDate(0) &&
    rememberedDate <= isoDate(6))
    ? rememberedDate
    : null;
let findInitialCalendarDate = !explicitCalendarDate && !linkedCalendarMatch && !chosenCalendarDate;

function rememberCalendarContext() {
  findInitialCalendarDate = false;
  try {
    localStorage.setItem(
      calendarContextKey,
      JSON.stringify({
        date: chosenCalendarDate,
        leagues: state.selectedLeagues,
        favorites: state.filter === 'Favoris'
      })
    );
  } catch {}
}
const state = {
  bankroll: guestWallet.bankroll,
  initial: 1000,
  history: [],
  legacy: (saved?.history ?? []).map((bet) => Object.assign(bet, { legacy: true })),
  serverBets: [],
  serverReady: false,
  countsLeague: true,
  dailyChallenge: null,
  dailyPicks: [],
  league: null,
  special: null,
  progress: null,
  xpMap: {},
  private: null,
  followIds: new Set(),
  community: {
    tab: 'league',
    scope: 'season',
    sort: 'points',
    division: '',
    club: '',
    search: '',
    page: 1,
    general: null,
    follows: null,
    hall: null,
    podium: null
  },
  capitalEvents: saved?.capitalEvents ?? [],
  favoriteTeams: saved?.favoriteTeams ?? [],
  favoriteLeagues: saved?.favoriteLeagues ?? [],
  predictionHistory: saved?.predictionHistory ?? [],
  onboardingSeen: saved?.onboardingSeen === true,
  profile: {
    nickname: 'Parieur',
    avatar: 'lime',
    face: 'smile',
    accessory: 'none',
    ...(saved?.profile ?? {})
  },
  challengeEntries: saved?.challengeEntries ?? [],
  communityProfiles: [],
  communityStatus: 'loading',
  leaderboardPeriod: 'week',
  playerSearch: '',
  predictionFilters: {
    period: 'all',
    league: 'all',
    market: 'all',
    result: 'all',
    source: 'bookmaker'
  },
  predictionPage: 1,
  liveMatches: [],
  results: [],
  ticket: [],
  betMode: 'combined',
  filter: !linkedCalendarMatch && calendarContext?.favorites ? 'Favoris' : 'Tous',
  selectedLeagues:
    !linkedCalendarMatch && Array.isArray(calendarContext?.leagues)
      ? calendarContext.leagues.filter((league) => typeof league === 'string')
      : [],
  dateFilter:
    explicitCalendarDate ?? (linkedCalendarMatch ? null : chosenCalendarDate) ?? isoDate(0),
  live: {},
  liveErrors: {},
  revealed: new Set(),
  goal: null,
  oddsUpdatedAt: null,
  oddsRefreshHours: ODDS_REFRESH_HOURS
};
const $ = (s) => document.querySelector(s);
const money = (n) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
const allMatches = () => [...(state.liveMatches.length ? state.liveMatches : DEFAULT_MATCHES)];
let activeTab = 'matches',
  detailsPromise = null;
let attention = null;
let inbox = null;
function renderAttention() {
  if (typeof window === 'undefined') return;
  for (const [group, selector, label] of [
    ['bets', '[data-tab=bankroll],[data-mobile-target=bankroll]', 'Nouveau résultat'],
    [
      'rewards',
      '[data-tab=community],[data-mobile-target=community],[data-ctab=challenges]',
      'Nouvelle récompense'
    ]
  ])
    document.querySelectorAll(selector).forEach((button) => {
      let dot = button.querySelector('.attention-dot');
      if (!dot) {
        dot = document.createElement('span');
        dot.className = 'attention-dot';
        dot.setAttribute('role', 'img');
        dot.setAttribute('aria-label', label);
        button.append(dot);
      }
      dot.hidden = !attention?.pending(group);
    });
}
function updateBetAttention() {
  inbox?.bets(state.serverBets);
  if (!attention) return;
  attention.update(
    'bets',
    state.serverBets
      .filter((b) => b.status !== 'pending')
      .map((b) => String(b.id) + ':' + b.status),
    activeTab === 'bankroll'
  );
  renderAttention();
}
function updateRewardAttention(data) {
  inbox?.rewards(data);
  if (!attention || !data) return;
  attention.update(
    'rewards',
    [
      ...(data.badges ?? []).map((id) => 'badge:' + id),
      ...(data.results ?? []).map((r) => [r.week_start, r.challenge_id, r.rank].join(':'))
    ],
    activeTab === 'community' && state.community.tab === 'challenges'
  );
  renderAttention();
}
const loadJson = createJsonLoader(),
  mobileDiagnostics = createMobileDiagnostics(),
  markFixtureNetwork = mobileDiagnostics && ((phase) => mobileDiagnostics.mark('reseau-' + phase));
const WEEK_MATCH_BATCH = 8;
let lastFixtureVersion = null,
  fixturePreview = null,
  fixtureAnalyses = new Map(),
  visibleWeekLimit = WEEK_MATCH_BATCH,
  fixtureRefresh = null,
  lastFixtureRequestAt = -Infinity,
  archiveLoadedAt = 0,
  archiveStatus = 'loading',
  archivePromise = null;
const cachedPublicForecastIds = new Set(
  Array.isArray(saved?.publicPredictionIds) ? saved.publicPredictionIds : []
);
let publicForecastArchive = state.predictionHistory.filter((entry) =>
    cachedPublicForecastIds.has(entry?.id)
  ),
  publicForecastSignatures = null,
  archivedForecastVariants = Array.isArray(saved?.privatePredictionVariants)
    ? saved.privatePredictionVariants
    : [];
let cloudSave = () => {},
  accountAuthenticated = false,
  accountUserId = null,
  details = null,
  accountApi = null,
  betAttempt = null,
  betConfirmed = false,
  lastSharedTicket = null,
  join = null;
const profileHash = /^#joueur-(.+)$/.exec(location.hash);
const hasAccountCallback = () =>
  [new URLSearchParams(location.search), new URLSearchParams(location.hash.slice(1))].some(
    (params) =>
      ['access_token', 'refresh_token', 'error', 'error_code', 'code', 'token_hash'].some((key) =>
        params.has(key)
      )
  );
function hasStoredSession() {
  try {
    for (let index = 0; index < localStorage.length; index++) {
      if (/^sb-.+-auth-token$/.test(localStorage.key(index))) return true;
    }
  } catch {}
  return false;
}
const knownAccountSession = hasStoredSession();
const accountCallbackOnLoad = hasAccountCallback();
let accountPromise = null,
  detailStyles = null;
const joinOnLoad = location.hash === '#rejoindre',
  challengesOnLoad = location.hash === '#challenges';
let pendingAlertMatch = /^#match-(espn-[0-9]+)$/.exec(location.hash)?.[1] ?? null;
function captureCalendarPosition(matchId) {
  if (activeTab !== 'matches') return null;
  const card = document.getElementById(`match-${matchId}`),
    offset = card?.getBoundingClientRect().top,
    top = window.scrollY;
  return () =>
    requestAnimationFrame(() => {
      if (activeTab !== 'matches') return;
      const current = card && document.getElementById(card.id);
      window.scrollTo({
        top: current ? window.scrollY + current.getBoundingClientRect().top - offset : top,
        behavior: 'instant'
      });
    });
}
function loadDetailStyles() {
  const before = $('#components-style');
  if (!before) return Promise.resolve();
  return (detailStyles ??= new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'styles/details.css?v=bet379';
    link.addEventListener('load', resolve, { once: true });
    link.addEventListener(
      'error',
      () => {
        link.remove();
        detailStyles = null;
        reject(new Error('Styles des fiches indisponibles'));
      },
      { once: true }
    );
    before.before(link);
  }));
}
function ensureDetails() {
  if (!detailsPromise)
    detailsPromise = Promise.all([
      import('./src/matches/details.js?v=fiches-8'),
      loadDetailStyles()
    ])
      .then(
        ([module]) =>
          (details = module.initDetails({
            allMatches,
            logoTag,
            leagueLogoUrl,
            LEAGUES,
            isLive,
            kickoffAt,
            state,
            toast,
            updateScrollers,
            captureCalendarPosition,
            onLiveEntry: (match, entry) =>
              renderLiveUpdates(
                recordLiveEntry(allMatches().find((m) => m.id === match.id) ?? match, entry)
              )
          }))
      )
      .catch((error) => {
        detailsPromise = null;
        throw error;
      });
  return detailsPromise;
}
function useDetails(action) {
  return ensureDetails()
    .then(action)
    .catch((error) => {
      console.error('Fiches indisponibles', error);
      toast('Fiche indisponible : réessayez dans un instant.');
    });
}
function openAlertMatch() {
  if (!pendingAlertMatch) return;
  const match = allMatches().find((item) => item.id === pendingAlertMatch);
  if (!match) return;
  const id = pendingAlertMatch;
  useDetails((api) => {
    if (pendingAlertMatch !== id) return;
    pendingAlertMatch = null;
    findInitialCalendarDate = false;
    state.dateFilter = match.date;
    state.selectedLeagues = [];
    state.filter = 'Tous';
    setActiveTab('matches', false);
    renderDateNavigator();
    renderFilters();
    renderMatches();
    document.getElementById(`match-${id}`)?.scrollIntoView({ block: 'start' });
    api.openMatch(match);
  });
}
// Paris certifiés : enregistrés et réglés par le serveur (state.serverBets). Les anciens paris du navigateur (state.legacy) restent consultables « avant saison 1 ».
const fromServerBet = (b) => ({
  id: b.id,
  date: b.placed_at,
  items: b.selections,
  stake: Number(b.stake),
  odds: Number(b.odds),
  status: b.status,
  betType: b.bet_type,
  systemFormula: b.system_formula,
  systemLines: b.system_lines ?? undefined,
  returnAmount: b.status === 'pending' ? undefined : Number(b.payout),
  settledAt: b.settled_at,
  countsGeneral: b.counts_general,
  valueBet: b.value_bet,
  certified: true
});
function rebuildHistory() {
  state.history = [...state.serverBets, ...state.legacy].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );
}
rebuildHistory();
function forecastSignature(entry) {
  return JSON.stringify(entry, (_, value) =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
      : value
  );
}
function isPublicForecast(entry) {
  publicForecastSignatures ??= new Set(publicForecastArchive.map(forecastSignature));
  return publicForecastSignatures.has(forecastSignature(entry));
}
function installPublicForecasts(entries) {
  const publicIds = new Set(publicForecastArchive.map((entry) => entry.id));
  archivedForecastVariants = entries.filter(
    (entry) => publicIds.has(entry?.id) && !isPublicForecast(entry)
  );
  state.predictionHistory = [
    ...entries.filter((entry) => entry && !publicIds.has(entry.id)),
    ...publicForecastArchive
  ];
}
function saveLocalState() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...userStatePayload(state.predictionHistory),
        privatePredictionVariants: archivedForecastVariants,
        publicPredictionIds: publicForecastArchive.map((entry) => entry.id)
      })
    );
  } catch {}
}
function cloudForecasts() {
  const publicRows = new Set(publicForecastArchive);
  return [...state.predictionHistory, ...archivedForecastVariants].filter(
    (entry) => !publicRows.has(entry) && !isPublicForecast(entry)
  );
}
function userStatePayload(predictionHistory = cloudForecasts()) {
  return {
    bankroll: state.bankroll,
    initial: state.initial,
    guestSimulation: guestWallet,
    history: state.legacy,
    capitalEvents: state.capitalEvents,
    favoriteTeams: state.favoriteTeams,
    favoriteLeagues: state.favoriteLeagues,
    predictionHistory,
    onboardingSeen: state.onboardingSeen,
    profile: state.profile
  };
}
function persist() {
  saveLocalState();
  if (accountAuthenticated) cloudSave(userStatePayload());
}
function applySyncedState(data) {
  if (!data || typeof data !== 'object') return;
  if (data.guestSimulation) {
    guestWallet = guestWalletFrom(data.guestSimulation);
    guestStorageReady = saveGuestWallet(guestWallet, guestStorage);
  }
  state.bankroll = Number.isFinite(Number(data.bankroll))
    ? Math.max(0, Number(data.bankroll))
    : 1000;
  state.initial = Number.isFinite(Number(data.initial))
    ? Math.max(0, Number(data.initial))
    : state.bankroll;
  state.legacy = (Array.isArray(data.history) ? data.history : []).map((bet) =>
    Object.assign(bet, { legacy: true })
  );
  rebuildHistory();
  state.capitalEvents = Array.isArray(data.capitalEvents) ? data.capitalEvents : [];
  state.favoriteTeams = Array.isArray(data.favoriteTeams) ? data.favoriteTeams : [];
  state.favoriteLeagues = Array.isArray(data.favoriteLeagues) ? data.favoriteLeagues : [];
  installPublicForecasts(Array.isArray(data.predictionHistory) ? data.predictionHistory : []);
  state.onboardingSeen = data.onboardingSeen === true || state.onboardingSeen;
  if (state.onboardingSeen) $('#discovery').hidden = true;
  state.profile =
    data.profile && typeof data.profile === 'object'
      ? { nickname: 'Parieur', avatar: 'lime', face: 'smile', accessory: 'none', ...data.profile }
      : state.profile;
  saveLocalState();
  render();
  toast('Données synchronisées');
}
function resetSyncedState() {
  lastSharedTicket = null;
  const success = $('#bet-success');
  if (success) success.hidden = true;
  betConfirmed = false;
  betAttempt = null;
  state.bankroll = guestWallet.bankroll;
  state.initial = 1000;
  state.legacy = [];
  state.serverBets = [];
  state.serverReady = false;
  state.history = [];
  state.capitalEvents = [];
  state.favoriteTeams = [];
  state.favoriteLeagues = [];
  installPublicForecasts([]);
  state.profile = { nickname: 'Parieur', avatar: 'lime', face: 'smile', accessory: 'none' };
  state.challengeEntries = [];
  state.ticket = [];
  rememberTicket();
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
  render();
}
// Logos servis en direct par le CDN d'ESPN : adresses fournies par le pipeline, repli sur l'identifiant ESPN de la compétition.
// Compétitions suivies : [identifiant du logo ESPN, importance pour le tri, famille, version sombre du logo disponible, slug ESPN].
const LEAGUES = {
  'Ligue des champions': [2, 42, 'europe', 1, 'uefa.champions'],
  'Coupe du monde des clubs': [1932, 38, 'europe', 1, 'fifa.cwc'],
  "Supercoupe d'Europe": [1272, 36, 'europe', 1, 'uefa.super_cup'],
  'Premier League': [23, 34, 'league', 1, 'eng.1'],
  'La Liga': [15, 33, 'league', 1, 'esp.1'],
  Bundesliga: [10, 32, 'league', 1, 'ger.1'],
  'Serie A': [12, 31, 'league', 1, 'ita.1'],
  'Ligue 1': [9, 30, 'league', 1, 'fra.1'],
  'Ligue des nations': [2395, 30, 'nations', 1, 'uefa.nations'],
  'Qualifications Coupe du monde': [67, 30, 'nations', 1, 'fifa.worldq.uefa'],
  'Europa League': [2310, 28, 'europe', 1, 'uefa.europa'],
  'FA Cup': [40, 27, 'cup', 1, 'eng.fa'],
  'Coupe de France': [182, 26, 'cup', 1, 'fra.coupe_de_france'],
  'Copa del Rey': [80, 26, 'cup', 1, 'esp.copa_del_rey'],
  'Coppa Italia': [2192, 25, 'cup', 0, 'ita.coppa_italia'],
  'DFB-Pokal': [2061, 25, 'cup', 1, 'ger.dfb_pokal'],
  'Conference League': [20296, 24, 'europe', 1, 'uefa.europa.conf'],
  'Carabao Cup': [41, 24, 'cup', 1, 'eng.league_cup'],
  'Ligue 2': [96, 18, 'league', 1, 'fra.2']
};
const LEAGUE_GROUPS = [
  ['europe', 'Coupes d’Europe et du monde'],
  ['league', 'Championnats'],
  ['cup', 'Coupes nationales'],
  ['nations', 'Sélections nationales'],
  ['other', 'Autres']
];
const ICONS = {
  user: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>',
  cross: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  clock:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  all: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/></svg>',
  chevron:
    '<svg class="chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>'
};
// Listes horizontales (dates, compétitions) : flèches, molette de la souris et sélection gardée visible.
const scrollers = [];
function updateScrollers() {
  for (const el of scrollers) {
    const wrap = el.parentElement;
    wrap.classList.toggle('can-prev', el.scrollLeft > 4);
    wrap.classList.toggle('can-next', el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    if (el.id === 'date-navigator')
      wrap
        .querySelectorAll('[data-scroll]')
        .forEach(
          (button) =>
            (button.disabled =
              Number(button.dataset.scroll) < 0
                ? el.scrollLeft <= 4
                : el.scrollLeft + el.clientWidth >= el.scrollWidth - 4)
        );
  }
}
function revealActive(el, smooth = true) {
  const active = el.querySelector?.('.active');
  if (active)
    el.scrollTo({
      left: active.offsetLeft - (el.clientWidth - active.offsetWidth) / 2,
      behavior: smooth ? motionBehavior() : 'auto'
    });
}
function setupScroller(el) {
  scrollers.push(el);
  el.addEventListener('scroll', updateScrollers, { passive: true });
  el.addEventListener(
    'wheel',
    (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const max = el.scrollWidth - el.clientWidth;
      if (
        max <= 0 ||
        (e.deltaY < 0 && el.scrollLeft <= 0) ||
        (e.deltaY > 0 && el.scrollLeft >= max - 1)
      )
        return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    },
    { passive: false }
  );
  el.parentElement.querySelectorAll('[data-scroll]').forEach((button) =>
    button.addEventListener('click', () =>
      el.scrollBy({
        left: Number(button.dataset.scroll) * el.clientWidth * 0.7,
        behavior: motionBehavior()
      })
    )
  );
}
// Indice global : 75 % de forme récente du site et 25 % de confiance moyenne des pronostics du jour.
function confidenceMetrics() {
  return confidenceKpi(publicPredictionHistory(state.predictionHistory), allMatches(), isoDate(0));
}
function renderHomePerformance() {
  const box = $('#home-performance-kpis');
  if (!box) return;
  const r = predictionReport(state.predictionHistory, { period: 'all' });
  box.innerHTML = archiveLoadedAt
    ? kpiCard('ROI global', r.roi == null ? 'Indisponible' : decimal(r.roi, 1) + ' %', {
        tone: financialTone(r.roi),
        caption: 'Tout l’historique'
      }) +
      kpiCard('Profit simulé', r.items.length ? money(r.profit) : 'Indisponible', {
        tone: financialTone(r.profit),
        caption: '10 € fictifs par pronostic'
      }) +
      kpiCard('Pronostics réglés', r.items.length, { caption: 'Tout l’historique' })
    : '';
  $('#home-performance-status').textContent = archiveLoadedAt
    ? archiveStatus === 'error'
      ? 'Actualisation impossible : derniers résultats conservés. Archive lue le ' +
        new Date(archiveLoadedAt).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }) +
        ' (Paris).'
      : r.items.length < 30
        ? 'Échantillon limité : prudence dans l’interprétation.'
        : 'Bilan synchronisé avec les résultats publics.'
    : 'Résultats du modèle indisponibles pour le moment.';
}
function renderConfidenceKpi() {
  renderHomePerformance();
  const metrics = confidenceMetrics(),
    percent = (value) => (value == null ? '-' : `${Math.round(value * 100)}`),
    score = percent(metrics.score),
    form = percent(metrics.form),
    today = percent(metrics.todayConfidence);
  const face = $('#hero-confidence .gauge-face');
  if (!$('#hero-confidence .gauge-fill')) face?.insertAdjacentHTML('afterbegin', gaugeArc());
  const gauge = $('#hero-confidence .gauge-fill');
  $('#hero-confidence-score').textContent = score;
  $('#hero-confidence-form').textContent = form === '-' ? '-' : `${form} %`;
  $('#hero-confidence-today').textContent = today === '-' ? '-' : `${today} %`;
  $('#hero-confidence-form-detail').textContent = metrics.recentCount
    ? `${metrics.wins}/${metrics.recentCount} réussis`
    : 'Pas encore de résultat';
  $('#hero-confidence-today-detail').textContent = metrics.todayCount
    ? `${metrics.todayCount} pronostic${metrics.todayCount > 1 ? 's' : ''}`
    : 'Aucun match aujourd’hui';
  gauge.style.strokeDashoffset = String(100 - (metrics.score ?? 0) * 100);
  const card = $('#hero-confidence');
  card.classList.toggle('unavailable', metrics.score == null);
  card.classList.toggle('gauge-low', metrics.score != null && Number(score) < 50);
  card.classList.toggle('gauge-zero', score === '0');
}
const kickoffAt = (m) => new Date(m.kickoff ?? `${m.date}T${m.time || '12:00'}:00`);
const isLive = (m) => !m.completed && state.live[m.id]?.state === 'in';
function countdownText(m) {
  const diff = kickoffAt(m) - Date.now();
  if (diff <= 0) return 'Imminent';
  const s = Math.floor(diff / 1000),
    d = Math.floor(s / 86400),
    h = Math.floor((s % 86400) / 3600),
    mi = Math.floor((s % 3600) / 60),
    p = (n) => String(n).padStart(2, '0');
  return d ? `${d} j ${p(h)} h ${p(mi)}` : `${p(h)}:${p(mi)}:${p(s % 60)}`;
}
const liveAge = (updatedAt) => {
  const seconds = Math.max(0, Math.floor((Date.now() - updatedAt) / 1000));
  return seconds < 5 ? 'à l’instant' : `il y a ${seconds} s`;
};
function tickCountdowns() {
  document.querySelectorAll('[data-countdown]').forEach((el) => {
    const m = allMatches().find((x) => x.id === el.dataset.countdown);
    if (m) el.textContent = countdownText(m);
  });
  document.querySelectorAll('[data-live-updated]').forEach((el) => {
    const live = state.live[el.dataset.liveUpdated];
    if (live?.updatedAt) el.textContent = `Mis à jour ${liveAge(live.updatedAt)}`;
  });
}
// Fil des matchs : colonne à gauche sur grand écran, bandeau collant au-dessus de la liste sinon.
function renderRail(matches) {
  const item = (m) =>
      `<a class="rail-item ${m.completed ? 'done' : isLive(m) ? 'live' : ''}" href="#match-${html(m.id)}" data-rail="${html(m.id)}"><span class="rail-time">${m.completed ? `${html(m.homeScore)} : ${html(m.awayScore)}` : isLive(m) ? `${html(state.live[m.id].home)} : ${html(state.live[m.id].away)} · ${html(state.live[m.id].clock)}` : state.dateFilter === 'week' ? `${shortDay(m.date).split(' ')[0]} ${html(m.time)}` : html(m.time)}</span><span class="rail-teams">${logoTag('crest mini', m.homeLogo, m.home)}${logoTag('crest mini', m.awayLogo, m.away)}</span></a>`,
    items = matches.map(item).join('');
  $('#match-rail').innerHTML = matches.length
    ? `<p class="rail-title">${state.dateFilter === 'week' ? 'La semaine' : 'Le fil du jour'}</p><div class="rail-track"><span class="rail-dot" aria-hidden="true"></span>${items}</div>`
    : '';
  $('#match-strip').innerHTML = matches.length > 1 ? `<div class="rail-track">${items}</div>` : '';
}
function setRailActive(id) {
  for (const rail of [$('#match-rail'), $('#match-strip')]) {
    const track = rail.querySelector?.('.rail-track');
    if (!track) continue;
    let active = null;
    track.querySelectorAll('[data-rail]').forEach((el) => {
      const on = el.dataset.rail === id;
      el.classList.toggle('active', on);
      if (on) active = el;
    });
    if (!active) continue;
    const dot = track.querySelector('.rail-dot');
    if (dot) {
      dot.style.opacity = 1;
      dot.style.transform = `translateY(${active.offsetTop + active.offsetHeight / 2 - 6}px)`;
    }
    if (track.scrollWidth > track.clientWidth)
      track.scrollTo({
        left: active.offsetLeft - (track.clientWidth - active.offsetWidth) / 2,
        behavior: motionBehavior()
      });
    if (rail.scrollHeight > rail.clientHeight)
      rail.scrollTo({ top: active.offsetTop - rail.clientHeight / 2, behavior: motionBehavior() });
  }
}
// Apparition des fiches au défilement (une seule fois par fiche) et suivi du match affiché pour le fil.
let cardObserver = null,
  railObserver = null;
function observeCards() {
  if (typeof IntersectionObserver === 'undefined') return;
  cardObserver?.disconnect();
  railObserver?.disconnect();
  cardObserver = new IntersectionObserver(
    (entries) => {
      let batch = 0;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const card = entry.target;
        card.style.setProperty('--delay', '0ms');
        card.classList.add('in-view');
        state.revealed.add(card.dataset.id);
        cardObserver.unobserve(card);
      }
    },
    { rootMargin: '0px 0px -6% 0px' }
  );
  railObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) if (entry.isIntersecting) setRailActive(entry.target.dataset.id);
    },
    { rootMargin: '-30% 0px -60% 0px' }
  );
  document.querySelectorAll('#match-list .match-card').forEach((card) => {
    if (state.revealed.has(card.dataset.id)) card.classList.add('seen');
    if (!card.classList.contains('seen')) cardObserver.observe(card);
    railObserver.observe(card);
  });
}
// La cote ajoutée s'envole vers le ticket (ou vers le bouton Combiné sur mobile).
function flyToTicket(from, origin) {
  if (!from?.getBoundingClientRect || matchMedia('(prefers-reduced-motion: reduce)').matches)
    return;
  const visible = (el) => {
      if (!el || el.hidden) return false;
      const r = el.getBoundingClientRect();
      return (
        r.width > 0 &&
        r.bottom > 0 &&
        r.top < innerHeight &&
        getComputedStyle(el).visibility !== 'hidden'
      );
    },
    aside = $('#builder'),
    ticket = document.querySelector('.ticket');
  let target = [
      $('#mobile-coupon'),
      document.querySelector('[data-mobile-target=builder]'),
      $('#total-odds')
    ].find(visible),
    shift = 0;
  if (!target && ticket && visible(aside) && aside.scrollHeight > aside.clientHeight) {
    const top = Math.max(0, ticket.offsetTop - 12);
    shift = top - aside.scrollTop;
    aside.scrollTo({ top, behavior: motionBehavior() });
    target = $('#total-odds');
  }
  if (!target) return;
  const a = origin ?? from.getBoundingClientRect(),
    r =
      target.id === 'mobile-coupon'
        ? {
            left: target.offsetLeft,
            top: target.offsetTop,
            width: target.offsetWidth,
            height: target.offsetHeight
          }
        : target.getBoundingClientRect(),
    x = a.left + a.width / 2,
    y = a.top + a.height / 2,
    dx = r.left + r.width / 2 - x,
    dy = r.top - shift + r.height / 2 - y,
    chip = document.createElement('span');
  chip.className = 'fly-chip';
  chip.setAttribute('aria-hidden', 'true');
  chip.textContent = from.querySelector('strong')?.textContent ?? '';
  chip.style.left = `${x}px`;
  chip.style.top = `${y}px`;
  document.body.append(chip);
  const frames = Array.from({ length: 31 }, (_, i) => {
    const t = i / 30,
      u = 1 - t;
    return {
      transform: `translate3d(calc(-50% + ${dx * t}px),calc(-50% + ${dy * t - 240 * u * t}px),0) scale(${1 - 0.65 * t})`,
      opacity: 1 - 0.7 * t
    };
  });
  const animation = chip.animate?.(frames, { duration: 600, easing: 'cubic-bezier(.25,.1,.3,1)' });
  if (!animation) {
    chip.remove();
    return;
  }
  animation.finished.then(
    () => {
      chip.remove();
      if (!visible(target)) return;
      target.getAnimations?.().forEach((a) => a.cancel());
      target.animate?.(
        [
          { transform: 'scale(1)' },
          { transform: 'scale(1.18)', offset: 0.4 },
          { transform: 'scale(.96)', offset: 0.7 },
          { transform: 'scale(1)' }
        ],
        { duration: 300, easing: 'cubic-bezier(.2,.8,.3,1)' }
      );
    },
    () => chip.remove()
  );
}
let rollToken = 0;
function rollNumber(el, value) {
  const from = Number(el.dataset.value ?? value),
    id = ++rollToken;
  el.dataset.value = value;
  if (
    typeof requestAnimationFrame === 'undefined' ||
    motionBehavior() === 'auto' ||
    from === value
  ) {
    el.textContent = decimal(value, 2);
    return;
  }
  const start = performance.now(),
    step = (now) => {
      if (id !== rollToken) return;
      const t = Math.min(1, (now - start) / 500);
      el.textContent = decimal(from + (value - from) * (1 - Math.pow(1 - t, 3)), 2);
      if (t < 1) requestAnimationFrame(step);
    };
  requestAnimationFrame(step);
}
const isDark = () => !document.documentElement.classList.contains('light');
const leagueLogoUrl = (league) => {
  const dark = isDark(),
    match = allMatches().find((item) => item.league === league && safeLogo(item.leagueLogo)),
    config = LEAGUES[league];
  if (match)
    return dark && safeLogo(match.leagueLogoDark) ? match.leagueLogoDark : match.leagueLogo;
  return config
    ? `https://a.espncdn.com/i/leaguelogos/soccer/${dark && config[3] ? '500-dark' : '500'}/${config[0]}.png?h=96&w=96`
    : null;
};
const inPeriod = (m) =>
  (state.dateFilter === 'week' &&
    m.date >= isoDate(0) &&
    m.date <= isoDate(6) &&
    !m.completed &&
    !m.voided &&
    kickoffAt(m) > Date.now()) ||
  m.date === state.dateFilter;
// Compétitions classées par importance : celles qui ont des matchs sur la période affichée d'abord.
const calendarMatches = () => fixturePreview ?? matchesWithBookmakers(allMatches());
function rankedLeagues() {
  const counts = {};
  for (const name of Object.keys(LEAGUES)) counts[name] = 0;
  for (const match of calendarMatches()) {
    counts[match.league] ??= 0;
    if (inPeriod(match)) counts[match.league]++;
  }
  return Object.entries(counts)
    .map(([name, count]) => ({
      name,
      count,
      rank: LEAGUES[name]?.[1] ?? 0,
      group: LEAGUES[name]?.[2] ?? 'other'
    }))
    .sort(
      (a, b) =>
        Number(state.favoriteLeagues.includes(b.name)) -
          Number(state.favoriteLeagues.includes(a.name)) ||
        (b.count > 0) - (a.count > 0) ||
        b.rank - a.rank ||
        b.count - a.count ||
        a.name.localeCompare(b.name)
    );
}
// « Le match en chiffres » : même structure sur chaque fiche, domicile à gauche, extérieur à droite.
function formDots(stats) {
  const letters = (stats?.form || '').slice(0, 5).split('').reverse(),
    cells = [...Array(5 - letters.length).fill('X'), ...letters],
    names = { V: 'victoire', N: 'nul', D: 'défaite' };
  return `<span class="form-dots" role="img" aria-label="${letters.length ? `Forme, du plus ancien au plus récent : ${letters.map((x) => names[x]).join(', ')}` : 'Forme indisponible'}">${cells.map((x) => `<i class="fd ${html(x)}">${x === 'X' ? '' : html(x)}</i>`).join('')}</span>`;
}
function statLine(label, note, home, away, scale) {
  const side = (value, cls) =>
    `<div class="stat-side ${cls}"><span class="stat-num">${decimal(value, 1)}</span><span class="stat-bar"><i style="--w:${Math.min(100, (value / scale) * 100)}%"></i></span></div>`;
  return `<div class="stat-row">${side(home, 'home')}<span class="stat-label">${html(label)}${note ? `<small>${html(note)}</small>` : ''}</span>${side(away, 'away')}</div>`;
}
function matchStats(m) {
  const hs = m.homeStats,
    as = m.awayStats,
    tracked = hs?.sample && as?.sample,
    scale = Math.max(
      3,
      m.homeGoals,
      m.awayGoals,
      tracked ? Math.max(hs.avgScored, as.avgScored) : 0
    ),
    short = tracked
      ? [
          [m.home, hs.sample],
          [m.away, as.sample]
        ]
          .filter(([, n]) => n < 5)
          .map(
            ([team, n]) =>
              `${team} : ${n} match${n > 1 ? 's' : ''} seulement dans les compétitions suivies.`
          )
          .join(' ')
      : '',
    rows = tracked
      ? `<div class="stat-row"><div class="stat-side home">${formDots(hs)}</div><span class="stat-label">Forme<small>5 derniers matchs</small></span><div class="stat-side away">${formDots(as)}</div></div>${statLine('Buts marqués', 'par match', hs.avgScored, as.avgScored, scale)}${statLine('Buts encaissés', 'par match', hs.avgConceded, as.avgConceded, scale)}`
      : '<div class="stat-row"><span class="stat-na">Forme non suivie pour cette compétition</span></div>';
  return `<div class="match-stats"><h3 class="match-stats-title">Le match en chiffres</h3><div class="stats-team-names"><span>${logoTag('crest mini', m.homeLogo, m.home)}${html(m.home)}</span><span>${logoTag('crest mini', m.awayLogo, m.away)}${html(m.away)}</span></div>${rows}${statLine('Buts attendus', m.statsSource ? 'selon la forme réelle' : 'estimation du modèle', m.homeGoals, m.awayGoals, scale)}${short ? `<p class="stat-note">${html(short)}</p>` : ''}</div>`;
}
// Fiches équipe et match (details.js) : identifiants ESPN du pipeline, sinon lus dans l'adresse du logo.
const teamIdOf = (m, side) =>
  m[`${side}Id`] ??
  /teamlogos\/soccer\/\d+(?:-dark)?\/(\d+)\.png/.exec(m[`${side}Logo`] ?? '')?.[1] ??
  '';
const teamData = (m, side) =>
  `data-team-id="${html(teamIdOf(m, side))}" data-team-name="${html(m[side])}" data-team-logo="${html(m[`${side}Logo`] ?? '')}" data-league="${html(m.league)}" data-team-match="${html(m.id)}" aria-label="Fiche de ${html(m[side])}"`;
function marketButton(match, m, highestConfidence = false) {
  return marketCard(match, m, highestConfidence);
}
function renderMarketFamilies(match, markets) {
  markets = markets.filter((m) => quoteAvailable(match, m.key));
  if (!markets.length)
    return '<p class="bookmaker-unavailable">Cotes indisponibles : au moins 10 bookmakers sont nécessaires pour chaque sélection.</p>';
  const ranked = byConfidence(
      markets.filter((m) => Number.isFinite(m.odd) && m.odd > 1 && Number.isFinite(m.probability))
    ),
    top = ranked.slice(0, 5),
    remaining = markets.filter((m) => !top.some((p) => p.key === m.key)),
    selection = recommendedMarket(match);
  return `<div class="predictions-heading"><h3>${ranked.length ? UI_COPY.choosePick : 'Marchés disponibles'}</h3><p class="analysis-note">${ranked.length ? 'Classés par confiance estimée' : 'Choix manuels · au moins 10 bookmakers par sélection'}</p></div><div class="markets featured-markets">${top.map((m) => marketButton(match, m, m.key === selection?.key)).join('')}</div><div class="market-categories">${[
    'Résultat',
    'Buts',
    'Score exact',
    'Handicap européen',
    'Marge de victoire',
    '1re mi-temps'
  ]
    .map((family) => {
      const items = byConfidence(
        remaining.filter((m) => (m.family === 'Équipes' ? 'Buts' : m.family) === family)
      );
      return items.length
        ? `<details class="match-secondary market-category" data-family-match="${html(match.id)}" data-family-name="${family}" data-stats="${html(match.id)}-${family}"${expandedMatchStats.has(match.id + '-' + family) ? ' open' : ''}><summary><strong>${family}</strong><span>${items.length} autre${items.length > 1 ? 's' : ''} choix</span></summary><div class="markets">${expandedMatchStats.has(match.id + '-' + family) ? items.map((m) => marketButton(match, m, m.key === selection?.key)).join('') : ''}</div></details>`
        : '';
    })
    .join('')}</div>`;
}
const expandedBookmakers = new Set();
const bookmakerCache = new Map();
const unavailableBookmakers = new Set();
function bookmakerComparison(match) {
  const count = match.bookmakerOffers?.length ?? match.bookmakerCount ?? 0;
  if (!count)
    return '<p class="bookmaker-unavailable">Cotes indisponibles : au moins 10 bookmakers par sélection.</p>';
  if (!expandedBookmakers.has(match.id))
    return `<details class="bookmaker-comparison" data-bookmakers="${html(match.id)}"><summary>Comparaison des bookmakers · ${count}</summary></details>`;
  const key = bookmakerKey(match),
    offers = match.bookmakerOffers ?? bookmakerCache.get(key),
    status = unavailableBookmakers.has(key)
      ? '<p class="bookmaker-unavailable" role="status">Offres détaillées indisponibles.</p><button type="button" class="button secondary" data-retry-bookmakers>Réessayer</button>'
      : '<p class="bookmaker-loading" role="status">Chargement des offres…</p>',
    markets = offers?.length
      ? analyseMatch(match).markets.filter((market) => quoteAvailable(match, market.key))
      : [];
  if (!markets.length)
    return `<details class="bookmaker-comparison" data-bookmakers="${html(match.id)}" open><summary>Comparaison des bookmakers · ${count}</summary>${offers ? '<p class="bookmaker-unavailable">Aucune offre détaillée admissible pour ce match.</p>' : status}</details>`;
  const price = (offer, key) =>
    Number(offer[key]) > 1
      ? `${decimal(Number(offer[key]), 2)}${offer[`${key}Cached`] ? ' · cache' : ''}`
      : '-';
  return `<details class="bookmaker-comparison" data-bookmakers="${html(match.id)}" open><summary>Comparaison des bookmakers · ${offers.length}</summary><div class="bookmaker-table" tabindex="0" role="region" aria-label="Comparaison des cotes par marché et ligne"><table><thead><tr><th>Bookmaker</th>${markets.map((m) => `<th>${html(m.label)}</th>`).join('')}</tr></thead><tbody>${offers.map((offer) => `<tr><td>${html(offer.name)}</td>${markets.map((m) => `<td>${price(offer, m.key)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><small>PropLine : moyenne par sélection et par ligne disponible. Exchanges et marchés prédictifs exclus. « - » indique une cote absente de la collecte. « cache » signale une offre conservée, potentiellement ancienne.</small></details>`;
}
let bookmakerSchema = null,
  bookmakerFixtureVersion = null;
const bookmakerKey = (match) =>
  match.offerVersion ? `${match.id}:${match.offerVersion}` : match.id;
async function loadBookmakerOffers(match) {
  const key = bookmakerKey(match);
  if (match.bookmakerOffers) return match.bookmakerOffers;
  if (bookmakerCache.has(key)) return bookmakerCache.get(key);
  const version = bookmakerFixtureVersion;
  let offers = [];
  if (bookmakerSchema === 1) {
    if (match.offerVersion)
      offers = await loadJson(
        `data/match-offers/v1/${encodeURIComponent(match.id)}-${match.offerVersion}.json`
      );
  } else {
    // Compatibilité avec un calendrier mis en cache avant la publication par match.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(match.date)) throw new Error('Date invalide');
    const daily = await loadJson(`data/offers/${match.date}.json`);
    offers = daily?.matches?.[match.id] ?? [];
  }
  if (!Array.isArray(offers)) throw new Error('Offres indisponibles');
  if (bookmakerFixtureVersion === version) bookmakerCache.set(key, offers);
  return offers;
}
function refreshBookmakerSection(section) {
  const match = allMatches().find((item) => item.id === section.dataset.bookmakers);
  if (!match || section.dataset.loading) return;
  const key = bookmakerKey(match);
  function renderSection() {
    if (!section.open || !section.isConnected) return;
    const template = document.createElement('template');
    template.innerHTML = bookmakerComparison(match);
    const current = template.content.firstElementChild;
    section.replaceChildren(...current.childNodes);
  }
  if (match.bookmakerOffers || bookmakerCache.has(key) || unavailableBookmakers.has(key)) {
    if (!section.querySelector('.bookmaker-loading') && section.children.length > 1) return;
    renderSection();
    return;
  }
  section.dataset.loading = 'true';
  renderSection();
  const version = bookmakerFixtureVersion;
  loadBookmakerOffers(match)
    .catch(() => {
      if (bookmakerFixtureVersion === version) unavailableBookmakers.add(key);
    })
    .finally(() => {
      delete section.dataset.loading;
      if (bookmakerFixtureVersion === version) renderSection();
    });
}
const hasMatchFilters = () => state.filter === 'Favoris' || state.selectedLeagues.length > 0;
function renderFilters() {
  $('#reset-match-filters').hidden = !hasMatchFilters();
  const summary = $('#match-filter-summary');
  if (summary)
    summary.textContent = [
      state.dateFilter === 'week' ? '7 prochains jours' : longDay(state.dateFilter),
      state.filter === 'Favoris' ? 'Favoris uniquement' : 'Toutes les équipes',
      state.selectedLeagues.length ? state.selectedLeagues.join(', ') : 'Toutes les compétitions'
    ].join(' · ');
  const leagues = rankedLeagues().filter((x) => x.count || state.selectedLeagues.includes(x.name));
  $('#filters').innerHTML =
    `<button class="filter filter-menu ${state.selectedLeagues.length ? 'has-filter' : ''}" data-league-menu aria-haspopup="dialog"><span class="filter-all">${ICONS.all}</span>Compétitions${ICONS.chevron}</button><button class="filter favorite-filter ${state.filter === 'Favoris' ? 'active' : ''}" data-filter="Favoris" aria-pressed="${state.filter === 'Favoris'}" title="Favoris parmi les compétitions sélectionnées">★ Favoris<em>${calendarMatches().filter((m) => inPeriod(m) && (state.favoriteLeagues.includes(m.league) || state.favoriteTeams.includes(m.home) || state.favoriteTeams.includes(m.away))).length}</em></button>${leagues.map((x) => `<span class="filter-wrap"><button class="filter ${state.selectedLeagues.includes(x.name) ? 'active' : ''}" data-filter="${html(x.name)}" aria-pressed="${state.selectedLeagues.includes(x.name)}">${logoTag('league-logo', leagueLogoUrl(x.name), x.name)}${html(x.name)}<em>${x.count}</em></button><button class="favorite-toggle ${state.favoriteLeagues.includes(x.name) ? 'active' : ''}" data-favorite-league="${html(x.name)}" aria-label="${state.favoriteLeagues.includes(x.name) ? 'Retirer' : 'Ajouter'} ${html(x.name)} des favoris">★</button></span>`).join('')}`;
  renderLeagueMenu();
  updateScrollers();
}
let leagueDraft = null;
function renderLeagueMenu() {
  const selected = leagueDraft ?? state.selectedLeagues;
  const leagues = rankedLeagues().filter((x) => x.count || selected.includes(x.name)),
    total = calendarMatches().filter(inPeriod).length,
    option = (filter, logo, name, count, label) =>
      `<button class="league-option ${(filter === 'Tous' ? !selected.length : selected.includes(filter)) ? 'active' : ''}" data-filter="${html(filter)}" aria-pressed="${filter === 'Tous' ? !selected.length : selected.includes(filter)}">${logo}<span class="league-text"><strong>${html(name)}</strong><small>${label ?? (count ? `${count} match${count > 1 ? 's' : ''} sur la période` : 'Aucun match sur la période')}</small></span>${(filter === 'Tous' ? !selected.length : selected.includes(filter)) ? ICONS.check : ''}</button>`;
  const options = $('#competition-options');
  const scrollTop = options.scrollTop;
  if (leagueDraft) {
    const visible = calendarMatches().filter((match) =>
      matchesCurrentFilters(match, selected)
    ).length;
    $('#apply-competitions').textContent = visible
      ? `Voir ${visible === 1 ? '1 match' : `les ${visible} matchs`}`
      : 'Voir les résultats (0)';
  }
  options.innerHTML =
    `<p class="muted">Sélectionnez plusieurs compétitions. Le filtre Favoris s’applique ensuite à cette sélection.</p>` +
    option(
      'Tous',
      `<span class="filter-all">${ICONS.all}</span>`,
      'Toutes les compétitions',
      total,
      `${total} match${total > 1 ? 's' : ''} sur la période`
    ) +
    LEAGUE_GROUPS.map(([key, title]) => {
      const items = leagues.filter((x) => x.group === key);
      return items.length
        ? `<p class="league-group">${title}</p>${items.map((x) => option(x.name, logoTag('league-logo', leagueLogoUrl(x.name), x.name), x.name, x.count)).join('')}`
        : '';
    }).join('');
  options.scrollTop = scrollTop;
}
const shortDay = (date) =>
  new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }).format(
    new Date(`${date}T12:00:00`)
  );
const longDay = (date) =>
  new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(
    new Date(`${date}T12:00:00`)
  );
function renderDateNavigator() {
  const days = Array.from({ length: 10 }, (_, i) => isoDate(i - 3));
  $('#date-navigator').innerHTML =
    `<button class="date-chip week ${state.dateFilter === 'week' ? 'active' : ''}" data-date="week"><strong>7 jours</strong><span>À venir</span></button>${days
      .map((date, i) => {
        const offset = i - 3,
          label =
            offset === 0
              ? "Aujourd'hui"
              : offset === -1
                ? 'Hier'
                : offset === 1
                  ? 'Demain'
                  : shortDay(date).split(' ')[0];
        return `<button class="date-chip ${state.dateFilter === date ? 'active' : ''}" data-date="${date}"><strong>${label}</strong><span>${shortDay(date).split(' ').slice(1).join(' ')}</span></button>`;
      })
      .join('')}`;
}
const followsMatch = (match) =>
  state.favoriteLeagues.includes(match.league) ||
  state.favoriteTeams.includes(match.home) ||
  state.favoriteTeams.includes(match.away);
const selectedCompetition = (match, selected = state.selectedLeagues) =>
  !selected.length || selected.includes(match.league);
function matchesCurrentFilters(match, selected = state.selectedLeagues) {
  return (
    inPeriod(match) &&
    selectedCompetition(match, selected) &&
    (state.filter !== 'Favoris' || followsMatch(match))
  );
}
function nextVisibleMatch(today, favorites = state.filter === 'Favoris') {
  return calendarMatches()
    .filter(
      (match) =>
        match.date >= today &&
        match.date <= isoDate(6) &&
        !match.completed &&
        !match.voided &&
        kickoffAt(match) > Date.now() &&
        selectedCompetition(match) &&
        (!favorites || followsMatch(match))
    )
    .sort((a, b) => kickoffAt(a) - kickoffAt(b))[0];
}
function chooseInitialCalendarDate() {
  if (!findInitialCalendarDate) return false;
  const today = isoDate(0);
  const hasMatchesToday = calendarMatches().some((match) => match.date === today);
  const date = hasMatchesToday ? today : (nextVisibleMatch(isoDate(1))?.date ?? today);
  if (date === state.dateFilter) return false;
  state.dateFilter = date;
  return true;
}
function visibleMatches() {
  const matches = calendarMatches().filter((match) => matchesCurrentFilters(match));
  const spotlight = fixturePreview
      ? null
      : selectSpotlight(matches, Date.now(), new Set(matches.filter(isLive).map((m) => m.id)))?.id,
    favorite = (m) =>
      state.favoriteTeams.includes(m.home) ||
      state.favoriteTeams.includes(m.away) ||
      state.favoriteLeagues.includes(m.league);
  return orderCalendar(matches, { spotlight, favorite, isLive, kickoff: kickoffAt });
}
let fixturesStatus = 'loading',
  fixtureDataLoaded = false;
function matchListEmpty() {
  if (!fixtureDataLoaded && !fixturePreview && fixturesStatus === 'loading')
    return '<div class="match-loading" role="status"><p>Chargement des matchs…</p><div class="match-skeleton" aria-hidden="true"></div><div class="match-skeleton" aria-hidden="true"></div></div>';
  if (!fixtureDataLoaded && fixturesStatus === 'error')
    return '<div class="empty match-list-error" role="status"><p>Le calendrier est indisponible. Vérifiez votre connexion puis réessayez.</p><button class="button secondary" data-retry-matches>Réessayer</button></div>';
  if (state.filter === 'Favoris')
    return '<div class="empty"><p>Aucun match favori sur cette période.</p><button class="button secondary" data-leave-favorites>Revenir au calendrier</button></div>';
  return emptyState('matches', hasMatchFilters());
}
function resultSelections(match, analysis) {
  if (match.completed || match.voided || isLive(match) || kickoffAt(match) <= Date.now()) return '';
  const buttons = [
    ['home', '1'],
    ['draw', 'N'],
    ['away', '2']
  ]
    .map(([key, label]) => {
      const market = analysis.markets.find((item) => item.key === key);
      const realQuote = quoteAvailable(match, key);
      const available = realQuote && market && Number.isFinite(market.probability);
      const probability =
        market && Number.isFinite(market.probability)
          ? `${Math.round(market.probability * 100)} %`
          : 'Probabilité indisponible';
      return `<button type="button" class="result-pick" data-result-pick data-match="${html(match.id)}" data-market="${key}" aria-pressed="false"${available ? '' : ' disabled'}><span>${label}</span><strong>${realQuote ? decimal(match.odds[key], 2) : 'Indisponible'}</strong><small>${probability}</small></button>`;
    })
    .join('');
  return `<div class="match-result-picks${analysis.available === false && ['home', 'draw', 'away'].some((key) => quoteAvailable(match, key)) ? ' quotes-only' : ''}" role="group" aria-label="Résultat du match : cote réelle et probabilité estimée">${buttons}</div>`;
}
function quickSelection(match, best) {
  if (!best?.key)
    return '<div class="recommended"><span class="selection-eyebrow">LA SÉLECTION DU MATCH</span><strong>Aucune sélection admissible</strong><small>Il faut une cote supérieure à 1,15 et au moins 10 bookmakers par sélection.</small></div>';
  if (!quoteAvailable(match, best.key))
    return `<div class="recommended"><strong>${html(best.label)}</strong><small>${Math.round(best.probability * 100)} % de probabilité estimée · cote indisponible : moins de 10 bookmakers</small></div>`;
  const ev = Number.isFinite(best.value) && best.real;
  return `<section class="selection-summary" aria-label="Sélection du match"><strong class="selection-title">${html(best.label)}</strong><dl><div><dt>Probabilité estimée</dt><dd class="selection-probability">${Math.round(best.probability * 100)} %</dd></div><div class="selection-price"><dt>Cote réelle</dt><dd>${decimal(best.odd, 2)}</dd></div>${ev ? `<div><dt>Rendement estimé</dt><dd class="selection-ev">${best.value >= 0 ? '+' : ''}${Math.round(best.value * 100)} %</dd></div>` : ''}</dl><button type="button" class="button primary match-selection selection-action" data-match="${html(match.id)}" data-market="${html(best.key)}" data-market-label="Ajouter au ticket : ${html(best.label)}">Ajouter au ticket</button></section>`;
}
function renderSafePicks(visible = visibleMatches()) {
  renderDailySelection(visible);
  const picks = visible
    .filter(
      (match) =>
        !match.completed && !match.voided && !isLive(match) && kickoffAt(match) > Date.now()
    )
    .map((match) => ({ match, pick: recommendedMarket(match) }))
    .filter((x) => x.pick?.available)
    .sort((a, b) => b.pick.probability - a.pick.probability)
    .slice(0, 3);
  $('#safe-picks-list').innerHTML = picks.length
    ? picks
        .map(
          ({ match, pick }) =>
            `<button class="safe-pick" data-safe-match="${html(match.id)}" data-safe-market="${html(pick.key)}"><span><strong>${html(pick.label)}</strong><small>${html(match.home)} - ${html(match.away)}</small></span><span class="suggestion-values"><b>Cote ${decimal(pick.odd, 2)}</b><small>Confiance estimée ${Math.round(pick.probability * 100)} %</small><em>Ajouter au ticket</em></span></button>`
        )
        .join('')
    : '<p class="empty">Pas assez de données fiables sur cette période.</p>';
}
function renderDailySelection(visible = visibleMatches()) {
  renderDailyAdvice();
  const box = $('#daily-selection');
  if (!box) return;
  const picks = dailyPicks(
    allMatches().filter((match) => !isLive(match)),
    'Europe/Paris'
  );
  box.hidden = !picks.length || !visible.length;
  if (box.hidden) {
    box.innerHTML = '';
    return;
  }
  box.innerHTML = `<div class="safe-picks-head"><div><p class="eyebrow">SUGGESTIONS</p><h3>Suggestions du jour</h3></div></div><p class="analysis-note">Les meilleurs pronostics disponibles aujourd’hui selon la confiance du modèle, puis la value. Cotes supérieures à 1,15, au moins 10 bookmakers par sélection. Paris virtuels · 18+ · Aucune garantie.</p>${picks.map(({ match, pick }) => `<button class="safe-pick" data-match="${html(match.id)}" data-market="${html(pick.key)}"><span><strong>${html(match.home)} - ${html(match.away)}</strong><small>${new Date(match.kickoff).toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' })} · ${html(pick.label)}</small></span><span class="suggestion-values"><b>Cote ${decimal(pick.odd, 2)}</b><small>Confiance ${Math.round(pick.probability * 100)} %</small><em>+ Ajouter au ticket</em></span></button>`).join('') || '<p class="empty">Aucun pronostic admissible aujourd’hui.</p>'}`;
}
function renderDailyAdvice() {
  const box = $('#conseils-du-jour');
  if (!box) return;
  box.hidden = location.hash !== '#conseils-du-jour';
  if (box.hidden) return;
  let timezone = 'Europe/Paris';
  try {
    const requested = new URL(location.href).searchParams.get('conseils_tz');
    if (requested) {
      new Intl.DateTimeFormat('fr', { timeZone: requested });
      timezone = requested;
    }
  } catch {}
  const picks = dailyPicks(allMatches(), timezone);
  box.innerHTML = `<p class="eyebrow">LES CONSEILS DU JOUR</p><h3>Les recommandations disponibles</h3><p class="analysis-note">Conseils et cotes actuels · Paris virtuels · 18+ · Aucune garantie.</p>${picks.map(({ match, pick }) => `<button class="safe-pick" data-match="${html(match.id)}" data-market="${html(pick.key)}"><span><strong>${html(pick.label)}</strong><small>${html(match.home)} - ${html(match.away)}</small></span><span class="suggestion-values"><b>Cote ${decimal(pick.odd, 2)}</b><small>Confiance ${Math.round(pick.probability * 100)} %</small><em>Ajouter au ticket</em></span></button>`).join('') || '<p>Aucun conseil disponible actuellement.</p>'}`;
}
const expandedMatchStats = new Set();
// Les signatures ignorent les compteurs et l’ouverture des statistiques, mis à jour sans remplacer les cartes.
const cardMarkup = new Map(),
  watchedStats = new WeakSet();
function reconcileMatchCards(markup) {
  const box = $('#match-list');
  if (typeof document.createElement !== 'function') {
    box.innerHTML = markup;
    return;
  }
  const template = document.createElement('template');
  template.innerHTML = markup;
  const next = [...template.content.children];
  if (!next.every((node) => node.matches('.match-card'))) {
    box.innerHTML = markup;
    cardMarkup.clear();
    return;
  }
  const existing = new Map(
      [...box.children].filter((node) => node.dataset.id).map((node) => [node.dataset.id, node])
    ),
    keep = new Set(next.map((node) => node.dataset.id));
  for (const node of [...box.children])
    if (!keep.has(node.dataset.id)) {
      cardMarkup.delete(node.dataset.id);
      node.remove();
    }
  let index = 0;
  for (const node of next) {
    const id = node.dataset.id,
      html = node.outerHTML
        .replace(/aria-expanded="(?:true|false)"/g, 'aria-expanded="false"')
        .replace(/(<div id="match-resources-[^"]*"[^>]*?) hidden(?:="")?/g, '$1')
        .replace(
          /(<details(?: id="[^"]*")? class="match-secondary[^"]*" data-stats="[^"]*") open(?:="")?/g,
          '$1'
        )
        .replace(/(<strong data-countdown="[^"]*">)[^<]*(<\/strong>)/g, '$1$2')
        .replace(
          /(<small class="live-updated" data-live-updated="[^"]*">)[^<]*(<\/small>)/g,
          '$1$2'
        ),
      previous = existing.get(id);
    let current = previous;
    if (!previous || cardMarkup.get(id) !== html) {
      current = node;
      if (previous) previous.replaceWith(current);
      cardMarkup.set(id, html);
    }
    const cursor = box.children[index++] ?? null;
    if (current !== cursor) box.insertBefore(current, cursor);
  }
}
function updateSelectedMarkets() {
  document.querySelectorAll('[data-selection-feedback]').forEach((el) => {
    const item = state.ticket.find((item) => item.matchId === el.dataset.selectionFeedback);
    el.hidden = !item;
    el.textContent = item
      ? `✓ Dans votre ticket : ${item.label}. Modifiez ou retirez ce choix dans Mon ticket.`
      : '';
  });
  document.querySelectorAll('#match-list [data-market]').forEach((button) => {
    const selected = state.ticket.some(
      (item) => item.matchId === button.dataset.match && item.key === button.dataset.market
    );
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
    button.setAttribute(
      'aria-label',
      `${button.dataset.marketLabel ?? button.textContent.trim()}${selected ? ' · sélectionné' : ''}`
    );
  });
}
function renderMatches() {
  if (activeTab !== 'matches') return;
  const focusedMarket =
      typeof document.activeElement !== 'undefined' ? document.activeElement : null,
    focusMatch = focusedMarket?.dataset?.match,
    focusKey = focusedMarket?.dataset?.market,
    focusFavorite = focusedMarket?.dataset?.favoriteTeam;
  const matches = visibleMatches();
  renderFixtureNotice();
  const today = isoDate(0),
    showTodayEmpty =
      (fixtureDataLoaded || fixturePreview) &&
      state.dateFilter === today &&
      !matches.length &&
      !hasMatchFilters(),
    notice = $('#today-empty'),
    nextButton = $('#next-match-day');
  const heroTitle = $('#calendar-hero-title');
  if (heroTitle)
    heroTitle.textContent =
      state.dateFilter === today
        ? 'Vos matchs du jour'
        : state.dateFilter === 'week'
          ? 'Vos matchs des 7 prochains jours'
          : `Vos matchs du ${longDay(state.dateFilter)}`;
  notice.hidden = !showTodayEmpty;
  if (showTodayEmpty) {
    const lastDay = isoDate(6);
    const nextDate = calendarMatches()
      .filter((match) => match.date > today && match.date <= lastDay && !match.voided)
      .map((match) => match.date)
      .sort()[0];
    nextButton.hidden = !nextDate;
    $('#today-empty-report').hidden = Boolean(nextDate);
    if (nextDate) {
      nextButton.dataset.nextDate = nextDate;
      nextButton.textContent = `Voir les matchs du ${longDay(nextDate)}`;
    }
    notice.querySelector('p').textContent = nextDate
      ? 'Aucun match aujourd’hui.'
      : 'Aucun match aujourd’hui ni dans les prochains jours du calendrier.';
  }
  const nextFavorite = $('#next-favorite-match');
  if (nextFavorite) {
    const next = state.filter === 'Favoris' && nextVisibleMatch(today, true);
    nextFavorite.hidden = !next;
    nextFavorite.innerHTML = next
      ? `<button class="text-button" type="button" data-next-favorite="${html(next.id)}">Prochain favori · ${html(next.home)} - ${html(next.away)} · ${longDay(next.date)} à ${html(next.time)}</button>`
      : '';
  }
  $('#match-period-title').textContent =
    state.filter === 'Favoris'
      ? 'Vos matchs favoris'
      : state.dateFilter === 'week'
        ? 'Les grandes affiches des 7 prochains jours'
        : `Les matchs du ${longDay(state.dateFilter)}`;
  $('#match-count').textContent = `${matches.length} rencontre${matches.length > 1 ? 's' : ''}`;
  const shown = state.dateFilter === 'week' ? matches.slice(0, visibleWeekLimit) : matches;
  const more = $('#match-list-more');
  more.hidden = shown.length === matches.length;
  more.textContent = `Voir les matchs suivants (${matches.length - shown.length})`;
  if (fixturePreview) {
    reconcileMatchCards(
      shown
        .map((match) => {
          const status = match.voided
            ? 'Match annulé'
            : match.completed
              ? `Score final · ${match.homeScore} : ${match.awayScore}`
              : match.time;
          return `<article id="match-${html(match.id)}" data-id="${html(match.id)}" class="card match-preview-card"><p>${html(match.league)} · ${longDay(match.date)}</p><h3>${html(match.home)} – ${html(match.away)}</h3><p>${html(status)}</p><small>Analyses en cours de chargement…</small></article>`;
        })
        .join('') || (showTodayEmpty ? '' : matchListEmpty())
    );
    mobileDiagnostics?.mark(matches.length ? 'calendrier-apercu' : 'calendrier-vide', true);
    return;
  }
  const spotlight = selectSpotlight(
    matches,
    Date.now(),
    new Set(matches.filter(isLive).map((match) => match.id))
  )?.id;
  renderSafePicks(matches);
  const oddsFeedDate = html(sourceFreshness(state.oddsUpdatedAt, 'odds').label);
  reconcileMatchCards(
    shown
      .map((m) => {
        const a = analyseMatch(m),
          best =
            m.completed || isLive(m) || kickoffAt(m) <= Date.now()
              ? (m.suggestedPick ?? null)
              : recommendedMarket(m),
          live = isLive(m) ? state.live[m.id] : null,
          isSpot = m.id === spotlight,
          pct = (x) => Math.round(x * 100),
          stats = matchStats(m),
          pastStatus =
            m.completed && best ? selectionResult({ ...best, matchId: m.id }, [m]).status : null,
          dayLabel =
            m.date === isoDate(0)
              ? "Aujourd'hui"
              : m.date === isoDate(1)
                ? 'Demain'
                : shortDay(m.date),
          fav = (team) =>
            `<button class="team-favorite ${state.favoriteTeams.includes(team) ? 'active' : ''}" data-favorite-team="${html(team)}" aria-pressed="${state.favoriteTeams.includes(team)}" aria-label="${state.favoriteTeams.includes(team) ? 'Retirer des favoris' : 'Ajouter aux favoris'} : ${html(team)}">★ ${html(team)}</button>`,
          center = m.completed
            ? `<div class="final-score"><strong>${html(m.homeScore)} : ${html(m.awayScore)}</strong><small>Score officiel</small></div>`
            : live
              ? `<div class="live-score"><span class="live-badge"><i></i>${state.liveErrors[m.id] ? 'Direct momentanément indisponible' : `En direct · ${html(live.clock)}`}</span><strong>${html(live.home)} : ${html(live.away)}</strong><small class="live-updated" data-live-updated="${html(m.id)}">Mis à jour ${liveAge(live.updatedAt)}</small></div>`
              : `<div class="kickoff"><small>${dayLabel}</small><strong>${html(m.time)}</strong>${state.liveErrors[m.id] ? '<small class="live-error">Direct ESPN momentanément indisponible</small>' : ''}</div>`,
          probs = m.completed
            ? ''
            : a.available === false
              ? '<p class="analysis-note" role="status">Probabilités indisponibles : données du modèle insuffisantes.</p>'
              : `<div class="prob-bar match-outcome" role="img" aria-label="Probabilités du modèle : 1 ${pct(a.probs.home)} %, nul ${pct(a.probs.draw)} %, 2 ${pct(a.probs.away)} %"><h3>${isSpot && !best ? 'Le choc du jour : les probabilités du modèle' : 'Issue du match'}</h3><div class="prob-track"><i class="p-home" style="--w:${pct(a.probs.home)}%"></i><i class="p-draw" style="--w:${pct(a.probs.draw)}%"></i><i class="p-away" style="--w:${pct(a.probs.away)}%"></i></div><div class="prob-legend"><span>${html(m.home)}<b>${pct(a.probs.home)} %</b></span><span>Nul<b>${pct(a.probs.draw)} %</b></span><span>${html(m.away)}<b>${pct(a.probs.away)} %</b></span></div></div>`,
          betting = m.voided
            ? '<div class="live-note"><span>Match annulé</span><strong>Paris remboursés</strong></div>'
            : m.completed && !best
              ? '<p class="live-note">Aucun pronostic archivé pour ce match.</p>'
              : m.completed
                ? `<div class="past-prediction ${pastStatus}"><div><span>PRONOSTIC PROPOSÉ</span><strong>${html(best.label)}</strong><small>Cote ${decimal(best.odd, 2)} · ${pct(best.probability)} % estimés</small></div><b>${pastStatus === 'won' ? `${ICONS.check}GAGNANT` : `${ICONS.cross}PERDANT`}</b></div>`
                : live || kickoffAt(m) <= Date.now()
                  ? `<div class="live-note"><span>Match commencé : paris fermés</span><strong>${best ? `Prono d'avant-match : ${html(best.label)} · ${decimal(best.odd, 2)}` : 'Aucun pronostic archivé'}</strong></div>`
                  : `<div class="market-grid-wrap">${renderMarketFamilies(m, a.markets)}</div>`,
          tag = m.voided
            ? '<span class="status-pill">ANNULÉ</span>'
            : m.completed
              ? '<span class="status-pill">TERMINÉ</span>'
              : isSpot
                ? '<span class="big-match spotlight-tag">Affiche du jour</span>'
                : m.featured
                  ? '<span class="big-match">Grande affiche</span>'
                  : '';
        const share = /^espn-[0-9]+$/.test(m.id)
          ? `<button type="button" class="button secondary match-share-action" data-share-analysis="${html(m.id)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3m-4 4 4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>Partager l’analyse</button>`
          : '';
        return `<article id="match-${html(m.id)}" data-id="${html(m.id)}" class="match-card${m.featured ? ' featured' : ''}${m.completed ? ' completed' : ''}${live ? ' live' : ''}${state.goal?.id === m.id && state.goal.until > Date.now() ? ' goal' : ''}"><div class="match-hero">${stadiumMarkup(m)}<div class="match-head"><span class="match-league">${logoTag('league-logo small', leagueLogoUrl(m.league), m.league)}<b>${html(m.league)}</b><span class="match-date">· ${longDay(m.date)}</span></span><span class="match-head-badges">${tag}${valueBetMarkup(a)}</span><button type="button" class="match-header-stats" data-match-stats="${html(m.id)}" aria-controls="match-stats-${html(m.id)}" aria-expanded="${expandedMatchStats.has(m.id + '-resources')}" aria-label="Voir les statistiques de ${html(m.home)} contre ${html(m.away)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4v16h16M8 16v-4m5 4V8m5 8V5"/></svg><span class="stats-long">Voir les stats</span><span class="stats-short">Stats</span></button></div><div class="match-teams"><div class="team-group"><button class="team home" ${teamData(m, 'home')}>${teamLogoMarkup(m, 'home')}<strong>${html(m.home)}</strong></button>${teamFormMarkup(m.homeStats, m.home)}</div>${`<div class="match-center">${center}</div>`}<div class="team-group"><button class="team away" ${teamData(m, 'away')}>${teamLogoMarkup(m, 'away')}<strong>${html(m.away)}</strong></button>${teamFormMarkup(m.awayStats, m.away)}</div></div></div><div class="match-overview">${!m.completed && !m.voided && !live && kickoffAt(m) > Date.now() ? quickSelection(m, best) : ''}${probs}${opportunityMarkup(a, best)}</div>${resultSelections(m, a)}<details class="match-secondary match-other-markets" data-stats="${html(m.id)}-more-picks"${expandedMatchStats.has(m.id + '-more-picks') ? ' open' : ''}><summary>Voir plus de pronostics <span aria-hidden="true">▼</span></summary>${betting}</details><p class="selection-feedback" data-selection-feedback="${html(m.id)}" hidden></p><details id="match-stats-${html(m.id)}" class="match-secondary match-explanation" data-stats="${html(m.id)}-resources"${expandedMatchStats.has(m.id + '-resources') ? ' open' : ''}><summary>Détails du modèle</summary><div class="match-resources" role="region" aria-label="Le match en chiffres"><section class="match-indicators" aria-label="Indicateurs et comparaison des cotes"><div class="match-follow-actions" role="group" aria-label="Suivre les équipes du match">${fav(m.home)}${fav(m.away)}</div>${opportunityMarkup(a, best)}${stats}${fairOddsMarkup(a, best)}${!m.completed && !live && !m.voided ? matchPreviewMarkup(m) : ''}<p class="stat-note">Flux de cotes PropLine · ${oddsFeedDate}. Une offre conservée peut être plus ancienne.</p><button type="button" class="button secondary" data-match-model-report>Résultats du modèle</button>${share}<p class="stat-note">V : victoire · N : nul · D : défaite</p>${m.completed || live || m.voided || kickoffAt(m) <= Date.now() ? '' : bookmakerComparison(m)}</section></div></details></article>`;
      })
      .join('') || (showTodayEmpty ? '' : matchListEmpty())
  );
  if (mobileDiagnostics && fixtureDataLoaded) {
    mobileDiagnostics.mark(matches.length ? 'calendrier-match' : 'calendrier-vide', true);
    mobileDiagnostics.markOnce('calendrier-enrichi');
  }
  document.querySelectorAll('#match-list .match-secondary').forEach((section) => {
    if (watchedStats.has(section)) return;
    watchedStats.add(section);
    section.addEventListener('toggle', () => {
      if (section.classList.contains('match-explanation'))
        section
          .closest('.match-card')
          ?.querySelector('[data-match-stats]')
          ?.setAttribute('aria-expanded', String(section.open));
      if (section.open) {
        expandedMatchStats.add(section.dataset.stats);
        const target = section.querySelector('.markets'),
          match = allMatches().find((m) => m.id === section.dataset.familyMatch);
        if (target && !target.children.length && match) {
          const markets = analyseMatch(match).markets.filter((m) => quoteAvailable(match, m.key)),
            top = byConfidence(
              markets.filter(
                (m) => Number.isFinite(m.odd) && m.odd > 1 && Number.isFinite(m.probability)
              )
            ).slice(0, 5),
            pick = recommendedMarket(match);
          target.innerHTML = byConfidence(
            markets.filter(
              (m) =>
                !top.some((p) => p.key === m.key) &&
                (m.family === 'Équipes' ? 'Buts' : m.family) === section.dataset.familyName
            )
          )
            .map((m) => marketButton(match, m, m.key === pick?.key))
            .join('');
          updateSelectedMarkets();
          renderMobileCoupon();
        }
      } else expandedMatchStats.delete(section.dataset.stats);
    });
  });
  updateSelectedMarkets();
  if (focusMatch && focusKey)
    document.querySelectorAll('#match-list [data-market]').forEach((button) => {
      if (button.dataset.match === focusMatch && button.dataset.market === focusKey)
        button.focus({ preventScroll: true });
    });
  if (focusFavorite)
    document.querySelectorAll('[data-favorite-team]').forEach((button) => {
      if (button.dataset.favoriteTeam === focusFavorite) button.focus({ preventScroll: true });
    });
  renderRail(matches);
  observeCards();
  bindStadiumImages($('#match-list'));
}
function updateStats() {
  const settled = state.history.filter((x) => !['pending', 'void'].includes(x.status)),
    won = settled.filter((x) => x.status === 'won').length,
    totalStaked = settled.reduce((sum, bet) => sum + bet.stake, 0),
    returns = settled.reduce(
      (sum, bet) => sum + (bet.returnAmount ?? (bet.status === 'won' ? bet.stake * bet.odds : 0)),
      0
    ),
    roi = totalStaked ? ((returns - totalStaked) / totalStaked) * 100 : null,
    deposits = state.capitalEvents.reduce((sum, event) => sum + event.amount, 0);
  $('#bankroll-stat').textContent = money(state.bankroll);
  $('#topbar-bankroll').textContent = money(state.bankroll);
  const profit = state.bankroll - state.initial - deposits;
  $('#profit-stat').textContent = `${profit > 0 ? '+' : ''}${money(profit)}`;
  $('#profit-stat').style.color = profit < 0 ? 'var(--danger)' : 'var(--accent-text)';
  $('#winrate-stat').textContent = settled.length
    ? `${Math.round((won / settled.length) * 100)} %`
    : '-';
  $('#bets-stat').textContent = state.history.length;
  $('#roi-stat').textContent = roi == null ? '-' : `${roi >= 0 ? '+' : ''}${decimal(roi, 1)} %`;
  $('#roi-stat').style.color = roi != null && roi < 0 ? 'var(--danger)' : 'var(--accent-text)';
  $('#capital-events').innerHTML = state.capitalEvents.length
    ? state.capitalEvents
        .map(
          (event) =>
            `<div class="capital-event"><span>${new Date(event.date).toLocaleDateString('fr-FR')}</span><b>+${money(event.amount)}</b></div>`
        )
        .join('')
    : '<p class="empty">Aucun apport supplémentaire.</p>';
  renderPerformance();
}
function renderPerformance() {
  return;
  const leagues = {};
  for (const bet of state.history)
    for (const item of bet.items) {
      const league =
          item.league ??
          state.liveMatches.find((match) => match.id === item.matchId)?.league ??
          'Autres',
        status = selectionResult(item, state.results).status;
      if (status === 'pending') continue;
      leagues[league] ??= { won: 0, total: 0 };
      leagues[league].total++;
      if (status === 'won') leagues[league].won++;
    }
  const ranking = Object.entries(leagues).sort(
    (a, b) => b[1].won / b[1].total - a[1].won / a[1].total
  );
  $('#best-league-stat').textContent = ranking.length
    ? `${ranking[0][0]} · ${Math.round((ranking[0][1].won / ranking[0][1].total) * 100)} %`
    : '-';
  $('#league-performance').innerHTML = ranking.length
    ? ranking
        .map(
          ([league, stats]) =>
            `<div class="league-performance-row"><span>${html(league)}</span><div><i style="width:${(stats.won / stats.total) * 100}%"></i></div><strong>${stats.won}/${stats.total} · ${Math.round((stats.won / stats.total) * 100)} %</strong></div>`
        )
        .join('')
    : '<p class="empty">Les statistiques apparaîtront après les premiers résultats.</p>';
  const svg = $('#bankroll-chart'),
    events = [
      ...state.capitalEvents.map((event) => ({
        date: event.date,
        delta: Number(event.amount) || 0
      })),
      ...state.history.map((bet) => ({
        date: bet.date,
        delta:
          -bet.stake +
          (bet.status === 'pending'
            ? 0
            : Number(bet.returnAmount ?? (bet.status === 'won' ? bet.stake * bet.odds : 0)))
      }))
    ].sort((a, b) => new Date(a.date) - new Date(b.date));
  let balance = state.initial;
  const values = [balance];
  for (const event of events) {
    balance += event.delta;
    values.push(balance);
  }
  const empty = values.length === 1;
  $('#chart-empty').hidden = !empty;
  if (empty) {
    svg.innerHTML = '';
    $('#chart-max').textContent = '';
    $('#chart-min').textContent = '';
    return;
  }
  const min = Math.min(...values),
    max = Math.max(...values),
    range = max - min || 1,
    points = values.map((value, index) => [
      30 + (index / (values.length - 1)) * 640,
      190 - ((value - min) / range) * 150
    ]),
    line = vizCurve(points, { baseline: 190, id: 'bankroll-fill' });
  svg.innerHTML = `${[40, 115, 190].map((y) => `<line x1="30" x2="670" y1="${y}" y2="${y}" class="viz-grid"/>`).join('')}${line}`;
  $('#chart-max').textContent = money(max);
  $('#chart-min').textContent = money(min);
}
$('#retry-predictions')?.addEventListener('click', () => {
  loadPredictionArchive(true);
});
const analytics = initAnalytics($('#prediction-analytics'), {
  onPeriod: () => {
    state.predictionPage = 1;
    renderPredictionStats();
  }
});
function renderPredictionStats() {
  if (activeTab !== 'predictions') return;
  const status = $('#prediction-load-status');
  if (status)
    status.textContent =
      archiveStatus === 'error'
        ? archiveLoadedAt
          ? 'Actualisation impossible : derniers résultats conservés.'
          : 'Bilan indisponible : réessayez le chargement.'
        : archiveLoadedAt
          ? 'Bilan synchronisé.'
          : 'Chargement des résultats du modèle…';
  analytics.render(state);
  const allItems = publicPredictionHistory(state.predictionHistory).filter((item) =>
      ['won', 'lost'].includes(item.status)
    ),
    leagues = [...new Set(allItems.map((item) => item.league).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, 'fr')
    ),
    leagueSelect = $('#prediction-league');
  leagueSelect.innerHTML =
    '<option value="all">Toutes</option>' +
    leagues.map((league) => `<option value="${html(league)}">${html(league)}</option>`).join('');
  if (!leagues.includes(state.predictionFilters.league)) state.predictionFilters.league = 'all';
  leagueSelect.value = state.predictionFilters.league;
  $('#prediction-period').value = state.predictionFilters.period;
  $('#prediction-market').value = state.predictionFilters.market;
  $('#prediction-result').value = state.predictionFilters.result;
  $('#prediction-source').value = state.predictionFilters.source || 'bookmaker';
  const report = predictionReport(state.predictionHistory, state.predictionFilters),
    { items, won, stake, returned, profit, roi } = report,
    best = won.slice().sort((a, b) => Number(b.odd) - Number(a.odd))[0],
    average = won.length ? won.reduce((sum, item) => sum + Number(item.odd), 0) / won.length : null;
  $('#prediction-sample').textContent =
    `${items.length} réglés · ${report.pending} en attente · ${report.voided} remboursés · ${report.invalid} sans cote exploitable. ${items.length < 30 ? 'Échantillon limité : prudence dans l’interprétation.' : ''}`;
  $('#prediction-calibration').innerHTML = renderCalibration(items);
  $('#prediction-closing').innerHTML = closingMarkup(items);
  $('#prediction-showcase').innerHTML = renderPredictionShowcase(report, {
    html,
    money,
    resultFilter: state.predictionFilters.result,
    period: state.predictionFilters.period
  });
  document
    .querySelectorAll('[data-report-period]')
    .forEach((button) =>
      button.setAttribute(
        'aria-pressed',
        String(button.dataset.reportPeriod === state.predictionFilters.period)
      )
    );
  let currentStreak = 0;
  for (const item of items) {
    if (item.status !== 'won') break;
    currentStreak++;
  }
  let streak = 0,
    bestStreak = 0;
  for (const item of items.slice().reverse()) {
    streak = item.status === 'won' ? streak + 1 : 0;
    bestStreak = Math.max(bestStreak, streak);
  }
  const groups = (key) =>
      Object.values(
        items.reduce((all, item) => {
          const name = item[key] || 'Autres';
          all[name] ??= { name, total: 0, won: 0, profit: 0 };
          all[name].total++;
          all[name].won += item.status === 'won' ? 1 : 0;
          all[name].profit += item.status === 'won' ? Number(item.odd || 0) * 10 - 10 : -10;
          return all;
        }, {})
      ).sort((a, b) => b.won / b.total - a.won / a.total || b.total - a.total),
    marketNames = {
      home: 'Victoire domicile',
      draw: 'Match nul',
      away: 'Victoire extérieure',
      over: 'Plus de 2,5 buts',
      btts: 'Les deux marquent'
    },
    rows = (values, names = {}) =>
      values.length
        ? values
            .map(
              (group) =>
                `<div class="prediction-performance-row"><span><strong>${html(names[group.name] || group.name)}</strong><small>${group.won}/${group.total} réussis · ${group.profit >= 0 ? '+' : ''}${money(group.profit)}</small></span><div><i style="width:${Math.round((group.won / group.total) * 100)}%"></i></div><b>${Math.round((group.won / group.total) * 100)} %</b></div>`
            )
            .join('')
        : '<p class="empty">Aucun résultat pour ces filtres.</p>';
  $('#site-predictions').textContent =
    `${items.length} affiché${items.length > 1 ? 's' : ''} / ${allItems.length} archivé${allItems.length > 1 ? 's' : ''}`;
  $('#site-score').textContent = `${won.length} / ${items.length}`;
  $('#site-winrate').textContent = items.length
    ? `${Math.round((won.length / items.length) * 100)} % de réussite`
    : 'Aucun résultat';
  $('#site-profit').textContent = `${profit > 0 ? '+' : ''}${money(profit)}`;
  $('#site-profit').className = profit < 0 ? 'negative' : 'positive';
  $('#site-roi').textContent =
    roi == null ? 'ROI -' : `ROI ${roi >= 0 ? '+' : ''}${decimal(roi, 1)} %`;
  $('#site-bankroll').textContent = money(100 + profit);
  $('#site-best-odd').textContent = best ? decimal(Number(best.odd), 2) : '-';
  $('#site-best-pick').textContent = best
    ? `${best.label} · ${best.match}`
    : 'En attente de résultats';
  $('#site-best-streak').textContent = bestStreak;
  $('#site-current-streak').textContent = `Série actuelle : ${currentStreak}`;
  $('#site-average-odd').textContent = average == null ? '-' : decimal(average, 2);
  $('#site-returned').textContent = `${money(returned)} retournés pour ${money(stake)} misés`;
  $('#market-performance').innerHTML = rows(groups('key'), marketNames);
  $('#site-league-performance').innerHTML = rows(groups('league'));
  const pageSize = 15,
    totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  state.predictionPage = Math.min(state.predictionPage, totalPages);
  const start = (state.predictionPage - 1) * pageSize,
    pageItems = items.slice(start, start + pageSize);
  $('#prediction-filter-summary').textContent =
    `${items.length} résultat${items.length > 1 ? 's' : ''} trouvé${items.length > 1 ? 's' : ''} · archive conservée depuis ${allItems.length ? new Date(`${allItems.at(-1).date}T12:00:00`).toLocaleDateString('fr-FR') : 'le premier pronostic'}`;
  $('#prediction-history').innerHTML =
    pageItems
      .map(
        (item) =>
          `<div class="prediction-row ${html(item.status)}"><small>${new Date(`${item.date}T12:00:00`).toLocaleDateString('fr-FR')}</small><span><strong>${html(item.match)}</strong><br><small>${html(item.league || '')} · ${html(item.label)} · ${html({ bookmaker: 'Cote réelle', model: 'Cote synthétique', unknown: 'Origine inconnue' }[predictionProvenance(item).oddsSource])} @ ${decimal(Number(item.odd), 2)}</small></span><b>${item.status === 'won' ? 'Gagné' : 'Perdu'} · ${html(item.score)}</b></div>`
      )
      .join('') || emptyState('predictions', allItems.length > 0);
  $('#prediction-page').textContent = `Page ${state.predictionPage} / ${totalPages}`;
  $('#prediction-prev').disabled = state.predictionPage <= 1;
  $('#prediction-next').disabled = state.predictionPage >= totalPages;
}
function playerMetrics(period = state.leaderboardPeriod) {
  const days = { day: 1, week: 7, month: 30, season: 30, all: 36500 }[period] ?? 7,
    after = Date.now() - days * 864e5,
    bets = state.history.filter(
      (bet) =>
        !['pending', 'void'].includes(bet.status) &&
        new Date(bet.settledAt ?? bet.date).getTime() >= after
    ),
    won = bets.filter((bet) => bet.status === 'won'),
    staked = bets.reduce((sum, bet) => sum + bet.stake, 0),
    returned = bets.reduce(
      (sum, bet) => sum + (bet.returnAmount ?? (bet.status === 'won' ? bet.stake * bet.odds : 0)),
      0
    );
  return {
    bets: bets.length,
    wins: won.length,
    roi: staked ? ((returned - staked) / staked) * 100 : 0,
    bestOdd: Math.max(0, ...won.map((bet) => bet.odds))
  };
}
function challengeEntry(id) {
  return state.challengeEntries.find(
    (entry) => (typeof entry === 'string' ? entry : entry.id) === id
  );
}
function challengeMetric(id) {
  const week = weekKey(Date.now()),
    bets = state.serverBets
      .filter((bet) => weekKey(bet.date) === week)
      .slice()
      .reverse()
      .map((bet) => ({
        status: bet.status,
        stake: bet.stake,
        payout: bet.returnAmount ?? 0,
        odds: bet.odds,
        value_bet: bet.valueBet
      }));
  return challengeScore(id, bets);
}
function avatarConfig(profile = {}) {
  return legacyOf(profile);
}
const avatarOf = (row, cls = 'mini-avatar') =>
  avatarMarkup(row.avatar_config ? { avatar_config: row.avatar_config } : row, {
    userId: row.user_id,
    cls
  });
function renderCommunity() {
  if (activeTab !== 'community') return;
  document.querySelectorAll('[data-challenge]').forEach((card) => {
    const id = card.dataset.challenge,
      joined = Boolean(challengeEntry(id)),
      metric = challengeMetric(id);
    card.classList.toggle('joined', joined);
    card.querySelector('[data-join-challenge]').textContent = joined
      ? 'Défi rejoint ✓'
      : 'Participer';
    const last = (state.progress?.results ?? []).find((item) => item.challenge_id === id);
    card.querySelector('[data-challenge-ranking]').textContent = joined
      ? `Cette semaine : ${metric.score} point${Math.abs(metric.score) > 1 ? 's' : ''} · ${metric.wins}/${metric.bets} gagnés${last ? ` · semaine dernière : ${last.rank}${last.rank === 1 ? 'er' : 'e'}` : ''}`
      : 'Défi hebdomadaire facultatif : de l’XP, jamais de points de ligue.';
  });
}
function updateFreshness() {
  const health = $('#pipeline-health'),
    calendarAt = Date.parse(state.feedDates?.calendar);
  if (health) {
    health.hidden = Number.isFinite(calendarAt) && Date.now() - calendarAt <= 24 * 60 * 60 * 1000;
    health.textContent =
      'Collecte des pronostics en retard de plus de 24 h ou date indisponible. Les derniers résultats sont conservés.';
  }
  const badge = $('#odds-freshness'),
    info = sourceFreshness(state.oddsUpdatedAt, 'odds'),
    age = Math.max(0, Math.floor((Date.now() - Date.parse(state.oddsUpdatedAt)) / 60000)),
    elapsed = age < 60 ? `${age} min` : `${Math.floor(age / 60)} h`;
  badge.textContent =
    info.status === 'unknown'
      ? 'Cotes : date indisponible'
      : info.status === 'stale'
        ? `Cotes anciennes · ${elapsed}`
        : `Cotes actualisées il y a ${elapsed}`;
  badge.className = `freshness-badge ${info.status === 'fresh' ? 'fresh' : 'stale'}`;
  badge.title = `${info.label}. Date du flux de cotes : une offre conservée en cache peut être plus ancienne.`;
  const details = $('#odds-data-detail');
  if (details)
    details.textContent = `Flux de cotes : ${info.label}. Collectes habituelles : 6 h et 18 h Paris. Les offres conservées peuvent être plus anciennes.`;
}
function showConfidence(match) {
  const dialog = $('#confidence-dialog'),
    metrics = confidenceMetrics(),
    pct = (value) => (value == null ? null : Math.round(value * 100));
  if (match) {
    const best =
        match.completed || isLive(match) || kickoffAt(match) <= Date.now()
          ? (match.suggestedPick ?? null)
          : recommendedMarket(match),
      score = pct(best?.probability),
      quality = analyseMatch(match).markets.find((m) => m.key === best?.key)?.dataConfidence;
    $('#confidence-content').innerHTML =
      `<p class="confidence-intro"><strong>${html(match.home)} - ${html(match.away)}</strong><br>Pronostic analysé : ${best ? html(best.label) : 'Aucune sélection admissible'}</p><div class="confidence-total"><strong>${score == null ? '-' : score + '/100'}</strong><span>Il s’agit de la probabilité estimée par le modèle pour ce pronostic, pas de l’indice global du site.</span></div><p>${dataBasisMarkup(quality)}</p><p class="model-warning">Le modèle de Poisson estime cette probabilité à partir des buts attendus. Elle ne mesure ni la forme récente des pronostics du site, ni une garantie de gain.</p>`;
  } else {
    const score = pct(metrics.score),
      form = pct(metrics.form),
      today = pct(metrics.todayConfidence);
    $('#confidence-content').innerHTML =
      `<p class="confidence-intro">L’indice global combine les résultats récents des propositions du site et la confiance moyenne des pronostics du jour.</p><div class="confidence-total"><strong>${score == null ? '-' : score + '/100'}</strong><span>${score == null ? 'L’indice apparaîtra dès que les deux composantes seront disponibles.' : '75 % de forme récente + 25 % de confiance du jour.'}</span></div>${[
        [
          `Forme des 10 derniers jours`,
          form,
          75,
          metrics.recentCount
            ? `${metrics.wins}/${metrics.recentCount} pronostics réussis`
            : 'Aucun résultat disponible'
        ],
        [
          'Confiance des matchs du jour',
          today,
          25,
          metrics.todayCount
            ? `${metrics.todayCount} pronostic${metrics.todayCount > 1 ? 's' : ''} analysé${metrics.todayCount > 1 ? 's' : ''}`
            : 'Aucun match disponible'
        ]
      ]
        .map(
          ([label, value, weight, detail]) =>
            `<div class="confidence-factor"><div><span>${label}</span><small>Poids ${weight}% · ${detail}</small></div><div><i style="width:${value ?? 0}%"></i></div><strong>${value == null ? '-' : value + '/100'}</strong></div>`
        )
        .join(
          ''
        )}<p class="model-warning">Calcul : (${form ?? '-'} × 0,75) + (${today ?? '-'} × 0,25)${score == null ? '. Les deux valeurs sont nécessaires.' : ` = ${score}/100`}. La période récente couvre les dix jours précédant aujourd’hui afin de ne pas compter deux fois les matchs du jour.</p>`;
  }
  dialog.showModal();
}
function renderStakeControls(locked) {
  document
    .querySelectorAll('[data-stake-percent]')
    .forEach(
      (button) =>
        (button.disabled =
          locked ||
          (percentageStake(state.bankroll, Number(button.dataset.stakePercent)) ?? 0) < 100)
    );
  const issue = stakeIssue(
      $('#stake').value,
      state.betMode === 'single' ? state.ticket.length : 1,
      state.bankroll
    ),
    feedback = $('#stake-feedback');
  if (feedback)
    feedback.textContent =
      issue === 'precision' && !$('#stake').value?.trim()
        ? 'Indiquez une mise avant de confirmer.'
        : issue === 'precision'
          ? 'Indiquez une mise valide, avec deux décimales au maximum.'
          : issue === 'minimum'
            ? 'La mise minimale est de 1 €. Ajoutez un montant avant de confirmer.'
            : issue === 'balance'
              ? 'Le total engagé dépasse votre bankroll disponible. Réduisez la mise.'
              : '';
  $('#stake').setAttribute?.('aria-invalid', String(Boolean(issue)));
  return issue;
}
let selectedStakePercent = 2;
let couponSignature = '';
function renderMobileCoupon() {
  const bar = $('#mobile-coupon');
  if (!bar) return;
  const wasHidden = bar.hidden,
    visible = state.ticket.length > 0;
  bar.hidden = !visible;
  document.body?.classList.toggle('has-mobile-coupon', visible);
  $('#coupon-count').textContent =
    `${state.ticket.length} sélection${state.ticket.length > 1 ? 's' : ''}`;
  const odds = state.ticket.reduce((total, item) => total * item.odd, 1),
    count = state.ticket.length;
  $('#coupon-odds').textContent = `Cote ${decimal(odds, 2)}`;
  bar.setAttribute?.(
    'aria-label',
    `Ouvrir mon coupon : ${count} sélection${count > 1 ? 's' : ''}, cote cumulée ${decimal(odds, 2)}`
  );
  const signature = JSON.stringify(state.ticket.map((x) => [x.matchId, x.key, x.odd]));
  if (signature !== couponSignature || (wasHidden && visible)) {
    bar.getAnimations?.().forEach((a) => a.cancel());
    if (
      visible &&
      typeof matchMedia !== 'undefined' &&
      !matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      bar.animate?.(
        wasHidden
          ? [
              { transform: 'translate3d(0,12px,0) scale(.7)', opacity: 0 },
              { transform: 'translate3d(0,0,0) scale(1)', opacity: 1 }
            ]
          : [
              { transform: 'scale(1)' },
              { transform: 'scale(1.12)', offset: 0.45 },
              { transform: 'scale(1)' }
            ],
        { duration: 240, easing: 'cubic-bezier(.2,.8,.3,1)' }
      );
    couponSignature = signature;
  }
}
function renderTicket() {
  const locked = Boolean(betConfirmed || betAttempt?.busy || betAttempt?.uncertain);
  if (!locked && selectedStakePercent != null)
    $('#stake').value = (
      (percentageStake(state.bankroll, selectedStakePercent) ?? 0) / 100
    ).toFixed(2);
  document.querySelectorAll('[data-stake-percent]').forEach((button) => {
    const percent = Number(button.dataset.stakePercent),
      cents = percentageStake(state.bankroll, percent);
    button.innerHTML = `${percent} %<small>${money((cents ?? 0) / 100)}</small>`;
    button.setAttribute('aria-pressed', String(selectedStakePercent === percent));
    button.disabled = locked || cents == null || cents < 100;
  });
  if (!locked)
    state.ticket = state.ticket.filter((item) => {
      const match = allMatches().find((m) => m.id === item.matchId);
      return (
        match &&
        quoteAvailable(match, item.key) &&
        analyseMatch(match).markets.some(
          (m) => m.key === item.key && Number.isFinite(m.probability)
        )
      );
    });
  document
    .querySelectorAll(
      '#builder input,#builder select,#builder [data-bet-mode],#clear-ticket,#generate-combo,#quick-combo,#ticket-items button,#stake-controls button'
    )
    .forEach((el) => (el.disabled = locked));
  const box = $('#ticket-items'),
    multiple = state.betMode === 'multiple',
    single = state.betMode === 'single',
    independent = single;
  const empty = $('#ticket-empty'),
    controls = $('#ticket-controls');
  const showEmpty = !state.ticket.length && !locked;
  const restoreFocus = showEmpty && controls?.contains?.(document.activeElement);
  if (empty) empty.hidden = !showEmpty;
  if (controls) controls.hidden = showEmpty;
  if (restoreFocus) $('#ticket-calendar')?.focus();
  box.innerHTML = state.ticket.length
    ? state.ticket
        .map(
          (x, i) =>
            `<div class="ticket-row"><div><strong>${html(x.label)}</strong><small>${html(x.match)}</small>${x.sourceNickname ? `<small class="copied-bet">Pari copié de ${html(x.sourceNickname)}</small>` : ''}</div><span class="ticket-price"><b>Cote ${decimal(x.odd, 2)}</b><small>${Number.isFinite(x.probability) ? `Confiance estimée ${Math.round(x.probability * 100)} %` : 'Choix manuel · sans modèle'}</small></span><button class="remove" data-remove="${i}"${locked ? ' disabled' : ''} aria-label="Retirer la sélection">×</button></div>`
        )
        .join('')
    : emptyState('ticket');
  const combinedOdds = state.ticket.reduce((p, x) => p * x.odd, 1),
    target = Number($('#target-odds').value),
    stake = Math.max(0, (stakeCents($('#stake').value) ?? 0) / 100 || 0),
    formula = $('#system-formula')?.value ?? 'auto',
    lines = multiple ? systemLines(state.ticket, formula) : [],
    validSystem = multiple && lines.length > 0,
    lineStake = validSystem ? stake / lines.length : 0,
    stakeTotal = state.ticket.length ? (independent ? stake * state.ticket.length : stake) : 0,
    potential = !state.ticket.length
      ? 0
      : independent
        ? state.ticket.reduce((sum, item) => sum + stake * item.odd, 0)
        : multiple
          ? lines.reduce((sum, line) => sum + lineStake * line.odds, 0)
          : stake * combinedOdds;
  const modeNote = $('#ticket-mode-note');
  if (modeNote)
    modeNote.textContent = single
      ? 'Chaque sélection devient un pari indépendant.'
      : multiple
        ? 'La mise est répartie entre les sous-paris de la formule.'
        : 'Toutes les sélections doivent gagner pour remporter le combiné.';
  $('#system-control').hidden = !multiple;
  $('#ticket-title').textContent = single
    ? state.ticket.length > 1
      ? 'Paris simples'
      : 'Pari simple'
    : multiple
      ? 'Pari système'
      : 'Combiné';
  document.querySelectorAll('[data-bet-mode]').forEach((button) => {
    button.classList.toggle('active', button.dataset.betMode === state.betMode);
    button.setAttribute('aria-pressed', String(button.dataset.betMode === state.betMode));
  });
  $('#odds-label').textContent = independent
    ? 'Cotes individuelles'
    : multiple
      ? 'Sous-paris'
      : 'Cote totale';
  if (independent || multiple) {
    const el = $('#total-odds');
    el.textContent = multiple
      ? lines.length
        ? `${lines.length} ligne${lines.length > 1 ? 's' : ''}`
        : 'Formule incompatible'
      : state.ticket.length
        ? `${state.ticket.length} pari${state.ticket.length > 1 ? 's' : ''}`
        : '-';
    delete el.dataset.value;
    rollToken++;
  } else rollNumber($('#total-odds'), combinedOdds);
  $('#target-gap-row').hidden = state.betMode !== 'combined';
  $('#target-gap').textContent = state.ticket.length
    ? `${combinedOdds >= target ? '+' : ''}${decimal(combinedOdds - target, 2)}`
    : '-';
  $('#stake-label').textContent = independent
    ? 'Mise par pari (€)'
    : multiple
      ? 'Mise globale (€)'
      : 'Mise (€)';
  $('#stake-total').textContent = money(stakeTotal);
  $('#potential-win').textContent = money(potential);
  const probability = state.ticket.reduce((p, x) => p * x.probability, 1),
    kelly =
      combinedOdds > 1
        ? Math.max(0, Math.min(0.05, (probability * combinedOdds - 1) / (combinedOdds - 1)))
        : 0;
  const manual = state.ticket.some((x) => !Number.isFinite(x.probability)),
    showAdvice = !independent && !multiple && !manual,
    adviceValue = $('#stake-advice-value'),
    adviceContext = $('#stake-advice-context');
  $('#stake-advice-note').textContent = independent
    ? `${state.ticket.length} pari${state.ticket.length > 1 ? 's' : ''} indépendant${state.ticket.length > 1 ? 's' : ''} · chacun sera réglé séparément`
    : multiple
      ? lines.length
        ? `${money(stake / lines.length)} par sous-pari · droit à l’erreur selon la formule`
        : 'Cette formule ne correspond pas au nombre de sélections'
      : manual
        ? 'Choix manuel : aucun conseil de mise sans modèle validé'
        : 'Mise conseillée :';
  adviceValue.hidden = adviceContext.hidden = !showAdvice;
  adviceValue.textContent = showAdvice ? money(state.bankroll * kelly) : '';
  adviceContext.textContent = showAdvice ? `(${decimal(kelly * 100, 1)} % de la bankroll)` : '';
  const placeButton = $('#place-bet');
  placeButton.disabled =
    Boolean(renderStakeControls(locked)) ||
    !state.ticket.length ||
    stake <= 0 ||
    stakeTotal > state.bankroll ||
    (multiple && !validSystem) ||
    (accountAuthenticated && !state.serverReady) ||
    Boolean(placeButton.dataset.busy);
  placeButton.textContent = accountAuthenticated
    ? !state.serverReady
      ? 'Paris certifiés indisponibles'
      : independent
        ? `Placer ${state.ticket.length} pari${state.ticket.length > 1 ? 's' : ''} simple${state.ticket.length > 1 ? 's' : ''}`
        : multiple
          ? `Placer le système (${lines.length} lignes)`
          : 'Placer le pari virtuel'
    : 'Placer le pari en mode invité';
  if (betAttempt?.uncertain) {
    placeButton.disabled = Boolean(placeButton.dataset.busy);
    placeButton.textContent = 'Vérifier le pari en attente';
  }
  placeButton.classList.toggle('bet-loading', Boolean(placeButton.dataset.busy));
  placeButton.classList.toggle('bet-confirmed', betConfirmed);
  placeButton.setAttribute?.('aria-busy', String(Boolean(placeButton.dataset.busy)));
  if (placeButton.dataset.busy) placeButton.textContent = 'Enregistrement…';
  if (betConfirmed) {
    placeButton.disabled = true;
    placeButton.textContent = '✓ Pari confirmé';
  }
  $('#share-combo').disabled = !state.ticket.length;
  const shareUrl = $('#share-ticket-url');
  if (shareUrl) shareUrl.disabled = !state.ticket.length;
  renderLeagueToggle();
  renderLeagueList();
  if (locked)
    document
      .querySelectorAll(
        '#builder input,#builder select,#builder [data-bet-mode],#clear-ticket,#generate-combo,#quick-combo,#ticket-items button,#stake-controls button'
      )
      .forEach((el) => (el.disabled = true));
  for (const id of ['#mobile-ticket-count', '#match-ticket-count']) {
    const count = $(id);
    if (count) {
      count.hidden = !state.ticket.length;
      count.textContent = state.ticket.length;
    }
  }
  updateSelectedMarkets();
  renderMobileCoupon();
}
// Interrupteur « Compte en ligue » : quota de 10 paris libres par semaine et un seul prono par match (mêmes règles que le serveur).
function leagueDecision() {
  const bets = state.serverBets;
  if (state.betMode === 'multiple')
    return { hidden: false, ok: false, note: 'Les paris système ne comptent pas en ligue.' };
  if (state.betMode === 'single') {
    const remaining = quotaRemaining(bets),
      eligible = state.ticket.filter(
        (item) => leagueEligibility([item.matchId], bets).counts
      ).length,
      count = Math.min(eligible, remaining);
    return {
      ok: count > 0,
      note:
        count > 0
          ? `${count} pari${count > 1 ? 's' : ''} sur ${state.ticket.length} compteront · ${quotaUsed(bets)} sur ${WEEKLY_QUOTA} cette semaine`
          : remaining
            ? 'Un pari de la ligue porte déjà sur ces matchs.'
            : 'Quota de la semaine atteint : ces paris ne compteront pas.'
    };
  }
  const check = leagueEligibility(
    state.ticket.map((item) => item.matchId),
    bets
  );
  return {
    ok: check.counts,
    note: check.counts
      ? `${quotaUsed(bets)} sur ${WEEKLY_QUOTA} cette semaine`
      : check.reason === 'QUOTA'
        ? 'Quota de la semaine atteint : ce pari ne comptera pas.'
        : 'Un pari de la ligue porte déjà sur un de ces matchs.'
  };
}
function renderLeagueToggle() {
  const box = $('#league-toggle');
  if (box) box.hidden = true;
}
function addSelection(matchId, key, from) {
  const origin = from?.getBoundingClientRect();
  if (betConfirmed || betAttempt?.busy || betAttempt?.uncertain) {
    toast('Vérifiez d’abord le pari en attente.');
    return;
  }
  if (
    from?.hasAttribute?.('data-result-pick') &&
    state.ticket.some((item) => item.matchId === matchId && item.key === key)
  ) {
    state.ticket = state.ticket.filter((item) => item.matchId !== matchId || item.key !== key);
    renderTicket();
    return;
  }
  const match = allMatches().find((x) => x.id === matchId);
  if (!match || match.completed || match.voided || kickoffAt(match) <= Date.now()) {
    toast('Ce match ne peut plus être sélectionné.');
    return;
  }
  const m = analyseMatch(match).markets.find((x) => x.key === key);
  if (!m || !Number.isFinite(m.probability) || !quoteAvailable(match, key)) return;
  const selection = {
    ...m,
    matchId,
    match: `${match.home} - ${match.away}`,
    home: match.home,
    away: match.away,
    league: match.league,
    date: match.date,
    time: match.time
  };
  state.ticket = [...state.ticket.filter((x) => x.matchId !== matchId), selection];
  renderTicket();
  if (from) flyToTicket(from, origin);
}
const personalFilters = { period: 'all', status: 'all', search: '' };
let personalDashboard = null;
function guestSyncOffer() {
  const eligible = !accountAuthenticated && guestStorageReady && guestWallet.history.length;
  if (eligible) syncTrial?.eligible();
  if (!eligible || syncTrial?.control || syncPromptChoice) return '';
  syncTrial?.exposed();
  return '<section class="card" aria-labelledby="guest-sync-title"><h4 id="guest-sync-title">Retrouver votre simulation sur un autre appareil</h4><p>Un compte peut sauvegarder votre historique de simulation dans un espace privé. Il reste distinct des paris certifiés.</p><button type="button" class="button secondary" data-guest-sync-start>Synchroniser ma simulation</button> <button type="button" class="text-button" data-guest-sync-dismiss>Continuer en invité</button></section>';
}
function renderHistory() {
  if (activeTab !== 'bankroll') return;
  for (const id of ['#bankroll-member', '#bankroll-capital']) {
    const el = $(id);
    if (el) el.hidden = !accountAuthenticated;
  }
  const guest = $('#bankroll-guest');
  if (guest) {
    guest.hidden = accountAuthenticated && !guestWallet.history.length;
    const offer = guestSyncOffer(),
      history = guestWallet.history
        .map((bet) =>
          historyCard(
            { ...bet, id: null },
            { results: state.results, live: state.live, fixtures: state.liveMatches }
          )
        )
        .join('');
    guest.innerHTML = `<h3>${accountAuthenticated ? 'Ma simulation invitée' : 'Mode invité'}</h3><p>Bankroll virtuelle : <strong>${money(guestWallet.bankroll)}</strong></p><p>Paris de simulation privés, distincts des paris certifiés du compte.</p>${!guestStorageReady ? '<p role="status">Sauvegarde locale indisponible : vos paris ne seront pas conservés après fermeture.</p>' : ''}${!accountAuthenticated ? '<p>Vos paris sont sauvegardés sur cet appareil.</p>' : '<button class="button secondary" data-save-guest>Sauvegarder cette simulation dans mon compte</button>'}${accountAuthenticated ? '' : offer || '<button class="button secondary" data-open-join>Créer un compte</button>'}<div class="personal-tickets">${history || '<p>Aucun pari invité pour le moment. Choisissez un match pour commencer.</p>'}</div>`;
  }
  if (!accountAuthenticated) {
    personalDashboard?.clear();
    $('#history-count').textContent = `${guestWallet.history.length} pari(s) en mode invité.`;
    return;
  }
  if (!accountApi?.personalHistory) return;
  if (!personalDashboard)
    personalDashboard = initPersonalDashboard({
      api: accountApi,
      root: $('#bankroll'),
      getContext: () => ({
        userId: accountUserId,
        results: state.results,
        live: state.live,
        fixtures: state.liveMatches
      })
    });
  personalDashboard.load({ refresh: true });
}
let sharedTicketRead = false,
  drawerReady = Promise.resolve();
function ticketOptions() {
  return { mode: state.betMode, formula: $('#system-formula')?.value ?? 'auto' };
}
function rememberTicket() {
  if (typeof window === 'undefined') return;
  try {
    saveTicketDraft(
      sessionStorage,
      state.ticket.length ? ticketToken(state.ticket, ticketOptions()) : null
    );
  } catch {}
}
function restoreSharedTicket() {
  if (sharedTicketRead || typeof window === 'undefined') return;
  let value = new URL(location.href).searchParams.get('ticket');
  try {
    value ??= readTicketDraft(sessionStorage);
  } catch {}
  if (value === null) return;
  sharedTicketRead = true;
  const restored = restoreTicket(value, allMatches());
  state.ticket = restored.items;
  state.betMode = restored.mode;
  const formula = $('#system-formula');
  if (formula) formula.value = restored.formula;
  renderTicket();
  const notice = $('#shared-ticket-notice');
  if (notice) {
    notice.hidden = false;
    notice.innerHTML = `<p>Coupon partagé chargé. Vérifiez les cotes et choisissez votre mise. Aucun pari n’a été placé.</p>${restored.invalid ? '<p>Une partie du lien est invalide.</p>' : ''}${restored.unavailable.length || restored.changed.length ? `<ul>${[...restored.unavailable, ...restored.changed].map((message) => `<li>${html(message)}</li>`).join('')}</ul>` : ''}`;
  }
  drawerReady.then(() => {
    setBuilderTab('ticket');
    setBuilderDrawer(true);
  });
  toast(
    restored.unavailable.length || restored.changed.length
      ? 'Coupon chargé · vérifiez les changements'
      : 'Coupon partagé chargé'
  );
}

let toastTimer = null;
function toast(message) {
  clearTimeout(toastTimer);
  const t = $('#toast');
  t.textContent = message;
  t.classList.add('show');
  toastTimer = setTimeout(
    () => t.classList.remove('show'),
    Math.min(8000, Math.max(2500, String(message).length * 45))
  );
}

// Page profil (profile.js, chargé à la demande) : #profil et #joueur-<pseudo).
let profilePage = null,
  profilePending = null;
async function openProfile(target) {
  profilePending = target;
  if (!profilePage) {
    const host = $('#profile-page');
    if (host)
      host.innerHTML =
        '<div class="profile-loading" role="status" aria-live="polite"><div class="skeleton" style="height:96px"></div><p>Chargement du profil…</p></div>';
  }
  if (!accountApi && !(await ensureAccount())) {
    const host = $('#profile-page');
    if (host) host.textContent = 'Profil indisponible. Revenez au calendrier puis réessayez.';
    return;
  }
  if (activeTab !== 'profile') return;
  if (!profilePage) {
    const [module, model] = await Promise.all([
      import('./src/account/profile.js?v=profil-bet310'),
      import('./src/model/model.js')
    ]);
    if (profilePage) return profilePage.show(profilePending);
    profilePage = module.initProfilePage({
      html,
      money,
      divisionBadge,
      levelInfo,
      avatarConfig,
      safeLogo,
      BADGES,
      echelonName,
      chevrons,
      divisionIndex,
      model,
      accountApi,
      getState: () => state,
      toast,
      copyBet: (bet, nickname) => {
        if (betConfirmed || betAttempt?.busy || betAttempt?.uncertain) {
          toast('Vérifiez d’abord le pari en attente.');
          return;
        }
        try {
          const copied = copyBetSelections(bet, nickname, allMatches());
          state.ticket = copied;
          state.betMode = copied.length > 1 ? 'combined' : 'single';
          renderTicket();
          setActiveTab('matches');
          setBuilderDrawer(true);
          toast('Pari copié · vérifiez les cotes et la mise');
        } catch (error) {
          toast(error.message);
        }
      },
      followers: async (id) => {
        try {
          const { data } = await accountApi.community.followers(id);
          return data?.followers ?? 0;
        } catch {
          return null;
        }
      },
      extraActions: (info) =>
        accountAuthenticated
          ? `<button class="button secondary" data-follow-profile="${html(info.profile.user_id)}">${state.followIds.has(info.profile.user_id) ? 'Ne plus suivre' : 'Suivre'}</button>`
          : '',
      onClick: async (event, context) => {
        const button = event.target.closest('[data-follow-profile]');
        if (!button) return;
        const id = button.dataset.followProfile,
          following = state.followIds.has(id);
        button.disabled = true;
        try {
          if (following) await accountApi.community.unfollow(id);
          else await accountApi.community.follow(id);
          toast(following ? 'Vous ne suivez plus ce joueur' : 'Joueur suivi');
          context.show();
        } catch (error) {
          toast(error.message);
          button.disabled = false;
        }
      },
      openJoin,
      navigate: (tab) => setActiveTab(tab, true),
      onNickname: () => {
        renderAccountMenu();
        renderCommunity();
        $('#account-label').textContent = state.profile.nickname;
      },
      onLoggedOut: () => setActiveTab('matches', true),
      setPreference: (key, value) => {
        if (key !== 'celebrationSound') return;
        state.profile = { ...state.profile, celebrationSound: value === true };
        persist();
      },
      race: () => {
        const league = state.league,
          mine = league?.rows?.find((row) => row.user_id === league.me);
        if (!mine || league.echelon == null) return '';
        const size = league.rows.length,
          zone = Math.max(1, Math.round(size * 0.2));
        return mine.confirmed === false
          ? `Classement provisoire : ${mine.decided}/10 résultats décidés.`
          : mine.rank <= zone
            ? 'Vous êtes dans la zone de montée.'
            : `Course à la montée : ${decimal(Math.max(0, Number(league.rows[zone - 1].points) - Number(mine.points)), 1)} points pour entrer dans la zone de montée.`;
      }
    });
  }
  if (!accountAuthenticated && profilePending?.self) {
    openJoin('login');
    return;
  }
  profilePage.show(profilePending);
}
// Page « Rejoindre le club » (join.js, chargé à la demande) et menu compte.
const joinTeams = () => {
  const seen = new Map();
  for (const match of allMatches())
    for (const side of ['home', 'away']) {
      const id = teamIdOf(match, side),
        logo = safeLogo(match[`${side}Logo`]);
      if (id && logo && !seen.has(id)) seen.set(id, { id, name: match[side], logo });
    }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
};
async function openJoin(mode = 'login') {
  rememberTicket();
  if (!accountApi && !(await ensureAccount())) {
    toast('Le service de comptes est indisponible. Réessayez dans un instant.');
    return;
  }
  if (accountApi.configured === false) {
    $('#club-unavailable').showModal();
    return;
  }
  if (!join) {
    const module = await import('./src/account/join.js?v=join-bet306');
    join = module.initJoin({
      auth: accountApi.auth,
      getTeams: joinTeams,
      getLeagues: () => Object.keys(LEAGUES),
      toast,
      onDone: async (event) => {
        if (event === 'signup') syncTrial?.created();
        if (accountAuthenticated) {
          try {
            await accountApi.refreshServer();
          } catch {}
        }
        toast(
          event === 'signup'
            ? 'Profil créé'
            : event === 'recovery'
              ? 'Mot de passe mis à jour'
              : 'Connexion réussie'
        );
        renderAccountMenu();
        if (accountAuthenticated && !$('#profil').classList.contains('tab-hidden'))
          openProfile(profilePending ?? { self: true });
        if (state.ticket.length)
          toast('Ticket conservé : vérifiez les matchs et les cotes avant de confirmer.');
      }
    });
  }
  $('#join-config').hidden = accountApi.configured !== false;
  join.open(mode);
}
function renderAccountMenu() {
  document.querySelectorAll('#account-menu [data-menu]').forEach((button) => {
    button.hidden =
      button.dataset.menu === 'login'
        ? accountAuthenticated
        : !['theme', 'login'].includes(button.dataset.menu) && !accountAuthenticated;
  });
  const sync = $('#sync-status');
  if (sync) sync.hidden = !accountAuthenticated;
  const menuHead = $('#menu-head');
  if (menuHead) menuHead.hidden = !accountAuthenticated;
  const icon = $('#account-avatar'),
    nickname = state.profile.nickname || 'Parieur';
  if (icon)
    icon.innerHTML = accountAuthenticated
      ? avatarMarkup(state.profile, { userId: accountUserId })
      : ICONS.user;
  $('#account-button')?.setAttribute?.(
    'aria-label',
    accountAuthenticated ? `Compte de ${nickname}` : 'Ouvrir mon compte'
  );
  if (accountAuthenticated) $('#account-label').textContent = nickname;
  const head = $('#menu-head');
  if (!head || !accountAuthenticated) return;
  const config = avatarConfig(state.profile),
    xp = state.progress?.xp ?? 0,
    info = levelInfo(xp);
  head.innerHTML = `${avatarMarkup(state.profile, { userId: accountUserId })}<div><strong>${html(state.profile.nickname || 'Parieur')}</strong><small>${state.progress ? `Niv. ${info.level} · ${info.title}` : 'Niveau en cours de calcul'}</small><span class="level-bar"><i style="width:${Math.round(info.progress * 100)}%"></i></span></div>`;
}
const accountMenu = () => $('#account-menu');
function toggleAccountMenu(force) {
  const menu = accountMenu();
  if (!menu) return;
  const open = force ?? menu.hidden;
  menu.hidden = !open;
  if (open) {
    renderAccountMenu();
    menu.querySelector('button:not([hidden])')?.focus();
  }
  $('#account-button')?.setAttribute('aria-expanded', String(open));
}
function menuAction(action) {
  toggleAccountMenu(false);
  if (action === 'theme') {
    $('#theme-dialog').showModal();
  } else if (action === 'login') {
    openJoin('login');
  } else if (action === 'profile') {
    setActiveTab('profile', true, { self: true });
  } else if (action === 'shop') {
    setActiveTab('shop', true);
  } else if (action === 'league') {
    setActiveTab('community', true);
    setCommunityTab('league');
  } else if (action === 'avatar') {
    setActiveTab('profile', true, { self: true });
  } else if (action === 'account') {
    setActiveTab('profile', true, { self: true, tab: 'account' });
  } else if (action === 'notifications') {
    setActiveTab('profile', true, { self: true, tab: 'notifications' });
  } else if (action === 'bets') {
    setActiveTab('bankroll', true);
  } else if (action === 'logout')
    accountApi?.auth
      .signOut()
      .then(() => toast('Vous êtes déconnecté'))
      .catch((error) => toast(error.message));
}
function applyServerData(data) {
  if (!data) {
    state.serverBets = [];
    state.dailyPicks = [];
    state.league = null;
    state.special = null;
    state.progress = null;
    state.private = null;
    state.followIds = new Set();
    state.community.follows = null;
    state.challengeEntries = [];
    state.serverReady = false;
    rebuildHistory();
    render();
    return;
  }
  state.serverReady = true;
  state.bankroll = Number(data.account.bankroll);
  state.initial = Number(data.account.initial);
  state.capitalEvents = data.events.map((event) => ({
    date: event.created_at,
    amount: Number(event.amount)
  }));
  state.serverBets = data.bets.map(fromServerBet);
  state.dailyPicks = data.dailyPicks ?? [];
  let voided = 0;
  for (const bet of state.legacy)
    if (bet.status === 'pending') {
      Object.assign(bet, {
        status: 'void',
        returnAmount: bet.stake,
        settledAt: new Date().toISOString()
      });
      voided++;
    }
  updateBetAttention();
  rebuildHistory();
  if (voided) persist();
  render();
  if (voided) toast(`${voided} ancien pari en attente annulé : mise restituée`);
}
function settlePendingBets(results) {
  const result = settleGuestWallet(guestWallet, results);
  if (result.settled) {
    guestWallet = result.wallet;
    guestStorageReady = saveGuestWallet(guestWallet, guestStorage);
    if (!accountAuthenticated) state.bankroll = guestWallet.bankroll;
    else cloudSave(userStatePayload());
  }
  if (!accountAuthenticated) return result.settled;
  let settled = result.settled;
  for (const bet of state.history) {
    if (bet.status !== 'pending' || bet.certified) continue;
    const system = bet.betType === 'multiple' ? settleSystemBet(bet, results) : null,
      status = system?.status ?? settleBet(bet, results);
    if (status === 'pending') continue;
    bet.status = status;
    bet.settledAt = new Date().toISOString();
    bet.returnAmount =
      system?.returnAmount ??
      (status === 'won' ? bet.stake * bet.odds : status === 'void' ? bet.stake : 0);
    if (bet.returnAmount) state.bankroll += bet.returnAmount;
    settled++;
  }
  if (settled) persist();
  return settled;
}
function applyFixtureData(data, cached = false) {
  if (!Array.isArray(data.matches)) throw new Error('Calendrier invalide');
  const version = fixtureVersion(data);
  if (version !== bookmakerFixtureVersion) {
    bookmakerFixtureVersion = version;
    bookmakerSchema = data.matchOffersSchema;
    bookmakerCache.clear();
    unavailableBookmakers.clear();
  }
  fixturePreview = null;
  fixtureDataLoaded = true;
  if (!cached || fixturesStatus !== 'error') fixturesStatus = 'ready';
  state.liveMatches = data.matches.map((match) => ({
    ...match,
    analysisStatus: match.analysisStatus ?? (match.statsSource ? 'ready' : 'unavailable')
  }));
  const calendarDateChanged = chooseInitialCalendarDate();
  if (!cached) findInitialCalendarDate = false;
  if (!betAttempt?.busy && !betAttempt?.uncertain)
    state.ticket = state.ticket.filter((item) => {
      const match = allMatches().find((m) => m.id === item.matchId);
      return (
        match &&
        quoteAvailable(match, item.key) &&
        analyseMatch(match).markets.some(
          (m) => m.key === item.key && Number.isFinite(m.probability)
        )
      );
    });
  if (!cached && syncTrial)
    syncTrial.calendar(
      matchesWithBookmakers(data.matches).some(
        (match) => match.date === isoDate(0) && !match.voided
      )
    );
  state.dailyChallenge = data.dailyChallenge ?? null;
  state.results = [...(data.settlements ?? []), ...data.matches.filter((match) => match.completed)];
  for (const match of data.matches.filter((item) => item.completed)) {
    if (state.predictionHistory.some((item) => item.id === match.id)) continue;
    const pick = match.suggestedPick;
    if (!pick?.key) continue;
    const status = selectionResult({ ...pick, matchId: match.id }, [match]).status;
    state.predictionHistory.unshift({
      id: match.id,
      date: match.date,
      league: match.league,
      match: `${match.home} – ${match.away}`,
      label: pick.label,
      key: pick.key,
      odd: pick.odd,
      probability: pick.probability,
      ...predictionProvenance(pick, match),
      status,
      score: `${match.homeScore} : ${match.awayScore}`
    });
  }
  state.oddsUpdatedAt = data.oddsRefreshedAt;
  state.feedDates = { calendar: data.generatedAt, scores: data.scoresUpdatedAt };
  state.oddsRefreshHours = Array.isArray(data.oddsRefreshHours)
    ? data.oddsRefreshHours
    : ODDS_REFRESH_HOURS;
  const settled = settlePendingBets(state.results),
    updated = sourceFreshness(data.generatedAt, 'calendar'),
    scoresUpdated = sourceFreshness(data.scoresUpdatedAt, 'scores'),
    coverage = data.coverage ?? {};
  if (!cached) persist();
  $('#data-source').innerHTML =
    `<span class="source-dot ${cached ? 'loading' : 'live'}"></span> ${cached ? 'Cache local instantané' : 'Données réelles'} · ${coverage.statsMatches ?? 0} matchs analysés · ${data.oddsHealth ? html(oddsHealthLabel(data.oddsHealth)) : `${coverage.oddsMatches ?? 0} avec cotes`} · calendrier ${html(updated.label)}${updated.status === 'stale' ? ' · ancien' : ''} · scores ${html(scoresUpdated.label)}${scoresUpdated.status === 'stale' ? ' · anciens' : ''}`;
  updateFreshness();
  render();
  if (calendarDateChanged && activeTab === 'matches') revealActive($('#date-navigator'), false);
  openAlertMatch();
  if (location.hash === '#conseils-du-jour')
    requestAnimationFrame(() => $('#conseils-du-jour')?.scrollIntoView({ block: 'start' }));
  if (settled)
    toast(
      `${settled} pari${settled > 1 ? 's' : ''} réglé${settled > 1 ? 's' : ''} automatiquement`
    );
}
async function loadPredictionArchive(force = false) {
  if (!force && archiveLoadedAt && Date.now() - archiveLoadedAt < 5 * 60 * 1000) return;
  if (archivePromise) return archivePromise;
  archivePromise = (async () => {
    try {
      const archive = await loadJson('data/predictions-history.json');
      if (!Array.isArray(archive)) throw new Error('Archive invalide');
      const preceding = cloudForecasts();
      const signatures = new Set(archive.map(forecastSignature));
      const compacted = preceding.some((entry) => signatures.has(forecastSignature(entry)));
      publicForecastArchive = archive;
      publicForecastSignatures = signatures;
      installPublicForecasts(preceding);
      saveLocalState();
      if (compacted) cloudSave(userStatePayload());
      archiveLoadedAt = Date.now();
      archiveStatus = 'ready';
      if (activeTab === 'profile') profilePage?.refresh?.();
      renderHomePerformance();
      renderPredictionStats();
      if (activeTab === 'matches') renderConfidenceKpi();
    } catch (error) {
      archiveStatus = 'error';
      renderHomePerformance();
      renderPredictionStats();
      if (activeTab === 'matches') renderConfidenceKpi();
      console.warn('Historique conservé : archive indisponible', error);
    } finally {
      archivePromise = null;
    }
  })();
  return archivePromise;
}
function loadLiveFixtures() {
  if (fixtureRefresh) return fixtureRefresh;
  lastFixtureRequestAt = Date.now();
  fixtureRefresh = refreshFixtures().finally(() => {
    fixtureRefresh = null;
  });
  return fixtureRefresh;
}
function renderFixtureNotice() {
  const notice = $('#fixture-network-notice');
  if (!notice) return;
  notice.hidden = fixturesStatus !== 'error' || !fixtureDataLoaded;
  if (notice.hidden) return;
  const dates = {
    calendar: state.feedDates?.calendar,
    scores: state.feedDates?.scores,
    odds: state.oddsUpdatedAt
  };
  const parts = [
    'Actualisation impossible. Dernières données disponibles',
    `calendrier ${sourceFreshness(dates?.calendar, 'calendar').label}`,
    `scores ${sourceFreshness(dates?.scores, 'scores').label}`,
    `cotes ${sourceFreshness(dates?.odds, 'odds').label}`
  ];
  const text = parts.join(' · ') + '.';
  const status = notice.querySelector('p');
  if (status.textContent !== text) status.textContent = text;
}
function resumeFixtures() {
  if (!document.hidden && Date.now() - lastFixtureRequestAt >= 60000) loadLiveFixtures();
}
async function showFixturePreview(matches) {
  if (fixtureDataLoaded || fixturePreview) return;
  fixturePreview = matches;
  const calendarDateChanged = chooseInitialCalendarDate();
  if (activeTab !== 'matches') return;
  if (calendarDateChanged) renderDateNavigator();
  renderFilters();
  renderMatches();
  if (calendarDateChanged) revealActive($('#date-navigator'), false);
  if (typeof requestAnimationFrame !== 'function' || document.hidden) return;
  await new Promise((resolve) => {
    const deadline = setTimeout(resolve, 50);
    requestAnimationFrame(() =>
      setTimeout(() => {
        clearTimeout(deadline);
        resolve();
      }, 0)
    );
  });
}
const fixtureVersion = (data) => data.fixtureVersion ?? JSON.stringify(data);
function prepareFixtureAnalyses(data, version) {
  if (!fixtureAnalyses.has(version)) {
    const matches = data.matches.map((match) => ({
      ...match,
      analysisStatus: match.analysisStatus ?? (match.statsSource ? 'ready' : 'unavailable')
    }));
    fixtureAnalyses.set(
      version,
      prepareAnalyses(matches).finally(() => fixtureAnalyses.delete(version))
    );
  }
  return fixtureAnalyses.get(version);
}
async function refreshFixtures() {
  const source = $('#data-source');
  try {
    if (!fixtureDataLoaded && fixturesStatus === 'error') {
      fixturesStatus = 'loading';
      renderMatches();
    }
    const data = await loadJson('data/fixtures.json', markFixtureNetwork ?? undefined);
    if (!Array.isArray(data.matches)) throw new Error('Calendrier invalide');
    const version = fixtureVersion(data);
    fixturesStatus = 'ready';
    if (version !== lastFixtureVersion) {
      writeFixtureCache(data);
      if (!fixturePreview) await showFixturePreview(matchesWithBookmakers(data.matches));
      markFixtureNetwork?.('analyse-debut');
      await prepareFixtureAnalyses(data, version);
      markFixtureNetwork?.('analyse-fin');
      applyFixtureData(data);
      restoreSharedTicket();
      lastFixtureVersion = version;
    } else {
      updateFreshness();
      source.innerHTML = lastFixturesSource;
      renderFixtureNotice();
    }
    loadPredictionArchive();
    lastFixturesSource = source.innerHTML;
  } catch (error) {
    fixturePreview = null;
    fixturesStatus = 'error';
    updateFreshness();
    renderConfidenceKpi();
    loadPredictionArchive();
    if (fixtureDataLoaded) {
      source.textContent = `Actualisation impossible : dernier calendrier conservé (${sourceFreshness(state.feedDates?.calendar, 'calendar').label}). Vérifiez la date des cotes.`;
    } else {
      source.textContent =
        'Calendrier indisponible : utilisez Réessayer pour relancer le chargement.';
      render();
    }
    renderFixtureNotice();
  }
}
let lastFixturesSource = '';
function setActiveTab(tab, scroll = false, profileTarget = null, historyMode = 'replace') {
  if (tab === 'community') tab = 'matches';
  if (tab === 'shop') {
    tab = 'profile';
    profileTarget = { self: true };
  }
  const changedTab = activeTab !== tab;
  if (changedTab && scroll && (tab === 'bankroll' || tab === 'predictions')) {
    mobileDiagnostics?.mark('consultation-resultats');
    syncTrial?.useful('resultats');
  }
  activeTab = tab;
  if (tab === 'bankroll') attention?.clear('bets');
  if (tab === 'community' && state.community.tab === 'challenges') attention?.clear('rewards');
  renderAttention();
  setBuilderDrawer(false);
  renderMobileCoupon();
  document.querySelector('.workspace')?.classList.toggle('tab-hidden', tab !== 'matches');
  document
    .querySelectorAll('[data-view]')
    .forEach((view) => view.classList.toggle('tab-hidden', view.dataset.view !== tab));
  document.querySelectorAll('[data-tab]').forEach((button) => {
    const active = button.dataset.tab === (tab === 'standings' ? 'matches' : tab);
    button.classList.toggle('active', active);
    button.setAttribute('aria-current', active ? 'page' : 'false');
  });
  document.querySelectorAll('[data-mobile-target]').forEach((button) => {
    const active = button.dataset.mobileTarget === tab;
    button.classList.toggle('active', active);
    button.setAttribute('aria-current', active ? 'page' : 'false');
  });
  const matchNavigation = $('#match-navigation');
  if (matchNavigation) {
    matchNavigation.hidden = !['matches', 'standings'].includes(tab);
    document.querySelectorAll('#match-navigation [data-open-tab]').forEach((button) => {
      const active = button.dataset.openTab === tab;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
  }
  if (tab === 'standings')
    useDetails((api) => {
      if (activeTab === 'standings') api.showStandings();
    });
  if (tab === 'predictions') loadPredictionArchive();
  if (changedTab) renderActiveTab();
  if (tab === 'profile') openProfile(profileTarget ?? { self: true });
  else profilePage?.stop();
  const target =
    tab === 'profile'
      ? '#profil'
      : tab === 'bankroll'
        ? '#bankroll'
        : tab === 'standings'
          ? '#standings'
          : tab === 'community'
            ? '#community'
            : tab === 'predictions'
              ? '#predictions'
              : '#match-navigation';
  if ((scroll || changedTab) && typeof window !== 'undefined')
    window.scrollTo({ top: 0, behavior: 'instant' });
  const hash =
    tab === 'profile'
      ? profileTarget && !profileTarget.self
        ? `#joueur-${encodeURIComponent(profileTarget.nickname)}`
        : '#profil'
      : tab === 'bankroll'
        ? '#bankroll'
        : tab === 'standings'
          ? '#classements'
          : tab === 'community'
            ? '#communaute'
            : tab === 'predictions'
              ? '#bilan-pronos'
              : tab === 'matches' && location.hash === '#conseils-du-jour'
                ? location.hash
                : '';
  if (!hasAccountCallback()) {
    if (typeof history !== 'undefined')
      history[historyMode === 'push' && location.hash !== hash ? 'pushState' : 'replaceState'](
        null,
        '',
        hash || location.pathname + location.search
      );
    else location.hash = hash.slice(1);
  }
}
let drawerReturnFocus = null;
function setBuilderDrawer(open) {
  const builder = $('#builder'),
    wasOpen = document.body?.classList.contains('ticket-drawer-open'),
    show = open && typeof matchMedia !== 'undefined' && matchMedia('(max-width:767px)').matches;
  document.body?.classList.toggle('ticket-drawer-open', show);
  document.querySelectorAll('body > header,body > main,body > footer,.mobile-nav').forEach((el) => {
    el.inert = show;
  });
  document
    .querySelectorAll('[data-open-ticket],[data-mobile-target=builder]')
    .forEach((el) => el.setAttribute('aria-expanded', String(show)));
  if (show) {
    if (!wasOpen) drawerReturnFocus = document.activeElement;
    builder.setAttribute('role', 'dialog');
    builder.setAttribute('aria-modal', 'true');
    builder.setAttribute('aria-labelledby', 'ticket-tab');
    if (!wasOpen) $('#close-builder').focus({ preventScroll: true });
  } else {
    builder.removeAttribute?.('role');
    builder.removeAttribute?.('aria-modal');
    if (wasOpen) drawerReturnFocus?.focus?.({ preventScroll: true });
  }
}
globalThis.addEventListener?.('keydown', (event) => {
  if (
    event.key !== 'Tab' ||
    !document.body?.classList.contains('ticket-drawer-open') ||
    document.querySelector('dialog[open]') ||
    !$('#rejoindre').hidden
  )
    return;
  const buttons = [
      ...document.querySelectorAll(
        '#builder button:not(:disabled),#builder input:not(:disabled),#builder select:not(:disabled)'
      )
    ].filter((el) => el.getClientRects().length),
    first = buttons[0],
    last = buttons.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
});
$('#reset-match-filters')?.addEventListener('click', () => {
  state.revealed.clear();
  state.selectedLeagues = [];
  state.filter = 'Tous';
  rememberCalendarContext();
  renderDateNavigator();
  renderFilters();
  renderMatches();
});
// Scores en direct : scoreboard daté, veille en secours, puis résumé du match. Interrogation toutes les 20 s.
function liveCandidates() {
  const now = Date.now();
  return allMatches().filter(
    (m) =>
      !m.completed &&
      String(m.id).startsWith('espn-') &&
      LEAGUES[m.league]?.[4] &&
      inLiveWindow(kickoffAt(m), now)
  );
}
function recordLiveEntry(match, entry) {
  const update = applyLiveSnapshot(state, match, entry);
  if (update.goal) {
    state.goal = { id: match.id, until: Date.now() + 5000 };
    toast(`But · ${match.home} ${entry.home} : ${entry.away} ${match.away}`);
  }
  return update;
}
function renderLiveUpdates({ changed, finished }) {
  if (finished) {
    const settled = settlePendingBets(state.results);
    render();
    if (settled)
      toast(
        `${settled} pari${settled > 1 ? 's' : ''} réglé${settled > 1 ? 's' : ''} au coup de sifflet final`
      );
  } else if (changed) {
    renderMatches();
    renderHistory();
  } else tickCountdowns();
  details?.refreshLive?.();
}
const liveBackoff = new Map();
let livePoll,
  lastLivePollAt = -Infinity;
function pollLive() {
  if (document.hidden || globalThis.navigator?.onLine === false || livePoll) return;
  const now = Date.now();
  if (now - lastLivePollAt < 20000) return;
  const active = liveCandidates(),
    ids = new Set(active.map((match) => match.id));
  for (const id of liveBackoff.keys()) if (!ids.has(id)) liveBackoff.delete(id);
  const due = active.filter((match) => (liveBackoff.get(match.id)?.retryAt ?? 0) <= now);
  if (due.length) {
    lastLivePollAt = now;
    livePoll = fetchLiveScores(due).finally(() => (livePoll = null));
  }
}
async function fetchLiveScores(candidates) {
  const requests = new Map(),
    json = (path) => {
      if (!requests.has(path))
        requests.set(path, loadJson(`https://site.api.espn.com/apis/${path}`));
      return requests.get(path);
    },
    read = async (match) => {
      const slug = LEAGUES[match.league][4],
        dates = [match.date, previousDate(match.date)];
      for (const date of dates) {
        const data = await json(
            `site/v2/sports/soccer/${slug}/scoreboard?dates=${date.replaceAll('-', '')}`
          ).catch(() => null),
          entry = data && liveEntryFromPayload(data, match.id);
        if (entry) return entry;
      }
      const summary = await json(
        `site/v2/sports/soccer/${slug}/summary?event=${String(match.id).replace('espn-', '')}`
      ).catch(() => null);
      return summary && liveEntryFromPayload(summary, match.id);
    };
  let changed = false,
    finished = 0;
  await Promise.all(
    candidates.map(async (match) => {
      try {
        const entry = await read(match);
        if (!entry) throw new Error('Match ESPN absent');
        liveBackoff.delete(match.id);
        const update = recordLiveEntry(match, entry);
        changed = changed || update.changed;
        finished += update.finished;
      } catch (error) {
        if (!state.liveErrors[match.id]) changed = true;
        const failures = (liveBackoff.get(match.id)?.failures ?? 0) + 1;
        liveBackoff.set(match.id, {
          failures,
          retryAt: Date.now() + 20000 * 2 ** Math.min(failures, 3)
        });
        state.liveErrors[match.id] = Date.now();
        console.warn(`Direct indisponible pour ${match.id}`, error);
      }
    })
  );
  renderLiveUpdates({ changed, finished });
}
function clubTable(rows, options = {}) {
  return renderClubTable(rows, {
    html,
    avatar: avatarOf,
    me: accountUserId,
    division: echelonName,
    ...options
  });
}
// Ma ligue (BET-55) : échelon, groupe, classement, zones de montée et de descente, compte à rebours de la saison.
const divisionBadge = (echelon) =>
  echelon == null
    ? '<span class="div-badge d-new">Placement</span>'
    : `<span class="div-badge d-${divisionIndex(echelon)}" title="${echelonName(echelon)}"><svg class="emblem" viewBox="0 0 32 32" aria-hidden="true"><use href="#emblem-${divisionIndex(echelon)}"/></svg>${echelonName(echelon)}${chevrons(echelon) ? ` <i>${chevrons(echelon)}</i>` : ''}</span>`;
function seasonEnd(season) {
  return new Date(`${seasonDates(season).end}T23:59:59.999+02:00`).getTime() + 1;
}
function roundCountdown() {
  const diff = roundEnd(Date.now()) - Date.now();
  if (diff <= 0) return 'Clôture en cours';
  return `${Math.floor(diff / 864e5)} j ${Math.floor((diff % 864e5) / 36e5)} h`;
}
function seasonCountdown(season) {
  const diff = seasonEnd(season) - Date.now();
  if (diff <= 0) return 'Clôture en cours';
  const days = Math.floor(diff / 864e5),
    hours = Math.floor((diff % 864e5) / 36e5);
  return days ? `${days} j ${hours} h` : `${hours} h ${Math.floor((diff % 36e5) / 6e4)} min`;
}
function renderLeague() {
  const box = $('#my-league');
  if (box) box.hidden = true;
}
// Écran de fin de saison : affiché une seule fois (PROMU, MAINTENU ou RELEGUE) avec les emblèmes avant et après et les déblocages.
function showSeasonResult() {
  // BET-338 : les annonces de classement sont retirées.
}
$('#season-close')?.addEventListener('click', () => {
  const season = state.league?.result?.season;
  $('#season-dialog').close();
  if (season) {
    state.league.result = null;
    accountApi?.markSeasonSeen(season);
  }
});
// Ligues spéciales (BET-56) : « Mes ligues », catalogue, page d'une ligue avec classement et grille de la journée.
const specialLogo = (league) =>
  league.kind === 'club'
    ? `https://a.espncdn.com/i/teamlogos/soccer/500/${league.team_id}.png?h=96&w=96`
    : leagueLogoUrl(league.league_label);
const leagueWatermark = (league) => {
  const src = safeLogo(specialLogo(league));
  return src
    ? `<span class="league-watermark" aria-hidden="true"><img src="${html(src)}" alt="" loading="lazy" data-image-fallback="remove"></span>`
    : '';
};
const specialSubmitting = new Set();
const MARKET_SHORT = { home: '1', draw: 'N', away: '2', over: '+2,5', btts: 'BTTS' };
const specialRounds = (id) =>
    (state.special?.rounds ?? []).filter((round) => round.league_id === id),
  specialPicks = (id) => (state.special?.picks ?? []).filter((pick) => pick.league_id === id);
const currentRound = (id) =>
  specialRounds(id).find((round) => new Date(round.ends_at) > Date.now());
function renderSpecial() {
  if (activeTab !== 'community') return;
  const mineBox = $('#my-leagues'),
    catalog = $('#league-catalog'),
    data = state.special;
  if (!mineBox || !catalog) return;
  mineBox.hidden = catalog.hidden = !data;
  if (!data) return;
  mineBox.hidden = true;
  const selector = $('#club-league-select');
  if (selector) {
    const selected = selector.value || 'general';
    selector.innerHTML =
      '<option value="general">Tous les joueurs</option><option value="group">Mon groupe</option>' +
      data.leagues
        .filter((league) => league.access === 'free' || data.mine.includes(league.id))
        .map((league) => `<option value="${html(league.id)}">${html(league.name)}</option>`)
        .join('');
    selector.value = [...selector.options].some((option) => option.value === selected)
      ? selected
      : 'general';
  }
  catalog.hidden = !data.leagues.some(
    (league) => league.access === 'premium' && !data.mine.includes(league.id)
  );
  catalog.innerHTML = `<div class="league-catalog-head"><strong>Ligues premium</strong><small>Participation automatique aux compétitions gratuites · vos pronostics éligibles comptent sans inscription</small></div><div class="league-catalog-list">${data.leagues
    .filter((league) => league.access === 'premium' && !data.mine.includes(league.id))
    .map((league) => {
      const automatic = league.kind === 'competition' && league.access === 'free',
        joined = automatic || data.mine.includes(league.id);
      return `<div class="league-line">${logoTag('league-logo', specialLogo(league), league.name)}<span><strong>${html(league.name)}</strong><small>${league.kind === 'club' ? 'Ligue club' : 'Compétition'} · ${data.counts[league.id] ?? 0} membre${(data.counts[league.id] ?? 0) > 1 ? 's' : ''}</small></span><button class="button secondary" ${joined ? `data-open-league="${html(league.id)}"` : ''} ${joined ? '' : `data-join-league="${html(league.id)}"`}>${joined ? 'Voir la ligue' : 'Rejoindre'}</button>${joined && !automatic ? `<button class="text-button" data-leave-league="${html(league.id)}">Quitter</button>` : ''}</div>`;
    })
    .join('')}</div>`;
}
async function openSpecialLeague(id) {
  // BET-333 : parcours retiré ; conserver les historiques côté serveur.
}
let specialRankingRequest = 0;
async function loadSpecialStandings(id, scope) {
  const request = ++specialRankingRequest,
    box = $('#special-standings');
  try {
    const rows = await accountApi.leagueStandings(id, scope);
    if (
      request !== specialRankingRequest ||
      !box.isConnected ||
      $('#special-dialog').dataset.league !== id
    )
      return;
    box.innerHTML = rows.length
      ? clubTable(rows)
      : '<p class="empty">Le classement apparaîtra après les premiers pronos réglés.</p>';
  } catch (error) {
    if (
      request === specialRankingRequest &&
      box.isConnected &&
      $('#special-dialog').dataset.league === id
    )
      box.innerHTML = `<p class="empty">${html(error.message)}</p>`;
  }
}
async function specialAction(action, failure = 'Action impossible') {
  if (!accountAuthenticated) {
    openJoin('login');
    toast('Connectez-vous pour rejoindre une ligue');
    return;
  }
  try {
    await action();
  } catch (error) {
    toast(error.message || failure);
  }
}
$('#league-catalog')?.addEventListener('click', (e) => {
  const join = e.target.closest('[data-join-league]'),
    leave = e.target.closest('[data-leave-league]'),
    open = e.target.closest('[data-open-league]');
  if (join) {
    join.disabled = true;
    specialAction(async () => {
      try {
        await accountApi.joinLeague(join.dataset.joinLeague);
        toast('Ligue rejointe : retrouvez-la dans Mes ligues');
      } finally {
        if (join.isConnected) join.disabled = false;
      }
    });
  } else if (leave) {
    const name = state.special.leagues.find((item) => item.id === leave.dataset.leaveLeague)?.name;
    if (
      confirm(
        `Quitter ${name} ? Vous perdrez vos points de cette ligue et ne pourrez changer de ligue qu’une fois par mois.`
      )
    )
      specialAction(async () => {
        await accountApi.leaveLeague(leave.dataset.leaveLeague);
        toast('Ligue quittée');
      });
  } else if (open) openSpecialLeague(open.dataset.openLeague);
});
$('#my-leagues')?.addEventListener('click', (e) => {
  const open = e.target.closest('[data-open-league]');
  if (open) openSpecialLeague(open.dataset.openLeague);
});
$('#special-dialog')?.addEventListener('click', (e) => {
  const scope = e.target.closest('[data-scope]');
  if (scope) {
    document
      .querySelectorAll('#special-scope button')
      .forEach((button) => button.classList.toggle('active', button === scope));
    loadSpecialStandings($('#special-dialog').dataset.league, scope.dataset.scope);
    return;
  }
  const pick = e.target.closest('[data-special-key]');
  if (!pick) return;
  const { specialLeague: league, specialMatch: match, specialKey: key } = pick.dataset,
    job = league + ':' + match;
  if (specialSubmitting.has(job)) return;
  specialAction(async () => {
    specialSubmitting.add(job);
    openSpecialLeague(league);
    try {
      const mine = specialPicks(league).find(
        (item) =>
          item.round_id === currentRound(league)?.id &&
          item.match_ids.includes(match) &&
          item.key === key &&
          item.source === 'grid' &&
          item.status === 'pending'
      );
      if (mine) await accountApi.clearSpecialPick(league, match);
      else await accountApi.playSpecialPick(league, match, key);
      toast(mine ? 'Prono retiré de la grille' : 'Prono enregistré dans la grille');
    } finally {
      specialSubmitting.delete(job);
      if ($('#special-dialog').open && $('#special-dialog').dataset.league === league) {
        openSpecialLeague(league);
        $('#special-content')
          .querySelector(
            `[data-special-match="${CSS.escape(match)}"][data-special-key="${CSS.escape(key)}"]`
          )
          ?.focus({ preventScroll: true });
      }
    }
  });
});
// Sur le ticket : liste des ligues dans lesquelles le pari compte (ligue générale et ligues spéciales du joueur).
function renderLeagueList() {
  const box = $('#league-list');
  if (box) box.hidden = true;
}
// Niveau, titre et XP (BET-57) : prestige seul, aucun avantage. Notification « +15 XP · prono gagné » pour les événements nouveaux.
const XP_LABELS = {
  counted: 'prono compté',
  won: 'prono gagné',
  daily: 'défi du jour complet',
  streak: 'série de bons pronos',
  season: 'fin de saison',
  promotion: 'montée',
  champion: 'champion de groupe',
  special: 'ligue spéciale',
  ['special-title']: 'titre de ligue spéciale',
  badge: 'trophée obtenu',
  challenge: 'défi hebdomadaire'
};
const levelInfo = (xp) => {
  const info = levelFromXp(xp);
  return { ...info, title: titleForLevel(info.level) };
};
function renderProgress() {
  if (activeTab !== 'community') return;
  const box = $('#level-box'),
    panel = $('#badges-panel'),
    progress = state.progress;
  if (box) {
    box.hidden = !progress;
    if (progress) {
      const info = levelInfo(progress.xp);
      box.innerHTML = `<span class="level-chip big">${info.level}</span><div><strong>${info.title}</strong><small>${info.next ? `${info.into} / ${info.next} XP vers le niveau ${info.level + 1}` : 'Niveau maximum'}</small><span class="level-bar"><i style="width:${Math.round(info.progress * 100)}%"></i></span></div>`;
    }
  }
  const summary = $('#club-progress-summary');
  if (summary)
    summary.innerHTML = progress
      ? `<strong>${progress.badges.length} trophée${progress.badges.length > 1 ? 's' : ''} obtenu${progress.badges.length > 1 ? 's' : ''}</strong><small>Niveau ${levelInfo(progress.xp).level} · ${Number(progress.xp).toLocaleString('fr-FR')} XP</small><span class="level-bar" role="progressbar" aria-label="Progression vers le prochain niveau" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(levelInfo(progress.xp).progress * 100)}"><i style="width:${Math.round(levelInfo(progress.xp).progress * 100)}%"></i></span>`
      : '<p>Connectez-vous pour suivre votre progression.</p>';
  if (panel) {
    panel.hidden = false;
    if (!progress)
      panel.innerHTML =
        '<p class="empty">Connectez-vous pour retrouver vos trophées et leur progression.</p>';
    if (progress)
      panel.innerHTML = `<div class="badges-head"><strong>Trophées</strong><small>${progress.badges.length} sur ${BADGES.length} obtenus · de l’XP à chaque trophée</small></div><div class="badge-grid">${BADGES.map((badge) => `<div class="badge${progress.badges.includes(badge.id) ? ' earned' : ''}" title="${html(badge.hint)}"><b>${html(badge.name)}</b><small>${html(badge.hint)}</small><em>+${badge.xp} XP</em></div>`).join('')}</div>`;
  }
}
function announceXp(progress) {
  let seen = '';
  try {
    seen = localStorage.getItem('betmaster-xp-seen') || '';
  } catch {}
  const fresh = progress.events.filter((event) => event.created_at > seen);
  if (progress.events[0]) {
    try {
      localStorage.setItem('betmaster-xp-seen', progress.events[0].created_at);
    } catch {}
  }
  if (!seen || !fresh.length) return;
  const best = fresh.slice().sort((a, b) => b.xp - a.xp)[0],
    more = fresh.length - 1;
  toast(
    `+${best.xp} XP · ${XP_LABELS[best.kind] ?? 'récompense'}${more ? ` (+${more} autre${more > 1 ? 's' : ''})` : ''}`
  );
}
// Célébration automatique (BET-163) : une fois par prono gagné (marque locale par joueur), image de l'avatar et effet équipé, sans Three.js ; la célébration 3D attend la prochaine ouverture du profil.
function celebrateWins(progress) {
  const key = `${CELEBRATION_SEEN_KEY}:${accountUserId ?? ''}`;
  let seen = '';
  try {
    seen = localStorage.getItem(key) || '';
  } catch {}
  const due = celebrationDue(progress.events, seen);
  try {
    localStorage.setItem(key, due.mark);
  } catch {}
  if (!due.celebrate) return;
  try {
    localStorage.setItem(`${CELEBRATION_PENDING_KEY}:${accountUserId ?? ''}`, '1');
  } catch {}
  const message = due.count > 1 ? `${due.count} pronos gagnés : bravo !` : 'Prono gagné : bravo !';
  if (typeof matchMedia !== 'function' || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    toast(message);
    return;
  }
  const config = state.profile.avatar2;
  import('./src/club/victory-effects.js')
    .then(({ showVictory }) =>
      showVictory({
        avatar: avatarMarkup(
          { avatar_config: config ?? state.profile },
          { cls: 'avatar-3d', kind: 'bust', userId: accountUserId }
        ),
        effect: equippedOf(progress.equipped, 'effect'),
        sound: soundEnabled(state.profile) ? equippedOf(progress.equipped, 'sound') : null,
        colors: celebrationColors(config),
        count: due.count
      })
    )
    .catch(() => toast(message));
}
// Ligues privées (BET-61) : créer, rejoindre avec un code BM-XXXX ou un lien, classement des amis avec les points de la ligue générale.
// Hub communauté (BET-60) : onglets, classement général paginé côté serveur, podium, suivis, fil d'activité, hall of fame.
const COMMUNITY_TABS = ['league', 'general', 'follows', 'private', 'challenges', 'fame'];
function setCommunityTab(tab) {
  return; // BET-338 : classements et communauté retirés.
  if (tab === 'general' || tab === 'private') tab = 'league';
  if (tab === 'fame') tab = 'challenges';
  if (!COMMUNITY_TABS.includes(tab)) tab = 'league';
  state.community.tab = tab;
  if (activeTab === 'community' && tab === 'challenges') {
    attention?.clear('rewards');
    renderAttention();
  }
  try {
    localStorage.setItem('betmaster-community-tab', tab);
  } catch {}
  document
    .querySelectorAll('[data-ctab]')
    .forEach((button) => button.setAttribute('aria-selected', String(button.dataset.ctab === tab)));
  document.querySelectorAll('[data-cpanel]').forEach((panel) => {
    panel.hidden = panel.dataset.cpanel !== tab;
  });
  const description = $('#club-section-description');
  if (description)
    description.textContent = {
      league: UI_COPY.communityLeague,
      general: UI_COPY.communityGeneral,
      follows: UI_COPY.communityFollows,
      private: UI_COPY.communityPrivate,
      challenges: UI_COPY.communityChallenges,
      fame: UI_COPY.communityFame
    }[tab];
  if (tab === 'league') {
    defaultClubRanking();
    selectClubLeague();
  } else if (tab === 'follows') {
    loadFollowsPanel();
    markFeedSeen();
  } else if (tab === 'challenges') {
    renderProgress();
    loadFame();
  }
}
function selectClubLeague() {
  // BET-338 : ne plus charger les classements retirés.
}
let clubRankingRequest = 0,
  clubRankingChosen = false;
function defaultClubRanking() {
  const selector = $('#club-league-select');
  if (selector) selector.value = 'general';
}
async function loadClubStandings(id, scope) {
  const request = ++clubRankingRequest,
    box = $('#club-special-ranking');
  if (!box) return;
  box.innerHTML = '<p class="empty">Chargement du classement…</p>';
  try {
    const rows = await accountApi.leagueStandings(id, scope);
    if (request !== clubRankingRequest || $('#club-league-select').value !== id) return;
    const own = state.special?.standings.find((row) => row.league_id === id && row.scope === scope);
    box.innerHTML =
      (own
        ? `<p class="league-race">Votre place : ${own.confirmed === false ? `Provisoire · ${own.decided}/10 résultats décidés` : Number(own.rank)} · ${decimal(Number(own.points), 1)} points</p>`
        : '') +
      (rows.length
        ? clubTable(rows)
        : '<p class="empty">Aucun pronostic réglé pour cette période. Votre premier prono éligible lancera la course.</p>');
  } catch (error) {
    if (request === clubRankingRequest && $('#club-league-select').value === id)
      box.innerHTML = `<p class="empty">${html(error.message)} <button class="text-button" data-club-retry="${html(scope)}">Réessayer</button></p>`;
  }
}
$('#club-league-select')?.addEventListener('change', () => {
  clubRankingChosen = true;
  selectClubLeague();
});
$('#club-competition')?.addEventListener('click', (e) => {
  const leave = e.target.closest('[data-club-leave]');
  if (leave) {
    if (
      confirm(
        'Quitter cette ligue premium ? Ses points seront perdus. Un seul changement par mois.'
      )
    )
      specialAction(async () => {
        await accountApi.leaveLeague(leave.dataset.clubLeave);
        selectClubLeague();
        toast('Ligue quittée');
      });
    return;
  }
  const open = e.target.closest('[data-open-league]'),
    scope = e.target.closest('[data-club-scope]'),
    retry = e.target.closest('[data-club-retry]');
  if (open) openSpecialLeague(open.dataset.openLeague);
  if (scope || retry) {
    const value = scope?.dataset.clubScope ?? retry.dataset.clubRetry;
    document
      .querySelectorAll('[data-club-scope]')
      .forEach((button) => button.classList.toggle('active', button.dataset.clubScope === value));
    loadClubStandings($('#club-league-select').value, value);
  }
});
let generalRequest = 0;
async function loadGeneral() {
  const c = state.community,
    request = ++generalRequest;
  if (!accountApi) return;
  c.general = { ...(c.general ?? {}), loading: true };
  renderGeneral();
  try {
    const [ranking, podium] = await Promise.all([
      accountApi.community.ranking({
        scope: c.scope,
        division: c.division,
        club: c.club,
        search: c.search.trim(),
        page: c.page,
        sort: c.sort
      }),
      c.podium ? Promise.resolve(c.podium) : accountApi.community.podium()
    ]);
    if (request !== generalRequest) return;
    c.general = { ...ranking, loading: false };
    c.podium = podium;
  } catch (error) {
    if (request !== generalRequest) return;
    c.general = { error: error.message, rows: [], total: 0, loading: false };
  }
  renderGeneral();
}
function renderGeneral() {
  const c = state.community,
    g = c.general,
    list = $('#general-list');
  if (!list) return;
  const clubs = new Map(
    state.communityProfiles
      .filter((profile) => profile.heart_club_id)
      .map((profile) => [profile.heart_club_id, profile.heart_club_name])
  );
  const select = $('#general-club');
  if (select && select.options.length <= clubs.size) {
    select.innerHTML =
      '<option value="">Tous</option>' +
      [...clubs]
        .sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'fr'))
        .map(([id, name]) => `<option value="${html(id)}">${html(name)}</option>`)
        .join('');
    select.value = c.club;
  }
  document.querySelectorAll('#general-scope [data-scope]').forEach((button) => {
    button.classList.toggle('active', button.dataset.scope === c.scope);
    button.setAttribute('aria-pressed', String(button.dataset.scope === c.scope));
  });
  const podium = $('#podium'),
    top = c.podium;
  podium.hidden =
    !top?.rows?.length ||
    c.scope !== 'season' ||
    c.sort !== 'points' ||
    !!c.division ||
    !!c.club ||
    !!c.search;
  if (top?.rows?.length) {
    const medals = [2, 1, 3];
    podium.innerHTML = `<p class="eyebrow">PODIUM DE LA SAISON</p><h3>${html(echelonName(top.echelon))}</h3><div class="podium-row">${medals
      .map((rank) => top.rows[rank - 1])
      .filter(Boolean)
      .map((row) => {
        const config = avatarConfig(row.avatar_config ?? row),
          rank = top.rows.indexOf(row) + 1;
        return `<button class="podium-step p${rank}" data-profile-nick="${html(row.nickname)}">${avatarOf(row, 'mini-avatar big')}<strong>${html(row.nickname)}</strong><small>${decimal(Number(row.points), 1)} pts</small><b>${rank}</b></button>`;
      })
      .join('')}</div>`;
  }
  const status = $('#general-status'),
    criteria = $('#general-criteria');
  if (criteria)
    criteria.textContent = [
      c.scope === 'alltime' ? 'Depuis le début' : 'Saison en cours',
      `Tri : ${{ points: 'points', roi: 'rendement (ROI)', wins: 'pronostics gagnés' }[c.sort]} décroissants`,
      $('#general-division')?.selectedOptions?.[0]?.textContent ?? 'Toutes les divisions',
      $('#general-club')?.selectedOptions?.[0]?.textContent ?? 'Tous les clubs',
      c.search ? `Pseudo : ${c.search}` : ''
    ]
      .filter(Boolean)
      .join(' · ');
  list.setAttribute('aria-busy', String(!!g?.loading));
  if (!accountApi || (g?.loading && !g.rows)) {
    status.textContent = 'Chargement du classement…';
    list.innerHTML = '';
    return;
  }
  if (g?.error) {
    status.innerHTML = `${html(g.error)} <button class="text-button" id="general-retry">Réessayer</button>`;
    list.innerHTML = '';
    return;
  }
  const rows = g?.rows ?? [],
    pages = Math.max(1, Math.ceil((g?.total ?? 0) / (g?.pageSize ?? 25)));
  status.textContent = g?.total
    ? `${g.total} joueur${g.total > 1 ? 's' : ''} · points de la ligue générale (${c.scope === 'alltime' ? 'tous les temps' : 'saison en cours'})`
    : 'Aucun joueur ne correspond à ces filtres.';
  if (g?.me)
    status.textContent += ` · Votre place au classement ${c.scope === 'alltime' ? 'historique' : 'de la saison'} : ${g.me.confirmed === false ? `Provisoire (${g.me.decided}/10)` : g.me.rank} · ${decimal(Number(g.me.points), 1)} pts`;
  list.innerHTML = g?.loading
    ? '<p class="empty">Actualisation du classement…</p>'
    : rows.length
      ? clubTable(rows, { sort: c.sort })
      : '';
  $('#general-page').textContent = `Page ${c.page} / ${pages}`;
  $('#general-prev').disabled = c.page <= 1;
  $('#general-next').disabled = c.page >= pages;
}
async function loadFollowsPanel() {
  const box = $('#follows-panel');
  if (!accountAuthenticated) {
    box.innerHTML =
      '<p class="empty">Connectez-vous pour suivre des joueurs et voir leur activité.</p><button class="button secondary" data-open-join>Se connecter</button>';
    return;
  }
  box.innerHTML = '<p class="empty">Chargement…</p>';
  try {
    state.community.follows = await accountApi.community.follows();
    renderFollows();
  } catch (error) {
    box.innerHTML = `<p class="empty">${html(error.message)}</p>`;
  }
}
function renderFollows() {
  const box = $('#follows-panel'),
    data = state.community.follows;
  if (!box || !data) return;
  const mine = state.communityProfiles.find(
      (profile) => profile.nickname === state.profile.nickname
    ),
    me = {
      user_id: mine?.user_id,
      echelon: state.league?.echelon ?? null,
      heart_club_id: mine?.heart_club_id ?? state.profile.heartClub?.id ?? null
    };
  const candidates = state.communityProfiles.map((profile) => ({
      ...profile,
      echelon: data.echelons[profile.user_id] ?? null
    })),
    suggestions = suggestPlayers(candidates, me, state.followIds, 6);
  const person = (profile) => avatarOf(profile);
  box.innerHTML = `<div class="follows-grid"><div><h3>Joueurs suivis <small>${data.following.length}</small></h3>${data.following.length ? data.following.map((profile) => `<div class="follow-line">${person(profile)}<button class="text-button" data-profile-nick="${html(profile.nickname)}">${html(profile.nickname)}</button><button class="text-button danger-text" data-unfollow="${html(profile.user_id)}">Ne plus suivre</button></div>`).join('') : '<p class="empty">Vous ne suivez personne pour le moment.</p>'}<h3>Suggestions <small>même division ou même club de cœur</small></h3>${suggestions.length ? suggestions.map((profile) => `<div class="follow-line">${person(profile)}<button class="text-button" data-profile-nick="${html(profile.nickname)}">${html(profile.nickname)}</button><small>${profile.echelon == null ? '' : html(echelonName(profile.echelon))}</small><button class="button secondary" data-follow-user="${html(profile.user_id)}">Suivre</button></div>`).join('') : '<p class="empty">Pas de suggestion pour le moment.</p>'}</div><div><h3>Fil d’activité</h3>${data.activities.length ? `<ul class="feed">${data.activities.map((item) => `<li><span>${html(activityText(item.kind, item.payload, item.nickname))}</span><small>${new Date(item.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</small></li>`).join('')}</ul>` : '<p class="empty">Le fil affiche les temps forts des joueurs que vous suivez : combinés gagnés, montées, titres, trophées. Jamais de mise ni de bankroll.</p>'}</div></div>`;
}
async function loadFame() {
  const box = $('#fame-panel');
  if (!accountApi) return;
  box.innerHTML = '<p class="empty">Chargement…</p>';
  try {
    const hall = await accountApi.community.hall();
    state.community.hall = hall;
    const line = (left, right, nick) =>
      `<li><b>${html(left)}</b><button class="text-button" data-profile-nick="${html(nick)}">${html(nick)}</button><small>${html(right)}</small></li>`;
    box.innerHTML = `<div class="fame-grid"><div><h3>Champions du Master</h3>${hall.masters.length ? `<ul class="fame-list">${hall.masters.map((row) => line(row.season, `${decimal(Number(row.points), 1)} pts`, row.nickname)).join('')}</ul>` : '<p class="empty">Les champions apparaîtront après la première saison.</p>'}</div><div><h3>Champions des ligues spéciales</h3>${hall.specials.length ? `<ul class="fame-list">${hall.specials.map((row) => line(row.league_name, row.season, row.nickname)).join('')}</ul>` : '<p class="empty">Aucun titre décerné pour le moment.</p>'}</div></div>`;
  } catch (error) {
    box.innerHTML = `<p class="empty">${html(error.message)} <button class="text-button" data-fame-retry>Réessayer</button></p>`;
  }
}
$('#fame-panel')?.addEventListener('click', (e) => {
  if (e.target.closest('[data-fame-retry]')) loadFame();
});
// Notification : pastille sur l'onglet Communauté (et la barre du bas) quand le fil a du nouveau.
async function refreshFeedDot() {
  if (!accountAuthenticated || !accountApi) return setFeedDot(0);
  let seen = null;
  try {
    seen = localStorage.getItem('betmaster-feed-seen');
  } catch {}
  if (!seen) {
    markFeedSeen();
    return;
  }
  try {
    setFeedDot(await accountApi.community.unread(seen));
  } catch {
    setFeedDot(0);
  }
}
const setFeedDot = (count) => {
  for (const id of ['feed-dot', 'feed-dot-mobile']) {
    const dot = $(`#${id}`);
    if (dot) {
      dot.hidden = !count;
      if (id === 'feed-dot-mobile') dot.textContent = count > 9 ? '9+' : String(count);
    }
  }
};
function markFeedSeen() {
  try {
    localStorage.setItem('betmaster-feed-seen', new Date().toISOString());
  } catch {}
  setFeedDot(0);
}
$('#community-tabs')?.addEventListener('click', (e) => {
  const button = e.target.closest('[data-ctab]');
  if (button) setCommunityTab(button.dataset.ctab);
});
$('#general-sort')?.addEventListener('change', (e) => {
  state.community.sort = e.target.value;
  state.community.page = 1;
  loadGeneral();
});
$('#general-scope')?.addEventListener('click', (e) => {
  const button = e.target.closest('[data-scope]');
  if (!button) return;
  state.community.scope = button.dataset.scope;
  state.community.page = 1;
  loadGeneral();
});
$('#general-division')?.addEventListener('change', (e) => {
  state.community.division = e.target.value;
  state.community.page = 1;
  loadGeneral();
});
$('#general-club')?.addEventListener('change', (e) => {
  state.community.club = e.target.value;
  state.community.page = 1;
  loadGeneral();
});
let generalTimer = null;
$('#general-search')?.addEventListener('input', (e) => {
  state.community.search = e.target.value;
  state.community.page = 1;
  clearTimeout(generalTimer);
  generalTimer = setTimeout(loadGeneral, 350);
});
$('#general-prev')?.addEventListener('click', () => {
  if (state.community.page > 1) {
    state.community.page--;
    loadGeneral();
  }
});
$('#general-next')?.addEventListener('click', () => {
  state.community.page++;
  loadGeneral();
});
const openPlayer = (nickname) =>
  setActiveTab('profile', true, {
    nickname,
    self: Boolean(accountAuthenticated && nickname === state.profile.nickname)
  });
$('#community')?.addEventListener('click', async (e) => {
  const nick = e.target.closest('[data-profile-nick]');
  if (nick) {
    openPlayer(nick.dataset.profileNick);
    return;
  }
  if (e.target.closest('#general-retry')) {
    loadGeneral();
    return;
  }
  if (e.target.closest('[data-open-join]')) {
    openJoin('login');
    return;
  }
  const follow = e.target.closest('[data-follow-user]'),
    unfollow = e.target.closest('[data-unfollow]');
  if (follow || unfollow) {
    try {
      if (follow) await accountApi.community.follow(follow.dataset.followUser);
      else await accountApi.community.unfollow(unfollow.dataset.unfollow);
      toast(follow ? 'Joueur suivi' : 'Vous ne suivez plus ce joueur');
      loadFollowsPanel();
    } catch (error) {
      toast(error.message);
    }
  }
});
let invitationStorage = null;
try {
  invitationStorage = sessionStorage;
} catch {}
let pendingInvitation = parseInvitation(location.href) ?? readInvitation(invitationStorage);
if (parseInvitation(location.href)) {
  const saved = readInvitation(invitationStorage);
  if (saved?.code === pendingInvitation.code)
    pendingInvitation = {
      ...pendingInvitation,
      preview: pendingInvitation.preview ?? saved.preview,
      autoJoin: saved.autoJoin
    };
  saveInvitation(
    invitationStorage,
    pendingInvitation,
    pendingInvitation.autoJoin,
    saved?.code === pendingInvitation.code ? saved.createdAt : Date.now()
  );
}
let pendingPrivateCode = pendingInvitation?.code ?? null;
let inviteJoining = false;
function showPrivateInvitation(message = '') {
  // BET-333 : parcours retiré ; conserver les historiques côté serveur.
}
function clearPrivateInvitation() {
  pendingPrivateCode = null;
  pendingInvitation = null;
  try {
    invitationStorage?.removeItem(INVITATION_KEY);
  } catch {}
  const url = new URL(location.href);
  url.searchParams.delete('invitation');
  if (url.hash.startsWith('#ligue-privee-') || /access_token=|refresh_token=/.test(url.hash))
    url.hash = '#communaute';
  history.replaceState(null, '', url);
}
$('#private-dialog')?.addEventListener('submit', async (e) => {
  if (!e.target.matches('[data-invitation-email]')) return;
  e.preventDefault();
  if (!e.target.reportValidity()) return;
  const button = e.target.querySelector('button');
  button.disabled = true;
  try {
    if (!accountApi?.auth?.magicInvite) throw new Error('La connexion par email est indisponible.');
    saveInvitation(invitationStorage, pendingInvitation, true);
    pendingInvitation.autoJoin = true;
    await accountApi.auth.magicInvite(
      String(new FormData(e.target).get('email')).trim(),
      pendingPrivateCode
    );
    showPrivateInvitation(
      'Si l’adresse peut être utilisée, un lien de connexion arrive par email. Ouvrez-le pour continuer. Vérifiez aussi les indésirables.'
    );
  } catch (error) {
    if (pendingInvitation) {
      pendingInvitation.autoJoin = false;
      saveInvitation(invitationStorage, pendingInvitation, false);
      showPrivateInvitation(error.message);
    }
  }
});
$('#private-dialog')?.addEventListener('click', (e) => {
  if (e.target.closest('[data-cancel-invitation]')) {
    clearPrivateInvitation();
    $('#private-dialog').close();
  }
  if (e.target.closest('[data-accept-invitation]')) {
    pendingInvitation.autoJoin = true;
    saveInvitation(invitationStorage, pendingInvitation, true);
    offerPrivateJoin();
  }
});
function renderPrivate() {
  const box = $('#private-leagues');
  if (box) box.hidden = true;
}
async function openPrivateLeague(id, season = null) {
  // BET-333 : parcours retiré ; conserver les historiques côté serveur.
}
async function privateAction(action, done) {
  if (!accountAuthenticated) {
    openJoin('login');
    return;
  }
  try {
    const result = await action();
    if (done) toast(done);
  } catch (error) {
    toast(error.message);
  }
}
async function offerPrivateJoin() {
  // BET-333 : parcours retiré ; conserver les historiques côté serveur.
}
$('#private-leagues')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target.closest('[data-private-form]'),
    values = Object.fromEntries(new FormData(form));
  if (form.dataset.privateForm === 'create') {
    if (!validLeagueName(values.name)) {
      toast('Le nom compte 3 à 30 caractères');
      return;
    }
    privateAction(async () => {
      const league = await accountApi.privateLeagues.create(
        String(values.name).trim(),
        values.emblem
      );
      form.reset();
      toast('Ligue créée : partagez le code pour inviter vos amis');
      setTimeout(() => openPrivateLeague(league.id), 100);
    });
  } else {
    const code = normalizeCode(values.code);
    if (!code) {
      toast('Le code a le format BM-XXXXXXXX (anciens codes BM-XXXX acceptés)');
      return;
    }
    privateAction(async () => {
      const league = await accountApi.privateLeagues.join(code);
      form.reset();
      toast('Ligue rejointe');
      setTimeout(() => openPrivateLeague(league.id), 100);
    });
  }
});
$('#private-leagues')?.addEventListener('click', (e) => {
  const open = e.target.closest('[data-private-open]');
  if (open) openPrivateLeague(open.dataset.privateOpen);
});
$('#private-dialog')?.addEventListener('click', async (e) => {
  const dialog = $('#private-dialog'),
    id = dialog.dataset.league,
    copy = e.target.closest('[data-copy-code],[data-copy-link]');
  if (e.target.closest('[data-share-invitation]')) {
    const league = state.private?.leagues.find((l) => l.id === id);
    if (!league) return;
    const preview = dialog.__invitePreview;
    try {
      const url = invitationLink(league.code, preview, location.origin + location.pathname);
      const result = await shareVisualCard(invitationCard(preview), url);
      if (result === 'downloaded')
        toast('Image téléchargée. Le bouton Copier le lien fournit l’invitation.');
    } catch {
      toast('Partage indisponible, utilisez Copier le lien.');
    }
    return;
  }

  if (copy) {
    const text =
      copy.dataset.copyCode ??
      invitationLink(
        copy.dataset.copyLink,
        dialog.__invitePreview,
        location.origin + location.pathname
      );
    try {
      await navigator.clipboard.writeText(text);
      toast(copy.dataset.copyCode ? 'Code copié' : 'Lien copié');
    } catch {
      toast(text);
    }
    return;
  }
  if (e.target.closest('[data-private-regen]')) {
    if (confirm('Générer un nouveau code ? L’ancien code ne fonctionnera plus.'))
      privateAction(async () => {
        await accountApi.privateLeagues.regenerate(id);
        openPrivateLeague(id);
      }, 'Nouveau code généré');
    return;
  }
  if (e.target.closest('[data-private-delete]')) {
    if (confirm('Supprimer définitivement cette ligue pour tous ses membres ?'))
      privateAction(async () => {
        await accountApi.privateLeagues.remove(id);
        dialog.close();
      }, 'Ligue supprimée');
    return;
  }
  if (e.target.closest('[data-private-leave]')) {
    if (confirm('Quitter cette ligue ?'))
      privateAction(async () => {
        await accountApi.privateLeagues.leave(id);
        dialog.close();
      }, 'Vous avez quitté la ligue');
    return;
  }
  const kick = e.target.closest('[data-private-kick]');
  if (kick && confirm('Exclure ce membre de la ligue ?'))
    privateAction(async () => {
      await accountApi.privateLeagues.kick(id, kick.dataset.privateKick);
      openPrivateLeague(id);
    }, 'Membre exclu');
});
$('#private-dialog')?.addEventListener('change', (e) => {
  const select = e.target.closest('[data-private-season]');
  if (select) openPrivateLeague($('#private-dialog').dataset.league, select.value);
});
function renderActiveTab() {
  if (activeTab === 'matches') {
    renderDateNavigator();
    renderFilters();
    renderMatches();
    renderConfidenceKpi();
  } else if (activeTab === 'community') {
    defaultClubRanking();
    renderProgress();
    renderPrivate();
    renderSpecial();
    renderLeague();
    renderCommunity();
  } else if (activeTab === 'bankroll') {
    renderHistory();
    renderPerformance();
  } else if (activeTab === 'predictions') renderPredictionStats();
}
function render() {
  renderActiveTab();
  renderTicket();
  updateStats();
}
$('#next-match-day')?.addEventListener('click', (event) => {
  const date = event.currentTarget.dataset.nextDate;
  document.querySelector(`[data-date="${date}"]`)?.click();
  document.querySelector(`[data-date="${date}"]`)?.focus();
});
$('#date-navigator').addEventListener('click', (e) => {
  const b = e.target.closest('[data-date]');
  if (!b) return;
  if (state.dateFilter !== b.dataset.date) visibleWeekLimit = WEEK_MATCH_BATCH;
  state.dateFilter = chosenCalendarDate = b.dataset.date;
  rememberCalendarContext();
  state.revealed.clear();
  renderDateNavigator();
  renderFilters();
  renderMatches();
  revealActive($('#date-navigator'));
  updateScrollers();
});
$('#next-favorite-match')?.addEventListener('click', (event) => {
  const match = calendarMatches().find((item) => item.id === event.target.dataset.nextFavorite);
  if (!match) return;
  document.querySelector(`[data-date="${match.date}"]`)?.click();
  const card = document.getElementById(`match-${match.id}`);
  card?.scrollIntoView({ block: 'start', behavior: motionBehavior() });
  card?.querySelector('[data-match-stats]')?.focus({ preventScroll: true });
});
$('#match-list-more')?.addEventListener('click', () => {
  const previous = visibleWeekLimit;
  visibleWeekLimit += WEEK_MATCH_BATCH;
  renderMatches();
  const first = $('#match-list')?.children[previous];
  first?.setAttribute('tabindex', '-1');
  first?.focus();
});
function selectLeague(filter) {
  visibleWeekLimit = WEEK_MATCH_BATCH;
  if (filter === 'Favoris') state.filter = state.filter === 'Favoris' ? 'Tous' : 'Favoris';
  else if (filter === 'Tous') state.selectedLeagues = [];
  else
    state.selectedLeagues = state.selectedLeagues.includes(filter)
      ? state.selectedLeagues.filter((name) => name !== filter)
      : [...state.selectedLeagues, filter];
  state.revealed.clear();
  rememberCalendarContext();
  renderFilters();
  renderMatches();
}
if (typeof window !== 'undefined') {
  applyUiCopy(document);
  initHeaderOffset();
  initMetricHelp();
}
$('#filters').addEventListener('click', (e) => {
  const favorite = e.target.closest('[data-favorite-league]');
  if (favorite) {
    const name = favorite.dataset.favoriteLeague;
    state.favoriteLeagues = state.favoriteLeagues.includes(name)
      ? state.favoriteLeagues.filter((item) => item !== name)
      : [...state.favoriteLeagues, name];
    if (state.favoriteLeagues.includes(name)) mobileDiagnostics?.mark('ajout-favori');
    persist();
    renderFilters();
    renderMatches();
    return;
  }
  if (e.target.closest('[data-league-menu]')) {
    leagueDraft = [...state.selectedLeagues];
    renderLeagueMenu();
    $('#league-dialog').showModal();
    return;
  }
  const b = e.target.closest('[data-filter]');
  if (b) selectLeague(b.dataset.filter);
});
$('#competition-options').addEventListener('click', (e) => {
  const b = e.target.closest('[data-filter]');
  if (!b || !leagueDraft) return;
  const league = b.dataset.filter;
  leagueDraft =
    league === 'Tous'
      ? []
      : leagueDraft.includes(league)
        ? leagueDraft.filter((name) => name !== league)
        : [...leagueDraft, league];
  renderLeagueMenu();
  const active = [...document.querySelectorAll('#competition-options [data-filter]')].find(
    (item) => item.dataset.filter === b.dataset.filter
  );
  active?.focus({ preventScroll: true });
});
$('#apply-competitions')?.addEventListener('click', () => {
  if (!leagueDraft) return;
  state.selectedLeagues = leagueDraft;
  rememberCalendarContext();
  leagueDraft = null;
  visibleWeekLimit = WEEK_MATCH_BATCH;
  state.revealed.clear();
  renderFilters();
  renderMatches();
  $('#league-dialog').close();
});
$('#league-dialog')?.addEventListener('close', () => {
  leagueDraft = null;
  $('[data-league-menu]')?.focus({ preventScroll: true });
});
$('#matches')?.addEventListener('click', (event) => {
  if (event.target.closest('[data-retry-matches]')) loadLiveFixtures();
});
$('#match-list').addEventListener('click', (e) => {
  if (e.target.closest('[data-match-model-report]')) {
    setActiveTab('predictions', true, null, 'push');
    return;
  }
  if (e.target.closest('[data-leave-favorites]')) {
    $('#reset-match-filters').click();
    $('#date-navigator').querySelector('.active')?.focus();
    return;
  }
  const form = e.target.closest('[data-team-form]');
  if (form) {
    toast(
      (e.target.closest('[data-form-info]') ?? form.querySelector('[data-form-info]:last-child'))
        .dataset.formInfo
    );
    return;
  }
  if (e.target.closest('[data-reset-matches]')) {
    $('#reset-match-filters').click();
    return;
  }
  const favorite = e.target.closest('[data-favorite-team]');
  if (favorite) {
    e.preventDefault();
    e.stopPropagation();
    const name = favorite.dataset.favoriteTeam;
    state.favoriteTeams = state.favoriteTeams.includes(name)
      ? state.favoriteTeams.filter((item) => item !== name)
      : [...state.favoriteTeams, name];
    if (state.favoriteTeams.includes(name)) mobileDiagnostics?.mark('ajout-favori');
    persist();
    renderFilters();
    renderMatches();
    toast(
      state.favoriteTeams.includes(name)
        ? `${name} ajouté aux favoris`
        : `${name} retiré des favoris`
    );
    return;
  }
  const share = e.target.closest('[data-share-analysis]');
  if (share) {
    const link = new URL(
      '#match-' + share.dataset.shareAnalysis,
      location.origin + location.pathname
    );
    Promise.resolve()
      .then(() => navigator.clipboard.writeText(link.href))
      .then(() => toast('Lien de l’analyse copié.'))
      .catch(() => {
        const dialog = $('#share-analysis-dialog'),
          input = $('#share-analysis-url');
        input.value = link.href;
        if (!dialog.open) dialog.showModal();
        input.focus();
        input.select();
      });
    return;
  }
  const statsShortcut = e.target.closest('[data-match-stats]');
  if (statsShortcut) {
    const panel = statsShortcut.closest('.match-card')?.querySelector('.match-explanation');
    if (panel) {
      if (!panel.open) {
        mobileDiagnostics?.mark('ouverture-analyse');
        syncTrial?.useful('analyse');
      }
      expandedMatchStats.add(statsShortcut.dataset.matchStats + '-resources');
      panel.open = true;
      statsShortcut.setAttribute('aria-expanded', 'true');
      panel.querySelector('summary')?.focus({ preventScroll: true });
      panel.scrollIntoView({
        block: 'start',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
      });
    }
    return;
  }
  const more = e.target.closest('[data-details]');
  if (more) {
    useDetails((api) => {
      const match = allMatches().find((item) => item.id === more.dataset.details);
      if (match) mobileDiagnostics?.mark('ouverture-analyse');
      return api.openMatch(match);
    });
    return;
  }
  const team = e.target.closest('[data-team-id]');
  if (team) {
    useDetails((api) =>
      api.openTeam({
        id: team.dataset.teamId,
        name: team.dataset.teamName,
        logo: team.dataset.teamLogo,
        league: team.dataset.league,
        matchId: team.dataset.teamMatch
      })
    );
    return;
  }
  const confidence = e.target.closest('[data-confidence]');
  if (confidence) {
    showConfidence(allMatches().find((match) => match.id === confidence.dataset.confidence));
    return;
  }
  const b = e.target.closest('[data-market]');
  if (b) {
    addSelection(b.dataset.match, b.dataset.market, b);
  }
});
for (const rail of [$('#match-rail'), $('#match-strip')])
  rail.addEventListener('click', (e) => {
    const link = e.target.closest('[data-rail]');
    if (!link) return;
    e.preventDefault();
    document
      .getElementById(`match-${link.dataset.rail}`)
      ?.scrollIntoView({ behavior: motionBehavior(), block: 'start' });
  });
$('#conseils-du-jour')?.addEventListener('click', (e) => {
  const b = e.target.closest('[data-market]');
  if (b) addSelection(b.dataset.match, b.dataset.market, b);
});
$('#daily-selection')?.addEventListener('click', (e) => {
  const b = e.target.closest('[data-market]');
  if (b) {
    addSelection(b.dataset.match, b.dataset.market, b);
  }
});
$('#safe-picks-list').addEventListener('click', (e) => {
  const b = e.target.closest('[data-safe-match]');
  if (b) {
    addSelection(b.dataset.safeMatch, b.dataset.safeMarket, b);
  }
});
$('#ticket-items').addEventListener('click', (e) => {
  if (betConfirmed || betAttempt?.busy || betAttempt?.uncertain) return;
  if (e.target.dataset.remove !== undefined) {
    state.ticket.splice(Number(e.target.dataset.remove), 1);
    renderTicket();
  }
});
$('#stake').addEventListener('input', () => {
  selectedStakePercent = null;
  renderTicket();
});
$('#target-odds').addEventListener('input', (e) => {
  $('#target-output').textContent = decimal(Number(e.target.value), 2);
  renderTicket();
});
$('#stake-controls')?.addEventListener('click', (event) => {
  if (betConfirmed || betAttempt?.busy || betAttempt?.uncertain) return;
  const percent = event.target.closest('[data-stake-percent]')?.dataset.stakePercent;
  if (percent) {
    selectedStakePercent = Number(percent);
    renderTicket();
    return;
  }
  const action = event.target.closest('[data-stake-action]')?.dataset.stakeAction;
  if (!action) return;
  selectedStakePercent = null;
  const cents = adjustStake($('#stake').value, action);
  if (cents == null) {
    renderTicket();
    return;
  }
  $('#stake').value = (cents / 100).toFixed(2);
  renderTicket();
});
$('#manual-stake')?.addEventListener('click', () => {
  if (!betAttempt?.busy && !betAttempt?.uncertain) $('#stake').focus();
});

$('#system-formula').addEventListener('change', renderTicket);
$('#counts-league').addEventListener('change', (e) => {
  state.countsLeague = e.target.checked;
  renderTicket();
});
$('#bet-mode').addEventListener('click', (e) => {
  const button = e.target.closest('[data-bet-mode]');
  if (!button) return;
  state.betMode = button.dataset.betMode;
  renderTicket();
});
function setBuilderTab(tab, focus = false) {
  document.querySelectorAll('[data-builder-tab]').forEach((button) => {
    const active = button.dataset.builderTab === tab;
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
    if (active && focus) button.focus();
  });
  const ticket = $('#ticket-panel'),
    generator = $('#generator-panel');
  if (ticket) ticket.hidden = tab !== 'ticket';
  if (generator) generator.hidden = tab !== 'generator';
}
document.querySelectorAll('[data-builder-tab]').forEach((button) => {
  button.addEventListener('click', () => setBuilderTab(button.dataset.builderTab));
  button.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    setBuilderTab(
      event.key === 'Home'
        ? 'ticket'
        : event.key === 'End'
          ? 'generator'
          : button.dataset.builderTab === 'ticket'
            ? 'generator'
            : 'ticket',
      true
    );
  });
});
const comboPeriod = $('#combo-period');
comboPeriod?.addEventListener('change', () => {
  const custom = comboPeriod.value === 'custom';
  $('#combo-dates').hidden = !custom;
  if (custom) {
    $('#combo-start').value ||= isoDate(0);
    $('#combo-end').value ||= isoDate(1);
  }
});
function generatorMatches() {
  const period = comboPeriod?.value ?? 'calendar';
  if (period === 'calendar') return visibleMatches();
  const day = new Date().getDay(),
    saturday = day === 0 ? -1 : 6 - day;
  const ranges = {
    today: [isoDate(0), isoDate(0)],
    tomorrow: [isoDate(1), isoDate(1)],
    weekend: [isoDate(saturday), isoDate(saturday + 1)],
    custom: [$('#combo-start').value, $('#combo-end').value]
  };
  const [start, end] = ranges[period];
  if (!start || !end || start > end) return null;
  return calendarMatches().filter(
    (match) =>
      match.date >= start &&
      match.date <= end &&
      selectedCompetition(match) &&
      (state.filter !== 'Favoris' || followsMatch(match))
  );
}
function generate() {
  if (betConfirmed || betAttempt?.busy || betAttempt?.uncertain) {
    toast('Vérifiez d’abord le pari en attente.');
    return;
  }
  const button = $('#generate-combo'),
    feedback = $('#combo-feedback');
  button.disabled = true;
  button.textContent = UI_COPY.composing;
  if (feedback) feedback.textContent = 'Recherche parmi les matchs de la période…';
  setTimeout(() => {
    try {
      const matches = generatorMatches();
      if (!matches) {
        if (feedback)
          feedback.textContent = 'Choisissez une date de début et une date de fin dans l’ordre.';
        setBuilderTab('generator');
        return;
      }
      const eligible = new Map();
      for (const match of matches) {
        if (!match.completed && !match.voided && kickoffAt(match) > Date.now())
          eligible.set(match.id, match);
      }
      const picks = optimizeCombo(
        [...eligible.values()],
        Number($('#target-odds').value),
        Number($('#selection-count').value),
        $('#risk-profile').value
      );
      if (!picks.length) {
        const message =
          'Aucun combiné disponible. Élargissez la période ou les filtres, ou ajoutez un choix manuellement. Votre ticket est conservé.';
        if (feedback) feedback.textContent = message;
        toast(message);
        return;
      }
      state.betMode = 'combined';
      state.ticket = picks;
      rememberTicket();
      renderTicket();
      setBuilderTab('ticket', true);
      const total = picks.reduce((p, x) => p * x.odd, 1),
        message = `Ticket composé : ${picks.length} sélections · cote ${decimal(total, 2)}. Vérifiez les choix ci-dessous, puis votre mise.`;
      if (feedback) feedback.textContent = message;
      toast(message);
    } finally {
      button.textContent = UI_COPY.compose;
      button.disabled = Boolean(betConfirmed || betAttempt?.busy || betAttempt?.uncertain);
    }
  }, 0);
}
$('#generate-combo').addEventListener('click', generate);
$('#quick-combo').addEventListener('click', () => {
  setActiveTab('matches');
  generate();
  setBuilderDrawer(true);
});
$('#clear-ticket').addEventListener('click', () => {
  state.ticket = [];
  rememberTicket();
  const notice = $('#shared-ticket-notice');
  if (notice) notice.hidden = true;
  renderTicket();
  toast('Ticket vidé');
});
$('#ticket-calendar')?.addEventListener('click', () => {
  setBuilderDrawer(false);
  setActiveTab('matches');
  const calendar = $('#date-navigator');
  calendar?.scrollIntoView({ behavior: motionBehavior(), block: 'start' });
  calendar?.querySelector('[aria-current="date"], button')?.focus({ preventScroll: true });
});
$('#close-builder').addEventListener('click', () => setBuilderDrawer(false));
function shareTicket(bet) {
  return import('./src/ticket/ticket-share.js?v=bet261')
    .then(({ openTicketShare }) => openTicketShare(bet, { baseUrl: location.href }))
    .catch(() => toast('Impossible de préparer le partage. Réessayez.'));
}
function currentShareTicket() {
  return {
    items: state.ticket.map((item) => ({ ...item })),
    stake: (stakeCents($('#stake').value) ?? 0) / 100,
    betType: state.betMode,
    formula: $('#system-formula').value,
    systemLines:
      state.betMode === 'multiple'
        ? systemLines(state.ticket, $('#system-formula').value).map((line) => ({
            ...line,
            stake:
              (stakeCents($('#stake').value) ?? 0) /
              100 /
              systemLines(state.ticket, $('#system-formula').value).length
          }))
        : []
  };
}
$('#share-combo').addEventListener('click', () => {
  if (state.ticket.length) shareTicket(currentShareTicket());
});
$('#share-confirmed-ticket')?.addEventListener('click', () => {
  if (lastSharedTicket) shareTicket(lastSharedTicket);
});
$('#place-bet').addEventListener('click', async () => {
  if ((knownAccountSession || accountCallbackOnLoad) && !accountApi && !(await ensureAccount())) {
    toast('Le service de comptes est indisponible. Réessayez dans un instant.');
    return;
  }
  if (!accountAuthenticated) {
    const button = $('#place-bet');
    if (button.disabled || button.dataset.busy || !state.ticket.length) return;
    button.dataset.busy = '1';
    try {
      guestWallet = placeGuestTicket(
        guestWallet,
        {
          items: state.ticket,
          stake: $('#stake').value,
          mode: state.betMode,
          formula: $('#system-formula').value
        },
        allMatches()
      );
      guestStorageReady = saveGuestWallet(guestWallet, guestStorage);
      state.bankroll = guestWallet.bankroll;
      state.ticket = [];
      rememberTicket();
      $('#bet-feedback').textContent = 'Pari invité enregistré. Retrouvez-le dans Mes paris.';
      setBuilderDrawer(false);
      render();
      toast('Pari virtuel enregistré en mode invité.');
    } catch (error) {
      toast(error.message);
    } finally {
      delete button.dataset.busy;
      renderTicket();
    }
    return;
  }
  if (!state.serverReady && !betAttempt?.uncertain) {
    toast('Les paris certifiés sont momentanément indisponibles');
    return;
  }
  const button = $('#place-bet'),
    stake = (stakeCents($('#stake').value) ?? 0) / 100,
    single = state.betMode === 'single',
    multiple = state.betMode === 'multiple',
    totalStake = stake * (single ? state.ticket.length : 1);
  if (
    button.dataset.busy ||
    betAttempt?.busy ||
    !state.ticket.length ||
    !Number.isFinite(stake) ||
    stake <= 0 ||
    (!betAttempt?.uncertain &&
      (totalStake > state.bankroll ||
        stakeIssue($('#stake').value, single ? state.ticket.length : 1, state.bankroll)))
  )
    return;
  if (
    !betAttempt?.uncertain &&
    state.ticket.some((item) => {
      const match = allMatches().find((m) => m.id === item.matchId);
      return !match || match.completed || match.voided || kickoffAt(match) <= Date.now();
    })
  ) {
    toast('Un match a commencé ou n’est plus disponible. Retirez-le du ticket.');
    return;
  }
  if (state.ticket.some((item) => !String(item.matchId).startsWith('espn-'))) {
    toast('Les matchs ajoutés à la main ou de démonstration ne peuvent pas être pariés');
    return;
  }
  const leg = (item) => ({
      matchId: item.matchId,
      key: item.key,
      odd: item.odd,
      ...(item.sourceBetId ? { sourceBetId: item.sourceBetId } : {})
    }),
    formula = multiple ? $('#system-formula').value : null;
  if (multiple && !systemLines(state.ticket, formula).length) return;
  if (!betAttempt) {
    const selections = state.ticket.map(leg),
      requests = single
        ? selections.map((selection) => ({
            selections: [selection],
            stake,
            betType: 'single',
            countsGeneral: state.countsLeague
          }))
        : [
            {
              selections,
              stake,
              betType: multiple ? 'multiple' : selections.length > 1 ? 'combined' : 'single',
              formula,
              countsGeneral: state.countsLeague
            }
          ];
    betAttempt = createSubmission(requests);
  }
  button.dataset.busy = '1';
  button.disabled = true;
  $('#bet-feedback').textContent = 'Enregistrement en cours : attendez la confirmation du serveur.';
  const submittingUser = accountUserId,
    guard = () => {
      if (accountUserId !== submittingUser || !accountAuthenticated)
        throw Object.assign(
          new Error('La session a changé : reconnectez-vous avant de confirmer.'),
          { code: 'AUTH_REQUIRED' }
        );
    },
    resultPromise = betAttempt.run({
      findBetsByRefs: (refs) => {
        guard();
        return accountApi.findBetsByRefs(refs);
      },
      placeBet: (job) => {
        guard();
        return accountApi.placeBet(job);
      }
    });
  renderTicket();
  const result = await resultPromise;
  delete button.dataset.busy;
  if (accountUserId !== submittingUser) {
    betAttempt = null;
    renderTicket();
    return;
  }
  if (result.busy) return;
  if (result.complete) {
    lastSharedTicket = {
      items: state.ticket.map((item) => ({ ...item })),
      stake,
      betType: state.betMode,
      formula,
      systemLines: multiple
        ? systemLines(state.ticket, formula).map((line) => ({
            ...line,
            stake: stake / systemLines(state.ticket, formula).length
          }))
        : []
    };
    const success = $('#bet-success');
    if (success) success.hidden = false;
    betConfirmed = true;
    renderTicket();
    try {
      navigator.vibrate?.([50]);
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1500));
    betConfirmed = false;
    if (accountUserId !== submittingUser) {
      betAttempt = null;
      renderTicket();
      return;
    }
    state.ticket = [];
    rememberTicket();
    betAttempt = null;
    $('#bet-feedback').textContent = 'Pari virtuel confirmé par le serveur.';
    try {
      await accountApi.refreshServer();
    } catch {}
    render();
    personalDashboard?.load({ refresh: true });
    toast('Pari virtuel enregistré. Votre ticket est prêt pour une nouvelle sélection.');
    return;
  }
  if (result.uncertain) {
    $('#bet-feedback').textContent =
      'Résultat incertain : vérifiez ce même envoi avant de modifier le ticket. La vérification relit le serveur et conserve les références pour éviter les doublons.';
    toast('Confirmation indisponible : utilisez Vérifier le pari en attente.');
  } else {
    if (single) state.ticket = state.ticket.filter((_, index) => !result.confirmed.includes(index));
    betAttempt = null;
    $('#bet-feedback').textContent =
      result.failure?.message || 'Ce pari a été refusé. Vérifiez le ticket avant de recommencer.';
    if (result.failure?.code === 'AUTH_REQUIRED') openJoin('login');
    if (['COTE_CHANGEE', 'MATCH_COMMENCE', 'MATCH_INCONNU'].includes(result.failure?.code))
      await loadLiveFixtures();
  }
  try {
    await accountApi.refreshServer();
  } catch {}
  renderTicket();
});
$('#bankroll-guest')?.addEventListener('click', (event) => {
  if (event.target.closest('[data-guest-sync-dismiss]')) {
    saveSyncPromptChoice('dismissed');
    renderHistory();
    $('#bankroll-guest [data-open-join]')?.focus();
    return;
  }
  if (event.target.closest('[data-guest-sync-start]')) {
    syncTrial?.intent();
    saveSyncPromptChoice('intent');
    openJoin('signup');
    return;
  }
  if (event.target.closest('[data-save-guest]')) {
    cloudSave(userStatePayload());
    toast('Sauvegarde de la simulation demandée.');
    return;
  }
  if (event.target.closest('[data-open-join]')) {
    mobileDiagnostics?.mark('intention-synchronisation');
    if (guestWallet.history.length) syncTrial?.intent();
    openJoin('signup');
  }
});
$('#community-profile-button')?.addEventListener('click', () => {
  if (!accountAuthenticated) {
    openJoin('signup');
    toast('Créez un compte pour définir votre profil');
    return;
  }
  setActiveTab('profile', true, { self: true });
});
$('#account-button').addEventListener('click', (event) => {
  event.stopPropagation();
  toggleAccountMenu();
});
$('#account-menu')?.addEventListener('click', (event) => {
  const item = event.target.closest('[data-menu]');
  if (item) menuAction(item.dataset.menu);
});
if (typeof window !== 'undefined')
  document.addEventListener('click', (event) => {
    const menu = accountMenu();
    if (
      menu &&
      !menu.hidden &&
      !menu.contains(event.target) &&
      !event.target.closest('[data-mobile-account]')
    )
      toggleAccountMenu(false);
  });
if (typeof window !== 'undefined')
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && accountMenu() && !accountMenu().hidden) {
      toggleAccountMenu(false);
      $('#account-button')?.focus();
    }
  });
document.querySelector('[data-mobile-account]')?.addEventListener('click', (event) => {
  event.stopPropagation();
  toggleAccountMenu();
});
$('#predictions').addEventListener('click', (event) => {
  if (event.target.closest('a[href="#model-journal"]')) {
    event.preventDefault();
    $('#model-journal').scrollIntoView({ behavior: motionBehavior() });
  }
});
document.querySelectorAll('[data-report-period]').forEach((button) =>
  button.addEventListener('click', () => {
    state.predictionFilters.period = button.dataset.reportPeriod;
    state.predictionPage = 1;
    renderPredictionStats();
  })
);
$('#prediction-filters').addEventListener('change', () => {
  state.predictionFilters = {
    period: $('#prediction-period').value,
    league: $('#prediction-league').value,
    market: $('#prediction-market').value,
    result: $('#prediction-result').value,
    source: $('#prediction-source').value
  };
  state.predictionPage = 1;
  renderPredictionStats();
});
$('#reset-prediction-filters').addEventListener('click', () => {
  state.predictionFilters = {
    period: 'all',
    league: 'all',
    market: 'all',
    result: 'all',
    source: 'bookmaker'
  };
  state.predictionPage = 1;
  renderPredictionStats();
});
$('#prediction-prev').addEventListener('click', () => {
  if (state.predictionPage > 1) {
    state.predictionPage--;
    renderPredictionStats();
    $('#predictions').scrollIntoView({ behavior: motionBehavior() });
  }
});
$('#prediction-next').addEventListener('click', () => {
  state.predictionPage++;
  renderPredictionStats();
  $('#predictions').scrollIntoView({ behavior: motionBehavior() });
});
$('#challenge-list').addEventListener('click', async (e) => {
  const button = e.target.closest('[data-join-challenge]');
  if (!button) return;
  if (!accountAuthenticated) {
    openJoin('login');
    toast('Connectez-vous pour participer à un défi');
    return;
  }
  if (!state.serverReady) {
    toast('Le serveur de jeu est indisponible pour le moment');
    return;
  }
  const id = button.dataset.joinChallenge,
    joined = Boolean(challengeEntry(id));
  button.disabled = true;
  try {
    if (joined) await accountApi.leaveChallenge(id);
    else await accountApi.joinChallenge(id);
    toast(joined ? 'Participation annulée' : 'Défi rejoint : classement et XP en fin de semaine');
  } catch (error) {
    toast(error.message);
  }
  button.disabled = false;
});
if (typeof window !== 'undefined') globalThis.betOptimumTheme?.bind(render);
// Les anciens liens du défi reviennent au calendrier.
function openDailyChallenge() {
  if (location.hash === '#defi-du-jour') setActiveTab('matches', false);
}
if (typeof window !== 'undefined') addEventListener('hashchange', openDailyChallenge);
$('#hero-confidence').addEventListener('click', () => showConfidence());
$('#open-help').addEventListener('click', () => $('#help-dialog').showModal());
document
  .querySelectorAll('[data-close-dialog]')
  .forEach((button) => button.addEventListener('click', () => button.closest('dialog').close()));
// Pied de page : navigation, pages d'information (avec ancre de section) et année.
document.querySelectorAll('[data-open-dialog]').forEach((button) =>
  button.addEventListener('click', () => {
    const dialog = $(`#${button.dataset.openDialog}`);
    dialog.showModal();
    const section = button.dataset.section && dialog.querySelector(`#${button.dataset.section}`);
    if (section) {
      section.scrollIntoView({ block: 'start' });
      if (section.hasAttribute('tabindex')) section.focus({ preventScroll: true });
    } else dialog.scrollTop = 0;
  })
);
document.querySelectorAll('[data-footer-nav]').forEach((button) =>
  button.addEventListener('click', () => {
    const target = button.dataset.footerNav;
    setActiveTab(
      ['bankroll', 'standings', 'community', 'predictions'].includes(target) ? target : 'matches'
    );
    document
      .querySelector(
        target === 'bankroll'
          ? '#bankroll'
          : target === 'standings'
            ? '#standings'
            : target === 'community'
              ? '#community'
              : target === 'predictions'
                ? '#predictions'
                : target === 'builder'
                  ? '#builder'
                  : '#matches'
      )
      ?.scrollIntoView({ behavior: motionBehavior() });
  })
);
document.querySelectorAll('a.brand').forEach((link) =>
  link.addEventListener('click', (event) => {
    event.preventDefault();
    toggleAccountMenu(false);
    setActiveTab('matches');
    document.querySelector('#dashboard')?.scrollIntoView({ behavior: motionBehavior() });
  })
);
document.querySelector('.tabs').addEventListener('click', (e) => {
  const button = e.target.closest('[data-tab]');
  if (button) setActiveTab(button.dataset.tab, true);
});
document
  .querySelectorAll('[data-open-tab]')
  .forEach((button) =>
    button.addEventListener('click', () => setActiveTab(button.dataset.openTab, true, null, 'push'))
  );
document.querySelector('.mobile-nav').addEventListener('click', (e) => {
  const button = e.target.closest('[data-mobile-target]');
  if (button) setActiveTab(button.dataset.mobileTarget, true, null, 'push');
});
globalThis.addEventListener?.('keydown', (event) => {
  if (event.key === 'Escape') setBuilderDrawer(false);
});
if (typeof window !== 'undefined')
  inbox = initInbox({
    navigate: (tab) => {
      if (tab === 'challenges') {
        setActiveTab('community', true);
        setCommunityTab('challenges');
      } else setActiveTab(tab, true);
    }
  });
clearLegacyFixtureCache();
readFixtureCache()
  .then(async (cached) => {
    if (!Array.isArray(cached?.matches) || fixtureDataLoaded) return;
    mobileDiagnostics?.mark('cache-lu');
    await showFixturePreview(matchesWithBookmakers(cached.matches));
    mobileDiagnostics?.mark('cache-analyse-debut');
    await prepareFixtureAnalyses(cached, fixtureVersion(cached));
    mobileDiagnostics?.mark('cache-analyse-fin');
    if (!fixtureDataLoaded) applyFixtureData(cached, true);
  })
  .catch(() => {});
setActiveTab(
  location.hash === '#boutique'
    ? 'shop'
    : location.hash === '#profil' || location.hash.startsWith('#joueur-')
      ? 'profile'
      : location.hash === '#bankroll'
        ? 'bankroll'
        : location.hash === '#classements'
          ? 'standings'
          : ['#communaute', '#challenges'].includes(location.hash) ||
              location.hash.startsWith('#ligue-privee-')
            ? 'community'
            : location.hash === '#bilan-pronos'
              ? 'predictions'
              : 'matches',
  false,
  profileHash ? { nickname: decodeURIComponent(profileHash[1]), self: false } : null
);
render();
if (typeof window !== 'undefined') {
  setTimeout(openDailyChallenge, 0);
  $('#footer-year').textContent = new Date().getFullYear();
  $('#match-list').classList.add('reveal');
  $('#match-list').addEventListener(
    'toggle',
    (event) => {
      const section = event.target,
        id = section.dataset?.bookmakers;
      if (!id) return;
      if (!section.open) {
        expandedBookmakers.delete(id);
        return;
      }
      expandedBookmakers.add(id);
      refreshBookmakerSection(section);
    },
    true
  );
  $('#match-list').addEventListener('click', (event) => {
    const retry = event.target.closest('[data-retry-bookmakers]');
    if (!retry) return;
    const section = retry.closest('[data-bookmakers]');
    const match = allMatches().find((item) => item.id === section.dataset.bookmakers);
    if (!match) return;
    unavailableBookmakers.delete(bookmakerKey(match));
    section.querySelector('summary')?.focus();
    refreshBookmakerSection(section);
  });
  setInterval(tickCountdowns, 1000);
  setInterval(renderLeague, 60000);
  setInterval(pollLive, 20000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      pollLive();
      resumeFixtures();
    }
  });
  addEventListener('pageshow', pollLive);
  addEventListener('online', () => {
    liveBackoff.clear();
    lastLivePollAt = -Infinity;
    pollLive();
    if (!document.hidden) loadLiveFixtures();
  });
  setupScroller($('#date-navigator'));
  setupScroller($('#filters'));
  setupScroller($('#standings-leagues'));
  addEventListener('resize', updateScrollers);
  requestAnimationFrame(() => {
    revealActive($('#date-navigator'), false);
    updateScrollers();
  });
  setTimeout(pollLive, 1500);
  const preview = $('#calendar-preview');
  if (preview?.textContent) {
    try {
      const matches = JSON.parse(preview.textContent);
      if (Array.isArray(matches)) showFixturePreview(matches);
    } catch {
      // Le calendrier complet reste la source de repli.
    }
  }
  loadLiveFixtures();
  setInterval(
    () => {
      if (document.hidden) return;
      resumeFixtures();
      if (accountAuthenticated && state.serverReady) {
        accountApi?.refreshServer();
        refreshFeedDot();
      }
    },
    5 * 60 * 1000
  );
  setInterval(() => {
    updateFreshness();
    if (state.dateFilter === 'week' && activeTab === 'matches') {
      renderFilters();
      renderMatches();
    }
  }, 60000);
  if (knownAccountSession || accountCallbackOnLoad || joinOnLoad || pendingPrivateCode)
    ensureAccount().then(() => {
      if (joinOnLoad && !accountAuthenticated && !accountCallbackOnLoad) openJoin('login');
    });
}
function ensureAccount() {
  if (accountPromise) return accountPromise;
  accountPromise = import('./src/account/account.js?v=accounts-bet309')
    .then(({ initAccountSync }) =>
      initAccountSync({
        getState: userStatePayload,
        onSyncWrite: (bytes) => mobileDiagnostics?.mark('ecriture-compte', false, { bytes }),
        applyState: applySyncedState,
        resetState: resetSyncedState,
        registerCloudSave: (save) => {
          cloudSave = save;
        },
        onAuthChange: (authenticated, user) => {
          accountAuthenticated = authenticated;
          accountUserId = user?.id ?? null;
          if (authenticated && syncPromptChoice === 'intent' && syncPromptDate >= isoDate(-7)) {
            syncReturnActive = true;
            saveSyncPromptChoice('completed');
            setActiveTab('bankroll');
          }
          inbox?.account(accountUserId);
          let store = null;
          try {
            store = localStorage;
          } catch {}
          attention = accountUserId
            ? createAttention(store, 'betoptimum-attention:' + accountUserId)
            : null;
          renderAttention();
          if (!authenticated) {
            state.bankroll = guestWallet.bankroll;
            updateStats();
            lastSharedTicket = null;
            const success = $('#bet-success');
            if (success) success.hidden = true;
            document.querySelector('.ticket-share-dialog')?.close();
            toggleAccountMenu(false);
            personalDashboard?.clear();
          }
          renderTicket();
          renderAccountMenu();
          renderHistory();
        },
        onAuthEvent: (event) => {
          if (event === 'SIGNED_OUT' || event === 'PASSWORD_RECOVERY') {
            clearPrivateInvitation();
          }
          if (
            pendingInvitation &&
            ['CONFIRMATION_FAILED', 'OAUTH_FAILED', 'PASSWORD_RECOVERY'].includes(event)
          ) {
            pendingInvitation.autoJoin = false;
            saveInvitation(invitationStorage, pendingInvitation, false);
            if (event !== 'PASSWORD_RECOVERY') {
              showPrivateInvitation(
                'Le lien a expiré ou la connexion a échoué. Demandez un nouveau lien.'
              );
              return;
            }
          }
          if (event === 'EMAIL_CONFIRMED') {
            syncTrial?.created();
            toast('Adresse confirmée. Bienvenue au Club !');
            if (!syncReturnActive) setActiveTab('community', true);
          } else if (event === 'OAUTH_FAILED')
            setTimeout(() => openJoin('login').then(() => join?.oauthError()), 0);
          else if (event === 'CONFIRMATION_FAILED')
            openJoin('login').then(() => join?.confirmationError());
          else if (event === 'PASSWORD_RECOVERY') openJoin('login').then(() => join?.recovery());
          else if (event === 'SIGNED_IN' && join && !$('#rejoindre').hidden) join.close();
        },
        onCommunityData: (profiles) => {
          state.communityProfiles = profiles;
          renderCommunity();
          if (state.community.tab === 'league') renderGeneral();
        },
        onCommunityStatus: (status) => {
          state.communityStatus = status;
          renderCommunity();
        },
        onServerData: applyServerData,
        onLeagueData: (data) => {
          state.league = data;
          defaultClubRanking();
          renderLeague();
          renderSpecial();
          if (activeTab === 'community' && state.community.tab === 'league') selectClubLeague();
          showSeasonResult();
        },
        onSpecialData: (data) => {
          state.special = data;
          renderSpecial();
          renderLeagueList();
        },
        onPrivateData: (data) => {
          state.private = data;
          renderPrivate();
          offerPrivateJoin();
        },
        onFollowData: (data) => {
          state.followIds = new Set(data?.ids ?? []);
          profilePage?.refresh?.();
          refreshFeedDot();
        },
        onProgressData: (data) => {
          state.progress = data;
          updateRewardAttention(data);
          renderAccountMenu();
          state.xpMap = data?.xpMap ?? {};
          state.challengeEntries = (data?.challenges ?? []).map((id) => ({
            id,
            joinedAt: new Date().toISOString()
          }));
          renderProgress();
          renderCommunity();
          if (data) {
            announceXp(data);
            celebrateWins(data);
          }
        },
        toast
      }).then((api) => {
        accountApi = api;
        offerPrivateJoin();
        renderHistory();
        {
          let tab = 'league';
          try {
            tab = localStorage.getItem('betmaster-community-tab') || 'league';
          } catch {}
          setCommunityTab(pendingPrivateCode ? 'private' : challengesOnLoad ? 'challenges' : tab);
        }
        return api;
      })
    )
    .catch((error) => {
      console.error('Compte indisponible', error);
      $('#account-label').textContent = 'Compte indisponible';
      accountPromise = null;
      return null;
    });
  return accountPromise;
}

if (typeof window !== 'undefined')
  import('./src/core/onboarding.js').then(({ initOnboarding }) =>
    initOnboarding($('#discovery'), {
      initialSeen: state.onboardingSeen,
      onSeen: () => {
        state.onboardingSeen = true;
        persist();
      }
    })
  );

if (typeof window !== 'undefined') {
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-help]');
    if (!button) return;
    const dialog = $('#help-dialog');
    dialog.showModal();
    const target = document.getElementById('help-' + button.dataset.help);
    target?.scrollIntoView({ block: 'nearest' });
    target?.focus();
  });
}

if (typeof window !== 'undefined') {
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-personal]');
    if (!button) return;
    if (!accountAuthenticated) {
      openJoin('login');
      return;
    }
    const destination = button.dataset.personal;
    if (destination === 'bets') setActiveTab('bankroll', true);
    else
      setActiveTab('profile', true, {
        self: true,
        tab: ['account', 'notifications', 'overview', 'badges'].includes(destination)
          ? destination
          : 'overview'
      });
  });
}

if (typeof window !== 'undefined') {
  document.querySelector('#account-menu')?.addEventListener('keydown', (event) => {
    const items = [...accountMenu().querySelectorAll('[role=menuitem]:not([hidden])')],
      i = items.indexOf(document.activeElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      toggleAccountMenu(false);
      $('#account-button').focus();
    } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      items[
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? items.length - 1
            : (i + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
      ]?.focus();
    } else if (event.key === 'Tab') toggleAccountMenu(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.target.matches('[data-help]') && event.key === 'Escape') $('#help-dialog').close();
  });
}

// BET-120 : accès au ticket depuis le calendrier et les classements.
document.querySelectorAll('[data-open-ticket]').forEach((button) =>
  button.addEventListener('click', () => {
    if (matchMedia('(max-width:767px)').matches) setBuilderDrawer(true);
    else {
      setActiveTab('matches');
      $('#builder')?.scrollIntoView({ behavior: motionBehavior() });
    }
  })
);
// Les anciens liens de rubrique fonctionnent aussi sans recharger la page.
globalThis.addEventListener?.('hashchange', () => {
  const sharedMatch = /^#match-(espn-[0-9]+)$/.exec(location.hash);
  if (sharedMatch) {
    pendingAlertMatch = sharedMatch[1];
    openAlertMatch();
    return;
  }
  const routes = {
      '': 'matches',
      '#dashboard': 'matches',
      '#classements': 'standings',
      '#bilan-pronos': 'predictions',
      '#communaute': 'community',
      '#bankroll': 'bankroll',
      '#challenges': 'community'
    },
    tab = routes[location.hash];
  if (tab) {
    const challenges = location.hash === '#challenges';
    setActiveTab(tab, true);
    if (challenges) setCommunityTab('challenges');
  }
});
if (typeof window !== 'undefined')
  import('./src/core/filter-chips.js').then(({ enhanceFilterChips }) =>
    [
      'prediction-league',
      'prediction-market',
      'prediction-result',
      'prediction-source',
      'prediction-period',
      'history-period',
      'history-status'
    ].forEach((id) => enhanceFilterChips(document.getElementById(id)))
  );

if (typeof window !== 'undefined')
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-empty-matches]')) {
      setBuilderDrawer(false);
      state.dateFilter = chosenCalendarDate = isoDate(0);
      state.selectedLeagues = [];
      state.filter = 'Tous';
      rememberCalendarContext();
      setActiveTab('matches', true);
      renderActiveTab();
    }
    if (event.target.closest('[data-empty-upcoming-matches]')) {
      state.dateFilter = chosenCalendarDate = 'week';
      state.selectedLeagues = [];
      state.filter = 'Tous';
      rememberCalendarContext();
      setActiveTab('matches', true);
      renderDateNavigator();
      renderFilters();
      renderMatches();
      document.querySelector('[data-date="week"]')?.focus({ preventScroll: true });
    }
    if (event.target.closest('[data-empty-reset-history]')) $('#reset-history')?.click();
    if (event.target.closest('[data-empty-reset-predictions]'))
      $('#reset-prediction-filters')?.click();
  });

if (typeof window !== 'undefined')
  drawerReady = import('./src/ticket/ticket-drawer.js')
    .then(({ initTicketDrawer }) => initTicketDrawer($('#builder'), () => setBuilderDrawer(false)))
    .catch(() => {});

if (typeof window !== 'undefined')
  addEventListener('hashchange', () => {
    if (location.hash === '#conseils-du-jour') {
      setActiveTab('matches');
      renderDailyAdvice();
      $('#conseils-du-jour')?.scrollIntoView({ block: 'start' });
    }
  });

$('#home-performance-detail')?.addEventListener('click', () => {
  state.predictionFilters = {
    period: 'all',
    league: 'all',
    market: 'all',
    result: 'all',
    source: 'bookmaker'
  };
  setActiveTab('predictions', true);
  renderPredictionStats();
});

if (typeof document !== 'undefined') installImageFallbacks(document);
