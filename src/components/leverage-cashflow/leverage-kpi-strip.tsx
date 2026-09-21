import { KpiCard } from '@/components/overview/kpi-card';
import { useSemanticModelQuery } from '@/hooks/use-semantic-model-query';
import { formatIndianNumber, formatRatio } from '@/lib/format-overview';
import { buildLeverageKpiQuery } from '@/queries/leverage-cashflow/leverage-cashflow-dax';

const CONNECTION = 'peerBenchmarking';

function skeletonCards() {
  return (
    <div className="grid grid-cols-3 gap-m">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-28 animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  );
}

export function LeverageKpiStrip({ fyYear }: { fyYear: string }) {
  const { data, isLoading, error } = useSemanticModelQuery({
    connection: CONNECTION,
    query: buildLeverageKpiQuery(fyYear),
  });

  if (isLoading) return skeletonCards();

  if (error || data?.status !== 'success') {
    return (
      <div className="rounded-md border border-destructive bg-destructive/10 p-l text-300 text-destructive">
        Failed to load KPI data
        {data?.status === 'error' ? `: ${data.error.message}` : '.'}
      </div>
    );
  }

  const row = data.table.rows[0] as (number | null)[] | undefined;
  const [netDebt, netDebtEbitda, netDebtEquity, cfo, cfi, cff] = row ?? [];

  return (
    <div className="grid grid-cols-3 gap-m">
      <KpiCard label="DRL Net Debt (₹ Cr)" value={formatIndianNumber(netDebt)} />
      <KpiCard label="DRL Net Debt / EBITDA" value={`${formatRatio(netDebtEbitda, 2)}x`} />
      <KpiCard label="DRL Net Debt / Equity" value={`${formatRatio(netDebtEquity, 2)}x`} />
      <KpiCard
        label="DRL Cash Flow From Operations (₹ Cr)"
        value={formatIndianNumber(cfo)}
      />
      <KpiCard
        label="DRL Cash Flow From Investing Activities (₹ Cr)"
        value={formatIndianNumber(cfi)}
      />
      <KpiCard
        label="DRL Cash Flow From Financing Activities (₹ Cr)"
        value={formatIndianNumber(cff)}
      />
    </div>
  );
}
