import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ title, children, onClose }) {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 glass-modal-backdrop flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="glass-card bg-white/90 max-w-lg w-full mx-4 shadow-2xl shadow-indigo-500/10">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200/60">
          <h2 className="text-lg font-semibold text-slate-900 font-[family-name:var(--font-family-heading)]">{title}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer p-1 hover:bg-slate-100 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
