import type { ComparisonMode } from '@/queries/overview/overview-dax';

import { ConsensusEstimates } from './consensus-estimates';
import { KpiStrip } from './kpi-strip';
import { MultiplesTable } from './multiples-table';
import { PerformanceHeatmap } from './performance-heatmap';

interface OverviewTabProps {
  fyYear: string;
  /** Only set when the Quarter slicer is active; Multiples & Consensus ignore it (FY-only measures). */
  quarter?: string;
  /** Only meaningful when `quarter` is set — governs Revenue Growth %'s comparison basis. */
  comparisonMode?: ComparisonMode;
}

export function OverviewTab({ fyYear, quarter, comparisonMode }: OverviewTabProps) {
  return (
    <div className="flex flex-col gap-xxl">
      <KpiStrip fyYear={fyYear} quarter={quarter} comparisonMode={comparisonMode} />
      <PerformanceHeatmap
        fyYear={fyYear}
        quarter={quarter}
        comparisonMode={comparisonMode}
      />
      <MultiplesTable fyYear={fyYear} />
      <ConsensusEstimates fyYear={fyYear} />
    </div>
  );
}
