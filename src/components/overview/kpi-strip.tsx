import {
  formatIndianNumber,
  formatPercentValue,
  formatRatio,
  formatSignedPercent,
} from '@/lib/format-overview';
import { useSemanticModelQuery } from '@/hooks/use-semantic-model-query';
import {
  buildKpiCoreQuery,
  buildKpiFyOnlyQuery,
  buildPeerPoolSizesQuery,
  type ComparisonMode,
} from '@/queries/overview/overview-dax';

import { KpiCard } from './kpi-card';

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

export function KpiStrip({
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
    query: buildKpiCoreQuery(fyYear, quarter, comparisonMode),
  });
  const fyOnly = useSemanticModelQuery({
    connection: CONNECTION,
    query: buildKpiFyOnlyQuery(fyYear),
  });
  const poolSizes = useSemanticModelQuery({
    connection: CONNECTION,
    query: buildPeerPoolSizesQuery(),
  });

  if (core.isLoading || fyOnly.isLoading || poolSizes.isLoading) {
    return skeletonCards();
  }

  if (
    core.data?.status !== 'success' ||
    fyOnly.data?.status !== 'success' ||
    poolSizes.data?.status !== 'success'
  ) {
    const errored = [core.data, fyOnly.data, poolSizes.data].find(
      (d) => d?.status === 'error'
    );
    return (
      <div className="rounded-md border border-destructive bg-destructive/10 p-l text-300 text-destructive">
        Failed to load KPI data
        {errored?.status === 'error' ? `: ${errored.error.message}` : '.'}
      </div>
    );
  }

  const coreRow = core.data.table.rows[0] as (number | null)[] | undefined;
  const [revenue, revenueGrowth, ebitda, ebitdaMargin] = coreRow ?? [];

  const fyOnlyRow = fyOnly.data.table.rows[0] as (number | null)[] | undefined;
  const [roce, peerAvgRoce, roceGap, pe, marketCapRank, ltiRank] =
    fyOnlyRow ?? [];

  const poolRow = poolSizes.data.table.rows[0] as [number, number];
  const [top10Count, ltiCount] = poolRow;

  return (
    <div className="flex flex-wrap gap-m">
      <KpiCard
        label="DRL Revenue (₹ Cr)"
        value={formatIndianNumber(revenue)}
        subtext={`Growth ${formatPercentValue(revenueGrowth)}%`}
      />
      <KpiCard
        label="DRL EBITDA Margin %"
        value={formatPercentValue(ebitdaMargin)}
        subtext={`Absolute EBITDA: ₹${formatIndianNumber(ebitda)} Cr`}
      />
      <KpiCard
        label="DRL ROCE %"
        value={formatPercentValue(roce)}
        subtext={`Peer avg ${formatPercentValue(peerAvgRoce)}% · gap ${formatSignedPercent(roceGap)}%`}
      />
      <KpiCard label="DRL P/E" value={`${formatRatio(pe)}x`} />
      <KpiCard
        label="DRL Market-Cap Rank Overall"
        value={`${marketCapRank ?? 'N/A'} of ${top10Count}`}
        subtext={`LTI Rank - ${ltiRank ?? 'N/A'} of ${ltiCount}`}
      />
    </div>
  );
}
