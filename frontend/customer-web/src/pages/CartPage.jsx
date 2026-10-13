import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, ShoppingBag } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { formatPrice } from '../utils/format';
import './CartPage.css';

export default function CartPage() {
  const { items, removeItem, subtotal } = useCart();
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="container state-block cart-empty">
        <div className="cart-empty-icon-wrap">
          <ShoppingBag size={48} className="cart-empty-icon" />
        </div>
        <h2 className="section-title" style={{ fontSize: '1.6rem', marginTop: '12px' }}>Your Cart is Empty</h2>
        <p style={{ maxWidth: '420px', lineHeight: '1.6', color: 'var(--text-muted)' }}>
          Discover the elegance of pure handwoven Mangalagiri pattu silk and cotton sarees crafted by master weavers.
        </p>
        <Link to="/shop" className="btn btn-primary" style={{ marginTop: '14px' }}>
          Explore Handloom Collections
        </Link>
      </div>
    );
  }

  // Nothing is added on top of the items — no shipping fee is ever charged.
  const total = subtotal;

  return (
    <div className="container cart-page">
      <div className="section-header" style={{ marginBottom: '20px' }}>
        <div>
          <h1 className="section-title">Your Cart</h1>
          <p className="section-subtitle">
            {items.length} handwoven item{items.length !== 1 ? 's' : ''} in your cart
          </p>
        </div>
      </div>

      <div className="cart-layout">
        <div className="cart-items">
          {items.map((item) => (
            <div className="cart-item" key={item.productId}>
              <Link to={`/product/${item.slug}`} className="cart-item-image">
                <img src={item.image} alt={item.name} />
              </Link>
              <div className="cart-item-details">
                <Link to={`/product/${item.slug}`} className="cart-item-name">{item.name}</Link>
                <span className="price-current">{formatPrice(item.price)}</span>

                <div className="cart-item-controls">
                  <button className="cart-item-remove" onClick={() => removeItem(item.productId)}>
                    <Trash2 size={14} /> Remove
                  </button>
                </div>
              </div>
              <span className="cart-item-line-total">{formatPrice(item.price)}</span>
            </div>
          ))}
        </div>

        <aside className="cart-summary">
          <h3>Order Summary</h3>
          <div className="cart-summary-row">
            <span>Subtotal</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          <div className="cart-summary-row">
            <span>Shipping</span>
            <span style={{ color: 'var(--success)', fontWeight: 600 }}>FREE (Insured Pan-India)</span>
          </div>
          <div className="cart-summary-row cart-summary-total">
            <span>Total</span>
            <span className="cart-total-amount">{formatPrice(total)}</span>
          </div>
          <button className="btn btn-primary btn-block" onClick={() => navigate('/checkout')} style={{ marginTop: '16px' }}>
            Proceed to Checkout
          </button>
          <div className="cart-summary-trust">
            <span>🔒 Secure 256-Bit SSL Checkout</span>
            <span>🪡 Direct from Mangalagiri Weavers</span>
          </div>
          <Link to="/shop" className="cart-continue-link">← Continue Shopping</Link>
        </aside>
      </div>
    </div>
  );
}
