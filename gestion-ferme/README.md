# Gestion SCEA La Ferme de Bernard

## Fiche de clôture SICA

Dans l'analyse complète d'un lot archivé, « Fiche PDF / imprimer » ouvre une
fiche dédiée : choisir « Enregistrer au format PDF » dans le navigateur.
« Fiche Excel » télécharge un classeur avec les onglets Synthèse, Production,
Charges, Livraisons, Mortalités, Consommations et Tarifs. Les montants et statuts
reprennent les calculs de l'analyse et les tarifs figés lorsqu'ils existent.

La fiche reste provisoire si des charges ou des recettes manquent, si des charges
restent à valider, si les tarifs ne sont pas figés, si la quantité retenue n'est
pas renseignée ou si le lot conserve des sujets / n'a aucune livraison. Une
valeur zéro saisie reste distincte d'une donnée absente. L'export ne valide ni
ne clôture le lot et n'écrit aucune donnée dans Supabase.

Interface React/Vite pour suivre les ateliers de l'exploitation agricole, avec une base de données Supabase et une publication possible sur Vercel.

## Configuration locale

1. Copier le fichier `.env.example` vers `.env`.
2. Renseigner les variables Supabase :

```env
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre-cle-anon-supabase

# Secours temporaire pendant l'installation de la connexion multi-utilisateurs
VITE_AUTH_USERNAME=mon-identifiant
VITE_AUTH_EMAIL=compte-supabase@exemple.com
```

La connexion principale utilise maintenant les profils Supabase et la fonction
Edge `username-login`. Les variables `VITE_AUTH_USERNAME` et
`VITE_AUTH_EMAIL` servent uniquement de secours pendant la migration.

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
   - temporairement : `VITE_AUTH_USERNAME` et `VITE_AUTH_EMAIL`
4. Vercel publiera automatiquement l'interface a chaque mise a jour du depot.

## Notes de securite

- Le fichier `.env` ne doit pas etre envoye sur GitHub.
- La cle `anon` Supabase peut etre utilisee cote navigateur, mais les regles RLS de Supabase doivent proteger les tables.
- Les droits d'acces Supabase sont a verifier avant une utilisation en production.
- Le dossier `supabase/` contient une proposition de politiques RLS a appliquer seulement apres verification du mode d'authentification souhaite.

## Notes Vercel

- Le fichier `vercel.json` redirige les routes React vers `index.html`.
- La configuration Vite separe les principales bibliotheques en plusieurs fichiers pour limiter les alertes de taille au build.

## Authentification multi-utilisateurs

L'installation detaillee se trouve dans `supabase/README.md`.

Chaque utilisateur possede :

- un compte Supabase Auth avec son adresse et son mot de passe ;
- un identifiant libre stocke dans `app_profiles` ;
- un nom affiche ;
- un role `admin` ou `user`.

La table des profils n'est pas accessible aux visiteurs non connectes. La
correspondance entre identifiant et adresse est realisee dans une fonction Edge
cote Supabase.

## Vente directe

Avant la premiere utilisation de la page `Volailles > Vente directe`, executer
le fichier `supabase/vente-directe.sql` dans l'editeur SQL de Supabase.
Ce fichier peut etre execute de nouveau apres une mise a jour : les ajouts de
colonnes et les politiques sont prevus pour ne pas effacer les donnees saisies.

Ce module conserve des tables separees pour les lots, les clients, les
commandes et les livraisons. Les donnees des lots destines a la cooperative ne
sont pas modifiees.

Les lots actifs de vente directe sont aussi proposes dans la page Alimentation.
Leurs consommations utilisent le stock commun et sont incluses dans les
previsions a sept jours.

Si le module Vente directe est deja installe, le script court
`supabase/alimentation-vente-directe.sql` suffit pour activer cette liaison.

### Saisie quotidienne groupée

La rubrique **Volailles → Saisie quotidienne** (`/volailles/saisie-quotidienne`),
également accessible depuis le résumé, rassemble les lots SICA actifs et les lots
vente directe non terminés ayant encore des sujets. La date utilise le fuseau
Martinique. Les sacs sont entiers de 25 kg ; les champs vides ou à zéro ne créent
pas de mouvement. Chaque lot peut recevoir un aliment et une mortalité par saisie.
Les journées de transition avec plusieurs aliments restent accessibles dans le
formulaire individuel d’alimentation.

**Activation préalable** : exécuter [supabase/saisie-quotidienne.sql](supabase/saisie-quotidienne.sql)
dans Supabase SQL Editor après les migrations alimentation et vente directe
(colonnes `source_type` et `direct_sale_lot_id` sur `consommations_aliment`).
Le script est réexécutable et ne modifie pas les données existantes. Sans cette
activation, la page affiche un message et n’effectue aucune écriture partielle.

La fonction SQL utilise les permissions et politiques RLS de l’utilisateur
connecté (`security invoker`). Elle vérifie la date d’arrivée, l’activité des
lots, leurs effectifs et le stock cumulé. Les tables concernées sont verrouillées
pendant la transaction courte pour éviter une modification concurrente entre
contrôle et écriture. Les consommations, mortalités et totaux sont enregistrés
ensemble ou tous annulés. Un identifiant de tentative rend le renvoi de la même
requête sans effet supplémentaire après une réponse réseau perdue. La nouvelle
table `daily_entry_batches` conserve cet identifiant et son contenu, visible
uniquement par son auteur et sans droit client de modification/suppression.

Une consommation ou une mortalité déjà enregistrée pour le lot et la date est
signalée : sa correction se fait dans les formulaires individuels existants.
Les mouvements insérés restent visibles dans les suivis habituels et dans le
journal lorsque ses triggers sont activés.

Vérification : `node --test tests/*.test.mjs` et `npm run build`.
Le test transactionnel PostgreSQL local est fourni dans
`tests/saisie-quotidienne-database.mjs` (instructions en tête du fichier).
