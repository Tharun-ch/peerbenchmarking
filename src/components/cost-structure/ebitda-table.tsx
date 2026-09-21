import { useSemanticModelQuery } from '@/hooks/use-semantic-model-query';
import { formatIndianNumber, formatPercentValue } from '@/lib/format-overview';
import { rowsToCompanyMap } from '@/lib/overview-data';
import { buildCostEbitdaQuery } from '@/queries/cost-structure/cost-structure-dax';
import { PEER_ORDER } from '@/queries/overview/overview-dax';
import { PeerMetricsTable, type MetricRowDef } from '@/components/overview/peer-metrics-table';

const CONNECTION = 'peerBenchmarking';

const ROWS: MetricRowDef[] = [
  { key: 'EBITDA', label: 'EBITDA (₹ Cr)', format: (v) => formatIndianNumber(v) },
  { key: 'EBITDAMargin', label: 'EBITDA Margin %', format: (v) => `${formatPercentValue(v)}%` },
];

export function EbitdaTable({ fyYear, quarter }: { fyYear: string; quarter?: string }) {
  const { data, isLoading, error } = useSemanticModelQuery({
    connection: CONNECTION,
    query: buildCostEbitdaQuery(fyYear, quarter),
  });

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-md bg-muted" />;
  }

  if (error || data?.status !== 'success') {
    return (
      <div className="rounded-md border border-destructive bg-destructive/10 p-l text-300 text-destructive">
        Failed to load EBITDA
        {data?.status === 'error' ? `: ${data.error.message}` : '.'}
      </div>
    );
  }

  const byCompany = rowsToCompanyMap(
    data.table,
    ROWS.map((r) => r.key)
  );

  return (
    <PeerMetricsTable title="EBITDA" companies={PEER_ORDER} rows={ROWS} data={byCompany} />
  );
}
