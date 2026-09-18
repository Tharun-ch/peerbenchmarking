import type { ReactNode } from 'react';
import { useLayoutEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

export type MetricDirection = 'higherIsBetter' | 'lowerIsBetter';

export interface MetricRowDef {
  key: string;
  label: string;
  format: (value: number | null | undefined) => string;
  /** Which extreme counts as "best" (green) vs "worst" (peach). Defaults to higherIsBetter. */
  direction?: MetricDirection;
}

interface PeerMetricsTableProps {
  title: string;
  /** Ordered company names; the first is treated as the focal company (boxed). */
  companies: readonly string[];
  rows: MetricRowDef[];
  /** company -> row key -> raw numeric value (or null/undefined if unavailable). */
  data: Record<string, Record<string, number | null | undefined>>;
  /** Highlight the best value in a row green and the worst orange. Defaults to true. */
  highlight?: boolean;
  /** Optional controls rendered in the title row (e.g. a forecast-period dropdown). */
  headerAction?: ReactNode;
}

interface FocalBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Optionally highlights the best value in a row green and the worst orange —
 * excluding the focal (first) company, which gets its own outline box
 * instead — skipping rows with fewer than 2 comparable candidates.
 */
export function PeerMetricsTable({
  title,
  companies,
  rows,
  data,
  highlight = true,
  headerAction,
}: PeerMetricsTableProps) {
  const lastRowIndex = rows.length - 1;

  const frameRef = useRef<HTMLDivElement | null>(null);
  const focalHeaderRef = useRef<HTMLTableCellElement | null>(null);
  const focalLastCellRef = useRef<HTMLTableCellElement | null>(null);
  const [focalBox, setFocalBox] = useState<FocalBox | null>(null);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const headerCell = focalHeaderRef.current;
    const lastCell = focalLastCellRef.current;
    if (!frame || !headerCell || !lastCell) {
      setFocalBox(null);
      return;
    }

    const update = () => {
      const frameRect = frame.getBoundingClientRect();
      const headerRect = headerCell.getBoundingClientRect();
      const lastRect = lastCell.getBoundingClientRect();
      setFocalBox({
        left: headerRect.left - frameRect.left,
        top: headerRect.top - frameRect.top,
        width: headerRect.width,
        height: lastRect.bottom - headerRect.top,
      });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    observer.observe(headerCell);
    observer.observe(lastCell);
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [companies, rows]);

  return (
    <section className="rounded-md border border-ca-card-border bg-card px-xl pt-l pb-l">
      <div className="mb-m flex items-center justify-between gap-m">
        <h3 className="m-0 text-[14px] font-semibold text-foreground">{title}</h3>
        {headerAction}
      </div>
      <div className="overflow-x-auto overflow-y-hidden rounded-md border border-ca-table-border">
        <div ref={frameRef} className="relative inline-block min-w-full">
          {focalBox && (
            <div
              className="pointer-events-none absolute z-10 border-2 border-ca-focal-border"
              style={{
                left: focalBox.left,
                top: focalBox.top,
                width: focalBox.width,
                height: focalBox.height,
              }}
            />
          )}
          <table className="min-w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-ca-purple">
                <th className="px-m py-s text-left text-[10px] font-medium whitespace-nowrap text-white">
                  Metric
                </th>
                {companies.map((company, i) => (
                  <th
                    key={company}
                    ref={i === 0 ? focalHeaderRef : undefined}
                    className="px-m py-s text-left text-[10px] font-medium whitespace-nowrap text-white"
                  >
                    {company}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => {
                const values = companies.map((c) => data[c]?.[row.key] ?? null);
                const direction = row.direction ?? 'higherIsBetter';
                const candidates = values
                  .map((v, i) => ({ v, i }))
                  .filter(
                    (x): x is { v: number; i: number } =>
                      x.v != null && !Number.isNaN(x.v) && x.i !== 0
                  );

                let bestIndex: number | null = null;
                let worstIndex: number | null = null;
                if (highlight && candidates.length >= 2) {
                  const best = candidates.reduce((a, b) =>
                    (direction === 'higherIsBetter' ? b.v > a.v : b.v < a.v) ? b : a
                  );
                  const worst = candidates.reduce((a, b) =>
                    (direction === 'higherIsBetter' ? b.v < a.v : b.v > a.v) ? b : a
                  );
                  if (best.i !== worst.i) {
                    bestIndex = best.i;
                    worstIndex = worst.i;
                  }
                }

                const isLastRow = rowIndex === lastRowIndex;

                return (
                  <tr
                    key={row.key}
                    className={rowIndex % 2 === 1 ? 'bg-ca-row-alt' : 'bg-card'}
                  >
                    <td className="border-b border-ca-row-border px-m py-xs text-[11px] whitespace-nowrap text-[#484848]">
                      {row.label}
                    </td>
                    {companies.map((company, i) => {
                      const value = values[i];
                      const isBest = i === bestIndex;
                      const isWorst = i === worstIndex;
                      return (
                        <td
                          key={company}
                          ref={
                            i === 0 && isLastRow ? focalLastCellRef : undefined
                          }
                          className={cn(
                            'border-b border-ca-row-border px-m py-xs text-left text-[11px] whitespace-nowrap text-ca-text tabular-nums',
                            isBest && 'bg-ca-green',
                            isWorst && 'bg-ca-orange'
                          )}
                        >
                          {row.format(value)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
