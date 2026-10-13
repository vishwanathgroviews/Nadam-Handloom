import React from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import './CartToast.css';

/**
 * Toast popup for cart operations.
 * Automatically dismisses after 2-3 seconds, provides checkmark icon,
 * and maintains Nandam Handlooms luxury aesthetics.
 */
export default function CartToast({ toast, onDismiss }) {
  if (!toast) return null;

  const isSuccess = toast.type !== 'error';

  return (
    <aside
      className={`cart-toast ${isSuccess ? 'cart-toast-success' : 'cart-toast-error'}`}
      role="status"
      aria-live="polite"
    >
      <div className="cart-toast-icon-wrap">
        {isSuccess ? (
          <CheckCircle2 size={20} className="cart-toast-icon" />
        ) : (
          <AlertCircle size={20} className="cart-toast-icon" />
        )}
      </div>
      <p className="cart-toast-message">{toast.message}</p>
      <button
        type="button"
        className="cart-toast-close"
        onClick={onDismiss}
        aria-label="Dismiss notification"
      >
        <X size={15} />
      </button>
    </aside>
  );
}
