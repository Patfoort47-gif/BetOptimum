# BET-269 : affiliation bookmaker

Intégration préparée et désactivée : le propriétaire ne dispose actuellement ni d’un partenaire ni d’un lien d’affiliation. Aucun bouton commercial n’apparaît en production dans cet état.

## Activation

Renseigner dans `affiliate.js` le nom du partenaire, son URL HTTPS contractuelle et les paramètres de tracking publics fournis par le partenaire. Aucun secret dans cette configuration. Activer `enabled` uniquement une fois ces éléments reçus et les mentions légales/Confidentialité adaptées au partenaire et aux données réellement transmises. Vérifier le lien de bout en bout avec le partenaire avant publication.

L’offre apparaît seulement après confirmation complète du pari virtuel par le serveur. Le clic ouvre le partenaire dans un nouvel onglet, sans référent, avec identification claire du lien d’affiliation. Aucun contact avec le partenaire avant le clic, aucun pixel ou SDK de tracking. Aucune identité, mise ou donnée de compte dans l’URL. L’état disparaît à la déconnexion.

Le préremplissage du coupon est optionnel et reste à développer si une API partenaire documentée le permet. Le lien actuel ne promet aucun transfert automatique de sélections ni conservation de cotes. La simulation reste distincte du pari réel, avec mentions 18+ et risques des jeux d’argent.

## Recette

Sans configuration : offre absente, même après confirmation. Configuration incomplète, URL non HTTPS ou avec identifiants : offre absente. Configuration valide : paramètres de tracking présents, mention d’affiliation, nouvel onglet et absence de référent. Aucun bouton avant confirmation serveur.
