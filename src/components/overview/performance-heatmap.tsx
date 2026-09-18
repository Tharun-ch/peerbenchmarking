import { useSemanticModelQuery } from '@/hooks/use-semantic-model-query';
import { formatPercentValue } from '@/lib/format-overview';
import { rowsToCompanyMap } from '@/lib/overview-data';
import {
  buildHeatmapCoreQuery,
  buildHeatmapFyOnlyQuery,
  PEER_ORDER,
  type ComparisonMode,
} from '@/queries/overview/overview-dax';

import { PeerMetricsTable, type MetricRowDef } from './peer-metrics-table';

const CONNECTION = 'peerBenchmarking';

const CORE_ROWS: MetricRowDef[] = [
  { key: 'RevenueGrowth', label: 'Revenue Growth%', format: formatPercentValue },
  {
    key: 'GrossProfitMargin',
    label: 'Gross Profit Margin%',
    format: formatPercentValue,
  },
  { key: 'EBITDAMargin', label: 'EBITDA Margin %', format: formatPercentValue },
  { key: 'PATMargin', label: 'PAT Margin %', format: formatPercentValue },
];

const FY_ONLY_ROWS: MetricRowDef[] = [
  { key: 'ROCE', label: 'ROCE %', format: formatPercentValue },
];

const ROWS = [...CORE_ROWS, ...FY_ONLY_ROWS];

export function PerformanceHeatmap({
  fyYear,
  quarter,
  comparisonMode,
}: {
  fyYear: string;
  quarter?: string;
  comparisonMode?: ComparisonMode;
}) {
  const core = useSemanticModelQuery({
    connection: CONNECTION,
    query: buildHeatmapCoreQuery(fyYear, quarter, comparisonMode),
  });
  const fyOnly = useSemanticModelQuery({
    connection: CONNECTION,
    query: buildHeatmapFyOnlyQuery(fyYear),
  });

  if (core.isLoading || fyOnly.isLoading) {
    return <div className="h-64 animate-pulse rounded-md bg-muted" />;
  }

  if (core.data?.status !== 'success' || fyOnly.data?.status !== 'success') {
    const errored = [core.data, fyOnly.data].find((d) => d?.status === 'error');
    return (
      <div className="rounded-md border border-destructive bg-destructive/10 p-l text-300 text-destructive">
        Failed to load Performance Heatmap
        {errored?.status === 'error' ? `: ${errored.error.message}` : '.'}
      </div>
    );
  }

  const coreByCompany = rowsToCompanyMap(
    core.data.table,
    CORE_ROWS.map((r) => r.key)
  );
  const fyOnlyByCompany = rowsToCompanyMap(
    fyOnly.data.table,
    FY_ONLY_ROWS.map((r) => r.key)
  );
  const byCompany = Object.fromEntries(
    PEER_ORDER.map((company) => [
      company,
      { ...coreByCompany[company], ...fyOnlyByCompany[company] },
    ])
  );

  return (
    <PeerMetricsTable
      title="Performance Heatmap"
      companies={PEER_ORDER}
      rows={ROWS}
      data={byCompany}
    />
  );
}
