import React, { useMemo, useRef, useState } from 'react';
import { BrainCircuit, CheckCircle2, RefreshCw, Upload } from 'lucide-react';
import { CleanedClaim, ServerSyncStatus } from '../../types';
import { translatePhenomenon } from '../../i18n';

type ParseStats = {
  parsedRows: number;
  droppedRows: number;
  missingDate: number;
  missingModel: number;
  missingDescription: number;
};

interface ProcessingPageProps {
  claims: CleanedClaim[];
  parseStats: ParseStats | null;
  isAnalyzing: boolean;
  analysisCompleted: boolean;
  uploadProgress: number;
  serverStatus: ServerSyncStatus;
  onLoadCsv: (content: string) => void;
  onStartAnalysis: () => void;
  onLoadSample?: () => void;
  onDownloadTemplate?: () => void;
}

const normalizeKeywords = (text: string) => {
  return text
    .toLowerCase()
    .split(/[^a-z0-9가-힣]+/g)
    .filter(Boolean)
    .slice(0, 2)
    .join(', ');
};

const ProcessingPage: React.FC<ProcessingPageProps> = ({
  claims,
  parseStats,
  isAnalyzing,
  analysisCompleted,
  uploadProgress,
  serverStatus,
  onLoadCsv,
  onStartAnalysis,
  onLoadSample,
  onDownloadTemplate,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    if (file.type !== 'text/csv' && !file.name.toLowerCase().endsWith('.csv')) {
      setError('현재는 CSV 파일만 지원됩니다.');
      return;
    }
    const text = await file.text();
    onLoadCsv(text);
    setError(null);
  };

  const unclassifiedCount = useMemo(
    () => claims.filter(claim => !claim.phenomenon || claim.phenomenon === 'Unclassified').length,
    [claims],
  );

  const estimatedAccuracy = useMemo(() => {
    if (!claims.length) return 0;
    const classified = claims.length - unclassifiedCount;
    return (classified / claims.length) * 100;
  }, [claims.length, unclassifiedCount]);

  const previewRows = useMemo(() => {
    return claims.slice(0, 10).map(claim => {
      const category = claim.phenomenon ? translatePhenomenon(claim.phenomenon) : '미분류';
      const keyword = normalizeKeywords(claim.description || '');
      return {
        id: claim.id,
        text: claim.description,
        keyword: keyword || '-',
        category: analysisCompleted ? category : '-',
        confidence: analysisCompleted ? (category === '미분류' ? 75 : 95) : 0,
        status: analysisCompleted ? '완료' : '대기',
      };
    });
  }, [analysisCompleted, claims]);

  const dbOnline = serverStatus.status !== 'error';

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full mix-blend-overlay filter blur-3xl opacity-20 -mr-16 -mt-16" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold mb-2 flex items-center">
              <BrainCircuit className="mr-3 text-blue-400" />
              Data Processing Center
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              업로드된 엑셀/CSV 파일의 자연어를 분석하여 자동으로 분류(Tagging)합니다. 분석이 완료되면
              <span className="text-blue-300 font-semibold ml-1">통합 현황판(Dashboard)이 자동으로 갱신</span>
              됩니다.
            </p>
            {error && <p className="text-xs text-rose-300 mt-3">{error}</p>}
          </div>
          <div className="flex flex-wrap gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={event => {
                const file = event.target.files?.[0];
                if (file) {
                  handleFile(file).catch(() => setError('파일을 처리하는 중 오류가 발생했습니다.'));
                }
                event.currentTarget.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center px-6 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl text-white text-sm font-medium transition-all border border-white/10"
            >
              <Upload size={18} className="mr-2" /> 파일 선택
            </button>
            {onLoadSample && (
              <button
                type="button"
                onClick={onLoadSample}
                className="px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-semibold"
              >
                샘플 로드
              </button>
            )}
            {onDownloadTemplate && (
              <button
                type="button"
                onClick={onDownloadTemplate}
                className="px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-semibold"
              >
                템플릿 다운로드
              </button>
            )}
            <button
              type="button"
              onClick={onStartAnalysis}
              disabled={isAnalyzing || analysisCompleted || !claims.length}
              className={`flex items-center px-8 py-3 rounded-xl font-bold shadow-lg transition-all ${
                analysisCompleted
                  ? 'bg-green-500 text-white cursor-default'
                  : isAnalyzing || !claims.length
                  ? 'bg-slate-600 text-slate-300 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-500'
              }`}
            >
              {analysisCompleted ? (
                <>
                  <CheckCircle2 size={18} className="mr-2" /> 분석 완료됨
                </>
              ) : isAnalyzing ? (
                <>
                  <RefreshCw size={18} className="mr-2 animate-spin" /> 처리 중...
                </>
              ) : (
                <>
                  <BrainCircuit size={18} className="mr-2" /> 분석 시작
                </>
              )}
            </button>
          </div>
        </div>

        {isAnalyzing && (
          <div className="mt-8">
            <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-blue-300 mb-2">
              <span>AI Classification Progress</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-slate-700/50 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-500 h-full rounded-full transition-all duration-300 relative"
                style={{ width: `${uploadProgress}%` }}
              >
                <div className="absolute inset-0 bg-white/30 animate-shimmer" />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center">
          <span className="text-xs text-slate-500 font-semibold uppercase mb-1">AI 분류 정확도</span>
          <span className="text-2xl font-bold text-emerald-600">{estimatedAccuracy.toFixed(1)}%</span>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center">
          <span className="text-xs text-slate-500 font-semibold uppercase mb-1">금일 처리 건수</span>
          <span className="text-2xl font-bold text-slate-700">{claims.length}</span>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center">
          <span className="text-xs text-slate-500 font-semibold uppercase mb-1">검토 필요</span>
          <span className="text-2xl font-bold text-amber-500">{unclassifiedCount}</span>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center bg-slate-50">
          <span className="text-xs text-slate-500 font-semibold uppercase mb-1">DB 연결 상태</span>
          <div className={`flex items-center font-bold ${dbOnline ? 'text-green-600' : 'text-rose-600'}`}>
            <span className={`w-2 h-2 rounded-full mr-2 ${dbOnline ? 'bg-green-500 animate-pulse' : 'bg-rose-500'}`} />
            {dbOnline ? 'Online' : 'Offline'}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h3 className="font-bold text-slate-700">처리 결과 미리보기 (Preview)</h3>
            {parseStats && (
              <p className="text-xs text-slate-500 mt-1">
                파싱된 행: {parseStats.parsedRows}건 / 누락 {parseStats.droppedRows}건 (날짜 {parseStats.missingDate}, 차종{' '}
                {parseStats.missingModel}, 설명 {parseStats.missingDescription})
              </p>
            )}
          </div>
          <span className="text-xs text-slate-400">Showing {previewRows.length} items</span>
        </div>
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">ID</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-5/12">원문 내용</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">추출 키워드</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">자동 분류</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">신뢰도</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {previewRows.map(row => (
              <tr key={row.id} className={row.status === '완료' ? 'bg-blue-50/30' : 'hover:bg-slate-50'}>
                <td className="px-6 py-4 text-xs font-mono text-slate-400">#{row.id}</td>
                <td className="px-6 py-4 text-sm text-slate-700 leading-relaxed">{row.text}</td>
                <td className="px-6 py-4">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                    {row.keyword || '-'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm font-bold text-slate-700">
                  {row.category !== '-' ? (
                    <span className="inline-flex items-center">
                      <CheckCircle2 size={14} className="text-blue-500 mr-2" />
                      {row.category}
                    </span>
                  ) : (
                    <span className="text-slate-300">-</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  {row.confidence > 0 ? (
                    <span className="flex items-center text-xs text-slate-500">
                      <span className="w-16 bg-slate-200 rounded-full h-1.5 mr-2">
                        <span
                          className={`h-1.5 rounded-full ${row.confidence > 90 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                          style={{ width: `${row.confidence}%` }}
                        />
                      </span>
                      {row.confidence}%
                    </span>
                  ) : (
                    <span className="text-slate-300 text-xs">-</span>
                  )}
                </td>
              </tr>
            ))}
            {!previewRows.length && (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-slate-500 text-sm">
                  아직 로드된 데이터가 없습니다. CSV 파일을 업로드해 주세요.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProcessingPage;
