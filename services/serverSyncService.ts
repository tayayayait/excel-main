import { CleanedClaim } from '../types';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';
const API_TOKEN = process.env.API_TOKEN || 'mock-token';
const STREAM_URL = `${API_BASE_URL.replace(/\/$/, '')}/api/notifications/stream?token=${API_TOKEN}`;

const getHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${API_TOKEN}`,
});

export interface ServerClaimsResponse {
  data: CleanedClaim[];
  lastUpdated?: string | null;
  version?: string | null;
}

export const fetchClaimsFromServer = async (since?: string): Promise<ServerClaimsResponse | null> => {
  try {
    const url = new URL('/api/claims', API_BASE_URL);
    if (since) {
      url.searchParams.set('since', since);
    }
    const response = await fetch(url.toString(), {
      headers: getHeaders(),
    });
    if (!response.ok) {
      console.error('Failed to fetch claims from server', response.status);
      return null;
    }
    return (await response.json()) as ServerClaimsResponse;
  } catch (error) {
    console.error('fetchClaimsFromServer error', error);
    return null;
  }
};

export interface UploadClaimsResult {
  version: string | null;
  lastUpdated: string | null;
}

export const uploadClaimsToServer = async (claims: CleanedClaim[]): Promise<UploadClaimsResult | null> => {
  if (!claims.length) return null;
  try {
    const url = new URL('/api/claims/upload', API_BASE_URL);
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        data: claims,
        source: 'web-app',
        uploadedAt: new Date().toISOString(),
      }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      console.error('Failed to upload claims', error || response.statusText);
      return null;
    }
    const payload = await response.json();
    return {
      version: payload.version || null,
      lastUpdated: payload.lastUpdated || null,
    };
  } catch (error) {
    console.error('uploadClaimsToServer error', error);
    return null;
  }
};

export interface ServerEvent {
  type: string;
  version?: string;
  lastUpdated?: string;
  at?: string;
}

export const subscribeToServerEvents = (onEvent: (event: ServerEvent) => void) => {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
    return () => {};
  }

  const source = new EventSource(STREAM_URL);

  source.onmessage = event => {
    try {
      const data = JSON.parse(event.data);
      onEvent(data);
    } catch (error) {
      console.error('Failed to parse SSE payload', error);
    }
  };
  source.onerror = error => {
    console.error('SSE connection error', error);
  };

  return () => {
    source.close();
  };
};

export const mergeClaimLists = (existing: CleanedClaim[], incoming: CleanedClaim[]): CleanedClaim[] => {
  if (!existing.length) {
    return incoming.slice();
  }
  if (!incoming.length) {
    return existing.slice();
  }

  const indexMap = new Map<string, number>();
  existing.forEach((claim, index) => {
    indexMap.set(claim.id, index);
  });

  const merged = existing.slice();
  incoming.forEach(claim => {
    const existingIndex = indexMap.get(claim.id);
    if (existingIndex !== undefined) {
      merged[existingIndex] = { ...merged[existingIndex], ...claim };
    } else {
      merged.push(claim);
      indexMap.set(claim.id, merged.length - 1);
    }
  });

  return merged;
};
