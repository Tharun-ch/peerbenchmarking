import { KpiCard } from '@/components/overview/kpi-card';
import { useSemanticModelQuery } from '@/hooks/use-semantic-model-query';
import { formatIndianNumber, formatRatio } from '@/lib/format-overview';
import { buildValuationKpiQuery } from '@/queries/valuation/valuation-dax';

const CONNECTION = 'peerBenchmarking';

function skeletonCards() {
  return (
    <div className="flex flex-wrap gap-m">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="h-28 min-w-[180px] flex-1 animate-pulse rounded-md bg-muted"
        />
      ))}
    </div>
  );
}

export function ValuationKpiStrip({ fyYear }: { fyYear: string }) {
  const { data, isLoading, error } = useSemanticModelQuery({
    connection: CONNECTION,
    query: buildValuationKpiQuery(fyYear),
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
  const [sharePrice, marketCap, pe, evEbitda, evSales] = row ?? [];

  return (
    <div className="flex flex-wrap gap-m">
      <KpiCard
        label="DRL Share Price (₹)"
        value={`₹${formatIndianNumber(sharePrice, 1)}`}
      />
      <KpiCard
        label="DRL Market Cap (₹ Cr)"
        value={formatIndianNumber(marketCap)}
      />
      <KpiCard label="DRL P/E" value={`${formatRatio(pe)}x`} />
      <KpiCard label="DRL EV/EBITDA" value={`${formatRatio(evEbitda)}x`} />
      <KpiCard label="DRL EV/Sales" value={`${formatRatio(evSales)}x`} />
    </div>
  );
}
