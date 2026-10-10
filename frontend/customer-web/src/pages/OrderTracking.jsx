import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Truck, Package, CheckCircle2, Clock, Calendar, ExternalLink,
  ShieldCheck, AlertCircle, ArrowLeft, ChevronRight, MapPin
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatPrice } from '../utils/format';
import './OrderTracking.css';

const DEFAULT_SARRE_IMG = 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=400&q=80';

// Progress steps based on verified order status
const getTimelineSteps = (order) => {
  const isDelivered = order.status === 'delivered';
  const isShipped = isDelivered || order.status === 'shipped';
  const isProcessing = isShipped || order.status === 'processing';
  const isPaid = Boolean(order.payment?.status === 'paid' || isProcessing);

  return [
    {
      label: 'Payment Confirmed',
      desc: order.payment?.method ? `Verified via ${order.payment.method}` : 'Payment successfully verified',
      done: isPaid,
      current: isPaid && !isProcessing,
    },
    {
      label: 'Order Processing',
      desc: 'Quality check & handloom packaging',
      done: isProcessing,
      current: isProcessing && !isShipped,
    },
    {
      label: 'Handed to Courier',
      desc: order.shipment?.carrier ? `${order.shipment.carrier} Courier` : 'DTDC Courier dispatch',
      done: isShipped,
      current: isShipped && !isDelivered,
    },
    {
      label: 'Delivered',
      desc: isDelivered ? 'Handed over successfully' : 'Delivered to your address',
      done: isDelivered,
      current: isDelivered,
    },
  ];
};

