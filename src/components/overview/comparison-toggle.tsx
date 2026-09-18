import { cn } from '@/lib/utils';
import type { ComparisonMode } from '@/queries/overview/overview-dax';

const OPTIONS: { value: ComparisonMode; label: string }[] = [
  { value: 'previous-quarter', label: 'QOQ' },
  { value: 'previous-year-same-quarter', label: 'YOY' },
];

interface ComparisonToggleProps {
  value: ComparisonMode;
  onChange: (mode: ComparisonMode) => void;
}

/** Only meaningful (and only rendered by the caller) when both FY and Quarter are selected. */
export function ComparisonToggle({ value, onChange }: ComparisonToggleProps) {
  return (
    <div className="flex items-center gap-xxs rounded-md border border-ca-input-border bg-card p-xxs text-[11px]">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded px-m py-xs font-medium whitespace-nowrap transition-colors',
            value === opt.value
              ? 'bg-ca-accent text-white'
              : 'text-[#666666] hover:text-[#4A4A4A]'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
