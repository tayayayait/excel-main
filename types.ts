export interface RawClaimData {
  [key: string]: string | number | undefined;
}

export type ClassificationRule = {
  code: string;
  label: string;
  keywords: string[];
  synonyms?: string[];
  excludes?: string[];
  priority?: number;
};

export type SeverityRule = {
  label: 'High' | 'Medium' | 'Low';
  keywords?: string[];
  costThreshold?: number;
};

export type FlagRule = {
  id: string;
  label: string;
  keywords: string[];
};

export interface ClassificationRuleSet {
  version: string;
  phenomena: ClassificationRule[];
  causes: ClassificationRule[];
  contaminations: ClassificationRule[];
  severity: SeverityRule[];
  flags: FlagRule[];
}

export interface CleanedClaim {
  id: string;
  sourceId?: string;
  date: string; // YYYY-MM-DD
  model: string;
  description: string;
  partName?: string;
  cost?: number;
  costParseFailed?: boolean;
  updatedAt?: string;
  phenomenon?: string;
  cause?: string;
  contamination?: string;
  severity?: 'High' | 'Medium' | 'Low';
  flags?: string[];
}

export interface KPI {
  totalClaims: number;
  totalCost: number;
  avgCostPerClaim: number;
  highSeverityCount: number;
  highSeverityRatio: number;
  momGrowth: number;
  topDefect: string;
}

export interface DateRangeFilter {
  start?: string | null;
  end?: string | null;
}

export interface FilterState {
  model: string | 'ALL';
  phenomenon: string | 'ALL';
  cause: string | 'ALL';
  contamination: string | 'ALL';
  severity: string | 'ALL';
  flag: string | 'ALL';
  dateRange: DateRangeFilter;
}

export interface Breakdown {
  label: string;
  count: number;
  cost: number;
}

export interface TrendInsight {
  recentLabel?: string;
  compareLabel?: string;
  recentCount: number;
  previousCount: number;
  growthPercent: number;
}

export interface CostSpikeAlert {
  phenomenon: string;
  deltaCost: number;
  currentCost: number;
  previousCost: number;
}

export interface ImportantClaim {
  id: string;
  date: string;
  model: string;
  description: string;
  phenomenon?: string;
  severity?: 'High' | 'Medium' | 'Low';
  cost?: number;
}

export interface ForecastPoint {
  period: string;
  actual?: number;
  forecast?: number;
}

export interface ImprovementAction {
  id: string;
  name: string;
  phenomenon: string;
  startDate: string;
  targetReduction?: number;
  notes?: string;
  evaluationWindowDays?: number;
}

export interface ImprovementMetrics {
  actionId: string;
  beforeCount: number;
  afterCount: number;
  beforeCost: number;
  afterCost: number;
  deltaCount: number;
  deltaCost: number;
}

export interface ServerSyncStatus {
  status: 'idle' | 'syncing' | 'error';
  lastSyncedAt?: string | null;
  lastUploadedAt?: string | null;
  serverVersion?: string | null;
  error?: string | null;
}

export interface AggregatedData {
  dailyTrend: { date: string; count: number }[];
  modelPareto: { name: string; count: number }[];
  defectKeywords: { keyword: string; count: number }[];
  phenomenonSummary: Breakdown[];
  causeSummary: Breakdown[];
  contaminationSummary: Breakdown[];
  severitySummary: { severity: 'High' | 'Medium' | 'Low'; count: number }[];
  monthlyTrend: { period: string; claims: number; cost: number }[];
  trendInsight?: TrendInsight;
  costSpike?: CostSpikeAlert;
  importantClaims: ImportantClaim[];
  forecastTrend: ForecastPoint[];
}

export type SortDirection = 'asc' | 'desc';
