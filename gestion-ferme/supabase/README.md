# Supabase

Ce dossier contient des notes de securite pour preparer la base de donnees.

## Important

Ne pas activer les politiques RLS sans verifier le mode d'acces souhaite.

Aujourd'hui, l'application utilise la cle `anon` Supabase cote navigateur et ne contient pas encore d'ecran de connexion. Si les tables sont bloquees aux seuls utilisateurs authentifies, l'interface ne pourra plus lire ni enregistrer les donnees tant que l'authentification n'est pas ajoutee.

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

Les quantites sont en kilogrammes. Le stock est calcule avec les livraisons
moins les consommations quotidiennes.