export default function OrderTracking() {
  const { status, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetOrderId = searchParams.get('orderId');

  const [orders, setOrders] = useState(null);
  const [trackingMap, setTrackingMap] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'loading') return;
    if (!isAuthenticated) {
      navigate('/login?redirect=/account/tracking');
      return;
    }

    api.getOrders()
      .then(async (res) => {
        const allOrders = res.items || [];
        // Strict filtering: verified payment ONLY. Exclude failed, unpaid, or cancelled.
        const eligible = allOrders.filter((order) => {
          const isPaid =
            order.payment?.status === 'paid' ||
            order.status === 'paid' ||
            order.status === 'processing' ||
            order.status === 'shipped' ||
            order.status === 'delivered';
          const isNotExcluded =
            order.status !== 'cancelled' &&
            order.status !== 'payment_failed' &&
            order.status !== 'pending_payment';
          const paymentNotFailed = order.payment?.status !== 'failed' && order.payment?.status !== 'created';
          return isPaid && isNotExcluded && paymentNotFailed;
        });

        setOrders(eligible);

        // Fetch live tracking details for eligible orders
        const trackings = {};
        await Promise.all(
          eligible.map(async (o) => {
            try {
              trackings[o.id] = await api.getOrderTracking(o.id);
            } catch {
              trackings[o.id] = null;
            }
          })
        );
        setTrackingMap(trackings);
      })
      .catch((err) => {
        setError(err.message || 'Could not load tracking information.');
        setOrders([]);
      });
  }, [status, isAuthenticated, navigate]);

  if (status === 'loading' || orders === null) {
    return (
      <div className="container state-block">
        <div className="loading-spinner" />
        <p>Loading live tracking information…</p>
      </div>
    );
  }

  return (
    <div className="container order-tracking-page">
      <div className="tracking-header-row">
        <div>
          <div className="tracking-breadcrumbs">
            <Link to="/account/orders" className="tracking-back-link">
              <ArrowLeft size={15} /> Back to My Orders
            </Link>
          </div>
          <h1 className="section-title">Order Tracking</h1>
          <p className="tracking-subtitle">
            Live status and courier dispatch details for your confirmed orders
          </p>
        </div>
        <div className="orders-tab-pills">
          <Link to="/account/orders" className="orders-pill">
            All Orders
          </Link>
          <Link to="/account/tracking" className="orders-pill active">
            <Truck size={14} /> Tracking ({orders.length})
          </Link>
        </div>
      </div>

      {error && (
        <div className="alert alert-error tracking-alert">
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="state-block tracking-empty-card">
          <Truck size={52} className="tracking-empty-icon" />
          <h3>No active trackable orders</h3>
          <p>
            Orders appear here once their payment is verified and confirmed.
            Failed, pending, or cancelled orders do not qualify for tracking.
          </p>
          <Link to="/shop" className="btn btn-primary">Start Shopping</Link>
        </div>
      ) : (
        <div className="tracking-cards-list">
          {orders.map((order) => {
            const tracking = trackingMap[order.id] || order.shipment;
            const steps = getTimelineSteps(order);
            const isTarget = targetOrderId === order.id;

            return (
              <div
                className={`tracking-card ${isTarget ? 'is-highlighted' : ''}`}
                key={order.id}
                id={`track-${order.id}`}
              >
                <div className="tracking-card-header">
                  <div>
                    <div className="tracking-order-title-row">
                      <h2 className="tracking-order-number">Order #{order.orderNumber}</h2>
                      <span className="badge badge-success tracking-paid-badge">
                        <ShieldCheck size={13} /> Payment Confirmed
                      </span>
                    </div>
                    <p className="tracking-order-date">
                      <Calendar size={13} /> Placed on{' '}
                      {new Date(order.placedAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="tracking-header-status-badge">
                    <span className="badge badge-primary">
                      {order.status === 'delivered'
                        ? 'Delivered'
                        : order.status === 'shipped'
                        ? 'Shipped & In Transit'
                        : 'Processing'}
                    </span>
                  </div>
                </div>

                {/* Tracking Timeline */}
                <div className="tracking-timeline-section">
                  <div className="tracking-timeline-grid">
                    {steps.map((st, idx) => (
                      <div
                        key={st.label}
                        className={`timeline-step ${st.done ? 'step-done' : ''} ${st.current ? 'step-current' : ''}`}
                      >
                        <div className="timeline-marker">
                          {st.done ? (
                            <CheckCircle2 size={16} />
                          ) : (
                            <span className="timeline-step-num">{idx + 1}</span>
                          )}
                        </div>
                        <div className="timeline-content">
                          <p className="timeline-step-title">{st.label}</p>
                          <p className="timeline-step-desc">{st.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Live Courier & Dispatch Details */}
                <div className="tracking-dispatch-box">
                  <div className="tracking-dispatch-header">
                    <Truck size={18} className="tracking-dispatch-icon" />
                    <div>
                      <h3 className="tracking-dispatch-title">
                        {tracking?.awbNumber
                          ? `Dispatched via ${tracking.carrier || 'DTDC'}`
                          : 'Shipment & Courier Information'}
                      </h3>
                      <p className="tracking-dispatch-subtitle">
                        {tracking?.awbNumber
                          ? 'Courier tracking number is active'
                          : 'Shipment details are updated once the package is handed to the courier'}
                      </p>
                    </div>
                  </div>

                  {tracking?.awbNumber ? (
                    <div className="tracking-awb-details-row">
                      <div className="tracking-awb-data">
                        <span className="tracking-awb-label">Courier Carrier:</span>
                        <strong className="tracking-awb-carrier">{tracking.carrier || 'DTDC'}</strong>
                      </div>
                      <div className="tracking-awb-data">
                        <span className="tracking-awb-label">AWB / Tracking Number:</span>
                        <code className="tracking-awb-code">{tracking.awbNumber}</code>
                      </div>
                      {tracking.trackingUrl && (
                        <a
                          href={tracking.trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-outline btn-sm tracking-external-btn"
                        >
                          Track on DTDC Portal <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                  ) : (
                    <div className="tracking-awaiting-dispatch-notice">
                      <Clock size={16} />
                      <p>
                        Order is currently in processing. DTDC AWB tracking details will be generated
                        and shown here as soon as master weavers dispatch your saree.
                      </p>
                    </div>
                  )}
                </div>

                {/* Saree Line Items with Direct PDP links */}
                <div className="tracking-items-preview">
                  <p className="tracking-items-heading">Items in this shipment:</p>
                  <div className="tracking-items-row">
                    {order.items.map((item) => (
                      <Link
                        to={`/product/${item.productId}`}
                        key={item.id}
                        className="tracking-item-chip"
                        title={`View ${item.nameSnapshot}`}
                      >
                        <img
                          src={item.imageSnapshot || DEFAULT_SARRE_IMG}
                          alt={item.nameSnapshot}
                          onError={(e) => { e.currentTarget.src = DEFAULT_SARRE_IMG; }}
                        />
                        <div className="tracking-item-chip-info">
                          <span className="tracking-item-chip-name">{item.nameSnapshot}</span>
                          <span className="tracking-item-chip-qty">Qty: {item.quantity} · {formatPrice(item.priceSnapshot)}</span>
                        </div>
                        <ChevronRight size={14} className="tracking-item-chip-arrow" />
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Footer with Verified Amount and Details link */}
                <div className="tracking-card-footer">
                  <div className="tracking-footer-payment">
                    <span className="tracking-footer-label">Confirmed Payment Amount:</span>
                    <strong className="tracking-footer-amount">{formatPrice(order.total)}</strong>
                  </div>
                  <Link to={`/account/orders/${order.id}`} className="btn btn-outline btn-sm">
                    View Full Order Details & Invoice
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
