# BET-383 · Proposition de synchronisation

En mode invité, Mes paris propose la synchronisation après une simulation
sauvegardée sur l’appareil. Le lien ouvre l’inscription existante et conserve
l’accès à la connexion. « Continuer en invité » masque la proposition sur cet
appareil. Au retour de la connexion ou de la confirmation sur le même appareil,
le parcours revient à Mes paris. La copie privée de la simulation reste
distincte des paris certifiés. Aucun écran de notifications ne fait partie de
ce parcours.

## Recette volontaire

Présenter le but de l’étude et demander l’accord pour le relevé manuel. Dans
chaque semaine et selon la disponibilité des matchs au premier chargement,
répartir les nouveaux participants entre les liens `?etude-sync=proposition` et
`?etude-sync=temoin`. Le témoin conserve l’accès ordinaire à la création d’un
compte dans Mes paris. Partir d’un profil de navigateur vierge. Relever les
données locales de `localStorage.getItem('betoptimum-sync-study')` avec le
participant. La page ne transmet aucun rapport. La fiche de recette expire
après quatorze jours et peut être effacée avec les données du site.

| Indicateur | Définition |
| --- | --- |
| Cohorte | Taille par semaine civile d’arrivée, groupe et calendrier avec ou sans match affichable |
| Éligibilité et exposition | Simulation sauvegardée suivie d’une ouverture de Mes paris, puis proposition affichée dans le groupe qui y a accès |
| Intention | Clic vers la synchronisation ou vers la création du compte depuis Mes paris après une simulation |
| Compte créé | Inscription achevée dans l’interface ou confirmation reçue sur le même appareil |
| Retour utile J7 | Analyse ouverte ou résultats consultés volontairement le septième jour civil après l’arrivée, en heure de Paris |

Pour chaque cohorte, publier les effectifs et les dénominateurs. Attendre J7
avant d’inclure un participant dans le taux de retour. Séparer les retours
inobservables (autre appareil, données effacées, relevé non fourni) des
absences de retour. Avec peu de participants, relever sur téléphone le premier
geste, la compréhension de la copie privée et la capacité à rester invité.
Aucune donnée de rétention n’est disponible au jour du déploiement.
