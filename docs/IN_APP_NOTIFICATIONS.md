# BET-268 : centre de notifications

La cloche apparaît pour les comptes connectés. Elle rassemble les nouveaux tickets gagnés/perdus, les reculs de rang confirmé dans une même saison et un même groupe, et les résultats de défis hebdomadaires. Chaque entrée ouvre Mes paris ou le classement/défi concerné. Marquage individuel ou global comme lu.

Source : réponses certifiées déjà chargées par `account.js`, sans nouvelle table ni migration. Le premier chargement constitue une référence et ne rejoue pas les anciens événements. Les consultations suivantes détectent les nouveautés, y compris après retour sur cet appareil. Les rangs provisoires et changements de saison/groupe ne déclenchent pas de fausse baisse.

Historique local limité à 100 entrées, isolé par identifiant de compte, conservé après rechargement mais masqué à la déconnexion. Aucun montant de mise ni bankroll dans les alertes. La confidentialité décrit ce stockage. Aucun push, email, permission navigateur ou nouveau service externe.

Les alertes suivent le rafraîchissement existant des comptes (notamment toutes les cinq minutes au premier plan) et ne constituent pas une livraison temps réel. L’historique n’est pas synchronisé entre appareils. Les défis sont signalés quand le serveur publie leur résultat de clôture. Les réponses échouées ne remplacent pas la dernière référence.
