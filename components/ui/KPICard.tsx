import React from 'react';
import { LucideIcon, TrendingUp } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string;
  subValue?: string;
  trend: 'up' | 'down';
  trendValue: string;
  icon: LucideIcon;
  colorClass: string;
  highlight?: boolean;
}

const KPICard: React.FC<KPICardProps> = ({ title, value, subValue, trend, trendValue, icon: Icon, colorClass, highlight = false }) => (
  <div
    className={`bg-white p-6 rounded-2xl border flex items-start justify-between transition-all duration-500 ${
      highlight
        ? 'border-blue-300 shadow-lg ring-2 ring-blue-100 transform scale-[1.02]'
        : 'border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)]'
    }`}
  >
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{title}</p>
      <h3 className={`text-2xl font-bold transition-colors duration-300 ${highlight ? 'text-blue-600' : 'text-slate-800'}`}>{value}</h3>
      {subValue && <p className="text-xs text-slate-400 mt-1">{subValue}</p>}
      <div className={`flex items-center mt-3 text-sm font-medium ${trend === 'up' ? 'text-rose-500' : 'text-emerald-500'}`}>
        {trend === 'up' ? <TrendingUp size={16} className="mr-1" /> : <TrendingUp size={16} className="mr-1 transform rotate-180" />}
        <span>{trendValue} vs 전월</span>
      </div>
    </div>
    <div className={`p-3 rounded-xl ${colorClass} bg-opacity-10`}>
      <Icon size={24} className={colorClass.replace('bg-', 'text-')} />
    </div>
  </div>
);

export default KPICard;
