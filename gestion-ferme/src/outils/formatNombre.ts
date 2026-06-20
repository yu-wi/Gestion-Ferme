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
