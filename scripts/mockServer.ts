#!/usr/bin/env ts-node
import express from 'express';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import { CleanedClaim } from '../types';
import { classifyClaim as ruleBasedClassify } from '../services/classificationService';

const PORT = process.env.MOCK_SERVER_PORT ? Number(process.env.MOCK_SERVER_PORT) : 4000;
const DATA_DIR = path.resolve(process.cwd(), 'mock-data');
const CLAIMS_FILE = path.join(DATA_DIR, 'claims.json');
const AUTH_TOKEN = process.env.MOCK_API_TOKEN || 'mock-token';

type ClaimsPayload = {
  data: CleanedClaim[];
  source?: string;
  uploadedAt?: string;
};

type StoredClaim = CleanedClaim & { updatedAt: string };

type ClaimsResponse = {
  data: StoredClaim[];
  lastUpdated: string;
  version: string;
};

const ensureTimestamps = (claims: CleanedClaim[], fallback: string): StoredClaim[] => {
  return claims.map(claim => {
    const updatedAt = claim.updatedAt || fallback;
    return { ...claim, updatedAt };
  });
};

const normalizeClaimsResponse = (record: ClaimsResponse): ClaimsResponse => {
  const fallback = record.lastUpdated || new Date().toISOString();
  const normalizedData = ensureTimestamps(record.data || [], fallback);
  const derivedLastUpdated = normalizedData.reduce((latest, claim) => {
    return claim.updatedAt > latest ? claim.updatedAt : latest;
  }, fallback);
  return {
    data: normalizedData,
    lastUpdated: derivedLastUpdated,
    version: record.version || 'init',
  };
};

const readClaims = (): ClaimsResponse => {
  if (!fs.existsSync(CLAIMS_FILE)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const empty: ClaimsResponse = {
      data: [],
      lastUpdated: new Date().toISOString(),
      version: 'init',
    };
    fs.writeFileSync(CLAIMS_FILE, JSON.stringify(empty, null, 2));
    return empty;
  }
  const parsed = JSON.parse(fs.readFileSync(CLAIMS_FILE, 'utf-8'));
  return normalizeClaimsResponse(parsed);
};

const saveClaims = (payload: ClaimsPayload) => {
  const version = `${Date.now().toString(16)}`;
  const timestamp = payload.uploadedAt || new Date().toISOString();
  const normalizedData = ensureTimestamps(payload.data || [], timestamp);
  const lastUpdated = normalizedData.reduce((latest, claim) => {
    return claim.updatedAt > latest ? claim.updatedAt : latest;
  }, timestamp);
  const record: ClaimsResponse = {
    data: normalizedData,
    lastUpdated,
    version,
  };
  fs.writeFileSync(CLAIMS_FILE, JSON.stringify(record, null, 2));
  return record;
};

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(cors());

app.use((req, res, next) => {
  const headerToken = (req.headers.authorization || '').replace('Bearer ', '');
  const queryToken = typeof req.query.token === 'string' ? req.query.token : undefined;
  const token = headerToken || queryToken;
  if (token !== AUTH_TOKEN) {
    return res.status(401).json({ error: { message: 'Unauthorized', code: 'UNAUTHENTICATED' } });
  }
  next();
});

app.get('/api/claims', (req, res) => {
  const claims = readClaims();
  const since = req.query.since ? new Date(String(req.query.since)) : null;
  if (since && !isNaN(since.getTime())) {
    const filtered = claims.data.filter(item => new Date(item.updatedAt) > since);
    return res.json({
      data: filtered,
      lastUpdated: claims.lastUpdated,
      version: claims.version,
    });
  }
  res.json(claims);
});

let clients: express.Response[] = [];

app.get('/api/notifications/stream', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders();
  res.write('retry: 10000\n\n');

  clients.push(res);
  req.on('close', () => {
    clients = clients.filter(client => client !== res);
  });
});

const broadcast = (event: any) => {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  clients.forEach(client => client.write(payload));
};

app.post('/api/claims/upload', (req, res) => {
  const payload = req.body as ClaimsPayload;
  if (!payload.data || !Array.isArray(payload.data)) {
    return res.status(400).json({ error: { message: 'Invalid data payload', code: 'BAD_REQUEST' } });
  }
  const saved = saveClaims(payload);
  broadcast({
    type: 'claims.updated',
    version: saved.version,
    lastUpdated: saved.lastUpdated,
  });
  res.json({ status: 'ok', version: saved.version, lastUpdated: saved.lastUpdated });
});

app.post('/api/notifications/push', (req, res) => {
  const event = req.body || {};
  broadcast(event);
  res.json({ status: 'sent' });
});

app.post('/api/ai/analyze', (req, res) => {
  const sampleClaims: CleanedClaim[] = Array.isArray(req.body?.claims) ? req.body.claims : [];
  if (!sampleClaims.length) {
    return res.json({ analysis: 'No claims provided for analysis.' });
  }
  const topModels = sampleClaims.reduce<Record<string, number>>((acc, claim) => {
    const key = claim.model || 'Unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const ranked = Object.entries(topModels)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([model, count], index) => `${index + 1}. ${model} - ${count}건`);
  const analysis = [
    '**Top Root Causes (Mocked)**',
    ...ranked,
    '',
    '**Recommended Action**',
    'Focus on quick triage for the most frequent model and confirm containment with supplier.',
  ].join('\n');
  res.json({ analysis });
});

app.post('/api/ai/classify', (req, res) => {
  const items: any[] = Array.isArray(req.body?.claims) ? req.body.claims : [];
  if (!items.length) {
    return res.status(400).json({ error: { message: 'claims payload required', code: 'BAD_REQUEST' } });
  }
  const results: Record<string, { phenomenon: string; cause: string; severity: 'High' | 'Medium' | 'Low' }> = {};
  items.forEach(item => {
    if (!item?.id || !item.description) {
      return;
    }
    const classification = ruleBasedClassify(item.description, item.part, item.cost);
    results[item.id] = {
      phenomenon: classification.phenomenon,
      cause: classification.cause,
      severity: classification.severity,
    };
  });
  res.json({ results });
});

app.listen(PORT, () => {
  console.log(`Mock Claims API running at http://localhost:${PORT}`);
});
