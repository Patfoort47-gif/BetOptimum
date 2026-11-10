import { ticketUrl } from './ticket-url.js';
const odd = (value) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    Number(value)
  );
export function shareSummary(bet) {
  const items = bet.items ?? [],
    combinedOdds = items.reduce((total, item) => total * Number(item.odd), 1);
  if (bet.betType === 'single')
    return items.length === 1
      ? `Pari simple : ${items[0].label} · cote ${odd(items[0].odd)}`
      : `${items.length} paris simples : ${items.map((item) => `${item.label} · cote ${odd(item.odd)}`).join(' ; ')}`;
  if (bet.betType === 'multiple')
    return `Pari multiple : ${items.length} sélections · formule ${bet.formula ?? bet.systemFormula ?? 'automatique'}`;
  return items.length === 1
    ? `Pari simple : ${items[0].label} · cote ${odd(items[0].odd)}`
    : `Combiné : ${items.length} sélections · cote ${odd(bet.odds ?? combinedOdds)}`;
}
export async function openTicketShare(bet, { baseUrl = location.href } = {}) {
  const options = { mode: bet.betType, formula: bet.formula ?? bet.systemFormula ?? 'auto' },
    link = ticketUrl(baseUrl, bet.items, options),
    summary = shareSummary(bet),
    message = `${summary}\n${link}`;
  const dialog = document.createElement('dialog');
  dialog.className = 'ticket-share-dialog';
  dialog.setAttribute('aria-label', 'Partager mon ticket');
  dialog.innerHTML =
    '<div class="modal-head"><h2>Partager mon ticket</h2><button class="icon-button" data-share-close aria-label="Fermer">×</button></div><p data-share-summary></p><p>Le destinataire choisit sa mise et vérifie les cotes actuelles. Aucun pari n’est placé à l’ouverture.</p><div class="ticket-share-link"><input readonly aria-label="Lien du coupon prérempli"><button class="button secondary" data-share-copy>Copier le texte et le lien</button></div><p role="status" data-share-status></p><div class="ticket-share-actions"><button class="button primary" data-share-native>Partager</button></div>';
  dialog.querySelector('[data-share-summary]').textContent = summary;
  dialog.querySelector('input').value = link;
  document.body.append(dialog);
  const previous = document.activeElement;
  dialog.addEventListener(
    'close',
    () => {
      dialog.remove();
      previous?.focus?.({ preventScroll: true });
    },
    { once: true }
  );
  dialog.querySelector('[data-share-close]').onclick = () => dialog.close();
  const status = dialog.querySelector('[data-share-status]');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      status.textContent = 'Texte et lien copiés.';
    } catch {
      const input = dialog.querySelector('input');
      input.focus();
      input.select();
      status.textContent = 'Copiez le lien sélectionné et le résumé affiché ci-dessus.';
    }
  };
  dialog.querySelector('[data-share-copy]').onclick = copy;
  const share = dialog.querySelector('[data-share-native]');
  share.hidden = typeof navigator.share !== 'function';
  share.onclick = async () => {
    try {
      await navigator.share({ title: 'Mon ticket BetOptimum', text: summary, url: link });
      status.textContent = 'Partage préparé.';
    } catch (error) {
      if (error.name !== 'AbortError')
        status.textContent = 'Partage indisponible. Copiez le texte et le lien.';
    }
  };
  dialog.showModal();
  return { link, summary, dialog };
}
