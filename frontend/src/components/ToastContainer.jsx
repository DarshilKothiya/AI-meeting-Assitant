import React from 'react';
import { CheckCircleIcon, AlertCircleIcon, SparklesIcon, XIcon } from './Icons';

const ToastContainer = ({ toasts, onDismiss }) => {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast-item toast-${toast.type || 'info'}`}>
          <div className="toast-icon">
            {toast.type === 'success' ? (
              <CheckCircleIcon size={18} />
            ) : toast.type === 'error' ? (
              <AlertCircleIcon size={18} />
            ) : (
              <SparklesIcon size={18} />
            )}
          </div>
          <div className="toast-content">
            {toast.title && <div className="toast-title">{toast.title}</div>}
            <div className="toast-message">{toast.message}</div>
          </div>
          <button
            type="button"
            className="toast-close"
            onClick={() => onDismiss(toast.id)}
            aria-label="Dismiss notification"
          >
            <XIcon size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
