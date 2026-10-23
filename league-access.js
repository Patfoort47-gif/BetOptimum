// BET-92 : adhésions de championnat, erreurs explicites et récupération des réponses perdues.
const MESSAGES = {
  AUTH_REQUIRED: 'Reconnectez-vous pour rejoindre cette ligue.',
  LIGUE_FERMEE: 'Cette ligue n’est pas ouverte aux inscriptions.',
  SOLDE_INSUFFISANT: 'Vous n’avez pas assez de jetons pour rejoindre cette ligue.',
  LIGUES_MAX: 'Le service des ligues utilise encore une ancienne limite d’inscription. Contactez l’administrateur pour sa mise à jour : vos ligues actuelles sont conservées.'
};
export function leagueAccessError(error = {}) {
  const message = String(error.message ?? ''), code = String(error.code ?? '');
  const known = Object.keys(MESSAGES).find(key => message.includes(key));
  if (known) return Object.assign(new Error(MESSAGES[known]), { code: known });
  if (['PGRST301', 'PGRST302', 'PGRST303'].includes(code) || error.status === 401) return Object.assign(new Error(MESSAGES.AUTH_REQUIRED), { code: 'AUTH_REQUIRED' });
  if (['PGRST202', 'PGRST205', '42P01', '42883', '42501'].includes(code)) return Object.assign(new Error('Le service des ligues doit être mis à jour par l’administrateur. Vos inscriptions actuelles sont conservées.'), { code: 'LEAGUE_SETUP_REQUIRED' });
  if (code || Number(error.status) >= 400) return Object.assign(new Error(`Le service n’a pas pu enregistrer l’adhésion. ${/^[A-Z0-9_]{3,24}$/.test(code) ? `Référence : ${code}. ` : ''}Vos ligues actuelles sont conservées.`), { code: 'LEAGUE_SERVER_ERROR' });
  return Object.assign(new Error('La connexion au service des ligues a échoué. Réessayez dans un instant ; aucune nouvelle inscription n’a pu être confirmée.'), { code: 'LEAGUE_UNAVAILABLE' });
}

export function createLeagueJoiner(client, getUserId) {
  const pending = new Map();
  return function join(id) {
    const userId = getUserId();
    if (!userId) return Promise.reject(leagueAccessError({ message: 'AUTH_REQUIRED' }));
    const key = `${userId}:${id}`;
    if (pending.has(key)) return pending.get(key);
    const action = (async () => {
      let result;
      try { result = await client.rpc('join_special_league', { p_league: id }); }
      catch (error) { result = { error }; }
      if (!result.error) return result.data;
      // Le serveur a pu accepter l’inscription avant la coupure réseau ou le conflit d’un autre onglet.
      // Filtrer le joueur ET la ligue : les adhésions des autres joueurs sont publiques.
      try {
        const confirmed = await client.from('league_members').select('league_id').eq('user_id', userId).eq('league_id', id).maybeSingle();
        if (!confirmed.error && confirmed.data) return { joined: true };
      } catch { /* conserver l’erreur initiale */ }
      throw leagueAccessError(result.error);
    })();
    pending.set(key, action);
    action.then(() => pending.delete(key), () => pending.delete(key));
    return action;
  };
}
