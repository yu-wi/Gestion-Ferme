# Gestion SCEA La Ferme de Bernard

Interface React/Vite pour suivre les ateliers de l'exploitation agricole, avec une base de données Supabase et une publication possible sur Vercel.

## Configuration locale

1. Copier le fichier `.env.example` vers `.env`.
2. Renseigner les variables Supabase et la correspondance de connexion :

```env
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre-cle-anon-supabase
VITE_AUTH_USERNAME=mon-identifiant
VITE_AUTH_EMAIL=compte-supabase@exemple.com
```

`VITE_AUTH_USERNAME` peut contenir l'identifiant librement choisi.
`VITE_AUTH_EMAIL` doit contenir l'adresse du compte créé dans Supabase.
L'adresse n'est jamais demandée dans l'écran de connexion.

3. Installer les dependances :

```bash
npm install
```

4. Lancer l'interface :

```bash
npm run dev
```

## Publication avec Vercel

1. Envoyer ce projet sur GitHub.
2. Connecter le depot GitHub a Vercel.
3. Ajouter les variables d'environnement dans Vercel :
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_AUTH_USERNAME`
   - `VITE_AUTH_EMAIL`
4. Vercel publiera automatiquement l'interface a chaque mise a jour du depot.

## Notes de securite

- Le fichier `.env` ne doit pas etre envoye sur GitHub.
- La cle `anon` Supabase peut etre utilisee cote navigateur, mais les regles RLS de Supabase doivent proteger les tables.
- Les droits d'acces Supabase sont a verifier avant une utilisation en production.
- Le dossier `supabase/` contient une proposition de politiques RLS a appliquer seulement apres verification du mode d'authentification souhaite.

## Notes Vercel

- Le fichier `vercel.json` redirige les routes React vers `index.html`.
- La configuration Vite separe les principales bibliotheques en plusieurs fichiers pour limiter les alertes de taille au build.

## Authentification

L'application affiche maintenant un ecran de connexion avant les pages de gestion.

Avant de deployer cette version, verifier dans Supabase :

1. Aller dans `Authentication > Providers`.
2. Activer `Email`.
3. Creer le ou les comptes autorises dans `Authentication > Users`.
4. Utiliser ces identifiants sur l'ecran de connexion de l'application.

Cette version ne propose pas d'inscription publique depuis l'interface.
