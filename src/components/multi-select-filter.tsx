import { ChevronDown } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface MultiSelectFilterProps {
  label: string;
  options: string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}

export function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
}: MultiSelectFilterProps) {
  function toggle(option: string) {
    const next = new Set(selected);
    if (next.has(option)) {
      next.delete(option);
    } else {
      next.add(option);
    }
    onChange(next);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="bg-card text-foreground"
        >
          {label}
          {selected.size > 0 && (
            <Badge variant="secondary">{selected.size}</Badge>
          )}
          <ChevronDown className="icon-size-100 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="start">
        <div className="mb-s flex items-center justify-between">
          <span className="text-300 font-semibold text-foreground">
            {label}
          </span>
          {selected.size > 0 && (
            <button
              type="button"
              onClick={() => onChange(new Set())}
              className="text-200 text-muted-foreground hover:text-foreground hover:underline"
            >
              Clear
            </button>
          )}
        </div>
        <div className="flex max-h-64 flex-col gap-xxs overflow-auto">
          {options.map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-s rounded-lg px-s py-xs hover:bg-accent"
            >
              <Checkbox
                checked={selected.has(option)}
                onCheckedChange={() => toggle(option)}
              />
              <span className="truncate text-300 text-foreground">
                {option}
              </span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
