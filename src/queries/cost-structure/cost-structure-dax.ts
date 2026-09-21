/**
 * DAX query builders for the Cost Structure & EBITDA tab.
 *
 * None of these cost line items exist as stored measures in the semantic
 * model's `_Measures` table — verified live via
 * `EVALUATE VALUES('Income Statement'[KPI])`. They're raw KPI strings on the
 * same long/narrow `Income Statement` fact table that [Revenue]/[EBITDA]
 * read from, so every query here aggregates them inline
 * (`CALCULATE(SUM('Income Statement'[Amount]), 'Income Statement'[KPI] = "...")`)
 * rather than adding a model-side measure — see TECHNICAL_HANDOVER.md §11.1.
 *
 * Unit note: `Income Statement[Amount]` is stored in ₹ Millions, but every
 * stored measure ([Revenue], [EBITDA], ...) already returns ₹ Crores. Raw
 * KPI sums read here must be divided by 10 to match — verified against the
 * live model (DRL COGS FY2026: raw 158,669 / 10 = 15,866.9 ≈ mapping doc's
 * 15,687; DRL SG&A FY2026: raw 106,763 / 10 = 10,676.3, exact match).
 */

import {
  DRL,
  PEER_FILTER,
  daxString,
} from '@/queries/overview/overview-dax';

const CR_DIVISOR = 10;

const KPI_COGS = 'Cost of Goods & Services Sold';
const KPI_SGA = 'Selling, General and Administrative Expense';
const KPI_RND = 'R&D Expense Adjusted';
const KPI_PERSONNEL = 'Personnel Expenses';

/** `CALCULATE(SUM(Amount), KPI = "...")`, in ₹ Crores, optionally scoped to an explicit FY/Quarter. */
function costAmountExpr(kpi: string, fyYear?: string, quarter?: string): string {
  const filters = fyYear
    ? `, 'Dim Date'[FY Year] = ${daxString(fyYear)}${quarter ? `, 'Dim Date'[Quarter] = ${daxString(quarter)}` : ''}`
    : '';
  return `CALCULATE(SUM('Income Statement'[Amount]), 'Income Statement'[KPI] = ${daxString(kpi)}${filters}) / ${CR_DIVISOR}`;
}

/**
 * Cost (₹ Cr) & as a % of Sales — COGS/SG&A/R&D/Personnel amounts plus
 * Revenue (for the %-of-sales calc, done client-side) for all 8 peers.
 * Quarter-eligible (Income Statement carries a Quarter column, §5.1).
 */
export function buildCostStructureQuery(fyYear: string, quarter?: string): string {
  const quarterFilter = quarter ? `,\n    'Dim Date'[Quarter] = ${daxString(quarter)}` : '';
  return `
EVALUATE
CALCULATETABLE(
    SUMMARIZECOLUMNS(
        'Dim Company'[Company],
        "COGS", ${costAmountExpr(KPI_COGS)},
        "SGA", ${costAmountExpr(KPI_SGA)},
        "RnD", ${costAmountExpr(KPI_RND)},
        "Personnel", ${costAmountExpr(KPI_PERSONNEL)},
        "Revenue", [Revenue]
    ),
    ${PEER_FILTER},
    'Dim Date'[FY Year] = ${daxString(fyYear)}${quarterFilter}
)`.trim();
}

/**
 * Cost Increase/Decrease — YoY growth % for COGS/SG&A/R&D/Personnel.
 * Fetches the current and prior-FY (same quarter, if set) amounts as
 * separate named expressions (each with its own explicit FY/Quarter filter,
 * since they target two different periods) and leaves the growth-%
 * arithmetic to the caller — see `lib/cost-structure-data.ts`.
 */
export function buildCostGrowthQuery(fyYear: string, quarter?: string): string {
  const priorFyYear = shiftFyYear(fyYear, -1);
  const metrics: [key: string, kpi: string][] = [
    ['COGS', KPI_COGS],
    ['SGA', KPI_SGA],
    ['RnD', KPI_RND],
    ['Personnel', KPI_PERSONNEL],
  ];
  const columns = metrics.flatMap(([key, kpi]) => [
    `"${key}", ${costAmountExpr(kpi, fyYear, quarter)}`,
    `"${key}Prior", ${costAmountExpr(kpi, priorFyYear, quarter)}`,
  ]);
  return `
EVALUATE
CALCULATETABLE(
    SUMMARIZECOLUMNS(
        'Dim Company'[Company],
        ${columns.join(',\n        ')}
    ),
    ${PEER_FILTER}
)`.trim();
}

/** EBITDA (₹ Cr) & EBITDA Margin % — both real stored measures, quarter-eligible. */
export function buildCostEbitdaQuery(fyYear: string, quarter?: string): string {
  const quarterFilter = quarter ? `,\n    'Dim Date'[Quarter] = ${daxString(quarter)}` : '';
  return `
EVALUATE
CALCULATETABLE(
    SUMMARIZECOLUMNS(
        'Dim Company'[Company],
        "EBITDA", [EBITDA],
        "EBITDAMargin", [EBITDA Margin %]
    ),
    ${PEER_FILTER},
    'Dim Date'[FY Year] = ${daxString(fyYear)}${quarterFilter}
)`.trim();
}

/**
 * EBITDA Bridge inputs — COGS % of sales, R&D % of sales (both derived,
 * DIVIDE'd against [Revenue] directly in DAX so the unit conversion is
 * self-contained) and EBITDA Margin % for every peer at a single FY. FY-only
 * — the bridge's own period dropdowns are year-level, matching the mapping
 * doc's mockup (no quarter selector on the bridge).
 */
export function buildCostBridgeInputsQuery(fyYear: string): string {
  return `
EVALUATE
CALCULATETABLE(
    SUMMARIZECOLUMNS(
        'Dim Company'[Company],
        "CogsPct", DIVIDE(${costAmountExpr(KPI_COGS)}, [Revenue]),
        "RndPct", DIVIDE(${costAmountExpr(KPI_RND)}, [Revenue]),
        "EBITDAMargin", [EBITDA Margin %]
    ),
    ${PEER_FILTER},
    'Dim Date'[FY Year] = ${daxString(fyYear)}
)`.trim();
}

export { DRL };

/** "FY 2026" -> "FY 2025" (offset = -1) / "FY 2027" (offset = +1). */
export function shiftFyYear(fyYear: string, offset: number): string {
  const year = Number.parseInt(fyYear.slice(-4), 10);
  return `FY ${year + offset}`;
}
