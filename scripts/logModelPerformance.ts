#!/usr/bin/env ts-node
import fs from 'fs';
import path from 'path';
import { parseCSV, cleanData } from '../services/dataService';
import { enrichClaimsWithAI } from '../services/classificationPipeline';
import { initializeChatGPT } from '../services/chatGPTService';

const SAMPLE_PATH = process.argv[2] || path.resolve(process.cwd(), 'qa/qa-sample.csv');
const TRUTH_PATH = process.argv[3] || path.resolve(process.cwd(), 'qa/ground-truth.json');

const loadGroundTruth = (): Record<string, { phenomenon?: string; severity?: string }> => {
  if (!fs.existsSync(TRUTH_PATH)) {
    console.warn('Ground truth file not found. Skipping accuracy calculation.');
    return {};
  }
  return JSON.parse(fs.readFileSync(TRUTH_PATH, 'utf-8'));
};

const ensureLogsDir = () => {
  const dir = path.resolve(process.cwd(), 'logs');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const run = async () => {
  if (!fs.existsSync(SAMPLE_PATH)) {
    console.error(`Sample dataset not found at ${SAMPLE_PATH}`);
    process.exit(1);
  }

  initializeChatGPT();

  const csvContent = fs.readFileSync(SAMPLE_PATH, 'utf-8');
  const rawRows = parseCSV(csvContent);
  const { claims: cleaned } = cleanData(rawRows);
  const enriched = await enrichClaimsWithAI(cleaned);

  const truth = loadGroundTruth();
  const evaluated = enriched.filter(claim => truth[claim.id]);
  const matches = evaluated.filter(claim => truth[claim.id].phenomenon === claim.phenomenon).length;
  const accuracy = evaluated.length ? matches / evaluated.length : 0;

  const logEntry = {
    timestamp: new Date().toISOString(),
    provider: process.env.MODEL_PROVIDER || 'chatgpt',
    dataset: path.basename(SAMPLE_PATH),
    evaluated: evaluated.length,
    matches,
    accuracy: Number(accuracy.toFixed(3)),
  };

  const logsDir = ensureLogsDir();
  fs.appendFileSync(path.join(logsDir, 'model-performance.log'), JSON.stringify(logEntry) + '\n');

  console.log('Model performance log entry:', logEntry);
};

run().catch(error => {
  console.error('Failed to log model performance', error);
  process.exit(1);
});
