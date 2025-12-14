import { CleanedClaim } from '../types';
import { classifyWithProvider } from './modelGateway';

const needsAIEnrichment = (claim: CleanedClaim) => {
  const phenomenon = (claim.phenomenon || '').toLowerCase();
  return (
    !claim.phenomenon ||
    phenomenon.includes('unclassified') ||
    phenomenon.includes('other') ||
    claim.severity === 'High'
  );
};

export const enrichClaimsWithAI = async (claims: CleanedClaim[]): Promise<CleanedClaim[]> => {
  const candidates = claims.filter(needsAIEnrichment);
  if (!candidates.length) return claims;

  const aiResults = await classifyWithProvider(candidates);
  if (!Object.keys(aiResults).length) {
    return claims;
  }

  return claims.map(claim => {
    const ai = aiResults[claim.id];
    if (!ai) return claim;
    return {
      ...claim,
      phenomenon: ai.phenomenon || claim.phenomenon,
      cause: ai.cause || claim.cause,
      severity: ai.severity || claim.severity,
    };
  });
};
