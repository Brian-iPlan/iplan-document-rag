import React, { useEffect } from 'react';
import { X, CheckCircle, AlertCircle } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
  duration?: number;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose, duration = 3000 }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl border animate-in fade-in slide-in-from-bottom-4 duration-300 ${
      type === 'success' 
        ? 'bg-[#1e293b] border-emerald-500/30 text-emerald-400' 
        : 'bg-[#1e293b] border-rose-500/30 text-rose-400'
    }`}>
      {type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
      <span className="text-sm font-medium text-slate-200">{message}</span>
      <button 
        onClick={onClose} 
        className="ml-2 hover:bg-slate-700/50 rounded-full p-1 transition-colors text-slate-400 hover:text-slate-200"
      >
        <X size={16} />
      </button>
    </div>
  );
};

export default Toast;