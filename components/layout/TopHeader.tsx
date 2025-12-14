import React, { useMemo, useState } from 'react';
import { Bell, Database, Search } from 'lucide-react';
import { ServerSyncStatus } from '../../types';
import { MainTab } from './Sidebar';

interface TopHeaderProps {
  activeTab: MainTab;
  serverStatus: ServerSyncStatus;
  dataUpdated: boolean;
}

const tabTitles: Record<MainTab, string> = {
  dashboard: 'Dashboard Overview',
  processing: 'Data Processing Center',
  analysis: 'Analytics & Forecast',
  settings: 'System Settings',
};

const TopHeader: React.FC<TopHeaderProps> = ({ activeTab, serverStatus, dataUpdated }) => {
  const [searchValue, setSearchValue] = useState('');
  const serverLabel = useMemo(() => {
    if (serverStatus.serverVersion) {
      return `Connected to ${serverStatus.serverVersion}`;
    }
    return 'Connected to HQ_DB_v2';
  }, [serverStatus.serverVersion]);

  return (
    <header className="bg-white/80 backdrop-blur-md sticky top-0 border-b border-slate-200 h-16 flex items-center justify-between px-8 z-10">
      <div className="flex items-center">
        <h2 className="text-lg font-bold text-slate-800 tracking-tight">{tabTitles[activeTab]}</h2>
        <span className="mx-3 text-slate-300">|</span>
        <div className="flex items-center text-xs text-slate-500 font-medium bg-slate-100 px-2 py-1 rounded-md">
          <Database size={12} className="mr-1" />
          {serverLabel}
        </div>
      </div>

      <div className="flex items-center space-x-5">
        <div className="relative group">
          <Search
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors"
            size={16}
          />
          <input
            type="text"
            placeholder="Search claims..."
            value={searchValue}
            onChange={event => setSearchValue(event.target.value)}
            className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-64 transition-all"
          />
        </div>
        <div className="h-6 w-px bg-slate-200" />
        <button type="button" className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors">
          <Bell size={20} />
          {dataUpdated && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white animate-pulse" />
          )}
        </button>
      </div>
    </header>
  );
};

export default TopHeader;
