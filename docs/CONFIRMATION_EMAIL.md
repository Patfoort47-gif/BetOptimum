# Messages Supabase Auth

Les modèles de confirmation, de récupération, de connexion par lien et de changement d’adresse se trouvent dans `supabase/templates/`. Le bouton et le lien de secours utilisent `{{ .ConfirmationURL }}`. Le changement d’adresse utilise aussi `{{ .NewEmail }}`. Les fichiers texte servent de référence. Supabase Auth ne propose pas de champ distinct pour les publier en multipart.

Publier les seules paires objet/contenu des modèles approuvés via la configuration Auth du projet. Relire les valeurs après écriture et conserver les anciennes en lieu sûr pour un retour arrière. Les autres modèles, redirections, limites et réglages SMTP sont indépendants de cette opération.

Le projet utilise un SMTP personnalisé. Contrôler sur un compte de recette consenti les redirections, l’expiration, le renvoi et le rendu Gmail, Outlook et Apple Mail, en clair et sombre avec images désactivées. Vérifier l’identité d’envoi et les résultats SPF, DKIM et DMARC d’un message reçu. Éviter de conserver les liens ou jetons dans les comptes rendus.

## Modèles de réserve

| Modèle | Déclencheur et variables | Statut vérifié le 19 novembre 2026 |
| --- | --- | --- |
| Invitation Auth | Invitation administrative Supabase, `ConfirmationURL` | Modèle générique configuré. Le partage d’invitation privée dans PronoSafe suit un parcours distinct. |
| Réauthentification | Demande de réauthentification Supabase, `Token` | Modèle générique configuré. Aucun parcours appelant identifié dans l’application. |
| Changement de mot de passe | Avis après modification | Désactivé |
| Changement d’adresse | Avis après modification, `Email`, `OldEmail` | Désactivé. La confirmation du changement est un autre message. |
| Changement de téléphone | Avis après modification, `OldPhone`, `Phone` | Désactivé |
| Ajout ou retrait MFA | Avis associé, `FactorType` | Désactivé pour les deux modèles |
| Association ou retrait d’identité | Avis associé, `Email`, `Provider` | Désactivé pour les deux modèles |

Le propriétaire de la configuration Auth confirme les usages administratifs avant toute refonte ou activation des modèles de réserve.
