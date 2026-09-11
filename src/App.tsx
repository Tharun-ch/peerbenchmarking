//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { Moon, Sun } from 'lucide-react';
import { useState } from 'react';

import { FactTableGrid } from './components/fact-table-grid';
import { cn } from './lib/utils';
import { FACT_TABLES } from './queries/fact-tables';
import { useThemeContext } from './hooks/theme.context';

function App() {
  const { isDark, toggleTheme } = useThemeContext();
  const [activeId, setActiveId] = useState(FACT_TABLES[0].id);
  const active = FACT_TABLES.find((t) => t.id === activeId) ?? FACT_TABLES[0];

  return (
    <div className="flex h-full w-full bg-background">
      <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card">
        <div className="border-b border-border px-xl py-xl">
          <p className="m-0 text-100 font-semibold tracking-[0.14em] text-accent uppercase">
            Pharma Peer Analytics
          </p>
          <h1 className="m-0 mt-xs font-heading text-600 font-semibold text-foreground">
            Peer Benchmark
          </h1>
        </div>

        <nav className="flex flex-1 flex-col gap-xxs overflow-auto p-m">
          {FACT_TABLES.map((table) => (
            <button
              key={table.id}
              type="button"
              onClick={() => setActiveId(table.id)}
              aria-current={table.id === activeId ? 'page' : undefined}
              className={cn(
                'rounded-lg px-m py-s text-left text-300 font-medium transition-colors',
                table.id === activeId
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground hover:bg-accent/10'
              )}
            >
              {table.label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-border px-xxl py-l">
          <div>
            <h2 className="m-0 font-heading text-500 font-semibold text-foreground">
              {active.label}
            </h2>
            <p className="m-0 mt-xxs text-300 text-muted-foreground">
              {active.description}
            </p>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={
              isDark ? 'Switch to light mode' : 'Switch to dark mode'
            }
            className="flex items-center justify-center rounded-full border border-border bg-card p-s text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {isDark ? (
              <Sun className="icon-size-300" />
            ) : (
              <Moon className="icon-size-300" />
            )}
          </button>
        </header>

        <main className="min-h-0 flex-1 p-xxl">
          <div className="mx-auto h-full w-full max-w-[1600px]">
            <div className="h-full w-full overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <FactTableGrid key={active.id} config={active} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
