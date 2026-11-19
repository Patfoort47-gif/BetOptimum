# Messages Supabase Auth

Les modèles de confirmation, de récupération, de connexion par lien et de changement d’adresse se trouvent dans `supabase/templates/`. Le bouton et le lien de secours utilisent `{{ .ConfirmationURL }}`. Le changement d’adresse utilise aussi `{{ .NewEmail }}`. Les fichiers texte servent de référence. Supabase Auth ne propose pas de champ distinct pour les publier en multipart.

Publier les seules paires objet/contenu des modèles approuvés via la configuration Auth du projet. Relire les valeurs après écriture et conserver les anciennes en lieu sûr pour un retour arrière. Les autres modèles, redirections, limites et réglages SMTP sont indépendants de cette opération.

Le projet utilise un SMTP personnalisé. Contrôler sur un compte de recette consenti les redirections, l’expiration, le renvoi et le rendu Gmail, Outlook et Apple Mail, en clair et sombre avec images désactivées. Vérifier l’identité d’envoi et les résultats SPF, DKIM et DMARC d’un message reçu. Éviter de conserver les liens ou jetons dans les comptes rendus.
