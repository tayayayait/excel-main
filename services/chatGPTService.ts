import { CleanedClaim } from '../types';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';
const API_TOKEN = process.env.API_TOKEN || 'mock-token';

const getHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${API_TOKEN}`,
});

const postToProxy = async <T>(path: string, body: unknown): Promise<T> => {
  const url = new URL(path, API_BASE_URL);
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`AI proxy request failed (${response.status}): ${errorText}`);
  }
  return (await response.json()) as T;
};

export interface AIClassificationResult {
  phenomenon: string;
  cause: string;
  severity: 'High' | 'Medium' | 'Low';
}

export const initializeChatGPT = () => {
  if (!API_BASE_URL) {
    console.warn('API_BASE_URL is not configured. AI proxy calls may fail.');
  }
};

export const analyzeDefects = async (claims: CleanedClaim[]): Promise<string> => {
  const sampleClaims = claims.slice(0, 15).map(c => ({
    id: c.id,
    model: c.model,
    description: c.description,
    part: c.partName,
    phenomenon: c.phenomenon,
    cause: c.cause,
    severity: c.severity,
  }));

  try {
    const payload = await postToProxy<{ analysis: string }>('/api/ai/analyze', {
      claims: sampleClaims,
    });
    return payload.analysis || 'No analysis could be generated.';
  } catch (error) {
    console.error('AI analysis proxy failed:', error);
    return 'Failed to communicate with the AI proxy.';
  }
};

export const classifyClaimsBatch = async (
  claims: CleanedClaim[],
): Promise<Record<string, AIClassificationResult>> => {
  if (!claims.length) {
    return {};
  }

  const payload = {
    claims: claims
      .filter(claim => claim.description)
      .map(claim => ({
        id: claim.id,
        description: claim.description,
        model: claim.model,
        part: claim.partName,
        cost: claim.cost,
        phenomenon: claim.phenomenon,
        cause: claim.cause,
        severity: claim.severity,
      })),
  };

  if (!payload.claims.length) {
    return {};
  }

  try {
    const response = await postToProxy<{ results: Record<string, AIClassificationResult> }>('/api/ai/classify', payload);
    return response.results || {};
  } catch (error) {
    console.error('AI classification proxy failed:', error);
    return {};
  }
};
