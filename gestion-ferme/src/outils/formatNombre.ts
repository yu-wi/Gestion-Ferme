export function formatNombre(value: number, decimals = 0) {
  return Number(value || 0).toLocaleString("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatMontant(value: number) {
  return `${formatNombre(value, 2)} €`;
}

export function formatPoids(value: number, decimals = 2) {
  return `${formatNombre(value, decimals)} kg`;
}

export function formatDateCourte(date: Date) {
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
