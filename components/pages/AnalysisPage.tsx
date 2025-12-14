import React, { useMemo } from 'react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ForecastPoint, ImprovementAction, ImprovementMetrics } from '../../types';

interface AnalysisPageProps {
  improvements: ImprovementAction[];
  improvementStats: Record<string, ImprovementMetrics>;
  forecastTrend: ForecastPoint[];
}

const AnalysisPage: React.FC<AnalysisPageProps> = ({ improvements, improvementStats, forecastTrend }) => {
  const improvementData = useMemo(() => {
    return improvements
      .map(action => {
        const stat = improvementStats[action.id];
        return {
          name: action.name,
          before: stat?.beforeCount ?? 0,
          after: stat?.afterCount ?? 0,
        };
      })
      .filter(item => item.before > 0 || item.after > 0);
  }, [improvementStats, improvements]);

  const forecastData = useMemo(() => {
    return forecastTrend.map(point => ({
      month: point.actual === undefined ? `${point.period} (예측)` : point.period,
      actual: point.actual ?? null,
      predicted: point.forecast ?? null,
    }));
  }, [forecastTrend]);

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-800">개선 대책 유효성 분석</h2>
            <p className="text-sm text-slate-500 mt-1">과거 조치 사항에 대한 클레임 감소 효과를 정량적으로 분석합니다.</p>
          </div>
          <div className="flex items-center space-x-2 text-xs text-slate-500">
            <span className="flex items-center"><span className="w-3 h-3 bg-slate-400 rounded-sm mr-1" /> 개선 전</span>
            <span className="flex items-center"><span className="w-3 h-3 bg-emerald-500 rounded-sm mr-1" /> 개선 후</span>
          </div>
        </div>
        <div className="h-80">
          {improvementData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={improvementData} barSize={40} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 13 }} axisLine={false} tickLine={false} />
                <YAxis label={{ value: '클레임 건수', angle: -90, position: 'insideLeft', fill: '#94a3b8' }} tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                <Legend />
                <Bar dataKey="before" name="개선 전" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="after" name="개선 후" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-slate-500">
              개선 활동이 없거나 전/후 데이터를 비교할 수 없습니다.
            </div>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full opacity-50 pointer-events-none" />
        <h2 className="text-xl font-bold text-slate-800 mb-2">향후 3개월 클레임 추이 전망 (AI Forecast)</h2>
        <p className="text-sm text-slate-500 mb-6">
          현재 추세와 계절적 요인을 반영한 예측 모델링 결과입니다. <span className="text-blue-600 font-semibold">개선 대책 적용 시 감소</span>가 예상됩니다.
        </p>
        <div className="h-72">
          {forecastData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={forecastData}>
                <defs>
                  <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '8px' }} />
                <Legend />
                <Line type="monotone" dataKey="actual" name="실제" stroke="#64748b" strokeWidth={3} dot={{ r: 4 }} />
                <Area type="monotone" dataKey="predicted" name="AI 예측 (전망)" stroke="#3B82F6" fill="url(#colorForecast)" strokeDasharray="5 5" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-slate-500">예측 데이터를 표시할 수 없습니다.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalysisPage;
