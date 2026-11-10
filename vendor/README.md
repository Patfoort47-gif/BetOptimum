# Bibliothèques navigateur figées · BET-302

Supabase JS 2.81.1 (bundle ESM navigateur, esbuild 0.25.12) et Three.js 0.170.0 (fichier officiel du paquet npm). Aucune importation distante à l’exécution. Licences MIT et dépendances dans LICENSES.json ; sommes SHA-256 dans SHA256.json. Les versions et intégrités npm sont verrouillées dans package-lock.json. Aucun secret dans ces fichiers.

Reconstruction depuis la racine, Node 22 ou supérieur :

```sh
mkdir -p work/vendor-build
cp vendor/package*.json work/vendor-build/
npm ci --prefix work/vendor-build
VENDOR_MODULES=work/vendor-build/node_modules node scripts/build-vendor.mjs
```

Le site reste statique, sans installation npm ni compilation lors du déploiement. Toute mise à jour des bibliothèques exige une modification explicite des versions et une nouvelle recette des parcours de connexion. Les manifestes et outils de compilation ne sont pas publiés.
