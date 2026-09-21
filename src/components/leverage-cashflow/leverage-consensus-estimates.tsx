import { useState } from 'react';

import { PeerMetricsTable, type MetricRowDef } from '@/components/overview/peer-metrics-table';
import { type ForecastPeriod, PEER_ORDER } from '@/queries/overview/overview-dax';

/**
 * Cashflow / Non current liabilities carry no Fy1/Fy2 forward-estimate
 * columns — same situation as Valuation & Returns' Consensus Estimates.
 * Placeholder table matching the mapping doc's mockup (Forecast Period
 * toggle + "XX.XX" cells) rather than a text notice.
 */
const ROWS: MetricRowDef[] = [
  { key: 'FCF', label: 'Free Cash Flow (₹ Cr)', format: () => 'XX.XX' },
  { key: 'CAPEX', label: 'CAPEX (₹ Cr)', format: () => 'XX.XX' },
  { key: 'NetDebtEbitda', label: 'Net Debt/EBITDA (x)', format: () => 'XX.XX' },
];

const PLACEHOLDER_DATA = Object.fromEntries(
  PEER_ORDER.map((company) => [company, { FCF: 0, CAPEX: 0, NetDebtEbitda: 0 }])
);

export function LeverageConsensusEstimates() {
  const [forecastPeriod, setForecastPeriod] = useState<ForecastPeriod>('1YF');

  const headerAction = (
    <label className="flex items-center gap-s text-[12px] text-[#555555]">
      Forecast Period:
      <select
        value={forecastPeriod}
        onChange={(e) => setForecastPeriod(e.target.value as ForecastPeriod)}
        className="h-8 rounded-md border border-ca-input-border bg-card px-m text-[12px] text-[#4A4A4A] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="1YF">1 Year Forward (1YF)</option>
        <option value="2YF">2 Year Forward (2YF)</option>
      </select>
    </label>
  );

  return (
    <PeerMetricsTable
      title="Consensus Estimates"
      companies={PEER_ORDER}
      rows={ROWS}
      data={PLACEHOLDER_DATA}
      highlight={false}
      headerAction={headerAction}
    />
  );
}
