import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogIn, UserPlus, Plus, CheckCircle2, Trash2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { api } from '../services/api';
import AddressForm from '../components/AddressForm';
import { formatPrice } from '../utils/format';
import { loadRazorpayScript } from '../utils/razorpay';
import './CheckoutPage.css';

export default function CheckoutPage() {
  const { isAuthenticated, status, user } = useAuth();
  const { items, subtotal, itemCount, removeItem, clearCart } = useCart();
  const navigate = useNavigate();

  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [error, setError] = useState('');
  // productId -> { availableCount, isPurchasable }. Null until the first
  // check returns, so the pay button isn't blocked on a slow network.
  const [availability, setAvailability] = useState(null);

  // Re-checked whenever the cart changes, so removing the sold-out line
  // clears the block immediately.
  useEffect(() => {
    const productIds = items.map((i) => i.productId);
    if (productIds.length === 0) {
      setAvailability({});
      return;
    }
    let cancelled = false;
    api.getAvailability(productIds)
      .then((rows) => {
        if (cancelled) return;
        setAvailability(Object.fromEntries(rows.map((r) => [r.productId, r])));
      })
      .catch(() => {
        // A failed check must not strand the customer: the atomic claim at
        // reservation time is still the real guard.
        if (!cancelled) setAvailability({});
      });
    return () => { cancelled = true; };
  }, [items]);

  useEffect(() => {
    if (!isAuthenticated) return;
    api.getAddresses().then((list) => {
      setAddresses(list);
      const preferred = list.find((a) => a.isDefault) || list[0];
      if (preferred) setSelectedAddressId(preferred.id);
      if (list.length === 0) setShowAddressForm(true);
    }).catch(() => {});
  }, [isAuthenticated]);

  if (status === 'loading') {
    return <p className="container state-block">Loading…</p>;
  }

  if (items.length === 0) {
    return (
      <div className="container state-block">
        <h3>Your cart is empty</h3>
        <p>Add something to your cart before checking out.</p>
        <Link to="/shop" className="btn btn-primary">Shop Now</Link>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="container checkout-auth-gate">
        <div className="checkout-auth-card">
          <h2 className="section-title">Sign in to continue</h2>
          <p>Please log in or create an account to complete your order. Your cart will be right here waiting.</p>
          <div className="checkout-auth-actions">
            <Link to="/login?redirect=/checkout" className="btn btn-primary btn-block">
              <LogIn size={17} /> Sign In
            </Link>
            <Link to="/register?redirect=/checkout" className="btn btn-outline btn-block">
              <UserPlus size={17} /> Create Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Nothing is added on top of the items — no shipping fee is ever charged.
  const total = subtotal;

  const stockFor = (item) => availability?.[item.productId];
  const isShort = (item) => {
    const row = stockFor(item);
    if (!row) return false;
    return !row.isPurchasable || row.availableCount < 1;
  };
  const unavailableItems = items.filter(isShort);
  const hasUnavailable = unavailableItems.length > 0;

  const handleSaveAddress = async (form) => {
    setSavingAddress(true);
    setError('');
    try {
      const address = await api.createAddress(form);
      setAddresses((prev) => [address, ...prev]);
      setSelectedAddressId(address.id);
      setShowAddressForm(false);
    } catch (err) {
      setError(err.message || 'Could not save address');
    } finally {
      setSavingAddress(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (hasUnavailable) {
      setError("Can't proceed, some of the products are out of stock");
      return;
    }
    if (!selectedAddressId) {
      setError('Please select or add a shipping address');
      return;
    }
    setError('');
    setPlacingOrder(true);
    try {
      const checkoutResult = await api.checkout({
        // Always one piece per line — see CartContext.
        items: items.map((i) => ({ productId: i.productId, quantity: 1 })),
        addressId: selectedAddressId,
      });

      const { orderId, razorpayOrderId, amount, currency, razorpayKeyId } = checkoutResult;

      if (!razorpayKeyId) {
        setError('Online payments are not configured yet. Please contact support to complete this order.');
        setPlacingOrder(false);
        return;
      }

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        setError('Could not load the payment gateway. Please check your connection and try again.');
        setPlacingOrder(false);
        return;
      }

      const razorpay = new window.Razorpay({
        key: razorpayKeyId,
        amount: Math.round(amount * 100),
        currency,
        order_id: razorpayOrderId,
        name: 'Nandam Handlooms',
        description: 'Handloom saree order',
        prefill: { name: user?.userProfile?.displayName, email: user?.email, contact: user?.phone },
        theme: { color: '#7A1F2B' },
        handler: async (response) => {
          try {
            await api.verifyPayment(orderId, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            clearCart();
            navigate(`/order-confirmation/${orderId}`);
          } catch (err) {
            setError(err.message || 'Payment verification failed. Please contact support.');
            setPlacingOrder(false);
          }
        },
        modal: {
          ondismiss: () => setPlacingOrder(false),
        },
      });

      razorpay.on('payment.failed', () => {
        setError('Payment failed. Please try again.');
        setPlacingOrder(false);
      });

      razorpay.open();
    } catch (err) {
      setError(err.message || 'Could not place order');
      setPlacingOrder(false);
    }
  };

  return (
    <div className="container checkout-page">
      <h1 className="section-title">Checkout</h1>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="checkout-layout">
        <div className="checkout-main">
          <section className="checkout-section">
            <div className="checkout-section-header">
              <h3>Shipping Address</h3>
              {addresses.length > 0 && !showAddressForm && (
                <button className="section-link" onClick={() => setShowAddressForm(true)}>
                  <Plus size={14} /> Add new
                </button>
              )}
            </div>

            {!showAddressForm && addresses.length > 0 && (
              <div className="address-list">
                {addresses.map((addr) => (
                  <label key={addr.id} className={`address-option ${selectedAddressId === addr.id ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="address"
                      checked={selectedAddressId === addr.id}
                      onChange={() => setSelectedAddressId(addr.id)}
                    />
                    <div>
                      <strong>{addr.fullName}</strong> · {addr.phone}
                      <p>{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}, {addr.city}, {addr.state} - {addr.pincode}</p>
                    </div>
                    {selectedAddressId === addr.id && <CheckCircle2 size={18} className="address-selected-icon" />}
                  </label>
                ))}
              </div>
            )}

            {showAddressForm && (
              <AddressForm
                onSubmit={handleSaveAddress}
                onCancel={addresses.length > 0 ? () => setShowAddressForm(false) : undefined}
                submitting={savingAddress}
              />
            )}
          </section>

          <section className="checkout-section">
            <h3>Order Items <span className="checkout-item-count">({itemCount})</span></h3>
            {hasUnavailable && (
              <div className="checkout-stock-alert" role="alert">
                <AlertTriangle size={17} />
                <div>
                  <strong>Can't proceed, some of the products are out of stock</strong>
                  <p>Remove {unavailableItems.length === 1 ? 'it' : 'them'} below to continue.</p>
                </div>
              </div>
            )}
            <div className="checkout-items">
              {items.map((item) => {
                const row = stockFor(item);
                const short = isShort(item);
                return (
                  <div className={`checkout-item${short ? ' checkout-item-unavailable' : ''}`} key={item.productId}>
                    <img src={item.image} alt={item.name} />
                    <div className="checkout-item-info">
                      <span>{item.name}</span>
                      {short && (
                        <span className="checkout-item-stock">
                          {row && row.availableCount > 0
                            ? `Only ${row.availableCount} left`
                            : 'Out of stock'}
                        </span>
                      )}
                    </div>
                    <span className="checkout-item-price">{formatPrice(item.price)}</span>
                    <button
                      type="button"
                      className="checkout-item-remove"
                      onClick={() => { removeItem(item.productId); setError(''); }}
                      aria-label={`Remove ${item.name} from this order`}
                      title="Remove from order"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="cart-summary checkout-summary">
          <h3>Order Summary</h3>
          <div className="cart-summary-row">
            <span>Subtotal ({itemCount} item{itemCount === 1 ? '' : 's'})</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          <div className="cart-summary-row cart-summary-total">
            <span>Total</span>
            <span>{formatPrice(total)}</span>
          </div>
          <button
            className="btn btn-primary btn-block"
            onClick={handlePlaceOrder}
            disabled={placingOrder || hasUnavailable}
          >
            {placingOrder ? 'Processing…' : 'Pay & Place Order'}
          </button>
          <p className="checkout-secure-note">Payments are securely processed via Razorpay.</p>
        </aside>
      </div>
    </div>
  );
}
