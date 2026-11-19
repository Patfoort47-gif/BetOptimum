import { registerAppWorker } from '../core/pwa.js';
export async function mountWebPush(root, { api, config, html, toast }) {
  let alive = true,
    prefs = null,
    busy = false,
    associated = false,
    hasSubscription = false,
    feedback = '';
  const ios =
      /iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
    installed =
      !!navigator.standalone || globalThis.matchMedia?.('(display-mode: standalone)').matches;
  const supported =
    (!ios || installed) &&
    typeof Notification !== 'undefined' &&
    typeof PushManager !== 'undefined' &&
    'serviceWorker' in navigator;
  const render = () => {
    if (!alive) return;
    const permission = supported ? Notification.permission : null;
    const active = prefs?.enabled && associated && hasSubscription && permission === 'granted';
    const status = !supported
      ? ios && !installed
        ? 'Sur iPhone et iPad, ajoutez BetOptimum à l’écran d’accueil depuis Safari, puis ouvrez l’application installée.'
        : 'Ce navigateur ne prend pas en charge les notifications push.'
      : permission === 'denied'
        ? 'Notifications bloquées. Autorisez-les dans les réglages de votre navigateur ou de votre téléphone.'
        : !config.available.web
          ? 'Le service push est temporairement indisponible.'
          : active
            ? 'Notifications autorisées et abonnement associé à cet appareil.'
            : prefs?.enabled
              ? 'Une nouvelle association est nécessaire pour reprendre les notifications sur cet appareil.'
              : 'Notifications désactivées.';
    root.innerHTML = `<section class="settings-card"><h3>Notifications sur cet appareil</h3><p>À l’activation, recevez le conseil du jour à 9 h sur ce téléphone, ainsi que les résultats de vos paris.</p><label class="switch-line"><input type="checkbox" data-web-push ${active ? 'checked' : ''} ${supported && permission !== 'denied' && config.available.web && !busy ? '' : 'disabled'}><span>Activer les alertes sur ce téléphone<small>Conseil du jour inclus par défaut. Autorisation du navigateur requise. Vous pouvez le désactiver séparément ci-dessous.</small></span></label><label class="switch-line"><input type="checkbox" data-daily-summary ${prefs?.daily_summary ? 'checked' : ''} ${active && !prefs?.essential && !busy ? '' : 'disabled'}><span>Conseil du jour à 9 h<small>Dans le fuseau ${html(prefs?.timezone ?? 'Europe/Paris')}, indépendamment de vos favoris. Aucun envoi sans conseil. Fenêtre d’envoi : 9 h à 9 h 15.</small></span></label><details class="notification-advanced"><summary>Autres rappels et réglages</summary><label class="switch-line"><input type="checkbox" data-web-essential ${prefs?.essential ? 'checked' : ''} ${active && !busy ? '' : 'disabled'}><span>Mode Éco / Essentiel<small>Uniquement les résultats de vos paris validés par le serveur. Les rappels et le conseil quotidien sont coupés.</small></span></label><label class="switch-line"><input type="checkbox" data-favorite-reminders ${prefs?.favorite_reminders ? 'checked' : ''} ${active && !prefs?.essential && config.available.web && !busy ? '' : 'disabled'}><span>Me rappeler les matchs de mes équipes favorites 2 h avant<small>Un rappel par match avec le conseil, sa cote et sa confiance lorsqu’ils sont disponibles. Le délai peut varier de quelques minutes. Les heures silencieuses sont respectées (22 h à 8 h par défaut).</small></span></label><p>Les équipes favorites sont celles de votre compte. Suivre un championnat seul ne déclenche aucune alerte. Le rappel ouvre la fiche du match pour préparer votre prono virtuel.</p></details><p role="status">${html(status)}</p>${prefs?.enabled && !active ? '<button type="button" class="button secondary" data-stop-web>Arrêter les alertes push du compte</button>' : ''}<p role="status">${html(feedback)}</p></section>`;
  };
  async function refreshLocalSubscription() {
    if (!supported) return;
    try {
      const worker = await navigator.serviceWorker.getRegistration();
      const subscription = await worker?.pushManager.getSubscription();
      hasSubscription = Boolean(subscription);
      if (associated && subscription && config.available.web) {
        const status = await api.action({
          action: 'web-status',
          destination: subscription.toJSON()
        });
        hasSubscription = status?.matches === true;
      }
    } catch {
      hasSubscription = false;
    }
  }
  async function refresh() {
    const data = await api.web();
    prefs = data.preferences;
    associated = data.associated === true;
    await refreshLocalSubscription();
  }
  try {
    await refresh();
    render();
  } catch {
    root.innerHTML = '<p role="status">Les paramètres push sont indisponibles.</p>';
  }
  const change = async (e) => {
    if (
      !e.target.matches(
        '[data-web-push],[data-favorite-reminders],[data-web-essential],[data-daily-summary],[data-stop-web]'
      ) ||
      busy
    )
      return;
    const reminder = e.target.matches('[data-favorite-reminders]');
    const enable = e.target.checked === true;
    feedback = '';
    busy = true;
    render();
    try {
      if (e.target.matches('[data-daily-summary]')) {
        await api.saveWeb({ ...prefs, daily_summary: enable });
      } else if (e.target.matches('[data-web-essential]')) {
        await api.saveWeb({ ...prefs, essential: enable });
      } else if (reminder) {
        await api.saveWeb({ ...prefs, favorite_reminders: enable });
      } else if (enable) {
        const permission = await Notification.requestPermission();
        if (permission === 'denied')
          throw Error(
            'Autorisation refusée. Vous pouvez la modifier dans les paramètres du navigateur.'
          );
        if (permission !== 'granted') throw Error('La demande d’autorisation a été fermée.');
        if (!alive) return;
        const worker = await registerAppWorker();
        await navigator.serviceWorker.ready;
        if (!alive) return;
        const publicKey = Uint8Array.from(
          atob(config.vapid.replace(/-/g, '+').replace(/_/g, '/')),
          (c) => c.charCodeAt(0)
        );
        const existing = await worker.pushManager.getSubscription();
        const subscription =
          existing ??
          (await worker.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: publicKey
          }));
        if (!alive) {
          if (!existing) await subscription.unsubscribe().catch(() => {});
          return;
        }
        await api.action({ action: 'connect', channel: 'web', destination: subscription.toJSON() });
        await api.saveWeb(
          prefs?.enabled
            ? prefs
            : {
                ...prefs,
                enabled: true,
                daily_summary: true,
                essential: false,
                favorite_reminders: false,
                daily_challenge_reminder: false
              }
        );
      } else {
        await api.disconnectWeb();
        if (supported) {
          const worker = await navigator.serviceWorker.getRegistration();
          const subscription = await worker?.pushManager.getSubscription();
          await subscription?.unsubscribe();
        }
      }
      await refresh();
      toast(
        e.target.matches('[data-daily-summary]')
          ? enable
            ? 'Résumé de 9 h activé.'
            : 'Résumé de 9 h désactivé.'
          : e.target.matches('[data-web-essential]')
            ? 'Préférences push enregistrées.'
            : reminder
              ? enable
                ? 'Rappels des favoris activés.'
                : 'Rappels des favoris désactivés.'
              : enable
                ? 'Notifications push activées.'
                : 'Notifications push désactivées.'
      );
    } catch (error) {
      feedback = error.message;
      await refresh().catch(() => {});
      if (alive) toast(feedback);
    } finally {
      busy = false;
      render();
    }
  };
  const stop = (event) => {
    if (event.target.matches('[data-stop-web]')) change(event);
  };
  const onVisibility = async () => {
    if (document.hidden || busy || !alive) return;
    await refresh().catch(() => {});
    if (alive && !busy) render();
  };
  root.addEventListener('change', change);
  root.addEventListener('click', stop);
  if (supported) document.addEventListener('visibilitychange', onVisibility);
  return {
    destroy() {
      alive = false;
      root.removeEventListener('change', change);
      root.removeEventListener('click', stop);
      if (supported) document.removeEventListener('visibilitychange', onVisibility);
    }
  };
}
