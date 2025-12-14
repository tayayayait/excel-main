import { DEFAULT_CLASSIFICATION_RULES } from '../constants/classification';
import { ClassificationRule, ClassificationRuleSet, FlagRule, SeverityRule } from '../types';

const RULE_STORAGE_KEY = 'autoseat_classification_rules';
const hasWindow = typeof window !== 'undefined';

const deepClone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string');

const isClassificationRule = (value: any): value is ClassificationRule =>
  value &&
  typeof value.code === 'string' &&
  typeof value.label === 'string' &&
  Array.isArray(value.keywords) &&
  isStringArray(value.keywords) &&
  (value.synonyms === undefined || isStringArray(value.synonyms)) &&
  (value.excludes === undefined || isStringArray(value.excludes)) &&
  (value.priority === undefined || typeof value.priority === 'number');

const isSeverityRule = (value: any): value is SeverityRule =>
  value &&
  (value.label === 'High' || value.label === 'Medium' || value.label === 'Low') &&
  (value.keywords === undefined || isStringArray(value.keywords)) &&
  (value.costThreshold === undefined || typeof value.costThreshold === 'number');

const isFlagRule = (value: any): value is FlagRule =>
  value && typeof value.id === 'string' && typeof value.label === 'string' && isStringArray(value.keywords);

export const isClassificationRuleSet = (value: any): value is ClassificationRuleSet => {
  if (!value || typeof value.version !== 'string') {
    return false;
  }
  if (
    !Array.isArray(value.phenomena) ||
    !Array.isArray(value.causes) ||
    !Array.isArray(value.contaminations) ||
    !Array.isArray(value.severity) ||
    !Array.isArray(value.flags)
  ) {
    return false;
  }
  return (
    value.phenomena.every(isClassificationRule) &&
    value.causes.every(isClassificationRule) &&
    value.contaminations.every(isClassificationRule) &&
    value.severity.every(isSeverityRule) &&
    value.flags.every(isFlagRule)
  );
};

const loadStoredRuleSet = (): ClassificationRuleSet | null => {
  if (!hasWindow) return null;
  try {
    const raw = window.localStorage.getItem(RULE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (isClassificationRuleSet(parsed)) {
      return parsed;
    }
  } catch (error) {
    console.warn('Failed to load stored classification rules', error);
  }
  return null;
};

let activeRuleSet: ClassificationRuleSet = (() => {
  const stored = loadStoredRuleSet();
  return stored ? stored : deepClone(DEFAULT_CLASSIFICATION_RULES);
})();

const persistRuleSet = (ruleSet: ClassificationRuleSet) => {
  if (!hasWindow) return;
  try {
    window.localStorage.setItem(RULE_STORAGE_KEY, JSON.stringify(ruleSet));
  } catch (error) {
    console.warn('Failed to persist classification rules', error);
  }
};

export const getActiveRuleSet = (): ClassificationRuleSet => activeRuleSet;

export const setActiveRuleSet = (ruleSet: ClassificationRuleSet, options: { persist?: boolean } = {}) => {
  activeRuleSet = deepClone(ruleSet);
  if (options.persist !== false) {
    persistRuleSet(activeRuleSet);
  }
};

export const resetToDefaultRuleSet = () => {
  setActiveRuleSet(deepClone(DEFAULT_CLASSIFICATION_RULES));
};

export const parseRuleSetFromJson = (content: string): ClassificationRuleSet => {
  const parsed = JSON.parse(content);
  if (!isClassificationRuleSet(parsed)) {
    throw new Error('Invalid rule file: missing required fields.');
  }
  return parsed;
};

export const serializeRuleSet = (ruleSet: ClassificationRuleSet = activeRuleSet): string =>
  JSON.stringify(ruleSet, null, 2);

export const getRuleStorageKey = () => RULE_STORAGE_KEY;
