import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ShoppingBag, Package, ShieldCheck, X } from 'lucide-react';
import { formatPrice } from '../utils/format';
import './PaymentSuccessModal.css';

export default function PaymentSuccessModal({
  isOpen,
  orderNumber,
  orderId,
  amount,
  onClose,
}) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleViewOrders = () => {
    if (onClose) onClose();
    navigate('/account/orders');
  };

  const handleContinueShopping = () => {
    if (onClose) onClose();
    navigate('/shop');
  };

  return (
    <div className="payment-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="payment-modal-backdrop" onClick={onClose} />
      <div className="payment-modal-card">
        {onClose && (
          <button
            type="button"
            className="payment-modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        )}

        <div className="payment-modal-icon-wrapper">
          <div className="payment-modal-icon-pulse" />
          <CheckCircle2 size={48} className="payment-modal-icon" />
        </div>

        <h2 id="modal-title" className="payment-modal-title">Order Successful!</h2>
        <p className="payment-modal-message">
          Your payment has been confirmed and your order has been placed successfully.
        </p>

        <div className="payment-modal-details">
          <div className="payment-detail-row">
            <span className="payment-detail-label">Order Number</span>
            <strong className="payment-detail-value">{orderNumber || orderId}</strong>
          </div>
          {amount != null && (
            <div className="payment-detail-row">
              <span className="payment-detail-label">Confirmed Amount</span>
              <strong className="payment-detail-value payment-amount-highlight">
                {formatPrice(amount)}
              </strong>
            </div>
          )}
          <div className="payment-detail-row payment-status-badge-row">
            <span className="payment-detail-label">Payment Status</span>
            <span className="badge badge-success">
              <ShieldCheck size={13} /> Verified by Gateway
            </span>
          </div>
        </div>

        <div className="payment-modal-actions">
          <button
            type="button"
            className="btn btn-primary btn-block payment-modal-btn"
            onClick={handleViewOrders}
          >
            <Package size={17} /> View My Orders
          </button>
          <button
            type="button"
            className="btn btn-outline btn-block payment-modal-btn"
            onClick={handleContinueShopping}
          >
            <ShoppingBag size={17} /> Continue Shopping
          </button>
        </div>
      </div>
    </div>
  );
}
