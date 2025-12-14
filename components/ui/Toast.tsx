import React from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

interface ToastProps {
  message: string;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, onClose }) => (
  <div className="fixed bottom-6 right-6 bg-slate-800 text-white px-6 py-4 rounded-lg shadow-2xl flex items-center space-x-4 animate-slide-up z-50">
    <div className="bg-green-500 rounded-full p-1">
      <CheckCircle2 size={16} className="text-white" />
    </div>
    <div>
      <h4 className="font-bold text-sm">시스템 업데이트 완료</h4>
      <p className="text-xs text-slate-300">{message}</p>
    </div>
    <button type="button" onClick={onClose} className="text-slate-400 hover:text-white ml-4">
      <ArrowRight size={16} />
    </button>
  </div>
);

export default Toast;
