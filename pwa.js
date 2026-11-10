let registration = null;
export function registerAppWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator))
    return Promise.reject(Error('Service worker indisponible'));
  return (registration ??= navigator.serviceWorker
    .register(new URL('./notification-sw.js', import.meta.url), {
      scope: new URL('./', import.meta.url).pathname
    })
    .catch((e) => {
      registration = null;
      throw e;
    }));
}
export function initPwa() {
  if (typeof window === 'undefined') return;
  registerAppWorker().catch(() => {});
  const display = window.matchMedia('(display-mode: standalone)'),
    ios =
      /iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
    android = /Android/.test(navigator.userAgent),
    safari =
      /Safari/.test(navigator.userAgent) &&
      !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/.test(navigator.userAgent),
    dialog = document.querySelector('#install-guide');
  let installPrompt = null,
    installedHere = false,
    busy = false,
    dismissed = false,
    visits = 0,
    returnFocus = null;
  try {
    dismissed = sessionStorage.getItem('betoptimum-install-dismissed') === '1';
    if (!sessionStorage.getItem('betoptimum-visit')) {
      sessionStorage.setItem('betoptimum-visit', '1');
      localStorage.setItem(
        'betoptimum-visits',
        String(Number(localStorage.getItem('betoptimum-visits') ?? 0) + 1)
      );
    }
    visits = Number(localStorage.getItem('betoptimum-visits') ?? 0);
  } catch {}
  const installed = () => installedHere || display.matches || navigator.standalone;
  const removeBanner = () => document.querySelector('[data-install-banner]')?.remove();
  const dismiss = () => {
    dismissed = true;
    try {
      sessionStorage.setItem('betoptimum-install-dismissed', '1');
    } catch {}
    removeBanner();
  };
  const sync = () => {
    document.querySelectorAll('[data-install-app]').forEach((button) => {
      button.hidden = Boolean(installed());
      button.disabled = busy;
    });
    if (installed()) {
      removeBanner();
      if (dialog?.open) dialog.close();
    }
  };
  const show = () => {
    if (
      installed() ||
      dismissed ||
      visits < 2 ||
      document.querySelector('[data-install-banner]') ||
      (!ios && !installPrompt)
    )
      return;
    const banner = document.createElement('aside');
    banner.dataset.installBanner = '';
    banner.className = 'install-banner';
    banner.setAttribute('aria-label', 'Installer BetOptimum');
    banner.innerHTML = `<img src="icons/icon-192x192.png" width="48" height="48" alt=""><div class="install-banner-copy"><strong>BetOptimum sur votre écran d’accueil</strong><p>Retrouvez vos matchs en un geste, comme une application.</p></div><button type="button" class="button secondary" data-install-app>${ios ? 'Voir comment faire' : 'Installer l’application'}</button><button type="button" class="icon-button" data-dismiss-install aria-label="Fermer la proposition d’installation">×</button>`;
    document.querySelector('main')?.prepend(banner);
  };
  const shareIcon =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V3m-4 4 4-4 4 4M7 10H4v11h16V10h-3"/></svg>',
    menuIcon =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>',
    addIcon =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8m-4-4h8"/></svg>';
  const guide = (trigger, message = '') => {
    if (!dialog || installed()) return;
    returnFocus = trigger;
    dialog.querySelector('[data-install-intro]').textContent =
      message ||
      (ios
        ? safari
          ? 'Ajoutez BetOptimum depuis le menu de Safari.'
          : 'Ouvrez cette page dans Safari, puis suivez ces étapes.'
        : 'Ajoutez BetOptimum depuis le menu de votre navigateur.');
    const steps = ios
      ? [
          [
            shareIcon,
            'Ouvrez Partager',
            'Touchez l’icône de partage de Safari, éventuellement dans le menu de la page.'
          ],
          [
            addIcon,
            'Sur l’écran d’accueil',
            'Faites défiler les actions si cette option n’est pas visible.'
          ],
          [
            addIcon,
            'Touchez Ajouter',
            'Conservez « Ouvrir comme app » si cette option est proposée.'
          ]
        ]
      : android
        ? [
            [menuIcon, 'Ouvrez le menu ⋮', 'Dans Chrome, ouvrez le menu du navigateur.'],
            [
              addIcon,
              'Installer l’application',
              'Selon le navigateur, choisissez « Ajouter à l’écran d’accueil ».'
            ],
            [addIcon, 'Confirmez l’ajout', 'Validez la fenêtre affichée par votre téléphone.']
          ]
        : [
            [
              menuIcon,
              'Ouvrez le menu du navigateur',
              'Dans Chrome ou Edge, cherchez l’option d’installation dans le menu ou la barre d’adresse.'
            ],
            [addIcon, 'Installer BetOptimum', 'Cette option dépend de votre navigateur.'],
            [
              addIcon,
              'Confirmez l’installation',
              'Retrouvez ensuite BetOptimum parmi vos applications.'
            ]
          ];
    dialog.querySelector('[data-install-steps]').innerHTML = steps
      .map(
        ([icon, title, text]) =>
          `<li><span class="install-step-icon">${icon}</span><div><strong>${title}</strong><p>${text}</p></div></li>`
      )
      .join('');
    if (!dialog.open) dialog.showModal();
  };
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    if (installed()) return;
    installPrompt = event;
    show();
  });
  window.addEventListener('appinstalled', () => {
    installedHere = true;
    installPrompt = null;
    sync();
  });
  display.addEventListener?.('change', sync);
  dialog?.addEventListener('close', () => {
    if (returnFocus?.isConnected && !returnFocus.hidden) returnFocus.focus();
    else document.querySelector('[data-install-app]:not([hidden])')?.focus();
    returnFocus = null;
  });
  document.addEventListener('click', async (event) => {
    if (event.target.closest('[data-dismiss-install]')) {
      dismiss();
      return;
    }
    if (event.target.closest('[data-close-install-guide]')) {
      dialog?.close();
      return;
    }
    const trigger = event.target.closest('[data-install-app]');
    if (!trigger || installed() || busy) return;
    if (!installPrompt || ios) {
      guide(trigger);
      return;
    }
    const prompt = installPrompt;
    installPrompt = null;
    busy = true;
    sync();
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice?.outcome === 'accepted') removeBanner();
      else dismiss();
    } catch {
      guide(
        trigger,
        'L’invite d’installation est indisponible. Vous pouvez utiliser le menu de votre navigateur.'
      );
    } finally {
      busy = false;
      sync();
    }
  });
  sync();
  show();
}
