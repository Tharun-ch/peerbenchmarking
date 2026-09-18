import { useState } from 'react';

import { useSemanticModelQuery } from '@/hooks/use-semantic-model-query';
import { rowsToCompanyMap } from '@/lib/overview-data';
import { buildTrendQuery, type TrendMeasure } from '@/queries/trend-analysis/trend-analysis-dax';

import { TrendAnalysisChart } from './trend-analysis-chart';
import { TrendKpiStrip } from './trend-kpi-strip';

const CONNECTION = 'peerBenchmarking';

export function TrendAnalysisTab({ fyYear }: { fyYear: string }) {
  const [measure, setMeasure] = useState<TrendMeasure>('Revenue');

  const { data, isLoading, error } = useSemanticModelQuery({
    connection: CONNECTION,
    query: buildTrendQuery(fyYear, measure),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-xxl">
        <div className="grid grid-cols-2 gap-m sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
        <div className="h-[440px] animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  if (error || data?.status !== 'success') {
    return (
      <div className="rounded-md border border-destructive bg-destructive/10 p-l text-300 text-destructive">
        Failed to load {measure} trend data
        {data?.status === 'error' ? `: ${data.error.message}` : '.'}
      </div>
    );
  }

  const byCompany = rowsToCompanyMap(data.table, ['Value', 'Growth']);

  return (
    <div className="flex flex-col gap-xxl">
      <TrendKpiStrip measure={measure} data={byCompany} />
      <TrendAnalysisChart measure={measure} onMeasureChange={setMeasure} data={byCompany} />
    </div>
  );
}
