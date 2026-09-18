/**
 * DAX query builders for the Overview tab.
 *
 * All measures referenced here already exist in the semantic model's
 * `_Measures` table (workspace 51b19e59-..., model 51ebc77c-...) — see
 * "Semantic Model Reference" for the full definitions. Queries only need
 * to filter Dim Company / Dim Date and read the named measures.
 */

export const DRL = "Dr. Reddy's";

/** The 8-company main peer set: Exception Top 10, excluding the CDMO-only pair. */
export const PEER_ORDER = [
  DRL,
  'Sun Pharma',
  'Cipla',
  'Aurobindo',
  'Lupin',
  'Torrent',
  'Mankind',
  'Zydus Life',
] as const;

/** The 8-company main peer set filter, reused by every peer-comparison query in the app. */
export const PEER_FILTER =
  "FILTER('Dim Company', 'Dim Company'[Exception Top 10] = 1 && 'Dim Company'[Exception CDMO] = 0)";

/** Escapes a value for use inside a DAX string literal (doubles embedded quotes). */
export function daxString(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * [Revenue Growth %] compares against the prior FISCAL YEAR's same quarter
 * (see [Revenue PY]'s DAX) — i.e. "Previous Year Same Quarter". The sequential
 * "Previous Quarter" comparison (Q2 vs Q1) is a separate stored measure,
 * [Revenue Growth % (QoQ)], added to the model's `_Measures` table alongside
 * its own hidden [Revenue PrevQ] helper (same PY-style pattern, one quarter
 * back instead of one fiscal year, wrapping to Q4 of the prior FY when the
 * current quarter is Q1). Verified against the live model.
 */
export type ComparisonMode = 'previous-quarter' | 'previous-year-same-quarter';

function revenueGrowthMeasureRef(quarter: string | undefined, comparisonMode: ComparisonMode | undefined): string {
  return quarter && comparisonMode === 'previous-quarter'
    ? '[Revenue Growth % (QoQ)]'
    : '[Revenue Growth %]';
}

/**
 * Income-Statement-derived KPIs (Revenue, EBITDA and their %s) — these carry a
 * Quarter column, so they respond to the Quarter slicer when `quarter` is given.
 * `comparisonMode` only matters when `quarter` is set (the comparison toggle is
 * only shown in quarter mode); it defaults to the model's built-in "Previous
 * Year Same Quarter" logic.
 */
export function buildKpiCoreQuery(
  fyYear: string,
  quarter?: string,
  comparisonMode?: ComparisonMode
): string {
  const quarterFilter = quarter
    ? `,\n    'Dim Date'[Quarter] = ${daxString(quarter)}`
    : '';
  return `
EVALUATE
CALCULATETABLE(
    SUMMARIZECOLUMNS(
        "Revenue", [Revenue],
        "RevenueGrowth", ${revenueGrowthMeasureRef(quarter, comparisonMode)},
        "EBITDA", [EBITDA],
        "EBITDAMargin", [EBITDA Margin %]
    ),
    'Dim Company'[Company] = ${daxString(DRL)},
    'Dim Date'[FY Year] = ${daxString(fyYear)}${quarterFilter}
)`.trim();
}

/**
 * FY-only KPIs (ROCE %, P/E, Market Cap ranks) — sourced from Return ratios /
 * Enterprise data ratios, which carry no Quarter column. Filtering these by
 * Quarter returns zero rows (verified against the live model), so they are
 * always queried at FY grain, matching the reference app's own behavior.
 */
export function buildKpiFyOnlyQuery(fyYear: string): string {
  return `
EVALUATE
CALCULATETABLE(
    SUMMARIZECOLUMNS(
        "ROCE", [ROCE %],
        "PeerAvgROCE", [Peer Avg ROCE %],
        "ROCEGap", [ROCE Gap],
        "PE", [P/E],
        "MarketCapRank", [Market Cap Rank (Top 10)],
        "LTIRank", [LTI Rank]
    ),
    'Dim Company'[Company] = ${daxString(DRL)},
    'Dim Date'[FY Year] = ${daxString(fyYear)}
)`.trim();
}

export function buildPeerPoolSizesQuery(): string {
  return `
EVALUATE
ROW(
    "Top10Count", COUNTROWS(FILTER('Dim Company', 'Dim Company'[Exception Top 10] = 1)),
    "LTICount", COUNTROWS(FILTER('Dim Company', 'Dim Company'[Exception LTI] = 1))
)`.trim();
}

/**
 * Income-Statement-derived heatmap rows — respond to the Quarter slicer.
 * `comparisonMode` only matters when `quarter` is set — see buildKpiCoreQuery.
 */
export function buildHeatmapCoreQuery(
  fyYear: string,
  quarter?: string,
  comparisonMode?: ComparisonMode
): string {
  const quarterFilter = quarter
    ? `,\n    'Dim Date'[Quarter] = ${daxString(quarter)}`
    : '';
  return `
EVALUATE
CALCULATETABLE(
    SUMMARIZECOLUMNS(
        'Dim Company'[Company],
        "RevenueGrowth", ${revenueGrowthMeasureRef(quarter, comparisonMode)},
        "GrossProfitMargin", [Gross Profit Margin %],
        "EBITDAMargin", [EBITDA Margin %],
        "PATMargin", [PAT Margin %]
    ),
    ${PEER_FILTER},
    'Dim Date'[FY Year] = ${daxString(fyYear)}${quarterFilter}
)`.trim();
}

/** ROCE % — Return ratios is FY-only; always queried without a Quarter filter. */
export function buildHeatmapFyOnlyQuery(fyYear: string): string {
  return `
EVALUATE
CALCULATETABLE(
    SUMMARIZECOLUMNS(
        'Dim Company'[Company],
        "ROCE", [ROCE %]
    ),
    ${PEER_FILTER},
    'Dim Date'[FY Year] = ${daxString(fyYear)}
)`.trim();
}

export function buildMultiplesQuery(fyYear: string): string {
  return `
EVALUATE
CALCULATETABLE(
    SUMMARIZECOLUMNS(
        'Dim Company'[Company],
        "PE", [P/E],
        "EVEBITDA", [EV/EBITDA],
        "MarketCap", [Market Cap]
    ),
    ${PEER_FILTER},
    'Dim Date'[FY Year] = ${daxString(fyYear)}
)`.trim();
}

export type ForecastPeriod = '1YF' | '2YF';

export function buildConsensusQuery(
  fyYear: string,
  forecastPeriod: ForecastPeriod
): string {
  const suffix = forecastPeriod === '1YF' ? '1YF' : '2YF';
  return `
EVALUATE
CALCULATETABLE(
    SUMMARIZECOLUMNS(
        'Dim Company'[Company],
        "RevenueGrowth", [Revenue Growth % (${suffix})],
        "GrossMargin", [Gross Margin % (${suffix})],
        "EBITDAMargin", [EBITDA Margin % (${suffix})],
        "PATMargin", [PAT Margin % (${suffix})]
    ),
    ${PEER_FILTER},
    'Dim Date'[FY Year] = ${daxString(fyYear)}
)`.trim();
}

/** Known FY Year values in Dim Date, newest to oldest (slicers list latest year first). */
export const FY_YEAR_OPTIONS = [
  'FY 2028',
  'FY 2027',
  'FY 2026',
  'FY 2025',
  'FY 2024',
  'FY 2023',
  'FY 2022',
  'FY 2021',
] as const;

export const DEFAULT_FY_YEAR = 'FY 2026';

/** Quarters available on the Quarter slicer. */
export const QUARTER_OPTIONS = ['Q1', 'Q2', 'Q3', 'Q4'] as const;

/** Years after this one are still forecast/estimated, per the "(Est.)" tag in the reference picker. */
const LAST_ACTUAL_FY_YEAR = 'FY 2026';

/** "FY 2026" -> "FY26"; years after LAST_ACTUAL_FY_YEAR get an " (Est.)" suffix, matching quater.png. */
export function formatFyYearShort(fyYear: string): string {
  const short = `FY${fyYear.slice(-2)}`;
  return fyYear > LAST_ACTUAL_FY_YEAR ? `${short} (Est.)` : short;
}

/**
 * The model's fiscal year runs April-March (see Dim Date's FiscalYear column:
 * e.g. April 2025-March 2026 is "FY 2026"). Returns the numeric fiscal year
 * containing `date` — Jan-Mar belongs to the FY that started the previous
 * calendar year, Apr-Dec belongs to the FY ending next calendar year.
 */
export function getCurrentFiscalYear(date: Date = new Date()): number {
  const month = date.getMonth(); // 0-indexed; 3 = April
  const calendarYear = date.getFullYear();
  return month >= 3 ? calendarYear + 1 : calendarYear;
}

/** No Period slicer anywhere in the app offers the current (in-progress) fiscal year or later — only fully-closed years. */
export function getMaxSelectableFyYear(date: Date = new Date()): string {
  return `FY ${getCurrentFiscalYear(date) - 1}`;
}

/** FY_YEAR_OPTIONS capped at getMaxSelectableFyYear() — used by every Period slicer in the app. */
export function getCappedFyYearOptions(date: Date = new Date()): string[] {
  const max = getMaxSelectableFyYear(date);
  return FY_YEAR_OPTIONS.filter((year) => year <= max);
}
