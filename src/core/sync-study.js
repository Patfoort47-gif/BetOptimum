// Recette volontaire sur un appareil. Aucun identifiant ni transport réseau.
export function syncStudy(storage, assignment, today) {
  const key = 'betoptimum-sync-study';
  const daysSince = (day) => (Date.parse(today()) - Date.parse(day)) / 86400000;
  let record;
  try {
    record = JSON.parse(storage.getItem(key));
    if (record && !(daysSince(record.arrival) >= 0 && daysSince(record.arrival) <= 14)) {
      storage.removeItem(key);
      record = null;
    }
    if (!record && ['proposition', 'temoin'].includes(assignment))
      record = { group: assignment, arrival: today() };
    if (!record || !['proposition', 'temoin'].includes(record.group)) return null;
    storage.setItem(key, JSON.stringify(record));
  } catch {
    return null;
  }
  const mark = (field, value = true) => {
    if (record[field] !== undefined) return;
    record[field] = value;
    try {
      storage.setItem(key, JSON.stringify(record));
    } catch {}
  };
  return {
    control: record.group === 'temoin',
    calendar: (available) => mark('matchDay', available),
    eligible: () => mark('eligible'),
    exposed: () => mark('exposed'),
    intent: () => mark('intent'),
    created: () => mark('created'),
    useful: (kind) => {
      if (daysSince(record.arrival) === 7) mark('usefulDay7', kind);
    }
  };
}
