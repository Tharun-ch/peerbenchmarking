import { PEER_ORDER } from '@/queries/overview/overview-dax';
import { PeerMetricsTable, type MetricRowDef } from '@/components/overview/peer-metrics-table';
import { useSemanticModelQuery } from '@/hooks/use-semantic-model-query';
import { formatRatio } from '@/lib/format-overview';
import { rowsToCompanyMap } from '@/lib/overview-data';
import { buildValuationMultiplesQuery } from '@/queries/valuation/valuation-dax';

const CONNECTION = 'peerBenchmarking';

const ROWS: MetricRowDef[] = [
  { key: 'PE', label: 'P/E', format: formatRatio, direction: 'lowerIsBetter' },
  { key: 'PB', label: 'P/B', format: formatRatio, direction: 'lowerIsBetter' },
  {
    key: 'EVEBITDA',
    label: 'EV/EBITDA',
    format: formatRatio,
    direction: 'lowerIsBetter',
  },
  {
    key: 'EVSales',
    label: 'EV/Sales',
    format: formatRatio,
    direction: 'lowerIsBetter',
  },
];

export function ValuationMultiplesTable({ fyYear }: { fyYear: string }) {
  const { data, isLoading, error } = useSemanticModelQuery({
    connection: CONNECTION,
    query: buildValuationMultiplesQuery(fyYear),
  });

  if (isLoading) {
    return <div className="h-56 animate-pulse rounded-md bg-muted" />;
  }

  if (error || data?.status !== 'success') {
    return (
      <div className="rounded-md border border-destructive bg-destructive/10 p-l text-300 text-destructive">
        Failed to load Valuation Multiples
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
      title="Valuation Multiples"
      companies={PEER_ORDER}
      rows={ROWS}
      data={byCompany}
    />
  );
}
