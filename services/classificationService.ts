import { ClassificationRule, ClassificationRuleSet, CleanedClaim, SeverityRule } from '../types';
import { normalizeForMatch } from './textUtils';
import { getActiveRuleSet } from './ruleService';

const getTerms = (rule: ClassificationRule) => [
  ...rule.keywords.map(k => k.toLowerCase()),
  ...(rule.synonyms?.map(s => s.toLowerCase()) || []),
];

const textMatchesRule = (text: string, rule: ClassificationRule): boolean => {
  const terms = getTerms(rule);
  if (!terms.length) {
    return false;
  }
  const hasKeyword = terms.some(keyword => text.includes(keyword));
  if (!hasKeyword) return false;
  if (rule.excludes && rule.excludes.length) {
    return !rule.excludes.some(keyword => text.includes(keyword.toLowerCase()));
  }
  return true;
};

const sortRulesByPriority = (rules: ClassificationRule[]) =>
  [...rules].sort((a, b) => (b.priority || 0) - (a.priority || 0));

const findRuleMatch = (text: string, rules: ClassificationRule[], fallback: ClassificationRule) => {
  const sorted = sortRulesByPriority(rules);
  return sorted.find(rule => textMatchesRule(text, rule)) || fallback;
};

const determineSeverity = (text: string, cost: number, severityRules: SeverityRule[]): 'High' | 'Medium' | 'Low' => {
  for (const rule of severityRules) {
    if (matchesSeverity(text, cost, rule)) {
      return rule.label;
    }
  }
  return 'Low';
};

const matchesSeverity = (text: string, cost: number, rule: SeverityRule) => {
  if (rule.keywords && rule.keywords.some(keyword => text.includes(keyword.toLowerCase()))) {
    return true;
  }
  if (rule.costThreshold !== undefined && cost >= rule.costThreshold) {
    return true;
  }
  return false;
};

const collectFlags = (text: string, ruleSet: ClassificationRuleSet): string[] => {
  return ruleSet.flags
    .filter(rule => rule.keywords.some(keyword => text.includes(keyword.toLowerCase())))
    .map(rule => rule.label);
};

export interface ClassificationResult {
  phenomenon: string;
  cause: string;
  contamination: string;
  severity: 'High' | 'Medium' | 'Low';
  flags: string[];
}

export const classifyClaim = (
  description?: string,
  partName?: string,
  cost?: number,
  ruleOverrides?: ClassificationRuleSet,
): ClassificationResult => {
  const combined = [description, partName].filter(Boolean).join(' ');
  const text = normalizeForMatch(combined);

  const ruleSet = ruleOverrides || getActiveRuleSet();
  const phenomenonRules = ruleSet.phenomena;
  const causeRules = ruleSet.causes;
  const contaminationRules = ruleSet.contaminations;

  const phenomenonFallback = phenomenonRules[phenomenonRules.length - 1];
  const causeFallback = causeRules[causeRules.length - 1];
  const contaminationFallback = contaminationRules[contaminationRules.length - 1];

  const phenomenonRule = findRuleMatch(text, phenomenonRules, phenomenonFallback);
  const causeRule = findRuleMatch(text, causeRules, causeFallback);
  const contaminationRule = findRuleMatch(text, contaminationRules, contaminationFallback);

  const severity = determineSeverity(text, cost || 0, ruleSet.severity);
  const flags = collectFlags(text, ruleSet);

  return {
    phenomenon: phenomenonRule.label,
    cause: causeRule.label,
    contamination: contaminationRule.label,
    severity,
    flags,
  };
};

export const applyRulesToClaims = (
  claims: CleanedClaim[],
  ruleOverrides?: ClassificationRuleSet,
): CleanedClaim[] => {
  return claims.map(claim => ({
    ...claim,
    ...classifyClaim(claim.description, claim.partName, claim.cost, ruleOverrides),
  }));
};
