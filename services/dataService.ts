import {
  CleanedClaim,
  RawClaimData,
  AggregatedData,
  KPI,
  FilterState,
  TrendInsight,
  CostSpikeAlert,
  ImportantClaim,
  ForecastPoint,
} from '../types';
import { KEYWORDS_IGNORE } from '../constants';
import { IMPORTANT_CLAIM_WEIGHTS } from '../constants/classification';
import { classifyClaim } from './classificationService';
import { sanitizeText } from './textUtils';
import Papa from 'papaparse';

const COLUMN_CANDIDATES: Record<string, string[]> = {
  id: ['claim id', 'id', '클레임번호', '접수번호'],
  date: ['date', 'incident date', 'reported', '발생일', '일자', '접수일'],
  model: ['model', 'vehicle', 'car', '차종', '모델'],
  description: ['issue', 'description', 'complaint', '현상', '불만', '내용'],
  part: ['part', 'component', '부품', '품명'],
  cost: ['cost', 'price', 'repair', '비용', '금액'],
};

const normalizeHeader = (value: string) => value.toLowerCase().replace(/[\s_\-]/g, '');
const getMonthKey = (date: string) => date.slice(0, 7);

const addMonths = (monthKey: string, delta: number) => {
  const [yearStr, monthStr] = monthKey.split('-');
  const date = new Date(Number(yearStr), Number(monthStr) - 1 + delta, 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const NON_NUMERIC_DECIMAL_REGEX = /[^0-9.]/g;
const DAY_MS = 24 * 60 * 60 * 1000;

const parseCostValue = (value: unknown): { amount: number; failed: boolean } => {
  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? { amount: value, failed: false }
      : { amount: 0, failed: true };
  }
  if (value === null || value === undefined) {
    return { amount: 0, failed: true };
  }

  let text = String(value).trim();
  if (!text) {
    return { amount: 0, failed: true };
  }

  let isNegative = false;
  const parenMatch = text.match(/^\((.*)\)$/);
  if (parenMatch) {
    isNegative = true;
    text = parenMatch[1];
  }

  text = text.trim();
  if (text.startsWith('-')) {
    isNegative = true;
    text = text.slice(1);
  } else if (text.startsWith('+')) {
    text = text.slice(1);
  }

  text = text.replace(/\s+/g, '');
  text = text.replace(/,/g, '');
  text = text.replace(NON_NUMERIC_DECIMAL_REGEX, '');

  if (!text) {
    return { amount: 0, failed: true };
  }

  const parsed = Number(text);
  if (!Number.isFinite(parsed)) {
    return { amount: 0, failed: true };
  }

  const amount = isNegative ? -Math.abs(parsed) : parsed;
  return { amount, failed: false };
};

// Helper to parse CSV string to array of objects
export const parseCSV = (csvText: string): RawClaimData[] => {
  const parsed = Papa.parse<RawClaimData>(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  });

  if (parsed.errors.length) {
    console.warn('CSV parse warnings:', parsed.errors.slice(0, 3));
  }

  return parsed.data.filter(row => Object.keys(row).length > 0);
};

// Fuzzy column mapping
const findColumn = (row: RawClaimData, key: keyof typeof COLUMN_CANDIDATES): string | undefined => {
  const candidates = COLUMN_CANDIDATES[key];
  const keys = Object.keys(row);
  return keys.find(header => {
    const normalized = normalizeHeader(header);
    return candidates.some(candidate => {
      const normalizedCandidate = normalizeHeader(candidate);
      if (normalizedCandidate === 'id') {
        return normalized === 'id';
      }
      return normalized.includes(normalizedCandidate);
    });
  });
};

export interface CleanResult {
  claims: CleanedClaim[];
  stats: {
    parsedRows: number;
    droppedRows: number;
    missingDate: number;
    missingModel: number;
    missingDescription: number;
  };
}

