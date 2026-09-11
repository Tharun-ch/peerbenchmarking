import { buildFactColumnMetadata } from '@/lib/fact-table-metadata';
import type { ColumnMetadataMap } from '@/lib/to-data-table';

import cashflowQuery from './cashflow.dax?raw';
import currentAssetsQuery from './current-assets.dax?raw';
import currentLiabilitiesQuery from './current-liabilities.dax?raw';
import enterpriseDataRatiosQuery from './enterprise-data-ratios.dax?raw';
import environmentQuery from './environment.dax?raw';
import incomeStatementQuery from './income-statement.dax?raw';
import nonCurrentAssetsQuery from './non-current-assets.dax?raw';
import nonCurrentLiabilitiesQuery from './non-current-liabilities.dax?raw';
import returnRatiosQuery from './return-ratios.dax?raw';
import segmentalRevenuesQuery from './segmental-revenues.dax?raw';
import socialGovernanceQuery from './social-governance.dax?raw';

const CONNECTION = 'peerBenchmarking';

export interface FilterColumn {
  /** Raw column name (as it appears in the model, e.g. "FY Year"). */
  key: string;
  label: string;
}

export interface FactTableConfig {
  id: string;
  /** Nav label and page heading. */
  label: string;
  description: string;
  connection: string;
  query: string;
  columnMetadata: ColumnMetadataMap;
  filterColumns: FilterColumn[];
}

const STANDARD_FILTERS: FilterColumn[] = [
  { key: 'Company', label: 'Company' },
  { key: 'KPI', label: 'KPI' },
  { key: 'FY Year', label: 'FY Year' },
];

const STANDARD_FILTERS_WITH_QUARTER: FilterColumn[] = [
  ...STANDARD_FILTERS,
  { key: 'Quarter', label: 'Quarter' },
];

const STANDARD_RAW_COLUMNS = [
  'Company',
  'KPI',
  'Bloomberg_Code',
  'FY Year',
  'Date',
  'Amount',
];

export const FACT_TABLES: FactTableConfig[] = [
  {
    id: 'income-statement',
    label: 'Income Statement',
    description: 'Peer benchmarking data, as reported in the semantic model',
    connection: CONNECTION,
    query: incomeStatementQuery,
    columnMetadata: buildFactColumnMetadata('Income Statement', [
      'Company',
      'KPI',
      'FY Year',
      'Quarter',
      'Amount',
      'Date',
      'Fy1',
      'Fy2',
    ]),
    filterColumns: STANDARD_FILTERS_WITH_QUARTER,
  },
  {
    id: 'cashflow',
    label: 'Cash Flow',
    description: 'Cash flow KPIs by company and fiscal year',
    connection: CONNECTION,
    query: cashflowQuery,
    columnMetadata: buildFactColumnMetadata('Cashflow', STANDARD_RAW_COLUMNS),
    filterColumns: STANDARD_FILTERS,
  },
  {
    id: 'enterprise-data-ratios',
    label: 'Enterprise Data Ratios',
    description: 'Enterprise valuation ratios by company and fiscal year',
    connection: CONNECTION,
    query: enterpriseDataRatiosQuery,
    columnMetadata: buildFactColumnMetadata(
      'Enterprise data ratios',
      STANDARD_RAW_COLUMNS
    ),
    filterColumns: STANDARD_FILTERS,
  },
  {
    id: 'environment',
    label: 'Environment',
    description: 'Environmental KPIs by company and fiscal year',
    connection: CONNECTION,
    query: environmentQuery,
    columnMetadata: buildFactColumnMetadata(
      'Environment',
      STANDARD_RAW_COLUMNS
    ),
    filterColumns: STANDARD_FILTERS,
  },
  {
    id: 'return-ratios',
    label: 'Return Ratios',
    description: 'Return on capital and profitability ratios',
    connection: CONNECTION,
    query: returnRatiosQuery,
    columnMetadata: buildFactColumnMetadata(
      'Return ratios',
      STANDARD_RAW_COLUMNS
    ),
    filterColumns: STANDARD_FILTERS,
  },
  {
    id: 'social-governance',
    label: 'Social Governance',
    description: 'Social and governance KPIs by company and fiscal year',
    connection: CONNECTION,
    query: socialGovernanceQuery,
    columnMetadata: buildFactColumnMetadata(
      'Social Governance',
      STANDARD_RAW_COLUMNS
    ),
    filterColumns: STANDARD_FILTERS,
  },
  {
    id: 'current-assets',
    label: 'Current Assets',
    description: 'Current asset balances by company and fiscal year',
    connection: CONNECTION,
    query: currentAssetsQuery,
    columnMetadata: buildFactColumnMetadata(
      'Current assets',
      STANDARD_RAW_COLUMNS
    ),
    filterColumns: STANDARD_FILTERS,
  },
  {
    id: 'current-liabilities',
    label: 'Current Liabilities',
    description: 'Current liability balances by company and fiscal year',
    connection: CONNECTION,
    query: currentLiabilitiesQuery,
    columnMetadata: buildFactColumnMetadata(
      'Current Liabilities',
      STANDARD_RAW_COLUMNS
    ),
    filterColumns: STANDARD_FILTERS,
  },
  {
    id: 'non-current-assets',
    label: 'Non-Current Assets',
    description: 'Non-current asset balances by company and fiscal year',
    connection: CONNECTION,
    query: nonCurrentAssetsQuery,
    columnMetadata: buildFactColumnMetadata(
      'Non current asset',
      STANDARD_RAW_COLUMNS
    ),
    filterColumns: STANDARD_FILTERS,
  },
  {
    id: 'non-current-liabilities',
    label: 'Non-Current Liabilities',
    description: 'Non-current liability balances by company and fiscal year',
    connection: CONNECTION,
    query: nonCurrentLiabilitiesQuery,
    columnMetadata: buildFactColumnMetadata(
      'Non current liabilities',
      STANDARD_RAW_COLUMNS
    ),
    filterColumns: STANDARD_FILTERS,
  },
  {
    id: 'segmental-revenues',
    label: 'Segmental Revenues',
    description: 'Revenue by company, segment, and fiscal period',
    connection: CONNECTION,
    query: segmentalRevenuesQuery,
    columnMetadata: buildFactColumnMetadata('Segmental Revenues', [
      'Company',
      'KPI',
      'Field_Expression',
      'Calcrt_Field',
      'Segment_Id',
      'Date',
      'Amount',
      'FY Year',
      'Quarter',
    ]),
    filterColumns: [...STANDARD_FILTERS_WITH_QUARTER, { key: 'Segment_Id', label: 'Segment' }],
  },
];
