import { useSemanticModelQuery } from '@/hooks/use-semantic-model-query';
import { formatIndianNumber, formatRatio } from '@/lib/format-overview';
import { rowsToCompanyMap } from '@/lib/overview-data';
import { buildMultiplesQuery, PEER_ORDER } from '@/queries/overview/overview-dax';

import { PeerMetricsTable, type MetricRowDef } from './peer-metrics-table';

const CONNECTION = 'peerBenchmarking';

const ROWS: MetricRowDef[] = [
  { key: 'PE', label: 'P/E (x)', format: formatRatio, direction: 'lowerIsBetter' },
  {
    key: 'EVEBITDA',
    label: 'EV/EBITDA (x)',
    format: formatRatio,
    direction: 'lowerIsBetter',
  },
  {
    key: 'MarketCap',
    label: 'Market Capitalisation (₹ Cr)',
    format: (v) => formatIndianNumber(v),
  },
];

export function MultiplesTable({ fyYear }: { fyYear: string }) {
  const { data, isLoading, error } = useSemanticModelQuery({
    connection: CONNECTION,
    query: buildMultiplesQuery(fyYear),
  });

  if (isLoading) {
    return <div className="h-48 animate-pulse rounded-md bg-muted" />;
  }

  if (error || data?.status !== 'success') {
    return (
      <div className="rounded-md border border-destructive bg-destructive/10 p-l text-300 text-destructive">
        Failed to load Multiples & Market Capitalisation
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
      title="Multiples & Market Capitalisation"
      companies={PEER_ORDER}
      rows={ROWS}
      data={byCompany}
    />
  );
}
