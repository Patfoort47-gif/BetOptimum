// Affichage français uniquement : ne pas utiliser pour les champs numériques ou les données.
const formats = new Map();
export function decimal(value, digits = 2) {
  if (value == null || value === '' || !Number.isFinite(Number(value))) return '-';
  if (!formats.has(digits))
    formats.set(
      digits,
      new Intl.NumberFormat('fr-FR', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
        useGrouping: false
      })
    );
  return formats.get(digits).format(Number(value));
}
