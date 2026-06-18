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
