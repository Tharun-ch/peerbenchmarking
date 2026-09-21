import { useState } from 'react';

import { useSemanticModelQuery } from '@/hooks/use-semantic-model-query';
import { rowsToCompanyMap } from '@/lib/overview-data';
import { cn } from '@/lib/utils';
import { buildCostBridgeInputsQuery, DRL } from '@/queries/cost-structure/cost-structure-dax';
import { getCappedFyYearOptions, formatFyYearShort, PEER_ORDER } from '@/queries/overview/overview-dax';

import { FieldSelect } from '@/components/overview/field-select';

const CONNECTION = 'peerBenchmarking';
const FY_YEAR_OPTIONS = getCappedFyYearOptions();
const PEER_CHOICES = PEER_ORDER.filter((c) => c !== DRL);

const CHART_HEIGHT = 240;
const COL_WIDTH = 100 / 5;
const BAR_WIDTH = 12;

interface BridgeInputs {
  CogsPct: number | null;
  RndPct: number | null;
  EBITDAMargin: number | null;
}

interface WaterfallStep {
  label: string;
  /** Value-space range this bar's floating segment spans (lo <= hi). */
  lo: number;
  hi: number;
  /** The signed contribution this step represents (for the label). */
  delta: number;
  kind: 'anchor' | 'positive' | 'negative';
}

interface WaterfallData {
  steps: WaterfallStep[];
  /** The 4 running-total levels at each junction between steps, for connector lines. */
  connectorLevels: number[];
}

/**
 * The mapping doc marks this chart's formula as "to be provided" — there's
 * no stored measure or documented spec for it. This is a best-effort
 * decomposition, confirmed with the user: walk from the selected peer's
 * EBITDA Margin % to DRL's, via COGS and R&D deltas (the two cost lines
 * with consistent cross-company Bloomberg coverage), with "SG&A & Others"
 * as the residual bucket that makes the walk sum exactly to the real
 * margin gap — SG&A/Personnel/Other Opex have too many cross-company
 * reporting gaps (§ mapping doc) to decompose individually. Verified
 * against the live model: the COGS step matches the mapping doc's mockup
 * almost exactly (-27.5 vs a computed -27.49 for Sun Pharma -> DRL, FY2026).
 *
 * Rendered as a true running-total waterfall (each step's floating segment
 * starts exactly where the previous one ended), not independent bars.
 */
function buildWaterfall(peerLabel: string, peer: BridgeInputs, drl: BridgeInputs): WaterfallData {
  const start = (peer.EBITDAMargin ?? 0) * 100;
  const cogsStep = -((drl.CogsPct ?? 0) - (peer.CogsPct ?? 0)) * 100;
  const afterCogs = start + cogsStep;
  const rndStep = -((drl.RndPct ?? 0) - (peer.RndPct ?? 0)) * 100;
  const afterRnd = afterCogs + rndStep;
  const end = (drl.EBITDAMargin ?? 0) * 100;
  const othersStep = end - afterRnd;

  const steps: WaterfallStep[] = [
    { label: `${peerLabel} EBITDA`, lo: Math.min(0, start), hi: Math.max(0, start), delta: start, kind: 'anchor' },
    {
      label: 'COGS',
      lo: Math.min(start, afterCogs),
      hi: Math.max(start, afterCogs),
      delta: cogsStep,
      kind: cogsStep >= 0 ? 'positive' : 'negative',
    },
    {
      label: 'R&D',
      lo: Math.min(afterCogs, afterRnd),
      hi: Math.max(afterCogs, afterRnd),
      delta: rndStep,
      kind: rndStep >= 0 ? 'positive' : 'negative',
    },
    {
      label: 'SG&A & Others',
      lo: Math.min(afterRnd, end),
      hi: Math.max(afterRnd, end),
      delta: othersStep,
      kind: othersStep >= 0 ? 'positive' : 'negative',
    },
    { label: 'DRL EBITDA', lo: Math.min(0, end), hi: Math.max(0, end), delta: end, kind: 'anchor' },
  ];

  return { steps, connectorLevels: [start, afterCogs, afterRnd, end] };
}

function barLeftPct(i: number): number {
  return i * COL_WIDTH + (COL_WIDTH - BAR_WIDTH) / 2;
}

function barCenterPct(i: number): number {
  return barLeftPct(i) + BAR_WIDTH / 2;
}

