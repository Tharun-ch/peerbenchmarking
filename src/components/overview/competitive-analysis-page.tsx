import { useState } from 'react';

import { CostStructureTab } from '@/components/cost-structure/cost-structure-tab';
import { LeverageCashFlowTab } from '@/components/leverage-cashflow/leverage-cashflow-tab';
import { ValuationTab } from '@/components/valuation/valuation-tab';
import { TrendAnalysisTab } from '@/components/trend-analysis/trend-analysis-tab';
import { cn } from '@/lib/utils';
import {
  DEFAULT_FY_YEAR,
  type ComparisonMode,
} from '@/queries/overview/overview-dax';

import { ComparisonToggle } from './comparison-toggle';
import { FyYearPicker } from './fy-year-picker';
import { OverviewTab } from './overview-tab';
import { PeriodPicker, type PeriodValue } from './period-picker';

const TABS = [
  'Overview',
  'Revenue & Growth',
  'Cost Structure & EBITDA',
  'Valuation & Returns',
  'Leverage & Cash Flow',
  'CDMO',
  'Consensus',
  'Trend Analysis',
] as const;

const ENABLED_TABS: ReadonlySet<(typeof TABS)[number]> = new Set([
  'Overview',
  'Cost Structure & EBITDA',
  'Valuation & Returns',
  'Leverage & Cash Flow',
  'Trend Analysis',
]);

/** Tabs whose source tables carry a Quarter column (§5.1) — these get the rich Quarter+Year PeriodPicker. */
const QUARTER_CAPABLE_TABS: ReadonlySet<(typeof TABS)[number]> = new Set([
  'Overview',
  'Cost Structure & EBITDA',
]);

const DEFAULT_PERIOD: PeriodValue = {
  mode: 'year',
  fyYear: DEFAULT_FY_YEAR,
  quarter: 'Q1',
};

export function CompetitiveAnalysisPage() {
  const [period, setPeriod] = useState<PeriodValue>(DEFAULT_PERIOD);
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>('Overview');
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>(
    'previous-year-same-quarter'
  );

  const showComparisonToggle = activeTab === 'Overview' && period.mode === 'quarter';

  return (
    <div className="flex h-full flex-col overflow-auto bg-background">
      <div className="border-b border-ca-card-border bg-ca-header-bg">
        <div className="flex flex-wrap items-center justify-between gap-m px-l pt-m">
          <div className="flex flex-wrap items-center gap-s">
            <h1 className="m-0 text-[16px] font-semibold text-foreground">
              Competitive Analysis
            </h1>
            <p className="m-0 text-[9px] font-medium tracking-[0.08em] text-ca-text-muted uppercase">
              Source: <span className="font-semibold text-[#888888]">Bloomberg</span> |
              Data not available in Bloomberg marked as NA
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-m">
            {showComparisonToggle && (
              <ComparisonToggle
                value={comparisonMode}
                onChange={setComparisonMode}
              />
            )}
            <div className="flex items-center gap-s text-[12px] text-[#555555]">
              Period:
              {QUARTER_CAPABLE_TABS.has(activeTab) ? (
                <PeriodPicker value={period} onApply={setPeriod} />
              ) : (
                <FyYearPicker
                  value={period.fyYear}
                  onApply={(fyYear) => setPeriod((p) => ({ ...p, fyYear }))}
                />
              )}
            </div>
          </div>
        </div>

        <div className="mt-m flex flex-wrap gap-l px-l">
          {TABS.map((tab) => {
            const isActive = tab === activeTab;
            const isEnabled = ENABLED_TABS.has(tab);
            return (
              <button
                key={tab}
                type="button"
                disabled={!isEnabled}
                onClick={() => isEnabled && setActiveTab(tab)}
                title={isEnabled ? undefined : 'Coming soon'}
                className={cn(
                  'border-b-2 border-transparent pb-[10px] text-[11px] font-medium whitespace-nowrap transition-colors',
                  isEnabled
                    ? 'text-[#7D7D7D] hover:text-[#4A4A4A]'
                    : 'cursor-not-allowed text-[#7D7D7D]/50',
                  isActive && isEnabled && 'border-ca-accent text-ca-accent'
                )}
              >
                {tab}
              </button>
            );
          })}
        </div>
      </div>

      <main className="flex flex-1 flex-col p-l">
        {activeTab === 'Overview' ? (
          <OverviewTab
            fyYear={period.fyYear}
            quarter={period.mode === 'quarter' ? period.quarter : undefined}
            comparisonMode={period.mode === 'quarter' ? comparisonMode : undefined}
          />
        ) : activeTab === 'Cost Structure & EBITDA' ? (
          <CostStructureTab
            fyYear={period.fyYear}
            quarter={period.mode === 'quarter' ? period.quarter : undefined}
          />
        ) : activeTab === 'Valuation & Returns' ? (
          <ValuationTab fyYear={period.fyYear} />
        ) : activeTab === 'Leverage & Cash Flow' ? (
          <LeverageCashFlowTab fyYear={period.fyYear} />
        ) : activeTab === 'Trend Analysis' ? (
          <TrendAnalysisTab fyYear={period.fyYear} />
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-md border border-ca-card-border bg-card p-xxl text-[12px] text-ca-text-muted">
            {activeTab} — coming soon.
          </div>
        )}
      </main>
    </div>
  );
}
