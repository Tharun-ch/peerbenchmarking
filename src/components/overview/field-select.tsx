import { ChevronDown } from 'lucide-react';

/** Small caret-down select box shared by every Period-slicer popover. */
export function FieldSelect({
  value,
  onChange,
  options,
  optionLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  optionLabel?: (v: string) => string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-full appearance-none rounded-md border border-ca-input-border bg-card pr-xl pl-m text-[12px] text-[#4A4A4A] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {optionLabel ? optionLabel(opt) : opt}
          </option>
        ))}
      </select>
      <ChevronDown className="icon-size-200 pointer-events-none absolute top-1/2 right-m -translate-y-1/2 text-foreground" />
    </div>
  );
}
