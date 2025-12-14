import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ClassificationRuleSet,
  CleanedClaim,
  FilterState,
  ImprovementAction,
  ImprovementMetrics,
  ServerSyncStatus,
} from './types';
import { parseCSV, cleanData, aggregateData, calculateKPIs, DEFAULT_FILTERS, applyFilters } from './services/dataService';
import { SAMPLE_CSV_DATA, TEMPLATE_CSV_DATA } from './constants';
import { initializeChatGPT } from './services/chatGPTService';
import { enrichClaimsWithAI } from './services/classificationPipeline';
import { calculateImprovementMetrics } from './services/improvementService';
import {
  fetchClaimsFromServer,
  uploadClaimsToServer,
  subscribeToServerEvents,
  mergeClaimLists,
} from './services/serverSyncService';
import { downloadCSV } from './services/csvService';
import { applyRulesToClaims } from './services/classificationService';
import { getActiveRuleSet, setActiveRuleSet } from './services/ruleService';
import Sidebar, { MainTab } from './components/layout/Sidebar';
import TopHeader from './components/layout/TopHeader';
import Toast from './components/ui/Toast';
import ProcessingPage from './components/pages/ProcessingPage';
import DashboardPage from './components/pages/DashboardPage';
import AnalysisPage from './components/pages/AnalysisPage';
import SettingsPanel from './components/dashboard/SettingsPanel';

const FILTER_STORAGE_KEY = 'autoseat_claim_filters';
const IMPROVEMENTS_STORAGE_KEY = 'autoseat_improvements';
const SERVER_POLL_INTERVAL_MS = 60_000;

const getStoredFilters = (): FilterState => {
  if (typeof window === 'undefined') return DEFAULT_FILTERS;
  const saved = window.localStorage.getItem(FILTER_STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return {
        model: parsed.model || DEFAULT_FILTERS.model,
        phenomenon: parsed.phenomenon || DEFAULT_FILTERS.phenomenon,
        cause: parsed.cause || DEFAULT_FILTERS.cause,
        contamination: parsed.contamination || DEFAULT_FILTERS.contamination,
        severity: parsed.severity || DEFAULT_FILTERS.severity,
        flag: parsed.flag || DEFAULT_FILTERS.flag,
        dateRange: {
          start: parsed.dateRange?.start || null,
          end: parsed.dateRange?.end || null,
        },
      };
    } catch {
      return DEFAULT_FILTERS;
    }
  }
  return DEFAULT_FILTERS;
};