export const cleanData = (rawData: RawClaimData[]): CleanResult => {
  const idUsage = new Map<string, number>();
  const stats = {
    parsedRows: 0,
    droppedRows: 0,
    missingDate: 0,
    missingModel: 0,
    missingDescription: 0,
  };

  const claims = rawData
    .map((row, index) => {
      // Detect columns
      const idKey = findColumn(row, 'id');
      const dateKey = findColumn(row, 'date');
    const modelKey = findColumn(row, 'model');
    const descKey = findColumn(row, 'description');
    const partKey = findColumn(row, 'part');
    const costKey = findColumn(row, 'cost');

    const rawIdValue =
      idKey && row[idKey] !== undefined && row[idKey] !== null ? String(row[idKey]) : '';
    const trimmedSourceId = rawIdValue.trim();
    const normalizedId = trimmedSourceId.replace(/\s+/g, '');
    const fallbackId = `CLM-${index + 1}`;
    const baseId = normalizedId || fallbackId;
    const duplicateCount = idUsage.get(baseId) || 0;
    const uniqueId = duplicateCount > 0 ? `${baseId}-${duplicateCount + 1}` : baseId;
    idUsage.set(baseId, duplicateCount + 1);

    // Normalize Date
    let dateStr = 'Unknown';
    if (dateKey && row[dateKey]) {
      const rawDate = String(row[dateKey]);
      const dateObj = new Date(rawDate);
      if (!isNaN(dateObj.getTime())) {
        dateStr = dateObj.toISOString().split('T')[0];
      }
    }

    // Normalize Description
    let description = 'Unknown';
    if (descKey && row[descKey]) {
      const sanitizedDescription = sanitizeText(row[descKey]);
      description = sanitizedDescription || 'Unknown';
    }

    const sanitizedPartName = partKey && row[partKey] ? sanitizeText(row[partKey]) : '';

    const costValue = costKey ? row[costKey] : undefined;
    const { amount: parsedCost, failed: costFailed } = parseCostValue(costValue);

    const baseClaim: CleanedClaim = {
      id: uniqueId,
      sourceId: trimmedSourceId || undefined,
      date: dateStr,
      model: modelKey ? String(row[modelKey]) : 'Unknown',
      description: description,
      partName: sanitizedPartName || undefined,
      cost: parsedCost,
      costParseFailed: costFailed,
    };

    const classification = classifyClaim(baseClaim.description, baseClaim.partName, baseClaim.cost);

      return {
        ...baseClaim,
        ...classification,
      };
    })
    .filter(claim => {
      let isValid = true;
      if (!claim || !claim.date || claim.date === 'Unknown') {
        stats.missingDate += 1;
        isValid = false;
      }
      if (!claim.model || claim.model === 'Unknown') {
        stats.missingModel += 1;
      }
      if (!claim.description || claim.description === 'Unknown') {
        stats.missingDescription += 1;
      }
      if (!isValid) {
        stats.droppedRows += 1;
      }
      return isValid;
    });

  stats.parsedRows = claims.length;

  return { claims, stats };
};

