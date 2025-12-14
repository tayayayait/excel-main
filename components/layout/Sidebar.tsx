import React from 'react';
import { BrainCircuit, LayoutDashboard, Settings, TrendingUp } from 'lucide-react';

export type MainTab = 'dashboard' | 'processing' | 'analysis' | 'settings';

type SidebarItemProps = {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
  notificationCount?: number;
};

const SidebarItem: React.FC<SidebarItemProps> = ({ icon: Icon, label, active, onClick, notificationCount = 0 }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center justify-between w-full p-3 mx-2 rounded-lg cursor-pointer transition-all duration-200 group text-left ${
      active
        ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20'
        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
    }`}
  >
    <span className="flex items-center space-x-3">
      <Icon size={20} className={active ? 'text-white' : 'text-slate-500 group-hover:text-white'} />
      <span className="font-medium text-sm">{label}</span>
    </span>
    {notificationCount > 0 && (
      <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{notificationCount}</span>
    )}
  </button>
);

interface SidebarProps {
  activeTab: MainTab;
  onTabChange: (tab: MainTab) => void;
  notificationCount?: number;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, notificationCount = 0 }) => {
  return (
    <aside className="w-64 bg-[#0F172A] text-white flex flex-col shadow-2xl">
      <div className="p-6">
        <div className="flex items-center space-x-2 mb-6">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-teal-400 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/30">
            <BrainCircuit size={18} className="text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight">Claim AI</span>
        </div>
        <div className="px-3 py-2 bg-slate-800/50 rounded-lg mb-2">
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Project</p>
          <p className="text-sm font-medium text-slate-200">차세대 시트 품질관리</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        <SidebarItem
          icon={LayoutDashboard}
          label="통합 현황판"
          active={activeTab === 'dashboard'}
          onClick={() => onTabChange('dashboard')}
          notificationCount={notificationCount}
        />
        <SidebarItem
          icon={BrainCircuit}
          label="자동 분류 & 정제"
          active={activeTab === 'processing'}
          onClick={() => onTabChange('processing')}
        />
        <SidebarItem
          icon={TrendingUp}
          label="분석 및 전망"
          active={activeTab === 'analysis'}
          onClick={() => onTabChange('analysis')}
        />
      </nav>

      <div className="p-4 border-t border-slate-800/50 space-y-3">
        <SidebarItem
          icon={Settings}
          label="시스템 설정"
          active={activeTab === 'settings'}
          onClick={() => onTabChange('settings')}
        />
        <div className="px-3 py-3 bg-slate-800/50 rounded-xl flex items-center space-x-3 border border-slate-700/50">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-xs font-bold shadow-md">
            QA
          </div>
          <div className="text-sm overflow-hidden">
            <p className="font-medium text-slate-200 truncate">Senior Manager</p>
            <p className="text-xs text-slate-500 truncate">품질보증팀</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
