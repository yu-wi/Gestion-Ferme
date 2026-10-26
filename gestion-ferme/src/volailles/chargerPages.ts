// Supabase limite les réponses : parcourir toutes les pages pour ne pas tronquer les totaux.
export async function chargerPages<T>(
  requete: (debut: number, fin: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const resultat: T[] = [];
  const taille = 1000;
  for (let debut = 0; ; debut += taille) {
    const { data, error } = await requete(debut, debut + taille - 1);
    if (error) throw error;
    resultat.push(...(data || []));
    if (!data || data.length < taille) return resultat;
  }
}