export const calculateKPIs = (data: CleanedClaim[]): KPI => {
  const totalClaims = data.length;
  const totalCost = data.reduce((sum, claim) => sum + (claim.cost || 0), 0);
  const avgCostPerClaim = totalClaims > 0 ? totalCost / totalClaims : 0;
  const highSeverityCount = data.reduce(
    (sum, claim) => sum + (claim.severity === 'High' ? 1 : 0),
    0,
  );
  const highSeverityRatio = totalClaims > 0 ? (highSeverityCount / totalClaims) * 100 : 0;
  
  // Calculate top defect keyword
  const wordMap = new Map<string, number>();
  data.forEach(c => {
    const words = c.description.toLowerCase().split(/\s+/);
    words.forEach(w => {
      if (w.length > 3 && !KEYWORDS_IGNORE.has(w)) {
        wordMap.set(w, (wordMap.get(w) || 0) + 1);
      }
    });
  });
  
  let topDefect = 'N/A';
  let maxCount = 0;
  wordMap.forEach((count, word) => {
    if (count > maxCount) {
      maxCount = count;
      topDefect = word;
    }
  });

  // MoM Growth (최근 30일 vs 이전 30일, 마지막 날짜 기준)
  let momGrowth = 0;
  const validDates = data
    .map(claim => new Date(claim.date))
    .filter(date => !Number.isNaN(date.getTime()));
  if (validDates.length) {
    const maxDate = new Date(Math.max(...validDates.map(date => date.getTime())));
    const last30Start = new Date(maxDate);
    last30Start.setDate(maxDate.getDate() - 29);
    const prev30Start = new Date(last30Start);
    prev30Start.setDate(last30Start.getDate() - 30);

    const last30Count = data.filter(claim => {
      const date = new Date(claim.date);
      return !Number.isNaN(date.getTime()) && date >= last30Start && date <= maxDate;
    }).length;
    const prev30Count = data.filter(claim => {
      const date = new Date(claim.date);
      return !Number.isNaN(date.getTime()) && date >= prev30Start && date < last30Start;
    }).length;

    momGrowth =
      prev30Count > 0
        ? ((last30Count - prev30Count) / prev30Count) * 100
        : last30Count > 0
        ? 100
        : 0;
  }

  return {
    totalClaims,
    totalCost,
    avgCostPerClaim,
    highSeverityCount,
    highSeverityRatio,
    momGrowth,
    topDefect,
  };
};