const getStoredImprovements = (): ImprovementAction[] => {
  if (typeof window === 'undefined') return [];
  const saved = window.localStorage.getItem(IMPROVEMENTS_STORAGE_KEY);
  if (!saved) return [];
  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MainTab>('processing');
  const [claims, setClaims] = useState<CleanedClaim[]>([]);
  const [ruleSet, setRuleSet] = useState<ClassificationRuleSet>(() => getActiveRuleSet());
  const [filters, setFilters] = useState<FilterState>(() => getStoredFilters());
  const [improvements, setImprovements] = useState<ImprovementAction[]>(() => getStoredImprovements());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analysisCompleted, setAnalysisCompleted] = useState(false);
  const [serverStatus, setServerStatus] = useState<ServerSyncStatus>({
    status: 'idle',
    lastSyncedAt: null,
    lastUploadedAt: null,
    serverVersion: null,
  });
  const [dataUpdated, setDataUpdated] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [lastLoadedCount, setLastLoadedCount] = useState<number | null>(null);
  const lastSyncedRef = useRef<string | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  const [parseStats, setParseStats] = useState<{
    parsedRows: number;
    droppedRows: number;
    missingDate: number;
    missingModel: number;
    missingDescription: number;
  } | null>(null);

  useEffect(() => {
    initializeChatGPT();
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
    }
  }, [filters]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(IMPROVEMENTS_STORAGE_KEY, JSON.stringify(improvements));
    }
  }, [improvements]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const triggerToast = useCallback((message: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(message);
    setShowToast(true);
    const timeoutId = setTimeout(() => {
      setShowToast(false);
      toastTimeoutRef.current = null;
    }, 5000);
    toastTimeoutRef.current = Number(timeoutId);
  }, []);

  const handleDataLoad = useCallback((csvContent: string) => {
    try {
      const rawData = parseCSV(csvContent);
      const { claims: cleaned, stats } = cleanData(rawData);
      setClaims(cleaned);
      setParseStats(stats);
      setFilters(DEFAULT_FILTERS);
      setUploadProgress(0);
      setAnalysisCompleted(false);
      setDataUpdated(false);
      setLastLoadedCount(cleaned.length);
      setActiveTab('processing');
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = null;
      }
      setShowToast(false);
    } catch (error) {
      console.error('Failed to parse data', error);
      alert('파일을 분석하는 중 오류가 발생했습니다. 형식을 확인해 주세요.');
    }
  }, []);

  const handleAddImprovement = (action: Omit<ImprovementAction, 'id'>) => {
    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `imp-${Date.now()}`;
    setImprovements(prev => [...prev, { ...action, id }]);
  };

  const handleRemoveImprovement = (id: string) => {
    setImprovements(prev => prev.filter(action => action.id !== id));
  };

  const syncFromServer = useCallback(
    async (reason: 'initial' | 'poll' | 'event' = 'poll') => {
      setServerStatus(prev => ({ ...prev, status: 'syncing', error: null }));
      const since = lastSyncedRef.current || undefined;
      const response = await fetchClaimsFromServer(since);
      if (response) {
        if (response.lastUpdated) {
          lastSyncedRef.current = response.lastUpdated;
        }
        setServerStatus(prev => ({
          ...prev,
          status: 'idle',
          lastSyncedAt: response.lastUpdated || prev.lastSyncedAt,
          serverVersion: response.version || prev.serverVersion,
        }));
        if (response.data && response.data.length) {
          if (since) {
            setClaims(prev => mergeClaimLists(prev, response.data));
            setDataUpdated(true);
            triggerToast(`${response.data.length}건의 신규 데이터가 서버에서 동기화되었습니다.`);
          } else {
            setClaims(response.data);
          }
        } else if (!since) {
          setClaims([]);
        }
      } else {
        setServerStatus(prev => ({
          ...prev,
          status: 'error',
          error: `Server sync failed (${reason})`,
        }));
      }
    },
    [triggerToast],
  );

  const handleAnalyze = useCallback(async () => {
    if (!claims.length) {
      alert('분석할 데이터가 없습니다.');
      return;
    }
    setIsAnalyzing(true);
    setUploadProgress(0);
    setAnalysisCompleted(false);
    setServerStatus(prev => ({ ...prev, status: 'syncing', error: null }));
    const progressTimer = setInterval(() => {
      setUploadProgress(prev => (prev >= 90 ? prev : prev + 10));
    }, 250);
    try {
      const enriched = await enrichClaimsWithAI(claims);
      const nextClaims = enriched.length ? enriched : claims;
      if (enriched.length) {
        setClaims(enriched);
      }
      const serverPayload = await uploadClaimsToServer(nextClaims);
      const timestamp = new Date().toISOString();
      const syncedAt = serverPayload?.lastUpdated || timestamp;
      setServerStatus(prev => ({
        ...prev,
        status: 'idle',
        lastUploadedAt: timestamp,
        lastSyncedAt: syncedAt,
        serverVersion: serverPayload?.version || prev.serverVersion,
      }));
      if (serverPayload?.lastUpdated) {
        lastSyncedRef.current = serverPayload.lastUpdated;
      }
      setUploadProgress(100);
      setAnalysisCompleted(true);
      setDataUpdated(true);
      setLastLoadedCount(nextClaims.length);
      triggerToast(`분석된 ${nextClaims.length}건의 클레임 데이터가 저장되었습니다.`);
      setActiveTab('dashboard');
    } catch (error) {
      console.error('AI enrichment failed', error);
      setServerStatus(prev => ({
        ...prev,
        status: 'error',
        error: 'Failed to sync with server',
      }));
    } finally {
      clearInterval(progressTimer);
      setIsAnalyzing(false);
    }
  }, [claims, triggerToast]);

  const handleDownloadTemplate = () => {
    downloadCSV(TEMPLATE_CSV_DATA, 'autoseat-claim-template.csv');
  };

  const filteredClaims = useMemo(() => applyFilters(claims, filters), [claims, filters]);
  const aggregated = useMemo(() => aggregateData(filteredClaims), [filteredClaims]);
  const kpi = useMemo(() => calculateKPIs(filteredClaims), [filteredClaims]);
  const improvementStats = useMemo<Record<string, ImprovementMetrics>>(
    () => calculateImprovementMetrics(claims, improvements),
    [claims, improvements],
  );

  const handleApplyRuleSet = (nextRules: ClassificationRuleSet) => {
    setActiveRuleSet(nextRules);
    setRuleSet(nextRules);
    setClaims(prev => applyRulesToClaims(prev, nextRules));
  };

  useEffect(() => {
    syncFromServer('initial');

    const interval = setInterval(() => {
      syncFromServer('poll');
    }, SERVER_POLL_INTERVAL_MS);

    const unsubscribe = subscribeToServerEvents(event => {
      if (event.type === 'claims.updated') {
        syncFromServer('event');
      }
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [syncFromServer]);

  const handleLoadSample = () => handleDataLoad(SAMPLE_CSV_DATA);

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800 selection:bg-blue-100">
      {showToast && <Toast message={toastMessage} onClose={() => setShowToast(false)} />}

      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        notificationCount={dataUpdated ? 3 : 0}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <TopHeader activeTab={activeTab} serverStatus={serverStatus} dataUpdated={dataUpdated} />
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'processing' && (
              <ProcessingPage
                claims={claims}
                parseStats={parseStats}
                isAnalyzing={isAnalyzing}
                analysisCompleted={analysisCompleted}
                uploadProgress={uploadProgress}
                serverStatus={serverStatus}
                onLoadCsv={handleDataLoad}
                onStartAnalysis={handleAnalyze}
                onLoadSample={handleLoadSample}
                onDownloadTemplate={handleDownloadTemplate}
              />
            )}

            {activeTab === 'dashboard' && (
              <DashboardPage
                claims={filteredClaims}
                kpi={kpi}
                aggregated={aggregated}
                dataUpdated={dataUpdated}
                lastLoadedCount={lastLoadedCount}
              />
            )}

            {activeTab === 'analysis' && (
              <AnalysisPage
                improvements={improvements}
                improvementStats={improvementStats}
                forecastTrend={aggregated.forecastTrend}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsPanel
                allClaims={claims}
                ruleSet={ruleSet}
                onApplyRuleSet={handleApplyRuleSet}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
