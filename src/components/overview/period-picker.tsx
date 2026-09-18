import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  formatFyYearShort,
  getCappedFyYearOptions,
  QUARTER_OPTIONS,
} from '@/queries/overview/overview-dax';

import { FieldSelect } from './field-select';

// No Period slicer in the app offers the current (in-progress) fiscal year or later.
// Computed once at module load — the app is a static SPA reloaded on each visit,
// so this still re-evaluates against "today" on every fresh page load.
const CAPPED_FY_YEAR_OPTIONS = getCappedFyYearOptions();

export type PeriodMode = 'quarter' | 'year';

export interface PeriodValue {
  mode: PeriodMode;
  fyYear: string;
  quarter: string;
}

interface PeriodPickerProps {
  value: PeriodValue;
  onApply: (value: PeriodValue) => void;
}

export function PeriodPicker({ value, onApply }: PeriodPickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<PeriodValue>(value);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(value);
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-8 items-center gap-s rounded-md border border-ca-input-border bg-card px-m text-[12px] text-[#4A4A4A] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {value.fyYear}
          {value.mode === 'quarter' && ` · ${value.quarter}`}
          <ChevronDown className="icon-size-200 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-l" align="end">
        <div className="mb-l flex rounded-md bg-ca-pill p-xxs">
          {(['quarter', 'year'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setDraft((d) => ({ ...d, mode }))}
              className={cn(
                'flex-1 rounded-md py-s text-300 font-medium capitalize transition-colors',
                draft.mode === mode
                  ? 'bg-card text-ca-accent shadow-sm'
                  : 'text-muted-foreground'
              )}
            >
              {mode}
            </button>
          ))}
        </div>

        <div
          className={cn(
            'grid gap-m',
            draft.mode === 'quarter' ? 'grid-cols-2' : 'grid-cols-1'
          )}
        >
          <div className="flex flex-col gap-xs">
            <span className="text-100 font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              Fiscal Year
            </span>
            <FieldSelect
              value={draft.fyYear}
              onChange={(fyYear) => setDraft((d) => ({ ...d, fyYear }))}
              options={CAPPED_FY_YEAR_OPTIONS}
              optionLabel={formatFyYearShort}
            />
          </div>
          {draft.mode === 'quarter' && (
            <div className="flex flex-col gap-xs">
              <span className="text-100 font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                Quarter
              </span>
              <FieldSelect
                value={draft.quarter}
                onChange={(quarter) => setDraft((d) => ({ ...d, quarter }))}
                options={QUARTER_OPTIONS}
              />
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            onApply(draft);
            setOpen(false);
          }}
          className="mt-l w-full rounded-md bg-ca-accent py-m text-300 font-semibold text-ca-accent-foreground transition-colors hover:brightness-110"
        >
          Apply
        </button>
      </PopoverContent>
    </Popover>
  );
}
