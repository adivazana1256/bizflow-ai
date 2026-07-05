// Money is stored as integer minor units. Format for display only.
export function formatMoney(minor: number, currency: string): string {
  const symbol = currency === "USD" ? "$" : `${currency} `;
  return `${symbol}${(minor / 100).toFixed(2)}`;
}
