# Technical Handover & Maintenance Guide
## Peer Benchmarking — Competitive Analysis App

**Audience:** a developer who has never seen this codebase and needs to maintain or extend it without a knowledge-transfer session.

**How to use this document:** Section 1–9 build up a mental model (architecture → data flow → structure → data model → business rules → measures → components → config → dependencies). Section 10 is a deep-dive per feature. Section 11 is the fastest path in if you already know what you're doing — it's a lookup table: "business wants X" → "go here." Sections 12–17 cover operations (troubleshooting, deploy, testing, limitations, standards, roadmap).

All file paths are relative to the repo root (`C:\Users\p90025659\Desktop\peerbenchmarking`). All line numbers were verified against the working tree at the time of writing and will drift as the code changes — treat them as "look here first," not gospel.

---

# 1. Solution Architecture

**This is not a traditional web app with a backend.** There is no server, no API layer, no database of ours. It's a **client-only Vite + React 19 single-page application**, built as a static bundle, hosted by Microsoft Fabric's static-hosting service, and **loaded inside an `<iframe>` in the Fabric portal** (a "Fabric Data App" / Rayfin `AppBackend` item). All "backend" work — authentication, DAX query execution, semantic-model access — happens either:

- **client-side, in this repo's own code** (query building, formatting, state), or
- **inside the Fabric portal host frame**, which the app talks to exclusively via `window.postMessage` (never a direct HTTP call to Power BI/Fabric REST or XMLA endpoints from this code).

```
┌─────────────────────────────────────────────────────────────┐
│ Microsoft Fabric Portal (parent frame)                       │
│  - Holds the user's Entra ID token                            │
│  - Executes real DAX/HTTP calls against the semantic model    │
│  - Owns the Power BI Premium/Fabric capacity                  │
│                                                                 │
│   ┌───────────────────────────────────────────────────────┐  │
│   │ <iframe> — THIS APP (static SPA bundle)                 │  │
│   │                                                          │  │
│   │  React tree ─▶ DAX query strings ─▶ Fabric SDK           │  │
│   │                                        │                 │  │
│   │                                  postMessage()            │  │
│   └────────────────────────────────────────┼─────────────────┘  │
│                                             ▼                    │
│                                   (handled by the host,          │
│                                    result posted back)           │
└─────────────────────────────────────────────────────────────┘
```

