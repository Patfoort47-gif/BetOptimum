// Montants d'interface en centimes ; les règles et écritures serveur restent autoritaires.
export function stakeCents(value) {
  const text = String(value ?? '')
    .trim()
    .replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ''] = text.split('.'),
    cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}
export function validUnit(cents) {
  return Number.isSafeInteger(cents) && cents > 0;
}
export function adjustStake(value, action, unit) {
  if (action === 'reset') return 0;
  if (action === 'unit') return validUnit(unit) ? unit : null;
  const cents = String(value).trim() === '' ? 0 : stakeCents(value),
    increment = { 5: 500, 10: 1000, 50: 5000 }[action];
  if (cents == null || !increment) return null;
  const next = cents + increment;
  return Number.isSafeInteger(next) ? next : null;
}
export function stakeIssue(value, count, bankroll) {
  const cents = stakeCents(value);
  if (cents == null) return 'precision';
  if (cents < 100) return 'minimum';
  const total = cents * count;
  if (!Number.isSafeInteger(total) || total > Math.round(Number(bankroll) * 100)) return 'balance';
  return null;
}

export function percentageStake(bankroll, percent) {
  const cents = Math.round(Number(bankroll) * 100),
    rate = Number(percent);
  return Number.isSafeInteger(cents) && cents >= 0 && [1, 2, 3, 5].includes(rate)
    ? Math.round((cents * rate) / 100)
    : null;
}
