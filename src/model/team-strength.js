// Recherche BET-316 : Elo partagé par identifiant ESPN, puis buts attendus Poisson.
// Aucun paramètre ni résultat de ce module n'est utilisé par les recommandations actives.
export const TEAM_STRENGTH_ACTIVE = false;
export function createTeamStrength() {
  const ratings = new Map();
  const rating = (id) => ratings.get(String(id)) ?? 1500;
  return {
    predict(match) {
      if (!match.homeId || !match.awayId || match.homeId === match.awayId) return null;
      const difference = rating(match.homeId) - rating(match.awayId) + 60;
      const ratio = Math.exp(Math.max(-2, Math.min(2, difference / 400)));
      return {
        homeGoals: (2.6 * ratio) / (1 + ratio),
        awayGoals: 2.6 / (1 + ratio),
        modelVersion: 'elo-research-v1'
      };
    },
    observe(match, homeScore, awayScore) {
      if (
        !match.homeId ||
        !match.awayId ||
        match.homeId === match.awayId ||
        ![homeScore, awayScore].every((n) => Number.isInteger(n) && n >= 0)
      )
        return false;
      const h = rating(match.homeId),
        a = rating(match.awayId);
      const expected = 1 / (1 + 10 ** ((a - h - 60) / 400));
      const actual = homeScore > awayScore ? 1 : homeScore === awayScore ? 0.5 : 0;
      const delta = 20 * (actual - expected);
      ratings.set(String(match.homeId), h + delta);
      ratings.set(String(match.awayId), a - delta);
      return true;
    }
  };
}
