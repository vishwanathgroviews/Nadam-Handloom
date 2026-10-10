import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PackageSearch, Truck, ExternalLink, Calendar, CreditCard, ChevronRight, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatPrice } from '../utils/format';
import './MyOrders.css';

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

const PAYMENT_STATUS_LABELS = {
  paid: 'Payment Confirmed',
  failed: 'Payment Failed',
  created: 'Pending Payment',
  pending: 'Payment Pending',
};

const DEFAULT_SARRE_IMG = 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=400&q=80';

export default function MyOrders() {
  const { status, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'loading') return;
    if (!isAuthenticated) {
      navigate('/login?redirect=/account/orders');
      return;
    }
    api.getOrders()
      .then((res) => setOrders(res.items || []))
      .catch((err) => {
        setError(err.message || 'Failed to load orders.');
        setOrders([]);
      });
  }, [status, isAuthenticated, navigate]);

  if (status === 'loading' || orders === null) {
    return (
      <div className="container state-block">
        <div className="loading-spinner" />
        <p>Loading your orders…</p>
      </div>
    );
  }

  return (
    <div className="container my-orders">
      <div className="orders-header-row">
        <div>
          <h1 className="section-title">My Orders</h1>
          <p className="orders-subtitle">Review previous purchases, status, and track your handwoven sarees</p>
        </div>
        <div className="orders-tab-pills">
          <Link to="/account/orders" className="orders-pill active">
            All Orders ({orders.length})
          </Link>
          <Link to="/account/tracking" className="orders-pill">
            <Truck size={14} /> Order Tracking
          </Link>
        </div>
      </div>

      {error && (
        <div className="alert alert-error orders-alert">
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="state-block orders-empty-card">
          <PackageSearch size={52} className="orders-empty-icon" />
          <h3>No orders yet</h3>
          <p>Once you place an order, all your details and tracking will appear here.</p>
          <Link to="/shop" className="btn btn-primary">Start Shopping</Link>
        </div>
      ) : (
        <div className="order-cards-container">
          {orders.map((order) => {
            const isPaid = order.payment?.status === 'paid' || order.status === 'paid' || order.status === 'processing' || order.status === 'shipped' || order.status === 'delivered';
            const isEligibleForTracking = isPaid && order.status !== 'cancelled' && order.status !== 'payment_failed';

            return (
              <div className="order-card" key={order.id}>
                <div className="order-card-header">
                  <div className="order-meta-group">
                    <span className="order-number-tag">Order #{order.orderNumber}</span>
                    <span className="order-meta-date">
                      <Calendar size={13} />
                      {new Date(order.placedAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <div className="order-badges-group">
                    {order.payment && (
                      <span className={`badge ${order.payment.status === 'paid' ? 'badge-success' : order.payment.status === 'failed' ? 'badge-danger' : 'badge-muted'}`}>
                        <CreditCard size={12} /> {PAYMENT_STATUS_LABELS[order.payment.status] || order.payment.status}
                      </span>
                    )}
                    <span className={`badge ${STATUS_VARIANT[order.status] || 'badge-muted'}`}>
                      {STATUS_LABELS[order.status] || order.status}
                    </span>
                  </div>
                </div>

                {/* Items List with Tappable Saree Name & Image to PDP */}
                <div className="order-items-list">
                  {order.items.map((item) => {
                    const productLink = `/product/${item.productId}`;
                    return (
                      <div className="order-item-row" key={item.id}>
                        <Link to={productLink} className="order-item-thumb" title={`View ${item.nameSnapshot}`}>
                          <img
                            src={item.imageSnapshot || DEFAULT_SARRE_IMG}
                            alt={item.nameSnapshot}
                            onError={(e) => { e.currentTarget.src = DEFAULT_SARRE_IMG; }}
                          />
                        </Link>
                        <div className="order-item-details">
                          <Link to={productLink} className="order-item-name">
                            {item.nameSnapshot}
                          </Link>
                          <div className="order-item-meta">
                            <span className="order-item-qty">Qty: {item.quantity}</span>
                            <span className="order-item-unit-price">
                              {formatPrice(item.priceSnapshot)} each
                            </span>
                          </div>
                          <Link to={productLink} className="order-view-saree-link">
                            View saree details & current stock <ChevronRight size={13} />
                          </Link>
                        </div>
                        <div className="order-item-line-total">
                          {formatPrice(item.priceSnapshot * item.quantity)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="order-card-footer">
                  <div className="order-total-block">
                    <span className="order-total-label">Order Total:</span>
                    <span className="order-total-value">{formatPrice(order.total)}</span>
                  </div>
                  <div className="order-actions-group">
                    <Link to={`/account/orders/${order.id}`} className="btn btn-outline btn-sm">
                      Details & Invoice
                    </Link>
                    {isEligibleForTracking && (
                      <Link to={`/account/tracking?orderId=${order.id}`} className="btn btn-primary btn-sm">
                        <Truck size={14} /> Track Order
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
