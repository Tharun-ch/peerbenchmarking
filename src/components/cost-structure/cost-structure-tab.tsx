import { CostGrowthTable } from './cost-growth-table';
import { CostSalesTable } from './cost-sales-table';
import { EbitdaBridge } from './ebitda-bridge';
import { EbitdaTable } from './ebitda-table';

interface CostStructureTabProps {
  fyYear: string;
  /** Only set when the Quarter slicer is active — matches Overview's PeriodPicker. */
  quarter?: string;
}

export function CostStructureTab({ fyYear, quarter }: CostStructureTabProps) {
  return (
    <div className="flex flex-col gap-xxl">
      <CostSalesTable fyYear={fyYear} quarter={quarter} />
      <CostGrowthTable fyYear={fyYear} quarter={quarter} />
      <EbitdaTable fyYear={fyYear} quarter={quarter} />
      <EbitdaBridge fyYear={fyYear} />
    </div>
  );
}
