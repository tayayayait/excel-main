#!/usr/bin/env ts-node
import fs from 'fs';
import path from 'path';
import { parseCSV, cleanData } from '../services/dataService';
import { applyRulesToClaims } from '../services/classificationService';
import { parseRuleSetFromJson } from '../services/ruleService';
import { DEFAULT_CLASSIFICATION_RULES } from '../constants/classification';
import { CleanedClaim, ClassificationRuleSet } from '../types';

const args = process.argv.slice(2);
let csvArg: string | undefined;
const options: Record<string, string> = {};

args.forEach(arg => {
  if (arg.startsWith('--')) {
    const [name, value] = arg.slice(2).split('=');
    options[name] = value || '';
  } else if (!csvArg) {
    csvArg = arg;
  }
});

const targetFile = csvArg ? path.resolve(process.cwd(), csvArg) : path.resolve(process.cwd(), 'qa/qa-sample.csv');
const candidateRulesPath = options.rules ? path.resolve(process.cwd(), options.rules) : undefined;
const baselineRulesPath = options.baseline ? path.resolve(process.cwd(), options.baseline) : undefined;
const unclassifiedOutPath = options.unclassified ? path.resolve(process.cwd(), options.unclassified) : undefined;

if (!fs.existsSync(targetFile)) {
  console.error(`QA sample file not found at ${targetFile}`);
  process.exit(1);
}

const cloneRuleSet = (rules: ClassificationRuleSet): ClassificationRuleSet => JSON.parse(JSON.stringify(rules));

const loadRuleSet = (filePath: string): ClassificationRuleSet => {
  const content = fs.readFileSync(filePath, 'utf-8');
  return cloneRuleSet(parseRuleSetFromJson(content));
};

const csvContent = fs.readFileSync(targetFile, 'utf-8');
const rawRows = parseCSV(csvContent);
const { claims: cleaned, stats } = cleanData(rawRows);

const baselineRules = baselineRulesPath ? loadRuleSet(baselineRulesPath) : cloneRuleSet(DEFAULT_CLASSIFICATION_RULES);
const candidateRules = candidateRulesPath ? loadRuleSet(candidateRulesPath) : baselineRules;
const hasComparison = candidateRulesPath !== undefined;

const baseline = applyRulesToClaims(cleaned, baselineRules);
const candidate = hasComparison ? applyRulesToClaims(cleaned, candidateRules) : baseline;

const buildDistribution = (claims: CleanedClaim[]) => {
  return claims.reduce<Record<string, number>>((acc, claim) => {
    const label = claim.phenomenon || 'Unclassified';
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});
};

const countUnclassified = (claims: CleanedClaim[]) =>
  claims.filter(
    claim => !claim.phenomenon || claim.phenomenon === 'Other / Unclassified' || claim.phenomenon === 'Unclassified',
  ).length;

const baselineDistribution = buildDistribution(baseline);
const candidateDistribution = buildDistribution(candidate);

console.log(`QA Classification Summary (${targetFile})`);
console.log(`Baseline rules version: ${baselineRules.version}`);
if (hasComparison) {
  console.log(`Candidate rules version: ${candidateRules.version}`);
}
console.log(`Total records: ${baseline.length}`);
console.log(
  `Dropped rows (missing 날짜): ${stats.missingDate}, 차종:${stats.missingModel}, 설명:${stats.missingDescription}`,
);
console.log(`Baseline unclassified: ${countUnclassified(baseline)}`);
console.table(baselineDistribution);

if (hasComparison) {
  console.log('\nCandidate distribution vs baseline (phenomenon):');
  const labels = new Set([...Object.keys(baselineDistribution), ...Object.keys(candidateDistribution)]);
  const rows: { phenomenon: string; baseline: number; candidate: number; delta: number }[] = [];
  labels.forEach(label => {
    const baseValue = baselineDistribution[label] || 0;
    const candidateValue = candidateDistribution[label] || 0;
    rows.push({
      phenomenon: label,
      baseline: baseValue,
      candidate: candidateValue,
      delta: candidateValue - baseValue,
    });
  });
  console.table(rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)));
  console.log(`Candidate unclassified: ${countUnclassified(candidate)}`);
}

if (unclassifiedOutPath) {
  const targetClaims = candidate.filter(
    claim => !claim.phenomenon || claim.phenomenon === 'Other / Unclassified' || claim.phenomenon === 'Unclassified',
  );
  const lines = [
    ['ID', 'Date', 'Model', 'Description', 'Phenomenon', 'Cause'].join(','),
    ...targetClaims.map(claim =>
      [
        claim.id,
        claim.date,
        claim.model,
        `"${(claim.description || '').replace(/"/g, '""')}"`,
        claim.phenomenon || 'Unclassified',
        claim.cause || 'Unknown',
      ].join(','),
    ),
  ];
  fs.writeFileSync(unclassifiedOutPath, lines.join('\n'), 'utf-8');
  console.log(`Saved ${targetClaims.length} unclassified records to ${unclassifiedOutPath}`);
}
