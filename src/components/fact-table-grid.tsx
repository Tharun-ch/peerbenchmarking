import { DataGrid } from '@microsoft/fabric-datagrid';
import { useCssTheme } from '@microsoft/fabric-visuals';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useSemanticModelQuery } from '@/hooks/use-semantic-model-query';
import { normalizeCellValue } from '@/lib/normalize-cell-value';
import { toDataTable } from '@/lib/to-data-table';
import type { FactTableConfig } from '@/queries/fact-tables';

import { MultiSelectFilter } from './multi-select-filter';

type FilterState = Record<string, Set<string>>;

function emptyFilterState(config: FactTableConfig): FilterState {
  return Object.fromEntries(
    config.filterColumns.map(({ key }) => [key, new Set<string>()])
  );
}

export function FactTableGrid({ config }: { config: FactTableConfig }) {
  const theme = useCssTheme();
  const { connection, query, columnMetadata, filterColumns } = config;
  const { data, isLoading, error } = useSemanticModelQuery({
    connection,
    query,
  });

  const [filters, setFilters] = useState<FilterState>(() =>
    emptyFilterState(config)
  );

  const columnIndex = useMemo(() => {
    if (data?.status !== 'success') return undefined;
    const index: Record<string, number> = {};
    for (const { key } of filterColumns) {
      const rawKey = Object.keys(columnMetadata).find(
        (k) => columnMetadata[k].name === key
      );
      index[key] = data.table.columns.findIndex((c) => c.name === rawKey);
    }
    return index;
  }, [data, filterColumns, columnMetadata]);

  const filterOptions = useMemo(() => {
    if (data?.status !== 'success' || !columnIndex) return undefined;
    const options: Record<string, string[]> = {};
    for (const { key } of filterColumns) {
      const idx = columnIndex[key];
      const values = new Set<string>();
      for (const row of data.table.rows) {
        const value = normalizeCellValue(row[idx]);
        if (value != null) values.add(String(value));
      }
      options[key] = Array.from(values).sort((a, b) => a.localeCompare(b));
    }
    return options;
  }, [data, columnIndex, filterColumns]);

  const filteredTable = useMemo(() => {
    if (data?.status !== 'success' || !columnIndex) return undefined;
    const activeFilters = filterColumns.filter(
      ({ key }) => filters[key].size > 0
    );
    const rows =
      activeFilters.length === 0
        ? data.table.rows
        : data.table.rows.filter((row) =>
            activeFilters.every(({ key }) =>
              filters[key].has(String(normalizeCellValue(row[columnIndex[key]])))
            )
          );
    return { columns: data.table.columns, rows };
  }, [data, columnIndex, filters, filterColumns]);

  const hasActiveFilters = filterColumns.some(
    ({ key }) => filters[key].size > 0
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-s p-l">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-6 w-full animate-pulse rounded-md bg-muted"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="m-l rounded-xl border border-destructive bg-destructive/10 p-l text-300 text-destructive">
        Failed to load {config.label} data: {error.message}
      </div>
    );
  }

  if (data?.status === 'error') {
    return (
      <div className="m-l rounded-xl border border-destructive bg-destructive/10 p-l text-300 text-destructive">
        {data.error.message}
      </div>
    );
  }

  if (data?.status !== 'success' || data.table.rows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-l text-300 text-muted-foreground">
        No {config.label} data available.
      </div>
    );
  }

  const dataTable =
    filteredTable && filteredTable.rows.length > 0
      ? toDataTable(
          {
            columns: filteredTable.columns,
            rows: filteredTable.rows.map((row) => row.map(normalizeCellValue)),
          },
          columnMetadata
        )
      : undefined;

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-s border-b border-border p-l">
        {filterColumns.map(({ key, label }) => (
          <MultiSelectFilter
            key={key}
            label={label}
            options={filterOptions?.[key] ?? []}
            selected={filters[key]}
            onChange={(next) =>
              setFilters((prev) => ({ ...prev, [key]: next }))
            }
          />
        ))}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilters(emptyFilterState(config))}
            className="text-muted-foreground"
          >
            Reset filters
          </Button>
        )}
        <span className="ml-auto text-200 text-muted-foreground">
          {filteredTable?.rows.length ?? 0} of {data.table.rows.length} rows
        </span>
      </div>

      {dataTable ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <DataGrid data={dataTable} theme={theme} />
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center p-l text-300 text-muted-foreground">
          No rows match the selected filters.
        </div>
      )}
    </div>
  );
}
