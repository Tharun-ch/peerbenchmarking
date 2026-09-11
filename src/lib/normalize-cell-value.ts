const ISO_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

/**
 * Normalizes raw query values for display. Some tables (e.g. Segmental
 * Revenues) return an ISO datetime string for date columns instead of the
 * `MM/DD/YYYY` text most other fact tables use — this reformats those to
 * match for a consistent grid appearance.
 */
export function normalizeCellValue(value: unknown): unknown {
  if (typeof value === 'string' && ISO_DATETIME_PATTERN.test(value)) {
    const [year, month, day] = value.slice(0, 10).split('-');
    return `${month}/${day}/${year}`;
  }
  return value;
}
