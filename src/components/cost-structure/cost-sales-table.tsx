import { useLayoutEffect, useRef, useState } from 'react';

import { useSemanticModelQuery } from '@/hooks/use-semantic-model-query';
import { formatIndianNumber, formatPercentValue } from '@/lib/format-overview';
import { rowsToCompanyMap } from '@/lib/overview-data';
import { buildCostStructureQuery } from '@/queries/cost-structure/cost-structure-dax';
import { PEER_ORDER } from '@/queries/overview/overview-dax';

const CONNECTION = 'peerBenchmarking';

interface SegmentRow {
  key: 'COGS' | 'SGA' | 'RnD' | 'Personnel';
  label: string;
}

const SEGMENTS: SegmentRow[] = [
  { key: 'COGS', label: 'COGS' },
  { key: 'SGA', label: 'SG&A' },
  { key: 'RnD', label: 'R&D' },
  { key: 'Personnel', label: 'Personnel' },
];

interface FocalBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Two-line cells (amount + % of sales) don't fit `PeerMetricsTable`'s
 * single-value-per-cell contract, so this table is a standalone component
 * rather than a new mode on the shared primitive — keeps every other table
 * in the app (which does use `PeerMetricsTable`) untouched. The focal-box
 * (DRL outline) technique is duplicated from `peer-metrics-table.tsx` for
 * visual parity, not imported, for the same isolation reason.
 */
export function CostSalesTable({ fyYear, quarter }: { fyYear: string; quarter?: string }) {
  const { data, isLoading, error } = useSemanticModelQuery({
    connection: CONNECTION,
    query: buildCostStructureQuery(fyYear, quarter),
  });

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
  }, [data]);

  if (isLoading) {
    return <div className="h-64 animate-pulse rounded-md bg-muted" />;
  }

  if (error || data?.status !== 'success') {
    return (
      <div className="rounded-md border border-destructive bg-destructive/10 p-l text-300 text-destructive">
        Failed to load Cost & % of Sales
        {data?.status === 'error' ? `: ${data.error.message}` : '.'}
      </div>
    );
  }

  const byCompany = rowsToCompanyMap(data.table, ['COGS', 'SGA', 'RnD', 'Personnel', 'Revenue']);
  const lastRowIndex = SEGMENTS.length - 1;

  return (
    <section className="rounded-md border border-ca-card-border bg-card px-xl pt-l pb-l">
      <h3 className="m-0 text-[14px] font-semibold text-foreground">
        Cost (₹ Cr) &amp; as a % of Sales
      </h3>
      <p className="mt-xs mb-m text-[11px] text-ca-text-muted">
        Bloomberg indicated SG&amp;A for DRL but only Selling &amp; Marketing on an annual basis for peers
      </p>
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
                  Segment
                </th>
                {PEER_ORDER.map((company, i) => (
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
              {SEGMENTS.map((segment, rowIndex) => {
                const isLastRow = rowIndex === lastRowIndex;
                return (
                  <tr
                    key={segment.key}
                    className={rowIndex % 2 === 1 ? 'bg-ca-row-alt' : 'bg-card'}
                  >
                    <td className="border-b border-ca-row-border px-m py-xs text-[11px] whitespace-nowrap">
                      <div className="font-semibold text-[#484848]">{segment.label}</div>
                      <div className="text-ca-text-muted">% of Total</div>
                    </td>
                    {PEER_ORDER.map((company, i) => {
                      const amount = byCompany[company]?.[segment.key];
                      const revenue = byCompany[company]?.Revenue;
                      const pctOfSales =
                        amount != null && revenue ? amount / revenue : null;
                      return (
                        <td
                          key={company}
                          ref={i === 0 && isLastRow ? focalLastCellRef : undefined}
                          className="border-b border-ca-row-border px-m py-xs text-left text-[11px] whitespace-nowrap tabular-nums"
                        >
                          <div className="font-medium text-ca-text">
                            {formatIndianNumber(amount)}
                          </div>
                          <div className="text-ca-text-muted">
                            {formatPercentValue(pctOfSales)}%
                          </div>
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
