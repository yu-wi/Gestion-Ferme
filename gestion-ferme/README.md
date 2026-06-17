# Gestion SCEA La Ferme de Bernard

Interface React/Vite pour suivre les ateliers de l'exploitation agricole, avec une base de données Supabase et une publication possible sur Vercel.

## Configuration locale

1. Copier le fichier `.env.example` vers `.env`.
2. Renseigner les deux variables Supabase :

```env
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre-cle-anon-supabase
```

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
4. Vercel publiera automatiquement l'interface a chaque mise a jour du depot.

## Notes de securite

- Le fichier `.env` ne doit pas etre envoye sur GitHub.
- La cle `anon` Supabase peut etre utilisee cote navigateur, mais les regles RLS de Supabase doivent proteger les tables.
- Les droits d'acces Supabase sont a verifier avant une utilisation en production.
- Le dossier `supabase/` contient une proposition de politiques RLS a appliquer seulement apres verification du mode d'authentification souhaite.

## Notes Vercel

- Le fichier `vercel.json` redirige les routes React vers `index.html`.
- La configuration Vite separe les principales bibliotheques en plusieurs fichiers pour limiter les alertes de taille au build.