**Why this matters for maintenance:** you cannot "just call the API" to fetch or change data — every read goes through the DAX-over-postMessage channel (§2), and there is no write channel available to the app at runtime at all (see §10.9 "Adding a measure" for how measures actually get added — it's a one-time manual/REST-API operation on the semantic model, not something the running app can do).

## 1.1 Technology stack

| Layer | Technology |
|---|---|
| Framework | React 19, Vite 7 (`@vitejs/plugin-react-swc`) |
| Language | TypeScript 5.7, strict mode |
| Styling | Tailwind CSS v4 (CSS-first config via `@theme` in `src/global.css`), no CSS-in-JS |
| UI primitives | Hand-rolled + a few shadcn/radix-ui wrappers (`src/components/ui/*`) |
| Data client | `@microsoft/fabric-app-data` (+ `-embed-client`, `-proxy`) — the only way this app talks to the semantic model |
| Auth | `@microsoft/rayfin-auth-provider-fabric` + `@microsoft/rayfin-client` — embedded Fabric session handoff, **not** MSAL/AAD popup |
| Testing | Vitest + Testing Library + jsdom |
| Deployment | Rayfin CLI (`npx rayfin up`) → Fabric static hosting |
| Fonts | DM Sans (Google Fonts, loaded in `index.html`) |

## 1.2 What "the app" actually is, structurally

One page (`CompetitiveAnalysisPage`), one tab bar with 8 tabs, of which **3 are built** (Overview, Valuation & Returns, Trend Analysis) and **5 are placeholders** ("— coming soon."). There is no router — tab switching is local `useState`, not URL-based. See §11 for exactly how to build one of the 5 remaining tabs.

---

# 2. End-to-End Data Flow

Trace of a single user interaction — e.g. changing the Period dropdown on the Overview tab from FY 2026 to FY 2025:

```
1. User picks "FY 2025" in the Period popover
   → src/components/overview/period-picker.tsx (Apply button, ~line 137)

2. Parent state updates
   → src/components/overview/competitive-analysis-page.tsx
     setPeriod({ mode: 'year', fyYear: 'FY 2025', quarter: 'Q1' })

3. Prop drilling (NO context, NO global store) down to leaf components
   → OverviewTab(fyYear, quarter?, comparisonMode?)
       → KpiStrip(fyYear, quarter?, comparisonMode?)
       → PerformanceHeatmap(fyYear, quarter?, comparisonMode?)
       → MultiplesTable(fyYear)
       → ConsensusEstimates(fyYear)

4. Each leaf component builds ITS OWN DAX query string
   → e.g. src/queries/overview/overview-dax.ts: buildKpiCoreQuery('FY 2025', undefined, undefined)
     returns a template-literal DAX string like:
       EVALUATE
       CALCULATETABLE(
           SUMMARIZECOLUMNS("Revenue", [Revenue], "RevenueGrowth", [Revenue Growth %], ...),
           'Dim Company'[Company] = "Dr. Reddy's",
           'Dim Date'[FY Year] = "FY 2025"
       )

5. The component hands that string to the ONE data-fetching hook
   → src/hooks/use-semantic-model-query.ts
     useSemanticModelQuery({ connection: 'peerBenchmarking', query })

6. The hook's useEffect re-fires automatically because `query` is a new string
   (there is no explicit "refetch on period change" wiring anywhere —
   it's implicit: new query string → new effect dependency → re-run)

7. Hook calls the Fabric SDK
   → src/lib/fabric-client.ts: getFabricClient().semanticModel('peerBenchmarking').query(query)

8. SDK internals (NOT our code, lives in node_modules):
   FabricClient → check in-memory LRU cache → on miss →
   EmbedFabricApiProxy → SemanticModelMessageClient.executeDax() →
   window.postMessage() to the Fabric portal host

9. Fabric portal host (outside this repo entirely):
   owns the Entra token, makes the real HTTP call to the Fabric/Power BI
   DAX execution endpoint, posts the Arrow/JSON result back

10. Hook receives CachedQueryResult, calls setData() → React re-renders

11. Component transforms the raw table into a UI-friendly shape
    → src/lib/overview-data.ts: rowsToCompanyMap(table, keys)
      → Record<company, Record<measureKey, number|null>>

12. Component formats and renders
    → src/lib/format-overview.ts: formatIndianNumber / formatPercentValue / formatRatio / ...
    → src/components/overview/kpi-card.tsx or peer-metrics-table.tsx
```

**Key architectural facts that fall out of this trace:**

- **No global state management.** No Redux/Zustand/Context for data. Every widget owns its own fetch, independently, via `useSemanticModelQuery`. Changing the Period slicer causes **4–5 independent parallel queries** to re-fire (one per widget on the active tab), not one shared query.
- **No explicit cache invalidation logic in our code.** The only cache is the SDK's internal LRU (`FabricClient`), keyed by the exact query string. Two components asking for the exact same DAX string will share a cache entry; a one-character difference (e.g. FY 2025 vs FY 2026) is a cache miss.
- **Query building is pure string templating**, not a query builder library. All DAX is hand-written template literals in `src/queries/**`. This is both the biggest strength (any developer who knows DAX can read/modify it directly) and the biggest risk (no compile-time validation that a query is syntactically correct DAX — see §12 Troubleshooting for the exact error you get when it's wrong).

---

# 3. Folder Structure & Component Structure

```
src/
├── App.tsx                          # 1-line passthrough to CompetitiveAnalysisPage
├── main.tsx                         # Bootstrap: auth → theme → error boundary → auth gate → App
├── ErrorFallback.tsx                # Generic error boundary UI
├── global.css                       # ALL design tokens (colors, spacing, type, radius) — Tailwind v4 @theme
├── fabric.generated.ts              # GENERATED — do not hand-edit (see §8)
├── vite-env.d.ts                    # Types the VITE_* env vars
│
├── components/
│   ├── auth-gate.component.tsx      # Blocks rendering until Fabric embedded-auth resolves
│   ├── fact-table-grid.tsx          # ⚠️ DEAD CODE — not reachable from any tab (see §15)
│   ├── multi-select-filter.tsx      # ⚠️ DEAD CODE — only consumer is fact-table-grid.tsx
│   │
│   ├── overview/                    # Page shell + Overview tab + shared widgets
│   │   ├── competitive-analysis-page.tsx   # THE PAGE ROOT — header, tab bar, routing
│   │   ├── overview-tab.tsx                # Overview tab composition (no queries itself)
│   │   ├── kpi-strip.tsx                   # Overview's 5 KPI cards
│   │   ├── kpi-card.tsx                    # Generic KPI card — reused by all 3 tabs
│   │   ├── performance-heatmap.tsx         # Overview's 5-metric peer heatmap
│   │   ├── multiples-table.tsx             # Overview's P/E, EV/EBITDA, Market Cap table
│   │   ├── consensus-estimates.tsx         # Overview's 1YF/2YF forecast table
│   │   ├── peer-metrics-table.tsx          # ⭐ THE SHARED TABLE COMPONENT — used everywhere
│   │   ├── period-picker.tsx               # Overview-only: FY + Quarter/Year toggle popover
│   │   ├── fy-year-picker.tsx              # Non-Overview tabs: FY-only popover (same look)
│   │   ├── field-select.tsx                # Shared <select> styling for both pickers
│   │   └── comparison-toggle.tsx           # QOQ/YOY pill toggle (Overview, quarter mode only)
│   │
│   ├── valuation/                   # Valuation & Returns tab
│   │   ├── valuation-tab.tsx               # Composition
│   │   ├── valuation-kpi-strip.tsx         # 5 KPI cards (Share Price, Market Cap, P/E, EV/EBITDA, EV/Sales)
│   │   ├── valuation-multiples-table.tsx   # P/E, P/B, EV/EBITDA, EV/Sales
│   │   ├── share-price-market-cap-table.tsx# Share Price, Market Cap, 2 rank rows
│   │   ├── returns-table.tsx               # ROCE, ROIC, ROE, Dividend Payout, DPS
│   │   └── consensus-unavailable.tsx       # Static "not available" notice (no query)
│   │
│   ├── trend-analysis/              # Trend Analysis tab
│   │   ├── trend-analysis-tab.tsx          # Owns `measure` state, fetches once, fans out
│   │   ├── trend-kpi-strip.tsx             # 8 KPI cards (one per company)
│   │   ├── trend-analysis-chart.tsx        # Hand-rolled SVG+div bar/line combo chart
│   │   └── trend-format.ts                 # displayCompanyName() — "Dr. Reddy's" → "DRL"
│   │
│   └── ui/                          # Generic shadcn/radix primitives
│       ├── badge.tsx, button.tsx, checkbox.tsx, popover.tsx
│
├── hooks/
│   ├── use-semantic-model-query.ts  # ⭐ THE ONLY DATA-FETCHING HOOK in the app
│   ├── use-auth.tsx / auth.context.ts   # Fabric embedded-auth session
│   └── theme.context.ts / use-theme.ts  # Dark/light auto-detection (see §10.12 — still runs, no UI)
│
├── lib/
│   ├── fabric-client.ts             # getFabricClient() singleton — the SDK entry point
│   ├── rayfin-client.ts             # Separate client, used only for the auth handoff
│   ├── overview-data.ts             # rowsToCompanyMap() — query result → UI map
│   ├── format-overview.ts           # All number/percent/ratio/rank formatters
│   ├── to-data-table.ts             # ⚠️ only used by dead-code fact-table-grid.tsx
│   ├── fact-table-metadata.ts       # ⚠️ only used by dead-code fact-table-grid.tsx
│   ├── normalize-cell-value.ts      # ⚠️ only used by dead-code fact-table-grid.tsx
│   └── utils.ts                     # cn() — Tailwind class merge helper
│
├── queries/
│   ├── overview/overview-dax.ts     # ⭐ Overview tab's DAX + shared constants (PEER_ORDER, PEER_FILTER, FY options)
│   ├── valuation/valuation-dax.ts   # Valuation & Returns tab's DAX
│   ├── trend-analysis/trend-analysis-dax.ts  # Trend Analysis tab's DAX
│   └── fact-tables/                 # ⚠️ DEAD CODE — static full-table dumps, 11 .dax files
│
└── services/
    └── rayfin-auth.service.ts       # bootstrapAuth() — called once at app startup
```

**Rule of thumb for where new code goes:** one tab = one folder under `src/components/`, one file under `src/queries/`. The Overview folder's `overview-dax.ts` is special — it also holds cross-tab shared constants (`PEER_ORDER`, `PEER_FILTER`, `daxString`, `FY_YEAR_OPTIONS`, `getCappedFyYearOptions`, etc.) that `valuation-dax.ts` and `trend-analysis-dax.ts` both import from. **Any new tab's query file should import shared constants from `overview-dax.ts` rather than redefining them** — this is the established convention (see `valuation-dax.ts:16` and `trend-analysis-dax.ts:13`).

---

# 4. Data Model

The app connects to **one** Power BI/Fabric semantic model (workspace `51b19e59-d8d1-41dd-9b9b-2d401b9d5754`, semantic model item `51ebc77c-c773-413f-9689-93ff56cfd5e6` — see `fabric.yaml`). It's a small star schema:

```
        Dim Date                    Dim Company
   (FY Year, Quarter,          (Company, Exception Top 10,
    FiscalYear, FiscalQuarterNum)   Exception LTI, Exception CDMO)
        │                              │
        └──────────┬───────────────────┘
                    │ (18 relationships)
   ┌────────────────┼────────────────────────────────────┐
   │                │                                    │
Income Statement  Cashflow   Enterprise data ratios   Return ratios
(FY+Quarter)     (FY only)      (FY only)              (FY only)
   │
Segmental Revenues (FY+Quarter)   Current assets / Current Liabilities (FY only)
                                  Non current asset / Non current liabilities (FY only)
                                  Environment / Social Governance (FY only, UNUSED by any tab)

              ▲ all referenced by ▲
        _Measures (hidden table, holds every DAX measure)
```

**Critical fact for anyone writing new DAX:** every fact table is a **long/narrow format** — one row per `Company + KPI + Year (+ Quarter)` with a single `Amount` column. There is no "one column per metric" table anywhere. Every measure is `CALCULATE(SUM(Table[Amount]), Table[KPI] = "Some Exact String")`. If you need a new metric, you first check whether the underlying `KPI` string already exists in the source table (see §11.1 "Adding a new metric") — you cannot just add a column.

**FY-only vs FY+Quarter tables — this is the single most important business rule in the whole app** (see §5.1): only **Income Statement** and **Segmental Revenues** carry a `Quarter` column. Every other fact table only ever holds one row per company per year. Filtering a FY-only-sourced measure by Quarter doesn't error — it silently returns **zero rows** (verified against the live model during development; this is a real, previously-hit bug class — see §12).

**Peer-set membership** lives on `Dim Company`'s three flag columns, not on any fact table:

| Flag | =1 for | Used by |
|---|---|---|
| `Exception Top 10` | DRL, Sun Pharma, Cipla, Aurobindo, Lupin, Torrent, Mankind, Zydus Life, Laurus, Divi's (10 companies) | Combined with `Exception CDMO = 0` to get the app's real 8-company peer set (see §5.2) |
| `Exception LTI` | DRL, Sun Pharma, Cipla, Aurobindo, Lupin, Torrent, Zydus Life, Glenmark (8 — swaps Mankind for Glenmark) | `[LTI Rank]` ranking pool |
| `Exception CDMO` | Divi's, Laurus, Sai Life, Syngene (4) | The CDMO tab's peer set (tab not yet built) |

---

# 5. Business Rules

These are the rules that are **not obvious from reading a single file** — they're cross-cutting decisions baked into multiple places. Get these wrong and a "simple" change silently produces wrong numbers instead of an error.

## 5.1 FY-only vs Quarter-eligible measures

- **Quarter-eligible** (sourced from Income Statement): `[Revenue]`, `[EBITDA]`, `[PAT]`, `[Gross Profit Margin %]`, `[EBITDA Margin %]`, `[PAT Margin %]`, `[Revenue Growth %]`, `[Revenue Growth % (QoQ)]`.
- **FY-only, always** (sourced from Return ratios / Enterprise data ratios / Non current liabilities): `[ROCE %]`, `[Peer Avg ROCE %]`, `[ROCE Gap]`, `[P/E]`, `[EV/EBITDA]`, `[EV/Sales]`, `[Market Cap]`, `[Market Cap Rank (Top 10)]`, `[LTI Rank]`, `[Share Price]`, `[ROIC %]`, `[ROE %]`, `[Dividend Payout Ratio %]`, `[Dividends per Share]`, `[P/B]`, `[Book Value]`.
- **Implementation:** every query builder in `overview-dax.ts` is split into a `*CoreQuery` (quarter-eligible, takes an optional `quarter` param) and a `*FyOnlyQuery` (never takes quarter) — e.g. `buildKpiCoreQuery` / `buildKpiFyOnlyQuery`, `buildHeatmapCoreQuery` / `buildHeatmapFyOnlyQuery`. The calling component (`kpi-strip.tsx`, `performance-heatmap.tsx`) fires **both** queries in parallel and merges the results with `{...coreByCompany[c], ...fyOnlyByCompany[c]}`.
- **If you add a new metric**, you must classify it into one of these two buckets first (check which fact table it's sourced from) and put it in the matching query builder. Putting a FY-only metric in a `*CoreQuery` that also has a `'Dim Date'[Quarter]` filter will make it silently return blank whenever a quarter is selected.

## 5.2 The 8-company peer set

`PEER_ORDER` (`overview-dax.ts:13-22`) is the **hardcoded, ordered** list of 8 companies shown everywhere: `["Dr. Reddy's", "Sun Pharma", "Cipla", "Aurobindo", "Lupin", "Torrent", "Mankind", "Zydus Life"]`. The corresponding DAX filter is `PEER_FILTER` (`overview-dax.ts:25-26`):
```dax
FILTER('Dim Company', 'Dim Company'[Exception Top 10] = 1 && 'Dim Company'[Exception CDMO] = 0)
```
This is `Exception Top 10` (10 companies) **minus** the 2 that are also `Exception CDMO` (Divi's, Laurus) — giving exactly the 8. **`PEER_ORDER`'s hardcoded array and the DAX filter are two independent sources of truth that must stay in sync** — the array controls display order (first entry = focal/boxed column), the DAX filter controls which rows come back. If Fabric-side company membership ever changes, both must be updated together.

## 5.3 The "focal company" convention

The first entry in whatever `companies` array is passed to `PeerMetricsTable` (always DRL, always index 0) gets a black 2px outline box drawn around its entire column (header + all data rows) — see §10.10. This is purely presentational (via `ResizeObserver`, not a DAX concept) but it is load-bearing UX: DRL is always column 1, always boxed, on every table in the app.

## 5.4 Heatmap coloring excludes the focal company

`PeerMetricsTable`'s best/worst highlighting (`peer-metrics-table.tsx:130-149`) explicitly filters out index 0 (DRL) from the candidate pool before computing min/max — `x.i !== 0` in the filter predicate. **DRL's own cells are never colored green or orange**, regardless of whether its value would be the row's best or worst. This was a deliberate correction made mid-project after discovering the actual reference implementation (`competition/src/components/competitive/format.ts`'s `extremeColors()`) does the same thing — don't "fix" this by removing the exclusion.

## 5.5 Direction matters: higher-is-better vs lower-is-better

Every `MetricRowDef` (`peer-metrics-table.tsx:6-14`) has an optional `direction: 'higherIsBetter' | 'lowerIsBetter'`, defaulting to `higherIsBetter`. Valuation multiples (`P/E`, `EV/EBITDA`, `EV/Sales`, `P/B`) are explicitly `lowerIsBetter` (cheaper valuation = "better") — set in `multiples-table.tsx` and `valuation-multiples-table.tsx`. Everything else (growth %, margins, ROCE, Market Cap) defaults to `higherIsBetter`. **When adding a new ratio/multiple-type metric, ask "is lower actually better here?" before wiring it in** — getting this backwards silently swaps the green/orange highlighting.

## 5.6 FY slicer capped at "current FY − 1"

No Period slicer anywhere in the app ever offers the in-progress fiscal year. `getCurrentFiscalYear()` (`overview-dax.ts:221-225`) computes the real-world current fiscal year from `new Date()` using the model's April–March fiscal calendar (Jan–Mar belongs to the FY that started the previous calendar year). `getCappedFyYearOptions()` (`overview-dax.ts:233-236`) filters the full `FY_YEAR_OPTIONS` list down to `<= "FY {currentFY - 1}"`. This is **computed at runtime in the browser**, re-evaluating "today" on every page load — it is not a hardcoded cutoff and will silently advance every April.

## 5.7 QoQ vs YoY comparison toggle

`[Revenue Growth %]` (the model's own measure) is always "Previous Year Same Quarter." `[Revenue Growth % (QoQ)]` (added to the model specifically for this app, see §10.2) is "Previous Quarter" (sequential, wrapping Q1→prior-FY-Q4). The `ComparisonMode` toggle only appears when **both** a specific FY and a specific Quarter are selected (`competitive-analysis-page.tsx:46`: `activeTab === 'Overview' && period.mode === 'quarter'`) — for a plain FY-year view there is no "previous quarter" to compare against, so the toggle is hidden, not disabled.

---

# 6. Measure/Calculation Inventory

All of these live in the semantic model's hidden `_Measures` table. "Table" below is the DAX table qualifier the measure's `DEFINE`/underlying `CALCULATE` reads from — not where the measure itself is stored (they're all in `_Measures`).

| Measure | Source table | Format | Hidden? | Used by (component) |
|---|---|---|---|---|
| `[Revenue]` | Income Statement | `#,0` | No | KpiStrip, PerformanceHeatmap (via growth), TrendAnalysis |
| `[Revenue PY]` | Income Statement | `#,0` | Yes | Backs `[Revenue Growth %]` |
| `[Revenue Growth %]` | Income Statement | `0.0%` | No | KpiStrip, PerformanceHeatmap (YoY mode) |
| `[Revenue PrevQ]` | Income Statement | `#,0` | Yes (intended — see §12) | Backs `[Revenue Growth % (QoQ)]` |
| `[Revenue Growth % (QoQ)]` | Income Statement | `0.0%` | No | KpiStrip, PerformanceHeatmap (QoQ mode) |
| `[EBITDA]` | Income Statement | `#,0` | No | KpiStrip (absolute value in subtext), TrendAnalysis |
| `[EBITDA Margin %]` | Income Statement (derived) | `0.0%` | No | KpiStrip, PerformanceHeatmap |
| `[Gross Profit Margin %]` | Income Statement (derived) | `0.0%` | No | PerformanceHeatmap |
| `[PAT]` | Income Statement | `#,0` | Yes | TrendAnalysis only |
| `[PAT Margin %]` | Income Statement (derived) | `0.0%` | No | PerformanceHeatmap |
| `[ROCE %]` | Return ratios | `0.0%` | No | KpiStrip, PerformanceHeatmap, Valuation Returns table |
| `[Peer Avg ROCE %]` | Return ratios (cross-company) | `0.0%` | No | KpiStrip subtext only |
| `[ROCE Gap]` | derived | `0.0%` | No | KpiStrip subtext only |
| `[ROIC %]` | Return ratios | `0.0%` | No | Valuation Returns table |
| `[ROE %]` | Return ratios | `0.0%` | No | Valuation Returns table |
| `[Dividend Payout Ratio %]` | Return ratios | `0.0%` | No | Valuation Returns table |
| `[Dividends per Share]` | Return ratios | `#,0.00` | No | Valuation Returns table |
| `[P/E]` | Enterprise data ratios | `0.0` | No | KpiStrip, Overview Multiples, Valuation KpiStrip+Multiples, TrendAnalysis |
| `[EV/EBITDA]` | Enterprise data ratios | `0.0` | No | Overview Multiples, Valuation Multiples |
| `[EV/Sales]` | Enterprise data ratios | `0.0` | No | Valuation KpiStrip+Multiples |
| `[Share Price]` | Enterprise data ratios | `#,0.0` | No | Valuation KpiStrip, Share Price & Market Cap table |
| `[Market Cap]` | Enterprise data ratios | `#,0` | No | KpiStrip (via rank), Overview Multiples, Valuation KpiStrip+Multiples+SharePrice table |
| `[Market Cap Rank (Top 10)]` | derived (RANKX over 10-co pool) | `0` | No | KpiStrip, Valuation Share Price & Market Cap table |
| `[LTI Rank]` | derived (RANKX over 8-co pool) | `0` | No | KpiStrip, Valuation Share Price & Market Cap table — **note: does NOT self-blank for non-members, app patches this client-side, see §10.7** |
| `[Book Value]` | Non current liabilities (`Total Equity` KPI, ÷10) | `#,0` | Yes | Backs `[P/B]` |
| `[P/B]` | derived (`Market Cap ÷ Book Value`) | `0.0` | No | Valuation Multiples table |
| `[Revenue Growth % (1YF)]`, `(2YF)` | Income Statement (`Fy1`/`Fy2` columns) | `0.0%` | No | Overview Consensus Estimates |
| `[Gross Margin % (1YF)]`, `(2YF)` | Income Statement | `0.0%` | No | Overview Consensus Estimates |
| `[EBITDA Margin % (1YF)]`, `(2YF)` | Income Statement | `0.0%` | No | Overview Consensus Estimates |
| `[PAT Margin % (1YF)]`, `(2YF)` | Income Statement | `0.0%` | No | Overview Consensus Estimates |

**Query-scoped (not stored in the model) measures:** `[Trend PY]`, `[Trend Growth %]` — defined inline via a `DEFINE MEASURE` block every time `trend-analysis-dax.ts`'s `buildTrendQuery` is called for `EBITDA`, `PAT`, or `P/E` (not `Revenue`, which uses the real stored `[Revenue Growth %]`). See §10.8 and §12 for why this one case wasn't migrated to a stored measure like the others were.

**How to add a stored measure to the model:** there is no MCP tool or in-app write path for this. It was done once, manually, via the Fabric REST API's `getDefinition`/`updateDefinition` endpoints on the item (`POST https://api.fabric.microsoft.com/v1/workspaces/{workspaceId}/items/{semanticModelItemId}/getDefinition?format=TMSL`, an async operation — poll `Location` header until `Succeeded`, then `GET {location}/result`; edit the base64-decoded `model.bim` JSON's `_Measures` table `measures` array; re-encode and `updateDefinition`). This requires an Entra token with write access to the workspace (obtained via `az login`, not a token this app has at runtime) and is a **shared, production, hard-to-reverse** change — see §11.1 for the safer alternative (query-scoped `DEFINE MEASURE`) when write access isn't available or the change is experimental.

---

# 7. UI Component Mapping

| Component | File | Data source (query builder) | Renders |
|---|---|---|---|
| `CompetitiveAnalysisPage` | `overview/competitive-analysis-page.tsx` | — (owns `period`/`activeTab`/`comparisonMode` state) | Header, tab bar, routes to one of 3 tab components or a placeholder |
| `OverviewTab` | `overview/overview-tab.tsx` | — (pure composition) | `KpiStrip` + `PerformanceHeatmap` + `MultiplesTable` + `ConsensusEstimates` |
| `KpiStrip` (Overview) | `overview/kpi-strip.tsx` | `buildKpiCoreQuery`, `buildKpiFyOnlyQuery`, `buildPeerPoolSizesQuery` | 5 `KpiCard`s |
| `PerformanceHeatmap` | `overview/performance-heatmap.tsx` | `buildHeatmapCoreQuery`, `buildHeatmapFyOnlyQuery` | `PeerMetricsTable` (5 rows) |
| `MultiplesTable` (Overview) | `overview/multiples-table.tsx` | `buildMultiplesQuery` | `PeerMetricsTable` (3 rows) |
| `ConsensusEstimates` | `overview/consensus-estimates.tsx` | `buildConsensusQuery` | `PeerMetricsTable` (4 rows) + Forecast Period `<select>` |
| `ValuationTab` | `valuation/valuation-tab.tsx` | — (pure composition) | `ValuationKpiStrip` + `ValuationMultiplesTable` + `SharePriceMarketCapTable` + `ReturnsTable` + `ConsensusUnavailable` |
| `ValuationKpiStrip` | `valuation/valuation-kpi-strip.tsx` | `buildValuationKpiQuery` | 5 `KpiCard`s |
| `ValuationMultiplesTable` | `valuation/valuation-multiples-table.tsx` | `buildValuationMultiplesQuery` | `PeerMetricsTable` (4 rows) |
| `SharePriceMarketCapTable` | `valuation/share-price-market-cap-table.tsx` | `buildSharePriceMarketCapQuery` | `PeerMetricsTable` (4 rows) + footnote |
| `ReturnsTable` | `valuation/returns-table.tsx` | `buildReturnsQuery` | `PeerMetricsTable` (5 rows) |
| `ConsensusUnavailable` | `valuation/consensus-unavailable.tsx` | none | Static amber notice |
| `TrendAnalysisTab` | `trend-analysis/trend-analysis-tab.tsx` | `buildTrendQuery` | `TrendKpiStrip` + `TrendAnalysisChart` |
| `TrendKpiStrip` | `trend-analysis/trend-kpi-strip.tsx` | (receives `data` prop from parent) | 8 `KpiCard`s |
| `TrendAnalysisChart` | `trend-analysis/trend-analysis-chart.tsx` | (receives `data` prop from parent) | Custom SVG+div bar/line chart, Companies+Measure dropdowns |
| `PeerMetricsTable` | `overview/peer-metrics-table.tsx` | (receives `data`/`rows`/`companies` props) | **The shared table primitive — see §10.10** |
| `KpiCard` | `overview/kpi-card.tsx` | (receives `label`/`value`/`subtext` props) | Generic card, reused by all 3 tabs |
| `PeriodPicker` | `overview/period-picker.tsx` | none (pure UI, calls `onApply`) | Overview-only FY+Quarter popover |
| `FyYearPicker` | `overview/fy-year-picker.tsx` | none | Non-Overview FY-only popover |
| `ComparisonToggle` | `overview/comparison-toggle.tsx` | none | QOQ/YOY pill toggle |

**Dead/unreachable components** (exist in the codebase, compile fine, but nothing renders them): `FactTableGrid` (`components/fact-table-grid.tsx`), `MultiSelectFilter` (`components/multi-select-filter.tsx`). See §15.

---

# 8. Configuration & Parameters

| File | Role |
|---|---|
| `fabric.yaml` | Human-authored. Declares the semantic model connection alias `peerBenchmarking` → `{workspaceId, itemId}`. **The `itemId` here is the semantic MODEL's item ID** (`51ebc77c-...`) — do not confuse with the Rayfin app's own item ID below. |
| `src/fabric.generated.ts` | **Generated, do not edit.** Regenerated from `fabric.yaml` by `npx fabric-app-data generate -o src/fabric.generated.ts` (runs automatically as the first step of `npm run build`/`build:fabric`). Exports `fabricConfig`, consumed by `src/lib/fabric-client.ts`. |
| `rayfin/rayfin.yml` | The Rayfin **application** manifest — `id: peerb`, `name: Peer Benchmarking App`. Controls `services.auth.fabric.enabled`, `allowedRedirectUris` (every dev-port and deployed URL that's allowed to embed this app), and `services.staticHosting` (build command `npm run build:fabric`, output folder `dist`). |
| `rayfin/.env` | Runtime values for `RAYFIN_PUBLIC_*` vars (API URL, publishable key, workspace/item/tenant IDs, portal URL). Regenerated/merged by `rayfin up`/`rayfin dev`. |
| `.env.local` (git-ignored) | `VITE_*`-prefixed mirror of `rayfin/.env`, generated by `rayfin env --framework vite` (the `prebuild` npm script) — Vite only exposes `VITE_`-prefixed vars to client code via `import.meta.env`, which is why this translation step exists. |
| `rayfin/.deployments.json` | Local record of every workspace this project has deployed to. **`fabricItemId` here is the Rayfin APP-BACKEND's item ID** (`a3f4af34-...`) — a **different GUID from `fabric.yaml`'s `itemId`** (which is the semantic model). Two different Fabric items, easy to confuse. |
| `src/global.css` | Every design token — see §3 inventory in the research pass above for the full `--color-ca-*` / `--spacing-*` / `--text-*` / `--radius-*` tables. This is the **only** place to change a color, font, spacing value, or radius app-wide. |
| `vite.config.ts` | Dev server port pinning from `VITE_PORT`, a Local-Network-Access CORS shim (needed because the Fabric portal, a public origin, embeds `localhost` during local dev), a build-time guard that fails the production build if pointed at a remote API without a publishable key, and the `@` → `src` path alias. |
| `package.json` scripts | `dev` → `rayfin dev` (local Fabric-backed dev server); `build`/`build:fabric` → regenerate `fabric.generated.ts`, `tsc -b --noCheck`, `vite build`; `test` → `vitest run`; `lint` → `eslint .`. |

**Cross-tab shared constants** (all in `src/queries/overview/overview-dax.ts`, imported by other tabs' query files):

| Constant/function | Purpose |
|---|---|
| `PEER_ORDER` | The 8-company display order (§5.2) |
| `PEER_FILTER` | The DAX filter string for the 8-company peer set |
| `daxString(value)` | Escapes a value for a DAX string literal |
| `FY_YEAR_OPTIONS` | All known FY values, newest first |
| `DEFAULT_FY_YEAR` | `'FY 2026'` — the app's initial selection |
| `QUARTER_OPTIONS` | `['Q1','Q2','Q3','Q4']` |
| `getCurrentFiscalYear()`, `getMaxSelectableFyYear()`, `getCappedFyYearOptions()` | The FY-cap logic (§5.6) |
| `formatFyYearShort()` | `"FY 2026"` → `"FY26"`, appends `"(Est.)"` for years beyond `LAST_ACTUAL_FY_YEAR` |

---

# 9. Dependencies Matrix

"If I change X, what else might break?" Read this before touching a shared file.

| If you change... | You directly affect... | Ripple risk |
|---|---|---|
| `peer-metrics-table.tsx` (styling, highlight logic, focal-box logic) | **Every table in the app** — Overview's Heatmap/Multiples/Consensus, and all 3 Valuation tables | High. This is the single most shared component. A change here is visible on 7 different tables across 2 tabs simultaneously. Test both tabs after any edit. |
| `kpi-card.tsx` | All 3 tabs' KPI strips (5+5+8 = 18 card instances) | High for visual changes, low for logic (it's a pure presentational leaf with no query logic of its own). |
| `overview-dax.ts`'s `PEER_ORDER` / `PEER_FILTER` | Every peer-comparison query in the app (Overview + Valuation both import these; Trend Analysis imports `PEER_ORDER`) | High. Changing the peer set changes it everywhere at once — there is no per-tab override. |
| `overview-dax.ts`'s `daxString()` | Every query builder in all 3 query files | High but low-risk — it's a pure escaping utility, unlikely to need changes. |
| `global.css` color/spacing tokens | The entire visual design system | High for `--color-ca-*` tokens (dashboard-specific, used everywhere); lower for the original "ledger" tokens (`--color-background` etc.) which are less consistently used now that most components hardcode `ca-*` classes directly (see §16). |
| `use-semantic-model-query.ts` | **Every single data fetch in the app** — all 3 tabs, dead-code `FactTableGrid` too | Extreme. This is the sole data-fetching mechanism. A bug here breaks the entire app, not one feature. |
| `fabric-client.ts` | Same as above — it's the singleton the hook calls into | Extreme. |
| `competitive-analysis-page.tsx`'s `ENABLED_TABS` | Which tabs are clickable | Low-risk to change (just adds a tab to the Set) but the tab's actual content component must exist and be wired into the `activeTab === '...' ?` chain (lines ~107-124), or you'll get a working tab button with no content. |
| `period-picker.tsx` / `fy-year-picker.tsx` | Which FY/Quarter values reach every query builder | High — an off-by-one in the capped-options logic silently changes what data every tab can show. |
| A single tab's own query file (e.g. `valuation-dax.ts`) | Only that tab | Low — these are intentionally isolated per tab. |

---

# 10. Feature Deep Dives

## 10.1 Period Slicer (FY Year, Quarter, and the FY cap)

**Purpose:** lets the user pick which fiscal period every visible number reflects. Two variants exist: the rich Overview popover (FY + optional Quarter) and the FY-only popover used everywhere else.

**Technical Flow:**
1. `CompetitiveAnalysisPage` owns `period: PeriodValue = {mode: 'year'|'quarter', fyYear, quarter}` (default `{mode:'year', fyYear:'FY 2026', quarter:'Q1'}`).
2. On the Overview tab, `PeriodPicker` is rendered; everywhere else, `FyYearPicker`.
3. Both are Popover-based: internal `draft` state, only committed to the parent via `onApply(draft)` when the user clicks "Apply" (not on every keystroke/selection).
4. Both source their FY option list from `getCappedFyYearOptions()` (module-level, computed once at import time from `new Date()` — see §5.6).
5. `period.fyYear` and (Overview-only) `period.quarter`/`period.mode` are passed down as props to the active tab.

**Files Involved:** `overview/period-picker.tsx`, `overview/fy-year-picker.tsx`, `overview/field-select.tsx` (shared `<select>`), `overview/competitive-analysis-page.tsx` (owns state, decides which picker to show), `overview-dax.ts` (`FY_YEAR_OPTIONS`, `getCappedFyYearOptions`, `getCurrentFiscalYear`, `formatFyYearShort`, `QUARTER_OPTIONS`).

**Change Impact Analysis:**
- **Change the FY cap rule** (e.g. allow the current in-progress year): edit `getMaxSelectableFyYear()` in `overview-dax.ts:228-230`. This is a **one-line, app-wide** change — every picker uses the same function.
- **Add a picker to a new tab:** just render `<FyYearPicker value={period.fyYear} onApply={...} />` (or `<PeriodPicker>` if it needs quarters) in `competitive-analysis-page.tsx`'s ternary at line ~68-77 for that `activeTab`.
- **Risk:** `FY_YEAR_OPTIONS` (`overview-dax.ts:190-199`) is a **hand-maintained hardcoded list**. If the semantic model's `Dim Date` table ever gets a new FY value added, this array must be updated manually — nothing queries `Dim Date` to auto-populate it. Verify against the model with: `EVALUATE DISTINCT('Dim Date'[FY Year])` (see §12 for how to run this).

**Examples:**
- *"Business wants FY2029 available once it exists in the model":* add `'FY 2029'` to the front of `FY_YEAR_OPTIONS` array (`overview-dax.ts:191`, newest-first order) — it'll be auto-capped out until the real-world date rolls past it per §5.6, so this is safe to do proactively.
- *"Business wants no cap at all (show the in-progress year too)":* change `getMaxSelectableFyYear` to `return \`FY ${getCurrentFiscalYear(date)}\`;` (drop the `- 1`).

## 10.2 QoQ / YoY Comparison Toggle

**Purpose:** lets the user choose whether Revenue Growth % (in the KPI strip and heatmap) compares to the same quarter last year (YoY) or the immediately preceding quarter (QoQ).

**Technical Flow:** `ComparisonToggle` is a controlled pill pair rendered in the page header, **only when** `activeTab === 'Overview' && period.mode === 'quarter'` (`competitive-analysis-page.tsx:46`). Its value (`ComparisonMode = 'previous-quarter' | 'previous-year-same-quarter'`) is passed to `OverviewTab` → `KpiStrip`/`PerformanceHeatmap`, which pass it into `buildKpiCoreQuery`/`buildHeatmapCoreQuery`. Inside those builders, `revenueGrowthMeasureRef()` (`overview-dax.ts:44-48`) picks `[Revenue Growth % (QoQ)]` vs `[Revenue Growth %]` by name.

**Files Involved:** `overview/comparison-toggle.tsx`, `overview/competitive-analysis-page.tsx`, `overview/kpi-strip.tsx`, `overview/performance-heatmap.tsx`, `overview-dax.ts` (`ComparisonMode` type, `revenueGrowthMeasureRef`, `buildKpiCoreQuery`, `buildHeatmapCoreQuery`).

**Change Impact Analysis:**
- **Only Revenue Growth is toggle-aware.** EBITDA Margin %, Gross Profit Margin %, PAT Margin %, and ROCE % on the same page are NOT growth/variance measures (no YoY math at all — they're point-in-time ratios), so the toggle correctly has no effect on them. Don't assume "the toggle affects the whole page."
- **Extending the toggle to another metric** (e.g. EBITDA growth) requires: (1) a stored `[EBITDA Growth %]` measure in the model (YoY) and a `[EBITDA Growth % (QoQ)]` measure (see §6/§11.1 for how measures get added), (2) a second `xxxMeasureRef()`-style helper function, (3) wiring that helper into whichever query builder returns EBITDA.
- **Risk:** the toggle's visibility condition (`period.mode === 'quarter'`) is duplicated logic — it must match whatever `PeriodPicker` considers "quarter mode." If `PeriodPicker`'s mode values ever change, update both places.

**Examples:**
- *"Rename QOQ/YOY to something else":* `comparison-toggle.tsx:5-7`, the `OPTIONS` array's `label` fields — purely cosmetic, doesn't touch the `value` (which must keep matching `ComparisonMode`).
- *"Default to QoQ instead of YoY":* `competitive-analysis-page.tsx`, the `useState<ComparisonMode>('previous-year-same-quarter')` initial value.

## 10.3 Overview KPI Strip

**Purpose:** the 5 headline cards at the top of Overview — DRL Revenue, EBITDA Margin %, ROCE %, P/E, Market-Cap Rank.

**Technical Flow:** `KpiStrip` fires 3 parallel queries (`buildKpiCoreQuery`, `buildKpiFyOnlyQuery`, `buildPeerPoolSizesQuery` — the last one just counts pool sizes for the "X of Y" rank display) via 3 separate `useSemanticModelQuery` calls, waits for all 3, destructures each result row **positionally** (not by column name — `const [revenue, revenueGrowth, ebitda, ebitdaMargin] = coreRow ?? []`), and renders 5 `KpiCard`s with formatted values.

**Files Involved:** `overview/kpi-strip.tsx`, `overview/kpi-card.tsx`, `overview-dax.ts` (`buildKpiCoreQuery`, `buildKpiFyOnlyQuery`, `buildPeerPoolSizesQuery`), `lib/format-overview.ts` (`formatIndianNumber`, `formatPercentValue`, `formatRatio`, `formatSignedPercent`).

**Change Impact Analysis:**
- **Positional destructuring is a real risk.** The order of columns in the `SUMMARIZECOLUMNS(...)` call in `buildKpiCoreQuery`/`buildKpiFyOnlyQuery` **must exactly match** the order of variables destructured in `kpi-strip.tsx`. Reordering columns in the query without updating the destructuring (or vice versa) silently shuffles which number appears under which label — no type error, no runtime error, just wrong data.
- Adding a 6th KPI card means: add a column to the appropriate query builder (core if quarter-eligible, FY-only if not), add it to the destructuring, add a `<KpiCard>`.

**Examples:**
- *"Add a 'DRL EV/Sales' card":* `EV/Sales` is FY-only (Enterprise data ratios) → add `"EVSales", [EV/Sales]` to `buildKpiFyOnlyQuery`'s `SUMMARIZECOLUMNS` (`overview-dax.ts:105-119`), add `evSales` to the destructuring array in `kpi-strip.tsx` (keeping order matched), add `<KpiCard label="DRL EV/Sales" value={\`${formatRatio(evSales)}x\`} />`.
- *"Change the ROCE card's subtext wording":* `kpi-strip.tsx`, the `subtext` prop string template on the ROCE `<KpiCard>` — no query change needed, the underlying values (`peerAvgRoce`, `roceGap`) are already fetched.

## 10.4 Performance Heatmap

**Purpose:** the 5-row × 8-column table comparing Revenue Growth%, Gross Profit Margin%, EBITDA Margin%, PAT Margin%, and ROCE% across all peers, with best/worst highlighting.

**Technical Flow:** Same dual-query pattern as the KPI strip (`buildHeatmapCoreQuery` for the 4 Income-Statement rows, `buildHeatmapFyOnlyQuery` for the ROCE row), merged via `Object.fromEntries(PEER_ORDER.map(c => [c, {...coreByCompany[c], ...fyOnlyByCompany[c]}]))`, then handed to `PeerMetricsTable` as `data` alongside a `rows: MetricRowDef[]` array combining `CORE_ROWS` and `FY_ONLY_ROWS`.

**Files Involved:** `overview/performance-heatmap.tsx`, `overview/peer-metrics-table.tsx`, `overview-dax.ts`, `lib/overview-data.ts` (`rowsToCompanyMap`).

**Change Impact Analysis:** Adding/removing a row here is isolated to this file + whichever query builder feeds it — `PeerMetricsTable` itself is generic and needs no changes. **Do not** add a row whose measure isn't classified into core/FY-only correctly (§5.1).

**Examples:**
- *"Add a Net Debt/EBITDA row"* (FY-only, from Non current liabilities): add `"NetDebtEbitda", [Net Debt / EBITDA]` to `buildHeatmapFyOnlyQuery`, add `{key: 'NetDebtEbitda', label: 'Net Debt/EBITDA', format: formatRatio, direction: 'lowerIsBetter'}` to `FY_ONLY_ROWS` in `performance-heatmap.tsx`.
- *"Change ROCE% to use ROIC% instead":* swap the measure name in `buildHeatmapFyOnlyQuery` and the `key`/`label` in `FY_ONLY_ROWS` — a 2-line change.

## 10.5 Multiples & Market Capitalisation (Overview)

**Purpose:** P/E, EV/EBITDA, Market Cap for all 8 peers.

**Technical Flow:** Single query (`buildMultiplesQuery`, all 3 metrics are FY-only) → `PeerMetricsTable`. P/E and EV/EBITDA are `direction: 'lowerIsBetter'`; Market Cap defaults to `higherIsBetter`.

**Files Involved:** `overview/multiples-table.tsx`, `overview-dax.ts` (`buildMultiplesQuery`).

**Change Impact Analysis:** Simplest table in the app — one query, no core/FY-only split needed (everything here is FY-only already). Safe to extend directly.

**Examples:** *"Add EV/Sales to this table too"* — add `"EVSales", [EV/Sales]` to the query, add a row with `direction: 'lowerIsBetter'`.

## 10.6 Consensus Estimates (Overview)

**Purpose:** forward-looking (1-year/2-year) Revenue Growth%, Gross Margin%, EBITDA Margin%, PAT Margin% — the only forecast data anywhere in the app, because only Income Statement carries `Fy1`/`Fy2` forward-estimate columns.

**Technical Flow:** Owns local `forecastPeriod` state (`'1YF'|'2YF'`). `buildConsensusQuery(fyYear, forecastPeriod)` **dynamically builds measure names via template literal** — `` [Revenue Growth % (${suffix})] `` etc. — so the actual DAX measure referenced changes based on the dropdown. Renders with `highlight={false}` on `PeerMetricsTable` (no best/worst coloring on this table, per the original design reference).

**Files Involved:** `overview/consensus-estimates.tsx`, `overview-dax.ts` (`buildConsensusQuery`, `ForecastPeriod` type).

**Change Impact Analysis:** If you ever need a `3YF` option, it must exist as **4 real stored measures** in the model first (`[Revenue Growth % (3YF)]` etc. — check whether Income Statement even has an `Fy3` column; per the model reference doc it only has `Fy1`/`Fy2`). The template-literal measure-name construction means a typo in `ForecastPeriod`'s values produces a DAX error referencing a measure that doesn't exist — see §12.

**Examples:** *"Add a 2YF-only KPI card at the top of this section"* — the data is already fetched (`buildConsensusQuery` with `forecastPeriod='2YF'`), just render a `<KpiCard>` above the `<PeerMetricsTable>` using the DRL row of `byCompany`.

## 10.7 Valuation & Returns Tab

**Purpose:** Share Price, Market Cap, valuation multiples (incl. P/B), and return ratios for all 8 peers. FY-only, no Quarter slicer at all (per explicit product decision).

**Technical Flow:** 4 independent widgets, each with its own query (`buildValuationKpiQuery`, `buildValuationMultiplesQuery`, `buildSharePriceMarketCapQuery`, `buildReturnsQuery`), plus a static `ConsensusUnavailable` notice (no query — Enterprise data ratios has no `Fy1`/`Fy2` columns, so there is genuinely no forward-looking valuation data to show, and the app says so explicitly rather than fabricating numbers).

**The LTI Rank "NA" patch (important, non-obvious):** `[LTI Rank]` is a `RANKX` over an 8-company pool that swaps Mankind for Glenmark. RANKX still computes *a* rank for Mankind's row even though Mankind isn't in that pool (it just ranks Mankind's value against the pool as if it were a member) — so the raw measure never blanks itself out. `buildSharePriceMarketCapQuery` therefore also pulls `SELECTEDVALUE('Dim Company'[Exception LTI])` as `InLTIPeerSet`, and `share-price-market-cap-table.tsx:49-58` client-side-nulls `LTIRank` whenever `InLTIPeerSet !== 1`, so the UI correctly shows "NA" for Mankind instead of a misleading number.

**Files Involved:** `valuation/valuation-tab.tsx`, `valuation/valuation-kpi-strip.tsx`, `valuation/valuation-multiples-table.tsx`, `valuation/share-price-market-cap-table.tsx`, `valuation/returns-table.tsx`, `valuation/consensus-unavailable.tsx`, `valuation-dax.ts` (all 4 query builders), `overview/peer-metrics-table.tsx` (all 3 real tables reuse this).

**Change Impact Analysis:** This tab imports `DRL`, `PEER_FILTER`, `daxString` from `overview-dax.ts` — any breaking change to those exports breaks this tab too (§9). The `[P/B]`/`[Book Value]` measures were added specifically for this tab (§6) — if they're ever removed from the model, `valuation-multiples-table.tsx`'s P/B row will error (see §12 for the exact DAX-error symptom).

**Examples:**
- *"Add a Net Debt table to this tab"* — Net Debt/EBITDA/Equity measures already exist (`Leverage & Cash Flow` folder in the model, not yet surfaced anywhere in the app) — new query builder function in `valuation-dax.ts`, new `PeerMetricsTable`-based component, add it to `valuation-tab.tsx`'s composition.
- *"Add the Quarter slicer to this tab after all"* — would require: switching `FyYearPicker` back to `PeriodPicker` for this tab in `competitive-analysis-page.tsx`, and re-deriving which of this tab's measures are actually quarter-eligible (currently: **none** — Enterprise/Return ratios/Non-current-liabilities are all FY-only) — so this change would need new quarter-eligible source measures to have any real effect, not just a UI change.

## 10.8 Trend Analysis Tab

**Purpose:** pick a measure (Revenue/EBITDA/PAT/P-E) and see it as a bar+line chart across all 8 peers, plus one KPI card per company.

**Technical Flow:** `TrendAnalysisTab` owns `measure` state, fires **one** query (`buildTrendQuery(fyYear, measure)`), and passes the same result data down to both `TrendKpiStrip` and `TrendAnalysisChart` (unlike Overview/Valuation, this tab does NOT let each child fetch independently — it fetches once and fans out via props). `buildTrendQuery` has **two code paths**: Revenue uses the real stored `[Revenue Growth %]`; EBITDA/PAT/P-E use a **query-scoped `DEFINE MEASURE`** block (`'Trend PY'`/`'Trend Growth %'`) computed inline per-query, because those three don't have stored YoY-growth measures in the model (see §12 for why this is the one remaining query-scoped measure in the codebase).

**Files Involved:** `trend-analysis/trend-analysis-tab.tsx`, `trend-analysis/trend-kpi-strip.tsx`, `trend-analysis/trend-analysis-chart.tsx`, `trend-analysis/trend-format.ts`, `trend-analysis-dax.ts`.

**Change Impact Analysis:** Adding a 5th measure option means adding it to `TREND_MEASURES`/`MEASURE_CONFIG` in `trend-analysis-dax.ts` — if it has no stored growth measure, it'll automatically fall into the `DEFINE MEASURE` branch (no code change needed there, `buildTrendQuery`'s branch logic is measure-agnostic — it just checks `config.storedGrowthMeasure`).

**Examples:**
- *"Add Gross Profit as a 5th measure":* `MEASURE_CONFIG` (`trend-analysis-dax.ts:27-36`): add `'Gross Profit': { table: 'Income Statement', valueMeasure: '[Gross Profit]' }` (no `storedGrowthMeasure` → auto-uses the query-scoped path), add `'Gross Profit'` to `TREND_MEASURES` array, update `TrendMeasure` type (it's derived from `TREND_MEASURES` automatically via `(typeof TREND_MEASURES)[number]`, so no separate type edit needed).
- *"Make the QoQ/YoY toggle also work on Trend Analysis":* would need `buildTrendQuery` to accept a `comparisonMode` param and a QoQ-style DEFINE block for the FY-only-quarter-wrap logic — non-trivial since this tab currently has no Quarter slicer at all (FY-only, per §10.7-style tab convention).

## 10.9 Peer Set / Company Membership Rules

Covered in depth in §5.2. **Files:** `overview-dax.ts` (`PEER_ORDER`, `PEER_FILTER`), the model's `Dim Company` table (`Exception Top 10`/`Exception LTI`/`Exception CDMO` columns — not editable from this repo).

**Examples:**
- *"Add a 9th company to the peer set"* — requires the company to exist in the model's fact tables AND have `Dim Company[Exception Top 10] = 1` (model-side change, not app-side) — then add its exact name string to `PEER_ORDER` in the correct display position. **The DAX filter doesn't need to change** (it already says `Exception Top 10 = 1`) — only the array does, and only after the model itself is updated.
- *"Remove a company from just the Trend Analysis tab, keep it everywhere else"* — `trend-analysis-chart.tsx` currently derives its company dropdown from `PEER_ORDER` directly; you'd need a tab-local filtered copy rather than editing the shared constant (which would remove it everywhere).

## 10.10 `PeerMetricsTable` — the shared table primitive

**Purpose:** every peer-comparison table in the app (7 of them across 2 tabs) is this one component, parameterized by `title`, `companies`, `rows: MetricRowDef[]`, `data`, `highlight?`, `headerAction?`.

**Technical Flow (non-obvious internals):**
- The focal-company (DRL) outline box is **not** CSS borders on individual cells. It's computed via `useLayoutEffect` + `ResizeObserver` (`peer-metrics-table.tsx:56-87`): refs on the DRL header cell and the DRL cell in the last row, `getBoundingClientRect()` on both plus the table's outer frame, and a single absolutely-positioned `<div>` overlay drawn from the header's top-left to the last row's bottom, all in one piece. This exact technique (down to variable names) was copied from a reference implementation to guarantee a clean single-box outline rather than stacked per-cell borders (an earlier version had a visible seam between rows — see §12).
- Best/worst highlighting (`peer-metrics-table.tsx:126-149`): for each row, filters out index 0 (DRL, §5.4), needs ≥2 remaining candidates, computes best/worst per the row's `direction`, colors exactly one cell green (`bg-ca-green`) and one orange (`bg-ca-orange`) — or none if `highlight={false}` or fewer than 2 real values.

**Files Involved:** `overview/peer-metrics-table.tsx` only — but its **consumers** are §7's entire "Renders `PeerMetricsTable`" column.

**Change Impact Analysis:** This is the highest-blast-radius file in the UI layer (§9). Any visual change here (padding, colors, radius, font size) is instantly visible on all 7 tables. Any logic change (highlighting rule, focal-box calculation) affects all 7 identically — there is no per-table override mechanism currently.

**Examples:**
- *"Make the heatmap colors more/less vibrant"* — `global.css`'s `--color-ca-green`/`--color-ca-orange` tokens (§8) — changes every table's highlighting at once, not just the heatmap's.
- *"Give Consensus Estimates its own highlight rule instead of `highlight={false}`"* — pass a new prop (e.g. `highlightMode: 'best-worst' | 'none' | 'custom-fn'`) and branch inside `peer-metrics-table.tsx`'s row-rendering loop — needs a new prop, not just a config value, since the current `highlight` is a boolean on/off switch only.

## 10.11 Authentication & Fabric Embedding

**Purpose:** the app only ever runs meaningfully inside the Fabric portal's iframe; this handles that handoff and blocks the UI otherwise.

**Technical Flow:** `main.tsx:21` — `await bootstrapAuth()` runs at module top level, **before React ever renders**, constructing a `RayfinAuthService` (`services/rayfin-auth.service.ts`) via a separate `RayfinClient` (`lib/rayfin-client.ts`, reads `VITE_RAYFIN_API_URL`/`VITE_RAYFIN_PUBLISHABLE_KEY`). `AuthProvider` (`hooks/use-auth.tsx`) then calls `initEmbeddedAuth()` in a `useEffect`, which — via `@microsoft/rayfin-auth-provider-fabric` — does a `postMessage` handshake with the Fabric portal host **only if the page is loaded with `?fabricEmbedded=true` inside an iframe**; otherwise resolves `null` immediately. `AuthGate` (`components/auth-gate.component.tsx`) blocks rendering `<App/>` until `isAuthenticated`, showing "Connecting to Fabric…" while loading or "Can't open this app outside Fabric" if not embedded.

**This auth flow is entirely separate from DAX query authentication** — `getFabricClient()` (§2 step 7) builds its own independent `SemanticModelMessageClient`, with its own `postMessage` channel. Both rely on the same fact (the app is embedded in Fabric) but are two unrelated code paths.

**Files Involved:** `main.tsx`, `services/rayfin-auth.service.ts`, `lib/rayfin-client.ts`, `hooks/use-auth.tsx`, `hooks/auth.context.ts`, `components/auth-gate.component.tsx`.

**Change Impact Analysis:** **Do not touch this to "fix" local dev friction.** The reason you can't open `localhost:5173` directly in a plain browser tab and see the app (you get the "Can't open this app outside Fabric" block) is by design — this app has no meaningful standalone mode. The documented local-dev path is: run `npm run dev`, then in the Fabric portal append `&devUri=http://localhost:5173` to the app's URL so the *portal* iframes your local server (see `README.md` if present, or `rayfin dev` docs).

**Examples:** *"Business wants a public/standalone mode with a login screen"* — would require building an entirely separate, non-embedded auth path (real MSAL/AAD popup or similar) — a large architectural addition, not a config toggle. Out of scope for a quick change.

## 10.12 Design System / Theming

**Purpose:** consistent colors, spacing, typography across the app.

**Technical Flow:** All tokens live in `src/global.css`'s Tailwind v4 `@theme` block (§8). Two token families coexist: the original "ledger" tokens (`--color-background`, `--color-primary`, etc. — navy+gold, has dark-mode overrides) and the newer `--color-ca-*` tokens (indigo/purple + heatmap colors, lifted from a reference implementation, **light-mode only, no dark overrides**). Most of the actual dashboard UI (tables, KPI cards, page chrome) uses the `ca-*` tokens directly via Tailwind classes like `bg-ca-purple`, `border-ca-card-border`.

**Dark mode still technically works but has no UI toggle.** `useAppTheme()` (`hooks/use-theme.ts`) auto-detects dark mode from the Fabric host's `data-appearance` attribute, a pre-existing `.dark` class, or `prefers-color-scheme`, and keeps watching for changes via `MutationObserver` + a `matchMedia` listener — this all still runs on every page load. But since `--color-ca-*` tokens have no `.dark` overrides, if dark mode ever does activate, the page background/foreground will flip while every table/card (which use `ca-*` tokens) stays in its light-mode colors — a visual mismatch. `useThemeContext()` (the context this feeds) has zero consumers in the codebase (grep-confirmed) — the manual toggle button was removed from the UI but the entire detection stack was left running.

**Files Involved:** `global.css`, `hooks/theme.context.ts`, `hooks/use-theme.ts`, `main.tsx` (wires the provider).

**Change Impact Analysis:** Changing a `ca-*` token is safe and app-wide (§9). **Adding dark-mode support properly** would require adding a `:root[data-theme=...]`/`.dark` override block for every `--color-ca-*` token in `global.css` — a real, if mechanical, chunk of work, not currently done.

**Examples:**
- *"Switch the whole app to a blue accent instead of purple"* — `global.css`: `--color-ca-purple` and `--color-ca-accent` (§8 table) — 2-line change, affects every table header and every active-tab/toggle highlight simultaneously.
- *"Actually support dark mode"* — add a `.dark { --color-ca-purple: ...; --color-ca-card-border: ...; ... }` block mirroring the existing `.dark` block's structure (`global.css` lines ~152-185) but for every `ca-*` token.

---

# 11. Common Change Requests and Implementation Locations

Quick-reference table — find your request, jump to the file.

| Business request | Primary file(s) to change | Also check |
|---|---|---|
| **Add a new metric to an existing table** | The relevant `build*Query` function in that tab's `*-dax.ts`, plus the `ROWS`/`CORE_ROWS`/`FY_ONLY_ROWS` array in the component file | §5.1 (core vs FY-only), §5.5 (direction) |
| **Add a brand-new metric that doesn't exist in the model yet** | First: does the KPI string exist in a fact table? (`EVALUATE VALUES('TableName'[KPI])` — §12). If not, and it's a simple derived ratio of existing measures, prefer a query-scoped `DEFINE MEASURE` (§11.1) over a model write. If it needs a genuinely new stored measure, that's a model-write operation (§6, "How to add a stored measure") | — |
| **Add a new company to the peer set** | `overview-dax.ts`'s `PEER_ORDER` array (**after** the model's `Dim Company[Exception Top 10]` flag is set — model-side, not app-side) | §5.2, §10.9 |
| **Change ranking logic** (e.g. Market Cap Rank pool size) | The `[Market Cap Rank (Top 10)]` / `[LTI Rank]` measures are stored in the model (RANKX over a `Dim Company` flag-filtered pool) — changing the pool means changing which companies have `Exception Top 10`/`Exception LTI` = 1 in the model. The app just reads the result. | §10.7 for the "RANKX doesn't self-blank for non-members" gotcha |
| **Change fiscal year cap logic** | `overview-dax.ts`'s `getMaxSelectableFyYear()` | §5.6, §10.1 |
| **Change FY year list** | `overview-dax.ts`'s `FY_YEAR_OPTIONS` (hand-maintained array) | §10.1 risk note |
| **Modify growth calculations (YoY/QoQ)** | `overview-dax.ts`'s `revenueGrowthMeasureRef()` + the underlying stored measures `[Revenue Growth %]`/`[Revenue Growth % (QoQ)]` in the model | §5.7, §10.2 |
| **Change heatmap colors** | `global.css`: `--color-ca-green`, `--color-ca-orange` | §10.10, §9 (affects all 7 tables) |
| **Change which cell gets highlighted (best/worst logic)** | `peer-metrics-table.tsx` lines 126-149 (the candidate-filtering + reduce logic) | §5.4, §5.5 |
| **Update toggle behavior (QoQ/YoY labels, default)** | `comparison-toggle.tsx` (labels), `competitive-analysis-page.tsx` (default value, visibility condition) | §10.2 |
| **Add a new navigation tab** | 1) Add the tab name to `TABS` in `competitive-analysis-page.tsx` if not already there (all 8 already are — just move it into `ENABLED_TABS`). 2) Create `src/components/<tabname>/` folder with a `*-tab.tsx` composition component. 3) Create `src/queries/<tabname>/<tabname>-dax.ts` with query builders (reuse `PEER_ORDER`/`PEER_FILTER`/`daxString` from `overview-dax.ts`). 4) Wire the new tab component into the `activeTab === '...' ?` chain in `competitive-analysis-page.tsx` (~line 107-124). 5) Decide: does it need the Quarter slicer (`PeriodPicker`) or FY-only (`FyYearPicker`)? Update the picker-selection ternary if it needs the rich one (currently only Overview does). | §3 folder convention, §5.1 for quarter-eligibility of whatever tables the new tab reads |
| **Modify KPI card calculations** | The relevant `build*KpiQuery`/`build*FyOnlyQuery` in that tab's `*-dax.ts`, plus the positional-destructuring + `<KpiCard>` JSX in that tab's `*-kpi-strip.tsx` | §10.3 positional-destructuring risk |
| **Change KPI card visual style (padding, font, colors)** | `overview/kpi-card.tsx` (shared by all 3 tabs — 18 card instances) | §9 |
| **Change table cell/header font size, padding, borders** | `overview/peer-metrics-table.tsx` (shared by all tables) + `global.css` tokens it references (`--color-ca-table-border`, `--color-ca-row-border`, etc.) | §10.10 |
| **Add a new peer-comparison table to an existing tab** | New `build*Query` function in that tab's `*-dax.ts`, new component file using `<PeerMetricsTable>`, add it to that tab's composition file | §10.4/§10.5 as templates |
| **Change the Period picker's visual style** | `field-select.tsx` (shared styling), then `period-picker.tsx`/`fy-year-picker.tsx` for structural differences | §10.1 |
| **Add a measure the model doesn't have** | See §6 "How to add a stored measure" (Fabric REST API, manual, requires workspace write access) OR §11.1 below for a same-session alternative | — |
| **Deploy a change** | `npx rayfin up --workspace-id 51b19e59-d8d1-41dd-9b9b-2d401b9d5754 -y` | §13 |

## 11.1 Adding a metric that doesn't exist in the model — the query-scoped `DEFINE MEASURE` technique

Used twice in this codebase's history for `[P/B]` (now migrated to a real stored measure) and still in active use for `[Trend PY]`/`[Trend Growth %]` (`trend-analysis-dax.ts:56-60`, EBITDA/PAT/P-E growth on the Trend Analysis tab). This is a DAX feature that lets you define a measure **inline, scoped to a single query**, without any write access to the model:

```dax
DEFINE
    MEASURE 'Income Statement'[My Temp Measure] =
        <any valid DAX expression, can reference real measures/columns>
EVALUATE
CALCULATETABLE(
    SUMMARIZECOLUMNS(..., "MyValue", [My Temp Measure]),
    ...
)
```

**When to use this instead of a model write:** experimenting, a metric only one tab needs, or you don't have workspace-write access. **When to graduate it to a real stored measure:** once it's proven correct and multiple tabs/components would benefit — a stored measure (a) shows up in Power BI Desktop's own field list for anyone else using the model, (b) doesn't need to be re-sent as text on every single query, (c) can be referenced by name from *other* stored measures (query-scoped ones can't be referenced outside their own query). See §6 for the exact REST API mechanics used to add `[P/B]`/`[Book Value]`/`[Revenue Growth % (QoQ)]`/`[Revenue PrevQ]` to the model.

---

# 12. Troubleshooting Guide

| Symptom | Cause | Fix |
|---|---|---|
| A `PeerMetricsTable` shows blank/null for one specific row, for all companies, only when a Quarter is selected | A FY-only measure (Return ratios/Enterprise data ratios/Non-current-liabilities-sourced) got put in a `*CoreQuery` that also applies a `'Dim Date'[Quarter]` filter | Move that measure to the matching `*FyOnlyQuery` function; see §5.1 |
| DAX error: `A single value for column '<oii>X</oii>' in table '<oii>Y</oii>' cannot be determined...` | A bare column reference (e.g. `'Dim Company'[Exception LTI]`) was used directly as a `SUMMARIZECOLUMNS` named-expression value instead of a scalar aggregation | Wrap it in `SELECTEDVALUE(...)` — see `valuation-dax.ts:79` for the fixed pattern (`share-price-market-cap-table.tsx`'s `InLTIPeerSet` column) |
| A measure reference like `[Some Measure Name]` errors with "measure not found" | Typo in the measure name, OR the measure exists but is spelled slightly differently in the model (check exact casing/spacing/punctuation) | Verify live: `npx fabric-app-data query peerBenchmarking --query "EVALUATE ROW(\"x\", [Exact Measure Name])"` — see below for the query CLI |
| A whole table's data looks like the WRONG period (e.g. shows FY2026 numbers when FY2025 is selected) | The SDK's in-memory query cache returned a stale result for what looks like the same query string but isn't — OR (more commonly during dev) the deployed static bundle is stale (browser cached the old `index.html`/JS) | Hard-refresh (Ctrl+Shift+R) / open in a private window. For genuine cache issues in code, pass `bypassCache: true` to `useSemanticModelQuery` |
| Best/worst highlighting looks "wrong" for a ratio (e.g. lowest P/E is orange, not green) | `direction` wasn't set to `'lowerIsBetter'` for that row | Check the `MetricRowDef`'s `direction` field — see §5.5 |
| DRL's own cell is never colored, even when it's genuinely the row's max/min | This is intentional (§5.4), not a bug | No fix needed — if business explicitly wants DRL colorable too, remove the `x.i !== 0` filter in `peer-metrics-table.tsx` |
| Can't view the app by opening `localhost:5173` in a plain browser tab | The app's `AuthGate` blocks rendering outside a Fabric-embedded iframe by design (§10.11) | Not a bug. Use the documented `rayfin dev` + Fabric-portal `&devUri=` workflow, or just deploy and view the real Fabric-hosted URL |
| `fabric-app-data query` CLI fails with `Failed to acquire access token: Azure CLI is not installed` | The CLI needs a live Azure CLI session for local schema-inspection/testing (separate from the app's own runtime auth) | Install Azure CLI, run `az login --use-device-code --allow-no-subscriptions` (the `--allow-no-subscriptions` flag matters — this account may have no ARM subscriptions, which otherwise makes `az login` report failure even on a successful sign-in) |
| A new tab's button is clickable but shows nothing / falls through to "coming soon" | The tab was added to `ENABLED_TABS` but not wired into the `activeTab === '...' ?` rendering chain (or vice versa) | Both `ENABLED_TABS` (`competitive-analysis-page.tsx:27-31`) and the ternary chain (~line 107-124) must be updated together |
| Vite build warning: "You are using Node.js 20.13.1. Vite requires Node.js version 20.19+ or 22.12+" | Environment's Node version predates Vite 7's stated minimum | Cosmetic warning only — build succeeds regardless; upgrade Node if it ever starts actually failing |
| Production `vite build` fails with a message about `VITE_RAYFIN_PUBLISHABLE_KEY` | `vite.config.ts`'s build-time guard (lines 63-74) — fires when the API URL is non-localhost but no publishable key is set, because Vite statically inlines `import.meta.env.*` at build time | Ensure `rayfin/.env`/`.env.local` has a real publishable key before building for a non-local target |

**How to run a one-off DAX query against the live model for debugging** (used constantly during development):
```bash
npx fabric-app-data query peerBenchmarking --query "EVALUATE <your DAX here>"
# or, for multi-line/DEFINE-block queries (avoids shell-escaping issues):
npx fabric-app-data query peerBenchmarking --file path/to/query.dax
```
Requires `az login` first (see the table above). This hits the exact same execution path the running app uses (`connection: 'peerBenchmarking'` matches `fabric.yaml`'s alias) — it's the fastest way to verify a new DAX expression before wiring it into a query builder.

---

# 13. Deployment Process

```bash
# 1. Regenerate the fabric client config from fabric.yaml (build script does this automatically too)
npx fabric-app-data generate -o src/fabric.generated.ts

# 2. Deploy — builds, packages, and uploads the static bundle + syncs runtime settings
npx rayfin up --workspace-id 51b19e59-d8d1-41dd-9b9b-2d401b9d5754 -y
```

**What `rayfin up` does under the hood** (per `package.json`'s `build:fabric` script, which it invokes): `npx fabric-app-data generate -o src/fabric.generated.ts && tsc -b --noCheck && vite build`, then zips `dist/` and uploads it to the Rayfin app-backend item recorded in `rayfin/.deployments.json` (`fabricItemId: a3f4af34-...` — **the app item, not the semantic model item**).

**Before deploying, always run** (in order — fail fast on the cheapest checks first):
```bash
npx tsc -b              # type-check
npx eslint .            # lint
npx vitest run          # unit tests
npx vite build           # production build sanity check
```

**Reusing an existing deployment vs. creating a new one:** `rayfin up` re-uses the item recorded in `rayfin/.deployments.json` — running it again updates the *same* live app, it does not create a duplicate. If you ever need to point at a *different* pre-existing Fabric item (not one this local checkout has deployed before), you must manually edit `rayfin/.deployments.json`'s `fabricItemId`/`fabricApiUrl` fields to match the target item, since `rayfin up`'s own "create or reuse" logic is keyed off this local file, not off matching by name in Fabric.

**Local dev:** `npm run dev` → `rayfin dev` (starts a local dev server; view it by embedding it in the Fabric portal via `&devUri=http://localhost:<port>`, not by opening it directly — see §10.11/§12).

---

# 14. Testing Checklist

Before considering any change done:

- [ ] `npx tsc -b` — zero errors
- [ ] `npx eslint <changed files>` — zero errors (project convention: no `// eslint-disable` without a very good reason)
- [ ] `npx vitest run` — all existing tests still pass (currently: `App.spec.tsx`, `use-semantic-model-query.spec.ts`, `to-data-table.spec.ts` — no component-level tests exist yet, see §15)
- [ ] If you touched a query builder: **run the exact generated DAX string against the live model** via `npx fabric-app-data query peerBenchmarking --query "..."` (§12) and manually sanity-check the numbers against what you expect — there is no automated test coverage for DAX correctness
- [ ] If you touched `peer-metrics-table.tsx` or `kpi-card.tsx`: visually check **every** tab that renders them (currently Overview + Valuation & Returns; Trend Analysis for `kpi-card.tsx` only) — see §9's dependency matrix
- [ ] `npx vite build` — production build succeeds with no new warnings beyond the known Node-version and chunk-size ones (§12)
- [ ] Deploy to a real Fabric-hosted instance and view it embedded (§10.11 — you cannot meaningfully test in a plain browser tab)
- [ ] If you added/changed a measure: confirm via `INFO.VIEW.MEASURES()` that it exists with the expected name/format/hidden-flag, not just that your query happens to work

---

# 15. Known Limitations

- **Only 3 of 8 tabs are built** (Overview, Valuation & Returns, Trend Analysis). Revenue & Growth, Cost Structure & EBITDA, Leverage & Cash Flow, CDMO, and Consensus are all "coming soon" placeholders with no query files or components yet.
- **Dead code exists and compiles cleanly:** `src/components/fact-table-grid.tsx`, `src/components/multi-select-filter.tsx`, `src/lib/to-data-table.ts`, `src/lib/fact-table-metadata.ts`, `src/lib/normalize-cell-value.ts`, and the entire `src/queries/fact-tables/` directory (11 `.dax` files + `fact-tables.ts`) are never imported by any routed page. They represent an earlier "raw table browser" iteration of the app. Safe to delete once confirmed unneeded, or leave as reference for how to build a full-table dump view.
- **`Revenue PrevQ` is marked `isHidden: false`** in the model despite being intended as an internal helper (cosmetic only — it'll show up in Power BI Desktop's field list, but doesn't affect this app's behavior).
- **One query-scoped `DEFINE MEASURE` remains** (`trend-analysis-dax.ts`, EBITDA/PAT/P-E growth on Trend Analysis) — was not migrated to stored measures in the same pass that migrated `[P/B]` and `[Revenue Growth % (QoQ)]`. Functionally correct, just less efficient (re-sent as text on every query) and invisible to Power BI Desktop's field list.
- **No dark-mode support for the `ca-*` design tokens** — the auto-detection stack fully runs (§10.12) but would produce a visually broken half-dark/half-light page if it ever activates, since none of the dashboard-specific colors have dark overrides.
- **No component-level or query-builder-level test coverage.** Existing tests only cover the generic data-fetching hook, one data-transform utility, and an app-mount smoke test. Any DAX correctness verification is manual (via the CLI, §12) — there's no CI-enforced guardrail against a broken query shipping.
- **`FY_YEAR_OPTIONS` is a hand-maintained array**, not derived from the live model — will drift if the model's `Dim Date` range changes without a corresponding code update.
- **`framer-motion` is a listed dependency** (`package.json`) but was not found imported anywhere in `src/` during this inventory — worth confirming it's actually unused before assuming any animation behavior depends on it.
- **Single JS bundle, no code-splitting** — `vite build` warns about a 500KB+ chunk; not currently addressed (`build.rollupOptions.output.manualChunks` or dynamic `import()` would be the fix if bundle size ever becomes a real problem).
- **Positional (not named) result destructuring** in every KPI strip component (§10.3) — a structural fragility: query column order and destructuring order must be manually kept in sync, with no compiler or runtime check that they match.

---

# 16. Development Standards

Observed, established conventions — follow these for consistency with the existing codebase:

- **No comments explaining WHAT code does** — identifiers are named to be self-explanatory. Comments are reserved for non-obvious WHY (a business rule, a workaround, a gotcha) — see the density of "why" comments in `overview-dax.ts` and `peer-metrics-table.tsx` as the model to follow.
- **DAX query builders are pure functions returning template-literal strings**, one function per logical query, named `build<Thing>Query`. They live in `src/queries/<tab>/<tab>-dax.ts`, never inline in a component.
- **Shared cross-tab constants live in `overview-dax.ts`**, imported by other tabs' query files (not duplicated). `overview-dax.ts` is the de facto "shared kernel" for query-building even though it's named after one specific tab.
- **One component = one file**, named `kebab-case.tsx`, exporting a single `PascalCase` named export (not default export, except `App.tsx`).
- **`PeerMetricsTable` is the only table-rendering component** — every new peer-comparison table should use it rather than writing a new `<table>` from scratch (§10.10).
- **`KpiCard` is the only KPI-card component** — same rule.
- **Formatting logic lives in `lib/format-overview.ts`**, not inline in components — every new numeric display format should be a new exported function there, following the existing `formatXxx(value, fractionDigits?)` signature pattern with `'N/A'`/`'NA'` fallback for null/undefined.
- **All design tokens go in `global.css`**, never a one-off inline hex color or pixel value in a component's `className` (the few `text-[11px]`/`bg-[#4A4A4A]`-style arbitrary Tailwind values that do exist were lifted directly from a pixel-matched reference implementation — new arbitrary values should be justified the same way, not introduced casually).
- **`daxString()` for every DAX string literal** — never hand-interpolate a string value into a DAX template without escaping through this function (embedded quotes, e.g. in company names, will otherwise break the query).
- **Attribution:** git commits in this repo end with a `Co-Authored-By:` trailer identifying the AI model that made the change — continue this convention if instructed to by the session's system context.
- **Confirm before deploying, always run type-check + lint + tests + a live DAX sanity check first** (§14) — this was the consistent workflow throughout development and caught real bugs (the `SELECTEDVALUE` fix, the QoQ-vs-YoY measure mixup) before they reached production.

---

# 17. Future Enhancement Guidelines

**Building one of the 5 remaining tabs (Revenue & Growth, Cost Structure & EBITDA, Leverage & Cash Flow, CDMO, Consensus):** follow the exact pattern of Valuation & Returns (§10.7) as your template — it's the simplest fully-built example (FY-only, no quarter complexity). Steps:
1. Identify which fact tables/measures the tab needs (check the model reference doc / `INFO.VIEW.MEASURES()`).
2. Create `src/queries/<tab-name>/<tab-name>-dax.ts`, importing `DRL`/`PEER_FILTER`/`daxString`/`PEER_ORDER` from `overview-dax.ts`.
3. Create `src/components/<tab-name>/` with a `*-tab.tsx` composition file and one component per widget (KPI strip if needed, `PeerMetricsTable`-based tables).
4. Add the tab to `ENABLED_TABS` and the rendering ternary in `competitive-analysis-page.tsx`.
5. Decide FY-only (`FyYearPicker`) vs FY+Quarter (`PeriodPicker`) based on whether the tab's source tables carry a `Quarter` column (§5.1) — per the model reference doc, only Revenue & Growth, Cost Structure & EBITDA, and CDMO are quarter-capable; Leverage & Cash Flow and Consensus are FY-only.
6. **CDMO uses a different peer set** (`Exception CDMO = 1`, not `PEER_FILTER`'s Top-10-minus-CDMO) — do not reuse `PEER_ORDER`/`PEER_FILTER` for this tab; define a CDMO-specific company list and filter.
7. **Consensus (the top-level tab)** is confirmed to have no underlying data anywhere in the model (no analyst ratings/target prices) — per the project's established "handle honestly" philosophy (see `ConsensusUnavailable`, §10.7), this tab should render an unavailable-notice, not fabricated data.

**If asked to add real-time/auto-refresh:** `useSemanticModelQuery` has no polling built in — you'd add a `setInterval`-driven `refetch()` call (the hook already exposes `refetch`) at the component level, or extend the hook itself with an optional `pollIntervalMs` param.

**If asked to add export-to-Excel/PDF:** no such capability exists anywhere currently; would be a net-new dependency and feature, not a small config change — scope it as a real project, not a quick add.

**If bundle size becomes a real problem:** the 5 not-yet-built tabs are a natural code-splitting boundary — `React.lazy()` + dynamic `import()` per tab component would keep the initial bundle to just Overview, loading other tabs on first click.

**If asked to add automated DAX-correctness testing:** there's no existing pattern for this. The most direct approach would be a script (Node, using the same `fabric-app-data query` CLI mechanics) that runs each `build*Query` function's output against the live model in CI and asserts on shape (column count/names), not exact values (which change as the model's data updates) — this does not exist today and would be genuinely new infrastructure.
