import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PackageSearch } from 'lucide-react';
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

export default function MyOrders() {
  const { status, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState(null);

  useEffect(() => {
    if (status === 'loading') return;
    if (!isAuthenticated) {
      navigate('/login?redirect=/account/orders');
      return;
    }
    api.getOrders().then((res) => setOrders(res.items)).catch(() => setOrders([]));
  }, [status, isAuthenticated, navigate]);

  if (status === 'loading' || orders === null) return <p className="container state-block">Loading your orders…</p>;

  if (orders.length === 0) {
    return (
      <div className="container state-block">
        <PackageSearch size={44} />
        <h3>No orders yet</h3>
        <p>Once you place an order, it will show up here.</p>
        <Link to="/shop" className="btn btn-primary">Start Shopping</Link>
      </div>
    );
  }

  return (
    <div className="container my-orders">
      <h1 className="section-title">My Orders</h1>
      <div className="order-list">
        {orders.map((order) => (
          <Link to={`/account/orders/${order.id}`} className="order-list-item" key={order.id}>
            <div>
              <span className="order-list-number">{order.orderNumber}</span>
              <span className="order-list-date">{new Date(order.placedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
            <span className="order-list-items-count">{order.items.length} item{order.items.length !== 1 ? 's' : ''}</span>
            <span className={`badge ${STATUS_VARIANT[order.status] || 'badge-muted'}`}>{STATUS_LABELS[order.status] || order.status}</span>
            <span className="order-list-total">{formatPrice(order.total)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
