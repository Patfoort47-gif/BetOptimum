// Mesures de recette locales, activées explicitement et conservées en mémoire.
export function createMobileDiagnostics() {
  if (
    typeof window === 'undefined' ||
    !new URLSearchParams(window.location.search).has('diagnostic-mobile') ||
    typeof performance.mark !== 'function'
  )
    return null;

  const first = new Set();
  return {
    markOnce(phase) {
      if (first.has(phase)) return;
      first.add(phase);
      performance.mark('bet-mobile:' + phase);
    },
    mark(phase, calendarReady = false) {
      if (calendarReady) {
        if (first.has('calendrier-utilisable')) return;
        first.add('calendrier-utilisable');
        performance.mark('bet-mobile:calendrier-utilisable');
      }
      performance.mark('bet-mobile:' + phase);
    }
  };
}
