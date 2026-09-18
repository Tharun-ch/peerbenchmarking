import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { PEER_ORDER } from '@/queries/overview/overview-dax';
import {
  TREND_MEASURES,
  type TrendMeasure,
} from '@/queries/trend-analysis/trend-analysis-dax';

import { displayCompanyName } from './trend-format';

const COMPANY_OPTIONS = ['All', ...PEER_ORDER.map(displayCompanyName)] as const;
const CHART_MAX_FLOOR = 10;

const compactFormatter = new Intl.NumberFormat('en-IN', { notation: 'compact' });
const wholeFormatter = new Intl.NumberFormat('en-IN');

function InlineSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
}) {
  return (
    <label className="flex items-center gap-s text-[12px] text-[#4F4F4F]">
      <span>{label}</span>
      <div className="relative min-w-[130px]">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-full appearance-none rounded-md border border-ca-input-border bg-card pr-xl pl-m text-[12px] text-[#4A4A4A] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <ChevronDown className="icon-size-100 pointer-events-none absolute top-1/2 right-s -translate-y-1/2 text-[#666666]" />
      </div>
    </label>
  );
}

interface TrendPoint {
  company: string;
  value: number | null;
  deltaPct: number | null;
}

export function TrendAnalysisChart({
  measure,
  onMeasureChange,
  data,
}: {
  measure: TrendMeasure;
  onMeasureChange: (measure: TrendMeasure) => void;
  data: Record<string, Record<string, number | null | undefined>>;
}) {
  const [company, setCompany] = useState<string>('All');

  const points: TrendPoint[] = PEER_ORDER.map((c) => ({
    company: displayCompanyName(c),
    value: data[c]?.Value ?? null,
    deltaPct: data[c]?.Growth != null ? data[c].Growth * 100 : null,
  }));

  const visiblePoints =
    company === 'All' ? points : points.filter((p) => p.company === company);

  const chartMax = Math.max(CHART_MAX_FLOOR, ...points.map((p) => p.value ?? 0)) * 1.1;

  const stepX = visiblePoints.length > 0 ? 100 / visiblePoints.length : 100;
  const polylinePoints = visiblePoints
    .map((point, index) => {
      const x = index * stepX + stepX / 2;
      const y = point.value == null ? 100 : 100 - (point.value / chartMax) * 100;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <section className="rounded-md border border-ca-card-border bg-card p-l">
      <div className="rounded-md border border-ca-table-border bg-ca-header-bg p-l">
        <div className="flex flex-wrap items-center justify-between gap-m border-b border-ca-row-border pb-m">
          <h3 className="m-0 text-[14px] font-medium text-foreground">Trend Analysis</h3>
          <div className="flex flex-wrap items-center gap-l">
            <InlineSelect
              label="Companies:"
              value={company}
              onChange={setCompany}
              options={COMPANY_OPTIONS}
            />
            <InlineSelect
              label="Measure:"
              value={measure}
              onChange={(v) => onMeasureChange(v as TrendMeasure)}
              options={TREND_MEASURES}
            />
          </div>
        </div>

        <div className="relative mt-l h-[340px]">
          <div className="absolute inset-0">
            {[0.75, 0.5, 0.25, 0].map((fraction) => {
              const value = Math.round(chartMax * fraction);
              return (
                <div
                  key={fraction}
                  className="absolute right-0 left-0 border-t border-ca-row-border"
                  style={{ top: `${100 - fraction * 100}%` }}
                >
                  <span className="absolute -left-1 -translate-x-full -translate-y-1/2 text-[11px] text-[#8A97A8]">
                    {compactFormatter.format(value)}
                  </span>
                </div>
              );
            })}
          </div>

          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-x-8 top-4 h-[260px] w-[calc(100%-4rem)] overflow-visible"
          >
            <polyline
              fill="none"
              stroke="#0D67FF"
              strokeWidth="0.6"
              points={polylinePoints}
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          <div className="absolute inset-x-8 top-4 bottom-9 flex items-end justify-between gap-m">
            {visiblePoints.map((point, index) => {
              const barHeight = `${((point.value ?? 0) / chartMax) * 100}%`;
              const isFocal = index === 0 && company === 'All';

              return (
                <div
                  key={point.company}
                  className="flex h-full flex-1 flex-col justify-end"
                >
                  <div
                    className={`relative rounded-sm ${isFocal ? 'bg-ca-accent' : 'bg-[#B9B9B9]'}`}
                    style={{ height: barHeight }}
                  >
                    <div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-[11px]">
                      <span className={isFocal ? 'text-white' : 'text-[#222222]'}>
                        {point.value == null
                          ? 'NA'
                          : wholeFormatter.format(Math.round(point.value))}
                      </span>
                      {point.deltaPct != null && (
                        <span
                          className={
                            point.deltaPct >= 0 ? 'text-[#17803D]' : 'text-[#D84444]'
                          }
                        >
                          {point.deltaPct >= 0 ? '↗' : '↘'}{' '}
                          {Math.abs(point.deltaPct).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-s text-center text-[11px] text-[#777777]">
                    {point.company}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="absolute bottom-0 left-8 flex items-center gap-s text-[12px] text-[#414141]">
            <span className="h-[10px] w-[10px] rounded-full bg-ca-accent" />
            <span>{measure}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
