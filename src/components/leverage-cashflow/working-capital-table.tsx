import { PeerMetricsTable, type MetricRowDef } from '@/components/overview/peer-metrics-table';
import { useSemanticModelQuery } from '@/hooks/use-semantic-model-query';
import { formatRatio } from '@/lib/format-overview';
import { rowsToCompanyMap } from '@/lib/overview-data';
import { buildWorkingCapitalQuery } from '@/queries/leverage-cashflow/leverage-cashflow-dax';
import { PEER_ORDER } from '@/queries/overview/overview-dax';

const CONNECTION = 'peerBenchmarking';

const ROWS: MetricRowDef[] = [
  { key: 'DSO', label: 'DSO (days)', format: (v) => formatRatio(v), direction: 'lowerIsBetter' },
  { key: 'DIO', label: 'DIO (days)', format: (v) => formatRatio(v), direction: 'lowerIsBetter' },
  { key: 'DPO', label: 'DPO (days)', format: (v) => formatRatio(v) },
  { key: 'CurrentRatio', label: 'Current Ratio', format: (v) => `${formatRatio(v)}x` },
];

export function WorkingCapitalTable({ fyYear }: { fyYear: string }) {
  const { data, isLoading, error } = useSemanticModelQuery({
    connection: CONNECTION,
    query: buildWorkingCapitalQuery(fyYear),
  });

  if (isLoading) {
    return <div className="h-48 animate-pulse rounded-md bg-muted" />;
  }

  if (error || data?.status !== 'success') {
    return (
      <div className="rounded-md border border-destructive bg-destructive/10 p-l text-300 text-destructive">
        Failed to load Working Capital Days
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
      title="Working Capital Days"
      companies={PEER_ORDER}
      rows={ROWS}
      data={byCompany}
    />
  );
}
