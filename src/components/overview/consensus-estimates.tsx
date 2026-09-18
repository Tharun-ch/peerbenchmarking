import { useState } from 'react';

import { useSemanticModelQuery } from '@/hooks/use-semantic-model-query';
import { formatPercentValue } from '@/lib/format-overview';
import { rowsToCompanyMap } from '@/lib/overview-data';
import {
  buildConsensusQuery,
  PEER_ORDER,
  type ForecastPeriod,
} from '@/queries/overview/overview-dax';

import { PeerMetricsTable, type MetricRowDef } from './peer-metrics-table';

const CONNECTION = 'peerBenchmarking';

const ROWS: MetricRowDef[] = [
  { key: 'RevenueGrowth', label: 'Revenue Growth%', format: formatPercentValue },
  { key: 'GrossMargin', label: 'Gross Margin %', format: formatPercentValue },
  { key: 'EBITDAMargin', label: 'EBITDA Margin %', format: formatPercentValue },
  { key: 'PATMargin', label: 'PAT Margin %', format: formatPercentValue },
];

export function ConsensusEstimates({ fyYear }: { fyYear: string }) {
  const [forecastPeriod, setForecastPeriod] = useState<ForecastPeriod>('1YF');

  const { data, isLoading, error } = useSemanticModelQuery({
    connection: CONNECTION,
    query: buildConsensusQuery(fyYear, forecastPeriod),
  });

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

  if (isLoading) {
    return <div className="h-56 animate-pulse rounded-md bg-muted" />;
  }

  if (error || data?.status !== 'success') {
    return (
      <div className="rounded-md border border-destructive bg-destructive/10 p-l text-300 text-destructive">
        Failed to load Consensus Estimates
        {data?.status === 'error' ? `: ${data.error.message}` : '.'}
      </div>
    );
  }

  const byCompany = rowsToCompanyMap(
    data.table,
    ROWS.map((r) => r.key)
  );

  return (
    <PeerMetricsTable
      title="Consensus Estimates"
      companies={PEER_ORDER}
      rows={ROWS}
      data={byCompany}
      highlight={false}
      headerAction={headerAction}
    />
  );
}
