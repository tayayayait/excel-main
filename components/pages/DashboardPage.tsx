import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AggregatedData, CleanedClaim, KPI } from '../../types';
import { DEFAULT_CURRENCY_SYMBOL } from '../../constants';
import { translatePhenomenon } from '../../i18n';
import KPICard from '../ui/KPICard';
import AIAlertCard from '../ui/AIAlertCard';
import {
  AlertTriangle,
  BarChart2,
  BrainCircuit,
  Calendar,
  ChevronDown,
  Database,
  DollarSign,
  FileText,
} from 'lucide-react';

interface DashboardPageProps {
  claims: CleanedClaim[];
  kpi: KPI;
  aggregated: AggregatedData;
  dataUpdated: boolean;
  lastLoadedCount?: number | null;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

const formatCurrency = (value: number) => `${DEFAULT_CURRENCY_SYMBOL} ${Math.round(value).toLocaleString('ko-KR')}`;

const getLatestMonthLabel = (claims: CleanedClaim[]) => {
  const sorted = [...claims]
    .map(claim => claim.date)
    .filter(Boolean)
    .sort();
  if (!sorted.length) return '전체 기간';
  const latest = sorted[sorted.length - 1];
  const [year, month] = latest.split('-');
  const monthNumber = Number(month);
  return `${year}년 ${monthNumber}월 (실시간)`;
};

const DashboardPage: React.FC<DashboardPageProps> = ({ claims, kpi, aggregated, dataUpdated, lastLoadedCount }) => {
  const monthTrend = useMemo(() => {
    const map = new Map<string, { claims: number; cost: number }>();
    claims.forEach(claim => {
      const key = claim.date?.slice(0, 7);
      if (!key) return;
      const current = map.get(key) || { claims: 0, cost: 0 };
      current.claims += 1;
      current.cost += claim.cost || 0;
      map.set(key, current);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([key, value]) => ({
        name: key.split('-')[1] ? `${Number(key.split('-')[1])}월` : key,
        claims: value.claims,
        cost: Math.round(value.cost),
      }));
  }, [claims]);

  const costTrendPercent = useMemo(() => {
    if (monthTrend.length < 2) return 0;
    const last = monthTrend[monthTrend.length - 1].cost;
    const prev = monthTrend[monthTrend.length - 2].cost;
    if (!prev) return last > 0 ? 100 : 0;
    return ((last - prev) / prev) * 100;
  }, [monthTrend]);

  const costByPhenomenonData = useMemo(
    () =>
      aggregated.phenomenonSummary.slice(0, 5).map(item => ({
        name: translatePhenomenon(item.label),
        cost: Math.round(item.cost),
        count: item.count,
      })),
    [aggregated.phenomenonSummary],
  );

  const latestMonthLabel = useMemo(() => getLatestMonthLabel(claims), [claims]);

  const criticalAlert = aggregated.costSpike
    ? {
        title: `${translatePhenomenon(aggregated.costSpike.phenomenon)} 비용 급증 감지`,
        description: `${translatePhenomenon(aggregated.costSpike.phenomenon)} 관련 비용이 직전 월 대비 ${formatCurrency(
          aggregated.costSpike.deltaCost,
        )} 증가했습니다.`,
      }
    : {
        title: '비용 급증 감지 없음',
        description: '현재 비용 급증 패턴이 감지되지 않았습니다.',
      };

  const warningAlert = aggregated.trendInsight
    ? {
        title: aggregated.trendInsight.growthPercent >= 0 ? '클레임 증가 추세' : '클레임 감소 추세',
        description: `${aggregated.trendInsight.recentLabel || '최근'} 기간 대비 ${aggregated.trendInsight.growthPercent.toFixed(
          1,
        )}% 변화`,
      }
    : { title: '추세 분석 대기', description: '추세 분석을 위한 데이터가 부족합니다.' };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200 text-sm font-medium text-slate-600">
          <Calendar size={16} />
          <span>{latestMonthLabel}</span>
          <ChevronDown size={14} />
        </div>
        <div className="flex items-center text-sm text-slate-500">
          <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse" />
          Last synced: {aggregated.forecastTrend.length ? aggregated.forecastTrend[aggregated.forecastTrend.length - 1].period : '방금 전'}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KPICard
          title="총 클레임 건수"
          value={`${kpi.totalClaims} 건`}
          subValue={dataUpdated ? `+${lastLoadedCount || 0}건 신규 반영` : '전월 데이터'}
          trend={kpi.momGrowth >= 0 ? 'up' : 'down'}
          trendValue={`${Math.abs(kpi.momGrowth).toFixed(1)}%`}
          icon={FileText}
          colorClass="bg-blue-500"
          highlight={dataUpdated}
        />
        <KPICard
          title="총 클레임 비용"
          value={formatCurrency(kpi.totalCost)}
          subValue="보증 수리비 + 부품비"
          trend={costTrendPercent >= 0 ? 'up' : 'down'}
          trendValue={`${Math.abs(costTrendPercent).toFixed(1)}%`}
          icon={DollarSign}
          colorClass="bg-indigo-500"
          highlight={dataUpdated}
        />
        <KPICard
          title="AI 감지 리스크"
          value={`${aggregated.importantClaims.length} 건`}
          subValue={dataUpdated ? '신규 패턴 감지' : '-'}
          trend="up"
          trendValue={`${aggregated.importantClaims.length} 건`}
          icon={BrainCircuit}
          colorClass="bg-rose-500"
          highlight={dataUpdated}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-800 flex items-center">
                <BarChart2 size={20} className="mr-2 text-blue-600" />
                월별 클레임 및 비용 추세
              </h3>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="claims" fill="#3B82F6" barSize={32} radius={[4, 4, 0, 0]} name="클레임 건수" />
                  <Line yAxisId="right" type="monotone" dataKey="cost" stroke="#EF4444" strokeWidth={3} dot={{ r: 4 }} name="비용" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
              <AlertTriangle size={20} className="mr-2 text-orange-600" />
              현상별 클레임 비용 순위 (Pareto Analysis)
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={costByPhenomenonData} margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={130}
                    tick={{ fill: '#475569', fontSize: 13, fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip contentStyle={{ borderRadius: '8px' }} />
                  <Bar dataKey="cost" barSize={24} radius={[0, 4, 4, 0]}>
                    {costByPhenomenonData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center justify-between">
              <span className="flex items-center">
                <BrainCircuit size={20} className="mr-2 text-purple-600" /> AI 중요 리포트
              </span>
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Real-time</span>
            </h3>
            <div className="space-y-3">
              {dataUpdated && (
                <div className="p-3 bg-blue-600 text-white rounded-lg shadow-md animate-pulse">
                  <div className="flex items-center mb-1">
                    <Database size={16} className="mr-2" />
                    <span className="font-bold text-sm">신규 데이터 분석 완료</span>
                  </div>
                  <p className="text-xs opacity-90 pl-6">{lastLoadedCount || 0}건이 현황판에 반영되었습니다.</p>
                </div>
              )}
              <AIAlertCard title={criticalAlert.title} description={criticalAlert.description} level={aggregated.costSpike ? 'critical' : 'warning'} />
              <AIAlertCard title={warningAlert.title} description={warningAlert.description} level="warning" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center">
            <h3 className="text-lg font-bold text-slate-800 mb-2 self-start w-full">현상별 점유율</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={costByPhenomenonData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="count">
                    {costByPhenomenonData.map((entry, index) => (
                      <Cell key={`slice-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
