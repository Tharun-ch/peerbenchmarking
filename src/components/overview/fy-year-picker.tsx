import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { formatFyYearShort, getCappedFyYearOptions } from '@/queries/overview/overview-dax';

import { FieldSelect } from './field-select';

// No Period slicer in the app offers the current (in-progress) fiscal year or later.
const CAPPED_FY_YEAR_OPTIONS = getCappedFyYearOptions();

interface FyYearPickerProps {
  value: string;
  onApply: (fyYear: string) => void;
}

/**
 * Same popover shell and styling as the Overview tab's PeriodPicker, minus the
 * Quarter/Year mode toggle and Quarter field — these tabs only ever query at
 * FY grain, so there's nothing for a quarter selection to do.
 */
export function FyYearPicker({ value, onApply }: FyYearPickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

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
          {value}
          <ChevronDown className="icon-size-200 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-m text-[12px]" align="end">
        <div className="flex flex-col gap-xs">
          <span className="text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            Fiscal Year
          </span>
          <FieldSelect
            value={draft}
            onChange={setDraft}
            options={CAPPED_FY_YEAR_OPTIONS}
            optionLabel={formatFyYearShort}
          />
        </div>

        <button
          type="button"
          onClick={() => {
            onApply(draft);
            setOpen(false);
          }}
          className="mt-m w-full rounded-md bg-ca-accent py-s text-[12px] font-semibold text-ca-accent-foreground transition-colors hover:brightness-110"
        >
          Apply
        </button>
      </PopoverContent>
    </Popover>
  );
}
