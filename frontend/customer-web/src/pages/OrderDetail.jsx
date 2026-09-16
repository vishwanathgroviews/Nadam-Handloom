import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Truck, Clock, ExternalLink } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatPrice } from '../utils/format';
import './OrderDetail.css';

const STATUS_LABELS = {
  pending_payment: 'Payment Pending',
  paid: 'Paid',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  payment_failed: 'Payment Failed',
};

export default function OrderDetail() {
  const { orderId } = useParams();
  const { status, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'loading') return;
    if (!isAuthenticated) {
      navigate(`/login?redirect=/account/orders/${orderId}`);
      return;
    }
    api.getOrder(orderId).then(setOrder).catch(() => setError('We could not find this order.'));
    api.getOrderTracking(orderId).then(setTracking).catch(() => setTracking(null));
    // A 404 just means no invoice has been generated for this order yet.
    api.getOrderInvoice(orderId).then(setInvoice).catch(() => setInvoice(null));
  }, [orderId, status, isAuthenticated, navigate]);

  if (status === 'loading') return <p className="container state-block">Loading…</p>;

  if (error) {
    return (
      <div className="container state-block">
        <h3>{error}</h3>
        <Link to="/account/orders" className="btn btn-outline">Back to My Orders</Link>
      </div>
    );
  }

  if (!order) return <p className="container state-block">Loading…</p>;

  const address = order.address || order.shippingAddress;

  return (
    <div className="container order-detail">
      <div className="breadcrumb">
        <Link to="/account/orders">My Orders</Link> <span>/</span> <span>{order.orderNumber}</span>
      </div>

      <div className="order-detail-header">
        <div>
          <h1 className="section-title">{order.orderNumber}</h1>
          <p className="section-subtitle">
            Placed on {new Date(order.placedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <span className="badge badge-success">{STATUS_LABELS[order.status] || order.status}</span>
      </div>

      <div className="order-detail-layout">
        <div className="checkout-main">
          <section className="checkout-section">
            <h3><Truck size={17} /> Tracking</h3>
            {tracking?.awbNumber ? (
              <p className="order-tracking-awb">Carrier: {tracking.carrier} · DTDC AWB Number: <strong>{tracking.awbNumber}</strong></p>
            ) : (
              <p className="order-tracking-empty">
                <Clock size={15} /> DTDC AWB number will appear here once your order ships.
              </p>
            )}
            {tracking?.trackingUrl && (
              <a
                href={tracking.trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline btn-sm order-tracking-link"
              >
                {tracking.awbNumber ? 'Track on DTDC' : 'Visit DTDC Tracking'} <ExternalLink size={14} />
              </a>
            )}
          </section>

          <section className="checkout-section">
            <h3>Items</h3>
            <div className="checkout-items">
              {order.items.map((item) => (
                <div className="checkout-item" key={item.id}>
                  {item.imageSnapshot && <img src={item.imageSnapshot} alt={item.nameSnapshot} />}
                  <div className="checkout-item-info">
                    <span>{item.nameSnapshot}</span>
                  </div>
                  <span className="checkout-item-price">{formatPrice(item.priceSnapshot * item.quantity)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="checkout-section">
            <h3>Shipping Address</h3>
            {address && (
              <p className="order-address">
                <strong>{address.fullName}</strong><br />
                {address.line1}{address.line2 ? `, ${address.line2}` : ''}<br />
                {address.city}, {address.state} - {address.pincode}<br />
                Phone: {address.phone}
              </p>
            )}
          </section>
        </div>

        <aside className="cart-summary checkout-summary">
          <h3>Payment Summary</h3>
          <div className="cart-summary-row"><span>Subtotal</span><span>{formatPrice(order.subtotal)}</span></div>
          <div className="cart-summary-row cart-summary-total"><span>Total</span><span>{formatPrice(order.total)}</span></div>
          {invoice && (
            <a href={invoice.url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm order-tracking-link">
              Download Invoice
            </a>
          )}
        </aside>
      </div>
    </div>
  );
}
