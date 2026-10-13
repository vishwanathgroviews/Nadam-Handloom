import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Truck, Clock, ExternalLink, RefreshCw, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatPrice } from '../utils/format';
import { loadRazorpayScript } from '../utils/razorpay';
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

const STATUS_VARIANT = {
  delivered: 'badge-success',
  processing: 'badge-success',
  shipped: 'badge-success',
  paid: 'badge-success',
  payment_failed: 'badge-danger',
  cancelled: 'badge-danger',
  pending_payment: 'badge-muted',
};

export default function OrderDetail() {
  const { orderId } = useParams();
  const { status, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [error, setError] = useState('');
  const [retryingPayment, setRetryingPayment] = useState(false);
  const [paymentNotice, setPaymentNotice] = useState('');

  const loadOrderDetails = useCallback(() => {
    api.getOrder(orderId).then(setOrder).catch(() => setError('We could not find this order.'));
    api.getOrderTracking(orderId).then(setTracking).catch(() => setTracking(null));
    api.getOrderInvoice(orderId).then(setInvoice).catch(() => setInvoice(null));
  }, [orderId]);

  useEffect(() => {
    if (status === 'loading') return;
    if (!isAuthenticated) {
      navigate(`/login?redirect=/account/orders/${orderId}`);
      return;
    }
    loadOrderDetails();
  }, [orderId, status, isAuthenticated, navigate, loadOrderDetails]);

  const handleRetryPayment = async () => {
    if (!order) return;
    setRetryingPayment(true);
    setPaymentNotice('');
    try {
      const retryResult = await api.retryPayment(order.id);
      const { razorpayOrderId, amount, currency, razorpayKeyId } = retryResult;

      if (!razorpayKeyId) {
        setPaymentNotice('Online payments are not configured yet. Please contact support.');
        setRetryingPayment(false);
        return;
      }

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        setPaymentNotice('Could not load payment gateway. Please check your connection.');
        setRetryingPayment(false);
        return;
      }

      let isSuccessHandled = false;
      const razorpay = new window.Razorpay({
        key: razorpayKeyId,
        amount: Math.round(amount * 100),
        currency,
        order_id: razorpayOrderId,
        name: 'Nandam Handlooms',
        description: 'Handloom saree order',
        prefill: { name: user?.userProfile?.displayName, email: user?.email, contact: user?.phone },
        theme: { color: '#245B57' },
        handler: async (response) => {
          isSuccessHandled = true;
          try {
            await api.verifyPayment(order.id, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            loadOrderDetails();
            setPaymentNotice('Payment successful! Your order is being processed.');
          } catch (err) {
            setPaymentNotice(err.message || 'Payment verification failed. Please contact support.');
            loadOrderDetails();
          } finally {
            setRetryingPayment(false);
          }
        },
        modal: {
          ondismiss: async () => {
            if (isSuccessHandled) return;
            setRetryingPayment(false);
            try {
              await api.cancelOrder(order.id, 'cancelled');
            } catch (e) {
              console.error('Failed to notify cancellation', e);
            }
            loadOrderDetails();
            setPaymentNotice('Payment cancelled. Your order was not confirmed. You can try again.');
          },
        },
      });

      razorpay.on('payment.failed', async () => {
        isSuccessHandled = true;
        setRetryingPayment(false);
        try {
          await api.cancelOrder(order.id, 'failed');
        } catch (e) {
          console.error('Failed to notify payment failure', e);
        }
        loadOrderDetails();
        setPaymentNotice('Payment failed. Please try again.');
      });

      razorpay.open();
    } catch (err) {
      setPaymentNotice(err.message || 'Could not retry payment for this order.');
      setRetryingPayment(false);
      loadOrderDetails();
    }
  };

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
  const isUnpaid = ['pending_payment', 'payment_failed', 'cancelled'].includes(order.status);

  return (
    <div className="container order-detail">
      <div className="order-detail-header">
        <div>
          <h1 className="section-title">{order.orderNumber}</h1>
          <p className="section-subtitle">
            Placed on {new Date(order.placedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <span className={`badge ${STATUS_VARIANT[order.status] || 'badge-muted'}`}>
          {STATUS_LABELS[order.status] || order.status}
        </span>
      </div>

      {paymentNotice && (
        <div className={`alert ${order.status === 'processing' || order.status === 'paid' ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: '1.5rem' }}>
          <AlertCircle size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
          <span>{paymentNotice}</span>
        </div>
      )}

      {isUnpaid && (
        <div className="alert alert-info" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>
            {order.status === 'cancelled'
              ? 'Payment was cancelled. You can retry payment below to confirm your saree purchase.'
              : order.status === 'payment_failed'
              ? 'Payment was unsuccessful. You can retry payment below.'
              : 'Payment is pending. Please complete payment to confirm your order.'}
          </span>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleRetryPayment}
            disabled={retryingPayment}
            style={{ marginLeft: '12px', whiteSpace: 'nowrap' }}
          >
            <RefreshCw size={14} style={{ marginRight: '6px', animation: retryingPayment ? 'spin 1s linear infinite' : 'none' }} />
            {retryingPayment ? 'Opening gateway…' : 'Retry Payment'}
          </button>
        </div>
      )}

      <div className="order-detail-layout">
        <div className="checkout-main">
          {!isUnpaid && (
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
          )}

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
          {isUnpaid && (
            <button
              type="button"
              className="btn btn-primary btn-block"
              style={{ marginTop: '1rem' }}
              onClick={handleRetryPayment}
              disabled={retryingPayment}
            >
              <RefreshCw size={15} style={{ marginRight: '6px' }} />
              {retryingPayment ? 'Opening gateway…' : 'Retry Payment'}
            </button>
          )}
          {invoice && (
            <a href={invoice.url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm order-tracking-link" style={{ marginTop: '0.75rem' }}>
              Download Invoice
            </a>
          )}
        </aside>
      </div>
    </div>
  );
}
