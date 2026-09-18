import { PeerMetricsTable, type MetricRowDef } from '@/components/overview/peer-metrics-table';
import { useSemanticModelQuery } from '@/hooks/use-semantic-model-query';
import { formatIndianNumber, formatRank } from '@/lib/format-overview';
import { rowsToCompanyMap } from '@/lib/overview-data';
import { PEER_ORDER } from '@/queries/overview/overview-dax';
import { buildSharePriceMarketCapQuery } from '@/queries/valuation/valuation-dax';

const CONNECTION = 'peerBenchmarking';

const QUERY_KEYS = [
  'SharePrice',
  'MarketCap',
  'MarketCapRank',
  'InLTIPeerSet',
  'LTIRank',
];

const ROWS: MetricRowDef[] = [
  {
    key: 'SharePrice',
    label: 'Share Price (₹)',
    format: (v) => formatIndianNumber(v, 1),
  },
  { key: 'MarketCap', label: 'Market Cap (₹ Cr)', format: (v) => formatIndianNumber(v) },
  { key: 'MarketCapRank', label: 'Market Cap Rank (of 8)', format: formatRank },
  { key: 'LTIRank', label: 'Market Cap Rank as per LTI', format: formatRank },
];

export function SharePriceMarketCapTable({ fyYear }: { fyYear: string }) {
  const { data, isLoading, error } = useSemanticModelQuery({
    connection: CONNECTION,
    query: buildSharePriceMarketCapQuery(fyYear),
  });

  if (isLoading) {
    return <div className="h-56 animate-pulse rounded-md bg-muted" />;
  }

  if (error || data?.status !== 'success') {
    return (
      <div className="rounded-md border border-destructive bg-destructive/10 p-l text-300 text-destructive">
        Failed to load Share Price & Market Cap
        {data?.status === 'error' ? `: ${data.error.message}` : '.'}
      </div>
    );
  }

  const rawByCompany = rowsToCompanyMap(data.table, QUERY_KEYS);
  const byCompany = Object.fromEntries(
    Object.entries(rawByCompany).map(([company, row]) => [
      company,
      {
        ...row,
        // LTI Rank is only meaningful for companies actually in the LTI peer set.
        LTIRank: row.InLTIPeerSet === 1 ? row.LTIRank : null,
      },
    ])
  );

  return (
    <div className="flex flex-col gap-xs">
      <PeerMetricsTable
        title="Share Price & Market Cap"
        companies={PEER_ORDER}
        rows={ROWS}
        data={byCompany}
      />
      <p className="m-0 px-xs text-100 text-muted-foreground">
        Divi&apos;s is in top companies by market cap but not included in this
        peer set. Glenmark is part of LTI peer set.
      </p>
    </div>
  );
}
