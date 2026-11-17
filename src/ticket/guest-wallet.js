import { analyseMatch, settleTicket, systemLines } from '../model/model.js';
import { quoteAvailable } from '../model/quote-policy.js';
import { stakeCents } from './stake-controls.js';
export const GUEST_STORAGE_KEY = 'betoptimum-guest-wallet-v1';
const cents = (value) => Math.round(value * 100);
export function guestWalletFrom(value) {
  if (
    value?.version !== 1 ||
    !Number.isSafeInteger(cents(value.bankroll)) ||
    value.bankroll < 0 ||
    !Array.isArray(value.history)
  )
    return { version: 1, bankroll: 1000, history: [] };
  const history = value.history.filter(
    (bet) =>
      bet?.guest === true &&
      !bet.certified &&
      Number.isFinite(bet.stake) &&
      bet.stake > 0 &&
      Number.isFinite(bet.odds) &&
      bet.odds > 1 &&
      ['pending', 'won', 'lost', 'void'].includes(bet.status) &&
      Array.isArray(bet.items) &&
      bet.items.length &&
      bet.items.every(
        (item) =>
          item &&
          typeof item.matchId === 'string' &&
          typeof item.key === 'string' &&
          Number.isFinite(item.odd) &&
          item.odd > 1
      ) &&
      (bet.betType !== 'multiple' ||
        (Array.isArray(bet.systemLines) &&
          bet.systemLines.length &&
          bet.systemLines.every(
            (line) =>
              Number.isFinite(line.stake) &&
              line.stake > 0 &&
              Array.isArray(line.indexes) &&
              line.indexes.length &&
              line.indexes.every((i) => Number.isInteger(i) && i >= 0 && i < bet.items.length)
          )))
  );
  return { version: 1, bankroll: cents(value.bankroll) / 100, history: structuredClone(history) };
}
export function readGuestWallet(storage) {
  try {
    return guestWalletFrom(JSON.parse(storage.getItem(GUEST_STORAGE_KEY)));
  } catch {
    return guestWalletFrom(null);
  }
}
export function saveGuestWallet(wallet, storage) {
  try {
    storage.setItem(GUEST_STORAGE_KEY, JSON.stringify(wallet));
    return true;
  } catch {
    return false;
  }
}
// Simulation privée : aucune écriture de solde, pari ou score certifié.
export function placeGuestTicket(
  wallet,
  { items, stake, mode = 'combined', formula = 'auto' },
  matches,
  { now = Date.now(), uuid = () => crypto.randomUUID() } = {}
) {
  const amount = stakeCents(stake),
    count = mode === 'single' ? items.length : 1;
  if (
    !['single', 'combined', 'multiple'].includes(mode) ||
    !items.length ||
    amount == null ||
    amount < 100 ||
    !Number.isSafeInteger(amount * count) ||
    amount * count > cents(wallet.bankroll)
  )
    throw new Error('Vérifiez votre mise et votre bankroll invitée.');
  if (new Set(items.map((i) => i.matchId)).size !== items.length)
    throw new Error('Un seul choix par match est autorisé.');
  for (const item of items) {
    const match = matches.find((m) => m.id === item.matchId),
      kickoff = Date.parse(match?.kickoff ?? `${match?.date}T${match?.time || '12:00'}:00`);
    if (
      !match ||
      !String(match.id).startsWith('espn-') ||
      match.completed ||
      match.voided ||
      !Number.isFinite(kickoff) ||
      kickoff <= now ||
      !quoteAvailable(match, item.key)
    )
      throw new Error('Une sélection est indisponible ou son match a commencé.');
    const current = analyseMatch(match).markets.find((m) => m.key === item.key);
    if (!current || !Number.isFinite(current.probability))
      throw new Error('Probabilités indisponibles pour cette sélection.');
    if (current.odd !== item.odd)
      throw new Error('Une cote a changé. Retirez la sélection et ajoutez-la à nouveau.');
  }
  const lines = mode === 'multiple' ? systemLines(items, formula) : [];
  if (mode === 'multiple' && !lines.length)
    throw new Error('La formule du système est incompatible.');
  const groups = mode === 'single' ? items.map((item) => [item]) : [items];
  const bets = groups.map((selections) => ({
    id: uuid(),
    guest: true,
    certified: false,
    countsGeneral: false,
    date: new Date(now).toISOString(),
    stake: amount / 100,
    odds: selections.reduce((product, item) => product * item.odd, 1),
    betType: mode === 'multiple' ? 'multiple' : selections.length > 1 ? 'combined' : 'single',
    systemFormula: mode === 'multiple' ? formula : null,
    systemLines: lines.map((line) => ({ ...line, stake: amount / 100 / lines.length })),
    items: structuredClone(selections),
    status: 'pending'
  }));
  return {
    ...wallet,
    bankroll: (cents(wallet.bankroll) - amount * count) / 100,
    history: [...bets, ...wallet.history]
  };
}
export function settleGuestWallet(wallet, results, now = Date.now()) {
  let bankroll = cents(wallet.bankroll),
    settled = 0;
  const history = wallet.history.map((bet) => {
    if (bet.status !== 'pending') return bet;
    const result = settleTicket(bet, results);
    if (result.status === 'pending') return bet;
    settled++;
    bankroll += cents(result.payout);
    return {
      ...bet,
      status: result.status,
      returnAmount: result.payout,
      settledAt: new Date(now).toISOString()
    };
  });
  return { wallet: { ...wallet, bankroll: bankroll / 100, history }, settled };
}