export function EbitdaBridge({ fyYear }: { fyYear: string }) {
  const [peerCompany, setPeerCompany] = useState<string>(PEER_CHOICES[0]);
  const [peerFyYear, setPeerFyYear] = useState(fyYear);
  const [drlFyYear, setDrlFyYear] = useState(fyYear);

  const peerQuery = useSemanticModelQuery({
    connection: CONNECTION,
    query: buildCostBridgeInputsQuery(peerFyYear),
  });
  const drlQuery = useSemanticModelQuery({
    connection: CONNECTION,
    query: buildCostBridgeInputsQuery(drlFyYear),
  });

  if (peerQuery.isLoading || drlQuery.isLoading) {
    return <div className="h-[360px] animate-pulse rounded-md bg-muted" />;
  }

  if (peerQuery.data?.status !== 'success' || drlQuery.data?.status !== 'success') {
    const errored = [peerQuery.data, drlQuery.data].find((d) => d?.status === 'error');
    return (
      <div className="rounded-md border border-destructive bg-destructive/10 p-l text-300 text-destructive">
        Failed to load EBITDA Bridge
        {errored?.status === 'error' ? `: ${errored.error.message}` : '.'}
      </div>
    );
  }

  const peerByCompany = rowsToCompanyMap(peerQuery.data.table, ['CogsPct', 'RndPct', 'EBITDAMargin']);
  const drlByCompany = rowsToCompanyMap(drlQuery.data.table, ['CogsPct', 'RndPct', 'EBITDAMargin']);

  const peer: BridgeInputs = {
    CogsPct: peerByCompany[peerCompany]?.CogsPct ?? null,
    RndPct: peerByCompany[peerCompany]?.RndPct ?? null,
    EBITDAMargin: peerByCompany[peerCompany]?.EBITDAMargin ?? null,
  };
  const drl: BridgeInputs = {
    CogsPct: drlByCompany[DRL]?.CogsPct ?? null,
    RndPct: drlByCompany[DRL]?.RndPct ?? null,
    EBITDAMargin: drlByCompany[DRL]?.EBITDAMargin ?? null,
  };

  const { steps, connectorLevels } = buildWaterfall(peerCompany, peer, drl);

  const allLevels = [0, ...steps.flatMap((s) => [s.lo, s.hi])];
  const domainMin = Math.min(...allLevels);
  const domainMax = Math.max(...allLevels) * 1.2 || 1;
  const domainSpan = domainMax - domainMin || 1;
  const topPct = (v: number) => ((domainMax - v) / domainSpan) * 100;
  const baselinePct = topPct(0);

  return (
    <section className="rounded-md border border-ca-card-border bg-card px-xl pt-l pb-l">
      <h3 className="m-0 mb-l text-[14px] font-semibold text-foreground">EBITDA Bridge</h3>
      <p className="mt-[-8px] mb-l text-[11px] text-ca-text-muted">
        {peerCompany} EBITDA % → COGS → R&amp;D → SG&amp;A &amp; Others → DRL EBITDA %
      </p>

      <div className="relative" style={{ height: CHART_HEIGHT }}>
        {/* Zero baseline */}
        <div
          className="absolute right-0 left-0 border-t border-ca-table-border"
          style={{ top: `${baselinePct}%` }}
        />

        {/* Connector lines between steps */}
        {connectorLevels.map((level, i) => {
          const left = barLeftPct(i) + BAR_WIDTH;
          const width = barLeftPct(i + 1) - left;
          return (
            <div
              key={i}
              className="absolute border-t-2 border-dashed border-ca-text-muted/60"
              style={{ top: `${topPct(level)}%`, left: `${left}%`, width: `${width}%` }}
            />
          );
        })}

        {/* Bars */}
        {steps.map((step, i) => {
          const topEdge = topPct(step.hi);
          const bottomEdge = topPct(step.lo);
          const heightPct = Math.max(bottomEdge - topEdge, 1.5);
          const isNegative = step.kind === 'negative';
          return (
            <div key={step.label}>
              <div
                className={cn(
                  'absolute flex items-center justify-center rounded-sm',
                  step.kind === 'anchor' && 'bg-ca-purple',
                  step.kind === 'positive' && 'bg-ca-green',
                  isNegative && 'bg-ca-orange'
                )}
                style={{
                  top: `${topEdge}%`,
                  height: `${heightPct}%`,
                  left: `${barLeftPct(i)}%`,
                  width: `${BAR_WIDTH}%`,
                }}
              />
              <span
                className={cn(
                  'absolute -translate-x-1/2 -translate-y-full text-[12px] font-semibold whitespace-nowrap',
                  step.kind === 'anchor' ? 'text-foreground' : 'text-[#2f2f2f]'
                )}
                style={{ top: `${topEdge}%`, left: `${barCenterPct(i)}%` }}
              >
                {step.kind !== 'anchor' && step.delta >= 0 ? '+' : ''}
                {step.delta.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-s flex gap-m">
        {steps.map((step, i) => (
          <div key={step.label} className="flex flex-1 flex-col items-center gap-xs">
            <span className="text-center text-[11px] font-medium text-ca-text">{step.label}</span>
            {i === 0 && (
              <div className="flex w-full flex-col gap-xs">
                <FieldSelect value={peerCompany} onChange={setPeerCompany} options={PEER_CHOICES} />
                <FieldSelect
                  value={peerFyYear}
                  onChange={setPeerFyYear}
                  options={FY_YEAR_OPTIONS}
                  optionLabel={formatFyYearShort}
                />
              </div>
            )}
            {i === steps.length - 1 && (
              <div className="w-full">
                <FieldSelect
                  value={drlFyYear}
                  onChange={setDrlFyYear}
                  options={FY_YEAR_OPTIONS}
                  optionLabel={formatFyYearShort}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
