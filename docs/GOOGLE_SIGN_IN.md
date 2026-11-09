# Connexion Google (BET-259)

Cause constatée le 9 novembre 2026 : le fournisseur Google était désactivé dans Supabase et aucun client OAuth n’était configuré. L’adresse par défaut pointait encore vers l’ancien chemin `prono_patfoort`.

Le propriétaire a créé et publié son application Google, puis configuré le fournisseur Supabase. Configuration attendue :

- Origine JavaScript Google : `https://patfoort47-gif.github.io`.
- URI de redirection Google : `https://mvbpmirhjfmppdrmuksa.supabase.co/auth/v1/callback`.
- Site URL Supabase : `https://patfoort47-gif.github.io/BetOptimum/`.
- Redirect URL autorisée : cette même adresse. L’ancienne adresse reste autorisée pour les liens déjà envoyés.

Les identifiants OAuth restent exclusivement dans Supabase, jamais dans le code ni les journaux. Le site demande une connexion par `signInWithOAuth` vers son origine et son chemin. Le client Supabase restaure la session au retour ; les callbacks Auth sont différés pour éviter de bloquer son verrou interne. La création de profil est assurée par le déclencheur `creer_profil_inscription`, dont le pseudo généré est relu par l’application. La reconnexion n’insère aucun nouvel utilisateur depuis le navigateur.

Les annulations/refus Google sont distingués des liens email expirés. Le bouton bloque les doubles clics et redevient utilisable après un échec. Une erreur de chargement des données ne marque plus le compte comme déjà restauré.

Recette : inscription depuis ordinateur et téléphone avec un compte Google neuf, retour sur le site et profil utilisable ; déconnexion/reconnexion sans doublon ; annulation puis nouvelle tentative. Les tests automatisés couvrent classification et erreurs, ainsi que le bouton dans un navigateur avec Auth simulé. La validation complète d’une identité Google réelle exige le propriétaire du compte ; aucun mot de passe ou jeton ne doit être fourni à l’agent.

Contrôle de production sans connexion personnelle : la route Auth `/authorize?provider=google` atteint Google (HTTP 200), sans erreur de fournisseur désactivé ni de redirection. Ce contrôle ne remplace pas la validation d’une identité réelle.
