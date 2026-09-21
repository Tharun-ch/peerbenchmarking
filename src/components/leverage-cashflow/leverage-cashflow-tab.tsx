import { LeverageConsensusEstimates } from './leverage-consensus-estimates';
import { LeverageKpiStrip } from './leverage-kpi-strip';
import { LeverageTable } from './leverage-table';
import { WorkingCapitalTable } from './working-capital-table';

export function LeverageCashFlowTab({ fyYear }: { fyYear: string }) {
  return (
    <div className="flex flex-col gap-xxl">
      <LeverageKpiStrip fyYear={fyYear} />
      <LeverageTable fyYear={fyYear} />
      <WorkingCapitalTable fyYear={fyYear} />
      <LeverageConsensusEstimates />
    </div>
  );
}
