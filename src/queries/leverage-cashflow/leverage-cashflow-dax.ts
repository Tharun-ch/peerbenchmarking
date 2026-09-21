/**
 * DAX query builders for the Leverage & Cash Flow tab.
 *
 * Unlike Cost Structure & EBITDA, every measure here is a real stored
 * measure in the model's `_Measures` table (verified live via
 * `EVALUATE SELECTCOLUMNS(INFO.VIEW.MEASURES(), [Table], [Name])`) —
 * [Net Debt], [Net Debt / EBITDA], [Net Debt / Equity], [Cash From
 * Operations], [Cash From Investing], [Cash From Financing],
 * [Free Cash Flow], [CAPEX], [DSO], [DIO], [DPO], [Current Ratio]. All are
 * sourced from Cashflow / Current assets / Current Liabilities / Non current
 * asset / Non current liabilities — none of which carry a Quarter column
 * (§5.1 in TECHNICAL_HANDOVER.md), so this tab is FY-only, confirmed with
 * the user (no PeriodPicker/Quarter slicer, matching Valuation & Returns).
 *
 * [CAPEX] is stored as a negative outflow (verified: [Free Cash Flow] =
 * [Cash From Operations] + [CAPEX] exactly) — negated at display time only,
 * matching the mapping doc's mockup which shows it as a positive spend
 * figure.
 */

import { PEER_FILTER, daxString } from '@/queries/overview/overview-dax';

export function buildLeverageKpiQuery(fyYear: string): string {
  return `
EVALUATE
CALCULATETABLE(
    SUMMARIZECOLUMNS(
        "NetDebt", [Net Debt],
        "NetDebtEbitda", [Net Debt / EBITDA],
        "NetDebtEquity", [Net Debt / Equity],
        "CFO", [Cash From Operations],
        "CFI", [Cash From Investing],
        "CFF", [Cash From Financing]
    ),
    'Dim Company'[Company] = ${daxString("Dr. Reddy's")},
    'Dim Date'[FY Year] = ${daxString(fyYear)}
)`.trim();
}

export function buildLeverageTableQuery(fyYear: string): string {
  return `
EVALUATE
CALCULATETABLE(
    SUMMARIZECOLUMNS(
        'Dim Company'[Company],
        "NetDebt", [Net Debt],
        "NetDebtEbitda", [Net Debt / EBITDA],
        "NetDebtEquity", [Net Debt / Equity],
        "CFO", [Cash From Operations],
        "CFI", [Cash From Investing],
        "CFF", [Cash From Financing],
        "FCF", [Free Cash Flow],
        "CAPEX", [CAPEX]
    ),
    ${PEER_FILTER},
    'Dim Date'[FY Year] = ${daxString(fyYear)}
)`.trim();
}

export function buildWorkingCapitalQuery(fyYear: string): string {
  return `
EVALUATE
CALCULATETABLE(
    SUMMARIZECOLUMNS(
        'Dim Company'[Company],
        "DSO", [DSO],
        "DIO", [DIO],
        "DPO", [DPO],
        "CurrentRatio", [Current Ratio]
    ),
    ${PEER_FILTER},
    'Dim Date'[FY Year] = ${daxString(fyYear)}
)`.trim();
}
