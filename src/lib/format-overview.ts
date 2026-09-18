/** Formats a number using Indian digit grouping (e.g. 421611 -> "4,21,611"). */
export function formatIndianNumber(
  value: number | null | undefined,
  fractionDigits = 0
): string {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/** Formats a true-fraction measure (e.g. 0.032 -> "3.2") as a percentage number, no % sign. */
export function formatPercentValue(
  value: number | null | undefined,
  fractionDigits = 1
): string {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return (value * 100).toFixed(fractionDigits);
}

/** Formats a ratio/multiple measure (e.g. P/E, EV/EBITDA) with a fixed decimal count. */
export function formatRatio(
  value: number | null | undefined,
  fractionDigits = 1
): string {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return value.toFixed(fractionDigits);
}

/** Formats an integer rank, or "NA" when the company falls outside the ranked pool (e.g. LTI Rank). */
export function formatRank(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return 'NA';
  return String(value);
}

/** Formats a percentage delta with an explicit sign (e.g. -0.1121 -> "-11.21"). */
export function formatSignedPercent(
  value: number | null | undefined,
  fractionDigits = 2
): string {
  if (value == null || Number.isNaN(value)) return 'N/A';
  const pct = value * 100;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(fractionDigits)}`;
}
