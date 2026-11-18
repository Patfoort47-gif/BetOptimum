# BET-105 · Dates et seuils

Toutes les dates publiques sont rendues en Europe/Paris ; l’heure de téléchargement du navigateur n’est jamais utilisée comme fraîcheur de source.

- Calendrier : ancien après 26 h ; génération du flux distincte des dates de cotes.
- Scores consolidés : ancien après 90 min ; date inconnue si scoresUpdatedAt est absent.
- Cotes : dernier créneau de 6 h ou 18 h Paris dépassé de 45 min. Aucune attente de mise à jour nocturne. Tests été/hiver.
- Direct : affichage du temps depuis la réponse ESPN ; rafraîchissement habituel 20 s, échec explicite.
- Offres bookmaker : date fournisseur propre au marché conservée en cache. Une offre sans métadonnée reste de date inconnue, même si le flux global est récent.

Le bouton Actualiser relit le JSON publié ; il ne contacte jamais un fournisseur payant. Les incidents de collecte (quota, clés GitHub Actions, erreur du fournisseur) doivent être diagnostiqués dans le workflow : aucun secret ni journal fournisseur brut n’est publié côté navigateur.

## BET-361 : rattrapage et suivi des cotes

Les créneaux de référence restent 6 h et 18 h Paris. Un contrôle horaire léger (`27 * * * *`) relit les dates du calendrier et des cotes. Il rattrape un créneau absent ou une collecte retardée dès que le journal de quota permet une réservation : deux tentatives par 24 h, espacées de 12 h, huit requêtes maximum par tentative. Il ne force jamais le quota et ne relance pas un calendrier à jour. Les briefings ne sont pas envoyés par ce contrôle horaire ; une collecte manuelle ne les envoie pas non plus par défaut.

Le flux publie `oddsHealth` : date de contrôle, état fresh/cache/delayed/partial/unavailable, raison collecte/cache-quota et couverture des matchs à venir et du jour avec au moins une cote admissible. Un flux récemment généré ne rend pas les anciennes cotes fraîches et un jour sans cote réelle ne produit plus un statut fournisseur vert. Le résumé Actions conserve les dates, la couverture et les échecs, sans secret ni réponse fournisseur brute.

Des prix réels admissibles restent visibles même si le modèle n’a pas assez de données pour calculer une probabilité. Ils ne deviennent pas des recommandations ni des paris sélectionnables sans probabilité. Les cotes estimées, le minimum de dix bookmakers et les expirations existantes restent inchangés.

Diagnostic : consulter le résumé du workflow Actualiser les matchs et `data/fixtures.json` (oddsRefreshedAt, oddsHealth, coverage, failures). Pour un rattrapage manuel, lancer update-fixtures sans forçage et avec notify_after_update=false ; vérifier la réservation puis la couverture réelle publiée. Un défaut de couverture ou un refus du fournisseur nécessite une intervention distincte et ne justifie jamais de fabriquer des prix.
