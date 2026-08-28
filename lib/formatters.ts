export function formatCurrency(value: number | null, currency = "EUR") {
  if (value === null || Number.isNaN(value)) {
    return "-";
  }

  return new Intl.NumberFormat("en", {
    style: "currency",
    currency
  }).format(value);
}

export function formatNumber(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "-";
  }

  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 6
  }).format(value);
}

export function formatPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "-";
  }

  return `${new Intl.NumberFormat("en", {
    maximumFractionDigits: 2
  }).format(value)}%`;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium"
  }).format(new Date(`${value}T00:00:00`));
}
