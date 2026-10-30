# BET-105 · Dates et seuils

Toutes les dates publiques sont rendues en Europe/Paris ; l’heure de téléchargement du navigateur n’est jamais utilisée comme fraîcheur de source.

- Calendrier : ancien après 26 h ; génération du flux distincte des dates de cotes.
- Scores consolidés : ancien après 90 min ; date inconnue si scoresUpdatedAt est absent.
- Cotes : dernier créneau de 7 h, 14 h ou 19 h Paris dépassé de 45 min. Aucune attente de mise à jour nocturne. Tests été/hiver.
- Direct : affichage du temps depuis la réponse ESPN ; rafraîchissement habituel 20 s, échec explicite.
- Offres bookmaker : date fournisseur propre au marché conservée en cache. Une offre sans métadonnée reste de date inconnue, même si le flux global est récent.

Le bouton Actualiser relit le JSON publié ; il ne contacte jamais un fournisseur payant. Les incidents de collecte (quota, clés GitHub Actions, erreur du fournisseur) doivent être diagnostiqués dans le workflow : aucun secret ni journal fournisseur brut n’est publié côté navigateur.
