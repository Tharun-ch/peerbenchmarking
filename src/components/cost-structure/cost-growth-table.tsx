import { useSemanticModelQuery } from '@/hooks/use-semantic-model-query';
import { formatSignedPercent } from '@/lib/format-overview';
import { rowsToCompanyMap } from '@/lib/overview-data';
import { buildCostGrowthQuery } from '@/queries/cost-structure/cost-structure-dax';
import { PEER_ORDER } from '@/queries/overview/overview-dax';
import { PeerMetricsTable, type MetricRowDef } from '@/components/overview/peer-metrics-table';

const CONNECTION = 'peerBenchmarking';

const SEGMENT_KEYS = ['COGS', 'SGA', 'RnD', 'Personnel'] as const;

const ROWS: MetricRowDef[] = [
  { key: 'COGS', label: 'COGS', format: (v) => `${formatSignedPercent(v)}%`, direction: 'lowerIsBetter' },
  { key: 'SGA', label: 'SG&A', format: (v) => `${formatSignedPercent(v)}%`, direction: 'lowerIsBetter' },
  { key: 'RnD', label: 'R&D', format: (v) => `${formatSignedPercent(v)}%`, direction: 'lowerIsBetter' },
  {
    key: 'Personnel',
    label: 'Personnel',
    format: (v) => `${formatSignedPercent(v)}%`,
    direction: 'lowerIsBetter',
  },
];

export function CostGrowthTable({ fyYear, quarter }: { fyYear: string; quarter?: string }) {
  const { data, isLoading, error } = useSemanticModelQuery({
    connection: CONNECTION,
    query: buildCostGrowthQuery(fyYear, quarter),
  });

  if (isLoading) {
    return <div className="h-48 animate-pulse rounded-md bg-muted" />;
  }

  if (error || data?.status !== 'success') {
    return (
      <div className="rounded-md border border-destructive bg-destructive/10 p-l text-300 text-destructive">
        Failed to load Cost Increase/Decrease
        {data?.status === 'error' ? `: ${data.error.message}` : '.'}
      </div>
    );
  }

  const keys = SEGMENT_KEYS.flatMap((k) => [k, `${k}Prior`]);
  const raw = rowsToCompanyMap(data.table, keys);
  const byCompany = Object.fromEntries(
    PEER_ORDER.map((company) => {
      const row = raw[company] ?? {};
      const growth: Record<string, number | null> = {};
      for (const key of SEGMENT_KEYS) {
        const current = row[key];
        const prior = row[`${key}Prior`];
        growth[key] = current != null && prior ? (current - prior) / prior : null;
      }
      return [company, growth];
    })
  );

  return (
    <PeerMetricsTable
      title="Cost Increase/Decrease (YoY %)"
      companies={PEER_ORDER}
      rows={ROWS}
      data={byCompany}
    />
  );
}
