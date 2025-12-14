import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface AIAlertCardProps {
  title: string;
  description: string;
  level: 'critical' | 'warning';
}

const AIAlertCard: React.FC<AIAlertCardProps> = ({ title, description, level }) => (
  <div
    className={`p-4 rounded-xl border mb-3 transition-transform hover:scale-[1.02] cursor-pointer ${
      level === 'critical'
        ? 'bg-rose-50 border-rose-100 hover:bg-rose-100'
        : 'bg-amber-50 border-amber-100 hover:bg-amber-100'
    }`}
  >
    <div className="flex items-center mb-2">
      <AlertTriangle size={18} className={level === 'critical' ? 'text-rose-600 mr-2' : 'text-amber-600 mr-2'} />
      <h4 className={`font-bold text-sm ${level === 'critical' ? 'text-rose-800' : 'text-amber-800'}`}>{title}</h4>
    </div>
    <p className="text-xs text-slate-600 ml-7 leading-relaxed">{description}</p>
  </div>
);

export default AIAlertCard;