export const aggregateData = (data: CleanedClaim[]): AggregatedData => {
  // 1. Daily Trend
  const dateMap = new Map<string, number>();
  data.forEach(c => {
    dateMap.set(c.date, (dateMap.get(c.date) || 0) + 1);
  });
  const dailyTrend = Array.from(dateMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // 2. Model Pareto
  const modelMap = new Map<string, number>();
  data.forEach(c => {
    modelMap.set(c.model, (modelMap.get(c.model) || 0) + 1);
  });
  const modelPareto = Array.from(modelMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // 3. Defect Keywords
  const wordMap = new Map<string, number>();
  data.forEach(c => {
    const words = c.description.toLowerCase().split(/\s+/);
    words.forEach(w => {
      if (w.length > 3 && !KEYWORDS_IGNORE.has(w)) {
        wordMap.set(w, (wordMap.get(w) || 0) + 1);
      }
    });
  });
  const defectKeywords = Array.from(wordMap.entries())
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // Top 10

  const phenomenonSummaryMap = new Map<string, { count: number; cost: number }>();
  const causeSummaryMap = new Map<string, { count: number; cost: number }>();
  const contaminationSummaryMap = new Map<string, { count: number; cost: number }>();
  const severitySummaryMap = new Map<'High' | 'Medium' | 'Low', number>([
    ['High', 0],
    ['Medium', 0],
    ['Low', 0],
  ]);
  const monthSummary = new Map<
    string,
    { count: number; cost: number; phenomenon: Map<string, { count: number; cost: number }> }
  >();

  data.forEach(c => {
    const label = c.phenomenon || 'Unclassified';
    const current = phenomenonSummaryMap.get(label) || { count: 0, cost: 0 };
    phenomenonSummaryMap.set(label, {
      count: current.count + 1,
      cost: current.cost + (c.cost || 0),
    });

    const causeLabel = c.cause || 'Unknown';
    const currentCause = causeSummaryMap.get(causeLabel) || { count: 0, cost: 0 };
    causeSummaryMap.set(causeLabel, {
      count: currentCause.count + 1,
      cost: currentCause.cost + (c.cost || 0),
    });

    const contaminationLabel = c.contamination || 'Unknown';
    const currentContamination = contaminationSummaryMap.get(contaminationLabel) || { count: 0, cost: 0 };
    contaminationSummaryMap.set(contaminationLabel, {
      count: currentContamination.count + 1,
      cost: currentContamination.cost + (c.cost || 0),
    });

    if (c.severity) {
      severitySummaryMap.set(c.severity, (severitySummaryMap.get(c.severity) || 0) + 1);
    }

     // Monthly aggregation
     const monthKey = getMonthKey(c.date);
     const existingMonth = monthSummary.get(monthKey) || {
       count: 0,
       cost: 0,
       phenomenon: new Map<string, { count: number; cost: number }>(),
     };
     existingMonth.count += 1;
     existingMonth.cost += c.cost || 0;
     const phenoKey = c.phenomenon || 'Unclassified';
     const phenoStats = existingMonth.phenomenon.get(phenoKey) || { count: 0, cost: 0 };
     phenoStats.count += 1;
     phenoStats.cost += c.cost || 0;
     existingMonth.phenomenon.set(phenoKey, phenoStats);
     monthSummary.set(monthKey, existingMonth);
  });

  const buildBreakdown = (source: Map<string, { count: number; cost: number }>) =>
    Array.from(source.entries())
      .map(([label, value]) => ({ label, count: value.count, cost: value.cost }))
      .sort((a, b) => b.cost - a.cost);

  const phenomenonSummary = buildBreakdown(phenomenonSummaryMap);
  const causeSummary = buildBreakdown(causeSummaryMap);
  const contaminationSummary = buildBreakdown(contaminationSummaryMap);

  const severitySummary = Array.from(severitySummaryMap.entries()).map(([severity, count]) => ({
    severity,
    count,
  }));

  const monthKeys = Array.from(monthSummary.keys()).sort();
  const monthlyTrend = monthKeys.map(key => {
    const summary = monthSummary.get(key);
    return {
      period: key,
      claims: summary?.count || 0,
      cost: summary?.cost || 0,
    };
  });
  const trendInsight = calculateTrendInsight(monthKeys, monthSummary);
  const costSpike = detectCostSpike(monthKeys, monthSummary);
  const importantClaims = selectImportantClaims(data);
  const forecastTrend = buildForecast(monthKeys, monthSummary);

  return {
    dailyTrend,
    modelPareto,
    defectKeywords,
    phenomenonSummary,
    causeSummary,
    contaminationSummary,
    severitySummary,
    monthlyTrend,
    trendInsight,
    costSpike,
    importantClaims,
    forecastTrend,
  };
};

type MonthSummaryRecord = {
  count: number;
  cost: number;
  phenomenon: Map<string, { count: number; cost: number }>;
};

const calculateTrendInsight = (
  monthKeys: string[],
  monthSummary: Map<string, MonthSummaryRecord>,
): TrendInsight | undefined => {
  if (!monthKeys.length) return undefined;

  const recentKeys = monthKeys.slice(-3);
  const previousKeys = monthKeys.slice(-6, -3);

  const recentCount = recentKeys.reduce((sum, key) => sum + (monthSummary.get(key)?.count || 0), 0);
  const previousCount = previousKeys.reduce((sum, key) => sum + (monthSummary.get(key)?.count || 0), 0);

  const growthPercent =
    previousCount > 0 ? ((recentCount - previousCount) / previousCount) * 100 : recentCount > 0 ? 100 : 0;

  return {
    recentLabel: recentKeys.length ? `${recentKeys[0]} → ${recentKeys[recentKeys.length - 1]}` : undefined,
    compareLabel: previousKeys.length ? `${previousKeys[0]} → ${previousKeys[previousKeys.length - 1]}` : undefined,
    recentCount,
    previousCount,
    growthPercent,
  };
};

const detectCostSpike = (
  monthKeys: string[],
  monthSummary: Map<string, MonthSummaryRecord>,
): CostSpikeAlert | undefined => {
  if (monthKeys.length < 2) return undefined;
  const current = monthSummary.get(monthKeys[monthKeys.length - 1]);
  const previous = monthSummary.get(monthKeys[monthKeys.length - 2]);
  if (!current || !previous) return undefined;

  let spike: CostSpikeAlert | undefined;
  const phenomenonSet = new Set<string>([
    ...current.phenomenon.keys(),
    ...previous.phenomenon.keys(),
  ]);

  phenomenonSet.forEach(label => {
    const currentCost = current.phenomenon.get(label)?.cost || 0;
    const previousCost = previous.phenomenon.get(label)?.cost || 0;
    const deltaCost = currentCost - previousCost;
    if (deltaCost <= 0) return;
    if (!spike || deltaCost > spike.deltaCost) {
      spike = { phenomenon: label, deltaCost, currentCost, previousCost };
    }
  });

  return spike;
};

type PhenomenonTrendStats = {
  recentCount: number;
  previousCount: number;
  recentCost: number;
  previousCost: number;
};

const getPhenomenonStats = (
  map: Map<string, PhenomenonTrendStats>,
  label: string,
): PhenomenonTrendStats => {
  let stats = map.get(label);
  if (!stats) {
    stats = { recentCount: 0, previousCount: 0, recentCost: 0, previousCost: 0 };
    map.set(label, stats);
  }
  return stats;
};

const selectImportantClaims = (data: CleanedClaim[]): ImportantClaim[] => {
  if (!data.length) {
    return [];
  }

  const { severity, cost: costWeight, recency, trend, costSpike, flags } = IMPORTANT_CLAIM_WEIGHTS;
  const validTimestamps = data
    .map(claim => Date.parse(claim.date))
    .filter(value => !Number.isNaN(value));
  const referenceMs = validTimestamps.length ? Math.max(...validTimestamps) : Date.now();
  const recentStartMs = referenceMs - recency.recentDays * DAY_MS;
  const previousStartMs = recentStartMs - recency.recentDays * DAY_MS;
  const hotStartMs = referenceMs - recency.hotDays * DAY_MS;
  const phenomenonTrendMap = new Map<string, PhenomenonTrendStats>();

  data.forEach(claim => {
    const label = claim.phenomenon || 'Unclassified';
    const stats = getPhenomenonStats(phenomenonTrendMap, label);
    const claimTime = Date.parse(claim.date);
    if (Number.isNaN(claimTime)) {
      return;
    }
    if (claimTime >= recentStartMs) {
      stats.recentCount += 1;
      stats.recentCost += claim.cost || 0;
    } else if (claimTime >= previousStartMs && claimTime < recentStartMs) {
      stats.previousCount += 1;
      stats.previousCost += claim.cost || 0;
    }
  });

  const scoredClaims = data.map(claim => {
    const label = claim.phenomenon || 'Unclassified';
    const stats = getPhenomenonStats(phenomenonTrendMap, label);
    const severityScore = severity[claim.severity || 'Low'] || 0;
    const costScore = Math.min(((claim.cost || 0) / costWeight.normalizer), costWeight.maxBonus);

    let recencyScore = 0;
    const claimTime = Date.parse(claim.date);
    if (!Number.isNaN(claimTime)) {
      if (claimTime >= hotStartMs) {
        recencyScore += recency.hotBonus;
      } else if (claimTime >= recentStartMs) {
        recencyScore += recency.recentBonus;
      }
    }

    let trendScore = 0;
    if (stats.previousCount === 0 && stats.recentCount > 0) {
      trendScore += trend.newIssueBonus;
    } else if (stats.previousCount > 0) {
      const growthPercent = ((stats.recentCount - stats.previousCount) / stats.previousCount) * 100;
      if (growthPercent >= trend.highGrowthThreshold) {
        trendScore += trend.highGrowthBonus;
      } else if (growthPercent >= trend.mediumGrowthThreshold) {
        trendScore += trend.mediumGrowthBonus;
      }
    }

    let costSpikeScore = 0;
    const prevAvgCost = stats.previousCount ? stats.previousCost / stats.previousCount : 0;
    const recentAvgCost = stats.recentCount ? stats.recentCost / stats.recentCount : 0;
    if (prevAvgCost > 0 && recentAvgCost >= prevAvgCost * costSpike.multiplier) {
      costSpikeScore += costSpike.bonus;
    } else if (prevAvgCost === 0 && recentAvgCost > 0 && stats.recentCount >= 3) {
      costSpikeScore += costSpike.emergingBonus;
    }

    let flagScore = 0;
    if (claim.flags?.includes('Safety Risk')) {
      flagScore += flags.safety;
    }
    if (claim.flags?.includes('Repeat Repair')) {
      flagScore += flags.repeat;
    }

    const totalScore =
      severityScore + costScore + recencyScore + trendScore + costSpikeScore + flagScore;

    return {
      claim,
      score: totalScore,
    };
  });

  return scoredClaims
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      const costDelta = (b.claim.cost || 0) - (a.claim.cost || 0);
      if (costDelta !== 0) {
        return costDelta;
      }
      return b.claim.date.localeCompare(a.claim.date);
    })
    .slice(0, 5)
    .map(entry => ({
      id: entry.claim.id,
      date: entry.claim.date,
      model: entry.claim.model,
      description: entry.claim.description,
      phenomenon: entry.claim.phenomenon,
      severity: entry.claim.severity,
      cost: entry.claim.cost,
    }));
};

