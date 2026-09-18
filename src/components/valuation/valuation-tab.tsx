import { ConsensusUnavailable } from './consensus-unavailable';
import { ReturnsTable } from './returns-table';
import { SharePriceMarketCapTable } from './share-price-market-cap-table';
import { ValuationKpiStrip } from './valuation-kpi-strip';
import { ValuationMultiplesTable } from './valuation-multiples-table';

export function ValuationTab({ fyYear }: { fyYear: string }) {
  return (
    <div className="flex flex-col gap-xxl">
      <ValuationKpiStrip fyYear={fyYear} />
      <ValuationMultiplesTable fyYear={fyYear} />
      <SharePriceMarketCapTable fyYear={fyYear} />
      <ReturnsTable fyYear={fyYear} />
      <ConsensusUnavailable />
    </div>
  );
}
