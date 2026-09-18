import { KpiCard } from '@/components/overview/kpi-card';
import { formatIndianNumber, formatRatio } from '@/lib/format-overview';
import { PEER_ORDER } from '@/queries/overview/overview-dax';
import type { TrendMeasure } from '@/queries/trend-analysis/trend-analysis-dax';

import { displayCompanyName } from './trend-format';

function formatMeasureValue(
  measure: TrendMeasure,
  value: number | null | undefined
): string {
  return measure === 'P/E' ? `${formatRatio(value)}x` : formatIndianNumber(value);
}

export function TrendKpiStrip({
  measure,
  data,
}: {
  measure: TrendMeasure;
  data: Record<string, Record<string, number | null | undefined>>;
}) {
  return (
    <div className="grid grid-cols-2 gap-m sm:grid-cols-3 lg:grid-cols-4">
      {PEER_ORDER.map((company) => (
        <KpiCard
          key={company}
          label={`${displayCompanyName(company)} ${measure}`}
          value={formatMeasureValue(measure, data[company]?.Value)}
        />
      ))}
    </div>
  );
}
