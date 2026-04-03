import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

let toastId = 0;

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const COLORS = {
  success: {
    bg: 'bg-emerald-50 border-emerald-200',
    icon: 'text-emerald-600',
    text: 'text-emerald-900',
    sub: 'text-emerald-700',
  },
  error: {
    bg: 'bg-red-50 border-red-200',
    icon: 'text-red-600',
    text: 'text-red-900',
    sub: 'text-red-700',
  },
  info: {
    bg: 'bg-blue-50 border-blue-200',
    icon: 'text-blue-600',
    text: 'text-blue-900',
    sub: 'text-blue-700',
  },
};

const DURATIONS = { success: 4000, error: 6000, info: 4000 };

function ToastItem({ toast, onRemove }) {
  const [exiting, setExiting] = useState(false);
  const Icon = ICONS[toast.type] || Info;
  const colors = COLORS[toast.type] || COLORS.info;

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onRemove(toast.id), 200);
    }, toast.duration || DURATIONS[toast.type] || 4000);
    return () => clearTimeout(timer);
  }, [toast, onRemove]);

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg max-w-sm w-full ${colors.bg} ${
        exiting ? 'toast-exit' : 'toast-enter'
      }`}
    >
      <Icon size={18} className={`${colors.icon} flex-shrink-0 mt-0.5`} />
      <p className={`text-sm font-medium flex-1 ${colors.text}`}>{toast.message}</p>
      <button
        onClick={() => { setExiting(true); setTimeout(() => onRemove(toast.id), 200); }}
        className={`${colors.sub} hover:opacity-70 flex-shrink-0 mt-0.5 cursor-pointer`}
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((message, type = 'info', duration) => {
    const id = ++toastId;
    setToasts(prev => [...prev.slice(-4), { id, message, type, duration }]);
  }, []);

  const toast = useCallback({
    success: (msg, duration) => addToast(msg, 'success', duration),
    error: (msg, duration) => addToast(msg, 'error', duration),
    info: (msg, duration) => addToast(msg, 'info', duration),
  }, [addToast]);

  // Fix: useCallback can't wrap an object, use useMemo-like pattern
  const contextValue = React.useMemo(() => ({
    success: (msg, duration) => addToast(msg, 'success', duration),
    error: (msg, duration) => addToast(msg, 'error', duration),
    info: (msg, duration) => addToast(msg, 'info', duration),
  }), [addToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none sm:bottom-6 sm:right-6">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onRemove={removeToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
