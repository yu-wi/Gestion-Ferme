-- Retour arriere de l'automatisation des totaux.
-- Les donnees existantes ne sont pas supprimees.

drop trigger if exists actualiser_totaux_mortalites_volailles
on public.mortalites_volailles;

drop trigger if exists actualiser_totaux_livraisons_volailles
on public.livraisons_volailles;

drop trigger if exists actualiser_totaux_lot_volaille
on public.lots_volailles;

drop function if exists public.actualiser_totaux_depuis_mouvement_volaille();
drop function if exists public.actualiser_totaux_avant_modification_lot_volaille();
drop function if exists public.recalculer_totaux_lot_volaille(uuid);
