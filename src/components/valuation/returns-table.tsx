import { PeerMetricsTable, type MetricRowDef } from '@/components/overview/peer-metrics-table';
import { useSemanticModelQuery } from '@/hooks/use-semantic-model-query';
import { formatPercentValue, formatRatio } from '@/lib/format-overview';
import { rowsToCompanyMap } from '@/lib/overview-data';
import { PEER_ORDER } from '@/queries/overview/overview-dax';
import { buildReturnsQuery } from '@/queries/valuation/valuation-dax';

const CONNECTION = 'peerBenchmarking';

const ROWS: MetricRowDef[] = [
  { key: 'ROCE', label: 'ROCE', format: formatPercentValue },
  { key: 'ROIC', label: 'ROIC', format: formatPercentValue },
  { key: 'ROE', label: 'ROE', format: formatPercentValue },
  {
    key: 'DividendPayoutRatio',
    label: 'Dividend Payout Ratio',
    format: formatPercentValue,
  },
  {
    key: 'DividendPerShare',
    label: 'Dividend Per Share (₹)',
    format: (v) => formatRatio(v, 2),
  },
];

export function ReturnsTable({ fyYear }: { fyYear: string }) {
  const { data, isLoading, error } = useSemanticModelQuery({
    connection: CONNECTION,
    query: buildReturnsQuery(fyYear),
  });

  if (isLoading) {
    return <div className="h-64 animate-pulse rounded-md bg-muted" />;
  }

  if (error || data?.status !== 'success') {
    return (
      <div className="rounded-md border border-destructive bg-destructive/10 p-l text-300 text-destructive">
        Failed to load Returns
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
      title="Returns"
      companies={PEER_ORDER}
      rows={ROWS}
      data={byCompany}
    />
  );
}
