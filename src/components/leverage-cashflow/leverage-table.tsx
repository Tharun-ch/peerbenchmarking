import { PeerMetricsTable, type MetricRowDef } from '@/components/overview/peer-metrics-table';
import { useSemanticModelQuery } from '@/hooks/use-semantic-model-query';
import { formatIndianNumber, formatRatio } from '@/lib/format-overview';
import { rowsToCompanyMap } from '@/lib/overview-data';
import { buildLeverageTableQuery } from '@/queries/leverage-cashflow/leverage-cashflow-dax';
import { PEER_ORDER } from '@/queries/overview/overview-dax';

const CONNECTION = 'peerBenchmarking';

const ROWS: MetricRowDef[] = [
  { key: 'NetDebt', label: 'Net Debt (₹ Cr)', format: (v) => formatIndianNumber(v), direction: 'lowerIsBetter' },
  {
    key: 'NetDebtEbitda',
    label: 'Net Debt / EBITDA',
    format: (v) => `${formatRatio(v, 2)}x`,
    direction: 'lowerIsBetter',
  },
  {
    key: 'NetDebtEquity',
    label: 'Net Debt / Equity',
    format: (v) => formatRatio(v, 2),
    direction: 'lowerIsBetter',
  },
  { key: 'CFO', label: 'Cash Flow From Operations (₹ Cr)', format: (v) => formatIndianNumber(v) },
  { key: 'CFI', label: 'Cash Flow From Investing (₹ Cr)', format: (v) => formatIndianNumber(v) },
  { key: 'CFF', label: 'Cash Flow From Financing (₹ Cr)', format: (v) => formatIndianNumber(v) },
  { key: 'FCF', label: 'Free Cash Flow (₹ Cr)', format: (v) => formatIndianNumber(v) },
  {
    key: 'CAPEX',
    label: 'CAPEX',
    // Stored as a negative outflow ([Free Cash Flow] = [CFO] + [CAPEX], verified live) — negated for display only.
    format: (v) => formatIndianNumber(v == null ? v : -v),
  },
];

export function LeverageTable({ fyYear }: { fyYear: string }) {
  const { data, isLoading, error } = useSemanticModelQuery({
    connection: CONNECTION,
    query: buildLeverageTableQuery(fyYear),
  });

  if (isLoading) {
    return <div className="h-72 animate-pulse rounded-md bg-muted" />;
  }

  if (error || data?.status !== 'success') {
    return (
      <div className="rounded-md border border-destructive bg-destructive/10 p-l text-300 text-destructive">
        Failed to load Leverage & Cash Flows
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
      title="Leverage & Cash Flows"
      companies={PEER_ORDER}
      rows={ROWS}
      data={byCompany}
    />
  );
}
