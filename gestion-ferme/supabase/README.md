# Supabase

Ce dossier contient des notes de securite pour preparer la base de donnees.

## Connexion par identifiant et profils

La connexion multi-utilisateurs utilise :

- `app_profiles` pour associer un identifiant libre a un compte Supabase ;
- la fonction Edge `username-login` pour resoudre cet identifiant sans exposer
  l'adresse courriel dans le navigateur ;
- Supabase Auth pour verifier le mot de passe et creer la session.

Ordre d'installation :

1. Executer `user-profiles.sql` dans le SQL Editor.
2. Creer le compte dans `Authentication > Users`.
3. Associer son identifiant depuis le SQL Editor :

```sql
select public.set_app_user_profile(
  'adresse-du-compte@exemple.com',
  'identifiant',
  'Nom affiche',
  'admin'
);
```

4. Deployer la fonction :

```bash
supabase functions deploy username-login --no-verify-jwt
```

5. Executer `check-user-profiles.sql`.
6. Tester la connexion par identifiant avant de supprimer les anciennes
   variables `VITE_AUTH_USERNAME` et `VITE_AUTH_EMAIL` de Vercel.
7. Apres validation, executer `rls-app-users.sql` pour limiter les donnees aux
   profils actifs.

Pour ajouter un autre utilisateur, creer son compte dans Authentication puis
executer de nouveau `set_app_user_profile` avec un identifiant different et le
role `user` ou `admin`.

Pour desactiver un compte sans supprimer son historique :

```sql
update public.app_profiles
set is_active = false, updated_at = now()
where username = 'identifiant';
```

## Ordre conseille

1. Sauvegarder la base Supabase.
2. Ajouter une authentification si l'interface doit etre privee.
3. Activer RLS table par table.
4. Tester l'application avec un compte connecte.
5. Verifier que les operations principales fonctionnent :
   - consultation du planning ;
   - creation d'un lot de volailles ;
   - saisie de mortalite ;
   - saisie de livraison ;
   - ajout de charges ;
   - consultation historique/statistiques.

## Fichier fourni

`rls-authenticated.sql` propose une base simple : autoriser uniquement les utilisateurs connectes a lire et modifier les tables utilisees par l'application.

## Totaux automatiques des volailles

Apres la creation des tables `mortalites_volailles` et `livraisons_volailles` :

1. Executer `volailles-automatic-totals.sql` dans le SQL Editor.
2. Executer `check-volailles-automatic-totals.sql`.
3. Verifier que la colonne `statut` affiche `OK` pour chaque lot.

Cette automatisation recalcule `nb_morts`, `sujets_restants` et
`total_poids_livre` apres chaque ajout, modification ou suppression.

`rollback-volailles-automatic-totals.sql` retire seulement cette
automatisation et ne supprime aucune donnee.

## Suivi et stock d'aliment

1. Executer `alimentation-stock-suivi.sql`.
2. Executer `check-alimentation-stock-suivi.sql`.
3. Verifier que les deux tables apparaissent avec le statut `OK`.

L'interface utilise des sacs de 25 kg. Les quantites restent stockees en
kilogrammes dans Supabase pour conserver la precision et la compatibilite des
donnees. Le stock est calcule avec les livraisons moins les consommations.

Pour gerer les references depuis l'interface :

1. Executer `feed-reference-management.sql`.
2. Executer `check-feed-reference-management.sql`.
3. Verifier que le statut affiche `OK`.

## Suppression definitive d'un lot

1. Executer `suppression-lot-volaille.sql`.
2. Executer `check-suppression-lot-volaille.sql`.
3. Verifier que le statut affiche `OK`.

La fonction supprime le lot et ses donnees rattachees dans une seule
transaction. En cas d'erreur, aucune suppression partielle n'est conservee.

## Nettoyage des anciennes tables

1. Executer `nettoyage-tables-inutilisees.sql`.
2. Verifier les deux tableaux de controle affiches par Supabase.

Le script supprime l'ancienne table `feed_consumption`, remplacee par
`consommations_aliment`, et liste les eventuelles autres tables publiques qui
ne sont pas appelees par l'interface actuelle.

Si le controle affiche encore `daily_tasks`, `feed_stock`,
`feed_stock_movements` ou `mortalites`, executer ensuite
`nettoyage-tables-anciennes-confirmation.sql`.
