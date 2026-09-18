/**
 * DAX query builder for the Trend Analysis tab.
 *
 * Reuses the Overview folder's real measures — [Revenue], [EBITDA], [PAT],
 * [P/E] — exactly as the semantic model reference doc specifies for this tab
 * ("Reuses [Revenue], [EBITDA], [PAT], [P/E] from the Overview folder — no
 * new measures needed"). [Revenue] already has a stored YoY-growth measure
 * ([Revenue Growth %]); EBITDA, PAT, and P/E don't, so their growth is built
 * here as a query-scoped DAX measure (DEFINE MEASURE, valid only for that one
 * query) — verified against the live model.
 */

import { daxString, PEER_FILTER } from '@/queries/overview/overview-dax';

export const TREND_MEASURES = ['Revenue', 'EBITDA', 'PAT', 'P/E'] as const;
export type TrendMeasure = (typeof TREND_MEASURES)[number];

interface MeasureConfig {
  /** DAX table qualifier used for the query-scoped PY/growth measures. */
  table: string;
  /** Real stored measure name for the raw value. */
  valueMeasure: string;
  /** Real stored measure name for growth, if one already exists (Revenue only). */
  storedGrowthMeasure?: string;
}

const MEASURE_CONFIG: Record<TrendMeasure, MeasureConfig> = {
  Revenue: {
    table: 'Income Statement',
    valueMeasure: '[Revenue]',
    storedGrowthMeasure: '[Revenue Growth %]',
  },
  EBITDA: { table: 'Income Statement', valueMeasure: '[EBITDA]' },
  PAT: { table: 'Income Statement', valueMeasure: '[PAT]' },
  'P/E': { table: 'Enterprise data ratios', valueMeasure: '[P/E]' },
};

export function buildTrendQuery(fyYear: string, measure: TrendMeasure): string {
  const config = MEASURE_CONFIG[measure];

  if (config.storedGrowthMeasure) {
    return `
EVALUATE
CALCULATETABLE(
    SUMMARIZECOLUMNS(
        'Dim Company'[Company],
        "Value", ${config.valueMeasure},
        "Growth", ${config.storedGrowthMeasure}
    ),
    ${PEER_FILTER},
    'Dim Date'[FY Year] = ${daxString(fyYear)}
)`.trim();
  }

  return `
DEFINE
    MEASURE '${config.table}'[Trend PY] =
        CALCULATE(${config.valueMeasure}, FILTER(ALL('Dim Date'), 'Dim Date'[FiscalYear] = SELECTEDVALUE('Dim Date'[FiscalYear]) - 1))
    MEASURE '${config.table}'[Trend Growth %] =
        DIVIDE(${config.valueMeasure} - [Trend PY], [Trend PY])
EVALUATE
CALCULATETABLE(
    SUMMARIZECOLUMNS(
        'Dim Company'[Company],
        "Value", ${config.valueMeasure},
        "Growth", [Trend Growth %]
    ),
    ${PEER_FILTER},
    'Dim Date'[FY Year] = ${daxString(fyYear)}
)`.trim();
}
