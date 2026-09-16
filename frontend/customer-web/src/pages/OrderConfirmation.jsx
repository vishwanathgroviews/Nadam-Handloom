import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { api } from '../services/api';
import { formatPrice } from '../utils/format';
import './OrderConfirmation.css';

// Checkout only ever navigates here right after a successful verifyPayment
// call, so the order is paid by the time this normally renders — but the URL
// is bookmarkable/shareable, so a stale or failed order must not still claim
// success if someone revisits it later.
const STATUS_COPY = {
  payment_failed: {
    icon: AlertTriangle,
    iconClass: 'order-confirmation-icon order-confirmation-icon-error',
    title: 'Payment Not Completed',
    message: (orderNumber) => `Order ${orderNumber} was not paid — the payment did not go through.`,
  },
  pending_payment: {
    icon: Clock,
    iconClass: 'order-confirmation-icon order-confirmation-icon-pending',
    title: 'Payment Pending',
    message: (orderNumber) => `Order ${orderNumber} is still awaiting payment confirmation. This can take a moment.`,
  },
};

export default function OrderConfirmation() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getOrder(orderId).then(setOrder).catch(() => setError('We could not find this order.'));
    // The invoice is generated a few seconds after payment (async) — a 404
    // here just means it isn't ready yet, not a real error, so it's fine to
    // simply not show the link rather than surfacing a failure.
    api.getOrderInvoice(orderId).then(setInvoice).catch(() => setInvoice(null));
  }, [orderId]);

  if (error) {
    return (
      <div className="container state-block">
        <h3>{error}</h3>
        <Link to="/account/orders" className="btn btn-outline">View My Orders</Link>
      </div>
    );
  }

  if (!order) return <p className="container state-block">Loading…</p>;

  const statusOverride = STATUS_COPY[order.status];

  if (statusOverride) {
    const { icon: Icon, iconClass, title, message } = statusOverride;
    return (
      <div className="container order-confirmation">
        <div className="order-confirmation-card">
          <Icon size={52} className={iconClass} />
          <h1 className="section-title">{title}</h1>
          <p>{message(order.orderNumber)}</p>
          <div className="order-confirmation-actions">
            <Link to="/checkout" className="btn btn-primary">Try Again</Link>
            <Link to="/account/orders" className="btn btn-outline">View My Orders</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container order-confirmation">
      <div className="order-confirmation-card">
        <CheckCircle2 size={52} className="order-confirmation-icon" />
        <h1 className="section-title">Order Confirmed!</h1>
        <p>Thank you for your purchase. A confirmation has been recorded for order <strong>{order.orderNumber}</strong>.</p>

        <div className="order-confirmation-summary">
          {order.items.map((item) => (
            <div className="checkout-item" key={item.id}>
              {item.imageSnapshot && <img src={item.imageSnapshot} alt={item.nameSnapshot} />}
              <div className="checkout-item-info">
                <span>{item.nameSnapshot}</span>
              </div>
              <span className="checkout-item-price">{formatPrice(item.priceSnapshot * item.quantity)}</span>
            </div>
          ))}
          <div className="cart-summary-row cart-summary-total">
            <span>Total Paid</span>
            <span>{formatPrice(order.total)}</span>
          </div>
        </div>

        <div className="order-confirmation-actions">
          <Link to={`/account/orders/${order.id}`} className="btn btn-primary">Track This Order</Link>
          {invoice && (
            <a href={invoice.url} target="_blank" rel="noopener noreferrer" className="btn btn-outline">Download Invoice</a>
          )}
          <Link to="/shop" className="btn btn-outline">Continue Shopping</Link>
        </div>
      </div>
    </div>
  );
}
