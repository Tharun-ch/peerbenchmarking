import type { QueryTable } from '@microsoft/fabric-app-data';

/**
 * Converts a query result shaped as `[Company, ...measureValues]` per row
 * into `{ [company]: { [key]: value } }`, using `keys` (in column order,
 * excluding the leading company column) as the measure keys.
 */
export function rowsToCompanyMap(
  table: QueryTable,
  keys: string[]
): Record<string, Record<string, number | null>> {
  const result: Record<string, Record<string, number | null>> = {};
  for (const row of table.rows) {
    const company = row[0] as string;
    const values: Record<string, number | null> = {};
    keys.forEach((key, i) => {
      values[key] = (row[i + 1] as number | null) ?? null;
    });
    result[company] = values;
  }
  return result;
}
