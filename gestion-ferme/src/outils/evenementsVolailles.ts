export type RegleSuiviVolaille = {
  key: "vaccin" | "rappel" | "analyse" | "livraison";
  title: string;
  jour: number;
  icon: string;
  tone: "warning" | "info";
};

export type EvenementVolaille = {
  key: string;
  title: string;
  date: Date;
};

export const REGLES_SUIVI_VOLAILLES: RegleSuiviVolaille[] = [
  { key: "vaccin", title: "Vaccin", jour: 15, icon: "✚", tone: "warning" },
  { key: "rappel", title: "Rappel vaccin", jour: 25, icon: "↻", tone: "warning" },
  { key: "analyse", title: "Analyse", jour: 47, icon: "⌕", tone: "warning" },
  { key: "livraison", title: "Livraison", jour: 70, icon: "🚚", tone: "info" },
];

export const CLES_EVENEMENTS_VOLAILLES = [
  "reception",
  "ouverture-poussiniere",
  ...REGLES_SUIVI_VOLAILLES.map((regle) => regle.key),
];

export function dateDepuisArrivee(dateArrivee: string, jours: number) {
  const date = new Date(`${dateArrivee}T00:00:00`);
  date.setDate(date.getDate() + jours);
  return date;
}

export function genererEvenementsVolailles(
  dateArrivee: string
): EvenementVolaille[] {
  return [
    {
      key: "reception",
      title: "Réception",
      date: dateDepuisArrivee(dateArrivee, 0),
    },
    {
      key: "ouverture-poussiniere",
      title: "Ouverture poussinière",
      date: dateDepuisArrivee(dateArrivee, 15),
    },
    ...REGLES_SUIVI_VOLAILLES.map((regle) => ({
      key: regle.key,
      title: regle.title,
      date: dateDepuisArrivee(dateArrivee, regle.jour),
    })),
  ];
}
