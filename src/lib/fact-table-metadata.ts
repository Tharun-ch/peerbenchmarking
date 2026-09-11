import type { ColumnMetadataMap } from '@/lib/to-data-table';

/** Friendly display labels for raw column names shared across the fact tables. */
const COLUMN_LABELS: Record<string, string> = {
  Company: 'Company',
  KPI: 'KPI',
  'FY Year': 'FY Year',
  Quarter: 'Quarter',
  Amount: 'Amount',
  Date: 'Date',
  Bloomberg_Code: 'Bloomberg Code',
  Fy1: 'FY1',
  Fy2: 'FY2',
  Field_Expression: 'Field Expression',
  Calcrt_Field: 'Calculated Field',
  Segment_Id: 'Segment',
};

/** Raw column names that hold numeric values and should render with thousands separators. */
const NUMERIC_COLUMNS = new Set(['Amount', 'Fy1', 'Fy2']);

/**
 * Builds a `ColumnMetadataMap` for a fact table dumped as-is (`EVALUATE 'Table'`).
 * `rawColumnNames` must be the exact column names verified via schema discovery
 * (see the `schema-discovery` skill) — never guessed.
 */
export function buildFactColumnMetadata(
  tableName: string,
  rawColumnNames: string[]
): ColumnMetadataMap {
  const map: ColumnMetadataMap = {};
  for (const raw of rawColumnNames) {
    map[`${tableName}[${raw}]`] = {
      name: raw,
      displayName: COLUMN_LABELS[raw] ?? raw,
      ...(NUMERIC_COLUMNS.has(raw) ? { format: '#,##0.00' } : {}),
    };
  }
  return map;
}
