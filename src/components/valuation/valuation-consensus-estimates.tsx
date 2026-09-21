import { useState } from 'react';

import { PeerMetricsTable, type MetricRowDef } from '@/components/overview/peer-metrics-table';
import { type ForecastPeriod } from '@/queries/overview/overview-dax';
import { PEER_ORDER } from '@/queries/overview/overview-dax';

/**
 * Enterprise data ratios (P/E, P/B, EV/EBITDA, EV/Sales) carries no Fy1/Fy2
 * forward-estimate columns — only Income Statement does (used by Overview's
 * real ConsensusEstimates). There is no forward-looking valuation-multiple
 * data anywhere in the model. Per the mapping doc's mockup, this section is
 * still shown as a real table (Forecast Period toggle included) with
 * explicit "XX.XX" placeholders — reserving the layout rather than hiding
 * it — instead of the plain-text unavailable notice this app previously
 * showed here.
 */
const ROWS: MetricRowDef[] = [
  { key: 'PE', label: 'P/E', format: () => 'XX.XX' },
  { key: 'PB', label: 'P/B', format: () => 'XX.XX' },
  { key: 'EVEBITDA', label: 'EV/EBITDA', format: () => 'XX.XX' },
  { key: 'EVSales', label: 'EV/Sales', format: () => 'XX.XX' },
];

const PLACEHOLDER_DATA = Object.fromEntries(
  PEER_ORDER.map((company) => [company, { PE: 0, PB: 0, EVEBITDA: 0, EVSales: 0 }])
);

export function ValuationConsensusEstimates() {
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
