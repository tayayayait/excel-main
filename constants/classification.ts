import defaultRuleSet from './classificationRules.json';
import { ClassificationRuleSet } from '../types';

export const DEFAULT_CLASSIFICATION_RULES: ClassificationRuleSet = defaultRuleSet as ClassificationRuleSet;
export const CLASSIFICATION_RULES_VERSION = DEFAULT_CLASSIFICATION_RULES.version;

export const IMPORTANT_CLAIM_WEIGHTS = {
  severity: {
    High: 6,
    Medium: 3,
    Low: 1,
  },
  cost: {
    normalizer: 200,
    maxBonus: 4,
  },
  recency: {
    hotDays: 30,
    hotBonus: 4,
    recentDays: 90,
    recentBonus: 2,
  },
  trend: {
    mediumGrowthThreshold: 20,
    mediumGrowthBonus: 2,
    highGrowthThreshold: 50,
    highGrowthBonus: 4,
    newIssueBonus: 3,
  },
  costSpike: {
    multiplier: 1.6,
    bonus: 2,
    emergingBonus: 1,
  },
  flags: {
    safety: 5,
    repeat: 3,
  },
};