const buildForecast = (
  monthKeys: string[],
  monthSummary: Map<string, MonthSummaryRecord>,
): ForecastPoint[] => {
  const forecast: ForecastPoint[] = [];
  monthKeys.forEach(key => {
    forecast.push({
      period: key,
      actual: monthSummary.get(key)?.count || 0,
    });
  });

  if (!monthKeys.length) {
    return forecast;
  }

  const recentKeys = monthKeys.slice(-3);
  const average =
    recentKeys.length > 0
      ? recentKeys.reduce((sum, key) => sum + (monthSummary.get(key)?.count || 0), 0) / recentKeys.length
      : 0;

  const baseMonth = monthKeys[monthKeys.length - 1];
  for (let i = 1; i <= 3; i++) {
    const nextMonth = addMonths(baseMonth, i);
    forecast.push({
      period: nextMonth,
      forecast: Math.round(average),
    });
  }

  return forecast;
};

export const DEFAULT_FILTERS: FilterState = {
  model: 'ALL',
  phenomenon: 'ALL',
  cause: 'ALL',
  contamination: 'ALL',
  severity: 'ALL',
  flag: 'ALL',
  dateRange: { start: null, end: null },
};

export const applyFilters = (data: CleanedClaim[], filters: FilterState): CleanedClaim[] => {
  return data.filter(claim => {
    if (filters.model !== 'ALL' && claim.model !== filters.model) {
      return false;
    }
    const phenomenonLabel = claim.phenomenon || 'Unclassified';
    if (filters.phenomenon !== 'ALL' && phenomenonLabel !== filters.phenomenon) {
      return false;
    }
    const causeLabel = claim.cause || 'Unknown';
    if (filters.cause !== 'ALL' && causeLabel !== filters.cause) {
      return false;
    }
    const contaminationLabel = claim.contamination || 'Unknown';
    if (filters.contamination !== 'ALL' && contaminationLabel !== filters.contamination) {
      return false;
    }
    const severityLabel = claim.severity || 'Low';
    if (filters.severity !== 'ALL' && severityLabel !== filters.severity) {
      return false;
    }
    if (filters.flag !== 'ALL') {
      const claimFlags = claim.flags || [];
      if (!claimFlags.includes(filters.flag)) {
        return false;
      }
    }
    if (filters.dateRange.start && claim.date < filters.dateRange.start) {
      return false;
    }
    if (filters.dateRange.end && claim.date > filters.dateRange.end) {
      return false;
    }
    return true;
  });
};
