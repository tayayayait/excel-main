import { CleanedClaim } from '../types';
import { classifyClaimsBatch, AIClassificationResult } from './chatGPTService';

export const classifyWithProvider = async (
  claims: CleanedClaim[],
): Promise<Record<string, AIClassificationResult>> => {
  if (!claims.length) return {};
  return classifyClaimsBatch(claims);
};
