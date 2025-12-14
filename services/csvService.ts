import { AggregatedData, CleanedClaim, KPI } from '../types';

const escapeCsvValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }
  const stringValue = String(value);
  if (stringValue.includes('"') || stringValue.includes(',') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

const joinRow = (values: unknown[]) => values.map(escapeCsvValue).join(',');

export const buildClaimsCsv = (claims: CleanedClaim[]): string => {
  const headers = [
    'ID',
    'Source ID',
    'Date',
    'Model',
    'Part Name',
    'Description',
    'Cost',
    'Cost Parse Failed',
    'Phenomenon',
    'Cause',
    'Contamination',
    'Severity',
    'Flags',
    'Updated At',
  ];
  const rows = claims.map(claim =>
    joinRow([
      claim.id,
      claim.sourceId ?? '',
      claim.date,
      claim.model,
      claim.partName ?? '',
      claim.description ?? '',
      claim.cost ?? '',
      claim.costParseFailed ? 'Y' : '',
      claim.phenomenon ?? 'Unclassified',
      claim.cause ?? 'Unknown',
      claim.contamination ?? 'Unknown',
      claim.severity ?? 'Low',
      (claim.flags || []).join('|'),
      claim.updatedAt ?? '',
    ]),
  );
  return [headers.join(','), ...rows].join('\n');
};

const buildBreakdownSection = (title: string, entries: { label: string; count: number; cost: number }[]) => {
  const lines = [`${title},Count,Cost`];
  entries.forEach(entry => {
    lines.push(joinRow([entry.label, entry.count, Math.round(entry.cost)]));
  });
  return lines;
};

export const buildSummaryCsv = (kpi: KPI, aggregated: AggregatedData): string => {
  const lines: string[] = [];
  lines.push('KPI,Value');
  lines.push(joinRow(['Total Claims', kpi.totalClaims]));
  lines.push(joinRow(['Total Cost', Math.round(kpi.totalCost)]));
  lines.push(joinRow(['Avg Cost Per Claim', Math.round(kpi.avgCostPerClaim)]));
  lines.push(joinRow(['High Severity Count', kpi.highSeverityCount]));
  lines.push(joinRow(['High Severity Ratio (%)', kpi.highSeverityRatio.toFixed(1)]));
  lines.push(joinRow(['MoM Growth (%)', kpi.momGrowth.toFixed(1)]));
  lines.push(joinRow(['Top Phenomenon', kpi.topDefect]));

  lines.push('');
  lines.push(...buildBreakdownSection('Phenomenon Pareto', aggregated.phenomenonSummary));
  lines.push('');
  lines.push(...buildBreakdownSection('Cause Pareto', aggregated.causeSummary));
  lines.push('');
  lines.push(...buildBreakdownSection('Contamination Pareto', aggregated.contaminationSummary));
  lines.push('');
  const modelLines = ['Model Pareto,Count'];
  aggregated.modelPareto.forEach(entry => {
    modelLines.push(joinRow([entry.name, entry.count]));
  });
  lines.push(...modelLines);

  return lines.join('\n');
};

export const downloadCSV = (content: string, filename: string) => {
  if (typeof window === 'undefined' || !content) {
    return;
  }
  const csvWithBom = '\uFEFF' + content;
  const blob = new Blob([csvWithBom], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
