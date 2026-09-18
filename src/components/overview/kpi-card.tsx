interface KpiCardProps {
  label: string;
  value: string;
  subtext?: string;
}

export function KpiCard({ label, value, subtext }: KpiCardProps) {
  return (
    <div className="min-w-0 flex-1 rounded-md border border-ca-card-border bg-card px-l py-[14px]">
      <div className="truncate text-[11px] font-medium tracking-[0.12em] text-ca-text-muted uppercase">
        {label}
      </div>
      <div className="mt-xs text-[24px] leading-tight font-bold text-foreground">
        {value}
      </div>
      {subtext && (
        <div className="mt-xs truncate text-[12px] text-ca-text-muted">
          {subtext}
        </div>
      )}
    </div>
  );
}
