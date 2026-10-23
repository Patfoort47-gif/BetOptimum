// Page « Rejoindre le club » (BET-46) : connexion, inscription en étapes, mot de passe oublié, vérification d'email. Chargée à la demande par app.js.
// La logique de validation est dans auth-model.js (pure, testée) ; les appels Supabase passent par l'objet `auth` fourni par account.js.
import { RISK_STYLES, STYLE_LABELS, passwordStrength, sanitizePreferences, signupSteps, validNickname, validateIdentity, validEmail } from './auth-model.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const STYLE_COPY = { safe: ['Prudent', 'Des cotes basses et des pronos fiables'], balanced: ['Équilibré', 'Un mélange de sécurité et de value'], bold: ['Audacieux', 'Des cotes plus hautes, plus de risque'] };

export function initJoin({ auth, getTeams, getLeagues, avatarStudio = false, toast, onDone }) {
  const root = document.querySelector('#rejoindre'), content = root.querySelector('#join-content');
  let studio = null, mode = 'login', draft = { nickname: '', email: '', password: '', adult: false, club: null, leagues: [], style: 'balanced', avatar: null }, stepIndex = 0, busy = false, lastFocus = null, nicknameState = '', nicknameTimer = null, resendAt = 0, teamQuery = '';
  const steps = signupSteps(avatarStudio);

  const field = (id, label, input, hint = '', error = '') => `<label class="join-field" for="${id}"><span>${label}</span>${input}${hint ? `<small id="${id}-hint">${hint}</small>` : ''}<small class="join-error" id="${id}-error" role="alert">${escape(error)}</small></label>`;
  const passwordInput = (id, autocomplete) => `<span class="join-password"><input id="${id}" name="${id}" type="password" autocomplete="${autocomplete}" required minlength="8" value="${id === 'join-password' && mode !== 'recovery' ? escape(draft.password) : ''}" aria-describedby="${id}-error"><button type="button" class="text-button" data-toggle-password="${id}" aria-pressed="false">Afficher</button></span>`;
  const banner = (text, kind = 'error') => text ? `<p class="join-banner ${kind}" role="${kind === 'error' ? 'alert' : 'status'}">${escape(text)}</p>` : '';
  const tabs = () => `<div class="join-tabs" role="tablist"><button role="tab" aria-selected="${mode === 'login'}" data-mode="login">Se connecter</button><button role="tab" aria-selected="${mode === 'signup'}" data-mode="signup">Créer un compte</button></div>`;
  const google = '<button type="button" class="button secondary full join-google" data-google><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.2c0-.7-.1-1.3-.2-1.9H12v3.6h5.1a4.4 4.4 0 0 1-1.9 2.9v2.4h3.1c1.8-1.7 2.7-4.1 2.7-7z" fill="#4285F4"/><path d="M12 21.5c2.6 0 4.7-.9 6.3-2.3l-3.1-2.4c-.9.6-2 .9-3.2.9-2.5 0-4.6-1.7-5.3-3.9H3.5v2.5A9.5 9.5 0 0 0 12 21.5z" fill="#34A853"/><path d="M6.7 13.8a5.7 5.7 0 0 1 0-3.6V7.7H3.5a9.5 9.5 0 0 0 0 8.6z" fill="#FBBC05"/><path d="M12 6.4c1.4 0 2.7.5 3.7 1.4l2.8-2.8A9.5 9.5 0 0 0 3.5 7.7l3.2 2.5C7.4 8.1 9.5 6.4 12 6.4z" fill="#EA4335"/></svg>Continuer avec Google</button>';

  function view(state = {}) {
    const { error = '', info = '', errors = {} } = state;
    if (mode === 'login') return `${tabs()}<form id="join-form" novalidate><h2 id="join-title">Bon retour dans le club</h2>${banner(error)}${banner(info, 'info')}${field('join-email', 'Adresse email', `<input id="join-email" name="email" type="email" autocomplete="email" required value="${escape(draft.email)}" aria-describedby="join-email-error">`, '', errors.email)}${field('join-password', 'Mot de passe', passwordInput('join-password', 'current-password'), '', errors.password)}<button class="button primary full" type="submit" ${busy ? 'disabled' : ''}>${busy ? 'Connexion…' : 'Se connecter'}</button><button type="button" class="text-button" data-mode="forgot">Mot de passe oublié ?</button><p class="join-sep"><span>ou</span></p>${google}</form>`;
    if (mode === 'forgot') return `<form id="join-form" novalidate><button type="button" class="text-button" data-mode="login">← Retour</button><h2 id="join-title">Mot de passe oublié</h2><p class="muted">Saisissez votre email : si un compte existe, vous recevrez un lien pour choisir un nouveau mot de passe.</p>${banner(error)}${banner(info, 'info')}${field('join-email', 'Adresse email', `<input id="join-email" name="email" type="email" autocomplete="email" required value="${escape(draft.email)}">`, '', errors.email)}<button class="button primary full" type="submit" ${busy ? 'disabled' : ''}>Envoyer le lien</button></form>`;
    if (mode === 'recovery') return `<form id="join-form" novalidate><h2 id="join-title">Nouveau mot de passe</h2>${banner(error)}${field('join-password', 'Nouveau mot de passe', passwordInput('join-password', 'new-password'), '', errors.password)}<div class="join-meter" id="join-meter" aria-live="polite"></div>${field('join-password2', 'Confirmer le mot de passe', passwordInput('join-password2', 'new-password'), '', errors.password2)}<button class="button primary full" type="submit" ${busy ? 'disabled' : ''}>Enregistrer</button></form>`;
    if (mode === 'check') return `<div class="join-check"><h2 id="join-title">Vérifiez vos emails</h2><p>Nous avons envoyé un lien de confirmation à <strong>${escape(draft.email)}</strong>. Ouvrez-le : vous reviendrez ici, connecté.</p>${banner(error)}${banner(info, 'info')}<button class="button secondary full" data-resend ${busy ? 'disabled' : ''}>Renvoyer le lien</button><button class="text-button" data-mode="login">J’ai confirmé : me connecter</button></div>`;
    const step = steps[stepIndex], progress = `<ol class="join-steps" aria-label="Étapes de l’inscription">${steps.map((name, index) => `<li class="${index === stepIndex ? 'current' : index < stepIndex ? 'done' : ''}" ${index === stepIndex ? 'aria-current="step"' : ''}>${{ identity: 'Identité', avatar: 'Avatar', preferences: 'Préférences' }[name]}</li>`).join('')}</ol>`;
    if (step === 'identity') {
      const strength = passwordStrength(draft.password), nick = nicknameState === 'free' ? '<span class="ok">✓ Pseudo disponible</span>' : nicknameState === 'taken' ? '<span class="ko">Ce pseudo est déjà pris</span>' : nicknameState === 'checking' ? 'Vérification…' : '3 à 24 caractères, visible dans les classements';
      return `${tabs()}${progress}<form id="join-form" novalidate><h2 id="join-title">Créez votre identité</h2>${banner(error)}${field('join-nickname', 'Pseudo', `<input id="join-nickname" name="nickname" autocomplete="nickname" required maxlength="24" value="${escape(draft.nickname)}" aria-describedby="join-nickname-hint join-nickname-error">`, `<span id="join-nick-status">${nick}</span>`, errors.nickname)}${field('join-email', 'Adresse email', `<input id="join-email" name="email" type="email" autocomplete="email" required value="${escape(draft.email)}">`, '', errors.email)}${field('join-password', 'Mot de passe (8 caractères minimum)', passwordInput('join-password', 'new-password'), '', errors.password)}<div class="join-meter" id="join-meter" aria-live="polite"><i class="s${strength.score}"></i><span>${draft.password ? strength.label : ''}</span></div><label class="join-check-line"><input type="checkbox" name="adult" ${draft.adult ? 'checked' : ''}><span>J’ai 18 ans ou plus · paris virtuels sans argent réel</span></label><small class="join-error" role="alert">${escape(errors.adult ?? '')}</small><button class="button primary full" type="submit" ${busy ? 'disabled' : ''}>Continuer</button><p class="join-sep"><span>ou</span></p>${google}</form>`;
    }
    if (step === 'avatar') return `${tabs()}${progress}<form id="join-form" novalidate><button type="button" class="text-button" data-back>← Retour</button><h2 id="join-title">Créez votre joueur</h2><p class="muted">Visage, coiffure et maillot : vous pourrez tout changer, et débloquer bien plus, depuis votre profil.</p><div class="join-studio" data-join-studio></div><button class="button primary full">Continuer</button></form>`;
    const teams = getTeams().filter(team => !teamQuery || team.name.toLowerCase().includes(teamQuery)).slice(0, 12), leagues = getLeagues();
    return `${tabs()}${progress}<form id="join-form" novalidate><button type="button" class="text-button" data-back>← Retour</button><h2 id="join-title">Vos préférences</h2><p class="muted">Facultatif : elles servent à personnaliser vos favoris et vos suggestions.</p>${banner(error)}<fieldset><legend>Club de cœur</legend><input class="join-search" type="search" id="join-team-search" placeholder="Rechercher un club" value="${escape(teamQuery)}" aria-label="Rechercher un club"><div class="join-teams">${teams.map(team => `<button type="button" class="join-team${draft.club?.id === team.id ? ' selected' : ''}" data-team="${escape(team.id)}" data-team-name="${escape(team.name)}" aria-pressed="${draft.club?.id === team.id}"><img src="${escape(team.logo)}" alt="" width="28" height="28" loading="lazy">${escape(team.name)}</button>`).join('') || '<small>Aucun club trouvé : les clubs proposés sont ceux des matchs à venir.</small>'}</div></fieldset><fieldset><legend>Compétitions suivies</legend><div class="join-leagues">${leagues.map(name => `<label class="join-chip"><input type="checkbox" name="league" value="${escape(name)}" ${draft.leagues.includes(name) ? 'checked' : ''}><span>${escape(name)}</span></label>`).join('')}</div></fieldset><fieldset><legend>Style de jeu</legend><div class="join-styles">${Object.entries(STYLE_COPY).map(([key, [label, text]]) => `<label class="join-style"><input type="radio" name="style" value="${key}" ${draft.style === key ? 'checked' : ''}><span><b>${label}</b><small>${text}</small></span></label>`).join('')}</div></fieldset><button class="button primary full" type="submit" ${busy ? 'disabled' : ''}>${busy ? 'Création…' : 'Créer mon compte'}</button></form>`;
  }
  const stopStudio = () => { if (studio) { draft.avatar = studio.getConfig(); studio.destroy(); studio = null; } };
  async function mountAvatarStep() {
    const host = content.querySelector('[data-join-studio]'); if (!host) return;
    const [{ mountStudio }, config] = await Promise.all([import('./avatar-studio.js'), import('./avatar-config.js')]);
    if (!host.isConnected) return;
    const handle = await mountStudio(host, { html: escape, toast, initial: draft.avatar ?? config.defaultAvatar(), tabs: ['face', 'hair', 'kit'], freeOnly: true, stacked: true, hideActions: true, authenticated: false });
    if (!host.isConnected) { handle.destroy(); return; }
    studio = handle;
  }
  function render(state) { stopStudio(); content.innerHTML = view(state); if (mode === 'signup' && steps[stepIndex] === 'avatar') mountAvatarStep(); const first = content.querySelector('input:not([type=checkbox]):not([type=radio]):not([type=search])'); if (first && !state?.keepFocus) first.focus(); }
  const setMode = (next, state) => { mode = next; stepIndex = 0; render(state); };
  const fail = (error, extra = {}) => { busy = false; render({ error: error.message ?? String(error), keepFocus: false, ...extra }); };
  const syncDraft = form => { const data = new FormData(form); for (const key of ['nickname', 'email']) if (data.has(key)) draft[key] = String(data.get(key)); if (data.has('join-password') && mode !== 'recovery') draft.password = String(data.get('join-password')); if (form.querySelector('[name=adult]')) draft.adult = data.has('adult'); if (form.querySelector('[name=style]')) draft.style = String(data.get('style') ?? draft.style); if (form.querySelector('[name=league]')) draft.leagues = data.getAll('league').map(String); };
  const finish = async (event, user) => { busy = false; close(); onDone(event, user); };

  async function checkNickname() {
    clearTimeout(nicknameTimer);
    if (!validNickname(draft.nickname)) { nicknameState = ''; return; }
    nicknameState = 'checking'; updateNicknameLabel();
    nicknameTimer = setTimeout(async () => { const asked = draft.nickname; try { const free = await auth.nicknameAvailable(asked); if (asked === draft.nickname) nicknameState = free ? 'free' : 'taken'; } catch { nicknameState = ''; } updateNicknameLabel(); }, 400);
  }
  function updateNicknameLabel() { const label = content.querySelector('#join-nick-status'); if (label) label.innerHTML = nicknameState === 'free' ? '<span class="ok">✓ Pseudo disponible</span>' : nicknameState === 'taken' ? '<span class="ko">Ce pseudo est déjà pris</span>' : nicknameState === 'checking' ? 'Vérification…' : '3 à 24 caractères, visible dans les classements'; }
  function updateMeter() { const meter = content.querySelector('#join-meter'), input = content.querySelector('#join-password'); if (!meter || !input) return; const strength = passwordStrength(input.value); meter.innerHTML = `<i class="s${strength.score}"></i><span>${input.value ? strength.label : ''}</span>`; }

  content.addEventListener('input', event => {
    const target = event.target;
    if (target.id === 'join-nickname') { draft.nickname = target.value; nicknameState = ''; checkNickname(); }
    else if (target.id === 'join-password') updateMeter();
    else if (target.id === 'join-team-search') { teamQuery = target.value.trim().toLowerCase(); const form = target.form; syncDraft(form); const caret = target.selectionStart; render({ keepFocus: true }); const again = content.querySelector('#join-team-search'); again?.focus(); again?.setSelectionRange(caret, caret); }
  });
  content.addEventListener('click', async event => {
    const toggle = event.target.closest('[data-toggle-password]'), modeButton = event.target.closest('[data-mode]'), team = event.target.closest('[data-team]');
    if (toggle) { const input = content.querySelector(`#${toggle.dataset.togglePassword}`), show = input.type === 'password'; input.type = show ? 'text' : 'password'; toggle.textContent = show ? 'Masquer' : 'Afficher'; toggle.setAttribute('aria-pressed', String(show)); return; }
    if (modeButton) { const form = content.querySelector('#join-form'); if (form) syncDraft(form); setMode(modeButton.dataset.mode); return; }
    if (event.target.closest('[data-back]')) { syncDraft(content.querySelector('#join-form')); stepIndex = Math.max(0, stepIndex - 1); render({}); return; }
    if (team) { syncDraft(content.querySelector('#join-form')); draft.club = draft.club?.id === team.dataset.team ? null : { id: team.dataset.team, name: team.dataset.teamName }; render({ keepFocus: true }); return; }
    if (event.target.closest('[data-google]')) { try { await auth.google(); } catch (error) { fail(error); } return; }
    if (event.target.closest('[data-resend]')) {
      if (Date.now() < resendAt) { render({ error: `Patientez ${Math.ceil((resendAt - Date.now()) / 1000)} s avant un nouvel envoi.` }); return; }
      busy = true; render({}); try { await auth.resend(draft.email); resendAt = Date.now() + 30000; busy = false; render({ info: 'Lien renvoyé : pensez à vérifier vos courriers indésirables.' }); } catch (error) { fail(error); }
    }
  });
  content.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    const form = event.target;
    syncDraft(form);
    if (mode === 'login') {
      const errors = {}; if (!validEmail(draft.email)) errors.email = 'Saisissez une adresse email valide.'; if (!draft.password) errors.password = 'Saisissez votre mot de passe.'; if (Object.keys(errors).length) { render({ errors }); return; }
      busy = true; render({ keepFocus: true });
      try { const user = await auth.signIn(draft.email, draft.password); draft.password = ''; await finish('login', user); } catch (error) { draft.password = ''; fail(error); }
    } else if (mode === 'forgot') {
      if (!validEmail(draft.email)) { render({ errors: { email: 'Saisissez une adresse email valide.' } }); return; }
      busy = true; render({ keepFocus: true });
      try { await auth.reset(draft.email); busy = false; render({ info: 'Si un compte existe pour cette adresse, un lien vient d’être envoyé.' }); } catch (error) { fail(error); }
    } else if (mode === 'recovery') {
      const password = String(new FormData(form).get('join-password') ?? ''), again = String(new FormData(form).get('join-password2') ?? ''), errors = {};
      if (!passwordStrength(password).ok) errors.password = password.length < 8 ? `Mot de passe trop court (${password.length}/8 caractères).` : 'Ce mot de passe est trop courant.'; if (password !== again) errors.password2 = 'Les deux mots de passe sont différents.';
      if (Object.keys(errors).length) { render({ errors }); return; }
      busy = true; render({ keepFocus: true });
      try { await auth.updatePassword(password); await finish('recovery'); } catch (error) { fail(error); }
    } else if (steps[stepIndex] === 'identity') {
      const check = validateIdentity(draft);
      if (!check.ok) { render({ errors: check.errors }); return; }
      busy = true; render({ keepFocus: true });
      try { const free = await auth.nicknameAvailable(draft.nickname); busy = false; nicknameState = free ? 'free' : 'taken'; if (!free) { render({ errors: { nickname: 'Ce pseudo est déjà pris : choisissez-en un autre.' } }); return; } stepIndex++; render({}); } catch (error) { fail(error); }
    } else if (steps[stepIndex] === 'avatar') {
      stopStudio(); stepIndex++; render({});
    } else {
      busy = true; render({ keepFocus: true });
      const prefs = sanitizePreferences({ club: draft.club, leagues: draft.leagues, style: draft.style }, getLeagues());
      try { const result = await auth.signUp({ email: draft.email, password: draft.password, username: draft.nickname, prefs, avatar: draft.avatar }); draft.password = ''; if (result.confirmed) await finish('signup'); else { busy = false; mode = 'check'; render({}); } } catch (error) { fail(error); }
    }
  });
  root.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
  root.querySelector('.join-close').addEventListener('click', () => close());

  function open(nextMode = 'login') {
    lastFocus = document.activeElement; mode = nextMode; stepIndex = 0; busy = false;
    root.hidden = false; document.body.classList.add('join-open'); render({});
    if (location.hash !== '#rejoindre' && typeof history !== 'undefined') history.pushState({ join: true }, '', '#rejoindre');
  }
  function close() {
    stopStudio();
    if (root.hidden) return;
    root.hidden = true; document.body.classList.remove('join-open'); clearTimeout(nicknameTimer);
    if (location.hash === '#rejoindre' && typeof history !== 'undefined') history.replaceState(null, '', location.pathname + location.search);
    lastFocus?.focus?.();
  }
  addEventListener('popstate', () => { if (location.hash !== '#rejoindre') { root.hidden = true; document.body.classList.remove('join-open'); } });
  return { open, close, recovery: () => { open('recovery'); mode = 'recovery'; render({}); }, STYLE_LABELS, RISK_STYLES };
}
