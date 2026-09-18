/**
 * DAX query builders for the Valuation & Returns tab.
 *
 * Most measures already exist in the semantic model's `_Measures` table
 * (see "Semantic Model Reference"): [Share Price], [Market Cap], [P/E],
 * [EV/EBITDA], [EV/Sales], [ROCE %], [ROIC %], [ROE %],
 * [Dividend Payout Ratio %], [Dividends per Share], [Market Cap Rank (Top 10)],
 * [LTI Rank].
 *
 * P/B (Price to Book) has no equivalent stored measure — the model has no
 * "Price to Book"/"Book Value" KPI (confirmed via VALUES('Enterprise data
 * ratios'[KPI]) and VALUES('Non current liabilities'[KPI])). It's built here
 * as a query-scoped DAX measure (DEFINE MEASURE, valid only within a single
 * EVALUATE) rather than a model change, since Market Cap ÷ Total Equity
 * ("Total Equity" is a real KPI on the Non current liabilities table)
 * reproduces the reference design's P/B figures exactly (verified against
 * the live model, e.g. DRL 2.75 -> "2.7").
 */

import { DRL, PEER_FILTER, daxString } from '@/queries/overview/overview-dax';

const PB_MEASURE_DEFINE = `DEFINE
    MEASURE 'Enterprise data ratios'[PB Ratio] =
        DIVIDE(
            CALCULATE(SUM('Enterprise data ratios'[Amount]), 'Enterprise data ratios'[KPI] = "Diluted Market Cap (Weighted Average Shares)"),
            CALCULATE(SUM('Non current liabilities'[Amount]), 'Non current liabilities'[KPI] = "Total Equity")
        )`;

export function buildValuationKpiQuery(fyYear: string): string {
  return `
EVALUATE
CALCULATETABLE(
    SUMMARIZECOLUMNS(
        "SharePrice", [Share Price],
        "MarketCap", [Market Cap],
        "PE", [P/E],
        "EVEBITDA", [EV/EBITDA],
        "EVSales", [EV/Sales]
    ),
    'Dim Company'[Company] = ${daxString(DRL)},
    'Dim Date'[FY Year] = ${daxString(fyYear)}
)`.trim();
}

export function buildValuationMultiplesQuery(fyYear: string): string {
  return `
${PB_MEASURE_DEFINE}
EVALUATE
CALCULATETABLE(
    SUMMARIZECOLUMNS(
        'Dim Company'[Company],
        "PE", [P/E],
        "PB", [PB Ratio],
        "EVEBITDA", [EV/EBITDA],
        "EVSales", [EV/Sales]
    ),
    ${PEER_FILTER},
    'Dim Date'[FY Year] = ${daxString(fyYear)}
)`.trim();
}

/**
 * [LTI Rank] is a RANKX against the 8-company LTI pool — since RANKX still
 * returns a positional rank for the current row even when that row's
 * company isn't a member of the pool (e.g. Mankind, swapped out for
 * Glenmark), the raw measure doesn't blank itself out for non-members.
 * 'Dim Company'[Exception LTI] is included here so the UI can show "NA"
 * for companies outside the LTI peer set instead of a misleading rank.
 */
export function buildSharePriceMarketCapQuery(fyYear: string): string {
  return `
EVALUATE
CALCULATETABLE(
    SUMMARIZECOLUMNS(
        'Dim Company'[Company],
        "SharePrice", [Share Price],
        "MarketCap", [Market Cap],
        "MarketCapRank", [Market Cap Rank (Top 10)],
        "InLTIPeerSet", SELECTEDVALUE('Dim Company'[Exception LTI]),
        "LTIRank", [LTI Rank]
    ),
    ${PEER_FILTER},
    'Dim Date'[FY Year] = ${daxString(fyYear)}
)`.trim();
}

export function buildReturnsQuery(fyYear: string): string {
  return `
EVALUATE
CALCULATETABLE(
    SUMMARIZECOLUMNS(
        'Dim Company'[Company],
        "ROCE", [ROCE %],
        "ROIC", [ROIC %],
        "ROE", [ROE %],
        "DividendPayoutRatio", [Dividend Payout Ratio %],
        "DividendPerShare", [Dividends per Share]
    ),
    ${PEER_FILTER},
    'Dim Date'[FY Year] = ${daxString(fyYear)}
)`.trim();
}
