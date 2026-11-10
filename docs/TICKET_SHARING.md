# Partage d’un coupon (BET-260)

Le partage natif envoie uniquement un résumé textuel et l’URL du coupon. Un pari simple indique la sélection et sa cote ; un combiné indique le nombre de sélections et la cote totale. Aucune image n’est créée ni jointe. Aucune identité, bankroll ou mise ne figure dans le lien. Le destinataire choisit sa propre mise, vérifie les cotes actuelles et valide lui-même son pari.

## Ouverture

Le format V2 contient uniquement identifiants ESPN, marchés, cotes de référence, mode et formule. Les anciens liens V1 restent valides. Le calendrier frais est chargé avant restauration. Les sélections impossibles sont énumérées dans le coupon, les cotes modifiées indiquent avant/après, aucun marché n’est remplacé. Un lien malformé n’exécute aucun code. Le coupon s’ouvre dès que le tiroir mobile est prêt.

Avant connexion, un brouillon de session limité aux sélections et cotes est enregistré pour 24 h maximum. Le retour OAuth retrouve le coupon même lorsque l’URL de retour est nettoyée par Supabase. Effacer, se déconnecter ou confirmer le pari nettoie le brouillon. Aucun pari n’est validé automatiquement.

## Aperçus des liens

Page publique hébergée avec le skill Sites : `https://betoptimum-partage.honedchord2.chatgpt.site/`, projet `appgprj_6af1efca402481919a4c894a488f8ac3`, source dans son dépôt Sites. Le Worker utilise `ticket-preview.js` et `ticket-url.js` de ce dépôt ; recopier ces modules et reconstruire le Worker lors d’une évolution du format. Pas de secret ni accès aux comptes dans ce service, seulement les sélections du lien et l’adresse publique du PNG.

La page sert Open Graph et Twitter Card avec le vrai PNG, puis ouvre le coupon canonique dans BetOptimum par JavaScript (lien visible sans JavaScript). Elle n’accepte aucune destination de redirection arbitraire. Les robots lisent le HTML côté serveur sans exécuter le script. Le domaine Supabase standard réécrit le HTML en `text/plain` : la fonction Supabase n’est donc pas utilisée pour servir ces pages.

Depuis BET-261, le navigateur ne dépose plus d’image dans `ticket-previews` et partage toujours le lien direct. Le service ne stocke aucun identifiant de destinataire et ne contacte aucune messagerie. Les tests de partage natif simulent le système ; aucune conversation réelle n’est utilisée pour la recette.

**Accès public autorisé explicitement par le propriétaire le 10 novembre 2026.** Le service est accessible sans compte ChatGPT ; seuls les sélections et le visuel du coupon partagé y sont exposés.

## Stockage et purge

V61 après V60 : seau public PNG de 1,5 Mo maximum, dépôt authentifié lié au propriétaire, suppression par le propriétaire et aucune écriture anonyme. `ticket_preview_cleanup_candidates` est réservé au rôle service. La fonction Edge `ticket-preview`, POST seulement et secret de minuteur obligatoire, supprime les objets de plus de 30 jours ou dont le compte a été supprimé. `supabase/ticket-preview-cleanup.sql` programme le nettoyage horaire et lit le secret dans Vault. Les copies et caches des messageries restent hors du contrôle de l’application.

## Validation

Tests Node : V1/V2, syntaxe, doublons, prix de référence, mode/formule, résumé de partage et restauration avec indisponibles. Essais Chromium sur téléphone et ordinateur : un seul bouton, aucune image, texte adapté au simple ou au combiné, lien copiable et partage natif simulé.

L’affichage effectif d’un aperçu dépend du cache et des règles de la messagerie. Le lien direct recharge toujours les choix actuels disponibles ; les cotes enregistrées dans le visuel sont celles du partage.
