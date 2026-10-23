// Connexion et inscription (BET-46) : règles pures, sans DOM ni réseau. Utilisées par join.js (interface) et account.js (Supabase).
export const NICKNAME_RE = /^[A-Za-zÀ-ÿ0-9_. -]{3,24}$/;
export const validNickname = value => typeof value === 'string' && NICKNAME_RE.test(value) && value.trim() === value;
export const validEmail = value => typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
const COMMON_PASSWORDS = ['password', 'motdepasse', '12345678', '123456789', 'azertyuiop', 'azerty123', 'qwertyuiop', 'password1', 'betmaster', 'football1'];
export const STRENGTH_LABELS = ['Très faible', 'Faible', 'Correct', 'Bon', 'Solide'];
// Solidité d'un mot de passe de 0 à 4 ; ok = longueur minimale de 8 caractères respectée et mot de passe non banal.
export function passwordStrength(value) {
  const password = String(value ?? ''), common = COMMON_PASSWORDS.includes(password.toLowerCase());
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-zà-ÿ]/.test(password) && /[A-ZÀ-Ý]/.test(password)) score++;
  if (/\d/.test(password) && /[^A-Za-zÀ-ÿ0-9]/.test(password)) score++;
  if (common || password.length < 8) score = Math.min(score, password.length < 8 ? 1 : 0);
  return { score, label: STRENGTH_LABELS[score], ok: password.length >= 8 && !common };
}
// Messages d'erreur Supabase traduits : aucune erreur n'est affichée en anglais.
export function translateAuthError(error) {
  const text = String(error?.message ?? error ?? '').toLowerCase(), code = String(error?.code ?? '').toLowerCase(), status = Number(error?.status ?? 0);
  if (code === 'invalid_credentials' || text.includes('invalid login credentials')) return 'Email ou mot de passe incorrect.';
  if (code === 'user_already_exists' || code === 'email_exists' || text.includes('already registered') || text.includes('already been registered')) return 'Un compte existe déjà avec cet email : connectez-vous ou réinitialisez votre mot de passe.';
  if (text.includes('same password') || code === 'same_password') return 'Choisissez un mot de passe différent de l’ancien.';
  if (code === 'weak_password' || text.includes('password should be') || text.includes('weak password')) return 'Mot de passe trop faible : 8 caractères au moins, avec des lettres et des chiffres.';
  if (code === 'email_not_confirmed' || text.includes('email not confirmed')) return 'Adresse email non confirmée : ouvrez le lien reçu par email ou demandez un nouvel envoi.';
  if (status === 429 || code.includes('rate_limit') || text.includes('rate limit') || text.includes('too many') || text.includes('security purposes')) return 'Trop de tentatives : patientez quelques minutes avant de réessayer.';
  if (text.includes('failed to fetch') || text.includes('networkerror') || text.includes('network request failed') || text.includes('load failed') || error?.name === 'TypeError') return 'Problème de connexion : vérifiez votre réseau puis réessayez.';
  if (text.includes('signup') && text.includes('disabled')) return 'Les inscriptions sont momentanément fermées.';
  if (text.includes('invalid email') || code === 'validation_failed' && text.includes('email')) return 'Adresse email invalide.';
  if (text.includes('jwt') || text.includes('session') && text.includes('missing')) return 'Votre session a expiré : reconnectez-vous.';
  return 'Une erreur est survenue : réessayez dans un instant.';
}
// Étapes d'inscription : l'étape Avatar n'existe qu'avec le personnage 3D livré (aucun avatar simplifié proposé).
export const signupSteps = (avatarStudio = false) => avatarStudio ? ['identity', 'avatar', 'preferences'] : ['identity', 'preferences'];
export function validateIdentity({ nickname = '', email = '', password = '', adult = false }) {
  const errors = {};
  if (!validNickname(nickname)) errors.nickname = 'Le pseudo compte 3 à 24 caractères : lettres, chiffres, espace, point, tiret ou souligné.';
  if (!validEmail(email)) errors.email = 'Saisissez une adresse email valide.';
  if (!passwordStrength(password).ok) errors.password = password.length < 8 ? `Mot de passe trop court (${password.length}/8 caractères).` : 'Ce mot de passe est trop courant.';
  if (!adult) errors.adult = 'Vous devez avoir 18 ans ou plus pour créer un compte.';
  return { ok: !Object.keys(errors).length, errors };
}
export const RISK_STYLES = { prudent: 'safe', equilibre: 'balanced', audacieux: 'bold' };
export const STYLE_LABELS = { safe: 'Prudent', balanced: 'Équilibré', bold: 'Audacieux' };
// Préférences de l'inscription, nettoyées avant d'être envoyées au serveur ou appliquées : club de cœur, compétitions suivies, style de jeu.
export function sanitizePreferences(value = {}, knownLeagues = []) {
  const club = value.club && /^\d{1,8}$/.test(String(value.club.id ?? '')) ? { id: String(value.club.id), name: String(value.club.name ?? '').slice(0, 40) } : null;
  const leagues = [...new Set((Array.isArray(value.leagues) ? value.leagues : []).map(String).filter(name => !knownLeagues.length || knownLeagues.includes(name)))].slice(0, 25);
  return { club: club?.name ? club : null, leagues, style: ['safe', 'balanced', 'bold'].includes(value.style) ? value.style : 'balanced' };
}
